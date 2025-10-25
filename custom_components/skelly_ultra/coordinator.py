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
                # capacity may return a dict or tuple with capacity and file_count
                cap_task = asyncio.create_task(
                    self.adapter.client.get_capacity(timeout=timeout_seconds)
                )
                # also request current eye icon and light state for channels we
                # expose as entities (torso=head channels 0 and 1)
                eye_task = asyncio.create_task(
                    self.adapter.client.get_eye_icon(timeout=timeout_seconds)
                )
                light0_task = asyncio.create_task(
                    self.adapter.client.get_light_info(0, timeout=timeout_seconds)
                )
                light1_task = asyncio.create_task(
                    self.adapter.client.get_light_info(1, timeout=timeout_seconds)
                )
                vol, live, cap, eye, light0, light1 = await asyncio.gather(
                    vol_task, live_task, cap_task, eye_task, light0_task, light1_task
                )

            # Normalize capacity result. The client may return an object that
            # contains capacity in kilobytes and file count; adapt here to the
            # expected output: capacity_kb and file_count
            capacity_kb = None
            file_count = None
            if cap is None:
                capacity_kb = None
                file_count = None
            elif isinstance(cap, dict):
                capacity_kb = cap.get("capacity_kb") or cap.get("capacity")
                file_count = cap.get("file_count") or cap.get("files")
            elif isinstance(cap, (list, tuple)) and len(cap) >= 2:
                capacity_kb, file_count = cap[0], cap[1]
            else:
                # Fallback: if single numeric returned, treat as capacity
                try:
                    capacity_kb = int(cap)
                except Exception:
                    capacity_kb = None

            data = {
                "volume": vol,
                "live_name": live,
                "capacity_kb": capacity_kb,
                "file_count": file_count,
                # eye is expected to be an int (1-based) or None
                "eye_icon": eye,
                # lights is a list of small dicts with brightness and rgb
                "lights": [
                    {
                        "brightness": int(getattr(light0, "brightness", 0))
                        if light0 is not None
                        else None,
                        "rgb": tuple(getattr(light0, "rgb", (0, 0, 0)))
                        if light0 is not None
                        else None,
                    },
                    {
                        "brightness": int(getattr(light1, "brightness", 0))
                        if light1 is not None
                        else None,
                        "rgb": tuple(getattr(light1, "rgb", (0, 0, 0)))
                        if light1 is not None
                        else None,
                    },
                ],
            }
            _LOGGER.debug("Coordinator fetched data: %s", data)
        except Exception:
            _LOGGER.exception("Coordinator update failed")
            raise UpdateFailed("Failed to update Skelly data") from None
        else:
            return data
