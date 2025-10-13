"""Adapter that wraps skelly_ultra_pkg.client.SkellyClient for Home Assistant.

This keeps the HA integration code separate from the library internals.
"""
from __future__ import annotations

from typing import Optional
import asyncio
import logging

from homeassistant.core import HomeAssistant
from homeassistant.components import bluetooth

from skelly_ultra_pkg.client import SkellyClient

from bleak import BleakClient

_LOGGER = logging.getLogger(__name__)


class SkellyClientAdapter:
    def __init__(self, hass: HomeAssistant, address: Optional[str] = None):
        self.hass = hass
        self.address = address
        self._client = SkellyClient(address=address)

    async def connect(self, attempts: int = 3, backoff: float = 1.0) -> bool:
        """Connect using HA's bluetooth helpers when possible, with retries.

        Attempts to retrieve a BLE device from HA and connect. Retries on
        transient errors with exponential backoff. Returns True on success,
        False on failure.
        """
        last_exc: Optional[Exception] = None

        for attempt in range(1, attempts + 1):
            try:
                if self.address:
                    try:
                        ble_device = await bluetooth.async_ble_device_from_address(self.hass, self.address)
                    except Exception as exc:
                        _LOGGER.debug("HA bluetooth helper couldn't resolve address %s: %s", self.address, exc)
                        ble_device = None

                    if ble_device:
                        bleak_client = BleakClient(ble_device)
                        ok = await self._client.connect(client=bleak_client, start_notify=True)
                        if ok:
                            _LOGGER.debug("Connected to Skelly device at %s on attempt %d", self.address, attempt)
                            return True
                        else:
                            _LOGGER.warning("SkellyClient.connect returned False for %s on attempt %d", self.address, attempt)

                # Fallback to library discovery/connect
                ok = await self._client.connect()
                if ok:
                    _LOGGER.debug("SkellyClient connected via internal discovery on attempt %d", attempt)
                    return True

            except Exception as exc:  # broad catch so we can retry
                last_exc = exc
                _LOGGER.warning("Attempt %d to connect to Skelly device failed: %s", attempt, exc)

            # Backoff before retrying
            if attempt < attempts:
                sleep_for = backoff * (2 ** (attempt - 1))
                _LOGGER.debug("Retrying in %.1f seconds...", sleep_for)
                try:
                    await asyncio.sleep(sleep_for)
                except asyncio.CancelledError:
                    raise

        # All attempts exhausted
        if last_exc:
            _LOGGER.error("All connection attempts failed: %s", last_exc)
        else:
            _LOGGER.error("All connection attempts failed (no exception available)")
        return False

    async def disconnect(self) -> None:
        await self._client.disconnect()

    @property
    def client(self) -> SkellyClient:
        return self._client

    # delegate common calls for convenience
    async def get_volume(self, timeout: float = 2.0):
        return await self._client.get_volume(timeout=timeout)
