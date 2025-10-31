"""Switch platform for controlling Skelly live/classic Bluetooth mode."""

from __future__ import annotations

import contextlib
import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly switches for the config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address

    async_add_entities(
        [
            SkellyConnectedSwitch(
                hass, coordinator, data.get("adapter"), entry, address
            ),
            SkellyLiveModeSwitch(
                coordinator, data.get("adapter"), entry.entry_id, address
            ),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, address, channel=0),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, address, channel=1),
            SkellyMovementSwitch(coordinator, entry.entry_id, address, part="head"),
            SkellyMovementSwitch(coordinator, entry.entry_id, address, part="arm"),
            SkellyMovementSwitch(coordinator, entry.entry_id, address, part="torso"),
            SkellyMovementSwitch(coordinator, entry.entry_id, address, part="all"),
        ]
    )


class SkellyConnectedSwitch(SwitchEntity):
    """Main connection switch for the Skelly integration.

    Controls whether the integration maintains connections to both the BLE
    and classic Bluetooth devices. When turned off, disconnects both and
    pauses coordinator polling. State is persisted across HA restarts.
    """

    _attr_has_entity_name = True

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: SkellyCoordinator,
        adapter,
        entry: ConfigEntry,
        address: str | None,
    ) -> None:
        """Initialize the connected switch."""
        self.hass = hass
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry = entry
        self._attr_translation_key = "connected"
        self._attr_unique_id = f"{entry.entry_id}_connected"
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

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
            _LOGGER.info("Connected switch is off - coordinator updates paused")

        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Turn on - connect to devices and resume coordinator polling."""
        _LOGGER.info("Turning on Connected switch - connecting to devices")

        try:
            # Connect to BLE device
            ok = await self.adapter.connect()
            if not ok:
                _LOGGER.error("Failed to connect to BLE device")
                return

            # Start notifications
            started = await self.adapter.start_notifications_with_retry()
            if not started:
                _LOGGER.warning("Failed to start BLE notifications")

            # Resume coordinator updates
            self.coordinator.resume_updates()

            # Trigger immediate refresh to get current state
            await self.coordinator.async_request_refresh()

            # Update and persist state
            self._is_on = True
            self.hass.config_entries.async_update_entry(
                self._entry, options={**self._entry.options, "connected": True}
            )
            self.async_write_ha_state()

            _LOGGER.info(
                "Connected switch turned on - devices connected and polling resumed"
            )

        except Exception:
            _LOGGER.exception("Failed to turn on Connected switch")

    async def async_turn_off(self, **kwargs) -> None:
        """Turn off - disconnect from devices and pause coordinator polling."""
        _LOGGER.info("Turning off Connected switch - disconnecting from devices")

        try:
            # Pause coordinator updates first to stop polling
            self.coordinator.pause_updates()

            # Disconnect classic BT if connected
            await self.adapter.disconnect_live_mode()

            # Disconnect BLE device
            await self.adapter.disconnect()

            # Update and persist state
            self._is_on = False
            self.hass.config_entries.async_update_entry(
                self._entry, options={**self._entry.options, "connected": False}
            )
            self.async_write_ha_state()

            _LOGGER.info(
                "Connected switch turned off - devices disconnected and polling paused"
            )

        except Exception:
            _LOGGER.exception("Failed to turn off Connected switch")


class SkellyLiveModeSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity that connects/disconnects the Skelly classic (live) Bluetooth device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        adapter,
        entry_id: str,
        address: str | None,
    ) -> None:
        """Initialize the live-mode switch for this config entry."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.adapter = adapter
        self._attr_name = "Live Mode"
        self._attr_unique_id = f"{entry_id}_live_mode"
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def available(self) -> bool:
        """The switch is available only after the coordinator has a successful update."""
        # coordinator.last_update_success is True after initial successful refresh
        return bool(getattr(self.coordinator, "last_update_success", False))

    @property
    def is_on(self) -> bool:
        """Return True if live-mode client is connected."""
        address = None
        with contextlib.suppress(Exception):
            address = self.coordinator.adapter.client.live_mode_client_address
        return address is not None

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to coordinator updates."""
        await super().async_added_to_hass()
        # ensure initial availability/state is written
        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Connect to the classic/live Bluetooth device exposed by the Skelly."""
        try:
            # Use the adapter-level helper so HA can use establish_connection
            result = await self.adapter.connect_live_mode()
            if result:
                _LOGGER.info("Live mode connected: %s", result)
                # Update state immediately
                self.async_write_ha_state()
            else:
                _LOGGER.warning("Live mode connection failed")
        except Exception:
            _LOGGER.exception("Failed to connect live mode")

    async def async_turn_off(self, **kwargs) -> None:
        """Disconnect the classic/live Bluetooth device."""
        try:
            await self.adapter.disconnect_live_mode()
            _LOGGER.info("Live mode disconnected")
            # Update state immediately
            self.async_write_ha_state()
        except Exception:
            _LOGGER.exception("Failed to disconnect live mode")


class SkellyColorCycleSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity to enable/disable color cycling for a light channel."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        channel: int,
    ) -> None:
        """Initialize the color cycle switch for a specific channel.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        address: str | None
            BLE address used for device grouping
        channel: int
            Light channel number (0 = Torso, 1 = Head)
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.channel = channel
        self._attr_name = "Torso Color Cycle" if channel == 0 else "Head Color Cycle"
        self._attr_unique_id = f"{entry_id}_color_cycle_{channel}"
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def available(self) -> bool:
        """The switch is available after coordinator has a successful update."""
        return bool(getattr(self.coordinator, "last_update_success", False))

    @property
    def is_on(self) -> bool:
        """Return True if color cycle is enabled (effect == 1)."""
        data = getattr(self.coordinator, "data", None)
        if data:
            lights = data.get("lights", [])
            if self.channel < len(lights):
                light_data = lights[self.channel]
                effect = light_data.get("effect")
                return effect == 1
        return False

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to coordinator updates."""
        await super().async_added_to_hass()
        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Enable color cycling by setting loop=1 in set_light_rgb."""
        try:
            # Get current RGB color from coordinator data
            data = getattr(self.coordinator, "data", None)
            r, g, b = 255, 255, 255  # default white
            if data:
                lights = data.get("lights", [])
                if self.channel < len(lights):
                    rgb = lights[self.channel].get("rgb")
                    if rgb:
                        r, g, b = rgb

            # Call set_light_rgb with loop=1 to enable color cycling
            await self.coordinator.adapter.client.set_light_rgb(
                channel=self.channel, r=r, g=g, b=b, loop=1
            )

            # Push optimistic value into coordinator cache
            new_data = dict(self.coordinator.data or {})
            lights = list(new_data.get("lights", [{}, {}]))
            if self.channel < len(lights):
                light_data = dict(lights[self.channel])
                light_data["effect"] = 1
                lights[self.channel] = light_data
                new_data["lights"] = lights
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(new_data)

            self.async_write_ha_state()

            # Request coordinator refresh
            with contextlib.suppress(Exception):
                await self.coordinator.async_request_refresh()
        except Exception:
            _LOGGER.exception(
                "Failed to enable color cycle for channel %d", self.channel
            )

    async def async_turn_off(self, **kwargs) -> None:
        """Disable color cycling by setting loop=0 in set_light_rgb."""
        try:
            # Get current RGB color from coordinator data
            data = getattr(self.coordinator, "data", None)
            r, g, b = 255, 255, 255  # default white
            if data:
                lights = data.get("lights", [])
                if self.channel < len(lights):
                    rgb = lights[self.channel].get("rgb")
                    if rgb:
                        r, g, b = rgb

            # Call set_light_rgb with loop=0 to disable color cycling
            await self.coordinator.adapter.client.set_light_rgb(
                channel=self.channel, r=r, g=g, b=b, loop=0
            )

            # Push optimistic value into coordinator cache
            new_data = dict(self.coordinator.data or {})
            lights = list(new_data.get("lights", [{}, {}]))
            if self.channel < len(lights):
                light_data = dict(lights[self.channel])
                light_data["effect"] = 0
                lights[self.channel] = light_data
                new_data["lights"] = lights
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(new_data)

            self.async_write_ha_state()

            # Request coordinator refresh
            with contextlib.suppress(Exception):
                await self.coordinator.async_request_refresh()
        except Exception:
            _LOGGER.exception(
                "Failed to disable color cycle for channel %d", self.channel
            )


class SkellyMovementSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity to control movement for head, arm, torso, or all body parts."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        part: str,
    ) -> None:
        """Initialize the movement switch for a specific body part.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        address: str | None
            BLE address used for device grouping
        part: str
            Body part: "head", "arm", "torso", or "all"
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.part = part
        part_display = part.capitalize()
        self._attr_name = f"Movement {part_display}"
        self._attr_unique_id = f"{entry_id}_movement_{part}"
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def available(self) -> bool:
        """The switch is available after coordinator has a successful update."""
        return bool(getattr(self.coordinator, "last_update_success", False))

    @property
    def is_on(self) -> bool:
        """Return True if this body part's movement is enabled.

        For individual parts (head/arm/torso), check if the corresponding bit is set.
        For "all", return True only if action == 255.
        """
        data = getattr(self.coordinator, "data", None)
        if not data:
            return False

        action = data.get("action")
        if action is None:
            return False

        if self.part == "all":
            # "All" is on only if action is exactly 255
            return action == 255

        # Individual part: check corresponding bit
        # bit 0 = head, bit 1 = arm, bit 2 = torso
        bit_map = {"head": 0, "arm": 1, "torso": 2}
        bit = bit_map.get(self.part)
        if bit is None:
            return False

        return bool(action & (1 << bit))

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to coordinator updates."""
        await super().async_added_to_hass()
        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Enable movement for this body part."""
        try:
            # Use lock to prevent race conditions when multiple switches are toggled quickly
            async with self.coordinator.action_lock:
                # Get current action from coordinator
                data = getattr(self.coordinator, "data", None)
                current_action = data.get("action", 0) if data else 0

                if self.part == "all":
                    # Turning on "all" always sends 255
                    new_action = 255
                else:
                    # Set the bit for this part
                    bit_map = {"head": 0, "arm": 1, "torso": 2}
                    bit = bit_map.get(self.part)
                    if bit is None:
                        return

                    new_action = current_action | (1 << bit)

                    # Check if all three individual parts are now on
                    # If so, send 255 instead
                    if (new_action & 0b111) == 0b111:  # all three bits set
                        new_action = 255

                # Send the command
                await self.coordinator.adapter.client.set_action(new_action)

                # Push optimistic value into coordinator cache
                new_data = dict(self.coordinator.data or {})
                new_data["action"] = new_action
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(new_data)

                self.async_write_ha_state()

            # Request coordinator refresh (outside lock to avoid blocking)
            with contextlib.suppress(Exception):
                await self.coordinator.async_request_refresh()
        except Exception:
            _LOGGER.exception("Failed to enable movement for %s", self.part)

    async def async_turn_off(self, **kwargs) -> None:
        """Disable movement for this body part."""
        try:
            # Use lock to prevent race conditions when multiple switches are toggled quickly
            async with self.coordinator.action_lock:
                # Get current action from coordinator
                data = getattr(self.coordinator, "data", None)
                current_action = data.get("action", 0) if data else 0

                if self.part == "all":
                    # Turning off "all" clears all bits
                    new_action = 0
                else:
                    # Clear the bit for this part
                    bit_map = {"head": 0, "arm": 1, "torso": 2}
                    bit = bit_map.get(self.part)
                    if bit is None:
                        return

                    new_action = current_action & ~(1 << bit)

                    # If current action was 255 (all enabled), turning off one part
                    # means we need to clear that specific bit from 0b111
                    if current_action == 255:
                        new_action = 0b111 & ~(1 << bit)

                # Send the command
                await self.coordinator.adapter.client.set_action(new_action)

                # Push optimistic value into coordinator cache
                new_data = dict(self.coordinator.data or {})
                new_data["action"] = new_action
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(new_data)

                self.async_write_ha_state()

            # Request coordinator refresh (outside lock to avoid blocking)
            with contextlib.suppress(Exception):
                await self.coordinator.async_request_refresh()
        except Exception:
            _LOGGER.exception("Failed to disable movement for %s", self.part)
