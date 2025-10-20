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

    # Start notifications before performing the initial refresh so responses
    # to queries (which arrive via notifications) are delivered to the
    # client's event queue. If starting notifications fails, we still attempt
    # the initial refresh but it may time out.
    try:
        started = await adapter.start_notifications_with_retry()
        if not started:
            _LOGGER.warning(
                "Notifications could not be started before initial refresh; "
                "initial data fetch may time out"
            )
    except Exception:
        _LOGGER.exception("Unexpected error while starting notifications")

    # Perform an initial refresh so the coordinator has data before entities
    # are available. If this fails Home Assistant will retry setup later.
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as exc:
        _LOGGER.exception("Initial data refresh failed: %s", exc)
        # Let Home Assistant retry setup later
        raise ConfigEntryNotReady("Initial data refresh failed")
    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)

    # forward async_setup_entry calls to other platforms (sensor, switch, light) to create entities
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["adapter"].disconnect()
    return True
