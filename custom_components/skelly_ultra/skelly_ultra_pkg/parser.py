"""Notification parser and event dataclasses for Skelly Ultra.

Pure parsing functions that convert BLE notification bytes into typed events.
"""

from dataclasses import dataclass
from typing import List, Optional, Any, Union
import logging


@dataclass
class LightInfo:
    mode: int  # aka Lighting Type: 1 == static, 2 == strobe, 3 == pulsing
    brightness: int  # 0-255
    rgb: tuple
    effect: int  # 0 == no effect, 1 == cycle all colors
    speed: int  # 0-255, used by mode 2 (strobe) and 3 (pulsing) only


@dataclass
class LiveModeEvent:
    action: int
    eye_icon: int
    lights: List[LightInfo]


@dataclass
class VolumeEvent:
    volume: int


@dataclass
class LiveNameEvent:
    name: str


@dataclass
class DeviceParamsEvent:
    channels: List[
        int
    ]  # list of active channels, will have 6 entries, for Skelly Ultra channel 0 and 1 are used and so will be 1 in the array, all otehrs 0
    pin_code: str
    wifi_password: str
    show_mode: int  # 1 == show/demo mode is active, 0 == regular mode
    name: str  # BT classic name of the device, same as what LiveNameEvent returns


@dataclass
class WifiMacEvent:
    mac: str


@dataclass
class StartTransferEvent:
    failed: int
    written: int


@dataclass
class ChunkDroppedEvent:
    dropped: int
    index: int


@dataclass
class TransferEndEvent:
    failed: int


@dataclass
class ResumeWriteEvent:
    written: int


@dataclass
class PlayPauseEvent:
    serial: int
    playing: bool
    duration: int


@dataclass
class DeleteFileEvent:
    success: bool


@dataclass
class FormatEvent:
    success: int


@dataclass
class CapacityEvent:
    capacity_kb: int
    file_count: int
    mode_str: str


@dataclass
class MusicOrderEvent:
    orders: List[int]


@dataclass
class FileInfoEvent:
    file_index: int
    cluster: int
    total_files: int
    length: int
    attr: int
    eye_icon: int
    db_pos: int
    name: str
    lights: List[LightInfo]


def get_utf16le_from_bytes(b: bytes) -> str:
    try:
        return b.decode("utf-16le").strip("\x00")
    except Exception:
        return ""


def get_ascii(hexpart: str) -> str:
    try:
        return bytes.fromhex(hexpart).decode("ascii").strip()
    except Exception:
        return ""


def parse_notification(
    sender: Any, data: bytes
) -> Optional[
    Union[
        LiveModeEvent,
        VolumeEvent,
        LiveNameEvent,
        DeviceParamsEvent,
        WifiMacEvent,
        StartTransferEvent,
        ChunkDroppedEvent,
        TransferEndEvent,
        ResumeWriteEvent,
        PlayPauseEvent,
        DeleteFileEvent,
        FormatEvent,
        CapacityEvent,
        MusicOrderEvent,
        FileInfoEvent,
    ]
]:
    hexstr = data.hex().upper()

    if hexstr.startswith("BBE1"):
        action = int(hexstr[4:6], 16)
        lights: List[LightInfo] = []
        light_data = hexstr[6:90]
        for i in range(6):
            chunk = light_data[i * 14 : (i + 1) * 14]
            if len(chunk) < 14:
                continue
            mode = int(chunk[0:2], 16)
            brightness = int(chunk[2:4], 16)
            r = int(chunk[4:6], 16)
            g = int(chunk[6:8], 16)
            b = int(chunk[8:10], 16)
            effect = int(chunk[10:12], 16)
            speed = int(chunk[12:14], 16)
            lights.append(
                LightInfo(
                    mode=mode,
                    brightness=brightness,
                    rgb=(r, g, b),
                    effect=effect,
                    speed=speed,
                )
            )
        eye_icon = int(hexstr[90:92], 16)
        return LiveModeEvent(
            action=action,
            eye_icon=eye_icon,
            lights=lights,
        )

    if hexstr.startswith("BBE5"):
        volume = int(hexstr[4:6], 16)
        return VolumeEvent(volume=volume)

    if hexstr.startswith("BBE6"):
        length = int(hexstr[4:6], 16)
        name_hex = hexstr[6 : 6 + length * 2]
        name = get_ascii(name_hex)
        return LiveNameEvent(name=name)

    if hexstr.startswith("BBE0"):
        channels = [int(hexstr[i : i + 2], 16) for i in range(4, 16, 2)]
        pin_code = get_ascii(hexstr[16:24])
        wifi_password = get_ascii(hexstr[24:40])
        show_mode = int(hexstr[40:42], 16)
        name_len = int(hexstr[56:58], 16)
        name = get_ascii(hexstr[58 : 58 + name_len * 2])
        return DeviceParamsEvent(
            channels=channels,
            pin_code=pin_code,
            wifi_password=wifi_password,
            show_mode=show_mode,
            name=name,
        )

    if hexstr.startswith("BBCC"):
        mac = hexstr[4:16]
        return WifiMacEvent(mac=mac)

    if hexstr.startswith("BBC0"):
        failed = int(hexstr[4:6], 16)
        written = int(hexstr[6:14], 16)
        return StartTransferEvent(failed=failed, written=written)

    if hexstr.startswith("BBC1"):
        dropped = int(hexstr[4:6], 16)
        index = int(hexstr[6:10], 16)
        return ChunkDroppedEvent(dropped=dropped, index=index)

    if hexstr.startswith("BBC2"):
        failed = int(hexstr[4:6], 16)
        return TransferEndEvent(failed=failed)

    if hexstr.startswith("BBC3"):
        failed = int(hexstr[4:6], 16)
        return ResumeWriteEvent(written=failed)

    if hexstr.startswith("BBC4"):
        failed = int(hexstr[4:6], 16)
        return TransferEndEvent(failed=failed)

    if hexstr.startswith("BBC5"):
        written = int(hexstr[4:12], 16)
        return ResumeWriteEvent(written=written)

    if hexstr.startswith("BBC6"):
        serial = int(hexstr[4:8], 16)
        playing = int(hexstr[8:10], 16)
        duration = int(hexstr[10:14], 16)
        return PlayPauseEvent(serial=serial, playing=bool(playing), duration=duration)

    if hexstr.startswith("BBC7"):
        success = int(hexstr[4:6], 16)
        return DeleteFileEvent(success=(success == 0))

    if hexstr.startswith("BBC8"):
        success = int(hexstr[4:6], 16)
        return FormatEvent(success=success)

    if hexstr.startswith("BBD2"):
        capacity = int(hexstr[4:12], 16)
        file_count = int(hexstr[12:14], 16)
        action_mode = int(hexstr[14:16], 16)
        mode_str = "Set Action" if action_mode else "Transfer Mode"
        return CapacityEvent(
            capacity_kb=capacity, file_count=file_count, mode_str=mode_str
        )

    if hexstr.startswith("BBD1"):
        count = int(hexstr[4:6], 16)
        data_str = hexstr[6:]
        if len(data_str) < count * 4:
            count = len(data_str) // 4
        orders = [int(data_str[i * 4 : i * 4 + 4], 16) for i in range(count)]
        return MusicOrderEvent(orders=orders)

    if hexstr.startswith("BBD0"):
        file_index = int(hexstr[4:8], 16)
        cluster = int(hexstr[8:16], 16)
        total_files = int(hexstr[16:20], 16)
        length = int(hexstr[20:24], 16)
        attr = int(hexstr[24:26], 16)
        light_data = hexstr[26:110]
        lights: List[LightInfo] = []
        for i in range(6):
            chunk = light_data[i * 14 : (i + 1) * 14]
            if len(chunk) == 14:
                mode = int(chunk[0:2], 16)
                brightness = int(chunk[2:4], 16)
                r = int(chunk[4:6], 16)
                g = int(chunk[6:8], 16)
                b = int(chunk[8:10], 16)
                effect = int(chunk[10:12], 16)
                speed = int(chunk[12:14], 16)
                lights.append(
                    LightInfo(
                        mode=mode,
                        brightness=brightness,
                        rgb=(r, g, b),
                        effect=effect,
                        speed=speed,
                    )
                )
        eye_icon = int(hexstr[110:112], 16)
        db_pos = int(hexstr[112:114], 16)
        try:
            name_utf16 = data[59:-1]
            name = get_utf16le_from_bytes(name_utf16)
        except Exception:
            name = ""
        return FileInfoEvent(
            file_index=file_index,
            cluster=cluster,
            total_files=total_files,
            length=length,
            attr=attr,
            eye_icon=eye_icon,
            db_pos=db_pos,
            name=name,
            lights=lights,
        )

    return None


def handle_notification(sender: Any, data: bytes) -> None:
    """Shim: parse notification and emit debug logs for raw/parsed data.

    Returns the parsed event (or None) for backward compatibility.
    """
    logger = logging.getLogger(__name__)
    # Log raw received bytes as a space-separated hex string for debugging
    try:
        raw_hex = " ".join(f"{b:02X}" for b in data)
    except Exception:
        raw_hex = data.hex().upper()
    logger.debug("[RAW RECV] From %s (%d bytes): %s", sender, len(data), raw_hex)
    parsed = parse_notification(sender, data)
    if parsed is not None:
        logger.debug("[PARSED] %s", parsed)
    else:
        logger.debug("[NOTIFY] No parser match for incoming data")
    return parsed
