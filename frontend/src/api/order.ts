// Helpers for changing which files are in the play order, and where.
// An order is the file_index of each enabled file, in play order.

import type { FileRow } from "./files";
import type { FilesPayload } from "./types";

// The play order the table shows: its enabled rows, top to bottom
export function enabledIndices(rows: readonly FileRow[]): number[] {
	return rows
		.filter((row) => row.position !== null)
		.map((row) => row.file.file_index);
}

export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((value, i) => value === b[i]);
}

// The order with a file added at the end, or taken out. The last enabled
// file can't be taken out: the device needs at least one.
export function toggleInOrder(
	order: readonly number[],
	fileIndex: number,
	enabled: boolean,
): number[] {
	const without = order.filter((i) => i !== fileIndex);
	if (enabled) {
		return [...without, fileIndex];
	}
	return without.length ? without : [...order];
}

// The payload as it will be once the order is written, for the table to
// show meanwhile
export function withOrder(
	payload: FilesPayload,
	order: readonly number[],
): FilesPayload {
	return { ...payload, file_order: [...order] };
}

// The order without files that are no longer on the Skelly
export function existingOnly(
	order: readonly number[],
	payload: FilesPayload,
): number[] {
	const present = new Set(payload.files.map((f) => f.file_index));
	return order.filter((i) => present.has(i));
}
