"""Playing the files stored on the Skelly.

The real device aborts a file it plays when it gets the coordinator's
status queries, so polling must pause while a file plays.
"""

import asyncio

import pytest
from homeassistant.components.media_player import MediaPlayerState
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.exceptions import HomeAssistantError

from custom_components.skelly_ultra.const import DOMAIN
from custom_components.skelly_ultra.skelly_ultra_pkg import parser

from .conftest import advance, coordinator, entity_id, wait_for
from .device_sim import Playback

QUERY_TAGS = (b"\xaa\xe0", b"\xaa\xe1", b"\xaa\xd0", b"\xaa\xd1", b"\xaa\xd2")


def queries(device) -> int:
    return sum(w[:2] in QUERY_TAGS for w in device.writes)


def player(hass, entry) -> str:
    return entity_id(hass, entry, "media_player", "internal_files")


async def test_play_file_by_name(hass, setup_integration, device):
    entry = setup_integration
    eid = player(hass, entry)
    await hass.services.async_call(
        "media_player",
        "select_source",
        {ATTR_ENTITY_ID: eid, "source": "laugh.mp3"},
        blocking=True,
    )
    await hass.services.async_call(
        "media_player", "media_play", {ATTR_ENTITY_ID: eid}, blocking=True
    )
    assert device.playback[-1] == Playback(device.file("laugh.mp3").index, True)
    assert hass.states.get(eid).state == MediaPlayerState.PLAYING

    await hass.services.async_call(
        "media_player", "media_stop", {ATTR_ENTITY_ID: eid}, blocking=True
    )
    assert device.playback[-1] == Playback(device.file("laugh.mp3").index, False)
    assert hass.states.get(eid).state == MediaPlayerState.IDLE


async def test_next_track_wraps_around(hass, setup_integration, device):
    entry = setup_integration
    eid = player(hass, entry)
    await hass.services.async_call(
        "media_player",
        "select_source",
        {ATTR_ENTITY_ID: eid, "source": "scream.mp3"},
        blocking=True,
    )
    await hass.services.async_call(
        "media_player", "media_play", {ATTR_ENTITY_ID: eid}, blocking=True
    )
    await hass.services.async_call(
        "media_player", "media_next_track", {ATTR_ENTITY_ID: eid}, blocking=True
    )
    assert device.playback[-1] == Playback(device.file("hello.mp3").index, True)


async def test_no_polling_while_a_file_plays(hass, setup_integration, device):
    entry = setup_integration
    eid = player(hass, entry)
    f = device.file("laugh.mp3")
    f.duration = 120
    await hass.services.async_call(
        "media_player",
        "play_media",
        {
            ATTR_ENTITY_ID: eid,
            "media_content_type": "music",
            "media_content_id": str(f.index),
        },
        blocking=True,
    )
    # The device's "playing" report sets how long polling stays off
    await wait_for(hass, lambda: coordinator(hass, entry).playback is not None)
    before = queries(device)
    await advance(hass, 31)
    await advance(hass, 31)
    assert queries(device) == before, "status queries would abort playback"

    # The device reports the end of the file: polling resumes.
    device.finish_playback(f.index)
    await wait_for(hass, lambda: hass.states.get(eid).state == MediaPlayerState.IDLE)
    await advance(hass, 31)
    assert queries(device) > before


async def test_polling_resumes_if_end_of_file_is_missed(
    hass, setup_integration, device
):
    entry = setup_integration
    f = device.file("hello.mp3")  # 4 s long
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": f.index}, blocking=True
    )
    # The device's "playing" notification sets the expected duration.
    await wait_for(
        hass,
        lambda: hass.states.get(player(hass, entry)).state == MediaPlayerState.PLAYING,
    )
    before = queries(device)
    await advance(hass, 20)  # 4 s file + 10 s margin passed; no "stopped" came
    await advance(hass, 31)
    assert queries(device) > before


async def test_play_file_action_after_drop_reconnects(hass, setup_integration, device):
    device.drop_connection()
    await hass.async_block_till_done()
    f = device.file("scream.mp3")
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": f.index}, blocking=True
    )
    assert device.is_connected
    assert device.playback[-1] == Playback(f.index, True)


@pytest.mark.parametrize("service", ["play_file", "stop_file"])
async def test_play_and_stop_report_failures(
    hass, setup_integration, device, monkeypatch, service
):
    # The panel shows these errors; they used to be logged and swallowed
    client = hass.data[DOMAIN][setup_integration.entry_id]["adapter"].client

    async def reject(file_index):
        raise RuntimeError("device said no")

    monkeypatch.setattr(client, service, reject)
    f = device.file("hello.mp3")
    with pytest.raises(HomeAssistantError, match="device said no"):
        await hass.services.async_call(
            DOMAIN, service, {"file_index": f.index}, blocking=True
        )


async def test_play_file_needs_a_known_skelly(hass, setup_integration):
    with pytest.raises(HomeAssistantError, match="not found"):
        await hass.services.async_call(
            DOMAIN,
            "play_file",
            {"entity_id": "media_player.nobody", "file_index": 1},
            blocking=True,
        )


async def test_play_waits_for_a_poll_and_holds_off_the_next(
    hass, setup_integration, device
):
    """A poll's queries right after Play would stop the file again."""
    coord = coordinator(hass, setup_integration)
    f = device.file("laugh.mp3")
    f.duration = 120
    await coord.action_lock.acquire()  # a poll in progress
    play = hass.async_create_task(
        hass.services.async_call(
            DOMAIN, "play_file", {"file_index": f.index}, blocking=True
        )
    )
    await asyncio.sleep(0.05)
    assert Playback(f.index, True) not in device.playback, "waits for the poll"
    # The next poll starts while the first one still runs
    poll = hass.async_create_task(coord._async_update_data())
    await asyncio.sleep(0.05)
    before = queries(device)
    coord.action_lock.release()
    await play
    await poll
    assert device.playback[-1] == Playback(f.index, True)
    assert queries(device) == before, "the waiting poll sends no queries"


async def test_failed_play_lets_polls_run(hass, setup_integration, device, monkeypatch):
    coord = coordinator(hass, setup_integration)
    client = hass.data[DOMAIN][setup_integration.entry_id]["adapter"].client

    async def reject(file_index):
        raise RuntimeError("device said no")

    monkeypatch.setattr(client, "play_file", reject)
    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(
            DOMAIN, "play_file", {"file_index": 1}, blocking=True
        )
    before = queries(device)
    await advance(hass, 31)
    assert queries(device) > before
    assert coord.playback is None


async def test_failed_or_unreported_play_holds_off_polling_briefly(
    hass, setup_integration, device, monkeypatch
):
    """A Play the device ignores doesn't keep edits and polls waiting long."""
    client = hass.data[DOMAIN][setup_integration.entry_id]["adapter"].client

    async def ignore(file_index):
        return None  # sent, but the device never plays it

    monkeypatch.setattr(client, "play_file", ignore)
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": 1}, blocking=True
    )
    before = queries(device)
    # Two steps, so the 10s report timeout fires before the 30s poll is due.
    # In one jump both timers fire in no set order, and a poll that runs first
    # is still held off.
    await advance(hass, 11)
    await advance(hass, 31)
    assert queries(device) > before, "polling resumed after the report timeout"


async def test_end_of_the_previous_file_keeps_polling_held_off(
    hass, setup_integration, device
):
    """Switching files, the device reports the old one ended."""
    coord = coordinator(hass, setup_integration)
    a = device.file("laugh.mp3")
    b = device.file("scream.mp3")
    b.duration = 120
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": a.index}, blocking=True
    )
    await wait_for(hass, lambda: coord.playback is not None)
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": b.index}, blocking=True
    )
    # The "ended" report of A comes before B's "playing"
    coord.set_playback(a.index, False, 0)
    assert coord.playback is None
    assert coord._playback_active, "a poll now would stop B"
    await wait_for(
        hass, lambda: coord.playback and coord.playback["file_index"] == b.index
    )
    # ... or after it, as the media player hears it
    client = hass.data[DOMAIN][setup_integration.entry_id]["adapter"].client
    client.events.put_nowait(parser.PlaybackEvent(a.index, False, 0))
    await wait_for(
        hass,
        lambda: (
            not any(
                isinstance(e, parser.PlaybackEvent)
                for e in list(client.events._queue)  # noqa: SLF001
            )
        ),
    )
    assert coord.playback["file_index"] == b.index
    eid = player(hass, setup_integration)
    assert hass.states.get(eid).state == MediaPlayerState.PLAYING
    before = queries(device)
    await advance(hass, 31)
    assert queries(device) == before, "a poll now would stop B"
