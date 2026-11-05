// The file transfer overrides (chunk size and MP3 bitrate) are the
// integration's own entities: an override switch and a value entity each.
// The value entity only takes a value while its switch is on.

import type { HomeAssistant } from "../ha-types";
import type { TransferSettings } from "./types";

// Below this many bytes per chunk, a transfer takes minutes
export const SMALL_CHUNK_SIZE = 100;

const turn = (hass: HomeAssistant, entityId: string, on: boolean) =>
	hass.callService("switch", on ? "turn_on" : "turn_off", {
		entity_id: entityId,
	});

// Turns the chunk size override on (with a value) or off (null)
export async function setChunkSize(
	hass: HomeAssistant,
	settings: TransferSettings,
	value: number | null,
): Promise<void> {
	const { switch_entity, value_entity } = settings.chunk_size;
	if (!switch_entity || (value !== null && !value_entity)) {
		throw new Error("The chunk size entities aren't available");
	}
	if (value === null) {
		await turn(hass, switch_entity, false);
		return;
	}
	await turn(hass, switch_entity, true);
	await hass.callService("number", "set_value", {
		entity_id: value_entity,
		value,
	});
}

// Turns the bitrate override on (with a value) or off (null)
export async function setBitrate(
	hass: HomeAssistant,
	settings: TransferSettings,
	value: string | null,
): Promise<void> {
	const { switch_entity, value_entity } = settings.bitrate;
	if (!switch_entity || (value !== null && !value_entity)) {
		throw new Error("The bitrate entities aren't available");
	}
	if (value === null) {
		await turn(hass, switch_entity, false);
		return;
	}
	await turn(hass, switch_entity, true);
	await hass.callService("select", "select_option", {
		entity_id: value_entity,
		option: value,
	});
}
