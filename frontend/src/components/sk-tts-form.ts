import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";
import { errorMessage } from "../api/actions";
import {
	listEngines,
	listVoices,
	loadChoice,
	type OptionsProblem,
	type ParsedOptions,
	pickLanguage,
	previewSpeech,
	saveChoice,
	speechOptions,
	type TtsEngine,
	type TtsSpeech,
	type TtsVoice,
	yamlOptions,
} from "../api/tts";
import type { HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

// Detail of sk-tts-change: the speech to send, or why there's none yet
export interface TtsChangeDetail {
	speech?: TtsSpeech;
	problem?: string;
	message: string;
}

const YAML_EDITOR = "ha-yaml-editor";
let yamlEditorLoad: Promise<void> | undefined;

// HA's YAML editor, the one its automation and script editors use, is part
// of HA's frontend. Newer versions have it loaded already; otherwise an
// object selector, which uses it, loads it. Resolves once it's there, or
// after a while without it.
function loadYamlEditor(hass: HomeAssistant): Promise<void> {
	if (customElements.get(YAML_EDITOR)) {
		return Promise.resolve();
	}
	if (!yamlEditorLoad) {
		const loader = customElements.get("ha-selector")
			? Object.assign(document.createElement("ha-selector"), {
					hass,
					selector: { object: {} },
				})
			: undefined;
		if (loader) {
			loader.hidden = true;
			document.body.append(loader);
		}
		yamlEditorLoad = Promise.race([
			customElements.whenDefined(YAML_EDITOR).then(() => undefined),
			new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
		]).finally(() => loader?.remove());
	}
	return yamlEditorLoad;
}

interface YamlEditorChange {
	value: unknown;
	isValid: boolean;
}

// The text-to-speech inputs: engine, language, voice, extra options and the
// message, with a preview. Fires sk-tts-change whenever they change.
export class SkTtsForm extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean }) disabled = false;
	// Shown: the engines are listed the first time it is
	@property({ type: Boolean }) active = false;

	// undefined while loading
	@state() private _engines?: TtsEngine[];
	@state() private _loadError?: string;
	@state() private _engine?: string;
	@state() private _language?: string;
	@state() private _voices: TtsVoice[] = [];
	@state() private _voice = "";
	@state() private _voicesLoading = false;
	@state() private _message = "";
	// Parsed by HA's YAML editor; undefined until it is typed in
	@state() private _yamlOptions?: ParsedOptions;
	// HA's YAML editor is there, or "missing" if it didn't load
	@state() private _yamlEditor: boolean | "missing" =
		!!customElements.get(YAML_EDITOR);
	@state() private _advancedOpen = false;
	// HA's YAML editor was asked to load
	private _yamlEditorWait = false;
	// Bumped to start the YAML editor over empty
	private _yamlEditorRun = 0;
	@state() private _previewing = false;
	@state() private _previewSrc?: string;
	@state() private _previewError?: string;
	// The speech last previewed, so the same one isn't requested again
	private _previewed?: string;
	private _previewAbort?: AbortController;
	private _loading = false;
	// Counts voice requests, so a late answer for an old choice is dropped
	private _voicesRequest = 0;

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			label.field {
				display: block;
				margin: 16px 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				gap: 8px 12px;
			}

			.row > div {
				flex: 1 1 160px;
				min-width: 0;
			}

			select,
			textarea {
				box-sizing: border-box;
				width: 100%;
				font: inherit;
				font-size: 16px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 8px;
			}

			textarea {
				resize: vertical;
			}

			details {
				margin-top: 12px;
			}

			ha-yaml-editor.locked {
				opacity: 0.6;
				pointer-events: none;
			}

			summary {
				font-size: 14px;
				color: var(--secondary-text-color);
				cursor: pointer;
			}

			.hint {
				margin: 4px 0 0;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.problem,
			.error {
				color: var(--error-color, #db4437);
			}

			.preview {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				margin-top: 12px;
			}

			.preview button {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
			}

			.preview button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			audio {
				width: 100%;
				max-width: 320px;
				height: 36px;
			}
		`,
	];

	// Starts over with an empty message (the remembered engine, language
	// and voice stay). The engines are listed again when next shown, so
	// new ones appear and a failed listing is retried.
	reset(): void {
		this.stopPreview();
		this._message = "";
		this._yamlOptions = undefined;
		this._yamlEditorRun++;
		this._advancedOpen = false;
		this._previewError = undefined;
		this._previewed = undefined;
		if (!this._loading) {
			this._engines = undefined;
			this._loadError = undefined;
		}
		this._changed();
	}

	// Stops a preview being made or played (the dialog closed)
	stopPreview(): void {
		this.pausePreview();
		this._previewSrc = undefined;
	}

	// Calls off a preview being made and pauses one playing, keeping it to
	// play again (another tab is shown)
	pausePreview(): void {
		this._previewAbort?.abort();
		this._previewAbort = undefined;
		this._previewing = false;
		this.renderRoot.querySelector("audio")?.pause();
	}

	protected willUpdate(): void {
		if (this.active && this.hass && this._engines === undefined) {
			void this._loadEngines();
		}
		if (this.active && this.hass && !this._yamlEditor) {
			if (customElements.get(YAML_EDITOR)) {
				this._yamlEditor = true;
			} else if (!this._yamlEditorWait) {
				this._yamlEditorWait = true;
				void loadYamlEditor(this.hass).then(() => {
					this._yamlEditor = customElements.get(YAML_EDITOR) ? true : "missing";
				});
			}
		}
	}

	// The select values are set after their options exist
	protected updated(): void {
		for (const [selector, value] of [
			["select.engine", this._engine],
			["select.language", this._language],
			["select.voice", this._voice],
		] as const) {
			const select = this.renderRoot.querySelector<HTMLSelectElement>(selector);
			if (select && value !== undefined && select.value !== value) {
				select.value = value;
			}
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.stopPreview();
	}

	private async _loadEngines() {
		const hass = this.hass;
		if (!hass || this._loading) {
			return;
		}
		this._loading = true;
		this._loadError = undefined;
		try {
			const engines = await listEngines(hass);
			const choice = loadChoice(hass.user?.id);
			const engine =
				engines.find((e) => e.engine_id === choice.engine) ?? engines[0];
			this._engines = engines;
			if (engine) {
				this._selectEngine(engine, choice);
			} else {
				this._voicesRequest++; // An answer still coming is for an old engine
				this._voicesLoading = false;
				this._engine = undefined;
				this._language = undefined;
				this._voices = [];
				this._voice = "";
			}
		} catch (err) {
			this._engines = [];
			this._loadError = strings.ttsLoadFailed(errorMessage(err));
		} finally {
			this._loading = false;
			this._changed();
		}
	}

	private _selectEngine(
		engine: TtsEngine,
		choice: { language?: string; voice?: string } = {},
	) {
		this._engine = engine.engine_id;
		this._language = pickLanguage(
			engine.languages,
			[choice.language, this.hass?.language],
			this.hass?.config?.country ?? undefined,
		);
		void this._loadVoices(choice.voice);
	}

	private async _loadVoices(voice?: string) {
		const hass = this.hass;
		const engine = this._engine;
		const language = this._language;
		const request = ++this._voicesRequest;
		this._voices = [];
		this._voice = "";
		if (!hass || !engine || !language) {
			this._voicesLoading = false;
			this._changed();
			return;
		}
		this._voicesLoading = true;
		this._changed();
		let voices: TtsVoice[] = [];
		try {
			voices = await listVoices(hass, engine, language);
		} catch {
			// No voices to pick from: the engine's default is used
		}
		if (request !== this._voicesRequest) {
			return;
		}
		this._voicesLoading = false;
		this._voices = voices;
		this._voice = voices.some((v) => v.voice_id === voice) ? (voice ?? "") : "";
		this._remember();
		this._changed();
	}

	private get _currentEngine(): TtsEngine | undefined {
		return this._engines?.find((e) => e.engine_id === this._engine);
	}

	protected render() {
		const engines = this._engines;
		if (engines === undefined) {
			return html`<p class="hint">${strings.ttsLoading}</p>`;
		}
		if (this._loadError) {
			return html`<p class="error" role="alert">${this._loadError}</p>`;
		}
		if (!engines.length) {
			return html`<p class="hint">${strings.ttsNoEngines}</p>`;
		}
		const engine = this._currentEngine;
		const languages = engine?.languages ?? [];
		const parsed = this._options();
		const optionsProblem = "problem" in parsed ? parsed.problem : undefined;
		const speech = this.speech;
		return html`
			<div class="row">
				<div>
					<label class="field" for="engine">${strings.ttsEngine}</label>
					<select
						id="engine"
						class="engine"
						?disabled=${this.disabled}
						@change=${this._onEngine}
					>
						${engines.map(
							(e) => html`<option
								value=${e.engine_id}
								?selected=${e.engine_id === this._engine}
							>
								${e.name}
							</option>`,
						)}
					</select>
				</div>
				${
					languages.length
						? html`<div>
								<label class="field" for="language">${strings.ttsLanguage}</label>
								<select
									id="language"
									class="language"
									?disabled=${this.disabled}
									@change=${this._onLanguage}
								>
									${languages.map(
										(l) => html`<option
											value=${l}
											?selected=${l === this._language}
										>
											${l}
										</option>`,
									)}
								</select>
							</div>`
						: nothing
				}
				${
					this._voices.length
						? html`<div>
								<label class="field" for="voice">${strings.ttsVoice}</label>
								<select
									id="voice"
									class="voice"
									?disabled=${this.disabled}
									@change=${this._onVoice}
								>
									<option value="" ?selected=${this._voice === ""}>
										${strings.ttsVoiceDefault}
									</option>
									${this._voices.map(
										(v) => html`<option
											value=${v.voice_id}
											?selected=${v.voice_id === this._voice}
										>
											${v.name}
										</option>`,
									)}
								</select>
							</div>`
						: nothing
				}
			</div>
			<label class="field" for="message">${strings.ttsMessage}</label>
			<textarea
				id="message"
				class="message"
				rows="3"
				.value=${live(this._message)}
				?disabled=${this.disabled}
				@input=${this._onMessage}
			></textarea>
			<details ?open=${this._advancedOpen} @toggle=${this._onToggleAdvanced}>
				<summary>${strings.ttsAdvanced}</summary>
				${
					this._yamlEditor === true
						? this._renderYamlEditor()
						: html`<p class="hint">
								${
									this._yamlEditor === "missing"
										? strings.ttsOptionsEditorMissing
										: strings.ttsOptionsEditorLoading
								}
							</p>`
				}
				<p
					id="options-hint"
					class="hint ${optionsProblem ? "problem" : ""}"
				>
					${optionsProblem || this._yamlEditor !== true ? nothing : strings.ttsOptionsHint}
					<span role="status"
						>${optionsProblem ? optionsMessage(optionsProblem) : nothing}</span
					>
				</p>
			</details>
			<div class="preview">
				<button
					class="preview-button"
					title=${strings.ttsPreviewTitle}
					?disabled=${
						this.disabled ||
						this._previewing ||
						!speech ||
						this._previewed === JSON.stringify(speech)
					}
					aria-describedby="preview-note"
					@click=${this._preview}
				>
					<ha-icon icon="mdi:play-circle-outline"></ha-icon>
					${this._previewing ? strings.ttsPreviewing : strings.ttsPreview}
				</button>
				${
					this._previewSrc
						? html`<audio
								controls
								autoplay
								aria-label=${strings.ttsPreview}
								src=${this._previewSrc}
								@error=${this._onPreviewAudioError}
							></audio>`
						: nothing
				}
			</div>
			<p class="hint" id="preview-note">${strings.ttsPreviewNote}</p>
			${
				this._previewError
					? html`<p class="error" role="alert">${this._previewError}</p>`
					: nothing
			}
		`;
	}

	private _renderYamlEditor() {
		return keyed(
			this._yamlEditorRun,
			html`<ha-yaml-editor
				class="options ${this.disabled ? "locked" : ""}"
				.hass=${this.hass}
				.readOnly=${this.disabled}
				in-dialog
				disable-fullscreen
				@value-changed=${this._onYamlOptions}
			></ha-yaml-editor>`,
		);
	}

	// The extra options; none until they're typed
	private _options(): ParsedOptions {
		return this._yamlOptions ?? { options: {} };
	}

	// The speech to send, if everything needed is there
	get speech(): TtsSpeech | undefined {
		return this._problem() === undefined ? this._speech() : undefined;
	}

	private _speech(): TtsSpeech | undefined {
		const parsed = this._options();
		if (!this._engine || "problem" in parsed) {
			return undefined;
		}
		const message = this._message.trim();
		const options = speechOptions(this._voice || undefined, parsed.options);
		return {
			tts_entity: this._engine,
			message,
			...(this._language ? { language: this._language } : {}),
			...(options ? { tts_options: options } : {}),
		};
	}

	// Why there's nothing to send yet
	private _problem(): string | undefined {
		if (this._engines === undefined) {
			return strings.ttsLoading;
		}
		if (this._loadError) {
			return this._loadError;
		}
		if (!this._engine) {
			return strings.ttsNoEngines;
		}
		if (this._voicesLoading) {
			return strings.ttsVoicesLoading;
		}
		if (!this._message.trim()) {
			return strings.ttsNoMessage;
		}
		const parsed = this._options();
		if ("problem" in parsed) {
			return optionsMessage(parsed.problem);
		}
		return undefined;
	}

	private _changed() {
		const problem = this._problem();
		this.dispatchEvent(
			new CustomEvent<TtsChangeDetail>("sk-tts-change", {
				detail: {
					speech: problem === undefined ? this._speech() : undefined,
					problem,
					message: this._message,
				},
				bubbles: true,
				composed: true,
			}),
		);
	}

	private _remember() {
		saveChoice(this.hass?.user?.id, {
			engine: this._engine,
			language: this._language,
			voice: this._voice || undefined,
		});
	}

	private _onEngine(ev: Event) {
		const id = (ev.target as HTMLSelectElement).value;
		const engine = this._engines?.find((e) => e.engine_id === id);
		if (engine) {
			// The language just used, if this engine has it too
			this._selectEngine(engine, { language: this._language });
			this._remember();
		}
		this._changed();
	}

	private _onLanguage(ev: Event) {
		this._language = (ev.target as HTMLSelectElement).value;
		void this._loadVoices(this._voice);
		this._remember();
		this._changed();
	}

	private _onVoice(ev: Event) {
		this._voice = (ev.target as HTMLSelectElement).value;
		this._remember();
		this._changed();
	}

	private _onMessage(ev: Event) {
		this._message = (ev.target as HTMLTextAreaElement).value;
		this._changed();
	}

	private _onToggleAdvanced(ev: Event) {
		this._advancedOpen = (ev.target as HTMLDetailsElement).open;
	}

	private _onYamlOptions(ev: CustomEvent<YamlEditorChange>) {
		// HA's dialogs and forms listen for value-changed too
		ev.stopPropagation();
		this._yamlOptions = yamlOptions(ev.detail.value, ev.detail.isValid);
		this._changed();
	}

	// HA starts the speech after answering, so the engine's errors (quota,
	// sign-in) only show as audio that doesn't load
	private _onPreviewAudioError() {
		this._previewSrc = undefined;
		this._previewed = undefined;
		this._previewError = strings.ttsPreviewFailed(strings.ttsPreviewNoAudio);
	}

	private async _preview() {
		const hass = this.hass;
		const speech = this.speech;
		if (!hass || !speech || this._previewing) {
			return;
		}
		const abort = new AbortController();
		this._previewAbort = abort;
		this._previewing = true;
		this._previewError = undefined;
		const key = JSON.stringify(speech);
		try {
			const path = await previewSpeech(hass, speech, abort.signal);
			if (!abort.signal.aborted) {
				this._previewSrc = path;
				this._previewed = key;
			}
		} catch (err) {
			if (!abort.signal.aborted) {
				this._previewError = strings.ttsPreviewFailed(errorMessage(err));
			}
		} finally {
			if (this._previewAbort === abort) {
				this._previewAbort = undefined;
				this._previewing = false;
			}
		}
	}
}

function optionsMessage(problem: OptionsProblem): string {
	return problem === "yaml"
		? strings.ttsOptionsYaml
		: strings.ttsOptionsMapping;
}
