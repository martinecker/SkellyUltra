"""Managing the files on the Skelly: upload, delete, per-file settings, order."""

import shutil
import subprocess

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra import file_order, file_settings
from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    DEVICE_TYPE_LILY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)

from .conftest import entity_id
from .device_sim import Light

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")


@pytest.fixture(autouse=True)
def no_write_delays(monkeypatch):
    """The device needs pauses between setting writes; the simulator doesn't."""
    monkeypatch.setattr(file_settings, "FILE_SETTING_WRITE_DELAY", 0)
    monkeypatch.setattr(file_order, "FILE_ORDER_WRITE_DELAY", 0)


async def action(hass: HomeAssistant, service: str, response: bool = False, **data):
    result = await hass.services.async_call(
        DOMAIN, service, data, blocking=True, return_response=response
    )
    await hass.async_block_till_done()
    return result


def sensor(hass, entry, suffix) -> str:
    return hass.states.get(entity_id(hass, entry, "sensor", suffix)).state


# ---- upload --------------------------------------------------------------


@pytest.fixture
def tone(tmp_path):
    """A one-second WAV file."""
    path = tmp_path / "tone.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            str(path),
        ],
        check=True,
    )
    return path


@needs_ffmpeg
async def test_send_file_uploads_as_mp3(hass, setup_integration, device, tone):
    entry = setup_integration
    result = await action(
        hass,
        "send_file",
        response=True,
        file_path=str(tone),
        target_filename="Boo Sound.wav",
    )
    uploaded = device.file("Boo Sound.mp3")
    assert uploaded.data[:3] == b"ID3" or uploaded.data[0] == 0xFF, "MP3 data"
    assert result == {"filename": "Boo Sound.mp3", "file_index": uploaded.index}
    # Shows up in Home Assistant without waiting for a poll.
    assert sensor(hass, entry, "file_count_received") == "4"


@needs_ffmpeg
async def test_send_file_uses_the_transfer_overrides(
    hass, setup_integration, device, tone, monkeypatch
):
    """Turning on the override switches makes uploads use their values."""
    from custom_components.skelly_ultra import uploads

    entry = setup_integration
    used = {}
    send_file = uploads.FileTransferManager.send_file
    process_file = uploads.AudioProcessor.process_file

    async def spy_send(self, client, data, name, progress=None, chunk_size=None):
        used["chunk_size"] = chunk_size
        return await send_file(self, client, data, name, progress, chunk_size)

    def spy_process(path, output=None, bitrate=None):
        used["bitrate"] = bitrate
        return process_file(path, output, bitrate)

    monkeypatch.setattr(uploads.FileTransferManager, "send_file", spy_send)
    monkeypatch.setattr(uploads.AudioProcessor, "process_file", spy_process)

    await action(hass, "send_file", file_path=str(tone), target_filename="a.mp3")
    assert used == {"chunk_size": None, "bitrate": None}

    for domain, service, suffix, data in (
        ("switch", "turn_on", "override_chunk_size", {}),
        ("number", "set_value", "chunk_size", {"value": 300}),
        ("switch", "turn_on", "override_bitrate", {}),
        ("select", "select_option", "bitrate", {"option": "64k"}),
    ):
        await hass.services.async_call(
            domain,
            service,
            {"entity_id": entity_id(hass, entry, domain, suffix), **data},
            blocking=True,
        )
    await action(hass, "send_file", file_path=str(tone), target_filename="b.mp3")
    assert used == {"chunk_size": 300, "bitrate": "64k"}
    assert device.file("b.mp3").data


@needs_ffmpeg
async def test_overwriting_a_file_keeps_its_settings(
    hass, setup_integration, device, tone
):
    await action(
        hass,
        "edit_file",
        filename="laugh.mp3",
        movements=["torso"],
        eye_icon=9,
        lights={
            "channel": 0,
            "effect_mode": "Pulse",
            "brightness": 90,
            "rgb": [0, 0, 255],
        },
    )
    laugh = device.file("laugh.mp3")
    settings = (laugh.action, laugh.eye_icon, list(laugh.lights))
    await action(hass, "send_file", file_path=str(tone), target_filename="laugh.mp3")
    assert laugh.data, "new audio stored"
    assert (laugh.action, laugh.eye_icon, laugh.lights) == settings


async def test_too_long_filename_is_refused_before_upload(
    hass, setup_integration, device, tmp_path
):
    src = tmp_path / "x.mp3"
    src.write_bytes(b"not used")
    with pytest.raises(HomeAssistantError, match="exceeds"):
        await action(
            hass, "send_file", file_path=str(src), target_filename="a" * 40 + ".mp3"
        )
    assert not any(w[:2] == b"\xaa\xc0" for w in device.writes)


async def test_missing_source_file(hass, setup_integration, device):
    with pytest.raises(HomeAssistantError, match="not found"):
        await action(
            hass, "send_file", file_path="/nope/missing.mp3", target_filename="x.mp3"
        )


async def test_cancel_without_transfer(hass, setup_integration):
    with pytest.raises(HomeAssistantError, match="No file transfer"):
        await action(hass, "cancel_file_transfer")


# ---- delete --------------------------------------------------------------


async def test_delete_by_name(hass, setup_integration, device):
    entry = setup_integration
    await action(hass, "delete_file", filename="laugh.mp3")
    assert [f.name for f in device.files] == ["hello.mp3", "scream.mp3"]
    assert sensor(hass, entry, "file_count_received") == "2"


async def test_delete_by_index_needs_matching_cluster(hass, setup_integration, device):
    f = device.file("hello.mp3")
    with pytest.raises(HomeAssistantError, match="not found"):
        await action(hass, "delete_file", file_index=f.index, cluster=f.cluster + 1)
    await action(hass, "delete_file", file_index=f.index, cluster=f.cluster)
    assert "hello.mp3" not in [x.name for x in device.files]


async def test_delete_unknown_file(hass, setup_integration, device):
    with pytest.raises(HomeAssistantError, match="not found"):
        await action(hass, "delete_file", filename="nope.mp3")
    assert len(device.files) == 3


# ---- per-file settings (edit_file) -----------------------------------------


async def test_edit_file_changes_only_given_settings(hass, setup_integration, device):
    f = device.file("scream.mp3")
    f.action, f.eye_icon = 0x01, 3
    f.lights[1] = Light(effect_type=2, brightness=100, rgb=(255, 0, 0), effect_speed=50)
    other = device.file("hello.mp3")
    other_before = (other.action, other.eye_icon, list(other.lights))
    live_before = (device.action, device.eye_icon, list(device.lights))

    await action(
        hass,
        "edit_file",
        filename="scream.mp3",
        eye_icon=5,
        lights=[
            {"channel": 1, "effect_mode": "Pulse"},
            {"channel": 0, "rgb": [0, 255, 0]},
        ],
    )
    assert f.eye_icon == 5
    assert f.action == 0x01, "movement left out: kept"
    assert f.lights[1] == Light(
        effect_type=3, brightness=100, rgb=(255, 0, 0), effect_speed=50
    )
    assert f.lights[0].rgb == (0, 255, 0)
    assert (other.action, other.eye_icon, other.lights) == other_before, (
        "other files untouched"
    )
    assert (device.action, device.eye_icon, device.lights) == live_before, (
        "live settings untouched"
    )


async def test_edit_file_movements_by_part_name(hass, setup_integration, device):
    await action(hass, "edit_file", filename="hello.mp3", movements=["arm", "torso"])
    assert device.file("hello.mp3").action == 0x06
    await action(hass, "edit_file", filename="hello.mp3", movements=["all"])
    assert device.file("hello.mp3").action == 255
    await action(hass, "edit_file", filename="hello.mp3", movements=[])
    assert device.file("hello.mp3").action == 0


@pytest.mark.parametrize(
    ("device_type", "parts", "bits"),
    [
        (DEVICE_TYPE_SKELLY_12FT, ["head"], 0x02),
        (DEVICE_TYPE_LILY, ["wrist", "eyes"], 0x21),
        (DEVICE_TYPE_LILY, ["all"], 255),
    ],
)
async def test_edit_file_movement_bits_follow_device_profile(
    hass, mock_ble, device_type, parts, bits
):
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"address": mock_ble.address, CONF_DEVICE_TYPE: device_type},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await action(hass, "edit_file", filename="hello.mp3", movements=parts)
    assert mock_ble.file("hello.mp3").action == bits
    # Parts of other models are refused
    with pytest.raises(HomeAssistantError, match="Unknown movement"):
        await action(hass, "edit_file", filename="hello.mp3", movements=["torso"])


async def test_edit_file_sends_nothing_when_unchanged(hass, setup_integration, device):
    f = device.file("hello.mp3")
    f.eye_icon = 4
    device.writes.clear()
    await action(hass, "edit_file", filename="hello.mp3", eye_icon=4)
    assert not any(w[:2] == b"\xaa\xf9" for w in device.writes), (
        "slow device writes avoided"
    )


async def test_edit_file_color_cycle_keeps_color(hass, setup_integration, device):
    f = device.file("hello.mp3")
    f.lights[0].rgb = (12, 34, 56)
    await action(
        hass,
        "edit_file",
        filename="hello.mp3",
        lights={"channel": 0, "color_cycle": True},
    )
    assert f.lights[0].color_cycle == 1
    assert f.lights[0].rgb == (12, 34, 56)


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"filename": "nope.mp3", "eye_icon": 2}, "not found"),
        ({"filename": "hello.mp3", "eye_icon": 19}, "eye_icon must be 1-18"),
        (
            {"filename": "hello.mp3", "lights": [{"channel": 2, "brightness": 1}]},
            "no light channel 2",
        ),
        (
            {
                "filename": "hello.mp3",
                "lights": [{"channel": 0, "effect_mode": "Flicker"}],
            },
            "unknown effect_mode",
        ),
        (
            {"filename": "hello.mp3", "lights": [{"channel": 0, "rgb": [1, 2]}]},
            r"rgb must be \[r, g, b\]",
        ),
        ({"filename": "hello.mp3", "movements": ["tail"]}, "Unknown movement"),
        (
            {"filename": "hello.mp3", "file_index": 1, "eye_icon": 2},
            "Cannot specify both",
        ),
    ],
)
async def test_edit_file_rejects_bad_input_without_touching_device(
    hass, setup_integration, device, data, message
):
    before = [(f.action, f.eye_icon, list(f.lights)) for f in device.files]
    with pytest.raises(HomeAssistantError, match=message):
        await action(hass, "edit_file", **data)
    assert [(f.action, f.eye_icon, f.lights) for f in device.files] == before


async def test_edit_file_refused_while_playing(hass, setup_integration, device):
    from .conftest import coordinator

    coordinator(hass, setup_integration).mark_playback_active(30)
    with pytest.raises(HomeAssistantError, match="playing a file"):
        await action(hass, "edit_file", filename="hello.mp3", eye_icon=2)
    assert device.file("hello.mp3").eye_icon == 1
    coordinator(hass, setup_integration).mark_playback_inactive()


async def test_edit_file_works_right_after_stop_file(
    hass, setup_integration, device
):
    # The panel stops a playing file and saves right away, before the
    # device's "stopped" event arrives
    from .conftest import coordinator

    coordinator(hass, setup_integration).mark_playback_active(30)
    f = device.file("hello.mp3")
    await action(hass, "stop_file", file_index=f.index)
    assert not coordinator(hass, setup_integration).playback_active
    await action(hass, "edit_file", filename="hello.mp3", eye_icon=2)
    assert device.file("hello.mp3").eye_icon == 2


# ---- play order ------------------------------------------------------------


async def test_set_file_order_by_name(hass, setup_integration, device):
    result = await action(
        hass, "set_file_order", response=True, filenames=["scream.mp3", "hello.mp3"]
    )
    assert device.file_names_in_order() == ["scream.mp3", "hello.mp3"], (
        "laugh.mp3 disabled"
    )
    assert result == {
        "file_order": [
            {"file_index": device.file("scream.mp3").index, "filename": "scream.mp3"},
            {"file_index": device.file("hello.mp3").index, "filename": "hello.mp3"},
        ]
    }
    assert sensor(hass, setup_integration, "file_order") != "unknown"


async def test_set_file_order_by_index(hass, setup_integration, device):
    indices = [device.file(n).index for n in ("laugh.mp3", "hello.mp3", "scream.mp3")]
    await action(hass, "set_file_order", file_indices=indices)
    assert device.file_names_in_order() == ["laugh.mp3", "hello.mp3", "scream.mp3"]


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"filenames": ["hello.mp3", "nope.mp3"]}, "not found.*nope.mp3"),
        ({"filenames": ["hello.mp3", "hello.mp3"]}, "more than once"),
        ({"filenames": ["hello.mp3"], "file_indices": [1]}, "not both"),
        ({"filenames": []}, "At least one"),
        ({"file_indices": [99]}, "not found.*99"),
    ],
)
async def test_set_file_order_rejects_bad_input(
    hass, setup_integration, device, data, message
):
    with pytest.raises(HomeAssistantError, match=message):
        await action(hass, "set_file_order", **data)
    assert device.file_names_in_order() == ["hello.mp3", "laugh.mp3", "scream.mp3"]


async def test_set_file_order_reports_what_device_did(hass, setup_integration, device):
    """If the device doesn't apply the order, the response shows its real order."""
    device._cmd_AAC9 = lambda p: None  # firmware ignores order writes
    result = await action(
        hass, "set_file_order", response=True, filenames=["scream.mp3"]
    )
    assert [x["filename"] for x in result["file_order"]] == [
        "hello.mp3",
        "laugh.mp3",
        "scream.mp3",
    ]
