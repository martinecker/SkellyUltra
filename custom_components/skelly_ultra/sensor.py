"""Sensor platform for Skelly Ultra."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .coordinator import SkellyCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up Skelly sensors for a config entry."""
    data = hass.data["skelly_ultra"][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    async_add_entities(
        [
            SkellyVolumeSensor(coordinator, entry.entry_id),
            SkellyLiveNameSensor(coordinator, entry.entry_id),
        ]
    )


class SkellyVolumeSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device volume as an integer percentage."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: SkellyCoordinator, entry_id: str) -> None:
        """Initialize the volume sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Skelly Volume"
        self._attr_unique_id = f"{entry_id}_volume"

    @property
    def native_value(self):
        """Return the current volume (0-100) from coordinator data."""
        return self.coordinator.data.get("volume")


class SkellyLiveNameSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device 'live name' as text."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: SkellyCoordinator, entry_id: str) -> None:
        """Initialize the live name sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Skelly Live Name"
        self._attr_unique_id = f"{entry_id}_live_name"

    @property
    def native_value(self):
        """Return the current live name from coordinator data."""
        return self.coordinator.data.get("live_name")
