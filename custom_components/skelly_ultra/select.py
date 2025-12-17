"""Select platform for Skelly Ultra eye icon selection."""

from __future__ import annotations

import contextlib
import logging

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info
from .skelly_ultra_pkg.audio_processor import AudioProcessor

_LOGGER = logging.getLogger(__name__)


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

EFFECT_MODES = ["Static", "Strobe", "Pulse"]

# Bitrate options for MP3 encoding
BITRATE_OPTIONS = ["8k", "16k", "32k", "64k", "128k", "192k", "256k", "320k"]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly select entities."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [
            SkellyEyeIconSelect(coordinator, entry.entry_id, device_info),
            SkellyEffectModeSelect(coordinator, entry.entry_id, device_info, channel=0),
            SkellyEffectModeSelect(coordinator, entry.entry_id, device_info, channel=1),
            SkellyBitrateSelect(coordinator, entry.entry_id, device_info),
        ]
    )


class SkellyEyeIconSelect(CoordinatorEntity, SelectEntity):
    """Select entity to set the skelly eye icon."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the eye icon select entity.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        device_info: DeviceInfo | None
            Device registry info for grouping entities
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Eye Icon"
        self._attr_unique_id = f"{entry_id}_eye_icon"
        self._options = EYE_ICONS
        self._attr_device_info = device_info

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
            _LOGGER.error("Failed to parse eye icon index from option: %s", option)
            return

        _LOGGER.info("Setting eye icon to %d (%s)", icon_index, option)

        # Send command to device via adapter client
        try:
            await self.coordinator.adapter.client.set_eye_icon(icon_index)
            _LOGGER.info("Successfully sent eye icon command")
        except Exception:
            _LOGGER.exception("Failed to send eye icon command")
            return

        # Push optimistic value into the coordinator cache so other
        # CoordinatorEntity consumers see the update immediately, then
        # request a refresh to get authoritative state from the device.
        self.coordinator.async_update_data_optimistic("eye_icon", icon_index)

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


class SkellyEffectModeSelect(CoordinatorEntity, SelectEntity):
    """Select entity to set the light effect mode (Static, Strobe, Pulse)."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
    ) -> None:
        """Initialize the effect mode select entity.

        Parameters
        ----------
        coordinator: SkellyCoordinator
            Coordinator providing access to the adapter/client
        entry_id: str
            Config entry id used to form unique id
        device_info: DeviceInfo | None
            Device registry info for grouping entities
        channel: int
            Light channel number (0 = Torso, 1 = Head)
        """
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.channel = channel
        self._attr_name = "Torso Effect Mode" if channel == 0 else "Head Effect Mode"
        self._attr_unique_id = f"{entry_id}_effect_mode_{channel}"
        self._options = EFFECT_MODES
        self._attr_device_info = device_info

    @property
    def options(self) -> list[str]:
        """Return the available effect mode options."""
        return self._options

    @property
    def current_option(self) -> str | None:
        """Return the currently selected option, if any."""
        # Return authoritative coordinator data
        data = getattr(self.coordinator, "data", None)
        if data:
            lights = data.get("lights", [])
            if self.channel < len(lights):
                light_data = lights[self.channel]
                effect_type = light_data.get("effect_type")
                # effect_type: 1 = Static, 2 = Strobe, 3 = Pulse
                if effect_type in (1, 2, 3):
                    return self._options[effect_type - 1]
        return None

    async def async_select_option(self, option: str) -> None:
        """Handle when an option is selected in the UI."""
        # Convert option name to effect_type number (1 = Static, 2 = Strobe, 3 = Pulse)
        try:
            effect_type = self._options.index(option) + 1
        except ValueError:
            return

        # Send command to device via adapter client
        try:
            await self.coordinator.adapter.client.set_light_mode(
                channel=self.channel, mode=effect_type
            )
        except Exception:  # device/IO errors surfaced here
            return

        # Push optimistic value into the coordinator cache
        data = self.coordinator.data or {}
        lights = list(data.get("lights", [{}, {}]))
        if self.channel < len(lights):
            light_data = dict(lights[self.channel])
            light_data["effect_type"] = effect_type
            lights[self.channel] = light_data
            self.coordinator.async_update_data_optimistic("lights", lights)

        self.async_write_ha_state()

        # Request an immediate coordinator refresh
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_added_to_hass(self) -> None:
        """Ensure entity state reflects current coordinator data."""
        await super().async_added_to_hass()
        data = getattr(self.coordinator, "data", None)
        if data and data.get("lights"):
            self.async_write_ha_state()


class SkellyBitrateSelect(CoordinatorEntity, SelectEntity):
    """Select entity for file transfer bitrate.

    Shows the current bitrate when override is off (uses default),
    or allows manual selection when override is on.
    """

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the bitrate select entity."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Bitrate"
        self._attr_unique_id = f"{entry_id}_bitrate"
        self._attr_icon = "mdi:music-note"
        self._attr_device_info = device_info

    @property
    def options(self) -> list[str]:
        """Return the available bitrate options."""
        return BITRATE_OPTIONS

    @property
    def current_option(self) -> str | None:
        """Return current bitrate.

        If override is enabled, returns the user-set value.
        If override is disabled, returns the default.
        """
        data = self.coordinator.data
        if not data:
            return AudioProcessor.MP3_BITRATE

        override_enabled = data.get("override_bitrate", False)

        if override_enabled:
            # Return user-set value
            return data.get("bitrate_override", AudioProcessor.MP3_BITRATE)

        # Return default when override is disabled
        return AudioProcessor.MP3_BITRATE

    async def async_select_option(self, option: str) -> None:
        """Set the bitrate override value.

        Only works when override switch is enabled.
        """
        data = self.coordinator.data
        if not data:
            return

        override_enabled = data.get("override_bitrate", False)
        if not override_enabled:
            # Don't allow changes when override is disabled
            return

        # Store the override value
        self.coordinator.async_update_data_optimistic("bitrate_override", option)

        self.async_write_ha_state()
