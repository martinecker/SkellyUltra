"""The Skelly sidebar panel and dashboard card: serving and registering them."""

import hashlib
import logging

from homeassistant.components import frontend as ha_frontend
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra import frontend
from custom_components.skelly_ultra.const import (
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_SHOW_PANEL,
    CONF_USE_BLE_PROXY,
    DEVICE_TYPE_SKELLY,
    DOMAIN,
)

BUNDLE = frontend.FRONTEND_DIR / frontend.BUNDLE_NAME


def bundle_url() -> str:
    version = hashlib.sha256(BUNDLE.read_bytes()).hexdigest()[:16]
    return f"/skelly_ultra/frontend/skelly-ultra.js?v={version}"


async def panels(hass: HomeAssistant, hass_ws_client) -> dict:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "get_panels"})
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


def extra_module_urls(hass: HomeAssistant) -> frozenset[str]:
    return hass.data[ha_frontend.DATA_EXTRA_MODULE_URL].urls


async def set_show_panel(hass: HomeAssistant, entry, show: bool) -> dict:
    """Change the option through the options flow, as a user would."""
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_SHOW_PANEL: show}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    return result


def other_skelly(hass: HomeAssistant, **options) -> MockConfigEntry:
    """A second Skelly, not connected (the Connected switch is off)."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Second Skelly",
        data={
            "address": "11:22:33:44:55:66",
            "name": "Second Skelly",
            CONF_SERVER_URL: "http://localhost:8765",
            CONF_USE_BLE_PROXY: False,
            CONF_DEVICE_TYPE: DEVICE_TYPE_SKELLY,
        },
        options={"connected": False, **options},
        unique_id="11:22:33:44:55:66",
    )
    entry.add_to_hass(hass)
    return entry


async def test_bundle_is_served_and_loaded_on_every_page(
    hass, setup_integration, hass_client
):
    url = bundle_url()
    assert url in extra_module_urls(hass)

    client = await hass_client()
    response = await client.get(url)
    assert response.status == 200
    assert "javascript" in response.headers["Content-Type"]
    # Cached by browsers; the hash in the URL changes with the bundle
    assert "max-age" in response.headers["Cache-Control"]
    assert await response.read() == BUNDLE.read_bytes()


async def test_panel_is_in_the_sidebar(hass, setup_integration, hass_ws_client):
    panel = (await panels(hass, hass_ws_client))["skelly-ultra"]

    assert panel["title"] == "Skelly"
    assert panel["icon"] == "mdi:skull"
    assert panel["require_admin"] is False
    custom = panel["config"]["_panel_custom"]
    assert custom["name"] == "skelly-ultra-panel"
    # The panel loads the same module as every page, so the browser loads it once
    assert custom["module_url"] == bundle_url()
    assert bundle_url().endswith(f"?v={panel['config']['version']}")


async def test_panel_is_also_shown_to_users_who_are_not_admins(
    hass, setup_integration, hass_ws_client, hass_read_only_access_token
):
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": "get_panels"})
    response = await client.receive_json()
    assert "skelly-ultra" in response["result"]


async def test_option_hides_and_shows_the_panel(
    hass, setup_integration, hass_ws_client
):
    entry = setup_integration
    assert entry.options.get("connected") is True

    await set_show_panel(hass, entry, False)

    assert entry.options[CONF_SHOW_PANEL] is False
    # The other options (switch states) are kept, and the device stays loaded
    assert entry.options["connected"] is True
    assert entry.state is ConfigEntryState.LOADED
    assert "skelly-ultra" not in await panels(hass, hass_ws_client)
    # The card stays available
    assert bundle_url() in extra_module_urls(hass)

    await set_show_panel(hass, entry, True)

    assert "skelly-ultra" in await panels(hass, hass_ws_client)


async def test_options_form_shows_the_current_value(hass, setup_integration):
    entry = setup_integration
    result = await hass.config_entries.options.async_init(entry.entry_id)
    schema = result["data_schema"].schema
    (key,) = schema
    assert key == CONF_SHOW_PANEL
    assert key.default() is True

    await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_SHOW_PANEL: False}
    )
    result = await hass.config_entries.options.async_init(entry.entry_id)
    (key,) = result["data_schema"].schema
    assert key.default() is False


async def test_panel_is_shown_while_any_skelly_wants_it(
    hass, setup_integration, hass_ws_client
):
    first = setup_integration
    second = other_skelly(hass, **{CONF_SHOW_PANEL: False})
    assert await hass.config_entries.async_setup(second.entry_id)
    await hass.async_block_till_done()
    assert "skelly-ultra" in await panels(hass, hass_ws_client)

    await set_show_panel(hass, first, False)
    assert "skelly-ultra" not in await panels(hass, hass_ws_client)

    await set_show_panel(hass, second, True)
    assert "skelly-ultra" in await panels(hass, hass_ws_client)

    # The Skelly that wants the panel unloads: no loaded Skelly wants it
    assert await hass.config_entries.async_unload(second.entry_id)
    await hass.async_block_till_done()
    assert "skelly-ultra" not in await panels(hass, hass_ws_client)


async def test_unloading_the_last_skelly_removes_the_panel(
    hass, setup_integration, hass_ws_client
):
    entry = setup_integration
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert "skelly-ultra" not in await panels(hass, hass_ws_client)

    # Setting it up again (as on a reload) brings the panel back
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert "skelly-ultra" in await panels(hass, hass_ws_client)


async def test_reloading_keeps_the_panel(hass, setup_integration, hass_ws_client):
    entry = setup_integration
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert "skelly-ultra" in await panels(hass, hass_ws_client)
    # Loaded on every page once, not once per setup
    assert len([u for u in extra_module_urls(hass) if "skelly_ultra" in u]) == 1


async def test_two_skellies_set_up_at_once_register_once(
    hass, config_entry, mock_ble, hass_ws_client
):
    second = other_skelly(hass)
    # async_setup of the first sets up all entries of the domain together
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert second.state is ConfigEntryState.LOADED

    assert "skelly-ultra" in await panels(hass, hass_ws_client)
    assert len([u for u in extra_module_urls(hass) if "skelly_ultra" in u]) == 1


async def test_missing_bundle_logs_an_error_and_sets_up_anyway(
    hass, config_entry, mock_ble, hass_ws_client, tmp_path, monkeypatch, caplog
):
    monkeypatch.setattr(frontend, "FRONTEND_DIR", tmp_path / "missing")
    with caplog.at_level(logging.ERROR):
        assert await hass.config_entries.async_setup(config_entry.entry_id)
        await hass.async_block_till_done()

    assert config_entry.state is ConfigEntryState.LOADED
    assert "Frontend bundle" in caplog.text
    assert "skelly-ultra" not in await panels(hass, hass_ws_client)
    assert not [u for u in extra_module_urls(hass) if "skelly_ultra" in u]


def test_bundle_is_committed():
    """HACS installs the integration as it is in git: no build step."""
    assert BUNDLE.is_file()
    assert b"skelly-ultra-panel" in BUNDLE.read_bytes()


async def test_panel_url_taken_by_another_panel(
    hass, config_entry, mock_ble, hass_ws_client, caplog
):
    """A panel_custom in YAML at /skelly-ultra: the Skelly still sets up."""
    from homeassistant.components import panel_custom
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, "panel_custom", {})
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path="skelly-ultra",
        webcomponent_name="my-panel",
        module_url="/local/my-panel.js",
    )

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    assert config_entry.state is ConfigEntryState.LOADED
    assert "another panel already uses /skelly-ultra" in caplog.text
    panel = (await panels(hass, hass_ws_client))["skelly-ultra"]
    assert panel["config"]["_panel_custom"]["name"] == "my-panel"

    # Option writes (e.g. the Connected switch) retry, but log the error once
    hass.config_entries.async_update_entry(
        config_entry, options={**config_entry.options, "live_mode_connected": True}
    )
    await hass.async_block_till_done()
    errors = [
        r
        for r in caplog.records
        if r.levelno >= logging.ERROR and "another panel already uses" in r.message
    ]
    assert len(errors) == 1

    # Unloading must not remove the other panel
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert "skelly-ultra" in await panels(hass, hass_ws_client)
