import { describe, expect, it } from "vitest";
import { orderedFiles } from "../src/api/files";
import {
	enabledIndices,
	existingOnly,
	sameOrder,
	toggleInOrder,
	withOrder,
} from "../src/api/order";
import type { FilesPayload } from "../src/api/types";
import fixture from "./fixtures/files-payload.json";

const base = fixture as FilesPayload;
const payload = (indices: number[], fileOrder: number[]): FilesPayload => ({
	...base,
	files: indices.map((file_index) => ({
		...base.files[0],
		name: `f${file_index}.mp3`,
		file_index,
	})),
	file_order: fileOrder,
});

describe("play order", () => {
	it("reads the enabled files from the rows, in play order", () => {
		// Entries without a file and repeats are left out
		const rows = orderedFiles(payload([1, 2, 3, 4], [3, 9, 1, 3]));
		expect(enabledIndices(rows)).toEqual([3, 1]);
	});

	it("adds a file at the end and takes one out, but not the last", () => {
		expect(toggleInOrder([1, 2], 3, true)).toEqual([1, 2, 3]);
		expect(toggleInOrder([1, 2], 1, true)).toEqual([2, 1]);
		expect(toggleInOrder([1, 2], 1, false)).toEqual([2]);
		expect(toggleInOrder([1], 1, false)).toEqual([1]);
	});

	it("compares orders and drops files that are gone", () => {
		expect(sameOrder([1, 2], [1, 2])).toBe(true);
		expect(sameOrder([1, 2], [2, 1])).toBe(false);
		expect(sameOrder([1], [1, 2])).toBe(false);
		expect(existingOnly([3, 5, 1], payload([1, 3], []))).toEqual([3, 1]);
	});

	it("shows a payload with another order", () => {
		const p = payload([1, 2], [1]);
		const shown = withOrder(p, [2, 1]);
		expect(shown.file_order).toEqual([2, 1]);
		expect(p.file_order).toEqual([1]);
	});
});
