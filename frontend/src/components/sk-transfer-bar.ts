import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";
import type { TransferState } from "../api/types";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

// Progress of the file transfer to the Skelly, with a Cancel button. After a
// transfer fails or is cancelled it says so for as long as the backend keeps
// that state (about a minute); otherwise it shows nothing. Cancel fires sk-cancel; the panel calls the
// action and sets `cancelling` until it returns.
export class SkTransferBar extends LitElement {
	@property({ attribute: false }) transfer?: TransferState;
	@property({ type: Boolean }) cancelling = false;
	@property({ type: Boolean }) disabled = false;

	static styles = [
		sharedStyles,
		css`
			:host {
				display: block;
			}

			.bar {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 8px 0;
			}

			.text {
				flex: 1;
				min-width: 0;
			}

			.label {
				display: flex;
				justify-content: space-between;
				gap: 8px;
				font-size: 14px;
				margin-bottom: 4px;
			}

			.name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.track {
				height: 6px;
				border-radius: 3px;
				background: var(--secondary-background-color, #e0e0e0);
				overflow: hidden;
			}

			.fill {
				height: 100%;
				background: var(--primary-color);
				transition: width 0.3s;
			}

			.note {
				font-size: 12px;
				margin-top: 4px;
			}

			.ended {
				margin: 8px 0;
				word-break: break-word;
			}

			.error {
				color: var(--error-color, #db4437);
			}

			button {
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
			}

			button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}
		`,
	];

	protected render() {
		const transfer = this.transfer;
		if (!transfer) {
			return nothing;
		}
		if (!transfer.in_progress) {
			if (transfer.status === "error") {
				return html`<p class="ended error" role="status">
					${strings.transferFailed(transfer.filename, transfer.error)}
				</p>`;
			}
			if (transfer.status === "cancelled") {
				return html`<p class="ended secondary" role="status">
					${strings.transferCancelled(transfer.filename)}
				</p>`;
			}
			return nothing;
		}
		const progress = Math.max(0, Math.min(100, Math.round(transfer.progress)));
		return html`
			<div class="bar">
				<div class="text">
					<div class="label">
						<span class="name">${strings.transferSending(transfer.filename)}</span>
						<span class="num">${progress}%</span>
					</div>
					<div
						class="track"
						role="progressbar"
						aria-label=${strings.transferSending(transfer.filename)}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow=${progress}
					>
						<div class="fill" style="width: ${progress}%"></div>
					</div>
					<div class="note secondary">${strings.transferBusy}</div>
				</div>
				<button
					?disabled=${this.cancelling || this.disabled}
					@click=${this._cancel}
				>
					${this.cancelling ? strings.transferCancelling : strings.transferCancel}
				</button>
			</div>
		`;
	}

	private _cancel() {
		this.dispatchEvent(
			new CustomEvent("sk-cancel", { bubbles: true, composed: true }),
		);
	}
}
