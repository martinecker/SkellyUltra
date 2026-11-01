"""Set which files on the device are enabled for playback, and their order."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .file_settings import async_load_file_list_for_change
from .skelly_ultra_pkg import parser

_LOGGER = logging.getLogger(__name__)

# Delay between the per-file order writes, which the device doesn't acknowledge.
FILE_ORDER_WRITE_DELAY = 0.05

# The count of enabled files is sent as a single byte.
MAX_ENABLED_FILES = 255


def _resolve_files(
    file_list: list[parser.FileInfoEvent],
    filenames: list[str] | None,
    file_indices: list[int] | None,
) -> list[parser.FileInfoEvent]:
    """Look up the requested files in order, by name or by file index."""
    if filenames is not None:
        # First match per name, like edit_file's lookup
        by_name: dict[str, parser.FileInfoEvent] = {}
        for f in file_list:
            by_name.setdefault(f.name, f)
        missing = [name for name in filenames if name not in by_name]
        if missing:
            raise HomeAssistantError(
                f"Files not found in device file list: {', '.join(missing)}"
            )
        return [by_name[name] for name in filenames]

    assert file_indices is not None
    by_index = {f.file_index: f for f in file_list}
    missing_indices = [i for i in file_indices if i not in by_index]
    if missing_indices:
        raise HomeAssistantError(
            "File indices not found in device file list: "
            + ", ".join(str(i) for i in missing_indices)
        )
    return [by_index[i] for i in file_indices]


async def async_set_file_order(
    hass: HomeAssistant, adapter: Any, entry_id: str, data: dict[str, Any]
) -> list[dict[str, Any]]:
    """Enable the given files for playback in the given order.

    `data` holds either `filenames` or `file_indices`. Files left out are
    disabled. Returns the play order the device reports afterwards, as
    {"file_index", "filename"} entries (filename None if it isn't in the
    file list).
    """
    # An empty field counts as left out (the UI sends [] for a cleared one)
    filenames: list[str] | None = data.get("filenames") or None
    file_indices: list[int] | None = data.get("file_indices") or None
    if filenames is not None and file_indices is not None:
        raise HomeAssistantError("Provide either filenames or file_indices, not both")
    wanted: list[Any] = filenames or file_indices or []
    if not wanted:
        raise HomeAssistantError("At least one file must be enabled")
    if len(wanted) > MAX_ENABLED_FILES:
        raise HomeAssistantError(
            f"At most {MAX_ENABLED_FILES} files can be enabled, got {len(wanted)}"
        )
    duplicates = sorted({str(x) for x in wanted if wanted.count(x) > 1})
    if duplicates:
        raise HomeAssistantError(
            f"Files listed more than once: {', '.join(duplicates)}"
        )

    coordinator = hass.data[DOMAIN][entry_id].get("coordinator")
    if not coordinator:
        raise HomeAssistantError(f"No coordinator found for entry {entry_id}")

    # Holding the lock keeps coordinator polling and other writes out while
    # the files are looked up and the order is written and read back.
    async with coordinator.action_lock:
        file_list = await async_load_file_list_for_change(adapter, coordinator)
        files = _resolve_files(file_list, filenames, file_indices)
        # The device addresses files by name too (the web controller refuses
        # nameless files as well)
        nameless = [str(f.file_index) for f in files if not f.name.strip()]
        if nameless:
            raise HomeAssistantError(
                "Files without a name can't be ordered (file indices: "
                f"{', '.join(nameless)})"
            )

        total = len(files)
        try:
            for position, file_info in enumerate(files, start=1):
                await adapter.client.set_file_order(
                    total, position, file_info.file_index, file_info.name
                )
                await asyncio.sleep(FILE_ORDER_WRITE_DELAY)
        finally:
            # Read the order back even after a failed write, since some
            # writes may have landed. Don't let a failed read hide the
            # write error.
            read_error: Exception | None = None
            try:
                file_order = await coordinator.async_refresh_file_order()
            except Exception as err:  # noqa: BLE001
                read_error = err
                _LOGGER.warning(
                    "Failed to read back the file order: %r", err, exc_info=True
                )

        if read_error is not None:
            raise HomeAssistantError(
                "The file order was sent, but reading it back from the device "
                f"failed: {read_error!r}"
            ) from read_error

    requested = [f.file_index for f in files]
    if file_order != requested:
        _LOGGER.warning(
            "Device reports file order %s after setting %s", file_order, requested
        )
    else:
        _LOGGER.info("Set file order to %s", requested)

    names = {f.file_index: f.name for f in file_list}
    return [{"file_index": i, "filename": names.get(i)} for i in file_order]
