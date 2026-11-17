"""File transfer manager for Skelly Ultra devices.

Handles async file uploads to the device using the BLE file transfer protocol.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import logging
from typing import TYPE_CHECKING, Any

from . import parser

if TYPE_CHECKING:
    from .client import SkellyClient
    from .events import EventStream

logger = logging.getLogger(__name__)

# The device's replies during a file transfer
_TRANSFER_EVENTS = (
    parser.StartTransferEvent,
    parser.ChunkDroppedEvent,
    parser.TransferEndEvent,
    parser.TransferCancelEvent,
    parser.TransferConfirmEvent,
    parser.ResumeWriteEvent,
)


def _is_transfer_event(event: Any) -> bool:
    return isinstance(event, _TRANSFER_EVENTS)


def _is_failed_end(event: Any) -> bool:
    return isinstance(event, parser.TransferEndEvent) and event.failed != 0


def _is_chunk_report(event: Any) -> bool:
    return isinstance(event, parser.ChunkDroppedEvent)


class _Losses:
    """The device's loss reports (BBC1 lost = 1) during one attempt."""

    def __init__(self) -> None:
        self.count = 0  # loss reports, repeats not counted
        self.pending: int | None = None  # resend from here, not yet done
        self.last_index: int | None = None  # index of the latest report
        self._last_time = 0.0

    def note(self, event: parser.ChunkDroppedEvent, now: float, window: float) -> bool:
        """Take one BBC1; returns whether it is a new loss report.

        lost = 0 means no loss (the app ignores it too). A repeat of the
        latest report within window seconds counts once, like in the app.
        """
        if event.dropped == 0:
            return False
        if event.index == self.last_index and now - self._last_time < window:
            return False
        self.count += 1
        self.pending = self.last_index = event.index
        self._last_time = now
        return True


class FileTransferError(Exception):
    """Base exception for file transfer errors."""


class FileTransferCancelled(FileTransferError):
    """Exception raised when transfer is cancelled."""


class FileTransferTimeout(FileTransferError):
    """Exception raised when transfer times out."""


class InsufficientSpaceError(FileTransferError):
    """The device doesn't have room for the file."""


@dataclass
class TransferState:
    """Track file transfer state."""

    in_progress: bool = False
    cancelled: bool = False
    total_chunks: int = 0
    sent_chunks: int = 0
    filename: str = ""
    chunk_size: int = 0  # Actual chunk size used for this transfer

    @property
    def progress_percent(self) -> int:
        """Calculate progress percentage."""
        if self.total_chunks == 0:
            return 0
        return int((self.sent_chunks / self.total_chunks) * 100)


class FileTransferManager:
    """Manage file transfers to Skelly device.

    This manager implements the file transfer protocol:
    1. C0 (start_send_data): Initialize transfer with size, chunk count, filename
    2. C1 (send_data_chunk): Send data chunks with index
    3. C2 (end_send_data): Signal end of data transfer
    4. C3 (confirm_file): Confirm and commit the file

    The device responds with:
    - BBC0: Start acknowledgment (includes resume info if applicable)
    - BBC1: Chunk dropped notification (optional)
    - BBC2: End acknowledgment (may indicate retry needed)
    - BBC3: Final confirmation
    """

    # Protocol constants
    # Smallest chunk: what fits the smallest BLE MTU (23 - CHUNK_OVERHEAD)
    MIN_CHUNK_SIZE = 15
    MAX_CHUNK_SIZE = 500  # Maximum bytes per chunk
    DEFAULT_CHUNK_SIZE = 250  # Conservative default for unknown MTU
    # MTU bytes a chunk can't use: the ATT write header (3) and the C1 frame
    # around the data (AA C1, index u16, CRC: 5). Same as the phone app.
    CHUNK_OVERHEAD = 8
    TIMEOUT_START = 5.0  # seconds to wait for BBC0
    TIMEOUT_END_MIN = 5.0  # minimum seconds to wait for BBC2
    TIMEOUT_END_PER_KB = 0.4  # seconds per kilobyte of file size
    TIMEOUT_CONFIRM = 5.0  # seconds to wait for BBC3
    TIMEOUT_CAPACITY = 2.0  # seconds to wait for BBD2
    # Pause between chunks, like the phone app's 100 ms; can be overridden
    DEFAULT_CHUNK_DELAY_MS = 100
    MIN_CHUNK_DELAY_MS = 10
    MAX_CHUNK_DELAY_MS = 1000
    # Lost chunks, handled like the phone app: after a loss report (BBC1
    # lost = 1) stop, wait LOSS_WAIT then RESUME_WAIT (a new report starts the
    # wait over), and resend from the reported chunk. A failed BBC2 is handled
    # the same way, followed by C2 again. Too many of either: the attempt
    # fails and the transfer starts over with smaller chunks.
    LOSS_WAIT = 1.0
    RESUME_WAIT = 2.0
    REPEAT_WINDOW = 1.0  # repeats of a report within this count once
    MAX_LOSSES = 10  # the app gives up after 10 loss reports
    MAX_FAILED_ENDS = 3  # failed BBC2s before the attempt counts as failed

    def __init__(self) -> None:
        """Initialize the file transfer manager."""
        self._state = TransferState()
        self._lock = asyncio.Lock()
        self._chunk_cache: dict[int, bytes] = {}
        self._chunk_delay_ms = self.DEFAULT_CHUNK_DELAY_MS

    @staticmethod
    def calculate_chunk_size_from_mtu(mtu: int) -> int:
        """Calculate optimal chunk size from MTU value.

        A whole C1 frame then fills one write (MTU - 3 bytes), as in the
        phone app. A bigger frame doesn't fit and gets lost.

        Args:
            mtu: The negotiated BLE (ATT) MTU in bytes

        Returns:
            Optimal chunk size in bytes, constrained to valid range
        """
        chunk_size = min(
            mtu - FileTransferManager.CHUNK_OVERHEAD,
            FileTransferManager.MAX_CHUNK_SIZE,
        )
        return max(chunk_size, FileTransferManager.MIN_CHUNK_SIZE)

    async def get_chunk_size(
        self,
        client: SkellyClient,
        override_size: int | None = None,
    ) -> int:
        """Calculate optimal chunk size based on BLE MTU or use override value.

        Args:
            client: The BLE client to query for MTU
            override_size: Optional manual chunk size override (15-500 bytes)

        Returns:
            Optimal chunk size in bytes
        """
        if override_size is not None:
            if self.MIN_CHUNK_SIZE <= override_size <= self.MAX_CHUNK_SIZE:
                logger.info("Using user override chunk size: %d bytes", override_size)
                return override_size
            logger.warning(
                "Override chunk size %d out of range (%d-%d), using default",
                override_size,
                self.MIN_CHUNK_SIZE,
                self.MAX_CHUNK_SIZE,
            )

        # Try to use MTU-based chunk size if available
        mtu = await client.get_mtu_size()
        if mtu and mtu > 0:
            chunk_size = self.calculate_chunk_size_from_mtu(mtu)
            logger.debug(
                "Using MTU-based chunk size: %d bytes (MTU: %d)",
                chunk_size,
                mtu,
            )
            return chunk_size

        logger.debug("Using default chunk size: %d bytes", self.DEFAULT_CHUNK_SIZE)
        return self.DEFAULT_CHUNK_SIZE

    def get_chunk_delay_ms(self, override_ms: int | None = None) -> int:
        """Return the pause between chunks: the override if valid, else 100 ms."""
        if override_ms is not None:
            if self.MIN_CHUNK_DELAY_MS <= override_ms <= self.MAX_CHUNK_DELAY_MS:
                logger.info("Using user override chunk delay: %d ms", override_ms)
                return override_ms
            logger.warning(
                "Override chunk delay %d ms out of range (%d-%d), using default",
                override_ms,
                self.MIN_CHUNK_DELAY_MS,
                self.MAX_CHUNK_DELAY_MS,
            )
        return self.DEFAULT_CHUNK_DELAY_MS

    @staticmethod
    def needed_kb(size: int) -> int:
        """Return the KB a file of size bytes needs, as the phone app counts.

        The device reports free space in KB. The app divides by 1000; if the
        device's KB are 1024 bytes, that overestimates a little, which is safe.
        """
        return -(-size // 1000)

    async def _check_free_space(self, client: SkellyClient, size: int) -> None:
        """Refuse the upload if the device has no room for it, like the app.

        Runs for overwrites too. If the device doesn't report its free space,
        the upload goes ahead.
        """
        try:
            capacity = await client.get_capacity(timeout=self.TIMEOUT_CAPACITY)
        except Exception as err:  # noqa: BLE001 - don't block uploads on it
            logger.warning("Couldn't read the free space, uploading anyway: %r", err)
            return
        needed = self.needed_kb(size)
        logger.debug(
            "Free space: %d KB, the file needs %d KB", capacity.capacity_kb, needed
        )
        # Same test as the app: the file must need less than what's free
        if needed >= capacity.capacity_kb:
            raise InsufficientSpaceError(
                f"Not enough space on the device: the file needs {needed} KB, "
                f"{capacity.capacity_kb} KB are free. Delete files to make room."
            )

    @property
    def state(self) -> TransferState:
        """Get current transfer state (read-only copy)."""
        return TransferState(
            in_progress=self._state.in_progress,
            cancelled=self._state.cancelled,
            total_chunks=self._state.total_chunks,
            sent_chunks=self._state.sent_chunks,
            filename=self._state.filename,
            chunk_size=self._state.chunk_size,
        )

    async def send_file(
        self,
        client: SkellyClient,
        file_data: bytes,
        filename: str,
        progress_callback: Callable[[int, int], None] | None = None,
        override_chunk_size: int | None = None,
        override_chunk_delay_ms: int | None = None,
    ) -> None:
        """Send file to device with progress tracking.

        Args:
            client: Connected SkellyClient instance
            file_data: Raw file data as bytes
            filename: Target filename on device
            progress_callback: Optional callback(sent_chunks, total_chunks)
            override_chunk_size: Optional user-specified chunk size (bypasses MTU calculation)
            override_chunk_delay_ms: Optional user-specified pause between chunks

        Raises:
            FileTransferError: On transfer failure
            InsufficientSpaceError: If the device has no room for the file
            FileTransferCancelled: If cancelled
            FileTransferTimeout: If device doesn't respond
            RuntimeError: If client is not connected or transfer already in progress
        """
        async with self._lock:
            if self._state.in_progress:
                raise RuntimeError("Transfer already in progress")

            # Initialize state
            self._state.in_progress = True
            self._state.cancelled = False
            self._state.filename = filename
            self._state.sent_chunks = 0
            self._state.total_chunks = 0
            self._chunk_cache.clear()
            self._chunk_delay_ms = self.get_chunk_delay_ms(override_chunk_delay_ms)

            try:
                await self._check_free_space(client, len(file_data))
                await self._do_transfer(
                    client,
                    file_data,
                    filename,
                    progress_callback,
                    override_chunk_size,
                )
                logger.info("File transfer complete: %s", filename)
            except FileTransferCancelled:
                logger.warning("File transfer cancelled: %s", filename)
                raise
            except Exception as exc:
                logger.error("File transfer failed: %s - %s", filename, exc)
                raise
            finally:
                self._state.in_progress = False
                self._chunk_cache.clear()

    async def cancel(self, client: SkellyClient) -> None:
        """Cancel ongoing transfer.

        Args:
            client: SkellyClient instance to send cancel command

        Note:
            Sets cancellation flag and sends C4 (cancel_send) to device.
        """
        if not self._state.in_progress:
            logger.debug("No transfer in progress to cancel")
            return

        logger.info("Cancelling file transfer: %s", self._state.filename)
        self._state.cancelled = True

        try:
            await client.cancel_send()
        except Exception:
            logger.exception("Error sending cancel command to device")

    async def _do_transfer(
        self,
        client: SkellyClient,
        file_data: bytes,
        filename: str,
        progress_callback: Callable[[int, int], None] | None,
        override_chunk_size: int | None = None,
        retry_count: int = 0,
        retry_chunk_size: int | None = None,
    ) -> None:
        """Execute the file transfer protocol.

        Args:
            client: Connected SkellyClient
            file_data: File content as bytes
            filename: Target filename on device
            progress_callback: Optional progress callback
            override_chunk_size: Optional user-specified chunk size
            retry_count: Internal retry counter for smaller chunk sizes
            retry_chunk_size: Chunk size from previous retry (for progressive reduction)

        Raises:
            FileTransferCancelled: If cancelled during transfer
            FileTransferTimeout: If device doesn't respond
            FileTransferError: On protocol errors
        """
        # On retry, use half the previous chunk size
        if retry_count > 0 and retry_chunk_size is not None:
            chunk_size = max(self.MIN_CHUNK_SIZE, retry_chunk_size // 2)
            logger.warning(
                "Retrying transfer with reduced chunk size: %d bytes (attempt %d, was %d)",
                chunk_size,
                retry_count + 1,
                retry_chunk_size,
            )
        else:
            # First attempt - determine optimal chunk size based on BLE MTU or user override
            chunk_size = await self.get_chunk_size(client, override_chunk_size)

        self._state.chunk_size = chunk_size

        size = len(file_data)
        chunk_count = (size + chunk_size - 1) // chunk_size  # Ceiling division
        self._state.total_chunks = chunk_count

        logger.info(
            "Starting file transfer: %s (%d bytes, %d chunks of %d bytes)",
            filename,
            size,
            chunk_count,
            chunk_size,
        )

        # Give the device a moment to answer earlier requests (e.g. from the
        # coordinator); only replies that come after that count
        await asyncio.sleep(0.1)

        # Pre-cache all chunks before sending (needed for retry if BBC2 arrives early)
        logger.debug("Pre-caching all %d chunks for potential retry...", chunk_count)
        for idx in range(chunk_count):
            offset = idx * chunk_size
            chunk_data = file_data[offset : offset + chunk_size]
            self._chunk_cache[idx] = chunk_data

        with client.subscribe(_is_transfer_event) as events:
            failed = await self._attempt(
                client,
                events,
                file_data,
                filename,
                chunk_size,
                progress_callback,
            )
        if not failed:
            return None

        # Restart transfer with smaller chunk size (max 2 retries)
        if retry_count >= 2:
            await client.cancel_send()
            raise FileTransferError(
                "Transfer failed after 3 attempts with progressively smaller chunks",
            )

        logger.warning(
            "Transfer failed, restarting with smaller chunk size (retry %d/2)...",
            retry_count + 1,
        )
        # Cancel current transfer and restart
        await client.cancel_send()
        await asyncio.sleep(1.0)  # Give device time to reset
        if self._state.cancelled:
            raise FileTransferCancelled("Transfer cancelled by user")

        # Recursive retry with smaller chunks - pass current chunk_size for progressive halving
        # Don't pass override_chunk_size to retry - we want to use the calculated smaller size
        return await self._do_transfer(
            client,
            file_data,
            filename,
            progress_callback,
            None,  # Clear override on retry - use retry_chunk_size instead
            retry_count + 1,
            chunk_size,  # Pass current size so next retry halves it
        )

    async def _attempt(
        self,
        client: SkellyClient,
        events: EventStream,
        file_data: bytes,
        filename: str,
        chunk_size: int,
        progress_callback: Callable[[int, int], None] | None,
    ) -> bool:
        """Send the file once, in chunks of chunk_size.

        events has the device's replies. Returns True if the device reported
        the transfer failed (the caller retries with smaller chunks).
        """
        size = len(file_data)
        chunk_count = self._state.total_chunks

        # Phase 1: Start transfer (C0)
        await client.start_send_data(size, chunk_count, filename)
        start_event = await self._wait_for_event(
            events,
            parser.StartTransferEvent,
            self.TIMEOUT_START,
            "BBC0",
        )

        if start_event.failed != 0:
            raise FileTransferError(
                f"Device rejected start transfer (failed={start_event.failed})",
            )

        # Check if device wants to resume from previous transfer
        start_index = start_event.written // chunk_size
        if start_index > 0:
            logger.info(
                "Resuming transfer from chunk %d (device had %d bytes)",
                start_index,
                start_event.written,
            )
            self._state.sent_chunks = start_index

        # Phases 2 and 3: send the chunks (C1) and end (C2), resending after
        # losses until the device has all of them
        if not await self._send_until_received(
            client, events, file_data, start_index, chunk_size, progress_callback
        ):
            return True

        # Phase 4: Confirm file (C3)
        await client.confirm_file(filename)
        confirm_event = await self._wait_for_event(
            events,
            parser.TransferConfirmEvent,
            self.TIMEOUT_CONFIRM,
            "BBC3",
        )

        if confirm_event.failed != 0:
            raise FileTransferError(
                f"Device failed final confirmation (failed={confirm_event.failed})",
            )

        logger.info("File transfer confirmed by device: %s", filename)
        return False

    async def _send_until_received(
        self,
        client: SkellyClient,
        events: EventStream,
        file_data: bytes,
        start_index: int,
        chunk_size: int,
        progress_callback: Callable[[int, int], None] | None,
    ) -> bool:
        """Send the chunks from start_index on, then C2, until BBC2 says ok.

        Returns False if the device kept losing chunks (more than MAX_LOSSES
        loss reports, or MAX_FAILED_ENDS failed BBC2s).
        """
        losses = _Losses()
        failed_ends = 0
        index = start_index
        while True:
            if not await self._send_chunks(
                client, events, losses, file_data, index, chunk_size, progress_callback
            ):
                return False

            # The device may have ended the transfer early (failed); else C2
            end_event = events.take_nowait(_is_failed_end)
            if end_event is None:
                await client.end_send_data()
                end_event = await self._wait_for_end(
                    events, self._end_timeout(len(file_data))
                )
            if end_event.failed == 0:
                return True

            failed_ends += 1
            # Like the app: resend from the last lost chunk. Without a loss
            # report nobody knows what is missing, so all of it.
            self._take_chunk_reports(events, losses)
            index = losses.last_index or 0
            logger.warning(
                "Device reported transfer failed (failed=%d, %d/%d); "
                "resending from chunk %d",
                end_event.failed,
                failed_ends,
                self.MAX_FAILED_ENDS,
                index,
            )
            if failed_ends >= self.MAX_FAILED_ENDS:
                return False
            losses.pending = index
            index = await self._wait_out_losses(events, losses)
            if index is None:
                return False
            # A BBC2 still buffered now answers an earlier C2 (e.g. one that
            # crossed an early failed BBC2); don't take it for this round's
            while events.take_nowait(lambda e: isinstance(e, parser.TransferEndEvent)):
                logger.debug("Dropping a BBC2 from the previous round")

    async def _wait_for_end(
        self, events: EventStream, timeout: float
    ) -> parser.TransferEndEvent:
        """Wait for the BBC2 that answers C2.

        Unlike _wait_for_event, BBC1s that come first stay buffered: a loss
        reported now says where to resend from.
        """
        logger.debug("Waiting for BBC2 (timeout=%.1fs)", timeout)
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while True:
            end_event = events.take_nowait(
                lambda e: isinstance(e, parser.TransferEndEvent)
            )
            if end_event is not None:
                logger.debug("Received BBC2: %s", end_event)
                return end_event
            if self._state.cancelled:
                raise FileTransferCancelled(
                    "Transfer cancelled while waiting for response",
                )
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise FileTransferTimeout(f"Timeout waiting for BBC2 after {timeout}s")
            await asyncio.sleep(min(0.05, remaining))

    def _end_timeout(self, size: int) -> float:
        """Seconds to wait for BBC2: longer for bigger files."""
        file_size_kb = size / 1024
        timeout_end = max(
            self.TIMEOUT_END_MIN,
            self.TIMEOUT_END_MIN + (file_size_kb * self.TIMEOUT_END_PER_KB),
        )
        logger.debug(
            "Using BBC2 timeout of %.1fs for %d KB file", timeout_end, int(file_size_kb)
        )
        return timeout_end

    def _take_chunk_reports(self, events: EventStream, losses: _Losses) -> bool:
        """Note the buffered BBC1s; returns whether one was a new loss."""
        now = asyncio.get_running_loop().time()
        new = False
        while report := events.take_nowait(_is_chunk_report):
            if losses.note(report, now, self.REPEAT_WINDOW):
                new = True
                logger.warning(
                    "Device lost chunk %d (loss %d/%d)",
                    report.index,
                    losses.count,
                    self.MAX_LOSSES,
                )
            else:
                logger.debug("Chunk report: %s", report)
        return new

    async def _wait_out_losses(
        self, events: EventStream, losses: _Losses
    ) -> int | None:
        """Pause after a loss like the app, then return where to resend from.

        The pause is LOSS_WAIT + RESUME_WAIT after the latest new loss report.
        Returns None after more than MAX_LOSSES reports.
        """
        loop = asyncio.get_running_loop()
        resume_at = loop.time() + self.LOSS_WAIT + self.RESUME_WAIT
        while True:
            if losses.count > self.MAX_LOSSES:
                logger.warning("Device lost %d chunks; giving up", losses.count)
                return None
            if self._state.cancelled:
                raise FileTransferCancelled("Transfer cancelled by user")
            remaining = resume_at - loop.time()
            if remaining <= 0:
                break
            await asyncio.sleep(min(0.1, remaining))
            if self._take_chunk_reports(events, losses):
                resume_at = loop.time() + self.LOSS_WAIT + self.RESUME_WAIT
        index = losses.pending if losses.pending is not None else 0
        losses.pending = None
        logger.info("Resending from chunk %d", index)
        return index

    async def _send_chunks(
        self,
        client: SkellyClient,
        events: EventStream,
        losses: _Losses,
        file_data: bytes,
        start_index: int,
        chunk_size: int,
        progress_callback: Callable[[int, int], None] | None,
    ) -> bool:
        """Send data chunks from start_index on, going back after a loss.

        Stops early when the device ends the transfer as failed (the failed
        BBC2 stays buffered). Returns False after more than MAX_LOSSES loss
        reports.

        Raises:
            FileTransferCancelled: If cancelled during send
        """
        chunk_count = self._state.total_chunks
        idx = start_index
        while True:
            if self._state.cancelled:
                raise FileTransferCancelled("Transfer cancelled by user")

            # The device may end the transfer as failed while chunks are
            # still being sent; the caller handles that
            if events.has(_is_failed_end):
                logger.warning(
                    "Received early BBC2; stopping chunk transmission at %d", idx
                )
                return True

            self._take_chunk_reports(events, losses)
            if losses.pending is not None:
                resume = await self._wait_out_losses(events, losses)
                if resume is None:
                    return False
                idx = resume
                continue

            if idx >= chunk_count:
                break

            # Get chunk from cache (pre-cached before sending started)
            chunk_data = self._chunk_cache.get(idx)
            if chunk_data is None:
                # Fallback: calculate from file data if not in cache
                offset = idx * chunk_size
                chunk_data = file_data[offset : offset + chunk_size]

            await client.send_data_chunk(idx, chunk_data)
            idx += 1

            # Update progress
            self._state.sent_chunks = idx
            if progress_callback:
                try:
                    progress_callback(self._state.sent_chunks, self._state.total_chunks)
                except Exception:
                    logger.exception("Error in progress callback")

            # Pace the chunks: the device loses them when they come too fast
            await asyncio.sleep(self._chunk_delay_ms / 1000)

        logger.debug("All %d chunks sent", chunk_count)
        return True

    async def _wait_for_event(
        self,
        events: EventStream,
        event_type: type,
        timeout: float,
        event_name: str,
    ) -> Any:
        """Wait for the next event_type event of this transfer.

        Other transfer events that come first are skipped (logged).

        Args:
            events: The device's replies during this transfer
            event_type: Expected event dataclass type
            timeout: Timeout in seconds
            event_name: Event name for logging

        Returns:
            The received event

        Raises:
            FileTransferTimeout: If event not received within timeout
            FileTransferCancelled: If cancelled while waiting
        """
        logger.debug("Waiting for %s (timeout=%.1fs)", event_name, timeout)
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        # Transfers don't watch the connection: a drop shows as a timeout
        never = asyncio.Event()

        while True:
            if self._state.cancelled:
                raise FileTransferCancelled(
                    "Transfer cancelled while waiting for response",
                )
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise FileTransferTimeout(
                    f"Timeout waiting for {event_name} after {timeout}s",
                )
            try:
                # Short waits, so a cancel is noticed quickly
                event = await events.next(min(0.1, remaining), never)
            except TimeoutError:
                continue
            if isinstance(event, event_type):
                logger.debug("Received %s: %s", event_name, event)
                return event
            logger.debug(
                "Received unexpected event type %s while waiting for %s",
                type(event).__name__,
                event_name,
            )
