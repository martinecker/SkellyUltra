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

    async def _async_update_data(self) -> Any:
        try:
            vol = await self.adapter.get_volume()
            live = await self.adapter.client.get_live_name()
            return {"volume": vol, "live_name": live}
        except Exception as exc:
            raise UpdateFailed(exc)
