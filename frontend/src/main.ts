// Entry point of the bundle. Home Assistant loads it on every page (so the
// card is defined wherever a dashboard shows it) and as the panel's module.
// Both can happen in one page, and an older copy may already be loaded, so
// every registration checks first.

import { CARD_PICKER_ENTRY, SkellyUltraCard } from "./card/skelly-ultra-card";
import { CARD_ELEMENT, PANEL_ELEMENT } from "./constants";
import { SkellyUltraPanel } from "./panel/skelly-ultra-panel";

export function register(): void {
	if (!customElements.get(PANEL_ELEMENT)) {
		customElements.define(PANEL_ELEMENT, SkellyUltraPanel);
	}
	if (!customElements.get(CARD_ELEMENT)) {
		customElements.define(CARD_ELEMENT, SkellyUltraCard);
	}

	window.customCards = window.customCards ?? [];
	if (!window.customCards.some((card) => card.type === CARD_ELEMENT)) {
		window.customCards.push(CARD_PICKER_ENTRY);
	}
}

register();
