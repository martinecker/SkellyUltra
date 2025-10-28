"""SkellyClient: high-level async client wrapping Bleak, using commands and parser modules."""

from typing import Any, Optional
from collections.abc import Callable
import asyncio
import logging
import contextlib

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError

from . import commands
from . import parser

logger = logging.getLogger(__name__)


class SkellyClient:
    def __init__(
        self, address: Optional[str] = None, name_filter: str = "Animated Skelly"
    ) -> None:
        self.address = address
        self.name_filter = name_filter
        self._client: Optional[BleakClient] = None
        self._live_mode_client: Optional[BleakClient] = None
        self._live_mode_client_address: Optional[str] = None
        self._notification_handler: Callable[[Any, bytes], None] = (
            parser.handle_notification
        )
        self._parsed_handler: Optional[Callable[[Any, Any], None]] = None
        self.events: asyncio.Queue = asyncio.Queue()

    def register_notification_handler(
        self, handler: Callable[[Any, bytes], None]
    ) -> None:
        self._notification_handler = handler

    def register_parsed_notification_handler(
        self, handler: Callable[[Any, Any], None]
    ) -> None:
        self._parsed_handler = handler

    async def connect(
        self,
        timeout: float = 10.0,
        client: Optional[BleakClient] = None,
        start_notify: bool = True,
    ) -> bool:
        """Connect logic separated from notification registration.

        Args:
            timeout: discovery timeout when no client/address provided.
            client: optional already-constructed BleakClient (connected or not).
            start_notify: if True, register notification handler after connect.

        Behavior:
            - If `client` is provided and is connected, use it and optionally start notifications.
            - If `client` is provided but not connected, attempt to connect it.
            - If `self.address` is set and no client passed, find device by address.
            - Otherwise, perform discovery using BleakScanner and pick by `name_filter`.
        """
        device = None

        # If an explicit BleakClient was provided, prefer it.
        if client is not None:
            # use the provided client directly
            self._client = client
            try:
                if not getattr(self._client, "is_connected", False):
                    await self._client.connect()
            except Exception:
                # failed to connect provided client
                return False
        else:
            # No client passed; perform discovery by address or name
            if self.address and self.address != "None":
                device = await BleakScanner.find_device_by_address(self.address)
            else:
                devices = await BleakScanner.discover(timeout=timeout)
                for d in devices:
                    if d.name and self.name_filter.lower() in d.name.lower():
                        device = d
                        break

            if not device:
                return False

            self._client = BleakClient(device)
            try:
                await self._client.connect()
            except Exception:
                return False

        # At this point, self._client should be set and connected
        if self._client and getattr(self._client, "is_connected", False):
            if start_notify:
                await self.start_notifications()
            return True
        return False

    async def start_notifications(self) -> None:
        """Register the notification callback on an already-connected client.

        This can be called directly by an integration that manages the BleakClient
        connection itself (e.g. Home Assistant's BLE stack). It is safe to call
        multiple times; redundant registrations are ignored.
        """
        if not self._client or not getattr(self._client, "is_connected", False):
            raise RuntimeError("Client not connected")

        # Avoid re-registering if start_notify was called previously on same client
        # We don't keep an explicit flag here; Bleak will raise if notify handler already set.
        def _notif_cb(sender, data):
            try:
                if self._notification_handler:
                    self._notification_handler(sender, data)
            except Exception:
                pass
            try:
                parsed = parser.parse_notification(sender, data)
                if parsed is not None:
                    # push into events queue
                    try:
                        self.events.put_nowait(parsed)
                        logger.debug("Parsed event queued: %s", parsed)
                    except asyncio.QueueFull:
                        pass
                    if self._parsed_handler:
                        try:
                            self._parsed_handler(sender, parsed)
                        except Exception:
                            pass
            except Exception:
                pass

        try:
            await self._client.start_notify(commands.NOTIFY_UUID, _notif_cb)
        except Exception:
            # swallow notify registration errors; higher-level code can call again
            logger.exception("Failed to start notifications")

    async def disconnect(self) -> None:
        if self._client:
            try:
                await self._client.stop_notify(commands.NOTIFY_UUID)
            except Exception:
                pass
            try:
                await self._client.disconnect()
            except Exception:
                pass
            self._client = None

    async def disconnect_live_mode(self) -> None:
        """Disconnect the separate classic (live-mode) client and clear state."""
        if self._live_mode_client:
            try:
                await self._live_mode_client.disconnect()
            except Exception:
                pass
            self._live_mode_client = None
            self._live_mode_client_address = None

    @property
    def client(self) -> Optional[BleakClient]:
        return self._client

    @property
    def live_mode_client(self) -> Optional[BleakClient]:
        """Return the separate classic (live-mode) BleakClient if connected."""
        return self._live_mode_client

    async def send_command(self, cmd_bytes: bytes) -> None:
        if not self._client:
            raise RuntimeError("Not connected")
        # Log raw outgoing bytes as a space-separated hex string for debugging
        try:
            raw_hex = " ".join(f"{b:02X}" for b in cmd_bytes)
        except Exception:
            raw_hex = cmd_bytes.hex().upper()
        logger.debug("[RAW SEND] (%d bytes): %s", len(cmd_bytes), raw_hex)
        await self._client.write_gatt_char(commands.WRITE_UUID, cmd_bytes)

    # convenience wrappers
    async def enable_classic_bt(self) -> None:
        await self.send_command(commands.enable_classic_bt())

    async def query_live_mode(self) -> None:
        await self.send_command(commands.query_live_mode())

    async def query_song_order(self) -> None:
        await self.send_command(commands.query_song_order())

    async def query_volume(self) -> None:
        await self.send_command(commands.query_volume())

    async def query_live_name(self) -> None:
        await self.send_command(commands.query_live_name())

    async def query_version(self) -> None:
        await self.send_command(commands.query_version())

    async def query_capacity(self) -> None:
        await self.send_command(commands.query_capacity())

    async def set_volume(self, vol: int) -> None:
        await self.send_command(commands.set_volume(vol))

    async def play(self) -> None:
        await self.send_command(commands.play())

    async def pause(self) -> None:
        await self.send_command(commands.pause())

    # RGB / light convenience wrappers
    async def set_light_rgb(
        self,
        channel: int,
        r: int,
        g: int,
        b: int,
        loop: int = 0,
        cluster: int = 0,
        name: str = "",
    ) -> None:
        await self.send_command(
            commands.set_light_rgb(channel, r, g, b, loop, cluster, name)
        )

    async def set_light_brightness(
        self, channel: int, brightness: int, cluster: int = 0, name: str = ""
    ) -> None:
        await self.send_command(
            commands.set_light_brightness(channel, brightness, cluster, name)
        )

    async def set_light_mode(
        self, channel: int, mode: int, cluster: int = 0, name: str = ""
    ) -> None:
        await self.send_command(commands.set_light_mode(channel, mode, cluster, name))

    async def set_light_speed(
        self, channel: int, speed: int, cluster: int = 0, name: str = ""
    ) -> None:
        await self.send_command(commands.set_light_speed(channel, speed, cluster, name))

    async def select_rgb_channel(self, channel: int) -> None:
        await self.send_command(commands.select_rgb_channel(channel))

    async def set_eye_icon(self, icon: int, cluster: int = 0, name: str = "") -> None:
        await self.send_command(commands.set_eye_icon(icon, cluster, name))

    # File transfer convenience wrappers
    async def start_send_data(self, size: int, max_pack: int, filename: str) -> None:
        await self.send_command(commands.start_send_data(size, max_pack, filename))

    async def send_data_chunk(self, index: int, data: bytes) -> None:
        await self.send_command(commands.send_data_chunk(index, data))

    async def end_send_data(self) -> None:
        await self.send_command(commands.end_send_data())

    async def confirm_file(self, filename: str) -> None:
        await self.send_command(commands.confirm_file(filename))

    async def cancel_send(self) -> None:
        await self.send_command(commands.cancel_send())

    async def play_or_pause_file(self, serial: int, action: int) -> None:
        await self.send_command(commands.play_or_pause_file(serial, action))

    async def delete_file(self, serial: int, cluster: int) -> None:
        await self.send_command(commands.delete_file(serial, cluster))

    async def format_device(self) -> None:
        await self.send_command(commands.format_device())

    async def set_music_order(
        self, total: int, index: int, file_serial: int, filename: str
    ) -> None:
        await self.send_command(
            commands.set_music_order(total, index, file_serial, filename)
        )

    async def set_music_animation(
        self, action: int, cluster: int, filename: str
    ) -> None:
        await self.send_command(commands.set_music_animation(action, cluster, filename))

    # Awaitable helpers that send a query and wait for a matching parsed event
    async def _wait_for_event(self, predicate, timeout: float = 2.0):
        """Wait for an event from self.events that matches predicate.

        Non-matching events are temporarily held and re-queued after a match or timeout.
        Returns the matched event or raises asyncio.TimeoutError.
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        temp = []
        try:
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    raise asyncio.TimeoutError()
                try:
                    ev = await asyncio.wait_for(self.events.get(), timeout=remaining)
                except asyncio.TimeoutError:
                    raise
                if predicate(ev):
                    logger.debug("Matched event: %s", ev)
                    return ev
                # Log non-matching events for debugging before re-queuing
                logger.debug("Non-matching event received while waiting: %s", ev)
                temp.append(ev)
        finally:
            # re-queue temp events in order
            for e in temp:
                try:
                    self.events.put_nowait(e)
                except Exception:
                    pass

    async def get_volume(self, timeout: float = 2.0) -> int:
        """Query volume and await a VolumeEvent; returns the numeric volume."""
        await self.send_command(commands.query_volume())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.VolumeEvent), timeout=timeout
        )
        return ev.volume

    async def get_live_name(self, timeout: float = 2.0) -> str:
        """Query the live name and await a LiveNameEvent; returns the name string."""
        await self.send_command(commands.query_live_name())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveNameEvent), timeout=timeout
        )
        return ev.name

    async def get_music_order(self, timeout: float = 2.0):
        await self.send_command(commands.query_song_order())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.MusicOrderEvent), timeout=timeout
        )
        return ev.orders

    async def get_eye_icon(self, timeout: float = 2.0) -> int:
        """Query the device live mode and return the eye_icon integer."""
        await self.send_command(commands.query_live_mode())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveModeEvent), timeout=timeout
        )
        return ev.eye_icon

    async def get_live_mode(self, timeout: float = 2.0):
        """Query the device live mode and return the parsed LiveModeEvent."""
        await self.send_command(commands.query_live_mode())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveModeEvent), timeout=timeout
        )
        return ev

    async def get_light_info(self, channel: int, timeout: float = 2.0):
        """Query the device live mode and return the LightInfo for the specified channel index.

        Channel is zero-based and valid values are 0..5. Raises IndexError if
        the channel is out of range.
        """
        await self.send_command(commands.query_live_mode())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveModeEvent), timeout=timeout
        )
        lights = ev.lights
        if channel < 0 or channel >= len(lights):
            raise IndexError("Channel out of range")
        return lights[channel]

    async def get_capacity(self, timeout: float = 2.0):
        await self.send_command(commands.query_capacity())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.CapacityEvent), timeout=timeout
        )
        return ev.capacity_kb, ev.file_count, ev.mode_str

    async def connect_live_mode(
        self,
        timeout: float = 10.0,
        start_notify: bool = False,
        connect_fn: Callable[[str], Any] | None = None,
    ) -> str | None:
        """Enable classic BT and connect to the device exposed by the Skelly's live name.

        Sequence:
        - Query the device for its live name (uses the existing BLE connection).
        - Send the enable_classic_bt command so the device will expose a classic
          Bluetooth (non-LE) device with that name.
        - Scan for a discoverable Bluetooth device whose name matches the live
          name and attempt to connect to it.

        Returns the address (MAC) of the connected classic device on success,
        or None on failure.

        Note: this method requires that the Skelly device is already connected
        (so that `get_live_name`/`enable_classic_bt` can be sent).
        """
        # Must be connected to the device to request live name / enable classic
        if not self._client or not getattr(self._client, "is_connected", False):
            raise RuntimeError("Not connected to device to request live-mode")

        try:
            live_name = await self.get_live_name(timeout=2.0)
        except TimeoutError:
            logger.debug("Timed out while querying live name")
            return None
        except Exception:  # keep broad here since parsing could raise multiple errors
            logger.exception("Failed to query live name")
            return None

        # Tell the device to enable classic BT advertising/visibility
        try:
            await self.enable_classic_bt()
        except Exception:
            logger.exception("Failed to send enable_classic_bt command")
            return None

        # Scan for a device with the reported live name. We loop until timeout
        # to allow the device time to start advertising.
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        name_normalized = (live_name or "").strip().lower()

        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            scan_timeout = min(2.0, remaining)
            try:
                devices = await BleakScanner.discover(timeout=scan_timeout)
            except BleakError:
                logger.exception("Bleak scanner error during discover")
                devices = []
            except Exception:
                logger.exception("Unexpected error during BleakScanner.discover")
                devices = []

            for d in devices:
                if not d.name:
                    continue
                if d.name.strip().lower() == name_normalized:
                    addr = d.address
                    # Attempt to connect to the classic device without touching
                    # the existing BLE client. If the connect fails, ensure the
                    # created client is cleaned up and do not alter existing state.
                    # If a connect_fn is provided (e.g. from HA adapter that
                    # uses bleak-retry-connector), prefer it. It should accept
                    # an address and return a connected BleakClient or None.
                    new_client = None
                    if connect_fn is not None:
                        try:
                            maybe_client = await connect_fn(addr)
                            if maybe_client is not None:
                                new_client = maybe_client
                        except Exception:
                            logger.exception(
                                "connect_fn raised while connecting to classic BT device %s",
                                addr,
                            )

                    # Fallback to creating a BleakClient and connecting directly
                    if new_client is None:
                        new_client = BleakClient(d)
                        try:
                            await new_client.connect()
                        except BleakError:
                            logger.exception(
                                "Failed to connect to classic BT device %s", addr
                            )
                            # Ensure client is disconnected/cleaned if partially connected
                            with contextlib.suppress(Exception):
                                await new_client.disconnect()
                            continue
                        except Exception:
                            logger.exception(
                                "Unexpected error connecting to classic BT device %s",
                                addr,
                            )
                            with contextlib.suppress(Exception):
                                await new_client.disconnect()
                            continue

                    # Success — store the live-mode client separately
                    self._live_mode_client = new_client
                    self._live_mode_client_address = addr

                    logger.debug(
                        "Connected to classic BT device with name %s and address %s",
                        live_name,
                        addr,
                    )
                    return addr

            # small sleep to avoid tight loop when remaining time is small
            await asyncio.sleep(0.1)

        logger.debug("Could not find classic BT device with name %s", live_name)
        return None
