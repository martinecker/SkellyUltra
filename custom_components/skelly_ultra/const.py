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
DEVICE_TYPE_SKELLY_12FT = "skelly_12ft"
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
    # Eye icon option labels in device index order (1-based), and the folder
    # under images/ holding eye_icon_<n>.png for each of them.
    eye_icons: list[str]
    eye_icon_folder: str
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
        "eye_icons": [
            "1 Blue Eyeball",
            "2 Yellow Eyeball",
            "3 Green Eyeball",
            "4 Orange Eyeball",
            "5 Red Eyeball",
            "6 Gray Eyeball",
            "7 Yellow Dragon",
            "8 Red Dragon",
            "9 Color Spiral",
            "10 Fire",
            "11 Star",
            "12 Crossbones",
            "13 Fireworks",
            "14 USA Flag",
            "15 Heart",
            "16 Shamrock",
            "17 Snowflake",
            "18 Confetti",
        ],
        "eye_icon_folder": "skelly",
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
    DEVICE_TYPE_SKELLY_12FT: {
        "display_name": "12ft Skelly",
        "default_name": "12ft Skelly",
        "ble_names": ["12ft skelly"],
        "has_eye_image": True,
        "eye_icons": [
            "1 USA Flag",
            "2 Heart",
            "3 Shamrock",
            "4 Snowflake",
            "5 Ice Blue Eyeball",
            "6 Peppermint",
            "7 Cyber Eye",
            "8 Blue Eyeball",
            "9 Yellow Eyeball",
            "10 Green Eyeball",
            "11 Orange Eyeball",
            "12 Red Eyeball",
            "13 Gray Eyeball",
            "14 Yellow Dragon",
            "15 Red Dragon",
            "16 Color Spiral",
            "17 Fire",
            "18 Star",
            "19 Crossbones",
            "20 Fireworks",
        ],
        "eye_icon_folder": "skelly12ft",
        "movements": [
            {"part": "head", "bit": 0x02},
        ],
        "lights": [
            {"label": "Torso Light", "channel": 0},
        ],
        "light_modes": ["Static", "Strobe", "Pulse"],
    },
    DEVICE_TYPE_LILY: {
        "display_name": "Lethal Lily",
        "default_name": "Lethal Lily",
        "ble_names": ["lethal lily"],
        "has_eye_image": False,
        "eye_icons": [],
        "eye_icon_folder": "",
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
