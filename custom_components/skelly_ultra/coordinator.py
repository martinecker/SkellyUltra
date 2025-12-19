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

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client_adapter import SkellyClientAdapter
from .const import DOMAIN
from .helpers import DeviceLoggerAdapter


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

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        adapter: SkellyClientAdapter,
        device_info: DeviceInfo | None,
        device_logger: DeviceLoggerAdapter | None = None,
    ) -> None:
        """Initialize the coordinator and set polling interval."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=30),
        )
        self.adapter = adapter
        self.action_lock = asyncio.Lock()
        self.device_info = device_info
        self._logger = device_logger or DeviceLoggerAdapter(
            _LOGGER, {"device_name": entry.title or "Skelly Ultra"}
        )
        self._is_initializing = True
        self._last_refresh_request = 0.0
        self._updates_paused = False
        self._file_list: list[Any] = []
        self._initial_update_done = False
        self._data_counters: dict[str, int] = {}
        self._was_connected = False
        self._pending_state_push = False
        self._pending_state_push_attempts = 0
        self._logger.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    def async_update_data_optimistic(self, key: str, value: Any) -> None:
        """Update coordinator data optimistically and increment version counter.

        This should be called by entities when they send a command to the device
        and want to update the state immediately without waiting for the next poll.
        """
        self._data_counters[key] = self._data_counters.get(key, 0) + 1

        new_data = dict(self.data or {})
        new_data[key] = value

        self.async_set_updated_data(new_data)

    def notify_done_initializing(self) -> None:
        """Notifies the coordinator that device initialization started in async_setup_entry is done."""
        self._is_initializing = False

    def pause_updates(self) -> None:
        """Pause coordinator polling.

        Sets a flag that causes _async_update_data to skip updates.
        The coordinator timer continues running but updates are skipped.
        """
        self._logger.info("Pausing coordinator updates")
        self._updates_paused = True

    def resume_updates(self) -> None:
        """Resume coordinator polling.

        Clears the pause flag to allow updates to proceed normally.
        """
        self._logger.info("Resuming coordinator updates")
        self._updates_paused = False

    async def async_refresh_file_list(self) -> None:
        """Refresh the list of files from the device.

        This method fetches the current file list from the device and stores
        it in the coordinator. It can be called by both entities and services
        that need the latest file list information.

        Uses action_lock to prevent concurrent execution with coordinator updates.
        """
        # Check if we have a connection before attempting to fetch
        if not self.adapter.client.is_connected:
            self._logger.debug("Skipping file list refresh - device not connected")
            return

        async with self.action_lock:
            self._logger.debug("Acquiring lock for file list refresh")
            try:
                self._file_list = await self.adapter.client.get_file_list(timeout=20.0)
                self._logger.debug("Loaded %d files from device", len(self._file_list))

                # Also fetch file order and capacity to get updated device state
                file_order = await self.adapter.client.get_file_order(timeout=5.0)
                cap = await self.adapter.client.get_capacity(timeout=5.0)

                # Extract capacity info
                capacity_kb = getattr(cap, "capacity_kb", None) if cap else None
                file_count_reported = getattr(cap, "file_count", None) if cap else None

                # Update coordinator data with file list, order, and capacity
                if self.data:
                    updated_data = {
                        **self.data,
                        "file_count_received": len(self._file_list),
                        "file_order": file_order,
                        "capacity_kb": capacity_kb,
                        "file_count_reported": file_count_reported,
                    }
                    self.async_set_updated_data(updated_data)
            except TimeoutError:
                self._logger.warning("Timeout loading file list from device")
                self._file_list = []
                if self.data:
                    self.async_set_updated_data({**self.data, "file_count_received": 0})
            except Exception:
                self._logger.exception("Failed to load file list from device")
                self._file_list = []
                if self.data:
                    self.async_set_updated_data({**self.data, "file_count_received": 0})

    @property
    def file_list(self) -> list[Any]:
        """Return the current file list.

        Returns:
            list[Any]: List of file information objects from the device
        """
        return self._file_list

    async def async_request_refresh(self, force_immediate: bool = False) -> None:
        """Request a refresh with debouncing and delay.

        Waits 2 seconds before actually refreshing to allow multiple rapid
        changes to be sent to the device, then polls the final state.
        """
        now = time.monotonic()
        time_since_last = now - self._last_refresh_request

        # Debounce: ignore requests within 3 seconds of last request
        if time_since_last < 3.0:
            self._logger.debug(
                "Ignoring refresh request - last request was %.3fs ago (debounce: 3.0s)",
                time_since_last,
            )
            return

        self._last_refresh_request = now

        if force_immediate:
            self._logger.debug("Requesting immediate coordinator refresh")
        else:
            self._logger.debug(
                "Delaying coordinator refresh by 2s to allow changes to settle"
            )

            # Wait 2 seconds to give the device time to process the change
            # and allow any rapid consecutive changes to complete
            await asyncio.sleep(2.0)

            self._logger.debug("Requesting coordinator refresh after delay")

        await super().async_request_refresh()

    async def _async_update_data(self) -> Any:
        # Logic to ensure we push state to device on first connection or on reconnect after a disconnect
        if not self._was_connected and self.adapter.client.is_connected:
            self._pending_state_push = True
            self._pending_state_push_attempts = 0

        self._was_connected = self.adapter.client.is_connected

        # Skip updates if paused (e.g., when Connected switch is off)
        if self._updates_paused:
            self._logger.debug("Coordinator updates paused - skipping poll")
            raise UpdateFailed(
                "Device updates paused due to turned off Connected switch"
            )

        if not self.adapter.client.is_connected:
            # Try to reconnect unless the device initialization is still running
            if not self._is_initializing:
                self._logger.debug(
                    "Coordinator update with device not connected after initialization - attempting to re-connect"
                )
                await self.adapter.connect(attempts=1)

            if not self.adapter.client.is_connected:
                self._logger.debug("Skipping coordinator update - device not connected")
                raise UpdateFailed("Device not connected")

        # Use action_lock to prevent concurrent execution with file list refresh
        async with self.action_lock:
            # Capture counters before starting the update to detect optimistic updates
            # that happen while we are querying the device.
            start_counters = self._data_counters.copy()

            self._logger.debug("Coordinator polling Skelly device for updates")

            try:
                # Query device state with staggered delays to avoid overwhelming the device.
                # Each get_*() method sends its query and waits for the response.
                # We stagger the calls by 50ms each to prevent command flooding.
                # Use longer timeout for initial update to allow file list refresh to complete
                timeout_seconds = 30.0 if not self._initial_update_done else 15.0
                if not self._initial_update_done:
                    self._logger.debug(
                        "Initial update - using extended timeout of %s seconds",
                        timeout_seconds,
                    )
                try:
                    async with asyncio.timeout(timeout_seconds):
                        # Execute queries sequentially to avoid event queue race conditions.
                        # When using asyncio.gather with shared event queue, multiple waiters
                        # compete for the same events causing timeouts. Sequential execution
                        # ensures each query gets its response before the next starts.
                        live_mode = await self.adapter.client.get_live_mode(
                            timeout=timeout_seconds
                        )
                        await asyncio.sleep(0.05)  # 50ms delay between queries

                        device_params = await self.adapter.client.get_device_params(
                            timeout=timeout_seconds
                        )
                        await asyncio.sleep(0.05)

                        vol = await self.adapter.client.get_volume(
                            timeout=timeout_seconds
                        )
                        await asyncio.sleep(0.05)

                        live_name = await self.adapter.client.get_live_name(
                            timeout=timeout_seconds
                        )
                        await asyncio.sleep(0.05)

                        cap = await self.adapter.client.get_capacity(
                            timeout=timeout_seconds
                        )
                        await asyncio.sleep(0.05)

                        file_order = await self.adapter.client.get_file_order(
                            timeout=timeout_seconds
                        )
                except TimeoutError as ex:
                    self._logger.warning(
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
                    self._logger.debug(
                        "Coordinator checking REST server for live mode device: %s",
                        expected_mac,
                    )
                    try:
                        # Query REST server to verify connection is still active
                        rest_status = (
                            await self.adapter.client.get_audio_status_live_mode()
                        )

                        # Check if the REST server reports any connected devices
                        bluetooth_info = rest_status.get("bluetooth", {})
                        connected_devices = bluetooth_info.get("devices", [])

                        self._logger.debug(
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
                            self._logger.warning(
                                "Live mode device %s is no longer connected to REST server, cleaning up",
                                expected_mac,
                            )
                            # Disconnect on our side to sync state
                            await self.adapter.disconnect_live_mode()

                            # If user prefers live mode on, attempt to restore it
                            if self.adapter.live_mode_should_connect:
                                await self.adapter.restore_live_mode_if_needed()
                        else:
                            self._logger.debug(
                                "Live mode device %s is still connected to REST server",
                                expected_mac,
                            )

                    except Exception as ex:
                        # REST server may be down or unreachable
                        self._logger.warning(
                            "Failed to check REST server status for live mode device %s: %s. Assuming disconnected",
                            expected_mac,
                            ex,
                        )
                        # Clean up our state since we can't verify the connection
                        await self.adapter.disconnect_live_mode()

                # Extract capacity_kb and file_count_reported from CapacityEvent
                capacity_kb = getattr(cap, "capacity_kb", None) if cap else None
                file_count_reported = getattr(cap, "file_count", None) if cap else None

                # Preserve existing file_count_received value if already set
                # (it's only updated by async_refresh_file_list, not by regular polling)
                existing_file_count_received = (
                    self.data.get("file_count_received") if self.data else None
                )

                # Calculate MTU-based chunk size for display in number entity
                mtu_chunk_size = 250  # Default
                try:
                    mtu = await self.adapter.client.get_mtu_size()
                    if mtu and mtu > 0:
                        from .skelly_ultra_pkg.file_transfer import FileTransferManager

                        mtu_chunk_size = (
                            FileTransferManager.calculate_chunk_size_from_mtu(mtu)
                        )
                        self._logger.debug(
                            "Calculated MTU-based chunk size: %d bytes (MTU: %d)",
                            mtu_chunk_size,
                            mtu,
                        )
                except Exception:
                    self._logger.debug(
                        "Could not calculate MTU-based chunk size, using default: %d bytes",
                        mtu_chunk_size,
                    )

                # Extract pin_code and show_mode from DeviceParamsEvent
                pin_code = (
                    getattr(device_params, "pin_code", None) if device_params else None
                )
                if pin_code is not None:
                    pin_code = str(pin_code)
                show_mode = (
                    getattr(device_params, "show_mode", None) if device_params else None
                )

                # Check if device is in show mode (show_mode=1) on initial update
                if show_mode == 1 and self.data is None:
                    self._logger.error(
                        "Device is in SHOW MODE - This integration requires the device to be in normal mode. "
                        "To switch out of show mode, hold the button on the Skelly device for about 10 seconds until it beeps."
                    )

                data = {
                    "volume": vol,
                    "live_name": live_name,
                    "capacity_kb": capacity_kb,
                    "file_count_reported": file_count_reported,
                    "file_count_received": existing_file_count_received,  # Preserve existing value
                    "mtu_chunk_size": mtu_chunk_size,  # MTU-based chunk size for display
                    # eye is expected to be an int (1-based) or None
                    "eye_icon": eye,
                    # action is a bitfield where bit 0 = head, bit 1 = arm, bit 2 = torso
                    "action": action,
                    # file_order is a list of integers representing playback order
                    "file_order": file_order,
                    # pin_code is the Bluetooth pairing PIN (e.g., "1234")
                    "pin_code": pin_code,
                    # lights is a list of small dicts with brightness, rgb, effect_type, color_cycle, and effect_speed
                    "lights": [
                        {
                            "brightness": int(getattr(light0, "brightness", 0))
                            if light0 is not None
                            else None,
                            "rgb": tuple(getattr(light0, "rgb", (0, 0, 0)))
                            if light0 is not None
                            else None,
                            "effect_type": int(getattr(light0, "effect_type", 1))
                            if light0 is not None
                            else None,
                            "color_cycle": int(getattr(light0, "color_cycle", 0))
                            if light0 is not None
                            else None,
                            "effect_speed": int(getattr(light0, "effect_speed", 0))
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
                            "effect_type": int(getattr(light1, "effect_type", 1))
                            if light1 is not None
                            else None,
                            "color_cycle": int(getattr(light1, "color_cycle", 0))
                            if light1 is not None
                            else None,
                            "effect_speed": int(getattr(light1, "effect_speed", 0))
                            if light1 is not None
                            else None,
                        },
                    ],
                }
                self._logger.debug("Coordinator fetched data: %s", data)

                # On initial update, also fetch the file list
                if not self._initial_update_done:
                    self._logger.debug("Initial update - refreshing file list")
                    self._initial_update_done = True
                    # Schedule file list refresh as background task to not block coordinator update
                    self.hass.async_create_task(self.async_refresh_file_list())

                # Merge fetched data with existing data, respecting optimistic updates
                result_data = dict(self.data or {})
                optimistic_update_occurred = False

                for key, value in data.items():
                    current_counter = self._data_counters.get(key, 0)
                    start_counter = start_counters.get(key, 0)

                    if current_counter == start_counter:
                        # No optimistic update occurred for this key, use fetched value
                        result_data[key] = value
                        # Increment counter to mark this as a new version
                        self._data_counters[key] = current_counter + 1
                    else:
                        # Optimistic update occurred, discard fetched value and keep existing
                        optimistic_update_occurred = True
                        self._logger.debug(
                            "Optimistic update detected for key %s (counter %d != %d), discarding fetched value",
                            key,
                            current_counter,
                            start_counter,
                        )

                if optimistic_update_occurred:
                    self._logger.debug(
                        "Optimistic updates occurred during poll, scheduling immediate refresh"
                    )
                    # Schedule another refresh to get the authoritative state
                    # We use a task to avoid blocking the current update completion
                    self.hass.async_create_task(
                        self.async_request_refresh(force_immediate=True)
                    )

                if (
                    not optimistic_update_occurred
                    and self._pending_state_push
                    and self.adapter.client.is_connected
                ):
                    try:
                        await self._async_push_state_to_device(result_data)
                        self._pending_state_push = False
                        self._pending_state_push_attempts = 0
                        self._logger.debug(
                            "Finished pushing coordinator state to device after connection"
                        )
                    except Exception:
                        self._pending_state_push_attempts += 1
                        self._logger.exception(
                            "Failed to push coordinator state to device (attempt %d)",
                            self._pending_state_push_attempts,
                        )
                        # Keep pending flag true to retry on the next successful update

                return result_data

            except Exception:
                self._logger.exception("Coordinator update failed")
                raise UpdateFailed("Failed to update Skelly data") from None
            else:
                return data

    async def _async_push_state_to_device(self, state: dict[str, Any]) -> None:
        """Push selected coordinator state back to the device after connection."""

        # Skip if we don't have a connection to write to
        if not self.adapter.client.is_connected:
            self._logger.debug("Skipping state push - client not connected")
            return

        volume = state.get("volume")
        if volume is not None:
            try:
                await self.adapter.client.set_volume(int(volume))
            except Exception:
                self._logger.debug("Failed to push volume to device", exc_info=True)

        eye_icon = state.get("eye_icon")
        if eye_icon is not None:
            try:
                await self.adapter.client.set_eye_icon(int(eye_icon))
            except Exception:
                self._logger.debug("Failed to push eye icon to device", exc_info=True)

        action = state.get("action")
        if action is not None:
            try:
                await self.adapter.client.set_action(int(action))
            except Exception:
                self._logger.debug(
                    "Failed to push action bitfield to device", exc_info=True
                )

        lights = state.get("lights") or []
        for index, light_state in enumerate(lights):
            if not isinstance(light_state, dict):
                continue

            rgb = light_state.get("rgb")
            color_cycle = light_state.get("color_cycle")
            if rgb is not None:
                try:
                    r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
                    await self.adapter.client.set_light_rgb(
                        index,
                        r,
                        g,
                        b,
                        int(color_cycle) if color_cycle is not None else 0,
                    )
                except Exception:
                    self._logger.debug(
                        "Failed to push RGB for light channel %d", index, exc_info=True
                    )

            brightness = light_state.get("brightness")
            if brightness is not None:
                try:
                    await self.adapter.client.set_light_brightness(
                        index, int(brightness)
                    )
                except Exception:
                    self._logger.debug(
                        "Failed to push brightness for light channel %d",
                        index,
                        exc_info=True,
                    )

            effect_type = light_state.get("effect_type")
            if effect_type is not None:
                try:
                    await self.adapter.client.set_light_mode(index, int(effect_type))
                except Exception:
                    self._logger.debug(
                        "Failed to push effect mode for light channel %d",
                        index,
                        exc_info=True,
                    )

            effect_speed = light_state.get("effect_speed")
            if effect_speed is not None:
                try:
                    await self.adapter.client.set_light_speed(index, int(effect_speed))
                except Exception:
                    self._logger.debug(
                        "Failed to push effect speed for light channel %d",
                        index,
                        exc_info=True,
                    )
