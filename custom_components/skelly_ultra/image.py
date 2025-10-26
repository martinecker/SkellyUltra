"""Image platform for Skelly Ultra eye icon preview.

This image entity displays the currently-selected eye icon using the
coordinator data as the authoritative source. Image files are stored in
the integration's `images/` folder as `eye_icon_1.png`..`eye_icon_18.png`.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

from homeassistant.components.image import ImageEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ADDRESS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DOMAIN
from .coordinator import SkellyCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Set up the Skelly eye icon image entity for a config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: SkellyCoordinator = data["coordinator"]
    address = entry.data.get(CONF_ADDRESS) or data.get("adapter").address

    async_add_entities([SkellyEyeImage(coordinator, entry.entry_id, address)])


class SkellyEyeImage(CoordinatorEntity, ImageEntity):
    """Image entity that serves the currently selected eye icon image."""

    _attr_has_entity_name = True
    _attr_content_type = "image/png"

    def __init__(
        self, coordinator: SkellyCoordinator, entry_id: str, address: str | None
    ) -> None:
        """Initialize the image entity.

        coordinator: the update coordinator with `eye_icon` in data
        entry_id: used for unique id
        address: optional BLE address used as device identifier
        """
        # Initialize CoordinatorEntity
        super().__init__(coordinator)
        # Initialize ImageEntity internal state (requires hass)
        ImageEntity.__init__(self, coordinator.hass)

        self.coordinator = coordinator
        self._entry_id = entry_id
        self._attr_name = "Eye Icon"
        self._attr_unique_id = f"{entry_id}_eye_icon_image"
        if address:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, address)})

        # compute base images path
        self._images_path = Path(__file__).parent / "images"

    async def async_added_to_hass(self) -> None:
        """Register callbacks when entity is added and set initial state."""
        await super().async_added_to_hass()
        # Update timestamp to reflect the current coordinator value (if any)
        data = getattr(self.coordinator, "data", None)
        if data and data.get("eye_icon") is not None:
            self._attr_image_last_updated = datetime.now(tz=timezone.utc)
        # Ensure HA writes initial state
        self.async_write_ha_state()

    def _handle_coordinator_update(self) -> None:
        """Called when the coordinator has new data.

        Update the image_last_updated so the image proxy token changes and
        clients will re-fetch the image when the icon changes.
        """
        self._attr_image_last_updated = datetime.now(tz=timezone.utc)
        # Clear cached image so image() is called again
        self._cached_image = None
        super()._handle_coordinator_update()

    def image(self) -> bytes | None:
        """Return the bytes for the currently selected eye icon image.

        The coordinator stores `eye_icon` as a 1-based integer (1..18). If the
        coordinator has no data or the value is out of range, return None.
        """
        data: dict[str, Any] | None = getattr(self.coordinator, "data", None)
        if not data:
            return None
        eye = data.get("eye_icon")
        if not isinstance(eye, int):
            return None
        if eye < 1 or eye > 18:
            return None

        img_name = f"eye_icon_{eye}.png"
        img_path = self._images_path / img_name
        if not img_path.is_file():
            _LOGGER.debug("Eye icon image not found: %s", img_path)
            return None
        try:
            return img_path.read_bytes()
        except OSError:
            _LOGGER.exception("Failed to read eye icon image: %s", img_path)
            return None
