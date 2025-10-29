"""Coordinator that polls the Skelly device and updates Home Assistant entities.

This module provides a DataUpdateCoordinator implementation that periodically
fetches state from the Skelly BLE device via the provided adapter.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
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
                live_name_task = asyncio.create_task(
                    self.adapter.client.get_live_name(timeout=timeout_seconds)
                )
                # capacity may return a dict or tuple with capacity and file_count
                cap_task = asyncio.create_task(
                    self.adapter.client.get_capacity(timeout=timeout_seconds)
                )
                # Request the live mode once — it contains both the eye icon
                # and per-channel light info in a single parsed event. This
                # avoids multiple concurrent query_live_mode calls that can
                # consume the same notification and confuse the event
                # matching logic.
                live_mode_task = asyncio.create_task(
                    self.adapter.client.get_live_mode(timeout=timeout_seconds)
                )
                vol, live_name, cap, live_mode = await asyncio.gather(
                    vol_task, live_name_task, cap_task, live_mode_task
                )
                # Extract eye and light info from the parsed live_mode event
                eye = getattr(live_mode, "eye_icon", None)
                # live_mode.lights is a list of LightInfo objects
                light0 = None
                light1 = None
                try:
                    lights_list = getattr(live_mode, "lights", []) or []
                    if len(lights_list) > 0:
                        light0 = lights_list[0]
                    if len(lights_list) > 1:
                        light1 = lights_list[1]
                except Exception:
                    light0 = None
                    light1 = None

            # Check REST server status if we think live mode is connected
            expected_mac = self.adapter.client.live_mode_client_address
            if expected_mac:
                _LOGGER.debug(
                    "Coordinator checking REST server for live mode device: %s",
                    expected_mac,
                )
                try:
                    # Query REST server to verify connection is still active
                    rest_status = await self.adapter.client.get_audio_status_live_mode()

                    # Check if the REST server reports any connected devices
                    bluetooth_info = rest_status.get("bluetooth", {})
                    connected_devices = bluetooth_info.get("devices", [])

                    _LOGGER.debug(
                        "REST server reports %d connected devices: %s",
                        len(connected_devices),
                        connected_devices,
                    )

                    # Look for our expected MAC address in the connected devices
                    # Use case-insensitive comparison since MAC addresses can vary in case
                    expected_mac_lower = expected_mac.lower()
                    mac_still_connected = any(
                        device.get("mac", "").lower() == expected_mac_lower
                        for device in connected_devices
                    )

                    if not mac_still_connected:
                        _LOGGER.warning(
                            "Live mode device %s is no longer connected to REST server, cleaning up",
                            expected_mac,
                        )
                        # Disconnect on our side to sync state
                        await self.adapter.disconnect_live_mode()
                    else:
                        _LOGGER.debug(
                            "Live mode device %s is still connected to REST server",
                            expected_mac,
                        )

                except Exception as ex:
                    # REST server may be down or unreachable
                    _LOGGER.warning(
                        "Failed to check REST server status for live mode device %s: %s. Assuming disconnected",
                        expected_mac,
                        ex,
                    )
                    # Clean up our state since we can't verify the connection
                    await self.adapter.disconnect_live_mode()

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
                "live_name": live_name,
                "capacity_kb": capacity_kb,
                "file_count": file_count,
                # eye is expected to be an int (1-based) or None
                "eye_icon": eye,
                # lights is a list of small dicts with brightness, rgb, mode, effect, and speed
                "lights": [
                    {
                        "brightness": int(getattr(light0, "brightness", 0))
                        if light0 is not None
                        else None,
                        "rgb": tuple(getattr(light0, "rgb", (0, 0, 0)))
                        if light0 is not None
                        else None,
                        "mode": int(getattr(light0, "mode", 1))
                        if light0 is not None
                        else None,
                        "effect": int(getattr(light0, "effect", 0))
                        if light0 is not None
                        else None,
                        "speed": int(getattr(light0, "speed", 0))
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
                        "mode": int(getattr(light1, "mode", 1))
                        if light1 is not None
                        else None,
                        "effect": int(getattr(light1, "effect", 0))
                        if light1 is not None
                        else None,
                        "speed": int(getattr(light1, "speed", 0))
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
