"""Keep the Skelly's live light, eye and volume settings in step with HA.

With the ha_controls_settings option on, HA is the source of truth for these
settings: SettingsSync sends the settings HA last knew to the device after
every connect, checks the next poll got them, and sends dropped writes once
more. It also remembers the settings across restarts, and backs the Push
Settings button.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store

from .const import CONF_HA_CONTROLS_SETTINGS, DEFAULT_HA_CONTROLS_SETTINGS, DOMAIN
from .file_settings import (
    LIVE_SETTING_KEYS,
    async_current_light_scene,
    async_push_live_settings,
)

if TYPE_CHECKING:
    from .coordinator import SkellyCoordinator

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


class SettingsSync:
    """Push HA's live settings to the device and check that they arrived.

    Works on the coordinator's data and takes its action_lock for writes, so
    no poll runs between them.
    """

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry: ConfigEntry,
        logger: logging.Logger | logging.LoggerAdapter,
    ) -> None:
        self._coordinator = coordinator
        self._entry = entry
        self._logger = logger
        # Last live settings HA knew (see async_load), and the settings last
        # pushed, which the next poll checks.
        self._store = _settings_store(coordinator.hass, self._entry.entry_id)
        self._known_settings: dict[str, Any] | None = None
        self._save_pending = False
        self._push_to_verify: dict[str, Any] | None = None
        # Bumped only by changes made in HA (note_ha_change), unlike the
        # coordinator's data counters, which every poll bumps too.
        self._ha_changes: dict[str, int] = {}
        self._push_counters: dict[str, int] = {}
        self._push_stop_count = 0
        self._push_retried = False
        # A push on connect held back by playback, sent once it ends.
        self._push_after_playback = False
        self._closing = False

    @property
    def ha_controls_settings(self) -> bool:
        """Return True if HA's settings are sent to the device on connect."""
        return self._entry.options.get(
            CONF_HA_CONTROLS_SETTINGS, DEFAULT_HA_CONTROLS_SETTINGS
        )

    @property
    def known_settings(self) -> dict[str, Any] | None:
        """Return the live light, eye and volume settings HA knows, if any."""
        return _live_settings(self._coordinator.data) or self._known_settings

    async def async_load(self) -> None:
        """Load the live settings HA last knew; call before the first connect."""
        stored = await self._store.async_load()
        if isinstance(stored, dict) and _live_settings(stored) is not None:
            self._known_settings = _normalize_settings(stored)

    def note_ha_change(self, key: str) -> None:
        """Note that a setting was changed in HA (a command, not a poll)."""
        self._ha_changes[key] = self._ha_changes.get(key, 0) + 1

    def remember(self, data: dict[str, Any] | None) -> None:
        """Remember changed live settings in data for the next connect."""
        settings = _live_settings(data)
        if settings is not None and settings != self._known_settings:
            self._known_settings = settings
            self._save_pending = True
            self._store.async_delay_save(
                lambda: self._known_settings, SETTINGS_SAVE_DELAY
            )

    async def async_on_connected(self) -> None:
        """Send HA's settings after every connect if HA controls them.

        Runs inside the adapter's connect, before the first poll and before
        any command that triggered the reconnect.
        """
        coordinator = self._coordinator
        # A check left over from before a disconnect() (no poll ran since)
        # would compare against a device that may have changed meanwhile.
        self._push_to_verify = None
        if self._closing or not self.ha_controls_settings:
            return
        settings = self.known_settings
        if settings is None:
            self._logger.debug("No known settings yet - nothing to send on connect")
            return
        if coordinator.playback_active:
            self._logger.debug("Playback in progress - sending settings once it ends")
            self._push_after_playback = True
            return
        # Take action_lock when it's free, so no poll runs between the writes.
        # When it's held, the holder may be waiting for this very reconnect.
        if coordinator.action_lock.locked():
            await self._async_push(settings)
        else:
            async with coordinator.action_lock:
                await self._async_push(settings)

    def _counters(self) -> dict[str, int]:
        return {key: self._ha_changes.get(key, 0) for key in LIVE_SETTING_KEYS}

    async def _async_push(
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
        coordinator = self._coordinator
        adapter = coordinator.adapter
        profile = coordinator.profile
        stops = adapter.stop_count

        def keep_going() -> bool:
            return adapter.stop_count == stops

        counters = self._counters()
        scene = await async_current_light_scene(coordinator, adapter.client)
        writes = await async_push_live_settings(
            adapter.client, profile, settings, keep_going, scene
        )
        data = coordinator.data
        changed = {
            key: data[key]
            for key in settings
            if data and self._ha_changes.get(key, 0) != counters[key]
        }
        if changed:
            counters.update(self._counters())
            writes += await async_push_live_settings(
                adapter.client, profile, changed, keep_going, scene
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
        coordinator.async_merge_data(unchanged)

    async def async_push(self) -> None:
        """Send HA's live light, eye and volume settings to the device now.

        For the Push Settings button. Raises HomeAssistantError when there is
        nothing to send, the device isn't connected or plays a file.
        """
        coordinator = self._coordinator
        settings = self.known_settings
        if settings is None:
            raise HomeAssistantError("No Skelly settings known yet to send")
        if not coordinator.adapter.client.is_connected:
            raise HomeAssistantError("Skelly is not connected")
        if coordinator.playback_active:
            raise HomeAssistantError(
                "Skelly is playing a file; try again when it has ended"
            )
        async with coordinator.action_lock:
            try:
                await self._async_push(self.known_settings or settings)
            except Exception as ex:
                raise HomeAssistantError(f"Failed to send settings: {ex}") from ex
        await coordinator.async_request_refresh(force_immediate=True)

    def verify(self, data: dict[str, Any]) -> None:
        """Check a poll against the settings last pushed; called inside the poll.

        A dropped write would otherwise teach HA the device's wrong value. On
        a mismatch the pushed values are kept (in data) and sent once more;
        if the device still differs after that, its values are taken.
        """
        pushed = self._push_to_verify
        self._push_to_verify = None
        # disconnect() started since the push (e.g. while this poll ran)
        if (
            pushed is None
            or self._coordinator.adapter.stop_count != self._push_stop_count
        ):
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
        profile = self._coordinator.profile
        if pushed.get(key) is None:
            return False
        if key == "eye_icon" and not profile.get("has_eye_image"):
            return False  # not sent
        if key != "lights":
            return pushed[key] != polled[key]
        polled_lights = polled["lights"] or []
        for light_def in profile.get("lights", []):
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
            self._coordinator.hass,
            self._async_push_keys(keys, retry=retry),
            f"skelly_ultra push settings {self._entry.entry_id}",
        )

    async def _async_push_keys(self, keys: list[str], *, retry: bool) -> None:
        """Send HA's current values of some live settings, then poll to check them.

        retry: a resend after a poll reported other values (checked once
        more, then the device's values are taken). Otherwise the push held
        back while a file played.
        """
        coordinator = self._coordinator
        client = coordinator.adapter.client
        if self._closing or not client.is_connected:
            return
        if not retry and not self.ha_controls_settings:
            return
        async with coordinator.action_lock:
            if self._closing or not client.is_connected:
                return
            if coordinator.playback_active:
                if not retry:
                    self._push_after_playback = True
                return
            settings = self.known_settings
            if settings is None:
                return
            try:
                await self._async_push(
                    {key: settings[key] for key in keys}, retry=retry
                )
            except Exception:
                self._logger.debug("Failed to send settings", exc_info=True)
                return
        await coordinator.async_request_refresh(force_immediate=True)

    def on_playback_ended(self) -> None:
        """Send a push held back while a file played."""
        if self._push_after_playback and not self._closing:
            self._push_after_playback = False
            self._start_push_task(list(LIVE_SETTING_KEYS), retry=False)

    def on_disconnected(self) -> None:
        """Forget pending work when the BLE link drops.

        A push held back by playback is made by the next connect instead.
        """
        self._push_after_playback = False
        self._push_to_verify = None

    def stop(self) -> None:
        """Send no more settings; call when the entry starts to unload."""
        self._closing = True
        self._push_to_verify = None

    def resume(self) -> None:
        """Undo stop() after an unload failed."""
        self._closing = False
        if not self._coordinator.playback_active:
            self.on_playback_ended()  # a push held back meanwhile

    async def async_flush(self) -> None:
        """Write a pending delayed save now; call on unload.

        A delayed save still pending when the entry is removed would write
        the file again after async_remove_settings deleted it.
        """
        if self._save_pending and self._known_settings is not None:
            self._save_pending = False
            await self._store.async_save(self._known_settings)
