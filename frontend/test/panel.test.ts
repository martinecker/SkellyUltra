import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/main";
import type { FilesPayload, SkellyDevice } from "../src/api/types";
import { PANEL_ELEMENT } from "../src/constants";
import devicesFixture from "./fixtures/devices.json";
import filesFixture from "./fixtures/files-payload.json";

type Panel = HTMLElement & { hass: unknown; updateComplete: Promise<boolean> };

const settle = async (panel: Panel) => {
	for (let i = 0; i < 5; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await panel.updateComplete;
	}
};

function fakeHass(devices: SkellyDevice[]) {
	const subscribed: Record<string, unknown>[] = [];
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
				const name = devices.find(
					(d) =>
						d.device_id === message.device_id ||
						d.entry_id === message.entry_id,
				)?.name;
				setTimeout(() =>
					callback({ ...(filesFixture as FilesPayload), name: name ?? "?" }),
				);
				return unsubscribe;
			},
		),
	};
	const hass = {
		connection,
		user: { name: "Martin" },
		callWS: vi.fn().mockResolvedValue(devices),
	};
	return { hass, subscribed, unsubscribe };
}

async function showPanel(hass: unknown): Promise<Panel> {
	const panel = document.createElement(PANEL_ELEMENT) as Panel;
	panel.hass = hass;
	document.body.append(panel);
	await settle(panel);
	return panel;
}

const text = (panel: Panel) => panel.shadowRoot?.textContent ?? "";

describe("panel", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		history.replaceState(null, "", "/");
	});

	it("shows the live files of the only Skelly", async () => {
		const { hass, subscribed } = fakeHass(devicesFixture as SkellyDevice[]);
		const panel = await showPanel(hass);

		expect(hass.callWS).toHaveBeenCalledWith({
			type: "skelly_ultra/devices/list",
		});
		expect(subscribed).toEqual([
			{
				type: "skelly_ultra/files/subscribe",
				device_id: devicesFixture[0].device_id,
			},
		]);
		expect(text(panel)).toContain("Skelly Santa");
		expect(text(panel)).toContain("Live");
		expect(text(panel)).toContain('"file_order"');
		// One Skelly: no picker
		expect(panel.shadowRoot?.querySelector("select")).toBeNull();
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

		const select = panel.shadowRoot?.querySelector(
			"select",
		) as HTMLSelectElement;
		select.value = devicesFixture[0].device_id;
		select.dispatchEvent(new Event("change"));
		await settle(panel);

		expect(unsubscribe).toHaveBeenCalled();
		expect(subscribed.at(-1)).toMatchObject({
			device_id: devicesFixture[0].device_id,
		});
		expect(new URL(window.location.href).searchParams.get("device")).toBe(
			devicesFixture[0].device_id,
		);
	});

	it("says so when no Skelly is loaded", async () => {
		const { hass, subscribed } = fakeHass([]);
		const panel = await showPanel(hass);
		expect(text(panel)).toContain("No Skelly is set up");
		expect(subscribed).toEqual([]);
	});

	it("unsubscribes when it leaves the page", async () => {
		const { hass, unsubscribe } = fakeHass(devicesFixture as SkellyDevice[]);
		const panel = await showPanel(hass);
		panel.remove();
		expect(unsubscribe).toHaveBeenCalled();
	});
});
