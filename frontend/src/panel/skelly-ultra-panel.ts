import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { errorMessage } from "../api/actions";
import { listDevices } from "../api/devices";
import { FilesSubscription } from "../api/files-subscription";
import { type SkellyDevice, targetOf } from "../api/types";
import type { HomeAssistant, PanelInfo } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

export interface PanelConfig {
	// Hash of the bundle that the backend serves; compared with the running
	// bundle's own hash in a later phase, to offer a reload after an update
	version?: string;
}

// URL query parameter naming the Skelly to show (its device_id or entry_id),
// so a dashboard card can link to its Skelly
const DEVICE_PARAM = "device";

// The Skelly sidebar panel. Home Assistant creates it and sets hass, narrow,
// route and panel. For now it shows a device picker and the live files
// payload; the file table replaces the raw data in the next phase.
export class SkellyUltraPanel extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean, reflect: true }) narrow = false;
	@property({ attribute: false }) panel?: PanelInfo<PanelConfig>;

	@state() private _devices?: SkellyDevice[];
	@state() private _devicesError?: string;
	// device_id or entry_id of the chosen Skelly
	@state() private _selected?: string;

	private readonly _files = new FilesSubscription(this);
	private _loadingDevices = false;

	connectedCallback(): void {
		super.connectedCallback();
		this._selected =
			new URLSearchParams(window.location.search).get(DEVICE_PARAM) ??
			undefined;
	}

	protected willUpdate(changed: PropertyValues<this>): void {
		if (
			changed.has("hass") &&
			this.hass &&
			!this._devices &&
			!this._loadingDevices
		) {
			this._loadDevices();
		}
		const device = this._device;
		this._files.setTarget(
			device ? this.hass : undefined,
			device ? targetOf(device) : {},
		);
	}

	// The chosen Skelly, or the first one
	private get _device(): SkellyDevice | undefined {
		if (!this._devices?.length) {
			return undefined;
		}
		return (
			this._devices.find(
				(d) => d.device_id === this._selected || d.entry_id === this._selected,
			) ?? this._devices[0]
		);
	}

	private async _loadDevices(): Promise<void> {
		if (!this.hass) {
			return;
		}
		this._loadingDevices = true;
		try {
			this._devices = await listDevices(this.hass);
			this._devicesError = undefined;
		} catch (err) {
			this._devicesError = errorMessage(err);
		} finally {
			this._loadingDevices = false;
		}
	}

	private _onDeviceChange(ev: Event): void {
		const value = (ev.target as HTMLSelectElement).value;
		this._selected = value;
		const url = new URL(window.location.href);
		url.searchParams.set(DEVICE_PARAM, value);
		history.replaceState(history.state, "", url);
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

			.toolbar select {
				font: inherit;
				font-size: 14px;
				color: inherit;
				background: transparent;
				border: 1px solid currentColor;
				border-radius: 4px;
				padding: 4px 8px;
				max-width: 50vw;
			}

			.toolbar option {
				color: var(--primary-text-color);
				background: var(--card-background-color);
			}

			.content {
				padding: 16px;
			}

			ha-card {
				padding: 16px;
			}

			.status {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				align-items: center;
				margin-bottom: 8px;
			}

			.dot {
				width: 10px;
				height: 10px;
				border-radius: 50%;
				background: var(--disabled-text-color, #999);
			}

			.dot.live {
				background: var(--success-color, #4caf50);
			}

			.dot.error {
				background: var(--error-color, #db4437);
			}

			.warning {
				color: var(--warning-color, #ffa600);
			}

			.error {
				color: var(--error-color, #db4437);
			}

			h2 {
				font-size: 16px;
				font-weight: 500;
				margin: 16px 0 8px;
			}

			pre {
				margin: 0;
				padding: 8px;
				overflow: auto;
				font-size: 12px;
				background: var(--secondary-background-color);
				border-radius: 4px;
			}
		`,
	];

	protected render() {
		const device = this._device;
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
				${
					device && this._devices && this._devices.length > 1
						? html`<select
								aria-label=${strings.device}
								.value=${device.device_id ?? device.entry_id}
								@change=${this._onDeviceChange}
							>
								${this._devices.map(
									(d) =>
										html`<option
											value=${d.device_id ?? d.entry_id}
											?selected=${d === device}
										>
											${d.name}
										</option>`,
								)}
							</select>`
						: nothing
				}
			</div>
			<div class="content">
				<ha-card>${this._renderBody(device)}</ha-card>
			</div>
		`;
	}

	private _renderBody(device: SkellyDevice | undefined) {
		if (this._devicesError) {
			return html`<p class="error">${strings.devicesFailed(this._devicesError)}</p>`;
		}
		if (!this._devices) {
			return html`<p class="secondary">${strings.loadingDevices}</p>`;
		}
		if (!device) {
			return html`<p>${strings.noDevices}</p>`;
		}
		const { status, payload, error } = this._files;
		return html`
			<div class="status">
				<span class="dot ${status === "live" && !payload?.available ? "unavailable" : status}"></span>
				<strong>${payload?.name ?? device.name}</strong>
				<span class="secondary">${strings.status[status]}</span>
			</div>
			${error ? html`<p class="error">${error}</p>` : nothing}
			${
				payload && !payload.available && status === "live"
					? html`<p class="warning">${strings.unavailable}</p>`
					: nothing
			}
			${
				payload
					? html`<h2>${strings.rawPayloadHeading}</h2>
							<pre>${JSON.stringify(payload, null, 2)}</pre>`
					: nothing
			}
		`;
	}

	// What HA's own menu button does: the sidebar is hidden on narrow screens
	private _toggleSidebar() {
		this.dispatchEvent(
			new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
		);
	}
}
