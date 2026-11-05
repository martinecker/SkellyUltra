import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import {
	type ActionTarget,
	cancelTransfer,
	deleteFile,
	editFile,
	errorMessage,
	playFile,
	setFileOrder,
	stopFile,
} from "../api/actions";
import { listDevices } from "../api/devices";
import { formatFree, orderedFiles, refreshFiles } from "../api/files";
import { FilesSubscription, RETRY_DELAYS } from "../api/files-subscription";
import {
	enabledIndices,
	existingOnly,
	sameOrder,
	withOrder,
} from "../api/order";
import {
	type FileEntry,
	type FilesPayload,
	type SkellyDevice,
	targetOf,
} from "../api/types";
import type { SkConfirm } from "../components/sk-confirm";
import type { SaveHandler, SkEditDialog } from "../components/sk-edit-dialog";
import type {
	DragEventDetail,
	FileEventDetail,
	OrderEventDetail,
} from "../components/sk-file-table";
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

// Below this width (in px) the files are a list instead of a table
const COMPACT_WIDTH = 600;

interface PlayingFile {
	entry_id: string;
	file_index: number;
	name: string;
}

// Play order changes within this time (in ms) go out as one write
export const ORDER_DEBOUNCE_MS = 600;
// How long (in ms) the written order is shown before the Skelly's own
// order, if no new file list arrives after the write
export const ORDER_SETTLE_MS = 3000;

// A play order change not yet confirmed by the Skelly's file list
interface PendingOrder {
	entry_id: string;
	target: ActionTarget;
	// file_index of each enabled file, in play order
	order: number[];
	// Written; shown until the next file list (or ORDER_SETTLE_MS)
	written?: { seen: FilesPayload | undefined };
}

const busyKey = (entryId: string, fileIndex: number) =>
	`${entryId}:${fileIndex}`;

// localStorage key remembering whether the Details columns are shown
const DETAILS_KEY = "skelly_ultra.panel.details";

function storedDetails(): boolean {
	try {
		return localStorage.getItem(DETAILS_KEY) === "1";
	} catch {
		return false;
	}
}

// The Skelly sidebar panel. Home Assistant creates it and sets hass, narrow,
// route and panel. It shows the chosen Skelly's files, live, and plays,
// stops and deletes them.
export class SkellyUltraPanel extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean, reflect: true }) narrow = false;
	@property({ attribute: false }) panel?: PanelInfo<PanelConfig>;

	@state() private _devices?: SkellyDevice[];
	@state() private _devicesError?: string;
	// device_id or entry_id of the chosen Skelly
	@state() private _selected?: string;
	// The file in the edit dialog
	@state() private _editing?: { entry_id: string; name: string };
	// The file last played; the device doesn't report playback
	@state() private _playing?: PlayingFile;
	// busyKey()s of files with an action in progress
	@state() private _busy: ReadonlySet<string> = new Set();
	// Lists files instead of a table: the panel is less than 600 px wide
	@state() private _compact = false;
	@state() private _refreshing = false;
	@state() private _cancelling = false;
	@state() private _details = storedDetails();
	// The play order the table shows until the Skelly reports it
	@state() private _order?: PendingOrder;
	// entry_id of the Skelly whose play order is being written
	@state() private _orderSaving?: string;

	private readonly _files = new FilesSubscription(this);
	private _loadingDevices = false;
	private _devicesAttempted = false;
	private _devicesRetryTimer?: ReturnType<typeof setTimeout>;
	private _devicesRetries = 0;
	private _resizeObserver?: ResizeObserver;
	private _orderTimer?: ReturnType<typeof setTimeout>;
	private _settleTimer?: ReturnType<typeof setTimeout>;
	// A row is being dragged: the play order isn't written meanwhile
	private _dragging = false;

	connectedCallback(): void {
		super.connectedCallback();
		this._selected =
			new URLSearchParams(window.location.search).get(DEVICE_PARAM) ??
			undefined;
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
		// Leaving the panel: write a waiting play order change now
		this._writeOrder();
	}

	protected willUpdate(changed: PropertyValues<this>): void {
		// Only the first attempt starts here (HA sets hass on every state
		// change); later ones come from the retry timer or connectedCallback
		if (changed.has("hass") && this.hass && !this._devicesAttempted) {
			this._loadDevices();
		}
		const device = this._device;
		this._files.setTarget(
			device ? this.hass : undefined,
			device ? targetOf(device) : {},
		);
		this._forgetEndedPlayback();
		this._settleOrder();
	}

	// A written play order is shown until a newer file list arrives
	private _settleOrder(): void {
		const written = this._order?.written;
		if (written && this._files.payload !== written.seen) {
			this._dropOrder();
		}
	}

	private _dropOrder(): void {
		clearTimeout(this._settleTimer);
		this._settleTimer = undefined;
		this._order = undefined;
	}

	// The playing state is a guess (the device doesn't report playback). Drop
	// it once it can't be true any more: the Skelly disconnected, the
	// integration reloaded, or the file is gone.
	private _forgetEndedPlayback(): void {
		const playing = this._playing;
		const payload = this._files.payload;
		if (!playing || !payload || payload.entry_id !== playing.entry_id) {
			return;
		}
		if (
			!payload.available ||
			payload.unloaded ||
			!payload.files.some(
				(f) => f.file_index === playing.file_index && f.name === playing.name,
			)
		) {
			this._playing = undefined;
		}
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

	private _onDeviceChange(ev: Event): void {
		const value = (ev.target as HTMLSelectElement).value;
		this._selected = value;
		// The edit dialog belongs to the Skelly it was opened on
		this._closeEditor();
		// A waiting play order change goes to its own Skelly, now
		this._writeOrder();
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
				padding: 8px 16px 16px;
			}

			:host([narrow]) .content {
				padding: 8px;
			}

			:host([narrow]) ha-card {
				padding: 8px 12px 12px;
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

			.dot.unavailable,
			.dot.reloading {
				background: var(--warning-color, #ffa600);
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

			.spacer {
				flex: 1;
			}

			.toggle {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font-size: 14px;
				cursor: pointer;
			}

			button.refresh {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 4px 12px 4px 8px;
				cursor: pointer;
			}

			:host([narrow]) button.refresh {
				padding: 4px;
			}

			:host([narrow]) button.refresh .label {
				display: none;
			}

			button.refresh:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			@media (prefers-reduced-motion: no-preference) {
				.spin {
					animation: spin 1s linear infinite;
				}
			}

			@keyframes spin {
				to {
					transform: rotate(360deg);
				}
			}

			.notice {
				margin: 8px 0;
			}

			sk-file-table.stale {
				opacity: 0.5;
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
		const { status, error } = this._files;
		const payload = this._payload;
		const live = status === "live" && payload !== undefined;
		const transfer = payload?.transfer;
		const transferring = transfer?.in_progress === true;
		const readOnly = !live || !payload.available || !this._actionTarget;
		return html`
			<div class="status">
				<span class="dot ${live && !payload.available ? "unavailable" : status}"></span>
				<strong>${payload?.name ?? device.name}</strong>
				<span class="secondary">${strings.status[status]}</span>
				<span class="spacer"></span>
				${payload ? this._renderStorage(payload) : nothing}
				<label class="toggle" title=${strings.detailsTitle}>
					<input
						type="checkbox"
						.checked=${this._details}
						@change=${this._onDetailsChange}
					/>
					${strings.details}
				</label>
				<button
					class="refresh"
					title=${strings.refreshTitle}
					aria-label=${strings.refresh}
					?disabled=${!live || this._refreshing || transferring}
					@click=${this._refresh}
				>
					<ha-icon
						class=${this._refreshing ? "spin" : ""}
						icon="mdi:refresh"
					></ha-icon>
					<span class="label">${strings.refresh}</span>
				</button>
			</div>
			${error ? html`<p class="error">${error}</p>` : nothing}
			${
				status === "reloading"
					? html`<p class="notice warning">${strings.reloadingNotice}</p>`
					: nothing
			}
			${
				live && !payload.available
					? html`<p class="notice warning">${strings.unavailable}</p>`
					: nothing
			}
			${
				live && payload.available && !this._actionTarget
					? html`<p class="notice warning">${strings.noDeviceId}</p>`
					: nothing
			}
			<sk-transfer-bar
				.transfer=${transfer}
				?cancelling=${this._cancelling}
				?disabled=${readOnly}
				@sk-cancel=${this._cancelTransfer}
			></sk-transfer-bar>
			${
				payload
					? html`<sk-file-table
							class=${live ? "" : "stale"}
							.profile=${payload.device_profile}
							.rows=${orderedFiles(this._shownPayload(payload))}
							.playing=${this._playingIndex(payload)}
							.busy=${this._busyIndices(payload)}
							?disabled=${readOnly}
							.disabledReason=${transferring ? strings.transferBusy : undefined}
							?narrow=${this._compact}
							?details=${this._details}
							?ordering=${this._orderSaving === payload.entry_id}
							@sk-order=${this._onOrder}
							@sk-order-drag=${this._onOrderDrag}
							@sk-play=${this._onPlay}
							@sk-stop=${this._onStop}
							@sk-edit=${this._onEdit}
							@sk-delete=${this._onDelete}
						></sk-file-table>`
					: nothing
			}
			<sk-edit-dialog
				.profile=${payload?.device_profile}
				.file=${this._editedFile(payload)}
				.save=${this._saveEdit}
				.readOnlyReason=${this._editBlockedReason(live, payload)}
				?playing=${
					payload !== undefined &&
					this._editing !== undefined &&
					this._playingIndex(payload) === this._editedFile(payload)?.file_index
				}
				@sk-preview=${this._onPlay}
				@sk-preview-stop=${this._onStop}
				@sk-edit-closed=${this._onEditClosed}
			></sk-edit-dialog>
			<sk-confirm></sk-confirm>
		`;
	}

	private _renderStorage(payload: FilesPayload) {
		const free = formatFree(payload.capacity.free_kb);
		return html`<span class="secondary storage">
			${free ? strings.freeSpace(free) : strings.freeSpaceUnknown} ·
			${strings.fileCount(payload.files.length)}
		</span>`;
	}

	// The payload of the chosen Skelly (the subscription may still hold the
	// previous one's for a moment)
	private get _payload(): FilesPayload | undefined {
		const payload = this._files.payload;
		const device = this._device;
		return payload && device && payload.entry_id === device.entry_id
			? payload
			: undefined;
	}

	// The actions need a device_id
	private get _actionTarget(): ActionTarget | undefined {
		const deviceId = this._payload?.device_id ?? this._device?.device_id;
		return deviceId ? { device_id: deviceId } : undefined;
	}

	// The payload with a play order change that the Skelly hasn't reported
	// yet
	private _shownPayload(payload: FilesPayload): FilesPayload {
		const pending = this._order;
		return pending && pending.entry_id === payload.entry_id
			? withOrder(payload, pending.order)
			: payload;
	}

	// The table changed the play order: show it, and write it once the
	// changes stop for a moment
	private _onOrder(ev: CustomEvent<OrderEventDetail>): void {
		const payload = this._payload;
		const target = this._actionTarget;
		if (!payload || !target || this._orderSaving === payload.entry_id) {
			return;
		}
		clearTimeout(this._settleTimer);
		this._settleTimer = undefined;
		this._order = {
			entry_id: payload.entry_id,
			target,
			order: ev.detail.order,
		};
		this._scheduleOrder();
	}

	private _scheduleOrder(): void {
		clearTimeout(this._orderTimer);
		this._orderTimer = undefined;
		if (!this._dragging) {
			this._orderTimer = setTimeout(
				() => this._writeOrder(),
				ORDER_DEBOUNCE_MS,
			);
		}
	}

	// The wait for more changes doesn't run out while a row is dragged
	private _onOrderDrag(ev: CustomEvent<DragEventDetail>): void {
		this._dragging = ev.detail.dragging;
		if (this._order && !this._order.written) {
			this._scheduleOrder();
		}
	}

	// Writes the waiting play order change, if there is one. On failure the
	// table goes back to the Skelly's order.
	private async _writeOrder(): Promise<void> {
		clearTimeout(this._orderTimer);
		this._orderTimer = undefined;
		const pending = this._order;
		const hass = this.hass;
		// One write at a time; a change made meanwhile goes out after it
		if (!pending || pending.written || this._orderSaving !== undefined) {
			return;
		}
		const payload = this._files.payload;
		const current =
			payload?.entry_id === pending.entry_id ? payload : undefined;
		const order = current
			? existingOnly(pending.order, current)
			: pending.order;
		if (
			!hass ||
			!order.length ||
			(current && sameOrder(order, enabledIndices(orderedFiles(current))))
		) {
			// Nothing to write (e.g. changed and changed back)
			this._dropOrder();
			return;
		}
		this._orderSaving = pending.entry_id;
		try {
			await this._sendOrder(hass, pending, order, payload);
		} finally {
			this._orderSaving = undefined;
		}
		// A change for another Skelly, made during the write, goes out now
		// if its wait is over
		const next = this._order;
		if (next && next !== pending && !next.written && !this._orderTimer) {
			void this._writeOrder();
		}
	}

	// before: the payload when the write started
	private async _sendOrder(
		hass: HomeAssistant,
		pending: PendingOrder,
		order: number[],
		before: FilesPayload | undefined,
	): Promise<void> {
		let reported: number[] | undefined;
		try {
			// The device can't change the order while it plays a file, so a
			// file we started is stopped first
			const playing = this._playing;
			if (playing?.entry_id === pending.entry_id) {
				try {
					await stopFile(hass, pending.target, playing.file_index);
				} catch {
					// Writing says why, if the device is still busy
				}
				if (this._playing === playing) {
					this._playing = undefined;
				}
			}
			const response = await setFileOrder(hass, pending.target, {
				file_indices: order,
			});
			reported = response?.file_order?.map((entry) => entry.file_index);
		} catch (err) {
			if (this._order === pending) {
				this._dropOrder();
			}
			this._toast(strings.orderFailed(errorMessage(err)));
			return;
		}
		if (this._order !== pending) {
			return;
		}
		const latest = this._files.payload;
		if (
			// The Skelly's order differs from the one asked for
			(reported && !sameOrder(order, reported)) ||
			// The new file list came during the write
			latest !== before
		) {
			this._dropOrder();
			return;
		}
		this._order = { ...pending, order, written: { seen: latest } };
		this._settleTimer = setTimeout(() => this._dropOrder(), ORDER_SETTLE_MS);
	}

	private _playingIndex(payload: FilesPayload): number | null {
		const playing = this._playing;
		return playing && playing.entry_id === payload.entry_id
			? playing.file_index
			: null;
	}

	// The files of this Skelly with an action in progress
	private _busyIndices(payload: FilesPayload): ReadonlySet<number> {
		return new Set(
			payload.files
				.filter((f) => this._busy.has(busyKey(payload.entry_id, f.file_index)))
				.map((f) => f.file_index),
		);
	}

	private _setBusy(key: string, busy: boolean) {
		const next = new Set(this._busy);
		if (busy) {
			next.add(key);
		} else {
			next.delete(key);
		}
		this._busy = next;
	}

	// Runs an action on one file; the row is disabled meanwhile, and a failure
	// is shown as a toast
	// Runs an action on one file of the shown Skelly; the row is disabled
	// meanwhile, and a failure is shown as a toast. Resolves to the Skelly's
	// entry_id if the action succeeded.
	private async _fileAction(
		file: FileEntry,
		action: (hass: HomeAssistant, target: ActionTarget) => Promise<unknown>,
		failed: (name: string, message: string) => string,
	): Promise<string | undefined> {
		const hass = this.hass;
		const target = this._actionTarget;
		const entryId = this._payload?.entry_id;
		if (!hass || !target || !entryId) {
			return undefined;
		}
		const key = busyKey(entryId, file.file_index);
		if (this._busy.has(key)) {
			return undefined;
		}
		this._setBusy(key, true);
		try {
			await action(hass, target);
			return entryId;
		} catch (err) {
			this._toast(failed(file.name, errorMessage(err)));
			return undefined;
		} finally {
			this._setBusy(key, false);
		}
	}

	private async _onPlay(ev: CustomEvent<FileEventDetail>) {
		const { file } = ev.detail;
		// A waiting play order change goes first: writing it would stop the
		// file again
		if (this._order && !this._order.written) {
			await this._writeOrder();
		}
		const entryId = await this._fileAction(
			file,
			(hass, target) => playFile(hass, target, file.file_index),
			strings.playFailed,
		);
		if (entryId) {
			// The device doesn't say when a file ends, so this stays until
			// another file is played, Stop is pressed or the Skelly disconnects
			this._playing = {
				entry_id: entryId,
				file_index: file.file_index,
				name: file.name,
			};
		}
	}

	private async _onStop(ev: CustomEvent<FileEventDetail>) {
		const { file } = ev.detail;
		const entryId = await this._fileAction(
			file,
			(hass, target) => stopFile(hass, target, file.file_index),
			strings.stopFailed,
		);
		if (entryId) {
			this._clearPlaying(entryId, file);
		}
	}

	// The edited file's current entry: undefined while there's no payload of
	// its Skelly, null once the file is gone
	private _editedFile(
		payload: FilesPayload | undefined,
	): FileEntry | null | undefined {
		const editing = this._editing;
		if (!editing || !payload || payload.entry_id !== editing.entry_id) {
			return undefined;
		}
		return payload.files.find((f) => f.name === editing.name) ?? null;
	}

	// Why the edit dialog can't save right now, if it can't
	private _editBlockedReason(
		live: boolean,
		payload: FilesPayload | undefined,
	): string | undefined {
		if (!live || !payload) {
			return this._files.status === "reloading"
				? strings.reloadingNotice
				: strings.editWaiting;
		}
		if (!payload.available) {
			return strings.editDisconnected;
		}
		if (!this._actionTarget) {
			return strings.noDeviceId;
		}
		if (payload.transfer.in_progress) {
			return strings.transferBusy;
		}
		return undefined;
	}

	private async _onEdit(ev: CustomEvent<FileEventDetail>) {
		const { file } = ev.detail;
		const entryId = this._payload?.entry_id;
		const dialog = this._editDialog;
		if (!entryId || !dialog) {
			return;
		}
		this._editing = { entry_id: entryId, name: file.name };
		await dialog.open(file);
	}

	private get _editDialog(): SkEditDialog | null {
		return this.renderRoot.querySelector<SkEditDialog>("sk-edit-dialog");
	}

	private _onEditClosed() {
		this._editing = undefined;
	}

	private _closeEditor() {
		this._editing = undefined;
		this._editDialog?.close();
	}

	// Saves the edit dialog's changes. The device can't change a file's
	// settings while it plays one, so a file we started is stopped first.
	private readonly _saveEdit: SaveHandler = async (file, changes) => {
		const hass = this.hass;
		const target = this._actionTarget;
		const entryId = this._payload?.entry_id;
		if (!hass || !target || !entryId) {
			throw new Error(strings.editWaiting);
		}
		const playing = this._playing;
		if (playing?.entry_id === entryId) {
			try {
				await stopFile(hass, target, playing.file_index);
			} catch {
				// Saving says why, if the device is still busy
			}
			if (this._playing === playing) {
				this._playing = undefined;
			}
		}
		// The file's current index (it may have changed since the dialog opened)
		const current =
			this._payload?.files.find((f) => f.name === file.name) ?? file;
		const key = busyKey(entryId, current.file_index);
		this._setBusy(key, true);
		try {
			await editFile(hass, target, file.name, changes);
		} finally {
			this._setBusy(key, false);
		}
		this._toast(strings.saved(file.name));
	};

	private async _onDelete(ev: CustomEvent<FileEventDetail>) {
		const { file } = ev.detail;
		const confirm = this.renderRoot.querySelector<SkConfirm>("sk-confirm");
		if (
			!confirm ||
			!(await confirm.ask({
				title: strings.deleteTitle,
				message: strings.deleteMessage(file.name),
				confirmLabel: strings.delete,
				destructive: true,
			}))
		) {
			return;
		}
		const entryId = await this._fileAction(
			file,
			(hass, target) => deleteFile(hass, target, file.name),
			strings.deleteFailed,
		);
		if (entryId) {
			this._clearPlaying(entryId, file);
			this._toast(strings.deleted(file.name));
		}
	}

	private _clearPlaying(entryId: string, file: FileEntry) {
		const playing = this._playing;
		if (
			playing?.entry_id === entryId &&
			playing.file_index === file.file_index
		) {
			this._playing = undefined;
		}
	}

	private async _refresh() {
		const device = this._device;
		if (!this.hass || !device || this._refreshing) {
			return;
		}
		this._refreshing = true;
		try {
			// The new list arrives through the subscription as well
			await refreshFiles(this.hass, targetOf(device));
		} catch (err) {
			this._toast(strings.refreshFailed(errorMessage(err)));
		} finally {
			this._refreshing = false;
		}
	}

	private async _cancelTransfer() {
		const target = this._actionTarget;
		if (!this.hass || !target || this._cancelling) {
			return;
		}
		this._cancelling = true;
		try {
			await cancelTransfer(this.hass, target);
		} catch (err) {
			this._toast(strings.transferCancelFailed(errorMessage(err)));
		} finally {
			this._cancelling = false;
		}
	}

	private _onDetailsChange(ev: Event) {
		this._details = (ev.target as HTMLInputElement).checked;
		try {
			localStorage.setItem(DETAILS_KEY, this._details ? "1" : "0");
		} catch {
			// Not remembered, e.g. in a private window
		}
	}

	// HA's own toast, at the bottom of the screen
	private _toast(message: string) {
		this.dispatchEvent(
			new CustomEvent("hass-notification", {
				detail: { message },
				bubbles: true,
				composed: true,
			}),
		);
	}

	// What HA's own menu button does: the sidebar is hidden on narrow screens
	private _toggleSidebar() {
		this.dispatchEvent(
			new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
		);
	}
}
