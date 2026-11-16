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

from .const import DOMAIN, MOODS
from .stage import (
    MOOD_AUTO,
    MOOD_NONE,
    NON_BLANK,
    PERSON_PRESENT_FIELD,
    STAGE_BLANKABLE,
    STAGE_SCHEMA_FIELDS,
    RecentHistory,
    SkellyStage,
    StageState,
    async_generate_ai_data,
    async_remove_file,
    async_render_tts,
    async_run_marked_busy,
    async_wait_all,
    async_wait_for_camera_update,
    async_wait_started,
    check_movement,
    check_tts,
    drop_blank,
    person_present_from,
    start_in_background,
)

_LOGGER = logging.getLogger(__name__)


def _validate_perform(data: dict[str, Any]) -> dict[str, Any]:
    """Drop blank optional fields and check combinations a schema can't express."""
    data = drop_blank(data, STAGE_BLANKABLE)
    if data.get("camera_entity") and "prompt" not in data:
        raise vol.Invalid("camera_entity needs a prompt")
    if "message" in data and data.get("mood") == MOOD_AUTO:
        raise vol.Invalid("mood auto needs a prompt; give a mood name with message")
    check_movement(data)
    return data


SERVICE_PERFORM = vol.Schema(
    vol.All(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Exclusive("message", "line"): NON_BLANK,
            vol.Exclusive("prompt", "line"): NON_BLANK,
            vol.Required("tts_entity"): cv.entity_domain("tts"),
            vol.Optional("mood"): vol.In([MOOD_AUTO, MOOD_NONE, *MOODS]),
            **STAGE_SCHEMA_FIELDS,
        },
        cv.has_at_least_one_key("message", "prompt"),
        _validate_perform,
    )
)


def _new_history(hass: HomeAssistant, entry_id: str) -> RecentHistory:
    return RecentHistory(hass, f"{DOMAIN}.{entry_id}.perform_history", "lines")


async def async_remove_perform_history(hass: HomeAssistant, entry_id: str) -> None:
    """Delete the stored perform history of a removed config entry."""
    await _new_history(hass, entry_id).async_remove()


class PerformManager(StageState):
    """Per-Skelly perform state: the running flag and the AI line history."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the manager for a config entry."""
        super().__init__()
        self._history = _new_history(hass, entry_id)

    @property
    def history(self) -> list[str]:
        """The most recent AI lines, oldest first."""
        return self._history.items

    async def async_load(self) -> None:
        """Load the line history from storage (once)."""
        await self._history.async_load()

    async def async_add_line(self, line: str) -> None:
        """Append an AI line to the history, keeping the most recent ones."""
        await self._history.async_add(line)

    async def async_clear(self) -> None:
        """Forget all lines in the history."""
        await self._history.async_clear()


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
            self.background_task = start_in_background(
                self.hass, perform_line(), "Perform"
            )
            await async_wait_started(self.background_task, started)

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
            structure["person_present"] = PERSON_PRESENT_FIELD

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

        return line, mood, person_present_from(result, camera)

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

            playback = await stage.live_player().async_start_playback(audio_path)
            started.set_result(None)
            try:
                await asyncio.shield(playback)
            except asyncio.CancelledError:
                # Stopped (e.g. the automation was): silence the Skelly too
                await stage.async_stop_playback("Perform")
                raise
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Perform failed: {err}") from err
        finally:
            if look_applied and self.data["restore"]:
                await stage.async_restore_look(old_eye_icon, old_lights)
            if movement_sent and self.data["restore_movement"]:
                await stage.async_restore_movement(old_action)


async def async_perform(
    hass: HomeAssistant,
    adapter: Any,
    entry_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Run skelly_ultra.perform on one Skelly and return the response data."""
    perform = _Perform(hass, adapter, entry_id, data)
    if perform.manager.running:
        _LOGGER.info("Perform: already running on this Skelly, dropping this call")
        return {"status": "busy"}
    return await async_run_marked_busy([perform.manager], perform)
