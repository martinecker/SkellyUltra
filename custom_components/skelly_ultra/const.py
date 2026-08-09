"""Constants for the Skelly Ultra integration."""

from typing import TypedDict

DOMAIN = "skelly_ultra"

# Config flow constants
CONF_SERVER_URL = "server_url"
CONF_USE_BLE_PROXY = "use_ble_proxy"
DEFAULT_SERVER_URL = "http://localhost:8765"

# Device type constants (stored in entry.data[CONF_DEVICE_TYPE])
CONF_DEVICE_TYPE = "device_type"
DEVICE_TYPE_SKELLY = "ultra_skelly"
DEVICE_TYPE_LILY = "lethal_lily"


class MovementDef(TypedDict):
    part: str
    bit: int


class LightDef(TypedDict):
    label: str
    channel: int


class DeviceProfile(TypedDict):
    display_name: str
    default_name: str
    ble_names: list[str]
    has_eye_image: bool
    movements: list[MovementDef]
    lights: list[LightDef]
    light_modes: list[str]


# Device profiles. Each profile drives entity creation at setup time.
DEVICE_PROFILES: dict[str, DeviceProfile] = {
    DEVICE_TYPE_SKELLY: {
        "display_name": "Ultra Skelly",
        "default_name": "Ultra Skelly v2",
        # Lowercase substrings matched against BLE advertisement names
        "ble_names": ["animated skelly", "ultra skelly"],
        "has_eye_image": True,
        "movements": [
            {"part": "all", "bit": 255},
            {"part": "head", "bit": 0x01},
            {"part": "arm", "bit": 0x02},
            {"part": "torso", "bit": 0x04},
        ],
        "lights": [
            {"label": "Torso Light", "channel": 0},
            {"label": "Head Light", "channel": 1},
        ],
        "light_modes": ["Static", "Strobe", "Pulse"],
    },
    DEVICE_TYPE_LILY: {
        "display_name": "Lethal Lily",
        "default_name": "Lethal Lily",
        "ble_names": ["lethal lily"],
        "has_eye_image": False,
        "movements": [
            {"part": "all", "bit": 255},
            {"part": "wrist", "bit": 0x01},
            {"part": "elbow", "bit": 0x02},
            {"part": "head", "bit": 0x10},
            {"part": "eyes", "bit": 0x20},
        ],
        "lights": [
            {"label": "Lantern", "channel": 0},
        ],
        "light_modes": ["Flickering", "Pulsing", "Chasing"],
    },
}

# Flat list of all BLE name substrings to match during scan filtering (lowercase).
# Derived from DEVICE_PROFILES so it stays in sync automatically.
ALL_BLE_NAME_FILTERS: list[str] = [
    name for profile in DEVICE_PROFILES.values() for name in profile["ble_names"]
]
