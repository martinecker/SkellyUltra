"""SkellyClient: high-level async client wrapping Bleak, using commands and parser modules."""

import asyncio
from collections.abc import Callable
import logging
from typing import Any

import aiohttp
from bleak import BleakClient, BleakScanner

from . import commands, parser

logger = logging.getLogger(__name__)


class SkellyClient:
    def __init__(
        self,
        address: str | None = None,
        name_filter: str = "Animated Skelly",
        server_url: str = "http://localhost:8765",
    ) -> None:
        self.address = address
        self.name_filter = name_filter
        self.server_url = server_url
        self._client: BleakClient | None = None
        self._live_mode_client_address: str | None = None
        self._notification_handler: Callable[[Any, bytes], None] = (
            parser.handle_notification
        )
        self._parsed_handler: Callable[[Any, Any], None] | None = None
        self.events: asyncio.Queue = asyncio.Queue()
        self._rest_session: aiohttp.ClientSession | None = None

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
        client: BleakClient | None = None,
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

    def drain_event_queue(self) -> None:
        """Remove all pending events from the queue.

        This should be called before sending new queries to ensure
        only fresh responses are consumed.
        """
        drained_count = 0
        while not self.events.empty():
            try:
                self.events.get_nowait()
                drained_count += 1
            except asyncio.QueueEmpty:
                break
        if drained_count > 0:
            logger.debug("Drained %d old events from queue", drained_count)

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

        # Close REST session if it exists
        if self._rest_session:
            try:
                await self._rest_session.close()
            except Exception:
                pass
            self._rest_session = None

    def _get_rest_session(self) -> aiohttp.ClientSession:
        """Get or create the reusable REST session.

        Returns a persistent aiohttp ClientSession to avoid creating
        new sessions for each REST request, which prevents premature
        disconnection warnings from the server.
        """
        if self._rest_session is None or self._rest_session.closed:
            self._rest_session = aiohttp.ClientSession()
        return self._rest_session

    def get_mtu_size(self) -> int | None:
        """Get the BLE MTU size if available.

        Returns:
            MTU size in bytes, or None if not available.

        Notes:
            Available in Bleak 0.19.0+. Returns None if client is not
            connected or MTU information is unavailable.
        """
        try:
            if self._client and hasattr(self._client, "mtu_size"):
                return self._client.mtu_size
        except (AttributeError, TypeError):
            pass
        return None

    async def disconnect_live_mode(self) -> None:
        """Disconnect the separate classic (live-mode) client via REST server."""
        if not self._live_mode_client_address:
            logger.debug("No live mode device connected to disconnect")
            return

        try:
            session = self._get_rest_session()
            async with session.post(
                f"{self.server_url}/disconnect",
                json={"mac": self._live_mode_client_address},
                timeout=aiohttp.ClientTimeout(total=10.0),
            ) as resp:
                data = await resp.json()
                if data.get("success"):
                    logger.info(
                        "Successfully disconnected live mode device %s via REST server",
                        self._live_mode_client_address,
                    )
                    self._live_mode_client_address = None
                else:
                    logger.warning("REST server reported disconnect failure: %s", data)
        except Exception:
            logger.exception("Failed to disconnect via REST server")
            # Clear the address anyway since we can't reliably maintain state
            self._live_mode_client_address = None

    async def play_audio_live_mode(
        self, file_data: bytes, filename: str = "audio.wav", mac: str | None = None
    ) -> dict[str, Any]:
        """Play audio file via REST server to classic BT device.

        Args:
            file_data: Audio file data as bytes.
            filename: Name of the file (for logging/identification).
            mac: Optional MAC address target. If None, uses the stored live_mode_client_address.

        Returns:
            Response data dict with 'success', 'error', 'is_playing', etc.

        Raises:
            RuntimeError: If no live mode device is connected.
            aiohttp.ClientError: On REST server communication errors.
        """
        if not mac and not self._live_mode_client_address:
            raise RuntimeError("No live mode device connected")

        # Use stored address if no mac specified
        target_mac = mac or self._live_mode_client_address

        try:
            # Create multipart form data
            data = aiohttp.FormData()
            data.add_field(
                "file", file_data, filename=filename, content_type="audio/wav"
            )
            if target_mac:
                data.add_field("mac", target_mac)

            session = self._get_rest_session()
            async with session.post(
                f"{self.server_url}/play",
                data=data,
                timeout=aiohttp.ClientTimeout(total=30.0),
            ) as resp:
                return await resp.json()
        except aiohttp.ClientError:
            logger.exception("REST server communication error during play")
            raise
        except Exception:
            logger.exception("Unexpected error during play request")
            raise

    async def stop_audio_live_mode(self, mac: str | None = None) -> dict[str, Any]:
        """Stop audio playback via REST server.

        Args:
            mac: Optional specific MAC address to stop. If None, stops all playback.

        Returns:
            Response data dict with 'success', 'error', etc.

        Raises:
            aiohttp.ClientError: On REST server communication errors.
        """
        try:
            request_body = {}
            if mac:
                request_body["mac"] = mac

            session = self._get_rest_session()
            async with session.post(
                f"{self.server_url}/stop",
                json=request_body if request_body else None,
                timeout=aiohttp.ClientTimeout(total=5.0),
            ) as resp:
                return await resp.json()
        except aiohttp.ClientError:
            logger.exception("REST server communication error during stop")
            raise
        except Exception:
            logger.exception("Unexpected error during stop request")
            raise

    async def get_audio_status_live_mode(self) -> dict[str, Any]:
        """Get current audio playback status via REST server.

        Returns:
            Status data dict with 'bluetooth' and 'audio' keys containing
            device and playback session information.

        Raises:
            aiohttp.ClientError: On REST server communication errors.
        """
        try:
            session = self._get_rest_session()
            async with session.get(
                f"{self.server_url}/status",
                timeout=aiohttp.ClientTimeout(total=5.0),
            ) as resp:
                return await resp.json()
        except aiohttp.ClientError:
            logger.exception("REST server communication error during status check")
            raise
        except Exception:
            logger.exception("Unexpected error during status request")
            raise

    @property
    def client(self) -> BleakClient | None:
        return self._client

    @property
    def live_mode_client_address(self) -> str | None:
        """Return the MAC address of the connected classic BT device."""
        return self._live_mode_client_address

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

    async def query_file_order(self) -> None:
        await self.send_command(commands.query_file_order())

    async def query_volume(self) -> None:
        await self.send_command(commands.query_volume())

    async def query_live_name(self) -> None:
        await self.send_command(commands.query_live_name())

    async def query_version(self) -> None:
        await self.send_command(commands.query_version())

    async def query_capacity(self) -> None:
        await self.send_command(commands.query_capacity())

    async def query_file_infos(self) -> None:
        await self.send_command(commands.query_file_infos())

    async def set_volume(self, vol: int) -> None:
        await self.send_command(commands.set_volume(vol))

    async def play(self) -> None:
        await self.send_command(commands.play())

    async def pause(self) -> None:
        await self.send_command(commands.pause())

    async def play_file(self, file_index: int) -> None:
        await self.send_command(commands.play_file(file_index))

    async def stop_file(self, file_index: int) -> None:
        await self.send_command(commands.stop_file(file_index))

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

    async def set_action(self, action: int, cluster: int = 0, name: str = "") -> None:
        """Set movement action bitfield.

        Action is a bitfield where bit 0 = head, bit 1 = arm, bit 2 = torso.
        If a bit is set, movement for that body part is enabled, otherwise disabled.
        Value of 255 enables all (head+arm+torso).
        """
        await self.send_command(commands.set_action(action, cluster, name))

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

    async def delete_file(self, file_index: int, cluster: int) -> None:
        await self.send_command(commands.delete_file(file_index, cluster))

    async def format_device(self) -> None:
        await self.send_command(commands.format_device())

    async def get_file_list(self, timeout: float = 10.0) -> list[parser.FileInfoEvent]:
        """Query list of files and await all FileInfoEvents from the device.

        The device responds with multiple FileInfoEvent notifications. The first
        event's total_files field indicates how many events will be sent in total.
        This function collects all events with a timeout.

        Args:
            timeout: Maximum time to wait for all file info events (default 10 seconds)

        Returns:
            List of FileInfoEvent objects received from the device

        Raises:
            TimeoutError: If not all events are received within the timeout period
        """
        await self.send_command(commands.query_file_list())

        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        temp = []
        file_info_events = []
        expected_count = None

        try:
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    raise TimeoutError(
                        f"Timeout waiting for file info events. "
                        f"Expected {expected_count}, received {len(file_info_events)}"
                    )

                try:
                    ev = await asyncio.wait_for(self.events.get(), timeout=remaining)
                except TimeoutError:
                    raise

                if isinstance(ev, parser.FileInfoEvent):
                    file_info_events.append(ev)
                    logger.debug("Received FileInfoEvent %d", len(file_info_events))

                    # First event tells us how many total to expect
                    if expected_count is None:
                        expected_count = ev.total_files
                        logger.debug(
                            "Expecting %d total FileInfoEvents", expected_count
                        )

                    # Check if we've received all expected events
                    if len(file_info_events) >= expected_count:
                        logger.debug(
                            "Collected all %d FileInfoEvents", len(file_info_events)
                        )
                        return file_info_events
                else:
                    # Non-FileInfoEvent - save for re-queuing
                    logger.debug(
                        "Non-FileInfoEvent received while waiting: %s",
                        type(ev).__name__,
                    )
                    temp.append(ev)

        finally:
            # Re-queue non-FileInfoEvent events
            for e in temp:
                try:
                    self.events.put_nowait(e)
                except Exception:
                    pass

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
                    raise TimeoutError
                try:
                    ev = await asyncio.wait_for(self.events.get(), timeout=remaining)
                except TimeoutError:
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

    async def get_file_order(self, timeout: float = 2.0) -> list[int]:
        await self.send_command(commands.query_file_order())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.FileOrderEvent), timeout=timeout
        )
        return ev.file_indices

    async def get_eye_icon(self, timeout: float = 2.0) -> int:
        """Query the device live mode and return the eye_icon integer."""
        await self.send_command(commands.query_live_mode())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveModeEvent), timeout=timeout
        )
        return ev.eye_icon

    async def get_live_mode(self, timeout: float = 2.0) -> parser.LiveModeEvent:
        """Query the device live mode and return the parsed LiveModeEvent."""
        await self.send_command(commands.query_live_mode())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.LiveModeEvent), timeout=timeout
        )
        return ev

    async def get_light_info(
        self, channel: int, timeout: float = 2.0
    ) -> parser.LightInfo:
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

    async def get_capacity(self, timeout: float = 2.0) -> parser.CapacityEvent:
        await self.send_command(commands.query_capacity())
        ev = await self._wait_for_event(
            lambda e: isinstance(e, parser.CapacityEvent), timeout=timeout
        )
        return ev

    # Private helper methods for connect_live_mode

    async def _get_live_name_for_connection(self) -> str | None:
        """Get device live name via BLE.

        Returns:
            Device name on success, None on failure.
        """
        try:
            return await self.get_live_name(timeout=2.0)
        except TimeoutError:
            logger.debug("Timed out while querying live name")
            return None
        except Exception:
            logger.exception("Failed to query live name")
            return None

    async def _enable_bt_advertising(self) -> bool:
        """Enable classic Bluetooth advertising on device.

        Returns:
            True on success, False on failure.
        """
        try:
            await self.enable_classic_bt()
        except Exception:
            logger.exception("Failed to send enable_classic_bt command")
            return False
        else:
            return True

    async def _attempt_automated_pairing(
        self, live_name: str, bt_pin: str, timeout: float
    ) -> tuple[str | None, bool]:
        """Attempt automated pairing via REST server.

        Args:
            live_name: Device name to pair
            bt_pin: PIN code for pairing
            timeout: Server-side timeout for pairing operation

        Returns:
            Tuple of (mac_address, pairing_succeeded)
        """
        try:
            logger.debug("Attempting to pair and trust device: %s", live_name)
            http_timeout = timeout + 10  # Add buffer for HTTP response
            timeout_config = aiohttp.ClientTimeout(total=http_timeout)
            async with aiohttp.ClientSession(timeout=timeout_config) as session:
                async with session.post(
                    f"{self.server_url}/pair_and_trust_by_name",
                    json={"device_name": live_name, "pin": bt_pin, "timeout": timeout},
                ) as resp:
                    pair_data = await resp.json()

            if pair_data.get("success"):
                mac_address = pair_data.get("mac")
                if mac_address:
                    logger.info(
                        "Successfully paired and trusted device %s (MAC: %s)",
                        live_name,
                        mac_address,
                    )
                    return mac_address, True
                logger.warning(
                    "Pairing succeeded but no MAC address returned, falling back to connect_by_name"
                )
            error_msg = pair_data.get("error", "Unknown error")
            logger.info(
                "Pairing failed (%s), will attempt connect_by_name fallback",
                error_msg,
            )

        except (TimeoutError, aiohttp.ClientError) as err:
            logger.info(
                "Pairing request failed (%s), will attempt connect_by_name fallback",
                err,
            )
        except Exception:
            logger.debug("Unexpected error during pairing attempt", exc_info=True)

        return None, False

    async def _connect_by_mac_after_pairing(
        self, mac_address: str, bt_pin: str, timeout: float
    ) -> str | None:
        """Connect to paired device by MAC address.

        Args:
            mac_address: MAC address of paired device
            bt_pin: PIN code for connection
            timeout: Server-side timeout for connection operation

        Returns:
            MAC address on success, None on failure.
        """
        try:
            logger.info("Connecting to paired device by MAC address: %s", mac_address)
            http_timeout = timeout + 5  # Connection should be quick after pairing
            timeout_config = aiohttp.ClientTimeout(total=http_timeout)
            async with aiohttp.ClientSession(timeout=timeout_config) as session:
                async with session.post(
                    f"{self.server_url}/connect_by_mac",
                    json={"mac": mac_address, "pin": bt_pin},
                ) as resp:
                    connect_data = await resp.json()

            if connect_data.get("success"):
                logger.info(
                    "Successfully connected to classic BT device %s", mac_address
                )
                self._live_mode_client_address = mac_address
                return mac_address
            error_msg = (
                connect_data.get("error")
                or connect_data.get("message")
                or "Unknown error"
            )
            logger.warning(
                "Failed to connect by MAC after pairing: %s, trying connect_by_name",
                error_msg,
            )

        except (TimeoutError, aiohttp.ClientError) as err:
            logger.warning(
                "Error connecting by MAC after pairing: %s, trying connect_by_name", err
            )

        return None

    async def _connect_by_name_simple(
        self, live_name: str, bt_pin: str, timeout: float
    ) -> str | None:
        """Connect to device by name without retry logic.

        Args:
            live_name: Device name to connect to
            bt_pin: PIN code for connection
            timeout: Server-side timeout for connection operation

        Returns:
            MAC address on success, None on failure.
        """
        http_timeout = timeout + 5  # Add buffer for HTTP overhead
        timeout_config = aiohttp.ClientTimeout(total=http_timeout)
        async with aiohttp.ClientSession(timeout=timeout_config) as session:
            async with session.post(
                f"{self.server_url}/connect_by_name",
                json={"device_name": live_name, "pin": bt_pin},
            ) as resp:
                connect_data = await resp.json()

        if not connect_data.get("success"):
            error_msg = (
                connect_data.get("error")
                or connect_data.get("message")
                or "Unknown error"
            )
            logger.warning(
                "REST server failed to connect to %s: %s (response: %s)",
                live_name,
                error_msg,
                connect_data,
            )
            return None

        mac_address = connect_data.get("mac")
        if not mac_address:
            logger.warning("REST server connected but did not return MAC address")
            return None

        logger.info("Successfully connected to classic BT device %s", mac_address)
        self._live_mode_client_address = mac_address
        return mac_address

    async def _check_device_in_status(self, live_name: str) -> str | None:
        """Check if device is connected by querying REST server status.

        Args:
            live_name: Device name to look for

        Returns:
            MAC address if device found and connected, None otherwise.
        """
        try:
            status_data = await self.get_audio_status_live_mode()
            bluetooth_info = status_data.get("bluetooth", {})
            connected_devices = bluetooth_info.get("devices", [])

            live_name_lower = live_name.lower()
            for device in connected_devices:
                device_name = device.get("name", "").lower()
                if device_name == live_name_lower:
                    mac_address = device.get("mac")
                    if mac_address:
                        logger.info(
                            "Found connected device %s with MAC %s in REST server status",
                            live_name,
                            mac_address,
                        )
                        self._live_mode_client_address = mac_address
                        return mac_address
        except Exception:
            logger.debug("Failed to check device status", exc_info=True)

        return None

    async def _connect_by_name_with_retry(
        self, live_name: str, bt_pin: str, timeout: float
    ) -> str | None:
        """Connect to device by name with retry logic on timeout.

        This handles the case where the connection succeeds but the response times out.

        Args:
            live_name: Device name to connect to
            bt_pin: PIN code for connection
            timeout: Server-side timeout for connection operation

        Returns:
            MAC address on success, None on failure.
        """
        try:
            logger.info("Attempting to connect by name: %s", live_name)
            return await self._connect_by_name_simple(live_name, bt_pin, timeout)

        except TimeoutError:
            logger.warning("REST server connection request timed out")
            logger.info(
                "Checking REST server status to verify connection for %s", live_name
            )

            # Check if connection succeeded despite timeout
            mac_address = await self._check_device_in_status(live_name)
            if mac_address:
                return mac_address

            # Not found in status, retry the connection once
            logger.info(
                "Device %s not found in REST server status, retrying connection",
                live_name,
            )

            try:
                mac_address = await self._connect_by_name_simple(
                    live_name, bt_pin, timeout
                )
                if mac_address:
                    logger.info(
                        "Successfully connected to classic BT device %s on retry",
                        mac_address,
                    )
                return mac_address

            except TimeoutError:
                logger.warning("REST server retry connection also timed out")
                # One more status check after retry timeout
                mac_address = await self._check_device_in_status(live_name)
                return mac_address

            except aiohttp.ClientError as err:
                logger.warning("REST server retry communication error: %s", err)
                return None

        except aiohttp.ClientError as err:
            logger.warning("REST server communication error: %s", err)
            return None
        except Exception:
            logger.exception("Unexpected error during REST server communication")
            return None

    async def connect_live_mode(
        self, timeout: float = 40.0, bt_pin: str = "1234"
    ) -> str | None:
        """Enable classic BT and connect via REST server.

        Sequence:
        1. Query the device for its live name (uses the existing BLE connection)
        2. Send the enable_classic_bt command to expose a classic Bluetooth device
        3. Attempt automated pairing via REST server (requires root on server):
           - If successful: Connect by MAC address and return immediately
        4. Fallback to connect_by_name (for manually paired devices):
           - Used if pairing fails or server lacks root privileges
           - Requires device to be manually paired beforehand

        Args:
            timeout: Server-side timeout for pairing/connection operations (default 40s).
                    HTTP requests use timeout + buffer to allow for network overhead.
            bt_pin: PIN code for pairing (default "1234").

        Returns:
            The MAC address of the connected classic BT device on success,
            or None on failure.

        Note:
            This method requires the Skelly device to be already connected via BLE
            so that get_live_name and enable_classic_bt commands can be sent.
        """
        # Validate BLE connection
        if not self._client or not getattr(self._client, "is_connected", False):
            raise RuntimeError("Not connected to device to request live-mode")

        # Step 1: Get device name via BLE
        live_name = await self._get_live_name_for_connection()
        if not live_name:
            return None

        # Step 2: Enable classic Bluetooth advertising
        if not await self._enable_bt_advertising():
            return None

        logger.info(
            "Requesting REST server to connect to classic BT device: %s", live_name
        )

        # Step 3: Try automated pairing (requires root privileges on server)
        mac_address, pairing_succeeded = await self._attempt_automated_pairing(
            live_name, bt_pin, timeout
        )

        # Step 4: If pairing succeeded, connect by MAC address
        if pairing_succeeded and mac_address:
            connected_mac = await self._connect_by_mac_after_pairing(
                mac_address, bt_pin, timeout
            )
            if connected_mac:
                return connected_mac

        # Step 5: Fallback to connect_by_name (for manually paired devices)
        return await self._connect_by_name_with_retry(live_name, bt_pin, timeout)
