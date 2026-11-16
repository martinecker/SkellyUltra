"""Routing of parsed device notifications to whoever is waiting for them.

The Skelly's replies carry no request ID: a reply is recognized by its type
alone. So instead of one shared queue that every waiter takes from (and puts
back what it didn't want), each waiter subscribes to the events it expects
before it sends its command, and gets its own copy of them, in order:

- EventStream: a subscription with its own buffer, for replies (one event,
  or several such as the file list or a file transfer's steps).
- Listeners: callbacks for events nobody asked for, e.g. PlaybackEvent.

An event that no stream and no listener wants is dropped, so a late reply
can't be taken for the answer to a later query (unless one of the same type
is already waiting: replies can't be told apart).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections import deque
from collections.abc import Callable, Iterator
from typing import Any

logger = logging.getLogger(__name__)


class ConnectionLostError(TimeoutError):
    """Raised to a caller waiting for a reply when the connection drops.

    Subclasses TimeoutError so existing callers that handle a reply timeout
    also handle this, just without waiting out the full timeout.
    """


class EventStream:
    """The events matching a subscription, buffered in arrival order."""

    def __init__(self, predicate: Callable[[Any], bool]) -> None:
        self.predicate = predicate
        self._events: deque[Any] = deque()
        self._changed = asyncio.Event()

    def _push(self, event: Any) -> None:
        self._events.append(event)
        self._changed.set()

    def clear(self) -> None:
        """Drop buffered events (e.g. ones from a connection that was lost)."""
        self._events.clear()

    def has(self, predicate: Callable[[Any], bool]) -> bool:
        """Return whether a buffered event matches predicate (it stays)."""
        return any(predicate(event) for event in self._events)

    def take_nowait(self, predicate: Callable[[Any], bool] | None = None) -> Any:
        """Return and remove the first buffered event (matching predicate).

        Returns None if there is none; other events stay buffered, in order.
        """
        for event in self._events:
            if predicate is None or predicate(event):
                self._events.remove(event)
                return event
        return None

    async def next(self, timeout: float, connection_lost: asyncio.Event) -> Any:
        """Return the next event.

        Raises TimeoutError after timeout seconds, or ConnectionLostError as
        soon as connection_lost (the waiter's connection) is set.
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while True:
            if connection_lost.is_set():
                # A reply that raced the drop belongs to the lost connection
                raise ConnectionLostError("Connection to device lost")
            if self._events:
                return self._events.popleft()
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise TimeoutError
            self._changed.clear()
            changed = asyncio.ensure_future(self._changed.wait())
            lost = asyncio.ensure_future(connection_lost.wait())
            try:
                await asyncio.wait(
                    (changed, lost),
                    timeout=remaining,
                    return_when=asyncio.FIRST_COMPLETED,
                )
            finally:
                changed.cancel()
                lost.cancel()


class EventDispatcher:
    """Hands each parsed notification to the streams and listeners for it."""

    def __init__(self) -> None:
        self._streams: list[EventStream] = []
        self._listeners: list[Callable[[Any], None]] = []
        self._reply_locks: dict[type, asyncio.Lock] = {}

    def dispatch(self, event: Any) -> None:
        """Deliver event to every listener and every stream that wants it."""
        for listener in list(self._listeners):
            try:
                listener(event)
            except Exception:
                logger.exception("Error in event listener for %s", event)
        wanted = False
        for stream in list(self._streams):
            try:
                if not stream.predicate(event):
                    continue
            except Exception:
                logger.exception("Error in event filter for %s", event)
                continue
            stream._push(event)
            wanted = True
        if wanted:
            logger.debug("Event delivered: %s", event)
        else:
            logger.debug("Event not awaited: %s", event)

    @contextlib.contextmanager
    def subscribe(self, predicate: Callable[[Any], bool]) -> Iterator[EventStream]:
        """Collect matching events from now on, until the block ends."""
        stream = EventStream(predicate)
        self._streams.append(stream)
        try:
            yield stream
        finally:
            self._streams.remove(stream)

    def add_listener(self, listener: Callable[[Any], None]) -> Callable[[], None]:
        """Call listener(event) for every event; returns a function to remove it.

        Listeners run inside the notification callback, so they must not block.
        """
        self._listeners.append(listener)

        def remove() -> None:
            with contextlib.suppress(ValueError):
                self._listeners.remove(listener)

        return remove

    def reply_lock(self, reply_type: type) -> asyncio.Lock:
        """The lock for queries answered by reply_type.

        Replies of one type can't be told apart, so two such queries must not
        wait at the same time.
        """
        return self._reply_locks.setdefault(reply_type, asyncio.Lock())

    def clear(self) -> None:
        """Drop events buffered for all streams (the connection was lost)."""
        for stream in self._streams:
            stream.clear()
