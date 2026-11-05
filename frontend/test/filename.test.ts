import { describe, expect, it } from "vitest";
import {
	filenameOf,
	filenameProblem,
	httpUrl,
	isHttpUrl,
	nameLength,
	suggestStem,
	urlFileName,
} from "../src/api/filename";
import cases from "./fixtures/filename-cases.json";

const MAX = cases.max_filename_length;

describe("filenameProblem", () => {
	// The same cases as the backend's test_filename_rules_match_the_frontend
	it.each(cases.cases)("matches the backend for %j", (c) => {
		const problem = filenameProblem(c.stem, MAX);
		expect(problem === undefined).toBe(c.valid);
		if (!c.valid) {
			expect(problem).toBe(c.problem);
		}
	});

	it("treats blanks as empty", () => {
		expect(filenameProblem("   ", MAX)).toBe("empty");
	});

	it("counts code points, not UTF-16 units", () => {
		expect(nameLength(filenameOf("🎃"))).toBe(5);
	});
});

describe("suggestStem", () => {
	it("drops folders and the extension", () => {
		expect(suggestStem("C:\\music\\My song.wav", MAX)).toBe("My song");
		expect(suggestStem("a/b/boo.mp3", MAX)).toBe("boo");
		expect(suggestStem(".hidden", MAX)).toBe(".hidden");
		expect(suggestStem("Track 1", MAX)).toBe("Track 1");
	});

	it("cuts to fit the device's limit", () => {
		const stem = suggestStem(`${"🎃".repeat(40)}.mp3`, MAX);
		expect(nameLength(stem)).toBe(MAX - 4);
		expect(filenameProblem(stem, MAX)).toBeUndefined();
		expect(suggestStem(`${"a".repeat(28)} b.ogg`, MAX)).toBe("a".repeat(28));
	});
});

describe("URLs", () => {
	it("takes the last path part, decoded", () => {
		expect(urlFileName("https://x.org/sounds/Evil%20Laugh.mp3?x=1")).toBe(
			"Evil Laugh.mp3",
		);
		expect(urlFileName("https://x.org/")).toBe("");
		expect(urlFileName("https://x.org/%E0%A4%A")).toBe("%E0%A4%A");
		expect(urlFileName("not a url")).toBe("");
	});

	it("accepts http and https only", () => {
		expect(isHttpUrl(" https://x.org/a.mp3 ")).toBe(true);
		expect(isHttpUrl("http://192.168.1.2:8123/a")).toBe(true);
		expect(isHttpUrl("ftp://x.org/a.mp3")).toBe(false);
		expect(isHttpUrl("media-source://media_source/local/a.mp3")).toBe(false);
		expect(isHttpUrl("x.org/a.mp3")).toBe(false);
		expect(isHttpUrl("")).toBe(false);
		// The backend wants the scheme in lower case
		expect(httpUrl(" HTTPS://X.org/A.mp3")).toBe("https://x.org/A.mp3");
	});
});
