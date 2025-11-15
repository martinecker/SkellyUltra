"""Helper functions for Skelly Ultra integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN


def get_device_info(hass: HomeAssistant, entry: ConfigEntry) -> DeviceInfo | None:
    """Create DeviceInfo for a Skelly device from config entry.

    Args:
        hass: HomeAssistant instance to access integration data.
        entry: ConfigEntry containing device configuration.

    Returns:
        DeviceInfo with device name and address identifier, or None if address is None.
    """
    # Get address from entry data or adapter in hass.data
    address = entry.data.get(CONF_ADDRESS)
    if not address and DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
        adapter = hass.data[DOMAIN][entry.entry_id].get("adapter")
        if adapter:
            address = adapter.address

    if not address:
        return None

    # Always use entry.title for device name, with fallback to address-based name
    device_name = entry.title or f"Skelly Ultra {address}"

    return DeviceInfo(name=device_name, identifiers={(DOMAIN, address)})
