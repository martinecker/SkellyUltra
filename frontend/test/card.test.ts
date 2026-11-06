import { afterEach, describe, expect, it, vi } from "vitest";

// HA's YAML editor, as far as the TTS form uses it
class FakeYamlEditor extends HTMLElement {
	type(value: unknown, isValid = true) {
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
await import("../src/main");

import type { FileEntry, FilesPayload, SkellyDevice } from "../src/api/types";
import type { SkellyUltraCard } from "../src/card/skelly-ultra-card";
import { CARD_ELEMENT } from "../src/constants";
import devicesFixture from "./fixtures/devices.json";
import filesFixture from "./fixtures/files-payload.json";

const DEVICE: SkellyDevice = devicesFixture[0];
const DEVICE_ID = DEVICE.device_id as string;
const base = filesFixture as FilesPayload;

// Eight files; seven in the play order, the first ones out of index order
const files: FileEntry[] = Array.from({ length: 8 }, (_, i) => ({
	...base.files[0],
	name: `file${i + 1}.mp3`,
	file_index: i + 1,
	enabled: i < 7,
}));
const payload: FilesPayload = {
	...base,
	entry_id: DEVICE.entry_id,
	device_id: DEVICE_ID,
	name: DEVICE.name,
	files,
	file_order: [3, 1, 2, 4, 5, 6, 7],
	playback: null,
	transfer: {
		status: "idle",
		in_progress: false,
		progress: 0,
		filename: null,
		error: null,
	},
};

const ENGINES = {
	providers: [
		{ engine_id: "tts.piper", supported_languages: ["en_US"] },
		{
			engine_id: "tts.google_translate_en_com",
			supported_languages: ["en"],
		},
		// A legacy engine: perform can't use it
		{ engine_id: "google_translate", supported_languages: ["en"] },
	],
};

const SWITCH = "switch.skelly_santa_live_mode";
const SPEAKER = "media_player.skelly_santa_live_mode_speaker";

// The live mode entities' states for each live mode
function liveStates(live: "on" | "off" | "connecting" | "missing") {
	if (live === "missing") {
		return { [SWITCH]: { entity_id: SWITCH, state: "off", attributes: {} } };
	}
	return {
		[SWITCH]: {
			entity_id: SWITCH,
			state: live === "off" ? "off" : "on",
			attributes: {},
		},
		[SPEAKER]: {
			entity_id: SPEAKER,
			state: live === "on" ? "idle" : "unavailable",
			attributes: {},
		},
	};
}

function fakeHass(
	options: {
		admin?: boolean;
		panel?: boolean;
		subscribeError?: { code: string; message: string };
		devices?: SkellyDevice[];
		engines?: Promise<unknown>;
		play?: Promise<unknown>;
		live?: "on" | "off" | "connecting" | "missing";
		perform?: Promise<{ status: string }>;
		switchCall?: Promise<unknown>;
		performError?: Error;
	} = {},
) {
	const callbacks: ((p: FilesPayload) => void)[] = [];
	// Changed by tests as they go
	const state = {
		subscribeError: options.subscribeError,
		devices: options.devices ?? [DEVICE],
	};
	const connection = {
		connected: true,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		subscribeMessage: vi.fn(async (callback: (p: FilesPayload) => void) => {
			if (state.subscribeError) {
				throw state.subscribeError;
			}
			callbacks.push(callback);
			setTimeout(() => callback(payload));
			return vi.fn().mockResolvedValue(undefined);
		}),
	};
	const hass = {
		connection,
		user: { id: "u1", name: "Martin", is_admin: options.admin ?? true },
		language: "en",
		states: liveStates(options.live ?? "on") as Record<string, unknown>,
		panels:
			options.panel === false
				? {}
				: { "skelly-ultra": { url_path: "skelly-ultra" } },
		callWS: vi.fn(async (msg: Record<string, unknown>) =>
			msg.type === "skelly_ultra/devices/list"
				? state.devices
				: msg.type === "tts/engine/list"
					? (options.engines ?? ENGINES)
					: msg.type === "tts/engine/voices"
						? { voices: null }
						: payload,
		),
		callService: vi.fn(
			async (
				_domain: string,
				service: string,
				_data?: Record<string, unknown>,
			) => {
				if (service === "perform") {
					if (options.performError) {
						throw options.performError;
					}
					return { response: await (options.perform ?? { status: "ok" }) };
				}
				if (_domain === "switch" && options.switchCall) {
					await options.switchCall;
				}
				if (service === "play_file" && options.play) {
					await options.play;
				}
				return { context: {} };
			},
		),
		fetchWithAuth: vi.fn(),
	};
	const send = (p: FilesPayload) => callbacks.at(-1)?.(p);
	return { hass, send, state };
}

const settle = async (card: SkellyUltraCard) => {
	for (let i = 0; i < 6; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await card.updateComplete;
		const form = card.shadowRoot?.querySelector("sk-tts-form") as
			| (HTMLElement & { updateComplete: Promise<boolean> })
			| null;
		await form?.updateComplete;
	}
};

async function showCard(
	config: Record<string, unknown> = { device_id: DEVICE_ID },
	hass: unknown = fakeHass().hass,
) {
	const card = document.createElement(CARD_ELEMENT) as SkellyUltraCard;
	card.setConfig({ type: `custom:${CARD_ELEMENT}`, ...config });
	card.hass = hass as never;
	document.body.append(card);
	await settle(card);
	return card;
}

const root = (card: SkellyUltraCard) => card.shadowRoot as ShadowRoot;
const text = (card: SkellyUltraCard) =>
	root(card).textContent?.replace(/\s+/g, " ") ?? "";
const form = (card: SkellyUltraCard) =>
	root(card).querySelector("sk-tts-form")?.shadowRoot as ShadowRoot;
const fileNames = (card: SkellyUltraCard) =>
	[...root(card).querySelectorAll("li .file")].map((e) => e.textContent);
const playButton = (card: SkellyUltraCard, name: string) =>
	[...root(card).querySelectorAll("li")]
		.find((li) => li.querySelector(".file")?.textContent === name)
		?.querySelector("button") as HTMLButtonElement;
const typeMessage = async (card: SkellyUltraCard, message: string) => {
	const box = form(card).querySelector(
		"textarea.message",
	) as HTMLTextAreaElement;
	box.value = message;
	box.dispatchEvent(new Event("input"));
	await settle(card);
};
const button = (card: SkellyUltraCard, cls: string) =>
	root(card).querySelector(`button.${cls}`) as HTMLButtonElement;
const reason = (card: SkellyUltraCard) =>
	root(card).querySelector("#say-reason")?.textContent?.trim();
const say = (card: SkellyUltraCard) => button(card, "say");
const performCall = (hass: { callService: { mock: { calls: unknown[][] } } }) =>
	[...hass.callService.mock.calls].reverse().find((c) => c[1] === "perform");
// Hidden in the quick box
const hiddenInForm = (card: SkellyUltraCard, selector: string) =>
	(form(card).querySelector(selector) as HTMLElement).closest<HTMLElement>(
		".part",
	)?.hidden;
const toasts = () => {
	const messages: string[] = [];
	document.addEventListener("hass-notification", (ev) =>
		messages.push((ev as CustomEvent).detail.message),
	);
	return messages;
};

const Card = () =>
	customElements.get(CARD_ELEMENT) as unknown as {
		getStubConfig(hass: unknown): Promise<object>;
		getConfigElement(): HTMLElement;
	};

describe("card", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		localStorage.clear();
		vi.useRealTimers();
	});

	it("is added from the picker with the first Skelly and a visual editor", async () => {
		const { hass } = fakeHass({
			devices: [{ ...DEVICE, device_id: null }, DEVICE],
		});
		expect(await Card().getStubConfig(hass)).toEqual({ device_id: DEVICE_ID });
		hass.callWS.mockRejectedValueOnce(new Error("down"));
		expect(await Card().getStubConfig(hass)).toEqual({});
		expect(Card().getConfigElement().localName).toBe(
			"skelly-ultra-card-editor",
		);
	});

	it("checks its config and sizes itself", async () => {
		const card = document.createElement(CARD_ELEMENT) as SkellyUltraCard;
		expect(() => card.setConfig({ type: "x", max_files: 0 })).toThrow(
			"max_files",
		);
		expect(() =>
			card.setConfig({ type: "x", show_tts: "yes" } as never),
		).toThrow();
		expect(() =>
			card.setConfig({ type: "x", device_id: 1 } as never),
		).toThrow();
		card.setConfig({ type: "x", device_id: DEVICE_ID });
		expect(card.getCardSize()).toBe(1 + 3 + 4);
		card.setConfig({
			type: "x",
			device_id: DEVICE_ID,
			show_tts: false,
			max_files: 2,
		});
		expect(card.getCardSize()).toBe(1 + 2);
	});

	it("asks for a Skelly when none is set", async () => {
		const card = await showCard({});
		expect(text(card)).toContain("Pick a Skelly in the card's settings.");
	});

	it("shows the Skelly's status and links to the panel", async () => {
		const card = await showCard();
		expect(text(card)).toContain("Skelly Santa");
		expect(text(card)).toContain("Live");
		expect(text(card)).toContain("3.9 MB free");
		const link = root(card).querySelector("a.name") as HTMLAnchorElement;
		expect(link.getAttribute("href")).toBe(`/skelly-ultra?device=${DEVICE_ID}`);
		const changed = vi.fn();
		window.addEventListener("location-changed", changed);
		link.dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		expect(window.location.pathname).toBe("/skelly-ultra");
		expect(window.location.search).toBe(`?device=${DEVICE_ID}`);
		expect(changed).toHaveBeenCalled();
		window.removeEventListener("location-changed", changed);
		history.pushState(null, "", "/");
		expect(root(card).querySelector("a.manage")?.getAttribute("href")).toBe(
			`/skelly-ultra?device=${DEVICE_ID}`,
		);
	});

	it("doesn't link to the panel when it's turned off", async () => {
		const card = await showCard(undefined, fakeHass({ panel: false }).hass);
		expect(root(card).querySelector("a")).toBeNull();
		expect(text(card)).toContain("Skelly Santa");
	});

	it("lists the first files in play order and plays them", async () => {
		const { hass, send } = fakeHass();
		const card = await showCard(undefined, hass);
		expect(fileNames(card)).toEqual([
			"file3.mp3",
			"file1.mp3",
			"file2.mp3",
			"file4.mp3",
			"file5.mp3",
		]);
		playButton(card, "file1.mp3").click();
		await settle(card);
		expect(hass.callService).toHaveBeenCalledWith(
			"skelly_ultra",
			"play_file",
			{ device_id: DEVICE_ID, file_index: 1 },
			undefined,
			false,
			false,
		);
		expect(playButton(card, "file1.mp3").classList.contains("stop")).toBe(true);
		// The Skelly reports it, with its length
		const now = Date.now();
		send({
			...payload,
			sent_at: now,
			playback: { file_index: 1, duration: 75, started: now, report: 1 },
		});
		await settle(card);
		expect(text(card)).toContain("1:15");
		playButton(card, "file1.mp3").click();
		await settle(card);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"skelly_ultra",
			"stop_file",
			{ device_id: DEVICE_ID, file_index: 1 },
			undefined,
			false,
			false,
		);
		expect(playButton(card, "file1.mp3").classList.contains("play")).toBe(true);
	});

	it("shows as many files as set, or none", async () => {
		let card = await showCard({ device_id: DEVICE_ID, max_files: 2 });
		expect(fileNames(card)).toEqual(["file3.mp3", "file1.mp3"]);
		document.body.innerHTML = "";
		card = await showCard({
			device_id: DEVICE_ID,
			show_files: false,
			show_tts: false,
		});
		expect(fileNames(card)).toEqual([]);
		expect(root(card).querySelector("sk-tts-form")).toBeNull();
		expect(root(card).querySelector("a.manage")).toBeNull();
	});

	it("says something through the Skelly in live mode", async () => {
		const { hass } = fakeHass();
		const card = await showCard(
			{ device_id: DEVICE_ID, tts_entity: "tts.piper" },
			hass,
		);
		// Only the message in the quick box
		expect(hiddenInForm(card, "select.engine")).toBe(true);
		expect(hiddenInForm(card, "details")).toBe(true);
		expect(say(card).disabled).toBe(true);
		expect(reason(card)).toBe("Type a message to speak");
		expect(say(card).getAttribute("aria-describedby")).toBe("say-reason");
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		// Streamed through live mode: no file, no mood, no movement
		expect(performCall(hass)).toEqual([
			"skelly_ultra",
			"perform",
			{
				device_id: DEVICE_ID,
				tts_entity: "tts.piper",
				message: "Boo!",
				language: "en_US",
				mood: "none",
				movement: ["none"],
				wait_until_done: false,
				live_mode_timeout: 60,
			},
			undefined,
			false,
			true,
		]);
		expect(
			hass.callService.mock.calls.some((c) => c[1] === "send_file_from_tts"),
		).toBe(false);
		expect(
			(form(card).querySelector("textarea.message") as HTMLTextAreaElement)
				.value,
		).toBe("");
	});

	it("offers only TTS entities, which perform takes", async () => {
		const card = await showCard();
		button(card, "more").click();
		await settle(card);
		const options = [
			...(form(card).querySelector("select.engine") as HTMLSelectElement)
				.options,
		].map((o) => o.value);
		expect(options).toEqual(["tts.google_translate_en_com", "tts.piper"]);
	});

	it("turns live mode on when saying, and shows it connecting", async () => {
		let answer = (_: { status: string }) => {};
		const perform = new Promise<{ status: string }>((resolve) => {
			answer = resolve;
		});
		const { hass } = fakeHass({ live: "off", perform });
		const card = await showCard(undefined, hass);
		const toggle = button(card, "live");
		expect(toggle.getAttribute("aria-checked")).toBe("false");
		await typeMessage(card, "Boo!");
		expect(text(card)).toContain("Live mode is off. Say turns it on first.");
		say(card).click();
		await settle(card);
		expect(say(card).textContent?.trim()).toBe("Connecting live mode…");
		expect(say(card).disabled).toBe(true);
		expect(button(card, "live").disabled).toBe(true);
		answer({ status: "ok" });
		await settle(card);
		expect(say(card).textContent?.trim()).toBe("Say");
	});

	it("switches live mode from the card", async () => {
		const { hass } = fakeHass({ live: "off" });
		let card = await showCard(undefined, hass);
		button(card, "live").click();
		await settle(card);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"switch",
			"turn_on",
			{ entity_id: SWITCH },
			undefined,
			false,
			false,
		);
		document.body.innerHTML = "";
		const on = fakeHass({ live: "on" });
		card = await showCard(undefined, on.hass);
		expect(button(card, "live").getAttribute("aria-checked")).toBe("true");
		button(card, "live").click();
		await settle(card);
		expect(on.hass.callService).toHaveBeenLastCalledWith(
			"switch",
			"turn_off",
			{ entity_id: SWITCH },
			undefined,
			false,
			false,
		);
		document.body.innerHTML = "";
		card = await showCard(undefined, fakeHass({ live: "connecting" }).hass);
		expect(button(card, "live").getAttribute("aria-checked")).toBe("true");
		expect(button(card, "live").title).toBe(
			"Live mode is connecting. Turn it off",
		);
		expect(button(card, "live").getAttribute("aria-busy")).toBe("true");
	});

	it("waits for a live mode switch before saying", async () => {
		const messages = toasts();
		let done = () => {};
		const switchCall = new Promise<void>((resolve) => {
			done = resolve;
		});
		const { hass } = fakeHass({ live: "off", switchCall });
		const card = await showCard(undefined, hass);
		await typeMessage(card, "Boo!");
		expect(say(card).getAttribute("aria-describedby")).toBe("say-hint");
		button(card, "live").click();
		await settle(card);
		// Shown as connecting while the switch works
		expect(button(card, "live").getAttribute("aria-checked")).toBe("true");
		expect(button(card, "live").disabled).toBe(true);
		expect(say(card).disabled).toBe(true);
		say(card).click();
		await settle(card);
		expect(performCall(hass)).toBeUndefined();
		// Connected: the speaker is there
		Object.assign(hass.states, liveStates("on"));
		hass.states = { ...hass.states };
		card.hass = { ...hass } as never;
		done();
		await settle(card);
		await new Promise((resolve) => setTimeout(resolve, 150));
		await settle(card);
		expect(say(card).disabled).toBe(false);
		expect(messages).toEqual([]);
	});

	it("says when live mode didn't connect", async () => {
		const messages = toasts();
		const card = await showCard(undefined, fakeHass({ live: "off" }).hass);
		button(card, "live").click();
		await new Promise((resolve) => setTimeout(resolve, 2300));
		await settle(card);
		expect(messages.at(-1)).toBe(
			"Live mode didn't connect. The Home Assistant log says why.",
		);
		expect(button(card, "live").disabled).toBe(false);
	}, 10_000);

	it("doesn't carry a Say over to another Skelly in the editor", async () => {
		const messages = toasts();
		let fail = (_: Error) => {};
		const perform = new Promise<{ status: string }>((_, reject) => {
			fail = reject;
		});
		const { hass } = fakeHass({ live: "off", perform });
		const card = await showCard(undefined, hass);
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		expect(say(card).textContent?.trim()).toBe("Connecting live mode…");
		card.setConfig({ type: `custom:${CARD_ELEMENT}`, device_id: "other" });
		await settle(card);
		expect(say(card).textContent?.trim()).toBe("Say");
		expect(button(card, "live").disabled).toBe(false);
		fail(new Error("Live mode did not connect"));
		await settle(card);
		expect(messages).toEqual([]);
	});

	it("waits for a read of the files before turning live mode on", async () => {
		const off = fakeHass({ live: "off" });
		let card = await showCard(undefined, off.hass);
		await typeMessage(card, "Boo!");
		off.send({ ...payload, refreshing: true });
		await settle(card);
		expect(reason(card)).toBe("Reading the Skelly's files…");
		document.body.innerHTML = "";
		const on = fakeHass({ live: "on" });
		card = await showCard(undefined, on.hass);
		await typeMessage(card, "Boo!");
		on.send({ ...payload, refreshing: true });
		await settle(card);
		expect(say(card).disabled).toBe(false);
	});

	it("grays out Say without the live mode entities", async () => {
		const card = await showCard(undefined, fakeHass({ live: "missing" }).hass);
		await typeMessage(card, "Boo!");
		expect(say(card).disabled).toBe(true);
		expect(reason(card)).toContain("Enable the Skelly's Live Mode Speaker");
		expect(button(card, "live")).toBeNull();
	});

	it("gives admins the full text-to-speech form", async () => {
		let card = await showCard();
		const more = button(card, "more");
		expect(more.getAttribute("aria-expanded")).toBe("false");
		expect(more.getAttribute("aria-controls")).toBe("tts-form");
		more.click();
		await settle(card);
		expect(more.getAttribute("aria-expanded")).toBe("true");
		expect(hiddenInForm(card, "select.engine")).toBe(false);
		expect(hiddenInForm(card, "details")).toBe(false);
		document.body.innerHTML = "";
		card = await showCard(undefined, fakeHass({ admin: false }).hass);
		expect(button(card, "more")).toBeNull();
	});

	it("locks saying and playing while the Skelly isn't connected", async () => {
		const { hass, send } = fakeHass({ live: "off" });
		const card = await showCard(undefined, hass);
		await typeMessage(card, "Boo!");
		send({ ...payload, available: false });
		await settle(card);
		expect(text(card)).toContain("Not connected");
		expect(text(card)).toContain("These are the last known files.");
		expect(text(card)).not.toContain("refresh");
		// Old free space isn't shown
		expect(text(card)).not.toContain("MB free");
		expect(say(card).disabled).toBe(true);
		expect(reason(card)).toBe("The Skelly is not connected");
		expect(button(card, "live").disabled).toBe(true);
		expect(playButton(card, "file1.mp3").disabled).toBe(true);
		// A transfer: turning live mode on waits, the bar shows
		send({
			...payload,
			transfer: {
				...payload.transfer,
				status: "uploading",
				in_progress: true,
				progress: 40,
			},
		});
		await settle(card);
		expect(reason(card)).toBe("A file is being sent to the Skelly");
		expect(playButton(card, "file1.mp3").disabled).toBe(true);
	});

	it("says things during a transfer once live mode is on", async () => {
		const { hass, send } = fakeHass({ live: "on" });
		const card = await showCard(undefined, hass);
		await typeMessage(card, "Boo!");
		send({
			...payload,
			transfer: { ...payload.transfer, status: "uploading", in_progress: true },
		});
		await settle(card);
		expect(say(card).disabled).toBe(false);
	});

	it("tells a Skelly that isn't set up from one that is reloading", async () => {
		const error = { code: "not_found", message: "Not found" };
		let card = await showCard(
			undefined,
			fakeHass({ subscribeError: error, devices: [] }).hass,
		);
		expect(text(card)).toContain("isn't set up or loaded");
		document.body.innerHTML = "";
		card = await showCard(undefined, fakeHass({ subscribeError: error }).hass);
		expect(text(card)).toContain("The integration is reloading");
	});

	it("starts with its engine without changing the one remembered", async () => {
		const stored = JSON.stringify({
			engine: "tts.google_translate_en_com",
			language: "en",
		});
		localStorage.setItem("skelly_ultra.tts.u1", stored);
		const { hass } = fakeHass();
		const card = await showCard(
			{ device_id: DEVICE_ID, tts_entity: "tts.piper" },
			hass,
		);
		expect(
			(form(card).querySelector("select.engine") as HTMLSelectElement).value,
		).toBe("tts.piper");
		expect(localStorage.getItem("skelly_ultra.tts.u1")).toBe(stored);
		// Changed in the card editor: the preview follows
		card.setConfig({
			type: `custom:${CARD_ELEMENT}`,
			device_id: DEVICE_ID,
			tts_entity: "tts.google_translate_en_com",
		});
		await settle(card);
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		expect(performCall(hass)?.[2]).toMatchObject({
			tts_entity: "tts.google_translate_en_com",
			message: "Boo!",
			language: "en",
		});
		expect(localStorage.getItem("skelly_ultra.tts.u1")).toBe(stored);
		// Cleared: back to the remembered one
		card.setConfig({
			type: `custom:${CARD_ELEMENT}`,
			device_id: DEVICE_ID,
			tts_entity: "tts.piper",
		});
		await settle(card);
		card.setConfig({ type: `custom:${CARD_ELEMENT}`, device_id: DEVICE_ID });
		await settle(card);
		expect(
			(form(card).querySelector("select.engine") as HTMLSelectElement).value,
		).toBe("tts.google_translate_en_com");
	});

	it("keeps the extra options while the full form is folded away", async () => {
		const { hass } = fakeHass();
		const card = await showCard(undefined, hass);
		button(card, "more").click();
		await settle(card);
		const editor = form(card).querySelector("ha-yaml-editor") as FakeYamlEditor;
		editor.type({ speed: 2 });
		await settle(card);
		button(card, "more").click();
		await settle(card);
		expect(text(card) + form(card).textContent).toContain(
			"The extra options set under the gear are used too.",
		);
		// The same editor, still holding them
		button(card, "more").click();
		await settle(card);
		expect(form(card).querySelector("ha-yaml-editor")).toBe(editor);
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		expect(performCall(hass)?.[2]).toMatchObject({
			tts_options: { speed: 2 },
		});
	});

	it("waits for the engines before saying", async () => {
		const card = await showCard(
			undefined,
			fakeHass({ engines: new Promise(() => {}) }).hass,
		);
		expect(say(card).disabled).toBe(true);
		// Said once, by the form
		expect(form(card).textContent).toContain(
			"Loading the text-to-speech engines…",
		);
		expect(reason(card)).toBeUndefined();
		expect(say(card).hasAttribute("aria-describedby")).toBe(false);
	});

	it("asks for a TTS entity when there are only legacy engines", async () => {
		const card = await showCard(
			undefined,
			fakeHass({
				engines: Promise.resolve({
					providers: [{ engine_id: "google_translate" }],
				}),
			}).hass,
		);
		expect(form(card).textContent).toContain(
			"Home Assistant has no text-to-speech entity.",
		);
		expect(reason(card)).toBeUndefined();
		expect(say(card).disabled).toBe(true);
	});

	it("says when the Skelly is busy, or saying failed", async () => {
		const messages = toasts();
		let card = await showCard(
			undefined,
			fakeHass({ perform: Promise.resolve({ status: "busy" }) }).hass,
		);
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		expect(messages.at(-1)).toBe("The Skelly is already saying something.");
		document.body.innerHTML = "";
		card = await showCard(
			undefined,
			fakeHass({ performError: new Error("Live mode did not connect") }).hass,
		);
		await typeMessage(card, "Boo!");
		say(card).click();
		await settle(card);
		expect(messages.at(-1)).toBe("Couldn't say it: Live mode did not connect");
		// The message stays for another try
		expect(
			(form(card).querySelector("textarea.message") as HTMLTextAreaElement)
				.value,
		).toBe("Boo!");
	});

	it("doesn't play two files at once", async () => {
		let release = () => {};
		const play = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { hass } = fakeHass({ play });
		const card = await showCard(undefined, hass);
		playButton(card, "file1.mp3").click();
		await settle(card);
		expect(playButton(card, "file2.mp3").disabled).toBe(true);
		release();
		await settle(card);
		expect(playButton(card, "file2.mp3").disabled).toBe(false);
	});

	it("waits while the Skelly's files are read", async () => {
		const { hass, send } = fakeHass();
		const card = await showCard(undefined, hass);
		send({ ...payload, refreshing: true });
		await settle(card);
		expect(playButton(card, "file1.mp3").disabled).toBe(true);
	});

	it("notices a Skelly that was removed after it was live", async () => {
		const { hass, send, state } = fakeHass();
		const card = await showCard(undefined, hass);
		expect(text(card)).toContain("Live");
		state.subscribeError = { code: "not_found", message: "Not found" };
		state.devices = [];
		send({ ...payload, unloaded: true });
		await settle(card);
		expect(text(card)).toContain("The integration is reloading");
		// Looked at again a while later
		const now = Date.now();
		const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31_000);
		card.requestUpdate();
		await settle(card);
		expect(text(card)).toContain("isn't set up or loaded");
		clock.mockRestore();
	});

	it("doesn't leave the card editor through its links", async () => {
		const card = await showCard();
		card.preview = true;
		await settle(card);
		expect(root(card).querySelector("a")).toBeNull();
	});

	it("leaves a link with a modifier key to the browser", async () => {
		const card = await showCard();
		const link = root(card).querySelector("a.manage") as HTMLAnchorElement;
		const click = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
		});
		link.addEventListener("click", (ev) => ev.preventDefault(), { once: true });
		const changed = vi.fn();
		window.addEventListener("location-changed", changed);
		link.dispatchEvent(click);
		expect(changed).not.toHaveBeenCalled();
		window.removeEventListener("location-changed", changed);
		// The arrow isn't read out
		expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe("→");
	});

	it("takes an empty YAML value as not set, and limits max_files", () => {
		const card = document.createElement(CARD_ELEMENT) as SkellyUltraCard;
		card.setConfig({ type: "x", device_id: null, tts_entity: null } as never);
		expect(() => card.setConfig({ type: "x", max_files: 21 })).toThrow(
			"from 1 to 20",
		);
	});
});
