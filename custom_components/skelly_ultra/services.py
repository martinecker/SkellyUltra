"""Service handlers for Skelly Ultra integration."""

from __future__ import annotations

import functools
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
)
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .converse import SERVICE_CONVERSE, async_converse
from .file_order import async_set_file_order
from .file_settings import (
    async_edit_file,
    async_load_file_list_for_change,
    check_file_selector,
    find_file,
)
from .helpers import SkellyNotFoundError, resolve_skelly
from .perform import SERVICE_PERFORM, async_perform
from .skelly_ultra_pkg.client import ConnectionLostError
from .uploads import (
    FILE_TRANSFERS_KEY,
    async_resolve_audio_source,
    async_upload_audio,
    async_upload_tts,
    normalize_target_filename,
    remove_temp_files,
    transfer_failed,
)

_LOGGER = logging.getLogger(__name__)


def get_adapter_from_service_call(
    hass: HomeAssistant,
    call: ServiceCall,
    *,
    raise_on_error: bool = False,
) -> tuple[Any, str] | None:
    """Return the adapter and config entry ID of the Skelly a call targets.

    The call gives a device_id or entity_id; without either, the only loaded
    Skelly is used (see resolve_skelly). If it can't be found, raises
    HomeAssistantError with raise_on_error, otherwise logs and returns None.
    """
    try:
        entry_id, _device_id = resolve_skelly(
            hass,
            device_id=call.data.get("device_id"),
            entity_id=call.data.get("entity_id"),
        )
    except SkellyNotFoundError as err:
        if raise_on_error:
            raise
        _LOGGER.error("%s", err)
        return None
    return hass.data[DOMAIN][entry_id]["adapter"], entry_id


# Service schemas
SERVICE_ENABLE_CLASSIC_BT = vol.Schema(
    {
        vol.Optional("device_id"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
    }
)

SERVICE_FILE_CONTROL = vol.Schema(
    {
        vol.Optional("device_id"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
        vol.Required("file_index"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)

SERVICE_CANCEL_FILE_TRANSFER = vol.Schema(
    {
        vol.Optional("device_id"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
    }
)

SERVICE_SEND_FILE = vol.Schema(
    {
        vol.Optional("device_id"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
        vol.Required("file_path"): cv.string,
        vol.Required("target_filename"): cv.string,
    }
)

SERVICE_SEND_FILE_FROM_TTS = vol.Schema(
    {
        vol.Optional("device_id"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
        vol.Required("tts_entity"): cv.string,
        vol.Required("message"): vol.All(cv.string, vol.Strip, vol.Length(min=1)),
        vol.Optional("target_filename"): vol.Any(None, cv.string),
        vol.Optional("language"): vol.Any(None, cv.string),
        vol.Optional("tts_options"): vol.Any(None, dict),
    }
)

SERVICE_EDIT_FILE = vol.Schema(
    vol.All(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Optional("filename"): cv.string,
            vol.Optional("file_index"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Optional("cluster"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Optional("movements"): vol.Any(
                None, vol.All(cv.ensure_list, [cv.string])
            ),
            # Range and type checked against the device profile in file_settings
            vol.Optional("eye_icon"): vol.Any(None, int, float, str),
            # Validated against the device profile in file_settings
            vol.Optional("lights"): vol.Any(None, dict, list),
        },
        cv.has_at_least_one_key("filename", "file_index"),
        cv.has_at_least_one_key("movements", "eye_icon", "lights"),
    )
)

SERVICE_SET_FILE_ORDER = vol.Schema(
    vol.All(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Optional("filenames"): vol.All(cv.ensure_list, [cv.string]),
            vol.Optional("file_indices"): vol.All(
                cv.ensure_list, [vol.All(vol.Coerce(int), vol.Range(min=0))]
            ),
        },
        cv.has_at_least_one_key("filenames", "file_indices"),
    )
)

SERVICE_DELETE_FILE = vol.Schema(
    vol.All(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Optional("file_index"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Optional("cluster"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Optional("filename"): cv.string,
        },
        # Ensure at least one file identification method is provided
        cv.has_at_least_one_key("filename", "file_index"),
    )
)


async def async_enable_classic_bt_service(
    hass: HomeAssistant, call: ServiceCall
) -> None:
    """Enable classic Bluetooth speaker mode for a specific device.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    result = get_adapter_from_service_call(hass, call)
    if not result:
        return

    adapter, entry_id = result
    try:
        await adapter.client.enable_classic_bt()
        _LOGGER.info("Requested classic Bluetooth enable for entry %s", entry_id)
    except Exception:
        _LOGGER.exception("Failed to enable classic Bluetooth")


async def async_play_file_service(hass: HomeAssistant, call: ServiceCall) -> None:
    """Play a file on the device by file index.

    Raises HomeAssistantError if the device can't be reached or rejects the
    command, so callers (the panel, automations) see the failure.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)
    file_index = call.data["file_index"]

    coordinator = hass.data[DOMAIN][entry_id]["coordinator"]
    try:
        await coordinator.async_play_file(file_index)
    except ConnectionLostError:
        raise HomeAssistantError(
            "Lost connection to device while trying to play the file"
        ) from None
    except Exception as exc:
        _LOGGER.exception("Failed to play file %s", file_index)
        raise HomeAssistantError(f"Failed to play file {file_index}: {exc}") from exc
    _LOGGER.info("Requested play file %s for entry %s", file_index, entry_id)


async def async_stop_file_service(hass: HomeAssistant, call: ServiceCall) -> None:
    """Stop a file on the device by file index.

    Raises HomeAssistantError if the device can't be reached or rejects the
    command.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)
    file_index = call.data["file_index"]

    try:
        await adapter.client.stop_file(file_index)
    except ConnectionLostError:
        raise HomeAssistantError(
            "Lost connection to device while trying to stop the file"
        ) from None
    except Exception as exc:
        _LOGGER.exception("Failed to stop file %s", file_index)
        raise HomeAssistantError(f"Failed to stop file {file_index}: {exc}") from exc
    _LOGGER.info("Requested stop file %s for entry %s", file_index, entry_id)
    # As the media player's Stop does: don't wait for the device's "stopped"
    # event before files can be changed again (edit_file right after a stop)
    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    if coordinator is not None:
        coordinator.mark_playback_inactive()


async def async_cancel_file_transfer_service(
    hass: HomeAssistant, call: ServiceCall
) -> None:
    """Cancel an ongoing file transfer.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    result = get_adapter_from_service_call(hass, call, raise_on_error=True)
    adapter, entry_id = result

    # Check if there's an active transfer for this entry
    transfer_manager = hass.data.get(FILE_TRANSFERS_KEY, {}).get(entry_id)
    if not transfer_manager:
        raise HomeAssistantError(
            f"No file transfer in progress for this device (entry {entry_id})"
        )

    if not transfer_manager.state.in_progress:
        raise HomeAssistantError("No file transfer currently in progress")

    _LOGGER.info("Cancelling file transfer for entry %s", entry_id)
    await transfer_manager.cancel(adapter.client)
    _LOGGER.info("File transfer cancellation requested for entry %s", entry_id)


def _uploaded_file_response(
    hass: HomeAssistant, entry_id: str, filename: str
) -> ServiceResponse:
    """Build the response for an upload action: filename and file index.

    The file list was refreshed after the upload, so the new file's index
    is known unless the refresh failed, in which case it is None.
    """
    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    file_index = next(
        (f.file_index for f in coordinator.file_list if f.name == filename),
        None,
    )
    return {"filename": filename, "file_index": file_index}


async def async_send_file_service(
    hass: HomeAssistant, call: ServiceCall
) -> ServiceResponse:
    """Send audio file to device.

    Downloads/processes the file and uploads it to the device.
    The file_path can be:
    - Local file path, in a folder listed in allowlist_external_dirs
    - HTTP/HTTPS URL (will be downloaded)
    - Home Assistant media URL (/media/...)
    - Media source ID (media-source://...), including text-to-speech

    Returns the filename and file index on the device, so automations can
    play it next (file_index is None if the file list couldn't be
    refreshed).

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    # Resolve adapter and entry_id (raises HomeAssistantError on failure)
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)

    file_path = call.data["file_path"]

    # Validate the target filename before resolving the source, so a bad
    # name fails fast instead of after a download. async_upload_audio checks
    # it again, so other callers can't bypass the check.
    target_filename = normalize_target_filename(call.data["target_filename"])

    temp_files: list[Path] = []
    try:
        try:
            local_file = await async_resolve_audio_source(hass, file_path, temp_files)
        except Exception as exc:
            raise transfer_failed(hass, entry_id, exc) from exc

        filename = await async_upload_audio(
            hass, adapter, entry_id, local_file, target_filename
        )
    finally:
        remove_temp_files(temp_files)

    return (
        _uploaded_file_response(hass, entry_id, filename)
        if call.return_response
        else None
    )


async def async_send_file_from_tts_service(
    hass: HomeAssistant, call: ServiceCall
) -> ServiceResponse:
    """Speak a message with a TTS entity and upload it to the device.

    Without target_filename, the filename is built from the message. Returns
    the filename and file index on the device, so automations can play it
    next (file_index is None if the file list couldn't be refreshed).

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)

    filename = await async_upload_tts(
        hass,
        adapter,
        entry_id,
        call.data["tts_entity"],
        call.data["message"],
        target_filename=call.data.get("target_filename") or None,
        language=call.data.get("language") or None,
        options=call.data.get("tts_options") or None,
    )
    return (
        _uploaded_file_response(hass, entry_id, filename)
        if call.return_response
        else None
    )


async def async_edit_file_service(hass: HomeAssistant, call: ServiceCall) -> None:
    """Change a file's movement, eye and light settings on the device.

    The file is given by filename, or by file_index and cluster (as for
    delete_file). Settings left out keep their current values, and only
    values that differ from the file's current ones are sent.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)

    try:
        await async_edit_file(hass, adapter, entry_id, dict(call.data))
    except HomeAssistantError:
        raise
    except ConnectionLostError:
        raise HomeAssistantError(
            "Lost connection to device while editing the file"
        ) from None
    except Exception as exc:
        _LOGGER.exception("Failed to edit file")
        raise HomeAssistantError(f"Failed to edit file: {exc}") from exc


async def async_set_file_order_service(
    hass: HomeAssistant, call: ServiceCall
) -> ServiceResponse:
    """Enable the given files for playback, in the given order.

    The files are given by `filenames` or by `file_indices`. Files left out
    are disabled. Optionally returns the play order the device reports
    afterwards.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)

    try:
        file_order = await async_set_file_order(
            hass, adapter, entry_id, dict(call.data)
        )
    except HomeAssistantError:
        raise
    except ConnectionLostError:
        raise HomeAssistantError(
            "Lost connection to device while setting the file order"
        ) from None
    except Exception as exc:
        _LOGGER.exception("Failed to set file order")
        raise HomeAssistantError(f"Failed to set file order: {exc}") from exc

    if not call.return_response:
        return None
    return {"file_order": file_order}


async def async_delete_file_service(hass: HomeAssistant, call: ServiceCall) -> None:
    """Delete a file from the device.

    The file is given by filename, or by file_index and cluster.

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.

    Like edit_file, it reads the file list first (so it fails while the
    device plays a file or if the list can't be read, rather than reporting
    "not found"), then deletes the file, waits for the device to confirm,
    and reads the list again.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)

    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    if not coordinator:
        raise HomeAssistantError(f"No coordinator found for entry {entry_id}")

    filename = call.data.get("filename")
    file_index = call.data.get("file_index")
    cluster = call.data.get("cluster")
    check_file_selector(filename, file_index, cluster)

    try:
        # Keeps coordinator polling and other writes out while the file is
        # looked up and deleted
        async with coordinator.action_lock:
            file_list = await async_load_file_list_for_change(adapter, coordinator)
            file_info = find_file(file_list, filename, file_index, cluster)
            _LOGGER.info(
                "Deleting file '%s' (index=%d, cluster=%d) for entry %s",
                file_info.name,
                file_info.file_index,
                file_info.cluster,
                entry_id,
            )

            success = await adapter.client.delete_file_with_confirmation(
                file_info.file_index, file_info.cluster, timeout=10.0
            )
            if not success:
                raise HomeAssistantError(
                    "Device reported delete failed for file index "
                    f"{file_info.file_index}"
                )
            _LOGGER.info("Deleted file '%s'", file_info.name)

            await coordinator.async_refresh_file_list(lock_held=True)

    except HomeAssistantError:
        raise
    except ConnectionLostError:
        raise HomeAssistantError(
            "Lost connection to device while waiting for delete confirmation"
        ) from None
    except TimeoutError:
        raise HomeAssistantError(
            "Timeout waiting for delete confirmation from device"
        ) from None
    except Exception as exc:
        _LOGGER.exception("Failed to delete file")
        raise HomeAssistantError(f"Failed to delete file: {exc}") from exc


async def async_perform_service(
    hass: HomeAssistant, call: ServiceCall
) -> ServiceResponse:
    """Speak a line on the Skelly with a matching mood (see perform.py).

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.
    """
    adapter, entry_id = get_adapter_from_service_call(hass, call, raise_on_error=True)
    result = await async_perform(hass, adapter, entry_id, dict(call.data))
    return result if call.return_response else None


def _resolve_participant(
    hass: HomeAssistant, spec: dict[str, Any]
) -> tuple[Any, str, str]:
    """Return the adapter, config entry id and device id of a converse participant."""
    try:
        entry_id, device_id = resolve_skelly(
            hass, device_id=spec.get("device_id"), entity_id=spec.get("entity_id")
        )
    except SkellyNotFoundError as err:
        raise ServiceValidationError(f"{spec['name']}: {err}") from err
    if device_id is None:  # the schema requires a device_id or entity_id
        raise ServiceValidationError(f"{spec['name']}: give a device_id or entity_id")
    return hass.data[DOMAIN][entry_id]["adapter"], entry_id, device_id


async def async_converse_service(
    hass: HomeAssistant, call: ServiceCall
) -> ServiceResponse:
    """Let several Skellys hold a conversation (see converse.py)."""
    data = dict(call.data)
    participants = []
    seen: dict[str, str] = {}
    for spec in data["participants"]:
        adapter, entry_id, device_id = _resolve_participant(hass, spec)
        if entry_id in seen:
            raise ServiceValidationError(
                f"{seen[entry_id]} and {spec['name']} are the same Skelly"
            )
        seen[entry_id] = spec["name"]
        participants.append((adapter, entry_id, {**spec, "device_id": device_id}))
    result = await async_converse(hass, participants, data)
    return result if call.return_response else None


# (service name, handler, schema, supports_response) - drives both register_services and
# unregister_services so the two can't drift out of sync with each other.
_SERVICES: tuple[tuple[str, Any, vol.Schema, SupportsResponse], ...] = (
    (
        "enable_classic_bt",
        async_enable_classic_bt_service,
        SERVICE_ENABLE_CLASSIC_BT,
        SupportsResponse.NONE,
    ),
    (
        "play_file",
        async_play_file_service,
        SERVICE_FILE_CONTROL,
        SupportsResponse.NONE,
    ),
    (
        "stop_file",
        async_stop_file_service,
        SERVICE_FILE_CONTROL,
        SupportsResponse.NONE,
    ),
    (
        "cancel_file_transfer",
        async_cancel_file_transfer_service,
        SERVICE_CANCEL_FILE_TRANSFER,
        SupportsResponse.NONE,
    ),
    (
        "send_file",
        async_send_file_service,
        SERVICE_SEND_FILE,
        SupportsResponse.OPTIONAL,
    ),
    (
        "send_file_from_tts",
        async_send_file_from_tts_service,
        SERVICE_SEND_FILE_FROM_TTS,
        SupportsResponse.OPTIONAL,
    ),
    (
        "edit_file",
        async_edit_file_service,
        SERVICE_EDIT_FILE,
        SupportsResponse.NONE,
    ),
    (
        "set_file_order",
        async_set_file_order_service,
        SERVICE_SET_FILE_ORDER,
        SupportsResponse.OPTIONAL,
    ),
    (
        "delete_file",
        async_delete_file_service,
        SERVICE_DELETE_FILE,
        SupportsResponse.NONE,
    ),
    (
        "perform",
        async_perform_service,
        SERVICE_PERFORM,
        SupportsResponse.OPTIONAL
    ),
    (
        "converse",
        async_converse_service,
        SERVICE_CONVERSE,
        SupportsResponse.OPTIONAL,
    ),
)


def register_services(hass: HomeAssistant) -> None:
    """Register all Skelly Ultra services."""
    for name, handler, schema, supports_response in _SERVICES:
        hass.services.async_register(
            DOMAIN,
            name,
            functools.partial(handler, hass),
            schema=schema,
            supports_response=supports_response,
        )


def unregister_services(hass: HomeAssistant) -> None:
    """Unregister all Skelly Ultra services."""
    for name, _handler, _schema, _supports_response in _SERVICES:
        if hass.services.has_service(DOMAIN, name):
            hass.services.async_remove(DOMAIN, name)
