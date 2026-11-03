// The hand-written payload types (src/api/types.ts) describe the example
// payloads in test/fixtures/, which tests/test_frontend_contract.py checks
// against what the integration really sends. Most of this test runs in the
// type checker (npm run check runs tsc on the tests).

import { describe, expect, it } from "vitest";
import {
	type FilesPayload,
	type SkellyDevice,
	type SkellyTarget,
	targetOf,
} from "../src/api/types";
import devices from "./fixtures/devices.json";
import filesPayload from "./fixtures/files-payload.json";

// T as JSON.parse produces it: tuples become arrays and string unions strings
type Json<T> = T extends string
	? string
	: T extends readonly (infer I)[]
		? Json<I>[]
		: T extends object
			? { [K in keyof T]: Json<T[K]> }
			: T;

// true if A (a JSON value) has no keys that B doesn't declare, at any depth
type NoExtraKeys<A, B> = A extends readonly (infer AI)[]
	? B extends readonly (infer BI)[]
		? NoExtraKeys<AI, BI>
		: true
	: A extends object
		? B extends object
			? [Exclude<keyof A, keyof B>] extends [never]
				? AllTrue<{
						[K in keyof A & keyof B]: NoExtraKeys<A[K], NonNullable<B[K]>>;
					}>
				: false
			: true
		: true;
type AllTrue<T> = false extends T[keyof T] ? false : true;

// Every key the types require is in the fixtures, with a matching type...
filesPayload satisfies Json<FilesPayload>;
devices satisfies Json<SkellyDevice[]>;
// ...and the fixtures have no keys the types don't know
const filesHaveNoExtraKeys: NoExtraKeys<typeof filesPayload, FilesPayload> =
	true;
const devicesHaveNoExtraKeys: NoExtraKeys<typeof devices, SkellyDevice[]> =
	true;

describe("payload fixtures", () => {
	it("pass the type checks above", () => {
		expect(filesHaveNoExtraKeys && devicesHaveNoExtraKeys).toBe(true);
	});

	it("are realistic enough to test the UI with", () => {
		const payload = filesPayload as FilesPayload;
		expect(payload.files.length).toBeGreaterThan(1);
		expect(payload.files.some((f) => f.enabled)).toBe(true);
		expect(payload.files.some((f) => !f.enabled)).toBe(true);
		expect(payload.transfer.in_progress).toBe(true);
		for (const file of payload.files) {
			for (const light of file.lights) {
				expect(light.rgb).toHaveLength(3);
			}
		}
	});
});

describe("targetOf", () => {
	const device = (devices as SkellyDevice[])[0];

	it("targets a Skelly by its device_id", () => {
		expect(targetOf(device)).toEqual<SkellyTarget>({
			device_id: device.device_id ?? "",
		});
	});

	it("falls back to the entry_id without a device", () => {
		expect(targetOf({ ...device, device_id: null })).toEqual<SkellyTarget>({
			entry_id: device.entry_id,
		});
	});
});
