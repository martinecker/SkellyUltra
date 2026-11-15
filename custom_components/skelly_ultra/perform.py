"""The skelly_ultra.perform action: speak a line with a matching mood.

Perform says a literal line or one written by an AI Task entity (optionally
from a camera snapshot), using a TTS entity and the live-mode speaker. A mood
sets the eyes, lights and movement for the line and the look is restored
afterwards.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store

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

HISTORY_SIZE = 10
HISTORY_STORAGE_VERSION = 1


# Optional fields a blueprint may pass as empty when its input is left blank
_BLANKABLE = ("camera_entity", "ai_task_entity", "language", "tts_options")


def _validate_perform(data: dict[str, Any]) -> dict[str, Any]:
    """Drop blank optional fields and check combinations a schema can't express."""
    data = {k: v for k, v in data.items() if k not in _BLANKABLE or v}
    if data.get("camera_entity") and "prompt" not in data:
        raise vol.Invalid("camera_entity needs a prompt")
    if "message" in data and data.get("mood") == MOOD_AUTO:
        raise vol.Invalid("mood auto needs a prompt; give a mood name with message")
    movement = data["movement"]
    if len(movement) > 1 and (MOVEMENT_MOOD in movement or MOVEMENT_NONE in movement):
        raise vol.Invalid("movement takes mood, none, or a list of parts, not a mix")
    return data


_NON_BLANK = vol.All(cv.string, vol.Strip, vol.Length(min=1, msg="must not be empty"))

SERVICE_PERFORM = vol.Schema(
    vol.All(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Exclusive("message", "line"): _NON_BLANK,
            vol.Exclusive("prompt", "line"): _NON_BLANK,
            vol.Optional("camera_entity"): vol.Any(
                None, "", cv.entity_domain("camera")
            ),
            vol.Optional("ai_task_entity"): vol.Any(
                None, "", cv.entity_domain("ai_task")
            ),
            vol.Required("tts_entity"): cv.entity_domain("tts"),
            vol.Optional("language"): vol.Any(None, vol.All(cv.string, vol.Strip)),
            vol.Optional("tts_options"): vol.Any(None, dict),
            vol.Optional("mood"): vol.In([MOOD_AUTO, MOOD_NONE, *MOODS]),
            vol.Optional("movement", default=[MOVEMENT_MOOD]): vol.All(
                cv.ensure_list, [cv.string]
            ),
            vol.Optional("restore", default=True): cv.boolean,
            vol.Optional("restore_movement", default=False): cv.boolean,
            vol.Optional(
                "live_mode_timeout", default=DEFAULT_LIVE_MODE_TIMEOUT
            ): vol.All(vol.Coerce(float), vol.Range(min=1, max=300)),
            vol.Optional("wait_until_done", default=True): cv.boolean,
            vol.Optional("camera_wait", default=DEFAULT_CAMERA_WAIT): vol.All(
                vol.Coerce(float), vol.Range(min=0, max=60)
            ),
        },
        cv.has_at_least_one_key("message", "prompt"),
        _validate_perform,
    )
)


def _history_store(hass: HomeAssistant, entry_id: str) -> Store[dict[str, Any]]:
    return Store(hass, HISTORY_STORAGE_VERSION, f"{DOMAIN}.{entry_id}.perform_history")


async def async_remove_perform_history(hass: HomeAssistant, entry_id: str) -> None:
    """Delete the stored perform history of a removed config entry."""
    await _history_store(hass, entry_id).async_remove()


class PerformManager(StageState):
    """Per-Skelly perform state: the running flag and the AI line history."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the manager for a config entry."""
        super().__init__()
        self._store = _history_store(hass, entry_id)
        self.history: list[str] = []

    async def async_load(self) -> None:
        """Load the line history from storage."""
        data = await self._store.async_load()
        lines = data.get("lines", []) if isinstance(data, dict) else []
        self.history = [str(line) for line in lines][-HISTORY_SIZE:]

    async def async_add_line(self, line: str) -> None:
        """Append an AI line to the history, keeping the most recent ones."""
        self.history = [*self.history, line][-HISTORY_SIZE:]
        await self._store.async_save({"lines": self.history})

    async def async_clear(self) -> None:
        """Forget all lines in the history."""
        self.history = []
        await self._store.async_save({"lines": self.history})


class _Perform:
    """One run of the perform action on one Skelly."""

    def __init__(
        self,
        hass: HomeAssistant,
        adapter: Any,
        entry_id: str,
        data: dict[str, Any],
    ) -> None:
        self.hass = hass
        self.data = data
        self.stage = SkellyStage(hass, adapter, entry_id)
        self.manager: PerformManager = hass.data[DOMAIN][entry_id]["perform"]
        # With wait_until_done off: the rest of the perform (waiting for
        # playback, restoring the look), still running after async_run returns
        self.background_task: asyncio.Task | None = None

    async def async_run(self) -> dict[str, Any]:
        data = self.data
        stage = self.stage
        prompt: str | None = data.get("prompt")
        mood: str = data.get("mood", MOOD_AUTO if prompt else MOOD_NONE)
        movement: list[str] = data["movement"]
        # Check parts before anything is sent to the device
        parts_bits = stage.parts_bits_for(movement)
        # Fail before any AI request or device change rather than after
        stage.live_player()
        # A language or options the TTS entity doesn't take, before live mode
        # is turned on for nothing
        check_tts(
            self.hass,
            data["tts_entity"],
            data.get("language"),
            data.get("tts_options"),
        )

        # Live mode and the AI line in parallel
        live_task = asyncio.create_task(
            stage.async_ensure_live_mode(data["live_mode_timeout"])
        )
        tasks = [live_task]
        ai_task: asyncio.Task | None = None
        if prompt:
            ai_task = asyncio.create_task(
                self._async_generate_line(prompt, mood == MOOD_AUTO)
            )
            tasks.append(ai_task)
        await async_wait_all(tasks)

        person_present: bool | None = None
        if ai_task is not None:
            line, ai_mood, person_present = ai_task.result()
            if mood == MOOD_AUTO:
                mood = ai_mood
        else:
            line = data["message"]

        audio_path = await async_render_tts(
            self.hass,
            line,
            data["tts_entity"],
            data.get("language"),
            data.get("tts_options"),
        )
        started: asyncio.Future[None] = asyncio.get_running_loop().create_future()

        async def perform_line() -> None:
            try:
                await self._async_perform_line(
                    audio_path, mood, movement, parts_bits, started
                )
            finally:
                await async_remove_file(self.hass, audio_path)

        if data["wait_until_done"]:
            await perform_line()
        else:
            # Return once the line starts playing, so callers can act on it
            # (e.g. notify) while the Skelly speaks; the rest runs on.
            task = self.hass.async_create_background_task(
                perform_line(), "skelly_ultra perform"
            )
            self.background_task = task
            task.add_done_callback(_log_background_result)
            await asyncio.wait({started, task}, return_when=asyncio.FIRST_COMPLETED)
            if not started.done():
                task.result()  # raises the reason playback didn't start

        if ai_task is not None:
            await self.manager.async_add_line(line)

        return {
            "status": "ok",
            "line": line,
            "mood": mood,
            "person_present": person_present,
            "history": list(self.manager.history),
        }

    async def _async_generate_line(
        self, prompt: str, choose_mood: bool
    ) -> tuple[str, str, bool | None]:
        """Ask the AI Task entity for the line (and mood, person_present)."""
        camera = self.data.get("camera_entity")
        if camera:
            await async_wait_for_camera_update(
                self.hass, camera, self.data["camera_wait"]
            )

        instructions = prompt
        if self.manager.history:
            instructions += (
                "\n\nDo not repeat any of these lines, which you said before:\n"
                + "\n".join(f"- {line}" for line in self.manager.history)
            )

        structure: dict[str, Any] = {
            "line": {
                "description": "The line the Skelly says",
                "required": True,
                "selector": {"text": {}},
            }
        }
        if choose_mood:
            structure["mood"] = {
                "description": "The mood that fits the line best",
                "required": True,
                "selector": {"select": {"options": list(MOODS)}},
            }
        if camera:
            structure["person_present"] = {
                "description": "Whether a person can be seen in the image",
                "required": True,
                "selector": {"boolean": {}},
            }

        result = await async_generate_ai_data(
            self.hass,
            task_name="Skelly perform",
            instructions=instructions,
            structure=structure,
            ai_task_entity=self.data.get("ai_task_entity"),
            camera=camera,
            what="AI line generation",
        )
        line = str(result.get("line") or "").strip()
        if not line:
            raise HomeAssistantError("AI line generation returned an empty line")

        mood = MOOD_NONE
        if choose_mood:
            mood = result.get("mood")
            if mood not in MOODS:
                _LOGGER.warning("Perform: AI picked unknown mood %r, using none", mood)
                mood = MOOD_NONE

        person_present = None
        if camera and "person_present" in result:
            person_present = bool(result["person_present"])

        return line, mood, person_present

    async def _async_perform_line(
        self,
        audio_path: Path,
        mood: str,
        movement: list[str],
        parts_bits: int | None,
        started: asyncio.Future[None],
    ) -> None:
        """Apply the look, play the line and restore the look.

        Sets started once playback has started.
        """
        stage = self.stage
        mood_def = MOODS.get(mood)
        old_eye_icon, old_lights, old_action = stage.snapshot_look()
        new_action = stage.movement_action(mood, movement, parts_bits)

        look_applied = False
        movement_sent = False
        try:
            if mood_def:
                look_applied = True
                await stage.async_apply_mood(mood_def)
            if new_action:
                movement_sent = True
                await stage.async_send_movement(new_action)

            playback = await stage.live_player().async_start_playback(str(audio_path))
            started.set_result(None)
            await asyncio.shield(playback)
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Perform failed: {err}") from err
        finally:
            if look_applied and self.data["restore"]:
                await stage.async_restore_look(old_eye_icon, old_lights)
            if movement_sent and self.data["restore_movement"]:
                await stage.async_restore_movement(old_action)


def _log_background_result(task: asyncio.Task) -> None:
    """Log a failure of a perform that continued in the background."""
    if not task.cancelled() and (err := task.exception()) is not None:
        _LOGGER.error("Perform failed: %s", err)


async def async_perform(
    hass: HomeAssistant,
    adapter: Any,
    entry_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Run skelly_ultra.perform on one Skelly and return the response data."""
    perform = _Perform(hass, adapter, entry_id, data)
    manager = perform.manager
    if manager.running:
        _LOGGER.info("Perform: already running on this Skelly, dropping this call")
        return {"status": "busy"}

    manager.running = True
    try:
        return await perform.async_run()
    finally:
        background = perform.background_task
        if background is None or background.done():
            manager.running = False
        else:
            # Still busy until the line has finished and the look is restored
            background.add_done_callback(
                lambda _task: setattr(manager, "running", False)
            )
