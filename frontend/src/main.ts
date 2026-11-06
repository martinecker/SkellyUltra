// Entry point of the bundle. Home Assistant loads it on every page (so the
// card is defined wherever a dashboard shows it) and as the panel's module.
// Both can happen in one page, and an older copy may already be loaded, so
// every registration checks first.

import { CARD_PICKER_ENTRY, SkellyUltraCard } from "./card/skelly-ultra-card";
import { SkellyUltraCardEditor } from "./card/skelly-ultra-card-editor";
import { SkAddFileDialog } from "./components/sk-add-file-dialog";
import { SkConfirm } from "./components/sk-confirm";
import { SkEditDialog } from "./components/sk-edit-dialog";
import { SkFileTable } from "./components/sk-file-table";
import { SkMediaBrowser } from "./components/sk-media-browser";
import { SkTransferBar } from "./components/sk-transfer-bar";
import { SkTransferSettings } from "./components/sk-transfer-settings";
import { SkTtsForm } from "./components/sk-tts-form";
import {
	ADD_FILE_DIALOG_ELEMENT,
	CARD_EDITOR_ELEMENT,
	CARD_ELEMENT,
	CONFIRM_ELEMENT,
	EDIT_DIALOG_ELEMENT,
	FILE_TABLE_ELEMENT,
	MEDIA_BROWSER_ELEMENT,
	PANEL_ELEMENT,
	TRANSFER_BAR_ELEMENT,
	TRANSFER_SETTINGS_ELEMENT,
	TTS_FORM_ELEMENT,
} from "./constants";
import { SkellyUltraPanel } from "./panel/skelly-ultra-panel";

const ELEMENTS: [string, CustomElementConstructor][] = [
	[FILE_TABLE_ELEMENT, SkFileTable],
	[TRANSFER_BAR_ELEMENT, SkTransferBar],
	[CONFIRM_ELEMENT, SkConfirm],
	[EDIT_DIALOG_ELEMENT, SkEditDialog],
	[MEDIA_BROWSER_ELEMENT, SkMediaBrowser],
	[TRANSFER_SETTINGS_ELEMENT, SkTransferSettings],
	[TTS_FORM_ELEMENT, SkTtsForm],
	[ADD_FILE_DIALOG_ELEMENT, SkAddFileDialog],
	[PANEL_ELEMENT, SkellyUltraPanel],
	[CARD_ELEMENT, SkellyUltraCard],
	[CARD_EDITOR_ELEMENT, SkellyUltraCardEditor],
];

export function register(): void {
	// The panel's parts first, so they're ready when the panel renders
	for (const [name, element] of ELEMENTS) {
		if (!customElements.get(name)) {
			customElements.define(name, element);
		}
	}

	window.customCards = window.customCards ?? [];
	if (!window.customCards.some((card) => card.type === CARD_ELEMENT)) {
		window.customCards.push(CARD_PICKER_ENTRY);
	}
}

register();
