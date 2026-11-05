// The websocket payloads of custom_components/skelly_ultra/websocket_api.py.
// Written by hand; test/fixtures/ holds an example of each, which a backend
// test checks against what the integration sends and test/types.test.ts
// checks against these types, so the two sides can't drift apart silently.

// A light channel's settings, in the units edit_file takes
export interface LightSettings {
	channel: number;
	brightness: number; // 0-255
	effect_mode: number; // 1-based index into DeviceProfile.light_modes
	effect_speed: number; // 0 slowest to max_effect_speed fastest
	rgb: [number, number, number];
	color_cycle: boolean;
}

export interface FileEntry {
	name: string;
	file_index: number;
	cluster: number;
	enabled: boolean; // in the play order
	movements: string[]; // movement parts, as edit_file takes them
	movement_bits: number; // the raw value from the device
	eye_icon: number | null; // 1-based; null on profiles without eye icons
	lights: LightSettings[];
}

export interface MovementInfo {
	part: string;
	label: string;
	icon_url: string;
}

export interface LightChannelInfo {
	channel: number;
	label: string;
}

export interface EyeIconInfo {
	value: number;
	label: string;
	url: string;
}

export interface DeviceProfile {
	type: string; // ultra_skelly, skelly_12ft or lethal_lily
	display_name: string;
	movements: MovementInfo[];
	lights: LightChannelInfo[];
	light_modes: string[];
	eye_icons: EyeIconInfo[]; // empty on profiles without eye icons
	max_effect_speed: number;
	max_filename_length: number; // including the .mp3 extension
}

export type TransferStatus =
	| "idle"
	| "uploading"
	| "complete"
	| "cancelled"
	| "error";

export interface TransferState {
	status: TransferStatus;
	in_progress: boolean;
	progress: number; // 0-100
	filename: string | null;
	error: string | null;
}

export interface FilesPayload {
	entry_id: string;
	device_id: string | null;
	name: string;
	// Set on the last event of a subscription whose entry is unloading
	unloaded: boolean;
	device_profile: DeviceProfile;
	available: boolean;
	// The file list is being read from the Skelly, so it may be outdated
	refreshing: boolean;
	// HA's clock (ms since the epoch) when the payload was sent
	sent_at: number;
	// The file the Skelly reported playing, or null. duration is in seconds
	// (0 if unknown), started in ms since the epoch (HA's clock); report is
	// new for every report, also of the same file.
	playback: {
		file_index: number;
		duration: number;
		started: number;
		report: number;
	} | null;
	capacity: {
		free_kb: number | null;
		file_count_reported: number | null;
	};
	file_order: number[]; // file indices of the enabled files, in play order
	files: FileEntry[];
	transfer: TransferState;
	transfer_settings: TransferSettings;
}

// One file transfer override. The entities change it (null: not found in
// the entity registry); the value entity only takes a value while the
// override switch is on.
interface TransferOverride<T> {
	override: boolean;
	value: T;
	switch_entity: string | null;
	value_entity: string | null;
}

export interface TransferSettings {
	chunk_size: TransferOverride<number> & {
		// The chunk size the connection's MTU allows, used without the
		// override; null until the Skelly has connected
		auto: number | null;
		min: number;
		max: number;
	};
	bitrate: TransferOverride<string> & {
		default: string;
		options: string[];
	};
}

// An entry of skelly_ultra/devices/list
export interface SkellyDevice {
	entry_id: string;
	device_id: string | null;
	name: string;
	type: string;
	available: boolean;
	// Media source ID to upload files to, or null if HA has no local media folder
	upload_target: string | null;
}

// Which Skelly a command is about: one of these, or neither if there's only one
export interface SkellyTarget {
	device_id?: string;
	entry_id?: string;
}

// Picks the identifier to target a listed Skelly by
export function targetOf(device: SkellyDevice): SkellyTarget {
	return device.device_id
		? { device_id: device.device_id }
		: { entry_id: device.entry_id };
}
