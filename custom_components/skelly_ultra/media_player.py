"""Media Player platform for Skelly Ultra live mode audio playback."""

from __future__ import annotations

import asyncio
import base64
import contextlib
import logging
from pathlib import Path
import tempfile
from typing import Any
from urllib.parse import urlparse

from homeassistant.components import media_source
from homeassistant.components.media_player import (
    BrowseMedia,
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
    async_process_play_media_url,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator
from .skelly_ultra_pkg import parser
from .skelly_ultra_pkg.audio_processor import AudioProcessor, AudioProcessingError

_LOGGER = logging.getLogger(__name__)

# Target audio format for Bluetooth speaker (optional resampling)
TARGET_RESAMPLING = False
TARGET_SAMPLE_RATE = 8000  # 8kHz
TARGET_CHANNELS = 1  # Mono


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Set up Skelly media player for live mode audio playback."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address
    device_name = entry.title or (
        f"Skelly Ultra {address}" if address else "Skelly Ultra"
    )

    async_add_entities(
        [
            SkellyLiveMediaPlayer(
                coordinator, data.get("adapter"), entry.entry_id, address, device_name
            ),
            SkellyInternalFilesPlayer(
                coordinator, data.get("adapter"), entry.entry_id, address, device_name
            ),
        ]
    )


class SkellyLiveMediaPlayer(CoordinatorEntity, MediaPlayerEntity):
    """Media player for playing audio to Skelly's classic BT speaker in live mode."""

    _attr_has_entity_name = True
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.VOLUME_SET
        | MediaPlayerEntityFeature.VOLUME_STEP
    )

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        adapter,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the media player entity."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry_id = entry_id
        self._attr_name = "Live Mode Speaker"
        self._attr_unique_id = f"{entry_id}_live_mode_speaker"
        self._attr_media_content_type = MediaType.MUSIC

        # Store playback state
        self._is_playing = False
        self._current_media_title: str | None = None
        self._background_tasks: set[asyncio.Task] = set()

        # Device grouping
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def available(self) -> bool:
        """Entity is only available when live mode is connected.

        Directly checks the client's connection status for immediate updates,
        rather than waiting for coordinator refresh.
        """
        return self.adapter.client.live_mode_client_address is not None

    @property
    def state(self) -> MediaPlayerState:
        """Return the state of the media player."""
        if not self.available:
            return MediaPlayerState.OFF

        # Check if we're currently playing
        if self._is_playing:
            return MediaPlayerState.PLAYING

        return MediaPlayerState.IDLE

    @property
    def media_title(self) -> str | None:
        """Return the title of current playing media."""
        return self._current_media_title

    @property
    def entity_picture(self) -> str | None:
        """Return entity picture URL.

        Returns the same entity_picture as the eye icon image entity, which shares
        the same coordinator data. This ensures both entities show the same image.
        """
        # Look up the actual entity_id of the image entity from the registry
        # Image entity unique_id: {entry_id}_eye_icon_image
        image_unique_id = f"{self._entry_id}_eye_icon_image"

        # Get entity registry to find the actual entity_id
        registry = er.async_get(self.hass)
        image_entity_id = registry.async_get_entity_id("image", DOMAIN, image_unique_id)

        if not image_entity_id:
            # Image entity not found in registry
            return None

        # Get the state of the image entity to access its entity_picture
        image_state = self.hass.states.get(image_entity_id)
        if not image_state:
            # Image entity has no state yet
            return None

        # Return the same entity_picture that the image entity uses
        # This includes the proper access token
        return image_state.attributes.get("entity_picture")

    @property
    def volume_level(self) -> float | None:
        """Return the volume level (0.0 to 1.0).

        Returns:
            float | None: Volume level as a fraction (0.0-1.0), or None if unknown.
        """
        data = getattr(self.coordinator, "data", None)
        if data and (vol := data.get("volume")) is not None:
            try:
                # Convert from 0-100 percentage to 0.0-1.0 fraction
                return int(vol) / 100.0
            except (ValueError, TypeError):
                return None
        return None

    async def async_set_volume_level(self, volume: float) -> None:
        """Set volume level (0.0 to 1.0).

        Args:
            volume: Volume level as a fraction (0.0-1.0)
        """
        # Convert from 0.0-1.0 fraction to 0-100 percentage
        volume_percent = int(volume * 100)

        try:
            await self.coordinator.adapter.client.set_volume(volume_percent)
        except (OSError, RuntimeError, ValueError):
            # Setting failed; do not change state
            return

        # Update coordinator cache for immediate UI update
        new_data = dict(self.coordinator.data or {})
        new_data["volume"] = volume_percent
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)

        self.async_write_ha_state()

        # Request refresh to get authoritative state
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_volume_up(self) -> None:
        """Turn volume up by 5%."""
        current = self.volume_level
        if current is None:
            return
        new_volume = min(1.0, current + 0.05)
        await self.async_set_volume_level(new_volume)

    async def async_volume_down(self) -> None:
        """Turn volume down by 5%."""
        current = self.volume_level
        if current is None:
            return
        new_volume = max(0.0, current - 0.05)
        await self.async_set_volume_level(new_volume)

    async def async_play_media(
        self, media_type: str, media_id: str, **kwargs: Any
    ) -> None:
        """Play a media file to the classic BT device via REST server.

        Supports multiple audio formats including WAV, MP3, FLAC, OGG, and more.

        Args:
            media_type: Type of media (should be 'music' or similar)
            media_id: Path to local audio file, URL, or media source URI
            **kwargs: Additional arguments
        """
        if not self.available:
            _LOGGER.warning("Cannot play media: live mode is not connected")
            return

        # Stop any existing playback
        await self.async_media_stop()

        # Resolve media source URIs (e.g., from TTS services)
        if media_source.is_media_source_id(media_id):
            _LOGGER.debug("Resolving media source URI: %s", media_id)
            play_item = await media_source.async_resolve_media(
                self.hass, media_id, self.entity_id
            )
            media_id = async_process_play_media_url(self.hass, play_item.url)
            _LOGGER.info("Resolved media source to URL: %s", media_id)

        # Determine if media_id is a URL or local file path
        parsed = urlparse(media_id)
        is_url = parsed.scheme in ("http", "https")

        temp_file = None
        try:
            if is_url:
                # Download the file from URL
                _LOGGER.info("Downloading audio from URL: %s", media_id)
                session = async_get_clientsession(self.hass)

                async with session.get(media_id) as response:
                    if response.status != 200:
                        _LOGGER.error(
                            "Failed to download audio from %s: HTTP %d",
                            media_id,
                            response.status,
                        )
                        return

                    # Save to temporary file
                    audio_content = await response.read()
                    # Create temp file with suffix from URL
                    suffix = Path(parsed.path).suffix or ".mp3"
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                    await self.hass.async_add_executor_job(
                        temp_file.write, audio_content
                    )
                    await self.hass.async_add_executor_job(temp_file.close)
                    media_path = Path(temp_file.name)
                    _LOGGER.debug(
                        "Downloaded %d bytes to temporary file: %s",
                        len(audio_content),
                        media_path,
                    )
            else:
                # Local file path
                media_path = Path(media_id)
                if not media_path.is_file():
                    _LOGGER.error("Media file does not exist: %s", media_id)
                    return

            # Extract filename for display
            if is_url:
                # For URLs, use the last part of the path or a generic name
                self._current_media_title = Path(parsed.path).name or "Audio"
            else:
                self._current_media_title = media_path.name

            _LOGGER.info(
                "Processing audio file: %s (format: %s)",
                self._current_media_title,
                media_path.suffix.upper(),
            )

            # Process audio using AudioProcessor (supports WAV, MP3, FLAC, OGG, etc.)
            # Optionally resample to target format if TARGET_RESAMPLING is enabled
            if TARGET_RESAMPLING:
                _LOGGER.debug(
                    "Processing audio with resampling to %dHz mono",
                    TARGET_SAMPLE_RATE,
                )
                file_data = await self.hass.async_add_executor_job(
                    AudioProcessor.process_to_wav_bytes,
                    media_path,
                    TARGET_SAMPLE_RATE,
                    TARGET_CHANNELS,
                )
            else:
                _LOGGER.debug("Processing audio without resampling")
                file_data = await self.hass.async_add_executor_job(
                    AudioProcessor.process_to_wav_bytes,
                    media_path,
                    None,  # No sample rate conversion
                    None,  # No channel conversion
                )

            # Use the client to upload and play audio via REST server
            # The client will handle the MAC address and target formatting
            data = await self.adapter.client.play_audio_live_mode(
                file_data, filename=self._current_media_title
            )

            if not data.get("success"):
                _LOGGER.error(
                    "REST server failed to start playback: %s",
                    data.get("error", "Unknown error"),
                )
                self._current_media_title = None
                self.async_write_ha_state()
                return

            _LOGGER.info("REST server started playback successfully")
            self._is_playing = True
            self.async_write_ha_state()

            # Start background task to monitor playback status
            task = asyncio.create_task(self._monitor_playback_status())
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

        except AudioProcessingError as err:
            _LOGGER.error("Failed to process audio file: %s", err)
            self._current_media_title = None
            self._is_playing = False
            self.async_write_ha_state()
        except (OSError, RuntimeError):
            _LOGGER.exception("Failed to read or process audio file")
            self._current_media_title = None
            self._is_playing = False
            self.async_write_ha_state()
        finally:
            # Clean up temporary file if it was created
            if temp_file is not None:
                try:
                    await self.hass.async_add_executor_job(Path(temp_file.name).unlink)
                    _LOGGER.debug("Cleaned up temporary file: %s", temp_file.name)
                except (OSError, FileNotFoundError) as cleanup_err:
                    _LOGGER.debug(
                        "Failed to clean up temporary file %s: %s",
                        temp_file.name,
                        cleanup_err,
                    )

    async def _monitor_playback_status(self) -> None:
        """Monitor playback status via REST server and update state when done."""
        try:
            # Poll the REST server status endpoint to detect when playback finishes
            while self._is_playing:
                await asyncio.sleep(1)

                try:
                    # Use the client to check status
                    data = await self.adapter.client.get_audio_status_live_mode()
                    audio_status = data.get("audio", {})

                    # If server reports no playback, we're done
                    if not audio_status.get("is_playing", False):
                        _LOGGER.debug("Playback completed (detected via REST server)")
                        break

                except (OSError, RuntimeError, ValueError, KeyError):
                    _LOGGER.debug("Failed to check playback status, assuming complete")
                    break

        except (OSError, RuntimeError, asyncio.CancelledError):
            _LOGGER.exception("Error monitoring playback status")
        finally:
            # Clear playback state
            self._is_playing = False
            self._current_media_title = None
            self.async_write_ha_state()

    async def async_media_stop(self) -> None:
        """Stop any currently playing media via REST server."""
        if not self._is_playing:
            return

        _LOGGER.info("Requesting REST server to stop playback")

        try:
            # Use the client to stop playback
            data = await self.adapter.client.stop_audio_live_mode()

            if data.get("success"):
                _LOGGER.debug("REST server stopped playback successfully")
            else:
                _LOGGER.warning(
                    "REST server reported stop failure: %s", data.get("error")
                )

        except Exception:
            _LOGGER.exception("Failed to stop media playback via REST server")
        finally:
            self._is_playing = False
            self._current_media_title = None
            self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Clean up when entity is removed."""
        await self.async_media_stop()
        # Unregister live mode callback
        self.adapter.unregister_live_mode_callback(self._handle_live_mode_change)
        await super().async_will_remove_from_hass()

    async def async_added_to_hass(self) -> None:
        """When entity is added to hass."""
        await super().async_added_to_hass()
        # Register for live mode connection state changes
        self.adapter.register_live_mode_callback(self._handle_live_mode_change)

    def _handle_live_mode_change(self) -> None:
        """Handle live mode connection state change."""
        # Update entity state immediately when live mode connects/disconnects
        self.async_write_ha_state()


class SkellyInternalFilesPlayer(CoordinatorEntity, MediaPlayerEntity):
    """Media player for playing files stored on the device's internal storage."""

    _attr_has_entity_name = True
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.SELECT_SOURCE
        | MediaPlayerEntityFeature.VOLUME_SET
        | MediaPlayerEntityFeature.VOLUME_STEP
        | MediaPlayerEntityFeature.BROWSE_MEDIA
    )

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        adapter,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the internal files media player entity."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry_id = entry_id
        self._attr_name = "Internal Files"
        self._attr_unique_id = f"{entry_id}_internal_files"
        self._attr_media_content_type = MediaType.MUSIC

        # Playlist state
        self._current_file_index: int | None = None
        self._is_playing = False
        self._monitor_task: asyncio.Task | None = None

        # Device grouping
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    async def async_added_to_hass(self) -> None:
        """When entity is added to hass, load the file list and start event monitoring."""
        await super().async_added_to_hass()
        # Load file list on startup via coordinator
        await self.coordinator.async_refresh_file_list()
        # Start monitoring PlaybackEvent notifications from device
        self._monitor_task = asyncio.create_task(self._monitor_play_pause_events())

    async def async_will_remove_from_hass(self) -> None:
        """Clean up when entity is removed."""
        if self._monitor_task:
            self._monitor_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._monitor_task
        await super().async_will_remove_from_hass()

    async def _monitor_play_pause_events(self) -> None:
        """Monitor the client's event queue for PlaybackEvent notifications.

        This background task watches for device-initiated play/pause state changes
        and updates the media player state accordingly.
        """
        _LOGGER.debug("Started monitoring PlaybackEvent notifications")

        try:
            while True:
                # Check the event queue for PlaybackEvent
                # We check without blocking to avoid interfering with other queue consumers
                events_to_requeue = []

                try:
                    # Try to get an event without blocking
                    while not self.adapter.client.events.empty():
                        try:
                            event = self.adapter.client.events.get_nowait()

                            if isinstance(event, parser.PlaybackEvent):
                                _LOGGER.debug(
                                    "Received PlaybackEvent: file_index=%d, playing=%s, duration=%d",
                                    event.file_index,
                                    event.playing,
                                    event.duration,
                                )

                                # Update our state to match the device
                                self._current_file_index = event.file_index
                                self._is_playing = event.playing

                                # Update Home Assistant immediately
                                self.async_write_ha_state()
                            else:
                                # Not a PlaybackEvent, re-queue it for other consumers
                                events_to_requeue.append(event)

                        except asyncio.QueueEmpty:
                            break

                    # Re-queue non-PlaybackEvent events
                    for event in events_to_requeue:
                        try:
                            self.adapter.client.events.put_nowait(event)
                        except asyncio.QueueFull:
                            _LOGGER.warning(
                                "Event queue full, dropping event: %s", event
                            )

                except Exception:
                    _LOGGER.exception("Error processing event queue")

                # Sleep briefly before checking again
                await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            _LOGGER.debug("PlaybackEvent monitoring task cancelled")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in PlaybackEvent monitoring")

    @property
    def state(self) -> MediaPlayerState:
        """Return the state of the media player."""
        if self._is_playing:
            return MediaPlayerState.PLAYING
        return MediaPlayerState.IDLE

    @property
    def entity_picture(self) -> str | None:
        """Return entity picture URL for the current file's eye icon.

        Returns a URL to an image entity that displays the current file's eye icon.
        Since the eye icon changes per file, we construct a URL that points to a
        dynamically-served image based on the file's eye_icon value.

        Note: The eye_icon value is also available in the entity's attributes as
        'file_eye_icon' for use in automations and templates.
        """
        if self._current_file_index is None:
            return None

        # Find the current file's eye_icon value
        current_eye_icon = None
        for file_info in self.coordinator.file_list:
            if file_info.file_index == self._current_file_index:
                current_eye_icon = file_info.eye_icon
                break

        if current_eye_icon is None or not isinstance(current_eye_icon, int):
            return None

        # Validate eye_icon is in valid range (1..18)
        if current_eye_icon < 1 or current_eye_icon > 18:
            return None

        # Serve the image as a base64 data URI
        # This allows the icon to be displayed without requiring www folder access
        images_path = Path(__file__).parent / "images"
        img_path = images_path / f"eye_icon_{current_eye_icon}.png"

        if not img_path.is_file():
            _LOGGER.debug("Eye icon image not found: %s", img_path)
            return None

        try:
            img_data = img_path.read_bytes()
            img_base64 = base64.b64encode(img_data).decode("utf-8")
        except (OSError, UnicodeDecodeError):
            _LOGGER.exception("Failed to encode eye icon image: %s", img_path)
            return None
        else:
            return f"data:image/png;base64,{img_base64}"

    @property
    def media_title(self) -> str | None:
        """Return the title of current playing media."""
        if self._current_file_index is None:
            return None
        # Find the file with this index
        for file_info in self.coordinator.file_list:
            if file_info.file_index == self._current_file_index:
                return file_info.name or f"File {self._current_file_index}"
        return f"File {self._current_file_index}"

    @property
    def media_content_id(self) -> str | None:
        """Return the content ID of current playing media."""
        if self._current_file_index is None:
            return None
        return str(self._current_file_index)

    @property
    def source(self) -> str | None:
        """Return the current input source (current file name)."""
        return self.media_title

    @property
    def source_list(self) -> list[str]:
        """Return the list of available input sources (file names)."""
        return [
            file_info.name or f"File {file_info.file_index}"
            for file_info in self.coordinator.file_list
        ]

    @property
    def volume_level(self) -> float | None:
        """Return the volume level (0.0 to 1.0) from coordinator data."""
        data = getattr(self.coordinator, "data", None)
        if data and (vol := data.get("volume")) is not None:
            try:
                return int(vol) / 100.0
            except (ValueError, TypeError):
                return None
        return None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return entity specific state attributes.

        Includes file metadata for use in automations.
        """
        attrs = {}

        if self._current_file_index is not None:
            # Find current file metadata
            for file_info in self.coordinator.file_list:
                if file_info.file_index == self._current_file_index:
                    attrs["file_index"] = file_info.file_index
                    attrs["file_name"] = file_info.name
                    attrs["file_length"] = file_info.length
                    attrs["file_action"] = file_info.action
                    attrs["file_eye_icon"] = file_info.eye_icon
                    attrs["file_cluster"] = file_info.cluster
                    break

        # Include playlist information
        attrs["total_files"] = len(self.coordinator.file_list)
        attrs["file_order"] = self.coordinator.data.get("file_order", [])

        return attrs

    async def async_set_volume_level(self, volume: float) -> None:
        """Set volume level (0.0 to 1.0)."""
        volume_percent = int(volume * 100)

        try:
            await self.coordinator.adapter.client.set_volume(volume_percent)
        except (OSError, RuntimeError, ValueError):
            return

        # Update coordinator cache
        new_data = dict(self.coordinator.data or {})
        new_data["volume"] = volume_percent
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)

        self.async_write_ha_state()

        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_volume_up(self) -> None:
        """Turn volume up by 5%."""
        current = self.volume_level
        if current is None:
            return
        new_volume = min(1.0, current + 0.05)
        await self.async_set_volume_level(new_volume)

    async def async_volume_down(self) -> None:
        """Turn volume down by 5%."""
        current = self.volume_level
        if current is None:
            return
        new_volume = max(0.0, current - 0.05)
        await self.async_set_volume_level(new_volume)

    async def async_media_play(self) -> None:
        """Play the current file or first file if none selected."""
        if self._current_file_index is None and self.coordinator.file_list:
            # No file selected, play first file
            self._current_file_index = self.coordinator.file_list[0].file_index

        if self._current_file_index is not None:
            try:
                await self.adapter.client.play_file(self._current_file_index)
                self._is_playing = True
                self.async_write_ha_state()
            except Exception:
                _LOGGER.exception("Failed to play file %d", self._current_file_index)

    async def async_media_stop(self) -> None:
        """Stop the currently playing file."""
        if self._current_file_index is not None:
            try:
                await self.adapter.client.stop_file(self._current_file_index)
            except Exception:
                _LOGGER.exception("Failed to stop file %d", self._current_file_index)
        self._is_playing = False
        self.async_write_ha_state()

    async def async_media_next_track(self) -> None:
        """Play the next file in the list."""
        if not self.coordinator.file_list:
            return

        # Find current index in list
        current_idx = 0
        if self._current_file_index is not None:
            for i, file_info in enumerate(self.coordinator.file_list):
                if file_info.file_index == self._current_file_index:
                    current_idx = i
                    break

        # Move to next file (wrap around)
        next_idx = (current_idx + 1) % len(self.coordinator.file_list)
        self._current_file_index = self.coordinator.file_list[next_idx].file_index

        if self._is_playing:
            await self.async_media_play()
        else:
            self.async_write_ha_state()

    async def async_media_previous_track(self) -> None:
        """Play the previous file in the list."""
        if not self.coordinator.file_list:
            return

        # Find current index in list
        current_idx = 0
        if self._current_file_index is not None:
            for i, file_info in enumerate(self.coordinator.file_list):
                if file_info.file_index == self._current_file_index:
                    current_idx = i
                    break

        # Move to previous file (wrap around)
        prev_idx = (current_idx - 1) % len(self.coordinator.file_list)
        self._current_file_index = self.coordinator.file_list[prev_idx].file_index

        if self._is_playing:
            await self.async_media_play()
        else:
            self.async_write_ha_state()

    async def async_select_source(self, source: str) -> None:
        """Select a file to play by name."""
        # Find file by name
        for file_info in self.coordinator.file_list:
            file_name = file_info.name or f"File {file_info.file_index}"
            if file_name == source:
                self._current_file_index = file_info.file_index
                self.async_write_ha_state()
                return

        _LOGGER.warning("File not found: %s", source)

    async def async_browse_media(
        self, media_content_type: str | None = None, media_content_id: str | None = None
    ) -> Any:
        """Return a browsable media library structure.

        This allows the media browser to show the list of files.
        """
        # Refresh file list when browsing
        await self.coordinator.async_refresh_file_list()

        # Build media library structure
        children = []
        for file_info in self.coordinator.file_list:
            file_name = file_info.name or f"File {file_info.file_index}"
            children.append(
                {
                    "title": file_name,
                    "media_content_type": MediaType.MUSIC,
                    "media_content_id": str(file_info.file_index),
                    "can_play": True,
                    "can_expand": False,
                }
            )

        return BrowseMedia(
            title="Internal Files",
            media_class="directory",
            media_content_type="library",
            media_content_id="library",
            can_play=False,
            can_expand=True,
            children=[
                BrowseMedia(
                    title=child["title"],
                    media_class="music",
                    media_content_type=child["media_content_type"],
                    media_content_id=child["media_content_id"],
                    can_play=child["can_play"],
                    can_expand=child["can_expand"],
                )
                for child in children
            ],
        )

    async def async_play_media(
        self, media_type: str, media_id: str, **kwargs: Any
    ) -> None:
        """Play a file by its index."""
        try:
            file_index = int(media_id)
            self._current_file_index = file_index
            await self.async_media_play()
        except ValueError:
            _LOGGER.error("Invalid file index: %s", media_id)
