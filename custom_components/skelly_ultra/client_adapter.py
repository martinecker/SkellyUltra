"""Adapter that wraps skelly_ultra_pkg.client.SkellyClient for Home Assistant.

This keeps the HA integration code separate from the library internals.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from bleak import BleakClient

from homeassistant.components import bluetooth
from homeassistant.core import HomeAssistant

from .skelly_ultra_pkg.client import SkellyClient

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
                        else:
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
                _LOGGER.debug("Retrying in %.1f seconds...", sleep_for)
                await asyncio.sleep(sleep_for)

        # All attempts exhausted
        if last_exc:
            _LOGGER.error("All connection attempts failed: %s", last_exc)
        else:
            _LOGGER.error("All connection attempts failed (no exception available)")
        return False

    async def disconnect(self) -> None:
        _LOGGER.info("Disconnecting Skelly adapter/client")
        try:
            await self._client.disconnect()
        except Exception:
            _LOGGER.exception("Error while disconnecting Skelly client")

    @property
    def client(self) -> SkellyClient:
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
