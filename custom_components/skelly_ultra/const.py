"""Constants for the Skelly Ultra integration."""

from typing import TypedDict

DOMAIN = "skelly_ultra"

# Config flow constants
CONF_SERVER_URL = "server_url"
CONF_USE_BLE_PROXY = "use_ble_proxy"
DEFAULT_SERVER_URL = "http://localhost:8765"

# Options flow: show the Skelly sidebar panel (on when any loaded entry has it on)
CONF_SHOW_PANEL = "show_panel"
DEFAULT_SHOW_PANEL = True

# Options flow: Home Assistant controls the live light, eye and volume settings.
# On every connect, the last settings HA knew are sent to the device, which
# can show a different look after a power-up than it reports.
CONF_HA_CONTROLS_SETTINGS = "ha_controls_settings"
DEFAULT_HA_CONTROLS_SETTINGS = False

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


class MoodDef(TypedDict):
    """A perform mood in device-neutral terms; each device profile maps it."""

    # Eye icon name: an eye_icons label without its leading number
    eye_icon: str
    # RGB per light channel in profile order, repeating the last one as needed
    colors: list[tuple[int, int, int]]
    color_cycle: bool
    # Key into the profile's mood_light_styles
    light_style: str
    # Key into MOOD_LIGHT_SPEEDS, or None to leave the speed as it is
    light_speed: str | None
    # Key into the profile's mood_movements
    movement: str


class DeviceProfile(TypedDict):
    display_name: str
    default_name: str
    ble_names: list[str]
    has_eye_image: bool
    # Eye icon option labels in device index order (1-based)
    eye_icons: list[str]
    # Folder under images/ with the profile's pictures: eye_icon_<n>.png for
    # each eye icon and movement_<part>.png for each movement part
    image_folder: str
    movements: list[MovementDef]
    lights: list[LightDef]
    light_modes: list[str]
    # Mood light style ("steady", "pulse", "flash") -> light_modes entry
    mood_light_styles: dict[str, str]
    # Mood movement level ("subtle", "full") -> movement parts
    mood_movements: dict[str, list[str]]


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
        "image_folder": "skelly",
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
        "mood_light_styles": {"steady": "Static", "pulse": "Pulse", "flash": "Strobe"},
        "mood_movements": {"subtle": ["head"], "full": ["all"]},
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
        "image_folder": "skelly12ft",
        "movements": [
            {"part": "head", "bit": 0x02},
        ],
        "lights": [
            {"label": "Torso Light", "channel": 0},
        ],
        "light_modes": ["Static", "Strobe", "Pulse"],
        "mood_light_styles": {"steady": "Static", "pulse": "Pulse", "flash": "Strobe"},
        "mood_movements": {"subtle": ["head"], "full": ["head"]},
    },
    DEVICE_TYPE_LILY: {
        "display_name": "Lethal Lily",
        "default_name": "Lethal Lily",
        "ble_names": ["lethal lily"],
        "has_eye_image": False,
        "eye_icons": [],
        "image_folder": "lily",
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
        "mood_light_styles": {
            "steady": "Flickering",
            "pulse": "Pulsing",
            "flash": "Chasing",
        },
        "mood_movements": {"subtle": ["head", "eyes"], "full": ["all"]},
    },
}

# Moods for the skelly_ultra.perform action. The list is fixed and owned by
# the integration; DEVICE_PROFILES translate each one to what a device can do.
MOODS: dict[str, MoodDef] = {
    "friendly": {
        "eye_icon": "Green Eyeball",
        "colors": [(255, 160, 60), (0, 255, 0)],
        "color_cycle": False,
        "light_style": "steady",
        "light_speed": None,
        "movement": "subtle",
    },
    "spooky": {
        "eye_icon": "Color Spiral",
        "colors": [(160, 0, 255)],
        "color_cycle": False,
        "light_style": "pulse",
        "light_speed": "slow",
        "movement": "full",
    },
    "menacing": {
        "eye_icon": "Red Eyeball",
        "colors": [(255, 0, 0)],
        "color_cycle": False,
        "light_style": "flash",
        "light_speed": "fast",
        "movement": "full",
    },
    "playful": {
        "eye_icon": "Fireworks",
        "colors": [(255, 0, 255)],
        "color_cycle": True,
        "light_style": "pulse",
        "light_speed": "fast",
        "movement": "full",
    },
    "mysterious": {
        "eye_icon": "Gray Eyeball",
        "colors": [(0, 60, 255)],
        "color_cycle": False,
        "light_style": "pulse",
        "light_speed": "slow",
        "movement": "subtle",
    },
}

# Mood light speeds in device units (0 = fastest, 254 = slowest)
MOOD_LIGHT_SPEEDS: dict[str, int] = {"slow": 200, "fast": 40}

# Flat list of all BLE name substrings to match during scan filtering (lowercase).
# Derived from DEVICE_PROFILES so it stays in sync automatically.
ALL_BLE_NAME_FILTERS: list[str] = [
    name for profile in DEVICE_PROFILES.values() for name in profile["ble_names"]
]
