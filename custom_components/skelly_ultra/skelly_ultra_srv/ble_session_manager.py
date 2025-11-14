"""BLE session manager for proxying BLE connections."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
import logging
import uuid

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

_LOGGER = logging.getLogger(__name__)

# Skelly Ultra BLE UUIDs
WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"


@dataclass
class RawNotification:
    """Raw BLE notification with metadata."""

    sequence: int
    timestamp: str
    sender: str  # UUID of characteristic
    data: bytes  # Raw notification bytes


@dataclass
class CachedDevice:
    """Cached BLE device with last seen timestamp."""

    device: BLEDevice
    rssi: int
    last_seen: datetime


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
        try:
            self.notification_buffer.put_nowait(notification)
        except asyncio.QueueFull:
            # Drop oldest notification if buffer full
            try:
                self.notification_buffer.get_nowait()
                self.notification_buffer.put_nowait(notification)
            except Exception:
                pass  # Still can't add, skip this notification


class BLESessionManager:
    """Manages BLE sessions with raw notification buffering."""

    def __init__(self) -> None:
        """Initialize session manager."""
        self._sessions: dict[str, BLESession] = {}
        self._cleanup_task: asyncio.Task | None = None
        self._scanner_task: asyncio.Task | None = None
        self._scanner: BleakScanner | None = None
        self._scanner_paused = False
        self._device_cache: dict[
            str, CachedDevice
        ] = {}  # Cache scanned devices with timestamps
        self._device_cache_timeout = 120  # Remove devices not seen in 2 minutes

    async def start(self) -> None:
        """Start the session manager and background tasks."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        if self._scanner_task is None:
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
        """Pause the background scanner temporarily."""
        if self._scanner and not self._scanner_paused:
            _LOGGER.info("Pausing background BLE scanner")
            await self._scanner.stop()
            self._scanner_paused = True

    async def _resume_scanner(self) -> None:
        """Resume the background scanner."""
        if self._scanner and self._scanner_paused:
            _LOGGER.info("Resuming background BLE scanner")
            await self._scanner.start()
            self._scanner_paused = False

    async def _background_scanner(self) -> None:
        """Continuously scan for BLE devices and update cache."""

        def detection_callback(
            device: BLEDevice, advertisement_data: AdvertisementData
        ) -> None:
            """Handle device detection during background scan."""
            self._device_cache[device.address] = CachedDevice(
                device=device,
                rssi=advertisement_data.rssi,
                last_seen=datetime.now(UTC),
            )

        self._scanner = BleakScanner(detection_callback=detection_callback)

        try:
            await self._scanner.start()
            _LOGGER.info("Background BLE scanner started")

            while True:
                # Clean up old devices from cache every 30 seconds
                await asyncio.sleep(30)

                now = datetime.now(UTC)
                expired_devices = []
                for address, cached in self._device_cache.items():
                    age = (now - cached.last_seen).total_seconds()
                    if age > self._device_cache_timeout:
                        expired_devices.append(address)

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
            if self._scanner:
                await self._scanner.stop()
            _LOGGER.info("Background BLE scanner stopped")
            raise
        except Exception:
            _LOGGER.exception("Error in background BLE scanner")
            if self._scanner:
                await self._scanner.stop()
            raise

    async def scan_devices(
        self, name_filter: str | None = None, timeout: float = 10.0
    ) -> list[dict[str, str]]:
        """Get currently cached BLE devices.

        Args:
            name_filter: Optional name filter (case-insensitive substring match)
            timeout: Unused (kept for API compatibility)

        Returns:
            List of cached devices with name, address, and RSSI
        """
        _LOGGER.info(
            "Returning cached BLE devices (cache size: %d)", len(self._device_cache)
        )

        results = []
        for cached in self._device_cache.values():
            device = cached.device

            # Apply name filter if provided
            if name_filter:
                if not device.name or name_filter.lower() not in device.name.lower():
                    continue

            results.append(
                {
                    "name": device.name or "Unknown",
                    "address": device.address,
                    "rssi": cached.rssi,
                }
            )

        _LOGGER.info(
            "Found %d BLE device(s)%s in cache",
            len(results),
            f" matching '{name_filter}'" if name_filter else "",
        )
        return results

    async def _cleanup_loop(self) -> None:
        """Background task to cleanup idle sessions."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute

                # Find and remove idle sessions (5 minute timeout)
                now = datetime.now(UTC)
                idle_sessions = []
                for session_id, session in self._sessions.items():
                    idle_time = (now - session.last_activity).total_seconds()
                    if idle_time > 300:  # 5 minutes
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

    async def create_session(
        self, address: str | None, name_filter: str, timeout: float = 10.0
    ) -> tuple[str, str]:
        """Create new BLE session and connect to device.

        Args:
            address: BLE device address (optional)
            name_filter: Device name filter for discovery
            timeout: Discovery timeout in seconds

        Returns:
            Tuple of (session_id, device_address)

        Raises:
            RuntimeError: If device not found or connection fails
        """
        # Discover device or use provided address
        device: BLEDevice | None = None

        if address:
            # Try to use cached device from background scanner
            cached = self._device_cache.get(address)
            if cached:
                device = cached.device
                _LOGGER.info("Using cached BLE device for address: %s", address)
            else:
                # Not in cache - try to find it via scan
                _LOGGER.warning(
                    "Device not in cache (background scanner may not have seen it yet), "
                    "scanning for address: %s",
                    address,
                )
                device = await BleakScanner.find_device_by_address(
                    address, timeout=timeout
                )
                if device:
                    # Cache with unknown RSSI since we used find_device_by_address
                    self._device_cache[address] = CachedDevice(
                        device=device,
                        rssi=-100,  # Unknown RSSI
                        last_seen=datetime.now(UTC),
                    )
                else:
                    raise RuntimeError(f"Device not found: {address}")
        else:
            # Discover device by name (fallback - shouldn't normally be used)
            _LOGGER.warning(
                "Discovering BLE devices by name (this is a fallback path): %s",
                name_filter,
            )
            devices = await BleakScanner.discover(timeout=timeout)
            for d in devices:
                if d.name and name_filter.lower() in d.name.lower():
                    device = d
                    self._device_cache[d.address] = CachedDevice(
                        device=d,
                        rssi=-100,  # Unknown RSSI from discover()
                        last_seen=datetime.now(UTC),
                    )
                    _LOGGER.info("Found matching device: %s at %s", d.name, d.address)
                    break

            if not device:
                raise RuntimeError(f"Device not found: {name_filter}")

        # At this point, device is guaranteed to be set (or exception raised)
        discovered_address = device.address

        # Pause background scanner to avoid connection conflicts
        await self._pause_scanner()

        try:
            # Create BleakClient with BLEDevice object
            _LOGGER.info("Connecting to BLE device: %s", discovered_address)
            client = BleakClient(device, timeout=timeout)
            try:
                await client.connect()
            except Exception as exc:
                _LOGGER.error("Failed to connect to BLE device: %s", exc)
                await self._resume_scanner()
                raise RuntimeError(f"Failed to connect to BLE device: {exc}") from exc
        except Exception:
            # Resume scanner on any error
            await self._resume_scanner()
            raise

        # Create session
        session_id = f"sess-{uuid.uuid4().hex[:8]}"
        session = BLESession(
            session_id=session_id, client=client, address=discovered_address
        )

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
            try:
                await client.disconnect()
            except Exception:
                pass
            await self._resume_scanner()
            raise RuntimeError(f"Failed to start notifications: {exc}") from exc

        self._sessions[session_id] = session
        _LOGGER.info(
            "Created BLE session %s for device %s", session_id, discovered_address
        )

        # Resume scanner now that connection is established
        await self._resume_scanner()

        return session_id, discovered_address

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
            raise RuntimeError(f"Failed to send command: {exc}") from exc

    async def get_notifications(
        self, session_id: str, since: int, timeout: float = 30.0
    ) -> dict:
        """Long-poll for raw notifications since sequence number.

        Args:
            session_id: Session identifier
            since: Last sequence number client has seen
            timeout: Maximum time to wait for notifications

        Returns:
            Dict with notifications list, next_sequence, and has_more flag

        Raises:
            ValueError: If session_id is invalid
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session_id: {session_id}")

        notifications = []

        # First, collect any buffered notifications with sequence > since
        temp_buffer = []
        while not session.notification_buffer.empty():
            notif = session.notification_buffer.get_nowait()
            if notif.sequence > since:
                notifications.append(notif)
            else:
                temp_buffer.append(notif)  # Re-queue older ones

        # Put back notifications we didn't use
        for notif in temp_buffer:
            try:
                session.notification_buffer.put_nowait(notif)
            except asyncio.QueueFull:
                pass

        # If we have notifications, return immediately
        if notifications:
            _LOGGER.debug(
                "[BLE SESSION %s] Returning %d buffered notifications",
                session_id[:8],
                len(notifications),
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
            "[BLE SESSION %s] Long-polling for notifications (timeout: %.1fs)",
            session_id[:8],
            timeout,
        )
        try:
            notif = await asyncio.wait_for(
                session.notification_buffer.get(), timeout=timeout
            )
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
            "is_connected": session.client.is_connected,
        }

    def list_sessions(self) -> list[dict]:
        """List all active sessions.

        Returns:
            List of session info dicts
        """
        return [
            self.get_session_info(session_id) for session_id in self._sessions.keys()
        ]
