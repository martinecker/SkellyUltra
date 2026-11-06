"""Websocket API for a Skelly Ultra file manager frontend.

skelly_ultra/files/list returns a device's files with their settings, the
play order, the free storage, the transfer state and the device profile
metadata a UI needs to edit files. skelly_ultra/files/subscribe sends the
same payload right away and again whenever it changes.
skelly_ultra/devices/list returns the loaded Skellies, for a device picker.

These commands only read. Changes go through the skelly_ultra.* actions,
so automations and the UI share one path.
"""

from __future__ import annotations

import logging
import time
from functools import partial
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import CONF_DEVICE_TYPE, DEVICE_TYPE_SKELLY, DOMAIN
from .skelly_ultra_pkg.constants import MAX_FILENAME_LENGTH
from .helpers import (
    MAX_UI_EFFECT_SPEED,
    device_speed_to_ui,
    files_updated_signal,
    get_device_profile,
    movement_parts,
)
from .select import BITRATE_OPTIONS
from .sensor import idle_transfer_state
from .skelly_ultra_pkg.audio_processor import AudioProcessor
from .skelly_ultra_pkg.file_transfer import FileTransferManager

_LOGGER = logging.getLogger(__name__)

# The images/ folder: eye icons (<image_folder>/eye_icon_<n>.png) and movement
# icons (<image_folder>/movement_<part>.png) of each device profile
IMAGE_URL = f"/{DOMAIN}/images"
IMAGE_DIR = Path(__file__).parent / "images"

# Folder in the "local" media directory (My media) that a UI uploads files to
# before sending them to a Skelly. Uploaded files stay there, so they can be
# sent again from the media library.
UPLOAD_FOLDER = DOMAIN
LOCAL_MEDIA_DIR = "local"

_REGISTERED_KEY = f"{DOMAIN}_websocket_registered"
# Media source ID of the upload folder, or None if there is none
_UPLOAD_TARGET_KEY = f"{DOMAIN}_upload_target"
# entry_id -> {subscription end callbacks}, to end them when the entry unloads
_SUBSCRIPTIONS_KEY = f"{DOMAIN}_file_subscriptions"

_TARGET_SCHEMA = {
    vol.Exclusive("entry_id", "target"): str,
    vol.Exclusive("device_id", "target"): str,
}


async def async_setup_websocket_api(hass: HomeAssistant) -> None:
    """Register the websocket commands and the images path, make the upload folder.

    None of these can be undone, so this runs once per Home Assistant run,
    on the first entry that is set up. The commands check that the entry
    they are asked about is loaded.
    """
    if hass.data.get(_REGISTERED_KEY):
        return
    hass.data[_REGISTERED_KEY] = True
    hass.data[_UPLOAD_TARGET_KEY] = None

    websocket_api.async_register_command(hass, ws_list_files)
    websocket_api.async_register_command(hass, ws_subscribe_files)
    websocket_api.async_register_command(hass, ws_list_devices)

    if IMAGE_DIR.is_dir():
        await hass.http.async_register_static_paths(
            [StaticPathConfig(IMAGE_URL, str(IMAGE_DIR), cache_headers=True)]
        )

    hass.data[_UPLOAD_TARGET_KEY] = await _async_make_upload_folder(hass)


async def _async_make_upload_folder(hass: HomeAssistant) -> str | None:
    """Create the upload folder in My media; return its media source ID.

    Return None if there is no "local" media directory (it can be configured
    away) or the folder can't be created.
    """
    media_dir = hass.config.media_dirs.get(LOCAL_MEDIA_DIR)
    if media_dir is None:
        _LOGGER.debug("No local media directory, so the UI can't upload files")
        return None
    folder = Path(media_dir) / UPLOAD_FOLDER
    try:
        await hass.async_add_executor_job(
            partial(folder.mkdir, parents=True, exist_ok=True)
        )
    except OSError as err:
        _LOGGER.warning(
            "Can't create the upload folder %s, so the UI can't upload files: %s",
            folder,
            err,
        )
        return None
    return f"media-source://media_source/{LOCAL_MEDIA_DIR}/{UPLOAD_FOLDER}"


def _resolve_entry(hass: HomeAssistant, msg: dict[str, Any]) -> ConfigEntry | None:
    """Return the loaded entry a message targets, or None.

    Without entry_id or device_id, the only loaded entry is used.
    """
    entries = [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if entry.state is ConfigEntryState.LOADED
        and entry.entry_id in hass.data.get(DOMAIN, {})
    ]
    if "entry_id" in msg:
        return next((e for e in entries if e.entry_id == msg["entry_id"]), None)
    if "device_id" in msg:
        device = dr.async_get(hass).async_get(msg["device_id"])
        if device is None:
            return None
        return next((e for e in entries if e.entry_id in device.config_entries), None)
    return entries[0] if len(entries) == 1 else None


def _send_not_found(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Answer a message whose target couldn't be resolved."""
    if "entry_id" in msg or "device_id" in msg:
        message = "No loaded Skelly found for this entry_id or device_id"
    elif (
        sum(
            entry.state is ConfigEntryState.LOADED
            for entry in hass.config_entries.async_entries(DOMAIN)
        )
        > 1
    ):
        message = "More than one Skelly is set up; pass entry_id or device_id"
    else:
        message = "No loaded Skelly found"
    connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, message)


@callback
def async_end_file_subscriptions(hass: HomeAssistant, entry_id: str) -> None:
    """End an entry's files subscriptions; call when the entry starts unloading.

    Each subscriber gets a last event with unloaded set (and available
    cleared), so a UI knows to subscribe again once the entry is back.
    """
    for end in list(hass.data.get(_SUBSCRIPTIONS_KEY, {}).pop(entry_id, ())):
        end()


def _profile_payload(entry: ConfigEntry, profile: dict) -> dict[str, Any]:
    """Return the profile metadata a UI needs to show and edit files."""
    folder_url = f"{IMAGE_URL}/{profile['image_folder']}"
    eye_icons = []
    if profile.get("has_eye_image"):
        eye_icons = [
            {
                "value": number,
                "label": label,
                "url": f"{folder_url}/eye_icon_{number}.png",
            }
            for number, label in enumerate(profile["eye_icons"], start=1)
        ]
    return {
        "type": entry.data.get(CONF_DEVICE_TYPE, DEVICE_TYPE_SKELLY),
        "display_name": profile["display_name"],
        "movements": [
            {
                "part": m["part"],
                "label": m["part"].capitalize(),
                "icon_url": f"{folder_url}/movement_{m['part']}.png",
            }
            for m in profile["movements"]
        ],
        "lights": [
            {"channel": light["channel"], "label": light["label"]}
            for light in profile["lights"]
        ],
        "light_modes": list(profile["light_modes"]),
        "eye_icons": eye_icons,
        "max_effect_speed": MAX_UI_EFFECT_SPEED,
        "max_filename_length": MAX_FILENAME_LENGTH,
    }


def _file_payload(profile: dict, file_info: Any, enabled: bool) -> dict[str, Any]:
    """Return one file's entry, in the units edit_file takes."""
    lights = []
    for light_def in profile["lights"]:
        channel = light_def["channel"]
        if channel >= len(file_info.lights):
            continue
        light = file_info.lights[channel]
        lights.append(
            {
                "channel": channel,
                "brightness": light.brightness,
                "effect_mode": light.effect_type,
                "effect_speed": device_speed_to_ui(light.effect_speed),
                "rgb": list(light.rgb),
                "color_cycle": bool(light.color_cycle),
            }
        )
    return {
        "name": file_info.name,
        "file_index": file_info.file_index,
        "cluster": file_info.cluster,
        "enabled": enabled,
        "movements": movement_parts(profile, file_info.action),
        "movement_bits": file_info.action,
        "eye_icon": file_info.eye_icon if profile.get("has_eye_image") else None,
        "lights": lights,
    }


def _entry_device(hass: HomeAssistant, entry: ConfigEntry) -> dr.DeviceEntry | None:
    """Return the entry's device in the device registry."""
    devices = dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)
    return devices[0] if devices else None


def _device_name(entry: ConfigEntry, device: dr.DeviceEntry | None) -> str:
    """Return the name the user sees for the device."""
    if device is not None:
        return device.name_by_user or device.name or entry.title
    return entry.title


def _entity_id(hass: HomeAssistant, domain: str, unique_id: str) -> str | None:
    """Return the entity_id of one of the integration's entities, if it exists."""
    return er.async_get(hass).async_get_entity_id(domain, DOMAIN, unique_id)


def _transfer_settings(
    hass: HomeAssistant, entry: ConfigEntry, data: dict[str, Any]
) -> dict[str, Any]:
    """Return the file transfer overrides and the entities that change them.

    A UI changes them through the entities (switch.turn_on, number.set_value,
    select.select_option), like any automation. The value entities only take
    a value while their override switch is on.
    """
    entry_id = entry.entry_id
    chunk_override = bool(data.get("override_chunk_size", False))
    bitrate_override = bool(data.get("override_bitrate", False))
    return {
        "chunk_size": {
            "override": chunk_override,
            "value": data.get(
                "chunk_size_override", FileTransferManager.DEFAULT_CHUNK_SIZE
            ),
            # What the connection's MTU allows; used without the override
            "auto": data.get("mtu_chunk_size"),
            "min": FileTransferManager.MIN_CHUNK_SIZE,
            "max": FileTransferManager.MAX_CHUNK_SIZE,
            "switch_entity": _entity_id(
                hass, "switch", f"{entry_id}_override_chunk_size"
            ),
            "value_entity": _entity_id(hass, "number", f"{entry_id}_chunk_size"),
        },
        "bitrate": {
            "override": bitrate_override,
            "value": data.get("bitrate_override", AudioProcessor.MP3_BITRATE),
            "default": AudioProcessor.MP3_BITRATE,
            "options": list(BITRATE_OPTIONS),
            "switch_entity": _entity_id(hass, "switch", f"{entry_id}_override_bitrate"),
            "value_entity": _entity_id(hass, "select", f"{entry_id}_bitrate"),
        },
    }


def _stamped(payload: dict[str, Any]) -> dict[str, Any]:
    """Add sent_at, HA's clock (ms since the epoch) as the payload is sent.

    A UI compares it with its own clock to show playback.started in its
    time. It isn't part of the payload compared to skip unchanged ones.
    """
    return {**payload, "sent_at": int(time.time() * 1000)}


def build_files_payload(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    """Return the files payload of a loaded entry."""
    entry_data = hass.data[DOMAIN][entry.entry_id]
    coordinator = entry_data["coordinator"]
    profile = get_device_profile(entry)
    data = coordinator.data or {}
    file_order = list(data.get("file_order") or [])
    enabled = set(file_order)
    transfer_sensor = entry_data.get("transfer_sensor")
    device = _entry_device(hass, entry)
    return {
        "entry_id": entry.entry_id,
        "device_id": device.id if device else None,
        "name": _device_name(entry, device),
        "unloaded": False,
        "device_profile": _profile_payload(entry, profile),
        "available": coordinator.last_update_success,
        # The file list is being read from the device, so it may be outdated
        "refreshing": coordinator.file_list_loading,
        # The file the Skelly reported playing: file_index, duration
        # (seconds, 0 if unknown), started (ms since the epoch) and report
        # (new for each report), or None
        "playback": coordinator.playback,
        "capacity": {
            "free_kb": data.get("capacity_kb"),
            "file_count_reported": data.get("file_count_reported"),
        },
        "file_order": file_order,
        "files": [
            _file_payload(profile, f, f.file_index in enabled)
            for f in coordinator.file_list
        ],
        "transfer": (
            transfer_sensor.transfer_state
            if transfer_sensor is not None
            else idle_transfer_state()
        ),
        "transfer_settings": _transfer_settings(hass, entry, data),
        # The live mode entities (None: not in the entity registry). A UI
        # reads their states: the switch is on while live mode is on (or
        # being restored), the speaker is available while it's connected.
        "live_mode": {
            "switch_entity": _entity_id(
                hass, "switch", f"{entry.entry_id}_live_mode"
            ),
            "speaker_entity": _entity_id(
                hass, "media_player", f"{entry.entry_id}_live_mode_speaker"
            ),
        },
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): "skelly_ultra/files/list",
        **_TARGET_SCHEMA,
        vol.Optional("refresh", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_list_files(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return a device's files, play order, capacity and transfer state.

    With refresh, the file list is read from the device first. That is
    skipped while the device is disconnected or playing a file.
    """
    entry = _resolve_entry(hass, msg)
    if entry is None:
        _send_not_found(hass, connection, msg)
        return
    if msg["refresh"]:
        coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
        await coordinator.async_refresh_file_list()
        # The entry may have been unloaded while the list was read
        if entry.entry_id not in hass.data.get(DOMAIN, {}):
            connection.send_error(
                msg["id"], websocket_api.ERR_NOT_FOUND, "No loaded Skelly found"
            )
            return
    connection.send_result(msg["id"], _stamped(build_files_payload(hass, entry)))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "skelly_ultra/files/subscribe",
        **_TARGET_SCHEMA,
    }
)
@callback
def ws_subscribe_files(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Send the files payload now and whenever it changes.

    Changes come from the coordinator (file list, order, capacity,
    availability) and from the transfer progress sensor. The payload is
    only sent when it differs from the last one sent.
    """
    entry = _resolve_entry(hass, msg)
    if entry is None:
        _send_not_found(hass, connection, msg)
        return
    entry_id = entry.entry_id
    coordinator = hass.data[DOMAIN][entry_id]["coordinator"]
    last_sent: dict[str, Any] | None = None
    unsubscribed = False

    @callback
    def send_if_changed() -> None:
        nonlocal last_sent
        # Also skip once the entry has started unloading
        if unsubscribed or entry_id not in hass.data.get(DOMAIN, {}):
            return
        payload = build_files_payload(hass, entry)
        if payload == last_sent:
            return
        last_sent = payload
        connection.send_message(
            websocket_api.event_message(msg["id"], _stamped(payload))
        )

    unsub_coordinator = coordinator.async_add_listener(send_if_changed)
    unsub_signal = async_dispatcher_connect(
        hass, files_updated_signal(entry_id), send_if_changed
    )
    subscriptions: set = hass.data.setdefault(_SUBSCRIPTIONS_KEY, {}).setdefault(
        entry_id, set()
    )

    @callback
    def unsubscribe() -> None:
        """Stop listening: the client unsubscribed or disconnected."""
        nonlocal unsubscribed
        if unsubscribed:
            return
        unsubscribed = True
        unsub_coordinator()
        unsub_signal()
        subscriptions.discard(end_for_unload)

    @callback
    def end_for_unload() -> None:
        """Tell the client the entry is unloading, then stop listening."""
        if not unsubscribed and last_sent is not None:
            connection.send_message(
                websocket_api.event_message(
                    msg["id"],
                    {
                        **_stamped(last_sent),
                        "unloaded": True,
                        "available": False,
                        "refreshing": False,
                        "playback": None,
                        "transfer": idle_transfer_state(),
                    },
                )
            )
        unsubscribe()
        connection.subscriptions.pop(msg["id"], None)

    subscriptions.add(end_for_unload)
    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
    send_if_changed()


@websocket_api.websocket_command({vol.Required("type"): "skelly_ultra/devices/list"})
@callback
def ws_list_devices(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the loaded Skellies, for a UI's device picker.

    Unlike the device registry commands, this doesn't need an admin user.
    upload_target is the media source ID a UI uploads files to (the same for
    every Skelly), or None if Home Assistant has no local media directory.
    """
    upload_target = hass.data.get(_UPLOAD_TARGET_KEY)
    devices = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        if (
            entry.state is not ConfigEntryState.LOADED
            or entry.entry_id not in hass.data.get(DOMAIN, {})
        ):
            continue
        coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
        device = _entry_device(hass, entry)
        devices.append(
            {
                "entry_id": entry.entry_id,
                "device_id": device.id if device else None,
                "name": _device_name(entry, device),
                "type": entry.data.get(CONF_DEVICE_TYPE, DEVICE_TYPE_SKELLY),
                "available": coordinator.last_update_success,
                "upload_target": upload_target,
            }
        )
    connection.send_result(msg["id"], devices)
