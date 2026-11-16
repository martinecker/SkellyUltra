"""Select platform for Skelly Ultra eye icon selection."""

from __future__ import annotations

from functools import partial

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.device_registry import DeviceInfo

from .coordinator import SkellyCoordinator
from .data import SkellyConfigEntry
from .entity import SkellyCoordinatorEntity
from .helpers import get_device_info, get_device_profile
from .skelly_ultra_pkg.audio_processor import AudioProcessor

# Bitrate options for MP3 encoding
BITRATE_OPTIONS = ["8k", "16k", "32k", "64k", "128k", "192k", "256k", "320k"]


async def async_setup_entry(
    hass: HomeAssistant, entry: SkellyConfigEntry, async_add_entities
):
    """Set up the Skelly select entities."""
    data = entry.runtime_data
    coordinator: SkellyCoordinator = data.coordinator
    device_info = get_device_info(hass, entry)
    profile = get_device_profile(entry)

    entities: list = []

    if profile["has_eye_image"]:
        entities.append(
            SkellyEyeIconSelect(
                coordinator, entry.entry_id, device_info, profile["eye_icons"]
            )
        )

    for light_cfg in profile["lights"]:
        entities.append(
            SkellyEffectModeSelect(
                coordinator,
                entry.entry_id,
                device_info,
                channel=light_cfg["channel"],
                label=light_cfg["label"],
                options=profile["light_modes"],
            )
        )

    entities.append(SkellyBitrateSelect(coordinator, entry.entry_id, device_info))

    async_add_entities(entities)


class SkellyEyeIconSelect(SkellyCoordinatorEntity, SelectEntity):
    """Select entity to set the skelly eye icon."""

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        options: list[str],
    ) -> None:
        """Initialize the eye icon select.

        options are this device type's eye icon labels in device index order,
        each starting with its 1-based index (e.g. "10 Fire").
        """
        super().__init__(coordinator, entry_id, device_info, "eye_icon", "Eye Icon")
        self._attr_options = options

    @property
    def current_option(self) -> str | None:
        """Return the currently selected option, if any."""
        eye = self.coordinator_data.get("eye_icon")
        if isinstance(eye, int) and 1 <= eye <= len(self.options):
            return self.options[eye - 1]
        return None

    async def async_select_option(self, option: str) -> None:
        """Send the eye icon whose index the option starts with."""
        try:
            icon_index = int(option.split(" ", 1)[0])
        except ValueError:
            raise ServiceValidationError(f"Unknown eye icon: {option}") from None

        await self._async_command(
            self.coordinator.adapter.client.set_eye_icon(icon_index),
            "Couldn't set the eye icon",
            partial(
                self.coordinator.async_update_data_optimistic, "eye_icon", icon_index
            ),
        )


class SkellyEffectModeSelect(SkellyCoordinatorEntity, SelectEntity):
    """Select entity to set the light effect mode (Static, Strobe, Pulse)."""

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
        label: str,
        options: list[str],
    ) -> None:
        """Initialize the effect mode select for a light channel.

        label is the light's name (e.g. "Torso Light", "Lantern"); options
        are the device's mode names in order (index + 1 = mode value).
        """
        super().__init__(
            coordinator,
            entry_id,
            device_info,
            f"effect_mode_{channel}",
            f"{label} Effect Mode",
        )
        self.channel = channel
        self._attr_options = options

    @property
    def current_option(self) -> str | None:
        """Return the currently selected option, if any."""
        effect_type = self.light_data(self.channel).get("effect_type")
        if effect_type and 1 <= effect_type <= len(self.options):
            return self.options[effect_type - 1]
        return None

    async def async_select_option(self, option: str) -> None:
        """Send the effect mode."""
        try:
            effect_type = self.options.index(option) + 1
        except ValueError:
            raise ServiceValidationError(f"Unknown effect mode: {option}") from None

        await self._async_command(
            self.coordinator.adapter.client.set_light_mode(
                channel=self.channel, mode=effect_type
            ),
            "Couldn't set the effect mode",
            partial(
                self.coordinator.async_update_light,
                self.channel,
                effect_type=effect_type,
            ),
        )


class SkellyBitrateSelect(SkellyCoordinatorEntity, SelectEntity):
    """Select entity for the file transfer bitrate override value.

    Shows the current bitrate when override is off (uses default),
    or allows manual selection when override is on.
    """

    _attr_icon = "mdi:music-note"
    _attr_options = BITRATE_OPTIONS

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the bitrate select entity."""
        # Named to sort next to the "Override Bitrate" switch in the HA UI
        super().__init__(
            coordinator, entry_id, device_info, "bitrate", "Override Bitrate Value"
        )

    @property
    def current_option(self) -> str | None:
        """Return the user-set bitrate while the override is on, else the default."""
        data = self.coordinator_data
        if data.get("override_bitrate", False):
            return data.get("bitrate_override", AudioProcessor.MP3_BITRATE)
        return AudioProcessor.MP3_BITRATE

    async def async_select_option(self, option: str) -> None:
        """Set the bitrate override value; only while the override is on."""
        if not self.coordinator_data.get("override_bitrate", False):
            raise ServiceValidationError(
                "Turn on Override Bitrate to change the bitrate"
            )

        self.coordinator.async_update_data_optimistic("bitrate_override", option)
        self.async_write_ha_state()
