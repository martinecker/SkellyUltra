import { afterEach, describe, expect, it, vi } from "vitest";

// Older HA: no YAML editor yet, but an object selector loads it
const loaded = vi.fn();
class FakeSelector extends HTMLElement {
	hass?: unknown;
	selector?: unknown;
	connectedCallback() {
		loaded(this.selector, this.hidden);
		setTimeout(() => {
			if (!customElements.get("ha-yaml-editor")) {
				customElements.define(
					"ha-yaml-editor",
					class extends HTMLElement {
						yaml = "";
					},
				);
			}
		}, 0);
	}
}
customElements.define("ha-selector", FakeSelector);

const { TTS_FORM_ELEMENT } = await import("../src/constants");
await import("../src/main");
type SkTtsForm = import("../src/components/sk-tts-form").SkTtsForm;

const hass = {
	user: { id: "u1", name: "Martin", is_admin: true },
	language: "en",
	states: {},
	callWS: vi.fn(async (msg: Record<string, unknown>) =>
		msg.type === "tts/engine/list"
			? { providers: [{ engine_id: "tts.piper", supported_languages: ["en"] }] }
			: { voices: null },
	),
	fetchWithAuth: vi.fn(),
};

const settle = async (el: SkTtsForm) => {
	for (let i = 0; i < 4; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await el.updateComplete;
	}
};

describe("text to speech: loading HA's YAML editor", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("loads it through an object selector when shown", async () => {
		const el = document.createElement(TTS_FORM_ELEMENT) as SkTtsForm;
		el.hass = hass as never;
		document.body.append(el);
		await settle(el);
		// Not before it is shown
		expect(loaded).not.toHaveBeenCalled();
		el.active = true;
		await settle(el);
		expect(loaded).toHaveBeenCalledWith({ object: {} }, true);
		// The loader is gone again, and the form uses the editor now
		expect(document.body.querySelector("ha-selector")).toBeNull();
		expect(el.shadowRoot?.querySelector("ha-yaml-editor")).not.toBeNull();
	});
});
