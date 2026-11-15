"""A simulated Skelly REST server (skelly_ultra_srv), for live mode.

Live mode pairs the Skelly's classic Bluetooth speaker with the REST server
and plays audio through it. FakeRestServer answers the integration's HTTP
calls like the real server does, using the FakeSkellyDevice's state (live
name, PIN, whether classic Bluetooth was enabled over BLE).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from pytest_homeassistant_custom_component.test_util.aiohttp import (
    AiohttpClientMocker,
    AiohttpClientMockResponse,
)

from .device_sim import FakeSkellyDevice, Light

LIVE_MAC = "11:22:33:44:55:66"
# Another Skelly's speaker on the same REST server
OTHER_MAC = "AA:BB:CC:00:11:22"


@dataclass
class Look:
    """What the Skelly looked like when a clip started playing."""

    eye_icon: int
    action: int
    lights: list[Light]


class FakeRestServer:
    def __init__(self, mocker: AiohttpClientMocker, device: FakeSkellyDevice, url: str):
        self.device = device
        self.url = url
        self.up = True
        self.paired_mac: str | None = None
        self.connected = False
        self.playing = False
        # Audio playing to another Skelly on this server
        self.other_playing = False
        self.stops: list[str | None] = []
        # Set pair_gate to hold pairing until it is set; pair_started is set
        # once a pairing waits on it
        self.pair_gate: asyncio.Event | None = None
        self.pair_started = asyncio.Event()
        # Number of status polls a clip keeps playing for
        self.clip_polls = 1
        self._polls_left = 0
        self.plays: list[Look] = []
        for method, path, handler in (
            ("get", "/health", self._health),
            ("post", "/classic/pair_and_trust_by_name", self._pair),
            ("post", "/classic/connect_by_mac", self._connect),
            ("post", "/classic/disconnect", self._disconnect),
            ("get", "/classic/status", self._status),
            ("post", "/classic/play", self._play),
            ("post", "/classic/stop", self._stop),
            ("get", "/link_quality", self._link_quality),
        ):
            mocker.request(method, f"{url}{path}", side_effect=handler)

    def _reply(self, method, url, body: dict[str, Any], status: int = 200):
        if not self.up:
            return AiohttpClientMockResponse(
                method, url, status=503, json={"success": False}
            )
        return AiohttpClientMockResponse(method, url, status=status, json=body)

    async def _health(self, method, url, data):
        return self._reply(method, url, {"status": "ok"})

    async def _pair(self, method, url, data):
        if self.pair_gate is not None:
            self.pair_started.set()
            await self.pair_gate.wait()
        d = self.device
        if not d.classic_bt_enabled or data.get("device_name") not in (
            None,
            d.live_name,
        ):
            return self._reply(
                method, url, {"success": False, "error": "device not found"}
            )
        self.paired_mac = LIVE_MAC
        return self._reply(method, url, {"success": True, "mac": LIVE_MAC})

    async def _connect(self, method, url, data):
        if (
            data.get("mac") != self.paired_mac
            or data.get("pin") != self.device.pin_code
        ):
            return self._reply(method, url, {"success": False, "error": "not paired"})
        self.connected = True
        return self._reply(method, url, {"success": True})

    async def _disconnect(self, method, url, data):
        self.connected = False
        self.playing = False
        return self._reply(method, url, {"success": True})

    async def _status(self, method, url, data):
        if self.playing:
            if self._polls_left <= 0:
                self.playing = False
            self._polls_left -= 1
        devices = (
            [{"mac": LIVE_MAC, "name": self.device.live_name}] if self.connected else []
        )
        # Like the real server: is_playing is True while any target plays,
        # and sessions has one entry per target (upper-case MAC)
        sessions = []
        if self.playing:
            sessions.append(
                {"target": LIVE_MAC, "file_path": "/tmp/a", "is_playing": True}
            )
        if self.other_playing:
            sessions.append(
                {"target": OTHER_MAC, "file_path": "/tmp/b", "is_playing": True}
            )
        return self._reply(
            method,
            url,
            {
                "bluetooth": {"devices": devices},
                "audio": {
                    "is_playing": self.playing or self.other_playing,
                    "active_sessions": len(sessions),
                    "sessions": sessions,
                },
            },
        )

    async def _play(self, method, url, data):
        if not self.connected:
            return self._reply(
                method, url, {"success": False, "error": "not connected"}
            )
        d = self.device
        self.plays.append(
            Look(d.eye_icon, d.action, [Light(**vars(x)) for x in d.lights])
        )
        self.playing = True
        self._polls_left = self.clip_polls
        return self._reply(method, url, {"success": True, "is_playing": True})

    async def _stop(self, method, url, data):
        mac = (data or {}).get("mac")
        self.stops.append(mac)
        if mac is None or mac.upper() == LIVE_MAC:
            self.playing = False
        if mac is None or mac.upper() == OTHER_MAC:
            self.other_playing = False
        return self._reply(method, url, {"success": True})

    async def _link_quality(self, method, url, data):
        return self._reply(method, url, {"links": []})
