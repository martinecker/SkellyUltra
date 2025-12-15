"""Helper functions for Skelly Ultra integration."""

from __future__ import annotations

import logging
from typing import Any, cast

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo

from .const import CONF_SERVER_URL, CONF_USE_BLE_PROXY, DOMAIN


class DeviceLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that prefixes messages with the device name."""

    def process(
        self, msg: str, kwargs: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:  # pragma: no cover - standard logging behavior
        extra = cast(dict[str, Any], self.extra or {})
        device_name = extra.get("device_name") or "Unknown Skelly"
        return f"[{device_name}] {msg}", kwargs


def build_device_identifier(
    device_name: str, address: str, server_url: str | None = None
) -> str:
    """Build a consistent device identifier for Skelly Ultra devices.

    Args:
        device_name: The BLE device name (e.g., "Animated Skelly")
        address: The BLE MAC address
        server_url: Optional REST server URL (used when in BLE proxy mode)

    Returns:
        A formatted identifier string:
        - BLE proxy mode: "<name> (<address> via <server_url>)"
        - Direct BLE mode: "<name> (<address>)"
    """
    if server_url:
        # BLE proxy mode: include server URL in the identifier
        return f"{device_name} ({address} via {server_url})"
    # Direct BLE mode: just name and address
    return f"{device_name} ({address})"


def get_device_info(hass: HomeAssistant, entry: ConfigEntry) -> DeviceInfo | None:
    """Create DeviceInfo for a Skelly device from config entry.

    Args:
        hass: HomeAssistant instance to access integration data.
        entry: ConfigEntry containing device configuration.

    Returns:
        DeviceInfo with device name and address identifier, or None if address is None.

    Note:
        For BLE proxy connections, the identifier includes both the address and server URL
        to differentiate between the same device accessed via different proxies.
        For direct BLE connections, only the MAC address is used as the identifier.
    """
    # Get address from entry data or adapter in hass.data
    address = entry.data.get(CONF_ADDRESS)
    if not address and DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
        adapter = hass.data[DOMAIN][entry.entry_id].get("adapter")
        if adapter:
            address = adapter.address

    if not address:
        return None

    # Check if using BLE proxy mode
    use_ble_proxy = entry.data.get(CONF_USE_BLE_PROXY, False)

    # Create different identifiers for proxy vs direct connections
    # Note: This is the device registry identifier, not the user-facing title
    if use_ble_proxy:
        # Include server URL in identifier for proxy connections
        server_url = entry.data.get(CONF_SERVER_URL, "")
        # Use a composite identifier: "proxy:{address}@{server_url}"
        identifier = f"proxy:{address}@{server_url}"
    else:
        # Direct BLE connection - use MAC address only
        identifier = address

    # Always use entry.title for device name, with fallback to identifier-based name
    device_name = entry.title or f"Skelly Ultra {identifier}"

    return DeviceInfo(
        name=device_name,
        identifiers={(DOMAIN, identifier)},
        manufacturer="Seasonal Visions International/Home Depot",
        model="Ultra Skelly",
    )


def get_device_name(entry: ConfigEntry, device_info: DeviceInfo | None) -> str:
    """Derive a device-friendly name for logging and display."""

    if device_info:
        # DeviceInfo exposes attributes directly; fall back to mapping access if needed
        device_name = getattr(device_info, "name", None)
        if not device_name and hasattr(device_info, "get"):
            device_name = device_info.get("name")
        if device_name:
            return cast(str, device_name)

    if entry.title:
        return entry.title

    return "Skelly Ultra"
