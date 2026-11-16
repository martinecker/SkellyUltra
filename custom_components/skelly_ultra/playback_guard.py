"""Hold off device polling while the Skelly plays one of its own files.

The Skelly aborts internal-file playback if it receives the coordinator's BLE
query burst mid-file (notably the capacity query), so polling is held off
until playback ends. PlaybackGuard follows the device's play/stop reports
and HA's own Play commands to know when that is.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable

from homeassistant.core import HomeAssistant

# Polling normally resumes when the device reports playback stopped; the
# safety timer below only covers a missed "stopped" notification.
#
# When the device reports the file's duration, the timer is set to that plus a
# margin (any length - no upper cap, or long files would be cut off). The
# fallback is used only for the brief window before the device's first
# PlaybackEvent arrives, after which the timer is re-armed with the real
# duration.
PLAYBACK_ACTIVE_MARGIN_SECONDS = 10.0
PLAYBACK_ACTIVE_FALLBACK_SECONDS = 60.0
# After a Play from HA, how long the device has to report playing before
# polling resumes
PLAY_REPORT_TIMEOUT_SECONDS = 10.0
# The device reports the end of the previous file when switching files; such
# "stopped" reports this soon after a Play keep polling held off
PLAY_SWITCH_GRACE_SECONDS = 2.0


class PlaybackGuard:
    """Track whether the device plays an internal file, and which one.

    on_changed is called when the reported file (playback) changes, and
    on_ended when the guard is lifted (polling may resume).
    """

    def __init__(
        self,
        hass: HomeAssistant,
        logger: logging.Logger | logging.LoggerAdapter,
        *,
        on_changed: Callable[[], None],
        on_ended: Callable[[], None],
    ) -> None:
        self.hass = hass
        self._logger = logger
        self._on_changed = on_changed
        self._on_ended = on_ended
        self._active = False
        self._timer: asyncio.TimerHandle | None = None
        # The file the device reported playing, for UIs: file_index,
        # duration (seconds, 0 if unknown) and a number that tells the
        # reports apart (the same file can be played again)
        self._playback: dict[str, int] | None = None
        self._reports = 0
        # loop.time() of the last Play sent from HA, and its file, until
        # the device reports it playing
        self._play_sent_at: float | None = None
        self._play_sent_index: int | None = None

    @property
    def active(self) -> bool:
        """Return True while the device plays an internal file."""
        return self._active

    @property
    def playback(self) -> dict[str, int] | None:
        """Return the file the device reported playing, or None.

        A dict with file_index, duration (seconds, 0 if unknown), started
        (when the report came, in ms since the epoch) and report, which is
        new for every "playing" report.
        """
        return self._playback

    def mark_active(
        self, duration_seconds: float | None = None, *, timeout: float | None = None
    ) -> None:
        """Hold off polling while the device plays an internal file.

        A safety timer lifts the guard after the expected duration (plus a
        margin) so polling can't get stuck off if the device's "playback
        stopped" notification is never received. When the duration is known
        it is used as-is with no upper cap, so long files are not cut short.
        An explicit timeout (in seconds) replaces both.
        """
        if timeout is None:
            if duration_seconds and duration_seconds > 0:
                timeout = duration_seconds + PLAYBACK_ACTIVE_MARGIN_SECONDS
            else:
                timeout = PLAYBACK_ACTIVE_FALLBACK_SECONDS

        self._active = True
        if self._timer is not None:
            self._timer.cancel()
        self._timer = self.hass.loop.call_later(timeout, self._on_timeout)
        self._logger.debug(
            "Playback active - suppressing device polling for up to %.0fs", timeout
        )

    def mark_play_sent(self, file_index: int) -> None:
        """Note a Play just sent from HA, until the device reports it playing."""
        self.mark_active(timeout=PLAY_REPORT_TIMEOUT_SECONDS)
        self._play_sent_at = self.hass.loop.time()
        self._play_sent_index = file_index

    def set_playback(self, file_index: int, playing: bool, duration: int) -> None:
        """Record the device's report that a file started or stopped playing."""
        if playing:
            self._play_sent_at = None
            self.mark_active(duration)
            self._reports += 1
            self._set_playback(
                {
                    "file_index": file_index,
                    "duration": duration,
                    "started": int(time.time() * 1000),
                    "report": self._reports,
                }
            )
        elif self._playback is not None and self._playback["file_index"] != file_index:
            pass  # The end of a file played before the one now playing
        elif self._play_sent_at is not None and (
            file_index != self._play_sent_index
            or self.hass.loop.time() - self._play_sent_at < PLAY_SWITCH_GRACE_SECONDS
        ):
            # The end of the file played before (or likely so, shortly after
            # the Play), while the one just sent starts: keep polling held
            # off for it
            self._set_playback(None)
        else:
            self.mark_inactive()

    def _set_playback(self, playback: dict[str, int] | None) -> None:
        if playback != self._playback:
            self._playback = playback
            self._on_changed()

    def mark_inactive(self) -> None:
        """Lift the guard after internal-file playback ends."""
        self._play_sent_at = None
        self._set_playback(None)
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        if self._active:
            self._active = False
            self._logger.debug("Playback ended - resuming device polling")
            self._on_ended()

    def _on_timeout(self) -> None:
        """Force-resume polling if no 'playback stopped' event arrived in time."""
        self._timer = None
        self._set_playback(None)
        if self._active:
            self._logger.warning(
                "Playback-active flag timed out without a stop event; "
                "resuming device polling"
            )
            self._active = False
            self._on_ended()

    def stop_timer(self) -> None:
        """Drop the safety timer; call once the entry has unloaded."""
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
