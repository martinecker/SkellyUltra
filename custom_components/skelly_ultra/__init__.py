"""Home Assistant integration for Skelly Ultra.

This file creates a client adapter and coordinator and forwards setup to platforms.
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .client_adapter import SkellyClientAdapter
from .const import CONF_SERVER_URL, CONF_USE_BLE_PROXY, DEFAULT_SERVER_URL, DOMAIN
from .coordinator import SkellyCoordinator
from .services import register_services, unregister_services

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.SELECT,
    Platform.LIGHT,
    Platform.NUMBER,
    Platform.IMAGE,
    Platform.SWITCH,
    Platform.MEDIA_PLAYER,
]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a Skelly Ultra config entry.

    Create the client adapter and coordinator, start notifications and
    forward setup to platforms.
    """
    # Ensure config-entry options contain defaults for the connection switches
    options = dict(entry.options)
    options_changed = False
    if "connected" not in options:
        options["connected"] = True
        options_changed = True
    if "live_mode_connected" not in options:
        options["live_mode_connected"] = False
        options_changed = True
    if options_changed:
        hass.config_entries.async_update_entry(entry, options=options)

    address = entry.data.get("address")
    server_url = entry.data.get(CONF_SERVER_URL, DEFAULT_SERVER_URL)
    use_ble_proxy = entry.data.get(CONF_USE_BLE_PROXY, False)
    adapter = SkellyClientAdapter(
        hass,
        address=address,
        server_url=server_url,
        use_ble_proxy=use_ble_proxy,
        live_mode_should_connect=options.get("live_mode_connected", False),
        live_mode_pin=options.get("live_mode_pin"),
    )
    coordinator = SkellyCoordinator(hass, entry, adapter)

    # Check if Connected switch is on (defaults to True)
    is_connected = options.get("connected", True)

    # Start connection and initialization in background to avoid blocking setup
    # This allows the integration to load even if the device is not available
    async def _initialize_device() -> None:
        """Initialize device connection, notifications, and perform initial data fetch."""
        if not is_connected:
            # Switch is off - pause coordinator immediately
            coordinator.pause_updates()
            coordinator.notify_done_initializing()
            _LOGGER.info(
                "Connected switch is off - skipping connection and pausing updates"
            )
            return

        # Attempt to connect to the device
        try:
            ok = await adapter.connect()
            if not ok:
                _LOGGER.warning(
                    "Failed to connect to Skelly device during initialization, "
                    "coordinator will retry on next update cycle"
                )
                coordinator.notify_done_initializing()
                return
        except Exception:
            _LOGGER.exception(
                "Exception while connecting to Skelly device during initialization, "
                "coordinator will retry on next update cycle"
            )
            coordinator.notify_done_initializing()
            return

        coordinator.notify_done_initializing()

        # Perform immediate initial coordinator refresh after successful connection
        try:
            await coordinator.async_refresh()
        except Exception:
            _LOGGER.exception("Initial data refresh failed, will retry on next update")

    # Start initialization in background - don't block setup
    hass.async_create_task(_initialize_device())

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "adapter": adapter,
        "coordinator": coordinator,
    }

    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)

    # Register services (only once for the first entry)
    if len(hass.data[DOMAIN]) == 1:
        register_services(hass)

    # Forward setup to entity platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and disconnect the adapter."""
    if entry.entry_id not in hass.data.get(DOMAIN, {}):
        return True

    data = hass.data[DOMAIN][entry.entry_id]

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        return False

    hass.data[DOMAIN].pop(entry.entry_id)
    # Ensure any live-mode classic BT client is disconnected first
    try:
        await data["adapter"].disconnect_live_mode()
    except Exception:
        _LOGGER.debug(
            "Failed to disconnect live-mode BT classic client during unload",
            exc_info=True,
        )

    try:
        await data["adapter"].disconnect()
    except Exception:
        _LOGGER.debug("Failed to disconnect BLE client during unload", exc_info=True)

    # If there are no more entries for this domain, remove the services
    if not hass.data[DOMAIN]:
        unregister_services(hass)

    return True
