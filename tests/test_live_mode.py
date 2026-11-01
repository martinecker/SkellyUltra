"""Live mode: the Skelly as a Bluetooth speaker, and the perform action."""

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.exceptions import HomeAssistantError

from custom_components.skelly_ultra import perform as perform_module
from custom_components.skelly_ultra.const import DOMAIN

from .conftest import advance, entity_id, wait_for
from .device_sim import Light
from .rest_sim import LIVE_MAC


@pytest.fixture(autouse=True)
def fast_perform(monkeypatch):
    monkeypatch.setattr(perform_module, "COMMAND_DELAY", 0)
    monkeypatch.setattr(perform_module, "LIVE_MODE_POLL_INTERVAL", 0.01)


async def test_live_mode_switch_pairs_and_connects(
    hass, setup_integration, device, rest_server
):
    entry = setup_integration
    switch = entity_id(hass, entry, "switch", "live_mode")
    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await wait_for(hass, lambda: rest_server.connected)
    assert hass.states.get(switch).state == STATE_ON
    await advance(hass, 31)  # the MAC sensor is polled
    assert (
        hass.states.get(entity_id(hass, entry, "sensor", "live_bt_mac")).state
        == LIVE_MAC
    )
    assert entry.options["live_mode_connected"] is True

    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await hass.async_block_till_done()
    assert not rest_server.connected
    assert hass.states.get(switch).state == STATE_OFF
    assert entry.options["live_mode_connected"] is False


async def perform(hass, **data):
    return await hass.services.async_call(
        DOMAIN,
        "perform",
        {"tts_entity": "tts.fake_voice", **data},
        blocking=True,
        return_response=True,
    )


async def test_perform_speaks_with_mood_and_restores_look(
    hass, setup_integration, device, rest_server, tts_entity
):
    device.lights[0] = Light(rgb=(1, 2, 3), brightness=200)
    device.eye_icon = 3
    await advance(hass, 31)  # next poll picks up the look above
    result = await perform(hass, message="Welcome, mortal!", mood="spooky")

    assert result["status"] == "ok" and result["line"] == "Welcome, mortal!"
    assert tts_entity.spoken[-1][0] == "Welcome, mortal!"
    assert rest_server.connected, "live mode turned on and left on"
    # While the line played: spooky look (purple pulsing lights, spiral eyes, full movement)
    look = rest_server.plays[-1]
    assert look.eye_icon == 9  # "9 Color Spiral" on the Ultra Skelly
    assert look.lights[0].rgb == (160, 0, 255) and look.lights[0].effect_type == 3
    assert look.lights[1].rgb == (160, 0, 255)
    assert look.action == 255
    # Afterwards: eyes and lights back as they were
    assert device.eye_icon == 3
    assert device.lights[0].rgb == (1, 2, 3) and device.lights[0].brightness == 200


async def test_perform_without_mood_leaves_look_alone(
    hass, setup_integration, device, rest_server, tts_entity
):
    result = await perform(hass, message="Hi", movement=["head"])
    assert result["mood"] == "none"
    look = rest_server.plays[-1]
    assert look.eye_icon == 1 and look.lights[0] == Light()
    assert look.action == 0x01


async def test_perform_rejects_parts_the_model_lacks(
    hass, setup_integration, device, rest_server, tts_entity
):
    with pytest.raises(HomeAssistantError, match="(?i)unknown movement"):
        await perform(hass, message="Hi", movement=["wrist"])
    assert rest_server.plays == []
    assert not rest_server.connected, "nothing started before the input was checked"


async def test_perform_fails_cleanly_when_live_mode_cannot_connect(
    hass, setup_integration, device, rest_server, tts_entity
):
    rest_server.up = False
    with pytest.raises(HomeAssistantError, match="Live mode did not connect"):
        await perform(hass, message="Hi", mood="spooky", live_mode_timeout=1)
    assert device.eye_icon == 1, "look untouched"


async def test_perform_tts_failure(
    hass, setup_integration, device, rest_server, tts_entity
):
    tts_entity.fail = True
    with pytest.raises(HomeAssistantError, match="Text-to-speech failed"):
        await perform(hass, message="Hi", mood="spooky")
    assert rest_server.plays == []


async def test_send_file_from_tts(hass, setup_integration, device, tts_entity):
    result = await hass.services.async_call(
        DOMAIN,
        "send_file_from_tts",
        {
            "tts_entity": "tts.fake_voice",
            "message": "Boo, scared you!",
            "tts_options": {"voice": "x"},
        },
        blocking=True,
        return_response=True,
    )
    f = device.file("boo_scared_you.mp3")
    assert result == {"filename": "boo_scared_you.mp3", "file_index": f.index}
    assert tts_entity.spoken[-1] == ("Boo, scared you!", "en", {"voice": "x"})


async def tts_upload(hass, **data):
    return await hass.services.async_call(
        DOMAIN,
        "send_file_from_tts",
        {"tts_entity": "tts.fake_voice", **data},
        blocking=True,
        return_response=True,
    )


async def test_send_file_from_tts_explicit_name_becomes_mp3(
    hass, setup_integration, device, tts_entity
):
    result = await tts_upload(hass, message="hi", target_filename="greet.wav")
    assert result["filename"] == "greet.mp3"
    assert device.file("greet.mp3")


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"message": "hi", "target_filename": "x" * 40}, "exceeds"),
        ({"message": "hi", "tts_entity": "tts.nope"}, "(?i)tts"),
        ({"message": "hi", "language": "fr"}, "(?i)language"),
    ],
)
async def test_send_file_from_tts_errors(
    hass, setup_integration, device, tts_entity, data, message
):
    with pytest.raises(HomeAssistantError, match=message):
        await tts_upload(hass, **data)
    assert len(device.files) == 3


async def test_send_file_from_tts_checks_name_before_speaking(
    hass, setup_integration, tts_entity
):
    with pytest.raises(HomeAssistantError, match="exceeds"):
        await tts_upload(hass, message="hi", target_filename="x" * 40)
    assert tts_entity.spoken == [], "no TTS call (which may cost money) for a bad name"


async def test_send_file_from_tts_voice_failure(
    hass, setup_integration, device, tts_entity
):
    tts_entity.fail = True
    with pytest.raises(HomeAssistantError, match="Text-to-speech"):
        await tts_upload(hass, message="hi")
    assert len(device.files) == 3
