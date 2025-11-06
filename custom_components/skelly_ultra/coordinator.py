"""Coordinator that polls the Skelly device and updates Home Assistant entities.

This module provides a DataUpdateCoordinator implementation that periodically
fetches state from the Skelly BLE device via the provided adapter.
"""

from __future__ import annotations

import asyncio
import logging
import time
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
        self.action_lock = asyncio.Lock()
        self._last_refresh_request = 0.0
        self._updates_paused = False
        self._file_list: list[Any] = []
        _LOGGER.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    def pause_updates(self) -> None:
        """Pause coordinator polling.

        Sets a flag that causes _async_update_data to skip updates.
        The coordinator timer continues running but updates are skipped.
        """
        _LOGGER.info("Pausing coordinator updates")
        self._updates_paused = True

    def resume_updates(self) -> None:
        """Resume coordinator polling.

        Clears the pause flag to allow updates to proceed normally.
        """
        _LOGGER.info("Resuming coordinator updates")
        self._updates_paused = False

    async def async_refresh_file_list(self) -> None:
        """Refresh the list of files from the device.

        This method fetches the current file list from the device and stores
        it in the coordinator. It can be called by both entities and services
        that need the latest file list information.
        """
        try:
            self._file_list = await self.adapter.client.get_file_list(timeout=10.0)
            _LOGGER.debug("Loaded %d files from device", len(self._file_list))
        except TimeoutError:
            _LOGGER.warning("Timeout loading file list from device")
            self._file_list = []
        except Exception:
            _LOGGER.exception("Failed to load file list from device")
            self._file_list = []

    @property
    def file_list(self) -> list[Any]:
        """Return the current file list.

        Returns:
            list[Any]: List of file information objects from the device
        """
        return self._file_list

    async def async_request_refresh(self) -> None:
        """Request a refresh with debouncing and delay.

        Waits 2 seconds before actually refreshing to allow multiple rapid
        changes to be sent to the device, then polls the final state.
        """
        now = time.monotonic()
        time_since_last = now - self._last_refresh_request

        # Debounce: ignore requests within 3 seconds of last request
        if time_since_last < 3.0:
            _LOGGER.debug(
                "Ignoring refresh request - last request was %.3fs ago (debounce: 3.0s)",
                time_since_last,
            )
            return

        self._last_refresh_request = now
        _LOGGER.debug("Delaying coordinator refresh by 2s to allow changes to settle")

        # Wait 2 seconds to give the device time to process the change
        # and allow any rapid consecutive changes to complete
        await asyncio.sleep(2.0)

        _LOGGER.debug("Requesting coordinator refresh after delay")
        await super().async_request_refresh()

    async def _async_update_data(self) -> Any:
        # Skip updates if paused (e.g., when Connected switch is off)
        if self._updates_paused:
            _LOGGER.debug("Coordinator updates paused - skipping poll")
            # Return last known data or empty dict to avoid raising UpdateFailed
            return self.data if self.data else {}

        _LOGGER.debug("Coordinator polling Skelly device for updates")

        try:
            # Query device state with overall timeout.
            # Clear event queue first to ensure we only get fresh responses.
            self.adapter.client.drain_event_queue()

            # Send queries first, then wait for all responses to avoid race
            # conditions where responses arrive before tasks start waiting.
            timeout_seconds = 5.0
            try:
                async with asyncio.timeout(timeout_seconds):
                    # Send all queries first to trigger device responses
                    await self.adapter.client.query_volume()
                    await self.adapter.client.query_live_name()
                    await self.adapter.client.query_capacity()
                    await self.adapter.client.query_live_mode()
                    await self.adapter.client.query_file_order()
                    await self.adapter.client.query_device_params()

                    # Now wait for all responses concurrently
                    vol_task = asyncio.create_task(
                        self.adapter.client.get_volume(timeout=timeout_seconds)
                    )
                    live_name_task = asyncio.create_task(
                        self.adapter.client.get_live_name(timeout=timeout_seconds)
                    )
                    cap_task = asyncio.create_task(
                        self.adapter.client.get_capacity(timeout=timeout_seconds)
                    )
                    live_mode_task = asyncio.create_task(
                        self.adapter.client.get_live_mode(timeout=timeout_seconds)
                    )
                    file_order_task = asyncio.create_task(
                        self.adapter.client.get_file_order(timeout=timeout_seconds)
                    )
                    device_params_task = asyncio.create_task(
                        self.adapter.client.get_device_params(timeout=timeout_seconds)
                    )
                    (
                        vol,
                        live_name,
                        cap,
                        live_mode,
                        file_order,
                        device_params,
                    ) = await asyncio.gather(
                        vol_task,
                        live_name_task,
                        cap_task,
                        live_mode_task,
                        file_order_task,
                        device_params_task,
                    )
            except TimeoutError as ex:
                _LOGGER.warning(
                    "Coordinator update timed out after %s seconds", timeout_seconds
                )
                raise UpdateFailed(
                    f"Device polling timed out after {timeout_seconds}s"
                ) from ex

            # Extract eye, action, and light info from the parsed live_mode event
            eye = getattr(live_mode, "eye_icon", None)
            action = getattr(live_mode, "action", None)
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

            # Extract capacity_kb and file_count from CapacityEvent
            capacity_kb = getattr(cap, "capacity_kb", None) if cap else None
            file_count = getattr(cap, "file_count", None) if cap else None

            # Extract pin_code from DeviceParamsEvent
            pin_code = (
                getattr(device_params, "pin_code", None) if device_params else None
            )

            data = {
                "volume": vol,
                "live_name": live_name,
                "capacity_kb": capacity_kb,
                "file_count": file_count,
                # eye is expected to be an int (1-based) or None
                "eye_icon": eye,
                # action is a bitfield where bit 0 = head, bit 1 = arm, bit 2 = torso
                "action": action,
                # file_order is a list of integers representing playback order
                "file_order": file_order,
                # pin_code is the Bluetooth pairing PIN (e.g., "1234")
                "pin_code": pin_code,
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
