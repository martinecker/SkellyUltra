import { css, html, LitElement } from "lit";
import { query, state } from "lit/decorators.js";
import { strings } from "../strings";
import { sharedStyles } from "../styles";

export interface ConfirmOptions {
	title: string;
	message: string;
	confirmLabel: string;
	// Styles the confirm button as a destructive action
	destructive?: boolean;
}

// A yes/no question in a native modal <dialog>. ask() resolves to true if
// the user confirms, false if they cancel or press Escape.
export class SkConfirm extends LitElement {
	@state() private _options?: ConfirmOptions;
	@query("dialog") private _dialog?: HTMLDialogElement;
	private _resolve?: (confirmed: boolean) => void;

	static styles = [
		sharedStyles,
		css`
			dialog {
				max-width: min(400px, calc(100vw - 32px));
				padding: 24px;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			h2 {
				margin: 0 0 12px;
				font-size: 20px;
				font-weight: 500;
			}

			p {
				margin: 0 0 24px;
				word-break: break-word;
			}

			.buttons {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
			}

			button {
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

			button:hover {
				background: var(--secondary-background-color);
			}

			button.destructive {
				color: var(--error-color, #db4437);
			}
		`,
	];

	async ask(options: ConfirmOptions): Promise<boolean> {
		// A question still open is answered "no" by the new one
		this._resolve?.(false);
		this._options = options;
		await this.updateComplete;
		const answer = new Promise<boolean>((resolve) => {
			this._resolve = resolve;
		});
		if (this._dialog && !this._dialog.open) {
			this._dialog.showModal();
		}
		return answer;
	}

	protected render() {
		const options = this._options;
		return html`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				<h2 id="title">${options?.title}</h2>
				<p>${options?.message}</p>
				<div class="buttons">
					<button class="cancel" @click=${() => this._answer(false)}>
						${strings.cancel}
					</button>
					<button
						class="confirm ${options?.destructive ? "destructive" : ""}"
						@click=${() => this._answer(true)}
					>
						${options?.confirmLabel}
					</button>
				</div>
			</dialog>
		`;
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this._answer(false);
	}

	// Escape: answer "no" (the dialog then closes itself)
	private _onCancel() {
		this._answer(false);
	}

	// The dialog closed some other way (a browser may skip the cancel
	// event): answer "no". A close event comes a moment after close(), so
	// one that finds the dialog open again belongs to an earlier question.
	private _onClose() {
		if (!this._dialog?.open) {
			this._answer(false);
		}
	}

	private _answer(confirmed: boolean) {
		const resolve = this._resolve;
		this._resolve = undefined;
		if (this._dialog?.open) {
			this._dialog.close();
		}
		resolve?.(confirmed);
	}
}
