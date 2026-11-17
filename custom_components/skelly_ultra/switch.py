"""Switch platform for controlling Skelly live/classic Bluetooth mode."""

from __future__ import annotations

import contextlib
import logging
from functools import partial

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo

from .coordinator import SkellyCoordinator
from .data import SkellyConfigEntry
from .entity import (
    SkellyCoordinatorEntity,
    SkellyEntity,
    async_run_command,
    async_turn_on_live_mode,
)
from .helpers import get_device_info, get_device_profile

_LOGGER = logging.getLogger(__name__)


def _persist_entry_option(
    hass: HomeAssistant, entry: ConfigEntry, key: str, value: object
) -> None:
    """Merge one key into a config entry's options and persist it."""
    hass.config_entries.async_update_entry(entry, options={**entry.options, key: value})


async def async_setup_entry(
    hass: HomeAssistant, entry: SkellyConfigEntry, async_add_entities
):
    """Set up the Skelly switches for the config entry."""
    data = entry.runtime_data
    coordinator: SkellyCoordinator = data.coordinator
    device_info = get_device_info(hass, entry)
    profile = get_device_profile(entry)

    movement_switches = [
        SkellyMovementSwitch(
            coordinator,
            entry.entry_id,
            device_info,
            part=m["part"],
            bit_value=m["bit"],
        )
        for m in profile["movements"]
    ]

    color_cycle_switches = [
        SkellyColorCycleSwitch(
            coordinator,
            entry.entry_id,
            device_info,
            channel=light_cfg["channel"],
            label=light_cfg["label"],
        )
        for light_cfg in profile["lights"]
    ]

    async_add_entities(
        [
            SkellyConnectedSwitch(
                hass, coordinator, data.adapter, entry, device_info
            ),
            SkellyLiveModeSwitch(
                hass,
                coordinator,
                data.adapter,
                entry,
                device_info,
            ),
            *color_cycle_switches,
            *movement_switches,
            SkellyOverrideSwitch(
                coordinator,
                entry.entry_id,
                device_info,
                "override_chunk_size",
                "Override Chunk Size",
            ),
            SkellyOverrideSwitch(
                coordinator,
                entry.entry_id,
                device_info,
                "override_chunk_delay",
                "Override Chunk Delay",
            ),
            SkellyOverrideSwitch(
                coordinator,
                entry.entry_id,
                device_info,
                "override_bitrate",
                "Override Bitrate",
            ),
        ]
    )


class SkellyConnectedSwitch(SkellyEntity, SwitchEntity):
    """Main connection switch for the Skelly integration.

    Controls whether the integration maintains connections to both the BLE
    and classic Bluetooth devices. When turned off, disconnects both and
    pauses coordinator polling. State is persisted across HA restarts.
    """

    _attr_translation_key = "connected"

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: SkellyCoordinator,
        adapter,
        entry: ConfigEntry,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the connected switch."""
        super().__init__(entry.entry_id, device_info, "connected")
        self.hass = hass
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry = entry

        # Get initial state from config entry options, default to True (connected)
        self._is_on = entry.options.get("connected", True)

    @property
    def is_on(self) -> bool:
        """Return True if connection is enabled."""
        return self._is_on

    async def async_added_to_hass(self) -> None:
        """When entity is added, apply the initial connection state."""
        await super().async_added_to_hass()

        # If switch is off on startup, pause the coordinator
        if not self._is_on:
            self.coordinator.pause_updates()
            _LOGGER.debug("Connected switch is off - coordinator updates paused")

        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Turn on - connect to devices and resume coordinator polling."""
        _LOGGER.debug("Turning on Connected switch - connecting to devices")

        # Connect to BLE device. Returns right away without touching the
        # link if already connected, but still turns on automatic
        # reconnects, which an already-up link may not have yet (e.g. a
        # second turn-on while the first one restores live mode).
        failure = "Couldn't connect to the Skelly"
        if not await async_run_command(self.adapter.connect(), failure):
            raise HomeAssistantError(failure)

        self.coordinator.resume_updates()
        self._is_on = True
        _persist_entry_option(self.hass, self._entry, "connected", True)
        self.async_write_ha_state()

        _LOGGER.debug(
            "Connected switch turned on - devices connected and polling resumed"
        )

        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh(force_immediate=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Turn off - disconnect from devices and pause coordinator polling."""
        _LOGGER.debug("Turning off Connected switch - disconnecting from devices")

        # Pause coordinator updates first to stop polling
        self.coordinator.pause_updates()
        self.adapter.stop_auto_reconnect()

        # Both log a failure and go on: turning off always ends up off
        await self.adapter.disconnect_live_mode()
        await self.adapter.disconnect()

        self._is_on = False
        _persist_entry_option(self.hass, self._entry, "connected", False)
        self.async_write_ha_state()

        _LOGGER.debug(
            "Connected switch turned off - devices disconnected and polling paused"
        )

        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh(force_immediate=True)


class SkellyLiveModeSwitch(SkellyCoordinatorEntity, SwitchEntity):
    """Switch entity that connects/disconnects the Skelly classic (live) Bluetooth device."""

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: SkellyCoordinator,
        adapter,
        entry: SkellyConfigEntry,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the live-mode switch for this config entry."""
        super().__init__(
            coordinator, entry.entry_id, device_info, "live_mode", "Live Mode"
        )
        self.hass = hass
        self.adapter = adapter

    @property
    def is_on(self) -> bool:
        """Return True if live mode is connected, or wanted while BLE is down."""
        if self.adapter.live_mode_address is not None:
            return True
        if self.adapter.client.is_connected:
            return False
        return self.adapter.live_mode_should_connect

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to adapter updates."""
        await super().async_added_to_hass()
        self.adapter.register_live_mode_callback(self._handle_live_mode_change)
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Unregister adapter callbacks when entity is removed."""
        self.adapter.unregister_live_mode_callback(self._handle_live_mode_change)
        await super().async_will_remove_from_hass()

    async def async_turn_on(self, **kwargs) -> None:
        """Connect to the classic/live Bluetooth device exposed by the Skelly."""
        try:
            await async_turn_on_live_mode(self.adapter)
        finally:
            self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Disconnect the classic/live Bluetooth device."""
        try:
            await async_run_command(
                self.adapter.async_turn_off_live_mode(raise_errors=True),
                "Couldn't disconnect live mode",
            )
            _LOGGER.info("Live mode disconnected")
        finally:
            self.async_write_ha_state()

    @callback
    def _handle_live_mode_change(self) -> None:
        """Handle live-mode connection state updates from the adapter."""
        self.async_write_ha_state()


class SkellyColorCycleSwitch(SkellyCoordinatorEntity, SwitchEntity):
    """Switch entity to enable/disable color cycling for a light channel."""

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
        label: str,
    ) -> None:
        """Initialize the color cycle switch for a light channel.

        label is the light's name (e.g. "Torso Light", "Lantern").
        """
        super().__init__(
            coordinator,
            entry_id,
            device_info,
            f"color_cycle_{channel}",
            f"{label} Color Cycle",
        )
        self.channel = channel

    @property
    def is_on(self) -> bool:
        """Return True if color cycle is enabled (color_cycle == 1)."""
        return self.light_data(self.channel).get("color_cycle") == 1

    async def _set_color_cycle(self, enable: bool) -> None:
        """Turn color cycling on or off, keeping the channel's color."""
        r, g, b = self.light_data(self.channel).get("rgb") or (255, 255, 255)
        color_cycle = 1 if enable else 0
        await self._async_command(
            self.coordinator.adapter.client.set_light_rgb(
                channel=self.channel, r=r, g=g, b=b, color_cycle=color_cycle
            ),
            f"Couldn't turn color cycling {'on' if enable else 'off'}",
            partial(
                self.coordinator.async_update_light,
                self.channel,
                color_cycle=color_cycle,
            ),
        )

    async def async_turn_on(self, **kwargs) -> None:
        """Enable color cycling by setting loop=1 in set_light_rgb."""
        await self._set_color_cycle(enable=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Disable color cycling by setting loop=0 in set_light_rgb."""
        await self._set_color_cycle(enable=False)


class SkellyMovementSwitch(SkellyCoordinatorEntity, SwitchEntity):
    """Switch entity to control movement for head, arm, torso, or all body parts."""

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        part: str,
        bit_value: int,
    ) -> None:
        """Initialize the movement switch for a body part.

        part is e.g. "head", "arm", "torso", "wrist" or "all"; bit_value is
        its bit in the movement action (255 means "all").
        """
        super().__init__(
            coordinator,
            entry_id,
            device_info,
            f"movement_{part}",
            f"Movement {part.capitalize()}",
        )
        self.part = part
        self._bit_value = bit_value

    @property
    def is_on(self) -> bool:
        """Return True if this body part's movement is enabled."""
        action = self.coordinator_data.get("action")
        if action is None:
            return False

        if self._bit_value == 255:
            # "All" is on only if action is exactly 255
            return action == 255

        # Individual part: check corresponding bit
        return bool(action & self._bit_value)

    async def _set_movement(self, enable: bool) -> None:
        """Turn movement for this body part on or off."""
        # The lock keeps switches toggled quickly from undoing each other
        async with self.coordinator.action_lock:
            current_action = self.coordinator_data.get("action") or 0

            if self._bit_value == 255:
                new_action = 255 if enable else 0
            elif enable:
                new_action = current_action | self._bit_value
            else:
                new_action = current_action & ~self._bit_value

            await async_run_command(
                self.coordinator.adapter.client.set_movement_action(new_action),
                f"Couldn't turn {self.part} movement {'on' if enable else 'off'}",
            )
            self.coordinator.async_update_data_optimistic("action", new_action)
            self.async_write_ha_state()

        # Outside the lock, which the poll takes too
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_turn_on(self, **kwargs) -> None:
        """Enable movement for this body part."""
        await self._set_movement(enable=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Disable movement for this body part."""
        await self._set_movement(enable=False)


class SkellyOverrideSwitch(SkellyCoordinatorEntity, SwitchEntity):
    """Switch to enable/disable a manual override for file transfers.

    Shared by the chunk size, chunk delay and bitrate override switches, which only
    differ in which coordinator data key and display name they use.
    """

    _attr_icon = "mdi:cog"

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        data_key: str,
        name: str,
    ) -> None:
        """Initialize the override switch."""
        super().__init__(coordinator, entry_id, device_info, data_key, name)
        self._data_key = data_key

    @property
    def is_on(self) -> bool:
        """Return True if override is enabled."""
        return bool(self.coordinator_data.get(self._data_key, False))

    async def async_turn_on(self, **kwargs) -> None:
        """Enable the override."""
        _LOGGER.debug("Enabling %s", self._data_key)
        self.coordinator.async_update_data_optimistic(self._data_key, True)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Disable the override."""
        _LOGGER.debug("Disabling %s", self._data_key)
        self.coordinator.async_update_data_optimistic(self._data_key, False)
        self.async_write_ha_state()
