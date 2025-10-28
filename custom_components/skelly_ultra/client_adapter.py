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

    def __init__(self, hass: HomeAssistant, address: str | None = None) -> None:
        """Initialize the adapter.

        hass: the Home Assistant core object
        address: optional BLE address for the Skelly device
        """
        self.hass = hass
        self.address = address
        self._client = SkellyClient(address=address)

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
                    try:
                        ble_device = await bluetooth.async_ble_device_from_address(
                            self.hass, self.address
                        )
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
                            bleak_client = await establish_connection(self.address)
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

                        # Defer notification registration to HA so entities/coordinator can be ready
                        ok = await self._client.connect(
                            client=bleak_client, start_notify=False
                        )
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
                ok = await self._client.connect(start_notify=False)
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

    async def start_notifications_with_retry(
        self, attempts: int = 3, backoff: float = 1.0
    ) -> bool:
        """Try to start notifications on the SkellyClient with retries and backoff.

        Returns True on success, False if all attempts fail.
        """
        last_exc = None
        for attempt in range(1, attempts + 1):
            try:
                await self._client.start_notifications()
            except Exception as exc:
                last_exc = exc
                _LOGGER.warning(
                    "Attempt %d to start notifications failed: %s", attempt, exc
                )
            else:
                _LOGGER.info(
                    "Notifications started for Skelly device on attempt %d", attempt
                )
                return True

            if attempt < attempts:
                sleep_for = backoff * (2 ** (attempt - 1))
                _LOGGER.debug("Retrying start_notifications in %.1f seconds", sleep_for)
                await asyncio.sleep(sleep_for)

        _LOGGER.error(
            "Failed to start notifications after %d attempts: %s", attempts, last_exc
        )
        return False

    async def connect_live_mode(
        self, timeout: float = 10.0, start_notify: bool = False
    ) -> str | None:
        """Connect to the classic/live Bluetooth device using HA helpers when possible.

        This tries to use bleak-retry-connector.establish_connection to get a
        reliable BleakClient. If that fails, it falls back to the client's
        internal connection logic.
        Returns the connected device address or None on failure.
        """

        async def _connect_fn(address: str):
            # Try the HA/retry connector first
            try:
                client = await establish_connection(address)
                return client
            except Exception:
                _LOGGER.debug(
                    "establish_connection failed for %s, falling back", address
                )
                return None

        # Delegate to the library client, passing our connect function
        try:
            return await self._client.connect_live_mode(
                timeout=timeout, start_notify=start_notify, connect_fn=_connect_fn
            )
        except Exception:
            _LOGGER.exception("Failed to connect live mode via adapter")
            return None

    async def disconnect_live_mode(self) -> None:
        """Disconnect the classic/live-mode client managed by the underlying SkellyClient."""
        try:
            await self._client.disconnect_live_mode()
        except Exception:
            _LOGGER.exception("Error while disconnecting live-mode client")
