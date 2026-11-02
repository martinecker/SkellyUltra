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

describe("card", () => {
	it("needs no config from the card picker and renders the user's name", async () => {
		const Card = customElements.get(CARD_ELEMENT) as unknown as {
			new (): HTMLElement & {
				setConfig(c: object): void;
				hass: unknown;
				updateComplete: Promise<boolean>;
			};
			getStubConfig(): object;
		};
		const card = new Card();
		card.setConfig({ type: `custom:${CARD_ELEMENT}`, ...Card.getStubConfig() });
		card.hass = { user: { name: "Martin" } };
		document.body.append(card);
		await card.updateComplete;
		expect(card.shadowRoot?.textContent).toContain("Hello, Martin!");
		card.remove();
	});
});

describe("panel", () => {
	it("renders the user's name", async () => {
		const panel = document.createElement(PANEL_ELEMENT) as HTMLElement & {
			hass: unknown;
			updateComplete: Promise<boolean>;
		};
		panel.hass = { user: { name: "Martin" } };
		document.body.append(panel);
		await panel.updateComplete;
		expect(panel.shadowRoot?.textContent).toContain("Hello, Martin!");
		panel.remove();
	});
});
