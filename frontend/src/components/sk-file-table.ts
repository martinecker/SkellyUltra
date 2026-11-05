import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import Sortable, { type SortableEvent } from "sortablejs";
import type { FileRow } from "../api/files";
import { enabledIndices, sameOrder, toggleInOrder } from "../api/order";
import type { DeviceProfile, FileEntry, LightSettings } from "../api/types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

// How a swatch moves, by effect mode name (DeviceProfile.light_modes, which
// differ between profiles). Other modes don't move.
const MODE_ANIMATIONS: Record<string, "strobe" | "pulse"> = {
	strobe: "strobe",
	flickering: "strobe",
	pulse: "pulse",
	pulsing: "pulse",
};

// Detail of the events the table fires: sk-play, sk-stop, sk-edit and
// sk-delete
export interface FileEventDetail {
	file: FileEntry;
}

// Detail of sk-order: the new play order, as the file_index of each enabled
// file
export interface OrderEventDetail {
	order: number[];
}

// Detail of sk-order-drag: a row is picked up (true) or put down (false)
export interface DragEventDetail {
	dragging: boolean;
}

// The files of one Skelly: a table on wide screens, a two-line list on narrow
// ones. It only shows and asks; the panel does the actions, after an
// sk-play, sk-stop, sk-edit, sk-delete or sk-order event. Enabled files can
// be dragged by their handle to change the play order, and the checkbox puts
// a file in the play order or takes it out.
export class SkFileTable extends LitElement {
	@property({ attribute: false }) profile?: DeviceProfile;
	@property({ attribute: false }) rows: FileRow[] = [];
	// file_index of the file that is (thought to be) playing
	@property({ attribute: false }) playing: number | null = null;
	// file_index of files with an action in progress
	@property({ attribute: false }) busy: ReadonlySet<number> = new Set();
	// Everything is read-only, e.g. while the Skelly is disconnected
	@property({ type: Boolean }) disabled = false;
	// Read-only while a file transfer runs; the reason, for a tooltip
	@property({ attribute: false }) disabledReason?: string;
	@property({ type: Boolean, reflect: true }) narrow = false;
	@property({ type: Boolean }) details = false;
	// The play order is being written: it can't be changed meanwhile
	@property({ type: Boolean }) ordering = false;

	private _sortable?: Sortable;
	// Where the dragged row was, to put it back for Lit (see _onDragEnd)
	private _dragAnchor: Node | null = null;
	private _dragging = false;

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			table {
				width: 100%;
				border-collapse: collapse;
			}

			th {
				text-align: left;
				font-weight: 500;
				color: var(--secondary-text-color);
				font-size: 12px;
				padding: 4px 8px;
				border-bottom: 1px solid var(--divider-color);
				white-space: nowrap;
			}

			td {
				padding: 4px 8px;
				border-bottom: 1px solid var(--divider-color);
				vertical-align: middle;
			}

			tr.off td,
			li.off .main {
				color: var(--secondary-text-color);
			}

			tr.playing td,
			li.playing {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
			}

			.position {
				width: 2em;
				text-align: right;
				font-variant-numeric: tabular-nums;
			}

			.name {
				word-break: break-word;
			}

			.num {
				font-variant-numeric: tabular-nums;
			}

			.actions {
				white-space: nowrap;
				text-align: right;
			}

			.icons {
				display: inline-flex;
				gap: 4px;
				align-items: center;
				vertical-align: middle;
			}

			.icons img {
				width: 28px;
				height: 28px;
				object-fit: contain;
			}

			.glyph {
				display: inline-block;
				width: 28px;
				height: 28px;
				background-color: var(--primary-text-color);
				-webkit-mask: var(--sk-icon) center / contain no-repeat;
				mask: var(--sk-icon) center / contain no-repeat;
			}

			tr.off .glyph,
			li.off .glyph {
				background-color: var(--secondary-text-color);
			}

			.swatch {
				display: inline-block;
				box-sizing: border-box;
				width: 20px;
				height: 20px;
				border-radius: 50%;
				border: 1px solid var(--divider-color);
				vertical-align: middle;
			}

			.swatch.dark {
				background: transparent !important;
				border-style: dashed;
			}

			.swatch.cycle {
				background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red) !important;
			}

			@media (prefers-reduced-motion: no-preference) {
				.swatch.strobe {
					animation: strobe 0.6s steps(1, end) infinite;
				}

				.swatch.pulse {
					animation: pulse 2s ease-in-out infinite;
				}
			}

			@keyframes strobe {
				50% {
					opacity: 0.1;
				}
			}

			@keyframes pulse {
				50% {
					opacity: 0.25;
				}
			}

			button,
			summary.button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				border-radius: 50%;
				width: 40px;
				height: 40px;
				padding: 0;
				cursor: pointer;
			}

			summary.button {
				box-sizing: border-box;
			}

			button:hover:not(:disabled),
			summary.button:hover {
				background: var(--secondary-background-color);
			}

			button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			button.play {
				color: var(--primary-color);
			}

			ul {
				list-style: none;
				margin: 0;
				padding: 0;
			}

			li {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 0;
				border-bottom: 1px solid var(--divider-color);
			}

			li .main {
				flex: 1;
				min-width: 0;
			}

			li .line2 {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				align-items: center;
				margin-top: 4px;
				font-size: 12px;
			}

			details {
				position: relative;
			}

			summary {
				list-style: none;
			}

			summary::-webkit-details-marker {
				display: none;
			}

			.menu {
				position: absolute;
				right: 0;
				z-index: 1;
				min-width: 140px;
				padding: 4px 0;
				background: var(--card-background-color, #fff);
				border-radius: 4px;
				box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
			}

			.menu button {
				width: 100%;
				height: 40px;
				border-radius: 0;
				justify-content: flex-start;
				padding: 0 16px;
			}

			.empty {
				padding: 16px 0;
			}

			.visually-hidden {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
			}

			.handle-cell,
			.enabled-cell {
				width: 24px;
				padding-right: 0;
			}

			.handle,
			.grip {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 32px;
				height: 40px;
				color: var(--secondary-text-color);
				cursor: grab;
				/* A drag on the handle moves the row, not the page */
				touch-action: none;
			}

			.handle.locked,
			.grip.locked {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			.handle.none {
				visibility: hidden;
			}

			input.enabled {
				width: 18px;
				height: 18px;
				margin: 0;
				cursor: pointer;
				accent-color: var(--primary-color);
			}

			input.enabled:disabled {
				cursor: default;
			}

			.sortable-ghost td,
			li.sortable-ghost {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.2);
			}

			.sortable-fallback {
				opacity: 0.8;
				background: var(--card-background-color, #fff);
				box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
			}
		`,
	];

	protected render() {
		if (!this.profile) {
			return nothing;
		}
		if (!this.rows.length) {
			return html`<p class="empty secondary">${strings.noFiles}</p>`;
		}
		return this.narrow ? this._renderList() : this._renderTable();
	}

	private _renderTable() {
		const profile = this.profile as DeviceProfile;
		const showEyes = profile.eye_icons.length > 0;
		return html`
			<table>
				<thead>
					<tr>
						<th class="handle-cell"></th>
						<th class="enabled-cell" title=${strings.columnEnabledTitle}>
							<span class="visually-hidden">${strings.columnEnabledTitle}</span>
						</th>
						<th class="position">${strings.columnPosition}</th>
						<th>${strings.columnName}</th>
						${profile.lights.map((light) => html`<th>${light.label}</th>`)}
						<th>${strings.columnMovement}</th>
						${showEyes ? html`<th>${strings.columnEye}</th>` : nothing}
						${
							this.details
								? html`<th>${strings.columnIndex}</th>
										<th>${strings.columnCluster}</th>`
								: nothing
						}
						<th class="actions"><span class="secondary">${strings.columnActions}</span></th>
					</tr>
				</thead>
				<tbody>
					${repeat(
						this.rows,
						(row) => row.file.file_index,
						({ file, position }) => html`
							<tr
								class=${this._rowClass(file, position)}
								data-file-index=${file.file_index}
							>
								<td class="handle-cell">${this._renderHandle(file, position)}</td>
								<td class="enabled-cell">${this._renderEnabled(file, position)}</td>
								<td class="position">${this._renderPosition(position)}</td>
								<td class="name">${file.name}</td>
								${profile.lights.map(
									(light) =>
										html`<td>
											${this._renderSwatch(
												light.label,
												file.lights.find((l) => l.channel === light.channel),
											)}
										</td>`,
								)}
								<td>${this._renderMovements(file)}</td>
								${showEyes ? html`<td>${this._renderEye(file)}</td>` : nothing}
								${
									this.details
										? html`<td class="num">${file.file_index}</td>
												<td class="num">${file.cluster}</td>`
										: nothing
								}
								<td class="actions">
									${this._renderPlayButton(file)}
									<button
										class="edit"
										title=${this._title(strings.edit)}
										aria-label=${strings.edit}
										?disabled=${this._isDisabled(file)}
										@click=${() => this._fire("sk-edit", file)}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
									</button>
									<button
										class="delete"
										title=${this._title(strings.delete)}
										aria-label=${strings.delete}
										?disabled=${this._isDisabled(file)}
										@click=${() => this._fire("sk-delete", file)}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
									</button>
								</td>
							</tr>
						`,
					)}
				</tbody>
			</table>
		`;
	}

	private _renderList() {
		const profile = this.profile as DeviceProfile;
		const showEyes = profile.eye_icons.length > 0;
		return html`
			<ul>
				${repeat(
					this.rows,
					(row) => row.file.file_index,
					({ file, position }) => html`
						<li
							class=${this._rowClass(file, position)}
							data-file-index=${file.file_index}
						>
							${this._renderHandle(file, position)}
							${this._renderEnabled(file, position)}
							<div class="main">
								<div>
									<span class="num">${this._renderPosition(position)}</span>
									<span class="name">${file.name}</span>
								</div>
								<div class="line2">
									<span class="icons">
										${profile.lights.map((light) =>
											this._renderSwatch(
												light.label,
												file.lights.find((l) => l.channel === light.channel),
											),
										)}
									</span>
									${this._renderMovements(file)}
									${showEyes ? this._renderEye(file) : nothing}
									${
										this.details
											? html`<span class="secondary num"
													>${strings.columnIndex} ${file.file_index} ·
													${strings.columnCluster} ${file.cluster}</span
												>`
											: nothing
									}
								</div>
							</div>
							${this._renderPlayButton(file)}
							<details
								@toggle=${this._onMenuToggle}
								@keydown=${this._onMenuKeydown}
							>
								<summary
									class="button"
									title=${strings.moreActions}
									aria-label=${strings.moreActions}
								>
									<ha-icon icon="mdi:dots-vertical"></ha-icon>
								</summary>
								<div class="menu">
									<button
										class="edit"
										title=${this._title(strings.edit)}
										?disabled=${this._isDisabled(file)}
										@click=${(ev: Event) => {
											this._closeMenu(ev);
											this._fire("sk-edit", file);
										}}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
										${strings.edit}
									</button>
									<button
										class="delete"
										title=${this._title(strings.delete)}
										?disabled=${this._isDisabled(file)}
										@click=${(ev: Event) => {
											this._closeMenu(ev);
											this._fire("sk-delete", file);
										}}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
										${strings.delete}
									</button>
								</div>
							</details>
						</li>
					`,
				)}
			</ul>
		`;
	}

	private _rowClass(file: FileEntry, position: number | null): string {
		return [
			position === null ? "off" : "on",
			file.file_index === this.playing ? "playing" : "",
		]
			.filter(Boolean)
			.join(" ");
	}

	// Enabled files are dragged by this handle; disabled ones have none
	// (they aren't in the play order)
	private _renderHandle(file: FileEntry, position: number | null) {
		if (position === null) {
			return html`<span class="handle none" aria-hidden="true"></span>`;
		}
		// The device can't order a file without a name: dragging it would only
		// take it out. Its grip isn't a .handle, so Sortable won't pick it up.
		if (!file.name.trim()) {
			return html`<span
				class="grip locked"
				title=${strings.namelessInOrder}
				aria-hidden="true"
			>
				<ha-icon icon="mdi:drag"></ha-icon>
			</span>`;
		}
		const locked = this._dragLocked;
		return html`<span
			class="handle ${locked ? "locked" : ""}"
			title=${this._title(strings.dragTitle)}
			aria-hidden="true"
			data-file-index=${file.file_index}
		>
			<ha-icon icon="mdi:drag"></ha-icon>
		</span>`;
	}

	private _renderEnabled(file: FileEntry, position: number | null) {
		const enabled = position !== null;
		const named = file.name.trim() !== "";
		// The device needs at least one enabled file, and addresses files by
		// name when it orders them
		const last =
			enabled &&
			this._writable(this._order.filter((i) => i !== file.file_index))
				.length === 0;
		const nameless = !enabled && !named;
		const title = last
			? strings.lastEnabled
			: nameless
				? strings.namelessFile
				: enabled && !named && !this._orderLocked
					? strings.namelessInOrder
					: this._title(enabled ? strings.disableTitle : strings.enableTitle);
		return html`<input
			type="checkbox"
			class="enabled"
			title=${title}
			aria-label=${strings.enabledLabel(file.name)}
			.checked=${live(enabled)}
			?disabled=${this._orderLocked || last || nameless}
			@change=${(ev: Event) =>
				this._onEnabledChange(
					ev,
					file,
					(ev.target as HTMLInputElement).checked,
				)}
		/>`;
	}

	private get _enabledCount(): number {
		return this.rows.filter((row) => row.position !== null).length;
	}

	// The play order the rows show
	private get _order(): number[] {
		return enabledIndices(this.rows);
	}

	// The order without files that have no name: the device can't order
	// those, so any change takes them out of the play order
	private _writable(order: readonly number[]): number[] {
		const nameless = new Set(
			this.rows
				.filter((row) => !row.file.name.trim())
				.map((row) => row.file.file_index),
		);
		return order.filter((i) => !nameless.has(i));
	}

	// Rows can't be dragged now
	private get _dragLocked(): boolean {
		return this._orderLocked || this._enabledCount < 2;
	}

	// The play order (and the other actions) can't be changed now
	private get _orderLocked(): boolean {
		return this.disabled || this.disabledReason !== undefined || this.ordering;
	}

	// Why a control is disabled, for its tooltip, or its label
	private _title(label: string): string {
		if (this.disabled) {
			return label;
		}
		if (this.disabledReason !== undefined) {
			return this.disabledReason;
		}
		return this.ordering ? strings.orderSaving : label;
	}

	private _onEnabledChange(ev: Event, file: FileEntry, enabled: boolean) {
		const order = this._order;
		const next = toggleInOrder(order, file.file_index, enabled);
		if (next.length !== order.length) {
			this._fireOrder(next);
		}
		// The rows change once the panel takes the new order; until then (or
		// if it doesn't) the checkbox shows the rows' state again
		(ev.target as HTMLInputElement).checked = !enabled;
		this.requestUpdate();
	}

	private _fireOrder(proposed: number[]) {
		const order = this._writable(proposed);
		if (!order.length) {
			return;
		}
		this.dispatchEvent(
			new CustomEvent<OrderEventDetail>("sk-order", {
				detail: { order },
				bubbles: true,
				composed: true,
			}),
		);
	}

	// Sortable works on the rows' container, which changes when the table
	// turns into a list or the files come and go
	protected updated(): void {
		const container =
			this.renderRoot.querySelector<HTMLElement>("tbody") ??
			this.renderRoot.querySelector<HTMLElement>("ul");
		if (this._sortable && this._sortable.el !== container) {
			this._destroySortable();
		}
		if (container && !this._sortable) {
			this._sortable = Sortable.create(container, {
				handle: ".handle",
				// Only enabled files are in the play order
				draggable: ".on",
				// Pointer events instead of HTML5 drag and drop, the same on
				// touch screens and in the companion apps
				forceFallback: true,
				fallbackTolerance: 3,
				animation: 150,
				onChoose: (ev) => this._keepCellWidths(ev.item, true),
				onUnchoose: (ev) => this._keepCellWidths(ev.item, false),
				onStart: (ev) => this._onDragStart(ev),
				onEnd: (ev) => this._onDragEnd(ev),
			});
		}
		// Not while a row is dragged: Sortable would drop it on the spot
		if (!this._dragging) {
			this._sortable?.option("disabled", this._dragLocked);
		}
	}

	// The dragged copy of a table row is taken out of the table, so its cells
	// would lose their column widths: they're fixed while it's dragged
	private _keepCellWidths(item: HTMLElement, keep: boolean) {
		for (const cell of item.querySelectorAll<HTMLElement>(":scope > td")) {
			cell.style.width = keep ? `${cell.getBoundingClientRect().width}px` : "";
			cell.style.boxSizing = keep ? "border-box" : "";
		}
	}

	private _onDragStart(ev: SortableEvent) {
		this._dragAnchor = ev.item.nextSibling;
		this._dragging = true;
		this._fireDrag(true);
	}

	// The panel holds back its write while a row is dragged
	private _fireDrag(dragging: boolean) {
		this.dispatchEvent(
			new CustomEvent<DragEventDetail>("sk-order-drag", {
				detail: { dragging },
				bubbles: true,
				composed: true,
			}),
		);
	}

	// Sortable has moved the row in the DOM. Lit owns the rows, so the row
	// goes back where it was and the panel's new order moves it for real.
	private _onDragEnd(ev: SortableEvent) {
		const { item, from } = ev;
		// Where the rows are now, read before the row goes back. The rows may
		// have changed during the drag, so this goes by file, not by place.
		const dropped = this._droppedOrder(from, item);
		const anchor = this._dragAnchor;
		this._dragAnchor = null;
		this._dragging = false;
		if (!anchor) {
			from.appendChild(item);
		} else if (anchor.parentNode !== from) {
			// The file went away during the drag, and Lit removed its row's
			// place: the row goes too, and the drop counts for nothing
			item.remove();
			this._fireDrag(false);
			this.requestUpdate();
			return;
		} else {
			from.insertBefore(item, anchor);
		}
		// The new order first, so the panel's wait starts from it
		if (dropped && !sameOrder(dropped, this._order)) {
			this._fireOrder(dropped);
		}
		this._fireDrag(false);
		// Sortable's disabled option may have to catch up
		this.requestUpdate();
	}

	// The play order as the rows stand after a drop, or undefined if the
	// dragged file isn't in the play order (any more)
	private _droppedOrder(
		container: HTMLElement,
		item: HTMLElement,
	): number[] | undefined {
		const order = this._order;
		const dragged = Number(item.dataset.fileIndex);
		if (!order.includes(dragged)) {
			return undefined;
		}
		const inOrder = new Set(order);
		const seen = new Set<number>();
		const dropped: number[] = [];
		for (const el of container.children) {
			const fileIndex = Number((el as HTMLElement).dataset.fileIndex);
			// Skips Sortable's own copy of the row, and rows out of the order
			if (
				el.classList.contains("sortable-fallback") ||
				!inOrder.has(fileIndex) ||
				seen.has(fileIndex)
			) {
				continue;
			}
			seen.add(fileIndex);
			dropped.push(fileIndex);
		}
		return dropped.length === order.length ? dropped : undefined;
	}

	private _renderPosition(position: number | null) {
		return position === null
			? html`<span title=${strings.notInOrder}>–</span>`
			: html`<span title=${strings.positionTitle(position)}>${position}</span>`;
	}

	private _renderSwatch(label: string, light: LightSettings | undefined) {
		if (!light) {
			return nothing;
		}
		if (light.brightness === 0) {
			return html`<span
				class="swatch dark"
				role="img"
				title=${strings.lightOff(label)}
				aria-label=${strings.lightOff(label)}
			></span>`;
		}
		const mode =
			this.profile?.light_modes[light.effect_mode - 1] ??
			String(light.effect_mode);
		const title = strings.lightTitle(
			label,
			mode,
			light.rgb,
			light.brightness,
			light.color_cycle,
		);
		const classes = [
			"swatch",
			light.color_cycle ? "cycle" : "",
			MODE_ANIMATIONS[mode.toLowerCase()] ?? "",
		]
			.filter(Boolean)
			.join(" ");
		// Dimmer lights show fainter, but never invisible
		const opacity = 0.35 + (0.65 * Math.min(light.brightness, 255)) / 255;
		const [r, g, b] = light.rgb;
		return html`<span
			class=${classes}
			role="img"
			title=${title}
			aria-label=${title}
			style="background-color: rgb(${r}, ${g}, ${b}); opacity: ${opacity}"
		></span>`;
	}

	private _renderMovements(file: FileEntry) {
		const movements = (this.profile?.movements ?? []).filter((m) =>
			file.movements.includes(m.part),
		);
		if (!movements.length) {
			return html`<span class="secondary">${strings.noMovement}</span>`;
		}
		// The pictures are white shapes (made for the web controller's dark
		// page), so they're used as masks and take the text color of the theme
		return html`<span class="icons">
			${movements.map(
				(m) =>
					html`<span
						class="glyph"
						role="img"
						aria-label=${m.label}
						title=${m.label}
						data-src=${m.icon_url}
						style="--sk-icon: url('${m.icon_url}')"
					></span>`,
			)}
		</span>`;
	}

	private _renderEye(file: FileEntry) {
		if (file.eye_icon === null) {
			return nothing;
		}
		const icon = this.profile?.eye_icons.find((e) => e.value === file.eye_icon);
		if (!icon) {
			return html`<span class="num">${file.eye_icon}</span>`;
		}
		return html`<span class="icons">
			<img src=${icon.url} alt=${icon.label} title=${icon.label} loading="lazy" />
		</span>`;
	}

	private _renderPlayButton(file: FileEntry) {
		const playing = file.file_index === this.playing;
		const label = playing ? strings.stop : strings.play;
		return html`<button
			class=${playing ? "stop" : "play"}
			title=${playing ? label : this._title(label)}
			aria-label=${label}
			?disabled=${
				// Stopping is always allowed, also during a transfer
				playing
					? this.disabled || this.busy.has(file.file_index)
					: this._isDisabled(file)
			}
			@click=${() => this._fire(playing ? "sk-stop" : "sk-play", file)}
		>
			<ha-icon icon=${playing ? "mdi:stop" : "mdi:play"}></ha-icon>
		</button>`;
	}

	// Play, edit and delete wait for a transfer or a play order write
	private _isDisabled(file: FileEntry): boolean {
		return this._orderLocked || this.busy.has(file.file_index);
	}

	private _fire(
		type: "sk-play" | "sk-stop" | "sk-edit" | "sk-delete",
		file: FileEntry,
	) {
		this.dispatchEvent(
			new CustomEvent<FileEventDetail>(type, {
				detail: { file },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private _closeMenu(ev: Event) {
		const details = (ev.currentTarget as HTMLElement).closest("details");
		if (details) {
			details.open = false;
		}
	}

	// The overflow menus are <details>: one open at a time
	private _onMenuToggle(ev: Event) {
		const details = ev.currentTarget as HTMLDetailsElement;
		if (!details.open) {
			return;
		}
		for (const other of this.renderRoot.querySelectorAll("details[open]")) {
			if (other !== details) {
				(other as HTMLDetailsElement).open = false;
			}
		}
		this._focusMenu(details);
	}

	// Escape closes a menu and puts the focus back on its button
	private _onMenuKeydown(ev: KeyboardEvent) {
		const details = ev.currentTarget as HTMLDetailsElement;
		if (ev.key === "Escape" && details.open) {
			ev.stopPropagation();
			details.open = false;
			details.querySelector("summary")?.focus();
		}
	}

	// When the menu opens, focus its first action
	private _focusMenu(details: HTMLDetailsElement) {
		details.querySelector<HTMLButtonElement>(".menu button")?.focus();
	}

	// A click anywhere outside an open menu closes it
	private readonly _onWindowClick = (ev: Event) => {
		const path = ev.composedPath();
		for (const details of this.renderRoot.querySelectorAll("details[open]")) {
			if (!path.includes(details)) {
				(details as HTMLDetailsElement).open = false;
			}
		}
	};

	connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener("click", this._onWindowClick, true);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener("click", this._onWindowClick, true);
		this._destroySortable();
	}

	// A drag that was going on ends with it
	private _destroySortable() {
		this._sortable?.destroy();
		this._sortable = undefined;
		this._dragAnchor = null;
		if (this._dragging) {
			this._dragging = false;
			this._fireDrag(false);
		}
	}
}
