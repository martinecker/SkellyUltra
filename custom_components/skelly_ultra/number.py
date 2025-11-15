"""Number platform for Skelly Ultra volume control."""

from __future__ import annotations

import contextlib

from homeassistant.components.number import NumberEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info
from .skelly_ultra_pkg.file_transfer import FileTransferManager


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the number entities from a config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [
            SkellyVolumeNumber(coordinator, entry.entry_id, device_info),
            SkellyEffectSpeedNumber(
                coordinator, entry.entry_id, device_info, channel=0
            ),
            SkellyEffectSpeedNumber(
                coordinator, entry.entry_id, device_info, channel=1
            ),
            SkellyChunkSizeNumber(
                coordinator, data.get("adapter"), entry.entry_id, device_info
            ),
        ]
    )


class SkellyVolumeNumber(CoordinatorEntity, NumberEntity):
    """Number entity representing the Skelly volume (0-100%)."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Volume"
        self._attr_unique_id = f"{entry_id}_volume_number"
        self._attr_native_min_value = 0
        self._attr_native_max_value = 100
        self._attr_native_step = 1
        self._attr_native_unit_of_measurement = PERCENTAGE
        self._attr_device_info = device_info

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


class SkellyEffectSpeedNumber(CoordinatorEntity, NumberEntity):
    """Number entity representing the effect speed for a light channel (0-254).

    The speed is inverted for intuitive control:
    - User value 0 = slowest (device speed 254)
    - User value 254 = fastest (device speed 0)
    """

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
    ) -> None:
        """Initialize the effect speed number entity.

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
        self._attr_name = "Torso Effect Speed" if channel == 0 else "Head Effect Speed"
        self._attr_unique_id = f"{entry_id}_effect_speed_{channel}"
        self._attr_native_min_value = 0
        self._attr_native_max_value = 254
        self._attr_native_step = 1
        self._attr_device_info = device_info

    @property
    def native_value(self) -> int | None:
        """Return the current effect speed from the coordinator cache (inverted).

        The device reports speed where 0=fast, 254=slow, and 255=fast (same as 0).
        We invert this so the UI shows 0=slow and 254=fast for intuitive control.

        Returns:
            int | None: The inverted speed (0-254), or None if unknown.
        """
        data = getattr(self.coordinator, "data", None)
        if data:
            lights = data.get("lights", [])
            if self.channel < len(lights):
                device_speed = lights[self.channel].get("effect_speed")
                if device_speed is not None:
                    try:
                        speed_int = int(device_speed)
                        # Device speed 255 is fastest (same as 0), map to UI 254
                        if speed_int == 255:
                            return 254
                        # Invert: device 0 (fast) -> UI 254 (fast)
                        #         device 254 (slow) -> UI 0 (slow)
                        return 254 - speed_int
                    except (ValueError, TypeError):
                        return None
        return None

    async def async_set_native_value(self, value: float) -> None:
        """Set the effect speed on the device via the client (inverted).

        The UI value is inverted before sending to the device:
        - UI 0 (slow) -> device 254 (slow)
        - UI 254 (fast) -> device 0 (fast)

        Parameters
        ----------
        value : float
            Effect speed from UI (0=slow to 254=fast)
        """
        # Invert the value: UI 0 -> device 254, UI 254 -> device 0
        device_speed = 254 - int(value)

        try:
            await self.coordinator.adapter.client.set_light_speed(
                channel=self.channel, speed=device_speed
            )
        except Exception:
            # Setting failed; do not change optimistic state
            return

        # Push optimistic value into coordinator cache (store device value)
        new_data = dict(self.coordinator.data or {})
        lights = list(new_data.get("lights", [{}, {}]))
        if self.channel < len(lights):
            light_data = dict(lights[self.channel])
            light_data["effect_speed"] = device_speed
            lights[self.channel] = light_data
            new_data["lights"] = lights
            with contextlib.suppress(Exception):
                self.coordinator.async_set_updated_data(new_data)

        self.async_write_ha_state()

        # Request coordinator refresh
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()


class SkellyChunkSizeNumber(CoordinatorEntity, NumberEntity):
    """Number entity for file transfer chunk size.

    Shows the calculated chunk size when override is off (read-only),
    or allows manual setting when override is on.
    """

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        adapter,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the chunk size number entity."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self.adapter = adapter
        self._attr_name = "Chunk Size"
        self._attr_unique_id = f"{entry_id}_chunk_size"
        self._attr_native_unit_of_measurement = "bytes"
        self._attr_icon = "mdi:package-variant"

        # Set range from file_transfer constants
        self._attr_native_min_value = FileTransferManager.MIN_CHUNK_SIZE
        self._attr_native_max_value = FileTransferManager.MAX_CHUNK_SIZE
        self._attr_native_step = 10

        self._attr_device_info = device_info

    @property
    def mode(self) -> str:
        """Return mode based on override switch state."""
        override_enabled = (
            self.coordinator.data.get("override_chunk_size", False)
            if self.coordinator.data
            else False
        )
        return "box" if override_enabled else "slider"

    @property
    def native_value(self) -> int | None:
        """Return current chunk size.

        If override is enabled, returns the user-set value.
        If override is disabled, calculates from MTU.
        """
        data = self.coordinator.data
        if not data:
            return None

        override_enabled = data.get("override_chunk_size", False)

        if override_enabled:
            # Return user-set value
            return data.get("chunk_size_override", 250)

        # Calculate from MTU (read-only display)
        manager = FileTransferManager()
        try:
            return manager.get_chunk_size(self.adapter.client)
        except Exception:
            return 250  # Default fallback

    async def async_set_native_value(self, value: float) -> None:
        """Set the chunk size override value.

        Only works when override switch is enabled.
        """
        data = self.coordinator.data
        if not data:
            return

        override_enabled = data.get("override_chunk_size", False)
        if not override_enabled:
            # Don't allow changes when override is disabled
            return

        # Store the override value
        new_data = dict(data)
        new_data["chunk_size_override"] = int(value)
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data(new_data)

        self.async_write_ha_state()
