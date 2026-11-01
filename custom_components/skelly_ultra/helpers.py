"""Helper functions for Skelly Ultra integration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, cast

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo

from .const import (
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_USE_BLE_PROXY,
    DEVICE_PROFILES,
    DEVICE_TYPE_SKELLY,
    DOMAIN,
)


class DeviceLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that prefixes messages with the device name."""

    def process(
        self, msg: str, kwargs: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:  # pragma: no cover - standard logging behavior
        extra = cast(dict[str, Any], self.extra or {})
        device_name = extra.get("device_name") or "Unknown Skelly"
        return f"[{device_name}] {msg}", kwargs


def get_device_profile(entry: ConfigEntry) -> dict:
    """Return the DEVICE_PROFILES entry for a config entry, defaulting to Skelly."""
    device_type = entry.data.get(CONF_DEVICE_TYPE, DEVICE_TYPE_SKELLY)
    return DEVICE_PROFILES.get(device_type, DEVICE_PROFILES[DEVICE_TYPE_SKELLY])


# Light effect speed scales. The UI scale (Effect Speed number entities and
# edit_file) runs from 0 slowest to MAX_UI_EFFECT_SPEED fastest. The device
# uses the inverse (0 fastest, 254 slowest) and also reports 255 for fastest.
MAX_UI_EFFECT_SPEED = 254


def ui_speed_to_device(speed: int) -> int:
    """Convert an effect speed from the UI scale to the device's scale."""
    return MAX_UI_EFFECT_SPEED - speed


def device_speed_to_ui(speed: int) -> int:
    """Convert an effect speed from the device's scale to the UI scale."""
    if speed >= 255:  # also fastest, like 0
        return MAX_UI_EFFECT_SPEED
    return MAX_UI_EFFECT_SPEED - speed


def movement_bits(profile: dict, parts: list[str]) -> int:
    """Return the movement bitfield for a list of the profile's parts."""
    bits_by_part = {m["part"]: m["bit"] for m in profile["movements"]}
    unknown = [part for part in parts if part not in bits_by_part]
    if unknown:
        raise HomeAssistantError(
            f"Unknown movement part(s) {', '.join(unknown)} for this device; "
            f"use {', '.join(bits_by_part)}"
        )
    bits = 0
    for part in parts:
        bits |= bits_by_part[part]
    return bits


def movement_parts(profile: dict, bits: int) -> list[str]:
    """Return the profile's movement parts set in a movement bitfield.

    The inverse of movement_bits. A part with bit 255 ("all") is returned
    alone, and only when the bitfield is exactly 255, as the movement
    switches do.
    """
    movements = profile["movements"]
    if bits == 255 and any(m["bit"] == 255 for m in movements):
        return [m["part"] for m in movements if m["bit"] == 255]
    return [m["part"] for m in movements if m["bit"] != 255 and bits & m["bit"]]


def files_updated_signal(entry_id: str) -> str:
    """Return the dispatcher signal sent when an entry's file state changes.

    Sent by the file transfer progress sensor; the files websocket
    subscription listens for it next to the coordinator's updates.
    """
    return f"{DOMAIN}_files_updated_{entry_id}"


def get_eye_icon_path(profile: dict, eye_icon: int) -> Path | None:
    """Return the image path for a 1-based eye icon index, or None if out of range."""
    if not profile.get("eye_icon_folder") or not 1 <= eye_icon <= len(
        profile.get("eye_icons", [])
    ):
        return None
    return (
        Path(__file__).parent
        / "images"
        / profile["eye_icon_folder"]
        / f"eye_icon_{eye_icon}.png"
    )


def device_type_from_ble_name(name: str) -> str | None:
    """Return the device type key whose ble_names substring matches name, or None."""
    name_lower = name.lower()
    for device_type, profile in DEVICE_PROFILES.items():
        if any(f in name_lower for f in profile["ble_names"]):
            return device_type
    return None


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

    profile = get_device_profile(entry)
    model_name = profile["display_name"]

    return DeviceInfo(
        name=device_name,
        identifiers={(DOMAIN, identifier)},
        manufacturer="Seasonal Visions International/Home Depot",
        model=model_name,
    )


def get_device_name(entry: ConfigEntry, device_info: DeviceInfo | None) -> str:
    """Derive a device-friendly name for logging and display."""

    if device_info:
        # DeviceInfo is a TypedDict (a plain dict at runtime, no attribute
        # access), so it must be read via mapping access.
        device_name = device_info.get("name")
        if device_name:
            return cast(str, device_name)

    if entry.title:
        return entry.title

    return "Skelly Ultra"
