"""Button platform for triggering Skelly movement."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly buttons for the config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [SkellyTriggerMovementButton(coordinator, entry.entry_id, device_info)]
    )


class SkellyTriggerMovementButton(CoordinatorEntity, ButtonEntity):
    """Button that triggers one movement using the enabled movement switches.

    The device performs a movement when the movement action bitfield is set,
    so pressing this resends the current bitfield (the same command a
    movement switch sends when it is turned on).
    """

    _attr_has_entity_name = True
    _attr_icon = "mdi:run"

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the trigger movement button."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Trigger Movement"
        self._attr_unique_id = f"{entry_id}_trigger_movement"
        self._attr_device_info = device_info

    @property
    def available(self) -> bool:
        """The button is available after coordinator has a successful update."""
        return bool(getattr(self.coordinator, "last_update_success", False))

    async def async_press(self) -> None:
        """Resend the current movement action bitfield to the device."""
        async with self.coordinator.action_lock:
            data = getattr(self.coordinator, "data", None)
            action = data.get("action", 0) if data else 0

            if not action:
                _LOGGER.warning(
                    "Trigger Movement pressed but no movement switch is enabled"
                )
                return

            try:
                await self.coordinator.adapter.client.set_movement_action(action)
            except Exception:
                _LOGGER.exception("Failed to trigger movement")
