"""Media Player platform for Skelly Ultra live mode audio playback."""

from __future__ import annotations

import asyncio
from functools import partial
import io
import logging
from pathlib import Path
from typing import Any

from scipy import signal
import soundfile as sf

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator

_LOGGER = logging.getLogger(__name__)

# Target audio format for Bluetooth speaker
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
            SkellyMediaPlayer(
                coordinator, data.get("adapter"), entry.entry_id, address, device_name
            )
        ]
    )


class SkellyMediaPlayer(CoordinatorEntity, MediaPlayerEntity):
    """Media player for playing audio to Skelly's classic BT speaker in live mode."""

    _attr_has_entity_name = True
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY_MEDIA | MediaPlayerEntityFeature.STOP
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

    async def async_play_media(
        self, media_type: str, media_id: str, **kwargs: Any
    ) -> None:
        """Play a media file to the classic BT device via REST server.

        Supports multiple audio formats including WAV, MP3, FLAC, OGG, and more.
        Audio is automatically resampled to 8kHz mono for optimal BT speaker compatibility.

        Args:
            media_type: Type of media (should be 'music' or similar)
            media_id: Path to the local audio file to play
            **kwargs: Additional arguments
        """
        if not self.available:
            _LOGGER.warning("Cannot play media: live mode is not connected")
            return

        # Stop any existing playback
        await self.async_media_stop()

        # Validate the media file exists
        media_path = Path(media_id)
        if not media_path.is_file():
            _LOGGER.error("Media file does not exist: %s", media_id)
            return

        # Extract filename for display
        self._current_media_title = media_path.name

        _LOGGER.info(
            "Reading and processing audio file: %s (format: %s)",
            media_path.name,
            media_path.suffix.upper(),
        )

        try:
            # Read and process audio file (supports WAV, MP3, FLAC, OGG, etc.)
            audio_data, sample_rate = await self.hass.async_add_executor_job(
                sf.read, str(media_path)
            )

            _LOGGER.debug(
                "Audio file loaded: %dHz, %s, %d samples",
                sample_rate,
                "stereo" if len(audio_data.shape) == 2 else "mono",
                len(audio_data),
            )

            # Check if resampling is needed
            num_channels = audio_data.shape[1] if len(audio_data.shape) == 2 else 1
            needs_resampling = (
                sample_rate != TARGET_SAMPLE_RATE or num_channels != TARGET_CHANNELS
            )

            if needs_resampling:
                _LOGGER.debug(
                    "Resampling audio: %dHz %s -> %dHz mono",
                    sample_rate,
                    "stereo" if num_channels == 2 else "mono",
                    TARGET_SAMPLE_RATE,
                )

                # Convert to mono if stereo
                if num_channels == 2:
                    audio_data = audio_data.mean(axis=1)

                # Resample to target sample rate if needed
                if sample_rate != TARGET_SAMPLE_RATE:
                    num_samples = int(
                        len(audio_data) * TARGET_SAMPLE_RATE / sample_rate
                    )
                    audio_data = await self.hass.async_add_executor_job(
                        signal.resample, audio_data, num_samples
                    )

                _LOGGER.info(
                    "Audio resampled to %dHz mono (%d samples)",
                    TARGET_SAMPLE_RATE,
                    len(audio_data),
                )
            else:
                _LOGGER.debug(
                    "Audio already in target format: %dHz mono", TARGET_SAMPLE_RATE
                )

            # Write the (possibly resampled) audio to a bytes buffer
            file_buffer = io.BytesIO()
            await self.hass.async_add_executor_job(
                partial(
                    sf.write,
                    file=file_buffer,
                    data=audio_data,
                    samplerate=TARGET_SAMPLE_RATE,
                    format="WAV",
                )
            )
            file_data = file_buffer.getvalue()

            # Use the client to upload and play audio via REST server
            # The client will handle the MAC address and target formatting
            data = await self.adapter.client.play_audio_live_mode(
                file_data, filename=media_path.name
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

        except (OSError, RuntimeError):
            _LOGGER.exception("Failed to read or process audio file")
            self._current_media_title = None
            self._is_playing = False
            self.async_write_ha_state()
        except ValueError as err:
            # soundfile raises ValueError for unsupported formats
            _LOGGER.error(
                "Unsupported audio format for file %s: %s. Supported formats: WAV, MP3, FLAC, OGG, and more",
                media_path.name,
                err,
            )
            self._current_media_title = None
            self._is_playing = False
            self.async_write_ha_state()

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
