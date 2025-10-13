"""Home Assistant integration for Skelly Ultra (minimal scaffold).

This file creates a client adapter and coordinator and forwards setup to platforms.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .client_adapter import SkellyClientAdapter
from .coordinator import SkellyCoordinator
import logging

_LOGGER = logging.getLogger(__name__)

DOMAIN = "skelly_ultra"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    address = entry.data.get("address")
    adapter = SkellyClientAdapter(hass, address=address)
    coordinator = SkellyCoordinator(hass, adapter)
    ok = await adapter.connect()
    if not ok:
        raise ConfigEntryNotReady("Failed to connect to Skelly device")

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "adapter": adapter,
        "coordinator": coordinator,
    }

    # Perform an initial refresh so the coordinator has data before notifications arrive
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as exc:
        _LOGGER.exception("Initial data refresh failed: %s", exc)
        # Let Home Assistant retry setup later
        raise ConfigEntryNotReady("Initial data refresh failed")

    # Start notifications only after coordinator and data structures are ready
    try:
        # Use adapter helper that retries starting notifications
        await adapter.start_notifications_with_retry()
    except Exception as exc:
        _LOGGER.exception("Failed to start notifications after retries: %s", exc)
        # don't fail setup — device is connected but notifications may be retried later
        pass
    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)
    # forward platforms (sensor, switch, light) if you create them
    hass.config_entries.async_setup_platforms(entry, ["sensor"])
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["adapter"].disconnect()
    return True
