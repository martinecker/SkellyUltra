"""REST server BLE sessions to the same device share one BlueZ link.

bleak skips BlueZ's Connect when the device is already connected, so a new
session to a device that an older (abandoned) session still holds rides on
the same link, and disconnecting either client drops it for both.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from bleak.backends.device import BLEDevice

from custom_components.skelly_ultra.skelly_ultra_srv import ble_session_manager
from custom_components.skelly_ultra.skelly_ultra_srv.ble_session_manager import (
    BLESession,
    BLESessionManager,
)

ADDRESS = "AA:BB:CC:DD:EE:FF"


class FakeBus:
    def __init__(self) -> None:
        self.closed = False

    def disconnect(self) -> None:
        self.closed = True


class FakeBackend:
    """The parts of bleak's BlueZ backend that releasing a client touches."""

    def __init__(self) -> None:
        self._bus = FakeBus()
        self._is_connected = True
        self._disconnect_monitor_event = asyncio.Event()
        self.watching = True

    def _cleanup_all(self) -> None:
        self.watching = False


class FakeClient:
    def __init__(self, device: BLEDevice | None = None, **kwargs) -> None:
        self.device = device
        self._backend = FakeBackend()
        self.calls: list[str] = []

    @property
    def is_connected(self) -> bool:
        return self._backend._is_connected

    async def connect(self) -> None:
        self.calls.append("connect")

    async def start_notify(self, uuid, callback) -> None:
        self.calls.append("start_notify")
        self.notify = callback

    async def stop_notify(self, uuid) -> None:
        self.calls.append("stop_notify")

    async def disconnect(self) -> None:
        # Device1.Disconnect: drops the link shared by all sessions
        self.calls.append("disconnect")


def add_session(manager: BLESessionManager, session_id: str) -> BLESession:
    session = BLESession(session_id, FakeClient(), ADDRESS)
    session.device = BLEDevice(
        ADDRESS, "Animated Skelly", {"path": "/org/bluez/hci0/dev"}
    )
    session.adapter = "hci0"
    manager._sessions[session_id] = session
    return session


async def test_closing_an_older_session_keeps_the_newer_ones_link() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")

    await manager.disconnect_session("sess-old")

    assert "disconnect" not in old.client.calls
    assert "stop_notify" in old.client.calls  # Per D-Bus connection in BlueZ
    backend = old.client._backend
    assert backend._bus is None  # A later disconnect() is a no-op in bleak
    assert backend.watching is False
    assert backend._disconnect_monitor_event is None
    assert not old.is_connected
    assert new.client.calls == []
    assert list(manager._sessions) == ["sess-new"]


async def test_closing_the_newest_session_drops_the_link_and_older_sessions() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")

    await manager.disconnect_session("sess-new")

    assert new.client.calls == ["stop_notify", "disconnect"]
    assert "disconnect" in old.client.calls
    assert old.disconnected_event.is_set()  # Wakes a pending long-poll
    assert manager._sessions == {}


async def test_a_dropped_newer_session_does_not_keep_an_older_one() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")
    new.mark_disconnected()
    new.client._backend._is_connected = False

    await manager.disconnect_session("sess-old")

    assert "disconnect" in old.client.calls
    assert list(manager._sessions) == ["sess-new"]


async def test_other_devices_are_not_affected() -> None:
    manager = BLESessionManager()
    other = add_session(manager, "sess-other")
    other.address = "11:22:33:44:55:66"
    mine = add_session(manager, "sess-mine")

    await manager.disconnect_session("sess-mine")

    assert "disconnect" in mine.client.calls
    assert other.client.calls == []


async def test_unexpected_bleak_internals_leave_the_client_open() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    add_session(manager, "sess-new")
    old.client._backend = object()

    await manager.disconnect_session("sess-old")

    assert old.client.calls == ["stop_notify"]
    assert list(manager._sessions) == ["sess-new"]


async def test_stop_closes_every_session_once() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")

    await manager.stop()

    assert "disconnect" not in old.client.calls
    assert new.client.calls == ["stop_notify", "disconnect"]
    assert manager._sessions == {}


async def test_idle_cleanup_keeps_the_active_session(monkeypatch) -> None:
    """The reported loop: cleaning up an abandoned session killed the new one."""
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")
    old.last_activity = datetime.now(UTC) - timedelta(minutes=5)

    sleeps = 0

    async def fake_sleep(delay: float) -> None:
        nonlocal sleeps
        sleeps += 1
        if sleeps > 1:
            raise asyncio.CancelledError

    monkeypatch.setattr(ble_session_manager.asyncio, "sleep", fake_sleep)
    await manager._cleanup_loop()

    assert "disconnect" not in old.client.calls
    assert new.client.calls == []
    assert list(manager._sessions) == ["sess-new"]


async def test_reconnect_shares_the_link_of_a_session_still_connected(
    monkeypatch,
) -> None:
    """A connected device doesn't advertise, so it is never in the cache."""
    monkeypatch.setattr(ble_session_manager, "BleakClient", FakeClient)
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    old.last_activity = datetime.now(UTC) - timedelta(minutes=5)

    session_id, address, _mtu = await manager.create_session(ADDRESS, "", timeout=1)

    new = manager._sessions[session_id]
    assert address == ADDRESS
    assert new.client.device is old.device
    assert new.client.calls == ["connect", "start_notify"]

    # Notifications reach every session on the link, so they don't count as
    # client activity (or an abandoned session would never go idle)
    before = new.last_activity
    new.client.notify("0000ae02", b"\x01")
    assert new.notification_buffer.qsize() == 1
    assert new.last_activity == before

    await manager.disconnect_session("sess-old")
    assert "disconnect" not in old.client.calls


async def test_closing_an_unknown_session_raises() -> None:
    with pytest.raises(ValueError):
        await BLESessionManager().disconnect_session("sess-nope")


async def test_a_failed_write_flag_does_not_drop_a_shared_link() -> None:
    """send_command flags a session on any write error; the link stays up."""
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    new = add_session(manager, "sess-new")
    old.mark_disconnected()  # Flagged, but bleak still reports connected

    await manager.disconnect_session("sess-old")
    assert "disconnect" not in old.client.calls

    # Likewise a flagged newer session still holds the link
    other = add_session(manager, "sess-other")
    new.mark_disconnected()
    await manager.disconnect_session("sess-other", idle=False)
    assert "disconnect" in other.client.calls  # It was the newest


async def test_idle_cleanup_of_the_newest_keeps_an_active_older_session() -> None:
    """E.g. a web controller tab closed without disconnecting while HA runs."""
    manager = BLESessionManager()
    ha = add_session(manager, "sess-ha")
    web = add_session(manager, "sess-web")

    await manager.disconnect_session("sess-web", idle=True)

    assert "disconnect" not in web.client.calls
    assert ha.client.calls == []
    assert list(manager._sessions) == ["sess-ha"]


async def test_a_connect_in_progress_keeps_the_link() -> None:
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")
    manager._connecting[ADDRESS] = 1

    await manager.disconnect_session("sess-old", idle=True)

    assert "disconnect" not in old.client.calls


async def test_stop_handles_sessions_stored_out_of_order(caplog) -> None:
    manager = BLESessionManager()
    newest = add_session(manager, "sess-newest")
    oldest = add_session(manager, "sess-oldest")
    newest.serial, oldest.serial = oldest.serial, newest.serial

    await manager.stop()

    assert "disconnect" in newest.client.calls
    assert manager._sessions == {}
    assert "Error disconnecting" not in caplog.text


async def test_a_poll_of_buffered_data_counts_as_activity() -> None:
    manager = BLESessionManager()
    session = add_session(manager, "sess-a")
    session.last_activity = datetime.now(UTC) - timedelta(minutes=5)
    session.buffer_notification("0000ae02", b"\x01")

    result = await manager.get_notifications("sess-a", since=0, timeout=1)

    assert len(result["notifications"]) == 1
    assert session.last_activity > datetime.now(UTC) - timedelta(seconds=5)


class FailingNotifyClient(FakeClient):
    async def start_notify(self, uuid, callback) -> None:
        raise RuntimeError("Notify failed")


class HangingNotifyClient(FakeClient):
    async def start_notify(self, uuid, callback) -> None:
        await asyncio.sleep(10)


@pytest.mark.parametrize("client_class", [FailingNotifyClient, HangingNotifyClient])
async def test_a_failed_connect_on_a_shared_link_keeps_it(
    monkeypatch, client_class
) -> None:
    created: list[FakeClient] = []

    def make_client(*args, **kwargs) -> FakeClient:
        created.append(client_class(*args, **kwargs))
        return created[-1]

    monkeypatch.setattr(ble_session_manager, "BleakClient", make_client)
    manager = BLESessionManager()
    old = add_session(manager, "sess-old")

    connect = asyncio.ensure_future(manager.create_session(ADDRESS, "", timeout=1))
    await asyncio.sleep(0.05)
    if not connect.done():
        connect.cancel()  # HA gave up waiting
    with pytest.raises((RuntimeError, asyncio.CancelledError)):
        await connect

    assert "disconnect" not in created[0].calls
    assert created[0]._backend._bus is None  # Released
    assert old.client.calls == []
    assert manager._connecting == {}
    assert list(manager._sessions) == ["sess-old"]


async def test_a_failed_connect_alone_disconnects(monkeypatch) -> None:
    created: list[FakeClient] = []

    def make_client(*args, **kwargs) -> FakeClient:
        created.append(FailingNotifyClient(*args, **kwargs))
        return created[-1]

    monkeypatch.setattr(ble_session_manager, "BleakClient", make_client)
    manager = BLESessionManager()
    manager._device_cache[ADDRESS] = ble_session_manager.CachedDevice(
        BLEDevice(ADDRESS, "Animated Skelly", {"path": "/org/bluez/hci0/dev"}),
        -60,
        datetime.now(UTC),
    )
    with pytest.raises(RuntimeError):
        await manager.create_session(ADDRESS, "", timeout=0)

    assert "disconnect" in created[0].calls
    assert manager._connecting == {}
