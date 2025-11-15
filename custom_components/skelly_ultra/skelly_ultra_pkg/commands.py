"""Command builders and utilities for Skelly Ultra.

All functions are pure and return bytes for BLE writes.
"""

from . import constants as const

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
    base_str = tag + payload
    if len(payload) < 16:
        padding = "0" * (16 - len(payload))
        base_str += padding
    crc = crc8(bytes.fromhex(base_str))
    return bytes.fromhex(base_str + crc)


# Query Commands
def query_device_params() -> bytes:
    return build_cmd(const.CMD_QUERY_DEVICE_PARAMS)


def query_live_mode() -> bytes:
    return build_cmd(const.CMD_QUERY_LIVE_MODE)


def query_volume() -> bytes:
    return build_cmd(const.CMD_QUERY_VOLUME)


def query_live_name() -> bytes:
    return build_cmd(const.CMD_QUERY_LIVE_NAME)


def query_version() -> bytes:
    return build_cmd(const.CMD_QUERY_VERSION)


def query_file_list() -> bytes:
    return build_cmd(const.CMD_QUERY_FILE_LIST)


def query_file_order() -> bytes:
    return build_cmd(const.CMD_QUERY_FILE_ORDER)


def query_capacity() -> bytes:
    return build_cmd(const.CMD_QUERY_CAPACITY)


# Media Controls
def set_volume(vol: int) -> bytes:
    if not 0 <= vol <= 255:
        raise ValueError(f"Volume must be between 0 and 255, got {vol}")
    return build_cmd(const.CMD_SET_VOLUME, int_to_hex(vol, 1))


def play() -> bytes:
    return build_cmd(const.CMD_PLAY_PAUSE, "01")


def pause() -> bytes:
    return build_cmd(const.CMD_PLAY_PAUSE, "00")


def enable_classic_bt() -> bytes:
    return build_cmd(const.CMD_ENABLE_CLASSIC_BT, "01")


def set_music_mode(mode: int) -> bytes:
    if not 0 <= mode <= 255:
        raise ValueError(f"Music mode must be between 0 and 255, got {mode}")
    return build_cmd(const.CMD_SET_MUSIC_MODE, int_to_hex(mode, 1))


# Light Controls. If channel == -1 all lights are affected. Otherwise channel is 0-5, but Skelly Ultra only uses 0 and 1.


# Sets the light mode aka Lighting Type: 1 == static, 2 == strobe, 3 == pulsing
def set_light_mode(channel: int, mode: int, cluster: int = 0, name: str = "") -> bytes:
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")
    if not 1 <= mode <= 3:
        raise ValueError(
            f"Light mode must be 1 (static), 2 (strobe), or 3 (pulsing), got {mode}"
        )
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(mode, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd(const.CMD_SET_LIGHT_MODE, payload)


def set_light_brightness(
    channel: int, brightness: int, cluster: int = 0, name: str = ""
) -> bytes:
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")
    if not 0 <= brightness <= 255:
        raise ValueError(f"Brightness must be between 0 and 255, got {brightness}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(brightness, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd(const.CMD_SET_LIGHT_BRIGHTNESS, payload)


def set_light_rgb(
    channel: int, r: int, g: int, b: int, loop: int, cluster: int = 0, name: str = ""
) -> bytes:
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")
    if not 0 <= r <= 255:
        raise ValueError(f"Red value must be between 0 and 255, got {r}")
    if not 0 <= g <= 255:
        raise ValueError(f"Green value must be between 0 and 255, got {g}")
    if not 0 <= b <= 255:
        raise ValueError(f"Blue value must be between 0 and 255, got {b}")
    if not 0 <= loop <= 255:
        raise ValueError(f"Loop value must be between 0 and 255, got {loop}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
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
    return build_cmd(const.CMD_SET_LIGHT_RGB, payload)


def set_light_speed(
    channel: int, speed: int, cluster: int = 0, name: str = ""
) -> bytes:
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")
    if not 0 <= speed <= 255:
        raise ValueError(f"Speed must be between 0 and 255, got {speed}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    ch = "FF" if channel == -1 else int_to_hex(channel, 1)
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        ch
        + int_to_hex(speed, 1)
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd(const.CMD_SET_LIGHT_SPEED, payload)


def select_rgb_channel(channel: int) -> bytes:
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")
    return build_cmd(
        const.CMD_SELECT_RGB_CHANNEL, "FF" if channel == -1 else int_to_hex(channel, 1)
    )


def set_eye_icon(icon: int, cluster: int, name: str) -> bytes:
    if not 0 <= icon <= 255:
        raise ValueError(f"Icon must be between 0 and 255, got {icon}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    if not name and cluster > 0:
        raise ValueError(
            "Name cannot be empty for set_eye_icon when cluster is specified"
        )
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        int_to_hex(icon, 1)
        + "00"  # 1-byte padding
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd(const.CMD_SET_EYE_ICON, payload)


# Action here is a bitfield where bit 0 = head, bit 1 = arm, bit 2 = torso.
# If a bit is set movement for that body part is enabled, otherwise disabled.
# Can send a value of 255 to enable all (head+arm+torso) which in the phone app has a unique icon.
def set_action(action: int, cluster: int, name: str) -> bytes:
    if not 0 <= action <= 255:
        raise ValueError(f"Action must be between 0 and 255, got {action}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    if not name and cluster > 0:
        raise ValueError(
            "Name cannot be empty for set_action when cluster is specified"
        )
    name_utf16 = to_utf16le_hex(name)
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1) if name else "00"
    payload = (
        int_to_hex(action, 1)
        + "00"  # 1-byte padding
        + int_to_hex(cluster, 4)
        + (name_len + "5C55" + name_utf16 if name else name_len)
    )
    return build_cmd(const.CMD_SET_ACTION, payload)


# File transfer and playback
def start_send_data(size: int, chunk_count: int, filename: str) -> bytes:
    if not 0 <= size <= 0xFFFFFFFF:
        raise ValueError(f"Size must be between 0 and {0xFFFFFFFF}, got {size}")
    if not 0 <= chunk_count <= 0xFFFF:
        raise ValueError(
            f"Chunk count must be between 0 and {0xFFFF}, got {chunk_count}"
        )
    if not filename:
        raise ValueError("Filename cannot be empty")
    return build_cmd(
        const.CMD_START_SEND_DATA,
        int_to_hex(size, 4)
        + int_to_hex(chunk_count, 2)
        + "5C55"
        + to_utf16le_hex(filename),
    )


def send_data_chunk(index: int, data: bytes) -> bytes:
    if not 0 <= index <= 0xFFFF:
        raise ValueError(f"Index must be between 0 and {0xFFFF}, got {index}")
    if not data:
        raise ValueError("Data cannot be empty")
    return build_cmd(
        const.CMD_SEND_DATA_CHUNK, int_to_hex(index, 2) + data.hex().upper()
    )


def end_send_data() -> bytes:
    return build_cmd(const.CMD_END_SEND_DATA)


def confirm_file(filename: str) -> bytes:
    if not filename:
        raise ValueError("Filename cannot be empty")
    return build_cmd(const.CMD_CONFIRM_FILE, "5C55" + to_utf16le_hex(filename))


def cancel_send() -> bytes:
    return build_cmd(const.CMD_CANCEL_SEND)


def play_file(file_index: int) -> bytes:
    if not 0 <= file_index <= 0xFFFF:
        raise ValueError(f"File index must be between 0 and {0xFFFF}, got {file_index}")
    return build_cmd(const.CMD_PLAY_STOP_FILE, int_to_hex(file_index, 2) + "01")


def stop_file(file_index: int) -> bytes:
    if not 0 <= file_index <= 0xFFFF:
        raise ValueError(f"File index must be between 0 and {0xFFFF}, got {file_index}")
    return build_cmd(const.CMD_PLAY_STOP_FILE, int_to_hex(file_index, 2) + "00")


def delete_file(file_index: int, cluster: int) -> bytes:
    if not 0 <= file_index <= 0xFFFF:
        raise ValueError(f"File index must be between 0 and {0xFFFF}, got {file_index}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    return build_cmd(
        const.CMD_DELETE_FILE, int_to_hex(file_index, 2) + int_to_hex(cluster, 4)
    )
