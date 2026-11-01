"""Shared fixtures for the Skelly Ultra tests.

Tests run the real integration (config entry setup, coordinator, entities,
services, SkellyClient, parser) against FakeSkellyDevice, a simulated device
that speaks the BLE protocol. Only Home Assistant's Bluetooth lookup and
bleak-retry-connector are patched, to hand the integration the simulated
device instead of a radio.
"""

from __future__ import annotations

import asyncio
import time
from datetime import timedelta
from unittest.mock import patch

import pytest
from bleak.backends.device import BLEDevice
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_USE_BLE_PROXY,
    DEVICE_TYPE_SKELLY,
    DOMAIN,
)

from .device_sim import FakeSkellyDevice

ADDRESS = "AA:BB:CC:DD:EE:FF"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Let Home Assistant load custom_components/skelly_ultra."""
    return


@pytest.fixture(autouse=True)
def own_config_dir(hass: HomeAssistant, tmp_path):
    """Give each test its own config dir, so files (e.g. TTS cache) don't leak."""
    hass.config.config_dir = str(tmp_path)


class _FastAsyncio:
    """asyncio, except that sleep() doesn't wait for real.

    The coordinator waits 2s after each command for the device to settle
    before it polls. Tests skip that wait; they don't need real time to pass.
    """

    def __getattr__(self, name):
        return getattr(asyncio, name)

    @staticmethod
    async def sleep(delay, result=None):
        return await _real_sleep(0, result)


_real_sleep = asyncio.sleep


class _ShiftedTime:
    """time, with a monotonic() that tests can move forward.

    The coordinator debounces refresh requests by time.monotonic(), which
    async_fire_time_changed doesn't move.
    """

    def __init__(self):
        self.offset = 0.0

    def __getattr__(self, name):
        return getattr(time, name)

    def monotonic(self):
        return time.monotonic() + self.offset


COORDINATOR_TIME = _ShiftedTime()


@pytest.fixture(autouse=True)
def no_settle_delay():
    COORDINATOR_TIME.offset = 0.0
    with (
        patch("custom_components.skelly_ultra.coordinator.asyncio", _FastAsyncio()),
        patch("custom_components.skelly_ultra.coordinator.time", COORDINATOR_TIME),
    ):
        yield


async def advance(hass: HomeAssistant, seconds: float) -> None:
    """Let `seconds` of time pass, firing timers and sleeps due by then.

    Coordinator polls and reconnects run as background tasks, which
    async_block_till_done doesn't wait for, so give them a moment to finish.
    """
    COORDINATOR_TIME.offset += seconds
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=seconds))
    for _ in range(10):
        await hass.async_block_till_done()
        await asyncio.sleep(0.01)


@pytest.fixture
def device() -> FakeSkellyDevice:
    """A simulated Ultra Skelly with three files on it."""
    dev = FakeSkellyDevice(address=ADDRESS)
    dev.add_file("hello.mp3", duration=4)
    dev.add_file("laugh.mp3", duration=7)
    dev.add_file("scream.mp3", duration=3)
    return dev


@pytest.fixture
def mock_ble(device: FakeSkellyDevice):
    """Route the integration's BLE connects to the simulated device."""

    async def establish_connection(
        client_class, ble_device, name, disconnected_callback=None, **kw
    ):
        device.set_disconnected_callback(disconnected_callback)
        await device.connect()
        return device

    ble_device = BLEDevice(ADDRESS, device.name, {})
    with (
        patch(
            "custom_components.skelly_ultra.client_adapter.bluetooth.async_ble_device_from_address",
            side_effect=lambda hass, address, *a, **kw: (
                ble_device if device.reachable else None
            ),
        ),
        patch(
            "custom_components.skelly_ultra.client_adapter.establish_connection",
            side_effect=establish_connection,
        ),
        patch(
            "custom_components.skelly_ultra.client_adapter.close_stale_connections_by_address"
        ),
        # Library fallback discovery: never touch a real radio.
        patch(
            "custom_components.skelly_ultra.skelly_ultra_pkg.client.BleakScanner.find_device_by_address",
            return_value=None,
        ),
    ):
        yield device


@pytest.fixture
def config_entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Ultra Skelly v2",
        data={
            "address": ADDRESS,
            "name": "Ultra Skelly v2",
            CONF_SERVER_URL: "http://localhost:8765",
            CONF_USE_BLE_PROXY: False,
            CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY,
        },
        unique_id=ADDRESS,
    )
    entry.add_to_hass(hass)
    return entry


@pytest.fixture
async def setup_integration(hass: HomeAssistant, config_entry, mock_ble):
    """Set up the integration, connected to the simulated device and polled once."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry


def entity_id(
    hass: HomeAssistant, entry: MockConfigEntry, platform: str, suffix: str
) -> str:
    """Look up an entity id by its unique id suffix (stable across renames)."""
    ent_reg = er.async_get(hass)
    eid = ent_reg.async_get_entity_id(platform, DOMAIN, f"{entry.entry_id}_{suffix}")
    assert eid, f"no {platform} entity with unique id suffix {suffix!r}"
    return eid


def coordinator(hass: HomeAssistant, entry: MockConfigEntry):
    return hass.data[DOMAIN][entry.entry_id]["coordinator"]


async def wait_for(hass: HomeAssistant, condition, timeout: float = 2.0) -> None:
    """Wait (real time) until condition() is true; for background loops."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while not condition():
        if loop.time() > deadline:
            raise AssertionError("condition not met in time")
        await hass.async_block_till_done()
        await asyncio.sleep(0.02)


@pytest.fixture
async def rest_server(hass: HomeAssistant, aioclient_mock, device):
    """The Skelly REST server (live mode), simulated at the HTTP level."""
    from .rest_sim import FakeRestServer

    server = FakeRestServer(aioclient_mock, device, "http://localhost:8765")
    session = aioclient_mock.create_session(hass.loop)
    with patch(
        "custom_components.skelly_ultra.skelly_ultra_pkg.client.SkellyClient._get_rest_session",
        lambda self: session,
    ):
        yield server
        # Unload while the server is still faked: unloading disconnects live mode.
        for entry in hass.config_entries.async_entries(DOMAIN):
            await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
    await session.close()


@pytest.fixture
def tone_mp3(tmp_path_factory) -> bytes:
    """A short MP3 clip (needs ffmpeg)."""
    import shutil
    import subprocess

    if shutil.which("ffmpeg") is None:
        pytest.skip("needs ffmpeg")
    path = tmp_path_factory.mktemp("audio") / "tone.mp3"
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
    return path.read_bytes()


@pytest.fixture
async def tts_entity(hass: HomeAssistant, tone_mp3):
    """A text-to-speech entity, tts.fake_voice, that records what it says."""
    from homeassistant.components import tts
    from pytest_homeassistant_custom_component.common import (
        MockModule,
        MockPlatform,
        mock_config_flow,
        mock_integration,
        mock_platform,
    )

    class FakeVoice(tts.TextToSpeechEntity):
        _attr_name = "Fake voice"
        _attr_unique_id = "fake_voice"
        _attr_default_language = "en"
        _attr_supported_languages = ["en", "de"]
        _attr_supported_options = ["voice"]

        def __init__(self):
            self.spoken: list[tuple[str, str, dict]] = []
            self.fail = False

        def get_tts_audio(self, message, language, options):
            if self.fail:
                raise RuntimeError("voice service down")
            self.spoken.append((message, language, dict(options)))
            return ("mp3", tone_mp3)

    voice = FakeVoice()

    async def setup_entry(hass, entry):
        await hass.config_entries.async_forward_entry_setups(entry, ["tts"])
        return True

    async def setup_tts_platform(hass, entry, async_add_entities):
        async_add_entities([voice])

    mock_integration(hass, MockModule("fakevoice", async_setup_entry=setup_entry))
    mock_platform(
        hass, "fakevoice.tts", MockPlatform(async_setup_entry=setup_tts_platform)
    )
    mock_platform(hass, "fakevoice.config_flow")
    from homeassistant.config_entries import ConfigFlow
    from homeassistant.setup import async_setup_component

    class FakeVoiceFlow(ConfigFlow):
        VERSION = 1

    with mock_config_flow("fakevoice", FakeVoiceFlow):
        assert await async_setup_component(hass, "tts", {})
        entry = MockConfigEntry(domain="fakevoice")
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        yield voice
