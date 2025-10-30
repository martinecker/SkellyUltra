"""Sensor platform for Skelly Ultra."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Set up Skelly sensors for a config entry."""
    data = hass.data["skelly_ultra"][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    adapter = data.get("adapter")
    address = entry.data.get(CONF_ADDRESS) or adapter.address
    # Prefer the config entry title if provided, otherwise build a default
    # name using the BLE address so the device shows up with a friendly name
    device_name = entry.title or (
        f"Skelly Ultra {address}" if address else "Skelly Ultra"
    )

    async_add_entities(
        [
            SkellyVolumeSensor(coordinator, entry.entry_id, address, device_name),
            SkellyLiveNameSensor(coordinator, entry.entry_id, address, device_name),
            SkellyStorageCapacitySensor(
                coordinator, entry.entry_id, address, device_name
            ),
            SkellySoundCountSensor(coordinator, entry.entry_id, address, device_name),
            SkellyFileOrderSensor(coordinator, entry.entry_id, address, device_name),
            SkellyLiveBTMacSensor(adapter, entry.entry_id, address, device_name),
        ]
    )


class SkellyVolumeSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device volume as an integer percentage."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the volume sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Volume"
        self._attr_unique_id = f"{entry_id}_volume"
        # Volume is expressed as a percentage (0-100)
        self._attr_native_unit_of_measurement = "%"
        # Device grouping
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the current volume (0-100) from coordinator data."""
        return self.coordinator.data.get("volume")


class SkellyLiveNameSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device 'live name' as text."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the live name sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Live Name"
        self._attr_unique_id = f"{entry_id}_live_name"
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the current live name from coordinator data."""
        return self.coordinator.data.get("live_name")


class SkellyStorageCapacitySensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device storage capacity in kilobytes."""

    _attr_has_entity_name = True
    _attr_native_unit_of_measurement = "kB"

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the storage capacity sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Storage Capacity"
        self._attr_unique_id = f"{entry_id}_capacity_kb"
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the storage capacity in kilobytes from coordinator data."""
        return self.coordinator.data.get("capacity_kb")


class SkellySoundCountSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the number of sound files on the device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the sound count sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Sound Count"
        self._attr_unique_id = f"{entry_id}_sound_count"
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the file count from coordinator data."""
        return self.coordinator.data.get("file_count")


class SkellyFileOrderSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the file playback order as a list string."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the file order sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "File Order"
        self._attr_unique_id = f"{entry_id}_file_order"
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the file order list as a string representation."""
        file_order = self.coordinator.data.get("file_order", [])
        return str(file_order)


class SkellyLiveBTMacSensor(SensorEntity):
    """Sensor exposing the Live Mode Bluetooth Classic MAC address."""

    _attr_has_entity_name = True

    def __init__(
        self,
        adapter,
        entry_id: str,
        address: str | None,
        device_name: str | None = None,
    ) -> None:
        """Initialize the Live BT MAC sensor."""
        self.adapter = adapter
        self._attr_name = "Live BT MAC"
        self._attr_unique_id = f"{entry_id}_live_bt_mac"
        if address:
            self._attr_device_info = DeviceInfo(
                name=device_name, identifiers={(DOMAIN, address)}
            )

    @property
    def native_value(self):
        """Return the Live Mode BT MAC address or '<not connected>'."""
        mac = self.adapter.client.live_mode_client_address
        return mac if mac else "<not connected>"
