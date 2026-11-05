// Home Assistant's media sources: browsing them (media_source/browse_media)
// and uploading a file to the local media folder.

import type { HomeAssistant } from "../ha-types";

// HA's upload limit (MAX_UPLOAD_SIZE in media_source/local_source.py; newer
// versions allow more, the oldest supported one 10 MB)
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const UPLOAD_PATH = "/api/media_source/local_source/upload";

// Sources the browser leaves out: text-to-speech (its items are made on
// request and need a message), radio stations (endless streams that can't be
// downloaded) and the ones with only images or video
const HIDDEN_SOURCES = [
	"tts",
	"camera",
	"image",
	"image_upload",
	"ai_task",
	"radio_browser",
];

const isHiddenSource = (id: string): boolean =>
	HIDDEN_SOURCES.some(
		(domain) =>
			id === `media-source://${domain}` ||
			id.startsWith(`media-source://${domain}/`),
	);

// Media classes of things the Skelly can play
const AUDIO_CLASSES = new Set(["music", "podcast", "audio"]);

// One entry of a media_source/browse_media answer
export interface MediaItem {
	title: string;
	media_class: string;
	media_content_type: string;
	media_content_id: string;
	can_play: boolean;
	can_expand: boolean;
	thumbnail: string | null;
	children?: MediaItem[];
}

export const browseMedia = (hass: HomeAssistant, mediaContentId?: string) =>
	hass.callWS<MediaItem>({
		type: "media_source/browse_media",
		...(mediaContentId ? { media_content_id: mediaContentId } : {}),
	});

export function isAudio(item: MediaItem): boolean {
	return (
		item.can_play &&
		(AUDIO_CLASSES.has(item.media_class) ||
			item.media_content_type.startsWith("audio/"))
	);
}

// What the browser lists of a folder: its folders, then its audio items,
// without the hidden sources
export function visibleChildren(item: MediaItem): MediaItem[] {
	const children = (item.children ?? []).filter(
		(child) =>
			!isHiddenSource(child.media_content_id) &&
			(child.can_expand || isAudio(child)),
	);
	return [
		...children.filter((child) => child.can_expand),
		...children.filter((child) => !child.can_expand),
	];
}

export type UploadProblem = "type" | "size" | "name";

// What HA's upload refuses in a file's name (raise_if_invalid_filename)
const UNSAFE_NAME = /~|\.\.|\/|\\/;

// Why a picked file can't be uploaded, or undefined if it can. HA's upload
// only takes audio, video and images; the Skelly needs audio.
export function uploadProblem(file: File): UploadProblem | undefined {
	if (!file.type.startsWith("audio/")) {
		return "type";
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		return "size";
	}
	if (UNSAFE_NAME.test(file.name)) {
		return "name";
	}
	return undefined;
}

// An upload HA refused, with its HTTP status
export class UploadError extends Error {
	constructor(readonly status: number) {
		super(`HTTP ${status}`);
	}
}

// Uploads a file into a media folder (only admins may) and returns its media
// source ID. A file of the same name there is replaced.
export async function uploadMedia(
	hass: HomeAssistant,
	folder: string,
	file: File,
	signal?: AbortSignal,
): Promise<string> {
	const form = new FormData();
	form.append("media_content_id", folder);
	form.append("file", file);
	const response = await hass.fetchWithAuth(UPLOAD_PATH, {
		method: "POST",
		body: form,
		signal,
	});
	if (!response.ok) {
		throw new UploadError(response.status);
	}
	const { media_content_id } = (await response.json()) as {
		media_content_id: string;
	};
	return media_content_id;
}
