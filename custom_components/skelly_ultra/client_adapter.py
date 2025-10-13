"""Adapter that wraps skelly_ultra_pkg.client.SkellyClient for Home Assistant.

This keeps the HA integration code separate from the library internals.
"""
from __future__ import annotations

from typing import Optional
import asyncio

from skelly_ultra_pkg.client import SkellyClient


class SkellyClientAdapter:
    def __init__(self, address: Optional[str] = None):
        self._client = SkellyClient(address=address)

    async def connect(self) -> bool:
        return await self._client.connect()

    async def disconnect(self) -> None:
        await self._client.disconnect()

    @property
    def client(self) -> SkellyClient:
        return self._client

    # delegate common calls for convenience
    async def get_volume(self, timeout: float = 2.0):
        return await self._client.get_volume(timeout=timeout)
