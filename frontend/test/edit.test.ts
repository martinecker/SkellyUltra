import { describe, expect, it } from "vitest";
import {
	clampInt,
	draftOf,
	fileChanges,
	hasChanges,
	hexToRgb,
	modeHasSpeed,
	rgbToHex,
	sameSettings,
	toggleMovement,
} from "../src/api/edit";
import type { DeviceProfile, FileEntry, FilesPayload } from "../src/api/types";
import fixture from "./fixtures/files-payload.json";

const payload = fixture as FilesPayload;
const ultra = payload.device_profile;
const file = payload.files[0] as FileEntry;

const lily: DeviceProfile = {
	...ultra,
	movements: ["all", "wrist", "elbow", "head", "eyes"].map((part) => ({
		part,
		label: part,
		icon_url: "",
	})),
	light_modes: ["Flickering", "Pulsing", "Chasing"],
	eye_icons: [],
};

describe("toggleMovement", () => {
	it("keeps All and the single parts apart", () => {
		expect(toggleMovement(ultra, ["head", "torso"], "all")).toEqual(["all"]);
		expect(toggleMovement(ultra, ["all"], "arm")).toEqual(["arm"]);
		expect(toggleMovement(ultra, ["all"], "all")).toEqual([]);
	});

	it("adds and removes parts, in the profile's order", () => {
		expect(toggleMovement(ultra, ["torso"], "head")).toEqual(["head", "torso"]);
		expect(toggleMovement(ultra, ["head", "torso"], "head")).toEqual(["torso"]);
		expect(toggleMovement(lily, ["eyes"], "wrist")).toEqual(["wrist", "eyes"]);
	});
});

describe("fileChanges", () => {
	it("is empty when nothing changed, also for a reordered movement list", () => {
		const draft = draftOf(file);
		draft.movements = [...draft.movements].reverse();
		expect(fileChanges(draftOf(file), draft)).toEqual({});
		expect(hasChanges(fileChanges(draftOf(file), draft))).toBe(false);
		expect(sameSettings(draftOf(file), draft)).toBe(true);
	});

	it("has only the changed fields and light channels", () => {
		const draft = draftOf(file);
		draft.movements = ["all"];
		draft.eye_icon = 2;
		draft.lights[1] = { ...draft.lights[1], rgb: [1, 2, 3], effect_speed: 10 };
		expect(fileChanges(draftOf(file), draft)).toEqual({
			movements: ["all"],
			eye_icon: 2,
			lights: [{ channel: 1, rgb: [1, 2, 3], effect_speed: 10 }],
		});
		expect(sameSettings(draftOf(file), draft)).toBe(false);
	});

	it("can turn movement off", () => {
		const draft = draftOf(file);
		draft.movements = [];
		expect(fileChanges(draftOf(file), draft)).toEqual({ movements: [] });
	});

	it("leaves out the eye icon on profiles without one", () => {
		const noEye = { ...file, eye_icon: null };
		expect(fileChanges(draftOf(noEye), draftOf(noEye))).toEqual({});
	});

	it("doesn't share arrays with the file it copied", () => {
		const draft = draftOf(file);
		draft.lights[0].rgb[0] = 7;
		draft.movements.push("arm");
		expect(file.lights[0].rgb[0]).toBe(255);
		expect(file.movements).toEqual(["head", "torso"]);
	});
});

describe("helpers", () => {
	it("know which modes have a speed", () => {
		expect(modeHasSpeed(ultra, 1)).toBe(false);
		expect(modeHasSpeed(ultra, 2)).toBe(true);
		// Every one of Lily's modes moves
		expect(modeHasSpeed(lily, 1)).toBe(true);
	});

	it("convert colors", () => {
		expect(rgbToHex([255, 0, 16])).toBe("#ff0010");
		expect(hexToRgb("#FF0010")).toEqual([255, 0, 16]);
		expect(hexToRgb("red")).toBeNull();
	});

	it("keep typed numbers in range", () => {
		expect(clampInt(300, 0, 255, 5)).toBe(255);
		expect(clampInt(-1, 0, 255, 5)).toBe(0);
		expect(clampInt(Number.NaN, 0, 255, 5)).toBe(5);
		expect(clampInt(12.6, 0, 255, 5)).toBe(13);
	});
});
