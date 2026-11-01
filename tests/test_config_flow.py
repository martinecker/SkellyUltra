"""Adding a Skelly through the UI."""

from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra.config_flow import SkellyFlowHandler
from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_USE_BLE_PROXY,
    DEVICE_TYPE_SKELLY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
)

SERVER = "http://pi.local:8765"


class FakeRestServer:
    """Stands in for the Skelly REST server the flow talks to."""

    def __init__(self):
        self.up = True
        self.devices = [
            {"name": "Animated Skelly", "address": "11:11:11:11:11:11"},
            {"name": "12ft Skelly", "address": "22:22:22:22:22:22"},
            {"name": "Kitchen Speaker", "address": "33:33:33:33:33:33"},
        ]

    @property
    def validate(self):
        async def _validate_rest_server(flow, server_url):
            return None if self.up else {"base": "rest_server_unreachable"}

        return _validate_rest_server

    @property
    def scan(self):
        async def _scan_via_rest_server(flow, name_filter=None):
            return self.devices if self.up else []

        return _scan_via_rest_server


@pytest.fixture
def rest_server():
    server = FakeRestServer()
    with (
        patch.object(SkellyFlowHandler, "_validate_rest_server", server.validate),
        patch.object(SkellyFlowHandler, "_scan_via_rest_server", server.scan),
        patch("custom_components.skelly_ultra.async_setup_entry", return_value=True),
    ):
        yield server


@pytest.fixture
def bluetooth_entry(hass):
    """A configured Bluetooth integration (not started: no adapter needed)."""
    MockConfigEntry(domain="bluetooth").add_to_hass(hass)
    with patch(
        "homeassistant.components.bluetooth.async_setup_entry", return_value=True
    ):
        yield


def form(**overrides):
    data = {
        CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY,
        CONF_USE_BLE_PROXY: False,
        "mode": "manual",
        "address": "AA:BB:CC:DD:EE:FF",
        "name": "Bones",
        CONF_SERVER_URL: SERVER,
    }
    data.update(overrides)
    return data


async def start(hass: HomeAssistant):
    return await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )


async def test_manual_direct_ble(hass, rest_server, bluetooth_entry):
    result = await start(hass)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], form())
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert "Bones" in result["title"] and "AA:BB:CC:DD:EE:FF" in result["title"]
    assert result["data"] == {
        "address": "AA:BB:CC:DD:EE:FF",
        "name": "Bones",
        CONF_SERVER_URL: SERVER,
        CONF_USE_BLE_PROXY: False,
        CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY,
    }


async def test_server_url_trailing_slash_is_dropped(hass, rest_server, bluetooth_entry):
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], form(**{CONF_SERVER_URL: SERVER + "/"})
    )
    assert result["data"][CONF_SERVER_URL] == SERVER


async def test_direct_ble_without_server_warns_but_continues(
    hass, rest_server, bluetooth_entry
):
    rest_server.up = False
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], form())
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "server_warning"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"acknowledged": True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_proxy_mode_needs_the_server(hass, rest_server):
    rest_server.up = False
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], form(**{CONF_USE_BLE_PROXY: True})
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "rest_server_unreachable"}


async def test_proxy_mode_title_names_the_server(hass, rest_server):
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], form(**{CONF_USE_BLE_PROXY: True})
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert SERVER in result["title"]
    assert result["data"][CONF_USE_BLE_PROXY] is True


async def test_direct_ble_needs_bluetooth_integration(hass, rest_server):
    result = await start(hass)
    assert result["errors"] == {"base": "bluetooth_integration_required"}


async def test_manual_mode_needs_address(hass, rest_server, bluetooth_entry):
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], form(address="")
    )
    assert result["errors"] == {"base": "address_required"}


async def test_scan_lists_only_skellies_and_detects_model(hass, rest_server):
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        form(**{CONF_USE_BLE_PROXY: True, "mode": "scan", "address": ""}),
    )
    assert result["step_id"] == "scan"
    choices = result["data_schema"].schema["address"].container
    assert "11:11:11:11:11:11" in choices and "22:22:22:22:22:22" in choices
    assert "33:33:33:33:33:33" not in choices

    # Ultra Skelly was selected in the form, but the 12ft's name wins.
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"address": "22:22:22:22:22:22"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"][CONF_DEVICE_TYPE] == DEVICE_TYPE_SKELLY_12FT
    assert result["data"]["name"] == "12ft Skelly"


async def test_scan_show_all_includes_other_devices(hass, rest_server):
    result = await start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        form(**{CONF_USE_BLE_PROXY: True, "mode": "scan", "address": ""}),
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"address": "__show_all__"}
    )
    choices = result["data_schema"].schema["address"].container
    assert "33:33:33:33:33:33" in choices
