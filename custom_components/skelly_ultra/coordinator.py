"""Coordinator that polls the Skelly device and updates Home Assistant entities.

This module provides a DataUpdateCoordinator implementation that periodically
fetches state from the Skelly BLE device via the provided adapter.
"""

from __future__ import annotations

from datetime import timedelta
import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client_adapter import SkellyClientAdapter

_LOGGER = logging.getLogger(__name__)


class SkellyCoordinator(DataUpdateCoordinator):
    """Coordinator for the Skelly animatronic BLE device.

    Parameters
    ----------
    hass: HomeAssistant
        Home Assistant instance
    adapter: SkellyClientAdapter
        Adapter used to communicate with the Skelly device
    """

    def __init__(self, hass: HomeAssistant, adapter: SkellyClientAdapter) -> None:
        """Initialize the coordinator and set polling interval."""
        super().__init__(
            hass,
            _LOGGER,
            name="skelly_ultra",
            update_interval=timedelta(seconds=30),
        )
        self.adapter = adapter
        _LOGGER.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    async def _async_update_data(self) -> Any:
        _LOGGER.debug("Coordinator polling Skelly device for updates")
        try:
            # Query volume and live name concurrently with a combined timeout
            # to avoid per-call cancellation interfering when notifications
            # arrive slightly late.
            timeout_seconds = 5.0
            async with asyncio.timeout(timeout_seconds):
                vol_task = asyncio.create_task(
                    self.adapter.client.get_volume(timeout=timeout_seconds)
                )
                live_task = asyncio.create_task(
                    self.adapter.client.get_live_name(timeout=timeout_seconds)
                )
                vol, live = await asyncio.gather(vol_task, live_task)
            data = {"volume": vol, "live_name": live}
            _LOGGER.debug("Coordinator fetched data: %s", data)
        except Exception:
            _LOGGER.exception("Coordinator update failed")
            raise UpdateFailed("Failed to update Skelly data") from None
        else:
            return data
