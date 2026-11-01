"""Shared audio upload path for Skelly Ultra file actions.

Uploading a file to the device has two halves:

1. Resolving the caller's input into a local audio file
   (async_resolve_audio_source).
2. Converting that file to the device's format and transferring it, with
   progress reporting and settings restore on overwrite (async_upload_audio).

The send_file action chains the two. Other callers that already have a local
file (for example, generated TTS audio) only need async_upload_audio.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN
from .helpers import get_device_profile
from .skelly_ultra_pkg import parser
from .skelly_ultra_pkg.audio_processor import AudioProcessor
from .skelly_ultra_pkg.constants import MAX_FILENAME_LENGTH
from .skelly_ultra_pkg.file_transfer import (
    FileTransferCancelled,
    FileTransferError,
    FileTransferManager,
)

_LOGGER = logging.getLogger(__name__)

# Delay between the per-file setting writes in _restore_file_settings. These are
# unacknowledged writes the device can drop when sent back-to-back (matches
# APPLY_ALL_COMMAND_DELAY_MS in the web controller).
RESTORE_COMMAND_DELAY = 0.04


def normalize_target_filename(target_filename: str) -> str:
    """Return the filename that will be stored on the device, or raise.

    AudioProcessor always converts the uploaded audio to MP3 (the device
    only plays MP3), so the name is normalized to `<stem>.mp3` regardless of
    what extension, if any, the caller provided. The length check runs on the
    normalized name, since that is what is actually sent to the device.

    Safe to call more than once on the same name.
    """
    target_filename = f"{Path(target_filename).stem}.mp3"

    # The device accepts an upload with a filename longer than this, acking
    # transfer/confirm with failed=0, but then silently never lists the file
    # afterward. Reject up front instead of failing silently.
    if len(target_filename) > MAX_FILENAME_LENGTH:
        raise HomeAssistantError(
            f'Target filename "{target_filename}" is {len(target_filename)} '
            f"characters, which exceeds the device's {MAX_FILENAME_LENGTH}-character "
            "limit. Shorten it and try again."
        )

    return target_filename


def _get_transfer_sensor(hass: HomeAssistant, entry_id: str) -> Any | None:
    """Return the transfer progress sensor for an entry, if it exists."""
    if entry_id in hass.data[DOMAIN]:
        return hass.data[DOMAIN][entry_id].get("transfer_sensor")
    return None


def transfer_failed(
    hass: HomeAssistant, entry_id: str, exc: Exception
) -> HomeAssistantError:
    """Report an unexpected upload failure and return the error to raise.

    Call this from inside an `except` block (it logs the active traceback),
    then `raise transfer_failed(...) from exc`. Shows the error on the
    entry's transfer progress sensor.
    """
    _LOGGER.exception("Unexpected error during file transfer")
    transfer_sensor = _get_transfer_sensor(hass, entry_id)
    if transfer_sensor:
        transfer_sensor.set_error(str(exc))
    return HomeAssistantError(f"File transfer failed: {exc}")


def remove_temp_files(temp_files: list[Path]) -> None:
    """Delete temp files, ignoring any that are already gone."""
    for temp_file in temp_files:
        try:
            temp_file.unlink(missing_ok=True)
        except OSError:
            _LOGGER.debug("Failed to cleanup temp file: %s", temp_file)


async def async_resolve_audio_source(
    hass: HomeAssistant, source: str, temp_files: list[Path]
) -> Path:
    """Resolve an audio source to a local file and return its path.

    The source can be:
    - Local file path
    - HTTP/HTTPS URL (downloaded to a temp file)
    - Home Assistant media URL (/media/...)

    Any temp file created here is appended to `temp_files`. The caller owns
    that list and must pass it to remove_temp_files once the upload is done,
    whether it succeeded or not.
    """
    _LOGGER.info("Processing file for upload: %s", source)

    if source.startswith(("http://", "https://")):
        # Download from URL
        _LOGGER.debug("Downloading file from URL: %s", source)
        session = async_get_clientsession(hass)

        temp_fd, temp_name = tempfile.mkstemp()
        os.close(temp_fd)
        temp_path = Path(temp_name)
        temp_files.append(temp_path)

        async with session.get(source) as resp:
            if resp.status != 200:
                raise HomeAssistantError(f"Failed to download file: HTTP {resp.status}")
            # Use executor for file write to avoid blocking
            data = await resp.read()
            await hass.async_add_executor_job(temp_path.write_bytes, data)

        return temp_path

    if source.startswith("/media/"):
        # HA media file - convert to filesystem path
        media_path = Path(hass.config.path("media"))
        relative_path = source[7:]  # Remove '/media/'
        local_file = media_path / relative_path

        if not local_file.exists():
            raise HomeAssistantError(f"Media file not found: {source}")
        return local_file

    # Assume local filesystem path
    local_file = Path(source)
    if not local_file.exists():
        raise HomeAssistantError(f"File not found: {source}")
    return local_file


async def _restore_file_settings(
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

    Writes are paced by RESTORE_COMMAND_DELAY, since the device can drop
    back-to-back writes.
    """

    async def paced(command) -> None:
        await command
        await asyncio.sleep(RESTORE_COMMAND_DELAY)

    await paced(client.set_movement_action(existing_file.action, cluster, filename))

    if profile.get("has_eye_image"):
        await paced(client.set_eye_icon(existing_file.eye_icon, cluster, filename))

    for light_def in profile.get("lights", []):
        channel = light_def["channel"]
        if channel >= len(existing_file.lights):
            continue
        light = existing_file.lights[channel]

        await paced(
            client.set_light_brightness(channel, light.brightness, cluster, filename)
        )
        await paced(
            client.set_light_mode(channel, light.effect_type, cluster, filename)
        )
        if light.effect_type != 1:
            await paced(
                client.set_light_speed(channel, light.effect_speed, cluster, filename)
            )
        r, g, b = light.rgb
        await paced(
            client.set_light_rgb(channel, r, g, b, light.color_cycle, cluster, filename)
        )


async def async_upload_audio(
    hass: HomeAssistant,
    adapter: Any,
    entry_id: str,
    local_file: Path,
    target_filename: str,
) -> str:
    """Convert a local audio file and upload it to the device.

    Normalizes and validates `target_filename`, converts `local_file` to the
    device's 8 kHz mono MP3 format (honoring the bitrate override), and
    transfers it while updating the transfer progress sensor. If a file with
    the same name already exists on the device, its movement/eye/light
    settings are restored after the overwrite. Refreshes the file list on
    success.

    `local_file` itself is never deleted; temp files created during
    conversion are. Returns the filename stored on the device.
    """
    target_filename = normalize_target_filename(target_filename)

    # Get the transfer progress sensor for this entry
    transfer_sensor = _get_transfer_sensor(hass, entry_id)

    # Create file transfer manager
    transfer_manager = FileTransferManager()

    # Store in hass.data for potential cancellation
    if "file_transfers" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["file_transfers"] = {}
    hass.data[DOMAIN]["file_transfers"][entry_id] = transfer_manager

    temp_files: list[Path] = []

    # Define progress callback for sensor updates
    def progress_callback(sent_chunks: int, total_chunks: int) -> None:
        """Update progress sensor."""
        if transfer_sensor:
            transfer_sensor.update_progress(sent_chunks, total_chunks)

    try:
        # Get coordinator early to check for bitrate override
        coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
        if not coordinator:
            raise HomeAssistantError(f"No coordinator found for entry {entry_id}")

        # If this upload overwrites an existing file, the device resets that
        # file's movement/eye/light settings to default. Capture them now so
        # they can be restored right after the new upload lands.
        existing_file = next(
            (f for f in coordinator.file_list if f.name == target_filename), None
        )
        config_entry = hass.config_entries.async_get_entry(entry_id)
        profile = get_device_profile(config_entry) if config_entry else None

        # Check if bitrate override is enabled
        bitrate = None
        if coordinator.data:
            override_enabled = coordinator.data.get("override_bitrate", False)
            if override_enabled:
                bitrate = coordinator.data.get("bitrate_override")
                _LOGGER.debug("Using bitrate override: %s", bitrate)

        # Process audio to required format (8kHz mono MP3)
        # Run audio processing in executor to avoid blocking event loop
        _LOGGER.debug("Processing audio file: %s", local_file)
        processed_file = await hass.async_add_executor_job(
            AudioProcessor.process_file, local_file, None, bitrate
        )
        if Path(processed_file) != Path(local_file):
            temp_files.append(Path(processed_file))

        # Read file data using executor to avoid blocking
        file_data = await hass.async_add_executor_job(Path(processed_file).read_bytes)

        # Acquire lock to prevent concurrent coordinator updates during file transfer
        _LOGGER.debug("Acquiring lock for file transfer")
        async with coordinator.action_lock:
            # Upload to device
            _LOGGER.info(
                "Uploading file to entry %s as %s",
                entry_id,
                target_filename,
            )

            # Check if chunk size override is enabled
            override_chunk_size = None
            if coordinator.data:
                override_enabled = coordinator.data.get("override_chunk_size", False)
                if override_enabled:
                    override_chunk_size = coordinator.data.get("chunk_size_override")
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

            # If this was an overwrite, restore the previous movement/eye/light
            # settings right away, using the pre-upload cluster - the device
            # resets them to default on upload, and delaying this (e.g. until
            # after a file-list refresh) risks the writes getting dropped.
            if existing_file and profile:
                try:
                    await _restore_file_settings(
                        adapter.client,
                        profile,
                        existing_file.cluster,
                        target_filename,
                        existing_file,
                    )
                    _LOGGER.info(
                        "Restored previous settings for overwritten file %s",
                        target_filename,
                    )
                except Exception:
                    _LOGGER.exception(
                        "Failed to restore settings after overwriting %s",
                        target_filename,
                    )

            _LOGGER.info(
                "Successfully sent file %s to entry %s",
                target_filename,
                entry_id,
            )

            # Update sensor to show completion
            if transfer_sensor:
                transfer_sensor.set_complete()

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
        raise transfer_failed(hass, entry_id, exc) from exc
    finally:
        remove_temp_files(temp_files)

        # Remove from tracking
        if "file_transfers" in hass.data[DOMAIN]:
            hass.data[DOMAIN]["file_transfers"].pop(entry_id, None)

    # Refresh the file list via coordinator
    _LOGGER.debug("Refreshing file list after successful upload")
    await coordinator.async_refresh_file_list()

    return target_filename
