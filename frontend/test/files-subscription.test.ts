import type { ReactiveController, ReactiveControllerHost } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilesSubscription, RETRY_DELAYS } from "../src/api/files-subscription";
import type { FilesPayload } from "../src/api/types";
import type { HomeAssistant } from "../src/ha-types";
import fixture from "./fixtures/files-payload.json";

const payload = fixture as FilesPayload;

// A websocket connection that records subscriptions and lets the test answer them
class FakeConnection {
	connected = true;
	listeners: Record<string, Set<() => void>> = {
		ready: new Set(),
		disconnected: new Set(),
	};

	addEventListener(event: string, listener: () => void) {
		this.listeners[event].add(listener);
	}

	removeEventListener(event: string, listener: () => void) {
		this.listeners[event].delete(listener);
	}

	// The websocket drops (the server forgets all subscriptions) ...
	disconnect() {
		this.connected = false;
		for (const listener of this.listeners.disconnected) listener();
	}

	// ... and comes back
	reconnect() {
		this.connected = true;
		for (const listener of this.listeners.ready) listener();
	}

	subscriptions: {
		message: Record<string, unknown>;
		callback: (payload: FilesPayload) => void;
		resolve: (unsub: () => Promise<void>) => void;
		reject: (err: unknown) => void;
		unsubscribed: boolean;
	}[] = [];

	subscribeMessage<T>(
		callback: (message: T) => void,
		message: Record<string, unknown>,
		options?: { resubscribe?: boolean },
	) {
		// The library must not resubscribe on its own: see FilesSubscription
		expect(options).toEqual({ resubscribe: false });
		return new Promise<() => Promise<void>>((resolve, reject) => {
			this.subscriptions.push({
				message,
				callback: callback as unknown as (payload: FilesPayload) => void,
				resolve,
				reject,
				unsubscribed: false,
			});
		});
	}

	get last() {
		return this.subscriptions[this.subscriptions.length - 1];
	}

	// Accept the latest subscription and send it a payload
	async accept(sent: FilesPayload | null = payload) {
		const sub = this.last;
		sub.resolve(async () => {
			sub.unsubscribed = true;
		});
		await flush();
		if (sent) {
			sub.callback(sent);
		}
	}
}

class FakeHost implements ReactiveControllerHost {
	controllers: ReactiveController[] = [];
	updates = 0;
	addController(controller: ReactiveController) {
		this.controllers.push(controller);
	}
	removeController() {}
	requestUpdate() {
		this.updates += 1;
	}
	get updateComplete() {
		return Promise.resolve(true);
	}
}

const flush = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve)).then(() => undefined);

function setup() {
	const host = new FakeHost();
	const connection = new FakeConnection();
	const hass = { connection } as unknown as HomeAssistant;
	const files = new FilesSubscription(host);
	return { host, connection, hass, files };
}

describe("FilesSubscription", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("subscribes once connected and has a target, and shows the payloads", async () => {
		const { connection, hass, files } = setup();
		files.setTarget(hass, { device_id: "dev1" });
		expect(connection.subscriptions).toHaveLength(0); // the host isn't connected yet

		files.hostConnected();
		expect(connection.subscriptions).toHaveLength(1);
		expect(connection.last.message).toEqual({
			type: "skelly_ultra/files/subscribe",
			device_id: "dev1",
		});
		expect(files.status).toBe("connecting");

		await connection.accept();
		expect(files.status).toBe("live");
		expect(files.payload).toEqual(payload);
	});

	it("doesn't resubscribe when hass changes but the connection doesn't", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, { device_id: "dev1" });
		await connection.accept();

		files.setTarget({ ...hass } as HomeAssistant, { device_id: "dev1" });
		expect(connection.subscriptions).toHaveLength(1);
	});

	it("moves to another Skelly", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, { device_id: "dev1" });
		await connection.accept();
		const first = connection.last;

		files.setTarget(hass, { entry_id: "entry2" });
		await flush();
		expect(first.unsubscribed).toBe(true);
		expect(files.payload).toBeUndefined();
		expect(connection.last.message).toEqual({
			type: "skelly_ultra/files/subscribe",
			entry_id: "entry2",
		});

		// A late payload of the old subscription is ignored
		first.callback({ ...payload, name: "old" });
		expect(files.payload).toBeUndefined();
	});

	it("unsubscribes when the host leaves the page", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		await connection.accept();

		files.hostDisconnected();
		await flush();
		expect(connection.last.unsubscribed).toBe(true);
		expect(files.status).toBe("idle");
	});

	it("unsubscribes a subscription that's answered after the host left", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		files.hostDisconnected();

		await connection.accept();
		await flush();
		expect(connection.last.unsubscribed).toBe(true);
		expect(files.payload).toBeUndefined();
	});

	it("subscribes again with backoff while the integration reloads", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, { device_id: "dev1" });
		await connection.accept();

		connection.last.callback({ ...payload, unloaded: true, available: false });
		await flush();
		expect(files.status).toBe("reloading");
		expect(files.payload?.unloaded).toBe(true); // the last files stay visible

		// Not loaded yet: each retry fails, waiting longer each time
		for (const delay of [
			...RETRY_DELAYS,
			RETRY_DELAYS[RETRY_DELAYS.length - 1],
		]) {
			const before = connection.subscriptions.length;
			vi.advanceTimersByTime(delay * 1000 - 1);
			expect(connection.subscriptions).toHaveLength(before);
			vi.advanceTimersByTime(1);
			expect(connection.subscriptions).toHaveLength(before + 1);
			connection.last.reject({
				code: "not_found",
				message: "No loaded Skelly found",
			});
			await flush();
			await flush();
			expect(files.status).toBe("reloading");
		}

		// Back: live again, and the next reload starts over at the first delay
		vi.advanceTimersByTime(RETRY_DELAYS[RETRY_DELAYS.length - 1] * 1000);
		await connection.accept();
		expect(files.status).toBe("live");
		expect(files.payload?.unloaded).toBe(false);

		const before = connection.subscriptions.length;
		connection.last.callback({ ...payload, unloaded: true });
		vi.advanceTimersByTime(RETRY_DELAYS[0] * 1000);
		expect(connection.subscriptions).toHaveLength(before + 1);
	});

	it("shows other errors without retrying", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		connection.last.reject({ code: "invalid_format", message: "bad message" });
		await flush();
		await flush();

		expect(files.status).toBe("error");
		expect(files.error).toBe("bad message");
		vi.advanceTimersByTime(60_000);
		expect(connection.subscriptions).toHaveLength(1);
	});

	it("stops retrying when the host leaves the page", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		connection.last.reject({
			code: "not_found",
			message: "No loaded Skelly found",
		});
		await flush();
		await flush();

		files.hostDisconnected();
		vi.advanceTimersByTime(60_000);
		expect(connection.subscriptions).toHaveLength(1);
	});

	it("starts over when hass goes away and comes back", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		await connection.accept();

		files.setTarget(undefined, {});
		expect(files.status).toBe("idle");
		files.setTarget(hass, {});
		expect(connection.subscriptions).toHaveLength(2);
	});

	it("subscribes again when the websocket is back, e.g. after an HA restart", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, { device_id: "dev1" });
		await connection.accept();

		connection.disconnect();
		expect(files.status).toBe("connecting");
		expect(files.payload).toEqual(payload); // the last files stay visible
		// No unsubscribe for a subscription the server already forgot
		expect(connection.subscriptions[0].unsubscribed).toBe(false);

		connection.reconnect();
		expect(connection.subscriptions).toHaveLength(2);
		// The Skelly isn't loaded yet after the restart: retry until it is
		connection.last.reject({
			code: "unknown_command",
			message: "Unknown command.",
		});
		await flush();
		await flush();
		expect(files.status).toBe("reloading");
		vi.advanceTimersByTime(RETRY_DELAYS[0] * 1000);
		expect(connection.subscriptions).toHaveLength(3);
		await connection.accept();
		expect(files.status).toBe("live");
	});

	it("waits for the websocket instead of retrying while it is down", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		connection.last.reject({
			code: "not_found",
			message: "No loaded Skelly found",
		});
		await flush();
		await flush();

		connection.disconnect();
		vi.advanceTimersByTime(60_000);
		expect(connection.subscriptions).toHaveLength(1);

		// Switching Skellies while it's down doesn't subscribe either
		files.setTarget(hass, { device_id: "dev2" });
		expect(connection.subscriptions).toHaveLength(1);

		connection.reconnect();
		expect(connection.subscriptions).toHaveLength(2);
		expect(connection.last.message).toMatchObject({ device_id: "dev2" });
	});

	it("retries when the library rejects with a bare error code", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		connection.last.reject(3); // ERR_CONNECTION_LOST
		await flush();
		await flush();
		expect(files.status).toBe("reloading");
		vi.advanceTimersByTime(RETRY_DELAYS[0] * 1000);
		expect(connection.subscriptions).toHaveLength(2);
	});

	it("doesn't unsubscribe a subscription the server ended on unload", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		await connection.accept();
		connection.last.callback({ ...payload, unloaded: true });
		await flush();
		expect(connection.subscriptions[0].unsubscribed).toBe(false);
	});

	it("stops listening to the connection when it leaves the page", async () => {
		const { connection, hass, files } = setup();
		files.hostConnected();
		files.setTarget(hass, {});
		expect(connection.listeners.ready.size).toBe(1);
		files.hostDisconnected();
		expect(connection.listeners.ready.size).toBe(0);
		expect(connection.listeners.disconnected.size).toBe(0);
		connection.reconnect();
		expect(connection.subscriptions).toHaveLength(1);
	});
});
