import { describe, expect, it } from "vitest";
import { CARD_ELEMENT, PANEL_ELEMENT } from "../src/constants";
import { register } from "../src/main";

describe("register", () => {
	it("defines the panel and the card and adds the card to the picker", () => {
		expect(customElements.get(PANEL_ELEMENT)).toBeDefined();
		expect(customElements.get(CARD_ELEMENT)).toBeDefined();
		expect(
			window.customCards?.filter((c) => c.type === CARD_ELEMENT),
		).toHaveLength(1);
	});

	it("can run again, as when the bundle is loaded twice", () => {
		register();
		expect(
			window.customCards?.filter((c) => c.type === CARD_ELEMENT),
		).toHaveLength(1);
	});
});
