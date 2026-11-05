import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { errorMessage } from "../api/actions";
import {
	browseMedia,
	isAudio,
	type MediaItem,
	visibleChildren,
} from "../api/media";
import type { HomeAssistant } from "../ha-types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

// Detail of sk-media-pick: the audio item the user picked
export interface MediaPickDetail {
	item: MediaItem;
}

// A folder on the way to the shown one, for the breadcrumbs
interface Crumb {
	id: string;
	title: string;
}

// Browses Home Assistant's media sources, from the root, and lists their
// folders and audio files. Picking a file fires sk-media-pick.
export class SkMediaBrowser extends LitElement {
	@property({ attribute: false }) hass?: HomeAssistant;
	// media_content_id of the picked item, to mark it
	@property({ attribute: false }) selected?: string;

	@state() private _folder?: MediaItem;
	// The folders above the shown one, root first
	@state() private _path: Crumb[] = [];
	@state() private _loading = false;
	@state() private _error?: string;
	// Counts the loads, so a slow answer for a folder left meanwhile is dropped
	private _load = 0;

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			nav {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 2px;
				margin-bottom: 8px;
				font-size: 14px;
			}

			nav button {
				font: inherit;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 4px 6px;
				cursor: pointer;
			}

			nav button:hover {
				background: var(--secondary-background-color);
			}

			nav .current {
				padding: 4px 6px;
				font-weight: 500;
			}

			ul {
				list-style: none;
				margin: 0;
				padding: 0;
				max-height: 320px;
				overflow: auto;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			li + li {
				border-top: 1px solid var(--divider-color);
			}

			li button {
				display: flex;
				align-items: center;
				gap: 12px;
				width: 100%;
				min-height: 44px;
				padding: 6px 12px;
				font: inherit;
				font-size: 14px;
				text-align: left;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				cursor: pointer;
			}

			li button:hover {
				background: var(--secondary-background-color);
			}

			li button[aria-pressed="true"] {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
				font-weight: 500;
			}

			li ha-icon {
				flex: none;
				color: var(--secondary-text-color);
			}

			.title {
				flex: 1;
				min-width: 0;
				word-break: break-word;
			}

			.message {
				padding: 12px;
			}

			.error {
				color: var(--error-color, #db4437);
			}
		`,
	];

	protected willUpdate(changed: PropertyValues<this>): void {
		// The root, once there's a hass to ask
		if (changed.has("hass") && this.hass && !this._folder && !this._loading) {
			void this._open(undefined, []);
		}
	}

	protected render() {
		const folder = this._folder;
		return html`
			<nav aria-label=${strings.mediaHome}>
				${this._path.map(
					(crumb, i) =>
						html`<button
								class="crumb"
								@click=${() =>
									this._open(crumb.id || undefined, this._path.slice(0, i))}
							>
								${crumb.title}</button
							><span aria-hidden="true">›</span>`,
				)}
				<span class="current">${this._title(folder)}</span>
			</nav>
			${this._renderList(folder)}
		`;
	}

	private _renderList(folder: MediaItem | undefined) {
		// A folder that didn't open leaves the one shown before
		const error = this._error
			? html`<p class="message error" role="alert">
					${strings.mediaFailed(this._error)}
				</p>`
			: nothing;
		if (this._loading || !folder) {
			if (error !== nothing) {
				return error;
			}
			return html`<p class="message secondary">${strings.mediaLoading}</p>`;
		}
		const children = visibleChildren(folder);
		if (!children.length) {
			return html`${error}<p class="message secondary">${strings.mediaEmpty}</p>`;
		}
		return html`${error}<ul>
			${children.map(
				(child) => html`<li>
					${
						child.can_expand
							? html`<button
									class="folder"
									@click=${() => this._enter(child)}
								>
									<ha-icon icon="mdi:folder"></ha-icon>
									<span class="title">${child.title}</span>
									<ha-icon icon="mdi:chevron-right"></ha-icon>
								</button>`
							: html`<button
									class="item"
									aria-pressed=${child.media_content_id === this.selected ? "true" : "false"}
									@click=${() => this._pick(child)}
								>
									<ha-icon icon="mdi:music-note"></ha-icon>
									<span class="title">${child.title}</span>
								</button>`
					}
				</li>`,
			)}
		</ul>`;
	}

	private _title(folder: MediaItem | undefined): string {
		return this._path.length && folder ? folder.title : strings.mediaHome;
	}

	private _enter(child: MediaItem) {
		const folder = this._folder;
		if (!folder) {
			return;
		}
		const here: Crumb = {
			// The root has an empty ID
			id: this._path.length ? folder.media_content_id : "",
			title: this._title(folder),
		};
		void this._open(child.media_content_id, [...this._path, here]);
	}

	private async _open(id: string | undefined, path: Crumb[]) {
		const hass = this.hass;
		if (!hass) {
			return;
		}
		const load = ++this._load;
		this._loading = true;
		this._error = undefined;
		try {
			const folder = await browseMedia(hass, id);
			if (load !== this._load) {
				return;
			}
			this._folder = folder;
			this._path = path;
		} catch (err) {
			if (load === this._load) {
				this._error = errorMessage(err);
			}
		} finally {
			if (load === this._load) {
				this._loading = false;
			}
		}
	}

	private _pick(item: MediaItem) {
		if (!isAudio(item)) {
			return;
		}
		this.dispatchEvent(
			new CustomEvent<MediaPickDetail>("sk-media-pick", {
				detail: { item },
				bubbles: true,
				composed: true,
			}),
		);
	}
}
