import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/main";
import type { FilesPayload, SkellyDevice } from "../src/api/types";
import { PANEL_ELEMENT } from "../src/constants";
import {
	ORDER_DEBOUNCE_MS,
	ORDER_SETTLE_MS,
} from "../src/panel/skelly-ultra-panel";
import devicesFixture from "./fixtures/devices.json";
import filesFixture from "./fixtures/files-payload.json";

type Panel = HTMLElement & {
	hass: unknown;
	narrow: boolean;
	updateComplete: Promise<boolean>;
};

const DEVICE_ID = devicesFixture[0].device_id;

// The fixture, with no transfer running
const idlePayload: FilesPayload = {
	...(filesFixture as FilesPayload),
	transfer: {
		status: "idle",
		in_progress: false,
		progress: 0,
		filename: null,
		error: null,
	},
};

const settle = async (panel: Panel) => {
	for (let i = 0; i < 5; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await panel.updateComplete;
		const table = panel.shadowRoot?.querySelector("sk-file-table") as
			| (HTMLElement & { updateComplete: Promise<boolean> })
			| null;
		await table?.updateComplete;
	}
};

function fakeHass(
	devices: SkellyDevice[],
	payload: FilesPayload = idlePayload,
) {
	const subscribed: Record<string, unknown>[] = [];
	const callbacks: ((p: FilesPayload) => void)[] = [];
	const unsubscribe = vi.fn().mockResolvedValue(undefined);
	const connection = {
		connected: true,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		subscribeMessage: vi.fn(
			async (
				callback: (p: FilesPayload) => void,
				message: Record<string, unknown>,
			) => {
				subscribed.push(message);
				callbacks.push(callback);
				const device = devices.find(
					(d) =>
						d.device_id === message.device_id ||
						d.entry_id === message.entry_id,
				);
				setTimeout(() =>
					callback({
						...payload,
						entry_id: device?.entry_id ?? "?",
						device_id: device?.device_id ?? null,
						name: device?.name ?? "?",
					}),
				);
				return unsubscribe;
			},
		),
	};
	const hass = {
		connection,
		user: { name: "Martin", is_admin: true },
		callWS: vi.fn(async (msg: Record<string, unknown>) =>
			msg.type === "skelly_ultra/devices/list" ? devices : payload,
		),
		callService: vi.fn().mockResolvedValue({ context: {} }),
	};
	// Sends the latest subscription a new payload
	const send = (p: FilesPayload) => callbacks.at(-1)?.(p);
	return { hass, subscribed, unsubscribe, send };
}

// The panel's width, as the stubbed ResizeObserver reports it
let panelWidth = 1000;

class FakeResizeObserver {
	constructor(private readonly callback: ResizeObserverCallback) {}
	observe() {
		this.callback(
			[{ contentRect: { width: panelWidth } } as ResizeObserverEntry],
			this as unknown as ResizeObserver,
		);
	}
	disconnect() {}
}
vi.stubGlobal("ResizeObserver", FakeResizeObserver);

async function showPanel(hass: unknown, width = 1000): Promise<Panel> {
	panelWidth = width;
	const panel = document.createElement(PANEL_ELEMENT) as Panel;
	panel.hass = hass;
	document.body.append(panel);
	await settle(panel);
	return panel;
}

const text = (panel: Panel) =>
	(panel.shadowRoot?.textContent ?? "") +
	(panel.shadowRoot?.querySelector("sk-file-table")?.shadowRoot?.textContent ??
		"") +
	(panel.shadowRoot?.querySelector("sk-transfer-bar")?.shadowRoot
		?.textContent ?? "");

const table = (panel: Panel) =>
	panel.shadowRoot?.querySelector("sk-file-table")?.shadowRoot as ShadowRoot;

const row = (panel: Panel, fileIndex: number) =>
	table(panel).querySelector(`[data-file-index="${fileIndex}"]`) as HTMLElement;

const button = (panel: Panel, fileIndex: number, cls: string) =>
	row(panel, fileIndex).querySelector(`button.${cls}`) as HTMLButtonElement;

const refreshButton = (panel: Panel) =>
	(panel.shadowRoot as ShadowRoot).querySelector(
		"button.refresh",
	) as HTMLButtonElement;

const confirmDialog = (panel: Panel) =>
	panel.shadowRoot?.querySelector("sk-confirm")?.shadowRoot as ShadowRoot;

function toasts(): string[] {
	const messages: string[] = [];
	window.addEventListener("hass-notification", (ev) => {
		messages.push((ev as CustomEvent<{ message: string }>).detail.message);
	});
	return messages;
}

const one = devicesFixture as SkellyDevice[];

describe("panel", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		history.replaceState(null, "", "/");
	});

	it("shows the files of the only Skelly, enabled ones first in play order", async () => {
		const { hass, subscribed } = fakeHass(one);
		const panel = await showPanel(hass);

		expect(hass.callWS).toHaveBeenCalledWith({
			type: "skelly_ultra/devices/list",
		});
		expect(subscribed).toEqual([
			{ type: "skelly_ultra/files/subscribe", device_id: DEVICE_ID },
		]);
		expect(text(panel)).toContain("Skelly Santa");
		expect(text(panel)).toContain("Live");
		expect(text(panel)).toContain("3.9 MB free");
		expect(text(panel)).toContain("2 files");
		// One Skelly: no picker
		expect(panel.shadowRoot?.querySelector("select")).toBeNull();

		const rows = [...table(panel).querySelectorAll("tbody tr")];
		expect(rows.map((r) => r.getAttribute("data-file-index"))).toEqual([
			"1",
			"2",
		]);
		expect(rows[0].querySelector(".position")?.textContent?.trim()).toBe("1");
		expect(rows[1].querySelector(".position")?.textContent?.trim()).toBe("–");
		expect(rows[1].classList.contains("off")).toBe(true);

		// Movement icons and the eye icon come from the profile
		const images = [...rows[0].querySelectorAll(".glyph")].map((i) =>
			i.getAttribute("data-src"),
		);
		expect(images).toEqual([
			"/skelly_ultra/images/skelly/movement_head.png",
			"/skelly_ultra/images/skelly/movement_torso.png",
		]);
		// eye_icon 7 isn't in the fixture's profile: shown as a number
		expect(rows[0].textContent).toContain("7");
		expect(row(panel, 2).querySelector("img")?.getAttribute("src")).toBe(
			"/skelly_ultra/images/skelly/eye_icon_1.png",
		);

		// One swatch per light channel, styled by its effect mode
		const swatches = [...rows[0].querySelectorAll(".swatch")];
		expect(swatches).toHaveLength(2);
		expect(swatches[0].getAttribute("title")).toBe(
			"Torso Light: Static, RGB 255, 0, 0, brightness 255",
		);
		expect(swatches[1].classList.contains("pulse")).toBe(true);
		expect(swatches[1].classList.contains("cycle")).toBe(true);
	});

	it("plays and stops a file", async () => {
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass);

		button(panel, 1, "play").click();
		await settle(panel);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"skelly_ultra",
			"play_file",
			{ device_id: DEVICE_ID, file_index: 1 },
			undefined,
			false,
			false,
		);
		expect(row(panel, 1).classList.contains("playing")).toBe(true);

		// Playing another file moves the playing state
		button(panel, 2, "play").click();
		await settle(panel);
		expect(row(panel, 1).classList.contains("playing")).toBe(false);
		expect(row(panel, 2).classList.contains("playing")).toBe(true);

		button(panel, 2, "stop").click();
		await settle(panel);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"skelly_ultra",
			"stop_file",
			{ device_id: DEVICE_ID, file_index: 2 },
			undefined,
			false,
			false,
		);
		expect(row(panel, 2).classList.contains("playing")).toBe(false);
		expect(button(panel, 2, "play")).not.toBeNull();
	});

	it("shows a failed action as a toast", async () => {
		const messages = toasts();
		const { hass } = fakeHass(one);
		hass.callService.mockRejectedValueOnce({
			code: "home_assistant_error",
			message: "Device not connected",
		});
		const panel = await showPanel(hass);

		button(panel, 1, "play").click();
		await settle(panel);
		expect(messages).toContain("Couldn't play hello.mp3: Device not connected");
		expect(row(panel, 1).classList.contains("playing")).toBe(false);
		expect(button(panel, 1, "play").disabled).toBe(false);
	});

	it("deletes a file only after confirming", async () => {
		const messages = toasts();
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass);
		const dialog = () =>
			confirmDialog(panel).querySelector("dialog") as HTMLDialogElement;

		button(panel, 2, "delete").click();
		await settle(panel);
		expect(dialog().open).toBe(true);
		expect(dialog().textContent).toContain("Delete laugh.mp3 from the Skelly?");
		(
			confirmDialog(panel).querySelector("button.cancel") as HTMLElement
		).click();
		await settle(panel);
		expect(dialog().open).toBe(false);
		expect(hass.callService).not.toHaveBeenCalled();

		button(panel, 2, "delete").click();
		await settle(panel);
		(
			confirmDialog(panel).querySelector("button.confirm") as HTMLElement
		).click();
		await settle(panel);
		expect(hass.callService).toHaveBeenCalledWith(
			"skelly_ultra",
			"delete_file",
			{ device_id: DEVICE_ID, filename: "laugh.mp3" },
			undefined,
			false,
			false,
		);
		expect(messages).toContain("Deleted laugh.mp3");
	});

	it("reads the files from the device again on Refresh", async () => {
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass);
		refreshButton(panel).click();
		await settle(panel);
		expect(hass.callWS).toHaveBeenLastCalledWith({
			type: "skelly_ultra/files/list",
			device_id: DEVICE_ID,
			refresh: true,
		});
	});

	it("is read-only except Refresh while the Skelly is disconnected", async () => {
		const { hass } = fakeHass(one, { ...idlePayload, available: false });
		const panel = await showPanel(hass);
		expect(text(panel)).toContain("The Skelly is not connected");
		expect(button(panel, 1, "play").disabled).toBe(true);
		expect(button(panel, 1, "delete").disabled).toBe(true);
		expect(refreshButton(panel).disabled).toBe(false);
	});

	it("shows a transfer's progress and cancels it", async () => {
		const { hass, send } = fakeHass(one, filesFixture as FilesPayload);
		const panel = await showPanel(hass);
		expect(text(panel)).toContain("Sending boo.mp3");
		expect(text(panel)).toContain("42%");
		// The device does one thing at a time
		expect(button(panel, 1, "play").disabled).toBe(true);
		expect(button(panel, 1, "play").title).toBe(
			"Files can't be played, edited, reordered or deleted until the transfer is done.",
		);
		expect(text(panel)).toContain(
			"can't be played, edited, reordered or deleted",
		);

		const bar = panel.shadowRoot?.querySelector("sk-transfer-bar")
			?.shadowRoot as ShadowRoot;
		(bar.querySelector("button") as HTMLButtonElement).click();
		await settle(panel);
		expect(hass.callService).toHaveBeenLastCalledWith(
			"skelly_ultra",
			"cancel_file_transfer",
			{ device_id: DEVICE_ID },
			undefined,
			false,
			false,
		);

		send({
			...(filesFixture as FilesPayload),
			transfer: { ...idlePayload.transfer, status: "cancelled" },
		});
		await settle(panel);
		expect(text(panel)).not.toContain("Sending boo.mp3");
		expect(button(panel, 1, "play").disabled).toBe(false);
	});

	it("shows that the integration is reloading", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const { hass, send } = fakeHass(one);
			const panel = document.createElement(PANEL_ELEMENT) as Panel;
			panel.hass = hass;
			document.body.append(panel);
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(0);
			send({ ...idlePayload, unloaded: true });
			await vi.advanceTimersByTimeAsync(0);
			await panel.updateComplete;
			expect(text(panel)).toContain("The integration is reloading");
			expect(button(panel, 1, "play").disabled).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("leaves out the eye column on profiles without eye icons", async () => {
		const lily: FilesPayload = {
			...idlePayload,
			device_profile: { ...idlePayload.device_profile, eye_icons: [] },
			files: idlePayload.files.map((f) => ({ ...f, eye_icon: null })),
		};
		const { hass } = fakeHass(one, lily);
		const panel = await showPanel(hass);
		const headers = [...table(panel).querySelectorAll("th")].map((th) =>
			th.textContent?.trim(),
		);
		expect(headers).not.toContain("Eye");
		expect(headers).toContain("Movement");
	});

	it("shows the file index and cluster with Details", async () => {
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass);
		expect(text(panel)).not.toContain("1010");
		const toggle = panel.shadowRoot?.querySelector(
			".toggle input",
		) as HTMLInputElement;
		toggle.checked = true;
		toggle.dispatchEvent(new Event("change"));
		await settle(panel);
		expect(text(panel)).toContain("1010");
		expect(localStorage.getItem("skelly_ultra.panel.details")).toBe("1");
		localStorage.removeItem("skelly_ultra.panel.details");
	});

	it("lists the files with a menu on narrow screens", async () => {
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass, 400);
		expect(table(panel).querySelector("table")).toBeNull();
		expect(table(panel).querySelectorAll("li")).toHaveLength(2);

		const menu = row(panel, 2).querySelector("details") as HTMLDetailsElement;
		menu.open = true;
		button(panel, 2, "delete").click();
		await settle(panel);
		expect(menu.open).toBe(false);
		expect(
			(confirmDialog(panel).querySelector("dialog") as HTMLDialogElement).open,
		).toBe(true);
	});

	it("closes a narrow menu on Escape or a click elsewhere", async () => {
		const { hass } = fakeHass(one);
		const panel = await showPanel(hass, 400);
		const menu = row(panel, 1).querySelector("details") as HTMLDetailsElement;

		menu.open = true;
		menu.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		expect(menu.open).toBe(false);

		menu.open = true;
		document.body.click();
		expect(menu.open).toBe(false);
	});

	it("shows a table on a wide panel even if HA calls the screen narrow", async () => {
		const { hass } = fakeHass(one);
		const panel = document.createElement(PANEL_ELEMENT) as Panel;
		panelWidth = 800;
		panel.hass = hass;
		panel.narrow = true;
		document.body.append(panel);
		await settle(panel);
		expect(table(panel).querySelector("table")).not.toBeNull();
	});

	it("picks the Skelly from the URL and switches on request", async () => {
		const second = {
			...devicesFixture[0],
			entry_id: "e2",
			device_id: "d2",
			name: "Lily",
		};
		const { hass, subscribed, unsubscribe } = fakeHass([
			devicesFixture[0] as SkellyDevice,
			second,
		]);
		history.replaceState(null, "", "/skelly-ultra?device=d2");
		const panel = await showPanel(hass);

		expect(subscribed.at(-1)).toMatchObject({ device_id: "d2" });
		expect(text(panel)).toContain("Lily");

		// Playing state belongs to the Skelly it was played on
		button(panel, 1, "play").click();
		await settle(panel);
		expect(row(panel, 1).classList.contains("playing")).toBe(true);

		const select = panel.shadowRoot?.querySelector(
			"select",
		) as HTMLSelectElement;
		select.value = DEVICE_ID;
		select.dispatchEvent(new Event("change"));
		await settle(panel);

		expect(unsubscribe).toHaveBeenCalled();
		expect(subscribed.at(-1)).toMatchObject({ device_id: DEVICE_ID });
		expect(new URL(window.location.href).searchParams.get("device")).toBe(
			DEVICE_ID,
		);
		expect(row(panel, 1).classList.contains("playing")).toBe(false);
	});

	it("keeps Stop working during a transfer", async () => {
		const { hass, send } = fakeHass(one);
		const panel = await showPanel(hass);
		button(panel, 1, "play").click();
		await settle(panel);
		send({
			...(filesFixture as FilesPayload),
			entry_id: devicesFixture[0].entry_id,
		});
		await settle(panel);
		expect(button(panel, 1, "stop").disabled).toBe(false);
		expect(button(panel, 2, "play").disabled).toBe(true);
	});

	it("forgets the playing file when the Skelly disconnects or it's replaced", async () => {
		const { hass, send } = fakeHass(one);
		const panel = await showPanel(hass);
		const entry = { ...idlePayload, entry_id: devicesFixture[0].entry_id };

		button(panel, 1, "play").click();
		await settle(panel);
		send({ ...entry, available: false });
		await settle(panel);
		send(entry);
		await settle(panel);
		expect(row(panel, 1).classList.contains("playing")).toBe(false);

		button(panel, 1, "play").click();
		await settle(panel);
		// Another file now has the same index
		send({
			...entry,
			files: entry.files.map((f) =>
				f.file_index === 1 ? { ...f, name: "other.mp3" } : f,
			),
		});
		await settle(panel);
		expect(row(panel, 1).classList.contains("playing")).toBe(false);
	});

	it("keeps a pending action to the Skelly it was started on", async () => {
		const second = {
			...devicesFixture[0],
			entry_id: "e2",
			device_id: "d2",
			name: "Lily",
		};
		const { hass } = fakeHass([devicesFixture[0] as SkellyDevice, second]);
		let finish = () => {};
		hass.callService.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ context: {} });
				}),
		);
		const panel = await showPanel(hass);
		button(panel, 1, "play").click();
		await settle(panel);
		expect(button(panel, 1, "play").disabled).toBe(true);

		const select = panel.shadowRoot?.querySelector(
			"select",
		) as HTMLSelectElement;
		select.value = "d2";
		select.dispatchEvent(new Event("change"));
		await settle(panel);
		// Lily's file 1 isn't busy, and isn't playing once Santa's play returns
		expect(button(panel, 1, "play").disabled).toBe(false);
		finish();
		await settle(panel);
		expect(row(panel, 1).classList.contains("playing")).toBe(false);
	});

	it("says when a transfer failed or was cancelled", async () => {
		const { hass, send } = fakeHass(one);
		const panel = await showPanel(hass);
		const entry = { ...idlePayload, entry_id: devicesFixture[0].entry_id };
		send({
			...entry,
			transfer: {
				...entry.transfer,
				status: "error",
				filename: "boo.mp3",
				error: "Not enough space",
			},
		});
		await settle(panel);
		expect(text(panel)).toContain("Sending boo.mp3 failed: Not enough space");
		send({
			...entry,
			transfer: { ...entry.transfer, status: "cancelled", filename: "boo.mp3" },
		});
		await settle(panel);
		expect(text(panel)).toContain("Sending boo.mp3 was cancelled.");
	});

	it("shows a failed cancel and doesn't cancel twice", async () => {
		const messages = toasts();
		const { hass } = fakeHass(one, filesFixture as FilesPayload);
		let fail = (_err: unknown) => {};
		hass.callService.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = reject;
				}),
		);
		const panel = await showPanel(hass);
		const bar = panel.shadowRoot?.querySelector("sk-transfer-bar")
			?.shadowRoot as ShadowRoot;
		const cancel = () => bar.querySelector("button") as HTMLButtonElement;
		cancel().click();
		await settle(panel);
		expect(cancel().disabled).toBe(true);
		expect(cancel().textContent).toContain("Cancelling");
		fail({ message: "No file transfer currently in progress" });
		await settle(panel);
		expect(messages).toContain(
			"Couldn't cancel the transfer: No file transfer currently in progress",
		);
		expect(cancel().disabled).toBe(false);
		expect(hass.callService).toHaveBeenCalledTimes(1);
	});

	it("animates lights by mode name, which differs on Lethal Lily", async () => {
		const lily: FilesPayload = {
			...idlePayload,
			device_profile: {
				...idlePayload.device_profile,
				light_modes: ["Flickering", "Pulsing", "Chasing"],
			},
		};
		const { hass } = fakeHass(one, lily);
		const panel = await showPanel(hass);
		const modes = (fileIndex: number) =>
			[...row(panel, fileIndex).querySelectorAll(".swatch")].map((sw) =>
				["strobe", "pulse"].filter((c) => sw.classList.contains(c)).join(),
			);
		// File 1: Flickering (1) and Chasing (3); file 2: Flickering twice
		expect(modes(1)).toEqual(["strobe", ""]);
		expect(modes(2)).toEqual(["strobe", "strobe"]);
	});

	it("looks for Skellies again while none is loaded", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const { hass } = fakeHass(one);
			hass.callWS
				.mockRejectedValueOnce({ code: "unknown_command", message: "Unknown" })
				.mockResolvedValueOnce([]);
			const panel = document.createElement(PANEL_ELEMENT) as Panel;
			panel.hass = hass;
			document.body.append(panel);
			await vi.advanceTimersByTimeAsync(0);
			expect(text(panel)).toContain("Couldn't list your Skellies");
			await vi.advanceTimersByTimeAsync(1000);
			expect(text(panel)).toContain("No Skelly is set up");
			await vi.advanceTimersByTimeAsync(2000);
			await vi.advanceTimersByTimeAsync(0);
			await panel.updateComplete;
			expect(text(panel)).toContain("Skelly Santa");
			expect(hass.callWS).toHaveBeenCalledTimes(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("retries the Skelly list on its backoff, not on every hass update", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const { hass } = fakeHass(one);
			hass.callWS.mockRejectedValue({ code: "unknown_command", message: "x" });
			const panel = document.createElement(PANEL_ELEMENT) as Panel;
			panel.hass = hass;
			document.body.append(panel);
			await vi.advanceTimersByTimeAsync(0);
			// HA sets a new hass object on every state change
			for (let i = 0; i < 5; i++) {
				panel.hass = { ...hass };
				await vi.advanceTimersByTimeAsync(100);
			}
			expect(hass.callWS).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1000);
			expect(hass.callWS).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	describe("edit dialog", () => {
		const editor = (panel: Panel) =>
			panel.shadowRoot?.querySelector("sk-edit-dialog") as HTMLElement & {
				updateComplete: Promise<boolean>;
			};
		const ed = (panel: Panel) => editor(panel).shadowRoot as ShadowRoot;
		const edDialog = (panel: Panel) =>
			ed(panel).querySelector("dialog") as HTMLDialogElement;
		const edButton = (panel: Panel, selector: string) =>
			ed(panel).querySelector(selector) as HTMLButtonElement;
		const flush = async (panel: Panel) => {
			await settle(panel);
			await editor(panel).updateComplete;
		};
		const openEditor = async (panel: Panel, fileIndex = 1) => {
			button(panel, fileIndex, "edit").click();
			await flush(panel);
		};
		const entry = () => ({
			...idlePayload,
			entry_id: devicesFixture[0].entry_id,
		});

		it("saves only what changed", async () => {
			const messages = toasts();
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			expect(edDialog(panel).open).toBe(true);
			expect(ed(panel).textContent).toContain("Edit hello.mp3");
			// Nothing changed yet
			expect(edButton(panel, "button.save").disabled).toBe(true);

			edButton(panel, 'button.movement[data-part="all"]').click();
			await flush(panel);
			expect(
				edButton(panel, 'button.movement[data-part="all"]').getAttribute(
					"aria-pressed",
				),
			).toBe("true");
			expect(
				edButton(panel, 'button.movement[data-part="head"]').getAttribute(
					"aria-pressed",
				),
			).toBe("false");

			const brightness = ed(panel).querySelector(
				'fieldset[data-channel="1"] input.brightness',
			) as HTMLInputElement;
			brightness.value = "200";
			brightness.dispatchEvent(new Event("input"));
			await flush(panel);

			edButton(panel, "button.save").click();
			await flush(panel);
			expect(hass.callService).toHaveBeenLastCalledWith(
				"skelly_ultra",
				"edit_file",
				{
					device_id: DEVICE_ID,
					filename: "hello.mp3",
					movements: ["all"],
					lights: [{ channel: 1, brightness: 200 }],
				},
				undefined,
				false,
				false,
			);
			expect(edDialog(panel).open).toBe(false);
			expect(messages).toContain("Saved hello.mp3");
		});

		it("shows a failed save in the dialog and keeps the changes", async () => {
			const { hass } = fakeHass(one);
			hass.callService.mockRejectedValueOnce({
				code: "home_assistant_error",
				message: "The device is playing a file",
			});
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			await flush(panel);
			edButton(panel, "button.save").click();
			await flush(panel);
			expect(edDialog(panel).open).toBe(true);
			expect(ed(panel).textContent).toContain(
				"Couldn't save: The device is playing a file",
			);
			expect(edButton(panel, "button.save").disabled).toBe(false);
		});

		it("stops a file it played before saving", async () => {
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			button(panel, 2, "play").click();
			await settle(panel);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			await flush(panel);
			edButton(panel, "button.save").click();
			await flush(panel);
			const services = hass.callService.mock.calls.map((c) => c[1]);
			expect(services).toEqual(["play_file", "stop_file", "edit_file"]);
			expect(row(panel, 2).classList.contains("playing")).toBe(false);
		});

		it("previews the file with its saved settings", async () => {
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, "button.preview").click();
			await flush(panel);
			expect(hass.callService).toHaveBeenLastCalledWith(
				"skelly_ultra",
				"play_file",
				{ device_id: DEVICE_ID, file_index: 1 },
				undefined,
				false,
				false,
			);
			expect(edButton(panel, "button.preview").textContent).toContain("Stop");
			edButton(panel, "button.preview").click();
			await flush(panel);
			expect(hass.callService.mock.calls.at(-1)?.[1]).toBe("stop_file");
		});

		it("says when the file changed on the Skelly, and takes the new values", async () => {
			const { hass, send } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			await flush(panel);

			const changed = entry();
			changed.files = changed.files.map((f) =>
				f.file_index === 1 ? { ...f, movements: ["arm"] } : f,
			);
			send(changed);
			await flush(panel);
			expect(ed(panel).textContent).toContain("changed on the Skelly");
			edButton(panel, "button.reload").click();
			await flush(panel);
			expect(ed(panel).textContent).not.toContain("changed on the Skelly");
			expect(
				edButton(panel, 'button.movement[data-part="arm"]').getAttribute(
					"aria-pressed",
				),
			).toBe("true");
			// The user's eye change is gone too
			expect(edButton(panel, "button.save").disabled).toBe(true);
		});

		it("can't save while the Skelly is disconnected or the file is gone", async () => {
			const { hass, send } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			send({ ...entry(), available: false });
			await flush(panel);
			expect(ed(panel).textContent).toContain("not connected");
			expect(edButton(panel, "button.save").disabled).toBe(true);

			send({
				...entry(),
				files: entry().files.filter((f) => f.file_index !== 1),
			});
			await flush(panel);
			expect(ed(panel).textContent).toContain("no longer on the Skelly");
			expect(edButton(panel, "button.save").disabled).toBe(true);
		});

		it("shows a speed only for moving effects, and no eye icons on Lily", async () => {
			const lilyPayload: FilesPayload = {
				...idlePayload,
				device_profile: {
					...idlePayload.device_profile,
					eye_icons: [],
				},
				files: idlePayload.files.map((f) => ({ ...f, eye_icon: null })),
			};
			const { hass } = fakeHass(one, lilyPayload);
			const panel = await showPanel(hass);
			await openEditor(panel);
			expect(ed(panel).querySelector("button.eye")).toBeNull();
			// Channel 0 is Static, channel 1 Pulse
			expect(
				ed(panel).querySelector('fieldset[data-channel="0"] input.speed'),
			).toBeNull();
			expect(
				ed(panel).querySelector('fieldset[data-channel="1"] input.speed'),
			).not.toBeNull();

			const mode = ed(panel).querySelector(
				'fieldset[data-channel="0"] select.mode',
			) as HTMLSelectElement;
			mode.value = "2";
			mode.dispatchEvent(new Event("change"));
			await flush(panel);
			expect(
				ed(panel).querySelector('fieldset[data-channel="0"] input.speed'),
			).not.toBeNull();
		});

		it("discards the changes on Cancel and Escape", async () => {
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			await flush(panel);
			edButton(panel, "button.cancel").click();
			await flush(panel);
			expect(edDialog(panel).open).toBe(false);

			await openEditor(panel);
			expect(edButton(panel, "button.save").disabled).toBe(true);
			edButton(panel, 'button.eye[data-value="2"]').click();
			edDialog(panel).dispatchEvent(new Event("cancel"));
			edDialog(panel).close();
			await flush(panel);
			await openEditor(panel);
			expect(
				edButton(panel, 'button.eye[data-value="2"]').getAttribute(
					"aria-pressed",
				),
			).toBe("false");
			expect(hass.callService).not.toHaveBeenCalled();
		});

		it("can't be cancelled while saving, and reports a save it lost", async () => {
			const messages = toasts();
			const { hass } = fakeHass(one);
			let fail = (_err: unknown) => {};
			hass.callService.mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						fail = reject;
					}),
			);
			const panel = await showPanel(hass);
			await openEditor(panel);
			edButton(panel, 'button.eye[data-value="2"]').click();
			await flush(panel);
			edButton(panel, "button.save").click();
			await flush(panel);
			expect(edButton(panel, "button.cancel").disabled).toBe(true);
			// A browser may still close it (a second Escape)
			edDialog(panel).close();
			edDialog(panel).dispatchEvent(new Event("close"));
			fail({ message: "Lost connection" });
			await flush(panel);
			expect(messages).toContain("Couldn't save hello.mp3: Lost connection");
		});

		it("shows the reloaded effect and clamps typed numbers", async () => {
			const { hass, send } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel);
			const mode = () =>
				ed(panel).querySelector(
					'fieldset[data-channel="0"] select.mode',
				) as HTMLSelectElement;
			mode().value = "3";
			mode().dispatchEvent(new Event("change"));
			await flush(panel);
			mode().value = "1";
			mode().dispatchEvent(new Event("change"));
			await flush(panel);

			const changed = entry();
			changed.files = changed.files.map((f) =>
				f.file_index === 1
					? {
							...f,
							lights: f.lights.map((l) =>
								l.channel === 0 ? { ...l, effect_mode: 3 } : l,
							),
						}
					: f,
			);
			send(changed);
			await flush(panel);
			edButton(panel, "button.reload").click();
			await flush(panel);
			expect(mode().value).toBe("3");

			const number = ed(panel).querySelector(
				'fieldset[data-channel="0"] input.brightness-number',
			) as HTMLInputElement;
			number.value = "300";
			number.dispatchEvent(new Event("change"));
			await flush(panel);
			expect(number.value).toBe("255");
		});

		it("previews the file by its current index", async () => {
			const { hass, send } = fakeHass(one);
			const panel = await showPanel(hass);
			await openEditor(panel, 2);
			// Another file was deleted, and the device renumbered
			send({
				...entry(),
				file_order: [],
				files: entry()
					.files.filter((f) => f.file_index === 2)
					.map((f) => ({ ...f, file_index: 1 })),
			});
			await flush(panel);
			edButton(panel, "button.preview").click();
			await flush(panel);
			expect(hass.callService).toHaveBeenLastCalledWith(
				"skelly_ultra",
				"play_file",
				{ device_id: DEVICE_ID, file_index: 1 },
				undefined,
				false,
				false,
			);
		});

		it("closes when another Skelly is picked", async () => {
			const second = {
				...devicesFixture[0],
				entry_id: "e2",
				device_id: "d2",
				name: "Lily",
			};
			const { hass } = fakeHass([devicesFixture[0] as SkellyDevice, second]);
			const panel = await showPanel(hass);
			await openEditor(panel);
			const select = panel.shadowRoot?.querySelector(
				"select",
			) as HTMLSelectElement;
			select.value = "d2";
			select.dispatchEvent(new Event("change"));
			await flush(panel);
			expect(edDialog(panel).open).toBe(false);
		});
	});

	describe("play order", () => {
		const wait = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		// Past the debounce of the play order writes
		const pause = async (panel: Panel) => {
			await wait(ORDER_DEBOUNCE_MS + 50);
			await settle(panel);
		};
		const checkbox = (panel: Panel, fileIndex: number) =>
			row(panel, fileIndex).querySelector("input.enabled") as HTMLInputElement;
		const click = async (panel: Panel, fileIndex: number) => {
			checkbox(panel, fileIndex).click();
			await settle(panel);
		};
		const shownOrder = (panel: Panel) =>
			[...table(panel).querySelectorAll("tbody tr")].map((r) => [
				Number(r.getAttribute("data-file-index")),
				r.querySelector(".position")?.textContent?.trim(),
			]);
		const orderCalls = (hass: ReturnType<typeof fakeHass>["hass"]) =>
			hass.callService.mock.calls.filter((c) => c[1] === "set_file_order");
		// Three files, all in the play order
		const three: FilesPayload = {
			...idlePayload,
			files: [1, 2, 3].map((file_index) => ({
				...idlePayload.files[0],
				name: `f${file_index}.mp3`,
				file_index,
			})),
			file_order: [1, 2, 3],
		};

		it("puts a file in the play order with its checkbox, after a pause", async () => {
			const { hass, send } = fakeHass(one);
			const panel = await showPanel(hass);
			expect(checkbox(panel, 2).checked).toBe(false);

			await click(panel, 2);
			// Shown at once, written after the pause
			expect(shownOrder(panel)).toEqual([
				[1, "1"],
				[2, "2"],
			]);
			expect(checkbox(panel, 2).checked).toBe(true);
			expect(orderCalls(hass)).toEqual([]);

			await pause(panel);
			expect(orderCalls(hass)).toEqual([
				[
					"skelly_ultra",
					"set_file_order",
					{ device_id: DEVICE_ID, file_indices: [1, 2] },
					undefined,
					false,
					true,
				],
			]);
			// Shown until the Skelly's list comes, then that is shown
			expect(shownOrder(panel)[1]).toEqual([2, "2"]);
			send({
				...idlePayload,
				entry_id: devicesFixture[0].entry_id,
				file_order: [1, 2],
			});
			await settle(panel);
			expect(shownOrder(panel)[1]).toEqual([2, "2"]);
			send({
				...idlePayload,
				entry_id: devicesFixture[0].entry_id,
				file_order: [2],
			});
			await settle(panel);
			expect(shownOrder(panel)).toEqual([
				[2, "1"],
				[1, "–"],
			]);
		});

		it("writes quick changes as one, and nothing if they cancel out", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);

			await click(panel, 2);
			await click(panel, 3);
			expect(shownOrder(panel)).toEqual([
				[1, "1"],
				[2, "–"],
				[3, "–"],
			]);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [1] },
			]);
		});

		it("writes nothing when a change is undone before the pause", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			await click(panel, 3);
			await click(panel, 3);
			await pause(panel);
			expect(orderCalls(hass)).toEqual([]);
			expect(shownOrder(panel).map((r) => r[1])).toEqual(["1", "2", "3"]);
		});

		it("keeps the last file in the play order", async () => {
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			expect(checkbox(panel, 1).disabled).toBe(true);
			expect(checkbox(panel, 1).title).toBe(
				"At least one file must stay in the play order",
			);
			expect(checkbox(panel, 2).disabled).toBe(false);
			// A file without a name can't be ordered
			const nameless = fakeHass(one, {
				...idlePayload,
				files: [idlePayload.files[0], { ...idlePayload.files[1], name: " " }],
			});
			const other = await showPanel(nameless.hass);
			expect(checkbox(other, 2).disabled).toBe(true);
		});

		it("goes back to the Skelly's order and says why when the write fails", async () => {
			const messages = toasts();
			const { hass } = fakeHass(one);
			hass.callService.mockRejectedValueOnce({
				code: "home_assistant_error",
				message: "The device is not connected",
			});
			const panel = await showPanel(hass);
			await click(panel, 2);
			await pause(panel);
			expect(orderCalls(hass)).toHaveLength(1);
			expect(shownOrder(panel)).toEqual([
				[1, "1"],
				[2, "–"],
			]);
			expect(checkbox(panel, 2).checked).toBe(false);
			expect(messages).toContain(
				"Couldn't change the play order: The device is not connected",
			);
		});

		it("locks the files while the order is written, and stops a file it played first", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			button(panel, 1, "play").click();
			await settle(panel);
			let finish = () => {};
			hass.callService.mockImplementation(async (_d, service) =>
				service === "set_file_order"
					? new Promise((resolve) => {
							finish = () => resolve({ context: {}, response: {} });
						})
					: { context: {} },
			);

			await click(panel, 3);
			await pause(panel);
			expect(hass.callService.mock.calls.map((c) => c[1])).toEqual([
				"play_file",
				"stop_file",
				"set_file_order",
			]);
			expect(row(panel, 1).classList.contains("playing")).toBe(false);
			expect(checkbox(panel, 2).disabled).toBe(true);
			expect(checkbox(panel, 2).title).toBe("Saving the play order…");
			expect(button(panel, 2, "play").disabled).toBe(true);
			expect(button(panel, 2, "edit").disabled).toBe(true);

			finish();
			await settle(panel);
			expect(checkbox(panel, 2).disabled).toBe(false);
			expect(button(panel, 2, "play").disabled).toBe(false);
		});

		it("can't be changed during a transfer or while disconnected", async () => {
			const { hass, send } = fakeHass(one, three);
			const panel = await showPanel(hass);
			const entry = { ...three, entry_id: devicesFixture[0].entry_id };
			send({
				...entry,
				transfer: { ...three.transfer, status: "uploading", in_progress: true },
			});
			await settle(panel);
			expect(checkbox(panel, 2).disabled).toBe(true);
			expect(checkbox(panel, 2).title).toContain("reordered");
			send({ ...entry, available: false });
			await settle(panel);
			expect(checkbox(panel, 2).disabled).toBe(true);
		});

		it("moves a dragged file, by its handle", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			const sk = panel.shadowRoot?.querySelector(
				"sk-file-table",
			) as unknown as {
				_sortable: {
					el: HTMLElement;
					options: Record<string, unknown> & {
						onStart: (ev: unknown) => void;
						onEnd: (ev: unknown) => void;
					};
				};
			};
			const sortable = sk._sortable;
			const tbody = table(panel).querySelector("tbody") as HTMLElement;
			expect(sortable.el).toBe(tbody);
			expect(sortable.options).toMatchObject({
				handle: ".handle",
				draggable: ".on",
				forceFallback: true,
				disabled: false,
			});

			// What Sortable does: the first row is moved to the end
			const item = row(panel, 1);
			sortable.options.onStart({ item });
			tbody.append(item);
			sortable.options.onEnd({
				item,
				from: tbody,
				oldDraggableIndex: 0,
				newDraggableIndex: 2,
			});
			await settle(panel);
			expect(shownOrder(panel)).toEqual([
				[2, "1"],
				[3, "2"],
				[1, "3"],
			]);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [2, 3, 1] },
			]);
		});

		type SortableHooks = {
			_sortable: {
				options: Record<string, unknown> & {
					onStart: (ev: unknown) => void;
					onEnd: (ev: unknown) => void;
				};
			};
		};
		const hooks = (panel: Panel) =>
			(
				(panel.shadowRoot as ShadowRoot).querySelector(
					"sk-file-table",
				) as unknown as SortableHooks
			)._sortable.options;

		it("doesn't write while a row is still being dragged", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			await click(panel, 3);
			const tbody = table(panel).querySelector("tbody") as HTMLElement;
			const item = row(panel, 1);
			hooks(panel).onStart({ item });
			// Held past the wait: nothing goes out yet
			await pause(panel);
			expect(orderCalls(hass)).toEqual([]);
			expect(hooks(panel).disabled).toBe(false);
			tbody.append(item);
			hooks(panel).onEnd({
				item,
				from: tbody,
				oldDraggableIndex: 0,
				newDraggableIndex: 1,
			});
			await settle(panel);
			expect(orderCalls(hass)).toEqual([]);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [2, 1] },
			]);
		});

		it("drops a row whose file went away during the drag", async () => {
			const { hass, send } = fakeHass(one, three);
			const panel = await showPanel(hass);
			const tbody = table(panel).querySelector("tbody") as HTMLElement;
			const item = row(panel, 1);
			hooks(panel).onStart({ item });
			tbody.append(item);
			send({
				...three,
				entry_id: devicesFixture[0].entry_id,
				files: three.files.slice(1),
				file_order: [2, 3],
			});
			await settle(panel);
			hooks(panel).onEnd({
				item,
				from: tbody,
				oldDraggableIndex: 0,
				newDraggableIndex: 1,
			});
			await settle(panel);
			expect(item.isConnected).toBe(false);
			expect(shownOrder(panel)).toEqual([
				[2, "1"],
				[3, "2"],
			]);
			await pause(panel);
			expect(orderCalls(hass)).toEqual([]);
		});

		it("shows the Skelly's own order when it differs from the one written", async () => {
			const { hass } = fakeHass(one, three);
			hass.callService.mockImplementation(async (_d, service) =>
				service === "set_file_order"
					? {
							context: {},
							response: {
								file_order: [
									{ file_index: 1, filename: "f1.mp3" },
									{ file_index: 2, filename: "f2.mp3" },
									{ file_index: 3, filename: "f3.mp3" },
								],
							},
						}
					: { context: {} },
			);
			const panel = await showPanel(hass);
			await click(panel, 3);
			await pause(panel);
			expect(orderCalls(hass)).toHaveLength(1);
			expect(shownOrder(panel).map((r) => r[1])).toEqual(["1", "2", "3"]);
		});

		it("shows the Skelly's order again if no new file list comes", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			await click(panel, 3);
			await pause(panel);
			expect(shownOrder(panel)[2]).toEqual([3, "–"]);
			await wait(ORDER_SETTLE_MS);
			await settle(panel);
			expect(shownOrder(panel)[2]).toEqual([3, "3"]);
		});

		it("writes a waiting change before playing a file, without stopping it", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			button(panel, 1, "play").click();
			await settle(panel);
			await click(panel, 3);
			button(panel, 2, "play").click();
			await settle(panel);
			expect(hass.callService.mock.calls.map((c) => c[1])).toEqual([
				"play_file",
				"stop_file",
				"set_file_order",
				"play_file",
			]);
			expect(row(panel, 2).classList.contains("playing")).toBe(true);
			await pause(panel);
			expect(orderCalls(hass)).toHaveLength(1);
		});

		it("leaves nameless files out of the orders it writes", async () => {
			const { hass } = fakeHass(one, {
				...three,
				files: three.files.map((f) =>
					f.file_index === 2 ? { ...f, name: "" } : f,
				),
			});
			const panel = await showPanel(hass);
			expect(checkbox(panel, 2).title).toContain("takes it out");
			// Its row can't be dragged
			expect(row(panel, 2).querySelector(".handle")).toBeNull();
			expect(row(panel, 2).querySelector(".grip.locked")).not.toBeNull();
			expect(checkbox(panel, 1).disabled).toBe(false);
			expect(hooks(panel).disabled).toBe(false);
			await click(panel, 1);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [3] },
			]);
		});

		it("can replace a nameless file that is the only one in the play order", async () => {
			const { hass } = fakeHass(one, {
				...three,
				files: three.files.map((f) =>
					f.file_index === 1 ? { ...f, name: " " } : f,
				),
				file_order: [1],
			});
			const panel = await showPanel(hass);
			expect(checkbox(panel, 1).disabled).toBe(true);
			expect(checkbox(panel, 2).disabled).toBe(false);
			await click(panel, 2);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [2] },
			]);
		});

		it("moves the dragged file even if the rows changed during the drag", async () => {
			const { hass, send } = fakeHass(one, three);
			const panel = await showPanel(hass);
			const tbody = table(panel).querySelector("tbody") as HTMLElement;
			const item = row(panel, 3);
			hooks(panel).onStart({ item });
			// Another file arrives at the top of the play order
			send({
				...three,
				entry_id: devicesFixture[0].entry_id,
				files: [
					...three.files,
					{ ...three.files[0], name: "f4.mp3", file_index: 4 },
				],
				file_order: [4, 1, 2, 3],
			});
			await settle(panel);
			// Dropped at the very top
			tbody.prepend(item);
			hooks(panel).onEnd({
				item,
				from: tbody,
				oldDraggableIndex: 2,
				newDraggableIndex: 0,
			});
			await settle(panel);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [3, 4, 1, 2] },
			]);
		});

		it("ends a drag when the table turns into a list", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass);
			await click(panel, 3);
			hooks(panel).onStart({ item: row(panel, 1) });
			(panel as unknown as { _compact: boolean })._compact = true;
			await settle(panel);
			await pause(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [1, 2] },
			]);
		});

		it("drops the shown order once a file list came during the write", async () => {
			const { hass, send } = fakeHass(one, three);
			hass.callService.mockImplementation(async (_d, service) => {
				if (service === "set_file_order") {
					// The Skelly's list arrives before the reply, with its own order
					send({
						...three,
						entry_id: devicesFixture[0].entry_id,
						file_order: [2, 1],
					});
				}
				return { context: {} };
			});
			const panel = await showPanel(hass);
			await click(panel, 3);
			await pause(panel);
			expect(shownOrder(panel)).toEqual([
				[2, "1"],
				[1, "2"],
				[3, "–"],
			]);
		});

		it("can't drag with one file in the play order, and has no handle for files out of it", async () => {
			const { hass } = fakeHass(one);
			const panel = await showPanel(hass);
			const sk = panel.shadowRoot?.querySelector(
				"sk-file-table",
			) as unknown as {
				_sortable: { options: { disabled: boolean } };
			};
			expect(sk._sortable.options.disabled).toBe(true);
			expect(row(panel, 2).querySelector(".handle.none")).not.toBeNull();
		});

		it("has handles and checkboxes in the narrow list too", async () => {
			const { hass } = fakeHass(one, three);
			const panel = await showPanel(hass, 400);
			const sk = panel.shadowRoot?.querySelector(
				"sk-file-table",
			) as unknown as {
				_sortable: { el: HTMLElement };
			};
			expect(sk._sortable.el.tagName).toBe("UL");
			expect(row(panel, 2).querySelector(".handle")).not.toBeNull();
			checkbox(panel, 2).click();
			await settle(panel);
			expect(row(panel, 2).classList.contains("off")).toBe(true);
		});

		it("writes a waiting change at once when another Skelly is picked", async () => {
			const second = {
				...devicesFixture[0],
				entry_id: "e2",
				device_id: "d2",
				name: "Lily",
			};
			const { hass } = fakeHass([devicesFixture[0] as SkellyDevice, second]);
			const panel = await showPanel(hass);
			await click(panel, 2);
			const select = panel.shadowRoot?.querySelector(
				"select",
			) as HTMLSelectElement;
			select.value = "d2";
			select.dispatchEvent(new Event("change"));
			await settle(panel);
			expect(orderCalls(hass).map((c) => c[2])).toEqual([
				{ device_id: DEVICE_ID, file_indices: [1, 2] },
			]);
			// Lily's table shows Lily's own order
			expect(shownOrder(panel)).toEqual([
				[1, "1"],
				[2, "–"],
			]);
		});
	});

	it("says so when no Skelly is loaded", async () => {
		const { hass, subscribed } = fakeHass([]);
		const panel = await showPanel(hass);
		expect(text(panel)).toContain("No Skelly is set up");
		expect(subscribed).toEqual([]);
	});

	it("unsubscribes when it leaves the page", async () => {
		const { hass, unsubscribe } = fakeHass(one);
		const panel = await showPanel(hass);
		panel.remove();
		expect(unsubscribe).toHaveBeenCalled();
	});
});
