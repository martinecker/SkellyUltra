"""Select platform for Skelly Ultra eye icon selection."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.const import CONF_ADDRESS
from homeassistant.helpers.event import async_track_time_interval
from datetime import timedelta

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
        self._current: str | None = None
        # Unsubscribe handle for periodic polling
        self._poll_unsub = None
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def options(self) -> list[str]:
        """Return the available eye icon options."""
        return self._options

    @property
    def current_option(self) -> str | None:
        """Return the currently selected option, if any."""
        return self._current

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

        # Optimistically update state
        self._current = option
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        """Attempt to read the current eye icon from the device when entity is added.

        This uses the adapter client's `get_eye_icon` helper. If the read
        fails, the entity will remain with no current option until the user
        selects one in the UI.
        """
        await super().async_added_to_hass()
        try:
            current_index = await self.coordinator.adapter.client.get_eye_icon()
        except Exception:
            return

        # Map the integer (1-based) to our options list (which is labeled '1 ...')
        if 1 <= current_index <= len(self._options):
            self._current = self._options[current_index - 1]
            self.async_write_ha_state()

        # Start periodic polling to refresh the current icon while entity is present
        # Schedule a lightweight callback that creates a task to do the IO so
        # we don't block the track-time callback itself.
        def _schedule_poll(now):
            # create_task is safe here; the coroutine will handle exceptions
            self.hass.async_create_task(self._async_poll_eye_icon())

        self._poll_unsub = async_track_time_interval(
            self.hass, _schedule_poll, timedelta(seconds=5)
        )
        """Poll device for current eye icon and update state if connected."""
        try:
            client = self.coordinator.adapter.client
        except Exception:
            return

        if not client or not getattr(client, "is_connected", False):
            return

        try:
            current_index = await client.get_eye_icon()
        except Exception:
            return

        if 1 <= current_index <= len(self._options):
            new = self._options[current_index - 1]
            if new != self._current:
                self._current = new
                self.async_write_ha_state()
        """Clean up any periodic polling when the entity is removed."""
        if self._poll_unsub:
            try:
                self._poll_unsub()
            except Exception:
                pass
            self._poll_unsub = None
