// The target filename of a new file, with the same rules as the backend
// (normalize_target_filename in custom_components/skelly_ultra/uploads.py):
// the device only plays MP3, so a file is always stored as "<stem>.mp3", and
// the whole name must fit the device's limit. The UI asks for the stem and
// shows ".mp3" as a fixed suffix. test/fixtures/filename-cases.json holds
// cases that both sides' tests check.

export const EXTENSION = ".mp3";

// The stored name for a stem
export const filenameOf = (stem: string): string => `${stem}${EXTENSION}`;

export type FilenameProblem = "empty" | "slash" | "long";

// A name's length as the backend counts it: in code points, not UTF-16 units
export const nameLength = (name: string): number => [...name].length;

// Why a stem can't be used, or undefined if it can. maxLength counts the
// whole name, extension included.
export function filenameProblem(
	stem: string,
	maxLength: number,
): FilenameProblem | undefined {
	if (!stem.trim()) {
		return "empty";
	}
	// The backend keeps only the part after the last "/"
	if (stem.includes("/")) {
		return "slash";
	}
	if (nameLength(filenameOf(stem)) > maxLength) {
		return "long";
	}
	return undefined;
}

// A stem suggested from a source's name ("My song.wav", a URL's last path
// part or a media item's title): without folders and extension, trimmed to
// fit maxLength
export function suggestStem(name: string, maxLength: number): string {
	const base = name.split(/[/\\]/).pop() ?? "";
	const dot = base.lastIndexOf(".");
	// A leading dot isn't an extension (".hidden")
	const stem = (dot > 0 ? base.slice(0, dot) : base).trim();
	return [...stem]
		.slice(0, Math.max(0, maxLength - EXTENSION.length))
		.join("")
		.trim();
}

// A URL's last path part, decoded, for suggestStem
export function urlFileName(url: string): string {
	try {
		const parts = new URL(url).pathname.split("/").filter(Boolean);
		const last = parts.at(-1) ?? "";
		try {
			return decodeURIComponent(last);
		} catch {
			return last;
		}
	} catch {
		return "";
	}
}

// A typed URL as it is sent: parsed, so the scheme is lower case as the
// backend expects; undefined if it isn't an http or https URL with a host
export function httpUrl(text: string): string | undefined {
	try {
		const url = new URL(text.trim());
		return (url.protocol === "http:" || url.protocol === "https:") && url.host
			? url.href
			: undefined;
	} catch {
		return undefined;
	}
}

// Whether a typed URL can be sent
export const isHttpUrl = (text: string): boolean => httpUrl(text) !== undefined;
