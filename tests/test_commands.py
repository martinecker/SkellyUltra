"""Command frames built byte for byte (no device needed)."""

import pytest

from custom_components.skelly_ultra.skelly_ultra_pkg import commands
from custom_components.skelly_ultra.skelly_ultra_pkg.constants import LightScene
from custom_components.skelly_ultra.skelly_ultra_pkg.parser import LightInfo

RED = LightInfo(
    effect_type=1, brightness=200, rgb=(255, 0, 0), color_cycle=0, effect_speed=0
)
BLUE = LightInfo(
    effect_type=3, brightness=100, rgb=(0, 0, 255), color_cycle=1, effect_speed=40
)
RED_HEX = "01C8FF00000000"
BLUE_HEX = "036400 00FF0128".replace(" ", "")


def unframe(frame: bytes) -> str:
    """The payload of a frame, after checking its tag and checksum."""
    assert frame[:2] == b"\xaa\xf1"
    assert commands.crc8(frame[:-1]) == frame[-1:].hex().upper()
    return frame[2:-1].hex().upper()


def test_set_all_lights_live():
    """Cluster 0 is the live lights: audio mode 0, then scene and 6 channels."""
    payload = unframe(commands.set_all_lights([RED, BLUE, RED, BLUE, RED, BLUE]))
    assert payload == "00000000" + "00" + "00" + (RED_HEX + BLUE_HEX) * 3


def test_set_all_lights_for_a_file_with_a_scene():
    """A file's cluster comes with audio mode 1, like in the phone app."""
    payload = unframe(
        commands.set_all_lights(
            [RED] * 6, cluster=0x12345678, scene=LightScene.HALLOWEEN
        )
    )
    assert payload[:12] == "12345678" + "01" + "01"
    assert payload[12:] == RED_HEX * 6


@pytest.mark.parametrize(
    ("given", "sent"),
    [
        ([RED], [RED_HEX] * 6),  # one light (Lily, Santa): all 6 the same
        ([RED, BLUE], [RED_HEX, BLUE_HEX] * 3),  # the given ones in turn
        (
            [RED, BLUE, BLUE, RED],
            [RED_HEX, BLUE_HEX, BLUE_HEX, RED_HEX, RED_HEX, BLUE_HEX],
        ),
    ],
)
def test_set_all_lights_fills_missing_channels_like_the_app(given, sent):
    payload = unframe(commands.set_all_lights(given))
    assert payload[12:] == "".join(sent)


@pytest.mark.parametrize(
    ("lights", "kwargs"),
    [
        ([], {}),
        ([RED] * 7, {}),
        ([LightInfo(0, 0, (0, 0, 0), 0, 0)], {}),  # mode 0
        ([LightInfo(1, 256, (0, 0, 0), 0, 0)], {}),
        ([LightInfo(1, 0, (0, 0), 0, 0)], {}),
        ([LightInfo(1, 0, (0, 0, 0), 2, 0)], {}),
        ([RED], {"cluster": -1}),
        ([RED], {"scene": 256}),
    ],
)
def test_set_all_lights_refuses_bad_values(lights, kwargs):
    with pytest.raises(ValueError):
        commands.set_all_lights(lights, **kwargs)
