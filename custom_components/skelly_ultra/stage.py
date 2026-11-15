"""What the perform and converse actions do on one Skelly.

SkellyStage turns live mode on, applies a mood's eyes, lights and movement,
plays audio through the live-mode speaker and restores the look. The module
functions render TTS, ask an AI Task entity for structured data and wait for
a camera snapshot.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path
import tempfile
from typing import Any

from homeassistant.components import tts
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.event import async_track_state_change_event

from .const import DOMAIN, MOOD_LIGHT_SPEEDS, MOODS
from .helpers import get_device_profile, movement_bits

_LOGGER = logging.getLogger(__name__)

MOOD_AUTO = "auto"
MOOD_NONE = "none"
MOVEMENT_MOOD = "mood"
MOVEMENT_NONE = "none"

DEFAULT_LIVE_MODE_TIMEOUT = 30.0
DEFAULT_CAMERA_WAIT = 1.0

# Delay between device writes. They are unacknowledged and the device can
# drop them when sent back-to-back (same as FILE_SETTING_WRITE_DELAY in
# file_settings.py).
COMMAND_DELAY = 0.04

# How often to check whether live mode has connected
LIVE_MODE_POLL_INTERVAL = 0.5


class StageState:
    """Per-Skelly state shared by perform and converse.

    Kept in hass.data[DOMAIN][entry_id]["perform"] (a PerformManager, which
    adds perform's line history).
    """

    def __init__(self) -> None:
        # A perform or conversation is running on this Skelly
        self.running = False
        # Live-mode connect started by perform or converse. It is never
        # cancelled, so a run that times out doesn't abort a connect that is
        # half done.
        self.live_mode_task: asyncio.Task | None = None


def _eye_icon_index(profile: dict, name: str) -> int | None:
    """Return the 1-based eye icon index whose label names this icon."""
    for index, label in enumerate(profile.get("eye_icons", []), start=1):
        if label.split(" ", 1)[-1] == name:
            return index
    return None


def check_tts(
    hass: HomeAssistant,
    tts_entity: str,
    language: str | None,
    options: dict[str, Any] | None,
) -> None:
    """Raise if the TTS entity doesn't take the language or options."""
    try:
        tts.generate_media_source_id(
            hass, "check", engine=tts_entity, language=language, options=options
        )
    except HomeAssistantError as err:
        raise ServiceValidationError(f"Text-to-speech: {err}") from err


async def async_render_tts(
    hass: HomeAssistant,
    line: str,
    tts_entity: str,
    language: str | None,
    options: dict[str, Any] | None,
) -> Path:
    """Render a line with a TTS entity into a temporary file."""
    try:
        media_id = tts.generate_media_source_id(
            hass, line, engine=tts_entity, language=language, options=options
        )
        extension, audio = await tts.async_get_media_source_audio(hass, media_id)
    except Exception as err:
        raise HomeAssistantError(f"Text-to-speech failed: {err}") from err

    def write() -> Path:
        with tempfile.NamedTemporaryFile(
            delete=False, prefix="skelly_perform_", suffix=f".{extension}"
        ) as file:
            file.write(audio)
        return Path(file.name)

    future = hass.async_add_executor_job(write)
    try:
        return await asyncio.shield(future)
    except asyncio.CancelledError:
        # The file is written anyway; delete it once it is
        @callback
        def remove(done: asyncio.Future[Path]) -> None:
            if not done.cancelled() and done.exception() is None:
                hass.async_add_executor_job(_unlink_quietly, done.result())

        future.add_done_callback(remove)
        raise


def _unlink_quietly(path: Path) -> None:
    with contextlib.suppress(OSError):
        path.unlink()


async def async_remove_file(hass: HomeAssistant, path: Path) -> None:
    """Delete a temporary file, ignoring errors."""
    await hass.async_add_executor_job(_unlink_quietly, path)


async def async_wait_for_camera_update(
    hass: HomeAssistant, camera: str, timeout: float
) -> None:
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

    unsub = async_track_state_change_event(hass, [camera], on_change)
    try:
        async with asyncio.timeout(timeout):
            await updated.wait()
    except TimeoutError:
        _LOGGER.debug(
            "%s didn't update within %.1f s, using its current image",
            camera,
            timeout,
        )
    finally:
        unsub()


async def async_generate_ai_data(
    hass: HomeAssistant,
    *,
    task_name: str,
    instructions: str,
    structure: dict[str, Any],
    ai_task_entity: str | None,
    camera: str | None,
    what: str,
) -> dict[str, Any]:
    """Call ai_task.generate_data and return its structured data.

    what names the request in error messages, e.g. "AI line generation".
    """
    request: dict[str, Any] = {
        "task_name": task_name,
        "instructions": instructions,
        "structure": structure,
    }
    if ai_task_entity:
        request["entity_id"] = ai_task_entity
    if camera:
        request["attachments"] = [
            {
                "media_content_id": f"media-source://camera/{camera}",
                "media_content_type": "image/jpeg",
            }
        ]

    try:
        response = await hass.services.async_call(
            "ai_task",
            "generate_data",
            request,
            blocking=True,
            return_response=True,
        )
    except HomeAssistantError as err:
        raise HomeAssistantError(f"{what} failed: {err}") from err

    result = (response or {}).get("data")
    if not isinstance(result, dict):
        raise HomeAssistantError(f"{what} returned no structured data")
    return result


class SkellyStage:
    """What perform and converse do on one Skelly: live mode, look, playback."""

    def __init__(self, hass: HomeAssistant, adapter: Any, entry_id: str) -> None:
        self.hass = hass
        self.adapter = adapter
        self.client = adapter.client
        self.entry_id = entry_id
        entry_data = hass.data[DOMAIN][entry_id]
        self.coordinator = entry_data["coordinator"]
        # Running flag and live-mode connect, shared by perform and converse
        self.state: StageState = entry_data["perform"]
        config_entry = hass.config_entries.async_get_entry(entry_id)
        if config_entry is None:
            raise HomeAssistantError(f"Config entry {entry_id} not found")
        self.config_entry = config_entry
        self.profile = get_device_profile(config_entry)

    @property
    def name(self) -> str:
        """The Skelly's name, for messages."""
        return self.config_entry.title

    def live_player(self) -> Any:
        """Return the Live Mode Speaker entity, or raise if it is missing.

        A disabled Live Mode Speaker is never registered.
        """
        player = self.hass.data[DOMAIN][self.entry_id].get("live_media_player")
        if player is None:
            raise HomeAssistantError("Live Mode Speaker entity not found")
        return player

    async def async_stop_playback(self, caller: str) -> None:
        """Stop the line this Skelly is saying. Best effort: failures are logged.

        caller names the action for the log, e.g. "Perform".
        """
        try:
            await self.live_player().async_media_stop()
        except HomeAssistantError as err:
            _LOGGER.warning("%s: couldn't stop %s: %s", caller, self.name, err)
        except Exception:
            _LOGGER.exception("%s: failed to stop %s", caller, self.name)

    def movement_action(
        self, mood: str, movement: list[str], parts_bits: int | None
    ) -> int | None:
        """Return the movement bitfield to send for a line, or None.

        parts_bits: the bitfield of an explicit list of parts (see
        parts_bits_for), which wins over the mood's movement.
        """
        if parts_bits is not None:
            return parts_bits
        mood_def = MOODS.get(mood)
        if movement == [MOVEMENT_MOOD] and mood_def:
            return movement_bits(
                self.profile, self.profile["mood_movements"][mood_def["movement"]]
            )
        return None

    def parts_bits_for(self, movement: list[str]) -> int | None:
        """Return the bitfield of an explicit list of parts, None for mood/none.

        Raises for parts the device doesn't have.
        """
        if movement in ([MOVEMENT_MOOD], [MOVEMENT_NONE]):
            return None
        return movement_bits(self.profile, movement)

    # Live mode

    async def async_ensure_live_mode(self, timeout: float) -> None:
        """Turn live mode on if needed and wait for the live speaker.

        Fails as soon as the connection attempt perform or converse started
        has ended without a live link while BLE is connected and no live-mode
        restore is running, instead of waiting for the timeout.
        """
        if self.live_mode_connected():
            return

        state = self.state
        if state.live_mode_task is None or state.live_mode_task.done():
            _LOGGER.info("Turning on live mode on %s", self.name)
            state.live_mode_task = self.hass.async_create_task(
                self._async_turn_on_live_mode()
            )
        task = state.live_mode_task

        try:
            async with asyncio.timeout(timeout):
                while not self.live_mode_connected():
                    # Failed, unless a BLE reconnect or live-mode restore may
                    # still bring it up (as the switch left it wanted on)
                    if task.done() and not self.adapter.live_mode_may_still_connect:
                        raise HomeAssistantError(
                            "Live mode did not connect: the connection attempt "
                            "failed, see the log for details"
                        )
                    await asyncio.sleep(LIVE_MODE_POLL_INTERVAL)
        except TimeoutError:
            raise HomeAssistantError(
                f"Live mode did not connect within {timeout:.0f} seconds"
            ) from None

    def live_mode_connected(self) -> bool:
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
        except HomeAssistantError as err:
            _LOGGER.warning("%s", err)
        except Exception:
            _LOGGER.exception("Failed to turn on live mode")

    # Look

    def snapshot_look(self) -> tuple[int | None, list[dict[str, Any]], int | None]:
        """Return the eye icon, lights and movement bitfield as cached now."""
        cache = self.coordinator.data or {}
        return (
            cache.get("eye_icon"),
            [dict(light) for light in cache.get("lights") or []],
            cache.get("action"),
        )

    async def _paced(self, command) -> None:
        await command
        await asyncio.sleep(COMMAND_DELAY)

    async def async_apply_mood(self, mood_def: dict) -> None:
        client = self.client
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

            changes: dict[int, dict[str, Any]] = {}
            for position, light_def in enumerate(self.profile["lights"]):
                channel = light_def["channel"]
                r, g, b = colors[min(position, len(colors) - 1)]
                await self._paced(client.set_light_rgb(channel, r, g, b, color_cycle))
                await self._paced(client.set_light_brightness(channel, 255))
                await self._paced(client.set_light_mode(channel, mode))
                if speed is not None:
                    await self._paced(client.set_light_speed(channel, speed))

                changes[channel] = {
                    "rgb": (r, g, b),
                    "brightness": 255,
                    "effect_type": mode,
                    "color_cycle": color_cycle,
                }
                if speed is not None:
                    changes[channel]["effect_speed"] = speed
            self.coordinator.async_update_lights(changes)

    async def async_send_movement(self, action: int) -> None:
        async with self.coordinator.action_lock:
            await self.client.set_movement_action(action)
            self.coordinator.async_update_data_optimistic("action", action)

    async def async_restore_movement(self, action: int | None) -> None:
        """Send an earlier movement bitfield back. Best effort."""
        if action is None:
            return
        try:
            await self.async_send_movement(int(action))
        except Exception:
            _LOGGER.exception("Failed to restore movement")

    async def async_restore_look(
        self, eye_icon: int | None, lights: list[dict[str, Any]]
    ) -> None:
        """Send the eyes and lights from before the mood back to the device.

        Best effort: a failure is logged, so it doesn't hide the result or
        the error of the perform or conversation itself.
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
            _LOGGER.exception("Failed to restore eyes and lights")


async def async_wait_all(tasks: list[asyncio.Task]) -> None:
    """Wait for all tasks; on the first failure cancel the rest and raise it.

    If the caller is cancelled, the tasks are cancelled too.
    """
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        raise
    for task in pending:
        task.cancel()
    # Raise in the order given, so the same failure wins each time
    for task in tasks:
        if task in done and not task.cancelled() and task.exception() is not None:
            raise task.exception()
    for task in done:
        task.result()
