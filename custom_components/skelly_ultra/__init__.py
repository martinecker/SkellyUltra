"""Home Assistant integration for Skelly Ultra (minimal scaffold).

This file creates a client adapter and coordinator and forwards setup to platforms.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceInfo

from .client_adapter import SkellyClientAdapter
from .coordinator import SkellyCoordinator
from .skelly_ultra_pkg.audio_processor import AudioProcessor
from .skelly_ultra_pkg.file_transfer import (
    FileTransferCancelled,
    FileTransferError,
    FileTransferManager,
)

from .const import CONF_SERVER_URL, CONF_USE_BLE_PROXY, DEFAULT_SERVER_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a Skelly Ultra config entry.

    Create the client adapter and coordinator, start notifications and
    forward setup to platforms.
    """
    # Ensure "connected" option exists and defaults to True
    if "connected" not in entry.options:
        hass.config_entries.async_update_entry(
            entry, options={**entry.options, "connected": True}
        )

    address = entry.data.get("address")
    server_url = entry.data.get(CONF_SERVER_URL, DEFAULT_SERVER_URL)
    use_ble_proxy = entry.data.get(CONF_USE_BLE_PROXY, False)
    adapter = SkellyClientAdapter(
        hass, address=address, server_url=server_url, use_ble_proxy=use_ble_proxy
    )
    coordinator = SkellyCoordinator(hass, adapter)

    # Check if Connected switch is on (defaults to True)
    is_connected = entry.options.get("connected", True)

    # Start connection and initialization in background to avoid blocking setup
    # This allows the integration to load even if the device is not available
    async def _initialize_device() -> None:
        """Initialize device connection, notifications, and perform initial data fetch."""
        if not is_connected:
            # Switch is off - pause coordinator immediately
            coordinator.pause_updates()
            _LOGGER.info(
                "Connected switch is off - skipping connection and pausing updates"
            )
            return

        # Attempt to connect to the device
        try:
            ok = await adapter.connect()
            if not ok:
                _LOGGER.warning(
                    "Failed to connect to Skelly device during initialization, "
                    "coordinator will retry on next update cycle"
                )
                return
        except Exception:
            _LOGGER.exception(
                "Exception while connecting to Skelly device during initialization, "
                "coordinator will retry on next update cycle"
            )
            return

        # Perform immediate initial coordinator refresh after successful connection
        try:
            await coordinator.async_refresh()
        except Exception:
            _LOGGER.exception("Initial data refresh failed, will retry on next update")

    # Start initialization in background - don't block setup
    hass.async_create_task(_initialize_device())

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "adapter": adapter,
        "coordinator": coordinator,
    }

    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)

    # forward async_setup_entry calls to other platforms to create entities
    await hass.config_entries.async_forward_entry_setups(
        entry,
        ["sensor", "select", "light", "number", "image", "switch", "media_player"],
    )

    def _get_adapter_from_service_call(
        call, *, raise_on_error: bool = False
    ) -> tuple[SkellyClientAdapter, str] | None:
        """Extract adapter from service call data.

        Resolves device_id or entity_id from the service call and returns
        the corresponding adapter and entry_id. If neither is provided and
        there is exactly one integration entry, that entry is used.

        Args:
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

            msg = (
                "No device_id or entity_id provided and multiple Skelly entries present"
            )
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

    # Register services for enabling classic Bluetooth. The service accepts
    # either a device_id (device registry id) or an entity_id. If entity_id
    # is provided, the device_id is derived from the entity registry.
    SERVICE_ENABLE_CLASSIC_BT = vol.Schema(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
        }
    )

    async def _enable_classic_bt_service(call) -> None:
        """Enable classic Bluetooth speaker mode for a specific device.

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        result = _get_adapter_from_service_call(call)
        if not result:
            return

        adapter, entry_id = result
        try:
            await adapter.client.enable_classic_bt()
            _LOGGER.info("Requested classic Bluetooth enable for entry %s", entry_id)
        except Exception:
            _LOGGER.exception("Failed to enable classic Bluetooth")

    hass.services.async_register(
        DOMAIN,
        "enable_classic_bt",
        _enable_classic_bt_service,
        schema=SERVICE_ENABLE_CLASSIC_BT,
    )

    # Register play_file and stop_file services. Both accept device_id,
    # entity_id, and file_index (1-based).
    SERVICE_FILE_CONTROL = vol.Schema(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Required("file_index"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        }
    )

    async def _play_file_service(call) -> None:
        """Play a file on the device by file index.

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        result = _get_adapter_from_service_call(call)
        if not result:
            return

        adapter, entry_id = result
        file_index = call.data["file_index"]

        try:
            await adapter.client.play_file(file_index)
            _LOGGER.info("Requested play file %s for entry %s", file_index, entry_id)
        except Exception:
            _LOGGER.exception("Failed to play file %s", file_index)

    async def _stop_file_service(call) -> None:
        """Stop a file on the device by file index.

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        result = _get_adapter_from_service_call(call)
        if not result:
            return

        adapter, entry_id = result
        file_index = call.data["file_index"]

        try:
            await adapter.client.stop_file(file_index)
            _LOGGER.info("Requested stop file %s for entry %s", file_index, entry_id)
        except Exception:
            _LOGGER.exception("Failed to stop file %s", file_index)

    hass.services.async_register(
        DOMAIN,
        "play_file",
        _play_file_service,
        schema=SERVICE_FILE_CONTROL,
    )

    hass.services.async_register(
        DOMAIN,
        "stop_file",
        _stop_file_service,
        schema=SERVICE_FILE_CONTROL,
    )

    # Register cancel_file_transfer service
    SERVICE_CANCEL_FILE_TRANSFER = vol.Schema(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
        }
    )

    async def _cancel_file_transfer_service(call) -> None:
        """Cancel an ongoing file transfer.

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        result = _get_adapter_from_service_call(call, raise_on_error=True)
        adapter, entry_id = result

        # Check if there's an active transfer for this entry
        if "file_transfers" not in hass.data[DOMAIN]:
            raise HomeAssistantError("No file transfers in progress")

        transfer_manager = hass.data[DOMAIN]["file_transfers"].get(entry_id)
        if not transfer_manager:
            raise HomeAssistantError(
                f"No file transfer in progress for this device (entry {entry_id})"
            )

        if not transfer_manager.state.in_progress:
            raise HomeAssistantError("No file transfer currently in progress")

        _LOGGER.info("Cancelling file transfer for entry %s", entry_id)
        await transfer_manager.cancel(adapter.client)
        _LOGGER.info("File transfer cancellation requested for entry %s", entry_id)

    hass.services.async_register(
        DOMAIN,
        "cancel_file_transfer",
        _cancel_file_transfer_service,
        schema=SERVICE_CANCEL_FILE_TRANSFER,
    )

    # Register send_file service for uploading audio files to device
    SERVICE_SEND_FILE = vol.Schema(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
            vol.Required("file_path"): cv.string,
            vol.Required("target_filename"): cv.string,
        }
    )

    async def _send_file_service(call) -> None:
        """Send audio file to device.

        Downloads/processes the file and uploads it to the device.
        The file_path can be:
        - Local file path
        - HTTP/HTTPS URL (will be downloaded)
        - Home Assistant media URL (/media/...)

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        # Resolve adapter and entry_id (raises HomeAssistantError on failure)
        adapter, entry_id = _get_adapter_from_service_call(call, raise_on_error=True)

        file_path = call.data["file_path"]
        target_filename = call.data["target_filename"]

        # Get the transfer progress sensor for this entry
        transfer_sensor = None
        if entry_id in hass.data[DOMAIN]:
            transfer_sensor = hass.data[DOMAIN][entry_id].get("transfer_sensor")

        # Create file transfer manager
        transfer_manager = FileTransferManager()

        # Store in hass.data for potential cancellation
        if "file_transfers" not in hass.data[DOMAIN]:
            hass.data[DOMAIN]["file_transfers"] = {}
        hass.data[DOMAIN]["file_transfers"][entry_id] = transfer_manager

        temp_files = []

        # Define progress callback for sensor updates
        def progress_callback(sent_chunks: int, total_chunks: int) -> None:
            """Update progress sensor."""
            if transfer_sensor:
                transfer_sensor.update_progress(sent_chunks, total_chunks)

        try:
            # Step 1: Download/get file
            _LOGGER.info("Processing file for upload: %s", file_path)

            if file_path.startswith(("http://", "https://")):
                # Download from URL
                _LOGGER.debug("Downloading file from URL: %s", file_path)
                session = async_get_clientsession(hass)

                temp_fd, temp_path = tempfile.mkstemp()
                os.close(temp_fd)
                temp_files.append(temp_path)

                async with session.get(file_path) as resp:
                    if resp.status != 200:
                        raise HomeAssistantError(
                            f"Failed to download file: HTTP {resp.status}"
                        )
                    # Use executor for file write to avoid blocking
                    data = await resp.read()
                    await hass.async_add_executor_job(Path(temp_path).write_bytes, data)

                local_file = temp_path
            elif file_path.startswith("/media/"):
                # HA media file - convert to filesystem path
                media_path = Path(hass.config.path("media"))
                relative_path = file_path[7:]  # Remove '/media/'
                local_file = str(media_path / relative_path)

                if not Path(local_file).exists():
                    raise HomeAssistantError(f"Media file not found: {file_path}")
            else:
                # Assume local filesystem path
                if not Path(file_path).exists():
                    raise HomeAssistantError(f"File not found: {file_path}")
                local_file = file_path

            # Step 2: Process audio to required format (8kHz mono MP3)
            # Run audio processing in executor to avoid blocking event loop
            _LOGGER.debug("Processing audio file: %s", local_file)
            processed_file = await hass.async_add_executor_job(
                AudioProcessor.process_file, local_file
            )
            if str(processed_file) != local_file:
                temp_files.append(str(processed_file))

            # Step 3: Read file data using executor to avoid blocking
            file_data = await hass.async_add_executor_job(
                Path(processed_file).read_bytes
            )

            # Get coordinator for lock
            coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
            if not coordinator:
                raise HomeAssistantError(f"No coordinator found for entry {entry_id}")

            # Acquire lock to prevent concurrent coordinator updates during file transfer
            _LOGGER.debug("Acquiring lock for file transfer")
            async with coordinator.action_lock:
                # Step 4: Upload to device
                _LOGGER.info(
                    "Uploading file to entry %s as %s",
                    entry_id,
                    target_filename,
                )

                # Check if chunk size override is enabled
                override_chunk_size = None
                if coordinator.data:
                    override_enabled = coordinator.data.get(
                        "override_chunk_size", False
                    )
                    if override_enabled:
                        override_chunk_size = coordinator.data.get(
                            "chunk_size_override"
                        )
                        _LOGGER.debug(
                            "Using chunk size override: %d bytes", override_chunk_size
                        )

                await transfer_manager.send_file(
                    adapter.client,
                    file_data,
                    target_filename,
                    progress_callback,
                    override_chunk_size,
                )

                _LOGGER.info(
                    "Successfully sent file %s to entry %s",
                    target_filename,
                    entry_id,
                )

                # Update sensor to show completion
                if transfer_sensor:
                    transfer_sensor.set_complete()

                # Refresh the file list via coordinator
                _LOGGER.debug("Refreshing file list after successful upload")
                await coordinator.async_refresh_file_list()

        except FileTransferCancelled:
            _LOGGER.warning("File transfer was cancelled: %s", target_filename)
            if transfer_sensor:
                transfer_sensor.set_cancelled()
            raise HomeAssistantError("File transfer was cancelled") from None
        except FileTransferError as exc:
            _LOGGER.error("File transfer failed: %s", exc)
            if transfer_sensor:
                transfer_sensor.set_error(str(exc))
            raise HomeAssistantError(f"File transfer failed: {exc}") from exc
        except Exception as exc:
            _LOGGER.exception("Unexpected error during file transfer")
            if transfer_sensor:
                transfer_sensor.set_error(str(exc))
            raise HomeAssistantError(f"File transfer failed: {exc}") from exc
        finally:
            # Cleanup temp files
            for temp_file in temp_files:
                try:
                    Path(temp_file).unlink(missing_ok=True)
                except OSError:
                    _LOGGER.debug("Failed to cleanup temp file: %s", temp_file)

            # Remove from tracking
            if "file_transfers" in hass.data[DOMAIN]:
                hass.data[DOMAIN]["file_transfers"].pop(entry_id, None)

    hass.services.async_register(
        DOMAIN,
        "send_file",
        _send_file_service,
        schema=SERVICE_SEND_FILE,
    )

    # Register delete_file service
    # Note: The schema allows all file identification parameters to be optional,
    # but validation in the service function ensures that either:
    # - filename is provided (alone), OR
    # - both file_index AND cluster are provided together
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

    async def _delete_file_service(call) -> None:
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
        result = _get_adapter_from_service_call(call, raise_on_error=True)
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
                _LOGGER.info(
                    "Refreshing file list before delete for entry %s", entry_id
                )
                await coordinator.async_refresh_file_list()

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
                await coordinator.async_refresh_file_list()

        except TimeoutError:
            raise HomeAssistantError(
                "Timeout waiting for delete confirmation from device"
            ) from None
        except Exception as exc:
            _LOGGER.exception("Failed to delete file")
            raise HomeAssistantError(f"Failed to delete file: {exc}") from exc

    hass.services.async_register(
        DOMAIN,
        "delete_file",
        _delete_file_service,
        schema=SERVICE_DELETE_FILE,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and disconnect the adapter."""
    data = hass.data[DOMAIN].pop(entry.entry_id)
    # Ensure any live-mode classic BT client is disconnected first
    try:
        await data["adapter"].disconnect_live_mode()
    except Exception:
        _LOGGER.debug(
            "Failed to disconnect live-mode BT classic client during unload",
            exc_info=True,
        )

    try:
        await data["adapter"].disconnect()
    except Exception:
        _LOGGER.debug("Failed to disconnect BLE client during unload", exc_info=True)

    # If there are no more entries for this domain, remove the services
    if not hass.data[DOMAIN]:
        # Remove the services if they were registered
        if hass.services.has_service(DOMAIN, "enable_classic_bt"):
            hass.services.async_remove(DOMAIN, "enable_classic_bt")
        if hass.services.has_service(DOMAIN, "play_file"):
            hass.services.async_remove(DOMAIN, "play_file")
        if hass.services.has_service(DOMAIN, "stop_file"):
            hass.services.async_remove(DOMAIN, "stop_file")
        if hass.services.has_service(DOMAIN, "cancel_file_transfer"):
            hass.services.async_remove(DOMAIN, "cancel_file_transfer")
        if hass.services.has_service(DOMAIN, "send_file"):
            hass.services.async_remove(DOMAIN, "send_file")
        if hass.services.has_service(DOMAIN, "delete_file"):
            hass.services.async_remove(DOMAIN, "delete_file")

    return True
