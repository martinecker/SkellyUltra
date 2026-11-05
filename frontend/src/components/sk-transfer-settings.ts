import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { errorMessage } from "../api/actions";
import {
	SMALL_CHUNK_SIZE,
	setBitrate,
	setChunkSize,
} from "../api/transfer-settings";
import type { TransferSettings } from "../api/types";
import type { HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

const CHUNK_STEP = 10;
// How long (in ms) a change is shown before the reported settings, if they
// don't come back with it (e.g. HA skipped the call on an unavailable entity)
export const SETTINGS_SETTLE_MS = 3000;

// Whether the reported settings include a change
function applied(settings: TransferSettings, expected: TransferSettings) {
	const same = <T>(a: { override: boolean; value: T }, b: typeof a) =>
		a.override === b.override && (!a.override || a.value === b.value);
	return (
		same(settings.chunk_size, expected.chunk_size) &&
		same(settings.bitrate, expected.bitrate)
	);
}

// The chunk size and bitrate overrides of a Skelly's file transfers. They
// apply to the next transfer and change the integration's override entities.
export class SkTransferSettings extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ attribute: false }) settings?: TransferSettings;
	@property({ type: Boolean }) disabled = false;

	// A change is being written
	@state() private _busy = false;
	@state() private _error?: string;
	// The settings as just changed, shown until the Skelly's file list
	// reports them
	@state() private _expected?: TransferSettings;
	private _settleTimer?: ReturnType<typeof setTimeout>;

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			fieldset {
				margin: 16px 0 0;
				padding: 8px 12px 12px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			legend {
				padding: 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px 12px;
				min-height: 40px;
			}

			label {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 14px;
				cursor: pointer;
			}

			input[type="checkbox"] {
				width: 18px;
				height: 18px;
				margin: 0;
				accent-color: var(--primary-color);
			}

			input[type="number"],
			select {
				box-sizing: border-box;
				font: inherit;
				font-size: 14px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 8px;
			}

			input[type="number"] {
				width: 6em;
			}

			.note {
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.warning {
				margin: 4px 0;
				font-size: 12px;
				color: var(--warning-color, #ffa600);
			}

			.error {
				margin: 4px 0;
				font-size: 12px;
				color: var(--error-color, #db4437);
			}
		`,
	];

	protected willUpdate(changed: PropertyValues<this>): void {
		// Partly applied changes (switch on, value not yet set) keep showing
		// the change
		if (
			changed.has("settings") &&
			this._expected &&
			this.settings &&
			applied(this.settings, this._expected)
		) {
			this._dropExpected();
		}
	}

	// The select's value is set after its options exist (a value binding on
	// the select runs before them)
	protected updated(): void {
		const select =
			this.renderRoot.querySelector<HTMLSelectElement>("select.bitrate");
		const settings = this._expected ?? this.settings;
		if (select && settings && select.value !== settings.bitrate.value) {
			select.value = settings.bitrate.value;
		}
	}

	protected render() {
		const settings = this._expected ?? this.settings;
		if (!settings) {
			return nothing;
		}
		const { chunk_size: chunk, bitrate } = settings;
		const off = this.disabled || this._busy;
		const small =
			!chunk.override && chunk.auto !== null && chunk.auto < SMALL_CHUNK_SIZE;
		return html`
			<fieldset>
				<legend>${strings.transferSettings}</legend>
				<div class="row">
					<label>
						<input
							type="checkbox"
							class="chunk-override"
							.checked=${live(chunk.override)}
							?disabled=${off || !chunk.switch_entity || !chunk.value_entity}
							@change=${this._onChunkOverride}
						/>
						${strings.chunkOverride}
					</label>
					${
						chunk.override
							? html`<span>
									<input
										type="number"
										class="chunk-size"
										aria-label=${strings.chunkOverride}
										min=${chunk.min}
										max=${chunk.max}
										step=${CHUNK_STEP}
										.value=${live(String(chunk.value))}
										?disabled=${off}
										@change=${this._onChunkSize}
									/>
									${strings.chunkUnit}
								</span>`
							: html`<span class="note">${strings.chunkAuto(chunk.auto)}</span>`
					}
				</div>
				${
					small && chunk.auto !== null
						? html`<p class="warning">${strings.chunkSmall(chunk.auto)}</p>`
						: nothing
				}
				<div class="row">
					<label>
						<input
							type="checkbox"
							class="bitrate-override"
							.checked=${live(bitrate.override)}
							?disabled=${off || !bitrate.switch_entity || !bitrate.value_entity}
							@change=${this._onBitrateOverride}
						/>
						${strings.bitrateOverride}
					</label>
					${
						bitrate.override
							? html`<select
									class="bitrate"
									aria-label=${strings.bitrateOverride}
									?disabled=${off}
									@change=${this._onBitrate}
								>
									${bitrate.options.map(
										(option) =>
											html`<option
												value=${option}
												?selected=${option === bitrate.value}
											>
												${option}
											</option>`,
									)}
								</select>`
							: html`<span class="note">${strings.bitrateDefault(bitrate.default)}</span>`
					}
				</div>
				${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
			</fieldset>
		`;
	}

	private _onChunkOverride(ev: Event) {
		const settings = this._expected ?? this.settings;
		if (!settings) {
			return;
		}
		const on = (ev.target as HTMLInputElement).checked;
		void this._apply(
			{ ...settings, chunk_size: { ...settings.chunk_size, override: on } },
			(hass) =>
				setChunkSize(hass, settings, on ? settings.chunk_size.value : null),
		);
	}

	private _onChunkSize(ev: Event) {
		const settings = this._expected ?? this.settings;
		const input = ev.target as HTMLInputElement;
		if (!settings) {
			return;
		}
		const { min, max, value: current } = settings.chunk_size;
		const typed = Number(input.value);
		if (!Number.isFinite(typed) || input.value.trim() === "") {
			input.value = String(current);
			return;
		}
		const value = Math.min(
			max,
			Math.max(min, Math.round(typed / CHUNK_STEP) * CHUNK_STEP),
		);
		input.value = String(value);
		if (value !== current) {
			void this._apply(
				{ ...settings, chunk_size: { ...settings.chunk_size, value } },
				(hass) => setChunkSize(hass, settings, value),
			);
		}
	}

	private _onBitrateOverride(ev: Event) {
		const settings = this._expected ?? this.settings;
		if (!settings) {
			return;
		}
		const on = (ev.target as HTMLInputElement).checked;
		void this._apply(
			{ ...settings, bitrate: { ...settings.bitrate, override: on } },
			(hass) => setBitrate(hass, settings, on ? settings.bitrate.value : null),
		);
	}

	private _onBitrate(ev: Event) {
		const settings = this._expected ?? this.settings;
		if (!settings) {
			return;
		}
		const value = (ev.target as HTMLSelectElement).value;
		void this._apply(
			{ ...settings, bitrate: { ...settings.bitrate, value } },
			(hass) => setBitrate(hass, settings, value),
		);
	}

	// Writes a change and shows it meanwhile; the new settings come back
	// with the next file list
	private async _apply(
		expected: TransferSettings,
		change: (hass: HomeAssistant) => Promise<void>,
	): Promise<void> {
		const hass = this.hass;
		if (!hass || this._busy) {
			this.requestUpdate();
			return;
		}
		this._busy = true;
		this._error = undefined;
		this._expected = expected;
		clearTimeout(this._settleTimer);
		try {
			await change(hass);
			if (this._expected === expected) {
				this._settleTimer = setTimeout(() => {
					this._dropExpected();
					this._error = strings.settingsNotApplied;
				}, SETTINGS_SETTLE_MS);
			}
		} catch (err) {
			this._dropExpected();
			this._error = strings.settingsFailed(errorMessage(err));
		} finally {
			this._busy = false;
		}
	}

	private _dropExpected(): void {
		clearTimeout(this._settleTimer);
		this._settleTimer = undefined;
		this._expected = undefined;
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this._dropExpected();
	}
}
