"""Audio player manager using pw-play (PipeWire)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from enum import Enum
import logging
from pathlib import Path
from typing import NamedTuple

from .pipewire_utils import resolve_bluez_output_node, set_node_volume

_LOGGER = logging.getLogger(__name__)

# Silence stream that keeps a Bluetooth sink from suspending between clips.
# Raw zeros from /dev/zero, paced by the sink. dont-reconnect/dont-fallback
# make it exit when the device goes away instead of moving to another sink.
_KEEPALIVE_ARGS = [
    "pw-cat",
    "--playback",
    "--raw",
    "--rate",
    "48000",
    "--channels",
    "2",
    "--format",
    "s16",
    "--properties",
    '{ node.dont-reconnect = true node.dont-fallback = true media.name = "Skelly keep-alive" }',
]

# A keep-alive started right after connect can exit within a second, because
# the sink is still being set up. Restart it this many times in a row, waiting
# _KEEPALIVE_RETRY_DELAY seconds first. A run of _KEEPALIVE_STABLE_SECS or
# longer resets the count.
_KEEPALIVE_MAX_RETRIES = 5
_KEEPALIVE_RETRY_DELAY = 2.0
_KEEPALIVE_STABLE_SECS = 30.0


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

    def __init__(
        self,
        on_active_change: Callable[[bool], Awaitable[None]] | None = None,
        keepalive: bool = True,
    ) -> None:
        """Initialize the audio player.

        Args:
            on_active_change: Awaited with True before the first playback
                starts and with False once nothing is playing anymore
            keepalive: Run silence keep-alive streams (see start_keepalive)
        """
        self._playback_sessions: dict[str, PlaybackSession] = {}
        self._background_tasks: set[asyncio.Task] = set()
        self._on_active_change = on_active_change
        # Target MAC (upper case) -> silence keep-alive process
        self._keepalives: dict[str, asyncio.subprocess.Process] = {}
        # Target MAC (upper case) -> restarts since the last stable run. A key
        # is present while the keep-alive is wanted, until stop_keepalive.
        self._keepalive_retries: dict[str, int] = {}
        self._keepalive_enabled = keepalive
        self._active = False
        self._active_lock = asyncio.Lock()

    async def _set_active(self, active: bool) -> None:
        """Notify on_active_change when overall playback starts or stops."""
        async with self._active_lock:
            if active == self._active:
                return
            self._active = active
            if self._on_active_change is None:
                return
            try:
                await self._on_active_change(active)
            except Exception:
                _LOGGER.exception("Error in playback active change callback")

    async def _sync_active(self) -> None:
        """Set the active state from the sessions still playing."""
        await self._set_active(bool(self._playback_sessions))

    async def start_keepalive(self, target: str, node: str | None = None) -> None:
        """Stream silence to target so its Bluetooth sink stays awake.

        PipeWire suspends an idle Bluetooth sink and releases the A2DP
        transport, so every clip used to start on a cold link and stutter
        for the first seconds. The silence mixes with real playback.

        Args:
            target: Device MAC address
            node: PipeWire node name if already resolved
        """
        if not self._keepalive_enabled:
            return
        key = target.upper()
        process = self._keepalives.get(key)
        if process and process.returncode is None:
            return
        self._keepalive_retries.setdefault(key, 0)

        if node is None:
            try:
                node = await resolve_bluez_output_node(target)
            except RuntimeError as exc:
                _LOGGER.warning("Keep-alive: cannot resolve node for %s: %s", key, exc)
                self._keepalive_retries.pop(key, None)
                return
        if not node:
            _LOGGER.warning("Keep-alive: no PipeWire node for %s", key)
            self._keepalive_retries.pop(key, None)
            return

        try:
            process = await asyncio.create_subprocess_exec(
                *_KEEPALIVE_ARGS,
                "--target",
                node,
                "/dev/zero",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
        except Exception:
            _LOGGER.exception("Keep-alive: failed to start pw-cat for %s", key)
            self._keepalive_retries.pop(key, None)
            return

        self._keepalives[key] = process
        _LOGGER.info("Started silence keep-alive on %s (%s)", key, node)
        task = asyncio.create_task(self._monitor_keepalive(key, process))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    async def _monitor_keepalive(
        self, key: str, process: asyncio.subprocess.Process
    ) -> None:
        """Restart a keep-alive that exits on its own, or forget it."""
        started = asyncio.get_running_loop().time()
        try:
            await process.wait()
            error_msg = ""
            if process.stderr:
                stderr = await process.stderr.read()
                error_msg = stderr.decode("utf-8", errors="replace").strip()
            _LOGGER.info(
                "Silence keep-alive on %s exited with code %s%s",
                key,
                process.returncode,
                f": {error_msg}" if error_msg else "",
            )
        except Exception:
            _LOGGER.exception("Error monitoring keep-alive on %s", key)
        finally:
            # stop_keepalive pops the process first, so still being registered
            # means it exited on its own
            unexpected = self._keepalives.get(key) is process
            if unexpected:
                self._keepalives.pop(key, None)

        if not unexpected or key not in self._keepalive_retries:
            return
        if asyncio.get_running_loop().time() - started >= _KEEPALIVE_STABLE_SECS:
            self._keepalive_retries[key] = 0
        retries = self._keepalive_retries[key] + 1
        if retries > _KEEPALIVE_MAX_RETRIES:
            _LOGGER.warning(
                "Silence keep-alive on %s keeps exiting; giving up after %d restarts",
                key,
                _KEEPALIVE_MAX_RETRIES,
            )
            self._keepalive_retries.pop(key, None)
            return
        self._keepalive_retries[key] = retries

        await asyncio.sleep(_KEEPALIVE_RETRY_DELAY)
        # Stopped or already restarted (e.g. by a play) while waiting
        if key not in self._keepalive_retries or key in self._keepalives:
            return
        _LOGGER.info(
            "Restarting silence keep-alive on %s (attempt %d/%d)",
            key,
            retries,
            _KEEPALIVE_MAX_RETRIES,
        )
        # Resolve the node again: it may have been recreated, or the device
        # may be gone (then start_keepalive logs that and gives up)
        await self.start_keepalive(key)

    async def stop_keepalive(self, target: str | None = None) -> None:
        """Stop the keep-alive for target, or all of them if target is None."""
        if target:
            keys = [target.upper()]
        else:
            keys = list(self._keepalives)
            self._keepalive_retries.clear()
        for key in keys:
            self._keepalive_retries.pop(key, None)
            process = self._keepalives.pop(key, None)
            if not process or process.returncode is not None:
                continue
            _LOGGER.info("Stopping silence keep-alive on %s", key)
            # Kill right away: there is only silence to lose, and pw-cat
            # ignores SIGTERM once its sink is gone (seen on the Pi)
            process.kill()
            await process.wait()

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
        await self._stop_one(target_key)
        try:
            return await self._start_on_target(file_path, target, target_key)
        finally:
            await self._sync_active()

    async def _start_on_target(
        self, file_path: str, target: str | None, target_key: str
    ) -> PlayResult:
        """Start pw-play for one target (any old session is already stopped)."""
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
                # Covers devices connected before the server (re)started
                await self.start_keepalive(target, pipewire_target)
                # WirePlumber may have restored a lower sink volume since connect
                await set_node_volume(pipewire_target, 1.0)
            cmd.extend(["--volume", "1.0"])
            cmd.append(file_path)

            # Let the owner clear the radio (pause scanning) before audio starts
            await self._set_active(True)

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
        try:
            return await self._stop(target)
        finally:
            await self._sync_active()

    async def _stop(self, target: str | None) -> PlayResult:
        """Stop playback without updating the active state."""
        if target is None:
            if not self._playback_sessions:
                _LOGGER.debug("No audio currently playing")
                return PlayResult.SUCCESS

            overall_success = True
            for tgt_key in list(self._playback_sessions.keys()):
                result = await self._stop_one(tgt_key)
                if result is not PlayResult.SUCCESS:
                    overall_success = False
            return PlayResult.SUCCESS if overall_success else PlayResult.ERROR

        return await self._stop_one(target)

    async def _stop_one(self, target_key: str) -> PlayResult:
        """Stop playback for one session key (a target MAC or "default")."""
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
            # A newer play on this target may have replaced the session already
            if self._playback_sessions.get(target_key) is session:
                self._playback_sessions.pop(target_key, None)
            await self._sync_active()

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
