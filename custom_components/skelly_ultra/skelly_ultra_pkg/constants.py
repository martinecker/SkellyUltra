"""Protocol constants for Skelly Ultra BLE communication.

This module defines all command tags and response prefixes used in the
Skelly Ultra BLE protocol, similar to constants.js in the JavaScript codebase.
"""

# ============================================================================
# COMMAND TAGS (sent TO device)
# ============================================================================

# Query Commands (E series)
CMD_QUERY_DEVICE_PARAMS = "AAE0"
CMD_QUERY_LIVE_MODE = "AAE1"
CMD_QUERY_VOLUME = "AAE5"
CMD_QUERY_LIVE_NAME = "AAE6"
CMD_QUERY_VERSION = "AAEE"

# File Query Commands (D series)
CMD_QUERY_FILE_LIST = "AAD0"
CMD_QUERY_FILE_ORDER = "AAD1"
CMD_QUERY_CAPACITY = "AAD2"

# Media Control Commands (F series - FA to FE)
CMD_SET_VOLUME = "AAFA"
CMD_SET_PIN_AND_NAME = "AAFB"
CMD_PLAY_PAUSE = "AAFC"  # Payload: 01=play, 00=pause
CMD_ENABLE_CLASSIC_BT = "AAFD"
CMD_SET_MUSIC_MODE = "AAFE"

# Light Control Commands (F series - F0 to F9)
CMD_SET_LIGHT_MODE = "AAF2"  # 1=static, 2=strobe, 3=pulsing
CMD_SET_LIGHT_BRIGHTNESS = "AAF3"
CMD_SET_LIGHT_RGB = "AAF4"
CMD_SELECT_RGB_CHANNEL = "AAF5"
CMD_SET_LIGHT_SPEED = "AAF6"
CMD_SET_EYE_ICON = "AAF9"

# Action Control Commands (C series - CA)
CMD_SET_ACTION = "AACA"  # Bitfield: bit0=head, bit1=arm, bit2=torso

# File Transfer Commands (C series - C0 to C8)
CMD_START_SEND_DATA = "AAC0"
CMD_SEND_DATA_CHUNK = "AAC1"
CMD_END_SEND_DATA = "AAC2"
CMD_CONFIRM_FILE = "AAC3"
CMD_CANCEL_SEND = "AAC4"
CMD_RESUME_SEND = "AAC5"
CMD_PLAY_STOP_FILE = "AAC6"  # Payload last byte: 01=play, 00=stop
CMD_DELETE_FILE = "AAC7"
CMD_FORMAT = "AAC8"  # Not currently implemented in commands.py
CMD_SET_FILE_ORDER = "AAC9"

# ============================================================================
# RESPONSE PREFIXES (received FROM device)
# ============================================================================

# Query Responses (BBE series)
RESP_DEVICE_PARAMS = "BBE0"
RESP_LIVE_MODE = "BBE1"
RESP_VOLUME = "BBE5"
RESP_LIVE_NAME = "BBE6"
RESP_ENABLE_CLASSIC_BT = "BBFD"

# File Query Responses (BBD series)
RESP_FILE_INFO = "BBD0"
RESP_FILE_ORDER = "BBD1"
RESP_CAPACITY = "BBD2"

# File Transfer Responses (BBC series)
RESP_START_TRANSFER = "BBC0"
RESP_CHUNK_DROPPED = "BBC1"
RESP_TRANSFER_END = "BBC2"
RESP_TRANSFER_CONFIRM = "BBC3"
RESP_TRANSFER_CANCEL = "BBC4"
RESP_RESUME_WRITE = "BBC5"
RESP_PLAYBACK = "BBC6"
RESP_DELETE_FILE = "BBC7"
RESP_FORMAT = "BBC8"

# Other Responses
RESP_KEEP_ALIVE = "FEDC"

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
    CMD_SET_LIGHT_MODE: "set_light_mode",
    CMD_SET_LIGHT_BRIGHTNESS: "set_light_brightness",
    CMD_SET_LIGHT_RGB: "set_light_rgb",
    CMD_SELECT_RGB_CHANNEL: "select_rgb_channel",
    CMD_SET_LIGHT_SPEED: "set_light_speed",
    CMD_SET_EYE_ICON: "set_eye_icon",
    # Action control commands
    CMD_SET_ACTION: "set_action",
    # File transfer commands
    CMD_START_SEND_DATA: "start_send_data",
    CMD_SEND_DATA_CHUNK: "send_data_chunk",
    CMD_END_SEND_DATA: "end_send_data",
    CMD_CONFIRM_FILE: "confirm_file",
    CMD_CANCEL_SEND: "cancel_send",
    CMD_RESUME_SEND: "resume_send",
    CMD_PLAY_STOP_FILE: "play_stop_file",
    CMD_DELETE_FILE: "delete_file",
    CMD_FORMAT: "format",
    CMD_SET_FILE_ORDER: "set_file_order",
}

RESPONSE_PREFIXES = {
    # Query responses
    RESP_DEVICE_PARAMS: "DeviceParamsEvent",
    RESP_LIVE_MODE: "LiveModeEvent",
    RESP_VOLUME: "VolumeEvent",
    RESP_LIVE_NAME: "LiveNameEvent",
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
