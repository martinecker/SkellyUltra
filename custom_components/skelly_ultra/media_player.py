"""Media Player platform for Skelly Ultra live mode audio playback."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator

_LOGGER = logging.getLogger(__name__)


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
        """Entity is only available when live mode is connected."""
        # Check if the live mode is enabled
        is_connected = self.adapter.client.live_mode_client_address is not None

        # Also check coordinator is available
        return is_connected and bool(
            getattr(self.coordinator, "last_update_success", False)
        )

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

    async def async_play_media(
        self, media_type: str, media_id: str, **kwargs: Any
    ) -> None:
        """Play a media file to the classic BT device via REST server.

        Args:
            media_type: Type of media (should be 'music' or similar)
            media_id: Path to the local .wav file to play
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

        _LOGGER.info("Reading and uploading media file %s", media_id)

        try:
            # Read the audio file into memory
            file_data = await self.hass.async_add_executor_job(media_path.read_bytes)

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

        except Exception:
            _LOGGER.exception("Failed to start media playback via REST server")
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

                except Exception:
                    _LOGGER.debug("Failed to check playback status, assuming complete")
                    break

        except Exception:
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
        await super().async_will_remove_from_hass()
