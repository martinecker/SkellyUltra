"""Per-file movement, eye and light settings of files on the device.

Every file stored on the device carries its own movement bitfield, eye icon
and per-channel light settings, which the device applies while that file
plays. This module writes them, both for the edit_file action and to restore
a file's settings after an upload overwrote it.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import logging
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .helpers import (
    MAX_UI_EFFECT_SPEED,
    device_speed_to_ui,
    get_device_profile,
    movement_bits,
    ui_speed_to_device,
)
from .skelly_ultra_pkg import parser

_LOGGER = logging.getLogger(__name__)

# Delay between per-file setting writes. These are unacknowledged writes the
# device can drop when sent back-to-back (matches APPLY_ALL_COMMAND_DELAY_MS
# in the web controller).
FILE_SETTING_WRITE_DELAY = 0.04

# Light effect type the device uses for a steady light; effect speed has no
# effect in it.
STATIC_EFFECT_TYPE = 1


@dataclass
class LightSettings:
    """Settings of one light channel of a file. None means unchanged."""

    brightness: int | None = None
    effect_type: int | None = None
    effect_speed: int | None = None  # device scale
    rgb: tuple[int, int, int] | None = None
    color_cycle: int | None = None


@dataclass
class FileSettings:
    """Movement, eye and light settings of a file. None means unchanged."""

    action: int | None = None
    eye_icon: int | None = None
    lights: dict[int, LightSettings] = field(default_factory=dict)


def settings_from_file_info(
    profile: dict, file_info: parser.FileInfoEvent
) -> FileSettings:
    """Return all of a file's settings, for the channels the profile has.

    The effect speed is left out for static lights, where it does nothing.
    """
    lights: dict[int, LightSettings] = {}
    for light_def in profile.get("lights", []):
        channel = light_def["channel"]
        if channel >= len(file_info.lights):
            continue
        light = file_info.lights[channel]
        lights[channel] = LightSettings(
            brightness=light.brightness,
            effect_type=light.effect_type,
            effect_speed=(
                light.effect_speed if light.effect_type != STATIC_EFFECT_TYPE else None
            ),
            rgb=tuple(light.rgb),
            color_cycle=light.color_cycle,
        )
    return FileSettings(
        action=file_info.action,
        eye_icon=file_info.eye_icon if profile.get("has_eye_image") else None,
        lights=lights,
    )


async def async_apply_file_settings(
    client: Any,
    profile: dict,
    cluster: int,
    filename: str,
    settings: FileSettings,
) -> int:
    """Write a file's settings to the device and return the number of writes.

    Only the settings that aren't None are sent. An RGB write always carries
    the color cycle flag too, so callers that change only one of rgb and
    color_cycle must fill in the other (diff_file_settings does). Writes are
    paced by FILE_SETTING_WRITE_DELAY, since the device can drop back-to-back
    writes.
    """
    writes = 0

    async def paced(command) -> None:
        nonlocal writes
        await command
        writes += 1
        await asyncio.sleep(FILE_SETTING_WRITE_DELAY)

    if settings.action is not None:
        await paced(client.set_movement_action(settings.action, cluster, filename))

    if settings.eye_icon is not None and profile.get("has_eye_image"):
        await paced(client.set_eye_icon(settings.eye_icon, cluster, filename))

    for channel, light in sorted(settings.lights.items()):
        if light.brightness is not None:
            await paced(
                client.set_light_brightness(
                    channel, light.brightness, cluster, filename
                )
            )
        if light.effect_type is not None:
            await paced(
                client.set_light_mode(channel, light.effect_type, cluster, filename)
            )
        if light.effect_speed is not None:
            await paced(
                client.set_light_speed(channel, light.effect_speed, cluster, filename)
            )
        if light.rgb is not None:
            r, g, b = light.rgb
            await paced(
                client.set_light_rgb(
                    channel, r, g, b, light.color_cycle or 0, cluster, filename
                )
            )

    return writes


async def async_restore_file_settings(
    client: Any,
    profile: dict,
    cluster: int,
    filename: str,
    existing_file: parser.FileInfoEvent,
) -> None:
    """Re-send a file's movement/eye/light settings after an overwrite.

    The device resets a file's settings to default on every upload,
    including an overwrite of an existing file, so callers must capture the
    file's previous FileInfoEvent before uploading and pass it here right
    after the transfer completes, using the pre-upload cluster.
    """
    await async_apply_file_settings(
        client,
        profile,
        cluster,
        filename,
        settings_from_file_info(profile, existing_file),
    )


def diff_file_settings(current: FileSettings, wanted: FileSettings) -> FileSettings:
    """Return only the settings in `wanted` that differ from `current`.

    rgb and color_cycle go to the device in one write, so if either
    changes, both are returned, the unchanged one taken from `current`.
    """
    changes = FileSettings()
    if wanted.action is not None and wanted.action != current.action:
        changes.action = wanted.action
    if wanted.eye_icon is not None and wanted.eye_icon != current.eye_icon:
        changes.eye_icon = wanted.eye_icon

    for channel, want in wanted.lights.items():
        have = current.lights.get(channel, LightSettings())
        change = LightSettings()
        for attr in ("brightness", "effect_type", "effect_speed"):
            value = getattr(want, attr)
            if value is not None and value != getattr(have, attr):
                setattr(change, attr, value)

        rgb = want.rgb if want.rgb is not None else have.rgb
        color_cycle = (
            want.color_cycle if want.color_cycle is not None else have.color_cycle
        )
        if (want.rgb is not None and want.rgb != have.rgb) or (
            want.color_cycle is not None and want.color_cycle != have.color_cycle
        ):
            if rgb is None:
                raise HomeAssistantError(
                    f"Light channel {channel}: give rgb along with color_cycle, "
                    "since the file's current color is unknown"
                )
            change.rgb = rgb
            change.color_cycle = color_cycle or 0

        if change != LightSettings():
            changes.lights[channel] = change

    return changes


def _light_mode_number(profile: dict, mode: Any, channel: int) -> int:
    """Return the device effect type (1-based) for a mode name or number."""
    modes = profile.get("light_modes", [])
    if isinstance(mode, str) and not mode.strip().isdigit():
        lowered = {name.lower(): index for index, name in enumerate(modes, start=1)}
        if (number := lowered.get(mode.strip().lower())) is None:
            raise HomeAssistantError(
                f'Light channel {channel}: unknown effect_mode "{mode}"; '
                f"use one of {', '.join(modes)} or 1-{len(modes)}"
            )
        return number
    return _int_in_range(
        mode, 1, len(modes), f"Light channel {channel} effect_mode ({', '.join(modes)})"
    )


def _int_in_range(value: Any, low: int, high: int, what: str) -> int:
    """Return value as an int, raising if it isn't a whole number in [low, high]."""
    if isinstance(value, bool):
        raise HomeAssistantError(f"{what} must be a number, got {value!r}")
    try:
        number = int(value)
        if isinstance(value, float) and value != number:
            raise ValueError
    except (TypeError, ValueError, OverflowError):
        raise HomeAssistantError(
            f"{what} must be a whole number, got {value!r}"
        ) from None
    if not low <= number <= high:
        raise HomeAssistantError(f"{what} must be {low}-{high}, got {number}")
    return number


def settings_from_edit_request(profile: dict, data: dict[str, Any]) -> FileSettings:
    """Validate edit_file fields against the device profile.

    Returns the requested settings in device units; fields left out are None.
    """
    settings = FileSettings()

    if (movements := data.get("movements")) is not None:
        settings.action = movement_bits(profile, list(movements))

    if (eye_icon := data.get("eye_icon")) is not None:
        icons = profile.get("eye_icons", [])
        if not profile.get("has_eye_image") or not icons:
            raise HomeAssistantError("This device has no eye icons")
        settings.eye_icon = _int_in_range(eye_icon, 1, len(icons), "eye_icon")

    lights = data.get("lights")
    if lights is None:
        return settings
    if isinstance(lights, dict):
        lights = [lights]
    if not isinstance(lights, list):
        raise HomeAssistantError("lights must be a list of light settings")

    channels = {light_def["channel"] for light_def in profile.get("lights", [])}
    for light in lights:
        if not isinstance(light, dict):
            raise HomeAssistantError(f"Each light must be a mapping, got {light!r}")
        unknown = set(light) - {
            "channel",
            "brightness",
            "effect_mode",
            "effect_speed",
            "rgb",
            "color_cycle",
        }
        if unknown:
            raise HomeAssistantError(
                f"Unknown light setting(s): {', '.join(sorted(unknown))}"
            )
        if "channel" not in light:
            raise HomeAssistantError("Each light needs a channel")
        channel = _int_in_range(light["channel"], 0, 255, "Light channel")
        if channel not in channels:
            raise HomeAssistantError(
                f"This device has no light channel {channel}; use "
                f"{', '.join(str(c) for c in sorted(channels))}"
            )
        if channel in settings.lights:
            raise HomeAssistantError(f"Light channel {channel} is given twice")

        entry = LightSettings()
        if light.get("brightness") is not None:
            entry.brightness = _int_in_range(
                light["brightness"], 0, 255, f"Light channel {channel} brightness"
            )
        if light.get("effect_mode") is not None:
            entry.effect_type = _light_mode_number(
                profile, light["effect_mode"], channel
            )
        if light.get("effect_speed") is not None:
            entry.effect_speed = ui_speed_to_device(
                _int_in_range(
                    light["effect_speed"],
                    0,
                    MAX_UI_EFFECT_SPEED,
                    f"Light channel {channel} effect_speed",
                )
            )
        if light.get("rgb") is not None:
            rgb = light["rgb"]
            if not isinstance(rgb, (list, tuple)) or len(rgb) != 3:
                raise HomeAssistantError(
                    f"Light channel {channel} rgb must be [r, g, b], got {rgb!r}"
                )
            entry.rgb = tuple(
                _int_in_range(value, 0, 255, f"Light channel {channel} rgb value")
                for value in rgb
            )
        if light.get("color_cycle") is not None:
            try:
                entry.color_cycle = 1 if cv.boolean(light["color_cycle"]) else 0
            except vol.Invalid:
                raise HomeAssistantError(
                    f"Light channel {channel} color_cycle must be true or false, "
                    f"got {light['color_cycle']!r}"
                ) from None
        settings.lights[channel] = entry

    return settings


async def async_load_file_list_for_change(
    adapter: Any, coordinator: Any
) -> list[parser.FileInfoEvent]:
    """Refresh the file list before changing files on the device, and return it.

    The caller must hold coordinator.action_lock. Raises if the device isn't
    connected or is playing a file, since the refresh is skipped in those
    states and working from a stale list could miss changes, or if the list
    couldn't be read.
    """
    if not adapter.client.is_connected:
        raise HomeAssistantError("The device is not connected")
    if coordinator.playback_active:
        raise HomeAssistantError(
            "The device is playing a file, so its file list can't be read. "
            "Try again once playback has stopped."
        )
    await coordinator.async_refresh_file_list(lock_held=True)
    # A failed load leaves an empty list, which shouldn't read as "not found"
    if not adapter.client.is_connected:
        raise HomeAssistantError("Lost connection while reading the file list")
    if not coordinator.file_list:
        raise HomeAssistantError(
            "The device reported no files, or its file list couldn't be read"
        )
    return coordinator.file_list


def _find_file(
    file_list: list[parser.FileInfoEvent],
    filename: str | None,
    file_index: int | None,
    cluster: int | None,
) -> parser.FileInfoEvent:
    """Look up a file by name, or by file index and cluster."""
    if filename:
        match = next((f for f in file_list if f.name == filename), None)
        if not match:
            raise HomeAssistantError(f"File '{filename}' not found in device file list")
        return match
    match = next(
        (f for f in file_list if f.file_index == file_index and f.cluster == cluster),
        None,
    )
    if not match:
        raise HomeAssistantError(
            f"File with index {file_index} and cluster {cluster} not found in "
            "device file list"
        )
    return match


async def async_edit_file(
    hass: HomeAssistant, adapter: Any, entry_id: str, data: dict[str, Any]
) -> int:
    """Change a file's movement, eye and light settings on the device.

    Settings left out of `data` keep their current values, and only values
    that differ from the file's current ones are written. Returns the number
    of writes sent.
    """
    filename = data.get("filename")
    file_index = data.get("file_index")
    cluster = data.get("cluster")
    if filename:
        if file_index is not None or cluster is not None:
            raise HomeAssistantError(
                "Cannot specify both filename and file_index/cluster"
            )
    elif file_index is None or cluster is None:
        raise HomeAssistantError(
            "Must provide either filename OR both file_index and cluster"
        )

    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    if not coordinator:
        raise HomeAssistantError(f"No coordinator found for entry {entry_id}")
    config_entry = hass.config_entries.async_get_entry(entry_id)
    if config_entry is None:
        raise HomeAssistantError(f"No config entry found for entry {entry_id}")
    profile = get_device_profile(config_entry)

    # Validate before touching the device
    wanted = settings_from_edit_request(profile, data)

    # Holding the lock keeps coordinator polling and other writes out while
    # the file is looked up and edited.
    async with coordinator.action_lock:
        file_list = await async_load_file_list_for_change(adapter, coordinator)
        file_info = _find_file(file_list, filename, file_index, cluster)

        current = settings_from_file_info(profile, file_info)
        # Compare speeds even for static lights, where settings_from_file_info
        # leaves them out, so an explicit speed is only sent if it changes.
        # Round-trip through the UI scale so the device's 255 (fastest)
        # compares equal to 0, the value a UI speed of 254 maps to.
        for channel, light in current.lights.items():
            light.effect_speed = ui_speed_to_device(
                device_speed_to_ui(file_info.lights[channel].effect_speed)
            )
        changes = diff_file_settings(current, wanted)

        try:
            writes = await async_apply_file_settings(
                adapter.client, profile, file_info.cluster, file_info.name, changes
            )
        except Exception:
            # Some writes may have landed; show what the device has now
            await coordinator.async_refresh_file_list(lock_held=True)
            raise
        _LOGGER.info(
            "Edited file '%s' (index=%d, cluster=%d) with %d write(s)",
            file_info.name,
            file_info.file_index,
            file_info.cluster,
            writes,
        )

        if writes:
            await coordinator.async_refresh_file_list(lock_held=True)

    return writes
