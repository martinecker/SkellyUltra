"""Connecting, losing the link and getting it back.

The Skelly's BLE link drops in practice (out of range, the device resetting
itself). These tests check what a user sees: entities go unavailable right
away, come back on their own, and commands still work after a drop.
"""

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import ATTR_ENTITY_ID, STATE_UNAVAILABLE, STATE_UNKNOWN

from custom_components.skelly_ultra.const import DOMAIN

from .conftest import advance, entity_id


def volume_state(hass, entry) -> str:
    return hass.states.get(entity_id(hass, entry, "sensor", "volume")).state


async def test_drop_makes_entities_unavailable_at_once(hass, setup_integration, device):
    entry = setup_integration
    device.reachable = False
    device.drop_connection()
    await hass.async_block_till_done()
    assert volume_state(hass, entry) == STATE_UNAVAILABLE


async def test_reconnects_on_its_own_after_drop(hass, setup_integration, device):
    entry = setup_integration
    device.reachable = False
    device.drop_connection()
    await hass.async_block_till_done()

    # Still away: background attempts fail, entities stay unavailable.
    await advance(hass, 10)
    assert not device.is_connected
    assert volume_state(hass, entry) == STATE_UNAVAILABLE

    # Back in range: reconnected well before the next 30s poll.
    device.reachable = True
    device.volume = 42
    await advance(hass, 16)
    assert device.is_connected
    assert volume_state(hass, entry) == "42"


async def test_command_on_silently_dropped_link_reconnects_first(
    hass, setup_integration, device
):
    entry = setup_integration
    device.drop_connection(notify=False)

    await hass.services.async_call(
        "number",
        "set_value",
        {
            ATTR_ENTITY_ID: entity_id(hass, entry, "number", "volume_number"),
            "value": 77,
        },
        blocking=True,
    )
    assert device.is_connected
    assert device.volume == 77


async def test_setup_succeeds_while_device_is_away(hass, config_entry, mock_ble):
    device = mock_ble
    device.reachable = False
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert config_entry.state is ConfigEntryState.LOADED
    assert volume_state(hass, config_entry) in (STATE_UNKNOWN, STATE_UNAVAILABLE)

    # Turned on later: picked up by the regular poll.
    device.reachable = True
    await advance(hass, 31)
    assert device.is_connected
    assert volume_state(hass, config_entry) == "50"


async def test_connected_switch_off_stays_disconnected(hass, setup_integration, device):
    entry = setup_integration
    switch = entity_id(hass, entry, "switch", "connected")
    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await hass.async_block_till_done()
    assert not device.is_connected
    assert entry.options["connected"] is False

    await advance(hass, 120)
    assert not device.is_connected, "no automatic reconnect while switched off"

    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await hass.async_block_till_done()
    assert device.is_connected
    assert entry.options["connected"] is True
    assert volume_state(hass, entry) == "50"


async def test_connected_switch_off_survives_restart(hass, config_entry, mock_ble):
    hass.config_entries.async_update_entry(config_entry, options={"connected": False})
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await advance(hass, 60)
    assert mock_ble.connect_count == 0


async def test_unload_disconnects_and_stops_reconnecting(
    hass, setup_integration, device
):
    entry = setup_integration
    assert hass.services.has_service(DOMAIN, "play_file")
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert not device.is_connected
    assert not hass.services.has_service(DOMAIN, "play_file")
    connects = device.connect_count
    await advance(hass, 120)
    assert device.connect_count == connects


async def test_unresponsive_device_marks_entities_unavailable(
    hass, setup_integration, device
):
    entry = setup_integration
    device.unresponsive = True
    await advance(hass, 31)  # next poll starts
    await advance(hass, 20)  # its queries time out
    assert volume_state(hass, entry) == STATE_UNAVAILABLE

    device.unresponsive = False
    await advance(hass, 31)
    assert volume_state(hass, entry) == "50"


@pytest.mark.xfail(
    strict=True,
    reason="Known issue: the coordinator ignores refresh requests within 3s of "
    "the last one, so turning Connected back on right after turning it off "
    "leaves entities unavailable until the next 30s poll.",
)
async def test_connected_switch_quick_off_on(hass, setup_integration, device):
    entry = setup_integration
    switch = entity_id(hass, entry, "switch", "connected")
    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await advance(hass, 1)
    assert volume_state(hass, entry) == "50"


async def test_device_state_wins_after_reconnect(hass, setup_integration, device):
    """Changes made on the device while HA was away (phone app, a reset)
    show up in HA right after the reconnect; HA doesn't overwrite them.

    The volume change just before the drop also checks that a recent
    refresh request doesn't hold back the refresh after the reconnect.
    """
    entry = setup_integration
    await hass.services.async_call(
        "number",
        "set_value",
        {
            ATTR_ENTITY_ID: entity_id(hass, entry, "number", "volume_number"),
            "value": 80,
        },
        blocking=True,
    )
    await advance(hass, 5)

    device.drop_connection()
    await advance(hass, 0)
    device.volume = 20  # changed in the phone app while disconnected
    device.lights[0].rgb = (0, 0, 255)
    await advance(hass, 3)  # background reconnect (first try after 2 s)

    assert device.is_connected
    assert device.volume == 20
    assert device.lights[0].rgb == (0, 0, 255)
    assert volume_state(hass, entry) == "20"
    light = hass.states.get(entity_id(hass, entry, "light", "light_0"))
    assert light.attributes["rgb_color"] == (0, 0, 255)
