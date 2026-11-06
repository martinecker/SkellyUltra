import { describe, expect, it } from "vitest";
import {
	messageStem,
	pickLanguage,
	speechOptions,
	yamlOptions,
} from "../src/api/tts";

describe("text to speech helpers", () => {
	it("picks the remembered language, else the user's, else the first", () => {
		const languages = ["de-DE", "en-GB", "en-US"];
		expect(pickLanguage(languages, ["en-GB", "en"])).toBe("en-GB");
		expect(pickLanguage(languages, [undefined, "en-us"])).toBe("en-US");
		expect(pickLanguage(languages, [undefined, "en"])).toBe("en-GB");
		expect(pickLanguage(["de_DE", "en_US"], ["en-US"])).toBe("en_US");
		expect(pickLanguage(languages, ["fr"])).toBe("de-DE");
		expect(pickLanguage([], ["en"])).toBeUndefined();
		expect(pickLanguage(null, ["en"])).toBeUndefined();
		// HA's country picks the variant
		expect(pickLanguage(languages, [undefined, "en"], "US")).toBe("en-US");
		expect(pickLanguage(["sr_Latn_RS"], ["sr-latn-rs"])).toBe("sr_Latn_RS");
	});

	it("reads the extra options from the YAML editor", () => {
		expect(yamlOptions({}, true)).toEqual({ options: {} });
		expect(yamlOptions(undefined, true)).toEqual({ options: {} });
		expect(yamlOptions({ speed: 1 }, true)).toEqual({ options: { speed: 1 } });
		expect(yamlOptions({ speed: 1 }, false)).toEqual({ problem: "yaml" });
		expect(yamlOptions([1], true)).toEqual({ problem: "object" });
		expect(yamlOptions(null, true)).toEqual({ problem: "object" });
		expect(yamlOptions("x", true)).toEqual({ problem: "object" });
	});

	it("adds the picked voice to the options", () => {
		expect(speechOptions(undefined, {})).toBeUndefined();
		expect(speechOptions("amy", {})).toEqual({ voice: "amy" });
		expect(speechOptions("amy", { voice: "x", speed: 1 })).toEqual({
			voice: "amy",
			speed: 1,
		});
		expect(speechOptions(undefined, { speed: 1 })).toEqual({ speed: 1 });
	});

	it("makes a name from a message", () => {
		expect(messageStem("Welcome, mortal! Come closer.", 33)).toBe(
			"welcome_mortal_come_closer",
		);
		expect(messageStem("Grüße aus dem Grab", 33)).toBe("grusse_aus_dem_grab");
		expect(messageStem("!!!", 33)).toBe("");
		// Cut to fit, without a trailing "_"
		expect(messageStem("aaaaa bbbbb ccccc ddddd eeeee fffff", 33)).toBe(
			"aaaaa_bbbbb_ccccc_ddddd_eeeee",
		);
	});
});
