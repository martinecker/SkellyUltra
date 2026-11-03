import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { HassConnection, HomeAssistant } from "../ha-types";
import type { FilesPayload, SkellyTarget } from "./types";

// "connecting": waiting for the first payload, or for the websocket to be back
// "live": payloads arrive as the device changes
// "reloading": the integration is reloading (or not loaded); retrying
// "error": the subscription failed for a reason retrying won't fix
export type SubscriptionStatus =
	| "idle"
	| "connecting"
	| "live"
	| "reloading"
	| "error";

// Seconds to wait before each retry; the last one repeats
export const RETRY_DELAYS = [1, 2, 5, 10];

// Errors after which retrying can help: the Skelly isn't loaded (yet), or
// the integration hasn't registered its commands yet after a restart
const RETRY_CODES = new Set(["not_found", "unknown_command"]);

// Follows skelly_ultra/files/subscribe for one Skelly and re-renders the host
// on every change. Subscribes while the host is connected to the page.
//
// Call setTarget() whenever hass or the target Skelly may have changed (for
// example in willUpdate); it only resubscribes when the websocket connection
// or the target actually changed.
//
// The subscription is made with resubscribe: false and redone here when the
// websocket is back ("ready"). home-assistant-js-websocket's own resubscribe
// would hide a failure (after an HA restart the Skelly loads after the
// websocket is up), and would revive a subscription the server already ended
// because its entry unloaded.
export class FilesSubscription implements ReactiveController {
	payload?: FilesPayload;
	status: SubscriptionStatus = "idle";
	error?: string;

	private _connection?: HassConnection;
	// The connection whose events we listen to
	private _listening?: HassConnection;
	private _target: SkellyTarget = {};
	private _hostConnected = false;
	private _unsubscribe?: () => Promise<void>;
	// Bumped on every (re)subscribe and teardown, so a late answer to an old
	// subscribe is ignored
	private _generation = 0;
	private _retryTimer?: ReturnType<typeof setTimeout>;
	private _retries = 0;

	constructor(private readonly _host: ReactiveControllerHost) {
		_host.addController(this);
	}

	setTarget(hass: HomeAssistant | undefined, target: SkellyTarget): void {
		const connection = hass?.connection;
		if (connection === this._connection && sameTarget(target, this._target)) {
			return;
		}
		const targetChanged = !sameTarget(target, this._target);
		this._connection = connection;
		this._target = { ...target };
		if (targetChanged) {
			// Don't show another Skelly's files while the new ones load
			this.payload = undefined;
		}
		this._restart();
	}

	hostConnected(): void {
		this._hostConnected = true;
		this._restart();
	}

	hostDisconnected(): void {
		this._hostConnected = false;
		this._teardown();
		this._listen(undefined);
		this.status = "idle";
	}

	private readonly _onReady = (): void => {
		// The websocket is back (HA may have restarted): subscribe again
		this._restart();
	};

	private readonly _onDisconnected = (): void => {
		// The server forgot the subscription; wait for "ready"
		this._unsubscribe = undefined;
		this._teardown();
		this.status = "connecting";
		this._host.requestUpdate();
	};

	private _listen(connection: HassConnection | undefined): void {
		if (connection === this._listening) {
			return;
		}
		this._listening?.removeEventListener("ready", this._onReady);
		this._listening?.removeEventListener("disconnected", this._onDisconnected);
		this._listening = connection;
		connection?.addEventListener("ready", this._onReady);
		connection?.addEventListener("disconnected", this._onDisconnected);
	}

	private _restart(): void {
		this._teardown();
		this._retries = 0;
		if (!this._hostConnected || !this._connection) {
			this._listen(undefined);
			this.status = "idle";
			this._host.requestUpdate();
			return;
		}
		this._listen(this._connection);
		this._subscribe();
	}

	private async _subscribe(): Promise<void> {
		const connection = this._connection;
		if (!connection) {
			return;
		}
		const generation = ++this._generation;
		if (this.status !== "reloading") {
			this.status = "connecting";
		}
		this.error = undefined;
		this._host.requestUpdate();
		if (!connection.connected) {
			// _onReady subscribes once the websocket is back
			return;
		}
		try {
			const unsubscribe = await connection.subscribeMessage<FilesPayload>(
				(payload) => {
					if (generation === this._generation) {
						this._onPayload(payload);
					}
				},
				{ type: "skelly_ultra/files/subscribe", ...this._target },
				{ resubscribe: false },
			);
			if (generation !== this._generation) {
				// Torn down or restarted while subscribing
				unsubscribeQuietly(unsubscribe);
				return;
			}
			this._unsubscribe = unsubscribe;
		} catch (err) {
			if (generation !== this._generation) {
				return;
			}
			if (err && typeof err === "object") {
				const { code, message } = err as { code?: string; message?: string };
				this.error = message || code;
				this.status = code && RETRY_CODES.has(code) ? "reloading" : "error";
			} else {
				// The library rejects with a bare number when the connection is
				// lost mid-request; that's worth retrying
				this.error = undefined;
				this.status = "reloading";
			}
			if (this.status === "reloading") {
				this._scheduleRetry();
			}
			this._host.requestUpdate();
		}
	}

	private _onPayload(payload: FilesPayload): void {
		this.payload = payload;
		if (payload.unloaded) {
			// The server ended this subscription (so there's nothing to
			// unsubscribe); follow the entry once it's back
			this.status = "reloading";
			this._unsubscribe = undefined;
			this._teardown();
			this._scheduleRetry();
		} else {
			this.status = "live";
			this.error = undefined;
			this._retries = 0;
		}
		this._host.requestUpdate();
	}

	private _scheduleRetry(): void {
		clearTimeout(this._retryTimer);
		const delay =
			RETRY_DELAYS[Math.min(this._retries, RETRY_DELAYS.length - 1)];
		this._retries += 1;
		this._retryTimer = setTimeout(() => {
			this._retryTimer = undefined;
			this._subscribe();
		}, delay * 1000);
	}

	private _teardown(): void {
		this._generation += 1;
		clearTimeout(this._retryTimer);
		this._retryTimer = undefined;
		if (this._unsubscribe) {
			unsubscribeQuietly(this._unsubscribe);
			this._unsubscribe = undefined;
		}
	}
}

function sameTarget(a: SkellyTarget, b: SkellyTarget): boolean {
	return a.device_id === b.device_id && a.entry_id === b.entry_id;
}

// The server may already have ended the subscription; there's nothing to do
// about a failed unsubscribe.
function unsubscribeQuietly(unsubscribe: () => Promise<void>): void {
	unsubscribe().catch(() => undefined);
}
