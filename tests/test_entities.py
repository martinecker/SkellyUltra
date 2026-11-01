"""Controlling the Skelly through its Home Assistant entities.

Each test changes something the way a user or automation would (a service
call on an entity) and checks the effect on the simulated device, then that
Home Assistant shows the new state.
"""

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    DEVICE_TYPE_LILY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)

from .conftest import entity_id
from .device_sim import Light


async def call(hass, domain, service, eid, **data):
    await hass.services.async_call(
        domain, service, {ATTR_ENTITY_ID: eid, **data}, blocking=True
    )
    await hass.async_block_till_done()


async def test_entities_show_device_state(hass: HomeAssistant, mock_ble, config_entry):
    device = mock_ble
    device.volume = 35
    device.eye_icon = 10
    device.action = 0x01 | 0x04  # head + torso
    device.lights[1] = Light(
        effect_type=3, brightness=128, rgb=(0, 255, 0), effect_speed=50
    )
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    entry = config_entry

    assert (
        hass.states.get(entity_id(hass, entry, "number", "volume_number")).state == "35"
    )
    assert (
        hass.states.get(entity_id(hass, entry, "select", "eye_icon")).state == "10 Fire"
    )
    assert (
        hass.states.get(entity_id(hass, entry, "switch", "movement_head")).state
        == STATE_ON
    )
    assert (
        hass.states.get(entity_id(hass, entry, "switch", "movement_arm")).state
        == STATE_OFF
    )
    assert (
        hass.states.get(entity_id(hass, entry, "switch", "movement_torso")).state
        == STATE_ON
    )
    assert (
        hass.states.get(entity_id(hass, entry, "switch", "movement_all")).state
        == STATE_OFF
    )
    head = hass.states.get(entity_id(hass, entry, "light", "light_1"))
    assert head.state == STATE_ON
    assert head.attributes["rgb_color"] == (0, 255, 0)
    assert head.attributes["brightness"] == 128
    assert (
        hass.states.get(entity_id(hass, entry, "select", "effect_mode_1")).state
        == "Pulse"
    )
    # The UI shows speed as "higher is faster"; the device stores it inverted.
    assert (
        hass.states.get(entity_id(hass, entry, "number", "effect_speed_1")).state
        == "204"
    )


async def test_set_volume(hass, setup_integration, device):
    eid = entity_id(hass, setup_integration, "number", "volume_number")
    await call(hass, "number", "set_value", eid, value=80)
    assert device.volume == 80
    assert hass.states.get(eid).state == "80"


async def test_light_color_brightness_and_off(hass, setup_integration, device):
    eid = entity_id(hass, setup_integration, "light", "light_0")
    await call(hass, "light", "turn_on", eid, rgb_color=(10, 20, 30), brightness=100)
    assert device.lights[0].rgb == (10, 20, 30)
    assert device.lights[0].brightness == 100
    assert device.lights[1].rgb == (255, 0, 0), "other channel untouched"
    state = hass.states.get(eid)
    assert state.state == STATE_ON and state.attributes["rgb_color"] == (10, 20, 30)

    await call(hass, "light", "turn_off", eid)
    assert device.lights[0].brightness == 0
    assert hass.states.get(eid).state == STATE_OFF

    # Turning back on without a brightness doesn't leave it dark.
    await call(hass, "light", "turn_on", eid)
    assert device.lights[0].brightness > 0
    assert device.lights[0].rgb == (10, 20, 30)


async def test_color_cycle_keeps_color(hass, setup_integration, device):
    entry = setup_integration
    await call(
        hass,
        "light",
        "turn_on",
        entity_id(hass, entry, "light", "light_0"),
        rgb_color=(1, 2, 3),
    )
    eid = entity_id(hass, entry, "switch", "color_cycle_0")
    await call(hass, "switch", "turn_on", eid)
    assert device.lights[0].color_cycle == 1
    assert device.lights[0].rgb == (1, 2, 3)
    assert hass.states.get(eid).state == STATE_ON
    await call(hass, "switch", "turn_off", eid)
    assert device.lights[0].color_cycle == 0


async def test_light_effect_mode_and_speed(hass, setup_integration, device):
    entry = setup_integration
    await call(
        hass,
        "select",
        "select_option",
        entity_id(hass, entry, "select", "effect_mode_0"),
        option="Strobe",
    )
    assert device.lights[0].effect_type == 2
    await call(
        hass,
        "number",
        "set_value",
        entity_id(hass, entry, "number", "effect_speed_0"),
        value=254,
    )
    # Fastest in the UI is the device's fastest speed (0 or 255).
    assert device.lights[0].effect_speed in (0, 255)
    await call(
        hass,
        "number",
        "set_value",
        entity_id(hass, entry, "number", "effect_speed_0"),
        value=0,
    )
    assert device.lights[0].effect_speed == 254  # slowest


async def test_eye_icon(hass, setup_integration, device):
    eid = entity_id(hass, setup_integration, "select", "eye_icon")
    await call(hass, "select", "select_option", eid, option="15 Heart")
    assert device.eye_icon == 15
    assert hass.states.get(eid).state == "15 Heart"


async def test_movement_switches_combine(hass, setup_integration, device):
    entry = setup_integration
    head = entity_id(hass, entry, "switch", "movement_head")
    arm = entity_id(hass, entry, "switch", "movement_arm")
    everything = entity_id(hass, entry, "switch", "movement_all")

    await call(hass, "switch", "turn_on", head)
    await call(hass, "switch", "turn_on", arm)
    assert device.action == 0x03
    await call(hass, "switch", "turn_off", head)
    assert device.action == 0x02, "turning one part off keeps the others"

    await call(hass, "switch", "turn_on", everything)
    assert device.action == 255
    assert hass.states.get(head).state == STATE_ON
    await call(hass, "switch", "turn_off", everything)
    assert device.action == 0
    assert hass.states.get(arm).state == STATE_OFF


async def test_file_sensors(hass, setup_integration, device):
    entry = setup_integration
    assert (
        hass.states.get(entity_id(hass, entry, "sensor", "file_count_reported")).state
        == "3"
    )
    assert (
        hass.states.get(entity_id(hass, entry, "sensor", "file_count_received")).state
        == "3"
    )
    assert (
        hass.states.get(entity_id(hass, entry, "sensor", "capacity_kb")).state == "4000"
    )
    assert hass.states.get(entity_id(hass, entry, "sensor", "pin_code")).state == "1234"


def _unique_ids(hass, entry) -> set[str]:
    ent_reg = er.async_get(hass)
    return {
        e.unique_id.removeprefix(f"{entry.entry_id}_")
        for e in er.async_entries_for_config_entry(ent_reg, entry.entry_id)
    }


@pytest.mark.parametrize(
    ("device_type", "present", "absent"),
    [
        (
            DEVICE_TYPE_SKELLY_12FT,
            {"movement_head", "light_0", "eye_icon"},
            {"movement_all", "movement_arm", "movement_torso", "light_1"},
        ),
        (
            DEVICE_TYPE_LILY,
            {"light_0"},
            {"eye_icon", "eye_icon_image", "movement_arm", "light_1"},
        ),
    ],
)
async def test_entities_follow_device_profile(
    hass, mock_ble, device_type, present, absent
):
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"address": mock_ble.address, CONF_DEVICE_TYPE: device_type},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    ids = _unique_ids(hass, entry)
    assert present <= ids
    assert not absent & ids


async def test_12ft_head_movement_uses_its_own_bit(hass, mock_ble):
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"address": mock_ble.address, CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY_12FT},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await call(
        hass, "switch", "turn_on", entity_id(hass, entry, "switch", "movement_head")
    )
    # Captured from the 12ft Skelly's app: head is bit 0x02 on this model.
    assert mock_ble.action == 0x02
