"""Config flow for Skelly Ultra integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol
from bleak import BleakScanner

from homeassistant import config_entries
from homeassistant.components import bluetooth
from homeassistant.const import CONF_ADDRESS, CONF_NAME

from .const import (
    ALL_BLE_NAME_FILTERS,
    CONF_DEVICE_TYPE,
    CONF_SERVER_URL,
    CONF_USE_BLE_PROXY,
    DEFAULT_SERVER_URL,
    DEVICE_PROFILES,
    DEVICE_TYPE_SKELLY,
    DOMAIN,
)
from .helpers import build_device_identifier, device_type_from_ble_name

_LOGGER = logging.getLogger(__name__)

SHOW_ALL_TOKEN = "__show_all__"


class SkellyFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Skelly Ultra with discovery option."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize flow state."""
        self._discovered: dict[str, str] = {}
        self._server_url: str = DEFAULT_SERVER_URL
        self._use_ble_proxy: bool = False
        self._user_input: dict[str, Any] | None = None
        self._device_type: str = DEVICE_TYPE_SKELLY
        self._default_name: str = DEVICE_PROFILES[DEVICE_TYPE_SKELLY]["default_name"]

    async def _validate_rest_server(self, server_url: str) -> dict[str, str] | None:
        """Validate the REST server is accessible.

        Returns None if valid, or a dict with error key if invalid.
        """
        try:
            timeout = aiohttp.ClientTimeout(total=5.0)
            async with (
                aiohttp.ClientSession(timeout=timeout) as session,
                session.get(f"{server_url}/health") as resp,
            ):
                if resp.status == 200:
                    return None
                _LOGGER.warning("REST server returned status %d", resp.status)
                return {"base": "rest_server_error"}
        except aiohttp.ClientConnectorError:
            _LOGGER.warning("Cannot connect to REST server at %s", server_url)
            return {"base": "rest_server_unreachable"}
        except Exception:
            _LOGGER.exception("Error validating REST server")
            return {"base": "rest_server_error"}

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Entry point — go straight to the connection form."""
        return await self.async_step_connection()

    async def async_step_connection(self, user_input: dict[str, Any] | None = None):
        """BLE connection details: device type, proxy mode, address/scan, server URL."""
        use_proxy = user_input.get(CONF_USE_BLE_PROXY, False) if user_input else False
        device_type_options = {
            key: profile["display_name"] for key, profile in DEVICE_PROFILES.items()
        }
        current_type = (
            user_input.get(CONF_DEVICE_TYPE, self._device_type)
            if user_input
            else self._device_type
        )
        default_name = DEVICE_PROFILES[current_type]["default_name"]

        schema = vol.Schema(
            {
                vol.Required(CONF_DEVICE_TYPE, default=current_type): vol.In(
                    device_type_options
                ),
                vol.Required(CONF_USE_BLE_PROXY, default=use_proxy): bool,
                vol.Required("mode", default="scan"): vol.In(["manual", "scan"]),
                vol.Optional(CONF_ADDRESS, default=""): str,
                vol.Optional(CONF_NAME, default=default_name): str,
                vol.Required(CONF_SERVER_URL, default=DEFAULT_SERVER_URL): str,
            }
        )

        # In direct mode (not proxy), require that the user has a bluetooth config entry
        if not use_proxy:
            bt_entries = self.hass.config_entries.async_entries("bluetooth")
            if not bt_entries:
                return self.async_show_form(
                    step_id="connection",
                    data_schema=schema,
                    errors={"base": "bluetooth_integration_required"},
                )

        if user_input is None:
            return self.async_show_form(step_id="connection", data_schema=schema)

        # Validate the REST server is accessible (required for proxy mode, optional for direct mode)
        self._device_type = user_input.get(CONF_DEVICE_TYPE, DEVICE_TYPE_SKELLY)
        self._default_name = DEVICE_PROFILES[self._device_type]["default_name"]
        use_ble_proxy = user_input.get(CONF_USE_BLE_PROXY, False)
        server_url = user_input.get(CONF_SERVER_URL, DEFAULT_SERVER_URL).rstrip("/")
        server_errors = await self._validate_rest_server(server_url)

        self._user_input = user_input
        self._server_url = server_url
        self._use_ble_proxy = use_ble_proxy

        if server_errors:
            if use_ble_proxy:
                # Proxy mode requires server - show error and don't proceed
                return self.async_show_form(
                    step_id="connection",
                    data_schema=schema,
                    errors=server_errors,
                )
            # Direct mode - show warning modal
            return await self.async_step_server_warning()

        mode = user_input.get("mode", "manual")
        if mode == "scan":
            return await self.async_step_scan()

        address = user_input.get(CONF_ADDRESS, "")
        if not address:
            return self.async_show_form(
                step_id="connection",
                data_schema=schema,
                errors={"base": "address_required"},
            )

        device_name = user_input.get(CONF_NAME) or default_name
        title = build_device_identifier(
            device_name, address, server_url if use_ble_proxy else None
        )
        return self.async_create_entry(
            title=title,
            data={
                CONF_ADDRESS: address,
                CONF_NAME: device_name,
                CONF_SERVER_URL: server_url,
                CONF_USE_BLE_PROXY: use_ble_proxy,
                CONF_DEVICE_TYPE: self._device_type,
            },
        )

    async def async_step_server_warning(self, user_input: dict[str, Any] | None = None):
        """Show warning about REST server not being available.

        Live mode features require the REST server to be running, but the
        integration can still function without it for basic device control.
        """
        if user_input is not None:
            if self._user_input is None:
                return self.async_abort(reason="unknown")

            mode = self._user_input.get("mode", "manual")
            if mode == "scan":
                return await self.async_step_scan()

            address = self._user_input.get(CONF_ADDRESS, "")
            device_name = self._user_input.get(CONF_NAME) or self._default_name
            title = build_device_identifier(
                device_name, address, self._server_url if self._use_ble_proxy else None
            )
            return self.async_create_entry(
                title=title,
                data={
                    CONF_ADDRESS: address,
                    CONF_NAME: device_name,
                    CONF_SERVER_URL: self._server_url,
                    CONF_USE_BLE_PROXY: self._use_ble_proxy,
                    CONF_DEVICE_TYPE: self._device_type,
                },
            )

        # Show warning form with link to documentation
        # Note: Empty schemas don't display descriptions in Home Assistant,
        # so we add a confirmation checkbox to make the description visible
        return self.async_show_form(
            step_id="server_warning",
            data_schema=vol.Schema(
                {
                    vol.Required("acknowledged", default=True): bool,
                }
            ),
            description_placeholders={
                "docs_url": "https://github.com/martinecker/SkellyUltra/blob/main/custom_components/skelly_ultra/skelly_ultra_srv/README.md"
            },
        )

    async def _scan_via_rest_server(
        self, name_filter: str | None = None
    ) -> list[dict[str, Any]]:
        """Scan for BLE devices via REST server.

        Returns list of devices with 'name' and 'address' keys.
        """
        try:
            timeout = aiohttp.ClientTimeout(total=15.0)
            params = {"timeout": "10.0"}
            if name_filter:
                params["name_filter"] = name_filter

            async with (
                aiohttp.ClientSession(timeout=timeout) as session,
                session.get(
                    f"{self._server_url}/ble/scan_devices", params=params
                ) as resp,
            ):
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        return data.get("devices", [])
                    _LOGGER.warning("REST server scan failed: %s", data.get("error"))
                    return []
                _LOGGER.warning("REST server scan returned status %d", resp.status)
                return []
        except Exception:
            _LOGGER.exception("Error scanning via REST server")
            return []

    async def async_step_scan(self, user_input: dict[str, Any] | None = None):
        """Scan for nearby BLE devices and present a selection list."""
        _LOGGER.debug("async_step_scan called, user_input=%s", user_input)

        # In direct BLE mode, require bluetooth integration
        # In proxy mode, we'll scan via the REST server instead
        if not self._use_ble_proxy:
            bt_entries = self.hass.config_entries.async_entries("bluetooth")
            if not bt_entries:
                return self.async_abort(reason="bluetooth_integration_required")

        if user_input is not None and "action" in user_input:
            action = user_input.get("action")
            if action == "retry":
                return await self.async_step_scan()
            if action == "show_all":
                # Perform an unfiltered scan and present all devices
                choices: dict[str, str] = {}

                if self._use_ble_proxy:
                    # Scan via REST server without filter
                    _LOGGER.debug("Scanning via REST server (proxy mode, show_all)")
                    rest_devices = await self._scan_via_rest_server(name_filter=None)
                    _LOGGER.debug(
                        "REST server returned %d devices (show_all)", len(rest_devices)
                    )

                    for d in rest_devices:
                        addr = d.get("address")
                        if not addr:
                            continue
                        name = d.get("name", "Unknown")
                        display = (
                            f"{name} ({addr})" if name and name != "Unknown" else addr
                        )
                        choices[addr] = display
                else:
                    # Local BLE scan without filter
                    devices = []
                    try:
                        scanner = bluetooth.async_get_scanner(self.hass)
                        devices = await scanner.discover(timeout=5.0)
                    except TimeoutError, OSError:
                        devices = []
                    _LOGGER.debug(
                        "HA scanner returned %d devices (show_all)", len(devices)
                    )

                    # If HA's shared scanner returned nothing, fall back to calling
                    # Bleak directly. This helps when the shared scanner isn't
                    # reporting devices even though BLE hardware can see them.
                    if not devices:
                        try:
                            _LOGGER.debug(
                                "HA scanner returned no devices; falling back to BleakScanner.discover()"
                            )
                            devices = await BleakScanner.discover(timeout=5.0)
                        except TimeoutError, OSError:
                            devices = []

                    for d in devices:
                        addr = getattr(d, "address", None)
                        if not addr:
                            continue
                        name = getattr(d, "name", None)
                        display = f"{name} ({addr})" if name else addr
                        choices[addr] = display

                self._discovered = choices
                _LOGGER.debug("show_all choices populated: %s", choices)
                if not choices:
                    return self.async_show_form(
                        step_id="scan",
                        data_schema=vol.Schema(
                            {
                                vol.Required("action", default="retry"): vol.In(
                                    ["retry", "show_all", "manual"]
                                )
                            }
                        ),
                        errors={"base": "no_devices_found"},
                    )

                schema = vol.Schema({vol.Required(CONF_ADDRESS): vol.In(choices)})
                return self.async_show_form(step_id="scan", data_schema=schema)

            if action == "manual":
                # jump back to the manual entry form
                return await self.async_step_connection()

        if user_input is None:
            # Perform BLE scan - either via REST server (proxy mode) or locally (direct mode)
            choices: dict[str, str] = {}

            if self._use_ble_proxy:
                # Fetch all devices from REST server and filter client-side,
                # since a single name_filter can't cover multiple device types.
                _LOGGER.debug("Scanning via REST server (proxy mode)")
                rest_devices = await self._scan_via_rest_server(name_filter=None)
                _LOGGER.debug(
                    "REST server returned %d devices (filtered)", len(rest_devices)
                )
                for d in rest_devices:
                    addr = d.get("address")
                    name = d.get("name", "") or ""
                    name_lower = name.lower()
                    if not any(f in name_lower for f in ALL_BLE_NAME_FILTERS):
                        continue
                    if addr:
                        display = f"{name} ({addr})"
                        choices[addr] = display
            else:
                # Local BLE scan with filtering
                devices = []
                try:
                    scanner = bluetooth.async_get_scanner(self.hass)
                    devices = await scanner.discover(timeout=5.0)
                except TimeoutError, OSError:
                    devices = []

                _LOGGER.debug("Scanner discovered %d devices (initial)", len(devices))

                # If HA's shared scanner returned nothing, fall back to Bleak
                if not devices:
                    try:
                        _LOGGER.debug(
                            "HA scanner returned no devices during filtered scan; falling back to BleakScanner.discover()"
                        )
                        devices = await BleakScanner.discover(timeout=5.0)
                    except TimeoutError, OSError:
                        devices = []

                for d in devices:
                    _LOGGER.debug(
                        "discovered device: address=%s name=%s",
                        getattr(d, "address", None),
                        getattr(d, "name", None),
                    )

                _LOGGER.debug(
                    "Scanner discovered %d devices after fallback (filtered)",
                    len(devices),
                )

                for d in devices:
                    # Only include devices that advertise a name and match our product
                    if not d.name:
                        _LOGGER.debug(
                            "filtered out device (no name): address=%s",
                            getattr(d, "address", None),
                        )
                        continue
                    try:
                        name_lower = d.name.lower()
                        if not any(f in name_lower for f in ALL_BLE_NAME_FILTERS):
                            _LOGGER.debug(
                                "filtered out device (name mismatch): address=%s name=%s",
                                getattr(d, "address", None),
                                d.name,
                            )
                            continue
                    except Exception:
                        _LOGGER.exception(
                            "Error examining device name: %s",
                            getattr(d, "address", None),
                        )
                        continue

                    addr = d.address
                    name = d.name
                    display = f"{name} ({addr})" if name else addr
                    choices[addr] = display

            # Offer an explicit "show all" choice in case the filtered
            # results aren't what the user expects. Selecting this will
            # route the flow to the unfiltered show_all branch.
            choices[SHOW_ALL_TOKEN] = "Show all devices"
            self._discovered = choices
            _LOGGER.debug("filtered choices populated: %s", choices)

            if not choices:
                # Nothing found; show a form allowing retry, show_all (fallback), or manual entry
                schema = vol.Schema(
                    {
                        vol.Required("action", default="retry"): vol.In(
                            ["retry", "show_all", "manual"]
                        )
                    }
                )
                return self.async_show_form(step_id="scan", data_schema=schema)

            schema = vol.Schema({vol.Required(CONF_ADDRESS): vol.In(choices)})
            return self.async_show_form(
                step_id="scan",
                data_schema=schema,
                description_placeholders={"count": str(len(choices))},
            )

        # If the user selected the special show-all token, route to the
        # unfiltered scan branch so we can present every device.
        if user_input is not None and CONF_ADDRESS in user_input:
            if user_input.get(CONF_ADDRESS) == SHOW_ALL_TOKEN:
                return await self.async_step_scan({"action": "show_all"})

        # user selected a device address
        address = user_input.get(CONF_ADDRESS)
        _LOGGER.debug("user selected address: %s", address)
        if not address:
            return self.async_abort(reason="no_devices_found")

        # Extract device name from discovered display string (format: "Name (Address)")
        discovered_display = self._discovered.get(address) or address
        if " (" in discovered_display and discovered_display.endswith(")"):
            device_name = discovered_display.split(" (")[0]
        else:
            device_name = DEVICE_PROFILES[self._device_type]["default_name"]

        # Infer device type from the BLE advertisement name; overrides the connection-form selection.
        inferred = device_type_from_ble_name(device_name)
        if inferred:
            self._device_type = inferred

        title = build_device_identifier(
            device_name, address, self._server_url if self._use_ble_proxy else None
        )
        return self.async_create_entry(
            title=title,
            data={
                CONF_ADDRESS: address,
                CONF_NAME: device_name,
                CONF_SERVER_URL: self._server_url,
                CONF_USE_BLE_PROXY: self._use_ble_proxy,
                CONF_DEVICE_TYPE: self._device_type,
            },
        )
