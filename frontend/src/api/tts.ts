// Home Assistant's text-to-speech engines, their languages and voices, and
// previews, for the Text to speech tab. The Skelly gets the speech through
// send_file_from_tts (actions.ts); a preview is a separate TTS request.

import type { HomeAssistant } from "../ha-types";
import { EXTENSION } from "./filename";

export interface TtsEngine {
	// A tts.* entity, or a legacy provider's name
	engine_id: string;
	name: string;
	// null if the engine doesn't say
	languages: string[] | null;
}

export interface TtsVoice {
	voice_id: string;
	name: string;
}

interface EngineListResult {
	providers: {
		engine_id: string;
		name?: string;
		supported_languages?: string[] | null;
		deprecated?: boolean;
	}[];
}

// The engines, by name. Legacy providers that have an entity now are left
// out (HA marks them deprecated).
export async function listEngines(hass: HomeAssistant): Promise<TtsEngine[]> {
	const { providers } = await hass.callWS<EngineListResult>({
		type: "tts/engine/list",
	});
	return providers
		.filter((p) => !p.deprecated)
		.map((p) => {
			const friendly = hass.states[p.engine_id]?.attributes.friendly_name;
			return {
				engine_id: p.engine_id,
				name:
					typeof friendly === "string" && friendly
						? friendly
						: (p.name ?? p.engine_id),
				languages: p.supported_languages ?? null,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

// An engine's voices for a language; empty if it has none to choose from
export async function listVoices(
	hass: HomeAssistant,
	engineId: string,
	language: string,
): Promise<TtsVoice[]> {
	const { voices } = await hass.callWS<{ voices: TtsVoice[] | null }>({
		type: "tts/engine/voices",
		engine_id: engineId,
		language,
	});
	return voices ?? [];
}

// "en_US" and "en-us" are the same language
const normalized = (language: string) =>
	language.replace(/_/g, "-").toLowerCase();

// The language to start with: the remembered one, else the user's HA
// language (or a variant of it, the one for HA's country first: "en" →
// "en-US" in the US), else the engine's first. undefined if the engine
// lists none.
export function pickLanguage(
	languages: string[] | null,
	preferred: (string | undefined)[],
	country?: string,
): string | undefined {
	if (!languages?.length) {
		return undefined;
	}
	for (const wanted of preferred) {
		if (!wanted) {
			continue;
		}
		const exact = languages.find((l) => normalized(l) === normalized(wanted));
		if (exact) {
			return exact;
		}
		const base = normalized(wanted).split("-")[0];
		const local =
			country &&
			languages.find(
				(l) => normalized(l) === `${base}-${country.toLowerCase()}`,
			);
		if (local) {
			return local;
		}
		const variant = languages.find(
			(l) => normalized(l) === base || normalized(l).startsWith(`${base}-`),
		);
		if (variant) {
			return variant;
		}
	}
	return languages[0];
}

export type OptionsProblem = "yaml" | "object";

export type ParsedOptions =
	| { options: Record<string, unknown> }
	| { problem: OptionsProblem };

// What HA's YAML editor (ha-yaml-editor) parsed: empty is no options, and
// anything but a mapping (a list, a plain value) is a problem
export function yamlOptions(value: unknown, isValid: boolean): ParsedOptions {
	if (!isValid) {
		return { problem: "yaml" };
	}
	if (value === undefined) {
		return { options: {} };
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { problem: "object" };
	}
	return { options: value as Record<string, unknown> };
}

// What send_file_from_tts and a preview need (target_filename aside)
export interface TtsSpeech {
	tts_entity: string;
	message: string;
	language?: string;
	tts_options?: Record<string, unknown>;
}

// The options sent: the Advanced ones, with the picked voice
export function speechOptions(
	voice: string | undefined,
	advanced: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const options = voice ? { ...advanced, voice } : advanced;
	return Object.keys(options).length ? options : undefined;
}

export class PreviewError extends Error {}

// Has HA speak the message and returns the audio's path. No cache, so it
// is always a new request to the engine.
export async function previewSpeech(
	hass: HomeAssistant,
	speech: TtsSpeech,
	signal?: AbortSignal,
): Promise<string> {
	const response = await hass.fetchWithAuth("/api/tts_get_url", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			engine_id: speech.tts_entity,
			message: speech.message,
			language: speech.language,
			options: speech.tts_options,
			cache: false,
		}),
		signal,
	});
	let body: { path?: string; message?: string; error?: unknown } = {};
	try {
		body = await response.json();
	} catch {
		// Said below
	}
	if (!response.ok || !body.path) {
		throw new PreviewError(
			body.message ??
				(typeof body.error === "string" ? body.error : undefined) ??
				`HTTP ${response.status}`,
		);
	}
	return body.path;
}

// A stem from a message, like the backend's default name (HA's slugify):
// lower case, accents dropped, words joined by "_", trimmed to fit. The
// backend's transliterates more scripts; this is only a suggestion.
export function messageStem(message: string, maxLength: number): string {
	const slug = message
		.replace(/ß/g, "ss")
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "_")
		.replace(/^_+|_+$/g, "");
	return [...slug]
		.slice(0, Math.max(0, maxLength - EXTENSION.length))
		.join("")
		.replace(/_+$/, "");
}

// The last engine, language and voice, per HA user
export interface TtsChoice {
	engine?: string;
	language?: string;
	voice?: string;
}

const choiceKey = (userId: string | undefined) =>
	`skelly_ultra.tts.${userId ?? "anyone"}`;

export function loadChoice(userId: string | undefined): TtsChoice {
	try {
		const value: unknown = JSON.parse(
			localStorage.getItem(choiceKey(userId)) ?? "{}",
		);
		if (typeof value !== "object" || value === null) {
			return {};
		}
		const { engine, language, voice } = value as Record<string, unknown>;
		const text = (v: unknown) => (typeof v === "string" ? v : undefined);
		return {
			engine: text(engine),
			language: text(language),
			voice: text(voice),
		};
	} catch {
		return {};
	}
}

export function saveChoice(userId: string | undefined, choice: TtsChoice) {
	try {
		localStorage.setItem(choiceKey(userId), JSON.stringify(choice));
	} catch {
		// Private mode or storage full: not remembered
	}
}
