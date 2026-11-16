"""Tests for parsing the device's notifications."""

from custom_components.skelly_ultra.skelly_ultra_pkg import parser
from custom_components.skelly_ultra.skelly_ultra_pkg.constants import LightScene

# A file info response (BBD0) as a real 12 ft Skelly sends it (from a debug
# log): db_pos takes two bytes, so the name's 5C55 marker is at byte 58
REAL_FILE_INFO = bytes.fromhex(
    "BBD0 0004 00000091 0006 0000 FF"
    " 01FF0000FF0000 01FF0000FF0000 01FF0000FF0000"
    " 01FF0000FF0000 01FF0000FF0000 01FF0000FF0000"
    " 08 0003 5C55"
    " 44006500660061007500 6C007400200053006F00"
    " 75006E0064002000 34002E006D0070003300 09"
)


def test_file_info_from_a_real_device() -> None:
    """The name, eye icon and position are read from a real response."""
    event = parser.parse_notification(None, REAL_FILE_INFO)
    assert isinstance(event, parser.FileInfoEvent)
    assert event.name == "Default Sound 4.mp3"
    assert event.file_index == 4
    assert event.cluster == 0x91
    assert event.total_files == 6
    assert event.eye_icon == 8
    assert event.db_pos == 3
    assert len(event.lights) == 6


def test_file_info_with_a_one_byte_position() -> None:
    """The older layout, with the marker at byte 57, still parses.

    It is the Ultra Skelly v66 layout, without a light scene.
    """
    data = REAL_FILE_INFO[:56] + b"\x03" + REAL_FILE_INFO[58:]
    event = parser.parse_notification(None, data)
    assert isinstance(event, parser.FileInfoEvent)
    assert event.name == "Default Sound 4.mp3"
    assert event.db_pos == 3
    assert event.scene is None


def test_file_info_without_a_name() -> None:
    """A response without the marker gives an empty name."""
    event = parser.parse_notification(None, REAL_FILE_INFO[:58] + b"\x00")
    assert isinstance(event, parser.FileInfoEvent)
    assert event.name == ""


def test_firmware_version() -> None:
    """BBEE carries the version number in its first payload byte."""
    # An Ultra Skelly on v68, padded to 8 bytes like every reply
    event = parser.parse_notification(None, bytes.fromhex("BBEE440000000000"))
    assert event == parser.VersionEvent(version=68)


def test_file_info_scene_comes_before_the_position() -> None:
    """Scene firmware: byte 56 is the light scene, byte 57 the position."""
    data = REAL_FILE_INFO[:56] + bytes([LightScene.CHRISTMAS, 3]) + REAL_FILE_INFO[58:]
    event = parser.parse_notification(None, data)
    assert event.scene is LightScene.CHRISTMAS
    assert event.db_pos == 3
    assert event.name == "Default Sound 4.mp3"


def _live_mode(tail: bytes) -> bytes:
    lights = bytes.fromhex("01FF0000FF0000") * 6
    return b"\xbb\xe1" + b"\x01" + lights + b"\x07" + tail


def test_live_mode_with_scene() -> None:
    """Scene firmware ends the live mode reply with the live scene."""
    event = parser.parse_notification(None, _live_mode(b"\x01\xaa"))  # + CRC
    assert event.eye_icon == 7
    assert event.scene is LightScene.HALLOWEEN


def test_live_mode_without_scene() -> None:
    """Older firmware: the eye icon and the CRC end the reply."""
    event = parser.parse_notification(None, _live_mode(b"\xaa"))  # CRC only
    assert event.eye_icon == 7
    assert event.scene is None


def test_unknown_scene_is_kept_as_a_number() -> None:
    """A scene newer firmware may add still comes through."""
    data = REAL_FILE_INFO[:56] + bytes([7, 3]) + REAL_FILE_INFO[58:]
    event = parser.parse_notification(None, data)
    assert event.scene == 7
    assert event.db_pos == 3
