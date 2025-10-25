"""Number platform for Skelly Ultra volume control."""

from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import PERCENTAGE
from homeassistant.helpers.device_registry import DeviceInfo
import contextlib

from . import DOMAIN
from .coordinator import SkellyCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the volume number entity from a config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get("address") or data.get("adapter").address

    async_add_entities([SkellyVolumeNumber(coordinator, entry.entry_id, address)])


class SkellyVolumeNumber(CoordinatorEntity, NumberEntity):
    """Number entity representing the Skelly volume (0-100%)."""

    _attr_has_entity_name = True

    def __init__(
        self, coordinator: SkellyCoordinator, entry_id: str, address: str | None
    ) -> None:
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Volume"
        self._attr_unique_id = f"{entry_id}_volume_number"
        self._attr_native_min_value = 0
        self._attr_native_max_value = 100
        self._attr_native_step = 1
        self._attr_native_unit_of_measurement = PERCENTAGE
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def native_value(self) -> int | None:
        """Return the current volume from the coordinator cache.

        Returns:
            int | None: The current volume in percent, or None if unknown.
        """
        data = getattr(self.coordinator, "data", None)
        if data and (vol := data.get("volume")) is not None:
            try:
                return int(vol)
            except (ValueError, TypeError):
                return None

        return None

    async def async_set_native_value(self, value: int) -> None:
        """Set the volume on the device via the client and update optimistically.

        Parameters
        ----------
        value : int
            Volume percentage (0-100)
        """
        # Attempt to set the volume on the device. If it fails, do not update
        # the optimistic value.
        try:
            await self.coordinator.adapter.client.set_volume(int(value))
        except Exception:
            # Setting failed; do not change optimistic state
            return

        # Push optimistic value into coordinator cache so all entities
        # driven by the coordinator update instantly reflect the change.
        new_data = dict(self.coordinator.data or {})
        new_data["volume"] = int(value)
        # Update coordinator cache and notify listeners
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)

        # UI will be updated via coordinator cache update above; write state
        # locally as well to ensure immediate HA entity update
        self.async_write_ha_state()

        # Request an immediate coordinator refresh so we get authoritative state
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()
