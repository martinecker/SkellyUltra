import { afterEach, describe, expect, it } from "vitest";
import "../src/main";
import type { SkConfirm } from "../src/components/sk-confirm";
import { CONFIRM_ELEMENT } from "../src/constants";

const options = {
	title: "Delete file?",
	message: "Delete boo.mp3?",
	confirmLabel: "Delete",
	destructive: true,
};

async function show(): Promise<SkConfirm> {
	const confirm = document.createElement(CONFIRM_ELEMENT) as SkConfirm;
	document.body.append(confirm);
	await confirm.updateComplete;
	return confirm;
}

const dialog = (c: SkConfirm) =>
	c.shadowRoot?.querySelector("dialog") as HTMLDialogElement;
const click = (c: SkConfirm, cls: string) =>
	(
		(c.shadowRoot as ShadowRoot).querySelector(
			`button.${cls}`,
		) as HTMLButtonElement
	).click();

describe("sk-confirm", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("answers yes or no from its buttons", async () => {
		const confirm = await show();
		const yes = confirm.ask(options);
		await confirm.updateComplete;
		expect(dialog(confirm).open).toBe(true);
		expect(dialog(confirm).textContent).toContain("Delete boo.mp3?");
		click(confirm, "confirm");
		expect(await yes).toBe(true);
		expect(dialog(confirm).open).toBe(false);

		const no = confirm.ask(options);
		await confirm.updateComplete;
		click(confirm, "cancel");
		expect(await no).toBe(false);
	});

	it("answers no on Escape", async () => {
		const confirm = await show();
		const answer = confirm.ask(options);
		await confirm.updateComplete;
		dialog(confirm).dispatchEvent(new Event("cancel"));
		expect(await answer).toBe(false);
	});

	it("answers an open question no when asked another, and keeps the new one open", async () => {
		const confirm = await show();
		const first = confirm.ask(options);
		await confirm.updateComplete;
		const second = confirm.ask({ ...options, message: "Delete laugh.mp3?" });
		expect(await first).toBe(false);
		await confirm.updateComplete;
		// Let any events from the first question run
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(dialog(confirm).open).toBe(true);
		expect(dialog(confirm).textContent).toContain("Delete laugh.mp3?");
		click(confirm, "confirm");
		expect(await second).toBe(true);
	});

	it("answers no if the dialog closes without a cancel event", async () => {
		const confirm = await show();
		const answer = confirm.ask(options);
		await confirm.updateComplete;
		dialog(confirm).close();
		dialog(confirm).dispatchEvent(new Event("close"));
		expect(await answer).toBe(false);
	});

	it("isn't answered by the close event of the question before", async () => {
		const confirm = await show();
		const first = confirm.ask(options);
		await confirm.updateComplete;
		click(confirm, "cancel");
		expect(await first).toBe(false);
		const second = confirm.ask(options);
		await confirm.updateComplete;
		// The first question's close event arrives late
		dialog(confirm).dispatchEvent(new Event("close"));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(dialog(confirm).open).toBe(true);
		click(confirm, "confirm");
		expect(await second).toBe(true);
	});

	it("answers no when it leaves the page", async () => {
		const confirm = await show();
		const answer = confirm.ask(options);
		await confirm.updateComplete;
		confirm.remove();
		expect(await answer).toBe(false);
	});
});
