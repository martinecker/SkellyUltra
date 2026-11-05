// Typed wrappers for the skelly_ultra.* actions. All changes go through these
// actions, so the UI and automations share one path.

import type { HomeAssistant } from "../ha-types";
import type { LightSettings } from "./types";

const DOMAIN = "skelly_ultra";

// The actions take a Skelly by device_id (or entity_id), not entry_id
export interface ActionTarget {
	device_id: string;
}

// What send_file and send_file_from_tts return: the file's name on the
// device and its index, for play_file
export interface SentFile {
	filename: string;
	file_index: number;
}

// edit_file's settings; anything left out keeps its current value
export interface FileChanges {
	movements?: string[];
	eye_icon?: number;
	lights?: (Partial<LightSettings> & { channel: number })[];
}

export interface TtsRequest {
	tts_entity: string;
	message: string;
	target_filename?: string;
	language?: string;
	tts_options?: Record<string, unknown>;
}

async function call(
	hass: HomeAssistant,
	service: string,
	target: ActionTarget,
	data: Record<string, unknown>,
): Promise<void> {
	// Errors are shown by the caller, not as HA's own notification
	await hass.callService(
		DOMAIN,
		service,
		{ ...target, ...data },
		undefined,
		false,
		false,
	);
}

async function callWithResponse<T>(
	hass: HomeAssistant,
	service: string,
	target: ActionTarget,
	data: Record<string, unknown>,
): Promise<T> {
	const result = (await hass.callService(
		DOMAIN,
		service,
		{ ...target, ...data },
		undefined,
		false,
		true,
	)) as { response: T };
	return result.response;
}

export const playFile = (
	hass: HomeAssistant,
	target: ActionTarget,
	fileIndex: number,
) => call(hass, "play_file", target, { file_index: fileIndex });

export const stopFile = (
	hass: HomeAssistant,
	target: ActionTarget,
	fileIndex: number,
) => call(hass, "stop_file", target, { file_index: fileIndex });

export const deleteFile = (
	hass: HomeAssistant,
	target: ActionTarget,
	filename: string,
) => call(hass, "delete_file", target, { filename });

export const editFile = (
	hass: HomeAssistant,
	target: ActionTarget,
	filename: string,
	changes: FileChanges,
) => call(hass, "edit_file", target, { filename, ...changes });

// The play order the device reports after set_file_order
export interface FileOrderEntry {
	file_index: number;
	// null if the file isn't in the file list
	filename: string | null;
}

// files: the enabled files, in play order, by name or by file index (file
// indices are unique, names need not be)
export const setFileOrder = (
	hass: HomeAssistant,
	target: ActionTarget,
	files: { filenames: string[] } | { file_indices: number[] },
) =>
	callWithResponse<{ file_order: FileOrderEntry[] }>(
		hass,
		"set_file_order",
		target,
		{ ...files },
	);

// filePath: a media source ID, a URL or a path that HA may read
export const sendFile = (
	hass: HomeAssistant,
	target: ActionTarget,
	filePath: string,
	targetFilename: string,
) =>
	callWithResponse<SentFile>(hass, "send_file", target, {
		file_path: filePath,
		target_filename: targetFilename,
	});

export const sendFileFromTts = (
	hass: HomeAssistant,
	target: ActionTarget,
	request: TtsRequest,
) =>
	callWithResponse<SentFile>(hass, "send_file_from_tts", target, {
		...request,
	});

export const cancelTransfer = (hass: HomeAssistant, target: ActionTarget) =>
	call(hass, "cancel_file_transfer", target, {});

// The message of a failed action or websocket command, for a toast.
// HA rejects with {code, message}; anything else is shown as best we can.
export function errorMessage(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		const message = (err as { message: unknown }).message;
		if (typeof message === "string" && message) {
			return message;
		}
	}
	if (typeof err === "string" && err) {
		return err;
	}
	return "Unknown error";
}
