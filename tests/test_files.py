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
    DEVICE_TYPE_SANTA,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)
from custom_components.skelly_ultra.skelly_ultra_pkg.constants import LightScene

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
            # Stereo 48 kHz, so the upload has to convert it
            "-ac",
            "2",
            "-ar",
            "48000",
            str(path),
        ],
        check=True,
    )
    return path


def _mp3_frame_headers(data: bytes) -> list[tuple]:
    """Return (version, layer, kbps, sample rate, mode) of every MP3 frame."""
    if data[:3] == b"ID3":
        size = data[6] << 21 | data[7] << 14 | data[8] << 7 | data[9]
        data = data[10 + size :]
    kbps_mpeg1_l3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    frames = []
    pos = 0
    while pos + 4 <= len(data):
        header = int.from_bytes(data[pos : pos + 4], "big")
        if header >> 21 != 0x7FF:  # frame sync
            break
        assert (header >> 19) & 3 == 3 and (header >> 17) & 3 == 1, (
            "not MPEG-1 Layer III"
        )
        kbps = kbps_mpeg1_l3[(header >> 12) & 0xF]
        rate = (44100, 48000, 32000)[(header >> 10) & 3]
        padding = (header >> 9) & 1
        mode = "mono" if (header >> 6) & 3 == 3 else "stereo"
        size = 144 * kbps * 1000 // rate + padding
        # Skip the encoder's Xing/Info tag frame, which holds no audio
        if data[pos + 21 : pos + 25] not in (b"Xing", b"Info"):
            frames.append(("MPEG-1", "Layer III", kbps, rate, mode))
        pos += size
    return frames


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
    # The format the phone app uploads: MPEG-1 Layer III, 44.1 kHz, mono,
    # CBR 32 kbps
    frames = _mp3_frame_headers(uploaded.data)
    assert frames, "MP3 data"
    assert set(frames) == {("MPEG-1", "Layer III", 32, 44100, "mono")}
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

    async def spy_send(
        self, client, data, name, progress=None, chunk_size=None, chunk_delay=None
    ):
        used["chunk_size"] = chunk_size
        used["chunk_delay"] = chunk_delay
        return await send_file(
            self, client, data, name, progress, chunk_size, chunk_delay
        )

    def spy_process(path, output=None, bitrate=None):
        used["bitrate"] = bitrate
        return process_file(path, output, bitrate)

    monkeypatch.setattr(uploads.FileTransferManager, "send_file", spy_send)
    monkeypatch.setattr(uploads.AudioProcessor, "process_file", spy_process)

    await action(hass, "send_file", file_path=str(tone), target_filename="a.mp3")
    assert used == {"chunk_size": None, "chunk_delay": None, "bitrate": None}

    for domain, service, suffix, data in (
        ("switch", "turn_on", "override_chunk_size", {}),
        ("number", "set_value", "chunk_size", {"value": 300}),
        ("switch", "turn_on", "override_chunk_delay", {}),
        ("number", "set_value", "chunk_delay", {"value": 20}),
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
    assert used == {"chunk_size": 300, "chunk_delay": 20, "bitrate": "64k"}
    assert device.file("b.mp3").data


@needs_ffmpeg
async def test_new_file_goes_first_and_keeps_the_play_order(
    hass, setup_integration, device, tone
):
    """The device mangles the order on upload ([3, 1] -> [4, 1, 1]).

    The new file must end up first and enabled, and the other files keep
    their order and enabled state.
    """
    await action(hass, "set_file_order", filenames=["scream.mp3", "hello.mp3"])
    await action(hass, "send_file", file_path=str(tone), target_filename="new.mp3")
    assert device.file_names_in_order() == ["new.mp3", "scream.mp3", "hello.mp3"]
    assert device.file("laugh.mp3").index not in device.order
    entry = setup_integration
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data["file_order"] == device.order


@needs_ffmpeg
async def test_overwriting_a_file_leaves_the_play_order(
    hass, setup_integration, device, tone
):
    await action(hass, "set_file_order", filenames=["scream.mp3", "hello.mp3"])
    await action(hass, "send_file", file_path=str(tone), target_filename="laugh.mp3")
    assert device.file_names_in_order() == ["scream.mp3", "hello.mp3"]


@needs_ffmpeg
async def test_overwrite_unknown_to_ha_leaves_the_play_order(
    hass, setup_integration, device, tone
):
    """An overwrite HA took for a new file (its file list was empty)."""
    await action(hass, "set_file_order", filenames=["scream.mp3", "hello.mp3"])
    entry = setup_integration
    coordinator = entry.runtime_data.coordinator
    coordinator._file_list = []
    await action(hass, "send_file", file_path=str(tone), target_filename="laugh.mp3")
    assert device.file_names_in_order() == ["scream.mp3", "hello.mp3"]


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


@needs_ffmpeg
async def test_overwrite_restores_lights_in_one_f1_with_the_scene(
    hass, halloween_scream, setup_integration, device, tone
):
    """New firmware: the restore after an overwrite sends the lights as one
    F1 with the file's old scene (the upload resets it)."""
    f = halloween_scream
    lights = list(f.lights)
    device.writes.clear()
    await action(hass, "send_file", file_path=str(tone), target_filename="scream.mp3")
    assert len(light_writes(device, ALL_LIGHTS)) == 1
    assert not light_writes(device, *PER_CHANNEL_LIGHTS)
    assert f.scene == LightScene.HALLOWEEN
    assert f.lights[:2] == lights[:2]


@needs_ffmpeg
async def test_overwrite_is_refused_without_free_space(
    hass, setup_integration, device, tone
):
    """The free-space check runs for an overwrite too; the old file stays."""
    laugh = device.file("laugh.mp3")
    old = laugh.data
    device.capacity_kb = 1
    with pytest.raises(HomeAssistantError, match="Not enough space"):
        await action(
            hass, "send_file", file_path=str(tone), target_filename="laugh.mp3"
        )
    assert laugh.data == old


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


async def test_missing_source_file(hass, setup_integration, device, tmp_path):
    with pytest.raises(HomeAssistantError, match="not found"):
        await action(
            hass,
            "send_file",
            file_path=str(tmp_path / "missing.mp3"),
            target_filename="x.mp3",
        )


async def test_source_file_outside_allowed_folders_is_refused(
    hass, setup_integration, device, tone, tmp_path_factory
):
    """Only folders in allowlist_external_dirs can be read, like elsewhere in HA."""
    # mktemp folders sit next to tmp_path, which is the allowed folder
    outside = tmp_path_factory.mktemp("outside") / "secret.wav"
    outside.write_bytes(tone.read_bytes())
    link = tone.parent / "link.wav"
    link.symlink_to(outside)
    for path in (
        outside,
        tone.parent / ".." / outside.parent.name / outside.name,
        link,
    ):
        with pytest.raises(HomeAssistantError, match="Not allowed to read"):
            await action(
                hass, "send_file", file_path=str(path), target_filename="x.mp3"
            )
    with pytest.raises(HomeAssistantError, match="Not allowed to read"):
        await action(
            hass, "send_file", file_path="/nope/missing.mp3", target_filename="x.mp3"
        )
    assert not any(w[:2] == b"\xaa\xc0" for w in device.writes)


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


async def test_delete_refused_while_playing(hass, setup_integration, device):
    """While a file plays the list can't be read: say so, not "not found"."""
    from .conftest import coordinator

    coordinator(hass, setup_integration).mark_playback_active(30)
    with pytest.raises(HomeAssistantError, match="playing a file"):
        await action(hass, "delete_file", filename="laugh.mp3")
    assert len(device.files) == 3
    coordinator(hass, setup_integration).mark_playback_inactive()


async def test_delete_needs_name_or_index_and_cluster(hass, setup_integration, device):
    with pytest.raises(HomeAssistantError, match="Cannot specify both"):
        await action(hass, "delete_file", filename="laugh.mp3", file_index=1, cluster=0)
    with pytest.raises(HomeAssistantError, match="Must provide either"):
        await action(hass, "delete_file", file_index=1)
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


ALL_LIGHTS = b"\xaa\xf1"
PER_CHANNEL_LIGHTS = (b"\xaa\xf2", b"\xaa\xf3", b"\xaa\xf4", b"\xaa\xf6")


def light_writes(device, *tags) -> list[bytes]:
    return [w for w in device.writes if w[:2] in tags]


@pytest.fixture
def firmware_v66(mock_ble):
    """An Ultra Skelly on v66: no light scenes, no F1. Ask for it before
    setup_integration."""
    mock_ble.firmware_version = 66
    mock_ble.has_scenes = False
    return mock_ble


@pytest.fixture
def halloween_scream(device):
    """scream.mp3 with the Halloween scene. Ask for it before
    setup_integration, which reads the file list."""
    f = device.file("scream.mp3")
    f.scene = LightScene.HALLOWEEN
    f.lights[1] = Light(effect_type=2, brightness=100, rgb=(255, 0, 0), effect_speed=50)
    return f


async def test_edit_file_lights_go_in_one_f1_that_keeps_the_scene(
    hass, halloween_scream, setup_integration, device
):
    """New firmware (here Ultra v68): one F1 for all channels, with the
    file's scene, so a Halloween file stays Halloween."""
    f = halloween_scream
    device.writes.clear()

    await action(
        hass,
        "edit_file",
        filename="scream.mp3",
        lights={"channel": 0, "rgb": [0, 255, 0]},
    )
    assert len(light_writes(device, ALL_LIGHTS)) == 1
    assert not light_writes(device, *PER_CHANNEL_LIGHTS)
    assert f.scene == LightScene.HALLOWEEN
    assert f.lights[0].rgb == (0, 255, 0)
    assert f.lights[1] == Light(
        effect_type=2, brightness=100, rgb=(255, 0, 0), effect_speed=50
    ), "the channel left out is sent as it was"


async def test_edit_file_lights_per_channel_on_v66(
    hass, firmware_v66, setup_integration, device
):
    f = device.file("scream.mp3")
    await action(
        hass,
        "edit_file",
        filename="scream.mp3",
        lights={"channel": 0, "rgb": [0, 255, 0]},
    )
    assert not light_writes(device, ALL_LIGHTS)
    assert light_writes(device, *PER_CHANNEL_LIGHTS)
    assert f.lights[0].rgb == (0, 255, 0)


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
        # The app's Santa bits: eyes 0x01, head 0x02, torso 0x04, arm 0x08
        (DEVICE_TYPE_SANTA, ["eyes", "arm"], 0x09),
        (DEVICE_TYPE_SANTA, ["head", "torso"], 0x06),
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
    other = "wrist" if device_type == DEVICE_TYPE_SANTA else "torso"
    with pytest.raises(HomeAssistantError, match="Unknown movement"):
        await action(hass, "edit_file", filename="hello.mp3", movements=[other])


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


async def test_edit_file_works_right_after_stop_file(hass, setup_integration, device):
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
