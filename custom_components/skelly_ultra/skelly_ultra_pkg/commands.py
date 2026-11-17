"""Command builders and utilities for Skelly Ultra.

All functions are pure and return bytes for BLE writes.
"""

from collections.abc import Sequence

from . import constants as const
from .parser import LightInfo

WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"

# Value limits
MAX_FILE_INDEX = 0xFFFF  # 65535
MAX_CLUSTER = 0xFFFFFFFF  # 4294967295


def crc8(data: bytes) -> str:
    """Return the frame checksum of data as two hex digits.

    CRC-8 with the reflected polynomial 0x8C (Dallas/Maxim), initial value 0,
    over the whole frame before the checksum, the AA included.
    """
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc >> 1) ^ 0x8C) if (crc & 1) else (crc >> 1)
    return f"{crc:02X}"


def pad_hex(hex_str: str, length: int) -> str:
    """Left-pad hex_str with zeros to length hex digits."""
    return hex_str.zfill(length)


def to_utf16le_hex(s: str) -> str:
    """Return s encoded as UTF-16LE, as lowercase hex ("" for an empty s)."""
    if not s:
        return ""
    return s.encode("utf-16le").hex()


def int_to_hex(n: int, byte_len: int) -> str:
    """Return n big-endian in byte_len bytes, as uppercase hex."""
    return pad_hex(hex(n)[2:], byte_len * 2).upper()


def _build_filename_payload(name: str, with_length: bool = True) -> str:
    """Build filename payload with protocol marker.

    The per-file setting commands (AAF2/F3/F4/F6/F9/AACA/AAC9) require a
    1-byte length prefix (marker + name bytes) before the marker. The file
    transfer commands (AAC0 start_send_data, AAC3 confirm_file) take the
    bare marker instead - the device rejects/ignores a length byte there.

    Args:
        name: Filename or name string to encode
        with_length: Whether to prepend the 1-byte length prefix

    Returns:
        Hex string: [length (1 byte)] + protocol marker + UTF-16LE encoded name
        If name is empty, returns "00"
    """
    if not name:
        return "00"
    name_utf16 = to_utf16le_hex(name)
    marker = const.PROTOCOL_MARKER_FILENAME + name_utf16
    if not with_length:
        return marker
    name_len = int_to_hex((len(name_utf16) // 2) + 2, 1)
    return name_len + marker


def _validate_channel(channel: int) -> None:
    """Raise ValueError unless channel is 0-5, or -1 for all channels."""
    if channel != -1 and not 0 <= channel <= 5:
        raise ValueError(f"Channel must be -1 (all) or 0-5, got {channel}")


def _validate_cluster(cluster: int) -> None:
    """Raise ValueError unless cluster fits in a u32."""
    if not 0 <= cluster <= MAX_CLUSTER:
        raise ValueError(f"Cluster must be between 0 and {MAX_CLUSTER}, got {cluster}")


def _channel_hex(channel: int) -> str:
    """Return the channel byte: FF for -1 (all channels), else the channel."""
    return "FF" if channel == -1 else int_to_hex(channel, 1)


def build_cmd(tag: str, payload: str = "00") -> bytes:
    """Return a command frame: AA tag, payload, CRC.

    tag includes the AA (e.g. "AAE5"); payload is hex. The device expects
    at least 8 payload bytes, so a shorter payload is padded with zeros.
    """
    base_str = tag + payload
    if len(payload) < 16:
        padding = "0" * (16 - len(payload))
        base_str += padding
    crc = crc8(bytes.fromhex(base_str))
    return bytes.fromhex(base_str + crc)


# Query Commands
def query_device_params() -> bytes:
    """E0: ask for the device parameters (channels, PIN, show mode, classic
    BT name). Reply: BBE0.
    """
    return build_cmd(const.CMD_QUERY_DEVICE_PARAMS)


def query_live_mode() -> bytes:
    """E1: ask for the live settings (movement, lights, eye icon and, on
    scene firmware, the light scene). Reply: BBE1.
    """
    return build_cmd(const.CMD_QUERY_LIVE_MODE)


def query_volume() -> bytes:
    """E5: ask for the volume. Reply: BBE5."""
    return build_cmd(const.CMD_QUERY_VOLUME)


def query_live_name() -> bytes:
    """E6: ask for the classic Bluetooth name. Reply: BBE6."""
    return build_cmd(const.CMD_QUERY_LIVE_NAME)


def query_version() -> bytes:
    """EE: ask for the firmware version. Reply: BBEE."""
    return build_cmd(const.CMD_QUERY_VERSION)


def query_file_list() -> bytes:
    """D0: ask for the file list. Reply: one BBD0 per file."""
    return build_cmd(const.CMD_QUERY_FILE_LIST)


def query_file_order() -> bytes:
    """D1: ask for the play order. Reply: BBD1."""
    return build_cmd(const.CMD_QUERY_FILE_ORDER)


def query_capacity() -> bytes:
    """D2: ask for the free space (in KB) and file count. Reply: BBD2."""
    return build_cmd(const.CMD_QUERY_CAPACITY)


# Media Controls
def set_volume(vol: int) -> bytes:
    """FA: set the volume. The app uses 0-100; the byte allows 0-255."""
    if not 0 <= vol <= 255:
        raise ValueError(f"Volume must be between 0 and 255, got {vol}")
    return build_cmd(const.CMD_SET_VOLUME, int_to_hex(vol, 1))


def play() -> bytes:
    """FC 01: resume the device's own playback (pairs with pause())."""
    return build_cmd(const.CMD_PLAY_PAUSE, "01")


def pause() -> bytes:
    """FC 00: pause the device's own playback."""
    return build_cmd(const.CMD_PLAY_PAUSE, "00")


def enable_classic_bt() -> bytes:
    """FD 01: turn on classic Bluetooth, the audio link of live mode.

    Reply: BBFD.
    """
    return build_cmd(const.CMD_ENABLE_CLASSIC_BT, "01")


def set_music_mode(mode: int) -> bytes:
    """FE: switch the audio source (0 device music, 1 classic Bluetooth).

    The phone app no longer sends it.
    """
    if not 0 <= mode <= 255:
        raise ValueError(f"Music mode must be between 0 and 255, got {mode}")
    return build_cmd(const.CMD_SET_MUSIC_MODE, int_to_hex(mode, 1))


# Light Controls
LIGHT_CHANNELS = 6  # F1 always carries this many


def _light_hex(light: LightInfo) -> str:
    """Return one channel's 7 F1 bytes: mode, brightness, R, G, B, color
    cycle, speed. Raise ValueError for a value out of range.
    """
    if not 1 <= light.effect_type <= 3:
        raise ValueError(f"Light mode must be 1, 2, or 3, got {light.effect_type}")
    values = (light.brightness, *light.rgb, light.effect_speed)
    if len(light.rgb) != 3 or not all(0 <= v <= 255 for v in values):
        raise ValueError(f"Light values must be between 0 and 255, got {light}")
    if light.color_cycle not in (0, 1):
        raise ValueError(f"color cycle value must be 0 or 1, got {light.color_cycle}")
    r, g, b = light.rgb
    return "".join(
        int_to_hex(v, 1)
        for v in (
            light.effect_type,
            light.brightness,
            r,
            g,
            b,
            light.color_cycle,
            light.effect_speed,
        )
    )


def set_all_lights(
    lights: Sequence[LightInfo],
    cluster: int = 0,
    scene: int = const.LightScene.CUSTOM,
) -> bytes:
    """F1: set every light channel and the light scene in one command.

    lights are the channels from 0 on (1-6 of them). F1 always carries 6;
    the missing ones repeat the given channels in turn, as the phone app
    fills them. cluster 0 sets the live lights, a file's cluster that file's
    (the app sends audio mode 0 with cluster 0, 1 with a file's cluster).
    Unlike F2-F6 it carries no file name. Only for firmware with the
    set_all_lights capability: older firmware (the v66 Ultra) doesn't know F1.
    """
    if not 1 <= len(lights) <= LIGHT_CHANNELS:
        raise ValueError(
            f"Need 1 to {LIGHT_CHANNELS} light channels, got {len(lights)}"
        )
    _validate_cluster(cluster)
    if not 0 <= scene <= 255:
        raise ValueError(f"Scene must be between 0 and 255, got {scene}")
    channels = [lights[i % len(lights)] for i in range(LIGHT_CHANNELS)]
    payload = (
        int_to_hex(cluster, 4)
        + int_to_hex(0 if cluster == 0 else 1, 1)  # audio mode: live / file
        + int_to_hex(scene, 1)
        + "".join(_light_hex(light) for light in channels)
    )
    return build_cmd(const.CMD_SET_ALL_LIGHTS, payload)


def set_light_mode(
    channel: int, mode: int, cluster: int = 0, filename: str = ""
) -> bytes:
    """F2: set a light channel's mode, 1-3.

    The names depend on the device: Skelly 1 static, 2 strobe, 3 pulsing;
    Lily 1 flickering, 2 pulsing, 3 chasing; Santa 1 static, 2 sparkle,
    3 pulsing. channel is 0-5, or -1 for all channels. cluster 0 with an
    empty filename sets the live lights, else that file's (cluster and name
    both address the file). No reply.
    """
    _validate_channel(channel)
    if not 1 <= mode <= 3:
        raise ValueError(
            f"Light mode must be 1, 2, or 3, got {mode}",
        )
    _validate_cluster(cluster)
    payload = (
        _channel_hex(channel)
        + int_to_hex(mode, 1)
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_LIGHT_MODE, payload)


def set_light_brightness(
    channel: int,
    brightness: int,
    cluster: int = 0,
    filename: str = "",
) -> bytes:
    """F3: set a light channel's brightness, 0-255.

    channel, cluster and filename as for set_light_mode(). No reply.
    """
    _validate_channel(channel)
    if not 0 <= brightness <= 255:
        raise ValueError(f"Brightness must be between 0 and 255, got {brightness}")
    _validate_cluster(cluster)
    payload = (
        _channel_hex(channel)
        + int_to_hex(brightness, 1)
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_LIGHT_BRIGHTNESS, payload)


def set_light_rgb(
    channel: int,
    r: int,
    g: int,
    b: int,
    color_cycle: int,
    cluster: int = 0,
    filename: str = "",
) -> bytes:
    """F4: set a light channel's color, and whether it cycles all colors.

    color_cycle 1 makes the device cycle through the colors instead.
    channel, cluster and filename as for set_light_mode(). No reply.
    """
    _validate_channel(channel)
    if not 0 <= r <= 255:
        raise ValueError(f"Red value must be between 0 and 255, got {r}")
    if not 0 <= g <= 255:
        raise ValueError(f"Green value must be between 0 and 255, got {g}")
    if not 0 <= b <= 255:
        raise ValueError(f"Blue value must be between 0 and 255, got {b}")
    if not 0 <= color_cycle <= 1:
        raise ValueError(f"color cycle value must be 0 or 1, got {color_cycle}")
    _validate_cluster(cluster)
    payload = (
        _channel_hex(channel)
        + int_to_hex(r, 1)
        + int_to_hex(g, 1)
        + int_to_hex(b, 1)
        + int_to_hex(color_cycle, 1)
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_LIGHT_RGB, payload)


def select_rgb_channel(channel: int) -> bytes:
    """F5: pick the channel the phone app's color picker edits.

    channel is 0-5, or -1 for all. What it does on the device is unknown.
    """
    _validate_channel(channel)
    return build_cmd(const.CMD_SELECT_RGB_CHANNEL, _channel_hex(channel))


def set_light_speed(
    channel: int,
    speed: int,
    cluster: int = 0,
    filename: str = "",
) -> bytes:
    """F6: set a light channel's effect speed, 0 fastest to 254 slowest.

    The device also reports 255 for fastest. It only matters for the moving
    modes. channel, cluster and filename as for set_light_mode(). No reply.
    """
    _validate_channel(channel)
    if not 0 <= speed <= 255:
        raise ValueError(f"Speed must be between 0 and 255, got {speed}")
    _validate_cluster(cluster)
    payload = (
        _channel_hex(channel)
        + int_to_hex(speed, 1)
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_LIGHT_SPEED, payload)


def set_eye_icon(icon: int, cluster: int, filename: str) -> bytes:
    """F9: set the eye icon (1-based, as the device profile lists them).

    cluster 0 with an empty filename sets the live eye icon, else that
    file's; a file needs its name too. No reply.
    """
    if not 0 <= icon <= 255:
        raise ValueError(f"Icon must be between 0 and 255, got {icon}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    if not filename and cluster > 0:
        raise ValueError(
            "Filename cannot be empty for set_eye_icon when cluster is specified",
        )
    payload = (
        int_to_hex(icon, 1)
        + "00"  # 1-byte padding
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_EYE_ICON, payload)


def set_movement_action(action: int, cluster: int, filename: str) -> bytes:
    """CA: set which parts move: a bit field, or 255 for all.

    The bits differ per device type (the movements of DEVICE_PROFILES), e.g.
    the 12ft Skelly's head is 0x02. 255 is "all", which the phone app shows
    as an icon of its own. cluster 0 with an empty filename sets the live
    movement, else that file's; a file needs its name too. No reply.
    """
    if not 0 <= action <= 255:
        raise ValueError(f"Action must be between 0 and 255, got {action}")
    if not 0 <= cluster <= 0xFFFFFFFF:
        raise ValueError(f"Cluster must be between 0 and {0xFFFFFFFF}, got {cluster}")
    if not filename and cluster > 0:
        raise ValueError(
            "Filename cannot be empty for set_movement_action when cluster is specified",
        )
    payload = (
        int_to_hex(action, 1)
        + "00"  # 1-byte padding
        + int_to_hex(cluster, 4)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_MOVEMENT_ACTION, payload)


# File transfer and playback
def start_send_data(size: int, chunk_count: int, filename: str) -> bytes:
    """C0: start an upload of size bytes in chunk_count chunks.

    filename goes without a length byte (the device rejects one here).
    Reply: BBC0 (failed, bytes already written). See FileTransferManager.
    """
    if not 0 <= size <= 0xFFFFFFFF:
        raise ValueError(f"Size must be between 0 and {0xFFFFFFFF}, got {size}")
    if not 0 <= chunk_count <= 0xFFFF:
        raise ValueError(
            f"Chunk count must be between 0 and {0xFFFF}, got {chunk_count}",
        )
    if not filename:
        raise ValueError("Filename cannot be empty")
    return build_cmd(
        const.CMD_START_SEND_DATA,
        int_to_hex(size, 4)
        + int_to_hex(chunk_count, 2)
        + _build_filename_payload(filename, with_length=False),
    )


def send_data_chunk(index: int, data: bytes) -> bytes:
    """C1: one chunk of an upload, index 0-based.

    The frame must fit one BLE write (MTU - 3 bytes), so data is at most
    MTU - 8 bytes. The device reports a lost chunk with BBC1 01 <index>.
    """
    if not 0 <= index <= 0xFFFF:
        raise ValueError(f"Index must be between 0 and {0xFFFF}, got {index}")
    if not data:
        raise ValueError("Data cannot be empty")
    return build_cmd(
        const.CMD_SEND_DATA_CHUNK,
        int_to_hex(index, 2) + data.hex().upper(),
    )


def end_send_data() -> bytes:
    """C2: all chunks sent. Reply: BBC2 (failed = 0 when the device has
    every chunk).
    """
    return build_cmd(const.CMD_END_SEND_DATA)


def confirm_file(filename: str) -> bytes:
    """C3: store the uploaded file under filename (no length byte).

    Reply: BBC3 (failed = 0 when stored).
    """
    if not filename:
        raise ValueError("Filename cannot be empty")
    return build_cmd(
        const.CMD_CONFIRM_FILE,
        _build_filename_payload(filename, with_length=False),
    )


def cancel_send() -> bytes:
    """C4: cancel the upload in progress. Reply: BBC4."""
    return build_cmd(const.CMD_CANCEL_SEND)


def format_device() -> bytes:
    """C8: erase every file on the device, the default sounds included.

    Reply: BBC8. Cannot be undone.
    """
    return build_cmd(const.CMD_FORMAT_DEVICE)


def play_file(file_index: int) -> bytes:
    """C6 01: play the file with this serial (1-based).

    Reply: BBC6 (serial, playing, duration), and another one when the file
    ends.
    """
    if not 0 <= file_index <= 0xFFFF:
        raise ValueError(f"File index must be between 0 and {0xFFFF}, got {file_index}")
    return build_cmd(const.CMD_PLAY_STOP_FILE, int_to_hex(file_index, 2) + "01")


def stop_file(file_index: int) -> bytes:
    """C6 00: stop the file with this serial.

    Args:
        file_index: The file's serial (1-based, 0-65535)

    Returns:
        Command bytes to send via BLE

    Raises:
        ValueError: If file_index is out of valid range
    """
    if not 0 <= file_index <= MAX_FILE_INDEX:
        msg = f"File index must be between 0 and {MAX_FILE_INDEX}, got {file_index}"
        raise ValueError(msg)
    return build_cmd(const.CMD_PLAY_STOP_FILE, int_to_hex(file_index, 2) + "00")


def set_file_order(total: int, index: int, file_serial: int, filename: str) -> bytes:
    """Set a file's position in the play order (AAC9).

    Args:
        total: Count of enabled files in the play order
        index: 1-indexed position of this file within the play order
        file_serial: Device-assigned serial of the file
        filename: Filename to address (required, length-prefixed like the
            other per-file setting commands)
    """
    if not 0 <= total <= 0xFF:
        raise ValueError(f"Total must be between 0 and 255, got {total}")
    if not 0 <= index <= 0xFF:
        raise ValueError(f"Index must be between 0 and 255, got {index}")
    if not 0 <= file_serial <= 0xFFFF:
        raise ValueError(
            f"File serial must be between 0 and {0xFFFF}, got {file_serial}"
        )
    if not filename:
        raise ValueError("Filename cannot be empty")
    payload = (
        int_to_hex(total, 1)
        + int_to_hex(index, 1)
        + int_to_hex(file_serial, 2)
        + _build_filename_payload(filename)
    )
    return build_cmd(const.CMD_SET_FILE_ORDER, payload)


def delete_file(file_index: int, cluster: int) -> bytes:
    """C7: delete a file from the device. Reply: BBC7 (0 = deleted).

    Args:
        file_index: The file's serial (1-based, 0-65535)
        cluster: The file's cluster (0-4294967295); both must match

    Returns:
        Command bytes to send via BLE

    Raises:
        ValueError: If file_index or cluster is out of valid range
    """
    if not 0 <= file_index <= MAX_FILE_INDEX:
        msg = f"File index must be between 0 and {MAX_FILE_INDEX}, got {file_index}"
        raise ValueError(msg)
    if not 0 <= cluster <= MAX_CLUSTER:
        msg = f"Cluster must be between 0 and {MAX_CLUSTER}, got {cluster}"
        raise ValueError(msg)
    return build_cmd(
        const.CMD_DELETE_FILE,
        int_to_hex(file_index, 2) + int_to_hex(cluster, 4),
    )
