"""PipeWire helper utilities for bluez_output device nodes."""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
import json


def _normalize_hex_like(value: str) -> str:
    """Return a compact uppercase hex string from a MAC-like identifier."""

    filtered = "".join(ch for ch in value if ch.isalnum())
    return filtered.upper()


def _fragments_from_identifier(identifier: str) -> tuple[str, ...]:
    """Build fragment variations for PipeWire node matching."""

    if not identifier:
        return ()

    # If identifier already looks like a bluez_output node, extract the MAC-like component
    remainder = identifier
    lowered = identifier.lower()
    if lowered.startswith("bluez_output."):
        parts = identifier.split(".", 1)
        remainder = parts[1] if len(parts) > 1 else identifier
        remainder = remainder.split(".", 1)[0]

    compact = _normalize_hex_like(remainder)
    if not compact:
        return ()

    # Insert separators every two characters if possible
    colon = ":".join(compact[i : i + 2] for i in range(0, len(compact), 2))
    underscore = colon.replace(":", "_")
    return tuple(dict.fromkeys((colon, underscore, compact)))


def _node_candidates(identifier: str) -> tuple[str, ...]:
    """Return the set of node names that should be considered exact matches."""

    if not identifier:
        return ()
    trimmed = identifier.strip()
    if not trimmed:
        return ()
    if not trimmed.lower().startswith("bluez_output"):
        return ()
    # Preserve original casing plus normalized variants for robustness
    candidates = {trimmed, trimmed.lower(), trimmed.upper()}
    return tuple(candidates)


def _compact_forms(fragments: Iterable[str]) -> tuple[str, ...]:
    """Return fragments with punctuation removed for lax comparisons."""

    compacted: list[str] = []
    for fragment in fragments:
        cleaned = fragment.replace(":", "").replace("_", "").replace("-", "")
        if cleaned:
            if cleaned not in compacted:
                compacted.append(cleaned)
    return tuple(compacted)


async def resolve_bluez_output_node(
    identifier: str,
    *,
    attempts: int = 5,
    delay: float = 1.0,
) -> str | None:
    """Return the PipeWire bluez_output node for a MAC/node identifier.

    Args:
        identifier: MAC address or PipeWire node hint supplied by the caller.
        attempts: Number of polls before giving up (PipeWire may publish late).
        delay: Delay between polls (seconds).

    Raises:
        RuntimeError: If pw-dump cannot be executed or its output parsed.

    Returns:
        The node.name string reported by PipeWire, or None if not found.
    """

    if not identifier:
        return None

    fragments = _fragments_from_identifier(identifier)
    compact_fragments = _compact_forms(fragments)
    node_candidates = _node_candidates(identifier)

    for attempt in range(1, attempts + 1):
        node = await _query_pipewire_for_node(
            node_candidates, fragments, compact_fragments
        )
        if node:
            return node
        if attempt < attempts:
            await asyncio.sleep(delay)
    return None


async def _query_pipewire_for_node(
    node_candidates: tuple[str, ...],
    fragments: tuple[str, ...],
    compact_fragments: tuple[str, ...],
) -> str | None:
    """Run pw-dump and search for a matching bluez_output node."""

    dump = await _run_pw_dump()
    if not dump:
        return None

    for entry in dump:
        if not isinstance(entry, dict):
            continue
        entry_type = entry.get("type")
        if not isinstance(entry_type, str) or "Node" not in entry_type:
            continue
        info = entry.get("info")
        if not isinstance(info, dict):
            continue
        props = info.get("props") or info.get("properties")
        if not isinstance(props, dict):
            continue
        node_name = props.get("node.name")
        if not isinstance(node_name, str):
            continue
        if node_candidates and node_name in node_candidates:
            return node_name
        if not node_name.startswith("bluez_output"):
            continue
        if _matches(node_name, fragments, compact_fragments):
            return node_name
        description = props.get("device.description")
        if isinstance(description, str):
            if _matches(description, (), compact_fragments):
                return node_name
    return None


def _matches(
    source: str,
    fragments: tuple[str, ...],
    compact_fragments: tuple[str, ...],
) -> bool:
    """Return True if any fragment matches the provided string."""

    upper = source.upper()
    compact_upper = (
        upper.replace(":", "").replace("_", "").replace("-", "").replace(" ", "")
    )
    if fragments and any(fragment in upper for fragment in fragments):
        return True
    if compact_fragments and any(
        compact in compact_upper for compact in compact_fragments
    ):
        return True
    return False


async def _run_pw_dump() -> list[dict[str, object]]:
    """Execute pw-dump and return decoded JSON output."""

    try:
        proc = await asyncio.create_subprocess_exec(
            "pw-dump",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (FileNotFoundError, OSError) as exc:
        raise RuntimeError("pw-dump command is not available") from exc

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5.0)
    except TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise RuntimeError("Timed out while waiting for pw-dump") from exc

    if proc.returncode != 0:
        stderr_text = (stderr.decode(errors="ignore") if stderr else "").strip()
        raise RuntimeError(f"pw-dump exited with code {proc.returncode}: {stderr_text}")

    payload = stdout.decode(errors="replace").strip()
    if not payload:
        return []

    def _try_parse(content: str) -> list[dict[str, object]] | None:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return None
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
        return None

    data = _try_parse(payload)
    if data is None:
        # Some versions emit logs before the JSON blob; attempt to locate the first array/dict
        start_index = -1
        for candidate in ("[", "{"):
            idx = payload.find(candidate)
            if idx != -1:
                if start_index == -1 or idx < start_index:
                    start_index = idx
        if start_index > 0:
            data = _try_parse(payload[start_index:])

    if data is None:
        ndjson_lines = [line for line in payload.splitlines() if line.strip()]
        parsed: list[dict[str, object]] = []
        for line in ndjson_lines:
            obj = _try_parse(line)
            if obj is None:
                parsed = []
                break
            parsed.extend(entry for entry in obj if isinstance(entry, dict))
        if not parsed:
            raise RuntimeError("Failed to parse pw-dump output")
        return parsed

    return data
