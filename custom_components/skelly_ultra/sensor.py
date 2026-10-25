"""Sensor platform for Skelly Ultra."""

from __future__ import annotations

from datetime import timedelta

import logging

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    SIGNAL_STRENGTH_DECIBELS,
    SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
    EntityCategory,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info

_LOGGER = logging.getLogger(__name__)


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
            SkellyLiveBTMacSensor(coordinator, entry.entry_id, device_info),
            SkellyPinCodeSensor(coordinator, entry.entry_id, device_info),
            transfer_sensor,
        ]
    )

    # The REST server reads link quality from its own adapters, so the BLE
    # link is only covered in proxy mode. Live mode always goes through it.
    rssi_sensors: list[SensorEntity] = [
        SkellyLiveModeSignalSensor(coordinator, entry.entry_id, device_info)
    ]
    if coordinator.adapter.client.use_ble_proxy:
        rssi_sensors.append(
            SkellyBLESignalSensor(coordinator, entry.entry_id, device_info)
        )
    async_add_entities(rssi_sensors)


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
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the Live BT MAC sensor."""
        self.adapter = coordinator.adapter
        self._attr_name = "Live BT MAC"
        self._attr_unique_id = f"{entry_id}_live_bt_mac"
        self._attr_device_info = device_info

    @property
    def native_value(self):
        """Return the Live Mode BT MAC address or '<not connected>'."""
        client = getattr(self.adapter, "client", None)
        mac = getattr(client, "live_mode_client_address", None) if client else None
        return mac if mac else "<not connected>"


class _SkellyLinkSignalSensor(SensorEntity):
    """Base for sensors polling a link's RSSI from the REST server."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.SIGNAL_STRENGTH
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _transport: str  # "le" or "bredr", as reported by the server

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the link signal sensor."""
        self.adapter = coordinator.adapter
        self._attr_device_info = device_info
        self._error_logged = False

    def _link_address(self) -> str | None:
        """Return the MAC address of the link, or None while not connected."""
        raise NotImplementedError

    async def async_update(self) -> None:
        """Poll the REST server for the link's RSSI."""
        address = self._link_address()
        if not address:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {}
            self._attr_available = True
            return

        try:
            links = await self.adapter.client.get_link_quality(address)
        except Exception as err:  # noqa: BLE001 - any server failure
            if not self._error_logged:
                self._error_logged = True
                _LOGGER.warning(
                    "Could not read %s from REST server: %s", self.name, err
                )
            self._attr_available = False
            return

        self._error_logged = False
        self._attr_available = True
        link = next(
            (ln for ln in links if ln.get("transport") == self._transport), None
        )
        if link is None:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {}
            return
        self._attr_native_value = link.get("rssi")
        self._attr_extra_state_attributes = {
            "adapter": link.get("adapter"),
            "tx_power": link.get("tx_power"),
            "max_tx_power": link.get("max_tx_power"),
        }


class SkellyBLESignalSensor(_SkellyLinkSignalSensor):
    """RSSI of the REST server's BLE link to the Skelly (proxy mode)."""

    _transport = "le"
    _attr_native_unit_of_measurement = SIGNAL_STRENGTH_DECIBELS_MILLIWATT

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the BLE signal sensor."""
        super().__init__(coordinator, entry_id, device_info)
        self._attr_name = "BLE Signal Strength"
        self._attr_unique_id = f"{entry_id}_ble_rssi"

    def _link_address(self) -> str | None:
        client = self.adapter.client
        return client.address if client.is_connected else None


class SkellyLiveModeSignalSensor(_SkellyLinkSignalSensor):
    """RSSI of the live-mode Bluetooth Classic link.

    Controllers report classic RSSI relative to their golden receive power
    range (0 = inside the range, negative = too weak) rather than in dBm.
    """

    _transport = "bredr"
    _attr_native_unit_of_measurement = SIGNAL_STRENGTH_DECIBELS

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the live mode signal sensor."""
        super().__init__(coordinator, entry_id, device_info)
        self._attr_name = "Live Mode Signal Strength"
        self._attr_unique_id = f"{entry_id}_live_mode_rssi"

    def _link_address(self) -> str | None:
        return self.adapter.client.live_mode_client_address


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
