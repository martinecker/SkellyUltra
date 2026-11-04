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
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import (
    config_validation as cv,
    device_registry as dr,
    entity_registry as er,
)

from .const import DOMAIN
from .file_order import async_set_file_order
from .file_settings import async_edit_file
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
) -> tuple[any, str] | None:
    """Extract adapter from service call data.

    Resolves device_id or entity_id from the service call and returns
    the corresponding adapter and entry_id. If neither is provided and
    there is exactly one integration entry, that entry is used.

    Args:
        hass: Home Assistant instance
        call: Service call with device_id or entity_id in data
        raise_on_error: If True, raises HomeAssistantError on failures
                      If False, logs errors and returns None

    Returns:
        Tuple of (adapter, entry_id) or None if resolution fails

    Raises:
        HomeAssistantError: If raise_on_error=True and resolution fails
    """
    device_id = call.data.get("device_id")
    entity_id = call.data.get("entity_id")

    # If entity_id provided, resolve to device_id
    if not device_id and entity_id:
        ent_reg = er.async_get(hass)
        ent = ent_reg.async_get(entity_id)
        if not ent:
            msg = f"Entity {entity_id} not found"
            if raise_on_error:
                raise HomeAssistantError(msg)
            _LOGGER.error(msg)
            return None
        if not ent.device_id:
            msg = f"Entity {entity_id} has no device_id"
            if raise_on_error:
                raise HomeAssistantError(msg)
            _LOGGER.error(msg)
            return None
        device_id = ent.device_id

    # If no device specified, attempt to use single entry if available
    entry_id: str | None = None
    if not device_id:
        entries = hass.data.get(DOMAIN, {})
        if len(entries) == 1:
            entry_id = next(iter(entries))
            adapter = entries[entry_id]["adapter"]
            return (adapter, entry_id)

        msg = "No device_id or entity_id provided and multiple Skelly entries present"
        if raise_on_error:
            raise HomeAssistantError(msg)
        _LOGGER.error(msg)
        return None

    # Lookup device in device registry and find a config entry that matches
    dev_reg = dr.async_get(hass)
    device = dev_reg.async_get(device_id)
    if not device:
        msg = f"Device {device_id} not found"
        if raise_on_error:
            raise HomeAssistantError(msg)
        _LOGGER.error(msg)
        return None

    # Find a config entry id for this integration within the device
    for ce in device.config_entries:
        if ce in hass.data.get(DOMAIN, {}):
            entry_id = ce
            break

    if not entry_id:
        msg = f"Device {device_id} is not associated with {DOMAIN} integration"
        if raise_on_error:
            raise HomeAssistantError(msg)
        _LOGGER.error(msg)
        return None

    adapter = hass.data[DOMAIN][entry_id]["adapter"]
    return (adapter, entry_id)


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

    try:
        await adapter.client.play_file(file_index)
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
    - Local file path
    - HTTP/HTTPS URL (will be downloaded)
    - Home Assistant media URL (/media/...)

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

    The service can specify the file in two ways:
    1. Directly by file_index and cluster (both required if using this method)
    2. By filename (will look up file_index and cluster from the file list)

    The service accepts either `device_id` or `entity_id`. If neither is
    provided and there is exactly one configured entry for this
    integration, that entry will be used.

    The service performs the following steps:
    1. Refresh the file list to ensure accurate information
    2. Validate the file exists (if using filename, look up index/cluster)
    3. Send delete command
    4. Wait for DeleteFileEvent confirmation
    5. Refresh file list again to reflect the change
    """
    result = get_adapter_from_service_call(hass, call, raise_on_error=True)
    adapter, entry_id = result

    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    if not coordinator:
        raise HomeAssistantError(f"No coordinator found for entry {entry_id}")

    # Determine which parameters were provided
    file_index = call.data.get("file_index")
    cluster = call.data.get("cluster")
    filename = call.data.get("filename")

    # Validate that we have either (file_index AND cluster) OR filename
    if filename:
        if file_index is not None or cluster is not None:
            raise HomeAssistantError(
                "Cannot specify both filename and file_index/cluster"
            )
    else:
        if file_index is None or cluster is None:
            raise HomeAssistantError(
                "Must provide either filename OR both file_index and cluster"
            )

    try:
        # Acquire lock to prevent concurrent coordinator updates during file deletion
        _LOGGER.debug("Acquiring lock for file deletion")
        async with coordinator.action_lock:
            # Step 1: Refresh file list to ensure accurate info
            _LOGGER.info("Refreshing file list before delete for entry %s", entry_id)
            await coordinator.async_refresh_file_list(lock_held=True)

            # Step 2: If filename provided, look up file_index and cluster
            if filename:
                file_list = coordinator.file_list
                matching_file = None

                for file_info in file_list:
                    if file_info.name == filename:
                        matching_file = file_info
                        break

                if not matching_file:
                    raise HomeAssistantError(
                        f"File '{filename}' not found in device file list"
                    )

                file_index = matching_file.file_index
                cluster = matching_file.cluster
                _LOGGER.info(
                    "Resolved filename '%s' to file_index=%d, cluster=%d",
                    filename,
                    file_index,
                    cluster,
                )
            else:
                # Validate that the file_index and cluster exist in the file list
                # and get the filename for logging
                file_list = coordinator.file_list
                matching_file = None

                for file_info in file_list:
                    if (
                        file_info.file_index == file_index
                        and file_info.cluster == cluster
                    ):
                        matching_file = file_info
                        break

                if not matching_file:
                    raise HomeAssistantError(
                        f"File with index {file_index} and cluster {cluster} not found in device file list"
                    )

                # Get filename for logging
                filename = matching_file.name
                _LOGGER.info(
                    "Resolved file_index=%d, cluster=%d to filename '%s'",
                    file_index,
                    cluster,
                    filename,
                )

            # Step 3: Send delete command and wait for confirmation
            _LOGGER.info(
                "Deleting file '%s' (index=%d, cluster=%d) for entry %s",
                filename,
                file_index,
                cluster,
                entry_id,
            )

            success = await adapter.client.delete_file_with_confirmation(
                file_index, cluster, timeout=10.0
            )

            if not success:
                raise HomeAssistantError(
                    f"Device reported delete failed for file index {file_index}"
                )

            _LOGGER.info(
                "Successfully deleted file '%s' (index=%d, cluster=%d)",
                filename,
                file_index,
                cluster,
            )

            # Step 4: Refresh file list to reflect the deletion
            _LOGGER.info("Refreshing file list after successful delete")
            await coordinator.async_refresh_file_list(lock_held=True)

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
