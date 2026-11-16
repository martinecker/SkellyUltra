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
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client_adapter import SkellyClientAdapter
from .const import DOMAIN
from .helpers import DeviceLoggerAdapter, files_updated_signal, get_device_profile
from .playback_guard import PlaybackGuard
from .settings_sync import SettingsSync
from .skelly_ultra_pkg import parser
from .skelly_ultra_pkg.client import ConnectionLostError


_LOGGER = logging.getLogger(__name__)


def format_firmware_version(version: int | None) -> str | None:
    """Return the firmware version as the phone app shows it, e.g. "v68"."""
    return None if version is None else f"v{version}"


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
        self._entry = entry
        self.profile = get_device_profile(entry)
        self.action_lock = asyncio.Lock()
        self.device_info = device_info
        self._logger = device_logger or DeviceLoggerAdapter(
            _LOGGER, {"device_name": entry.title or "Skelly Ultra"}
        )
        self._is_initializing = True
        self._last_refresh_request = 0.0
        self._updates_paused = False
        self._file_list: list[Any] = []
        # Set while the file list is read from the device, for a UI
        self._file_list_loading = False
        self._initial_update_done = False
        self._data_counters: dict[str, int] = {}
        # Firmware version number (e.g. 68 for v68), read on every connect;
        # None until a device answered
        self.firmware_version: int | None = None
        self.settings_sync = SettingsSync(self, entry, self._logger)
        # Independent of _updates_paused (the Connected switch): holds off BLE
        # polling while the device plays an internal file.
        self.playback_guard = PlaybackGuard(
            hass,
            self._logger,
            on_changed=self._async_files_updated,
            on_ended=self.settings_sync.on_playback_ended,
        )
        adapter.register_disconnected_handler(self._on_device_disconnected)
        adapter.register_reconnected_callback(self._on_device_reconnected)
        adapter.register_connected_hook(self._async_on_connected)
        self._logger.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    async def _async_on_connected(self) -> None:
        """Read the firmware version, then let settings sync push its settings.

        Runs inside the adapter's connect, before the first poll, so features
        that depend on the firmware know it from the start.
        """
        await self._async_read_firmware_version()
        await self.settings_sync.async_on_connected()

    async def _async_read_firmware_version(self) -> None:
        """Query the firmware version; keep the last known one if it fails.

        It is read on every connect, as the device may have been updated with
        the phone app meanwhile. The version also goes to the device registry,
        where it shows as the device's firmware.
        """
        try:
            version = await self.adapter.client.get_version(timeout=2.0)
        except Exception as err:  # noqa: BLE001 - must not fail the connect
            self._logger.debug(
                "Couldn't read the firmware version: %s",
                str(err) or type(err).__name__,
            )
            return
        if version == self.firmware_version:
            return
        self._logger.info("Firmware version: v%d", version)
        self.firmware_version = version
        self._update_registry_sw_version()

    def _update_registry_sw_version(self) -> None:
        """Show the firmware version on the device page.

        The first connect can finish before the entities created the device,
        so this creates it from the same info if needed.
        """
        if self.device_info is None or self.firmware_version is None:
            return
        dr.async_get(self.hass).async_get_or_create(
            config_entry_id=self._entry.entry_id,
            **self.device_info,
            sw_version=format_firmware_version(self.firmware_version),
        )

    def async_update_data_optimistic(self, key: str, value: Any) -> None:
        """Update coordinator data optimistically and increment version counter.

        This should be called by entities when they send a command to the device
        and want to update the state immediately without waiting for the next poll.
        """
        self._data_counters[key] = self._data_counters.get(key, 0) + 1
        self.settings_sync.note_ha_change(key)

        new_data = dict(self.data or {})
        new_data[key] = value

        self.async_set_updated_data(new_data)

    def async_update_lights(self, changes: dict[int, dict[str, Any]]) -> None:
        """Update light channels optimistically, see async_update_data_optimistic.

        changes maps a channel to the fields that changed on it (rgb,
        brightness, effect_type, effect_speed, color_cycle); the channel's
        other fields stay as they are.
        """
        lights = [dict(light) for light in (self.data or {}).get("lights") or []]
        for channel, fields in changes.items():
            while len(lights) <= channel:
                lights.append({})
            lights[channel].update(fields)
        self.async_update_data_optimistic("lights", lights)

    def async_update_light(self, channel: int, **fields: Any) -> None:
        """Update one light channel optimistically, see async_update_lights."""
        self.async_update_lights({channel: fields})

    def async_merge_data(self, updates: dict[str, Any]) -> None:
        """Merge updates into the cached data without marking a successful poll.

        Unlike async_set_updated_data, this leaves last_update_success alone, so
        it can't make entities available again after the device disconnected.
        """
        if self.data:
            self.data = {**self.data, **updates}
            self.async_update_listeners()

    @callback
    def async_update_listeners(self) -> None:
        """Update entities, and remember changed live settings for the next connect."""
        super().async_update_listeners()
        self.settings_sync.remember(self.data)

    async def async_load_settings(self) -> None:
        """Load the live settings HA last knew; call before the first connect."""
        await self.settings_sync.async_load()

    @property
    def ha_controls_settings(self) -> bool:
        """Return True if HA's settings are sent to the device on connect."""
        return self.settings_sync.ha_controls_settings

    @property
    def known_settings(self) -> dict[str, Any] | None:
        """Return the live light, eye and volume settings HA knows, if any."""
        return self.settings_sync.known_settings

    async def async_push_settings(self) -> None:
        """Send HA's live settings to the device now (Push Settings button)."""
        await self.settings_sync.async_push()

    def async_stop_settings_push(self) -> None:
        """Send no more settings; call when the entry starts to unload."""
        self.settings_sync.stop()

    def async_resume_settings_push(self) -> None:
        """Undo async_stop_settings_push() after an unload failed."""
        self.settings_sync.resume()

    async def async_flush_settings(self) -> None:
        """Write a pending delayed settings save now; call on unload."""
        await self.settings_sync.async_flush()

    def async_stop_playback_timer(self) -> None:
        """Drop the playback safety timer; call once the entry has unloaded."""
        self.playback_guard.stop_timer()

    def _async_files_updated(self) -> None:
        """Tell the files subscriptions that the file list or playback changed."""
        async_dispatcher_send(self.hass, files_updated_signal(self._entry.entry_id))

    def _on_device_disconnected(self) -> None:
        """Mark entities unavailable as soon as the BLE link drops.

        Without this, entities stay available until the next poll and commands
        sent in the meantime fail with "Not connected". Also starts the
        adapter's background reconnect, so the device doesn't stay away until
        the next poll.
        """
        # The device can't still be playing for us; don't let the playback
        # guard keep returning stale data instead of polling. A push held
        # back by playback is made by the next connect instead.
        self.settings_sync.on_disconnected()
        self.mark_playback_inactive()
        self.async_set_update_error(UpdateFailed("Device disconnected"))
        self.adapter.start_reconnect_loop()

    def _on_device_reconnected(self) -> None:
        """Poll right away once the connection is back after a drop.

        This makes entities available again and shows the device's current
        state (it may have changed or reset meanwhile) without waiting for the
        next scheduled poll.
        """
        self.hass.async_create_task(self._async_refresh_after_reconnect())

    async def _async_refresh_after_reconnect(self) -> None:
        # Refresh directly: the base class debouncer would hold this back for
        # up to 10s after any recent refresh request (e.g. a volume change
        # right before the drop), and our own request adds a 3s debounce and
        # a 2s settle delay. A reconnect happens once per drop, so this can't
        # flood the device.
        await self.async_refresh()

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

    def mark_playback_active(
        self, duration_seconds: float | None = None, *, timeout: float | None = None
    ) -> None:
        """Suppress device polling while the device plays an internal file.

        This is independent of pause_updates() / resume_updates(), which are
        driven by the Connected switch. See PlaybackGuard.mark_active.
        """
        self.playback_guard.mark_active(duration_seconds, timeout=timeout)

    @property
    def playback(self) -> dict[str, int] | None:
        """Return the file the device reported playing, or None.

        A dict with file_index, duration (seconds, 0 if unknown), started
        (when the report came, in ms since the epoch) and report, which is
        new for every "playing" report.
        """
        return self.playback_guard.playback

    @callback
    def handle_device_event(self, event: Any) -> None:
        """Follow the device's play/pause reports (a client event listener).

        Registered at setup, before the first connect, so a report is never
        missed, even while the media player is still being added.
        """
        if isinstance(event, parser.PlaybackEvent):
            self.set_playback(event.file_index, event.playing, event.duration)

    def set_playback(self, file_index: int, playing: bool, duration: int) -> None:
        """Record the device's report that a file started or stopped playing."""
        self.playback_guard.set_playback(file_index, playing, duration)

    async def async_play_file(self, file_index: int) -> None:
        """Play a file stored on the device.

        Waits for a poll or file list read in progress to end and holds off
        new ones first: their queries would stop the file right away.
        """
        async with self.action_lock:
            # Until the device reports playing (which sets the file's length)
            self.playback_guard.mark_play_sent(file_index)
            try:
                await self.adapter.client.play_file(file_index)
            except BaseException:
                self.mark_playback_inactive()
                raise

    def mark_playback_inactive(self) -> None:
        """Re-enable device polling after internal-file playback ends."""
        self.playback_guard.mark_inactive()

    async def async_refresh_file_list(self, *, lock_held: bool = False) -> None:
        """Refresh the list of files from the device.

        This method fetches the current file list from the device and stores
        it in the coordinator. It can be called by both entities and services
        that need the latest file list information.

        Uses action_lock to prevent concurrent execution with coordinator updates.
        Callers that already hold action_lock must pass lock_held=True, since
        asyncio.Lock isn't reentrant and acquiring it again would deadlock.
        """
        # Check if we have a connection before attempting to fetch
        if not self.adapter.client.is_connected:
            self._logger.debug("Skipping file list refresh - device not connected")
            self._set_file_list_loading(False)
            return

        # Don't query the device mid-playback - the capacity query aborts it.
        if self.playback_active:
            self._logger.debug(
                "Skipping file list refresh - internal file playback in progress"
            )
            self._set_file_list_loading(False)
            return

        self.mark_file_list_loading()
        try:
            if lock_held:
                await self._async_load_file_list()
                return

            async with self.action_lock:
                self._logger.debug("Acquiring lock for file list refresh")
                # A file may have started playing while this waited
                if self.playback_active:
                    self._logger.debug(
                        "Skipping file list refresh - internal file playback started"
                    )
                    return
                await self._async_load_file_list()
        finally:
            self._set_file_list_loading(False)

    def mark_file_list_loading(self) -> None:
        """Mark the file list as being read, until the refresh is done.

        Callers that are about to call async_refresh_file_list can mark it
        early, so that UIs don't show the old list as current meanwhile.
        """
        self._set_file_list_loading(True)

    def _set_file_list_loading(self, loading: bool) -> None:
        """Set file_list_loading and tell the files subscriptions."""
        if self._file_list_loading == loading:
            return
        self._file_list_loading = loading
        self._async_files_updated()

    @property
    def file_list_loading(self) -> bool:
        """Return True while the file list is read from the device."""
        return self._file_list_loading

    async def _async_load_file_list(self) -> None:
        """Read the file list, order and capacity into the coordinator."""
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
        except ConnectionLostError:
            self._logger.debug("Device disconnected while loading file list")
            self._file_list = []
            self.async_merge_data({"file_count_received": 0})
        except TimeoutError:
            self._logger.warning("Timeout loading file list from device")
            self._file_list = []
            self.async_merge_data({"file_count_received": 0})
        except Exception:
            self._logger.exception("Failed to load file list from device")
            self._file_list = []
            self.async_merge_data({"file_count_received": 0})

    async def async_refresh_file_order(self) -> list[int]:
        """Fetch the play order from the device and store it.

        Unlike async_refresh_file_list, this only reads the order. The caller
        must hold action_lock. Errors from the device are passed on.
        """
        file_order = await self.adapter.client.get_file_order(timeout=5.0)
        self.async_merge_data({"file_order": file_order})
        return file_order

    @property
    def playback_active(self) -> bool:
        """Return True while the device plays an internal file.

        BLE polling and file list refreshes are held off during playback.
        """
        return self.playback_guard.active

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

        With force_immediate, refreshes right away and skips both our 3s
        debounce and the base class debouncer (10s cooldown). It's used where
        the refresh must not be dropped or held back: the Connected switch
        (turning it back on within 3s of turning it off) and the re-poll after
        a poll raced an optimistic update. Polls are serialized by action_lock.
        """
        if force_immediate:
            if self.playback_active:
                self._logger.debug(
                    "Skipping coordinator refresh - internal file playback in progress"
                )
                return
            self._logger.debug("Refreshing coordinator immediately")
            await self.async_refresh()
            return

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

        self._logger.debug(
            "Delaying coordinator refresh by 2s to allow changes to settle"
        )

        # Wait 2 seconds to give the device time to process the change
        # and allow any rapid consecutive changes to complete
        await asyncio.sleep(2.0)

        self._logger.debug("Requesting coordinator refresh after delay")

        # Playback may have started during the settle delay
        if self.playback_active:
            self._logger.debug(
                "Skipping coordinator refresh - internal file playback in progress"
            )
            return

        await super().async_request_refresh()

    @staticmethod
    def _light_state_dict(light: Any) -> dict[str, Any]:
        """Build the coordinator-cache dict for a single light from a LightInfo, or all-None if absent."""
        if light is None:
            return {
                "brightness": None,
                "rgb": None,
                "effect_type": None,
                "color_cycle": None,
                "effect_speed": None,
            }
        return {
            "brightness": int(getattr(light, "brightness", 0)),
            "rgb": tuple(getattr(light, "rgb", (0, 0, 0))),
            "effect_type": int(getattr(light, "effect_type", 1)),
            "color_cycle": int(getattr(light, "color_cycle", 0)),
            "effect_speed": int(getattr(light, "effect_speed", 0)),
        }

    async def _async_update_data(self) -> Any:
        # Skip updates if paused (e.g., when Connected switch is off)
        if self._updates_paused:
            self._logger.debug("Coordinator updates paused - skipping poll")
            raise UpdateFailed(
                "Device updates paused due to turned off Connected switch"
            )

        # Skip polling while the device is playing an internal file: the query
        # burst (notably the capacity query) knocks the device out of playback.
        # Return the last known data so entities don't churn to unavailable.
        if self.playback_active and self.data is not None:
            self._logger.debug(
                "Coordinator poll skipped - internal file playback in progress"
            )
            return self.data

        if not self.adapter.client.is_connected:
            # Try to reconnect unless the device initialization is still running
            # or the adapter's background reconnect is already on it
            if not self._is_initializing and not self.adapter.is_reconnecting:
                self._logger.debug(
                    "Coordinator update with device not connected after initialization - attempting to re-connect"
                )
                await self.adapter.connect(attempts=1, automatic=True)

            if not self.adapter.client.is_connected:
                self._logger.debug("Skipping coordinator update - device not connected")
                raise UpdateFailed("Device not connected")

        # Outside action_lock: it only talks to the REST server
        await self.adapter.async_check_live_mode()

        # Use action_lock to prevent concurrent execution with file list refresh
        async with self.action_lock:
            # A file may have started playing while this poll waited
            if self.playback_active and self.data is not None:
                self._logger.debug(
                    "Coordinator poll skipped - internal file playback started"
                )
                return self.data

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
                        queries = (
                            self.adapter.client.get_live_mode,
                            self.adapter.client.get_device_params,
                            self.adapter.client.get_volume,
                            self.adapter.client.get_live_name,
                            self.adapter.client.get_capacity,
                            self.adapter.client.get_file_order,
                        )
                        results = []
                        for i, query in enumerate(queries):
                            results.append(await query(timeout=timeout_seconds))
                            if i < len(queries) - 1:
                                await asyncio.sleep(0.05)  # 50ms delay between queries
                        (
                            live_mode,
                            device_params,
                            vol,
                            live_name,
                            cap,
                            file_order,
                        ) = results
                except ConnectionLostError as ex:
                    raise UpdateFailed("Device disconnected during polling") from ex
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
                    # Firmware version as shown, e.g. "v68"; read on connect
                    "firmware_version": format_firmware_version(self.firmware_version),
                    # lights is a list of small dicts with brightness, rgb, effect_type, color_cycle, and effect_speed
                    "lights": [
                        self._light_state_dict(light0),
                        self._light_state_dict(light1),
                    ],
                }
                self._logger.debug("Coordinator fetched data: %s", data)
                self.settings_sync.verify(data)

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

                return result_data

            except UpdateFailed:
                raise
            except Exception:
                self._logger.exception("Coordinator update failed")
                raise UpdateFailed("Failed to update Skelly data") from None
