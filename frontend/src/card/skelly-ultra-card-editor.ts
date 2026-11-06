import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import {
	configProblem,
	DEFAULT_MAX_FILES,
	MAX_FILES_LIMIT,
	type SkellyUltraCardConfig,
} from "./skelly-ultra-card";

// The fields of the card's visual editor, as ha-form schema
export const EDITOR_SCHEMA = [
	{
		name: "device_id",
		required: true,
		selector: { device: { integration: "skelly_ultra" } },
	},
	{ name: "tts_entity", selector: { entity: { domain: "tts" } } },
	{ name: "show_tts", selector: { boolean: {} } },
	{ name: "show_files", selector: { boolean: {} } },
	{
		name: "max_files",
		selector: { number: { min: 1, max: MAX_FILES_LIMIT, mode: "box" } },
	},
] as const;

const LABELS: Record<string, string> = {
	device_id: strings.editorDevice,
	tts_entity: strings.editorTtsEntity,
	show_tts: strings.editorShowTts,
	show_files: strings.editorShowFiles,
	max_files: strings.editorMaxFiles,
};

const HELPERS: Record<string, string> = {
	tts_entity: strings.editorTtsEntityHelper,
};

// Defaults aren't written into the config, so the YAML stays short
const DEFAULTS: Record<string, unknown> = {
	show_tts: true,
	show_files: true,
	max_files: DEFAULT_MAX_FILES,
};

// The card's visual editor. HA loads ha-form for card editors, so this one
// place uses it.
export class SkellyUltraCardEditor extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@state() private _config?: SkellyUltraCardConfig;

	// Throwing makes HA show its YAML editor instead
	setConfig(config: SkellyUltraCardConfig): void {
		const problem = configProblem(config);
		if (problem) {
			throw new Error(problem);
		}
		this._config = config;
	}

	protected render() {
		if (!this.hass || !this._config) {
			return nothing;
		}
		return html`<ha-form
			.hass=${this.hass}
			.data=${{ ...DEFAULTS, ...this._config }}
			.schema=${EDITOR_SCHEMA}
			.computeLabel=${(field: { name: string }) => LABELS[field.name] ?? field.name}
			.computeHelper=${(field: { name: string }) => HELPERS[field.name]}
			@value-changed=${this._onChange}
		></ha-form>`;
	}

	private _onChange(ev: CustomEvent<{ value: Record<string, unknown> }>) {
		ev.stopPropagation();
		// ha-form sends all of its data back, with what changed
		const config: Record<string, unknown> = {
			type: this._config?.type,
			...ev.detail.value,
		};
		for (const [key, value] of Object.entries(config)) {
			if (
				value === undefined ||
				value === null ||
				value === "" ||
				DEFAULTS[key] === value
			) {
				delete config[key];
			}
		}
		this._config = config as SkellyUltraCardConfig;
		this.dispatchEvent(
			new CustomEvent("config-changed", {
				detail: { config },
				bubbles: true,
				composed: true,
			}),
		);
	}
}
