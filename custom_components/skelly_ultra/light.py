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
        return self._is_on

    @property
    def brightness(self) -> int | None:
        return self._brightness

    @property
    def rgb_color(self) -> tuple[int, int, int] | None:
        return self._rgb_color

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        # Initialize current state from device if available
        try:
            client = self.coordinator.adapter.client
        except Exception:
            client = None

        if client and getattr(client, "is_connected", False):
            try:
                info = await client.get_light_info(self._channel)
            except Exception:
                return

            # parser.LightInfo has attributes: mode, brightness (0-255), rgb (r,g,b), effect, speed
            try:
                self._brightness = int(info.brightness)
                self._rgb_color = tuple(info.rgb)
                self._is_on = self._brightness > 0
                self.async_write_ha_state()
            except Exception:
                # ignore malformed data
                return

    async def async_turn_on(self, **kwargs) -> None:
        """Turn the light on or set color/brightness."""
        client = None
        try:
            client = self.coordinator.adapter.client
        except Exception:
            pass

        # If rgb_color specified, call set_light_rgb
        rgb = kwargs.get("rgb_color")
        brightness = kwargs.get("brightness")

        if rgb and client:
            try:
                r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
                # loop and cluster/name left as defaults
                await client.set_light_rgb(self._channel, r, g, b, 0)
                self._rgb_color = (r, g, b)
            except Exception:
                pass

        if brightness is not None and client:
            try:
                # brightness already 0-255 range
                await client.set_light_brightness(self._channel, int(brightness))
                self._brightness = int(brightness)
                self._is_on = self._brightness > 0
            except Exception:
                pass

        # If no brightness provided but turning on, set on=True
        if brightness is None:
            self._is_on = True

        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Turn the light off by setting brightness to 0."""
        client = None
        try:
            client = self.coordinator.adapter.client
        except Exception:
            pass

        if client:
            try:
                await client.set_light_brightness(self._channel, 0)
            except Exception:
                pass

        self._brightness = 0
        self._is_on = False
        self.async_write_ha_state()
