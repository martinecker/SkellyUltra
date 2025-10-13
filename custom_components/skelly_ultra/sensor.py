"""Sensor platform for Skelly Ultra."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .coordinator import SkellyCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    data = hass.data["skelly_ultra"][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    async_add_entities([
        SkellyVolumeSensor(coordinator),
        SkellyLiveNameSensor(coordinator),
    ])


class SkellyVolumeSensor(SensorEntity):
    def __init__(self, coordinator: SkellyCoordinator) -> None:
        self.coordinator = coordinator
        self._attr_name = "Skelly Volume"

    @property
    def native_value(self):
        return self.coordinator.data.get("volume")


class SkellyLiveNameSensor(SensorEntity):
    def __init__(self, coordinator: SkellyCoordinator) -> None:
        self.coordinator = coordinator
        self._attr_name = "Skelly Live Name"

    @property
    def native_value(self):
        return self.coordinator.data.get("live_name")
