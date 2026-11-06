// What the Skelly is playing, for the panel and the card. Follows the
// Skelly's playback reports (a file started anywhere shows as playing, with
// a countdown when its length is known) and Plays started here, which show
// as playing until the Skelly confirms them or PLAY_CONFIRM_MS passes.

import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { FileEntry, FilesPayload } from "./types";

export interface PlayingFile {
	entry_id: string;
	file_index: number;
	name: string;
	// The Skelly's playback report; undefined until it confirms a Play
	report?: number;
	// When the file ends (Date.now() time), if the Skelly said how long it is
	endsAt?: number;
}

// How long (in ms) the Skelly has to confirm a Play before it counts as not
// started
export const PLAY_CONFIRM_MS = 5000;

// What playing needs of a file
export type FileRef = Pick<FileEntry, "file_index" | "name">;

export class PlaybackTracker implements ReactiveController {
	private _playing?: PlayingFile;
	// Date.now() of the last tick, for the countdown
	now = Date.now();
	// The last playback report followed
	private _seen?: string;
	private _confirmTimer?: ReturnType<typeof setTimeout>;
	private _countdownTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly _host: ReactiveControllerHost,
		// A Play the Skelly didn't confirm in time
		private readonly _notStarted: (name: string) => void,
	) {
		_host.addController(this);
	}

	get playing(): PlayingFile | undefined {
		return this._playing;
	}

	private _set(playing: PlayingFile | undefined): void {
		if (playing !== this._playing) {
			this._playing = playing;
			this._host.requestUpdate();
		}
	}

	// Call before each render (willUpdate) with the shown Skelly's payload
	follow(payload: FilesPayload | undefined): void {
		this._forgetEnded(payload);
		this._followReports(payload);
	}

	// Drops the playing state once it can't be true any more: the Skelly
	// disconnected, the integration reloaded, or the file is gone
	private _forgetEnded(payload: FilesPayload | undefined): void {
		const playing = this._playing;
		if (!playing || !payload || payload.entry_id !== playing.entry_id) {
			return;
		}
		if (
			!payload.available ||
			payload.unloaded ||
			!payload.files.some(
				(f) => f.file_index === playing.file_index && f.name === playing.name,
			)
		) {
			this._set(undefined);
		}
	}

	private _followReports(payload: FilesPayload | undefined): void {
		if (!payload) {
			return;
		}
		const report =
			payload.available && !payload.unloaded ? payload.playback : null;
		const key = `${payload.entry_id}:${report?.report ?? ""}`;
		if (key === this._seen) {
			return;
		}
		const playing = this._playing;
		if (report) {
			const file = payload.files.find(
				(f) => f.file_index === report.file_index,
			);
			if (!file) {
				return; // Not in the list yet: looked at again with the next one
			}
			this._seen = key;
			clearTimeout(this._confirmTimer);
			this._confirmTimer = undefined;
			this.now = Date.now();
			// From when the Skelly reported it (it may be shown again later,
			// e.g. after reopening the panel), in this browser's time (HA's
			// clock may differ), and never longer than the file
			const duration = report.duration * 1000;
			const endsAt =
				duration > 0
					? Math.min(
							report.started + (this.now - payload.sent_at) + duration,
							this.now + duration,
						)
					: undefined;
			if (endsAt !== undefined && endsAt <= this.now) {
				// Ended already; the Skelly's report of it was missed
				if (playing?.entry_id === payload.entry_id) {
					this._set(undefined);
				}
				return;
			}
			this._set({
				entry_id: payload.entry_id,
				file_index: file.file_index,
				name: file.name,
				report: report.report,
				endsAt,
			});
			return;
		}
		this._seen = key;
		if (
			playing?.entry_id === payload.entry_id &&
			playing.report !== undefined
		) {
			// Ended; a Play still waiting for its report stays
			this._set(undefined);
		}
	}

	// Which report was seen last; take it before sending play_file and pass
	// it to started()
	get seen(): string | undefined {
		return this._seen;
	}

	// play_file for file succeeded: shown as playing until the Skelly
	// reports it, or says nothing for PLAY_CONFIRM_MS
	started(entryId: string, file: FileRef, seenBefore: string | undefined) {
		const current = this._playing;
		if (
			this._seen !== seenBefore &&
			current?.entry_id === entryId &&
			current.file_index === file.file_index &&
			current.report !== undefined
		) {
			return; // The Skelly's report came before the action's answer
		}
		const pending: PlayingFile = {
			entry_id: entryId,
			file_index: file.file_index,
			name: file.name,
		};
		this._set(pending);
		clearTimeout(this._confirmTimer);
		this._confirmTimer = setTimeout(() => {
			this._confirmTimer = undefined;
			if (this._playing === pending) {
				this._set(undefined);
				this._notStarted(file.name);
			}
		}, PLAY_CONFIRM_MS);
	}

	// The file stopped (or was deleted)
	clear(entryId: string, fileIndex: number): void {
		const playing = this._playing;
		if (playing?.entry_id === entryId && playing.file_index === fileIndex) {
			this._set(undefined);
		}
	}

	// Stopped by the caller: forgets playing, if it's still what plays
	drop(playing: PlayingFile): void {
		if (this._playing === playing) {
			this._set(undefined);
		}
	}

	// The file_index playing on payload's Skelly, or null
	playingIndex(payload: FilesPayload): number | null {
		const playing = this._playing;
		return playing && playing.entry_id === payload.entry_id
			? playing.file_index
			: null;
	}

	// Seconds left of the playing file, if the Skelly said how long it is
	remaining(payload: FilesPayload): number | null {
		const playing = this._playing;
		if (
			!playing ||
			playing.entry_id !== payload.entry_id ||
			playing.endsAt === undefined
		) {
			return null;
		}
		return Math.max(0, Math.ceil((playing.endsAt - this.now) / 1000));
	}

	// Counts down while a file with a known length plays
	hostUpdated(): void {
		if (this._playing?.endsAt === undefined) {
			this._stopCountdown();
		} else if (this._countdownTimer === undefined) {
			this._countdownTimer = setInterval(() => this._tick(), 1000);
		}
	}

	hostDisconnected(): void {
		clearTimeout(this._confirmTimer);
		this._confirmTimer = undefined;
		this._stopCountdown();
		// A Play the Skelly hasn't confirmed can't be checked from here
		if (this._playing && this._playing.report === undefined) {
			this._playing = undefined;
		}
	}

	private _tick(): void {
		this.now = Date.now();
		this._host.requestUpdate();
		const endsAt = this._playing?.endsAt;
		// The Skelly's "stopped" report may come late or not at all
		if (endsAt !== undefined && this.now >= endsAt) {
			this._set(undefined);
		}
	}

	private _stopCountdown(): void {
		clearInterval(this._countdownTimer);
		this._countdownTimer = undefined;
	}
}
