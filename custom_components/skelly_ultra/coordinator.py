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
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client_adapter import SkellyClientAdapter
from .const import CONF_HA_CONTROLS_SETTINGS, DEFAULT_HA_CONTROLS_SETTINGS, DOMAIN
from .file_settings import LIVE_SETTING_KEYS, async_push_live_settings
from .helpers import DeviceLoggerAdapter, files_updated_signal, get_device_profile
from .skelly_ultra_pkg.client import ConnectionLostError


_LOGGER = logging.getLogger(__name__)

# While the device is playing an internal file, BLE polling is suppressed so the
# coordinator's query burst (notably the capacity query) doesn't knock the device
# out of playback. Polling normally resumes when the device reports playback
# stopped; the safety timer below only covers a missed "stopped" notification.
#
# When the device reports the file's duration, the timer is set to that plus a
# margin (any length - no upper cap, or long files would be cut off). The
# fallback is used only for the brief window before the device's first
# PlaybackEvent arrives, after which the timer is re-armed with the real
# duration.
PLAYBACK_ACTIVE_MARGIN_SECONDS = 10.0
PLAYBACK_ACTIVE_FALLBACK_SECONDS = 60.0

# The last live light, eye and volume settings HA knew, kept across restarts
# so they can be sent to the device on connect (ha_controls_settings option).
SETTINGS_STORAGE_VERSION = 1
SETTINGS_SAVE_DELAY = 5.0


def _settings_store(hass: HomeAssistant, entry_id: str) -> Store:
    return Store(hass, SETTINGS_STORAGE_VERSION, f"{DOMAIN}.{entry_id}.settings")


async def async_remove_settings(hass: HomeAssistant, entry_id: str) -> None:
    """Delete the stored settings of a removed config entry."""
    await _settings_store(hass, entry_id).async_remove()


def _live_settings(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return the live light, eye and volume settings in data, or None if incomplete."""
    if not data:
        return None
    settings = {key: data.get(key) for key in LIVE_SETTING_KEYS}
    lights = settings["lights"]
    if (
        settings["volume"] is None
        or not isinstance(lights, list)
        or not lights
        or not all(isinstance(light, dict) for light in lights)
        or all(light.get("brightness") is None for light in lights)
    ):
        return None
    settings["lights"] = [dict(light) for light in lights]
    return settings


def _normalize_settings(settings: dict[str, Any]) -> dict[str, Any]:
    """Make stored settings compare equal to the coordinator's (JSON has no tuples)."""
    lights = []
    for light in settings.get("lights") or []:
        light = dict(light)
        if light.get("rgb") is not None:
            light["rgb"] = tuple(light["rgb"])
        lights.append(light)
    return {**settings, "lights": lights}


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
        self._profile = get_device_profile(entry)
        self.action_lock = asyncio.Lock()
        self.device_info = device_info
        self._logger = device_logger or DeviceLoggerAdapter(
            _LOGGER, {"device_name": entry.title or "Skelly Ultra"}
        )
        self._is_initializing = True
        self._last_refresh_request = 0.0
        self._updates_paused = False
        # Independent of _updates_paused (the Connected switch): set while the
        # device plays an internal file, to hold off BLE polling.
        self._playback_active = False
        self._playback_active_timer: asyncio.TimerHandle | None = None
        self._file_list: list[Any] = []
        # Set while the file list is read from the device, for a UI
        self._file_list_loading = False
        self._initial_update_done = False
        self._data_counters: dict[str, int] = {}
        # Last live settings HA knew (see async_load_settings), and the
        # settings last pushed, which the next poll checks.
        self._settings_store = _settings_store(hass, entry.entry_id)
        self._known_settings: dict[str, Any] | None = None
        self._settings_save_pending = False
        self._push_to_verify: dict[str, Any] | None = None
        # Bumped only by changes made in HA (async_update_data_optimistic),
        # unlike _data_counters, which every poll bumps too.
        self._ha_changes: dict[str, int] = {}
        self._push_counters: dict[str, int] = {}
        self._push_stop_count = 0
        self._push_retried = False
        # A push on connect held back by playback, sent once it ends.
        self._push_after_playback = False
        self._closing = False
        adapter.register_disconnected_handler(self._on_device_disconnected)
        adapter.register_reconnected_callback(self._on_device_reconnected)
        adapter.register_connected_hook(self._async_on_connected)
        self._logger.debug("SkellyCoordinator initialized for adapter: %s", adapter)

    def async_update_data_optimistic(self, key: str, value: Any) -> None:
        """Update coordinator data optimistically and increment version counter.

        This should be called by entities when they send a command to the device
        and want to update the state immediately without waiting for the next poll.
        """
        self._data_counters[key] = self._data_counters.get(key, 0) + 1
        self._ha_changes[key] = self._ha_changes.get(key, 0) + 1

        new_data = dict(self.data or {})
        new_data[key] = value

        self.async_set_updated_data(new_data)

    def _async_merge_data(self, updates: dict[str, Any]) -> None:
        """Merge updates into the cached data without marking a successful poll.

        Unlike async_set_updated_data, this leaves last_update_success alone, so
        it can't make entities available again after the device disconnected.
        """
        if self.data:
            self.data = {**self.data, **updates}
            self.async_update_listeners()

    async def async_load_settings(self) -> None:
        """Load the live settings HA last knew; call before the first connect."""
        stored = await self._settings_store.async_load()
        if isinstance(stored, dict) and _live_settings(stored) is not None:
            self._known_settings = _normalize_settings(stored)

    @property
    def ha_controls_settings(self) -> bool:
        """Return True if HA's settings are sent to the device on connect."""
        return self._entry.options.get(
            CONF_HA_CONTROLS_SETTINGS, DEFAULT_HA_CONTROLS_SETTINGS
        )

    @callback
    def async_update_listeners(self) -> None:
        """Update entities, and remember changed live settings for the next connect."""
        super().async_update_listeners()
        settings = _live_settings(self.data)
        if settings is not None and settings != self._known_settings:
            self._known_settings = settings
            self._settings_save_pending = True
            self._settings_store.async_delay_save(
                lambda: self._known_settings, SETTINGS_SAVE_DELAY
            )

    @property
    def known_settings(self) -> dict[str, Any] | None:
        """Return the live light, eye and volume settings HA knows, if any."""
        return _live_settings(self.data) or self._known_settings

    async def _async_on_connected(self) -> None:
        """Send HA's settings after every connect if HA controls them.

        Runs inside the adapter's connect, before the first poll and before
        any command that triggered the reconnect.
        """
        # A check left over from before a disconnect() (no poll ran since)
        # would compare against a device that may have changed meanwhile.
        self._push_to_verify = None
        if self._closing or not self.ha_controls_settings:
            return
        settings = self.known_settings
        if settings is None:
            self._logger.debug("No known settings yet - nothing to send on connect")
            return
        if self._playback_active:
            self._logger.debug("Playback in progress - sending settings once it ends")
            self._push_after_playback = True
            return
        # Take action_lock when it's free, so no poll runs between the writes.
        # When it's held, the holder may be waiting for this very reconnect.
        if self.action_lock.locked():
            await self._async_push_settings(settings)
        else:
            async with self.action_lock:
                await self._async_push_settings(settings)

    def _counters(self) -> dict[str, int]:
        return {key: self._ha_changes.get(key, 0) for key in LIVE_SETTING_KEYS}

    async def _async_push_settings(
        self, settings: dict[str, Any], *, retry: bool = False
    ) -> None:
        """Send settings to the device and have the next poll check them.

        settings may hold only some of the live setting keys. Entity commands
        don't take action_lock, so a setting can change in HA while this
        runs; the device may then have got the older value after the newer
        one, so HA's current value is sent once more.

        Stops between writes when disconnect() runs meanwhile (Connected
        switch off, unload); in proxy mode the client still looks connected
        then.
        """
        stops = self.adapter.stop_count

        def keep_going() -> bool:
            return self.adapter.stop_count == stops

        counters = self._counters()
        writes = await async_push_live_settings(
            self.adapter.client, self._profile, settings, keep_going
        )
        changed = {
            key: self.data[key]
            for key in settings
            if self.data and self._ha_changes.get(key, 0) != counters[key]
        }
        if changed:
            counters.update(self._counters())
            writes += await async_push_live_settings(
                self.adapter.client, self._profile, changed, keep_going
            )
            settings = {**settings, **changed}
        self._logger.debug("Sent %d live settings to the device", writes)
        if not keep_going():
            return  # disconnecting: nothing to check
        # Only what HA still shows: a change during the second round is
        # newer than anything sent, and its own command sent it.
        unchanged = {
            key: value
            for key, value in settings.items()
            if self._ha_changes.get(key, 0) == counters[key]
        }
        self._push_to_verify = unchanged
        self._push_counters = counters
        self._push_stop_count = stops
        self._push_retried = retry
        self._async_merge_data(unchanged)

    async def async_push_settings(self) -> None:
        """Send HA's live light, eye and volume settings to the device now.

        For the Push Settings button. Raises HomeAssistantError when there is
        nothing to send, the device isn't connected or plays a file.
        """
        settings = self.known_settings
        if settings is None:
            raise HomeAssistantError("No Skelly settings known yet to send")
        if not self.adapter.client.is_connected:
            raise HomeAssistantError("Skelly is not connected")
        if self._playback_active:
            raise HomeAssistantError(
                "Skelly is playing a file; try again when it has ended"
            )
        async with self.action_lock:
            try:
                await self._async_push_settings(self.known_settings or settings)
            except Exception as ex:
                raise HomeAssistantError(f"Failed to send settings: {ex}") from ex
        await self.async_request_refresh(force_immediate=True)

    def _verify_pushed_settings(self, data: dict[str, Any]) -> None:
        """Check a poll against the settings last pushed; called inside the poll.

        A dropped write would otherwise teach HA the device's wrong value. On
        a mismatch the pushed values are kept and sent once more; if the
        device still differs after that, its values are taken.
        """
        pushed = self._push_to_verify
        self._push_to_verify = None
        # disconnect() started since the push (e.g. while this poll ran)
        if pushed is None or self.adapter.stop_count != self._push_stop_count:
            return
        polled = {key: data.get(key) for key in LIVE_SETTING_KEYS}
        mismatched = [
            key
            for key in pushed
            # Changed in HA since the push (e.g. by the command that caused
            # the reconnect): the device has the newer value, not a dropped write.
            if self._ha_changes.get(key, 0) == self._push_counters.get(key, 0)
            and self._differs(key, pushed, polled)
        ]
        if not mismatched:
            return
        if self._push_retried:
            self._logger.warning(
                "Device still reports different %s than sent; using the device's",
                ", ".join(mismatched),
            )
            return
        self._logger.debug(
            "Device reports different %s than sent; sending again",
            ", ".join(mismatched),
        )
        for key in mismatched:
            data[key] = pushed[key]
        self._start_push_task(mismatched, retry=True)

    def _differs(
        self, key: str, pushed: dict[str, Any], polled: dict[str, Any]
    ) -> bool:
        """Return True if a polled setting differs from what was pushed."""
        if pushed.get(key) is None:
            return False
        if key == "eye_icon" and not self._profile.get("has_eye_image"):
            return False  # not sent
        if key != "lights":
            return pushed[key] != polled[key]
        polled_lights = polled["lights"] or []
        for light_def in self._profile.get("lights", []):
            channel = light_def["channel"]
            if channel >= len(pushed["lights"]):
                continue
            want = pushed["lights"][channel]
            have = polled_lights[channel] if channel < len(polled_lights) else {}
            if any(
                value is not None and have.get(field) != value
                for field, value in want.items()
            ):
                return True
        return False

    def _start_push_task(self, keys: list[str], *, retry: bool) -> None:
        """Send some live settings in the background (ended by an unload)."""
        self._entry.async_create_background_task(
            self.hass,
            self._async_push_keys(keys, retry=retry),
            f"skelly_ultra push settings {self._entry.entry_id}",
        )

    async def _async_push_keys(self, keys: list[str], *, retry: bool) -> None:
        """Send HA's current values of some live settings, then poll to check them.

        retry: a resend after a poll reported other values (checked once
        more, then the device's values are taken). Otherwise the push held
        back while a file played.
        """
        if self._closing or not self.adapter.client.is_connected:
            return
        if not retry and not self.ha_controls_settings:
            return
        async with self.action_lock:
            if self._closing or not self.adapter.client.is_connected:
                return
            if self._playback_active:
                if not retry:
                    self._push_after_playback = True
                return
            settings = self.known_settings
            if settings is None:
                return
            try:
                await self._async_push_settings(
                    {key: settings[key] for key in keys}, retry=retry
                )
            except Exception:
                self._logger.debug("Failed to send settings", exc_info=True)
                return
        await self.async_request_refresh(force_immediate=True)

    def _on_playback_ended(self) -> None:
        if self._push_after_playback and not self._closing:
            self._push_after_playback = False
            self._start_push_task(list(LIVE_SETTING_KEYS), retry=False)

    def async_stop_settings_push(self) -> None:
        """Send no more settings; call when the entry starts to unload."""
        self._closing = True
        self._push_to_verify = None

    def async_resume_settings_push(self) -> None:
        """Undo async_stop_settings_push() after an unload failed."""
        self._closing = False
        if not self._playback_active:
            self._on_playback_ended()  # a push held back meanwhile

    async def async_flush_settings(self) -> None:
        """Write a pending delayed save now; call on unload.

        A delayed save still pending when the entry is removed would write
        the file again after async_remove_settings deleted it.
        """
        if self._settings_save_pending and self._known_settings is not None:
            self._settings_save_pending = False
            await self._settings_store.async_save(self._known_settings)

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
        self._push_after_playback = False
        self._push_to_verify = None
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

    def mark_playback_active(self, duration_seconds: float | None = None) -> None:
        """Suppress device polling while the device plays an internal file.

        The Skelly aborts internal-file playback if it receives the coordinator's
        BLE query burst mid-file (notably the capacity query), so polling is held
        off until playback ends. This is independent of pause_updates() /
        resume_updates(), which are driven by the Connected switch.

        A safety timer clears the flag after the expected duration (plus a
        margin) so polling can't get stuck off if the device's "playback
        stopped" notification is never received. When the duration is known it
        is used as-is with no upper cap, so long files are not cut short.
        """
        if duration_seconds and duration_seconds > 0:
            timeout = duration_seconds + PLAYBACK_ACTIVE_MARGIN_SECONDS
        else:
            timeout = PLAYBACK_ACTIVE_FALLBACK_SECONDS

        self._playback_active = True
        if self._playback_active_timer is not None:
            self._playback_active_timer.cancel()
        self._playback_active_timer = self.hass.loop.call_later(
            timeout, self._on_playback_active_timeout
        )
        self._logger.debug(
            "Playback active - suppressing device polling for up to %.0fs", timeout
        )

    def mark_playback_inactive(self) -> None:
        """Re-enable device polling after internal-file playback ends."""
        if self._playback_active_timer is not None:
            self._playback_active_timer.cancel()
            self._playback_active_timer = None
        if self._playback_active:
            self._playback_active = False
            self._logger.debug("Playback ended - resuming device polling")
            self._on_playback_ended()

    def _on_playback_active_timeout(self) -> None:
        """Force-resume polling if no 'playback stopped' event arrived in time."""
        self._playback_active_timer = None
        if self._playback_active:
            self._logger.warning(
                "Playback-active flag timed out without a stop event; "
                "resuming device polling"
            )
            self._playback_active = False
            self._on_playback_ended()

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
        if self._playback_active:
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
        async_dispatcher_send(self.hass, files_updated_signal(self._entry.entry_id))

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
            self._async_merge_data({"file_count_received": 0})
        except TimeoutError:
            self._logger.warning("Timeout loading file list from device")
            self._file_list = []
            self._async_merge_data({"file_count_received": 0})
        except Exception:
            self._logger.exception("Failed to load file list from device")
            self._file_list = []
            self._async_merge_data({"file_count_received": 0})

    async def async_refresh_file_order(self) -> list[int]:
        """Fetch the play order from the device and store it.

        Unlike async_refresh_file_list, this only reads the order. The caller
        must hold action_lock. Errors from the device are passed on.
        """
        file_order = await self.adapter.client.get_file_order(timeout=5.0)
        self._async_merge_data({"file_order": file_order})
        return file_order

    @property
    def playback_active(self) -> bool:
        """Return True while the device plays an internal file.

        BLE polling and file list refreshes are held off during playback.
        """
        return self._playback_active

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
            if self._playback_active:
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
        if self._playback_active:
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
        if self._playback_active and self.data is not None:
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
                        self._light_state_dict(light0),
                        self._light_state_dict(light1),
                    ],
                }
                self._logger.debug("Coordinator fetched data: %s", data)
                self._verify_pushed_settings(data)

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
