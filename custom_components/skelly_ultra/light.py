"""Light platform for Skelly Ultra channels."""

from __future__ import annotations

import contextlib

from homeassistant.components.light import ColorMode, LightEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up Torso and Head lights for the Skelly Ultra."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [
            SkellyChannelLight(
                coordinator, entry.entry_id, device_info, 0, "Torso Light"
            ),
            SkellyChannelLight(
                coordinator, entry.entry_id, device_info, 1, "Head Light"
            ),
        ]
    )


class SkellyChannelLight(CoordinatorEntity, LightEntity):
    """Light entity representing a Skelly RGB channel."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
        name: str,
    ) -> None:
        """Initialize the light for a specific channel."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._channel = channel
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_light_{channel}"
        # Use supported_color_modes instead of the deprecated
        # SUPPORT_BRIGHTNESS. The light supports RGB and reports
        # brightness via the brightness property (0-255).
        self._attr_supported_color_modes = {ColorMode.RGB}
        self._attr_color_mode = ColorMode.RGB
        self._attr_device_info = device_info

    @property
    def is_on(self) -> bool:
        """Return True if light is on."""
        data = getattr(self.coordinator, "data", None)
        if not data:
            return False
        lights = data.get("lights") or []
        if len(lights) <= self._channel:
            return False
        try:
            brightness = lights[self._channel].get("brightness")
            return (int(brightness) or 0) > 0
        except (ValueError, TypeError, AttributeError):
            return False

    @property
    def brightness(self) -> int | None:
        """Return current brightness (0-255) or None."""
        data = getattr(self.coordinator, "data", None)
        if not data:
            return None
        lights = data.get("lights") or []
        if len(lights) <= self._channel:
            return None
        try:
            val = lights[self._channel].get("brightness")
            return int(val) if val is not None else None
        except (ValueError, TypeError, AttributeError):
            return None

    @property
    def rgb_color(self) -> tuple[int, int, int] | None:
        """Return current RGB color as (r, g, b) or None."""
        data = getattr(self.coordinator, "data", None)
        if not data:
            return None
        lights = data.get("lights") or []
        if len(lights) <= self._channel:
            return None
        try:
            rgb = lights[self._channel].get("rgb")
            return tuple(int(x) for x in rgb) if rgb else None
        except (ValueError, TypeError, AttributeError):
            return None

    async def async_added_to_hass(self) -> None:
        """Entity added to hass; initialize state from coordinator cache."""
        await super().async_added_to_hass()
        # Read initial state from the coordinator cache instead of querying
        # the device directly. The coordinator populates `lights` as a list
        # of dicts with `brightness` and `rgb` for channels 0 and 1.
        data = getattr(self.coordinator, "data", None)
        if not data:
            return

        lights = data.get("lights")
        if not lights or len(lights) <= self._channel:
            return

        # Ensure HA shows the coordinator cached state immediately
        # (properties `is_on`, `brightness`, and `rgb_color` read from
        # coordinator.data). No local optimistic state is stored here.
        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs) -> None:
        """Turn the light on or set color/brightness."""
        client = None
        with contextlib.suppress(Exception):
            client = self.coordinator.adapter.client

        # If rgb_color specified, call set_light_rgb
        rgb = kwargs.get("rgb_color")
        brightness = kwargs.get("brightness")

        if rgb and client:
            try:
                r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])

                # Get current effect (color cycle) state from coordinator
                loop = 0  # default: no color cycling
                data = getattr(self.coordinator, "data", None)
                if data:
                    lights = data.get("lights", [])
                    if self._channel < len(lights):
                        effect = lights[self._channel].get("effect", 0)
                        loop = 1 if effect == 1 else 0

                # Call set_light_rgb with current loop state to preserve color cycle setting
                await client.set_light_rgb(self._channel, r, g, b, loop)
            except (ValueError, TypeError):
                pass
            else:
                # push optimistic rgb into coordinator cache
                data = self.coordinator.data or {}
                lights = list(data.get("lights") or [{}, {}])
                # ensure list has at least channels 0 and 1
                while len(lights) <= self._channel:
                    lights.append({})
                lights[self._channel] = dict(lights[self._channel])
                lights[self._channel]["rgb"] = (r, g, b)
                self.coordinator.async_update_data_optimistic("lights", lights)

        # Determine brightness to set. If explicit brightness provided,
        # use that. Otherwise, use last-known brightness from the
        # coordinator (if > 0). If last-known is missing or zero, fall
        # back to full brightness (255) to ensure the light turns on.
        desired_brightness: int | None = None
        if brightness is not None:
            try:
                desired_brightness = int(brightness)
            except (ValueError, TypeError):
                desired_brightness = None
        else:
            # try last-known
            last = self.brightness
            try:
                if last is not None and int(last) > 0:
                    desired_brightness = int(last)
                else:
                    desired_brightness = 255
            except (ValueError, TypeError):
                desired_brightness = 255

        if desired_brightness is not None and client:
            try:
                await client.set_light_brightness(
                    self._channel, int(desired_brightness)
                )
            except (ValueError, TypeError):
                pass
            else:
                # push optimistic brightness into coordinator cache
                data = self.coordinator.data or {}
                lights = list(data.get("lights") or [{}, {}])
                while len(lights) <= self._channel:
                    lights.append({})
                lights[self._channel] = dict(lights[self._channel])
                lights[self._channel]["brightness"] = int(desired_brightness)
                self.coordinator.async_update_data_optimistic("lights", lights)

        if brightness is not None and client:
            try:
                # brightness already 0-255 range
                await client.set_light_brightness(self._channel, int(brightness))
            except (ValueError, TypeError):
                pass
            else:
                # push optimistic brightness into coordinator cache
                data = self.coordinator.data or {}
                lights = list(data.get("lights") or [{}, {}])
                while len(lights) <= self._channel:
                    lights.append({})
                lights[self._channel] = dict(lights[self._channel])
                lights[self._channel]["brightness"] = int(brightness)
                self.coordinator.async_update_data_optimistic("lights", lights)

        # If no brightness provided but turning on, set on=True
        # No local state is kept; coordinator cache update will drive
        # entity state. Ensure HA updates immediately and request a single
        # coordinator refresh at the end (non-fatal).
        self.async_write_ha_state()
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs) -> None:
        """Turn the light off by setting brightness to 0."""
        client = None
        with contextlib.suppress(Exception):
            client = self.coordinator.adapter.client

        if client:
            with contextlib.suppress(Exception):
                await client.set_light_brightness(self._channel, 0)

        self.async_write_ha_state()
        # reflect optimistic off state in coordinator cache
        data = self.coordinator.data or {}
        lights = list(data.get("lights") or [{}, {}])
        while len(lights) <= self._channel:
            lights.append({})
        lights[self._channel] = dict(lights[self._channel])
        lights[self._channel]["brightness"] = 0
        self.coordinator.async_update_data_optimistic("lights", lights)
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()
