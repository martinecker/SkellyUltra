import { css, html, LitElement, nothing } from "lit";
import { property, query, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { errorMessage } from "../api/actions";
import {
	EXTENSION,
	filenameOf,
	filenameProblem,
	httpUrl,
	isHttpUrl,
	nameLength,
	suggestStem,
	urlFileName,
} from "../api/filename";
import {
	MAX_UPLOAD_BYTES,
	type MediaItem,
	UploadError,
	type UploadProblem,
	uploadMedia,
	uploadProblem,
} from "../api/media";
import type { DeviceProfile, FileEntry } from "../api/types";
import type { HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";
import type { MediaPickDetail } from "./sk-media-browser";

// What to send to the Skelly: a file_path for send_file and the name to
// store it under
export interface SendRequest {
	filePath: string;
	filename: string;
}

// Starts sending; the dialog is closed by then. Progress and the result are
// the panel's business.
export type SendHandler = (request: SendRequest) => void;

export type AddFileTab = "upload" | "media" | "url";

const formatSize = (bytes: number): string =>
	bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const uploadMessage = (problem: UploadProblem): string =>
	problem === "type"
		? strings.uploadType
		: problem === "name"
			? strings.uploadName
			: strings.uploadSize(formatSize(MAX_UPLOAD_BYTES));

// Picks a new file for the Skelly, from an upload, HA's media library or a
// URL, with the name to store it under, in a native modal <dialog>. Send
// uploads the file first if needed, then calls `send` and closes.
export class SkAddFileDialog extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ attribute: false }) profile?: DeviceProfile;
	// The Skelly's files, to warn before replacing one
	@property({ attribute: false }) files: FileEntry[] = [];
	// Media source ID of the upload folder; null if HA has none
	@property({ attribute: false }) uploadTarget?: string | null;
	// Why sending isn't possible right now (e.g. a transfer is running)
	@property({ attribute: false }) readOnlyReason?: string;
	@property({ attribute: false }) send?: SendHandler;

	@state() private _tab: AddFileTab = "media";
	@state() private _stem = "";
	// The stem last filled in from a source; replaced by the next source's
	// unless the user changed it
	@state() private _suggested = "";
	@state() private _file?: File;
	@state() private _url = "";
	@state() private _media?: MediaItem;
	@state() private _uploading = false;
	@state() private _error?: string;
	@state() private _dragOver = false;
	private _abort?: AbortController;

	@query("dialog") private _dialog?: HTMLDialogElement;

	static styles = [
		sharedStyles,
		css`
			dialog {
				box-sizing: border-box;
				width: min(560px, calc(100vw - 32px));
				max-height: calc(100vh - 32px);
				padding: 0;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog[open] {
				display: flex;
				flex-direction: column;
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			@media (max-width: 600px) {
				dialog {
					width: 100vw;
					max-width: 100vw;
					height: 100%;
					max-height: 100%;
					margin: 0;
					border-radius: 0;
				}
			}

			header {
				padding: 20px 24px 0;
			}

			h2 {
				margin: 0;
				font-size: 20px;
				font-weight: 500;
			}

			[role="tablist"] {
				display: flex;
				gap: 4px;
				margin-top: 12px;
				border-bottom: 1px solid var(--divider-color);
			}

			[role="tab"] {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				padding: 8px 12px;
				cursor: pointer;
			}

			[role="tab"][aria-selected="true"] {
				color: var(--primary-color);
				border-bottom-color: var(--primary-color);
			}

			.body {
				flex: 1;
				overflow: auto;
				padding: 16px 24px 8px;
			}

			label.field {
				display: block;
				margin: 16px 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.name {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			input[type="text"],
			input[type="url"] {
				box-sizing: border-box;
				flex: 1;
				width: 100%;
				min-width: 0;
				font: inherit;
				font-size: 16px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 8px;
			}

			input[aria-invalid="true"] {
				border-color: var(--error-color, #db4437);
			}

			.hint {
				display: flex;
				gap: 8px;
				margin-top: 4px;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.hint .text {
				flex: 1;
			}

			.hint .counter {
				font-variant-numeric: tabular-nums;
			}

			.problem,
			.error {
				color: var(--error-color, #db4437);
			}

			.warning {
				color: var(--warning-color, #ffa600);
			}

			.notice {
				margin: 8px 0;
				font-size: 14px;
			}

			.drop {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 8px;
				min-height: 120px;
				padding: 16px;
				text-align: center;
				border: 2px dashed var(--divider-color);
				border-radius: 8px;
				cursor: pointer;
			}

			.drop.over {
				border-color: var(--primary-color);
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
			}

			.drop input {
				position: absolute;
				width: 1px;
				height: 1px;
				opacity: 0;
			}

			.drop:focus-within {
				outline: 2px solid var(--primary-color);
				outline-offset: 2px;
			}

			.chosen {
				font-weight: 500;
				word-break: break-word;
			}

			footer {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				padding: 12px 24px 16px;
				border-top: 1px solid var(--divider-color);
			}

			footer .reason {
				flex: 1;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			footer button {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 8px 12px;
				cursor: pointer;
			}

			footer button:hover:not(:disabled) {
				background: var(--secondary-background-color);
			}

			footer button.send {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
			}

			footer button:disabled {
				color: var(--disabled-text-color, #999);
				background: transparent;
				cursor: default;
			}
		`,
	];

	// Upload is for admins only: HA's upload API requires it
	private get _canUpload(): boolean {
		return this.hass?.user?.is_admin === true;
	}

	private get _tabs(): AddFileTab[] {
		return this._canUpload ? ["upload", "media", "url"] : ["media", "url"];
	}

	// Opens the dialog with nothing picked yet
	async open(): Promise<void> {
		this._abort?.abort();
		this._tab = this._canUpload && this.uploadTarget ? "upload" : "media";
		this._stem = "";
		this._suggested = "";
		this._file = undefined;
		this._url = "";
		this._media = undefined;
		this._uploading = false;
		this._error = undefined;
		this._dragOver = false;
		await this.updateComplete;
		if (this._dialog && !this._dialog.open) {
			this._dialog.showModal();
		}
	}

	get isOpen(): boolean {
		return this._dialog?.open ?? false;
	}

	close(): void {
		// An upload still running is called off
		this._abort?.abort();
		this._abort = undefined;
		if (this._dialog?.open) {
			this._dialog.close();
		}
	}

	protected render() {
		return html`
			<dialog aria-labelledby="title" @close=${this._onClose}>
				${this._renderContent()}
			</dialog>
		`;
	}

	private _renderContent() {
		const profile = this.profile;
		if (!profile) {
			return nothing;
		}
		const tabs = this._tabs;
		const tab = tabs.includes(this._tab) ? this._tab : tabs[0];
		const blocked = this._blockedReason(profile, tab);
		return html`
			<header>
				<h2 id="title">${strings.addDialogTitle}</h2>
				<div role="tablist">
					${tabs.map(
						(t) => html`<button
							role="tab"
							id="tab-${t}"
							aria-selected=${t === tab ? "true" : "false"}
							aria-controls="panel"
							?disabled=${this._uploading}
							@click=${() => this._selectTab(t)}
						>
							${this._tabLabel(t)}
						</button>`,
					)}
				</div>
			</header>
			<div class="body" id="panel" role="tabpanel" aria-labelledby="tab-${tab}">
				${this._renderSource(tab)}
				${this._renderName(profile)}
				${
					this._error
						? html`<p class="notice error" role="alert">${this._error}</p>`
						: nothing
				}
			</div>
			<footer>
				<span class="reason">${this._uploading ? strings.uploading : (this.readOnlyReason ?? "")}</span>
				<button class="cancel" @click=${this.close}>${strings.cancel}</button>
				<button
					class="send"
					title=${blocked ?? strings.send}
					?disabled=${blocked !== undefined}
					@click=${() => this._send(tab)}
				>
					${this._uploading ? strings.uploading : strings.send}
				</button>
			</footer>
		`;
	}

	private _tabLabel(tab: AddFileTab): string {
		return tab === "upload"
			? strings.tabUpload
			: tab === "media"
				? strings.tabMedia
				: strings.tabUrl;
	}

	private _renderSource(tab: AddFileTab) {
		if (tab === "upload") {
			return this._renderUpload();
		}
		if (tab === "media") {
			return html`<sk-media-browser
				.hass=${this.hass}
				.selected=${this._media?.media_content_id}
				@sk-media-pick=${this._onMediaPick}
			></sk-media-browser>`;
		}
		const invalid = this._url.trim() !== "" && !isHttpUrl(this._url);
		return html`
			<label class="field" for="url">${strings.urlLabel}</label>
			<input
				id="url"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="https://"
				aria-invalid=${invalid ? "true" : "false"}
				aria-describedby="url-hint"
				.value=${live(this._url)}
				@input=${this._onUrlInput}
			/>
			<div class="hint" id="url-hint">
				<span class="text problem">${invalid ? strings.urlInvalid : ""}</span>
			</div>
		`;
	}

	private _renderUpload() {
		if (!this.uploadTarget) {
			return html`<p class="notice warning">${strings.uploadNoFolder}</p>`;
		}
		const file = this._file;
		const problem = file ? uploadProblem(file) : undefined;
		return html`
			<label
				class="drop ${this._dragOver ? "over" : ""}"
				@dragover=${this._onDragOver}
				@dragleave=${this._onDragLeave}
				@drop=${this._onDrop}
			>
				<ha-icon icon="mdi:upload"></ha-icon>
				<span>${strings.uploadChoose}</span>
				${
					file
						? html`<span class="chosen">
								${strings.uploadChosen(file.name, formatSize(file.size))}
							</span>`
						: nothing
				}
				<input
					type="file"
					accept="audio/*"
					?disabled=${this._uploading}
					@change=${this._onFileInput}
				/>
			</label>
			${
				problem
					? html`<p class="notice problem" role="alert">
							${uploadMessage(problem)}
						</p>`
					: html`<p class="notice secondary">${strings.uploadSaved}</p>`
			}
		`;
	}

	private _renderName(profile: DeviceProfile) {
		const max = profile.max_filename_length;
		const name = filenameOf(this._stem);
		const problem =
			this._stem === "" ? undefined : filenameProblem(this._stem, max);
		const replaces =
			problem === undefined &&
			this._stem !== "" &&
			this.files.some((f) => f.name === name);
		const message =
			problem === "slash"
				? strings.filenameSlash
				: problem === "long"
					? strings.filenameLong(max)
					: problem === "empty"
						? strings.filenameEmpty
						: replaces
							? strings.filenameReplaces
							: "";
		return html`
			<label class="field" for="name">${strings.filenameLabel}</label>
			<div class="name">
				<input
					id="name"
					type="text"
					autocomplete="off"
					spellcheck="false"
					aria-invalid=${problem ? "true" : "false"}
					aria-describedby="name-hint"
					.value=${live(this._stem)}
					?disabled=${this._uploading}
					@input=${this._onNameInput}
				/>
				<span aria-hidden="true">${EXTENSION}</span>
			</div>
			<div class="hint" id="name-hint">
				<span class="text ${problem ? "problem" : replaces ? "warning" : ""}"
					>${message}</span
				>
				<span class="counter">${nameLength(name)} / ${max}</span>
			</div>
		`;
	}

	// Why Send can't be pressed, or undefined if it can
	private _blockedReason(
		profile: DeviceProfile,
		tab: AddFileTab,
	): string | undefined {
		if (this._uploading) {
			return strings.uploading;
		}
		if (this.readOnlyReason) {
			return this.readOnlyReason;
		}
		if (tab === "upload") {
			if (!this.uploadTarget) {
				return strings.uploadNoFolder;
			}
			if (!this._file) {
				return strings.uploadChoose;
			}
			const problem = uploadProblem(this._file);
			if (problem) {
				return uploadMessage(problem);
			}
		} else if (tab === "media") {
			if (!this._media) {
				return strings.mediaPick;
			}
		} else if (!isHttpUrl(this._url)) {
			return strings.urlInvalid;
		}
		const problem = filenameProblem(this._stem, profile.max_filename_length);
		if (problem) {
			return problem === "slash"
				? strings.filenameSlash
				: problem === "long"
					? strings.filenameLong(profile.max_filename_length)
					: strings.filenameEmpty;
		}
		return undefined;
	}

	private _selectTab(tab: AddFileTab) {
		this._tab = tab;
		this._error = undefined;
		// The name follows the source of the tab now shown
		const source =
			tab === "upload"
				? this._file?.name
				: tab === "media"
					? this._media?.title
					: urlFileName(this._url);
		this._suggest(source ?? "");
	}

	// Fills in a name from the source's, unless the user typed their own
	private _suggest(sourceName: string) {
		const max = this.profile?.max_filename_length ?? 0;
		const stem = suggestStem(sourceName, max);
		if (this._stem === this._suggested) {
			this._stem = stem;
		}
		this._suggested = stem;
	}

	private _onNameInput(ev: Event) {
		this._stem = (ev.target as HTMLInputElement).value;
	}

	private _onUrlInput(ev: Event) {
		this._url = (ev.target as HTMLInputElement).value;
		this._error = undefined;
		this._suggest(isHttpUrl(this._url) ? urlFileName(this._url) : "");
	}

	private _onMediaPick(ev: CustomEvent<MediaPickDetail>) {
		this._media = ev.detail.item;
		this._error = undefined;
		this._suggest(ev.detail.item.title);
	}

	private _onFileInput(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			this._pickFile(file);
		}
		// The same file can be picked again after a failed upload
		input.value = "";
	}

	private _pickFile(file: File) {
		this._file = file;
		this._error = undefined;
		this._suggest(file.name);
	}

	private _onDragOver(ev: DragEvent) {
		if (!this._uploading && ev.dataTransfer?.types.includes("Files")) {
			ev.preventDefault();
			this._dragOver = true;
		}
	}

	private _onDragLeave() {
		this._dragOver = false;
	}

	private _onDrop(ev: DragEvent) {
		ev.preventDefault();
		this._dragOver = false;
		const file = ev.dataTransfer?.files[0];
		if (file && !this._uploading) {
			this._pickFile(file);
		}
	}

	private async _send(tab: AddFileTab) {
		const profile = this.profile;
		if (!profile || this._blockedReason(profile, tab) !== undefined) {
			return;
		}
		const filename = filenameOf(this._stem);
		let filePath: string;
		if (tab === "upload") {
			const hass = this.hass;
			const folder = this.uploadTarget;
			const file = this._file;
			if (!hass || !folder || !file) {
				return;
			}
			const abort = new AbortController();
			this._abort = abort;
			this._uploading = true;
			this._error = undefined;
			try {
				filePath = await uploadMedia(hass, folder, file, abort.signal);
			} catch (err) {
				if (!abort.signal.aborted) {
					this._error = this._uploadError(err);
				}
				return;
			} finally {
				if (this._abort === abort) {
					this._abort = undefined;
					this._uploading = false;
				}
			}
			if (abort.signal.aborted || !this.isOpen) {
				return;
			}
		} else if (tab === "media") {
			if (!this._media) {
				return;
			}
			filePath = this._media.media_content_id;
		} else {
			const url = httpUrl(this._url);
			if (!url) {
				return;
			}
			filePath = url;
		}
		this.send?.({ filePath, filename });
		this.close();
	}

	private _uploadError(err: unknown): string {
		if (err instanceof UploadError) {
			if (err.status === 401 || err.status === 403) {
				return strings.uploadFailed(strings.uploadNotAllowed);
			}
			if (err.status === 400) {
				return strings.uploadFailed(strings.uploadRefused);
			}
			if (err.status === 413) {
				return strings.uploadFailed(strings.uploadTooLarge);
			}
		}
		return strings.uploadFailed(errorMessage(err));
	}

	// Escape or close(): an upload still running is called off
	private _onClose() {
		this._abort?.abort();
		this._abort = undefined;
		this._uploading = false;
		this.requestUpdate();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.close();
	}
}
