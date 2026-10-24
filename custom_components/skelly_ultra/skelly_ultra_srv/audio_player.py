"""Audio player manager using pw-play (PipeWire)."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from enum import Enum
import logging
from pathlib import Path
from typing import NamedTuple

from .pipewire_utils import resolve_bluez_output_node, set_node_volume

_LOGGER = logging.getLogger(__name__)

# Silence stream that keeps a Bluetooth sink from suspending between clips.
# Raw zeros from /dev/zero on stdin, paced by the sink. dont-reconnect/dont-fallback
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
    # Number of the play request (see AudioPlayer._request_seq). Only a newer
    # request replaces or stops this session.
    generation: int


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
        # Session key (see _session_key) -> playback session
        self._playback_sessions: dict[str, PlaybackSession] = {}
        # Session key -> lock held while starting or stopping playback there,
        # so two plays for the same speaker can't both start pw-play. One per
        # target ever used, never removed.
        self._target_locks: dict[str, asyncio.Lock] = {}
        # Numbers play and stop-all requests in arrival order. A request never
        # stops or replaces playback from a newer one: while a multi-target
        # play waits for a target's lock, newer requests may get there first.
        self._request_seq = 0
        # Number of the latest stop of all targets or untargeted play
        self._stop_all_seq = 0
        # Session key -> number of the latest stop of that target
        self._target_stop_seqs: dict[str, int] = {}
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

    @staticmethod
    def _session_key(target: str | None) -> str:
        """Return the session key for target: its MAC in upper case, or "default".

        "default" itself maps to "default", since that is the key clients see.
        """
        if not target or target.lower() == "default":
            return "default"
        return target.upper()

    def _target_lock(self, key: str) -> asyncio.Lock:
        """Return the lock for a session key, creating it on first use."""
        return self._target_locks.setdefault(key, asyncio.Lock())

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
            # pw-cat --raw reads stdin, not the file argument (seen with
            # PipeWire 1.4.2): with the server's stdin on /dev/null it drained
            # and exited at once. So feed /dev/zero as stdin.
            with open("/dev/zero", "rb") as zero:
                process = await asyncio.create_subprocess_exec(
                    *_KEEPALIVE_ARGS,
                    "--target",
                    node,
                    "-",
                    stdin=zero,
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
            file_path: Path to the audio file to play
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

        self._request_seq += 1
        seq = self._request_seq
        if not targets:
            self._stop_all_seq = seq
        success_count = 0
        unreachable: list[str] = []
        for tgt in target_list:
            result = await self._play_on_target(file_path, tgt, seq)
            if result is PlayResult.SUCCESS:
                success_count += 1
            elif result is PlayResult.TARGET_UNREACHABLE and tgt:
                unreachable.append(tgt)

        if success_count > 0:
            return PlayResponse(PlayResult.SUCCESS, unreachable)
        if unreachable:
            return PlayResponse(PlayResult.TARGET_UNREACHABLE, unreachable)
        return PlayResponse(PlayResult.ERROR, unreachable)

    async def _play_on_target(
        self, file_path: str, target: str | None, seq: int
    ) -> PlayResult:
        """Play audio on a specific target, replacing what plays there.

        seq is the number of the play request (see _request_seq).
        """
        target_key = self._session_key(target)
        try:
            # Held across stop, node lookup and spawn: a second play for the
            # same target waits here, then stops this one and replaces it.
            # Plays for different targets still start in parallel.
            async with contextlib.AsyncExitStack() as locks:
                await locks.enter_async_context(self._target_lock(target_key))
                if target is None:
                    # The default sink is usually one of the connected
                    # speakers, so stop everything rather than mix streams.
                    # Take the other targets' locks too (in sorted order, after
                    # "default"), so a targeted play still starting can't
                    # start pw-play after this stop.
                    others = set(self._playback_sessions) | set(self._target_locks)
                    others.discard(target_key)
                    for key in sorted(others):
                        await locks.enter_async_context(self._target_lock(key))
                current = self._playback_sessions.get(target_key)
                stop_seq = max(
                    self._stop_all_seq, self._target_stop_seqs.get(target_key, 0)
                )
                if stop_seq > seq or (current is not None and current.generation > seq):
                    # A newer request stopped this target or already plays on
                    # it: leave that alone and start nothing here
                    _LOGGER.info(
                        "Skipping playback of %s on %s: replaced by a newer request",
                        file_path,
                        target_key,
                    )
                    return PlayResult.SUCCESS
                if target is None:
                    await self._stop_all(seq)
                else:
                    await self._stop_one(target_key)
                return await self._start_on_target(file_path, target, target_key, seq)
        finally:
            await self._sync_active()

    async def _start_on_target(
        self, file_path: str, target: str | None, target_key: str, generation: int
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

            session = PlaybackSession(
                process=process,
                file_path=file_path,
                target=target,
                generation=generation,
            )
            self._playback_sessions[target_key] = session

        except FileNotFoundError:
            _LOGGER.error("pw-play command not found. Is PipeWire installed?")
            return PlayResult.ERROR
        except Exception:
            _LOGGER.exception("Failed to start playback on target: %s", target_key)
            return PlayResult.ERROR
        else:
            task = asyncio.create_task(self._monitor_playback(target_key, session))
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
        """Stop playback on specific target or all targets.

        Waits for a play that is still starting on the target, so a stop sent
        right after a play stops that play.
        """
        try:
            if target is None:
                self._request_seq += 1
                self._stop_all_seq = generation = self._request_seq
                overall_success = True
                for key in sorted(
                    set(self._playback_sessions) | set(self._target_locks)
                ):
                    async with self._target_lock(key):
                        result = await self._stop_one(key, generation)
                    if result is not PlayResult.SUCCESS:
                        overall_success = False
                return PlayResult.SUCCESS if overall_success else PlayResult.ERROR

            target_key = self._session_key(target)
            self._request_seq += 1
            generation = self._target_stop_seqs[target_key] = self._request_seq
            async with self._target_lock(target_key):
                return await self._stop_one(target_key, generation)
        finally:
            await self._sync_active()

    async def _stop_all(self, generation: int) -> None:
        """Stop every session from before generation (the caller holds the locks)."""
        for target_key in list(self._playback_sessions):
            await self._stop_one(target_key, generation)

    async def _stop_one(
        self, target_key: str, generation: int | None = None
    ) -> PlayResult:
        """Stop playback for one session key (a target MAC or "default").

        With generation, only a session from an earlier request is stopped: a
        play made after a stop of all targets began must keep playing.
        """
        session = self._playback_sessions.get(target_key)
        if not session:
            _LOGGER.debug("No audio playing on target: %s", target_key)
            return PlayResult.SUCCESS
        if generation is not None and session.generation >= generation:
            _LOGGER.debug("Keeping newer playback on target: %s", target_key)
            return PlayResult.SUCCESS

        process = session.process
        try:
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except TimeoutError:
                    _LOGGER.warning("Process didn't terminate gracefully, killing it")
                    process.kill()
                    await process.wait()
                _LOGGER.info("Playback stopped successfully on target: %s", target_key)
            else:
                _LOGGER.debug("Playback on target %s already finished", target_key)

        except ProcessLookupError:
            # Exited on its own just before the signal: stopped all the same
            _LOGGER.debug("Playback on target %s already finished", target_key)
        except Exception:
            _LOGGER.exception("Failed to stop playback on target: %s", target_key)
            return PlayResult.ERROR

        # A newer play may have replaced the session while this one stopped
        if self._playback_sessions.get(target_key) is session:
            self._playback_sessions.pop(target_key, None)
        return PlayResult.SUCCESS

    async def _monitor_playback(
        self, target_key: str, session: PlaybackSession
    ) -> None:
        """Monitor one playback process and clean up when it finishes."""
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

        session = self._playback_sessions.get(self._session_key(target))
        return session is not None and session.process.returncode is None

    def get_current_file(self, target: str | None = None) -> str | None:
        """Get the currently playing file path."""
        if target is None:
            for session in self._playback_sessions.values():
                if session.process.returncode is None:
                    return session.file_path
            return None

        session = self._playback_sessions.get(self._session_key(target))
        if session and session.process.returncode is None:
            return session.file_path
        return None

    def get_all_sessions(self) -> dict[str, tuple[str, bool]]:
        """Get information about all playback sessions."""
        return {
            target_key: (session.file_path, session.process.returncode is None)
            for target_key, session in self._playback_sessions.items()
        }
