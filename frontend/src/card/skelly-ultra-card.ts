import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { CARD_ELEMENT } from "../constants";
import type { HomeAssistant, LovelaceCardConfig } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

export interface SkellyUltraCardConfig extends LovelaceCardConfig {
	device_id?: string;
}

// The Skelly Ultra dashboard card. For now it's a placeholder that shows it
// is wired up; the real card (status, text to speech, files) comes later.
export class SkellyUltraCard extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@state() private _config?: SkellyUltraCardConfig;

	// The config the card picker adds the card with
	static getStubConfig(): Omit<SkellyUltraCardConfig, "type"> {
		return {};
	}

	setConfig(config: SkellyUltraCardConfig): void {
		if (!config) {
			throw new Error("Invalid configuration");
		}
		this._config = config;
	}

	getCardSize(): number {
		return 2;
	}

	static styles = [
		sharedStyles,
		css`
			ha-card {
				padding: 16px;
			}

			.header {
				font-size: 20px;
				margin-bottom: 8px;
			}

			p {
				margin: 0 0 8px;
			}
		`,
	];

	protected render() {
		if (!this._config) {
			return null;
		}
		return html`
			<ha-card>
				<div class="header">${strings.cardName}</div>
				<p>${strings.greeting(this.hass?.user?.name ?? "")}</p>
			</ha-card>
		`;
	}
}

export const CARD_PICKER_ENTRY = {
	type: CARD_ELEMENT,
	name: strings.cardName,
	description: strings.cardDescription,
	preview: true,
	documentationURL: "https://github.com/martinecker/SkellyUltra",
};
