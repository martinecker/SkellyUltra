"""Light platform for Skelly Ultra channels."""

from __future__ import annotations

import contextlib
from functools import partial

from homeassistant.components.light import ColorMode, LightEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .entity import SkellyCoordinatorEntity, async_run_command
from .helpers import get_device_info, get_device_profile


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up lights for the configured device type."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)
    profile = get_device_profile(entry)

    async_add_entities(
        [
            SkellyChannelLight(
                coordinator,
                entry.entry_id,
                device_info,
                light_cfg["channel"],
                light_cfg["label"],
            )
            for light_cfg in profile["lights"]
        ]
    )


class SkellyChannelLight(SkellyCoordinatorEntity, LightEntity):
    """Light entity representing a Skelly RGB channel."""

    _attr_color_mode = ColorMode.RGB

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        channel: int,
        name: str,
    ) -> None:
        """Initialize the light for a specific channel."""
        super().__init__(coordinator, entry_id, device_info, f"light_{channel}", name)
        self._channel = channel
        self._attr_supported_color_modes = {ColorMode.RGB}

    @property
    def is_on(self) -> bool:
        """Return True if light is on."""
        return (self.brightness or 0) > 0

    @property
    def brightness(self) -> int | None:
        """Return current brightness (0-255) or None."""
        try:
            val = self.light_data(self._channel).get("brightness")
            return int(val) if val is not None else None
        except (ValueError, TypeError, AttributeError):
            return None

    @property
    def rgb_color(self) -> tuple[int, int, int] | None:
        """Return current RGB color as (r, g, b) or None."""
        try:
            rgb = self.light_data(self._channel).get("rgb")
            return tuple(int(x) for x in rgb) if rgb else None
        except (ValueError, TypeError, AttributeError):
            return None

    async def async_turn_on(self, **kwargs) -> None:
        """Turn the light on or set color/brightness.

        Without a brightness, the last known one is used, or full brightness
        if the light was off, so the light turns on.
        """
        client = self.coordinator.adapter.client
        brightness = kwargs.get("brightness")
        if brightness is None:
            brightness = self.brightness or 255
        brightness = int(brightness)
        changes: dict = {}

        async def send() -> None:
            if (rgb := kwargs.get("rgb_color")) is not None:
                r, g, b = (int(x) for x in rgb)
                # Keep color cycling as it is
                cycle = self.light_data(self._channel).get("color_cycle") == 1
                await async_run_command(
                    client.set_light_rgb(self._channel, r, g, b, 1 if cycle else 0),
                    "Couldn't set the light color",
                )
                changes["rgb"] = (r, g, b)
            await async_run_command(
                client.set_light_brightness(self._channel, brightness),
                "Couldn't set the light brightness",
            )
            changes["brightness"] = brightness

        try:
            await send()
        finally:
            # Also when the brightness failed after the color went through
            if changes:
                self.coordinator.async_update_light(self._channel, **changes)
                self.async_write_ha_state()
                with contextlib.suppress(Exception):
                    await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs) -> None:
        """Turn the light off by setting brightness to 0."""
        await self._async_command(
            self.coordinator.adapter.client.set_light_brightness(self._channel, 0),
            "Couldn't turn the light off",
            partial(self.coordinator.async_update_light, self._channel, brightness=0),
        )
