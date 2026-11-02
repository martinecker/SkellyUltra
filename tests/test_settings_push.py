"""Sending Home Assistant's light, eye and volume settings to the Skelly.

After a power-up the device can show a different look than it reports
until it gets a write. With the ha_controls_settings option on, HA sends
the settings it last knew on every connect; the Push Settings button does
the same on demand. Movement is never sent, since that starts a move.
"""

import asyncio
from datetime import timedelta
from unittest.mock import patch

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_UNAVAILABLE
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    CONF_HA_CONTROLS_SETTINGS,
    DEVICE_TYPE_LILY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)

from .conftest import ADDRESS, advance, coordinator, entity_id

VOLUME = b"\xaa\xfa"
BRIGHTNESS = b"\xaa\xf3"
EFFECT = b"\xaa\xf2"
RGB = b"\xaa\xf4"
SPEED = b"\xaa\xf6"
EYE = b"\xaa\xf9"
MOVEMENT = b"\xaa\xca"
SETTING_TAGS = (VOLUME, BRIGHTNESS, EFFECT, RGB, SPEED, EYE)


def writes(device, *tags) -> list[bytes]:
    return [w for w in device.writes if w[:2] in tags]


def ha_controls(hass, entry, on: bool = True) -> None:
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, CONF_HA_CONTROLS_SETTINGS: on}
    )


def volume_state(hass, entry) -> str:
    return hass.states.get(entity_id(hass, entry, "sensor", "volume")).state


def change_device_while_away(device) -> None:
    """What a phone app or a reset might do while HA is disconnected."""
    device.volume = 20
    device.eye_icon = 5
    device.lights[0].rgb = (0, 0, 255)
    device.lights[0].brightness = 10
    device.lights[1].effect_type = 3
    device.lights[1].effect_speed = 100


def assert_initial_settings(device) -> None:
    assert device.volume == 50
    assert device.eye_icon == 1
    assert device.lights[0].rgb == (255, 0, 0)
    assert device.lights[0].brightness == 255
    assert device.lights[1].effect_type == 1
    assert device.lights[1].effect_speed == 0


async def drop_and_reconnect(hass, device, change=None) -> None:
    device.drop_connection()
    await advance(hass, 0)
    if change:
        change(device)
    await advance(hass, 3)  # background reconnect (first try after 2 s)
    assert device.is_connected


async def test_option_on_restores_ha_settings_after_reconnect(
    hass, setup_integration, device
):
    entry = setup_integration
    ha_controls(hass, entry)
    device.writes.clear()

    await drop_and_reconnect(hass, device, change_device_while_away)

    assert_initial_settings(device)
    assert volume_state(hass, entry) == "50"
    light = hass.states.get(entity_id(hass, entry, "light", "light_0"))
    assert light.attributes["rgb_color"] == (255, 0, 0)
    assert not writes(device, MOVEMENT)


async def test_option_on_sends_settings_even_if_device_reports_them(
    hass, setup_integration, device
):
    """The device may report the right values but show another look."""
    entry = setup_integration
    ha_controls(hass, entry)
    device.writes.clear()

    await drop_and_reconnect(hass, device)

    assert len(writes(device, VOLUME)) == 1
    assert len(writes(device, EYE)) == 1
    # Ultra Skelly: two light channels, each brightness, effect, speed, RGB
    for tag in (BRIGHTNESS, EFFECT, SPEED, RGB):
        assert sorted(w[2] for w in writes(device, tag)) == [0, 1]
    assert not writes(device, MOVEMENT)


async def test_option_off_sends_nothing_on_reconnect(hass, setup_integration, device):
    device.writes.clear()
    await drop_and_reconnect(hass, device, change_device_while_away)
    assert not writes(device, *SETTING_TAGS, MOVEMENT)
    assert device.volume == 20


async def test_settings_sent_before_first_poll_after_restart(
    hass, setup_integration, device
):
    """After an HA restart, the settings HA knew come from storage."""
    entry = setup_integration
    ha_controls(hass, entry)
    await hass.services.async_call(
        "number",
        "set_value",
        {
            ATTR_ENTITY_ID: entity_id(hass, entry, "number", "volume_number"),
            "value": 66,
        },
        blocking=True,
    )
    await advance(hass, 5)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    change_device_while_away(device)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert device.volume == 66
    assert device.lights[0].rgb == (255, 0, 0)
    assert device.eye_icon == 1
    assert volume_state(hass, entry) == "66"


async def test_nothing_sent_before_settings_are_known(hass, config_entry, mock_ble):
    """First setup: no stored settings, so the device's are taken."""
    device = mock_ble
    ha_controls(hass, config_entry)
    device.volume = 33
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert not writes(device, *SETTING_TAGS, MOVEMENT)
    assert volume_state(hass, config_entry) == "33"


async def test_dropped_write_is_sent_again(hass, setup_integration, device):
    entry = setup_integration
    ha_controls(hass, entry)
    volume_write = device._cmd_AAFA
    dropped = []

    def drop_first_volume_write(p):
        if not dropped:
            dropped.append(p[0])
            return
        volume_write(p)

    device._cmd_AAFA = drop_first_volume_write
    await drop_and_reconnect(hass, device, change_device_while_away)
    await advance(hass, 1)

    assert dropped == [50]
    assert device.volume == 50
    assert volume_state(hass, entry) == "50"


async def test_device_values_taken_if_it_keeps_refusing(
    hass, setup_integration, device
):
    entry = setup_integration
    ha_controls(hass, entry)
    device._cmd_AAFA = lambda p: None  # never applies a volume write
    await drop_and_reconnect(hass, device, change_device_while_away)
    await advance(hass, 1)

    assert len(writes(device, VOLUME)) == 2  # on connect, then once more
    assert volume_state(hass, entry) == "20"
    await advance(hass, 31)
    assert len(writes(device, VOLUME)) == 2


async def test_command_that_reconnects_is_not_undone(hass, setup_integration, device):
    """A change that triggers the reconnect is sent after the push."""
    entry = setup_integration
    ha_controls(hass, entry)
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
    await advance(hass, 1)
    assert device.volume == 77
    assert volume_state(hass, entry) == "77"
    await advance(hass, 31)
    assert device.volume == 77


async def test_push_button_sends_settings_with_option_off(
    hass, setup_integration, device
):
    entry = setup_integration
    button = entity_id(hass, entry, "button", "push_settings")
    device.lights[0].brightness = 10  # shows another look than HA knows
    device.writes.clear()

    await hass.services.async_call(
        "button", "press", {ATTR_ENTITY_ID: button}, blocking=True
    )
    await advance(hass, 1)

    assert device.lights[0].brightness == 255
    assert len(writes(device, VOLUME)) == 1
    assert not writes(device, MOVEMENT)


async def test_push_button_refuses_while_a_file_plays(hass, setup_integration, device):
    entry = setup_integration
    coordinator(hass, entry).mark_playback_active(10)
    device.writes.clear()
    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(
            "button",
            "press",
            {ATTR_ENTITY_ID: entity_id(hass, entry, "button", "push_settings")},
            blocking=True,
        )
    assert not writes(device, *SETTING_TAGS)


async def test_push_button_unavailable_while_disconnected(
    hass, setup_integration, device
):
    entry = setup_integration
    device.reachable = False
    device.drop_connection()
    await hass.async_block_till_done()
    state = hass.states.get(entity_id(hass, entry, "button", "push_settings"))
    assert state.state == STATE_UNAVAILABLE


async def test_options_flow_sets_ha_controls_settings(hass, setup_integration):
    entry = setup_integration
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"show_panel": True, CONF_HA_CONTROLS_SETTINGS: True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_HA_CONTROLS_SETTINGS] is True
    assert entry.options["connected"] is True  # other options kept


async def test_removing_the_entry_deletes_stored_settings(
    hass, setup_integration, hass_storage
):
    entry = setup_integration
    await advance(hass, 1)
    key = f"skelly_ultra.{entry.entry_id}.settings"
    assert key in hass_storage
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert key not in hass_storage


async def test_change_during_push_is_kept(hass, setup_integration, device):
    """Entity commands don't wait for a push; a change made meanwhile wins."""
    entry = setup_integration
    brightness_write = device._cmd_AAF3
    changed = []

    def brightness_and_change(p):
        brightness_write(p)
        if not changed:  # after the eye write, before the volume write
            changed.append(True)
            hass.async_create_task(
                hass.services.async_call(
                    "select",
                    "select_option",
                    {
                        ATTR_ENTITY_ID: entity_id(hass, entry, "select", "eye_icon"),
                        "option": "10 Fire",
                    },
                    blocking=True,
                )
            )
            hass.async_create_task(
                hass.services.async_call(
                    "number",
                    "set_value",
                    {
                        ATTR_ENTITY_ID: entity_id(
                            hass, entry, "number", "volume_number"
                        ),
                        "value": 77,
                    },
                    blocking=True,
                )
            )

    device._cmd_AAF3 = brightness_and_change
    await hass.services.async_call(
        "button",
        "press",
        {ATTR_ENTITY_ID: entity_id(hass, entry, "button", "push_settings")},
        blocking=True,
    )
    await advance(hass, 1)
    await advance(hass, 31)

    assert changed
    assert device.eye_icon == 10
    assert device.volume == 77
    assert volume_state(hass, entry) == "77"
    assert writes(device, VOLUME)[-1][2] == 77


async def test_resend_is_only_what_the_device_missed(hass, setup_integration, device):
    entry = setup_integration
    eye_write = device._cmd_AAF9
    eye_writes = []

    def drop_first_eye_write(p):
        eye_writes.append(p[0])
        if len(eye_writes) > 1:
            eye_write(p)

    device.eye_icon = 5  # shows another eye than HA knows
    device._cmd_AAF9 = drop_first_eye_write
    device.writes.clear()
    await hass.services.async_call(
        "button",
        "press",
        {ATTR_ENTITY_ID: entity_id(hass, entry, "button", "push_settings")},
        blocking=True,
    )
    await advance(hass, 1)

    assert eye_writes == [1, 1]
    assert device.eye_icon == 1
    assert len(writes(device, VOLUME)) == 1  # not resent: the device had it
    assert len(writes(device, BRIGHTNESS)) == 2  # one per channel


async def test_push_on_connect_waits_for_playback_to_end(
    hass, setup_integration, device
):
    entry = setup_integration
    ha_controls(hass, entry)
    switch = entity_id(hass, entry, "switch", "connected")
    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    change_device_while_away(device)
    coordinator(hass, entry).mark_playback_active(10)
    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await advance(hass, 1)
    assert device.volume == 20  # held back while the file plays

    coordinator(hass, entry).mark_playback_inactive()
    await advance(hass, 1)
    assert_initial_settings(device)
    assert volume_state(hass, entry) == "50"


async def test_12ft_skelly_gets_its_one_light_channel(hass, mock_ble):
    device = mock_ble
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="12ft Skelly",
        data={"address": ADDRESS, CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY_12FT},
        options={CONF_HA_CONTROLS_SETTINGS: True},
        unique_id=ADDRESS,
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    device.writes.clear()

    await drop_and_reconnect(hass, device, change_device_while_away)

    for tag in (BRIGHTNESS, EFFECT, SPEED, RGB):
        assert [w[2] for w in writes(device, tag)] == [0]
    assert len(writes(device, EYE)) == 1
    assert device.lights[0].rgb == (255, 0, 0)
    assert device.lights[1].effect_type == 3  # not the 12ft's, left alone
    assert device.volume == 50


async def test_poll_during_connect_push_does_not_undo_it(
    hass, setup_integration, device
):
    """A poll can start once the link is up, while the push still runs."""
    entry = setup_integration
    ha_controls(hass, entry)
    coord = coordinator(hass, entry)
    client = coord.adapter.client
    enable_classic_bt = client.enable_classic_bt

    async def enable_then_poll():
        await enable_classic_bt()
        hass.async_create_task(coord.async_refresh())
        for _ in range(3):
            await asyncio.sleep(0)

    client.enable_classic_bt = enable_then_poll
    with patch(
        "custom_components.skelly_ultra.file_settings.FILE_SETTING_WRITE_DELAY", 0.02
    ):
        await drop_and_reconnect(hass, device, change_device_while_away)
        await advance(hass, 1)
        await advance(hass, 31)

    assert_initial_settings(device)
    assert volume_state(hass, entry) == "50"


async def test_switch_off_during_push_leaves_no_check_behind(
    hass, setup_integration, device
):
    """A push cut short by the Connected switch isn't resent on the next
    connect, here with the option turned off meanwhile."""
    entry = setup_integration
    ha_controls(hass, entry)
    switch = entity_id(hass, entry, "switch", "connected")
    brightness_write = device._cmd_AAF3
    turned_off = []

    def brightness_then_switch_off(p):
        brightness_write(p)
        if not turned_off:
            turned_off.append(True)
            hass.async_create_task(
                hass.services.async_call(
                    "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
                )
            )

    device._cmd_AAF3 = brightness_then_switch_off
    device.drop_connection()
    await advance(hass, 0)
    await advance(hass, 3)  # reconnects and starts the push
    await advance(hass, 1)
    assert turned_off
    assert not device.is_connected

    ha_controls(hass, entry, False)
    change_device_while_away(device)
    device.writes.clear()
    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await advance(hass, 1)
    await advance(hass, 31)

    assert not writes(device, *SETTING_TAGS)
    assert device.volume == 20
    assert volume_state(hass, entry) == "20"


async def test_removal_right_after_a_change_leaves_no_file(
    hass, setup_integration, hass_storage
):
    entry = setup_integration
    key = f"skelly_ultra.{entry.entry_id}.settings"
    with patch("custom_components.skelly_ultra.coordinator.SETTINGS_SAVE_DELAY", 5):
        await hass.services.async_call(
            "number",
            "set_value",
            {
                ATTR_ENTITY_ID: entity_id(hass, entry, "number", "volume_number"),
                "value": 61,
            },
            blocking=True,
        )
        assert await hass.config_entries.async_remove(entry.entry_id)
        await hass.async_block_till_done()
        async_fire_time_changed(
            hass, dt_util.utcnow() + timedelta(seconds=10), fire_all=True
        )
        await hass.async_block_till_done()
    assert key not in hass_storage


async def test_lethal_lily_gets_no_eye_write(hass, mock_ble):
    device = mock_ble
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Lethal Lily",
        data={"address": ADDRESS, CONF_DEVICE_TYPE: DEVICE_TYPE_LILY},
        options={CONF_HA_CONTROLS_SETTINGS: True},
        unique_id=ADDRESS,
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    device.writes.clear()

    await drop_and_reconnect(hass, device, change_device_while_away)
    await advance(hass, 1)
    await advance(hass, 31)

    assert not writes(device, EYE)
    assert [w[2] for w in writes(device, BRIGHTNESS)] == [0]
    assert len(writes(device, VOLUME)) == 1  # nothing resent
    assert device.lights[0].rgb == (255, 0, 0)
    assert device.volume == 50
