import type { HomeAssistant } from "../ha-types";
import type { SkellyDevice } from "./types";

// The loaded Skellies. Works for users who aren't admins, unlike the
// device registry commands.
export function listDevices(hass: HomeAssistant): Promise<SkellyDevice[]> {
	return hass.callWS<SkellyDevice[]>({ type: "skelly_ultra/devices/list" });
}
