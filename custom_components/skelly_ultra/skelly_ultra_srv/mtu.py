"""Reading a BLE connection's negotiated MTU."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

_LOGGER = logging.getLogger(__name__)

# Seconds to wait for BlueZ to report the negotiated MTU
ACQUIRE_MTU_TIMEOUT = 5


async def acquire_mtu(client: Any) -> None:
    """Read the negotiated MTU on backends that need it (BlueZ).

    On Linux, Bleak's mtu_size is the default of 23 until the negotiated MTU
    has been read with the backend's _acquire_mtu(). Other backends know it
    already. If reading fails, the connection is kept with the default.
    """
    backend = getattr(client, "_backend", None)
    acquire = getattr(backend, "_acquire_mtu", None)
    if acquire is None or getattr(backend, "_mtu_size", None) is not None:
        return
    try:
        # The D-Bus call has no timeout of its own
        async with asyncio.timeout(ACQUIRE_MTU_TIMEOUT):
            await acquire()
    except Exception as err:  # noqa: BLE001 - keep the connection, use the default
        _LOGGER.warning("Could not read the negotiated MTU, using 23: %s", err)
