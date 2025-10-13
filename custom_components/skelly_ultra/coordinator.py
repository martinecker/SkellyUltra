"""Coordinator that polls the Skelly device and updates Home Assistant entities."""
from __future__ import annotations

from typing import Any
import asyncio
import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client_adapter import SkellyClientAdapter

_LOGGER = logging.getLogger(__name__)


class SkellyCoordinator(DataUpdateCoordinator):
    def __init__(self, hass: HomeAssistant, adapter: SkellyClientAdapter) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name="skelly_ultra",
            update_interval=30,
        )
        self.adapter = adapter
        _LOGGER.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    async def _async_update_data(self) -> Any:
        _LOGGER.debug("Coordinator polling Skelly device for updates")
        try:
            vol = await self.adapter.get_volume()
            live = await self.adapter.client.get_live_name()
            data = {"volume": vol, "live_name": live}
            _LOGGER.debug("Coordinator fetched data: %s", data)
            return data
        except Exception as exc:
            _LOGGER.exception("Coordinator update failed: %s", exc)
            raise UpdateFailed(exc)
