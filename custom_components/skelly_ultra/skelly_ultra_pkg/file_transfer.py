"""File transfer manager for Skelly Ultra devices.

Handles async file uploads to the device using the BLE file transfer protocol.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import logging
from typing import TYPE_CHECKING
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
    TIMEOUT_END = 240.0  # seconds to wait for BBC2 (long for large files)
    TIMEOUT_CONFIRM = 3.0  # seconds to wait for BBC3
    CHUNK_DELAY = 0.05  # seconds between chunks (50ms)
    DROPPED_CHUNK_CHECK_DELAY = (
        0.2  # seconds to wait after all chunks for dropped events
    )

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
    ) -> None:
        """Execute the file transfer protocol.

        Args:
            client: Connected SkellyClient
            file_data: File content as bytes
            filename: Target filename on device
            progress_callback: Optional progress callback
            override_chunk_size: Optional user-specified chunk size

        Raises:
            FileTransferCancelled: If cancelled during transfer
            FileTransferTimeout: If device doesn't respond
            FileTransferError: On protocol errors
        """
        # Determine optimal chunk size based on BLE MTU or user override
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

        # Phase 2: Send data chunks (C1)
        await self._send_chunks(
            client, file_data, start_index, chunk_count, chunk_size, progress_callback
        )

        # Phase 3: End transfer (C2)
        await client.end_send_data()
        end_event = await self._wait_for_event(
            client, parser.TransferEndEvent, self.TIMEOUT_END, "BBC2"
        )

        if end_event.failed != 0:
            logger.warning(
                "Device reported transfer end with failed=%d", end_event.failed
            )
            # Device may want us to retry some chunks
            # In the JavaScript implementation, it re-sends cached chunks
            # For now, we'll just report the error
            # TODO: Implement chunk retry based on device feedback
            raise FileTransferError(
                f"Device reported incomplete transfer (failed={end_event.failed})"
            )

        # Phase 4: Confirm file (C3)
        await client.confirm_file(filename)
        confirm_event = await self._wait_for_event(
            client, parser.ResumeWriteEvent, self.TIMEOUT_CONFIRM, "BBC3"
        )

        # BBC3 parser returns ResumeWriteEvent with 'written' field
        # The field actually contains the 'failed' status for BBC3
        if confirm_event.written != 0:
            raise FileTransferError(
                f"Device failed final confirmation (failed={confirm_event.written})"
            )

        logger.info("File transfer confirmed by device: %s", filename)

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
        """
        for idx in range(start_index, chunk_count):
            if self._state.cancelled:
                raise FileTransferCancelled("Transfer cancelled by user")

            # Calculate chunk data
            offset = idx * chunk_size
            chunk_data = file_data[offset : offset + chunk_size]

            # Cache chunk for potential retry
            self._chunk_cache[idx] = chunk_data

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

        # After all chunks sent, wait for any delayed dropped chunk events
        # The device may report dropped chunks slightly after we finish sending
        logger.debug("All chunks sent, waiting for any delayed dropped chunk events...")
        await asyncio.sleep(self.DROPPED_CHUNK_CHECK_DELAY)
        await self._handle_chunk_dropped_events(client, file_data, chunk_size)

        logger.debug("All %d chunks sent and verified", chunk_count)

    async def _handle_chunk_dropped_events(
        self,
        client: SkellyClient,
        file_data: bytes,
        chunk_size: int,
    ) -> None:
        """Check for and handle ChunkDroppedEvent (BBC1) from device.

        The device sends BBC1 when it detects a dropped chunk during transmission.
        We retry sending the specific chunk indicated by the event's index.

        This method polls the event queue and only processes ChunkDroppedEvents.
        Other events are left in the queue for later processing (they will be
        handled by _wait_for_event when we move to the next phase).

        Args:
            client: SkellyClient instance
            file_data: Complete file data
            chunk_size: Size of each chunk in bytes

        Raises:
            FileTransferCancelled: If cancelled during retry
        """
        retry_count = 0
        max_retries = 100  # Prevent infinite loop

        # Keep checking for dropped chunks until queue is empty or we hit max retries
        while retry_count < max_retries:
            try:
                # Peek at the queue with a very short timeout
                event = await asyncio.wait_for(client.events.get(), timeout=0.01)

                if isinstance(event, parser.ChunkDroppedEvent):
                    chunk_index = event.index
                    retry_count += 1
                    logger.warning(
                        "Device reported dropped chunk at index %d, retrying (attempt %d)...",
                        chunk_index,
                        retry_count,
                    )

                    if self._state.cancelled:
                        raise FileTransferCancelled(
                            "Transfer cancelled during chunk retry"
                        )

                    # Get chunk data from cache
                    if chunk_index not in self._chunk_cache:
                        # If not in cache, calculate from file data
                        offset = chunk_index * chunk_size
                        chunk_data = file_data[offset : offset + chunk_size]
                        logger.debug(
                            "Chunk %d not in cache, recalculated from file data",
                            chunk_index,
                        )
                    else:
                        chunk_data = self._chunk_cache[chunk_index]

                    # Resend the dropped chunk
                    await client.send_data_chunk(chunk_index, chunk_data)
                    logger.info(
                        "Resent dropped chunk %d (%d bytes)",
                        chunk_index,
                        len(chunk_data),
                    )

                    # Small delay before checking for more
                    await asyncio.sleep(self.CHUNK_DELAY)

                    # Continue checking for more dropped chunks
                    continue

                # Not a ChunkDroppedEvent - put it back in the queue
                # This event will be processed by _wait_for_event later
                await client.events.put(event)
                # Exit - we've hit a non-dropped-chunk event, meaning we're done
                break

            except TimeoutError:
                # No events in queue, normal - we're done
                break

        if retry_count > 0:
            logger.info("Handled %d dropped chunk(s)", retry_count)

    async def _wait_for_event(
        self,
        client: SkellyClient,
        event_type: type,
        timeout: float,
        event_name: str,
    ) -> any:
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
