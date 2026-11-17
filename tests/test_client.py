"""The BLE client library (skelly_ultra_pkg), against the simulated device.

No Home Assistant here: these drive SkellyClient and FileTransferManager
directly, for behavior that is hard to reach through entities.
"""

import asyncio
import logging

import aiohttp
import pytest

from custom_components.skelly_ultra.skelly_ultra_pkg import commands, parser
from custom_components.skelly_ultra.skelly_ultra_pkg.client import (
    ConnectionLostError,
    SkellyClient,
)
from custom_components.skelly_ultra.skelly_ultra_pkg.constants import LightScene
from custom_components.skelly_ultra.skelly_ultra_pkg.file_transfer import (
    FileTransferError,
    FileTransferManager,
)

from .device_sim import FakeSkellyDevice


@pytest.fixture
async def device():
    dev = FakeSkellyDevice()
    dev.add_file("hello.mp3")
    dev.add_file("Grüße 🎃.mp3")
    return dev


@pytest.fixture
async def client(device):
    c = SkellyClient(address=device.address)
    device.set_disconnected_callback(c.handle_ble_disconnect)
    assert await c.connect(client=device)
    yield c
    await c.disconnect()


@pytest.fixture(autouse=True)
def fast_transfers(monkeypatch):
    monkeypatch.setattr(FileTransferManager, "CHUNK_DELAY", 0)


def test_frame_matches_capture_from_the_app():
    """A frame captured from the 12ft Skelly's phone app (head movement on)."""
    assert commands.set_movement_action(0x02, 0, "") == bytes.fromhex(
        "AACA020000000000000094"
    )


async def test_queries_get_their_own_reply(client, device):
    device.volume = 33
    heard = []
    client.add_event_listener(heard.append)
    # A notification nobody asked for arrives first (the device reports playback).
    device.finish_playback(1)
    assert await client.get_volume() == 33
    # ...and went to its listener at once, not after the query
    assert isinstance(heard[0], parser.PlaybackEvent) and heard[0].file_index == 1


async def test_playback_report_during_a_query_is_heard_at_once(client, device):
    """A query waiting for its reply doesn't hold up other events."""
    device.unresponsive = True
    heard = []
    client.add_event_listener(heard.append)
    query = asyncio.create_task(client.get_volume(timeout=5))
    await asyncio.sleep(0)
    device.finish_playback(2)
    await asyncio.sleep(0)
    assert [e.file_index for e in heard] == [2]
    assert not query.done(), "still waiting for its own reply"
    query.cancel()
    with pytest.raises(asyncio.CancelledError):
        await query


async def test_late_reply_is_not_taken_for_the_next_query(client, device):
    """A reply that comes after its query timed out is dropped."""
    device.volume = 10
    device.unresponsive = True
    with pytest.raises(TimeoutError):
        await client.get_volume(timeout=0.01)
    # The reply to the timed-out query arrives now
    device.unresponsive = False
    device._cmd_AAE5(b"")
    await asyncio.sleep(0)
    device.volume = 20
    assert await client.get_volume() == 20


async def test_queries_of_one_kind_take_turns(client, device):
    """A second volume query waits until the first has its reply.

    Replies can't be told apart, so with both waiting, the first reply
    would answer both.
    """
    volume_query = commands.query_volume()
    device.unresponsive = True
    first = asyncio.create_task(client.get_volume(timeout=5))
    second = asyncio.create_task(client.get_volume(timeout=5))
    for _ in range(5):
        await asyncio.sleep(0)
    assert device.writes.count(volume_query) == 1, "the second waits its turn"

    device.volume = 10
    device._cmd_AAE5(b"")  # the first query's reply
    assert await first == 10
    for _ in range(5):
        await asyncio.sleep(0)
    assert device.writes.count(volume_query) == 2, "now the second is sent"
    device.volume = 20
    device._cmd_AAE5(b"")  # its reply
    assert await second == 20


async def test_events_reach_listeners_in_order(client, device):
    heard = []
    remove = client.add_event_listener(heard.append)
    for index in (1, 2, 3):
        device.finish_playback(index)
    await asyncio.sleep(0)
    assert [e.file_index for e in heard] == [1, 2, 3]
    remove()
    device.finish_playback(4)
    await asyncio.sleep(0)
    assert len(heard) == 3, "a removed listener hears nothing"


async def test_file_list_with_unicode_names(client, device):
    files = await client.get_file_list(timeout=2)
    assert [f.name for f in files] == ["hello.mp3", "Grüße 🎃.mp3"]
    assert [f.file_index for f in files] == [1, 2]


@pytest.mark.parametrize("has_scenes", [True, False])
async def test_file_list_reads_scene_and_position(client, device, has_scenes):
    """Firmware with and without light scenes lays out the file info tail
    differently; both give each file's position, and the scene if any."""
    device.has_scenes = has_scenes
    device.file("hello.mp3").scene = LightScene.CHRISTMAS
    files = sorted(await client.get_file_list(), key=lambda f: f.file_index)
    assert [f.db_pos for f in files] == [0, 1]
    assert [f.name for f in files] == ["hello.mp3", "Grüße 🎃.mp3"]
    expected_scenes = (
        [LightScene.CHRISTMAS, LightScene.CUSTOM] if has_scenes else [None, None]
    )
    assert [f.scene for f in files] == expected_scenes


@pytest.mark.parametrize("has_scenes", [True, False])
async def test_live_mode_scene(client, device, has_scenes):
    device.has_scenes = has_scenes
    device.live_scene = LightScene.HALLOWEEN
    live = await client.get_live_mode()
    assert live.eye_icon == device.eye_icon
    assert live.scene is (LightScene.HALLOWEEN if has_scenes else None)


async def test_file_list_ignores_leftovers_and_repeats(client, device):
    """Each file once, even with file info from an earlier read."""
    # An earlier read (of two files) that nobody waits for any more
    await client.query_file_list()
    await asyncio.sleep(0)
    heard = []
    client.add_event_listener(heard.append)
    device.add_file("laugh.mp3")

    # The device repeats each reply to this read
    original = device._cmd_AAD0

    def twice(p):
        original(p)
        original(p)

    device._cmd_AAD0 = twice
    device.finish_playback(2)  # something else meanwhile
    files = await client.get_file_list(timeout=2)
    assert [f.file_index for f in files] == [1, 2, 3]
    assert [e.file_index for e in heard if isinstance(e, parser.PlaybackEvent)] == [2]


async def test_file_list_starts_over_on_a_late_reply(client, device):
    """A late reply to an earlier read, with an older total, doesn't count."""
    # An earlier read's replies (two files), still on the way
    late = []
    notify = device._notify
    device._notify = late.append
    device._cmd_AAD0(b"")
    device._notify = notify
    device.add_file("laugh.mp3")
    original = device._cmd_AAD0

    def after_a_late_one(p):
        notify(late[0])
        original(p)

    device._cmd_AAD0 = after_a_late_one
    files = await client.get_file_list(timeout=2)
    assert [f.file_index for f in files] == [1, 2, 3]
    assert [f.total_files for f in files] == [3, 3, 3]


async def test_file_list_times_out_when_files_go_missing(client, device):
    """The deadline passing between file reports gives the timeout."""
    original = device._cmd_AAD0
    notify = device._notify

    def first_file_only(p):
        sent = []
        device._notify = sent.append
        original(p)
        device._notify = notify
        notify(sent[0])

    device._cmd_AAD0 = first_file_only
    with pytest.raises(TimeoutError, match="Expected 2, received 1"):
        await client.get_file_list(timeout=0.05)


async def test_reply_buffered_when_the_link_drops_is_dropped(client, device):
    """A reply received just before a drop is gone after it."""
    with client.subscribe(lambda e: isinstance(e, parser.VolumeEvent)) as stream:
        await client.send_command(commands.query_volume())
        await asyncio.sleep(0)
        assert stream.has(lambda e: True)
        device.drop_connection()
        await asyncio.sleep(0)
        assert not stream.has(lambda e: True)


async def test_cancelled_query_leaves_nothing_behind(client, device):
    device.unresponsive = True
    query = asyncio.create_task(client.get_volume(timeout=5))
    await asyncio.sleep(0)
    query.cancel()
    with pytest.raises(asyncio.CancelledError):
        await query
    assert not client._events._streams, "its subscription ended"
    device.unresponsive = False
    device.volume = 7
    assert await asyncio.wait_for(client.get_volume(), 1) == 7


async def test_failing_listener_does_not_stop_others(client, device, caplog):
    heard = []

    def broken(event):
        raise RuntimeError("boom")

    client.add_event_listener(broken)
    client.add_event_listener(heard.append)
    device.volume = 5
    assert await client.get_volume() == 5
    device.finish_playback(1)
    await asyncio.sleep(0)
    assert [type(e).__name__ for e in heard] == ["VolumeEvent", "PlaybackEvent"]
    assert "Error in event listener" in caplog.text


async def test_drop_during_query_fails_fast(client, device):
    device.unresponsive = True
    task = asyncio.create_task(client.get_volume(timeout=30))
    await asyncio.sleep(0)
    device.drop_connection()
    with pytest.raises(ConnectionLostError):
        await asyncio.wait_for(task, 1)  # not after the 30 s timeout


async def test_reply_from_lost_connection_is_not_taken_for_new_query(client, device):
    """A late reply on the old link must not answer a query on the new one."""
    device.volume = 10
    await client.send_command(commands.query_volume())  # reply in flight
    device.drop_connection()
    await asyncio.sleep(0)
    device.volume = 20
    assert await client.connect(client=device)
    assert await client.get_volume() == 20


async def test_upload_round_trip(client, device):
    data = bytes(range(256)) * 20
    await FileTransferManager().send_file(client, data, "boo.mp3")
    assert device.file("boo.mp3").data == data


@pytest.mark.parametrize(
    ("mtu", "chunk"), [(185, 177), (247, 239), (512, 500), (517, 500)]
)
async def test_upload_chunks_fill_one_write(client, device, mtu, chunk):
    """Each C1 frame fits the MTU, like the app's: data is MTU - 8 bytes.

    The file goes through on the first attempt, without a lost write.
    """
    device.mtu_size = mtu
    data = bytes(range(256)) * 8
    await FileTransferManager().send_file(client, data, "fit.mp3")
    assert device.file("fit.mp3").data == data
    assert device.oversized_writes == []
    sizes = [len(w) - 5 for w in device.writes if w[:2] == b"\xaa\xc1"]
    assert max(sizes) == chunk
    assert len(sizes) == -(-len(data) // chunk)  # no retry


def test_chunk_size_at_the_smallest_mtu():
    # At MTU 23 a C1 frame holds 15 data bytes. (The C0 frame with the name
    # doesn't fit there at all, so uploads need a bigger MTU anyway.)
    assert FileTransferManager.calculate_chunk_size_from_mtu(23) == 15


async def test_upload_retries_with_smaller_chunks(client, device):
    device.mtu_size = 247  # suggests 239-byte chunks...
    device.max_chunk_payload = 100  # ...but only 100 get through
    data = bytes(range(256)) * 10
    progress = []
    await FileTransferManager().send_file(
        client, data, "big.mp3", progress_callback=lambda s, t: progress.append((s, t))
    )
    assert device.file("big.mp3").data == data
    assert progress[-1][0] == progress[-1][1]


async def test_upload_stops_at_an_early_failure_report(client, device, caplog):
    """The device can report a lost chunk before the upload has finished.

    The rest of that attempt isn't sent, and its failure report isn't taken
    for the next attempt's.
    """
    caplog.set_level(logging.DEBUG)
    device.max_chunk_payload = 100
    device.report_lost_chunks = True
    data = bytes(range(256)) * 10
    await FileTransferManager().send_file(client, data, "early.mp3")
    assert device.file("early.mp3").data == data
    assert "Received early BBC2" in caplog.text
    # The first attempt stopped after its first (lost) chunk
    first_attempt = device.writes[: device.writes.index(commands.cancel_send())]
    assert sum(w[:2] == b"\xaa\xc1" for w in first_attempt) == 1


async def test_upload_gives_up_eventually(client, device):
    device.max_chunk_payload = 0
    with pytest.raises(FileTransferError, match="3 attempts"):
        await FileTransferManager().send_file(client, b"x" * 2000, "nope.mp3")
    assert "nope.mp3" not in [f.name for f in device.files]


async def test_commands_are_valid_frames(client, device):
    await client.set_light_rgb(
        0, 1, 2, 3, 0, device.file("hello.mp3").cluster, "hello.mp3"
    )
    await client.set_eye_icon(5, device.file("Grüße 🎃.mp3").cluster, "Grüße 🎃.mp3")
    assert device.bad_frames == []
    assert device.file("Grüße 🎃.mp3").eye_icon == 5


async def test_rest_session_passed_in_is_used_and_left_open():
    """HA's shared session is the caller's: disconnect doesn't close it."""
    async with aiohttp.ClientSession() as shared:
        c = SkellyClient(address="AA:BB:CC:DD:EE:FF", session=shared)
        assert c._get_rest_session() is shared
        await c.disconnect()
        assert not shared.closed
        assert c._get_rest_session() is shared

    own = SkellyClient(address="AA:BB:CC:DD:EE:FF")
    session = own._get_rest_session()
    assert session is own._get_rest_session()
    await own.disconnect()
    assert session.closed, "a session the client made itself is closed"
