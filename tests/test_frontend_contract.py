"""The websocket payloads match the fixtures the frontend's types are tested on.

frontend/test/fixtures/ holds one example of each payload. The frontend's
unit tests check that its hand-written types (frontend/src/api/types.ts)
describe these examples; this test checks that the integration sends payloads
of the same shape. Changing a payload without changing the fixture (and so
the frontend) fails here.
"""

import json
from pathlib import Path
from typing import Any

from .device_sim import Light
from .test_websocket import action, ws_devices, ws_list

FIXTURES = Path(__file__).parents[1] / "frontend" / "test" / "fixtures"


def assert_same_shape(actual: Any, example: Any, path: str = "payload") -> None:
    """Check that actual has the example's keys and value types, recursively.

    null matches any type, since optional values are null in one payload and
    set in another. Each list item is compared with the example's first item.
    """
    if actual is None or example is None:
        return
    if isinstance(example, dict):
        assert isinstance(actual, dict), f"{path}: not an object"
        assert set(actual) == set(example), (
            f"{path}: keys differ, "
            f"only sent: {sorted(set(actual) - set(example))}, "
            f"only in the fixture: {sorted(set(example) - set(actual))}"
        )
        for key, value in example.items():
            assert_same_shape(actual[key], value, f"{path}.{key}")
    elif isinstance(example, list):
        assert isinstance(actual, list), f"{path}: not a list"
        if example:
            for index, item in enumerate(actual):
                assert_same_shape(item, example[0], f"{path}[{index}]")
    else:
        # bool is an int in Python; JSON keeps them apart
        assert type(actual) is type(example) or (
            isinstance(actual, (int, float))
            and isinstance(example, (int, float))
            and not isinstance(actual, bool)
            and not isinstance(example, bool)
        ), f"{path}: {type(actual).__name__} instead of {type(example).__name__}"


async def test_payloads_match_the_frontend_fixtures(
    hass, config_entry, mock_ble, device, media_dir, hass_ws_client
):
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    # Fill in the values that are often empty: movements, colors, an eye icon
    hello = device.file("hello.mp3")
    hello.action = 0x01 | 0x04
    hello.eye_icon = 7
    hello.lights[1] = Light(effect_type=3, rgb=(0, 0, 255), color_cycle=1)
    await action(hass, "set_file_order", file_indices=[1])
    client = await hass_ws_client(hass)

    files = await ws_list(client, refresh=True)
    devices = await ws_devices(client)

    assert_same_shape(
        files, json.loads((FIXTURES / "files-payload.json").read_text()), "files"
    )
    assert_same_shape(
        devices, json.loads((FIXTURES / "devices.json").read_text()), "devices"
    )
    assert files["files"] and devices


def test_shape_check_catches_drift():
    example = {"a": 1, "b": [{"c": "x"}], "d": None}
    assert_same_shape({"a": 2, "b": [], "d": "set"}, example)
    for wrong in (
        {"a": 1, "b": []},  # key missing
        {"a": 1, "b": [], "d": None, "e": 0},  # key added
        {"a": "1", "b": [], "d": None},  # type changed
        {"a": True, "b": [], "d": None},  # bool is not a number
        {"a": 1, "b": [{"c": 1}], "d": None},  # list item changed
    ):
        try:
            assert_same_shape(wrong, example)
        except AssertionError:
            continue
        raise AssertionError(f"not caught: {wrong}")
