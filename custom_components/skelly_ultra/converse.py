"""The skelly_ultra.converse action: several Skellys hold a conversation.

An AI Task entity writes the whole script in one request, each line is
rendered with the speaking Skelly's own voice, and the lines play one after
another through each Skelly's live-mode speaker, with the line's mood on the
Skelly that speaks it. Builds on SkellyStage (stage.py), which the perform
action uses too.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN, MOODS
from .stage import (
    DEFAULT_CAMERA_WAIT,
    DEFAULT_LIVE_MODE_TIMEOUT,
    MOOD_AUTO,
    MOOD_NONE,
    MOVEMENT_MOOD,
    MOVEMENT_NONE,
    SkellyStage,
    StageState,
    async_generate_ai_data,
    async_remove_file,
    async_render_tts,
    async_wait_all,
    async_wait_for_camera_update,
    check_tts,
)

_LOGGER = logging.getLogger(__name__)

MAX_PARTICIPANTS = 6
DEFAULT_MAX_LINES = 6
DEFAULT_PAUSE = 0.3
HISTORY_SIZE = 10
HISTORY_STORAGE_VERSION = 1
# Lines rendered by the TTS entities at the same time
TTS_CONCURRENCY = 3

LINE_ERROR_SKIP = "skip"
LINE_ERROR_ABORT = "abort"

ADAPTER_HINT = (
    "With several Skellys in live mode, each needs its own Bluetooth adapter "
    "on its REST server"
)

DATA_CONVERSE: HassKey[ConverseHistory] = HassKey(f"{DOMAIN}_converse")

# Optional fields a blueprint may pass as empty when its input is left blank
_BLANKABLE = (
    "camera_entity",
    "ai_task_entity",
    "language",
    "tts_options",
    "tts_entity",
)
_PARTICIPANT_BLANKABLE = (
    "device_id",
    "entity_id",
    "persona",
    "language",
    "tts_options",
    "tts_entity",
)

_NON_BLANK = vol.All(cv.string, vol.Strip, vol.Length(min=1, msg="must not be empty"))


def _drop_blank(data: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if k not in keys or v}


def _validate_participant(data: dict[str, Any]) -> dict[str, Any]:
    data = _drop_blank(data, _PARTICIPANT_BLANKABLE)
    if not data.get("device_id") and not data.get("entity_id"):
        raise vol.Invalid("each participant needs a device_id or entity_id")
    return data


PARTICIPANT_SCHEMA = vol.All(
    {
        vol.Optional("device_id"): vol.Any(None, "", cv.string),
        vol.Optional("entity_id"): vol.Any(None, "", cv.entity_id),
        vol.Required("name"): _NON_BLANK,
        vol.Optional("persona"): vol.Any(None, vol.All(cv.string, vol.Strip)),
        vol.Optional("tts_entity"): vol.Any(None, "", cv.entity_domain("tts")),
        vol.Optional("tts_options"): vol.Any(None, "", dict),
        vol.Optional("language"): vol.Any(None, vol.All(cv.string, vol.Strip)),
    },
    _validate_participant,
)


def _validate_converse(data: dict[str, Any]) -> dict[str, Any]:
    """Drop blank optional fields and check combinations a schema can't express."""
    data = _drop_blank(data, _BLANKABLE)
    participants = data["participants"]
    names = [p["name"].casefold() for p in participants]
    if len(set(names)) != len(names):
        raise vol.Invalid("participant names must be different")
    if "tts_entity" not in data and any("tts_entity" not in p for p in participants):
        raise vol.Invalid(
            "give a tts_entity, either for the action or for each participant"
        )
    movement = data["movement"]
    if len(movement) > 1 and (MOVEMENT_MOOD in movement or MOVEMENT_NONE in movement):
        raise vol.Invalid("movement takes mood, none, or a list of parts, not a mix")
    return data


SERVICE_CONVERSE = vol.Schema(
    vol.All(
        {
            vol.Required("participants"): vol.All(
                cv.ensure_list,
                [PARTICIPANT_SCHEMA],
                vol.Length(
                    min=2,
                    max=MAX_PARTICIPANTS,
                    msg=f"a conversation needs 2 to {MAX_PARTICIPANTS} participants",
                ),
            ),
            vol.Required("prompt"): _NON_BLANK,
            vol.Optional("max_lines", default=DEFAULT_MAX_LINES): vol.All(
                vol.Coerce(int), vol.Range(min=2, max=20)
            ),
            vol.Optional("camera_entity"): vol.Any(
                None, "", cv.entity_domain("camera")
            ),
            vol.Optional("camera_wait", default=DEFAULT_CAMERA_WAIT): vol.All(
                vol.Coerce(float), vol.Range(min=0, max=60)
            ),
            vol.Optional("ai_task_entity"): vol.Any(
                None, "", cv.entity_domain("ai_task")
            ),
            vol.Optional("tts_entity"): vol.Any(None, "", cv.entity_domain("tts")),
            vol.Optional("tts_options"): vol.Any(None, "", dict),
            vol.Optional("language"): vol.Any(None, vol.All(cv.string, vol.Strip)),
            vol.Optional("mood", default=MOOD_AUTO): vol.In(
                [MOOD_AUTO, MOOD_NONE, *MOODS]
            ),
            vol.Optional("movement", default=[MOVEMENT_MOOD]): vol.All(
                cv.ensure_list, [cv.string]
            ),
            vol.Optional("restore", default=True): cv.boolean,
            vol.Optional("restore_movement", default=False): cv.boolean,
            vol.Optional("pause", default=DEFAULT_PAUSE): vol.All(
                vol.Coerce(float), vol.Range(min=0, max=10)
            ),
            vol.Optional(
                "live_mode_timeout", default=DEFAULT_LIVE_MODE_TIMEOUT
            ): vol.All(vol.Coerce(float), vol.Range(min=1, max=300)),
            vol.Optional("on_line_error", default=LINE_ERROR_SKIP): vol.In(
                [LINE_ERROR_SKIP, LINE_ERROR_ABORT]
            ),
            vol.Optional("wait_until_done", default=True): cv.boolean,
        },
        _validate_converse,
    )
)


class ConverseHistory:
    """Topics of recent conversations, so the AI picks new ones."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass, HISTORY_STORAGE_VERSION, f"{DOMAIN}.converse_history"
        )
        self.topics: list[str] = []
        self._loaded = False

    async def async_load(self) -> None:
        if self._loaded:
            return
        data = await self._store.async_load()
        topics = data.get("topics", []) if isinstance(data, dict) else []
        self.topics = [str(topic) for topic in topics][-HISTORY_SIZE:]
        self._loaded = True

    async def async_add_topic(self, topic: str) -> None:
        self.topics = [*self.topics, topic][-HISTORY_SIZE:]
        await self._store.async_save({"topics": self.topics})


def _history(hass: HomeAssistant) -> ConverseHistory:
    if (history := hass.data.get(DATA_CONVERSE)) is None:
        history = hass.data[DATA_CONVERSE] = ConverseHistory(hass)
    return history


class _Participant:
    """A Skelly in the conversation, with its voice."""

    def __init__(
        self, stage: SkellyStage, spec: dict[str, Any], data: dict[str, Any]
    ) -> None:
        self.stage = stage
        self.name: str = spec["name"]
        self.device_id: str = spec["device_id"]
        self.persona: str | None = spec.get("persona")
        self.tts_entity: str = spec.get("tts_entity") or data["tts_entity"]
        # The participant's own voice settings, else the action's
        if "tts_entity" in spec:
            self.tts_options = spec.get("tts_options")
            self.language = spec.get("language")
        else:
            self.tts_options = spec.get("tts_options", data.get("tts_options"))
            self.language = spec.get("language", data.get("language"))
        self.parts_bits: int | None = None
        # Look before the conversation, and what it changed
        self.old_eye_icon: int | None = None
        self.old_lights: list[dict[str, Any]] = []
        self.old_action: int | None = None
        self.look_applied = False
        self.movement_sent = False
        self.current_mood: str | None = None


class _Line:
    def __init__(self, speaker: _Participant, text: str, mood: str) -> None:
        self.speaker = speaker
        self.text = text
        self.mood = mood
        self.spoken = False
        self.audio: asyncio.Task[Path] | None = None


class _Converse:
    """One run of the converse action."""

    def __init__(
        self,
        hass: HomeAssistant,
        participants: list[tuple[Any, str, dict[str, Any]]],
        data: dict[str, Any],
    ) -> None:
        self.hass = hass
        self.data = data
        self.participants = [
            _Participant(SkellyStage(hass, adapter, entry_id), spec, data)
            for adapter, entry_id, spec in participants
        ]
        self.history = _history(hass)
        self.lines: list[_Line] = []
        # With wait_until_done off: the rest of the conversation, still
        # running after async_run returns
        self.background_task: asyncio.Task | None = None

    @property
    def states(self) -> list[StageState]:
        return [p.stage.state for p in self.participants]

    def _check(self) -> None:
        """Check everything that can be checked before any device or AI call."""
        movement = self.data["movement"]
        for participant in self.participants:
            stage = participant.stage
            try:
                participant.parts_bits = stage.parts_bits_for(movement)
                stage.live_player()
            except HomeAssistantError as err:
                raise HomeAssistantError(f"{participant.name}: {err}") from err
            try:
                check_tts(
                    self.hass,
                    participant.tts_entity,
                    participant.language,
                    participant.tts_options,
                )
            except ServiceValidationError as err:
                raise ServiceValidationError(f"{participant.name}: {err}") from err

    async def async_run(self) -> dict[str, Any]:
        data = self.data
        self._check()
        await self.history.async_load()

        # Live mode on every Skelly and the script, in parallel
        live_tasks = [
            asyncio.create_task(self._async_ensure_live_mode(p))
            for p in self.participants
        ]
        script_task = asyncio.create_task(self._async_generate_script())
        started: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        try:
            await async_wait_all([*live_tasks, script_task])
            topic, person_present = script_task.result()

            if data["wait_until_done"]:
                await self._async_play_all(started)
            else:
                # Return once the first line starts playing, so callers can act
                # on it (e.g. notify) while the Skellys talk; the rest runs on.
                async def play_all() -> None:
                    try:
                        await self._async_play_all(started)
                    finally:
                        await self._async_discard_audio()

                task = self.hass.async_create_background_task(
                    play_all(), "skelly_ultra converse"
                )
                self.background_task = task
                task.add_done_callback(_log_background_result)
                await asyncio.wait({started, task}, return_when=asyncio.FIRST_COMPLETED)
                if not started.done():
                    task.result()  # raises the reason no line started
        finally:
            if self.background_task is None:
                await self._async_discard_audio()

        if topic:
            await self.history.async_add_topic(topic)

        lines = []
        for line in self.lines:
            item = {
                "speaker": line.speaker.name,
                "device_id": line.speaker.device_id,
                "text": line.text,
                "mood": line.mood,
            }
            if data["wait_until_done"]:
                item["spoken"] = line.spoken
            lines.append(item)
        return {
            "status": "ok",
            "topic": topic,
            "lines": lines,
            "person_present": person_present,
            "history": list(self.history.topics),
        }

    async def _async_ensure_live_mode(self, participant: _Participant) -> None:
        try:
            await participant.stage.async_ensure_live_mode(
                self.data["live_mode_timeout"]
            )
        except HomeAssistantError as err:
            raise HomeAssistantError(
                f"{participant.name}: {err}. {ADAPTER_HINT}."
            ) from err

    # The script

    def _instructions(self) -> str:
        data = self.data
        cast = "\n".join(
            f"- {p.name}: {p.persona}" if p.persona else f"- {p.name}"
            for p in self.participants
        )
        text = (
            f"{data['prompt']}\n\n"
            f"The conversation is between these Skellys:\n{cast}\n\n"
            f"Write at most {data['max_lines']} lines. Each line is spoken by one "
            "of them; use exactly the name above as its speaker."
        )
        if data["mood"] == MOOD_AUTO:
            text += " Give each line the mood that fits it best."
        if self.history.topics:
            text += (
                "\n\nPick a different topic than these recent conversations:\n"
                + "\n".join(f"- {topic}" for topic in self.history.topics)
            )
        return text

    def _structure(self) -> dict[str, Any]:
        fields: dict[str, Any] = {
            "speaker": {
                "required": True,
                "selector": {
                    "select": {"options": [p.name for p in self.participants]}
                },
            },
            "text": {"required": True, "selector": {"text": {}}},
        }
        if self.data["mood"] == MOOD_AUTO:
            fields["mood"] = {
                "required": True,
                "selector": {"select": {"options": list(MOODS)}},
            }
        structure: dict[str, Any] = {
            "topic": {
                "description": "The topic of the conversation, in a few words",
                "required": True,
                "selector": {"text": {}},
            },
            "lines": {
                "description": "The lines of the conversation, in order",
                "required": True,
                "selector": {"object": {"multiple": True, "fields": fields}},
            },
        }
        if self.data.get("camera_entity"):
            structure["person_present"] = {
                "description": "Whether a person can be seen in the image",
                "required": True,
                "selector": {"boolean": {}},
            }
        return structure

    async def _async_generate_script(self) -> tuple[str | None, bool | None]:
        """Ask the AI Task entity for the script; fills self.lines.

        Returns the topic and person_present.
        """
        camera = self.data.get("camera_entity")
        if camera:
            await async_wait_for_camera_update(
                self.hass, camera, self.data["camera_wait"]
            )
        result = await async_generate_ai_data(
            self.hass,
            task_name="Skelly conversation",
            instructions=self._instructions(),
            structure=self._structure(),
            ai_task_entity=self.data.get("ai_task_entity"),
            camera=camera,
            what="AI conversation generation",
        )
        self.lines = self._parse_lines(result.get("lines"))
        speakers = {line.speaker for line in self.lines}
        if len(self.lines) < 2 or len(speakers) < 2:
            raise HomeAssistantError(
                "AI conversation generation returned no usable conversation "
                f"({len(self.lines)} usable lines by {len(speakers)} Skellys)"
            )
        # Render every line right away, a few at a time, in order, while live
        # mode may still be connecting
        semaphore = asyncio.Semaphore(TTS_CONCURRENCY)
        for line in self.lines:
            line.audio = asyncio.create_task(self._async_render(line, semaphore))
        topic = str(result.get("topic") or "").strip() or None
        person_present = None
        if camera and "person_present" in result:
            person_present = bool(result["person_present"])
        return topic, person_present

    def _parse_lines(self, raw: Any) -> list[_Line]:
        """Turn the AI's lines into _Lines, dropping unusable ones."""
        by_name = {p.name.casefold(): p for p in self.participants}
        mood_mode = self.data["mood"]
        lines: list[_Line] = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                _LOGGER.warning("Converse: dropping line %r, not an object", item)
                continue
            speaker = by_name.get(str(item.get("speaker") or "").strip().casefold())
            text = str(item.get("text") or "").strip()
            if speaker is None or not text:
                _LOGGER.warning(
                    "Converse: dropping line %r (unknown speaker or no text)", item
                )
                continue
            if mood_mode == MOOD_AUTO:
                mood = item.get("mood")
                if mood not in MOODS:
                    _LOGGER.warning(
                        "Converse: AI picked unknown mood %r, using none", mood
                    )
                    mood = MOOD_NONE
            else:
                mood = mood_mode
            lines.append(_Line(speaker, text, mood))
        max_lines = self.data["max_lines"]
        if len(lines) > max_lines:
            _LOGGER.info(
                "Converse: AI wrote %d lines, keeping the first %d",
                len(lines),
                max_lines,
            )
            del lines[max_lines:]
        return lines

    # Speech

    async def _async_render(self, line: _Line, semaphore: asyncio.Semaphore) -> Path:
        speaker = line.speaker
        async with semaphore:
            return await async_render_tts(
                self.hass,
                line.text,
                speaker.tts_entity,
                speaker.language,
                speaker.tts_options,
            )

    async def _async_discard_audio(self) -> None:
        """Stop rendering and delete every rendered line."""
        tasks = [line.audio for line in self.lines if line.audio is not None]
        for line in self.lines:
            line.audio = None
        for task in tasks:
            task.cancel()
        # Failures were reported when their line came up (or don't matter)
        for result in await asyncio.gather(*tasks, return_exceptions=True):
            if isinstance(result, Path):
                await async_remove_file(self.hass, result)

    async def _async_play_all(self, started: asyncio.Future[None]) -> None:
        """Play the lines in order, then restore every Skelly's look.

        Sets started once the first line is playing.
        """
        data = self.data
        for participant in self.participants:
            (
                participant.old_eye_icon,
                participant.old_lights,
                participant.old_action,
            ) = participant.stage.snapshot_look()

        # The Skelly whose line is starting or playing
        speaking: _Participant | None = None
        try:
            for number, line in enumerate(self.lines, start=1):
                assert line.audio is not None
                try:
                    audio_path = await line.audio
                except HomeAssistantError as err:
                    if data["on_line_error"] == LINE_ERROR_ABORT:
                        raise HomeAssistantError(
                            f"Line {number} ({line.speaker.name}): {err}"
                        ) from err
                    _LOGGER.warning(
                        "Converse: skipping line %d (%s): %s",
                        number,
                        line.speaker.name,
                        err,
                    )
                    continue

                speaker = line.speaker
                speaking = speaker
                try:
                    playback = await self._async_start_line(speaker, line, audio_path)
                except HomeAssistantError as err:
                    raise HomeAssistantError(
                        f"Line {number} ({speaker.name}): {err}"
                    ) from err
                except Exception as err:
                    raise HomeAssistantError(
                        f"Line {number} ({speaker.name}): converse failed: {err}"
                    ) from err
                line.spoken = True
                if not started.done():
                    started.set_result(None)
                await asyncio.shield(playback)
                speaking = None
                if number < len(self.lines) and data["pause"]:
                    await asyncio.sleep(data["pause"])
            if not started.done():
                raise HomeAssistantError("No line of the conversation could be spoken")
        except asyncio.CancelledError:
            # Stopped (e.g. the automation was): silence the Skelly speaking
            if speaking is not None:
                await speaking.stage.async_stop_playback("Converse")
            raise
        finally:
            await self._async_restore()

    async def _async_start_line(
        self, speaker: _Participant, line: _Line, audio_path: Path
    ) -> asyncio.Task:
        """Apply the line's mood and movement on its speaker and start it."""
        stage = speaker.stage
        mood_def = MOODS.get(line.mood)
        if mood_def and line.mood != speaker.current_mood:
            speaker.look_applied = True
            await stage.async_apply_mood(mood_def)
            speaker.current_mood = line.mood
        action = stage.movement_action(
            line.mood, self.data["movement"], speaker.parts_bits
        )
        if action:
            speaker.movement_sent = True
            await stage.async_send_movement(action)
        return await stage.live_player().async_start_playback(audio_path)

    async def _async_restore(self) -> None:
        """Restore the look of every Skelly the conversation changed."""
        for participant in self.participants:
            stage = participant.stage
            if participant.look_applied and self.data["restore"]:
                await stage.async_restore_look(
                    participant.old_eye_icon, participant.old_lights
                )
            if participant.movement_sent and self.data["restore_movement"]:
                await stage.async_restore_movement(participant.old_action)


def _log_background_result(task: asyncio.Task) -> None:
    """Log a failure of a conversation that continued in the background."""
    if not task.cancelled() and (err := task.exception()) is not None:
        _LOGGER.error("Converse failed: %s", err)


async def async_converse(
    hass: HomeAssistant,
    participants: list[tuple[Any, str, dict[str, Any]]],
    data: dict[str, Any],
) -> dict[str, Any]:
    """Run skelly_ultra.converse and return the response data.

    participants: (adapter, entry_id, participant data) per Skelly, in the
    order given, each Skelly once; the data's device_id is resolved.
    """
    converse = _Converse(hass, participants, data)
    busy = [p.name for p in converse.participants if p.stage.state.running]
    if busy:
        _LOGGER.info(
            "Converse: %s already performing or talking, dropping this call",
            ", ".join(busy),
        )
        return {"status": "busy", "busy": busy}

    states = converse.states
    for state in states:
        state.running = True

    def release(_task: asyncio.Task | None = None) -> None:
        for state in states:
            state.running = False

    try:
        return await converse.async_run()
    finally:
        background = converse.background_task
        if background is None or background.done():
            release()
        else:
            # Still busy until the last line has finished and looks are restored
            background.add_done_callback(release)
