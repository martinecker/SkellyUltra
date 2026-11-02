"""Button platform: trigger a movement, push settings, clear perform history."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SkellyCoordinator
from .helpers import get_device_info
from .perform import PerformManager

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
):
    """Set up the Skelly buttons for the config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    device_info = get_device_info(hass, entry)

    async_add_entities(
        [
            SkellyTriggerMovementButton(coordinator, entry.entry_id, device_info),
            SkellyPushSettingsButton(coordinator, entry.entry_id, device_info),
            SkellyClearPerformHistoryButton(
                data["perform"], entry.entry_id, device_info
            ),
        ]
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


class SkellyPushSettingsButton(CoordinatorEntity, ButtonEntity):
    """Button that sends HA's light, eye and volume settings to the device.

    The device can show a different look than it reports (e.g. after a
    power-up) until it gets a write; this sends every setting HA shows,
    never movement. Works whether or not the ha_controls_settings option,
    which does the same on every connect, is on.
    """

    _attr_has_entity_name = True
    _attr_icon = "mdi:upload"
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the push settings button."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Push Settings to Skelly"
        self._attr_unique_id = f"{entry_id}_push_settings"
        self._attr_device_info = device_info

    @property
    def available(self) -> bool:
        """Available while the device is connected and has been polled."""
        return bool(
            getattr(self.coordinator, "last_update_success", False)
            and self.coordinator.adapter.client.is_connected
        )

    async def async_press(self) -> None:
        """Send the settings; raises HomeAssistantError if that isn't possible."""
        await self.coordinator.async_push_settings()


class SkellyClearPerformHistoryButton(ButtonEntity):
    """Button that forgets the AI lines skelly_ultra.perform told not to repeat."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:history"
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(
        self,
        manager: PerformManager,
        entry_id: str,
        device_info: DeviceInfo | None,
    ) -> None:
        """Initialize the clear perform history button."""
        self._manager = manager
        self._attr_name = "Clear Perform History"
        self._attr_unique_id = f"{entry_id}_clear_perform_history"
        self._attr_device_info = device_info

    async def async_press(self) -> None:
        """Clear the perform line history."""
        await self._manager.async_clear()
        _LOGGER.info("Cleared perform history")
