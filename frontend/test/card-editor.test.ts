import { describe, expect, it, vi } from "vitest";
import "../src/main";
import { EDITOR_SCHEMA } from "../src/card/skelly-ultra-card-editor";
import { CARD_EDITOR_ELEMENT } from "../src/constants";

type Editor = HTMLElement & {
	hass: unknown;
	setConfig(config: object): void;
	updateComplete: Promise<boolean>;
};

type FakeForm = HTMLElement & {
	data: Record<string, unknown>;
	schema: unknown;
	computeLabel(field: { name: string }): string;
	computeHelper(field: { name: string }): string | undefined;
};

describe("card editor", () => {
	it("edits the config with ha-form, leaving defaults out", async () => {
		const editor = document.createElement(CARD_EDITOR_ELEMENT) as Editor;
		editor.hass = { user: { is_admin: true } };
		editor.setConfig({ type: "custom:skelly-ultra-card", device_id: "abc" });
		document.body.append(editor);
		await editor.updateComplete;
		const form = editor.shadowRoot?.querySelector("ha-form") as FakeForm;
		expect(form.schema).toBe(EDITOR_SCHEMA);
		expect(form.data).toEqual({
			type: "custom:skelly-ultra-card",
			device_id: "abc",
			show_tts: true,
			show_files: true,
			max_files: 5,
		});
		expect(form.computeLabel({ name: "max_files" })).toBe("Files to show");
		expect(form.computeHelper({ name: "tts_entity" })).toContain("last one");
		const changed = vi.fn();
		editor.addEventListener("config-changed", (ev) =>
			changed((ev as CustomEvent).detail.config),
		);
		const outside = vi.fn();
		document.body.addEventListener("value-changed", outside);
		form.dispatchEvent(
			new CustomEvent("value-changed", {
				detail: {
					value: {
						device_id: "abc",
						tts_entity: "tts.piper",
						show_tts: false,
						show_files: true,
						max_files: 3,
					},
				},
				bubbles: true,
				composed: true,
			}),
		);
		expect(changed).toHaveBeenLastCalledWith({
			type: "custom:skelly-ultra-card",
			device_id: "abc",
			tts_entity: "tts.piper",
			show_tts: false,
			max_files: 3,
		});
		expect(outside).not.toHaveBeenCalled();
		// ha-form sends all its data: the engine cleared, max_files emptied,
		// show_tts back on
		form.dispatchEvent(
			new CustomEvent("value-changed", {
				detail: {
					value: {
						type: "custom:skelly-ultra-card",
						device_id: "abc",
						tts_entity: undefined,
						show_tts: true,
						show_files: true,
						max_files: null,
						grid_options: { columns: 6 },
					},
				},
			}),
		);
		expect(changed).toHaveBeenLastCalledWith({
			type: "custom:skelly-ultra-card",
			device_id: "abc",
			grid_options: { columns: 6 },
		});
		editor.remove();
	});

	it("hands an invalid config to HA's YAML editor", () => {
		const editor = document.createElement(CARD_EDITOR_ELEMENT) as Editor;
		expect(() =>
			editor.setConfig({ type: "custom:skelly-ultra-card", max_files: "x" }),
		).toThrow("max_files");
	});
});
