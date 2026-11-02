import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import type { HomeAssistant, PanelInfo } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

export interface PanelConfig {
	// Hash of the bundle that the backend serves; compared with the running
	// bundle's own hash in a later phase, to offer a reload after an update
	version?: string;
}

// The Skelly sidebar panel. Home Assistant creates it and sets hass, narrow,
// route and panel. For now it's a placeholder that shows it is wired up.
export class SkellyUltraPanel extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean, reflect: true }) narrow = false;
	@property({ attribute: false }) panel?: PanelInfo<PanelConfig>;

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

			.content {
				padding: 16px;
			}

			ha-card {
				padding: 16px;
				max-width: 600px;
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
						: null
				}
				<div class="title">${strings.panelTitle}</div>
			</div>
			<div class="content">
				<ha-card>
					<p>${strings.greeting(this.hass?.user?.name ?? "")}</p>
					<p class="secondary">${strings.placeholder}</p>
				</ha-card>
			</div>
		`;
	}

	// What HA's own menu button does: the sidebar is hidden on narrow screens
	private _toggleSidebar() {
		this.dispatchEvent(
			new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }),
		);
	}
}
