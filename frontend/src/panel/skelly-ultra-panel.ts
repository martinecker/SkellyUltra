import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { errorMessage } from "../api/actions";
import { listDevices } from "../api/devices";
import { RETRY_DELAYS } from "../api/files-subscription";
import type { SkellyDevice } from "../api/types";
import type { HomeAssistant, PanelInfo } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";
import type { DetailsEventDetail } from "./sk-skelly-files";

export interface PanelConfig {
	// Hash of the bundle that the backend serves; compared with the running
	// bundle's own hash in a later phase, to offer a reload after an update
	version?: string;
}

// URL query parameter naming a Skelly to show (its device_id or entry_id),
// repeated for each one, so a dashboard card can link to its Skelly. Without
// it, the Skellies last ticked in this browser are shown, or all of them.
const DEVICE_PARAM = "device";

// Below this width (in px) the files are a list instead of a table
const COMPACT_WIDTH = 600;

// localStorage key remembering whether the Details columns are shown
const DETAILS_KEY = "skelly_ultra.panel.details";

function storedDetails(): boolean {
	try {
		return localStorage.getItem(DETAILS_KEY) === "1";
	} catch {
		return false;
	}
}

// The id a Skelly is chosen by: its device_id, or its entry_id without one
const idOf = (device: SkellyDevice) => device.device_id ?? device.entry_id;

// localStorage key remembering the Skellies last ticked in this browser
const SELECTION_KEY = "skelly_ultra.panel.skellies";

// The Skellies to show when the panel opens: the ones named in the page's
// URL (e.g. a card's link), else the ones last ticked in this browser;
// undefined: all of them
function initialSelection(): ReadonlySet<string> | undefined {
	const ids = new URLSearchParams(window.location.search).getAll(DEVICE_PARAM);
	if (ids.length) {
		return new Set(ids);
	}
	try {
		const stored: unknown = JSON.parse(
			localStorage.getItem(SELECTION_KEY) ?? "null",
		);
		if (
			Array.isArray(stored) &&
			stored.length &&
			stored.every((id) => typeof id === "string")
		) {
			return new Set(stored);
		}
	} catch {
		// Not readable, e.g. in a private window, or not valid: show all
	}
	return undefined;
}

// The Skelly sidebar panel. Home Assistant creates it and sets hass, narrow,
// route and panel. It shows the files of the chosen Skellies (all of them
// unless the user unticks some), one card each, live, and plays, stops,
// edits, reorders, deletes and adds them.
export class SkellyUltraPanel extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean, reflect: true }) narrow = false;
	@property({ attribute: false }) panel?: PanelInfo<PanelConfig>;

	@state() private _devices?: SkellyDevice[];
	@state() private _devicesError?: string;
	// device_ids or entry_ids of the chosen Skellies; undefined: all of them
	@state() private _selected?: ReadonlySet<string>;
	// Lists files instead of a table: the panel is less than 600 px wide
	@state() private _compact = false;
	@state() private _details = storedDetails();
	// entry_id of the Skelly a new file is being sent to
	@state() private _sendingTo?: string;

	private _loadingDevices = false;
	private _devicesAttempted = false;
	private _devicesRetryTimer?: ReturnType<typeof setTimeout>;
	private _devicesRetries = 0;
	private _resizeObserver?: ResizeObserver;

	connectedCallback(): void {
		super.connectedCallback();
		this._selected = initialSelection();
		if (typeof ResizeObserver !== "undefined") {
			this._resizeObserver = new ResizeObserver((entries) => {
				const width = entries[0]?.contentRect.width ?? 0;
				// 0: not laid out (yet); keep what we have
				if (width > 0) {
					this._compact = width < COMPACT_WIDTH;
				}
			});
			this._resizeObserver.observe(this);
		}
		// Back on the page after an error or with no Skelly: look again
		if (this.hass && !this._devices?.length && !this._loadingDevices) {
			this._loadDevices();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this._resizeObserver?.disconnect();
		this._resizeObserver = undefined;
		clearTimeout(this._devicesRetryTimer);
		this._devicesRetryTimer = undefined;
	}

	protected willUpdate(changed: Map<PropertyKey, unknown>): void {
		// Only the first attempt starts here (HA sets hass on every state
		// change); later ones come from the retry timer or connectedCallback
		if (changed.has("hass") && this.hass && !this._devicesAttempted) {
			this._loadDevices();
		}
	}

	private async _loadDevices(): Promise<void> {
		if (!this.hass) {
			return;
		}
		clearTimeout(this._devicesRetryTimer);
		this._devicesRetryTimer = undefined;
		this._devicesAttempted = true;
		this._loadingDevices = true;
		try {
			this._devices = await listDevices(this.hass);
			this._devicesError = undefined;
		} catch (err) {
			this._devicesError = errorMessage(err);
		} finally {
			this._loadingDevices = false;
		}
		// During HA startup the integration may not be loaded yet: look again
		// later, with the subscription's backoff
		if (this._devices?.length && !this._devicesError) {
			this._devicesRetries = 0;
		} else if (this.isConnected) {
			const delay =
				RETRY_DELAYS[Math.min(this._devicesRetries, RETRY_DELAYS.length - 1)];
			this._devicesRetries++;
			this._devicesRetryTimer = setTimeout(
				() => this._loadDevices(),
				delay * 1000,
			);
		}
	}

	// The Skellies shown, in the order of the list. A link or remembered
	// choice naming no Skelly that's still there (e.g. one since removed)
	// shows all of them.
	private get _shown(): SkellyDevice[] {
		const devices = this._devices ?? [];
		const selected = this._selected;
		if (!selected) {
			return devices;
		}
		const shown = devices.filter(
			(d) =>
				selected.has(d.entry_id) ||
				(d.device_id !== null && selected.has(d.device_id)),
		);
		return shown.length || !selected.size ? shown : devices;
	}

	private _onAllChange(ev: Event): void {
		const checked = (ev.target as HTMLInputElement).checked;
		this._select(checked ? undefined : new Set());
	}

	private _onDeviceToggle(device: SkellyDevice, ev: Event): void {
		const checked = (ev.target as HTMLInputElement).checked;
		const ids = new Set(this._shown.map(idOf));
		if (checked) {
			ids.add(idOf(device));
		} else {
			ids.delete(idOf(device));
		}
		const all = (this._devices ?? []).every((d) => ids.has(idOf(d)));
		this._select(all ? undefined : ids);
	}

	// Shows the given Skellies (undefined: all of them), and keeps them in the
	// URL and in this browser, so a reload or the next visit shows the same
	// ones. None ticked isn't kept: that shows all of them next time.
	private _select(selected: ReadonlySet<string> | undefined): void {
		this._selected = selected;
		const ids = [...(selected ?? [])];
		const url = new URL(window.location.href);
		url.searchParams.delete(DEVICE_PARAM);
		for (const id of ids) {
			url.searchParams.append(DEVICE_PARAM, id);
		}
		history.replaceState(history.state, "", url);
		try {
			if (ids.length) {
				localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
			} else {
				localStorage.removeItem(SELECTION_KEY);
			}
		} catch {
			// Not remembered, e.g. in a private window
		}
	}

	private readonly _onSending = (entryId: string, sending: boolean): void => {
		if (sending) {
			this._sendingTo = entryId;
		} else if (this._sendingTo === entryId) {
			this._sendingTo = undefined;
		}
	};

	private _onDetails(ev: CustomEvent<DetailsEventDetail>): void {
		this._details = ev.detail.details;
		try {
			localStorage.setItem(DETAILS_KEY, this._details ? "1" : "0");
		} catch {
			// Not remembered, e.g. in a private window
		}
	}

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
				min-height: 100%;
				background-color: var(--primary-background-color);
			}

			.toolbar {
				display: flex;
				align-items: center;
				gap: 8px;
				box-sizing: border-box;
				height: var(--header-height, 56px);
				padding: 0 16px;
				background-color: var(--app-header-background-color, var(--primary-color));
				color: var(--app-header-text-color, var(--text-primary-color, #fff));
				border-bottom: var(--app-header-border-bottom, none);
				font-size: 20px;
			}

			:host([narrow]) .toolbar {
				padding-left: 4px;
			}

			.title {
				flex: 1;
			}

			.content {
				display: flex;
				flex-direction: column;
				gap: 16px;
				padding: 16px;
			}

			ha-card {
				padding: 8px 16px 16px;
			}

			:host([narrow]) .content {
				gap: 8px;
				padding: 8px;
			}

			:host([narrow]) ha-card {
				padding: 8px 12px 12px;
			}

			.picker {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			.picker label {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				box-sizing: border-box;
				min-height: 32px;
				padding: 4px 12px 4px 8px;
				border: 1px solid var(--divider-color);
				border-radius: 16px;
				background: var(--card-background-color);
				font-size: 14px;
				cursor: pointer;
			}

			.picker label.checked {
				border-color: var(--primary-color);
			}

			.picker input {
				margin: 0;
				accent-color: var(--primary-color);
			}

			.error {
				color: var(--error-color, #db4437);
			}
		`,
	];

	protected render() {
		return html`
			<div class="toolbar">
				${
					this.narrow
						? html`<ha-icon-button
								.label=${strings.openSidebar}
								@click=${this._toggleSidebar}
							>
								<ha-icon icon="mdi:menu"></ha-icon>
							</ha-icon-button>`
						: nothing
				}
				<div class="title">${strings.panelTitle}</div>
			</div>
			<div class="content">${this._renderContent()}</div>
		`;
	}

	private _renderContent() {
		if (this._devicesError) {
			return html`<ha-card>
				<p class="error">${strings.devicesFailed(this._devicesError)}</p>
			</ha-card>`;
		}
		if (!this._devices) {
			return html`<ha-card>
				<p class="secondary">${strings.loadingDevices}</p>
			</ha-card>`;
		}
		if (!this._devices.length) {
			return html`<ha-card><p>${strings.noDevices}</p></ha-card>`;
		}
		const shown = this._shown;
		const several = this._devices.length > 1;
		return html`
			${several ? this._renderPicker(this._devices, shown) : nothing}
			${
				shown.length
					? repeat(
							shown,
							(d) => d.entry_id,
							(d) => html`<sk-skelly-files
								.hass=${this.hass}
								.device=${d}
								?narrow=${this.narrow}
								?compact=${this._compact}
								?details=${this._details}
								?named=${shown.length > 1}
								.sendingTo=${this._sendingTo}
								.onSending=${this._onSending}
								@sk-details=${this._onDetails}
							></sk-skelly-files>`,
						)
					: html`<ha-card>
							<p class="secondary none">${strings.noneChosen}</p>
						</ha-card>`
			}
		`;
	}

	// A checkbox per Skelly, and one for all of them
	private _renderPicker(devices: SkellyDevice[], shown: SkellyDevice[]) {
		const all = shown.length === devices.length;
		return html`<div
			class="picker"
			role="group"
			aria-label=${strings.skelliesShown}
		>
			<label class=${all ? "all checked" : "all"}>
				<input
					type="checkbox"
					.checked=${live(all)}
					.indeterminate=${live(!all && shown.length > 0)}
					@change=${this._onAllChange}
				/>
				${strings.allSkellies}
			</label>
			${devices.map((d) => {
				const checked = shown.includes(d);
				return html`<label
					class=${checked ? "checked" : ""}
					data-entry-id=${d.entry_id}
				>
					<input
						type="checkbox"
						.checked=${live(checked)}
						@change=${(ev: Event) => this._onDeviceToggle(d, ev)}
					/>
					${d.name}
				</label>`;
			})}
		</div>`;
	}

	// What HA's own menu button does: the sidebar is hidden on narrow screens
	private _toggleSidebar() {
		this.dispatchEvent(
			new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
		);
	}
}
