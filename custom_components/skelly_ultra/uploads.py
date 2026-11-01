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

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import aiohttp

from homeassistant.components import media_source, tts
from homeassistant.components.media_player.browse_media import (
    async_process_play_media_url,
)
from homeassistant.components.media_source.const import (
    URI_SCHEME as MEDIA_SOURCE_URI_SCHEME,
    URI_SCHEME_REGEX as MEDIA_SOURCE_URI_SCHEME_REGEX,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import raise_if_invalid_path, slugify

from .const import DOMAIN
from .file_settings import async_restore_file_settings
from .helpers import get_device_profile
from .skelly_ultra_pkg.audio_processor import AudioProcessor
from .skelly_ultra_pkg.constants import MAX_FILENAME_LENGTH
from .skelly_ultra_pkg.file_transfer import (
    FileTransferCancelled,
    FileTransferError,
    FileTransferManager,
)

_LOGGER = logging.getLogger(__name__)

# hass.data key for the active FileTransferManager of each entry, so that
# cancel_file_transfer can find it. Kept out of hass.data[DOMAIN], which must
# only hold per-entry dicts (the single-device fallback in
# get_adapter_from_service_call counts its keys).
FILE_TRANSFERS_KEY = f"{DOMAIN}_file_transfers"

# Filename stem used when a TTS message has nothing to build a name from
DEFAULT_TTS_FILENAME_STEM = "tts"


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
    hass: HomeAssistant,
    entry_id: str,
    exc: Exception,
    own_transfer: FileTransferManager | None = None,
) -> HomeAssistantError:
    """Report an unexpected upload failure and return the error to raise.

    Call this from inside an `except` block (it logs the active traceback),
    then `raise transfer_failed(...) from exc`. Shows the error on the
    entry's transfer progress sensor, unless another upload is transferring
    (one other than `own_transfer`, the failing upload's own manager), so
    a failure before the transfer doesn't overwrite that upload's progress.
    """
    _LOGGER.exception("Unexpected error during file transfer")
    transfer_sensor = _get_transfer_sensor(hass, entry_id)
    active = hass.data.get(FILE_TRANSFERS_KEY, {}).get(entry_id)
    if transfer_sensor and (active is None or active is own_transfer):
        transfer_sensor.set_error(str(exc))
    return HomeAssistantError(f"File transfer failed: {exc}")


def remove_temp_files(temp_files: list[Path]) -> None:
    """Delete temp files, ignoring any that are already gone."""
    for temp_file in temp_files:
        try:
            temp_file.unlink(missing_ok=True)
        except OSError:
            _LOGGER.debug("Failed to cleanup temp file: %s", temp_file)


async def _async_download_to_temp_file(
    hass: HomeAssistant, url: str, temp_files: list[Path]
) -> Path:
    """Download a URL to a new temp file and return its path."""
    session = async_get_clientsession(hass)

    temp_fd, temp_name = tempfile.mkstemp()
    os.close(temp_fd)
    temp_path = Path(temp_name)
    temp_files.append(temp_path)

    try:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise HomeAssistantError(f"Failed to download file: HTTP {resp.status}")
            data = await resp.read()
    except (aiohttp.ClientError, TimeoutError) as err:
        raise HomeAssistantError(
            f"Failed to download file: {type(err).__name__} {err}".rstrip()
        ) from err

    # Use executor for file write to avoid blocking
    await hass.async_add_executor_job(temp_path.write_bytes, data)

    return temp_path


async def _async_tts_media_to_temp_file(
    hass: HomeAssistant, media_id: str, temp_files: list[Path], engine: str
) -> Path:
    """Generate the audio for a TTS media source ID into a new temp file.

    The audio is fetched straight from the TTS manager, not over HTTP, so
    this works without a configured HA URL.
    """
    try:
        extension, data = await tts.async_get_media_source_audio(hass, media_id)
    except Exception as err:
        raise HomeAssistantError(f"Text-to-speech with {engine} failed: {err}") from err

    def write() -> Path:
        temp_fd, temp_name = tempfile.mkstemp(
            prefix="skelly_tts_", suffix=f".{extension}"
        )
        temp_path = Path(temp_name)
        temp_files.append(temp_path)
        with os.fdopen(temp_fd, "wb") as file:
            file.write(data)
        return temp_path

    return await hass.async_add_executor_job(write)


async def _async_resolve_media_source_id(
    hass: HomeAssistant, source: str, temp_files: list[Path]
) -> Path:
    """Resolve a media-source:// ID to a local file.

    Local media (including files uploaded through the HA media browser)
    resolves to a filesystem path, which is used directly. Text-to-speech
    IDs are generated into a temp file. Any other media source resolves to
    a URL, which is signed and downloaded to a temp file.
    """
    match = MEDIA_SOURCE_URI_SCHEME_REGEX.match(source)
    if match and match["domain"] == "tts":
        engine = (match["identifier"] or "").partition("?")[0] or "text-to-speech"
        return await _async_tts_media_to_temp_file(hass, source, temp_files, engine)

    try:
        media = await media_source.async_resolve_media(hass, source, None)
    except media_source.MediaSourceError as err:
        raise HomeAssistantError(f"Could not resolve {source}: {err}") from err
    except AssertionError as err:
        # local_source asserts that it can guess a MIME type from the file
        # extension, so an unknown extension or a folder ends up here.
        raise HomeAssistantError(
            f"Could not resolve {source}: not a file, or unsupported file type"
        ) from err
    except (AttributeError, KeyError, ValueError) as err:
        # Malformed IDs such as "media-source://media_source" fail inside
        # media_source with raw exceptions.
        raise HomeAssistantError(f"Could not resolve {source}") from err

    # Only audio (or video, for its audio track) can be converted. This also
    # keeps out camera streams and other endless or non-audio sources.
    if not media.mime_type.startswith(("audio/", "video/")):
        raise HomeAssistantError(
            f"{source} is not audio (media type {media.mime_type})"
        )

    if media.path is not None:
        local_file = Path(media.path)
        if not await hass.async_add_executor_job(local_file.is_file):
            raise HomeAssistantError(f"Media file not found: {source}")
        return local_file

    # Sign the URL if it points at this HA instance, so it can be fetched
    # without an auth header, and make a relative URL absolute. This is the
    # same processing HA applies before handing media to a media player.
    url = async_process_play_media_url(hass, media.url)

    _LOGGER.debug("Downloading media source %s", source)
    return await _async_download_to_temp_file(hass, url, temp_files)


def _resolve_media_url_path(hass: HomeAssistant, source: str) -> Path:
    """Map a /media/<dir_id>/<path> URL to a filesystem path.

    HA serves local media at /media/<dir_id>/<path>, which corresponds to
    hass.config.media_dirs[dir_id]/<path>.
    """
    dir_id, _, location = source[7:].partition("/")  # Remove '/media/'
    if (base := hass.config.media_dirs.get(dir_id)) is None:
        media_dirs = ", ".join(hass.config.media_dirs) or "none"
        raise HomeAssistantError(
            f'Unknown media directory "{dir_id}" in {source}. Paths starting '
            "with /media/ must be /media/<media_dir>/<path>, for example "
            f"/media/local/sounds/boo.mp3 (configured media dirs: {media_dirs})."
        )

    # Same checks as HA's local media source: no "..", "~" or absolute paths.
    # Symlinks inside the media dir are allowed, as they are in HA.
    try:
        raise_if_invalid_path(location)
    except ValueError as err:
        raise HomeAssistantError(f"Invalid media path: {source}") from err
    if Path(location).is_absolute():
        raise HomeAssistantError(f"Invalid media path: {source}")
    local_file = Path(base, location)

    if not local_file.is_file():
        raise HomeAssistantError(f"Media file not found: {source}")
    return local_file


async def async_resolve_audio_source(
    hass: HomeAssistant, source: str, temp_files: list[Path]
) -> Path:
    """Resolve an audio source to a local file and return its path.

    The source can be:
    - Local file path
    - HTTP/HTTPS URL (downloaded to a temp file)
    - Home Assistant media URL (/media/<dir_id>/...)
    - Media source ID (media-source://...), including text-to-speech IDs

    Any temp file created here is appended to `temp_files`. The caller owns
    that list and must pass it to remove_temp_files once the upload is done,
    whether it succeeded or not.
    """
    _LOGGER.info("Processing file for upload: %s", source)

    if source.startswith(MEDIA_SOURCE_URI_SCHEME):
        return await _async_resolve_media_source_id(hass, source, temp_files)

    if source.startswith(("http://", "https://")):
        # Download from URL
        _LOGGER.debug("Downloading file from URL: %s", source)
        return await _async_download_to_temp_file(hass, source, temp_files)

    if source.startswith("/media/"):
        # HA media file - convert to filesystem path. This touches the
        # filesystem, so run it in the executor.
        return await hass.async_add_executor_job(_resolve_media_url_path, hass, source)

    # Assume local filesystem path
    local_file = Path(source)
    if not local_file.exists():
        raise HomeAssistantError(f"File not found: {source}")
    return local_file


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

    # Create file transfer manager. It is registered for cancellation only
    # once this upload holds the action lock (see below), so a second upload
    # waiting for the lock can't take the place of the one transferring.
    transfer_manager = FileTransferManager()
    transfers: dict[str, FileTransferManager] = hass.data.setdefault(
        FILE_TRANSFERS_KEY, {}
    )

    temp_files: list[Path] = []

    # Define progress callback for sensor updates
    def progress_callback(sent_chunks: int, total_chunks: int) -> None:
        """Update progress sensor."""
        if transfer_sensor:
            transfer_sensor.update_progress(sent_chunks, total_chunks, target_filename)

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
            # Store in hass.data for potential cancellation
            transfers[entry_id] = transfer_manager
            if transfer_sensor:
                transfer_sensor.set_started(target_filename)

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
                    await async_restore_file_settings(
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
        raise transfer_failed(hass, entry_id, exc, transfer_manager) from exc
    finally:
        remove_temp_files(temp_files)

        # Remove from tracking, unless another upload has taken over
        if transfers.get(entry_id) is transfer_manager:
            del transfers[entry_id]

    # Refresh the file list via coordinator
    _LOGGER.debug("Refreshing file list after successful upload")
    await coordinator.async_refresh_file_list()

    return target_filename


def tts_filename_from_message(message: str) -> str:
    """Build a device filename from a TTS message.

    The message is slugified (words joined by "_") and the stem is cut so
    that "<stem>.mp3" fits MAX_FILENAME_LENGTH. Falls back to "tts.mp3" if
    nothing is left.
    """
    max_stem = MAX_FILENAME_LENGTH - len(".mp3")
    slug = slugify(message, separator="_")
    # HA's slugify returns "unknown" when nothing in the text can be
    # transliterated (punctuation only, some scripts)
    if slug == "unknown" and "unknown" not in message.lower():
        slug = ""
    stem = slug[:max_stem].rstrip("_")
    return f"{stem or DEFAULT_TTS_FILENAME_STEM}.mp3"


async def async_upload_tts(
    hass: HomeAssistant,
    adapter: Any,
    entry_id: str,
    tts_entity: str,
    message: str,
    *,
    target_filename: str | None = None,
    language: str | None = None,
    options: dict[str, Any] | None = None,
) -> str:
    """Speak a message with a TTS entity and upload it as a device file.

    The audio is never cached by HA's TTS cache. Returns the filename stored
    on the device.
    """
    if target_filename:
        # Fail before generating any audio if the name is too long
        target_filename = normalize_target_filename(target_filename)
    else:
        target_filename = tts_filename_from_message(message)

    # Raises HomeAssistantError for an unknown engine or invalid language or
    # options, which is clear enough to pass through as is.
    media_id = tts.generate_media_source_id(
        hass,
        message,
        engine=tts_entity,
        language=language,
        options=options,
        cache=False,
    )

    temp_files: list[Path] = []
    try:
        try:
            local_file = await _async_tts_media_to_temp_file(
                hass, media_id, temp_files, tts_entity
            )
        except Exception as exc:
            raise transfer_failed(hass, entry_id, exc) from exc

        return await async_upload_audio(
            hass, adapter, entry_id, local_file, target_filename
        )
    finally:
        remove_temp_files(temp_files)
