"""The firmware version: read on connect, shown as a sensor and on the device."""

from homeassistant.const import STATE_UNKNOWN
from homeassistant.helpers import device_registry as dr

from .conftest import advance, entity_id


def firmware_state(hass, entry) -> str:
    return hass.states.get(entity_id(hass, entry, "sensor", "firmware_version")).state


def device_sw_version(hass, entry) -> str | None:
    (device,) = dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)
    return device.sw_version


async def test_shows_firmware_version(hass, setup_integration, device):
    entry = setup_integration
    assert firmware_state(hass, entry) == "v68"
    assert device_sw_version(hass, entry) == "v68"


async def test_firmware_update_shows_after_reconnect(hass, setup_integration, device):
    """The device was updated with the phone app while HA was away."""
    entry = setup_integration
    device.drop_connection()
    await advance(hass, 0)
    device.firmware_version = 70
    await advance(hass, 3)  # background reconnect (first try after 2 s)

    assert device.is_connected
    assert firmware_state(hass, entry) == "v70"
    assert device_sw_version(hass, entry) == "v70"


async def test_device_without_version_reply_still_works(hass, mock_ble, config_entry):
    """A firmware that doesn't answer the version query is polled as usual."""
    mock_ble.firmware_version = None
    mock_ble.volume = 35
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    assert firmware_state(hass, config_entry) == STATE_UNKNOWN
    assert device_sw_version(hass, config_entry) is None
    assert (
        hass.states.get(entity_id(hass, config_entry, "sensor", "volume")).state == "35"
    )
