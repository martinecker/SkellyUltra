"""File transfer manager for Skelly Ultra devices.

Handles async file uploads to the device using the BLE file transfer protocol.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import logging
from typing import TYPE_CHECKING, Any
import warnings

from . import parser

if TYPE_CHECKING:
    from .client import SkellyClient

logger = logging.getLogger(__name__)


class FileTransferError(Exception):
    """Base exception for file transfer errors."""


class FileTransferCancelled(FileTransferError):
    """Exception raised when transfer is cancelled."""


class FileTransferTimeout(FileTransferError):
    """Exception raised when transfer times out."""


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
    MIN_CHUNK_SIZE = 20  # Minimum bytes per chunk
    MAX_CHUNK_SIZE = 500  # Maximum bytes per chunk
    DEFAULT_CHUNK_SIZE = 250  # Conservative default for unknown MTU
    ATT_OVERHEAD = 3  # ATT protocol overhead bytes
    TIMEOUT_START = 5.0  # seconds to wait for BBC0
    TIMEOUT_END = 60.0  # seconds to wait for BBC2 (long for large files)
    TIMEOUT_CONFIRM = 3.0  # seconds to wait for BBC3
    CHUNK_DELAY = 0.05  # seconds between chunks (50ms)

    def __init__(self) -> None:
        """Initialize the file transfer manager."""
        self._state = TransferState()
        self._lock = asyncio.Lock()
        self._chunk_cache: dict[int, bytes] = {}

    def get_chunk_size(
        self, client: SkellyClient, override_size: int | None = None
    ) -> int:
        """Calculate optimal chunk size based on BLE MTU or use override value.

        Args:
            client: The BLE client to query for MTU
            override_size: Optional manual chunk size override (50-500 bytes)

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
        if client.client and hasattr(client.client, "_mtu_size"):
            try:
                # Access the private _mtu_size attribute directly to check if MTU is set
                # Suppress the Bleak warning about using default MTU
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", message="Using default MTU value")
                    mtu = client.client._mtu_size  # noqa: SLF001
                if mtu and mtu > 0:
                    # Account for ATT protocol overhead
                    chunk_size = min(mtu - self.ATT_OVERHEAD, self.MAX_CHUNK_SIZE)
                    logger.info(
                        "Using MTU-based chunk size: %d bytes (MTU: %d)",
                        chunk_size,
                        mtu,
                    )
                    return max(chunk_size, self.MIN_CHUNK_SIZE)
            except (AttributeError, TypeError):
                # MTU not available or not valid, fall through to default
                pass

        logger.debug("Using default chunk size: %d bytes", self.DEFAULT_CHUNK_SIZE)
        return self.DEFAULT_CHUNK_SIZE

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
    ) -> None:
        """Send file to device with progress tracking.

        Args:
            client: Connected SkellyClient instance
            file_data: Raw file data as bytes
            filename: Target filename on device
            progress_callback: Optional callback(sent_chunks, total_chunks)
            override_chunk_size: Optional user-specified chunk size (bypasses MTU calculation)

        Raises:
            FileTransferError: On transfer failure
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

            try:
                await self._do_transfer(
                    client, file_data, filename, progress_callback, override_chunk_size
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
            chunk_size = self.get_chunk_size(client, override_chunk_size)

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

        # Phase 1: Start transfer (C0)
        await client.start_send_data(size, chunk_count, filename)
        start_event = await self._wait_for_event(
            client, parser.StartTransferEvent, self.TIMEOUT_START, "BBC0"
        )

        if start_event.failed != 0:
            raise FileTransferError(
                f"Device rejected start transfer (failed={start_event.failed})"
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

        # Pre-cache all chunks before sending (needed for retry if BBC2 arrives early)
        logger.debug("Pre-caching all %d chunks for potential retry...", chunk_count)
        for idx in range(chunk_count):
            offset = idx * chunk_size
            chunk_data = file_data[offset : offset + chunk_size]
            self._chunk_cache[idx] = chunk_data

        # Phase 2: Send data chunks (C1)
        await self._send_chunks(
            client, file_data, start_index, chunk_count, chunk_size, progress_callback
        )

        # Phase 3: End transfer (C2)
        await client.end_send_data()
        end_event = await self._wait_for_event(
            client, parser.TransferEndEvent, self.TIMEOUT_END, "BBC2"
        )

        # Handle failed transfer - restart with smaller chunks
        if end_event.failed != 0:
            logger.warning(
                "Device reported transfer failed (failed=%d, last_chunk_index=%d)",
                end_event.failed,
                end_event.last_chunk_index,
            )

            # Log any ChunkDroppedEvents for debugging, but don't act on them
            await asyncio.sleep(0.2)  # Wait for any pending events
            while not client.events.empty():
                try:
                    event = client.events.get_nowait()
                    if isinstance(event, parser.ChunkDroppedEvent):
                        logger.info(
                            "ChunkDroppedEvent reported for chunk %d (informational only)",
                            event.index,
                        )
                    else:
                        # Put non-ChunkDropped events back
                        await client.events.put(event)
                        break
                except asyncio.QueueEmpty:
                    break

            # Restart transfer with smaller chunk size (max 2 retries)
            if retry_count >= 2:
                raise FileTransferError(
                    "Transfer failed after 3 attempts with progressively smaller chunks"
                )

            logger.warning(
                "Transfer failed, restarting with smaller chunk size (retry %d/2)...",
                retry_count + 1,
            )
            # Cancel current transfer and restart
            await client.cancel_send()
            await asyncio.sleep(1.0)  # Give device time to reset

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

        # Phase 4: Confirm file (C3)
        await client.confirm_file(filename)
        confirm_event = await self._wait_for_event(
            client, parser.ResumeWriteEvent, self.TIMEOUT_CONFIRM, "BBC3"
        )

        # BBC3 parser returns TransferConfirmEvent with 'failed' field
        if confirm_event.written != 0:
            raise FileTransferError(
                f"Device failed final confirmation (failed={confirm_event.failed})"
            )

        logger.info("File transfer confirmed by device: %s", filename)
        return None

    async def _send_chunks(
        self,
        client: SkellyClient,
        file_data: bytes,
        start_index: int,
        chunk_count: int,
        chunk_size: int,
        progress_callback: Callable[[int, int], None] | None,
    ) -> None:
        """Send data chunks to device.

        Args:
            client: SkellyClient instance
            file_data: Complete file data
            start_index: Chunk index to start from (for resume)
            chunk_count: Total number of chunks
            chunk_size: Size of each chunk in bytes
            progress_callback: Optional progress callback

        Raises:
            FileTransferCancelled: If cancelled during send
            FileTransferError: If BBC2 (TransferEndEvent) received early with failed=1
        """
        for idx in range(start_index, chunk_count):
            if self._state.cancelled:
                raise FileTransferCancelled("Transfer cancelled by user")

            # Check for early BBC2 (TransferEndEvent) in the queue
            # Device may send this during chunk transmission if it detects problems
            if not client.events.empty():
                try:
                    # Peek at next event without blocking
                    event = client.events.get_nowait()
                    if isinstance(event, parser.TransferEndEvent):
                        logger.warning(
                            "Received early BBC2 during chunk %d (failed=%d, last_chunk=%d)",
                            idx,
                            event.failed,
                            event.last_chunk_index,
                        )
                        # Put it back for later handling in Phase 3
                        await client.events.put(event)
                        # Stop sending more chunks - we'll handle retry in Phase 3
                        logger.info(
                            "Stopping chunk transmission at %d due to early BBC2", idx
                        )
                        return
                    # Not a TransferEndEvent, put it back
                    await client.events.put(event)
                except asyncio.QueueEmpty:
                    pass

            # Get chunk from cache (pre-cached before sending started)
            chunk_data = self._chunk_cache.get(idx)
            if not chunk_data:
                # Fallback: calculate from file data if not in cache
                offset = idx * chunk_size
                chunk_data = file_data[offset : offset + chunk_size]

            # Send chunk
            await client.send_data_chunk(idx, chunk_data)

            # Update progress
            self._state.sent_chunks = idx + 1
            if progress_callback:
                try:
                    progress_callback(self._state.sent_chunks, self._state.total_chunks)
                except Exception:
                    logger.exception("Error in progress callback")

            # Small delay to avoid overwhelming the device
            await asyncio.sleep(self.CHUNK_DELAY)

        logger.debug("All %d chunks sent", chunk_count)

    async def _wait_for_event(
        self,
        client: SkellyClient,
        event_type: type,
        timeout: float,
        event_name: str,
    ) -> Any:
        """Wait for specific event type from device.

        Args:
            client: SkellyClient instance
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
        start_time = asyncio.get_event_loop().time()

        while True:
            if self._state.cancelled:
                raise FileTransferCancelled(
                    "Transfer cancelled while waiting for response"
                )

            # Check if we've exceeded timeout
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                raise FileTransferTimeout(
                    f"Timeout waiting for {event_name} after {timeout}s"
                )

            # Try to get event from queue (non-blocking with short timeout)
            try:
                event = await asyncio.wait_for(client.events.get(), timeout=0.1)
                if isinstance(event, event_type):
                    logger.debug("Received %s: %s", event_name, event)
                    return event

                logger.debug(
                    "Received unexpected event type %s while waiting for %s",
                    type(event).__name__,
                    event_name,
                )
            except TimeoutError:
                # No event in queue, continue waiting
                continue
