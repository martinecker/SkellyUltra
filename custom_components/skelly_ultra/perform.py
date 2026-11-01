"""The skelly_ultra.perform action: speak a line with a matching mood.

Perform says a literal line or one written by an AI Task entity (optionally
from a camera snapshot), using a TTS entity and the live-mode speaker. A mood
sets the eyes, lights and movement for the line and the look is restored
afterwards.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path
import tempfile
from typing import Any

import voluptuous as vol

from homeassistant.components import tts
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import DOMAIN, MOOD_LIGHT_SPEEDS, MOODS
from .helpers import get_device_profile, movement_bits

_LOGGER = logging.getLogger(__name__)

MOOD_AUTO = "auto"
MOOD_NONE = "none"
MOVEMENT_MOOD = "mood"
MOVEMENT_NONE = "none"

DEFAULT_LIVE_MODE_TIMEOUT = 30.0
DEFAULT_CAMERA_WAIT = 1.0
HISTORY_SIZE = 10
HISTORY_STORAGE_VERSION = 1

# Delay between device writes. They are unacknowledged and the device can
# drop them when sent back-to-back (same as FILE_SETTING_WRITE_DELAY in
# file_settings.py).
COMMAND_DELAY = 0.04

# How often to check whether live mode has connected
LIVE_MODE_POLL_INTERVAL = 0.5


# Optional fields a blueprint may pass as empty when its input is left blank
_BLANKABLE = ("camera_entity", "ai_task_entity", "tts_options")


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


class PerformManager:
    """Per-Skelly perform state: the running flag and the AI line history."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the manager for a config entry."""
        self._store = _history_store(hass, entry_id)
        self.history: list[str] = []
        self.running = False
        # Live-mode connect started by perform. It is never cancelled, so a
        # perform that times out doesn't abort a connect that is half done.
        self.live_mode_task: asyncio.Task | None = None

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


def _eye_icon_index(profile: dict, name: str) -> int | None:
    """Return the 1-based eye icon index whose label names this icon."""
    for index, label in enumerate(profile.get("eye_icons", []), start=1):
        if label.split(" ", 1)[-1] == name:
            return index
    return None


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
        self.adapter = adapter
        self.client = adapter.client
        self.entry_id = entry_id
        self.data = data
        entry_data = hass.data[DOMAIN][entry_id]
        self.coordinator = entry_data["coordinator"]
        self.manager: PerformManager = entry_data["perform"]
        config_entry = hass.config_entries.async_get_entry(entry_id)
        if config_entry is None:
            raise HomeAssistantError(f"Config entry {entry_id} not found")
        self.config_entry = config_entry
        self.profile = get_device_profile(config_entry)
        # With wait_until_done off: the rest of the perform (waiting for
        # playback, restoring the look), still running after async_run returns
        self.background_task: asyncio.Task | None = None

    async def async_run(self) -> dict[str, Any]:
        data = self.data
        prompt: str | None = data.get("prompt")
        mood: str = data.get("mood", MOOD_AUTO if prompt else MOOD_NONE)
        movement: list[str] = data["movement"]
        # Check parts before anything is sent to the device
        parts_bits = (
            movement_bits(self.profile, movement)
            if movement not in ([MOVEMENT_MOOD], [MOVEMENT_NONE])
            else None
        )
        # A disabled Live Mode Speaker is never registered; fail before any
        # AI request or device change rather than after.
        if self.hass.data[DOMAIN][self.entry_id].get("live_media_player") is None:
            raise HomeAssistantError("Live Mode Speaker entity not found")

        # Live mode and the AI line in parallel
        live_task = asyncio.create_task(
            self._async_ensure_live_mode(data["live_mode_timeout"])
        )
        tasks = [live_task]
        ai_task: asyncio.Task | None = None
        if prompt:
            ai_task = asyncio.create_task(
                self._async_generate_line(prompt, mood == MOOD_AUTO)
            )
            tasks.append(ai_task)
        try:
            done, pending = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_EXCEPTION
            )
        except asyncio.CancelledError:
            for task in tasks:
                task.cancel()
            raise
        for task in pending:
            task.cancel()
        for task in done:
            task.result()

        person_present: bool | None = None
        if ai_task is not None:
            line, ai_mood, person_present = ai_task.result()
            if mood == MOOD_AUTO:
                mood = ai_mood
        else:
            line = data["message"]

        audio_path = await self._async_generate_audio(line)
        started: asyncio.Future[None] = asyncio.get_running_loop().create_future()

        async def perform_line() -> None:
            try:
                await self._async_perform_line(
                    audio_path, mood, movement, parts_bits, started
                )
            finally:
                with contextlib.suppress(OSError):
                    await self.hass.async_add_executor_job(audio_path.unlink)

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

    async def _async_ensure_live_mode(self, timeout: float) -> None:
        """Turn live mode on if needed and wait for the live speaker."""
        if self._live_mode_connected():
            return

        if self.manager.live_mode_task is None or self.manager.live_mode_task.done():
            _LOGGER.info("Perform: turning on live mode")
            self.manager.live_mode_task = self.hass.async_create_task(
                self._async_turn_on_live_mode()
            )

        try:
            async with asyncio.timeout(timeout):
                while not self._live_mode_connected():
                    await asyncio.sleep(LIVE_MODE_POLL_INTERVAL)
        except TimeoutError:
            raise HomeAssistantError(
                f"Live mode did not connect within {timeout:.0f} seconds"
            ) from None

    def _live_mode_connected(self) -> bool:
        return self.client.live_mode_client_address is not None

    async def _async_turn_on_live_mode(self) -> None:
        # Go through the Live Mode switch, so its state and the remembered
        # preference ("leave it on") are updated the same as from the UI.
        # Called on the entity directly, since a service call skips it while
        # it is unavailable (e.g. before the first successful poll).
        switch = self.hass.data[DOMAIN][self.entry_id].get("live_mode_switch")
        try:
            if switch is not None:
                await switch.async_turn_on()
            else:
                # The switch entity is disabled: do what it would do
                self.adapter.set_live_mode_preference(True)
                self.hass.config_entries.async_update_entry(
                    self.config_entry,
                    options={**self.config_entry.options, "live_mode_connected": True},
                )
                await self.adapter.connect_live_mode()
        except Exception:
            _LOGGER.exception("Perform: failed to turn on live mode")

    async def _async_generate_line(
        self, prompt: str, choose_mood: bool
    ) -> tuple[str, str, bool | None]:
        """Ask the AI Task entity for the line (and mood, person_present)."""
        camera = self.data.get("camera_entity")
        if camera:
            await self._async_wait_for_camera_update(camera, self.data["camera_wait"])

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

        request: dict[str, Any] = {
            "task_name": "Skelly perform",
            "instructions": instructions,
            "structure": structure,
        }
        if ai_task_entity := self.data.get("ai_task_entity"):
            request["entity_id"] = ai_task_entity
        if camera:
            request["attachments"] = [
                {
                    "media_content_id": f"media-source://camera/{camera}",
                    "media_content_type": "image/jpeg",
                }
            ]

        try:
            response = await self.hass.services.async_call(
                "ai_task",
                "generate_data",
                request,
                blocking=True,
                return_response=True,
            )
        except HomeAssistantError as err:
            raise HomeAssistantError(f"AI line generation failed: {err}") from err

        result = (response or {}).get("data")
        if not isinstance(result, dict):
            raise HomeAssistantError("AI line generation returned no structured data")
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

    async def _async_wait_for_camera_update(self, camera: str, timeout: float) -> None:
        """Wait up to timeout seconds for the camera entity to update.

        A motion trigger usually fires just before a snapshot camera (such as
        ring-mqtt's) publishes the image of what moved, so taking the image
        right away would send the AI the previous one. Without an update in
        time, the current image is used.
        """
        if timeout <= 0:
            return
        updated = asyncio.Event()

        @callback
        def on_change(event: Event[EventStateChangedData]) -> None:
            if event.data["new_state"] is not None:
                updated.set()

        unsub = async_track_state_change_event(self.hass, [camera], on_change)
        try:
            async with asyncio.timeout(timeout):
                await updated.wait()
        except TimeoutError:
            _LOGGER.debug(
                "Perform: %s didn't update within %.1f s, using its current image",
                camera,
                timeout,
            )
        finally:
            unsub()

    async def _async_generate_audio(self, line: str) -> Path:
        """Render the line with the TTS entity into a temporary file."""
        try:
            media_id = tts.generate_media_source_id(
                self.hass,
                line,
                engine=self.data["tts_entity"],
                options=self.data.get("tts_options"),
            )
            extension, audio = await tts.async_get_media_source_audio(
                self.hass, media_id
            )
        except Exception as err:
            raise HomeAssistantError(f"Text-to-speech failed: {err}") from err

        def write() -> Path:
            with tempfile.NamedTemporaryFile(
                delete=False, prefix="skelly_perform_", suffix=f".{extension}"
            ) as file:
                file.write(audio)
            return Path(file.name)

        return await self.hass.async_add_executor_job(write)

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
        mood_def = MOODS.get(mood)
        cache = self.coordinator.data or {}
        old_eye_icon = cache.get("eye_icon")
        old_lights = [dict(light) for light in cache.get("lights") or []]
        old_action = cache.get("action")

        if parts_bits is not None:
            new_action: int | None = parts_bits
        elif movement == [MOVEMENT_MOOD] and mood_def:
            new_action = movement_bits(
                self.profile, self.profile["mood_movements"][mood_def["movement"]]
            )
        else:
            new_action = None

        look_applied = False
        movement_sent = False
        try:
            if mood_def:
                look_applied = True
                await self._async_apply_mood(mood_def)
            if new_action:
                movement_sent = True
                await self._async_send_movement(new_action)

            player = self.hass.data[DOMAIN][self.entry_id].get("live_media_player")
            if player is None:
                raise HomeAssistantError("Live Mode Speaker entity not found")
            playback = await player.async_start_playback(str(audio_path))
            started.set_result(None)
            await asyncio.shield(playback)
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Perform failed: {err}") from err
        finally:
            if look_applied and self.data["restore"]:
                await self._async_restore_look(old_eye_icon, old_lights)
            if (
                movement_sent
                and self.data["restore_movement"]
                and old_action is not None
            ):
                try:
                    await self._async_send_movement(int(old_action))
                except Exception:
                    _LOGGER.exception("Perform: failed to restore movement")

    async def _paced(self, command) -> None:
        await command
        await asyncio.sleep(COMMAND_DELAY)

    async def _async_apply_mood(self, mood_def: dict) -> None:
        client = self.client
        cache = self.coordinator.data or {}
        async with self.coordinator.action_lock:
            if self.profile.get("has_eye_image"):
                icon = _eye_icon_index(self.profile, mood_def["eye_icon"])
                if icon is not None:
                    await self._paced(client.set_eye_icon(icon))
                    self.coordinator.async_update_data_optimistic("eye_icon", icon)

            light_modes = self.profile["light_modes"]
            mode = (
                light_modes.index(
                    self.profile["mood_light_styles"][mood_def["light_style"]]
                )
                + 1
            )
            speed = (
                MOOD_LIGHT_SPEEDS[mood_def["light_speed"]]
                if mood_def["light_speed"]
                else None
            )
            color_cycle = 1 if mood_def["color_cycle"] else 0
            colors = mood_def["colors"]

            lights = [dict(light) for light in cache.get("lights") or []]
            for position, light_def in enumerate(self.profile["lights"]):
                channel = light_def["channel"]
                r, g, b = colors[min(position, len(colors) - 1)]
                await self._paced(client.set_light_rgb(channel, r, g, b, color_cycle))
                await self._paced(client.set_light_brightness(channel, 255))
                await self._paced(client.set_light_mode(channel, mode))
                if speed is not None:
                    await self._paced(client.set_light_speed(channel, speed))

                while len(lights) <= channel:
                    lights.append({})
                lights[channel].update(
                    rgb=(r, g, b),
                    brightness=255,
                    effect_type=mode,
                    color_cycle=color_cycle,
                )
                if speed is not None:
                    lights[channel]["effect_speed"] = speed
            self.coordinator.async_update_data_optimistic("lights", lights)

    async def _async_send_movement(self, action: int) -> None:
        async with self.coordinator.action_lock:
            await self.client.set_movement_action(action)
            self.coordinator.async_update_data_optimistic("action", action)

    async def _async_restore_look(
        self, eye_icon: int | None, lights: list[dict[str, Any]]
    ) -> None:
        """Send the eyes and lights from before the mood back to the device.

        Best effort: a failure is logged, so it doesn't hide the result or
        the error of the perform itself.
        """
        client = self.client
        try:
            async with self.coordinator.action_lock:
                if eye_icon is not None and self.profile.get("has_eye_image"):
                    await self._paced(client.set_eye_icon(int(eye_icon)))

                for light_def in self.profile["lights"]:
                    channel = light_def["channel"]
                    if channel >= len(lights):
                        continue
                    light = lights[channel]
                    if light.get("rgb") is not None:
                        r, g, b = light["rgb"]
                        await self._paced(
                            client.set_light_rgb(
                                channel, r, g, b, int(light.get("color_cycle") or 0)
                            )
                        )
                    if light.get("brightness") is not None:
                        await self._paced(
                            client.set_light_brightness(channel, light["brightness"])
                        )
                    if light.get("effect_type"):
                        await self._paced(
                            client.set_light_mode(channel, light["effect_type"])
                        )
                    if light.get("effect_speed") is not None:
                        await self._paced(
                            client.set_light_speed(channel, light["effect_speed"])
                        )

                if eye_icon is not None:
                    self.coordinator.async_update_data_optimistic("eye_icon", eye_icon)
                if lights:
                    self.coordinator.async_update_data_optimistic("lights", lights)
        except Exception:
            _LOGGER.exception("Perform: failed to restore eyes and lights")


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
