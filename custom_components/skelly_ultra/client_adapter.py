"""Adapter that wraps skelly_ultra_pkg.client.SkellyClient for Home Assistant.

This keeps the HA integration code separate from the library internals.
"""

from __future__ import annotations

import asyncio
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
        live_mode_pin: str | None = None,
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
        self._live_mode_callbacks: list = []
        self._live_mode_should_connect = live_mode_should_connect
        self._live_mode_pin = live_mode_pin

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
                _LOGGER.exception("Error in live mode callback")

    def set_live_mode_preference(
        self, should_connect: bool, bt_pin: str | None = None
    ) -> None:
        """Remember the desired live-mode state so it can be restored later."""
        self._live_mode_should_connect = should_connect
        self.cache_live_mode_pin(bt_pin)

    def cache_live_mode_pin(self, bt_pin: str | None) -> None:
        """Cache the provided live-mode PIN and trigger auto-restore if needed."""
        if not bt_pin:
            return
        if bt_pin == self._live_mode_pin:
            return
        self._live_mode_pin = bt_pin

        if not self._live_mode_should_connect:
            return

        if getattr(self._client, "live_mode_client_address", None):
            return

        # Attempt automatic restore now that a valid PIN is available
        self.hass.async_create_task(self._restore_live_mode_if_needed())

    async def _restore_live_mode_if_needed(self) -> None:
        """Reconnect live mode if it was previously on."""
        if not self._live_mode_should_connect:
            return

        # Skip if the live-mode transport already reports a client address
        live_mode_address = getattr(self._client, "live_mode_client_address", None)
        if live_mode_address:
            return

        pin = self._live_mode_pin
        if not pin:
            _LOGGER.debug(
                "Skipping live mode restore because no PIN has been cached yet"
            )
            return
        _LOGGER.info("Restoring live mode automatically because switch state was on")
        result = await self.connect_live_mode(bt_pin=pin)
        if not result:
            _LOGGER.warning("Automatic live-mode restore did not complete successfully")

    async def _connect_internal(self, attempts: int, backoff: float) -> bool:
        """Connect using HA's bluetooth helpers when possible, with retries.

        Attempts to retrieve a BLE device from HA and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure.
        """
        last_exc: Exception | None = None

        # If using BLE proxy, connect directly through the client without BLE device
        if self._client.use_ble_proxy:
            for attempt in range(1, attempts + 1):
                try:
                    ok = await self._client.connect()
                    if ok:
                        _LOGGER.info(
                            "Connected to Skelly device via BLE proxy on attempt %d",
                            attempt,
                        )
                        return True

                    _LOGGER.warning(
                        "BLE proxy connection returned False on attempt %d",
                        attempt,
                    )

                except Exception as exc:
                    last_exc = exc
                    _LOGGER.warning(
                        "Attempt %d to connect via BLE proxy failed: %s", attempt, exc
                    )

                # Backoff before retrying
                if attempt < attempts:
                    sleep_for = backoff * (2 ** (attempt - 1))
                    _LOGGER.debug("Retrying in %.1f seconds", sleep_for)
                    await asyncio.sleep(sleep_for)

            # All attempts exhausted
            if last_exc:
                _LOGGER.error("All BLE proxy connection attempts failed: %s", last_exc)
            else:
                _LOGGER.error(
                    "All BLE proxy connection attempts failed (no exception available)"
                )
            return False

        # Direct BLE mode - use HA's bluetooth helpers
        # Ensure any stale connections are cleaned up before attempting
        # to establish a new connection via the retry connector.
        if self.address:
            try:
                await close_stale_connections_by_address(self.address)
            except Exception:
                _LOGGER.debug(
                    "close_stale_connections_by_address failed", exc_info=True
                )

        for attempt in range(1, attempts + 1):
            try:
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
                        _LOGGER.debug(
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
                            )
                        except Exception:
                            _LOGGER.debug(
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
                            bleak_client = BleakClient(ble_device)

                        ok = await self._client.connect(client=bleak_client)
                        if ok:
                            _LOGGER.info(
                                "Connected to Skelly device at %s on attempt %d",
                                self.address,
                                attempt,
                            )
                            return True

                        _LOGGER.warning(
                            "SkellyClient.connect returned False for %s on attempt %d",
                            self.address,
                            attempt,
                        )

                # Fallback to library discovery/connect
                # Defer notification registration to HA
                ok = await self._client.connect()
                if ok:
                    _LOGGER.info(
                        "SkellyClient connected via internal discovery on attempt %d",
                        attempt,
                    )
                    return True

            except Exception as exc:  # broad catch so we can retry
                last_exc = exc
                _LOGGER.warning(
                    "Attempt %d to connect to Skelly device failed: %s", attempt, exc
                )

            # Backoff before retrying
            if attempt < attempts:
                sleep_for = backoff * (2 ** (attempt - 1))
                _LOGGER.debug("Retrying in %.1f seconds", sleep_for)
                await asyncio.sleep(sleep_for)

        # All attempts exhausted
        if last_exc:
            _LOGGER.warning("All connection attempts failed: %s", last_exc)
        else:
            _LOGGER.warning("All connection attempts failed (no exception available)")
        return False

    async def connect(self, attempts: int = 3, backoff: float = 1.0) -> bool:
        """Connect to the Skelly BLE device.

        The connection is established either directly and then using HA's bluetooth helpers
        when possible or using the REST server as BLE proxy if configured that way.

        Attempts to retrieve a BLE device from HA or the REST server and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure.
        """
        if not await self._connect_internal(attempts, backoff):
            return False

        # Immediately enable BT classic mode so that live mode can connect
        try:
            await self._client.enable_classic_bt()
        except Exception:
            _LOGGER.exception("Failed to enable classic Bluetooth")

        await self._restore_live_mode_if_needed()

        return True

    async def disconnect(self) -> None:
        """Disconnect the underlying Skelly client and clean up resources."""
        _LOGGER.info("Disconnecting Skelly adapter/client")
        try:
            await self._client.disconnect()
        except Exception:
            _LOGGER.exception("Error while disconnecting Skelly client")

    @property
    def client(self) -> SkellyClient:
        """Return the underlying SkellyClient instance."""
        return self._client

    async def connect_live_mode(
        self, timeout: float = 30.0, bt_pin: str | None = None
    ) -> str | None:
        """Connect to the classic/live Bluetooth device aka live mode.

        Args:
            timeout: Connection timeout in seconds
            bt_pin: Bluetooth PIN for pairing retrieved from the device
        """
        if not bt_pin:
            _LOGGER.warning(
                "Cannot connect live mode because the Bluetooth PIN is unknown"
            )
            return None

        self._live_mode_pin = bt_pin
        try:
            result = await self._client.connect_live_mode(
                timeout=timeout, bt_pin=bt_pin
            )
            # Notify callbacks that connection state changed
            self._notify_live_mode_change()
            return result
        except Exception:
            _LOGGER.exception("Failed to connect live mode via adapter")
            return None

    async def disconnect_live_mode(self) -> None:
        """Disconnect the classic/live-mode client managed by the underlying SkellyClient."""
        try:
            await self._client.disconnect_live_mode()
            # Notify callbacks that connection state changed
            self._notify_live_mode_change()
        except Exception:
            _LOGGER.exception("Error while disconnecting live-mode client")
