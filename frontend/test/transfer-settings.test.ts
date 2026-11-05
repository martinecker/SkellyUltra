import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/main";
import type { FilesPayload, TransferSettings } from "../src/api/types";
import {
	SETTINGS_SETTLE_MS,
	type SkTransferSettings,
} from "../src/components/sk-transfer-settings";
import { TRANSFER_SETTINGS_ELEMENT } from "../src/constants";
import fixture from "./fixtures/files-payload.json";

const base = (fixture as FilesPayload).transfer_settings;

const settingsWith = (
	chunk: Partial<TransferSettings["chunk_size"]> = {},
	bitrate: Partial<TransferSettings["bitrate"]> = {},
): TransferSettings => ({
	chunk_size: { ...base.chunk_size, ...chunk },
	bitrate: { ...base.bitrate, ...bitrate },
});

const settle = async (el: SkTransferSettings) => {
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await el.updateComplete;
	}
};

async function show(settings: TransferSettings) {
	const el = document.createElement(
		TRANSFER_SETTINGS_ELEMENT,
	) as SkTransferSettings;
	const hass = { callService: vi.fn().mockResolvedValue({ context: {} }) };
	el.hass = hass as never;
	el.settings = settings;
	document.body.append(el);
	await settle(el);
	return { el, hass };
}

const $ = <T extends Element>(el: SkTransferSettings, selector: string) =>
	(el.shadowRoot as ShadowRoot).querySelector(selector) as T;

describe("transfer settings", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("shows the automatic chunk size and bitrate", async () => {
		const { el } = await show(base);
		const text = el.shadowRoot?.textContent ?? "";
		expect(text).toContain("Automatic: 244 bytes");
		expect(text).toContain("Automatic: 32k");
		expect(text).not.toContain("make transfers slow");
		expect($(el, "input.chunk-size")).toBeNull();
		expect($(el, "select.bitrate")).toBeNull();
	});

	it("warns about small automatic chunks", async () => {
		const { el } = await show(settingsWith({ auto: 20 }));
		expect(el.shadowRoot?.textContent).toContain(
			"Chunks of 20 bytes make transfers slow",
		);
	});

	it("turns the chunk size override on with its value, then changes it", async () => {
		const { el, hass } = await show(base);
		const box = $<HTMLInputElement>(el, "input.chunk-override");
		box.checked = true;
		box.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService.mock.calls).toEqual([
			[
				"switch",
				"turn_on",
				{ entity_id: "switch.skelly_santa_override_chunk_size" },
			],
			[
				"number",
				"set_value",
				{
					entity_id: "number.skelly_santa_override_chunk_size_value",
					value: 250,
				},
			],
		]);
		// Shown as on until the file list says so
		const size = $<HTMLInputElement>(el, "input.chunk-size");
		expect(size.value).toBe("250");

		// Typed values are rounded to the step and kept in range
		hass.callService.mockClear();
		size.value = "1234";
		size.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService.mock.calls.at(-1)).toEqual([
			"number",
			"set_value",
			{
				entity_id: "number.skelly_santa_override_chunk_size_value",
				value: 500,
			},
		]);
		size.value = "33";
		size.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService.mock.calls.at(-1)?.[2]).toMatchObject({
			value: 30,
		});
		// Nothing for an empty box
		const calls = hass.callService.mock.calls.length;
		size.value = "";
		size.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService.mock.calls).toHaveLength(calls);

		// The file list's settings replace the shown ones
		el.settings = settingsWith({ override: true, value: 30 });
		await settle(el);
		expect($<HTMLInputElement>(el, "input.chunk-size").value).toBe("30");
	});

	it("turns an override off", async () => {
		const { el, hass } = await show(
			settingsWith({ override: true }, { override: true, value: "64k" }),
		);
		expect($<HTMLSelectElement>(el, "select.bitrate").value).toBe("64k");
		const box = $<HTMLInputElement>(el, "input.bitrate-override");
		box.checked = false;
		box.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService).toHaveBeenLastCalledWith("switch", "turn_off", {
			entity_id: "switch.skelly_santa_override_bitrate",
		});
		expect($(el, "select.bitrate")).toBeNull();
	});

	it("picks a bitrate", async () => {
		const { el, hass } = await show(settingsWith({}, { override: true }));
		const select = $<HTMLSelectElement>(el, "select.bitrate");
		select.value = "16k";
		select.dispatchEvent(new Event("change"));
		await settle(el);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"select",
			"select_option",
			{
				entity_id: "select.skelly_santa_override_bitrate_value",
				option: "16k",
			},
		);
	});

	it("says why a change failed and shows the old state again", async () => {
		const { el, hass } = await show(base);
		hass.callService.mockRejectedValueOnce({ message: "Entity unavailable" });
		const box = $<HTMLInputElement>(el, "input.chunk-override");
		box.checked = true;
		box.dispatchEvent(new Event("change"));
		await settle(el);
		expect(el.shadowRoot?.textContent).toContain(
			"Couldn't change the transfer settings: Entity unavailable",
		);
		expect($<HTMLInputElement>(el, "input.chunk-override").checked).toBe(false);
	});

	it("shows the reported settings again if they don't change", async () => {
		const { el } = await show(base);
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const box = $<HTMLInputElement>(el, "input.chunk-override");
			box.checked = true;
			box.dispatchEvent(new Event("change"));
			await el.updateComplete;
			await Promise.resolve();
			await el.updateComplete;
			expect($(el, "input.chunk-size")).not.toBeNull();
			vi.advanceTimersByTime(SETTINGS_SETTLE_MS);
			await el.updateComplete;
			expect($(el, "input.chunk-size")).toBeNull();
			expect($<HTMLInputElement>(el, "input.chunk-override").checked).toBe(
				false,
			);
			expect(el.shadowRoot?.textContent).toContain(
				"The Skelly didn't take the change",
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps showing a change until all of it is reported", async () => {
		const { el } = await show(base);
		const box = $<HTMLInputElement>(el, "input.bitrate-override");
		box.checked = true;
		box.dispatchEvent(new Event("change"));
		await settle(el);
		const select = $<HTMLSelectElement>(el, "select.bitrate");
		select.value = "64k";
		select.dispatchEvent(new Event("change"));
		await settle(el);
		// Only the switch is reported so far
		el.settings = settingsWith({}, { override: true });
		await settle(el);
		expect($<HTMLSelectElement>(el, "select.bitrate").value).toBe("64k");
		el.settings = settingsWith({}, { override: true, value: "64k" });
		await settle(el);
		expect($<HTMLSelectElement>(el, "select.bitrate").value).toBe("64k");
		expect(el.shadowRoot?.textContent).not.toContain("didn't take");
	});

	it("can't change overrides without their entities", async () => {
		const { el } = await show(settingsWith({ value_entity: null }));
		expect($<HTMLInputElement>(el, "input.chunk-override").disabled).toBe(true);
		expect($<HTMLInputElement>(el, "input.bitrate-override").disabled).toBe(
			false,
		);
	});
});
