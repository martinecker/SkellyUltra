"""Base classes for Skelly Ultra entities."""

from __future__ import annotations

import contextlib
from collections.abc import Awaitable, Callable
from typing import Any

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .coordinator import SkellyCoordinator


async def async_run_command(command: Awaitable[Any], failure: str) -> Any:
    """Await a device command; raise HomeAssistantError if it fails.

    failure says what didn't work, e.g. "Couldn't set the volume". The error
    then reaches the UI as a toast and lets automations handle it.
    """
    try:
        return await command
    except HomeAssistantError:
        raise
    except Exception as err:
        raise HomeAssistantError(
            f"{failure}: {str(err) or type(err).__name__}"
        ) from err


class SkellyEntity(Entity):
    """An entity of one Skelly: unique ID from the entry, on its device."""

    _attr_has_entity_name = True

    def __init__(
        self,
        entry_id: str,
        device_info: DeviceInfo | None,
        key: str,
        name: str | None = None,
    ) -> None:
        """Initialize; the unique ID is "<entry_id>_<key>"."""
        self._attr_unique_id = f"{entry_id}_{key}"
        self._attr_device_info = device_info
        if name is not None:
            self._attr_name = name


class SkellyCoordinatorEntity(CoordinatorEntity[SkellyCoordinator], SkellyEntity):
    """A Skelly entity showing the coordinator's data.

    Available while the last poll succeeded (CoordinatorEntity's default).
    """

    def __init__(
        self,
        coordinator: SkellyCoordinator,
        entry_id: str,
        device_info: DeviceInfo | None,
        key: str,
        name: str | None = None,
    ) -> None:
        """Initialize; the unique ID is "<entry_id>_<key>"."""
        CoordinatorEntity.__init__(self, coordinator)
        SkellyEntity.__init__(self, entry_id, device_info, key, name)

    @property
    def coordinator_data(self) -> dict[str, Any]:
        """Return the coordinator's data, empty before the first poll."""
        return self.coordinator.data or {}

    def light_data(self, channel: int) -> dict[str, Any]:
        """Return the coordinator's data for one light channel (may be empty)."""
        lights = self.coordinator_data.get("lights") or []
        return lights[channel] if channel < len(lights) else {}

    async def _async_command(
        self,
        command: Awaitable[Any],
        failure: str,
        update: Callable[[], None] | None = None,
    ) -> None:
        """Send a command, show its result at once, then poll the device.

        Raises HomeAssistantError (see async_run_command) if the command
        fails; nothing is changed then. Otherwise update, if given, puts the
        expected result into the coordinator's data (see
        SkellyCoordinator.async_update_data_optimistic and async_update_light)
        until the next poll reads it back from the device.
        """
        await async_run_command(command, failure)
        if update is not None:
            update()
        self.async_write_ha_state()
        # The command went through; a failed poll shows up on its own
        with contextlib.suppress(Exception):
            await self.coordinator.async_request_refresh()
