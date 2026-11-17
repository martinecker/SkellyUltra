"""Protocol constants for Skelly Ultra BLE communication.

This module defines all command tags and response prefixes used in the
Skelly Ultra BLE protocol, similar to constants.js in the JavaScript codebase.
The full protocol (frame format, payload and reply layouts, device quirks) is
documented in PROTOCOL.md in the repository root.
"""

from enum import IntEnum

# ============================================================================
# PROTOCOL MARKERS
# ============================================================================

# Marker used before filename/name strings in command payloads
PROTOCOL_MARKER_FILENAME = "5C55"


class LightScene(IntEnum):
    """Light scene preset, in file info (BBD0), live mode (BBE1) and F1."""

    CUSTOM = 0  # each light channel's own settings
    HALLOWEEN = 1
    CHRISTMAS = 2


# Device silently drops an upload whose target filename exceeds this length:
# the transfer/confirm commands still ack with failed=0, but the file never
# appears in the file list afterward. Confirmed empirically: 33 chars works,
# 34 chars fails.
MAX_FILENAME_LENGTH = 33

# ============================================================================
# COMMAND TAGS (sent TO device)
# Frames: AA <tag> <payload, padded to 8 bytes> <crc8>. Payload layouts and
# replies are in PROTOCOL.md (section 6) in the repository root. "Name" is a
# 5C55-marked UTF-16LE file name with a length byte; "bare name" has none.
# ============================================================================

# Queries (payload 00)
CMD_QUERY_DEVICE_PARAMS = "AAE0"  # -> BBE0
CMD_QUERY_LIVE_MODE = "AAE1"  # -> BBE1
CMD_QUERY_VOLUME = "AAE5"  # -> BBE5
CMD_QUERY_LIVE_NAME = "AAE6"  # -> BBE6
CMD_QUERY_VERSION = "AAEE"  # -> BBEE
CMD_QUERY_FILE_LIST = "AAD0"  # -> one BBD0 per file
CMD_QUERY_FILE_ORDER = "AAD1"  # -> BBD1
CMD_QUERY_CAPACITY = "AAD2"  # -> BBD2

# Device settings and media
CMD_SET_VOLUME = "AAFA"  # volume u8 (0-100)
CMD_SET_PIN_AND_NAME = "AAFB"  # PIN 4 ASCII, password 8 ASCII, len, name ASCII
CMD_PLAY_PAUSE = "AAFC"  # 01 play, 00 pause
CMD_ENABLE_CLASSIC_BT = "AAFD"  # 01 -> BBFD; live mode audio link
CMD_SET_MUSIC_MODE = "AAFE"  # 00 device music, 01 classic BT (app no longer sends it)

# Lights: ch is 0-5 or FF (all); cluster 0 + empty name = live settings
CMD_SET_ALL_LIGHTS = "AAF1"  # cluster u32, audioMode, scene, 6 x 7 light bytes
CMD_SET_LIGHT_MODE = "AAF2"  # ch, mode (1-3), cluster u32, name
CMD_SET_LIGHT_BRIGHTNESS = "AAF3"  # ch, brightness, cluster u32, name
CMD_SET_LIGHT_RGB = "AAF4"  # ch, R, G, B, color cycle, cluster u32, name
CMD_SELECT_RGB_CHANNEL = "AAF5"  # ch (the channel the app's picker edits)
CMD_SET_LIGHT_SPEED = "AAF6"  # ch, speed (0 fastest-254 slowest), cluster u32, name

# Movement, eyes and jaw: cluster 0 + empty name = live settings
CMD_SET_EYE_ICON = "AAF9"  # icon (1-based), 00, cluster u32, name
CMD_SET_MOVEMENT_ACTION = "AACA"  # movement bits (per device), 00, cluster u32, name
CMD_SET_JAW_DATA = "AACD"  # cluster u32, byte count, bitmap (1 bit per 60 ms)

# Files
CMD_START_SEND_DATA = "AAC0"  # size u32, chunk count u16, bare name -> BBC0
CMD_SEND_DATA_CHUNK = "AAC1"  # index u16, data (the app sends MTU - 8) -> BBC1
CMD_END_SEND_DATA = "AAC2"  # 00 -> BBC2
CMD_CONFIRM_FILE = "AAC3"  # bare name -> BBC3
CMD_CANCEL_SEND = "AAC4"  # 00 -> BBC4
CMD_RESUME_SEND = "AAC5"  # payload unknown; the app never sends it
CMD_PLAY_STOP_FILE = "AAC6"  # serial u16, 01 play / 00 stop -> BBC6
CMD_DELETE_FILE = "AAC7"  # serial u16, cluster u32 -> BBC7
CMD_FORMAT_DEVICE = "AAC8"  # 00 -> BBC8; erases every file
CMD_SET_FILE_ORDER = "AAC9"  # total, position (1-based), serial u16, name

# Wi-Fi (no known product has it)
CMD_SET_WIFI_POWER = "AACB"  # on/off u8
CMD_QUERY_WIFI_MAC = "AACC"  # 00 -> BBCC

# ============================================================================
# RESPONSE PREFIXES (received FROM device)
# Frames: BB <tag> <payload> <crc8>. Byte layouts are in PROTOCOL.md
# (section 7).
# ============================================================================

# Query replies
RESP_DEVICE_PARAMS = "BBE0"  # channels, PIN, Wi-Fi password, show mode, name
RESP_LIVE_MODE = "BBE1"  # movement, 6 lights, eye icon, scene (scene firmware)
RESP_VOLUME = "BBE5"  # volume
RESP_LIVE_NAME = "BBE6"  # len, classic BT name ASCII
RESP_VERSION = "BBEE"  # firmware version u8, e.g. 0x44 = v68
RESP_ENABLE_CLASSIC_BT = "BBFD"  # classic BT on
RESP_FILE_INFO = "BBD0"  # one file: serial, cluster, total, settings, name
RESP_FILE_ORDER = "BBD1"  # count, serials u16 in play order
RESP_CAPACITY = "BBD2"  # free KB u32, file count, mode

# Upload replies
RESP_START_TRANSFER = "BBC0"  # failed, written u32
RESP_CHUNK_DROPPED = "BBC1"  # lost (0 = none, 1 = resend from index), index u16
RESP_TRANSFER_END = "BBC2"  # failed, last chunk index u16
RESP_TRANSFER_CONFIRM = "BBC3"  # failed
RESP_TRANSFER_CANCEL = "BBC4"  # failed
RESP_RESUME_WRITE = "BBC5"  # written u32 (the app never uses it)

# Other replies
RESP_PLAYBACK = "BBC6"  # serial u16, playing, duration u16 (s); also when a file ends
RESP_DELETE_FILE = "BBC7"  # failed (0 = deleted)
RESP_FORMAT = "BBC8"  # result (0 = done)
RESP_WIFI_MAC = "BBCC"  # Wi-Fi MAC, 6 bytes
RESP_KEEP_ALIVE = "FEDC"  # FE DC <payload> EF, sent by the device on its own

# ============================================================================
# COMMAND LOOKUP DICTIONARIES (for reverse mapping and debugging)
# ============================================================================

COMMAND_TAGS = {
    # Query commands
    CMD_QUERY_DEVICE_PARAMS: "query_device_params",
    CMD_QUERY_LIVE_MODE: "query_live_mode",
    CMD_QUERY_VOLUME: "query_volume",
    CMD_QUERY_LIVE_NAME: "query_live_name",
    CMD_QUERY_VERSION: "query_version",
    # File query commands
    CMD_QUERY_FILE_LIST: "query_file_list",
    CMD_QUERY_FILE_ORDER: "query_file_order",
    CMD_QUERY_CAPACITY: "query_capacity",
    # Media control commands
    CMD_SET_VOLUME: "set_volume",
    CMD_SET_PIN_AND_NAME: "set_pin_and_name",
    CMD_PLAY_PAUSE: "play_pause",
    CMD_ENABLE_CLASSIC_BT: "enable_classic_bt",
    CMD_SET_MUSIC_MODE: "set_music_mode",
    # Light control commands
    CMD_SET_ALL_LIGHTS: "set_all_lights",
    CMD_SET_LIGHT_MODE: "set_light_mode",
    CMD_SET_LIGHT_BRIGHTNESS: "set_light_brightness",
    CMD_SET_LIGHT_RGB: "set_light_rgb",
    CMD_SELECT_RGB_CHANNEL: "select_rgb_channel",
    CMD_SET_LIGHT_SPEED: "set_light_speed",
    CMD_SET_EYE_ICON: "set_eye_icon",
    # Action control commands
    CMD_SET_MOVEMENT_ACTION: "set_movement_action",
    CMD_SET_JAW_DATA: "set_jaw_data",
    # File transfer commands
    CMD_START_SEND_DATA: "start_send_data",
    CMD_SEND_DATA_CHUNK: "send_data_chunk",
    CMD_END_SEND_DATA: "end_send_data",
    CMD_CONFIRM_FILE: "confirm_file",
    CMD_CANCEL_SEND: "cancel_send",
    CMD_RESUME_SEND: "resume_send",
    CMD_PLAY_STOP_FILE: "play_stop_file",
    CMD_DELETE_FILE: "delete_file",
    CMD_FORMAT_DEVICE: "format",
    CMD_SET_FILE_ORDER: "set_file_order",
    # Wi-Fi commands
    CMD_SET_WIFI_POWER: "set_wifi_power",
    CMD_QUERY_WIFI_MAC: "query_wifi_mac",
}

RESPONSE_PREFIXES = {
    # Query responses
    RESP_DEVICE_PARAMS: "DeviceParamsEvent",
    RESP_LIVE_MODE: "LiveModeEvent",
    RESP_VOLUME: "VolumeEvent",
    RESP_LIVE_NAME: "LiveNameEvent",
    RESP_VERSION: "VersionEvent",
    RESP_ENABLE_CLASSIC_BT: "EnableClassicBTEvent",
    # File query responses
    RESP_FILE_INFO: "FileInfoEvent",
    RESP_FILE_ORDER: "FileOrderEvent",
    RESP_CAPACITY: "CapacityEvent",
    # File transfer responses
    RESP_START_TRANSFER: "StartTransferEvent",
    RESP_CHUNK_DROPPED: "ChunkDroppedEvent",
    RESP_TRANSFER_END: "TransferEndEvent",
    RESP_TRANSFER_CONFIRM: "TransferConfirmEvent",
    RESP_TRANSFER_CANCEL: "TransferCancelEvent",
    RESP_RESUME_WRITE: "ResumeWriteEvent",
    RESP_PLAYBACK: "PlaybackEvent",
    RESP_DELETE_FILE: "DeleteFileEvent",
    RESP_FORMAT: "FormatEvent",
    # Other responses
    RESP_KEEP_ALIVE: "KeepAliveEvent",
}
