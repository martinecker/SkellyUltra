"""Home Assistant integration for Skelly Ultra (minimal scaffold).

This file creates a client adapter and coordinator and forwards setup to platforms.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .client_adapter import SkellyClientAdapter
from .coordinator import SkellyCoordinator

DOMAIN = "skelly_ultra"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    address = entry.data.get("address")
    adapter = SkellyClientAdapter(address=address)
    coordinator = SkellyCoordinator(hass, adapter)
    await adapter.connect()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "adapter": adapter,
        "coordinator": coordinator,
    }
    # forward platforms (sensor, switch, light) if you create them
    hass.config_entries.async_setup_platforms(entry, ["sensor"])
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["adapter"].disconnect()
    return True
