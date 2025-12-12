"""Switch platform for controlling Skelly live/classic Bluetooth mode."""

from __future__ import annotations

import contextlib
import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly switches for the config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [
            SkellyConnectedSwitch(
                hass, coordinator, data.get("adapter"), entry, device_info
            ),
            SkellyLiveModeSwitch(
                hass,
                coordinator,
                data.get("adapter"),
                entry,
                device_info,
            ),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, device_info, channel=0),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, device_info, channel=1),
            SkellyMovementSwitch(coordinator, entry.entry_id, device_info, part="head"),
            SkellyMovementSwitch(coordinator, entry.entry_id, device_info, part="arm"),
            SkellyMovementSwitch(
                coordinator, entry.entry_id, device_info, part="torso"
            ),
            SkellyMovementSwitch(coordinator, entry.entry_id, device_info, part="all"),
            SkellyOverrideChunkSizeSwitch(coordinator, entry.entry_id, device_info),
            SkellyOverrideBitrateSwitch(coordinator, entry.entry_id, device_info),
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
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the connected switch."""
        self.hass = hass
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry = entry
        self._attr_translation_key = "connected"
        self._attr_unique_id = f"{entry.entry_id}_connected"
        self._attr_device_info = device_info

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

        try:
            # Connect to BLE device
            ok = await self.adapter.connect()
            if not ok:
                _LOGGER.error("Failed to connect to BLE device")
                return

            # Resume coordinator updates
            self.coordinator.resume_updates()

            # Update and persist state
            self._is_on = True
            self.hass.config_entries.async_update_entry(
                self._entry, options={**self._entry.options, "connected": True}
            )
            self.async_write_ha_state()

            _LOGGER.debug(
                "Connected switch turned on - devices connected and polling resumed"
            )

            await self.coordinator.async_request_refresh(force_immediate=True)

        except Exception:
            _LOGGER.exception("Failed to turn on Connected switch")

    async def async_turn_off(self, **kwargs) -> None:
        """Turn off - disconnect from devices and pause coordinator polling."""
        _LOGGER.debug("Turning off Connected switch - disconnecting from devices")

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

            _LOGGER.debug(
                "Connected switch turned off - devices disconnected and polling paused"
            )

            await self.coordinator.async_request_refresh(force_immediate=True)

        except Exception:
            _LOGGER.exception("Failed to turn off Connected switch")


class SkellyLiveModeSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity that connects/disconnects the Skelly classic (live) Bluetooth device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: SkellyCoordinator,
        adapter,
        entry: ConfigEntry,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the live-mode switch for this config entry."""
        super().__init__(coordinator)
        self.hass = hass
        self.coordinator = coordinator
        self.adapter = adapter
        self._entry = entry
        self._attr_name = "Live Mode"
        self._attr_unique_id = f"{entry.entry_id}_live_mode"
        self._attr_device_info = device_info
        self._desired_live_mode_on = entry.options.get("live_mode_connected", False)

    @property
    def available(self) -> bool:
        """The switch is available only after the coordinator has a successful update."""
        return bool(getattr(self.coordinator, "last_update_success", False))

    @property
    def is_on(self) -> bool:
        """Return True if live-mode client is connected or should be restored."""
        actual_state: bool | None = None
        if self.adapter:
            with contextlib.suppress(Exception):
                address = self.adapter.client.live_mode_client_address
                if address is not None:
                    actual_state = True
                elif getattr(self.adapter.client, "is_connected", False):
                    actual_state = False

        if actual_state is None:
            return self._desired_live_mode_on
        return actual_state

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to adapter updates."""
        await super().async_added_to_hass()
        if self.adapter:
            self.adapter.register_live_mode_callback(self._handle_live_mode_change)
            self.adapter.set_live_mode_preference(self._desired_live_mode_on)
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Unregister adapter callbacks when entity is removed."""
        if self.adapter:
            self.adapter.unregister_live_mode_callback(self._handle_live_mode_change)
        await super().async_will_remove_from_hass()

    async def async_turn_on(self, **kwargs) -> None:
        """Connect to the classic/live Bluetooth device exposed by the Skelly."""
        if not self.adapter:
            _LOGGER.warning("Live mode adapter not available")
            return

        try:
            self._desired_live_mode_on = True
            self.adapter.set_live_mode_preference(True)
            self._persist_desired_state()
            result = await self.adapter.connect_live_mode()
            if result:
                _LOGGER.info("Live mode connected: %s", result)
            else:
                _LOGGER.warning("Live mode connection failed")
        except Exception:
            _LOGGER.exception("Failed to connect live mode")
        finally:
            self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Disconnect the classic/live Bluetooth device."""
        if not self.adapter:
            _LOGGER.warning("Live mode adapter not available")
            return

        try:
            self._desired_live_mode_on = False
            self.adapter.set_live_mode_preference(False)
            self._persist_desired_state()

            await self.adapter.disconnect_live_mode()
            _LOGGER.info("Live mode disconnected")
        except Exception:
            _LOGGER.exception("Failed to disconnect live mode")
        finally:
            self.async_write_ha_state()

    def _persist_desired_state(self) -> None:
        """Persist the last requested live-mode state in the config entry."""
        options = {
            **self._entry.options,
            "live_mode_connected": self._desired_live_mode_on,
        }
        self.hass.config_entries.async_update_entry(self._entry, options=options)

    @callback
    def _handle_live_mode_change(self) -> None:
        """Handle live-mode connection state updates from the adapter."""
        if not self.adapter:
            return

        self.async_write_ha_state()


class SkellyColorCycleSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity to enable/disable color cycling for a light channel."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
    ) -> None:
        """Initialize the color cycle switch for a specific channel.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        device_info: DeviceInfo | None
            Device registry info for grouping entities
        channel: int
            Light channel number (0 = Torso, 1 = Head)
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.channel = channel
        self._attr_name = "Torso Color Cycle" if channel == 0 else "Head Color Cycle"
        self._attr_unique_id = f"{entry_id}_color_cycle_{channel}"
        self._attr_device_info = device_info

    @property
    def available(self) -> bool:
        """The switch is available after coordinator has a successful update."""
        return bool(getattr(self.coordinator, "last_update_success", False))

    @property
    def is_on(self) -> bool:
        """Return True if color cycle is enabled (color_cycle == 1)."""
        data = getattr(self.coordinator, "data", None)
        if data:
            lights = data.get("lights", [])
            if self.channel < len(lights):
                light_data = lights[self.channel]
                color_cycle = light_data.get("color_cycle")
                return color_cycle == 1
        return False

    async def async_added_to_hass(self) -> None:
        """When entity is added, subscribe to coordinator updates."""
        await super().async_added_to_hass()
        self.async_write_ha_state()

    async def _set_color_cycle(self, enable: bool) -> None:
        """Set color cycle state for this channel.

        Parameters
        ----------
        enable: bool
            True to enable color cycling (color_cycle=1), False to disable (color_cycle=0)
        """
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

            # Call set_light_rgb with color_cycle=1 to enable, color_cycle=0 to disable
            color_cycle_value = 1 if enable else 0
            await self.coordinator.adapter.client.set_light_rgb(
                channel=self.channel, r=r, g=g, b=b, color_cycle=color_cycle_value
            )

            # Push optimistic value into coordinator cache
            new_data = dict(self.coordinator.data or {})
            lights = list(new_data.get("lights", [{}, {}]))
            if self.channel < len(lights):
                light_data = dict(lights[self.channel])
                light_data["color_cycle"] = color_cycle_value
                lights[self.channel] = light_data
                new_data["lights"] = lights
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(new_data)

            self.async_write_ha_state()

            # Request coordinator refresh
            with contextlib.suppress(Exception):
                await self.coordinator.async_request_refresh()
        except Exception:
            action = "enable" if enable else "disable"
            _LOGGER.exception(
                "Failed to %s color cycle for channel %d", action, self.channel
            )

    async def async_turn_on(self, **kwargs) -> None:
        """Enable color cycling by setting loop=1 in set_light_rgb."""
        await self._set_color_cycle(enable=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Disable color cycling by setting loop=0 in set_light_rgb."""
        await self._set_color_cycle(enable=False)


class SkellyMovementSwitch(CoordinatorEntity, SwitchEntity):
    """Switch entity to control movement for head, arm, torso, or all body parts."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        part: str,
    ) -> None:
        """Initialize the movement switch for a specific body part.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        device_info: DeviceInfo | None
            Device registry info for grouping entities
        part: str
            Body part: "head", "arm", "torso", or "all"
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.part = part
        part_display = part.capitalize()
        self._attr_name = f"Movement {part_display}"
        self._attr_unique_id = f"{entry_id}_movement_{part}"
        self._attr_device_info = device_info

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

    async def _set_movement(self, enable: bool) -> None:
        """Set movement state for this body part.

        Parameters
        ----------
        enable: bool
            True to enable movement, False to disable
        """
        try:
            # Use lock to prevent race conditions when multiple switches are toggled quickly
            async with self.coordinator.action_lock:
                # Get current action from coordinator
                data = getattr(self.coordinator, "data", None)
                current_action = data.get("action", 0) if data else 0

                if self.part == "all":
                    # "All" is 255 when enabling, 0 when disabling
                    new_action = 255 if enable else 0
                else:
                    # Get the bit for this part
                    bit_map = {"head": 0, "arm": 1, "torso": 2}
                    bit = bit_map.get(self.part)
                    if bit is None:
                        return

                    if enable:
                        # Set the bit for this part
                        new_action = current_action | (1 << bit)

                        # Check if all three individual parts are now on
                        # If so, send 255 instead
                        if (new_action & 0b111) == 0b111:  # all three bits set
                            new_action = 255
                    else:
                        # Clear the bit for this part
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
            action = "enable" if enable else "disable"
            _LOGGER.exception("Failed to %s movement for %s", action, self.part)

    async def async_turn_on(self, **kwargs) -> None:
        """Enable movement for this body part."""
        await self._set_movement(enable=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Disable movement for this body part."""
        await self._set_movement(enable=False)


class SkellyOverrideChunkSizeSwitch(CoordinatorEntity, SwitchEntity):
    """Switch to enable/disable manual chunk size override for file transfers."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the override chunk size switch."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Override Chunk Size"
        self._attr_unique_id = f"{entry_id}_override_chunk_size"
        self._attr_icon = "mdi:cog"
        self._attr_device_info = device_info

    @property
    def is_on(self) -> bool:
        """Return True if override is enabled."""
        return (
            self.coordinator.data.get("override_chunk_size", False)
            if self.coordinator.data
            else False
        )

    async def async_turn_on(self, **kwargs) -> None:
        """Enable chunk size override."""
        _LOGGER.debug("Enabling chunk size override")
        new_data = dict(self.coordinator.data or {})
        new_data["override_chunk_size"] = True
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Disable chunk size override."""
        _LOGGER.debug("Disabling chunk size override")
        new_data = dict(self.coordinator.data or {})
        new_data["override_chunk_size"] = False
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)
        self.async_write_ha_state()


class SkellyOverrideBitrateSwitch(CoordinatorEntity, SwitchEntity):
    """Switch to enable/disable manual bitrate override for file transfers."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the override bitrate switch."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Override Bitrate"
        self._attr_unique_id = f"{entry_id}_override_bitrate"
        self._attr_icon = "mdi:cog"
        self._attr_device_info = device_info

    @property
    def is_on(self) -> bool:
        """Return True if override is enabled."""
        return (
            self.coordinator.data.get("override_bitrate", False)
            if self.coordinator.data
            else False
        )

    async def async_turn_on(self, **kwargs) -> None:
        """Enable bitrate override."""
        _LOGGER.debug("Enabling bitrate override")
        new_data = dict(self.coordinator.data or {})
        new_data["override_bitrate"] = True
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Disable bitrate override."""
        _LOGGER.debug("Disabling bitrate override")
        new_data = dict(self.coordinator.data or {})
        new_data["override_bitrate"] = False
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)
        self.async_write_ha_state()
