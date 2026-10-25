"""Serialize BlueZ discovery calls made by this process.

BlueZ (checked against 5.82, src/adapter.c) remembers only one pending
StartDiscovery/StopDiscovery per adapter (adapter->client). If a second
D-Bus client's request arrives while one is pending, only the later one is
ever answered. The earlier client keeps a request BlueZ never finishes and
from then on gets org.bluez.Error.InProgress for every StartDiscovery and
StopDiscovery on that adapter, until its D-Bus connection closes.

The BLE scanner (bleak) and the classic scanner use separate D-Bus
connections and both start and stop discovery on all adapters, so every
discovery call goes through run_discovery_call().
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

_T = TypeVar("_T")

DISCOVERY_CALL_TIMEOUT = 10.0

_DISCOVERY_LOCK = asyncio.Lock()


class DiscoveryTimeoutError(TimeoutError, RuntimeError):
    """A discovery call got no answer in time.

    Also a RuntimeError, which the managers' callers turn into an error
    response.
    """

_pending: set[asyncio.Task] = set()


def _on_call_done(task: asyncio.Task) -> None:
    _pending.discard(task)
    if not task.cancelled():
        # Retrieved here so a call whose caller gave up doesn't log
        # "exception was never retrieved"
        task.exception()


async def run_discovery_call(
    call: Callable[[], Awaitable[_T]],
    timeout: float = DISCOVERY_CALL_TIMEOUT,
    *,
    run_if_abandoned: bool = True,
) -> _T:
    """Run one discovery call, never at the same time as another one.

    The call runs in its own task, which keeps the lock until BlueZ has
    answered (or `timeout` has passed), even if the caller is cancelled
    meanwhile. Raises DiscoveryTimeoutError if the call itself takes longer
    than `timeout`; waiting for the lock doesn't count.

    run_if_abandoned: whether to still make the call if the caller was
    cancelled while it waited for the lock. Pass False for starts, which
    nobody would stop then; stops should still run.
    """
    abandoned = asyncio.Event()

    async def locked_call() -> _T:
        async with _DISCOVERY_LOCK:
            if abandoned.is_set() and not run_if_abandoned:
                raise asyncio.CancelledError
            try:
                async with asyncio.timeout(timeout):
                    return await call()
            except TimeoutError as exc:
                raise DiscoveryTimeoutError(
                    f"BlueZ discovery call got no answer within {timeout:.0f} s"
                ) from exc

    task = asyncio.ensure_future(locked_call())
    _pending.add(task)
    task.add_done_callback(_on_call_done)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        abandoned.set()
        raise
