"""Live mode: the Skelly as a Bluetooth speaker, and the perform action."""

import asyncio
import tempfile
from pathlib import Path
from unittest.mock import Mock

import aiohttp
import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.setup import async_setup_component

from custom_components.skelly_ultra import media_player as media_player_module
from custom_components.skelly_ultra import stage as stage_module
from custom_components.skelly_ultra import uploads
from custom_components.skelly_ultra.const import DOMAIN

from .conftest import advance, coordinator, entity_id, wait_for
from .device_sim import Light
from .rest_sim import LIVE_MAC


@pytest.fixture(autouse=True)
def fast_perform(monkeypatch):
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


async def test_perform_turns_live_mode_on_like_the_switch(
    hass, setup_integration, device, rest_server, tts_entity
):
    switch = entity_id(hass, setup_integration, "switch", "live_mode")
    assert hass.states.get(switch).state == STATE_OFF
    await perform(hass, message="Hi")
    assert setup_integration.options["live_mode_connected"] is True
    assert hass.states.get(switch).state == STATE_ON


async def test_perform_turns_live_mode_on_with_the_switch_disabled(
    hass, setup_integration, device, rest_server, tts_entity
):
    from homeassistant.helpers import entity_registry as er

    entry = setup_integration
    switch = entity_id(hass, entry, "switch", "live_mode")
    er.async_get(hass).async_update_entity(
        switch, disabled_by=er.RegistryEntryDisabler.USER
    )
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(switch) is None

    result = await perform(hass, message="Hi")
    assert result["status"] == "ok"
    assert rest_server.connected
    assert entry.options["live_mode_connected"] is True


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
    with pytest.raises(HomeAssistantError, match="Text-to-speech.*failed"):
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
    manager = setup_integration.runtime_data.perform
    await wait_for(hass, lambda: not manager.running, timeout=5)


async def test_live_mode_survives_rest_server_hiccup(
    hass, setup_integration, device, rest_server, caplog
):
    entry = setup_integration
    switch = await turn_on_live_mode(hass, entry, rest_server)
    client = entry.runtime_data.adapter.client

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
    client = entry.runtime_data.adapter.client

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

    with pytest.raises(HomeAssistantError, match="File not found"):
        await play(tmp_path / "missing.mp3")
    with pytest.raises(HomeAssistantError, match="Not allowed to read"):
        await play("/etc/passwd")

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
    # Still wanted, so a reconnect or restart tries again
    assert setup_integration.options["live_mode_connected"] is True


async def play_clip(hass, speaker, clip):
    await hass.services.async_call(
        "media_player",
        "play_media",
        {
            ATTR_ENTITY_ID: speaker,
            "media_content_id": str(clip),
            "media_content_type": "music",
        },
        blocking=True,
    )


@pytest.fixture
def clip(tmp_path, tone_mp3):
    path = tmp_path / "tone.mp3"
    path.write_bytes(tone_mp3)
    return path


@pytest.fixture
def fast_status_polls(monkeypatch):
    monkeypatch.setattr(media_player_module, "STATUS_POLL_INTERVAL", 0.01)


async def test_speaker_unreadable_status_ends_playback_quietly(
    hass, setup_integration, rest_server, tts_entity, fast_status_polls
):
    """A status reply that isn't JSON ends the clip; perform doesn't fail on it."""
    rest_server.clip_polls = 1000
    rest_server.status_error = aiohttp.ContentTypeError(
        Mock(), (), message="Attempt to decode JSON with unexpected mimetype"
    )
    async with asyncio.timeout(10):
        result = await perform(hass, message="Hi", mood="none", movement=["none"])
    assert result["status"] == "ok"
    speaker = entity_id(hass, setup_integration, "media_player", "live_mode_speaker")
    assert hass.states.get(speaker).state == "idle"


async def test_speaker_playing_again_replaces_the_old_monitor(
    hass, setup_integration, rest_server, clip, fast_status_polls
):
    """The second clip has one monitor, and the first one's can't end it."""
    entry = setup_integration
    await turn_on_live_mode(hass, entry, rest_server)
    speaker = entity_id(hass, entry, "media_player", "live_mode_speaker")
    player = entry.runtime_data.live_media_player
    rest_server.clip_polls = 1000

    await play_clip(hass, speaker, clip)
    first = player._monitor_task
    await play_clip(hass, speaker, clip)
    second = player._monitor_task
    assert rest_server.stops == [LIVE_MAC], "the first clip was stopped"
    await wait_for(hass, first.done)
    assert not first.cancelled()

    polls = rest_server.status_polls
    await asyncio.sleep(0.2)
    # About 20 polls from one monitor; two monitors would make about 40
    assert 5 <= rest_server.status_polls - polls <= 30
    assert not second.done()
    assert hass.states.get(speaker).state == "playing"

    rest_server.playing = False
    await wait_for(hass, second.done)
    assert hass.states.get(speaker).state == "idle"
    assert player._monitor_task is None


async def test_speaker_stop_ends_the_monitor_at_once(
    hass, setup_integration, rest_server, clip
):
    """Stop doesn't leave the monitor polling until its next poll."""
    entry = setup_integration
    await turn_on_live_mode(hass, entry, rest_server)
    speaker = entity_id(hass, entry, "media_player", "live_mode_speaker")
    player = entry.runtime_data.live_media_player
    rest_server.clip_polls = 1000

    await play_clip(hass, speaker, clip)
    monitor = player._monitor_task
    await hass.services.async_call(
        "media_player", "media_stop", {ATTR_ENTITY_ID: speaker}, blocking=True
    )
    # Well under the 1 s poll interval
    await asyncio.wait({monitor}, timeout=0.5)
    assert monitor.done()
    assert hass.states.get(speaker).state == "idle"


async def test_speaker_monitor_can_be_cancelled(
    hass, setup_integration, rest_server, clip
):
    """Cancelling the monitor (e.g. at shutdown) cancels it, and the state clears."""
    entry = setup_integration
    await turn_on_live_mode(hass, entry, rest_server)
    speaker = entity_id(hass, entry, "media_player", "live_mode_speaker")
    player = entry.runtime_data.live_media_player
    rest_server.clip_polls = 1000

    await play_clip(hass, speaker, clip)
    monitor = player._monitor_task
    monitor.cancel()
    with pytest.raises(asyncio.CancelledError):
        await monitor
    assert monitor.cancelled()
    await hass.async_block_till_done()
    assert hass.states.get(speaker).state == "idle"


async def test_perform_stopped_midway_silences_and_restores(
    hass, setup_integration, device, rest_server, tts_entity
):
    """Cancelling a perform (e.g. a restarted automation) stops the line too."""
    rest_server.clip_polls = 1000  # the line plays for a long time
    task = hass.async_create_task(perform(hass, message="Boo", mood="spooky"))
    # Not wait_for: block_till_done would wait for the perform itself
    for _ in range(200):
        if rest_server.playing:
            break
        await asyncio.sleep(0.05)
    assert rest_server.playing
    assert device.eye_icon == 9, "spooky look on"
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await hass.async_block_till_done()
    assert rest_server.stops == [LIVE_MAC], "the line was stopped"
    assert not rest_server.playing
    assert device.eye_icon == 1, "look restored"
    speaker = entity_id(hass, setup_integration, "media_player", "live_mode_speaker")
    assert hass.states.get(speaker).state == "idle"
    manager = setup_integration.runtime_data.perform
    assert not manager.running


@pytest.fixture
async def speaker_on(hass, setup_integration, rest_server):
    """The Live Mode Speaker, with live mode on and clips that keep playing."""
    await async_setup_component(hass, "media_source", {})
    await turn_on_live_mode(hass, setup_integration, rest_server)
    rest_server.clip_polls = 1000
    return entity_id(hass, setup_integration, "media_player", "live_mode_speaker")


@pytest.fixture
def temp_dir(tmp_path, monkeypatch):
    path = tmp_path / "temp"
    path.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(path))
    return path


async def test_speaker_plays_local_media_source(
    hass, speaker_on, rest_server, media_dir, tone_mp3
):
    """A file from My media is read from disk, not fetched over HTTP."""
    (media_dir / "sounds").mkdir(parents=True)
    (media_dir / "sounds" / "boo.mp3").write_bytes(tone_mp3)
    await play_clip(
        hass, speaker_on, "media-source://media_source/local/sounds/boo.mp3"
    )
    state = hass.states.get(speaker_on)
    assert state.state == "playing"
    assert state.attributes["media_title"] == "boo.mp3"
    assert len(rest_server.plays) == 1


async def test_speaker_plays_tts_without_ha_url(
    hass, speaker_on, rest_server, tts_entity, temp_dir
):
    """Speech is fetched from the TTS manager, so no HA URL is needed."""
    from homeassistant.components import tts

    media_id = tts.generate_media_source_id(hass, "Boo", engine="tts.fake_voice")
    await play_clip(hass, speaker_on, media_id)
    state = hass.states.get(speaker_on)
    assert state.state == "playing"
    assert state.attributes["media_title"] == "Text to speech"
    assert tts_entity.spoken[-1][0] == "Boo"
    assert list(temp_dir.iterdir()) == [], "the speech's temp file was removed"


async def test_speaker_plays_url_and_cleans_up(
    hass, speaker_on, rest_server, aioclient_mock, tone_mp3, temp_dir
):
    aioclient_mock.get("http://example.com/sounds/howl.mp3?x=1", content=tone_mp3)
    await play_clip(hass, speaker_on, "http://example.com/sounds/howl.mp3?x=1")
    state = hass.states.get(speaker_on)
    assert state.state == "playing"
    assert state.attributes["media_title"] == "howl.mp3"
    assert list(temp_dir.iterdir()) == [], "the download was removed"


@pytest.mark.parametrize(
    ("media_id", "message"),
    [
        ("media-source://media_source/local/nope.mp3", "nope.mp3"),
        ("/media/local/nope.mp3", "Media file not found"),
        ("http://example.com/gone.mp3", "HTTP 404"),
    ],
)
async def test_speaker_unresolvable_media_raises(
    hass, speaker_on, rest_server, aioclient_mock, media_dir, media_id, message
):
    media_dir.mkdir(exist_ok=True)
    aioclient_mock.get("http://example.com/gone.mp3", status=404)
    with pytest.raises(HomeAssistantError, match=message):
        await play_clip(hass, speaker_on, media_id)
    assert hass.states.get(speaker_on).state == "idle"
    assert not rest_server.plays
