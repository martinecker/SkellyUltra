import { afterEach, describe, expect, it, vi } from "vitest";

// No YAML editor and nothing to load it with
const { TTS_FORM_ELEMENT } = await import("../src/constants");
await import("../src/main");
type SkTtsForm = import("../src/components/sk-tts-form").SkTtsForm;
type TtsChangeDetail = import("../src/components/sk-tts-form").TtsChangeDetail;

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
		await vi.advanceTimersByTimeAsync(0);
		await el.updateComplete;
	}
};

describe("text to speech: without HA's YAML editor", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
	});

	it("says it's loading, then that it didn't load, and still sends", async () => {
		vi.useFakeTimers();
		const el = document.createElement(TTS_FORM_ELEMENT) as SkTtsForm;
		el.hass = hass as never;
		el.active = true;
		const changes: TtsChangeDetail[] = [];
		el.addEventListener("sk-tts-change", (ev) =>
			changes.push((ev as CustomEvent<TtsChangeDetail>).detail),
		);
		document.body.append(el);
		await settle(el);
		const details = () => el.shadowRoot?.querySelector("details")?.textContent;
		expect(details()).toContain("Loading Home Assistant's YAML editor");
		const message = el.shadowRoot?.querySelector(
			"textarea.message",
		) as HTMLTextAreaElement;
		message.value = "Boo";
		message.dispatchEvent(new Event("input"));
		await settle(el);
		// Without options meanwhile
		expect(changes.at(-1)?.speech).toEqual({
			tts_entity: "tts.piper",
			message: "Boo",
			language: "en",
		});
		await vi.advanceTimersByTimeAsync(10_000);
		await settle(el);
		expect(details()).toContain("didn't load");
		// No YAML help without the editor
		expect(details()).not.toContain("key: value");
		expect(el.shadowRoot?.querySelector("ha-yaml-editor")).toBeNull();
	});
});
