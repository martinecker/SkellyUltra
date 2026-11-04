import { css, html, LitElement, nothing } from "lit";
import { property, query, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { errorMessage, type FileChanges } from "../api/actions";
import {
	ALL_PART,
	clampInt,
	draftOf,
	type FileDraft,
	fileChanges,
	hasChanges,
	hexToRgb,
	modeHasSpeed,
	rgbToHex,
	sameSettings,
	toggleMovement,
} from "../api/edit";
import type { DeviceProfile, FileEntry, LightSettings } from "../api/types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

// Saves the changes; rejects with the error to show
export type SaveHandler = (
	file: FileEntry,
	changes: FileChanges,
) => Promise<void>;

// Edits a file's movement, eye icon and lights, in a native modal <dialog>.
// open() starts editing a copy of the file. The panel keeps `file` set to the
// file's current entry (null once it's gone), so the dialog can say when it
// changed on the device meanwhile. Save calls `save` with only the changed
// fields and closes once it resolves. Preview fires sk-preview (or
// sk-preview-stop while `playing`).
export class SkEditDialog extends LitElement {
	@property({ attribute: false }) profile?: DeviceProfile;
	// The file's current entry; null once it's no longer on the device
	@property({ attribute: false }) file?: FileEntry | null;
	@property({ attribute: false }) save?: SaveHandler;
	// Why saving isn't possible right now (e.g. the Skelly is disconnected)
	@property({ attribute: false }) readOnlyReason?: string;
	// The file is (thought to be) playing
	@property({ type: Boolean }) playing = false;

	// The file as it was when editing started, and the user's version of it
	@state() private _editing?: FileEntry;
	@state() private _base?: FileDraft;
	@state() private _draft?: FileDraft;
	@state() private _saving = false;
	@state() private _error?: string;

	@query("dialog") private _dialog?: HTMLDialogElement;

	static styles = [
		sharedStyles,
		css`
			dialog {
				box-sizing: border-box;
				width: min(560px, calc(100vw - 32px));
				max-height: calc(100vh - 32px);
				padding: 0;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog[open] {
				display: flex;
				flex-direction: column;
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			@media (max-width: 600px) {
				dialog {
					width: 100vw;
					max-width: 100vw;
					height: 100%;
					max-height: 100%;
					margin: 0;
					border-radius: 0;
				}
			}

			header {
				padding: 20px 24px 8px;
			}

			h2 {
				margin: 0;
				font-size: 20px;
				font-weight: 500;
				word-break: break-word;
			}

			.body {
				flex: 1;
				overflow: auto;
				padding: 0 24px 8px;
			}

			h3 {
				margin: 16px 0 8px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.notice {
				margin: 8px 0;
				padding: 8px 12px;
				border-radius: 4px;
				background: var(--secondary-background-color);
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			.notice.warning {
				border-left: 4px solid var(--warning-color, #ffa600);
			}

			.notice.error {
				border-left: 4px solid var(--error-color, #db4437);
				color: var(--error-color, #db4437);
			}

			.choices {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}

			.choice {
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				gap: 4px;
				min-width: 64px;
				padding: 6px;
				font: inherit;
				font-size: 12px;
				color: var(--primary-text-color);
				background: transparent;
				border: 2px solid var(--divider-color);
				border-radius: 8px;
				cursor: pointer;
			}

			.choice[aria-pressed="true"] {
				border-color: var(--primary-color);
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
			}

			.choice:disabled {
				cursor: default;
				opacity: 0.5;
			}

			.glyph {
				display: inline-block;
				width: 36px;
				height: 36px;
				background-color: var(--primary-text-color);
				-webkit-mask: var(--sk-icon) center / contain no-repeat;
				mask: var(--sk-icon) center / contain no-repeat;
			}

			.eyes .choice {
				min-width: 0;
				padding: 2px;
			}

			.eyes img {
				display: block;
				width: 40px;
				height: 40px;
				object-fit: contain;
			}

			.choices + fieldset {
				margin-top: 16px;
			}

			fieldset {
				margin: 0 0 12px;
				padding: 8px 12px 12px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			legend {
				padding: 0 4px;
				font-weight: 500;
			}

			.field {
				display: grid;
				grid-template-columns: 110px 1fr;
				align-items: center;
				gap: 8px;
				margin-top: 8px;
			}

			@media (max-width: 600px) {
				.field {
					grid-template-columns: 1fr;
					gap: 4px;
				}
			}

			.inline {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			input[type="range"] {
				flex: 1;
				min-width: 120px;
				accent-color: var(--primary-color);
			}

			input[type="number"] {
				width: 4.5em;
				font: inherit;
				padding: 4px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			input[type="color"] {
				width: 44px;
				height: 32px;
				padding: 0;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				background: transparent;
			}

			select {
				font: inherit;
				padding: 4px 8px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			label.check {
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}

			.rgb label {
				display: inline-flex;
				align-items: center;
				gap: 2px;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			footer {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				padding: 12px 24px 16px;
				border-top: 1px solid var(--divider-color);
			}

			.spacer {
				flex: 1;
			}

			footer button {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 8px 12px;
				cursor: pointer;
			}

			footer button:hover:not(:disabled) {
				background: var(--secondary-background-color);
			}

			footer button.save {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
			}

			footer button:disabled {
				color: var(--disabled-text-color, #999);
				background: transparent;
				cursor: default;
			}
		`,
	];

	// Starts editing a copy of `file`
	async open(file: FileEntry): Promise<void> {
		this._editing = file;
		this._base = draftOf(file);
		this._draft = draftOf(file);
		this._saving = false;
		this._error = undefined;
		await this.updateComplete;
		if (this._dialog && !this._dialog.open) {
			this._dialog.showModal();
		}
	}

	get isOpen(): boolean {
		return this._dialog?.open ?? false;
	}

	close(): void {
		if (this._dialog?.open) {
			this._dialog.close();
		}
		this._forget();
	}

	// Ends the edit; tells the panel with sk-edit-closed
	private _forget() {
		if (!this._editing) {
			return;
		}
		this._editing = undefined;
		this._base = undefined;
		this._draft = undefined;
		this.dispatchEvent(
			new CustomEvent("sk-edit-closed", { bubbles: true, composed: true }),
		);
	}

	protected render() {
		const profile = this.profile;
		const draft = this._draft;
		const editing = this._editing;
		return html`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				${
					profile && draft && editing
						? this._renderContent(profile, draft, editing)
						: nothing
				}
			</dialog>
		`;
	}

	private _renderContent(
		profile: DeviceProfile,
		draft: FileDraft,
		editing: FileEntry,
	) {
		const changes = fileChanges(this._base as FileDraft, draft);
		const current = this.file;
		const gone = current === null;
		// (Not while saving: the saved values arrive before the save returns)
		const changedOnDevice =
			!this._saving &&
			current !== null &&
			current !== undefined &&
			!sameSettings(draftOf(current), this._base as FileDraft);
		const blocked =
			this.readOnlyReason ?? (gone ? strings.editGone : undefined);
		return html`
			<header>
				<h2 id="title">${strings.editTitle(editing.name)}</h2>
			</header>
			<div class="body">
				${
					gone
						? html`<div class="notice warning" role="status">${strings.editGone}</div>`
						: nothing
				}
				${
					changedOnDevice
						? html`<div class="notice warning" role="status">
								<span>${strings.editChanged}</span>
								<button class="reload" @click=${this._reload}>
									${strings.editReload}
								</button>
							</div>`
						: nothing
				}
				${
					this.readOnlyReason
						? html`<div class="notice warning" role="status">${this.readOnlyReason}</div>`
						: nothing
				}
				${this._renderMovements(profile, draft)}
				${profile.eye_icons.length ? this._renderEyes(profile, draft) : nothing}
				${profile.lights.map((channel) => {
					const light = draft.lights.find((l) => l.channel === channel.channel);
					return light
						? this._renderLight(profile, channel.label, light)
						: nothing;
				})}
				${
					this._error
						? html`<div class="notice error" role="alert">
								${strings.editFailed(this._error)}
							</div>`
						: nothing
				}
			</div>
			<footer>
				<button
					class="preview"
					title=${this.playing ? strings.stop : strings.editPreviewTitle}
					?disabled=${gone || this.readOnlyReason !== undefined}
					@click=${this._preview}
				>
					<ha-icon icon=${this.playing ? "mdi:stop" : "mdi:play"}></ha-icon>
					${this.playing ? strings.stop : strings.editPreview}
				</button>
				<span class="spacer"></span>
				<button
					class="cancel"
					?disabled=${this._saving}
					@click=${this._cancel}
				>
					${strings.cancel}
				</button>
				<button
					class="save"
					title=${blocked ?? (hasChanges(changes) ? strings.save : strings.editNothing)}
					?disabled=${this._saving || blocked !== undefined || !hasChanges(changes)}
					@click=${this._save}
				>
					${this._saving ? strings.saving : strings.save}
				</button>
			</footer>
		`;
	}

	private _renderMovements(profile: DeviceProfile, draft: FileDraft) {
		return html`
			<h3 id="movement">${strings.columnMovement}</h3>
			<div class="choices" role="group" aria-labelledby="movement">
				${profile.movements.map(
					(m) => html`<button
						class="choice movement"
						data-part=${m.part}
						aria-pressed=${draft.movements.includes(m.part) ? "true" : "false"}
						title=${m.part === ALL_PART ? strings.editAllTitle : m.label}
						@click=${() => this._toggleMovement(m.part)}
					>
						<span class="glyph" style="--sk-icon: url('${m.icon_url}')"></span>
						${m.label}
					</button>`,
				)}
			</div>
			${
				draft.movements.length
					? nothing
					: html`<p class="secondary">${strings.noMovement}</p>`
			}
		`;
	}

	private _renderEyes(profile: DeviceProfile, draft: FileDraft) {
		return html`
			<h3 id="eye">${strings.editEye}</h3>
			<div class="choices eyes" role="group" aria-labelledby="eye">
				${profile.eye_icons.map(
					(icon) => html`<button
						class="choice eye"
						data-value=${icon.value}
						aria-pressed=${draft.eye_icon === icon.value ? "true" : "false"}
						aria-label=${icon.label}
						title=${icon.label}
						@click=${() => this._update({ eye_icon: icon.value })}
					>
						<img src=${icon.url} alt="" loading="lazy" />
					</button>`,
				)}
			</div>
		`;
	}

	private _renderLight(
		profile: DeviceProfile,
		label: string,
		light: LightSettings,
	) {
		const id = `light-${light.channel}`;
		const set = (changes: Partial<LightSettings>) =>
			this._updateLight(light.channel, changes);
		const number = (ev: Event, low: number, high: number, fallback: number) =>
			clampInt(
				(ev.target as HTMLInputElement).valueAsNumber,
				low,
				high,
				fallback,
			);
		const maxSpeed = profile.max_effect_speed;
		return html`
			<fieldset class="light" data-channel=${light.channel}>
				<legend>${label}</legend>
				<div class="field">
					<label for="${id}-brightness">${strings.editBrightness}</label>
					<div class="inline">
						<input
							id="${id}-brightness"
							class="brightness"
							type="range"
							min="0"
							max="255"
							.value=${live(String(light.brightness))}
							@input=${(ev: Event) =>
								set({ brightness: number(ev, 0, 255, light.brightness) })}
						/>
						<input
							type="number"
							class="brightness-number"
							aria-label=${strings.editBrightness}
							min="0"
							max="255"
							.value=${live(String(light.brightness))}
							@change=${(ev: Event) =>
								set({ brightness: number(ev, 0, 255, light.brightness) })}
						/>
					</div>
				</div>
				<div class="field">
					<label for="${id}-color">${strings.editColor}</label>
					<div class="inline rgb">
						<input
							id="${id}-color"
							class="color"
							type="color"
							.value=${live(rgbToHex(light.rgb))}
							@input=${(ev: Event) => {
								const rgb = hexToRgb((ev.target as HTMLInputElement).value);
								if (rgb) {
									set({ rgb });
								}
							}}
						/>
						${(["R", "G", "B"] as const).map(
							(name, i) => html`<label>
								${name}
								<input
									type="number"
									class="rgb-${name.toLowerCase()}"
									min="0"
									max="255"
									.value=${live(String(light.rgb[i]))}
									@change=${(ev: Event) => {
										const rgb = [...light.rgb] as [number, number, number];
										rgb[i] = number(ev, 0, 255, light.rgb[i]);
										set({ rgb });
									}}
								/>
							</label>`,
						)}
					</div>
				</div>
				<div class="field">
					<label for="${id}-mode">${strings.editEffect}</label>
					<div class="inline">
						<select
							id="${id}-mode"
							class="mode"
							.value=${live(String(light.effect_mode))}
							@change=${(ev: Event) =>
								set({
									effect_mode: Number((ev.target as HTMLSelectElement).value),
								})}
						>
							${profile.light_modes.map(
								// ?selected sets the first render (the select's
								// value binding runs before its options exist);
								// .value keeps later renders right
								(mode, i) => html`<option
									value=${i + 1}
									?selected=${light.effect_mode === i + 1}
								>
									${mode}
								</option>`,
							)}
						</select>
					</div>
				</div>
				${
					modeHasSpeed(profile, light.effect_mode)
						? html`<div class="field">
								<label for="${id}-speed">${strings.editSpeed}</label>
								<div class="inline">
									<input
										id="${id}-speed"
										class="speed"
										type="range"
										min="0"
										max=${maxSpeed}
										.value=${live(String(light.effect_speed))}
										@input=${(ev: Event) =>
											set({
												effect_speed: number(
													ev,
													0,
													maxSpeed,
													light.effect_speed,
												),
											})}
									/>
									<input
										type="number"
										class="speed-number"
										aria-label=${strings.editSpeed}
										min="0"
										max=${maxSpeed}
										.value=${live(String(light.effect_speed))}
										@change=${(ev: Event) =>
											set({
												effect_speed: number(
													ev,
													0,
													maxSpeed,
													light.effect_speed,
												),
											})}
									/>
								</div>
							</div>`
						: nothing
				}
				<div class="field">
					<span></span>
					<label class="check">
						<input
							type="checkbox"
							class="cycle"
							.checked=${light.color_cycle}
							@change=${(ev: Event) =>
								set({ color_cycle: (ev.target as HTMLInputElement).checked })}
						/>
						${strings.editColorCycle}
					</label>
				</div>
			</fieldset>
		`;
	}

	private _update(changes: Partial<FileDraft>) {
		if (this._draft) {
			this._draft = { ...this._draft, ...changes };
			this._error = undefined;
		}
	}

	private _toggleMovement(part: string) {
		if (this._draft && this.profile) {
			this._update({
				movements: toggleMovement(this.profile, this._draft.movements, part),
			});
		}
	}

	private _updateLight(channel: number, changes: Partial<LightSettings>) {
		if (this._draft) {
			this._update({
				lights: this._draft.lights.map((l) =>
					l.channel === channel ? { ...l, ...changes } : l,
				),
			});
		}
	}

	// Takes the file's current settings, dropping the user's changes
	private _reload() {
		if (this.file) {
			this._editing = this.file;
			this._base = draftOf(this.file);
			this._draft = draftOf(this.file);
			this._error = undefined;
		}
	}

	private _preview() {
		this.dispatchEvent(
			new CustomEvent(this.playing ? "sk-preview-stop" : "sk-preview", {
				// The current entry: its index may have changed since opening
				detail: { file: this.file ?? this._editing },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private async _save() {
		const editing = this._editing;
		if (!editing || !this._base || !this._draft || !this.save || this._saving) {
			return;
		}
		const changes = fileChanges(this._base, this._draft);
		if (!hasChanges(changes)) {
			return;
		}
		this._saving = true;
		this._error = undefined;
		try {
			await this.save(editing, changes);
			// Still the same edit (not closed or reopened meanwhile)
			if (this._editing === editing) {
				this.close();
			}
		} catch (err) {
			if (this._editing === editing) {
				this._error = errorMessage(err);
			} else {
				// The dialog closed meanwhile: say so where it can be seen
				this.dispatchEvent(
					new CustomEvent("hass-notification", {
						detail: {
							message: strings.editFailedFor(editing.name, errorMessage(err)),
						},
						bubbles: true,
						composed: true,
					}),
				);
			}
		} finally {
			this._saving = false;
		}
	}

	private _cancel() {
		this.close();
	}

	// Escape: discard the changes, unless a save is running
	private _onCancel(ev: Event) {
		if (this._saving) {
			ev.preventDefault();
		}
	}

	// The dialog closed (Escape or close()): forget the edit
	private _onClose() {
		if (!this._dialog?.open) {
			this._forget();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.close();
	}
}
