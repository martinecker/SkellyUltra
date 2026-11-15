"""The converse action: two Skellys hold a conversation written by AI."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import PropertyMock, patch

import pytest
import voluptuous as vol
from bleak.backends.device import BLEDevice
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import device_registry as dr, llm
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra import stage as stage_module
from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_USE_BLE_PROXY,
    DEVICE_TYPE_SKELLY,
    DOMAIN,
)

from .conftest import ADDRESS, advance
from .device_sim import FakeSkellyDevice, Light
from .rest_sim import FakeRestServer, Look

ADDRESS_2 = "AA:BB:CC:DD:EE:01"
URL_1 = "http://localhost:8765"
URL_2 = "http://rattles.local:8765"  # the mock matches hosts, not ports


@pytest.fixture(autouse=True)
def fast_perform(monkeypatch):
    monkeypatch.setattr(stage_module, "COMMAND_DELAY", 0)
    monkeypatch.setattr(stage_module, "LIVE_MODE_POLL_INTERVAL", 0.01)


class LoggingRestServer(FakeRestServer):
    """A REST server that also logs its plays, in order, into a shared list."""

    def __init__(self, log: list[tuple[str, Look]], label: str, *args) -> None:
        self.log = log
        self.label = label
        super().__init__(*args)

    async def _play(self, method, url, data):
        reply = await super()._play(method, url, data)
        if self.connected and self.up:
            self.log.append((self.label, self.plays[-1]))
        return reply


class FakeAI:
    """Answers ai_task.generate_data through a real AI Task entity."""

    def __init__(self) -> None:
        self.requests: list[Any] = []
        self.schemas: list[dict] = []
        self.answer: dict[str, Any] = {}
        self.delay = 0.0


@pytest.fixture
async def fake_ai(hass: HomeAssistant) -> FakeAI:
    """ai_task.fake_ai, an AI Task entity that returns FakeAI.answer."""
    from homeassistant.components import ai_task
    from homeassistant.config_entries import ConfigFlow
    from homeassistant.setup import async_setup_component
    from pytest_homeassistant_custom_component.common import (
        MockModule,
        MockPlatform,
        mock_config_flow,
        mock_integration,
        mock_platform,
    )

    ai = FakeAI()

    class FakeAITask(ai_task.AITaskEntity):
        _attr_name = "Fake AI"
        _attr_unique_id = "fake_ai"
        _attr_supported_features = (
            ai_task.AITaskEntityFeature.GENERATE_DATA
            | ai_task.AITaskEntityFeature.SUPPORT_ATTACHMENTS
        )

        async def _async_generate_data(self, task, chat_log):
            ai.requests.append(task)
            ai.schemas.append(_json_schema(task.structure))
            if ai.delay:
                await asyncio.sleep(ai.delay)
            return ai_task.GenDataTaskResult(
                conversation_id=chat_log.conversation_id, data=ai.answer
            )

    entity = FakeAITask()

    async def setup_entry(hass, entry):
        await hass.config_entries.async_forward_entry_setups(entry, ["ai_task"])
        return True

    async def setup_platform(hass, entry, async_add_entities):
        async_add_entities([entity])

    mock_integration(hass, MockModule("fakeai", async_setup_entry=setup_entry))
    mock_platform(
        hass, "fakeai.ai_task", MockPlatform(async_setup_entry=setup_platform)
    )
    mock_platform(hass, "fakeai.config_flow")

    class FakeAIFlow(ConfigFlow):
        VERSION = 1

    with mock_config_flow("fakeai", FakeAIFlow):
        assert await async_setup_component(hass, "homeassistant", {})
        assert await async_setup_component(hass, "ai_task", {})
        entry = MockConfigEntry(domain="fakeai")
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        yield ai


def _json_schema(structure) -> dict:
    """The JSON schema an LLM integration sends for the structure."""
    try:
        import probatio  # Home Assistant 2026.x

        return probatio.to_openapi(structure, custom_serializer=llm.selector_serializer)
    except ImportError:
        from voluptuous_openapi import convert

        return convert(structure, custom_serializer=llm.selector_serializer)


class Skellys:
    def __init__(self) -> None:
        self.entries: list[MockConfigEntry] = []
        self.devices: list[FakeSkellyDevice] = []
        self.servers: list[LoggingRestServer] = []
        self.device_ids: list[str] = []
        self.log: list[tuple[str, Look]] = []


@pytest.fixture
async def skellys(hass: HomeAssistant, aioclient_mock, tts_entity) -> Skellys:
    """Two Ultra Skellys, Bones and Rattles, each with its own REST server."""
    result = Skellys()
    for address, title, url in (
        (ADDRESS, "Bones", URL_1),
        (ADDRESS_2, "Rattles", URL_2),
    ):
        device = FakeSkellyDevice(address=address)
        device.add_file("hello.mp3", duration=4)
        result.devices.append(device)
        result.servers.append(
            LoggingRestServer(result.log, title, aioclient_mock, device, url)
        )
        entry = MockConfigEntry(
            domain=DOMAIN,
            title=title,
            data={
                "address": address,
                "name": title,
                CONF_SERVER_URL: url,
                CONF_USE_BLE_PROXY: False,
                CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY,
            },
            unique_id=address,
        )
        entry.add_to_hass(hass)
        result.entries.append(entry)

    by_address = {d.address: d for d in result.devices}

    async def establish_connection(
        client_class, ble_device, name, disconnected_callback=None, **kw
    ):
        device = by_address[ble_device.address]
        device.set_disconnected_callback(disconnected_callback)
        await device.connect()
        return device

    session = aioclient_mock.create_session(hass.loop)
    with (
        patch(
            "custom_components.skelly_ultra.client_adapter.bluetooth.async_ble_device_from_address",
            side_effect=lambda hass, address, *a, **kw: BLEDevice(
                address, by_address[address].name, {}
            ),
        ),
        patch(
            "custom_components.skelly_ultra.client_adapter.establish_connection",
            side_effect=establish_connection,
        ),
        patch(
            "custom_components.skelly_ultra.client_adapter.close_stale_connections_by_address"
        ),
        patch(
            "custom_components.skelly_ultra.skelly_ultra_pkg.client.BleakScanner.find_device_by_address",
            return_value=None,
        ),
        patch(
            "custom_components.skelly_ultra.skelly_ultra_pkg.client.SkellyClient._get_rest_session",
            lambda self: session,
        ),
    ):
        dev_reg = dr.async_get(hass)
        # Setting up one entry sets up the integration with all its entries
        assert await hass.config_entries.async_setup(result.entries[0].entry_id)
        await hass.async_block_till_done()
        for entry in result.entries:
            assert entry.state is ConfigEntryState.LOADED
            (device,) = dr.async_entries_for_config_entry(dev_reg, entry.entry_id)
            result.device_ids.append(device.id)
        yield result
        for entry in result.entries:
            await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
    await session.close()


def cast(skellys: Skellys, **extra) -> list[dict[str, Any]]:
    return [
        {
            "device_id": skellys.device_ids[0],
            "name": "Bones",
            "persona": "a grumpy old skeleton",
            "tts_options": {"voice": "old"},
            **extra,
        },
        {
            "device_id": skellys.device_ids[1],
            "name": "Rattles",
            "persona": "an overexcited young skeleton",
            "tts_options": {"voice": "kid"},
        },
    ]


async def converse(hass: HomeAssistant, skellys: Skellys, **data):
    return await hass.services.async_call(
        DOMAIN,
        "converse",
        {
            "participants": cast(skellys),
            "prompt": "Argue about who is scarier.",
            "tts_entity": "tts.fake_voice",
            "ai_task_entity": "ai_task.fake_ai",
            **data,
        },
        blocking=True,
        return_response=True,
    )


SCRIPT = {
    "topic": "who is scarier",
    "lines": [
        {"speaker": "Bones", "text": "I am the scariest.", "mood": "menacing"},
        {"speaker": "Rattles", "text": "No, I am!", "mood": "playful"},
        {"speaker": "Bones", "text": "Hmph.", "mood": "menacing"},
        {"speaker": "Rattles", "text": "Boo!", "mood": "spooky"},
    ],
}


async def test_converse_speaks_lines_in_turn_with_own_voices_and_moods(
    hass, skellys, fake_ai, tts_entity
):
    bones, rattles = skellys.devices
    bones.eye_icon = 3
    rattles.lights[0] = Light(rgb=(1, 2, 3), brightness=200)
    await advance(hass, 31)  # next poll picks up the looks above
    fake_ai.answer = SCRIPT

    result = await converse(hass, skellys)

    assert result["status"] == "ok"
    assert result["topic"] == "who is scarier"
    assert [
        (x["speaker"], x["text"], x["mood"], x["spoken"]) for x in result["lines"]
    ] == [
        ("Bones", "I am the scariest.", "menacing", True),
        ("Rattles", "No, I am!", "playful", True),
        ("Bones", "Hmph.", "menacing", True),
        ("Rattles", "Boo!", "spooky", True),
    ]
    assert result["lines"][0]["device_id"] == skellys.device_ids[0]
    assert result["history"] == ["who is scarier"]

    # In turn, each through its own live speaker
    assert [label for label, _look in skellys.log] == [
        "Bones",
        "Rattles",
        "Bones",
        "Rattles",
    ]
    # Each line in its speaker's voice
    spoken = {text: options for text, _lang, options in tts_entity.spoken}
    assert spoken["I am the scariest."] == {"voice": "old"}
    assert spoken["No, I am!"] == {"voice": "kid"}
    # The line's mood on the speaker only: menacing = red eyeball (5), red lights
    first = skellys.log[0][1]
    assert first.eye_icon == 5 and first.lights[0].rgb == (255, 0, 0)
    assert first.action == 255
    second = skellys.log[1][1]
    assert second.eye_icon == 13  # playful: fireworks
    fourth = skellys.log[3][1]
    assert fourth.eye_icon == 9  # spooky: color spiral
    # Afterwards both look as before
    assert bones.eye_icon == 3
    assert rattles.lights[0].rgb == (1, 2, 3) and rattles.lights[0].brightness == 200
    assert all(server.connected for server in skellys.servers), "live mode left on"

    # The AI got the cast, the line count and a structure for a list of lines
    (task,) = fake_ai.requests
    assert "Argue about who is scarier." in task.instructions
    assert "- Bones: a grumpy old skeleton" in task.instructions
    assert "- Rattles: an overexcited young skeleton" in task.instructions
    assert "at most 6 lines" in task.instructions
    lines_schema = fake_ai.schemas[0]["properties"]["lines"]
    assert lines_schema["type"] == "array"
    item = lines_schema["items"]
    assert item["type"] == "object"
    assert set(item["required"]) == {"speaker", "text", "mood"}
    assert item["properties"]["speaker"]["enum"] == ["Bones", "Rattles"]


async def test_converse_history_avoids_recent_topics(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    await converse(hass, skellys, mood="none")
    fake_ai.answer = {**SCRIPT, "topic": "the weather"}
    result = await converse(hass, skellys, mood="none")
    assert "- who is scarier" in fake_ai.requests[1].instructions
    assert result["history"] == ["who is scarier", "the weather"]
    # mood none: no mood field asked for, looks untouched
    assert (
        "mood" not in fake_ai.schemas[1]["properties"]["lines"]["items"]["properties"]
    )
    assert all(look.eye_icon == 1 for _label, look in skellys.log)


async def test_converse_drops_unusable_lines_and_caps_the_count(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = {
        "topic": "t",
        "lines": [
            {"speaker": "Nobody", "text": "Who am I?", "mood": "spooky"},
            {"speaker": "bones ", "text": "One", "mood": "nonsense"},
            {"speaker": "Rattles", "text": "  ", "mood": "spooky"},
            {"speaker": "Rattles", "text": "Two", "mood": "spooky"},
            {"speaker": "Bones", "text": "Three", "mood": "spooky"},
        ],
    }
    result = await converse(hass, skellys, max_lines=2)
    assert [(x["speaker"], x["text"], x["mood"]) for x in result["lines"]] == [
        ("Bones", "One", "none"),
        ("Rattles", "Two", "spooky"),
    ]
    assert [label for label, _look in skellys.log] == ["Bones", "Rattles"]


@pytest.mark.parametrize(
    "lines",
    [
        [{"speaker": "Bones", "text": "a"}, {"speaker": "Bones", "text": "b"}],
        [{"speaker": "Bones", "text": "a"}],
        [],
    ],
)
async def test_converse_needs_two_speakers(hass, skellys, fake_ai, tts_entity, lines):
    fake_ai.answer = {"topic": "t", "lines": lines}
    with pytest.raises(HomeAssistantError, match="no usable conversation"):
        await converse(hass, skellys, mood="none")
    assert skellys.log == []
    assert tts_entity.spoken == []


async def test_converse_skips_a_line_whose_speech_fails(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    original = tts_entity.get_tts_audio

    def fail_on_hmph(message, language, options):
        if message == "Hmph.":
            raise RuntimeError("voice service down")
        return original(message, language, options)

    tts_entity.get_tts_audio = fail_on_hmph
    result = await converse(hass, skellys)
    assert [x["spoken"] for x in result["lines"]] == [True, True, False, True]
    assert [label for label, _look in skellys.log] == ["Bones", "Rattles", "Rattles"]

    # abort: ends with an error, looks restored
    with pytest.raises(HomeAssistantError, match=r"Line 3 \(Bones\).*Text-to-speech"):
        await converse(hass, skellys, on_line_error="abort")
    assert skellys.devices[0].eye_icon == 1


async def test_converse_fails_fast_when_a_live_mode_cannot_connect(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    skellys.servers[1].up = False
    loop = asyncio.get_running_loop()
    start = loop.time()
    with pytest.raises(
        HomeAssistantError, match="Rattles: Live mode did not connect"
    ) as err:
        await converse(hass, skellys)
    assert "own Bluetooth adapter" in str(err.value)
    assert loop.time() - start < 10, "didn't wait for the 30 s timeout"
    assert skellys.log == []
    assert skellys.devices[0].eye_icon == 1
    # Not left busy
    skellys.servers[1].up = True
    assert (await converse(hass, skellys))["status"] == "ok"


async def test_converse_is_busy_while_a_skelly_performs(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    manager = hass.data[DOMAIN][skellys.entries[1].entry_id]["perform"]
    manager.running = True
    result = await converse(hass, skellys)
    assert result == {"status": "busy", "busy": ["Rattles"]}
    assert fake_ai.requests == []
    assert not hass.data[DOMAIN][skellys.entries[0].entry_id]["perform"].running


async def test_converse_without_waiting_returns_at_the_first_line(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    result = await converse(hass, skellys, wait_until_done=False)
    assert result["status"] == "ok"
    assert "spoken" not in result["lines"][0]
    assert len(skellys.log) == 1
    managers = [
        hass.data[DOMAIN][entry.entry_id]["perform"] for entry in skellys.entries
    ]
    assert all(m.running for m in managers), "busy until the conversation ends"
    busy = await hass.services.async_call(
        DOMAIN,
        "perform",
        {
            "device_id": skellys.device_ids[0],
            "message": "Hi",
            "tts_entity": "tts.fake_voice",
        },
        blocking=True,
        return_response=True,
    )
    assert busy == {"status": "busy"}
    for _ in range(200):
        if not any(m.running for m in managers):
            break
        await asyncio.sleep(0.05)
    assert len(skellys.log) == 4
    assert not any(m.running for m in managers)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda c: c[:1], "2 to 6 participants"),
        (lambda c: [c[0], {**c[1], "name": "bones"}], "names must be different"),
        (lambda c: [c[0], {**c[1], "device_id": c[0]["device_id"]}], "same Skelly"),
        (lambda c: [c[0], {**c[1], "device_id": "nope"}], "Rattles: device nope"),
        (lambda c: [c[0], {"name": "X"}], "device_id or entity_id"),
    ],
)
async def test_converse_rejects_bad_participants(
    hass, skellys, fake_ai, tts_entity, change, message
):
    fake_ai.answer = SCRIPT
    with pytest.raises((vol.Invalid, ServiceValidationError), match=message):
        await converse(hass, skellys, participants=change(cast(skellys)))
    assert fake_ai.requests == []
    assert not any(server.connected for server in skellys.servers)


async def test_converse_checks_voices_before_starting(
    hass, skellys, fake_ai, tts_entity
):
    fake_ai.answer = SCRIPT
    participants = cast(skellys)
    participants[1]["tts_entity"] = "tts.fake_voice"
    participants[1]["language"] = "fr"
    with pytest.raises(ServiceValidationError, match="Rattles: Text-to-speech"):
        await converse(hass, skellys, participants=participants)
    assert fake_ai.requests == []
    assert not any(server.connected for server in skellys.servers)


async def test_perform_fails_fast_when_live_mode_cannot_connect(
    hass, skellys, tts_entity
):
    skellys.servers[0].up = False
    loop = asyncio.get_running_loop()
    start = loop.time()
    with pytest.raises(HomeAssistantError, match="Live mode did not connect"):
        await hass.services.async_call(
            DOMAIN,
            "perform",
            {
                "device_id": skellys.device_ids[0],
                "message": "Hi",
                "tts_entity": "tts.fake_voice",
            },
            blocking=True,
        )
    assert loop.time() - start < 10


async def test_converse_blueprint(hass, skellys, fake_ai, tts_entity):
    """The bundled blueprint builds the cast from its slots and talks on a button."""
    import shutil
    from pathlib import Path

    from homeassistant.setup import async_setup_component

    source = (
        Path(__file__).parent.parent
        / "blueprints/automation/skelly_ultra/converse.yaml"
    )
    target = Path(hass.config.path("blueprints/automation/skelly_ultra"))
    target.mkdir(parents=True)
    shutil.copy(source, target / "converse.yaml")

    assert await async_setup_component(
        hass, "input_button", {"input_button": {"talk": {"name": "Talk"}}}
    )
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": {
                "id": "skelly_talk",
                "alias": "Skellys talk",
                "use_blueprint": {
                    "path": "skelly_ultra/converse.yaml",
                    "input": {
                        "trigger_entity": ["binary_sensor.nothing"],
                        "force_entity": ["input_button.talk"],
                        "tts_entity": "tts.fake_voice",
                        "ai_task_entity": "ai_task.fake_ai",
                        "prompt": "Talk about pumpkins.",
                        "skelly_1": skellys.device_ids[0],
                        "persona_1": "a grumpy old skeleton",
                        "voice_1": {"voice": "old"},
                        "skelly_2": skellys.device_ids[1],
                        "name_2": "Little Rattles",
                        "voice_2": {"voice": "kid"},
                        "after_start": [
                            {
                                "event": "skelly_talked",
                                "event_data": {
                                    "topic": "{{ conversation.topic }}",
                                    "count": "{{ conversation.lines | count }}",
                                },
                            }
                        ],
                    },
                },
            }
        },
    )
    await hass.async_block_till_done()
    assert hass.states.get("automation.skellys_talk").state == "on"

    events = []
    hass.bus.async_listen("skelly_talked", events.append)
    fake_ai.answer = {
        "topic": "pumpkins",
        "lines": [
            {"speaker": "Skelly 1", "text": "Pumpkins.", "mood": "spooky"},
            {"speaker": "Little Rattles", "text": "Yay!", "mood": "playful"},
        ],
    }
    await hass.services.async_call(
        "input_button", "press", {"entity_id": "input_button.talk"}, blocking=True
    )
    for _ in range(200):
        if len(skellys.log) == 2 and events:
            break
        await asyncio.sleep(0.05)

    (task,) = fake_ai.requests
    assert task.instructions.startswith("Talk about pumpkins.")
    assert "- Skelly 1: a grumpy old skeleton" in task.instructions
    assert "- Little Rattles\n" in task.instructions
    assert [label for label, _look in skellys.log] == ["Bones", "Rattles"]
    spoken = {text: options for text, _lang, options in tts_entity.spoken}
    assert spoken == {"Pumpkins.": {"voice": "old"}, "Yay!": {"voice": "kid"}}
    assert events[0].data == {"topic": "pumpkins", "count": 2}
    # Let the conversation finish before the test ends
    managers = [
        hass.data[DOMAIN][entry.entry_id]["perform"] for entry in skellys.entries
    ]
    for _ in range(200):
        if not any(m.running for m in managers):
            break
        await asyncio.sleep(0.05)


async def test_converse_stopped_midway_silences_restores_and_cleans_up(
    hass, skellys, fake_ai, tts_entity, tmp_path, monkeypatch
):
    import tempfile

    temp_dir = tmp_path / "temp"
    temp_dir.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(temp_dir))
    fake_ai.answer = SCRIPT
    skellys.servers[0].clip_polls = 30  # the first line plays for a long time
    task = hass.async_create_task(converse(hass, skellys))
    for _ in range(200):
        if skellys.servers[0].playing:
            break
        await asyncio.sleep(0.05)
    assert skellys.log and skellys.devices[0].eye_icon == 5  # menacing look on
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await hass.async_block_till_done()
    assert not skellys.servers[0].playing, "the speaking Skelly was stopped"
    assert len(skellys.log) == 1
    assert skellys.devices[0].eye_icon == 1, "look restored"
    managers = [
        hass.data[DOMAIN][entry.entry_id]["perform"] for entry in skellys.entries
    ]
    assert not any(m.running for m in managers)
    for _ in range(50):
        if not list(temp_dir.iterdir()):
            break
        await asyncio.sleep(0.05)
    assert list(temp_dir.iterdir()) == [], "rendered lines deleted"
    # The speaker notices the stop at its next status poll
    player = hass.data[DOMAIN][skellys.entries[0].entry_id]["live_media_player"]
    for _ in range(60):
        if player._monitor_task is None or player._monitor_task.done():
            break
        await asyncio.sleep(0.05)


async def test_converse_takes_entity_ids_and_blank_values(
    hass, skellys, fake_ai, tts_entity
):
    from homeassistant.helpers import entity_registry as er

    fake_ai.answer = SCRIPT
    ent_reg = er.async_get(hass)
    entity = next(
        e
        for e in er.async_entries_for_config_entry(ent_reg, skellys.entries[1].entry_id)
        if e.domain == "media_player"
    )
    participants = cast(skellys, entity_id="", persona="", language="")
    participants[1] = {
        "device_id": "",
        "entity_id": entity.entity_id,
        "name": "Rattles",
        "tts_entity": "",
        "tts_options": "",
    }
    result = await converse(
        hass, skellys, participants=participants, camera_entity="", tts_options=""
    )
    assert result["status"] == "ok"
    assert result["lines"][1]["device_id"] == skellys.device_ids[1]
    assert [label for label, _look in skellys.log] == [
        "Bones",
        "Rattles",
        "Bones",
        "Rattles",
    ]


async def test_perform_keeps_waiting_while_ble_is_down(hass, skellys, tts_entity):
    """A BLE reconnect may still restore live mode, so no fail-fast then."""
    from custom_components.skelly_ultra.skelly_ultra_pkg.client import SkellyClient

    skellys.servers[0].up = False
    loop = asyncio.get_running_loop()
    start = loop.time()
    with (
        patch.object(
            SkellyClient, "is_connected", new_callable=PropertyMock, return_value=False
        ),
        pytest.raises(HomeAssistantError, match="within 2 seconds"),
    ):
        await hass.services.async_call(
            DOMAIN,
            "perform",
            {
                "device_id": skellys.device_ids[0],
                "message": "Hi",
                "tts_entity": "tts.fake_voice",
                "live_mode_timeout": 2,
            },
            blocking=True,
        )
    assert loop.time() - start >= 1.9


async def test_perform_speaks_after_a_ble_reconnect(
    hass, skellys, tts_entity, monkeypatch
):
    """Live mode that fails while BLE is down comes up with the reconnect."""
    from custom_components.skelly_ultra import client_adapter

    monkeypatch.setattr(client_adapter, "RECONNECT_DELAYS", [0.2] * 3)
    monkeypatch.setattr(client_adapter, "RECONNECT_MAX_DELAY", 0.2)
    bones = skellys.devices[0]
    bones.reachable = False
    bones.drop_connection()
    await hass.async_block_till_done()
    task = hass.async_create_task(
        hass.services.async_call(
            DOMAIN,
            "perform",
            {
                "device_id": skellys.device_ids[0],
                "message": "I'm back",
                "tts_entity": "tts.fake_voice",
                "live_mode_timeout": 20,
            },
            blocking=True,
            return_response=True,
        )
    )
    await asyncio.sleep(0.5)
    assert not task.done(), "still waiting for the reconnect"
    bones.reachable = True  # the adapter's reconnect loop finds it again
    result = await asyncio.wait_for(task, 15)
    assert result["status"] == "ok"
    assert [label for label, _look in skellys.log] == ["Bones"]
