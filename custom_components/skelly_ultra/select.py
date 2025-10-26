"""Select platform for Skelly Ultra eye icon selection."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.const import CONF_ADDRESS
import contextlib

from . import DOMAIN
from .coordinator import SkellyCoordinator


EYE_ICONS = [
    "1 Blue Eyeball",
    "2 Yellow Eyeball",
    "3 Green Eyeball",
    "4 Orange Eyeball",
    "5 Red Eyeball",
    "6 Gray Eyeball",
    "7 Yellow Dragon",
    "8 Red Dragon",
    "9 Color Spiral",
    "10 Fire",
    "11 Star",
    "12 Crossbones",
    "13 Fireworks",
    "14 USA Flag",
    "15 Heart",
    "16 Shamrock",
    "17 Snowflake",
    "18 Confetti",
]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly eye icon select entity."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address

    async_add_entities([SkellyEyeIconSelect(coordinator, entry.entry_id, address)])


class SkellyEyeIconSelect(CoordinatorEntity, SelectEntity):
    """Select entity to set the skelly eye icon."""

    _attr_has_entity_name = True

    def __init__(
        self, coordinator: SkellyCoordinator, entry_id: str, address: str | None
    ) -> None:
        """Initialize the eye icon select entity.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        address: str | None
            BLE address used for device grouping
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Eye Icon"
        self._attr_unique_id = f"{entry_id}_eye_icon"
        self._options = EYE_ICONS
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def options(self) -> list[str]:
        """Return the available eye icon options."""
        return self._options

    @property
    def current_option(self) -> str | None:
        """Return the currently selected option, if any."""
        # Return authoritative coordinator data (updated by coordinator polling)
        data = getattr(self.coordinator, "data", None)
        if data:
            eye = data.get("eye_icon")
            if isinstance(eye, int) and 1 <= eye <= len(self._options):
                return self._options[eye - 1]
        return None

    async def async_select_option(self, option: str) -> None:
        """Handle when an option is selected in the UI.

        Parses the leading integer from the option label and sends it to
        the device via the adapter client.
        """
        # Parse the leading integer index from the option string
        index_str = option.split(" ", 1)[0]
        try:
            icon_index = int(index_str)
        except ValueError:
            return

        # Send command to device via adapter client
        try:
            await self.coordinator.adapter.client.set_eye_icon(icon_index)
        except Exception:  # device/IO errors surfaced here
            return

        # Push optimistic value into the coordinator cache so other
        # CoordinatorEntity consumers see the update immediately, then
        # request a refresh to get authoritative state from the device.
        new_data = dict(self.coordinator.data or {})
        new_data["eye_icon"] = icon_index
        with contextlib.suppress(Exception):
            # update cache and notify listeners; do not immediately refresh
            # the coordinator to avoid overwriting the optimistic value.
            self.coordinator.async_set_updated_data(new_data)

        self.async_write_ha_state()

        # Request an immediate coordinator refresh so we get authoritative state
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self) -> None:
        """Attempt to read the current eye icon from the device when entity is added.

        This uses the adapter client's `get_eye_icon` helper. If the read
        fails, the entity will remain with no current option until the user
        selects one in the UI.
        """
        await super().async_added_to_hass()
        # Ensure the entity state reflects whatever is currently in the
        # coordinator cache. The coordinator stores `eye_icon` as a 1-based
        # int index; the `current_option` property reads from coordinator.data.
        data = getattr(self.coordinator, "data", None)
        if data and data.get("eye_icon") is not None:
            self.async_write_ha_state()
