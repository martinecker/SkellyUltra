"""The BLE client library (skelly_ultra_pkg), against the simulated device.

No Home Assistant here: these drive SkellyClient and FileTransferManager
directly, for behavior that is hard to reach through entities.
"""

import asyncio

import pytest

from custom_components.skelly_ultra.skelly_ultra_pkg import commands
from custom_components.skelly_ultra.skelly_ultra_pkg.client import (
    ConnectionLostError,
    SkellyClient,
)
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
    # A notification nobody asked for arrives first (the device reports playback).
    device.finish_playback(1)
    assert await client.get_volume() == 33
    # ...and is still there for whoever waits for it.
    ev = await client._wait_for_event(lambda e: type(e).__name__ == "PlaybackEvent")
    assert ev.file_index == 1


async def test_file_list_with_unicode_names(client, device):
    files = await client.get_file_list(timeout=2)
    assert [f.name for f in files] == ["hello.mp3", "Grüße 🎃.mp3"]
    assert [f.file_index for f in files] == [1, 2]


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


async def test_upload_retries_with_smaller_chunks(client, device):
    device.mtu_size = 247  # suggests ~244-byte chunks...
    device.max_chunk_payload = 100  # ...but only 100 get through
    data = bytes(range(256)) * 10
    progress = []
    await FileTransferManager().send_file(
        client, data, "big.mp3", progress_callback=lambda s, t: progress.append((s, t))
    )
    assert device.file("big.mp3").data == data
    assert progress[-1][0] == progress[-1][1]


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
