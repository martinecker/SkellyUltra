import { describe, expect, it } from "vitest";
import { formatFree, orderedFiles } from "../src/api/files";
import type { FileEntry, FilesPayload } from "../src/api/types";
import fixture from "./fixtures/files-payload.json";

const base = fixture as FilesPayload;

const file = (file_index: number): FileEntry => ({
	...base.files[0],
	name: `f${file_index}.mp3`,
	file_index,
});

const payload = (indices: number[], fileOrder: number[]): FilesPayload => ({
	...base,
	files: indices.map(file),
	file_order: fileOrder,
});

describe("orderedFiles", () => {
	it("lists enabled files in play order, then the others by index", () => {
		const rows = orderedFiles(payload([5, 1, 4, 2, 3], [4, 1, 3]));
		expect(rows.map((r) => [r.file.file_index, r.position])).toEqual([
			[4, 1],
			[1, 2],
			[3, 3],
			[2, null],
			[5, null],
		]);
	});

	it("ignores play order entries without a file, and repeats", () => {
		const rows = orderedFiles(payload([1, 2], [9, 2, 2]));
		expect(rows.map((r) => [r.file.file_index, r.position])).toEqual([
			[2, 1],
			[1, null],
		]);
	});

	it("copes with no files", () => {
		expect(orderedFiles(payload([], []))).toEqual([]);
	});
});

describe("formatFree", () => {
	it("shows KB below a megabyte and MB above", () => {
		expect(formatFree(0)).toBe("0 KB");
		expect(formatFree(512)).toBe("512 KB");
		expect(formatFree(1024)).toBe("1.0 MB");
		expect(formatFree(122060)).toBe("119.2 MB");
	});

	it("returns null when the device hasn't said", () => {
		expect(formatFree(null)).toBeNull();
		expect(formatFree(-1)).toBeNull();
	});
});
