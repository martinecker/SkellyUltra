"""Playing the files stored on the Skelly.

The real device aborts a file it plays when it gets the coordinator's
status queries, so polling must pause while a file plays.
"""

from homeassistant.components.media_player import MediaPlayerState
from homeassistant.const import ATTR_ENTITY_ID

from custom_components.skelly_ultra.const import DOMAIN

from .conftest import advance, entity_id, wait_for
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
