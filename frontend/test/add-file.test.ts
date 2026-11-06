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

import type { MediaItem } from "../src/api/media";
import type { FileEntry, FilesPayload } from "../src/api/types";
import type { SkAddFileDialog } from "../src/components/sk-add-file-dialog";
import { ADD_FILE_DIALOG_ELEMENT } from "../src/constants";
import fixture from "./fixtures/files-payload.json";

const payload = fixture as FilesPayload;
const FOLDER = "media-source://media_source/local/skelly_ultra";

const song = (title: string, id: string): MediaItem => ({
	title,
	media_class: "music",
	media_content_type: "audio/mpeg",
	media_content_id: id,
	can_play: true,
	can_expand: false,
	thumbnail: null,
});

const root: MediaItem = {
	title: "Media",
	media_class: "directory",
	media_content_type: "",
	media_content_id: "",
	can_play: false,
	can_expand: true,
	thumbnail: null,
	children: [
		{
			title: "My media",
			media_class: "directory",
			media_content_type: "",
			media_content_id: "media-source://media_source/local/.",
			can_play: false,
			can_expand: true,
			thumbnail: null,
		},
	],
};

const myMedia: MediaItem = {
	...root,
	title: "My media",
	media_content_id: "media-source://media_source/local/.",
	children: [
		song("Evil Laugh.mp3", "media-source://media_source/local/laugh.mp3"),
	],
};

const ENGINES = {
	providers: [
		{ engine_id: "tts.piper", supported_languages: ["de_DE", "en_US"] },
		{
			engine_id: "google_translate",
			name: "Google Translate",
			supported_languages: ["en", "de"],
		},
		// A legacy provider that has an entity now
		{
			engine_id: "piper",
			name: "Piper (old)",
			supported_languages: ["en_US"],
			deprecated: true,
		},
	],
};

function fakeHass(isAdmin = true) {
	return {
		user: { id: "u1", name: "Martin", is_admin: isAdmin },
		language: "en",
		states: {
			"tts.piper": {
				entity_id: "tts.piper",
				state: "unknown",
				attributes: { friendly_name: "Piper" },
			},
		},
		callWS: vi.fn(async (msg: Record<string, unknown>) =>
			msg.type === "tts/engine/list"
				? ENGINES
				: msg.type === "tts/engine/voices"
					? {
							voices:
								msg.engine_id === "tts.piper"
									? [
											{ voice_id: "amy", name: "Amy" },
											{ voice_id: "ryan", name: "Ryan" },
										]
									: null,
						}
					: msg.media_content_id
						? myMedia
						: root,
		),
		fetchWithAuth: vi.fn(),
	};
}

const settle = async (el: SkAddFileDialog) => {
	for (let i = 0; i < 5; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await el.updateComplete;
		for (const name of ["sk-media-browser", "sk-tts-form"]) {
			const child = el.shadowRoot?.querySelector(name) as
				| (HTMLElement & { updateComplete: Promise<boolean> })
				| null;
			await child?.updateComplete;
		}
	}
};

async function showDialog(
	options: {
		hass?: ReturnType<typeof fakeHass>;
		uploadTarget?: string | null;
		readOnlyReason?: string;
		files?: FileEntry[];
	} = {},
) {
	const el = document.createElement(ADD_FILE_DIALOG_ELEMENT) as SkAddFileDialog;
	const hass = options.hass ?? fakeHass();
	const send = vi.fn();
	el.hass = hass as never;
	el.profile = payload.device_profile;
	el.files = options.files ?? payload.files;
	el.uploadTarget = "uploadTarget" in options ? options.uploadTarget : FOLDER;
	el.readOnlyReason = options.readOnlyReason;
	el.send = send;
	document.body.append(el);
	await el.open();
	await settle(el);
	return { el, hass, send };
}

const root$ = (el: SkAddFileDialog) => el.shadowRoot as ShadowRoot;
const tabs = (el: SkAddFileDialog) =>
	[...root$(el).querySelectorAll('[role="tab"]')].map((t) =>
		t.textContent?.trim(),
	);
const tab = (el: SkAddFileDialog, label: string) =>
	[...root$(el).querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
		(t) => t.textContent?.trim() === label,
	) as HTMLButtonElement;
const nameInput = (el: SkAddFileDialog) =>
	root$(el).querySelector("#name") as HTMLInputElement;
const sendButton = (el: SkAddFileDialog) =>
	root$(el).querySelector("button.send") as HTMLButtonElement;
const dialog = (el: SkAddFileDialog) =>
	root$(el).querySelector("dialog") as HTMLDialogElement;

async function type(
	el: SkAddFileDialog,
	input: HTMLInputElement,
	value: string,
) {
	input.value = value;
	input.dispatchEvent(new Event("input"));
	await settle(el);
}

async function chooseFile(el: SkAddFileDialog, file: File) {
	const input = root$(el).querySelector(
		'input[type="file"]',
	) as HTMLInputElement;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	input.dispatchEvent(new Event("change"));
	await settle(el);
}

const audio = (name: string, size = 100) =>
	new File([new Uint8Array(size)], name, { type: "audio/wav" });

describe("add file dialog", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("offers upload to admins, first", async () => {
		const { el } = await showDialog();
		expect(dialog(el).open).toBe(true);
		expect(tabs(el)).toEqual([
			"Upload",
			"Text to speech",
			"Media library",
			"URL",
		]);
		expect(tab(el, "Upload").getAttribute("aria-selected")).toBe("true");
		expect(sendButton(el).disabled).toBe(true);
	});

	it("doesn't offer upload to others", async () => {
		const { el } = await showDialog({ hass: fakeHass(false) });
		expect(tabs(el)).toEqual(["Text to speech", "Media library", "URL"]);
		expect(tab(el, "Media library").getAttribute("aria-selected")).toBe("true");
	});

	it("starts on the media library when HA has no upload folder", async () => {
		const { el } = await showDialog({ uploadTarget: null });
		expect(tab(el, "Media library").getAttribute("aria-selected")).toBe("true");
		tab(el, "Upload").click();
		await settle(el);
		expect(root$(el).textContent).toContain("no local media folder");
		expect(sendButton(el).disabled).toBe(true);
	});

	it("uploads a file, then sends it under the suggested name", async () => {
		const { el, hass, send } = await showDialog();
		hass.fetchWithAuth.mockResolvedValue(
			new Response(
				JSON.stringify({ media_content_id: `${FOLDER}/My song.wav` }),
				{ status: 200 },
			),
		);
		await chooseFile(el, audio("My song.wav"));
		expect(nameInput(el).value).toBe("My song");
		expect(root$(el).textContent).toContain("My song.wav (1 KB)");
		expect(sendButton(el).disabled).toBe(false);

		sendButton(el).click();
		await settle(el);
		expect(hass.fetchWithAuth).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			filePath: `${FOLDER}/My song.wav`,
			filename: "My song.mp3",
		});
		expect(dialog(el).open).toBe(false);
	});

	it("stays open with the reason when the upload is refused", async () => {
		const { el, hass, send } = await showDialog();
		hass.fetchWithAuth.mockResolvedValue(new Response("", { status: 403 }));
		await chooseFile(el, audio("boo.mp3"));
		sendButton(el).click();
		await settle(el);
		expect(send).not.toHaveBeenCalled();
		expect(dialog(el).open).toBe(true);
		expect(root$(el).textContent).toContain(
			"Couldn't upload the file: Only administrators can upload files.",
		);
		// It can be tried again
		expect(sendButton(el).disabled).toBe(false);
	});

	it("says when HA refuses the file's name", async () => {
		const { el, hass } = await showDialog();
		hass.fetchWithAuth.mockResolvedValue(new Response("", { status: 400 }));
		await chooseFile(el, audio("boo.mp3"));
		sendButton(el).click();
		await settle(el);
		expect(root$(el).textContent).toContain(
			"Home Assistant refused the file or its name.",
		);
		await chooseFile(el, audio("boo~1.mp3"));
		expect(root$(el).textContent).toContain("doesn't take file names with ~");
		expect(sendButton(el).disabled).toBe(true);
	});

	it("calls off an upload on Escape", async () => {
		const { el, hass, send } = await showDialog();
		let signal: AbortSignal | undefined;
		hass.fetchWithAuth.mockImplementation(
			(_path: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					signal = init.signal ?? undefined;
					signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError")),
					);
				}),
		);
		await chooseFile(el, audio("boo.mp3"));
		sendButton(el).click();
		await settle(el);
		// What the browser does on Escape: close the dialog
		dialog(el).close();
		await settle(el);
		expect(signal?.aborted).toBe(true);
		expect(send).not.toHaveBeenCalled();
		expect(sendButton(el).textContent?.trim()).toBe("Send");
	});

	it("calls off an upload when closed", async () => {
		const { el, hass, send } = await showDialog();
		let signal: AbortSignal | undefined;
		hass.fetchWithAuth.mockImplementation(
			(_path: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					signal = init.signal ?? undefined;
					signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError")),
					);
				}),
		);
		await chooseFile(el, audio("boo.mp3"));
		sendButton(el).click();
		await settle(el);
		expect(sendButton(el).disabled).toBe(true);
		expect(sendButton(el).textContent?.trim()).toBe("Uploading…");
		el.close();
		await settle(el);
		expect(signal?.aborted).toBe(true);
		expect(send).not.toHaveBeenCalled();
		expect(root$(el).querySelector(".error")).toBeNull();
	});

	it("refuses files that aren't audio or are too large", async () => {
		const { el } = await showDialog();
		await chooseFile(el, new File(["x"], "a.png", { type: "image/png" }));
		expect(root$(el).textContent).toContain("That isn't an audio file.");
		expect(sendButton(el).disabled).toBe(true);
		await chooseFile(el, audio("big.wav", 11 * 1024 * 1024));
		expect(root$(el).textContent).toContain("larger than 10.0 MB");
		expect(sendButton(el).disabled).toBe(true);
	});

	it("sends a media library file", async () => {
		const { el, send } = await showDialog();
		tab(el, "Media library").click();
		await settle(el);
		const browser = root$(el).querySelector("sk-media-browser")
			?.shadowRoot as ShadowRoot;
		(browser.querySelector("button.folder") as HTMLButtonElement).click();
		await settle(el);
		expect(browser.textContent).toContain("Evil Laugh.mp3");
		(browser.querySelector("button.item") as HTMLButtonElement).click();
		await settle(el);
		expect(
			browser.querySelector("button.item")?.getAttribute("aria-pressed"),
		).toBe("true");
		expect(nameInput(el).value).toBe("Evil Laugh");
		sendButton(el).click();
		await settle(el);
		expect(send).toHaveBeenCalledWith({
			filePath: "media-source://media_source/local/laugh.mp3",
			filename: "Evil Laugh.mp3",
		});
	});

	it("checks the URL and suggests a name from it", async () => {
		const { el, send } = await showDialog();
		tab(el, "URL").click();
		await settle(el);
		const url = root$(el).querySelector("#url") as HTMLInputElement;
		await type(el, url, "ftp://x.org/a.mp3");
		expect(root$(el).textContent).toContain("Enter an address that starts");
		expect(sendButton(el).disabled).toBe(true);
		await type(el, url, "HTTPS://x.org/sounds/Scream%201.mp3");
		expect(nameInput(el).value).toBe("Scream 1");
		sendButton(el).click();
		await settle(el);
		expect(send).toHaveBeenCalledWith({
			filePath: "https://x.org/sounds/Scream%201.mp3",
			filename: "Scream 1.mp3",
		});
	});

	it("keeps a name the user typed", async () => {
		const { el } = await showDialog();
		tab(el, "URL").click();
		await settle(el);
		await type(el, nameInput(el), "Mine");
		const url = root$(el).querySelector("#url") as HTMLInputElement;
		await type(el, url, "https://x.org/other.mp3");
		expect(nameInput(el).value).toBe("Mine");
	});

	it("checks the name and warns before replacing a file", async () => {
		const { el } = await showDialog();
		tab(el, "URL").click();
		await settle(el);
		await type(
			el,
			root$(el).querySelector("#url") as HTMLInputElement,
			"https://x.org/a.mp3",
		);
		const hint = () => root$(el).querySelector("#name-hint")?.textContent ?? "";
		await type(el, nameInput(el), "a/b");
		expect(hint()).toContain("can't contain /");
		expect(sendButton(el).disabled).toBe(true);
		await type(el, nameInput(el), "a".repeat(30));
		expect(hint()).toContain("at most 33 characters");
		expect(hint()).toContain("34 / 33");
		await type(el, nameInput(el), " ");
		expect(hint()).toContain("Enter a name");
		await type(el, nameInput(el), "hello");
		expect(hint()).toContain("Will replace the existing file");
		expect(sendButton(el).disabled).toBe(false);
	});

	it("can't send while read-only", async () => {
		const { el } = await showDialog({ readOnlyReason: "Busy" });
		tab(el, "URL").click();
		await settle(el);
		await type(
			el,
			root$(el).querySelector("#url") as HTMLInputElement,
			"https://x.org/a.mp3",
		);
		expect(sendButton(el).disabled).toBe(true);
		expect(sendButton(el).title).toBe("Busy");
	});
});

describe("add file dialog: text to speech", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		localStorage.clear();
	});

	const form = (el: SkAddFileDialog) =>
		root$(el).querySelector("sk-tts-form")?.shadowRoot as ShadowRoot;
	const field = <T extends Element>(el: SkAddFileDialog, selector: string) =>
		form(el).querySelector(selector) as T;
	const select = async (
		el: SkAddFileDialog,
		selector: string,
		value: string,
	) => {
		const box = field<HTMLSelectElement>(el, selector);
		box.value = value;
		box.dispatchEvent(new Event("change"));
		await settle(el);
	};
	const typeIn = async (
		el: SkAddFileDialog,
		selector: string,
		value: string,
	) => {
		const box = field<HTMLTextAreaElement>(el, selector);
		box.value = value;
		box.dispatchEvent(new Event("input"));
		await settle(el);
	};

	it("speaks a message and sends it under a name made from it", async () => {
		const { el, send } = await showDialog();
		tab(el, "Text to speech").click();
		await settle(el);
		// Engines by name, without the deprecated legacy one
		expect(
			[...form(el).querySelectorAll("select.engine option")].map((o) =>
				o.textContent?.trim(),
			),
		).toEqual(["Google Translate", "Piper"]);
		expect(field<HTMLSelectElement>(el, "select.engine").value).toBe(
			"google_translate",
		);
		// The user's language
		expect(field<HTMLSelectElement>(el, "select.language").value).toBe("en");
		// Google Translate has no voices to pick
		expect(field(el, "select.voice")).toBeNull();
		expect(sendButton(el).disabled).toBe(true);
		expect(sendButton(el).title).toBe("Type a message to speak");

		await select(el, "select.engine", "tts.piper");
		expect(field<HTMLSelectElement>(el, "select.language").value).toBe("en_US");
		expect(field<HTMLSelectElement>(el, "select.voice").value).toBe("");
		await select(el, "select.voice", "ryan");
		await typeIn(el, "textarea.message", "Welcome, mortal! Come closer…");
		expect(nameInput(el).value).toBe("welcome_mortal_come_closer");
		sendButton(el).click();
		await settle(el);
		expect(send).toHaveBeenCalledWith({
			filename: "welcome_mortal_come_closer.mp3",
			speech: {
				tts_entity: "tts.piper",
				message: "Welcome, mortal! Come closer…",
				language: "en_US",
				tts_options: { voice: "ryan" },
			},
		});
		expect(dialog(el).open).toBe(false);
	});

	it("remembers the engine, language and voice", async () => {
		const first = await showDialog();
		tab(first.el, "Text to speech").click();
		await settle(first.el);
		await select(first.el, "select.engine", "tts.piper");
		await select(first.el, "select.language", "de_DE");
		await select(first.el, "select.voice", "amy");
		document.body.innerHTML = "";

		const { el } = await showDialog();
		tab(el, "Text to speech").click();
		await settle(el);
		expect(field<HTMLSelectElement>(el, "select.engine").value).toBe(
			"tts.piper",
		);
		expect(field<HTMLSelectElement>(el, "select.language").value).toBe("de_DE");
		expect(field<HTMLSelectElement>(el, "select.voice").value).toBe("amy");
	});

	it("blocks sending with extra options that aren't key: value lines", async () => {
		const { el, send } = await showDialog();
		tab(el, "Text to speech").click();
		await settle(el);
		await typeIn(el, "textarea.message", "Boo");
		const editor = field<FakeYamlEditor>(el, "ha-yaml-editor");
		editor.type(undefined, false);
		await settle(el);
		expect(sendButton(el).disabled).toBe(true);
		expect(sendButton(el).title).toContain("valid YAML");
		editor.type([1]);
		await settle(el);
		expect(sendButton(el).title).toContain("key: value");
		editor.type({ speed: 1.2 });
		await settle(el);
		sendButton(el).click();
		await settle(el);
		expect(send.mock.calls[0][0].speech.tts_options).toEqual({ speed: 1.2 });
	});

	it("names a message without letters like the backend does", async () => {
		const { el } = await showDialog();
		tab(el, "Text to speech").click();
		await settle(el);
		await typeIn(el, "textarea.message", "!!! 🎃");
		expect(nameInput(el).value).toBe("tts");
	});

	it("keeps the message when switching tabs, and keeps a typed name", async () => {
		const { el } = await showDialog();
		tab(el, "Text to speech").click();
		await settle(el);
		await typeIn(el, "textarea.message", "Boo");
		await type(el, nameInput(el), "scary");
		tab(el, "URL").click();
		await settle(el);
		tab(el, "Text to speech").click();
		await settle(el);
		expect(field<HTMLTextAreaElement>(el, "textarea.message").value).toBe(
			"Boo",
		);
		await typeIn(el, "textarea.message", "Boo hoo");
		expect(nameInput(el).value).toBe("scary");
	});

	it("previews with a separate request, once per change", async () => {
		const { el, hass } = await showDialog();
		hass.fetchWithAuth.mockImplementation(
			async () =>
				new Response(JSON.stringify({ path: "/api/tts_proxy/abc.mp3" }), {
					status: 200,
				}),
		);
		tab(el, "Text to speech").click();
		await settle(el);
		await typeIn(el, "textarea.message", "Boo");
		const preview = field<HTMLButtonElement>(el, "button.preview-button");
		preview.click();
		await settle(el);
		const [path, init] = hass.fetchWithAuth.mock.calls[0];
		expect(path).toBe("/api/tts_get_url");
		expect(JSON.parse(init.body)).toEqual({
			engine_id: "google_translate",
			message: "Boo",
			language: "en",
			cache: false,
		});
		expect(field<HTMLAudioElement>(el, "audio").getAttribute("src")).toBe(
			"/api/tts_proxy/abc.mp3",
		);
		// Unchanged: no second request
		expect(field<HTMLButtonElement>(el, "button.preview-button").disabled).toBe(
			true,
		);
		await typeIn(el, "textarea.message", "Boo!");
		expect(field<HTMLButtonElement>(el, "button.preview-button").disabled).toBe(
			false,
		);

		// The engine's own errors show as audio that doesn't load
		field<HTMLAudioElement>(el, "audio").dispatchEvent(new Event("error"));
		await settle(el);
		expect(form(el).textContent).toContain("the engine sent no audio");
		expect(field(el, "audio")).toBeNull();

		// Closing stops a preview; another tab only pauses it
		field<HTMLButtonElement>(el, "button.preview-button").click();
		await settle(el);
		expect(field(el, "audio")).not.toBeNull();
		tab(el, "URL").click();
		await settle(el);
		tab(el, "Text to speech").click();
		await settle(el);
		expect(field(el, "audio")).not.toBeNull();
		el.close();
		await settle(el);
		expect(field(el, "audio")).toBeNull();
	});

	it("says why a preview failed", async () => {
		const { el, hass } = await showDialog();
		// HA can't send its error as JSON, so it answers with a bare 500
		hass.fetchWithAuth.mockResolvedValue(
			new Response("500 Internal Server Error", { status: 500 }),
		);
		tab(el, "Text to speech").click();
		await settle(el);
		await typeIn(el, "textarea.message", "Boo");
		field<HTMLButtonElement>(el, "button.preview-button").click();
		await settle(el);
		expect(form(el).textContent).toContain("Couldn't preview: HTTP 500");
	});

	it("explains when HA has no text-to-speech engine", async () => {
		const hass = fakeHass();
		hass.callWS.mockImplementation(async (msg: Record<string, unknown>) =>
			msg.type === "tts/engine/list" ? { providers: [] } : root,
		);
		const { el } = await showDialog({ hass });
		tab(el, "Text to speech").click();
		await settle(el);
		expect(form(el).textContent).toContain("has no text-to-speech engine");
		expect(sendButton(el).disabled).toBe(true);
	});
});
