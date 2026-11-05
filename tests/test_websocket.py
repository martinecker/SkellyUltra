"""The skelly_ultra/files/* websocket commands a file manager UI uses."""

import asyncio
import shutil
import subprocess
import time

import aiohttp
import pytest
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra import file_order, file_settings
from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    DEVICE_TYPE_LILY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)
from custom_components.skelly_ultra.skelly_ultra_pkg.constants import (
    MAX_FILENAME_LENGTH,
)
from custom_components.skelly_ultra.websocket_api import IMAGE_DIR

from .conftest import advance, coordinator
from .device_sim import Light

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")


@pytest.fixture(autouse=True)
def no_write_delays(monkeypatch):
    monkeypatch.setattr(file_settings, "FILE_SETTING_WRITE_DELAY", 0)
    monkeypatch.setattr(file_order, "FILE_ORDER_WRITE_DELAY", 0)


async def action(hass: HomeAssistant, service: str, **data):
    await hass.services.async_call(DOMAIN, service, data, blocking=True)
    await hass.async_block_till_done()


async def ws_list(client, **msg) -> dict:
    await client.send_json_auto_id({"type": "skelly_ultra/files/list", **msg})
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


async def next_event(client, timeout: float = 2.0) -> dict:
    msg = await asyncio.wait_for(client.receive_json(), timeout)
    assert msg["type"] == "event", msg
    return msg["event"]


async def no_event(client) -> None:
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(client.receive_json(), 0.2)


async def test_list_files(hass, setup_integration, device, hass_ws_client):
    entry = setup_integration
    hello = device.file("hello.mp3")
    hello.action = 0x01 | 0x04
    hello.eye_icon = 7
    hello.lights[1] = Light(
        effect_type=3, brightness=128, rgb=(0, 0, 255), color_cycle=1, effect_speed=54
    )
    await action(hass, "set_file_order", file_indices=[3, 1])
    client = await hass_ws_client(hass)

    result = await ws_list(client, entry_id=entry.entry_id, refresh=True)

    assert result["entry_id"] == entry.entry_id
    (device_entry,) = dr.async_entries_for_config_entry(
        dr.async_get(hass), entry.entry_id
    )
    assert result["device_id"] == device_entry.id
    assert result["name"] == "Ultra Skelly v2"
    assert result["available"] is True
    assert result["file_order"] == [3, 1]
    assert result["capacity"] == {"free_kb": 4000, "file_count_reported": 3}
    assert result["transfer"] == {
        "status": "idle",
        "in_progress": False,
        "progress": 0,
        "filename": None,
        "error": None,
    }
    files = {f["name"]: f for f in result["files"]}
    assert set(files) == {"hello.mp3", "laugh.mp3", "scream.mp3"}
    assert files["hello.mp3"] == {
        "name": "hello.mp3",
        "file_index": hello.index,
        "cluster": hello.cluster,
        "enabled": True,
        "movements": ["head", "torso"],
        "movement_bits": 5,
        "eye_icon": 7,
        "lights": [
            {
                "channel": 0,
                "brightness": 255,
                "effect_mode": 1,
                "effect_speed": 254,
                "rgb": [255, 0, 0],
                "color_cycle": False,
            },
            {
                "channel": 1,
                "brightness": 128,
                "effect_mode": 3,
                "effect_speed": 200,  # the Effect Speed entities' scale
                "rgb": [0, 0, 255],
                "color_cycle": True,
            },
        ],
    }
    assert files["laugh.mp3"]["enabled"] is False

    profile = result["device_profile"]
    assert profile["type"] == "ultra_skelly"
    assert profile["movements"] == [
        {
            "part": part,
            "label": label,
            "icon_url": f"/skelly_ultra/images/skelly/movement_{part}.png",
        }
        for part, label in [
            ("all", "All"),
            ("head", "Head"),
            ("arm", "Arm"),
            ("torso", "Torso"),
        ]
    ]
    assert profile["lights"] == [
        {"channel": 0, "label": "Torso Light"},
        {"channel": 1, "label": "Head Light"},
    ]
    assert profile["light_modes"] == ["Static", "Strobe", "Pulse"]
    assert profile["max_effect_speed"] == 254
    assert profile["max_filename_length"] == MAX_FILENAME_LENGTH
    assert len(profile["eye_icons"]) == 18
    assert profile["eye_icons"][0] == {
        "value": 1,
        "label": "1 Blue Eyeball",
        "url": "/skelly_ultra/images/skelly/eye_icon_1.png",
    }


async def test_files_round_trip_through_edit_file(
    hass, setup_integration, device, hass_ws_client
):
    """A UI can send a file's lights back to edit_file without converting them."""
    hello = device.file("hello.mp3")
    hello.lights[0] = Light(effect_type=2, effect_speed=255, brightness=10)
    client = await hass_ws_client(hass)
    result = await ws_list(client, refresh=True)
    listed = next(f for f in result["files"] if f["name"] == "hello.mp3")
    writes = len(device.writes)

    await action(
        hass,
        "edit_file",
        filename="hello.mp3",
        movements=listed["movements"],
        lights=listed["lights"],
    )
    # Nothing changed, so nothing was written (only the file list was read)
    setting_writes = (0xCA, 0xF2, 0xF3, 0xF4, 0xF6, 0xF9)
    assert [w for w in device.writes[writes:] if w[1] in setting_writes] == []
    assert device.file("hello.mp3").lights[0].effect_speed == 255


async def test_list_targets(hass, setup_integration, hass_ws_client):
    entry = setup_integration
    client = await hass_ws_client(hass)
    (device_entry,) = dr.async_entries_for_config_entry(
        dr.async_get(hass), entry.entry_id
    )

    by_device = await ws_list(client, device_id=device_entry.id)
    only_one = await ws_list(client)
    assert by_device["entry_id"] == only_one["entry_id"] == entry.entry_id

    for msg in ({"entry_id": "nope"}, {"device_id": "nope"}):
        await client.send_json_auto_id({"type": "skelly_ultra/files/list", **msg})
        response = await client.receive_json()
        assert not response["success"]
        assert response["error"]["code"] == "not_found"

    await client.send_json_auto_id(
        {
            "type": "skelly_ultra/files/list",
            "entry_id": entry.entry_id,
            "device_id": device_entry.id,
        }
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_format"


async def test_list_refresh_reads_the_device(
    hass, setup_integration, device, hass_ws_client
):
    client = await hass_ws_client(hass)
    device.add_file("new.mp3")
    assert "new.mp3" not in [f["name"] for f in (await ws_list(client))["files"]]
    result = await ws_list(client, refresh=True)
    assert "new.mp3" in [f["name"] for f in result["files"]]


async def test_subscribe_pushes_changes(
    hass, setup_integration, device, hass_ws_client
):
    entry = setup_integration
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "skelly_ultra/files/subscribe", "entry_id": entry.entry_id}
    )
    assert (await client.receive_json())["success"]
    first = await next_event(client)
    assert first["file_order"] == [1, 2, 3]

    await action(hass, "set_file_order", filenames=["scream.mp3", "hello.mp3"])
    # (after the events of the file list read that setup started)
    event = await next_event(client)
    while event["file_order"] != [3, 1]:
        event = await next_event(client)
    assert {f["name"]: f["enabled"] for f in event["files"]}["laugh.mp3"] is False

    await action(hass, "edit_file", filename="hello.mp3", eye_icon=9)
    event = await next_event(client)
    while {f["name"]: f for f in event["files"]}["hello.mp3"]["eye_icon"] != 9:
        event = await next_event(client)

    # A poll that changes nothing sends nothing
    while True:
        try:
            await asyncio.wait_for(client.receive_json(), 0.2)
        except TimeoutError:
            break
    await advance(hass, 35)
    await no_event(client)

    # Capacity comes with every poll
    device.capacity_kb = 3000
    await advance(hass, 35)
    assert (await next_event(client))["capacity"]["free_kb"] == 3000

    # Losing the device shows as unavailable
    device.drop_connection()
    await hass.async_block_till_done()
    assert (await next_event(client))["available"] is False


async def test_transfer_settings_follow_the_override_entities(
    hass, setup_integration, device, hass_ws_client
):
    """The payload shows the overrides, and the entities that change them."""
    entry = setup_integration
    client = await hass_ws_client(hass)
    settings = (await ws_list(client))["transfer_settings"]
    chunk = settings["chunk_size"]
    bitrate = settings["bitrate"]
    # The simulator's MTU of 247 allows 244-byte chunks
    assert chunk["override"] is False
    assert chunk["auto"] == 244
    assert (chunk["min"], chunk["max"]) == (20, 500)
    assert bitrate["override"] is False
    assert bitrate["default"] == bitrate["value"] == "32k"
    assert "250k" not in bitrate["options"] and "64k" in bitrate["options"]
    registry = er.async_get(hass)
    for key, domain, unique_id in (
        ("switch_entity", "switch", "override_chunk_size"),
        ("value_entity", "number", "chunk_size"),
    ):
        assert chunk[key] == registry.async_get_entity_id(
            domain, DOMAIN, f"{entry.entry_id}_{unique_id}"
        )
        assert chunk[key].startswith(f"{domain}.")
    for key, domain, unique_id in (
        ("switch_entity", "switch", "override_bitrate"),
        ("value_entity", "select", "bitrate"),
    ):
        assert bitrate[key] == registry.async_get_entity_id(
            domain, DOMAIN, f"{entry.entry_id}_{unique_id}"
        )

    # What the panel does: the switch first, then the value
    await client.send_json_auto_id(
        {"type": "skelly_ultra/files/subscribe", "entry_id": entry.entry_id}
    )
    assert (await client.receive_json())["success"]
    await next_event(client)
    await hass.services.async_call(
        "switch", "turn_on", {"entity_id": chunk["switch_entity"]}, blocking=True
    )
    await hass.services.async_call(
        "number",
        "set_value",
        {"entity_id": chunk["value_entity"], "value": 300},
        blocking=True,
    )
    await hass.services.async_call(
        "switch", "turn_on", {"entity_id": bitrate["switch_entity"]}, blocking=True
    )
    await hass.services.async_call(
        "select",
        "select_option",
        {"entity_id": bitrate["value_entity"], "option": "64k"},
        blocking=True,
    )
    await hass.async_block_till_done()
    event = await next_event(client)
    while (
        event["transfer_settings"]["chunk_size"]["value"] != 300
        or event["transfer_settings"]["bitrate"]["value"] != "64k"
    ):
        event = await next_event(client)
    assert event["transfer_settings"]["chunk_size"]["override"] is True
    assert event["transfer_settings"]["bitrate"]["override"] is True


async def test_unsubscribe_stops_events(
    hass, setup_integration, device, hass_ws_client
):
    entry = setup_integration
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    sub = await client.receive_json()
    await next_event(client)
    listeners = len(coordinator(hass, entry)._listeners)

    await client.send_json_auto_id(
        {"type": "unsubscribe_events", "subscription": sub["id"]}
    )
    assert (await client.receive_json())["success"]
    assert len(coordinator(hass, entry)._listeners) == listeners - 1
    await action(hass, "set_file_order", filenames=["laugh.mp3"])
    await no_event(client)


async def test_unload_ends_subscription(hass, setup_integration, hass_ws_client):
    entry = setup_integration
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    await client.receive_json()
    assert (await next_event(client))["unloaded"] is False
    coord = coordinator(hass, entry)

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    last = await next_event(client)
    assert last["unloaded"] is True and last["available"] is False
    assert not coord._listeners
    await no_event(client)

    await client.send_json_auto_id({"type": "skelly_ultra/files/list"})
    response = await client.receive_json()
    assert response["error"]["code"] == "not_found"


async def test_resubscribe_after_reload(hass, setup_integration, hass_ws_client):
    """A UI that subscribes again after the unloaded event gets the new entry's data."""
    entry = setup_integration
    client = await hass_ws_client(hass)
    for _ in range(3):  # subscriptions that end don't pile up
        await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
        sub = await client.receive_json()
        await next_event(client)
        await client.send_json_auto_id(
            {"type": "unsubscribe_events", "subscription": sub["id"]}
        )
        await client.receive_json()
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    await client.receive_json()
    await next_event(client)
    assert len(hass.data["skelly_ultra_file_subscriptions"][entry.entry_id]) == 1

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert (await next_event(client))["unloaded"] is True
    await no_event(client)

    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await next_event(client))["unloaded"] is False
    await action(hass, "set_file_order", filenames=["laugh.mp3"])
    event = await next_event(client)
    while event["file_order"] != [2]:
        event = await next_event(client)


@pytest.mark.parametrize("device_type", [DEVICE_TYPE_SKELLY_12FT, DEVICE_TYPE_LILY])
async def test_payload_follows_device_profile(
    hass, mock_ble, hass_ws_client, device_type
):
    entry = MockConfigEntry(
        domain=DOMAIN, data={"address": mock_ble.address, CONF_DEVICE_TYPE: device_type}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    mock_ble.file("hello.mp3").action = 0x02
    client = await hass_ws_client(hass)

    result = await ws_list(client, refresh=True)
    profile = result["device_profile"]
    assert profile["type"] == device_type
    hello = next(f for f in result["files"] if f["name"] == "hello.mp3")
    assert [light["channel"] for light in hello["lights"]] == [0]
    if device_type == DEVICE_TYPE_SKELLY_12FT:
        assert [m["part"] for m in profile["movements"]] == ["head"]
        assert hello["movements"] == ["head"]
        assert len(profile["eye_icons"]) == 20
        assert profile["movements"][0]["icon_url"] == (
            "/skelly_ultra/images/skelly12ft/movement_head.png"
        )
        assert profile["eye_icons"][0]["url"].endswith("/skelly12ft/eye_icon_1.png")
    else:
        assert hello["movements"] == ["elbow"]
        assert [m["part"] for m in profile["movements"]] == [
            "all",
            "wrist",
            "elbow",
            "head",
            "eyes",
        ]
        assert profile["eye_icons"] == []
        assert all(f["eye_icon"] is None for f in result["files"])


async def test_target_needed_with_two_skellys(hass, setup_integration, hass_ws_client):
    other = MockConfigEntry(
        domain=DOMAIN,
        data={"address": "11:22:33:44:55:66"},
        options={"connected": False},
        unique_id="11:22:33:44:55:66",
    )
    other.add_to_hass(hass)
    assert await hass.config_entries.async_setup(other.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "skelly_ultra/files/list"})
    response = await client.receive_json()
    assert response["error"]["code"] == "not_found"
    assert "entry_id or device_id" in response["error"]["message"]
    await client.send_json_auto_id({"type": "skelly_ultra/files/list", "entry_id": ""})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    result = await ws_list(client, entry_id=setup_integration.entry_id)
    assert len(result["files"]) == 3


@pytest.fixture
def tone(tmp_path):
    path = tmp_path / "tone.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=3",
            str(path),
        ],
        check=True,
    )
    return path


@needs_ffmpeg
async def test_subscribe_reports_transfers(
    hass, setup_integration, device, hass_ws_client, tone
):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    await client.receive_json()
    await next_event(client)

    await hass.services.async_call(
        DOMAIN,
        "send_file",
        {"file_path": str(tone), "target_filename": "boo"},
        blocking=True,
    )
    await hass.async_block_till_done()

    events = []
    while True:
        try:
            events.append(await next_event(client, timeout=0.3))
        except TimeoutError:
            break
    transfers = [e["transfer"] for e in events]
    uploading = [t for t in transfers if t["status"] == "uploading"]
    assert uploading and all(t["filename"] == "boo.mp3" for t in uploading)
    # Starts at 0 and always reaches 100, however the updates are throttled
    assert uploading[0]["progress"] == 0 and uploading[-1]["progress"] == 100
    complete = next(t for t in transfers if t["status"] == "complete")
    assert complete == {
        "status": "complete",
        "in_progress": False,
        "progress": 100,
        "filename": "boo.mp3",
        "error": None,
    }
    assert "boo.mp3" in [f["name"] for f in events[-1]["files"]]
    # The file list is read before the transfer shows as done, so a UI never
    # shows the old list as current
    done = [e for e in events if e["transfer"]["status"] == "complete"]
    assert done[0]["refreshing"] is True
    assert all(
        "boo.mp3" in [f["name"] for f in e["files"]]
        for e in done
        if not e["refreshing"]
    )
    assert events[-1]["refreshing"] is False


async def test_failed_upload_shows_error(hass, setup_integration, hass_ws_client):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    await client.receive_json()
    await next_event(client)

    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(
            DOMAIN,
            "send_file",
            {"file_path": "/nonexistent/x.wav", "target_filename": "x"},
            blocking=True,
        )
    transfer = (await next_event(client))["transfer"]
    assert transfer["status"] == "error"
    assert transfer["filename"] is None and transfer["error"]


async def test_eye_icon_images_are_served(hass, config_entry, mock_ble, hass_client):
    assert await async_setup_component(hass, "http", {})
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_client()
    response = await client.get("/skelly_ultra/images/skelly/eye_icon_1.png")
    assert response.status == 200
    assert (
        await response.read() == (IMAGE_DIR / "skelly" / "eye_icon_1.png").read_bytes()
    )


async def ws_devices(client) -> list[dict]:
    await client.send_json_auto_id({"type": "skelly_ultra/devices/list"})
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


async def test_list_devices(
    hass, config_entry, mock_ble, media_dir, hass_ws_client, hass_read_only_access_token
):
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    (device_entry,) = dr.async_entries_for_config_entry(
        dr.async_get(hass), config_entry.entry_id
    )
    expected = [
        {
            "entry_id": config_entry.entry_id,
            "device_id": device_entry.id,
            "name": "Ultra Skelly v2",
            "type": "ultra_skelly",
            "available": True,
            "upload_target": "media-source://media_source/local/skelly_ultra",
        }
    ]

    assert await ws_devices(await hass_ws_client(hass)) == expected
    # Users who aren't admins can list them too
    client = await hass_ws_client(hass, hass_read_only_access_token)
    assert await ws_devices(client) == expected

    # The name the user gave the device wins
    dr.async_get(hass).async_update_device(device_entry.id, name_by_user="Bones")
    (listed,) = await ws_devices(client)
    assert listed["name"] == "Bones"
    result = await ws_list(client)
    assert result["name"] == "Bones"
    assert result["device_id"] == device_entry.id


async def test_list_devices_leaves_out_unloaded_skellies(
    hass, setup_integration, hass_ws_client
):
    other = MockConfigEntry(
        domain=DOMAIN,
        title="Not loaded",
        data={"address": "11:22:33:44:55:66"},
        unique_id="11:22:33:44:55:66",
    )
    other.add_to_hass(hass)
    client = await hass_ws_client(hass)

    devices = await ws_devices(client)
    assert [d["entry_id"] for d in devices] == [setup_integration.entry_id]

    assert await hass.config_entries.async_unload(setup_integration.entry_id)
    await hass.async_block_till_done()
    assert await ws_devices(client) == []


async def test_upload_folder_is_created_in_my_media(
    hass, config_entry, mock_ble, media_dir
):
    assert not media_dir.exists()
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert (media_dir / "skelly_ultra").is_dir()


async def test_no_upload_target_without_local_media(
    hass, config_entry, mock_ble, hass_ws_client
):
    hass.config.media_dirs = {"recordings": "/somewhere"}
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    (listed,) = await ws_devices(await hass_ws_client(hass))
    assert listed["upload_target"] is None


async def test_no_upload_target_if_the_folder_cant_be_made(
    hass, config_entry, mock_ble, hass_ws_client, tmp_path
):
    blocker = tmp_path / "media"
    blocker.write_text("a file where the media folder should be")
    hass.config.media_dirs = {"local": str(blocker)}
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert config_entry.state.name == "LOADED"
    (listed,) = await ws_devices(await hass_ws_client(hass))
    assert listed["upload_target"] is None


@needs_ffmpeg
async def test_upload_then_send_file(
    hass, config_entry, mock_ble, device, media_dir, hass_ws_client, hass_client, tone
):
    """The Upload tab's flow: upload to the target, then send_file the result."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    (listed,) = await ws_devices(await hass_ws_client(hass))

    client = await hass_client()
    form = aiohttp.FormData()
    form.add_field("media_content_id", listed["upload_target"])
    form.add_field(
        "file", tone.read_bytes(), filename="boo.wav", content_type="audio/wav"
    )
    response = await client.post("/api/media_source/local_source/upload", data=form)
    assert response.status == 200, await response.text()
    uploaded = (await response.json())["media_content_id"]
    assert (media_dir / "skelly_ultra" / "boo.wav").is_file()

    result = await hass.services.async_call(
        DOMAIN,
        "send_file",
        {"file_path": uploaded, "target_filename": "boo"},
        blocking=True,
        return_response=True,
    )
    assert result["filename"] == "boo.mp3"
    assert "boo.mp3" in [f.name for f in device.files]


def test_every_image_url_has_a_file():
    """Each profile's eye icon and movement pictures exist under images/."""
    from custom_components.skelly_ultra.const import DEVICE_PROFILES
    from custom_components.skelly_ultra.websocket_api import IMAGE_URL, _profile_payload

    for device_type, profile in DEVICE_PROFILES.items():
        entry = MockConfigEntry(domain=DOMAIN, data={CONF_DEVICE_TYPE: device_type})
        payload = _profile_payload(entry, profile)
        urls = [m["icon_url"] for m in payload["movements"]] + [
            icon["url"] for icon in payload["eye_icons"]
        ]
        assert len(urls) == len(profile["movements"]) + len(profile["eye_icons"])
        for url in urls:
            assert url.startswith(f"{IMAGE_URL}/")
            path = IMAGE_DIR / url.removeprefix(f"{IMAGE_URL}/")
            assert path.is_file(), f"{device_type}: no {path}"


async def test_subscribe_reports_playback(
    hass, setup_integration, device, hass_ws_client
):
    """The panel shows what the Skelly says it plays, and for how long."""
    client = await hass_ws_client(hass)
    assert (await ws_list(client))["playback"] is None
    await client.send_json_auto_id({"type": "skelly_ultra/files/subscribe"})
    await client.receive_json()
    await next_event(client)

    f = device.file("laugh.mp3")
    f.duration = 75
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": f.index}, blocking=True
    )
    event = await next_event(client)
    while event["playback"] is None:
        event = await next_event(client)
    playback = event["playback"]
    assert playback == {
        "file_index": f.index,
        "duration": 75,
        "started": playback["started"],
        "report": playback["report"],
    }
    assert abs(playback["started"] / 1000 - time.time()) < 5
    # HA's clock as it sends, for a UI's own clock
    assert abs(event["sent_at"] / 1000 - time.time()) < 5
    first = event["playback"]["report"]

    # Each report is new, even for the same file
    await hass.services.async_call(
        DOMAIN, "play_file", {"file_index": f.index}, blocking=True
    )
    event = await next_event(client)
    while event["playback"] is None or event["playback"]["report"] == first:
        event = await next_event(client)

    device.finish_playback(f.index)
    event = await next_event(client)
    while event["playback"] is not None:
        event = await next_event(client)
