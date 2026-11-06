// The parts of Home Assistant's frontend objects that this frontend uses.
// HA passes these to panels and cards; they are not imported from HA.

export interface HassUser {
	id: string;
	name: string;
	is_admin: boolean;
	is_owner: boolean;
}

export interface HassEntity {
	entity_id: string;
	state: string;
	attributes: Record<string, unknown>;
}

// home-assistant-js-websocket's Connection
export interface HassConnection {
	// false while the websocket is down and reconnecting
	connected: boolean;
	subscribeMessage<T>(
		callback: (message: T) => void,
		message: Record<string, unknown>,
		// resubscribe: false stops the library from subscribing again on its
		// own after a reconnect (and from hiding a failure to do so)
		options?: { resubscribe?: boolean },
	): Promise<() => Promise<void>>;
	addEventListener(event: "ready" | "disconnected", listener: () => void): void;
	removeEventListener(
		event: "ready" | "disconnected",
		listener: () => void,
	): void;
}

export interface HomeAssistant {
	connection: HassConnection;
	states: Record<string, HassEntity>;
	user?: HassUser;
	language: string;
	config?: { country?: string | null };
	// The sidebar panels, by URL path
	panels?: Record<string, { url_path: string }>;
	themes: { darkMode?: boolean };
	callWS<T>(message: Record<string, unknown>): Promise<T>;
	callService(
		domain: string,
		service: string,
		serviceData?: Record<string, unknown>,
		target?: Record<string, unknown>,
		notifyOnError?: boolean,
		returnResponse?: boolean,
	): Promise<unknown>;
	fetchWithAuth(path: string, init?: RequestInit): Promise<Response>;
}

// What HA passes to a custom panel's element as its `panel` property
export interface PanelInfo<C = Record<string, unknown>> {
	component_name: string;
	url_path: string;
	title: string | null;
	config: C;
}

// A Lovelace card's config, as the user writes it in YAML
export interface LovelaceCardConfig {
	type: string;
	[key: string]: unknown;
}

// An entry of window.customCards, which fills the dashboard's card picker
export interface CustomCardEntry {
	type: string;
	name: string;
	description?: string;
	preview?: boolean;
	documentationURL?: string;
}

declare global {
	interface Window {
		customCards?: CustomCardEntry[];
	}
}
