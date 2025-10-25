"""Light platform for Skelly Ultra channels."""

from __future__ import annotations

from homeassistant.components.light import (
    LightEntity,
    SUPPORT_BRIGHTNESS,
    ColorMode,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import CONF_ADDRESS
from homeassistant.helpers.device_registry import DeviceInfo
import contextlib

from . import DOMAIN
from .coordinator import SkellyCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up Torso and Head lights for the Skelly Ultra."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address

    async_add_entities(
        [
            SkellyChannelLight(coordinator, entry.entry_id, address, 0, "Torso Light"),
            SkellyChannelLight(coordinator, entry.entry_id, address, 1, "Head Light"),
        ]
    )


class SkellyChannelLight(CoordinatorEntity, LightEntity):
    """Light entity representing a Skelly RGB channel."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        address: str | None,
        channel: int,
        name: str,
    ) -> None:
        """Initialize the light for a specific channel."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._channel = channel
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_light_{channel}"
        self._attr_supported_features = SUPPORT_BRIGHTNESS
        # Use the modern supported color modes set to expose RGB support
        self._attr_supported_color_modes = {ColorMode.RGB}
        self._attr_color_mode = ColorMode.RGB
        self._is_on = False
        self._brightness = 0
        self._rgb_color: tuple[int, int, int] | None = None
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

    @property
    def is_on(self) -> bool:
        """Return True if light is on."""
        return self._is_on

    @property
    def brightness(self) -> int | None:
        """Return current brightness (0-255) or None."""
        return self._brightness

    @property
    def rgb_color(self) -> tuple[int, int, int] | None:
        """Return current RGB color as (r, g, b) or None."""
        return self._rgb_color

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

        info = lights[self._channel] or {}
        try:
            if info.get("brightness") is not None:
                self._brightness = int(info.get("brightness") or 0)
            rgb = info.get("rgb")
            if rgb:
                # Ensure tuple of ints
                self._rgb_color = tuple(int(x) for x in rgb)
            self._is_on = (self._brightness or 0) > 0
            self.async_write_ha_state()
        except (ValueError, TypeError):
            # If data is malformed, skip initialization
            return

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
                # loop and cluster/name left as defaults
                await client.set_light_rgb(self._channel, r, g, b, 0)
                self._rgb_color = (r, g, b)
            except (ValueError, TypeError):
                pass
            else:
                # push optimistic rgb into coordinator cache
                new_data = dict(self.coordinator.data or {})
                lights = list(new_data.get("lights") or [{}, {}])
                # ensure list has at least channels 0 and 1
                while len(lights) <= self._channel:
                    lights.append({})
                lights[self._channel]["rgb"] = (r, g, b)
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(
                        {**new_data, "lights": lights}
                    )

        if brightness is not None and client:
            try:
                # brightness already 0-255 range
                await client.set_light_brightness(self._channel, int(brightness))
                self._brightness = int(brightness)
                self._is_on = self._brightness > 0
            except (ValueError, TypeError):
                pass
            else:
                # push optimistic brightness into coordinator cache
                new_data = dict(self.coordinator.data or {})
                lights = list(new_data.get("lights") or [{}, {}])
                while len(lights) <= self._channel:
                    lights.append({})
                lights[self._channel]["brightness"] = int(brightness)
                with contextlib.suppress(Exception):
                    self.coordinator.async_set_updated_data(
                        {**new_data, "lights": lights}
                    )

        # If no brightness provided but turning on, set on=True
        if brightness is None:
            self._is_on = True

        self.async_write_ha_state()
        # Trigger an immediate coordinator refresh to get authoritative state
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

        self._brightness = 0
        self._is_on = False
        self.async_write_ha_state()
        # reflect optimistic off state in coordinator cache
        new_data = dict(self.coordinator.data or {})
        lights = list(new_data.get("lights") or [{}, {}])
        while len(lights) <= self._channel:
            lights.append({})
        lights[self._channel]["brightness"] = 0
        with contextlib.suppress(Exception):
            self.coordinator.async_set_updated_data({**new_data, "lights": lights})
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()
