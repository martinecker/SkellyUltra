// The live controls' logic, kept apart from the UI so it can be tested: what
// the entities behind them say, and the service calls that change them.

import type { HassEntity, HomeAssistant } from "../ha-types";
import type { DeviceProfile, EyeIconInfo } from "./types";

// The entity's state, if HA has one: a disabled entity (or one that's gone)
// has none, so its control isn't shown
export function stateOf(
	hass: HomeAssistant | undefined,
	entityId: string | null,
): HassEntity | undefined {
	return entityId ? hass?.states?.[entityId] : undefined;
}

// Whether the entity takes commands right now. "unknown" does: e.g. a
// button that was never pressed, or a select the Skelly hasn't reported yet.
export const usable = (entity: HassEntity | undefined): boolean =>
	entity !== undefined && entity.state !== "unavailable";

// The eye icon an eye icon select shows ("10 Fire" is 10), or null
export function eyeIconOf(entity: HassEntity | undefined): number | null {
	const match = /^(\d+)\s/.exec(entity?.state ?? "");
	return match ? Number(match[1]) : null;
}

// The select's option for an eye icon: the one with its number, else the
// profile's label (the same text)
export function eyeIconOption(
	entity: HassEntity | undefined,
	icon: EyeIconInfo,
): string {
	const options = entity?.attributes.options;
	const option = Array.isArray(options)
		? options.find(
				(o): o is string =>
					typeof o === "string" &&
					eyeIconOf({ state: o } as HassEntity) === icon.value,
			)
		: undefined;
	return option ?? icon.label;
}

// A light's brightness (0-255): 0 while it's off
export function brightnessOf(entity: HassEntity | undefined): number {
	if (entity?.state !== "on") {
		return 0;
	}
	const brightness = Number(entity.attributes.brightness);
	return Number.isFinite(brightness) ? brightness : 0;
}

// A light's color, if it says (HA leaves it out while the light is off)
export function rgbOf(
	entity: HassEntity | undefined,
): [number, number, number] | undefined {
	const rgb = entity?.attributes.rgb_color;
	return Array.isArray(rgb) &&
		rgb.length === 3 &&
		rgb.every((v) => typeof v === "number")
		? (rgb as [number, number, number])
		: undefined;
}

// The 1-based light mode an effect mode select shows, or 0 if unknown
export function lightModeOf(
	profile: DeviceProfile,
	entity: HassEntity | undefined,
): number {
	return profile.light_modes.indexOf(entity?.state ?? "") + 1;
}

// A number entity's value, or undefined
export function numberOf(entity: HassEntity | undefined): number | undefined {
	const value = Number.parseFloat(entity?.state ?? "");
	return Number.isFinite(value) ? value : undefined;
}

export const isOn = (entity: HassEntity | undefined): boolean =>
	entity?.state === "on";

// One of the live controls' service calls. Rejects with HA's error.
export type LiveCall = {
	domain: string;
	service: string;
	data: Record<string, unknown>;
};

export function lightCall(
	entityId: string,
	changes: { brightness?: number; rgb?: [number, number, number] },
): LiveCall {
	if (changes.brightness === 0) {
		return {
			domain: "light",
			service: "turn_off",
			data: { entity_id: entityId },
		};
	}
	return {
		domain: "light",
		service: "turn_on",
		data: {
			entity_id: entityId,
			...(changes.brightness !== undefined
				? { brightness: changes.brightness }
				: {}),
			...(changes.rgb ? { rgb_color: changes.rgb } : {}),
		},
	};
}

export const switchCall = (entityId: string, on: boolean): LiveCall => ({
	domain: "switch",
	service: on ? "turn_on" : "turn_off",
	data: { entity_id: entityId },
});

export const selectCall = (entityId: string, option: string): LiveCall => ({
	domain: "select",
	service: "select_option",
	data: { entity_id: entityId, option },
});

export const numberCall = (entityId: string, value: number): LiveCall => ({
	domain: "number",
	service: "set_value",
	data: { entity_id: entityId, value },
});

export const pressCall = (entityId: string): LiveCall => ({
	domain: "button",
	service: "press",
	data: { entity_id: entityId },
});

export async function callLive(
	hass: HomeAssistant,
	call: LiveCall,
): Promise<void> {
	// notifyOnError false: the caller shows the error in its own words
	await hass.callService(
		call.domain,
		call.service,
		call.data,
		undefined,
		false,
	);
}
