"""Home Assistant integration for Skelly Ultra.

This file creates a client adapter and coordinator and forwards setup to platforms.
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback

from .client_adapter import SkellyClientAdapter
from .const import CONF_SERVER_URL, CONF_USE_BLE_PROXY, DEFAULT_SERVER_URL, DOMAIN
from .coordinator import SkellyCoordinator, async_remove_settings
from .data import SkellyConfigEntry, SkellyData, get_skelly_data, skelly_entries
from .frontend import async_setup_frontend, async_update_panel
from .helpers import DeviceLoggerAdapter, get_device_info, get_device_name
from .perform import PerformManager, async_remove_perform_history
from .services import register_services, unregister_services
from .websocket_api import async_end_file_subscriptions, async_setup_websocket_api

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.SELECT,
    Platform.LIGHT,
    Platform.NUMBER,
    Platform.IMAGE,
    Platform.SWITCH,
    Platform.BUTTON,
    Platform.MEDIA_PLAYER,
]


@callback
def _async_set_missing_unique_id(
    hass: HomeAssistant, entry: ConfigEntry, address: str | None
) -> None:
    """Give an entry made before unique IDs its Skelly's address as unique ID.

    The config flow then won't add the same Skelly again. If another entry
    already has that ID, both manage the same Skelly: this one is left
    without an ID and a warning is logged.
    """
    if entry.unique_id is not None or not address:
        return
    unique_id = address.upper()
    other = next(
        (
            e
            for e in hass.config_entries.async_entries(DOMAIN)
            if e.unique_id == unique_id and e.entry_id != entry.entry_id
        ),
        None,
    )
    if other is not None:
        _LOGGER.warning(
            "%s and %s are set up for the same Skelly (%s); remove one of them, "
            "since they compete for its Bluetooth connection",
            entry.title,
            other.title,
            address,
        )
        return
    hass.config_entries.async_update_entry(entry, unique_id=unique_id)


async def async_setup_entry(hass: HomeAssistant, entry: SkellyConfigEntry) -> bool:
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
    _async_set_missing_unique_id(hass, entry, address)
    server_url = entry.data.get(CONF_SERVER_URL, DEFAULT_SERVER_URL)
    use_ble_proxy = entry.data.get(CONF_USE_BLE_PROXY, False)
    device_info = get_device_info(hass, entry)
    device_name = get_device_name(entry, device_info)
    device_logger = DeviceLoggerAdapter(_LOGGER, {"device_name": device_name})

    @callback
    def _save_live_mode_wanted(wanted: bool) -> None:
        if entry.options.get("live_mode_connected") != wanted:
            hass.config_entries.async_update_entry(
                entry, options={**entry.options, "live_mode_connected": wanted}
            )

    adapter = SkellyClientAdapter(
        hass,
        address=address,
        server_url=server_url,
        use_ble_proxy=use_ble_proxy,
        live_mode_should_connect=options.get("live_mode_connected", False),
        logger=device_logger,
        save_live_mode_wanted=_save_live_mode_wanted,
    )
    coordinator = SkellyCoordinator(
        hass,
        entry,
        adapter,
        device_info,
        device_logger,
    )
    # Play/pause reports hold off polling (it would stop the file)
    entry.async_on_unload(
        adapter.client.add_event_listener(coordinator.handle_device_event)
    )

    # Before the first connect, which may send these settings to the device
    await coordinator.async_load_settings()

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

        # The Connected switch is on: keep reconnecting (poll, commands) even
        # if this first attempt fails
        adapter.enable_auto_reconnect()

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

    perform_manager = PerformManager(hass, entry.entry_id)
    await perform_manager.async_load()

    # Start initialization in background - don't block setup
    hass.async_create_task(_initialize_device())

    entry.runtime_data = SkellyData(
        adapter=adapter, coordinator=coordinator, perform=perform_manager
    )

    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)

    # Register services (only once for the first entry)
    if len(skelly_entries(hass)) == 1:
        register_services(hass)

    # Websocket commands for a file manager UI (registered once per run)
    await async_setup_websocket_api(hass)

    # The Skelly sidebar panel and dashboard card
    await async_setup_frontend(hass)
    await async_update_panel(hass)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    # Forward setup to entity platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: SkellyConfigEntry) -> bool:
    """Unload a config entry and disconnect the adapter."""
    data = get_skelly_data(hass, entry.entry_id)
    if data is None:
        return True

    # Before anything is torn down, so no update reaches a subscriber mid-unload
    async_end_file_subscriptions(hass, entry.entry_id)
    # Ending playback tracking would send settings held back while a file plays
    data.coordinator.async_stop_settings_push()

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        data.coordinator.async_resume_settings_push()
        return False

    # From here on the entry no longer counts as set up; HA removes
    # runtime_data once this returns
    data.unloading = True
    data.adapter.stop_auto_reconnect()
    # Ensure any live-mode classic BT client is disconnected first
    try:
        await data.adapter.disconnect_live_mode()
    except Exception:
        _LOGGER.debug(
            "Failed to disconnect live-mode BT classic client during unload",
            exc_info=True,
        )

    try:
        await data.adapter.disconnect()
    except Exception:
        _LOGGER.debug("Failed to disconnect BLE client during unload", exc_info=True)
    # After the disconnect, so no play report can start it again
    data.coordinator.async_stop_playback_timer()

    # Before a removal deletes the file, so a delayed save can't recreate it
    await data.coordinator.async_flush_settings()

    # If there are no more entries for this domain, remove the services
    if not skelly_entries(hass):
        unregister_services(hass)

    # Remove the panel if no loaded entry shows it any more
    await async_update_panel(hass)

    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Show or hide the sidebar panel when the show_panel option changes."""
    await async_update_panel(hass)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Delete data stored for a removed config entry."""
    await async_remove_perform_history(hass, entry.entry_id)
    await async_remove_settings(hass, entry.entry_id)
