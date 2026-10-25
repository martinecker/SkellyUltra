"""BLE session manager for proxying BLE connections."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import contextlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
import logging
import re
import uuid

from bleak import BleakClient, BleakScanner
from bleak.backends.bluezdbus import manager as bluez_manager
from bleak.backends.bluezdbus.version import BlueZFeatures
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData
from bleak.exc import BleakDBusError
from dbus_fast import Message as FastMessage, MessageType as FastMessageType
from dbus_next import BusType, Message, MessageType
from dbus_next.aio import MessageBus

from .adapter_selection import AdapterChoice, LiveConstraints, choose_adapter
from .bluez_discovery import run_discovery_call

_LOGGER = logging.getLogger(__name__)


def _put_nowait_dropping_oldest(queue: asyncio.Queue, item) -> None:
    """Put item into an asyncio.Queue, dropping the oldest item if full.

    If the queue is still full after dropping the oldest item (e.g. due to
    concurrent access), the item is silently skipped.
    """
    try:
        queue.put_nowait(item)
    except asyncio.QueueFull:
        try:
            queue.get_nowait()
            queue.put_nowait(item)
        except Exception:
            pass

# Skelly Ultra BLE UUIDs
WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"


async def _prime_bluez_version_check(timeout: float = 5.0) -> None:
    """Do bleak's one-time BlueZ version check ourselves, with a timeout.

    bleak runs `bluetoothctl --version` on the first connect after start and
    makes every other connect wait for it without a timeout. After a Pi
    power-up that check cant hang and no connect ever finishes, so we run it here
    at startup and mark it done whatever happens.
    """
    if BlueZFeatures.checked_bluez_version:
        return
    proc = None
    try:
        async with asyncio.timeout(timeout):
            proc = await asyncio.create_subprocess_exec(
                "bluetoothctl",
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            out, _ = await proc.communicate()
        match = re.search(rb"(\d+)\.(\d+)", out)
        if match:
            major, minor = map(int, match.groups())
            BlueZFeatures.supported_version = major == 5 and minor >= 55
            _LOGGER.info("BlueZ version %d.%d", major, minor)
        else:
            _LOGGER.warning("Could not parse BlueZ version, assuming 5.55+")
    except Exception as exc:  # noqa: BLE001 - assume a supported BlueZ
        _LOGGER.warning("BlueZ version check failed (%s), assuming 5.55+", exc)
        if proc is not None and proc.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
    BlueZFeatures.checked_bluez_version = True


# A BleakScanner start that takes longer than this is treated as stuck
SCANNER_START_TIMEOUT = 15.0
# How often the background scanner retries a failed start
SCANNER_RETRY_INTERVAL = 10.0
# Weight of a new RSSI reading in an adapter's average for a device
RSSI_AVERAGING = 0.3
# How long a connect waits for every scanning adapter to report the device,
# so the adapter is chosen from all of them
ADAPTER_REPORT_GRACE = 2.0


def _adapter_of(device: BLEDevice) -> str | None:
    """Return the adapter (e.g. "hci0") whose BlueZ object device is."""
    details = device.details
    path = details.get("path") if isinstance(details, dict) else None
    if not isinstance(path, str) or not path.startswith("/org/bluez/hci"):
        return None
    return path.split("/")[3]


async def _list_adapters() -> list[str]:
    """Return the names of the powered adapters, e.g. ["hci0", "hci1"].

    An adapter that doesn't power on (e.g. a dongle whose firmware fails to
    load) still shows up in BlueZ, but can't scan or connect.
    """
    bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
    try:
        reply = await bus.call(
            Message(
                destination="org.bluez",
                path="/",
                interface="org.freedesktop.DBus.ObjectManager",
                member="GetManagedObjects",
            )
        )
    finally:
        bus.disconnect()
    if reply.message_type == MessageType.ERROR:
        raise RuntimeError(f"GetManagedObjects failed: {reply.body}")
    adapters = []
    for path, interfaces in reply.body[0].items():
        props = interfaces.get("org.bluez.Adapter1")
        if props is None:
            continue
        powered = props.get("Powered")
        if powered is not None and powered.value:
            adapters.append(path.rsplit("/", 1)[-1])
    return sorted(adapters)


def _reset_bleak_bluez_manager() -> None:
    """Drop bleak's shared BlueZ D-Bus connection for this event loop.

    bleak keeps one BlueZ manager per event loop and serializes its D-Bus
    calls with a lock. Right after a Pi power-up a scanner start's D-Bus call
    never got a reply, so it held that lock forever and every connect waited
    on it. The next bleak call after this reset creates a fresh manager.
    Uses bleak internals (bleak 3.x); anything still registered with the old
    manager (scanners, connected clients) stops getting updates.
    """
    loop = asyncio.get_running_loop()
    instances = getattr(bluez_manager, "_global_instances", None)
    if instances is None:
        _LOGGER.warning("Cannot reset bleak's BlueZ manager (unknown bleak version)")
        return
    manager = instances.pop(loop, None)
    bus = getattr(manager, "_bus", None)
    if bus is not None:
        try:
            bus.disconnect()
        except Exception:  # noqa: BLE001 - best effort
            _LOGGER.debug("Disconnecting the old BlueZ bus failed", exc_info=True)
    _LOGGER.warning("Reset bleak's BlueZ D-Bus connection")


async def _stop_bleak_discovery(
    adapter: str | None = None, timeout: float = 5.0
) -> None:
    """Withdraw a discovery request bleak's BlueZ connection may still hold.

    BlueZ registers a client for discovery as soon as StartDiscovery arrives,
    so a start we gave up on can stay active, and every retry on the same
    connection then fails with InProgress. Used after a failed scanner stop,
    and when the connection can't be reset because sessions depend on it.
    BlueZ answers InProgress while a request of that client is still pending
    (see bluez_discovery), so that is retried until the timeout. Best effort.
    adapter: e.g. "hci1"; bleak's default adapter if not given.
    """
    instances = getattr(bluez_manager, "_global_instances", None) or {}
    manager = instances.get(asyncio.get_running_loop())
    bus = getattr(manager, "_bus", None)
    if manager is None or bus is None or not bus.connected:
        return
    try:
        async with asyncio.timeout(timeout):
            while True:
                message = FastMessage(
                    destination="org.bluez",
                    path=(
                        f"/org/bluez/{adapter}"
                        if adapter
                        else manager.get_default_adapter()
                    ),
                    interface="org.bluez.Adapter1",
                    member="StopDiscovery",
                )
                reply = await run_discovery_call(
                    lambda message=message: bus.call(message), timeout
                )
                if (
                    reply is None
                    or reply.message_type != FastMessageType.ERROR
                    or reply.error_name != "org.bluez.Error.InProgress"
                ):
                    return
                await asyncio.sleep(0.5)
    except Exception:  # noqa: BLE001 - best effort
        _LOGGER.debug("StopDiscovery on bleak's connection failed", exc_info=True)


@dataclass
class RawNotification:
    """Raw BLE notification with metadata."""

    sequence: int
    timestamp: str
    sender: str  # UUID of characteristic
    data: bytes  # Raw notification bytes


@dataclass
class AdapterSighting:
    """A device as seen by one adapter."""

    device: BLEDevice  # BlueZ object on that adapter, to connect through it
    rssi: float  # Moving average of the adapter's readings
    last_seen: datetime


@dataclass
class CachedDevice:
    """Cached BLE device with last seen timestamp."""

    device: BLEDevice
    rssi: int
    last_seen: datetime
    # Per adapter (e.g. "hci0"), to pick the adapter with the best signal
    sightings: dict[str, AdapterSighting] = field(default_factory=dict)


class BLESession:
    """Single BLE connection session with notification buffering."""

    def __init__(self, session_id: str, client: BleakClient, address: str) -> None:
        """Initialize BLE session.

        Args:
            session_id: Unique session identifier
            client: Connected BleakClient instance
            address: BLE device address
        """
        self.session_id = session_id
        self.client = client
        self.address = address
        self.notification_buffer: asyncio.Queue[RawNotification] = asyncio.Queue(
            maxsize=200
        )
        self._sequence = 0
        self.created_at = datetime.now(UTC)
        self.last_activity = datetime.now(UTC)
        self.is_connected = True  # Track connection state
        self.adapter: str | None = None  # Adapter the link uses, e.g. "hci0"
        self.device: BLEDevice | None = None  # Its BlueZ object on that adapter
        # Set when the BLE link drops, to wake a pending notifications long-poll
        self.disconnected_event = asyncio.Event()

    def mark_disconnected(self) -> None:
        """Record that the BLE link dropped and wake any pending long-poll."""
        self.is_connected = False
        self.disconnected_event.set()

    def next_sequence(self) -> int:
        """Get next sequence number.

        Returns:
            Next sequence number for notifications
        """
        self._sequence += 1
        return self._sequence

    def buffer_notification(self, sender, data: bytes) -> None:
        """Buffer raw notification bytes.

        Args:
            sender: Characteristic UUID that sent the notification
            data: Raw notification bytes
        """
        notification = RawNotification(
            sequence=self.next_sequence(),
            timestamp=datetime.now(UTC).isoformat(),
            sender=str(sender),
            data=data,
        )
        _put_nowait_dropping_oldest(self.notification_buffer, notification)


class BLESessionManager:
    """Manages BLE sessions with raw notification buffering."""

    def __init__(self) -> None:
        """Initialize session manager."""
        self._sessions: dict[str, BLESession] = {}
        self._cleanup_task: asyncio.Task | None = None
        self._scanner_task: asyncio.Task | None = None
        # One background scanner per adapter (e.g. "hci0"), so each adapter's
        # signal to each device is known
        self._scanners: dict[str, BleakScanner] = {}
        self._scanners_started: set[str] = set()  # Adapters that are scanning
        self._scanning = False  # Whether the background scanner loop started
        # BLE address -> adapter of its last session
        self._last_adapter: dict[str, str] = {}
        # Classic (live mode) side's requirements for a BLE address, if any
        self._live_constraints: Callable[[str], LiveConstraints] | None = None
        # Serializes starts (background loop and resume can race)
        self._scanner_start_lock = asyncio.Lock()
        self._direct_scan_lock = asyncio.Lock()
        # Wakes the background scanner loop to (re)start the scanner
        self._scanner_wakeup = asyncio.Event()
        # Connects between client.connect() and their session being stored
        # or aborted; they depend on bleak's BlueZ connection too
        self._connects_in_flight = 0
        self._scanner_paused = False
        self._scanner_holds = 0  # Pending pauses (connects, playback)
        self._device_cache: dict[
            str, CachedDevice
        ] = {}  # Cache scanned devices with timestamps
        self._device_cache_timeout = 120  # Remove devices not seen in 2 minutes

    async def start(self) -> None:
        """Start the session manager and background tasks."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        if self._scanner_task is None:
            await _prime_bluez_version_check()
            self._scanner_task = asyncio.create_task(self._background_scanner())
            _LOGGER.info("Started background BLE scanner")

    async def stop(self) -> None:
        """Stop the session manager and disconnect all sessions."""
        if self._scanner_task:
            self._scanner_task.cancel()
            try:
                await self._scanner_task
            except asyncio.CancelledError:
                pass
            self._scanner_task = None
            _LOGGER.info("Stopped background BLE scanner")

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

        # Disconnect all sessions
        for session_id in list(self._sessions.keys()):
            try:
                await self.disconnect_session(session_id)
            except Exception:
                _LOGGER.exception("Error disconnecting session %s", session_id)

    async def _pause_scanner(self) -> None:
        """Pause the background scanner temporarily.

        Pauses are counted, so a connect finishing during audio playback
        does not restart the scanner. Each call needs one _resume_scanner().
        """
        self._scanner_holds += 1
        if self._scanning and not self._scanner_paused:
            _LOGGER.info("Pausing background BLE scanner")
            self._scanner_paused = True
            await self._stop_scanner()

    async def _resume_scanner(self) -> None:
        """Resume the background scanner once no pause is pending."""
        self._scanner_holds = max(0, self._scanner_holds - 1)
        if self._scanner_holds:
            return
        if self._scanning and self._scanner_paused:
            _LOGGER.info("Resuming background BLE scanner")
            self._scanner_paused = False
            # The background scanner loop starts it, so a hanging start can't
            # hold up the caller (e.g. the answer to a connect request)
            self._scanner_wakeup.set()

    async def pause_scanning(self) -> None:
        """Pause background scanning (e.g. while audio plays on the adapter)."""
        await self._pause_scanner()

    async def resume_scanning(self) -> None:
        """Undo one pause_scanning() call."""
        await self._resume_scanner()

    def set_live_constraints_provider(
        self, provider: Callable[[str], LiveConstraints] | None
    ) -> None:
        """Set what the live mode side requires of a BLE connect's adapter."""
        self._live_constraints = provider

    def _on_detection(
        self, device: BLEDevice, advertisement_data: AdvertisementData
    ) -> None:
        """Handle device detection during background scan."""
        now = datetime.now(UTC)
        rssi = advertisement_data.rssi
        cached = self._device_cache.get(device.address)
        if cached is None:
            cached = CachedDevice(device=device, rssi=rssi, last_seen=now)
            self._device_cache[device.address] = cached
        else:
            cached.device = device
            cached.rssi = rssi
            cached.last_seen = now

        adapter = _adapter_of(device)
        # bleak also reports other property changes, and a device whose RSSI
        # BlueZ dropped (after discovery stopped) as -127: not a reading
        props = (advertisement_data.platform_data or (None, None))[-1]
        if adapter is None or not isinstance(props, dict) or "RSSI" not in props:
            return
        sighting = cached.sightings.get(adapter)
        if (
            sighting is None
            or (now - sighting.last_seen).total_seconds() > self._device_cache_timeout
        ):
            cached.sightings[adapter] = AdapterSighting(device, float(rssi), now)
        else:
            sighting.device = device
            sighting.rssi += RSSI_AVERAGING * (rssi - sighting.rssi)
            sighting.last_seen = now

    def _new_scanner(self, adapter: str | None = None) -> None:
        """Replace an adapter's background scanner (default: all) with a fresh one."""
        for name in [adapter] if adapter else list(self._scanners):
            self._scanners[name] = BleakScanner(
                detection_callback=self._on_detection, bluez={"adapter": name}
            )
            self._scanners_started.discard(name)

    async def _refresh_scanner_adapters(self) -> None:
        """Keep one background scanner per adapter BlueZ currently has."""
        try:
            adapters = await _list_adapters()
        except Exception:  # noqa: BLE001 - keep the current scanners
            _LOGGER.debug("Listing Bluetooth adapters failed", exc_info=True)
            return
        async with self._scanner_start_lock:
            for name in list(self._scanners):
                if name in adapters:
                    continue
                _LOGGER.info(
                    "Bluetooth adapter %s is gone or powered off, dropping its "
                    "BLE scanner",
                    name,
                )
                if name in self._scanners_started:
                    # BlueZ dropped the adapter's discovery with it, but bleak
                    # still has the scanner's callback registered; stop()
                    # removes it before its StopDiscovery fails
                    with contextlib.suppress(Exception):
                        await run_discovery_call(self._scanners[name].stop, 5.0)
                del self._scanners[name]
                self._scanners_started.discard(name)
                for cached in self._device_cache.values():
                    cached.sightings.pop(name, None)
            for name in adapters:
                if name not in self._scanners:
                    _LOGGER.info("Adding background BLE scanner for %s", name)
                    self._new_scanner(name)

    def _adapter_rssi(self, address: str) -> dict[str, float]:
        """Return the averaged RSSI per adapter that has recently seen address."""
        cached = self._device_cache.get(address.upper())
        if cached is None:
            return {}
        now = datetime.now(UTC)
        return {
            adapter: sighting.rssi
            for adapter, sighting in cached.sightings.items()
            if (now - sighting.last_seen).total_seconds() <= self._device_cache_timeout
        }

    def adapter_rssi(self, address: str) -> dict[str, float]:
        """Public form of _adapter_rssi(), for the live mode side's planning."""
        return self._adapter_rssi(address)

    def _connected_session(self, address: str) -> BLESession | None:
        """Return a connected session to address, if any."""
        address = address.upper()
        for session in self._sessions.values():
            if session.address.upper() == address and session.is_connected:
                return session
        return None

    def connected_adapter(self, address: str) -> str | None:
        """Return the adapter of a connected session to address, if any."""
        session = self._connected_session(address)
        return session.adapter if session else None

    async def _start_scanner(self) -> bool:
        """Start every adapter's background scanner that isn't running.

        Returns whether all of them are scanning.
        """
        async with self._scanner_start_lock:
            if not self._scanners or self._scanner_paused:
                return False
            all_started = True
            for adapter in list(self._scanners):
                if self._scanner_paused:
                    return False
                if adapter in self._scanners_started:
                    continue
                if not await self._start_adapter_scanner(adapter):
                    all_started = False
            return all_started

    async def _start_adapter_scanner(self, adapter: str) -> bool:
        """Start one adapter's background scanner, giving up if the start hangs.

        Returns whether it is scanning. A stuck start is cancelled (which
        releases bleak's BlueZ lock) and, when no session needs it, bleak's
        BlueZ connection is reset so the next try starts clean.
        Called with _scanner_start_lock held.
        """
        scanner = self._scanners.get(adapter)
        if scanner is None:
            return False
        try:
            await run_discovery_call(
                scanner.start, SCANNER_START_TIMEOUT, run_if_abandoned=False
            )
        except TimeoutError:
            _LOGGER.warning(
                "Background BLE scanner start on %s hung for %.0fs, will retry",
                adapter,
                SCANNER_START_TIMEOUT,
            )
            await self._recover_bluez_manager(adapter=adapter)
            return False
        except BleakDBusError as exc:
            _LOGGER.warning(
                "Background BLE scanner failed to start on %s: %s", adapter, exc
            )
            if exc.dbus_error == "org.bluez.Error.InProgress":
                # Likely a discovery request from a start we gave up on
                await self._recover_bluez_manager(adapter=adapter)
            else:
                self._new_scanner(adapter)
            return False
        except Exception as exc:  # noqa: BLE001 - retried by the scanner loop
            _LOGGER.warning(
                "Background BLE scanner failed to start on %s: %s", adapter, exc
            )
            self._new_scanner(adapter)
            return False
        if self._scanner_paused or scanner is not self._scanners.get(adapter):
            # Paused (or replaced) while starting: undo the start
            try:
                await run_discovery_call(scanner.stop, SCANNER_START_TIMEOUT)
            except TimeoutError:
                _LOGGER.warning("Background BLE scanner stop on %s hung", adapter)
                await self._recover_bluez_manager(adapter=adapter)
            except Exception:  # noqa: BLE001 - best effort
                _LOGGER.debug("Undoing a scanner start failed", exc_info=True)
                await _stop_bleak_discovery(adapter)
            return False
        self._scanners_started.add(adapter)
        _LOGGER.info("Background BLE scanner started on %s", adapter)
        return True

    async def _recover_bluez_manager(
        self, own_connect: bool = False, adapter: str | None = None
    ) -> None:
        """Reset bleak's BlueZ connection after a hang, if nothing needs it.

        Connected sessions and connects in progress get their notifications
        and disconnect events through that connection, so it's left alone
        while any exist (cancelling the stuck call has already released its
        lock); a leftover discovery request is withdrawn instead, on adapter
        (the one whose scanner failed) or on every scanner's adapter.
        own_connect: called by a connect that is itself still counted.
        """
        others_connecting = self._connects_in_flight - (1 if own_connect else 0)
        if others_connecting > 0 or any(
            session.is_connected for session in self._sessions.values()
        ):
            _LOGGER.warning(
                "Not resetting bleak's BlueZ connection: it is in use by sessions"
            )
            adapters = [adapter] if adapter else list(self._scanners)
            for name in adapters:
                if name in self._scanners:
                    self._new_scanner(name)
            for name in adapters or [None]:
                await _stop_bleak_discovery(name)
            return

        async def reset() -> None:
            # BlueZ stops the connection's discovery once it sees the
            # disconnect, which is a discovery request of its own
            _reset_bleak_bluez_manager()
            await asyncio.sleep(1.0)

        await run_discovery_call(reset)
        # All scanners were registered with the dropped manager
        self._new_scanner()

    async def _stop_scanner(self) -> None:
        """Stop every adapter's background scanner that is scanning."""
        for adapter in list(self._scanners_started):
            await self._stop_adapter_scanner(adapter)

    async def _stop_adapter_scanner(self, adapter: str) -> None:
        """Stop one adapter's background scanner. Best effort.

        StopDiscovery fails with InProgress once BlueZ has lost track of an
        earlier discovery request of bleak's connection (see bluez_discovery),
        and it can hang like a start. That must not fail the connect that
        pauses the scanner. bleak drops the scanner's stop handle before it
        calls StopDiscovery, so the scanner is replaced and the discovery
        request is withdrawn directly (or the BlueZ connection reset after a
        hang).
        """
        scanner = self._scanners.get(adapter)
        self._scanners_started.discard(adapter)
        if scanner is None:
            return
        try:
            await run_discovery_call(scanner.stop, SCANNER_START_TIMEOUT)
        except asyncio.CancelledError:
            # The stop handle is gone either way, so don't reuse this scanner
            self._new_scanner(adapter)
            raise
        except TimeoutError:
            _LOGGER.warning(
                "Stopping background BLE scanner on %s hung for %.0f s",
                adapter,
                SCANNER_START_TIMEOUT,
            )
            await self._recover_bluez_manager(adapter=adapter)
        except Exception as err:  # noqa: BLE001 - best effort
            _LOGGER.warning(
                "Stopping background BLE scanner on %s failed: %s", adapter, err
            )
            self._new_scanner(adapter)
            await _stop_bleak_discovery(adapter)

    async def _background_scanner(self) -> None:
        """Continuously scan for BLE devices and update cache."""
        self._scanning = True
        await self._refresh_scanner_adapters()

        try:
            started = await self._start_scanner()

            while True:
                # Clean up old devices from cache every 30 seconds, retry a
                # failed scanner start sooner, and start it right away on resume
                with contextlib.suppress(TimeoutError):
                    async with asyncio.timeout(
                        30 if started else SCANNER_RETRY_INTERVAL
                    ):
                        await self._scanner_wakeup.wait()
                self._scanner_wakeup.clear()

                if self._scanner_paused:
                    # Nothing is refreshed while paused, so keep what we have
                    continue

                # Picks up adapters that were plugged in or unplugged
                await self._refresh_scanner_adapters()
                started = await self._start_scanner()

                _LOGGER.debug(
                    "Background BLE scanner checking for and cleaning up stale devices"
                )

                now = datetime.now(UTC)
                expired_devices = []
                for address, cached in self._device_cache.items():
                    age = (now - cached.last_seen).total_seconds()
                    if age > self._device_cache_timeout:
                        expired_devices.append(address)
                    for adapter, sighting in list(cached.sightings.items()):
                        age = (now - sighting.last_seen).total_seconds()
                        if age > self._device_cache_timeout:
                            del cached.sightings[adapter]

                for address in expired_devices:
                    device_name = self._device_cache[address].device.name or "Unknown"
                    del self._device_cache[address]
                    _LOGGER.debug(
                        "Removed stale device from cache: %s (%s)",
                        device_name,
                        address,
                    )

                if expired_devices:
                    _LOGGER.info(
                        "Cleaned %d stale device(s) from cache. Current cache size: %d",
                        len(expired_devices),
                        len(self._device_cache),
                    )
        except asyncio.CancelledError:
            await self._stop_scanner()
            _LOGGER.info("Background BLE scanner stopped")
            raise
        except Exception:
            _LOGGER.exception("Error in background BLE scanner")
            await self._stop_scanner()
            raise

    async def _poll_for_devices(
        self,
        get_matching_devices: Callable[[], list[dict[str, str]]],
        timeout: float,
        initial_results: list[dict[str, str]],
        *,
        stop_when_found: bool,
    ) -> tuple[list[dict[str, str]], float]:
        """Poll get_matching_devices() every 500ms until timeout.

        If stop_when_found is True, returns as soon as get_matching_devices()
        is non-empty. Otherwise polls for the full timeout regardless of
        result count (used when waiting for the background scanner to
        populate a still-sparse device cache). Returns (final results,
        elapsed seconds).
        """
        start_time = asyncio.get_event_loop().time()
        poll_interval = 0.5  # Poll every 500ms
        results = initial_results

        while asyncio.get_event_loop().time() - start_time < timeout:
            await asyncio.sleep(poll_interval)
            results = get_matching_devices()
            if stop_when_found and results:
                break

        elapsed = asyncio.get_event_loop().time() - start_time
        return results, elapsed

    async def scan_devices(
        self, name_filter: str | None = None, timeout: float = 10.0
    ) -> list[dict[str, str]]:
        """Get currently cached BLE devices.

        Args:
            name_filter: Optional name filter (case-insensitive substring match)
            timeout: Time to wait for devices to appear in cache if needed

        Returns:
            List of cached devices with name, address, and RSSI
        """

        def get_matching_devices() -> list[dict[str, str]]:
            """Helper to get matching devices from cache."""
            results = []
            for cached in self._device_cache.values():
                device = cached.device

                # Apply name filter if provided
                if name_filter:
                    if (
                        not device.name
                        or name_filter.lower() not in device.name.lower()
                    ):
                        continue

                results.append(
                    {
                        "name": device.name or "Unknown",
                        "address": device.address,
                        "rssi": cached.rssi,
                    }
                )
            return results

        # Check if we need to wait for devices
        initial_results = get_matching_devices()

        # Case 1: name_filter provided but no matching device found
        if name_filter and not initial_results:
            _LOGGER.info(
                "No devices matching '%s' in cache, polling for %.1f seconds",
                name_filter,
                timeout,
            )
            results, elapsed = await self._poll_for_devices(
                get_matching_devices, timeout, [], stop_when_found=True
            )
            if results:
                _LOGGER.info(
                    "Found %d device(s) matching '%s' after %.1fs",
                    len(results),
                    name_filter,
                    elapsed,
                )
                return results

            _LOGGER.info(
                "No devices matching '%s' found after timeout",
                name_filter,
            )
            return []

        # Case 2: no name_filter, but cache is empty or has only 1 device
        if not name_filter and len(self._device_cache) <= 1:
            _LOGGER.info(
                "Device cache has %d device(s), waiting %.1f seconds for more devices",
                len(self._device_cache),
                timeout,
            )
            results, elapsed = await self._poll_for_devices(
                get_matching_devices, timeout, initial_results, stop_when_found=False
            )
            _LOGGER.info(
                "Found %d BLE device(s) in cache after %.1fs",
                len(results),
                elapsed,
            )
            return results

        # Case 3: Have enough devices already, return immediately
        _LOGGER.info(
            "Found %d BLE device(s)%s in cache (returning immediately)",
            len(initial_results),
            f" matching '{name_filter}'" if name_filter else "",
        )
        return initial_results

    async def _cleanup_loop(self) -> None:
        """Background task to cleanup idle sessions."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute

                # Find and remove idle sessions (2 minute timeout)
                now = datetime.now(UTC)
                idle_sessions = []
                for session_id, session in self._sessions.items():
                    idle_time = (now - session.last_activity).total_seconds()
                    if idle_time > 120:  # 2 minutes
                        idle_sessions.append(session_id)

                for session_id in idle_sessions:
                    _LOGGER.info("Cleaning up idle BLE session %s", session_id)
                    try:
                        await self.disconnect_session(session_id)
                    except Exception:
                        _LOGGER.exception("Error cleaning up session %s", session_id)

            except asyncio.CancelledError:
                break
            except Exception:
                _LOGGER.exception("Error in cleanup loop")

    def _background_scanner_running(self) -> bool:
        """Return True if the background scanner task is alive."""
        return self._scanner_task is not None and not self._scanner_task.done()

    async def _wait_for_device(
        self,
        find_cached: Callable[[], BLEDevice | None],
        matches: Callable[[BLEDevice], bool],
        timeout: float,
    ) -> BLEDevice | None:
        """Wait for a device to show up, without colliding with other scans.

        BlueZ allows only one discovery per D-Bus client and adapter, so
        starting a second BleakScanner while the background scanner runs
        fails with org.bluez.Error.InProgress. While the background scanner
        task is alive (even if paused for another connect), wait for it to
        put the device in the cache. Only scan here if it is not running.
        """
        if self._background_scanner_running():
            start_time = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start_time < timeout:
                await asyncio.sleep(0.5)
                device = find_cached()
                if device:
                    _LOGGER.info(
                        "Background scanner found %s after %.1fs",
                        device.address,
                        asyncio.get_event_loop().time() - start_time,
                    )
                    return device
            return None

        _LOGGER.warning("Background scanner not running, scanning directly")

        # Start and stop separately, so the discovery lock isn't held while
        # scanning (find_device_by_filter's stop can't be bounded from here)
        found: list[BLEDevice] = []
        seen = asyncio.Event()

        def on_detection(d: BLEDevice, adv: AdvertisementData) -> None:
            self._on_detection(d, adv)
            if not found and matches(d):
                found.append(d)
                seen.set()

        # One direct scan at a time: they share bleak's D-Bus connection,
        # where a second StartDiscovery fails with InProgress and its
        # recovery would end the first scan. Waiting counts against timeout.
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        async with self._direct_scan_lock:
            device = find_cached()
            if device:
                return device
            remaining = deadline - loop.time()
            if remaining <= 0:
                return None
            scanner = BleakScanner(detection_callback=on_detection)
            try:
                await run_discovery_call(
                    scanner.start, SCANNER_START_TIMEOUT, run_if_abandoned=False
                )
            except TimeoutError:
                # Same cleanup as for a hung background scanner start
                await self._recover_bluez_manager()
                raise
            except BleakDBusError as exc:
                if exc.dbus_error == "org.bluez.Error.InProgress":
                    await self._recover_bluez_manager()
                raise
            try:
                with contextlib.suppress(TimeoutError):
                    async with asyncio.timeout(remaining):
                        await seen.wait()
            finally:
                try:
                    await run_discovery_call(scanner.stop, SCANNER_START_TIMEOUT)
                except Exception:  # noqa: BLE001 - best effort
                    _LOGGER.debug("Stopping the direct BLE scan failed", exc_info=True)
        return found[0] if found else None

    def _live_session_ids(self, address: str) -> list[str]:
        """Return ids of this server's sessions still connected to address."""
        return [
            sid
            for sid, session in self._sessions.items()
            if session.address.upper() == address and session.is_connected
        ]

    async def _disconnect_stale_bluez_link(self, address: str) -> bool:
        """Drop a BlueZ connection to address that no session owns.

        BlueZ keeps a BLE link up when the process that opened it dies (for
        example after the server is killed and restarted). The device then
        stops advertising, so it never reaches the cache and every connect
        fails with "Device not found". Returns True if a link was dropped.
        """
        bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
        try:
            reply = await bus.call(
                Message(
                    destination="org.bluez",
                    path="/",
                    interface="org.freedesktop.DBus.ObjectManager",
                    member="GetManagedObjects",
                )
            )
            if reply.message_type == MessageType.ERROR:
                _LOGGER.debug("GetManagedObjects failed: %s", reply.body)
                return False

            dropped = False
            for path, interfaces in reply.body[0].items():
                props = interfaces.get("org.bluez.Device1")
                if not props or "Address" not in props:
                    continue
                if props["Address"].value.upper() != address:
                    continue
                connected = props.get("Connected")
                if not connected or not connected.value:
                    continue

                _LOGGER.warning(
                    "Device %s is connected in BlueZ (%s) but not by any session, "
                    "disconnecting the stale link",
                    address,
                    path,
                )
                result = await bus.call(
                    Message(
                        destination="org.bluez",
                        path=path,
                        interface="org.bluez.Device1",
                        member="Disconnect",
                    )
                )
                if result.message_type == MessageType.ERROR:
                    _LOGGER.warning(
                        "Failed to disconnect stale link on %s: %s",
                        path,
                        result.body,
                    )
                else:
                    dropped = True
            return dropped
        finally:
            bus.disconnect()

    def _device_not_found_message(self, address: str) -> str:
        """Build the error for a device that never advertised."""
        message = f"Device not found: {address}"
        live = self._live_session_ids(address)
        if live:
            # A connected device stops advertising, so it never reaches the cache
            message += (
                f" (still connected in session {', '.join(live)}; "
                "disconnect that session first)"
            )
        return message

    async def _choose_connect_device(
        self, address: str, fallback: BLEDevice, deadline: float
    ) -> BLEDevice:
        """Return the device object of the adapter to connect address through.

        Each adapter has its own BlueZ object for a device, and connecting
        through an object uses that adapter. See adapter_selection for how
        the adapter is chosen. Falls back to `fallback` (any adapter).
        Waits no longer than deadline (event loop time).
        """
        loop = asyncio.get_running_loop()
        connected = self._connected_session(address)
        if connected is not None and connected.device is not None:
            # Never move a connected link (e.g. a retried connect). It doesn't
            # advertise, so its adapter's sighting may have expired.
            _LOGGER.info(
                "Connecting %s via %s: its BLE link is on it",
                address,
                connected.adapter,
            )
            return connected.device

        # Give every scanning adapter a moment to report the device
        grace = min(loop.time() + ADAPTER_REPORT_GRACE, deadline)
        while loop.time() < grace and not set(self._scanners_started) <= set(
            self._adapter_rssi(address)
        ):
            await asyncio.sleep(0.25)

        constraints = None
        if self._live_constraints is not None:
            try:
                constraints = self._live_constraints(address)
            except Exception:
                _LOGGER.exception("Could not get live mode constraints for %s", address)
        rssi = self._adapter_rssi(address)
        choice = choose_adapter(
            rssi, previous=self._last_adapter.get(address), constraints=constraints
        )
        readings = (
            ", ".join(f"{name} {value:.0f} dBm" for name, value in sorted(rssi.items()))
            or "no readings"
        )
        if choice.adapter is None:
            _LOGGER.info("No adapter choice for %s (%s)", address, choice.reason)
            return fallback

        while True:
            cached = self._device_cache.get(address)
            sighting = cached.sightings.get(choice.adapter) if cached else None
            if sighting is not None or loop.time() >= deadline:
                break
            # A pinned adapter that hasn't seen the device yet
            await asyncio.sleep(0.5)
        if sighting is None:
            _LOGGER.warning(
                "Wanted %s for %s (%s), but it hasn't seen the device; using %s",
                choice.adapter,
                address,
                choice.reason,
                _adapter_of(fallback) or "the default adapter",
            )
            return fallback
        _LOGGER.info(
            "Connecting %s via %s: %s (%s)",
            address,
            choice.adapter,
            choice.reason,
            readings,
        )
        return sighting.device

    async def create_session(
        self, address: str | None, name_filter: str, timeout: float = 10.0
    ) -> tuple[str, str]:
        """Create new BLE session and connect to device.

        Args:
            address: BLE device address (optional)
            name_filter: Device name filter for discovery
            timeout: Discovery timeout in seconds

        Returns:
            Tuple of (session_id, device_address, mtu)
            where mtu is the BLE MTU size in bytes (or None if unavailable)

        Raises:
            RuntimeError: If device not found or connection fails
        """
        # Discover device or use provided address
        device: BLEDevice | None = None
        # Finding the device and its adapter share timeout; connecting has
        # its own (HA waits 2 * timeout + 10 s for the whole request)
        find_deadline = asyncio.get_running_loop().time() + max(timeout, 0)

        if address:
            address = address.upper()

            def find_cached_by_address() -> BLEDevice | None:
                cached = self._device_cache.get(address)
                return cached.device if cached else None

            device = find_cached_by_address()
            if device:
                _LOGGER.info("Using cached BLE device for address: %s", address)
            else:
                _LOGGER.warning(
                    "Device not in cache (background scanner may not have seen it yet), "
                    "waiting up to %.1fs for address: %s",
                    timeout,
                    address,
                )
                if not self._live_session_ids(address):
                    try:
                        await self._disconnect_stale_bluez_link(address)
                    except Exception:
                        _LOGGER.debug(
                            "Could not check BlueZ for a stale link", exc_info=True
                        )
                device = await self._wait_for_device(
                    find_cached_by_address,
                    lambda d: d.address.upper() == address,
                    timeout,
                )
                if not device:
                    raise RuntimeError(self._device_not_found_message(address))
            device = await self._choose_connect_device(address, device, find_deadline)
        else:
            # Discover device by name (fallback - shouldn't normally be used)
            _LOGGER.warning(
                "Discovering BLE devices by name (this is a fallback path): %s",
                name_filter,
            )

            def matches_name(d: BLEDevice) -> bool:
                return bool(d.name) and name_filter.lower() in d.name.lower()

            def find_cached_by_name() -> BLEDevice | None:
                for cached in self._device_cache.values():
                    if matches_name(cached.device):
                        return cached.device
                return None

            device = find_cached_by_name() or await self._wait_for_device(
                find_cached_by_name, matches_name, timeout
            )
            if not device:
                raise RuntimeError(f"Device not found: {name_filter}")
            _LOGGER.info("Found matching device: %s at %s", device.name, device.address)

        # At this point, device is guaranteed to be set (or exception raised)
        discovered_address = device.address

        # Generate session ID early so we can use it in the callback
        session_id = f"sess-{uuid.uuid4().hex[:8]}"

        # Create disconnection callback before creating the client
        # Use a list to store session reference since we need to create it after client
        session_ref: list[BLESession | None] = [None]

        def disconnection_callback(client: BleakClient) -> None:
            """Handle device disconnection."""
            _LOGGER.warning(
                "[BLE SESSION %s] Device disconnected: %s",
                session_id[:8],
                discovered_address,
            )
            if session_ref[0]:
                session_ref[0].mark_disconnected()

        # Pause background scanner to avoid connection conflicts. Resumed in
        # the finally below, also when the request is cancelled (HA gave up
        # waiting); a leaked pause would stop the scanner for good.
        client: BleakClient | None = None
        in_flight = False
        try:
            await self._pause_scanner()
            self._connects_in_flight += 1
            in_flight = True
            # Create BleakClient with disconnected_callback parameter
            _LOGGER.info("Connecting to BLE device: %s", discovered_address)
            client = BleakClient(
                device, timeout=timeout, disconnected_callback=disconnection_callback
            )
            deadline = asyncio.timeout(timeout + 10)
            try:
                # bleak's timeout only covers part of connect(); a hang
                # before it (seen after a power-up) would block forever
                async with deadline:
                    await client.connect()
            except Exception as exc:
                if deadline.expired():
                    # Stuck outside bleak's own timeout, i.e. on its shared
                    # BlueZ connection: start the next connect on a fresh one
                    await self._recover_bluez_manager(own_connect=True)
                reason = str(exc) or "timed out"
                _LOGGER.error("Failed to connect to BLE device: %s", reason)
                raise RuntimeError(f"Failed to connect to BLE device: {reason}") from exc

            # Create session and store reference for the disconnection callback
            session = BLESession(
                session_id=session_id, client=client, address=discovered_address
            )
            session.adapter = _adapter_of(device)
            session.device = device
            session_ref[0] = session

            # Register raw notification handler
            def notification_callback(sender, data: bytes) -> None:
                """Capture raw notification bytes."""
                try:
                    # Log raw notification bytes
                    raw_hex = " ".join(f"{b:02X}" for b in data)
                    _LOGGER.debug(
                        "[BLE SESSION %s] Received notification (%d bytes): %s",
                        session_id[:8],
                        len(data),
                        raw_hex,
                    )
                    session.buffer_notification(sender, data)
                    session.last_activity = datetime.now(UTC)
                except Exception:
                    _LOGGER.exception("Error in notification callback")

            # Start notifications on the characteristic
            try:
                await client.start_notify(NOTIFY_UUID, notification_callback)
                _LOGGER.info("Started notifications for BLE session %s", session_id)
            except Exception as exc:
                _LOGGER.error("Failed to start notifications: %s", exc)
                raise RuntimeError(f"Failed to start notifications: {exc}") from exc
        except BaseException as exc:
            if isinstance(exc, asyncio.CancelledError):
                _LOGGER.warning(
                    "BLE connect to %s cancelled (client gave up waiting)",
                    discovered_address,
                )
            # Drop a link that is (half) up, or BlueZ keeps it and the device
            # stops advertising. Shielded so a cancellation can't cut it short.
            if client is not None:
                await asyncio.shield(self._abort_connect(client))
            raise
        finally:
            if in_flight:
                # The session (if any) is stored right after this, and
                # _resume_scanner() doesn't suspend, so it's never unaccounted for
                self._connects_in_flight -= 1
            # Best effort: a failed scanner restart must not lose a session
            # that is up, or replace the connect's own error
            try:
                await self._resume_scanner()
            except Exception:
                _LOGGER.warning("Could not resume BLE scanner", exc_info=True)

        self._sessions[session_id] = session
        if session.adapter:
            self._last_adapter[discovered_address.upper()] = session.adapter

        # Get MTU size if available
        mtu = None
        try:
            if hasattr(client, "mtu_size"):
                mtu = client.mtu_size
                _LOGGER.info(
                    "Created BLE session %s for device %s (MTU: %d)",
                    session_id,
                    discovered_address,
                    mtu,
                )
            else:
                _LOGGER.info(
                    "Created BLE session %s for device %s",
                    session_id,
                    discovered_address,
                )
        except Exception:
            _LOGGER.info(
                "Created BLE session %s for device %s", session_id, discovered_address
            )

        return session_id, discovered_address, mtu

    @staticmethod
    async def _abort_connect(client: BleakClient) -> None:
        """Disconnect a client whose session setup failed or was cancelled."""
        try:
            async with asyncio.timeout(10):
                await client.disconnect()
        except BaseException:  # noqa: BLE001 - best effort
            _LOGGER.debug("Disconnect after failed connect failed", exc_info=True)

    async def send_command(self, session_id: str, cmd_bytes: bytes) -> None:
        """Send raw command bytes to BLE device.

        Args:
            session_id: Session identifier
            cmd_bytes: Raw command bytes to send

        Raises:
            ValueError: If session_id is invalid
            RuntimeError: If command send fails
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session_id: {session_id}")

        # Check if device is still connected
        if not session.is_connected:
            _LOGGER.error(
                "[BLE SESSION %s] Cannot send command: device disconnected",
                session_id[:8],
            )
            raise RuntimeError("BLE device is disconnected")

        # Log raw outgoing bytes
        raw_hex = " ".join(f"{b:02X}" for b in cmd_bytes)
        _LOGGER.debug(
            "[BLE SESSION %s] Sending command (%d bytes): %s",
            session_id[:8],
            len(cmd_bytes),
            raw_hex,
        )

        try:
            # Write to BLE characteristic
            await session.client.write_gatt_char(WRITE_UUID, cmd_bytes)
            session.last_activity = datetime.now(UTC)
        except Exception as exc:
            _LOGGER.error("Failed to send command: %s", exc)
            # Mark as disconnected if write fails
            session.mark_disconnected()
            raise RuntimeError(f"Failed to send command: {exc}") from exc

    async def get_notifications(
        self, session_id: str, since: int, timeout: float = 30.0
    ) -> dict:
        """Long-poll for raw notifications since sequence number.

        Args:
            session_id: Session identifier
            since: Last sequence number client has seen (only echoed back in
                error responses; delivered notifications are removed instead)
            timeout: Maximum time to wait for notifications

        Returns:
            Dict with notifications list, next_sequence, and has_more flag

        Raises:
            ValueError: If session_id is invalid
            RuntimeError: If the BLE device is disconnected, including when it
                disconnects during the long-poll
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session_id: {session_id}")

        # Report a dropped link right away so the client can react, rather
        # than long-polling forever on a dead session
        if not session.is_connected:
            raise RuntimeError("BLE device is disconnected")

        notifications = []

        # First, hand out everything already buffered, removing it from the
        # queue so each notification is delivered exactly once. `since` is not
        # used to filter: clients disagree on whether it means the last
        # sequence seen (HA) or the next one expected (web controller), and
        # anything still buffered has not been delivered yet either way.
        while not session.notification_buffer.empty():
            notifications.append(session.notification_buffer.get_nowait())

        # If we have notifications, return immediately
        if notifications:
            _LOGGER.info(
                "[BLE SESSION %s] Returning %d buffered notifications (since=%d, sequences=%s)",
                session_id[:8],
                len(notifications),
                since,
                [n.sequence for n in notifications],
            )
            return {
                "notifications": [
                    {
                        "sequence": n.sequence,
                        "timestamp": n.timestamp,
                        "sender": n.sender,
                        "data": n.data.hex().upper(),  # Convert bytes to hex string
                    }
                    for n in notifications
                ],
                "next_sequence": notifications[-1].sequence + 1,
                "has_more": not session.notification_buffer.empty(),
            }

        # Otherwise, wait for new notifications (long-poll)
        _LOGGER.debug(
            "[BLE SESSION %s] Long-polling for notifications (timeout: %.1fs, connected: %s)",
            session_id[:8],
            timeout,
            session.is_connected,
        )
        get_task = asyncio.ensure_future(session.notification_buffer.get())
        disconnected_task = asyncio.ensure_future(session.disconnected_event.wait())
        try:
            # Wake on a notification or a dropped link, whichever comes first
            await asyncio.wait(
                (get_task, disconnected_task),
                timeout=timeout,
                return_when=asyncio.FIRST_COMPLETED,
            )
        finally:
            disconnected_task.cancel()
            if not get_task.done():
                get_task.cancel()

        try:
            if not get_task.done() or get_task.cancelled():
                if not session.is_connected:
                    raise RuntimeError("BLE device is disconnected")
                raise asyncio.TimeoutError
            notif = get_task.result()
            notifications.append(notif)

            # Grab any additional notifications that arrived while waiting
            while not session.notification_buffer.empty():
                notifications.append(session.notification_buffer.get_nowait())

            session.last_activity = datetime.now(UTC)

            _LOGGER.debug(
                "[BLE SESSION %s] Returning %d new notifications",
                session_id[:8],
                len(notifications),
            )
            return {
                "notifications": [
                    {
                        "sequence": n.sequence,
                        "timestamp": n.timestamp,
                        "sender": n.sender,
                        "data": n.data.hex().upper(),
                    }
                    for n in notifications
                ],
                "next_sequence": notifications[-1].sequence + 1,
                "has_more": not session.notification_buffer.empty(),
            }
        except asyncio.TimeoutError:
            # No notifications received during timeout
            _LOGGER.debug(
                "[BLE SESSION %s] Long-poll timeout, no notifications",
                session_id[:8],
            )
            session.last_activity = datetime.now(UTC)
            return {
                "notifications": [],
                "next_sequence": since,
                "has_more": False,
            }

    async def disconnect_session(self, session_id: str) -> None:
        """Disconnect BLE session and cleanup.

        Args:
            session_id: Session identifier to disconnect

        Raises:
            ValueError: If session_id is invalid
        """
        session = self._sessions.pop(session_id, None)
        if not session:
            raise ValueError(f"Invalid session_id: {session_id}")

        _LOGGER.info("Disconnecting BLE session %s", session_id)
        try:
            await session.client.stop_notify(NOTIFY_UUID)
        except Exception:
            _LOGGER.debug("Error stopping notifications", exc_info=True)

        try:
            await session.client.disconnect()
        except Exception:
            _LOGGER.debug("Error disconnecting client", exc_info=True)

    def get_session_info(self, session_id: str) -> dict | None:
        """Get information about a session.

        Args:
            session_id: Session identifier

        Returns:
            Dict with session info or None if not found
        """
        session = self._sessions.get(session_id)
        if not session:
            return None

        return {
            "session_id": session.session_id,
            "address": session.address,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "buffer_size": session.notification_buffer.qsize(),
            "is_connected": bool(session.client.is_connected),
            "adapter": session.adapter,
        }

    def list_sessions(self) -> list[dict]:
        """List all active sessions.

        Returns:
            List of session info dicts
        """
        return [
            self.get_session_info(session_id) for session_id in self._sessions.keys()
        ]
