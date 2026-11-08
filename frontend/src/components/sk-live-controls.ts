import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { errorMessage } from "../api/actions";
import { hexToRgb, modeHasSpeed, rgbToHex } from "../api/edit";
import {
	brightnessOf,
	callLive,
	eyeIconOf,
	eyeIconOption,
	isOn,
	type LiveCall,
	lightCall,
	lightModeOf,
	numberCall,
	numberOf,
	pressCall,
	rgbOf,
	selectCall,
	stateOf,
	switchCall,
	usable,
} from "../api/live";
import type { DeviceProfile, LiveControls, LiveLight } from "../api/types";
import type { HassEntity, HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";
import { showToast } from "../toast";

// How long (in ms) a value sent is still shown, once its call is done, if
// its entity doesn't change
export const PENDING_MS = 4000;

// Fired (sk-live-open) when the section is opened or closed; the panel or
// card keeps it so
export interface LiveOpenEventDetail {
	open: boolean;
}

// A value sent to an entity, shown until the entity's state changes
interface Pending {
	value: unknown;
	// The entity's state when it was sent
	before: HassEntity | undefined;
	// Set once the call is done: then waits PENDING_MS for the state
	timer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_RGB: [number, number, number] = [255, 255, 255];

// Changes a Skelly right now through its entities: eye icon, movement,
// lights and volume, as far as the Skelly has them. A collapsible section:
// the header opens and closes it (sk-live-open); the panel or card keeps
// `open`. Only controls whose entity HA has (it isn't disabled) are shown.
export class SkLiveControls extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ attribute: false }) profile?: DeviceProfile;
	@property({ attribute: false }) controls?: LiveControls;
	@property({ type: Boolean, reflect: true }) open = false;
	// Why the controls can't be used now (e.g. not connected), or undefined
	@property({ attribute: false }) disabledReason?: string;
	// Smaller pictures and a tighter layout (the card, a phone)
	@property({ type: Boolean, reflect: true }) narrow = false;
	// Shows an error; a toast by default
	@property({ attribute: false }) onError?: (message: string) => void;

	// Values sent, by entity_id and field, until the entity reports back
	private readonly _pending = new Map<string, Pending>();
	// The last color each light reported (HA leaves it out while off)
	private readonly _lastRgb = new Map<string, [number, number, number]>();

	disconnectedCallback(): void {
		super.disconnectedCallback();
		for (const pending of this._pending.values()) {
			clearTimeout(pending.timer);
		}
		this._pending.clear();
	}

	protected willUpdate(changed: PropertyValues<this>): void {
		if (!changed.has("hass")) {
			return;
		}
		// A value sent is shown until its entity reports something new
		for (const [key, pending] of this._pending) {
			const entityId = key.slice(0, key.indexOf("|"));
			if (stateOf(this.hass, entityId) !== pending.before) {
				clearTimeout(pending.timer);
				this._pending.delete(key);
			}
		}
		for (const light of this.controls?.lights ?? []) {
			const rgb = rgbOf(stateOf(this.hass, light.light_entity));
			if (rgb && light.light_entity) {
				this._lastRgb.set(light.light_entity, rgb);
			}
		}
	}

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			button.head {
				display: flex;
				align-items: center;
				gap: 6px;
				width: 100%;
				padding: 4px 0;
				font: inherit;
				font-weight: 500;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				cursor: pointer;
				text-align: left;
			}

			button.head ha-icon {
				--mdc-icon-size: 20px;
				color: var(--secondary-text-color);
			}

			.body {
				display: flex;
				flex-direction: column;
				gap: 12px;
				padding: 4px 0 8px;
			}

			.reason {
				margin: 0;
				font-size: 14px;
				color: var(--secondary-text-color);
			}

			h4 {
				margin: 0 0 6px;
				font-size: 13px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.choices {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 6px;
			}

			.choice {
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				gap: 2px;
				min-width: 56px;
				padding: 4px;
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

			.choice:disabled,
			button.move:disabled {
				cursor: default;
				opacity: 0.5;
			}

			.glyph {
				display: inline-block;
				width: 28px;
				height: 28px;
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
				width: 36px;
				height: 36px;
				object-fit: contain;
			}

			:host([narrow]) .eyes img {
				width: 28px;
				height: 28px;
			}

			:host([narrow]) .choice:not(.eye) {
				min-width: 48px;
			}

			:host([narrow]) .glyph {
				width: 22px;
				height: 22px;
			}

			button.move {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				align-self: stretch;
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
				padding: 4px 12px 4px 8px;
				cursor: pointer;
			}

			.lights {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
				gap: 8px;
			}

			fieldset {
				margin: 0;
				padding: 4px 10px 8px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
				min-width: 0;
			}

			legend {
				padding: 0 4px;
				font-size: 13px;
				font-weight: 500;
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 6px 10px;
				margin-top: 6px;
			}

			.row label {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 13px;
				color: var(--secondary-text-color);
			}

			.row label.slider {
				flex: 1 1 140px;
			}

			input[type="range"] {
				flex: 1;
				min-width: 80px;
				accent-color: var(--primary-color);
			}

			input[type="checkbox"] {
				margin: 0;
				accent-color: var(--primary-color);
			}

			input[type="color"] {
				width: 40px;
				height: 28px;
				padding: 0;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				background: transparent;
			}

			select {
				font: inherit;
				font-size: 13px;
				padding: 2px 6px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			.num {
				min-width: 2.5em;
				text-align: right;
				font-variant-numeric: tabular-nums;
				color: var(--primary-text-color);
			}
		`,
	];

	protected render() {
		return html`
			<button
				class="head"
				aria-expanded=${this.open ? "true" : "false"}
				aria-controls=${this.open ? "body" : nothing}
				@click=${this._toggleOpen}
			>
				<ha-icon icon=${this.open ? "mdi:chevron-down" : "mdi:chevron-right"}></ha-icon>
				${strings.liveControls}
			</button>
			${this.open ? this._renderBody() : nothing}
		`;
	}

	private _toggleOpen() {
		this.dispatchEvent(
			new CustomEvent<LiveOpenEventDetail>("sk-live-open", {
				detail: { open: !this.open },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private _renderBody() {
		const profile = this.profile;
		const controls = this.controls;
		if (!profile || !controls) {
			return nothing;
		}
		const disabled = this.disabledReason !== undefined;
		const parts = [
			this._renderEyes(profile, controls, disabled),
			this._renderMovements(profile, controls, disabled),
			this._renderLights(profile, controls, disabled),
			this._renderVolume(controls, disabled),
		].filter((part) => part !== nothing);
		return html`<div class="body" id="body">
			${
				this.disabledReason
					? html`<p class="reason" role="status">${this.disabledReason}</p>`
					: nothing
			}
			${parts.length ? parts : html`<p class="reason">${strings.liveNone}</p>`}
		</div>`;
	}

	private _renderEyes(
		profile: DeviceProfile,
		controls: LiveControls,
		disabled: boolean,
	) {
		const entityId = controls.eye_icon_entity;
		const entity = stateOf(this.hass, entityId);
		if (!entityId || !entity || !profile.eye_icons.length) {
			return nothing;
		}
		const off = disabled || !usable(entity);
		const current = this._shown(entityId, "eye", eyeIconOf(entity));
		return html`<div class="eyes-part">
			<h4 id="live-eye">${strings.editEye}</h4>
			<div class="choices eyes" role="group" aria-labelledby="live-eye">
				${profile.eye_icons.map(
					(icon) => html`<button
						class="choice eye"
						data-value=${icon.value}
						aria-pressed=${current === icon.value ? "true" : "false"}
						aria-label=${icon.label}
						title=${icon.label}
						?disabled=${off}
						@click=${() =>
							this._send(
								entityId,
								"eye",
								icon.value,
								selectCall(entityId, eyeIconOption(entity, icon)),
							)}
					>
						<img src=${icon.url} alt="" loading="lazy" />
					</button>`,
				)}
			</div>
		</div>`;
	}

	private _renderMovements(
		profile: DeviceProfile,
		controls: LiveControls,
		disabled: boolean,
	) {
		const shown = profile.movements.flatMap((m) => {
			const entityId =
				controls.movements.find((c) => c.part === m.part)?.entity ?? null;
			const entity = stateOf(this.hass, entityId);
			return entityId && entity ? [{ movement: m, entityId, entity }] : [];
		});
		if (!shown.length) {
			return nothing;
		}
		const triggerId = controls.trigger_movement_entity;
		const trigger = stateOf(this.hass, triggerId);
		const anyOn = shown.some(({ entityId, entity }) =>
			this._shown(entityId, "on", isOn(entity)),
		);
		return html`<div class="movement-part">
			<h4 id="live-movement">${strings.columnMovement}</h4>
			<div class="choices" role="group" aria-labelledby="live-movement">
				${shown.map(({ movement, entityId, entity }) => {
					const on = this._shown(entityId, "on", isOn(entity)) as boolean;
					return html`<button
						class="choice movement"
						data-part=${movement.part}
						aria-pressed=${on ? "true" : "false"}
						title=${movement.label}
						?disabled=${disabled || !usable(entity)}
						@click=${() =>
							this._send(entityId, "on", !on, switchCall(entityId, !on))}
					>
						<span class="glyph" style="--sk-icon: url('${movement.icon_url}')"></span>
						${movement.label}
					</button>`;
				})}
				${
					triggerId && trigger
						? html`<button
								class="move"
								title=${anyOn ? strings.liveMoveTitle : strings.liveMoveNone}
								?disabled=${disabled || !usable(trigger) || !anyOn}
								@click=${() => this._call(pressCall(triggerId))}
							>
								<ha-icon icon="mdi:run"></ha-icon>
								${strings.liveMove}
							</button>`
						: nothing
				}
			</div>
		</div>`;
	}

	private _renderLights(
		profile: DeviceProfile,
		controls: LiveControls,
		disabled: boolean,
	) {
		const lights = profile.lights.flatMap((info) => {
			const light = controls.lights.find((l) => l.channel === info.channel);
			return light &&
				(stateOf(this.hass, light.light_entity) ||
					stateOf(this.hass, light.effect_mode_entity) ||
					stateOf(this.hass, light.color_cycle_entity))
				? [this._renderLight(profile, info.label, light, disabled)]
				: [];
		});
		return lights.length
			? html`<div class="lights-part">
					<h4>${strings.liveLights}</h4>
					<div class="lights">${lights}</div>
				</div>`
			: nothing;
	}

	private _renderLight(
		profile: DeviceProfile,
		label: string,
		light: LiveLight,
		disabled: boolean,
	) {
		const id = `live-light-${light.channel}`;
		const lightId = light.light_entity;
		const lightState = stateOf(this.hass, lightId);
		const modeId = light.effect_mode_entity;
		const modeState = stateOf(this.hass, modeId);
		const speedId = light.effect_speed_entity;
		const speedState = stateOf(this.hass, speedId);
		const cycleId = light.color_cycle_entity;
		const cycleState = stateOf(this.hass, cycleId);
		const mode = modeId
			? (this._shown(modeId, "mode", lightModeOf(profile, modeState)) as number)
			: 0;
		const value = (ev: Event) => (ev.target as HTMLInputElement).valueAsNumber;
		return html`<fieldset class="light" data-channel=${light.channel}>
			<legend>${label}</legend>
			${
				lightId && lightState
					? this._renderLightColor(id, lightId, lightState, disabled)
					: nothing
			}
			<div class="row">
				${
					modeId && modeState
						? html`<label>
								${strings.editEffect}
								<select
									class="mode"
									?disabled=${disabled || !usable(modeState)}
									.value=${live(String(mode))}
									@change=${(ev: Event) => {
										const index = Number(
											(ev.target as HTMLSelectElement).value,
										);
										const option = profile.light_modes[index - 1];
										if (option) {
											this._send(
												modeId,
												"mode",
												index,
												selectCall(modeId, option),
											);
										}
									}}
								>
									${
										// Unknown: none of them, rather than the first
										mode
											? nothing
											: html`<option value="0" selected disabled hidden>–</option>`
									}
									${profile.light_modes.map(
										(name, i) => html`<option
											value=${i + 1}
											?selected=${mode === i + 1}
										>
											${name}
										</option>`,
									)}
								</select>
							</label>`
						: nothing
				}
				${
					cycleId && cycleState
						? html`<label>
								<input
									type="checkbox"
									class="cycle"
									?disabled=${disabled || !usable(cycleState)}
									.checked=${live(this._shown(cycleId, "on", isOn(cycleState)) as boolean)}
									@change=${(ev: Event) => {
										const on = (ev.target as HTMLInputElement).checked;
										this._send(cycleId, "on", on, switchCall(cycleId, on));
									}}
								/>
								${strings.editColorCycle}
							</label>`
						: nothing
				}
			</div>
			${
				speedId && speedState && (!mode || modeHasSpeed(profile, mode))
					? html`<div class="row">
							<label class="slider">
								${strings.editSpeed}
								<input
									type="range"
									class="speed"
									min="0"
									max=${profile.max_effect_speed}
									?disabled=${disabled || !usable(speedState)}
									.value=${live(String(this._shown(speedId, "value", numberOf(speedState) ?? 0)))}
									@change=${(ev: Event) => {
										const speed = value(ev);
										this._send(
											speedId,
											"value",
											speed,
											numberCall(speedId, speed),
										);
									}}
								/>
							</label>
						</div>`
					: nothing
			}
		</fieldset>`;
	}

	private _renderLightColor(
		id: string,
		lightId: string,
		lightState: HassEntity,
		disabled: boolean,
	) {
		const off = disabled || !usable(lightState);
		const brightness = this._shown(
			lightId,
			"brightness",
			brightnessOf(lightState),
		) as number;
		const rgb = this._shown(
			lightId,
			"rgb",
			rgbOf(lightState) ?? this._lastRgb.get(lightId) ?? DEFAULT_RGB,
		) as [number, number, number];
		return html`<div class="row">
			<label>
				<input
					type="checkbox"
					class="on"
					?disabled=${off}
					.checked=${live(brightness > 0)}
					@change=${(ev: Event) => {
						const on = (ev.target as HTMLInputElement).checked;
						// On: the light comes back at full brightness (off
						// keeps no brightness to go back to)
						this._send(
							lightId,
							"brightness",
							on ? 255 : 0,
							lightCall(lightId, on ? {} : { brightness: 0 }),
						);
					}}
				/>
				${strings.liveLightOn}
			</label>
			<input
				id="${id}-color"
				class="color"
				type="color"
				aria-label=${brightness > 0 ? strings.editColor : strings.liveColorOff}
				title=${brightness > 0 ? strings.editColor : strings.liveColorOff}
				?disabled=${off}
				.value=${live(rgbToHex(rgb))}
				@change=${(ev: Event) => {
					const picked = hexToRgb((ev.target as HTMLInputElement).value);
					if (picked) {
						this._send(
							lightId,
							"rgb",
							picked,
							lightCall(lightId, { rgb: picked }),
						);
					}
				}}
			/>
			<label class="slider">
				<ha-icon icon="mdi:brightness-6" title=${strings.editBrightness}></ha-icon>
				<input
					type="range"
					class="brightness"
					aria-label=${strings.editBrightness}
					min="0"
					max="255"
					?disabled=${off}
					.value=${live(String(brightness))}
					@change=${(ev: Event) => {
						const level = (ev.target as HTMLInputElement).valueAsNumber;
						this._send(
							lightId,
							"brightness",
							level,
							lightCall(lightId, { brightness: level }),
						);
					}}
				/>
			</label>
		</div>`;
	}

	private _renderVolume(controls: LiveControls, disabled: boolean) {
		const entityId = controls.volume_entity;
		const entity = stateOf(this.hass, entityId);
		if (!entityId || !entity) {
			return nothing;
		}
		const volume = this._shown(entityId, "value", numberOf(entity)) as
			| number
			| undefined;
		const min = Number(entity.attributes.min ?? 0);
		const max = Number(entity.attributes.max ?? 100);
		return html`<div class="volume-part">
			<h4 id="live-volume">${strings.liveVolume}</h4>
			<div class="row">
				<label class="slider">
					<input
						type="range"
						class="volume"
						aria-labelledby="live-volume"
						min=${min}
						max=${max}
						?disabled=${disabled || !usable(entity)}
						.value=${live(String(volume ?? min))}
						@change=${(ev: Event) => {
							const level = (ev.target as HTMLInputElement).valueAsNumber;
							this._send(entityId, "value", level, numberCall(entityId, level));
						}}
					/>
					<span class="num">${volume === undefined ? "–" : `${Math.round(volume)}%`}</span>
				</label>
			</div>
		</div>`;
	}

	// The value to show: the one just sent, until the entity reports back
	private _shown(entityId: string, field: string, actual: unknown): unknown {
		const pending = this._pending.get(`${entityId}|${field}`);
		return pending ? pending.value : actual;
	}

	// Sends a change and shows it right away
	private _send(
		entityId: string,
		field: string,
		value: unknown,
		call: LiveCall,
	): void {
		const key = `${entityId}|${field}`;
		const previous = this._pending.get(key);
		if (previous) {
			clearTimeout(previous.timer);
		}
		const pending: Pending = {
			value,
			before: stateOf(this.hass, entityId),
		};
		this._pending.set(key, pending);
		this.requestUpdate();
		const drop = () => {
			if (this._pending.get(key) === pending) {
				clearTimeout(pending.timer);
				this._pending.delete(key);
				this.requestUpdate();
			}
		};
		void this._call(call).then((ok) => {
			if (!ok) {
				drop();
			} else if (this._pending.get(key) === pending) {
				// HA usually has sent the new state by now; if the entity
				// didn't change, show its value again after a while
				pending.timer = setTimeout(drop, PENDING_MS);
			}
		});
	}

	// Makes the call; false (and says why) if it failed
	private async _call(call: LiveCall): Promise<boolean> {
		const hass = this.hass;
		if (!hass) {
			return false;
		}
		try {
			await callLive(hass, call);
			return true;
		} catch (err) {
			const message = strings.liveFailed(errorMessage(err));
			if (this.onError) {
				this.onError(message);
			} else {
				showToast(this, message);
			}
			return false;
		}
	}
}
