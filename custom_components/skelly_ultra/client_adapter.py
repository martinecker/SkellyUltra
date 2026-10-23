"""Adapter that wraps skelly_ultra_pkg.client.SkellyClient for Home Assistant.

This keeps the HA integration code separate from the library internals.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
import logging

from bleak import BleakClient
from bleak_retry_connector import (
    close_stale_connections_by_address,
    establish_connection,
)

from homeassistant.components import bluetooth
from homeassistant.core import HomeAssistant

from .skelly_ultra_pkg.client import SkellyClient

_LOGGER = logging.getLogger(__name__)

# Waits before each background reconnect attempt after a drop; once these are
# used up, attempts continue every RECONNECT_MAX_DELAY seconds (the
# coordinator's poll interval, which used to do the reconnecting).
RECONNECT_DELAYS = (2.0, 4.0, 8.0, 16.0)
RECONNECT_MAX_DELAY = 30.0
# Upper bound on how long a command waits for a reconnect before failing.
COMMAND_RECONNECT_TIMEOUT = 20.0
# A command sent this soon after a failed connect attempt fails right away
# instead of making another attempt of its own.
COMMAND_RECONNECT_FAIL_FAST = 10.0


class SkellyClientAdapter:
    """Adapter that manages a SkellyClient and integrates with Home Assistant's BLE helpers.

    The adapter prefers Home Assistant-managed connections (via
    bleak-retry-connector) and falls back to the bundled client's discovery
    logic when necessary.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        address: str | None = None,
        server_url: str = "http://localhost:8765",
        use_ble_proxy: bool = False,
        live_mode_should_connect: bool = False,
        logger: logging.Logger | logging.LoggerAdapter | None = None,
    ) -> None:
        """Initialize the adapter.

        hass: the Home Assistant core object
        address: optional BLE address for the Skelly device
        server_url: URL of the REST server for live mode features
        use_ble_proxy: if True, use REST server for BLE communication instead of direct connection
        """
        self.hass = hass
        self.address = address
        self._client = SkellyClient(
            address=address, server_url=server_url, use_ble_proxy=use_ble_proxy
        )
        self._logger = logger or _LOGGER
        self._live_mode_callbacks: list = []
        self._live_mode_should_connect = live_mode_should_connect
        # Serializes connects, so the reconnect loop, the coordinator poll,
        # commands, the Connected switch and disconnect() never overlap.
        self._connect_lock = asyncio.Lock()
        # True while the device should stay connected: after a successful
        # explicit connect() or enable_auto_reconnect(), until disconnect().
        # Automatic reconnects (loop, poll, commands) only happen while set.
        self._auto_reconnect = False
        self._reconnect_task: asyncio.Task | None = None
        # Live-mode restore (and reconnected callback) after a connect;
        # cancelled when live mode or the device is disconnected.
        self._after_connect_task: asyncio.Task | None = None
        # Counts stop_auto_reconnect() calls (disconnect() makes one too). A
        # connect that started before one gives up instead of finishing after
        # it, e.g. while the Connected switch is turned off: in proxy mode the
        # client still looks connected while disconnect() runs.
        self._stops = 0
        # Number of disconnect() calls still running.
        self._disconnects_running = 0
        # Bumped whenever a live-mode restore is superseded or started; a
        # restore only fires the reconnected callback while it is current.
        self._restore_generation = 0
        # The connect and live-mode restore tasks running now. A command sent
        # from one of them on a link that dropped again fails instead of
        # reconnecting, so a connect never recurses into another one or waits
        # on the lock it holds. (Tracked per task rather than in a ContextVar,
        # which would leak into tasks and HA callbacks started from there.)
        self._connect_tasks: set[asyncio.Task] = set()
        # Loop time of the last failed connect attempt, so commands and
        # waiting callers don't stack attempts on top of a failed one.
        self._last_connect_failure: float | None = None
        # Set by a drop; the next successful connect calls the reconnected
        # callback so the coordinator can refresh right away.
        self._recovering = False
        self._reconnected_callback: Callable[[], None] | None = None
        self._client.register_reconnect_handler(self._reconnect_for_command)

    def register_disconnected_handler(self, handler: Callable[[], None]) -> None:
        """Register a callback for when the BLE link drops unexpectedly.

        Forwards to SkellyClient.register_disconnected_handler; not called for
        disconnects requested through disconnect().
        """
        self._client.register_disconnected_handler(handler)

    def register_reconnected_callback(self, callback: Callable[[], None]) -> None:
        """Register a callback for when the connection is back after a drop."""
        self._reconnected_callback = callback

    def enable_auto_reconnect(self) -> None:
        """Reconnect automatically from now on, even if the next connect() fails.

        For setup with the Connected switch on, so the coordinator poll and
        commands keep retrying a device that isn't there yet. An explicit
        connect() only turns this on when it succeeds, so a failed turn-on of
        the Connected switch doesn't leave the device reconnecting on its own.
        """
        self._auto_reconnect = True

    @property
    def is_reconnecting(self) -> bool:
        """Return True while the background reconnect loop is running."""
        return self._reconnect_task is not None and not self._reconnect_task.done()

    def start_reconnect_loop(self) -> None:
        """Start reconnecting in the background with backoff after a drop.

        Does nothing while automatic reconnects are off (e.g. Connected switch
        off) or when the loop is already running.
        """
        if not self._auto_reconnect:
            return
        self._recovering = True
        if self.is_reconnecting:
            return
        self._reconnect_task = self.hass.async_create_background_task(
            self._reconnect_loop(), name=f"skelly_ultra reconnect {self.address}"
        )

    async def _reconnect_loop(self) -> None:
        """Retry connect() with increasing waits until connected or disabled."""
        attempt = 0
        while self._auto_reconnect and not self._client.is_connected:
            delay = (
                RECONNECT_DELAYS[attempt]
                if attempt < len(RECONNECT_DELAYS)
                else RECONNECT_MAX_DELAY
            )
            attempt += 1
            self._logger.debug("Reconnect attempt %d in %.0f seconds", attempt, delay)
            await asyncio.sleep(delay)
            # A command or the coordinator may have reconnected meanwhile.
            if not self._auto_reconnect or self._client.is_connected:
                break
            try:
                # Don't wait for the live-mode restore (a pairing can take
                # minutes): a drop during it then starts a new loop at once.
                ok = await self.connect(
                    attempts=1, automatic=True, restore_live_mode_in_background=True
                )
            except Exception:
                self._logger.exception("Error during background reconnect")
                ok = False
            if ok:
                self._logger.info(
                    "Reconnected to Skelly device after %d attempt(s)", attempt
                )
                # Don't return: the link can drop again before this loop ends,
                # and start_reconnect_loop() won't start another one while
                # this one still runs. The while condition checks again.
                attempt = 0
                continue
            self._logger.debug("Background reconnect attempt %d failed", attempt)

    def _failed_recently(self) -> bool:
        """Return True if a connect attempt failed in the last few seconds."""
        return (
            self._last_connect_failure is not None
            and self.hass.loop.time() - self._last_connect_failure
            < COMMAND_RECONNECT_FAIL_FAST
        )

    async def _reconnect_for_command(self) -> bool:
        """Reconnect handler for SkellyClient.send_command after a drop."""
        if self._client.is_connected:
            # Another caller reconnected meanwhile (e.g. replaced a lost proxy session).
            return True
        if not self._auto_reconnect or asyncio.current_task() in self._connect_tasks:
            return False
        if self._failed_recently():
            self._logger.debug(
                "Command issued while disconnected - a reconnect just failed, not retrying yet"
            )
            return False
        self._logger.info("Command issued while disconnected - reconnecting first")
        try:
            async with asyncio.timeout(COMMAND_RECONNECT_TIMEOUT):
                return await self.connect(
                    attempts=1, automatic=True, restore_live_mode_in_background=True
                )
        except TimeoutError:
            self._logger.warning(
                "Reconnect for command timed out after %.0f seconds",
                COMMAND_RECONNECT_TIMEOUT,
            )
            return False

    def register_live_mode_callback(self, callback) -> None:
        """Register a callback to be notified when live mode connection state changes."""
        if callback not in self._live_mode_callbacks:
            self._live_mode_callbacks.append(callback)

    def unregister_live_mode_callback(self, callback) -> None:
        """Unregister a live mode callback."""
        if callback in self._live_mode_callbacks:
            self._live_mode_callbacks.remove(callback)

    def _notify_live_mode_change(self) -> None:
        """Notify all registered callbacks that live mode state has changed."""
        for callback in self._live_mode_callbacks:
            try:
                callback()
            except Exception:
                self._logger.exception("Error in live mode callback")

    def set_live_mode_preference(self, should_connect: bool) -> None:
        """Remember the desired live-mode state so it can be restored later."""
        self._live_mode_should_connect = should_connect

    @property
    def live_mode_should_connect(self) -> bool:
        """Return True if live mode should be restored when possible."""
        return self._live_mode_should_connect

    async def restore_live_mode_if_needed(self) -> None:
        """Reconnect live mode if it was previously on."""
        if not self._live_mode_should_connect:
            return

        # Skip if the live-mode transport already reports a client address
        live_mode_address = getattr(self._client, "live_mode_client_address", None)
        if live_mode_address:
            return

        self._logger.info(
            "Restoring live mode automatically because switch state was on"
        )
        result = await self.connect_live_mode()
        if not result:
            self._logger.warning(
                "Automatic live-mode restore did not complete successfully"
            )

    async def _retry_connect(
        self,
        attempts: int,
        backoff: float,
        attempt_fn: Callable[[int], Awaitable[bool]],
        *,
        context: str,
        failure_log_is_error: bool = False,
    ) -> bool:
        """Run attempt_fn up to `attempts` times with exponential backoff between tries.

        attempt_fn(attempt) should return True on success or False on a clean
        failure; any exception it raises is treated the same as a False
        return (logged, then retried). Returns True as soon as attempt_fn
        succeeds, or False once all attempts are exhausted. `context`
        describes the connection method for log messages (e.g. "via BLE
        proxy" or "to Skelly device").
        """
        last_exc: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                if await attempt_fn(attempt):
                    return True
            except Exception as exc:  # broad catch so we can retry
                last_exc = exc
                self._logger.warning(
                    "Attempt %d to connect %s failed: %s", attempt, context, exc
                )

            if attempt < attempts:
                sleep_for = backoff * (2 ** (attempt - 1))
                self._logger.debug("Retrying in %.1f seconds", sleep_for)
                await asyncio.sleep(sleep_for)

        log = self._logger.error if failure_log_is_error else self._logger.warning
        if last_exc:
            log("All connection attempts %s failed: %s", context, last_exc)
        else:
            log("All connection attempts %s failed (no exception available)", context)
        return False

    async def _try_proxy_connect(self, attempt: int) -> bool:
        """Single connection attempt via the BLE proxy REST server."""
        ok = await self._client.connect()
        if ok:
            self._logger.info(
                "Connected to Skelly device via BLE proxy on attempt %d", attempt
            )
            return True
        self._logger.warning(
            "BLE proxy connection returned False on attempt %d", attempt
        )
        return False

    async def _try_direct_connect(self, attempt: int) -> bool:
        """Single connection attempt via HA's bluetooth helpers, or library discovery."""
        if self.address:
            ble_device = None
            try:
                # Try to get BLE device from HA's bluetooth integration
                result = bluetooth.async_ble_device_from_address(
                    self.hass, self.address
                )
                # Handle both sync and async versions of the API
                if hasattr(result, "__await__"):
                    ble_device = await result
                else:
                    ble_device = result
            except Exception as exc:
                self._logger.debug(
                    "HA bluetooth helper couldn't resolve address %s: %s",
                    self.address,
                    exc,
                )
                ble_device = None

            if ble_device:
                # Prefer using bleak-retry-connector to establish a
                # connection so the connection uses the shared retry
                # logic and Home Assistant's recommended connector.
                bleak_client = None
                try:
                    bleak_client = await establish_connection(
                        BleakClient,
                        ble_device,
                        ble_device.name or "Animated Skelly",
                        disconnected_callback=self._client.handle_ble_disconnect,
                    )
                except Exception:
                    self._logger.debug(
                        "establish_connection failed for %s, falling back to BleakClient",
                        self.address,
                        exc_info=True,
                    )

                if bleak_client is None:
                    # Last-resort fallback: create a BleakClient instance
                    # from the resolved device. SkellyClient.connect will
                    # avoid calling connect() if the client is already
                    # connected, but using establish_connection above is
                    # preferred to avoid a HA bleak-retry warning.
                    bleak_client = BleakClient(
                        ble_device,
                        disconnected_callback=self._client.handle_ble_disconnect,
                    )

                ok = await self._client.connect(client=bleak_client)
                if ok:
                    self._logger.info(
                        "Connected to Skelly device at %s on attempt %d",
                        self.address,
                        attempt,
                    )
                    return True

                self._logger.warning(
                    "SkellyClient.connect returned False for %s on attempt %d",
                    self.address,
                    attempt,
                )

        # Fallback to library discovery/connect
        # Defer notification registration to HA
        ok = await self._client.connect()
        if ok:
            self._logger.info(
                "SkellyClient connected via internal discovery on attempt %d",
                attempt,
            )
            return True
        return False

    async def _connect_internal(self, attempts: int, backoff: float) -> bool:
        """Connect using HA's bluetooth helpers when possible, with retries.

        Attempts to retrieve a BLE device from HA and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure.
        """
        # If using BLE proxy, connect directly through the client without BLE device
        if self._client.use_ble_proxy:
            return await self._retry_connect(
                attempts,
                backoff,
                self._try_proxy_connect,
                context="via BLE proxy",
                failure_log_is_error=True,
            )

        # Direct BLE mode - use HA's bluetooth helpers
        # Ensure any stale connections are cleaned up before attempting
        # to establish a new connection via the retry connector.
        if self.address:
            try:
                await close_stale_connections_by_address(self.address)
            except Exception:
                self._logger.debug(
                    "close_stale_connections_by_address failed", exc_info=True
                )

        return await self._retry_connect(
            attempts, backoff, self._try_direct_connect, context="to Skelly device"
        )

    async def connect(
        self,
        attempts: int = 3,
        backoff: float = 1.0,
        *,
        automatic: bool = False,
        restore_live_mode_in_background: bool = False,
    ) -> bool:
        """Connect to the Skelly BLE device.

        The connection is established either directly and then using HA's bluetooth helpers
        when possible or using the REST server as BLE proxy if configured that way.

        Attempts to retrieve a BLE device from HA or the REST server and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure, including when the link drops again before this
        returns. Returns True right away if already connected (e.g. another
        caller reconnected while this one waited for the lock).

        An explicit connect (setup, Connected switch) turns on automatic
        reconnects when it succeeds. automatic=True is for the reconnect
        loop, the coordinator poll and commands: it returns False when
        automatic reconnects are off (e.g. disconnect() ran meanwhile), and
        when another caller's attempt failed while this one waited.

        The connect runs in its own task: a caller that is cancelled or times
        out only stops waiting and never aborts a connect halfway, which
        could leave an orphan proxy session or a link without notifications.
        restore_live_mode_in_background returns once BLE is up instead of
        also waiting for the live-mode restore.
        """
        # Not while disconnect() runs: in proxy mode the client still looks
        # connected until it has closed the session. Wait for it instead.
        if self._client.is_connected and not self._disconnects_running:
            if not automatic:
                self._auto_reconnect = True
            return True
        if automatic and not self._auto_reconnect:
            return False
        task = self.hass.async_create_background_task(
            self._run_as_connect_task(
                self._connect(
                    attempts,
                    backoff,
                    automatic=automatic,
                    restore_live_mode_in_background=restore_live_mode_in_background,
                )
            ),
            name=f"skelly_ultra connect {self.address}",
        )
        return await asyncio.shield(task)

    async def _run_as_connect_task(self, coro: Awaitable):
        """Await coro with the current task marked as a connect task."""
        task = asyncio.current_task()
        self._connect_tasks.add(task)
        try:
            return await coro
        finally:
            self._connect_tasks.discard(task)

    async def _connect(
        self,
        attempts: int,
        backoff: float,
        *,
        automatic: bool,
        restore_live_mode_in_background: bool,
    ) -> bool:
        """Do the work of connect() in its own task."""
        wait_start = self.hass.loop.time()
        stops = self._stops
        async with self._connect_lock:
            if automatic and not self._auto_reconnect:
                return False
            if self._stops != stops:
                # stop_auto_reconnect() or disconnect() ran while this one waited.
                return False
            if self._client.is_connected:
                if not automatic:
                    self._auto_reconnect = True
                return True
            if (
                automatic
                and self._last_connect_failure is not None
                and self._last_connect_failure >= wait_start
            ):
                # Another caller's attempt failed while this one waited.
                return False

            try:
                connected = await self._connect_internal(attempts, backoff)
                if connected:
                    # Immediately enable BT classic mode so that live mode can connect
                    try:
                        await self._client.enable_classic_bt()
                    except Exception:
                        self._logger.exception("Failed to enable classic Bluetooth")
                    # The link can drop again during enable_classic_bt.
                    connected = self._client.is_connected
            except Exception:
                self._logger.exception("Unexpected error while connecting")
                connected = False

            if not connected:
                self._last_connect_failure = self.hass.loop.time()
                return False
            self._last_connect_failure = None

        # Restore live mode outside the lock: a pairing can take 30s or more,
        # and commands and other callers must not wait behind it. Cancel the
        # old restore first; it was superseded, so it leaves the reconnected
        # callback to this connect's restore. Loop in case another connect
        # started a restore while this one waited.
        while self._after_connect_task is not None:
            old_task = self._after_connect_task
            self._after_connect_task = None
            self._restore_generation += 1
            await self._cancel_task(old_task)
        if self._stops != stops:
            # Stopped meanwhile (switch off, unload); don't restore behind its back.
            return False
        self._restore_generation += 1
        self._after_connect_task = self.hass.async_create_background_task(
            self._run_as_connect_task(self._after_connect(self._restore_generation)),
            name=f"skelly_ultra live restore {self.address}",
        )
        if not restore_live_mode_in_background:
            # asyncio.wait: disconnect() cancelling the restore must not cancel us.
            await asyncio.wait((self._after_connect_task,))

        # In proxy mode the client still looks connected while disconnect()
        # runs, hence the stop count.
        connected = self._client.is_connected and self._stops == stops
        if connected and not automatic:
            # Only now: if the link dropped during the restore, this explicit
            # connect failed (e.g. the Connected switch stays off) and must
            # not leave the device reconnecting on its own.
            self._auto_reconnect = True
        return connected

    async def _after_connect(self, generation: int) -> None:
        """Restore live mode, then report a recovered connection.

        The reconnected callback runs after the restore, so the coordinator's
        refresh doesn't compete with the restore's queries for replies.
        """
        try:
            await self.restore_live_mode_if_needed()
        except Exception:
            self._logger.exception("Error while restoring live mode")
        finally:
            # Also when the restore is cancelled (e.g. live mode turned off),
            # so the refresh after a reconnect isn't lost. Not when a newer
            # connect replaced this task: its own restore notifies once done.
            # (A generation, not a task identity check: HA starts tasks
            # eagerly, so this can run before the task is even stored.)
            if generation == self._restore_generation:
                self._notify_reconnected()

    def _notify_reconnected(self) -> None:
        """Call the reconnected callback if this connect ended a drop."""
        if self._recovering and self._client.is_connected:
            self._recovering = False
            if self._reconnected_callback:
                try:
                    self._reconnected_callback()
                except Exception:
                    self._logger.exception("Error in reconnected callback")

    @staticmethod
    async def _cancel_task(task: asyncio.Task | None) -> None:
        """Cancel a task and wait for it to finish, unless it is the current one."""
        if task is None or task.done() or task is asyncio.current_task():
            return
        task.cancel()
        # asyncio.wait doesn't raise the task's CancelledError, while our own
        # cancellation still propagates.
        await asyncio.wait((task,))

    def stop_auto_reconnect(self) -> None:
        """Turn off automatic reconnects right away, until the next successful connect().

        disconnect() does this too. Call it first when disconnect_live_mode()
        runs before disconnect() (Connected switch off, unload), so a
        cancelled live-mode restore doesn't start a refresh after a reconnect,
        and a connect already running gives up instead of starting a new
        restore or reporting success.
        """
        self._auto_reconnect = False
        self._recovering = False
        self._stops += 1

    async def disconnect(self) -> None:
        """Disconnect the underlying Skelly client and clean up resources.

        Also stops automatic reconnects until the next successful connect(),
        and waits for a connect already in progress so it can't finish after
        this.
        """
        self._logger.info("Disconnecting Skelly adapter/client")
        self._disconnects_running += 1
        try:
            self.stop_auto_reconnect()
            # Take the lock first, so no connect can slip in between stopping
            # the tasks and closing the link. Neither task needs the lock.
            async with self._connect_lock:
                await self._cancel_task(self._reconnect_task)
                self._reconnect_task = None
                await self._cancel_task(self._after_connect_task)
                self._after_connect_task = None
                # An explicit connect that held the lock may have turned this back on.
                self._auto_reconnect = False
                try:
                    await self._client.disconnect()
                except Exception:
                    self._logger.exception("Error while disconnecting Skelly client")
        finally:
            self._disconnects_running -= 1

    @property
    def client(self) -> SkellyClient:
        """Return the underlying SkellyClient instance."""
        return self._client

    async def connect_live_mode(self, timeout: float = 30.0) -> str | None:
        """Connect to the classic/live Bluetooth device aka live mode.

        Args:
            timeout: Connection timeout in seconds
        """
        try:
            result = await self._client.connect_live_mode(
                timeout=timeout,
            )
            # Notify callbacks that connection state changed
            self._notify_live_mode_change()
            return result
        except Exception:
            self._logger.exception("Failed to connect live mode via adapter")
            return None

    async def disconnect_live_mode(self) -> None:
        """Disconnect the classic/live-mode client managed by the underlying SkellyClient."""
        # A live-mode restore still running after a reconnect would otherwise
        # connect it again behind our back.
        await self._cancel_task(self._after_connect_task)
        try:
            await self._client.disconnect_live_mode()
            # Notify callbacks that connection state changed
            self._notify_live_mode_change()
        except Exception:
            self._logger.exception("Error while disconnecting live-mode client")
