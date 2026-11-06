import { afterEach, describe, expect, it, vi } from "vitest";

// HA's YAML editor, as far as the form uses it. Defined before the form,
// like in newer HA where it is loaded already.
class FakeYamlEditor extends HTMLElement {
	hass?: unknown;
	readOnly = false;
	yaml = "";
	// Types YAML that HA's editor parsed to value
	type(yaml: string, value: unknown, isValid = true) {
		this.yaml = yaml;
		this.dispatchEvent(
			new CustomEvent("value-changed", {
				detail: { value, isValid },
				bubbles: true,
				composed: true,
			}),
		);
	}
}
customElements.define("ha-yaml-editor", FakeYamlEditor);

const { TTS_FORM_ELEMENT } = await import("../src/constants");
await import("../src/main");
type SkTtsForm = import("../src/components/sk-tts-form").SkTtsForm;
type TtsChangeDetail = import("../src/components/sk-tts-form").TtsChangeDetail;

function fakeHass() {
	return {
		user: { id: "u1", name: "Martin", is_admin: true },
		language: "en",
		states: {},
		callWS: vi.fn(async (msg: Record<string, unknown>) =>
			msg.type === "tts/engine/list"
				? {
						providers: [
							{
								engine_id: "google_translate",
								name: "Google Translate",
								supported_languages: ["en"],
							},
						],
					}
				: { voices: null },
		),
		fetchWithAuth: vi.fn(),
	};
}

async function showForm() {
	const el = document.createElement(TTS_FORM_ELEMENT) as SkTtsForm;
	el.hass = fakeHass() as never;
	el.active = true;
	const changes: TtsChangeDetail[] = [];
	const outside = vi.fn();
	document.body.addEventListener("value-changed", outside);
	el.addEventListener("sk-tts-change", (ev) =>
		changes.push((ev as CustomEvent<TtsChangeDetail>).detail),
	);
	document.body.append(el);
	await settle(el);
	const message = el.shadowRoot?.querySelector(
		"textarea.message",
	) as HTMLTextAreaElement;
	message.value = "Boo";
	message.dispatchEvent(new Event("input"));
	await settle(el);
	return { el, changes, outside };
}

const settle = async (el: SkTtsForm) => {
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await el.updateComplete;
	}
};

const editor = (el: SkTtsForm) =>
	el.shadowRoot?.querySelector("ha-yaml-editor") as FakeYamlEditor;
const hint = (el: SkTtsForm) =>
	el.shadowRoot?.querySelector("#options-hint")?.textContent?.trim();

describe("text to speech: extra options in HA's YAML editor", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		localStorage.clear();
	});

	it("uses HA's YAML editor for the extra options", async () => {
		const { el, changes, outside } = await showForm();
		expect(editor(el).hass).toBe(el.hass);
		expect(hint(el)).toContain("in YAML");
		editor(el).type("speed: 1.2\n", { speed: 1.2 });
		await settle(el);
		expect(changes.at(-1)?.speech).toEqual({
			tts_entity: "google_translate",
			message: "Boo",
			language: "en",
			tts_options: { speed: 1.2 },
		});
		// Kept to the form
		expect(outside).not.toHaveBeenCalled();
	});

	it("keeps Advanced open while it's edited, and closes it on reset", async () => {
		const { el } = await showForm();
		const details = () =>
			el.shadowRoot?.querySelector("details") as HTMLDetailsElement;
		const openByHand = async () => {
			details().open = true;
			details().dispatchEvent(new Event("toggle"));
			await settle(el);
		};
		await openByHand();
		editor(el).type("speed: 1\n", { speed: 1 });
		await settle(el);
		// Emptied to type it again
		editor(el).type("", {});
		await settle(el);
		expect(details().open).toBe(true);
		el.reset();
		await settle(el);
		expect(details().open).toBe(false);
		// Opened by hand without typing, too
		await openByHand();
		el.reset();
		await settle(el);
		expect(details().open).toBe(false);
	});

	it("says what's wrong with the YAML", async () => {
		const { el, changes } = await showForm();
		editor(el).type("speed: [", undefined, false);
		await settle(el);
		expect(changes.at(-1)?.speech).toBeUndefined();
		expect(changes.at(-1)?.problem).toBe("The extra options aren't valid YAML");
		expect(hint(el)).toBe("The extra options aren't valid YAML");
		editor(el).type("- 1", [1]);
		await settle(el);
		expect(changes.at(-1)?.problem).toBe(
			'The extra options must be "key: value" lines',
		);
		// Emptied: no options
		editor(el).type("", {});
		await settle(el);
		expect(changes.at(-1)?.problem).toBeUndefined();
		expect(changes.at(-1)?.speech?.tts_options).toBeUndefined();
	});

	it("starts the editor over on reset and locks it while disabled", async () => {
		const { el, changes } = await showForm();
		const first = editor(el);
		first.type("speed: 1.2\n", { speed: 1.2 });
		await settle(el);
		el.reset();
		el.disabled = true;
		await settle(el);
		expect(editor(el)).not.toBe(first);
		expect(editor(el).readOnly).toBe(true);
		expect(editor(el).classList.contains("locked")).toBe(true);
		expect(el.shadowRoot?.querySelector("details")?.open).toBe(false);
		expect(changes.at(-1)?.message).toBe("");
		const message = el.shadowRoot?.querySelector(
			"textarea.message",
		) as HTMLTextAreaElement;
		el.disabled = false;
		message.value = "Boo";
		message.dispatchEvent(new Event("input"));
		await settle(el);
		expect(changes.at(-1)?.speech?.tts_options).toBeUndefined();
	});
});
