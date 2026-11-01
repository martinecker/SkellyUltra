"""Setting up and unloading the integration."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from .conftest import entity_id


async def test_setup_connects_and_shows_device_state(
    hass: HomeAssistant, setup_integration, device
):
    entry = setup_integration
    assert entry.state is ConfigEntryState.LOADED
    assert device.is_connected
    assert hass.states.get(entity_id(hass, entry, "sensor", "volume")).state == "50"
