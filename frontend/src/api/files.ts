// Helpers for showing a Skelly's files: the play order, free space and the
// files/list command.

import type { HomeAssistant } from "../ha-types";
import type { FileEntry, FilesPayload, SkellyTarget } from "./types";

// A file as the table shows it
export interface FileRow {
	file: FileEntry;
	// 1-based place in the play order, or null if the file isn't in it
	position: number | null;
}

// The files in the order the table lists them: enabled files first, in play
// order, then the others by file index.
export function orderedFiles(payload: FilesPayload): FileRow[] {
	const place = new Map<number, number>();
	payload.file_order.forEach((fileIndex, i) => {
		if (!place.has(fileIndex)) {
			place.set(fileIndex, i);
		}
	});
	const inOrder: FileEntry[] = [];
	const others: FileEntry[] = [];
	for (const file of payload.files) {
		(place.has(file.file_index) ? inOrder : others).push(file);
	}
	inOrder.sort(
		(a, b) =>
			(place.get(a.file_index) as number) - (place.get(b.file_index) as number),
	);
	others.sort((a, b) => a.file_index - b.file_index);
	return [
		...inOrder.map((file, i) => ({ file, position: i + 1 })),
		...others.map((file) => ({ file, position: null })),
	];
}

// Free space as the device reports it (in KB, 1 MB = 1024 KB), or null if
// it's unknown
export function formatFree(freeKb: number | null): string | null {
	if (freeKb === null || !Number.isFinite(freeKb) || freeKb < 0) {
		return null;
	}
	if (freeKb < 1024) {
		return `${Math.round(freeKb)} KB`;
	}
	return `${(freeKb / 1024).toFixed(1)} MB`;
}

// Reads the file list from the device again. The subscription gets the new
// list too; the returned payload is the same.
export const refreshFiles = (hass: HomeAssistant, target: SkellyTarget) =>
	hass.callWS<FilesPayload>({
		type: "skelly_ultra/files/list",
		...target,
		refresh: true,
	});
