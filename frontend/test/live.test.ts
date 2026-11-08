import { afterEach, describe, expect, it, vi } from "vitest";

await import("../src/main");

import {
	brightnessOf,
	eyeIconOf,
	eyeIconOption,
	lightCall,
	lightModeOf,
	rgbOf,
} from "../src/api/live";
import type {
	DeviceProfile,
	FilesPayload,
	LiveControls,
} from "../src/api/types";
import {
	PENDING_MS,
	type SkLiveControls,
} from "../src/components/sk-live-controls";
import { LIVE_CONTROLS_ELEMENT } from "../src/constants";
import type { HassEntity } from "../src/ha-types";
import filesFixture from "./fixtures/files-payload.json";

const payload = filesFixture as FilesPayload;
const PROFILE: DeviceProfile = {
	...payload.device_profile,
	eye_icons: [
		{ value: 1, label: "1 Blue Eyeball", url: "/eye_1.png" },
		{ value: 2, label: "2 Yellow Eyeball", url: "/eye_2.png" },
		{ value: 15, label: "15 Heart", url: "/eye_15.png" },
	],
};
const CONTROLS: LiveControls = payload.live_controls;
const [TORSO, HEAD] = CONTROLS.lights;
const movementOf = (part: string) =>
	CONTROLS.movements.find((m) => m.part === part)?.entity as string;

const entity = (
	entity_id: string,
	state: string,
	attributes: Record<string, unknown> = {},
): HassEntity => ({ entity_id, state, attributes });

// Every entity of the fixture's Ultra Skelly, with the Head Light off
function allStates(): Record<string, HassEntity> {
	const list = [
		entity(CONTROLS.eye_icon_entity as string, "2 Yellow Eyeball", {
			options: ["1 Blue Eyeball", "2 Yellow Eyeball", "15 Heart"],
		}),
		entity(CONTROLS.volume_entity as string, "60", { min: 0, max: 100 }),
		entity(CONTROLS.trigger_movement_entity as string, "unknown"),
		entity(movementOf("all"), "off"),
		entity(movementOf("head"), "on"),
		entity(movementOf("arm"), "off"),
		entity(movementOf("torso"), "off"),
		entity(TORSO.light_entity as string, "on", {
			brightness: 200,
			rgb_color: [0, 128, 255],
		}),
		entity(TORSO.effect_mode_entity as string, "Pulse"),
		entity(TORSO.effect_speed_entity as string, "100"),
		entity(TORSO.color_cycle_entity as string, "off"),
		entity(HEAD.light_entity as string, "off", {
			brightness: null,
			rgb_color: null,
		}),
		entity(HEAD.effect_mode_entity as string, "Static"),
		entity(HEAD.effect_speed_entity as string, "0"),
		entity(HEAD.color_cycle_entity as string, "on"),
	];
	return Object.fromEntries(list.map((e) => [e.entity_id, e]));
}

function fakeHass(states = allStates()) {
	return {
		states,
		callService: vi.fn(
			async (
				_domain: string,
				_service: string,
				_data?: Record<string, unknown>,
			) => ({ context: {} }),
		),
	};
}

async function show(
	options: {
		hass?: ReturnType<typeof fakeHass>;
		open?: boolean;
		profile?: DeviceProfile;
		controls?: LiveControls;
		disabledReason?: string;
		onError?: (message: string) => void;
	} = {},
) {
	const el = document.createElement(LIVE_CONTROLS_ELEMENT) as SkLiveControls;
	const hass = options.hass ?? fakeHass();
	el.hass = hass as never;
	el.profile = options.profile ?? PROFILE;
	el.controls = options.controls ?? CONTROLS;
	el.open = options.open ?? true;
	el.disabledReason = options.disabledReason;
	el.onError = options.onError;
	document.body.append(el);
	await el.updateComplete;
	return { el, hass };
}

const root = (el: SkLiveControls) => el.shadowRoot as ShadowRoot;
const q = <T extends Element>(el: SkLiveControls, selector: string) =>
	root(el).querySelector(selector) as T;
const all = <T extends Element>(el: SkLiveControls, selector: string) => [
	...root(el).querySelectorAll<T>(selector),
];
const text = (el: SkLiveControls) =>
	root(el).textContent?.replace(/\s+/g, " ") ?? "";
const light = (el: SkLiveControls, channel: number) =>
	q<HTMLFieldSetElement>(el, `fieldset.light[data-channel="${channel}"]`);
const change = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
	input.value = value;
	input.dispatchEvent(new Event("change"));
};
const lastCall = (hass: ReturnType<typeof fakeHass>) =>
	hass.callService.mock.lastCall?.slice(0, 3);

afterEach(() => {
	document.body.innerHTML = "";
	vi.useRealTimers();
});

describe("live helpers", () => {
	it("read the entities' states", () => {
		expect(eyeIconOf(entity("select.x", "10 Fire"))).toBe(10);
		expect(eyeIconOf(entity("select.x", "unknown"))).toBeNull();
		expect(
			eyeIconOption(
				entity("select.x", "1 A", { options: ["1 A", "10 B", "2 C"] }),
				{ value: 10, label: "10 Other", url: "" },
			),
		).toBe("10 B");
		expect(
			eyeIconOption(undefined, { value: 3, label: "3 Green", url: "" }),
		).toBe("3 Green");
		expect(brightnessOf(entity("light.x", "on", { brightness: 99 }))).toBe(99);
		expect(brightnessOf(entity("light.x", "off", { brightness: 99 }))).toBe(0);
		expect(rgbOf(entity("light.x", "on", { rgb_color: [1, 2, 3] }))).toEqual([
			1, 2, 3,
		]);
		expect(rgbOf(entity("light.x", "off", { rgb_color: null }))).toBe(
			undefined,
		);
		expect(lightModeOf(PROFILE, entity("select.x", "Pulse"))).toBe(3);
		expect(lightModeOf(PROFILE, entity("select.x", "unknown"))).toBe(0);
	});

	it("turn a light off at brightness 0", () => {
		expect(lightCall("light.x", { brightness: 0 })).toEqual({
			domain: "light",
			service: "turn_off",
			data: { entity_id: "light.x" },
		});
		expect(lightCall("light.x", { rgb: [1, 2, 3] })).toEqual({
			domain: "light",
			service: "turn_on",
			data: { entity_id: "light.x", rgb_color: [1, 2, 3] },
		});
	});
});

describe("live controls", () => {
	it("open and close from the header", async () => {
		const { el } = await show({ open: false });
		const head = q<HTMLButtonElement>(el, "button.head");
		expect(head.getAttribute("aria-expanded")).toBe("false");
		expect(head.textContent).toContain("Live controls");
		expect(q(el, ".body")).toBeNull();
		const opened = vi.fn();
		el.addEventListener("sk-live-open", (ev) =>
			opened((ev as CustomEvent).detail),
		);
		head.click();
		expect(opened).toHaveBeenLastCalledWith({ open: true });
		// The panel or card keeps it
		expect(q(el, ".body")).toBeNull();
		el.open = true;
		await el.updateComplete;
		expect(q(el, ".body")).not.toBeNull();
		q<HTMLButtonElement>(el, "button.head").click();
		expect(opened).toHaveBeenLastCalledWith({ open: false });
	});

	it("set the eye icon", async () => {
		const { el, hass } = await show();
		const eyes = all<HTMLButtonElement>(el, "button.eye");
		expect(eyes.map((b) => b.getAttribute("aria-pressed"))).toEqual([
			"false",
			"true",
			"false",
		]);
		eyes[2].click();
		await el.updateComplete;
		expect(lastCall(hass)).toEqual([
			"select",
			"select_option",
			{ entity_id: CONTROLS.eye_icon_entity, option: "15 Heart" },
		]);
		// Shown right away
		expect(eyes[2].getAttribute("aria-pressed")).toBe("true");
		expect(eyes[1].getAttribute("aria-pressed")).toBe("false");
	});

	it("turn movement parts on and off, and move once more", async () => {
		const { el, hass } = await show();
		const chips = all<HTMLButtonElement>(el, "button.movement");
		expect(chips.map((b) => b.dataset.part)).toEqual([
			"all",
			"head",
			"arm",
			"torso",
		]);
		expect(chips.map((b) => b.getAttribute("aria-pressed"))).toEqual([
			"false",
			"true",
			"false",
			"false",
		]);
		chips[2].click();
		expect(lastCall(hass)).toEqual([
			"switch",
			"turn_on",
			{ entity_id: movementOf("arm") },
		]);
		chips[1].click();
		expect(lastCall(hass)).toEqual([
			"switch",
			"turn_off",
			{ entity_id: movementOf("head") },
		]);
		const move = q<HTMLButtonElement>(el, "button.move");
		expect(move.disabled).toBe(false);
		move.click();
		expect(lastCall(hass)).toEqual([
			"button",
			"press",
			{ entity_id: CONTROLS.trigger_movement_entity },
		]);
	});

	it("can't move with no part ticked", async () => {
		const hass = fakeHass();
		hass.states[movementOf("head")] = entity(movementOf("head"), "off");
		const { el } = await show({ hass });
		expect(q<HTMLButtonElement>(el, "button.move").disabled).toBe(true);
	});

	it("change a light's brightness, color, effect and color cycle", async () => {
		const { el, hass } = await show();
		const torso = light(el, 0);
		expect(torso.querySelector("legend")?.textContent).toBe("Torso Light");
		const brightness = torso.querySelector(
			"input.brightness",
		) as HTMLInputElement;
		expect(brightness.value).toBe("200");
		expect((torso.querySelector("input.color") as HTMLInputElement).value).toBe(
			"#0080ff",
		);
		expect((torso.querySelector("input.on") as HTMLInputElement).checked).toBe(
			true,
		);
		change(brightness, "50");
		expect(lastCall(hass)).toEqual([
			"light",
			"turn_on",
			{ entity_id: TORSO.light_entity, brightness: 50 },
		]);
		change(brightness, "0");
		expect(lastCall(hass)).toEqual([
			"light",
			"turn_off",
			{ entity_id: TORSO.light_entity },
		]);
		change(torso.querySelector("input.color") as HTMLInputElement, "#ff0000");
		expect(lastCall(hass)).toEqual([
			"light",
			"turn_on",
			{ entity_id: TORSO.light_entity, rgb_color: [255, 0, 0] },
		]);
		const mode = torso.querySelector("select.mode") as HTMLSelectElement;
		// happy-dom picks the wrong option on the first render; browsers
		// follow the selected attribute
		expect(mode.querySelector("option[selected]")?.textContent?.trim()).toBe(
			"Pulse",
		);
		change(mode, "2");
		expect(lastCall(hass)).toEqual([
			"select",
			"select_option",
			{ entity_id: TORSO.effect_mode_entity, option: "Strobe" },
		]);
		const speed = torso.querySelector("input.speed") as HTMLInputElement;
		expect(speed.value).toBe("100");
		change(speed, "200");
		expect(lastCall(hass)).toEqual([
			"number",
			"set_value",
			{ entity_id: TORSO.effect_speed_entity, value: 200 },
		]);
		const cycle = torso.querySelector("input.cycle") as HTMLInputElement;
		cycle.checked = true;
		cycle.dispatchEvent(new Event("change"));
		expect(lastCall(hass)).toEqual([
			"switch",
			"turn_on",
			{ entity_id: TORSO.color_cycle_entity },
		]);
	});

	it("turn a light on and off, keeping its color while off", async () => {
		const hass = fakeHass();
		const { el } = await show({ hass });
		const head = light(el, 1);
		const on = head.querySelector("input.on") as HTMLInputElement;
		expect(on.checked).toBe(false);
		expect(
			(head.querySelector("input.brightness") as HTMLInputElement).value,
		).toBe("0");
		// Static has no effect speed
		expect(head.querySelector("input.speed")).toBeNull();
		on.checked = true;
		on.dispatchEvent(new Event("change"));
		expect(lastCall(hass)).toEqual([
			"light",
			"turn_on",
			{ entity_id: HEAD.light_entity },
		]);
		// Off again: the color it last reported stays
		hass.states[HEAD.light_entity as string] = entity(
			HEAD.light_entity as string,
			"on",
			{ brightness: 255, rgb_color: [10, 20, 30] },
		);
		el.hass = { ...hass, states: { ...hass.states } } as never;
		await el.updateComplete;
		hass.states[HEAD.light_entity as string] = entity(
			HEAD.light_entity as string,
			"off",
			{ brightness: null, rgb_color: null },
		);
		el.hass = { ...hass, states: { ...hass.states } } as never;
		await el.updateComplete;
		expect(
			(light(el, 1).querySelector("input.color") as HTMLInputElement).value,
		).toBe("#0a141e");
		expect(
			(light(el, 1).querySelector("input.on") as HTMLInputElement).checked,
		).toBe(false);
	});

	it("show an unknown effect or volume as unknown", async () => {
		const hass = fakeHass();
		const modeId = TORSO.effect_mode_entity as string;
		const volumeId = CONTROLS.volume_entity as string;
		hass.states[modeId] = entity(modeId, "unknown");
		hass.states[volumeId] = entity(volumeId, "unknown");
		const { el } = await show({ hass });
		const mode = light(el, 0).querySelector("select.mode") as HTMLSelectElement;
		expect(mode.options[0].value).toBe("0");
		expect(mode.options[0].hidden).toBe(true);
		expect(text(el)).toContain("–");
		expect(text(el)).not.toContain("%");
		change(mode, "1");
		expect((hass.callService.mock.lastCall as unknown[]).slice(0, 3)).toEqual([
			"select",
			"select_option",
			{ entity_id: modeId, option: "Static" },
		]);
	});

	it("set the volume", async () => {
		const { el, hass } = await show();
		const volume = q<HTMLInputElement>(el, "input.volume");
		expect(volume.value).toBe("60");
		expect(text(el)).toContain("60%");
		change(volume, "80");
		expect(lastCall(hass)).toEqual([
			"number",
			"set_value",
			{ entity_id: CONTROLS.volume_entity, value: 80 },
		]);
	});

	it("show a value sent until the entity reports, then the entity's", async () => {
		vi.useFakeTimers();
		const hass = fakeHass();
		const { el } = await show({ hass });
		change(q<HTMLInputElement>(el, "input.volume"), "80");
		await el.updateComplete;
		expect(text(el)).toContain("80%");
		// Another entity changing doesn't end it
		el.hass = {
			...hass,
			states: {
				...hass.states,
				[movementOf("arm")]: entity(movementOf("arm"), "on"),
			},
		} as never;
		await el.updateComplete;
		expect(text(el)).toContain("80%");
		// The Skelly took 75 instead
		const volumeId = CONTROLS.volume_entity as string;
		el.hass = {
			...hass,
			states: { ...hass.states, [volumeId]: entity(volumeId, "75") },
		} as never;
		await el.updateComplete;
		expect(text(el)).toContain("75%");
		// No report at all: back to the entity's value after a while
		change(q<HTMLInputElement>(el, "input.volume"), "10");
		await el.updateComplete;
		expect(text(el)).toContain("10%");
		// (the wait starts once the call is done)
		await vi.advanceTimersByTimeAsync(PENDING_MS - 1);
		expect(text(el)).toContain("10%");
		await vi.advanceTimersByTimeAsync(1);
		await el.updateComplete;
		expect(text(el)).toContain("75%");
	});

	it("say when a change fails, and show the entity's value again", async () => {
		const hass = fakeHass();
		hass.callService.mockRejectedValueOnce(new Error("Not connected"));
		const onError = vi.fn();
		const { el } = await show({ hass, onError });
		all<HTMLButtonElement>(el, "button.eye")[0].click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await el.updateComplete;
		expect(onError).toHaveBeenCalledWith(
			"Couldn't change the Skelly: Not connected",
		);
		expect(
			all<HTMLButtonElement>(el, "button.eye").map((b) =>
				b.getAttribute("aria-pressed"),
			),
		).toEqual(["false", "true", "false"]);
	});

	it("can't be used while disabled", async () => {
		const { el, hass } = await show({
			disabledReason: "The Skelly is not connected",
		});
		expect(text(el)).toContain("The Skelly is not connected");
		const controls = all<HTMLInputElement | HTMLButtonElement>(
			el,
			".body input, .body select, .body button",
		);
		expect(controls.length).toBeGreaterThan(10);
		expect(controls.every((c) => c.disabled)).toBe(true);
		expect(hass.callService).not.toHaveBeenCalled();
	});

	it("disables a control whose entity is unavailable", async () => {
		const hass = fakeHass();
		const eyeId = CONTROLS.eye_icon_entity as string;
		hass.states[eyeId] = entity(eyeId, "unavailable");
		const { el } = await show({ hass });
		expect(
			all<HTMLButtonElement>(el, "button.eye").every((b) => b.disabled),
		).toBe(true);
		expect(q<HTMLInputElement>(el, "input.volume").disabled).toBe(false);
	});

	it("leave out what the entities don't have, e.g. disabled ones", async () => {
		const hass = fakeHass();
		delete hass.states[CONTROLS.eye_icon_entity as string];
		delete hass.states[movementOf("arm")];
		delete hass.states[CONTROLS.trigger_movement_entity as string];
		delete hass.states[HEAD.light_entity as string];
		delete hass.states[HEAD.effect_mode_entity as string];
		delete hass.states[HEAD.effect_speed_entity as string];
		delete hass.states[HEAD.color_cycle_entity as string];
		const { el } = await show({ hass });
		expect(all(el, "button.eye")).toEqual([]);
		expect(
			all<HTMLButtonElement>(el, "button.movement").map((b) => b.dataset.part),
		).toEqual(["all", "head", "torso"]);
		expect(q(el, "button.move")).toBeNull();
		expect(all(el, "fieldset.light").length).toBe(1);

		const { el: empty } = await show({ hass: fakeHass({}) });
		expect(text(empty)).toContain("No live controls");
	});

	it("follow the Skelly's profile: the 12ft Skelly", async () => {
		const profile: DeviceProfile = {
			...PROFILE,
			type: "skelly_12ft",
			movements: [PROFILE.movements[1]],
			lights: [PROFILE.lights[0]],
		};
		const controls: LiveControls = {
			...CONTROLS,
			movements: [{ part: "head", entity: movementOf("head") }],
			lights: [TORSO],
		};
		const { el } = await show({ profile, controls });
		expect(
			all<HTMLButtonElement>(el, "button.movement").map((b) => b.dataset.part),
		).toEqual(["head"]);
		expect(all(el, "fieldset.light").length).toBe(1);
		expect(all(el, "button.eye").length).toBe(3);
	});

	it("follow the Skelly's profile: Lethal Lily has no eye icon", async () => {
		const { el } = await show({
			profile: { ...PROFILE, eye_icons: [] },
			controls: { ...CONTROLS, eye_icon_entity: null },
		});
		expect(all(el, "button.eye")).toEqual([]);
		expect(text(el)).not.toContain("Eye icon");
	});
});
