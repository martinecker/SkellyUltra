"""Home Assistant integration for Skelly Ultra (minimal scaffold).

This file creates a client adapter and coordinator and forwards setup to platforms.
"""

from __future__ import annotations

import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .client_adapter import SkellyClientAdapter
from .coordinator import SkellyCoordinator

_LOGGER = logging.getLogger(__name__)

DOMAIN = "skelly_ultra"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a Skelly Ultra config entry.

    Create the client adapter and coordinator, start notifications and
    forward setup to platforms.
    """
    address = entry.data.get("address")
    server_url = entry.data.get("server_url", "http://localhost:8765")
    adapter = SkellyClientAdapter(hass, address=address, server_url=server_url)
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
        _LOGGER.exception("Initial data refresh failed")
        # Let Home Assistant retry setup later
        raise ConfigEntryNotReady("Initial data refresh failed") from exc
    _LOGGER.info("Skelly Ultra integration setup complete for entry %s", entry.entry_id)

    # forward async_setup_entry calls to other platforms to create entities
    await hass.config_entries.async_forward_entry_setups(
        entry,
        ["sensor", "select", "light", "number", "image", "switch", "media_player"],
    )

    # Register services for enabling classic Bluetooth. The service accepts
    # either a device_id (device registry id) or an entity_id. If entity_id
    # is provided, the device_id is derived from the entity registry.
    SERVICE_ENABLE_CLASSIC_BT = vol.Schema(
        {
            vol.Optional("device_id"): cv.string,
            vol.Optional("entity_id"): cv.entity_id,
        }
    )

    async def _enable_classic_bt_service(call) -> None:
        """Enable classic Bluetooth speaker mode for a specific device.

        The service accepts either `device_id` or `entity_id`. If neither is
        provided and there is exactly one configured entry for this
        integration, that entry will be used.
        """
        device_id = call.data.get("device_id")
        entity_id = call.data.get("entity_id")

        # If entity_id provided, resolve to device_id
        if not device_id and entity_id:
            ent_reg = er.async_get(hass)
            ent = ent_reg.async_get(entity_id)
            if not ent:
                _LOGGER.error("Entity %s not found", entity_id)
                return
            if not ent.device_id:
                _LOGGER.error("Entity %s has no device_id", entity_id)
                return
            device_id = ent.device_id

        # If no device specified, attempt to use single entry if available
        if not device_id:
            entries = hass.data.get(DOMAIN, {})
            if len(entries) == 1:
                # use the only entry
                entry_id = next(iter(entries))
                adapter = entries[entry_id]["adapter"]
                try:
                    await adapter.client.enable_classic_bt()
                    _LOGGER.info(
                        "Requested classic Bluetooth enable for entry %s", entry_id
                    )
                except Exception:
                    _LOGGER.exception("Failed to enable classic Bluetooth")
                return
            _LOGGER.error(
                "No device_id or entity_id provided and multiple Skelly entries present"
            )
            return

        # Lookup device in device registry and find a config entry that matches
        dev_reg = dr.async_get(hass)
        device = dev_reg.async_get(device_id)
        if not device:
            _LOGGER.error("Device %s not found", device_id)
            return

        # Find a config entry id for this integration within the device
        entry_id: str | None = None
        for ce in device.config_entries:
            if ce in hass.data.get(DOMAIN, {}):
                entry_id = ce
                break

        if not entry_id:
            _LOGGER.error(
                "Device %s is not associated with %s integration", device_id, DOMAIN
            )
            return

        adapter = hass.data[DOMAIN][entry_id]["adapter"]
        try:
            await adapter.client.enable_classic_bt()
            _LOGGER.info(
                "Requested classic Bluetooth enable for device %s (entry %s)",
                device_id,
                entry_id,
            )
        except Exception:
            _LOGGER.exception(
                "Failed to enable classic Bluetooth for device %s", device_id
            )

    hass.services.async_register(
        DOMAIN,
        "enable_classic_bt",
        _enable_classic_bt_service,
        schema=SERVICE_ENABLE_CLASSIC_BT,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and disconnect the adapter."""
    data = hass.data[DOMAIN].pop(entry.entry_id)
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

    # If there are no more entries for this domain, remove the service
    if not hass.data[DOMAIN]:
        # Remove the service if it was registered
        if hass.services.has_service(DOMAIN, "enable_classic_bt"):
            hass.services.async_remove(DOMAIN, "enable_classic_bt")

    return True
