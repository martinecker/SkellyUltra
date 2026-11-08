import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_ELEMENT, PANEL_ELEMENT } from "../src/constants";
import { register, registerAgainAfterHaBoots } from "../src/main";

describe("register", () => {
	it("defines the panel and the card and adds the card to the picker", () => {
		expect(customElements.get(PANEL_ELEMENT)).toBeDefined();
		expect(customElements.get(CARD_ELEMENT)).toBeDefined();
		expect(
			window.customCards?.filter((c) => c.type === CARD_ELEMENT),
		).toHaveLength(1);
	});

	it("can run again, as when the bundle is loaded twice", () => {
		register();
		expect(
			window.customCards?.filter((c) => c.type === CARD_ELEMENT),
		).toHaveLength(1);
	});

	describe("after Home Assistant's app replaces the registry", () => {
		const original = window.customElements;

		// A registry like HA's polyfill: starts empty, records definitions
		function fakeRegistry(): CustomElementRegistry {
			const defined = new Map<string, CustomElementConstructor>();
			return {
				get: (name: string) => defined.get(name),
				define: (name: string, element: CustomElementConstructor) => {
					defined.set(name, element);
				},
			} as unknown as CustomElementRegistry;
		}

		function replaceRegistry(registry: CustomElementRegistry): void {
			Object.defineProperty(window, "customElements", {
				value: registry,
				configurable: true,
			});
		}

		afterEach(() => {
			replaceRegistry(original);
			vi.restoreAllMocks();
		});

		it("defines everything again in the new registry once HA booted", async () => {
			let booted: (value: CustomElementConstructor) => void = () => {};
			const atLoad = fakeRegistry();
			atLoad.whenDefined = vi.fn(
				() =>
					new Promise<CustomElementConstructor>((resolve) => {
						booted = resolve;
					}),
			);
			const replaced = fakeRegistry();
			replaceRegistry(replaced);

			const done = registerAgainAfterHaBoots(atLoad);
			await Promise.resolve();
			expect(atLoad.whenDefined).toHaveBeenCalledWith("home-assistant");
			expect(replaced.get(CARD_ELEMENT)).toBeUndefined();

			booted(HTMLElement);
			await done;
			expect(replaced.get(PANEL_ELEMENT)).toBe(original.get(PANEL_ELEMENT));
			expect(replaced.get(CARD_ELEMENT)).toBe(original.get(CARD_ELEMENT));
			expect(
				window.customCards?.filter((c) => c.type === CARD_ELEMENT),
			).toHaveLength(1);
		});

		it("does nothing when the registry wasn't replaced", async () => {
			const registry = fakeRegistry();
			registry.whenDefined = vi.fn().mockResolvedValue(HTMLElement);
			replaceRegistry(registry);

			await registerAgainAfterHaBoots(registry);

			expect(registry.whenDefined).toHaveBeenCalledWith("home-assistant");
			expect(registry.get(CARD_ELEMENT)).toBeUndefined();
		});
	});
});
