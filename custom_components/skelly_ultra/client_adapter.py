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

    async def connect(self, attempts: int = 3, backoff: float = 1.0) -> bool:
        """Connect using HA's bluetooth helpers when possible, with retries.

        Attempts to retrieve a BLE device from HA and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure.
        """
        last_exc: Exception | None = None

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
            _LOGGER.error("All connection attempts failed: %s", last_exc)
        else:
            _LOGGER.error("All connection attempts failed (no exception available)")
        return False

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
        self, timeout: float = 10.0, bt_pin: str = "1234"
    ) -> str | None:
        """Connect to the classic/live Bluetooth device aka live mode.

        Args:
            timeout: Connection timeout in seconds
            bt_pin: Bluetooth PIN for pairing (default: "1234")
        """
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
