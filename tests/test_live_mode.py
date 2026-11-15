"""Live mode: the Skelly as a Bluetooth speaker, and the perform action."""

import asyncio
import tempfile
from pathlib import Path

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from custom_components.skelly_ultra import stage as stage_module
from custom_components.skelly_ultra import uploads
from custom_components.skelly_ultra.const import DOMAIN

from .conftest import advance, coordinator, entity_id, wait_for
from .device_sim import Light
from .rest_sim import LIVE_MAC


@pytest.fixture(autouse=True)
def fast_perform(monkeypatch):
    monkeypatch.setattr(stage_module, "COMMAND_DELAY", 0)
    monkeypatch.setattr(stage_module, "LIVE_MODE_POLL_INTERVAL", 0.01)


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


async def test_perform_speaks_in_the_given_language(
    hass, setup_integration, device, rest_server, tts_entity
):
    """The dashboard card passes the language picked in its TTS form."""
    await perform(hass, message="Hallo", language="de", mood="none", movement=["none"])
    assert tts_entity.spoken[-1][:2] == ("Hallo", "de")
    # Blank: the entity's default
    await perform(hass, message="Hi", language="", mood="none", movement=["none"])
    assert tts_entity.spoken[-1][:2] == ("Hi", "en")
    # One the entity doesn't speak: refused before live mode is turned on
    switch = entity_id(hass, setup_integration, "switch", "live_mode")
    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    with pytest.raises(ServiceValidationError, match="(?i)language"):
        await perform(hass, message="Bonjour", language="fr")
    assert not rest_server.connected


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


async def test_send_file_from_tts_is_not_cached_and_cleans_up(
    hass, setup_integration, device, tts_entity, tmp_path, monkeypatch
):
    """The audio isn't written to HA's TTS cache, and no temp files are left."""
    temp_dir = tmp_path / "temp"
    temp_dir.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(temp_dir))
    converted = []
    original = uploads.AudioProcessor.process_file

    def spy(path, *args):
        converted.append(path.name)
        return original(path, *args)

    monkeypatch.setattr(uploads.AudioProcessor, "process_file", staticmethod(spy))

    await tts_upload(hass, message="Boo")

    assert converted and all(name.endswith(".mp3") for name in converted), converted
    assert list(temp_dir.iterdir()) == []
    tts_cache = Path(hass.config.path("tts"))
    assert not tts_cache.exists() or list(tts_cache.iterdir()) == [], "cache=False"
    assert device.file("boo.mp3")


async def turn_on_live_mode(hass, entry, rest_server):
    switch = entity_id(hass, entry, "switch", "live_mode")
    await hass.services.async_call(
        "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    await wait_for(hass, lambda: rest_server.connected)
    return switch


async def test_speaker_waits_only_for_its_own_skelly(
    hass, setup_integration, device, rest_server, tts_entity
):
    """Another Skelly playing on the same REST server doesn't keep this one busy."""
    rest_server.other_playing = True
    async with asyncio.timeout(10):
        result = await perform(hass, message="Hi", mood="none", movement=["none"])
    assert result["status"] == "ok"
    speaker = entity_id(hass, setup_integration, "media_player", "live_mode_speaker")
    assert hass.states.get(speaker).state == "idle"
    assert rest_server.other_playing, "the other Skelly's audio was left alone"


async def test_speaker_stop_stops_only_its_own_skelly(
    hass, setup_integration, device, rest_server, tts_entity
):
    rest_server.clip_polls = 1000
    rest_server.other_playing = True
    result = await perform(
        hass, message="Hi", mood="none", movement=["none"], wait_until_done=False
    )
    assert result["status"] == "ok" and rest_server.playing
    speaker = entity_id(hass, setup_integration, "media_player", "live_mode_speaker")
    assert hass.states.get(speaker).state == "playing"

    await hass.services.async_call(
        "media_player", "media_stop", {ATTR_ENTITY_ID: speaker}, blocking=True
    )
    assert rest_server.stops == [LIVE_MAC]
    assert not rest_server.playing
    assert rest_server.other_playing, "the other Skelly kept playing"
    # The perform ends once its playback monitor notices
    manager = hass.data[DOMAIN][setup_integration.entry_id]["perform"]
    await wait_for(hass, lambda: not manager.running, timeout=5)


async def test_live_mode_survives_rest_server_hiccup(
    hass, setup_integration, device, rest_server, caplog
):
    entry = setup_integration
    switch = await turn_on_live_mode(hass, entry, rest_server)
    client = hass.data[DOMAIN][entry.entry_id]["adapter"].client

    rest_server.up = False  # status answers 503 for two polls
    await advance(hass, 31)
    await advance(hass, 31)
    assert client.live_mode_client_address == LIVE_MAC
    assert rest_server.connected
    assert hass.states.get(switch).state == STATE_ON
    assert caplog.text.count("Could not check live mode device") == 1

    rest_server.up = True
    await advance(hass, 31)
    assert client.live_mode_client_address == LIVE_MAC
    assert hass.states.get(switch).state == STATE_ON


async def test_live_mode_dropped_by_server_is_restored_in_background(
    hass, setup_integration, device, rest_server
):
    entry = setup_integration
    switch = await turn_on_live_mode(hass, entry, rest_server)
    coord = coordinator(hass, entry)
    client = hass.data[DOMAIN][entry.entry_id]["adapter"].client

    # The REST server lost the link (e.g. it restarted); pairing again is slow
    rest_server.connected = False
    rest_server.pair_gate = asyncio.Event()
    await advance(hass, 31)
    await wait_for(hass, rest_server.pair_started.is_set)
    # The poll finished without waiting for the pairing, and holds no lock
    assert coord.last_update_success
    assert not coord.action_lock.locked()
    assert client.live_mode_client_address is None

    rest_server.pair_gate.set()
    await wait_for(hass, lambda: rest_server.connected)
    await wait_for(hass, lambda: client.live_mode_client_address == LIVE_MAC)
    assert hass.states.get(switch).state == STATE_ON


async def test_live_mode_off_cancels_background_restore(
    hass, setup_integration, device, rest_server
):
    entry = setup_integration
    switch = await turn_on_live_mode(hass, entry, rest_server)

    rest_server.connected = False
    rest_server.pair_gate = asyncio.Event()
    await advance(hass, 31)
    await wait_for(hass, rest_server.pair_started.is_set)

    await hass.services.async_call(
        "switch", "turn_off", {ATTR_ENTITY_ID: switch}, blocking=True
    )
    rest_server.pair_gate.set()
    await advance(hass, 1)
    assert not rest_server.connected, "the restore didn't reconnect behind our back"
    assert hass.states.get(switch).state == STATE_OFF


async def test_speaker_play_failures_raise(
    hass, setup_integration, rest_server, tone_mp3, tmp_path
):
    """Playing to the live speaker reports why nothing played."""
    entry = setup_integration
    await turn_on_live_mode(hass, entry, rest_server)
    speaker = entity_id(hass, entry, "media_player", "live_mode_speaker")

    async def play(path):
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                ATTR_ENTITY_ID: speaker,
                "media_content_id": str(path),
                "media_content_type": "music",
            },
            blocking=True,
        )

    with pytest.raises(HomeAssistantError, match="Media file not found"):
        await play(tmp_path / "missing.mp3")

    clip = tmp_path / "tone.mp3"
    clip.write_bytes(tone_mp3)
    rest_server.connected = False  # the server lost the Skelly
    with pytest.raises(
        HomeAssistantError, match="REST server couldn't start playback: not connected"
    ):
        await play(clip)
    state = hass.states.get(speaker)
    assert state.state == "idle"
    assert "media_title" not in state.attributes
    assert not rest_server.plays


async def test_live_mode_switch_reports_failed_connect(
    hass, setup_integration, device, rest_server
):
    rest_server.up = False  # the REST server doesn't answer
    switch = entity_id(hass, setup_integration, "switch", "live_mode")
    with pytest.raises(HomeAssistantError, match="Couldn't connect live mode"):
        await hass.services.async_call(
            "switch", "turn_on", {ATTR_ENTITY_ID: switch}, blocking=True
        )
    assert not rest_server.connected
    assert hass.states.get(switch).state == STATE_OFF
