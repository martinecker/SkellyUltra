"""What the perform and converse actions do on one Skelly.

SkellyStage turns live mode on, applies a mood's eyes, lights and movement,
plays audio through the live-mode speaker and restores the look. The module
functions render TTS, ask an AI Task entity for structured data and wait for
a camera snapshot.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from pathlib import Path
from typing import Any, Protocol

import voluptuous as vol

from homeassistant.components import tts
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import MOOD_LIGHT_SPEEDS, MOODS
from .data import get_skelly_data, skelly_data
from .entity import async_turn_on_live_mode
from .file_settings import (
    FileSettings,
    LightingState,
    LightSettings,
    async_apply_file_settings,
    async_current_light_scene,
    async_push_live_settings,
    live_light_settings,
)
from .helpers import get_device_profile, movement_bits
from .uploads import async_tts_to_temp_file, remove_temp_files

_LOGGER = logging.getLogger(__name__)

MOOD_AUTO = "auto"
MOOD_NONE = "none"
MOVEMENT_MOOD = "mood"
MOVEMENT_NONE = "none"

DEFAULT_LIVE_MODE_TIMEOUT = 30.0
DEFAULT_CAMERA_WAIT = 1.0

# How often to check whether live mode has connected
LIVE_MODE_POLL_INTERVAL = 0.5


HISTORY_SIZE = 10
HISTORY_STORAGE_VERSION = 1

# Schema pieces perform and converse share

NON_BLANK = vol.All(cv.string, vol.Strip, vol.Length(min=1, msg="must not be empty"))

# Fields both actions take with the same meaning. Optional ones also take
# None or "", which a blueprint passes for an input left blank; drop_blank
# removes them.
STAGE_SCHEMA_FIELDS: dict[Any, Any] = {
    vol.Optional("camera_entity"): vol.Any(None, "", cv.entity_domain("camera")),
    vol.Optional("camera_wait", default=DEFAULT_CAMERA_WAIT): vol.All(
        vol.Coerce(float), vol.Range(min=0, max=60)
    ),
    vol.Optional("ai_task_entity"): vol.Any(None, "", cv.entity_domain("ai_task")),
    vol.Optional("tts_options"): vol.Any(None, "", dict),
    vol.Optional("language"): vol.Any(None, vol.All(cv.string, vol.Strip)),
    vol.Optional("movement", default=[MOVEMENT_MOOD]): vol.All(
        cv.ensure_list, [cv.string]
    ),
    vol.Optional("restore", default=True): cv.boolean,
    vol.Optional("restore_movement", default=False): cv.boolean,
    vol.Optional("live_mode_timeout", default=DEFAULT_LIVE_MODE_TIMEOUT): vol.All(
        vol.Coerce(float), vol.Range(min=1, max=300)
    ),
    vol.Optional("wait_until_done", default=True): cv.boolean,
}

# The blankable fields of STAGE_SCHEMA_FIELDS
STAGE_BLANKABLE = ("camera_entity", "ai_task_entity", "language", "tts_options")


def drop_blank(data: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    """Return data without the given keys whose value is blank."""
    return {k: v for k, v in data.items() if k not in keys or v}


def check_movement(data: dict[str, Any]) -> None:
    """Raise vol.Invalid if movement mixes mood or none with parts."""
    movement = data["movement"]
    if len(movement) > 1 and (MOVEMENT_MOOD in movement or MOVEMENT_NONE in movement):
        raise vol.Invalid("movement takes mood, none, or a list of parts, not a mix")


# The AI's answer to "is someone in the camera image"
PERSON_PRESENT_FIELD = {
    "description": "Whether a person can be seen in the image",
    "required": True,
    "selector": {"boolean": {}},
}


def person_present_from(result: dict[str, Any], camera: str | None) -> bool | None:
    """Return the AI's person_present answer, or None without a camera."""
    if camera and "person_present" in result:
        return bool(result["person_present"])
    return None


class RecentHistory:
    """The most recent items (lines, topics) an action keeps, so the AI
    doesn't repeat them. Stored as {field: [...]}."""

    def __init__(self, hass: HomeAssistant, storage_key: str, field: str) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass, HISTORY_STORAGE_VERSION, storage_key
        )
        self._field = field
        self._loaded = False
        self.items: list[str] = []

    async def async_load(self) -> None:
        """Load the items from storage, once."""
        if self._loaded:
            return
        data = await self._store.async_load()
        items = data.get(self._field, []) if isinstance(data, dict) else []
        self.items = [str(item) for item in items][-HISTORY_SIZE:]
        self._loaded = True

    async def async_add(self, item: str) -> None:
        """Append an item, keeping the most recent ones."""
        self.items = [*self.items, item][-HISTORY_SIZE:]
        await self._store.async_save({self._field: self.items})

    async def async_clear(self) -> None:
        """Forget all items."""
        self.items = []
        await self._store.async_save({self._field: self.items})

    async def async_remove(self) -> None:
        """Delete the stored items."""
        await self._store.async_remove()


class StageState:
    """Per-Skelly state shared by perform and converse.

    Kept in the entry's runtime data as perform (a PerformManager, which
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
    except Exception as err:
        raise HomeAssistantError(f"Text-to-speech failed: {err}") from err
    return await async_tts_to_temp_file(
        hass, media_id, tts_entity, prefix="skelly_perform_"
    )


async def async_remove_file(hass: HomeAssistant, path: Path) -> None:
    """Delete a temporary file, ignoring errors."""
    await hass.async_add_executor_job(remove_temp_files, [path])


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
        self.data = skelly_data(hass, entry_id)
        self.coordinator = self.data.coordinator
        # Running flag and live-mode connect, shared by perform and converse
        self.state: StageState = self.data.perform
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
        data = get_skelly_data(self.hass, self.entry_id)
        player = data.live_media_player if data is not None else None
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
        return self.adapter.live_mode_address is not None

    async def _async_turn_on_live_mode(self) -> None:
        # The same as the Live Mode switch, so live mode stays wanted
        # ("leave it on") as when turned on from the UI
        try:
            await async_turn_on_live_mode(self.adapter)
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

    async def async_apply_mood(self, mood_def: dict) -> None:
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

        eye_icon = None
        if self.profile.get("has_eye_image"):
            eye_icon = _eye_icon_index(self.profile, mood_def["eye_icon"])

        lights: dict[int, LightSettings] = {}
        changes: dict[int, dict[str, Any]] = {}
        for position, light_def in enumerate(self.profile["lights"]):
            channel = light_def["channel"]
            rgb = tuple(colors[min(position, len(colors) - 1)])
            lights[channel] = LightSettings(
                brightness=255,
                effect_type=mode,
                effect_speed=speed,
                rgb=rgb,
                color_cycle=color_cycle,
            )
            changes[channel] = {
                "rgb": rgb,
                "brightness": 255,
                "effect_type": mode,
                "color_cycle": color_cycle,
            }
            if speed is not None:
                changes[channel]["effect_speed"] = speed

        async with self.coordinator.action_lock:
            # Cluster 0 with no name addresses the live settings
            scene = await async_current_light_scene(self.coordinator, self.client)
            await async_apply_file_settings(
                self.client,
                self.profile,
                0,
                "",
                FileSettings(eye_icon=eye_icon, lights=lights),
                # A mood without a speed takes it from the current lights
                lighting=(
                    LightingState(
                        live_light_settings(
                            self.profile,
                            (self.coordinator.data or {}).get("lights") or [],
                        ),
                        scene,
                    )
                    if scene is not None
                    else None
                ),
            )
            if eye_icon is not None:
                self.coordinator.async_update_data_optimistic("eye_icon", eye_icon)
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
        try:
            async with self.coordinator.action_lock:
                await async_push_live_settings(
                    self.client,
                    self.profile,
                    {"eye_icon": eye_icon, "lights": lights},
                    scene=await async_current_light_scene(
                        self.coordinator, self.client
                    ),
                )
                if eye_icon is not None:
                    self.coordinator.async_update_data_optimistic("eye_icon", eye_icon)
                if lights:
                    self.coordinator.async_update_data_optimistic("lights", lights)
        except Exception:
            _LOGGER.exception("Failed to restore eyes and lights")


class StageRun(Protocol):
    """One run of perform or converse, as async_run_marked_busy runs it."""

    # The rest of the run, still going after async_run returned
    # (wait_until_done off); None if there is none
    background_task: asyncio.Task | None

    async def async_run(self) -> dict[str, Any]: ...


async def async_run_marked_busy(
    states: list[StageState], run: StageRun
) -> dict[str, Any]:
    """Run run.async_run() with the Skellys marked running.

    They stay marked until its background task, if any, has finished too.
    The caller checks that none of them is running already.
    """
    for state in states:
        state.running = True

    def release(_task: asyncio.Task | None = None) -> None:
        for state in states:
            state.running = False

    try:
        return await run.async_run()
    finally:
        background = run.background_task
        if background is None or background.done():
            release()
        else:
            background.add_done_callback(release)


def start_in_background(
    hass: HomeAssistant, coro: Coroutine[Any, Any, None], what: str
) -> asyncio.Task:
    """Run the rest of a run as a background task; failures are logged."""
    task = hass.async_create_background_task(coro, f"skelly_ultra {what.lower()}")

    def log_result(done: asyncio.Task) -> None:
        if not done.cancelled() and (err := done.exception()) is not None:
            _LOGGER.error("%s failed: %s", what, err)

    task.add_done_callback(log_result)
    return task


async def async_wait_started(task: asyncio.Task, started: asyncio.Future[None]) -> None:
    """Wait until playback has started, or raise why the task ended before."""
    await asyncio.wait({started, task}, return_when=asyncio.FIRST_COMPLETED)
    if not started.done():
        task.result()


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
