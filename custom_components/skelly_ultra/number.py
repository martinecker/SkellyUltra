"""Number platform for Skelly Ultra volume control."""

from __future__ import annotations

from functools import partial

from homeassistant.components.number import NumberEntity
from homeassistant.const import PERCENTAGE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.device_registry import DeviceInfo

from .coordinator import SkellyCoordinator
from .data import SkellyConfigEntry
from .entity import SkellyCoordinatorEntity
from .helpers import (
    MAX_UI_EFFECT_SPEED,
    device_speed_to_ui,
    get_device_info,
    get_device_profile,
    ui_speed_to_device,
)
from .skelly_ultra_pkg.file_transfer import FileTransferManager


async def async_setup_entry(
    hass: HomeAssistant, entry: SkellyConfigEntry, async_add_entities
):
    """Set up the number entities from a config entry."""
    data = entry.runtime_data
    coordinator: SkellyCoordinator = data.coordinator
    device_info = get_device_info(hass, entry)
    profile = get_device_profile(entry)

    entities: list = [
        SkellyVolumeNumber(coordinator, entry.entry_id, device_info),
    ]

    for light_cfg in profile["lights"]:
        entities.append(
            SkellyEffectSpeedNumber(
                coordinator,
                entry.entry_id,
                device_info,
                channel=light_cfg["channel"],
                label=light_cfg["label"],
            )
        )

    entities.append(SkellyChunkSizeNumber(coordinator, entry.entry_id, device_info))

    async_add_entities(entities)


class SkellyVolumeNumber(SkellyCoordinatorEntity, NumberEntity):
    """Number entity representing the Skelly volume (0-100%)."""

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = PERCENTAGE

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the volume number."""
        super().__init__(coordinator, entry_id, device_info, "volume_number", "Volume")

    @property
    def native_value(self) -> int | None:
        """Return the current volume in percent, or None if unknown."""
        vol = self.coordinator_data.get("volume")
        try:
            return int(vol) if vol is not None else None
        except (ValueError, TypeError):
            return None

    async def async_set_native_value(self, value: float) -> None:
        """Set the volume on the device."""
        volume = int(value)
        await self._async_command(
            self.coordinator.adapter.client.set_volume(volume),
            "Couldn't set the volume",
            partial(self.coordinator.async_update_data_optimistic, "volume", volume),
        )


class SkellyEffectSpeedNumber(SkellyCoordinatorEntity, NumberEntity):
    """Number entity representing the effect speed for a light channel (0-254).

    The speed is inverted for intuitive control:
    - User value 0 = slowest (device speed 254)
    - User value 254 = fastest (device speed 0)
    """

    _attr_native_min_value = 0
    _attr_native_max_value = MAX_UI_EFFECT_SPEED
    _attr_native_step = 1

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
        label: str,
    ) -> None:
        """Initialize the effect speed number for a light channel.

        label is the light's name (e.g. "Torso Light", "Lantern").
        """
        super().__init__(
            coordinator,
            entry_id,
            device_info,
            f"effect_speed_{channel}",
            f"{label} Effect Speed",
        )
        self.channel = channel

    @property
    def native_value(self) -> int | None:
        """Return the effect speed shown in the UI (inverted, 0=slow).

        The device reports speed where 0=fast, 254=slow, and 255=fast (same as 0).
        """
        device_speed = self.light_data(self.channel).get("effect_speed")
        if device_speed is None:
            return None
        try:
            return device_speed_to_ui(int(device_speed))
        except (ValueError, TypeError):
            return None

    async def async_set_native_value(self, value: float) -> None:
        """Set the effect speed on the device (UI 0 = slow = device 254)."""
        device_speed = ui_speed_to_device(int(value))
        await self._async_command(
            self.coordinator.adapter.client.set_light_speed(
                channel=self.channel, speed=device_speed
            ),
            "Couldn't set the effect speed",
            partial(
                self.coordinator.async_update_light,
                self.channel,
                effect_speed=device_speed,
            ),
        )


class SkellyChunkSizeNumber(SkellyCoordinatorEntity, NumberEntity):
    """Number entity for the file transfer chunk size override value.

    Holds the chunk size used when the Override Chunk Size switch is on
    (defaults to DEFAULT_CHUNK_SIZE). It can only be changed while the
    override is on; when it's off, transfers use the MTU-based chunk size.
    """

    _attr_native_unit_of_measurement = "bytes"
    _attr_icon = "mdi:package-variant"
    _attr_native_min_value = FileTransferManager.MIN_CHUNK_SIZE
    _attr_native_max_value = FileTransferManager.MAX_CHUNK_SIZE
    _attr_native_step = 10

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the chunk size number entity."""
        # Named to sort next to the "Override Chunk Size" switch in the HA UI
        super().__init__(
            coordinator,
            entry_id,
            device_info,
            "chunk_size",
            "Override Chunk Size Value",
        )

    @property
    def mode(self) -> str:
        """Return mode based on override switch state."""
        override_enabled = self.coordinator_data.get("override_chunk_size", False)
        return "box" if override_enabled else "slider"

    @property
    def native_value(self) -> int | None:
        """Return the chunk size override value, or the default if not set yet."""
        data = self.coordinator.data
        if not data:
            return None

        return data.get("chunk_size_override", FileTransferManager.DEFAULT_CHUNK_SIZE)

    async def async_set_native_value(self, value: float) -> None:
        """Set the chunk size override value; only while the override is on."""
        if not self.coordinator_data.get("override_chunk_size", False):
            raise ServiceValidationError(
                "Turn on Override Chunk Size to change the chunk size"
            )

        self.coordinator.async_update_data_optimistic("chunk_size_override", int(value))
        self.async_write_ha_state()
