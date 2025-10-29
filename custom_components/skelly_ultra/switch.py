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
            SkellyLiveModeSwitch(
                coordinator, data.get("adapter"), entry.entry_id, address
            ),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, address, channel=0),
            SkellyColorCycleSwitch(coordinator, entry.entry_id, address, channel=1),
        ]
    )


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
