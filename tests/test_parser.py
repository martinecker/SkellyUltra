"""Tests for parsing the device's notifications."""

from custom_components.skelly_ultra.skelly_ultra_pkg import parser

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
    """The older layout, with the marker at byte 57, still parses."""
    data = REAL_FILE_INFO[:56] + b"\x03" + REAL_FILE_INFO[58:]
    event = parser.parse_notification(None, data)
    assert isinstance(event, parser.FileInfoEvent)
    assert event.name == "Default Sound 4.mp3"
    assert event.db_pos == 3


def test_file_info_without_a_name() -> None:
    """A response without the marker gives an empty name."""
    event = parser.parse_notification(None, REAL_FILE_INFO[:58] + b"\x00")
    assert isinstance(event, parser.FileInfoEvent)
    assert event.name == ""
