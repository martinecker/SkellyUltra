"""A simulated Skelly device that speaks the real BLE protocol.

FakeSkellyDevice stands in for the BleakClient that SkellyClient talks to.
It decodes the command bytes the integration writes (AA.. frames), updates
its own state like the real device does, and answers with notification
bytes (BB.. frames) that go through the integration's real parser.

Tests set up the device's state, drive Home Assistant (services, entities)
and then assert on the device's state or on HA state. They don't depend on
which commands the integration sends to get there.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field

from custom_components.skelly_ultra.skelly_ultra_pkg import commands

CHANNELS = 6


@dataclass
class Light:
    """One light channel's settings, as the device stores them."""

    effect_type: int = 1  # 1 static, 2 strobe, 3 pulse
    brightness: int = 255
    rgb: tuple[int, int, int] = (255, 0, 0)
    color_cycle: int = 0
    effect_speed: int = 0

    def to_bytes(self) -> bytes:
        return bytes(
            [
                self.effect_type,
                self.brightness,
                *self.rgb,
                self.color_cycle,
                self.effect_speed,
            ]
        )


def _lights() -> list[Light]:
    return [Light() for _ in range(CHANNELS)]


@dataclass
class DeviceFile:
    """An audio file stored on the device, with its per-file settings."""

    index: int  # device serial (1-based), what play order and playback use
    cluster: int
    name: str
    duration: int = 5  # seconds
    action: int = 0
    eye_icon: int = 1
    lights: list[Light] = field(default_factory=_lights)
    data: bytes = b""


@dataclass
class Playback:
    file_index: int
    playing: bool


class FakeSkellyDevice:
    """BleakClient stand-in that emulates a Skelly's BLE protocol."""

    def __init__(
        self, address: str = "AA:BB:CC:DD:EE:FF", name: str = "Animated Skelly"
    ):
        self.address = address
        self.name = name
        self.is_connected = False
        self.mtu_size = 247
        self._notify_cb: Callable[[object, bytearray], None] | None = None
        self._disconnected_callback: Callable | None = None
        # Device state
        self.volume = 50
        self.live_name = "Skelly(Live)"
        self.pin_code = "1234"
        self.channels = [1, 1, 0, 0, 0, 0]
        self.show_mode = 0
        self.capacity_kb = 4000
        self.action = 0
        self.eye_icon = 1
        self.lights = _lights()
        self.files: list[DeviceFile] = []
        # Play order: device serials of the enabled files, in order
        self.order: list[int] = []
        self._pending_order: list[tuple[int, int]] = []
        self.playback: list[Playback] = []
        self.classic_bt_enabled = False
        # Upload in progress: (filename, size, chunk count, chunks)
        self._upload: dict | None = None
        # Test knobs
        self.writes: list[bytes] = []  # every command frame received
        self.bad_frames: list[bytes] = []  # frames ignored for a bad checksum
        # Chunks larger than this get lost (an MTU the link can't carry)
        self.max_chunk_payload: int | None = None
        self.unresponsive = False  # swallow queries (simulates a hung device)
        self.fail_connect = False
        self.connect_count = 0
        self.reachable = True  # False: out of range, HA cannot see it

    # ---- helpers for tests -------------------------------------------------

    def add_file(self, name: str, **kw) -> DeviceFile:
        index = max((f.index for f in self.files), default=0) + 1
        f = DeviceFile(index=index, cluster=1000 + index * 10, name=name, **kw)
        self.files.append(f)
        self.order.append(index)
        return f

    def file(self, name: str) -> DeviceFile:
        return next(f for f in self.files if f.name == name)

    def file_names_in_order(self) -> list[str]:
        by_index = {f.index: f.name for f in self.files}
        return [by_index[i] for i in self.order]

    def drop_connection(self, *, notify: bool = True) -> None:
        """Simulate the BLE link dropping (out of range, device reset).

        notify=False: bleak hasn't reported the drop yet, as happens when a
        write fails before the disconnected callback runs.
        """
        self.is_connected = False
        if notify and self._disconnected_callback:
            # Like bleak: after notifications that arrived before the drop.
            asyncio.get_running_loop().call_soon(self._disconnected_callback, self)

    # ---- BleakClient surface used by SkellyClient --------------------------

    def set_disconnected_callback(self, cb: Callable | None) -> None:
        self._disconnected_callback = cb

    async def connect(self, **_kw) -> bool:
        if self.fail_connect:
            raise TimeoutError("device not reachable")
        self.connect_count += 1
        self.is_connected = True
        return True

    async def disconnect(self) -> bool:
        self.is_connected = False
        self._notify_cb = None
        return True

    async def start_notify(self, uuid: str, callback) -> None:
        assert uuid == commands.NOTIFY_UUID
        self._notify_cb = callback

    async def stop_notify(self, uuid: str) -> None:
        self._notify_cb = None

    async def write_gatt_char(
        self, uuid: str, data: bytes, response: bool = False
    ) -> None:
        assert uuid == commands.WRITE_UUID
        if not self.is_connected:
            raise ConnectionError("Not connected")
        data = bytes(data)
        self.writes.append(data)
        self._handle(data)

    # ---- protocol ----------------------------------------------------------

    def _notify(self, frame: bytes) -> None:
        cb = self._notify_cb
        if cb is None or not self.is_connected:
            return
        # Real notifications arrive asynchronously, after the write returned.
        asyncio.get_running_loop().call_soon(cb, self, bytearray(frame))

    def _handle(self, data: bytes) -> None:
        # The real device ignores frames with a bad checksum.
        if commands.crc8(data[:-1]) != f"{data[-1]:02X}":
            self.bad_frames.append(data)
            return
        tag = data[:2].hex().upper()
        p = data[2:-1]  # payload without tag and CRC
        if (
            self.unresponsive
            and tag.startswith("AAE")
            or self.unresponsive
            and tag.startswith("AAD")
        ):
            return
        handler = getattr(self, f"_cmd_{tag}", None)
        if handler is not None:
            handler(p)

    @staticmethod
    def _name_after(p: bytes, offset: int, with_length: bool = True) -> str:
        """Decode a 5C55-marked UTF-16LE name starting at offset."""
        if with_length:
            length = p[offset]
            if length == 0:
                return ""
            raw = p[offset + 1 : offset + 1 + length]
        else:
            raw = p[offset:]
        assert raw[:2] == b"\x5c\x55", f"missing filename marker: {raw.hex()}"
        return raw[2:].decode("utf-16le").rstrip("\x00")

    def _target_lights(self, cluster: int, name: str) -> list[Light]:
        if cluster == 0:
            return self.lights
        f = self._file_by_cluster(cluster)
        assert f.name == name, (
            f"cluster {cluster} is {f.name!r}, command names {name!r}"
        )
        return f.lights

    def _file_by_cluster(self, cluster: int) -> DeviceFile:
        return next(f for f in self.files if f.cluster == cluster)

    def _channels(self, ch: int) -> range:
        return range(CHANNELS) if ch == 0xFF else range(ch, ch + 1)

    # Queries
    def _cmd_AAE0(self, p):  # device params
        name = self.live_name.encode("ascii")
        frame = (
            b"\xbb\xe0"
            + bytes(self.channels)
            + self.pin_code.encode("ascii").ljust(4, b"\x00")
            + b"pass1234"
            + bytes([self.show_mode])
            + bytes(7)
            + bytes([len(name)])
            + name
        )
        self._notify(frame)

    def _cmd_AAE1(self, p):  # live mode
        frame = b"\xbb\xe1" + bytes([self.action])
        frame += b"".join(light.to_bytes() for light in self.lights)
        frame += bytes([self.eye_icon])
        self._notify(frame)

    def _cmd_AAE5(self, p):
        self._notify(bytes([0xBB, 0xE5, self.volume]))

    def _cmd_AAE6(self, p):
        name = self.live_name.encode("ascii")
        self._notify(b"\xbb\xe6" + bytes([len(name)]) + name)

    def _cmd_AAD0(self, p):  # file list: one BBD0 per file
        total = len(self.files)
        for pos, f in enumerate(self.files):
            name = f.name.encode("utf-16le")
            frame = (
                b"\xbb\xd0"
                + f.index.to_bytes(2, "big")
                + f.cluster.to_bytes(4, "big")
                + total.to_bytes(2, "big")
                + bytes(2)
                + bytes([f.action])
                + b"".join(light.to_bytes() for light in f.lights)
                + bytes([f.eye_icon, pos])
                + b"\x5c\x55"
                + name
                + b"\x00"
            )
            self._notify(frame)

    def _cmd_AAD1(self, p):
        frame = b"\xbb\xd1" + bytes([len(self.order)])
        frame += b"".join(i.to_bytes(2, "big") for i in self.order)
        self._notify(frame)

    def _cmd_AAD2(self, p):
        self._notify(
            b"\xbb\xd2"
            + self.capacity_kb.to_bytes(4, "big")
            + bytes([len(self.files), 1])
        )

    def _cmd_AAFD(self, p):
        self.classic_bt_enabled = True
        self._notify(b"\xbb\xfd\x01")

    # Live settings (cluster 0) or per-file settings (cluster > 0)
    def _cmd_AAFA(self, p):
        self.volume = p[0]

    def _cmd_AAF2(self, p):
        cluster = int.from_bytes(p[2:6], "big")
        for ch in self._channels(p[0]):
            self._target_lights(cluster, self._name_after(p, 6))[ch].effect_type = p[1]

    def _cmd_AAF3(self, p):
        cluster = int.from_bytes(p[2:6], "big")
        for ch in self._channels(p[0]):
            self._target_lights(cluster, self._name_after(p, 6))[ch].brightness = p[1]

    def _cmd_AAF4(self, p):
        cluster = int.from_bytes(p[5:9], "big")
        for ch in self._channels(p[0]):
            light = self._target_lights(cluster, self._name_after(p, 9))[ch]
            light.rgb = (p[1], p[2], p[3])
            light.color_cycle = p[4]

    def _cmd_AAF6(self, p):
        cluster = int.from_bytes(p[2:6], "big")
        for ch in self._channels(p[0]):
            self._target_lights(cluster, self._name_after(p, 6))[ch].effect_speed = p[1]

    def _cmd_AAF9(self, p):
        cluster = int.from_bytes(p[2:6], "big")
        if cluster:
            f = self._file_by_cluster(cluster)
            assert f.name == self._name_after(p, 6)
            f.eye_icon = p[0]
        else:
            self.eye_icon = p[0]

    def _cmd_AACA(self, p):
        cluster = int.from_bytes(p[2:6], "big")
        if cluster:
            f = self._file_by_cluster(cluster)
            assert f.name == self._name_after(p, 6)
            f.action = p[0]
        else:
            self.action = p[0]

    # Playback
    def _cmd_AAC6(self, p):
        index = int.from_bytes(p[0:2], "big")
        playing = p[2] == 1
        f = next((f for f in self.files if f.index == index), None)
        duration = f.duration if f else 0
        self.playback.append(Playback(index, playing))
        self._notify(
            b"\xbb\xc6"
            + index.to_bytes(2, "big")
            + bytes([int(playing)])
            + duration.to_bytes(2, "big")
        )

    def finish_playback(self, index: int) -> None:
        """Simulate the device reaching the end of a file it plays."""
        self._notify(b"\xbb\xc6" + index.to_bytes(2, "big") + b"\x00\x00\x00")

    # Play order: the app sends one AAC9 per position; the order takes
    # effect once the last position (index == total) arrives.
    def _cmd_AAC9(self, p):
        total, index, serial = p[0], p[1], int.from_bytes(p[2:4], "big")
        f = next(f for f in self.files if f.index == serial)
        assert f.name == self._name_after(p, 4)
        if index == 1:
            self._pending_order = []
        self._pending_order.append((index, serial))
        if index == total:
            self.order = [s for _, s in sorted(self._pending_order)]
            self._pending_order = []

    def _cmd_AAC7(self, p):  # delete
        index = int.from_bytes(p[0:2], "big")
        cluster = int.from_bytes(p[2:6], "big")
        f = next(
            (f for f in self.files if f.index == index and f.cluster == cluster), None
        )
        if f is None:
            self._notify(b"\xbb\xc7\x01")
            return
        self.files.remove(f)
        self.order = [i for i in self.order if i != index]
        self._notify(b"\xbb\xc7\x00")

    # File transfer
    def _cmd_AAC0(self, p):
        size = int.from_bytes(p[0:4], "big")
        count = int.from_bytes(p[4:6], "big")
        name = self._name_after(p, 6, with_length=False)
        self._upload = {"name": name, "size": size, "count": count, "chunks": {}}
        self._notify(b"\xbb\xc0\x00" + bytes(4))

    def _cmd_AAC1(self, p):
        assert self._upload is not None
        index, chunk = int.from_bytes(p[0:2], "big"), p[2:]
        if self.max_chunk_payload is not None and len(chunk) > self.max_chunk_payload:
            return  # lost on the air
        self._upload["chunks"][index] = chunk

    def _cmd_AAC2(self, p):
        up = self._upload
        ok = up is not None and len(up["chunks"]) == up["count"]
        last = max(up["chunks"], default=0) if up else 0
        self._notify(b"\xbb\xc2" + bytes([0 if ok else 1]) + last.to_bytes(2, "big"))

    def _cmd_AAC3(self, p):
        up = self._upload
        name = self._name_after(p, 0, with_length=False)
        if up is None or up["name"] != name:
            self._notify(b"\xbb\xc3\x01")
            return
        # Chunks were sent padded by build_cmd's frame; keep the declared size.
        data = b"".join(up["chunks"][i] for i in sorted(up["chunks"]))[: up["size"]]
        existing = next((f for f in self.files if f.name == name), None)
        if existing:
            # Overwriting keeps the file's slot but resets its settings.
            existing.data = data
            existing.action, existing.eye_icon, existing.lights = 0, 1, _lights()
        else:
            self.add_file(name, data=data)
        self._upload = None
        self._notify(b"\xbb\xc3\x00")

    def _cmd_AAC4(self, p):
        self._upload = None
        self._notify(b"\xbb\xc4\x00")
