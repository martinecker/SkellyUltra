"""Command builders and utilities for Skelly Ultra.

All functions are pure and return bytes for BLE writes.
"""

from typing import List

WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"


def crc8(data: bytes) -> str:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc >> 1) ^ 0x8C) if (crc & 1) else (crc >> 1)
    return f"{crc:02X}"


def pad_hex(hex_str: str, length: int) -> str:
    return hex_str.zfill(length)


def to_utf16le_hex(s: str) -> str:
    if not s:
        return ""
    return s.encode("utf-16le").hex()


def int_to_hex(n: int, byte_len: int) -> str:
    return pad_hex(hex(n)[2:], byte_len * 2).upper()


def build_cmd(tag: str, payload: str = "00") -> bytes:
    base_str = "AA" + tag + payload
    if len(payload) < 16:
        padding = "0" * (16 - len(payload))
        base_str += padding
    crc = crc8(bytes.fromhex(base_str))
    return bytes.fromhex(base_str + crc)


# Query Commands
def query_device_parameter() -> bytes:
    return build_cmd("E0")


def query_live_mode() -> bytes:
    return build_cmd("E1")


def query_volume() -> bytes:
    return build_cmd("E5")


def query_live_name() -> bytes:
    return build_cmd("E6")


def query_version() -> bytes:
    return build_cmd("EE")


def query_file_info() -> bytes:
    return build_cmd("D0")


def query_song_order() -> bytes:
    return build_cmd("D1")


def query_capacity() -> bytes:
    return build_cmd("D2")


# Media Controls
def set_volume(vol: int) -> bytes:
    return build_cmd("FA", int_to_hex(vol, 1))


def play() -> bytes:
    return build_cmd("FC", "01")


def pause() -> bytes:
    return build_cmd("FC", "00")


def enable_classic_bt() -> bytes:
    return build_cmd("FD", "01")


def set_music_mode(mode: int) -> bytes:
    return build_cmd("FE", int_to_hex(mode, 1))


# Light Controls. If channel == -1 all lights are affected. Otherwise channel is 0-5, but Skelly Ultra only uses 0 and 1.
def set_light_mode(channel: int, mode: int, cluster: int = 0, name: str = "") -> bytes:
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(mode, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd("F2", payload)


def set_light_brightness(
    channel: int, brightness: int, cluster: int = 0, name: str = ""
) -> bytes:
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(brightness, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd("F3", payload)


def set_light_rgb(
    channel: int, r: int, g: int, b: int, loop: int, cluster: int = 0, name: str = ""
) -> bytes:
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(r, 1)
        + int_to_hex(g, 1)
        + int_to_hex(b, 1)
        + int_to_hex(loop, 1)
        + int_to_hex(cluster, 4)
    )
    payload += (name_len + "5C55" + name_utf16) if name else name_len
    return build_cmd("F4", payload)


def set_light_speed(
    channel: int, speed: int, cluster: int = 0, name: str = ""
) -> bytes:
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(speed, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd("F6", payload)


def select_rgb_channel(channel: int) -> bytes:
    return build_cmd("F5", "FF" if channel == -1 else int_to_hex(channel, 1))


def set_eye_icon(icon: int, cluster: int, name: str) -> bytes:
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        int_to_hex(icon, 1)
        + "00"  # 1-byte padding
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd("F9", payload)


# File transfers and other builders (kept minimal for now)
def start_send_data(size: int, max_pack: int, filename: str) -> bytes:
    return build_cmd(
        "C0",
        int_to_hex(size, 4)
        + int_to_hex(max_pack, 2)
        + "5C55"
        + to_utf16le_hex(filename),
    )


def send_data_chunk(index: int, data: bytes) -> bytes:
    return build_cmd("C1", int_to_hex(index, 2) + data.hex().upper())


def end_send_data() -> bytes:
    return build_cmd("C2")


def confirm_file(filename: str) -> bytes:
    return build_cmd("C3", "5C55" + to_utf16le_hex(filename))
