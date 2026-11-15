"""Setting up and unloading the integration."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra import _async_set_missing_unique_id
from custom_components.skelly_ultra.const import DOMAIN

from .conftest import ADDRESS, entity_id


async def test_setup_connects_and_shows_device_state(
    hass: HomeAssistant, setup_integration, device
):
    entry = setup_integration
    assert entry.state is ConfigEntryState.LOADED
    assert device.is_connected
    assert hass.states.get(entity_id(hass, entry, "sensor", "volume")).state == "50"


async def test_entry_from_before_unique_ids_gets_one(
    hass: HomeAssistant, config_entry, mock_ble
):
    hass.config_entries.async_update_entry(config_entry, unique_id=None)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert config_entry.unique_id == ADDRESS


async def test_second_entry_for_same_skelly_is_reported(
    hass: HomeAssistant, config_entry, caplog
):
    other = MockConfigEntry(domain=DOMAIN, title="Copy", data=dict(config_entry.data))
    other.add_to_hass(hass)
    _async_set_missing_unique_id(hass, other, ADDRESS)
    assert other.unique_id is None
    assert "set up for the same Skelly" in caplog.text
