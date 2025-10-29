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
    """Set up the Skelly live-mode switch for the config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address

    async_add_entities(
        [
            SkellyLiveModeSwitch(
                coordinator, data.get("adapter"), entry.entry_id, address
            )
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
