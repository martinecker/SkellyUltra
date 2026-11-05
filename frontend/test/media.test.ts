import { describe, expect, it, vi } from "vitest";
import {
	browseMedia,
	isAudio,
	MAX_UPLOAD_BYTES,
	type MediaItem,
	UploadError,
	uploadMedia,
	uploadProblem,
	visibleChildren,
} from "../src/api/media";
import type { HomeAssistant } from "../src/ha-types";

const item = (over: Partial<MediaItem>): MediaItem => ({
	title: "x",
	media_class: "music",
	media_content_type: "audio/mpeg",
	media_content_id: "media-source://media_source/local/x.mp3",
	can_play: true,
	can_expand: false,
	thumbnail: null,
	...over,
});

describe("media browsing", () => {
	it("asks for the root without an ID", async () => {
		const callWS = vi.fn().mockResolvedValue(item({}));
		const hass = { callWS } as unknown as HomeAssistant;
		await browseMedia(hass);
		expect(callWS).toHaveBeenLastCalledWith({
			type: "media_source/browse_media",
		});
		await browseMedia(hass, "media-source://media_source");
		expect(callWS).toHaveBeenLastCalledWith({
			type: "media_source/browse_media",
			media_content_id: "media-source://media_source",
		});
	});

	it("knows audio", () => {
		expect(isAudio(item({}))).toBe(true);
		expect(
			isAudio(item({ media_class: "app", media_content_type: "audio/ogg" })),
		).toBe(true);
		expect(
			isAudio(item({ media_class: "video", media_content_type: "video/mp4" })),
		).toBe(false);
		expect(isAudio(item({ can_play: false }))).toBe(false);
	});

	it("lists folders first, then audio, without TTS and other media", () => {
		const folder = item({
			title: "folder",
			media_class: "directory",
			media_content_type: "",
			can_play: false,
			can_expand: true,
			media_content_id: "media-source://media_source/local/f",
		});
		const tts = {
			...folder,
			title: "tts",
			media_content_id: "media-source://tts",
		};
		const song = item({ title: "song" });
		const image = item({
			title: "image",
			media_class: "image",
			media_content_type: "image/png",
		});
		const camera = {
			...folder,
			title: "camera",
			media_content_id: "media-source://camera",
		};
		const radio = {
			...folder,
			title: "radio",
			media_content_id: "media-source://radio_browser",
		};
		const dlna = {
			...folder,
			title: "dlna",
			media_content_id: "media-source://dlna_dms/nas",
		};
		const parent = item({
			children: [song, image, tts, camera, folder, radio, dlna],
		});
		expect(visibleChildren(parent).map((c) => c.title)).toEqual([
			"folder",
			"dlna",
			"song",
		]);
		expect(visibleChildren(item({}))).toEqual([]);
	});
});

describe("uploads", () => {
	const file = (type: string, size = 10) =>
		new File([new Uint8Array(size)], "a.mp3", { type });

	it("takes audio up to HA's limit", () => {
		expect(uploadProblem(file("audio/mpeg"))).toBeUndefined();
		expect(uploadProblem(file("video/mp4"))).toBe("type");
		expect(uploadProblem(file(""))).toBe("type");
		expect(uploadProblem(file("audio/wav", MAX_UPLOAD_BYTES + 1))).toBe("size");
		// HA refuses these names
		for (const name of ["a..b.mp3", "Boo~1.mp3", "a\\b.mp3"]) {
			expect(uploadProblem(new File(["x"], name, { type: "audio/mpeg" }))).toBe(
				"name",
			);
		}
		expect(
			uploadProblem(new File(["x"], "a.b.mp3", { type: "audio/mpeg" })),
		).toBeUndefined();
	});

	it("posts the folder and file, and returns the new ID", async () => {
		const fetchWithAuth = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					media_content_id:
						"media-source://media_source/local/skelly_ultra/a.mp3",
				}),
				{ status: 200 },
			),
		);
		const hass = { fetchWithAuth } as unknown as HomeAssistant;
		const signal = new AbortController().signal;
		const f = file("audio/mpeg");
		await expect(
			uploadMedia(
				hass,
				"media-source://media_source/local/skelly_ultra",
				f,
				signal,
			),
		).resolves.toBe("media-source://media_source/local/skelly_ultra/a.mp3");
		const [path, init] = fetchWithAuth.mock.calls[0];
		expect(path).toBe("/api/media_source/local_source/upload");
		expect(init.method).toBe("POST");
		expect(init.signal).toBe(signal);
		const form = init.body as FormData;
		expect(form.get("media_content_id")).toBe(
			"media-source://media_source/local/skelly_ultra",
		);
		expect((form.get("file") as File).name).toBe("a.mp3");
	});

	it("throws the status of a refused upload", async () => {
		const fetchWithAuth = vi
			.fn()
			.mockResolvedValue(new Response("", { status: 401 }));
		const hass = { fetchWithAuth } as unknown as HomeAssistant;
		const err = await uploadMedia(hass, "f", file("audio/mpeg")).catch(
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(UploadError);
		expect((err as UploadError).status).toBe(401);
	});
});
