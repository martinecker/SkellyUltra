"""Per-entry runtime data of the Skelly Ultra integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN

if TYPE_CHECKING:
    from .client_adapter import SkellyClientAdapter
    from .coordinator import SkellyCoordinator
    from .media_player import SkellyLiveMediaPlayer
    from .perform import PerformManager
    from .sensor import SkellyFileTransferProgressSensor
    from .switch import SkellyLiveModeSwitch


class SkellyNotFoundError(HomeAssistantError):
    """The Skelly an action or message targets couldn't be found."""


@dataclass
class SkellyData:
    """What a set-up Skelly entry keeps in entry.runtime_data."""

    adapter: SkellyClientAdapter
    coordinator: SkellyCoordinator
    perform: PerformManager
    # Registered by the entities when they're added, so a disabled one
    # (never added) isn't used
    live_mode_switch: SkellyLiveModeSwitch | None = None
    live_media_player: SkellyLiveMediaPlayer | None = None
    transfer_sensor: SkellyFileTransferProgressSensor | None = None
    # Set at the start of tearing down, after the platforms unloaded; the
    # entry no longer counts as set up from then on
    unloading: bool = False


type SkellyConfigEntry = ConfigEntry[SkellyData]


def _active_data(entry: ConfigEntry) -> SkellyData | None:
    data = getattr(entry, "runtime_data", None)
    if not isinstance(data, SkellyData) or data.unloading:
        return None
    return data


def skelly_entries(hass: HomeAssistant) -> list[SkellyConfigEntry]:
    """Return the Skelly entries that are set up and not being torn down.

    This includes an entry still setting up its platforms, and one whose
    platforms failed to unload.
    """
    return [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if _active_data(entry) is not None
    ]


def get_skelly_data(hass: HomeAssistant, entry_id: str) -> SkellyData | None:
    """Return the runtime data of a set-up Skelly entry, or None."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        return None
    return _active_data(entry)


def skelly_data(hass: HomeAssistant, entry_id: str) -> SkellyData:
    """Return the runtime data of a set-up Skelly entry.

    Raises SkellyNotFoundError if the entry isn't set up.
    """
    data = get_skelly_data(hass, entry_id)
    if data is None:
        raise SkellyNotFoundError(f"Config entry {entry_id} is not a loaded Skelly")
    return data
