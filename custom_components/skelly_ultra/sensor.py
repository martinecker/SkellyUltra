"""Sensor platform for Skelly Ultra."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Set up Skelly sensors for a config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    # Create and store the file transfer progress sensor for service callbacks
    transfer_sensor = SkellyFileTransferProgressSensor(
        hass, entry.entry_id, device_info
    )

    # Store sensor reference in hass.data for service access
    hass.data[DOMAIN][entry.entry_id]["transfer_sensor"] = transfer_sensor

    async_add_entities(
        [
            SkellyVolumeSensor(coordinator, entry.entry_id, device_info),
            SkellyLiveNameSensor(coordinator, entry.entry_id, device_info),
            SkellyStorageCapacitySensor(coordinator, entry.entry_id, device_info),
            SkellyFileCountReportedSensor(coordinator, entry.entry_id, device_info),
            SkellyFileCountReceivedSensor(coordinator, entry.entry_id, device_info),
            SkellyFileOrderSensor(coordinator, entry.entry_id, device_info),
            SkellyLiveBTMacSensor(adapter, entry.entry_id, device_info),
            SkellyPinCodeSensor(coordinator, entry.entry_id, device_info),
            transfer_sensor,
        ]
    )


class SkellyVolumeSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device volume as an integer percentage."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the volume sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Volume"
        self._attr_unique_id = f"{entry_id}_volume"
        # Volume is expressed as a percentage (0-100)
        self._attr_native_unit_of_measurement = "%"
        # Device grouping
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the current volume (0-100) from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("volume")


class SkellyLiveNameSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device 'live name' as text."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the live name sensor with coordinator."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Live Name"
        self._attr_unique_id = f"{entry_id}_live_name"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the current live name from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("live_name")


class SkellyStorageCapacitySensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the remaining device storage capacity in kilobytes."""

    _attr_has_entity_name = True
    _attr_native_unit_of_measurement = "kB"

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the storage capacity sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Remaining Capacity"
        self._attr_unique_id = f"{entry_id}_capacity_kb"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the remaining storage capacity in kilobytes from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("capacity_kb")


class SkellyFileCountReportedSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the number of files reported by the device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the file count reported sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "File Count Reported"
        self._attr_unique_id = f"{entry_id}_file_count_reported"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the file count reported from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("file_count_reported")


class SkellyFileCountReceivedSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the number of files actually received from the device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the file count received sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "File Count Received"
        self._attr_unique_id = f"{entry_id}_file_count_received"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the file count received from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("file_count_received")


class SkellyFileOrderSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the file playback order as a list string."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the file order sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "File Order"
        self._attr_unique_id = f"{entry_id}_file_order"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the file order list as a string representation."""
        if self.coordinator.data is None:
            return None
        file_order = self.coordinator.data.get("file_order", [])
        return str(file_order)


class SkellyLiveBTMacSensor(SensorEntity):
    """Sensor exposing the Live Mode Bluetooth Classic MAC address."""

    _attr_has_entity_name = True

    def __init__(
        self,
        adapter,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the Live BT MAC sensor."""
        self.adapter = adapter
        self._attr_name = "Live BT MAC"
        self._attr_unique_id = f"{entry_id}_live_bt_mac"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the Live Mode BT MAC address or '<not connected>'."""
        mac = self.adapter.client.live_mode_client_address
        return mac if mac else "<not connected>"


class SkellyPinCodeSensor(CoordinatorEntity, SensorEntity):
    """Sensor exposing the device Bluetooth pairing PIN code."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the PIN code sensor."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "PIN Code"
        self._attr_unique_id = f"{entry_id}_pin_code"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the device PIN code from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("pin_code")


class SkellyFileTransferProgressSensor(SensorEntity):
    """Sensor showing file transfer progress, errors, and cancellation status."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the file transfer progress sensor."""
        self.hass = hass
        self._attr_name = "File Transfer Progress"
        self._attr_unique_id = f"{entry_id}_file_transfer_progress"
        self._attr_native_value = "Idle"
        self._cancel_timer = None
        self._attr_device_info = device_info

    @callback
    def update_progress(self, sent_chunks: int, total_chunks: int) -> None:
        """Update progress during file transfer."""
        if total_chunks == 0:
            percentage = 0
        else:
            percentage = int((sent_chunks / total_chunks) * 100)

        self._attr_native_value = f"Uploading: {percentage}%"
        self.async_write_ha_state()

    @callback
    def set_error(self, error_message: str) -> None:
        """Set error message and schedule return to idle."""
        self._attr_native_value = f"Error: {error_message}"
        self.async_write_ha_state()
        self._schedule_idle_return()

    @callback
    def set_cancelled(self) -> None:
        """Set cancelled status and schedule return to idle."""
        self._attr_native_value = "Cancelled"
        self.async_write_ha_state()
        self._schedule_idle_return()

    @callback
    def set_complete(self) -> None:
        """Set complete status and return to idle immediately."""
        self._attr_native_value = "Complete"
        self.async_write_ha_state()
        # Return to idle after a short delay
        self._schedule_idle_return(delay=5)

    @callback
    def set_idle(self) -> None:
        """Set idle status."""
        self._cancel_idle_timer()
        self._attr_native_value = "Idle"
        self.async_write_ha_state()

    def _schedule_idle_return(self, delay: int = 60) -> None:
        """Schedule return to idle state after delay (in seconds)."""
        self._cancel_idle_timer()
        self._cancel_timer = async_call_later(
            self.hass, timedelta(seconds=delay), self._return_to_idle
        )

    @callback
    def _return_to_idle(self, _now) -> None:
        """Return to idle state (callback for timer)."""
        self._cancel_timer = None
        self.set_idle()

    def _cancel_idle_timer(self) -> None:
        """Cancel any pending idle timer."""
        if self._cancel_timer:
            self._cancel_timer()
            self._cancel_timer = None
