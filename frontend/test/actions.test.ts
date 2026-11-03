import { describe, expect, it, vi } from "vitest";
import {
	cancelTransfer,
	deleteFile,
	editFile,
	errorMessage,
	playFile,
	sendFile,
	sendFileFromTts,
	setFileOrder,
	stopFile,
} from "../src/api/actions";
import type { HomeAssistant } from "../src/ha-types";

function fakeHass(response: unknown = undefined) {
	const callService = vi.fn().mockResolvedValue({ context: {}, response });
	return { hass: { callService } as unknown as HomeAssistant, callService };
}

const target = { device_id: "dev1" };

describe("actions", () => {
	it("send the target and data to the skelly_ultra actions", async () => {
		const { hass, callService } = fakeHass();
		await playFile(hass, target, 3);
		await stopFile(hass, target, 3);
		await deleteFile(hass, target, "boo.mp3");
		await editFile(hass, target, "boo.mp3", {
			movements: ["head"],
			lights: [{ channel: 0, rgb: [1, 2, 3] }],
		});
		await cancelTransfer(hass, { device_id: "dev2" });

		expect(callService.mock.calls).toEqual([
			[
				"skelly_ultra",
				"play_file",
				{ device_id: "dev1", file_index: 3 },
				undefined,
				false,
				false,
			],
			[
				"skelly_ultra",
				"stop_file",
				{ device_id: "dev1", file_index: 3 },
				undefined,
				false,
				false,
			],
			[
				"skelly_ultra",
				"delete_file",
				{ device_id: "dev1", filename: "boo.mp3" },
				undefined,
				false,
				false,
			],
			[
				"skelly_ultra",
				"edit_file",
				{
					device_id: "dev1",
					filename: "boo.mp3",
					movements: ["head"],
					lights: [{ channel: 0, rgb: [1, 2, 3] }],
				},
				undefined,
				false,
				false,
			],
			[
				"skelly_ultra",
				"cancel_file_transfer",
				{ device_id: "dev2" },
				undefined,
				false,
				false,
			],
		]);
	});

	it("return the action's response where there is one", async () => {
		const sent = { filename: "boo.mp3", file_index: 4 };
		const { hass, callService } = fakeHass(sent);

		expect(
			await sendFile(hass, target, "media-source://x/boo.wav", "boo"),
		).toEqual(sent);
		expect(
			await sendFileFromTts(hass, target, {
				tts_entity: "tts.piper",
				message: "Boo!",
			}),
		).toEqual(sent);
		expect(callService.mock.calls).toEqual([
			[
				"skelly_ultra",
				"send_file",
				{
					device_id: "dev1",
					file_path: "media-source://x/boo.wav",
					target_filename: "boo",
				},
				undefined,
				false,
				true,
			],
			[
				"skelly_ultra",
				"send_file_from_tts",
				{ device_id: "dev1", tts_entity: "tts.piper", message: "Boo!" },
				undefined,
				false,
				true,
			],
		]);

		const order = fakeHass({ file_order: [2, 1] });
		expect(await setFileOrder(order.hass, target, ["b.mp3", "a.mp3"])).toEqual({
			file_order: [2, 1],
		});
		expect(order.callService.mock.calls[0][2]).toEqual({
			device_id: "dev1",
			filenames: ["b.mp3", "a.mp3"],
		});
	});

	it("pass errors on to the caller", async () => {
		const callService = vi
			.fn()
			.mockRejectedValue({ code: "home_assistant_error", message: "Busy" });
		const hass = { callService } as unknown as HomeAssistant;
		await expect(playFile(hass, target, 1)).rejects.toEqual({
			code: "home_assistant_error",
			message: "Busy",
		});
	});
});

describe("errorMessage", () => {
	it("uses HA's message", () => {
		expect(errorMessage({ code: "x", message: "Device is busy" })).toBe(
			"Device is busy",
		);
		expect(errorMessage(new Error("boom"))).toBe("boom");
		expect(errorMessage("plain")).toBe("plain");
		expect(errorMessage(undefined)).toBe("Unknown error");
		expect(errorMessage({ message: "" })).toBe("Unknown error");
	});
});
