// The edit dialog's logic, kept apart from the UI so it can be tested:
// what the user changed, as edit_file data, and the movement rules.

import type { FileChanges } from "./actions";
import type { DeviceProfile, FileEntry, LightSettings } from "./types";

// The settings the dialog edits
export interface FileDraft {
	movements: string[];
	eye_icon: number | null;
	lights: LightSettings[];
}

// The movement part that moves everything at once
export const ALL_PART = "all";

export function draftOf(file: FileEntry): FileDraft {
	return {
		movements: [...file.movements],
		eye_icon: file.eye_icon,
		lights: file.lights.map((light) => ({
			...light,
			rgb: [...light.rgb] as [number, number, number],
		})),
	};
}

// Turns a movement part on or off. "All" and the single parts exclude each
// other, as on the device (and in the web controller).
export function toggleMovement(
	profile: DeviceProfile,
	movements: string[],
	part: string,
): string[] {
	if (movements.includes(part)) {
		return movements.filter((p) => p !== part);
	}
	if (part === ALL_PART) {
		return [ALL_PART];
	}
	const parts = [...movements.filter((p) => p !== ALL_PART), part];
	// Keep the profile's order, which edit_file doesn't need but reads better
	const order = profile.movements.map((m) => m.part);
	return parts.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

const sameParts = (a: string[], b: string[]) =>
	a.length === b.length && a.every((part) => b.includes(part));

const sameRgb = (a: readonly number[], b: readonly number[]) =>
	a.length === b.length && a.every((value, i) => value === b[i]);

// The fields of `draft` that differ from `original`, as edit_file data.
// Empty if nothing changed. The backend diffs as well; this keeps the
// request small and tells the dialog whether there's anything to save.
export function fileChanges(
	original: FileDraft,
	draft: FileDraft,
): FileChanges {
	const changes: FileChanges = {};
	if (!sameParts(original.movements, draft.movements)) {
		changes.movements = [...draft.movements];
	}
	if (draft.eye_icon !== null && draft.eye_icon !== original.eye_icon) {
		changes.eye_icon = draft.eye_icon;
	}
	const lights: NonNullable<FileChanges["lights"]> = [];
	for (const light of draft.lights) {
		const before = original.lights.find((l) => l.channel === light.channel);
		const changed: Partial<LightSettings> & { channel: number } = {
			channel: light.channel,
		};
		if (!before || before.brightness !== light.brightness) {
			changed.brightness = light.brightness;
		}
		if (!before || before.effect_mode !== light.effect_mode) {
			changed.effect_mode = light.effect_mode;
		}
		if (!before || before.effect_speed !== light.effect_speed) {
			changed.effect_speed = light.effect_speed;
		}
		if (!before || !sameRgb(before.rgb, light.rgb)) {
			changed.rgb = [...light.rgb] as [number, number, number];
		}
		if (!before || before.color_cycle !== light.color_cycle) {
			changed.color_cycle = light.color_cycle;
		}
		if (Object.keys(changed).length > 1) {
			lights.push(changed);
		}
	}
	if (lights.length) {
		changes.lights = lights;
	}
	return changes;
}

export const hasChanges = (changes: FileChanges) =>
	Object.keys(changes).length > 0;

// Whether two file entries have the same settings (to notice a change made
// on the device, or elsewhere, while the dialog is open)
export function sameSettings(a: FileDraft, b: FileDraft): boolean {
	return !hasChanges(fileChanges(a, b)) && !hasChanges(fileChanges(b, a));
}

// Whether a light mode has an effect speed (every mode but Static)
export function modeHasSpeed(profile: DeviceProfile, mode: number): boolean {
	return profile.light_modes[mode - 1]?.toLowerCase() !== "static";
}

// "#rrggbb" for <input type=color>, and back
export function rgbToHex(rgb: readonly number[]): string {
	return `#${rgb
		.map((v) =>
			Math.max(0, Math.min(255, Math.round(v)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
	const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
	if (!match) {
		return null;
	}
	return [
		Number.parseInt(match[1], 16),
		Number.parseInt(match[2], 16),
		Number.parseInt(match[3], 16),
	];
}

// Keeps a typed number in range; NaN (an empty field) becomes `fallback`
export function clampInt(
	value: number,
	low: number,
	high: number,
	fallback: number,
): number {
	if (!Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(low, Math.min(high, Math.round(value)));
}
