import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import {
	type ActionTarget,
	cancelTransfer,
	errorMessage,
	playFile,
	sayLive,
	stopFile,
} from "../api/actions";
import { listDevices } from "../api/devices";
import { formatFree, orderedFiles } from "../api/files";
import { FilesSubscription } from "../api/files-subscription";
import { type FileRef, PlaybackTracker } from "../api/playback";
import type { FilesPayload } from "../api/types";
import type { SkTtsForm, TtsChangeDetail } from "../components/sk-tts-form";
import {
	CARD_EDITOR_ELEMENT,
	CARD_ELEMENT,
	PANEL_URL_PATH,
} from "../constants";
import type { HomeAssistant, LovelaceCardConfig } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";
import { navigate, showToast } from "../toast";

export interface SkellyUltraCardConfig extends LovelaceCardConfig {
	device_id?: string;
	// The text-to-speech engine to start with; the last one used otherwise
	tts_entity?: string;
	show_tts?: boolean;
	show_files?: boolean;
	max_files?: number;
}

export const DEFAULT_MAX_FILES = 5;
export const MAX_FILES_LIMIT = 20;

// The config with its defaults filled in
export function withDefaults(
	config: SkellyUltraCardConfig,
): SkellyUltraCardConfig &
	Required<
		Pick<SkellyUltraCardConfig, "show_tts" | "show_files" | "max_files">
	> {
	return {
		...config,
		device_id: config.device_id ?? undefined,
		tts_entity: config.tts_entity ?? undefined,
		show_tts: config.show_tts ?? true,
		show_files: config.show_files ?? true,
		max_files: config.max_files ?? DEFAULT_MAX_FILES,
	};
}

// Why a config can't be used, or undefined. An empty YAML value (null)
// counts as not set.
export function configProblem(
	config: SkellyUltraCardConfig,
): string | undefined {
	const unset = (key: string) =>
		config[key] === undefined || config[key] === null;
	const text = (key: string) => unset(key) || typeof config[key] === "string";
	const flag = (key: string) => unset(key) || typeof config[key] === "boolean";
	if (!text("device_id")) {
		return "device_id must be text";
	}
	if (!text("tts_entity")) {
		return "tts_entity must be text";
	}
	if (!flag("show_tts") || !flag("show_files")) {
		return "show_tts and show_files must be true or false";
	}
	const max = config.max_files;
	if (
		!unset("max_files") &&
		(!Number.isInteger(max) ||
			(max as number) < 1 ||
			(max as number) > MAX_FILES_LIMIT)
	) {
		return `max_files must be a whole number from 1 to ${MAX_FILES_LIMIT}`;
	}
	return undefined;
}

// How long (in ms) a live mode that was turned on has to show as connected
export const LIVE_STATE_WAIT_MS = 2000;

// How often (in ms) to look again whether a Skelly that isn't live is set up
const KNOWN_RECHECK_MS = 30_000;

// The Skelly Ultra dashboard card: the Skelly's status and free space, a
// quick box to say something through it, and its first files in play order
// with play buttons. Everything else is in the Skelly panel.
export class SkellyUltraCard extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	// Set by HA while the card is shown in its editor
	@property({ type: Boolean }) preview = false;
	@state() private _config?: SkellyUltraCardConfig;
	@state() private _tts?: TtsChangeDetail;
	// The full text-to-speech form instead of only the message (admins)
	@state() private _ttsExpanded = false;
	// While a Say runs: the Skelly it's for (the editor can switch Skelly
	// meanwhile)
	@state() private _saying?: { deviceId: string };
	// While live mode is being switched: on which Skelly, and to what
	@state() private _liveSwitching?: { deviceId: string; on: boolean };
	@state() private _cancelling = false;
	// The file_index of a file whose Play or Stop runs
	@state() private _busyFile?: number;
	// Whether HA lists the configured Skelly: undefined until known
	@state() private _known?: boolean;
	// The Skelly last looked up, and when (Date.now())
	private _knownFor?: string;
	private _knownAt = 0;

	private readonly _files = new FilesSubscription(this);
	private readonly _playback = new PlaybackTracker(this, (name) =>
		showToast(this, strings.playNotStarted(name)),
	);

	// The card picker's preview and new cards: the first Skelly
	static async getStubConfig(
		hass: HomeAssistant,
	): Promise<Omit<SkellyUltraCardConfig, "type">> {
		try {
			const devices = await listDevices(hass);
			const device = devices.find((d) => d.device_id);
			return device?.device_id ? { device_id: device.device_id } : {};
		} catch {
			return {};
		}
	}

	static getConfigElement(): HTMLElement {
		return document.createElement(CARD_EDITOR_ELEMENT);
	}

	setConfig(config: SkellyUltraCardConfig): void {
		if (!config || typeof config !== "object") {
			throw new Error("Invalid configuration");
		}
		const problem = configProblem(config);
		if (problem) {
			throw new Error(problem);
		}
		this._config = config;
	}

	// Masonry dashboards: about 50 px per unit
	getCardSize(): number {
		if (!this._config) {
			return 1;
		}
		const config = withDefaults(this._config);
		return (
			1 +
			(config.show_tts ? 3 : 0) +
			(config.show_files ? Math.ceil(config.max_files / 2) + 1 : 0)
		);
	}

	// Sections dashboards: full width by default, at least half; the height
	// follows the content
	getGridOptions() {
		return { columns: 12, min_columns: 6 };
	}

	protected willUpdate(): void {
		const deviceId = this._config?.device_id ?? undefined;
		this._files.setTarget(
			deviceId ? this.hass : undefined,
			deviceId ? { device_id: deviceId } : {},
		);
		this._playback.follow(this._files.payload);
		if (this._files.status === "live") {
			this._known = true;
			this._knownFor = deviceId;
			this._knownAt = Date.now();
		} else if (
			deviceId &&
			this.hass &&
			(this._knownFor !== deviceId ||
				Date.now() - this._knownAt > KNOWN_RECHECK_MS)
		) {
			void this._checkKnown(this.hass, deviceId);
		}
		// No TTS box shown: what its last form said is gone with it
		if (
			!this._config ||
			!deviceId ||
			withDefaults(this._config).show_tts === false
		) {
			this._tts = undefined;
		}
	}

	// A Skelly that isn't loaded shows as reloading; this tells it apart
	// from one that isn't set up (or was removed)
	private async _checkKnown(hass: HomeAssistant, deviceId: string) {
		if (this._knownFor !== deviceId) {
			this._known = undefined;
		}
		this._knownFor = deviceId;
		this._knownAt = Date.now();
		try {
			const devices = await listDevices(hass);
			if (this._knownFor === deviceId && this._files.status !== "live") {
				this._known = devices.some((d) => d.device_id === deviceId);
			}
		} catch {
			// Not known either way
		}
	}

	static styles = [
		sharedStyles,
		css`
			ha-card {
				height: 100%;
				box-sizing: border-box;
				padding: 16px;
			}

			.header {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 4px 8px;
			}

			.name {
				font-size: 18px;
				font-weight: 500;
				color: var(--primary-text-color);
				text-decoration: none;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			a.name {
				color: var(--primary-color);
			}

			a.name:hover,
			a.name:focus-visible {
				text-decoration: underline;
			}

			.spacer {
				flex: 1;
			}

			.dot {
				flex: none;
				width: 10px;
				height: 10px;
				border-radius: 50%;
				background: var(--disabled-text-color, #999);
			}

			.dot.live {
				background: var(--success-color, #4caf50);
			}

			.dot.unavailable,
			.dot.reloading {
				background: var(--warning-color, #ffa600);
			}

			.dot.error {
				background: var(--error-color, #db4437);
			}

			.secondary,
			.hint {
				font-size: 14px;
			}

			.notice {
				margin: 12px 0 0;
				font-size: 14px;
				color: var(--secondary-text-color);
			}

			.notice.warning {
				color: var(--warning-color, #ffa600);
			}

			.notice.error {
				color: var(--error-color, #db4437);
			}

			section {
				margin-top: 16px;
			}

			.section-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				font-weight: 500;
			}

			.hint {
				margin: 4px 0 0;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.buttons {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				margin-top: 8px;
			}

			.buttons .reason {
				flex: 1 1 100%;
				margin: 0;
				text-align: right;
			}

			button {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
			}

			button.primary {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
				border-color: var(--primary-color);
			}

			button:disabled {
				cursor: default;
				color: var(--disabled-text-color, #999);
				background: transparent;
				border-color: var(--divider-color);
			}

			button.icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 4px;
				border: none;
				border-radius: 50%;
				color: var(--secondary-text-color);
			}

			button.live {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				padding: 2px 10px;
				border-radius: 16px;
				font-size: 13px;
				color: var(--secondary-text-color);
			}

			button.live[aria-checked="true"] {
				color: var(--primary-color);
				border-color: var(--primary-color);
			}

			button.live .dot {
				width: 8px;
				height: 8px;
			}

			button.icon[aria-expanded="true"] {
				color: var(--primary-color);
			}

			button.icon.play {
				color: var(--primary-color);
			}

			button.icon:disabled {
				color: var(--disabled-text-color, #999);
			}

			ul {
				list-style: none;
				margin: 8px 0 0;
				padding: 0;
			}

			li {
				display: flex;
				align-items: center;
				gap: 8px;
				min-height: 40px;
				border-top: 1px solid var(--divider-color);
			}

			li:first-child {
				border-top: none;
			}

			li .position {
				flex: none;
				min-width: 1.5em;
				text-align: right;
				color: var(--secondary-text-color);
			}

			li .file {
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			li.playing .file {
				color: var(--primary-color);
				font-weight: 500;
			}

			.num {
				font-variant-numeric: tabular-nums;
			}

			.remaining {
				font-size: 13px;
				color: var(--primary-color);
			}

			.manage {
				display: inline-block;
				margin-top: 8px;
				font-size: 14px;
			}
		`,
	];

	protected render() {
		const config = this._config;
		if (!config) {
			return nothing;
		}
		return html`<ha-card>${this._renderContent(withDefaults(config))}</ha-card>`;
	}

	private _renderContent(config: ReturnType<typeof withDefaults>) {
		if (!config.device_id) {
			return html`<div class="header">
					<span class="name">${strings.cardName}</span>
				</div>
				<p class="notice">${strings.cardNoDevice}</p>`;
		}
		const { status, error } = this._files;
		const payload = this._files.payload;
		const live = status === "live" && payload !== undefined;
		const available = live && payload.available;
		const transferring = payload?.transfer.in_progress === true;
		const reading = live && payload.refreshing;
		return html`
			${this._renderHeader(config.device_id, payload)}
			${
				status === "error"
					? html`<p class="notice error" role="alert">
							${error ?? strings.status.error}
						</p>`
					: status === "reloading"
						? html`<p class="notice warning">
								${this._known === false ? strings.cardUnknownDevice : strings.reloadingNotice}
							</p>`
						: live && !payload.available
							? html`<p class="notice warning">${strings.cardUnavailable}</p>`
							: nothing
			}
			${
				payload
					? html`<sk-transfer-bar
							.transfer=${payload.transfer}
							?cancelling=${this._cancelling}
							?disabled=${!available}
							@sk-cancel=${this._cancelTransfer}
						></sk-transfer-bar>`
					: nothing
			}
			${config.show_tts ? this._renderTts(config, payload, available, transferring, reading) : nothing}
			${config.show_files && payload ? this._renderFiles(config, payload, available, transferring, reading) : nothing}
		`;
	}

	private _renderHeader(deviceId: string, payload: FilesPayload | undefined) {
		const { status } = this._files;
		const live = status === "live" && payload !== undefined;
		const name = payload?.name ?? strings.cardName;
		const free = payload ? formatFree(payload.capacity.free_kb) : null;
		// Free space only while it's current
		const showFree = live && payload.available;
		const dot = live && !payload.available ? "unavailable" : status;
		const label =
			live && !payload.available ? strings.status.idle : strings.status[status];
		const href = this._panelHref(deviceId);
		return html`<div class="header">
			<span class="dot ${dot}" aria-hidden="true"></span>
			${
				href
					? html`<a
							class="name"
							href=${href}
							title=${strings.cardOpenPanel(name)}
							@click=${(ev: MouseEvent) => this._openPanel(ev, href)}
							>${name}</a
						>`
					: html`<span class="name">${name}</span>`
			}
			<span class="secondary">${label}</span>
			<span class="spacer"></span>
			${
				showFree
					? html`<span class="secondary">
							${free ? strings.freeSpace(free) : strings.freeSpaceUnknown}
						</span>`
					: nothing
			}
		</div>`;
	}

	// Live mode as HA shows it: missing (Say can't work: the speaker or
	// switch entity is disabled or gone), on (connected), connecting (the
	// switch is on, the speaker not connected yet) or off
	private _liveMode(
		payload: FilesPayload | undefined,
	): "missing" | "on" | "connecting" | "off" {
		const states = this.hass?.states ?? {};
		const speakerId = payload?.live_mode?.speaker_entity;
		const switchId = payload?.live_mode?.switch_entity;
		const speaker = speakerId ? states[speakerId] : undefined;
		const toggle = switchId ? states[switchId] : undefined;
		if (!speaker || !toggle) {
			return "missing";
		}
		if (speaker.state !== "unavailable" && speaker.state !== "unknown") {
			return "on";
		}
		return toggle.state === "on" ? "connecting" : "off";
	}

	// Why Say can't be used now, or undefined
	private _sayBlocked(
		available: boolean,
		transferring: boolean,
		reading: boolean,
		live: ReturnType<SkellyUltraCard["_liveMode"]>,
	): string | undefined {
		const status = this._files.status;
		if (status !== "live") {
			return status === "reloading" || status === "error"
				? strings.status[status]
				: strings.status.connecting;
		}
		if (!available) {
			return strings.cardNotConnected;
		}
		if (live === "missing") {
			return strings.cardLiveMissing;
		}
		// Turning live mode on sends commands; not in the middle of a file
		// transfer or a read of the files
		if (transferring && live !== "on") {
			return strings.cardBusyTransfer;
		}
		if (reading && live !== "on") {
			return strings.cardBusyReading;
		}
		// The form says once its engines are listed
		return this._tts ? this._tts.problem : strings.ttsLoading;
	}

	private _renderTts(
		config: ReturnType<typeof withDefaults>,
		payload: FilesPayload | undefined,
		available: boolean,
		transferring: boolean,
		reading: boolean,
	) {
		const admin = this.hass?.user?.is_admin === true;
		const expanded = admin && this._ttsExpanded;
		const switching =
			this._liveSwitching?.deviceId === config.device_id
				? this._liveSwitching
				: undefined;
		const saying = this._saying?.deviceId === config.device_id;
		let live = this._liveMode(payload);
		// Being turned on (the switch shows it once connected)
		if (live === "off" && switching?.on) {
			live = "connecting";
		}
		const why = this._sayBlocked(available, transferring, reading, live);
		// Not twice: the form says it already
		// (before its first change event, it shows that it's loading)
		const shownByForm =
			why !== undefined &&
			(this._tts
				? why === this._tts.problem && this._tts.problemShown === true
				: why === strings.ttsLoading);
		const hint =
			why === undefined && live === "off" && !saying
				? strings.cardLiveOffHint
				: undefined;
		const describedBy =
			why !== undefined && !shownByForm
				? "say-reason"
				: hint !== undefined
					? "say-hint"
					: undefined;
		return html`<section class="tts">
			<div class="section-head">
				<span>${strings.cardSay}</span>
				<span class="spacer"></span>
				${
					live !== "missing"
						? this._renderLiveToggle(
								live,
								!available || switching !== undefined || saying,
							)
						: nothing
				}
				${
					admin
						? html`<button
								class="icon more"
								title=${strings.cardMoreOptions}
								aria-label=${strings.cardMoreOptions}
								aria-expanded=${expanded ? "true" : "false"}
								aria-controls="tts-form"
								@click=${this._toggleTts}
							>
								<ha-icon icon="mdi:cog"></ha-icon>
							</button>`
						: nothing
				}
			</div>
			<sk-tts-form
				id="tts-form"
				.hass=${this.hass}
				.preferredEngine=${config.tts_entity}
				active
				entities-only
				?compact=${!expanded}
				?disabled=${saying}
				@sk-tts-change=${this._onTtsChange}
			></sk-tts-form>
			<div class="buttons">
				${
					why !== undefined
						? shownByForm
							? nothing
							: html`<p class="hint reason" id="say-reason">${why}</p>`
						: hint !== undefined
							? html`<p class="hint reason" id="say-hint">${hint}</p>`
							: nothing
				}
				<button
					class="say primary"
					title=${strings.cardSayTitle}
					aria-describedby=${describedBy ?? nothing}
					?disabled=${why !== undefined || saying || switching !== undefined}
					@click=${this._say}
				>
					${
						saying
							? live === "on"
								? strings.cardSaying
								: strings.cardLiveConnecting
							: strings.cardSayButton
					}
				</button>
			</div>
		</section>`;
	}

	// The live mode switch, with its state
	private _renderLiveToggle(
		live: "on" | "connecting" | "off",
		disabled: boolean,
	) {
		const on = live !== "off";
		const label =
			live === "on"
				? strings.cardLiveOn
				: live === "connecting"
					? strings.cardLiveWait
					: strings.cardLiveOff;
		return html`<button
			class="live ${live}"
			role="switch"
			aria-checked=${on ? "true" : "false"}
			title=${label}
			aria-label=${strings.cardLive}
			aria-busy=${live === "connecting" ? "true" : "false"}
			?disabled=${disabled}
			@click=${() => this._switchLive(!on)}
		>
			<span class="dot ${live === "on" ? "live" : live === "connecting" ? "reloading" : ""}" aria-hidden="true"></span>
			${strings.cardLive}
		</button>`;
	}

	private _renderFiles(
		config: ReturnType<typeof withDefaults>,
		payload: FilesPayload,
		available: boolean,
		transferring: boolean,
		reading: boolean,
	) {
		const rows = orderedFiles(payload)
			.filter((row) => row.position !== null)
			.slice(0, config.max_files);
		const playingIndex = this._playback.playingIndex(payload);
		const remaining = this._playback.remaining(payload);
		const href = config.device_id
			? this._panelHref(config.device_id)
			: undefined;
		return html`<section class="files">
			${
				rows.length
					? html`<ul>
							${rows.map(({ file, position }) => {
								const playing = file.file_index === playingIndex;
								const left =
									playing && remaining !== null
										? strings.remaining(remaining)
										: undefined;
								const label = playing ? strings.stop : strings.play;
								return html`<li class=${playing ? "playing" : ""}>
									<span class="position num">${position}</span>
									<span class="file" title=${file.name}>${file.name}</span>
									${
										left !== undefined
											? html`<span class="remaining num" aria-hidden="true">${left}</span>`
											: nothing
									}
									<button
										class="icon ${playing ? "stop" : "play"}"
										title=${playing && left !== undefined ? strings.stopRemaining(left) : label}
										aria-label=${`${label} ${file.name}`}
										?disabled=${
											this._busyFile !== undefined ||
											!available ||
											(!playing && (transferring || reading))
										}
										@click=${() => (playing ? this._stop(file) : this._play(file))}
									>
										<ha-icon icon=${playing ? "mdi:stop" : "mdi:play"}></ha-icon>
									</button>
								</li>`;
							})}
						</ul>`
					: html`<p class="notice">${strings.cardNoFiles}</p>`
			}
			${
				href
					? html`<a
							class="manage"
							href=${href}
							@click=${(ev: MouseEvent) => this._openPanel(ev, href)}
							>${strings.cardManage} <span aria-hidden="true">→</span></a
						>`
					: nothing
			}
		</section>`;
	}

	// The Skelly panel's URL for this Skelly, if the panel is shown (it can
	// be turned off in the integration's options)
	private _panelHref(deviceId: string): string | undefined {
		// Not from the editor's preview, which would leave the editor
		return !this.preview && this.hass?.panels?.[PANEL_URL_PATH]
			? `/${PANEL_URL_PATH}?device=${encodeURIComponent(deviceId)}`
			: undefined;
	}

	private _openPanel(ev: MouseEvent, href: string) {
		// A new tab or window as the browser does it
		if (
			ev.button !== 0 ||
			ev.ctrlKey ||
			ev.metaKey ||
			ev.shiftKey ||
			ev.altKey
		) {
			return;
		}
		ev.preventDefault();
		navigate(href);
	}

	private get _target(): ActionTarget | undefined {
		const deviceId = this._config?.device_id ?? undefined;
		return deviceId ? { device_id: deviceId } : undefined;
	}

	private get _ttsForm(): SkTtsForm | null {
		return this.renderRoot.querySelector("sk-tts-form");
	}

	private _toggleTts() {
		this._ttsExpanded = !this._ttsExpanded;
	}

	private _onTtsChange(ev: CustomEvent<TtsChangeDetail>) {
		this._tts = ev.detail;
	}

	private async _say() {
		const hass = this.hass;
		const target = this._target;
		const form = this._ttsForm;
		// The form's speech as it is now
		const speech = form?.speech;
		if (
			!hass ||
			!target ||
			!speech ||
			this._saying?.deviceId === target.device_id
		) {
			return;
		}
		const saying = { deviceId: target.device_id };
		this._saying = saying;
		// Still the same Skelly once it's done (the editor can switch)
		const same = () => this._target?.device_id === target.device_id;
		try {
			const result = await sayLive(hass, target, speech);
			if (result?.status === "busy" && same()) {
				showToast(this, strings.cardSayBusy);
			}
			if (result?.status === "busy") {
				return;
			}
		} catch (err) {
			if (same()) {
				showToast(this, strings.cardSayFailed(errorMessage(err)));
			}
			return;
		} finally {
			if (this._saying === saying) {
				this._saying = undefined;
			}
		}
		if (same()) {
			form?.clearMessage();
		}
	}

	private async _switchLive(on: boolean) {
		const hass = this.hass;
		const deviceId = this._config?.device_id ?? undefined;
		const entityId = this._files.payload?.live_mode?.switch_entity;
		if (
			!hass ||
			!deviceId ||
			!entityId ||
			this._liveSwitching?.deviceId === deviceId
		) {
			return;
		}
		const switching = { deviceId, on };
		this._liveSwitching = switching;
		const same = () => this._config?.device_id === deviceId;
		try {
			await hass.callService(
				"switch",
				on ? "turn_on" : "turn_off",
				{ entity_id: entityId },
				undefined,
				false,
				false,
			);
			// The switch doesn't fail when live mode doesn't connect; the
			// speaker shows whether it did, once HA has sent its state
			if (on && !(await this._liveConnected()) && same()) {
				showToast(this, strings.cardLiveNotConnected);
			}
		} catch (err) {
			if (same()) {
				showToast(this, strings.cardLiveFailed(errorMessage(err)));
			}
		} finally {
			if (this._liveSwitching === switching) {
				this._liveSwitching = undefined;
			}
		}
	}

	// Whether live mode shows as connected within LIVE_STATE_WAIT_MS
	private async _liveConnected(): Promise<boolean> {
		const until = Date.now() + LIVE_STATE_WAIT_MS;
		while (this._liveMode(this._files.payload) !== "on") {
			if (Date.now() >= until || !this.isConnected) {
				return false;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		return true;
	}

	private async _play(file: FileRef) {
		const hass = this.hass;
		const target = this._target;
		const entryId = this._files.payload?.entry_id;
		if (!hass || !target || !entryId || this._busyFile !== undefined) {
			return;
		}
		const seen = this._playback.seen;
		this._busyFile = file.file_index;
		try {
			await playFile(hass, target, file.file_index);
		} catch (err) {
			showToast(this, strings.playFailed(file.name, errorMessage(err)));
			return;
		} finally {
			this._busyFile = undefined;
		}
		// Another Skelly by now (the editor): its playback isn't this one's
		if (this.isConnected && this._files.payload?.entry_id === entryId) {
			this._playback.started(entryId, file, seen);
		}
	}

	private async _stop(file: FileRef) {
		const hass = this.hass;
		const target = this._target;
		const entryId = this._files.payload?.entry_id;
		if (!hass || !target || !entryId || this._busyFile !== undefined) {
			return;
		}
		this._busyFile = file.file_index;
		try {
			await stopFile(hass, target, file.file_index);
			this._playback.clear(entryId, file.file_index);
		} catch (err) {
			showToast(this, strings.stopFailed(file.name, errorMessage(err)));
		} finally {
			this._busyFile = undefined;
		}
	}

	private async _cancelTransfer() {
		const hass = this.hass;
		const target = this._target;
		if (!hass || !target || this._cancelling) {
			return;
		}
		this._cancelling = true;
		try {
			await cancelTransfer(hass, target);
		} catch (err) {
			showToast(this, strings.transferCancelFailed(errorMessage(err)));
		} finally {
			this._cancelling = false;
		}
	}
}

export const CARD_PICKER_ENTRY = {
	type: CARD_ELEMENT,
	name: strings.cardName,
	description: strings.cardDescription,
	preview: true,
	documentationURL: "https://github.com/martinecker/SkellyUltra",
};
