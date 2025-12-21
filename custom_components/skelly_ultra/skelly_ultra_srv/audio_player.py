"""Audio player manager using pw-play (PipeWire)."""

from __future__ import annotations

import asyncio
from enum import Enum
import logging
from pathlib import Path
from typing import NamedTuple

from .pipewire_utils import resolve_bluez_output_node

_LOGGER = logging.getLogger(__name__)


class PlaybackSession(NamedTuple):
    """Information about an active playback session."""

    process: asyncio.subprocess.Process
    file_path: str
    target: str | None


class PlayResult(Enum):
    """Playback result classification."""

    SUCCESS = "success"
    TARGET_UNREACHABLE = "target_unreachable"
    ERROR = "error"


class PlayResponse(NamedTuple):
    """Aggregate playback response across requested targets."""

    result: PlayResult
    unreachable_targets: list[str]


class AudioPlayer:
    """Manager for audio playback using pw-play."""

    def __init__(self) -> None:
        """Initialize the audio player."""
        self._playback_sessions: dict[str, PlaybackSession] = {}
        self._background_tasks: set[asyncio.Task] = set()

    async def play(
        self,
        file_path: str,
        targets: list[str] | None = None,
    ) -> PlayResponse:
        """Play an audio file using pw-play.

        Args:
            file_path: Path to the .wav file to play
            targets: List of target devices to play on

        Returns:
            PlayResponse capturing aggregate result and unreachable targets
        """
        target_list = list(targets) if targets else [None]

        path = Path(file_path)
        if not path.exists():
            _LOGGER.error("Audio file does not exist: %s", file_path)
            return PlayResponse(PlayResult.ERROR, [])

        if not path.is_file():
            _LOGGER.error("Path is not a file: %s", file_path)
            return PlayResponse(PlayResult.ERROR, [])

        success_count = 0
        unreachable: list[str] = []
        for tgt in target_list:
            result = await self._play_on_target(file_path, tgt)
            if result is PlayResult.SUCCESS:
                success_count += 1
            elif result is PlayResult.TARGET_UNREACHABLE and tgt:
                unreachable.append(tgt)

        if success_count > 0:
            return PlayResponse(PlayResult.SUCCESS, unreachable)
        if unreachable:
            return PlayResponse(PlayResult.TARGET_UNREACHABLE, unreachable)
        return PlayResponse(PlayResult.ERROR, unreachable)

    async def _play_on_target(self, file_path: str, target: str | None) -> PlayResult:
        """Play audio on a specific target."""
        target_key = target or "default"
        await self.stop(target)

        _LOGGER.info("Starting playback of: %s on target: %s", file_path, target_key)

        try:
            cmd = ["pw-play"]
            if target:
                try:
                    pipewire_target = await resolve_bluez_output_node(target)
                except RuntimeError as exc:
                    _LOGGER.error(
                        "Failed to resolve PipeWire node for target %s: %s",
                        target,
                        exc,
                    )
                    return PlayResult.TARGET_UNREACHABLE

                if not pipewire_target:
                    _LOGGER.error(
                        "No PipeWire bluez_output node available for target: %s",
                        target,
                    )
                    return PlayResult.TARGET_UNREACHABLE

                cmd.extend(["--target", pipewire_target])
            cmd.extend(["--volume", "1.0"])
            cmd.append(file_path)

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            self._playback_sessions[target_key] = PlaybackSession(
                process=process, file_path=file_path, target=target
            )

        except FileNotFoundError:
            _LOGGER.error("pw-play command not found. Is PipeWire installed?")
            return PlayResult.ERROR
        except Exception:
            _LOGGER.exception("Failed to start playback on target: %s", target_key)
            return PlayResult.ERROR
        else:
            task = asyncio.create_task(self._monitor_playback(target_key))
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

            cmd_str = " ".join(f'"{arg}"' if " " in arg else arg for arg in cmd)
            _LOGGER.info(
                "Playback started for: %s on target: %s - Command: %s",
                file_path,
                target_key,
                cmd_str,
            )
            return PlayResult.SUCCESS

    async def stop(self, target: str | None = None) -> PlayResult:
        """Stop playback on specific target or all targets."""
        if target is None:
            if not self._playback_sessions:
                _LOGGER.debug("No audio currently playing")
                return PlayResult.SUCCESS

            overall_success = True
            for tgt_key in list(self._playback_sessions.keys()):
                result = await self.stop(tgt_key if tgt_key != "default" else None)
                if result is not PlayResult.SUCCESS:
                    overall_success = False
            return PlayResult.SUCCESS if overall_success else PlayResult.ERROR

        target_key = target or "default"
        session = self._playback_sessions.get(target_key)
        if not session:
            _LOGGER.debug("No audio playing on target: %s", target_key)
            return PlayResult.SUCCESS

        try:
            session.process.terminate()
            try:
                await asyncio.wait_for(session.process.wait(), timeout=5)
            except TimeoutError:
                _LOGGER.warning("Process didn't terminate gracefully, killing it")
                session.process.kill()
                await session.process.wait()

        except Exception:
            _LOGGER.exception("Failed to stop playback on target: %s", target_key)
            return PlayResult.ERROR
        else:
            _LOGGER.info("Playback stopped successfully on target: %s", target_key)
            self._playback_sessions.pop(target_key, None)
            return PlayResult.SUCCESS

    async def _monitor_playback(self, target_key: str) -> None:
        """Monitor the playback process and clean up when it finishes."""
        session = self._playback_sessions.get(target_key)
        if not session:
            return

        try:
            await session.process.wait()
            returncode = session.process.returncode

            if returncode == 0:
                _LOGGER.info(
                    "Playback completed: %s on %s", session.file_path, target_key
                )
            elif session.process.stderr:
                stderr = await session.process.stderr.read()
                error_msg = stderr.decode("utf-8", errors="replace")
                _LOGGER.warning(
                    "Playback process exited with code %d on %s: %s",
                    returncode,
                    target_key,
                    error_msg,
                )

        except Exception:
            _LOGGER.exception("Error monitoring playback on target: %s", target_key)
        finally:
            self._playback_sessions.pop(target_key, None)

    def is_playing(self, target: str | None = None) -> bool:
        """Check if audio is currently playing."""
        if target is None:
            for session in self._playback_sessions.values():
                if session.process.returncode is None:
                    return True
            return False

        target_key = target or "default"
        session = self._playback_sessions.get(target_key)
        return session is not None and session.process.returncode is None

    def get_current_file(self, target: str | None = None) -> str | None:
        """Get the currently playing file path."""
        if target is None:
            for session in self._playback_sessions.values():
                if session.process.returncode is None:
                    return session.file_path
            return None

        target_key = target or "default"
        session = self._playback_sessions.get(target_key)
        if session and session.process.returncode is None:
            return session.file_path
        return None

    def get_all_sessions(self) -> dict[str, tuple[str, bool]]:
        """Get information about all playback sessions."""
        return {
            target_key: (session.file_path, session.process.returncode is None)
            for target_key, session in self._playback_sessions.items()
        }
