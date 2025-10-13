"""Config flow for Skelly Ultra integration.

This simple flow allows the user to manually enter a BLE address (and optional name)
or pick from a scan of discovered "Animated Skelly" BLE devices when configuring the
integration Home Assistant's UI.
"""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_ADDRESS, CONF_NAME
from homeassistant.components import bluetooth

DOMAIN = "skelly_ultra"


@config_entries.ConfigFlow(domain=DOMAIN)
class SkellyFlowHandler(config_entries.ConfigFlow):
    """Handle a config flow for Skelly Ultra with discovery option."""

    VERSION = 1

    def __init__(self) -> None:
        self._discovered: dict[str, str] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Initial step offering manual entry or discovery.

        The form accepts:
        - mode: 'manual' or 'scan'
        - CONF_ADDRESS: optional address when using manual mode
        - CONF_NAME: optional friendly name
        """
        if user_input is None:
            schema = vol.Schema(
                {
                    vol.Required("mode", default="manual"): vol.In(["manual", "scan"]),
                    vol.Optional(CONF_ADDRESS, default=""): str,
                    vol.Optional(CONF_NAME, default="Animated Skelly"): str,
                }
            )
            return self.async_show_form(step_id="user", data_schema=schema)

        mode = user_input.get("mode", "manual")
        if mode == "scan":
            return await self.async_step_scan()

        # Manual mode: create entry directly
        title = user_input.get(CONF_NAME) or user_input.get(CONF_ADDRESS) or "Skelly Ultra"
        return self.async_create_entry(title=title, data={CONF_ADDRESS: user_input.get(CONF_ADDRESS, ""), CONF_NAME: user_input.get(CONF_NAME, "")})

    async def async_step_scan(self, user_input: dict[str, Any] | None = None):
        """Scan for nearby BLE devices and present a selection list."""
        # If the user submitted an action from the fallback form, handle it
        if user_input is not None and "action" in user_input:
            action = user_input.get("action")
            if action == "retry":
                # retry the filtered scan
                return await self.async_step_scan()
            if action == "show_all":
                # perform an unfiltered scan and present all devices
                devices = []
                try:
                    scanner = await bluetooth.async_get_scanner(self.hass)
                    devices = await scanner.discover(timeout=5.0)
                except Exception:
                    devices = []

                choices: dict[str, str] = {}
                for d in devices:
                    if not d.address:
                        continue
                    name = d.name or "Unknown"
                    display = f"{name} ({d.address})"
                    choices[d.address] = display

                self._discovered = choices
                if not choices:
                    return self.async_show_form(step_id="scan", data_schema=vol.Schema({vol.Required("action", default="retry"): vol.In(["retry", "show_all", "manual"]) }), errors={"base": "no_devices_found"})

                schema = vol.Schema({vol.Required(CONF_ADDRESS): vol.In(list(choices.keys()))})
                return self.async_show_form(step_id="scan", data_schema=schema)

            if action == "manual":
                # jump back to the manual entry form
                return await self.async_step_user()

        if user_input is None:
            # perform an asynchronous filtered BLE scan
            devices = []
            try:
                scanner = await bluetooth.async_get_scanner(self.hass)
                devices = await scanner.discover(timeout=5.0)
            except Exception:
                devices = []

            choices: dict[str, str] = {}
            for d in devices:
                # Only include devices that advertise a name and match our product
                if not d.name:
                    continue
                try:
                    if "animated skelly" not in d.name.lower():
                        continue
                except Exception:
                    continue

                addr = d.address
                name = d.name
                display = f"{name} ({addr})"
                choices[addr] = display

            # Save discovered mapping for the next step
            self._discovered = choices

            if not choices:
                # Nothing found; show a form allowing retry, show_all (fallback), or manual entry
                schema = vol.Schema({vol.Required("action", default="retry"): vol.In(["retry", "show_all", "manual"])})
                return self.async_show_form(step_id="scan", data_schema=schema)

            schema = vol.Schema({vol.Required(CONF_ADDRESS): vol.In(list(choices.keys()))})
            return self.async_show_form(step_id="scan", data_schema=schema, description_placeholders={"count": len(choices)})

        # user selected a device address
        address = user_input.get(CONF_ADDRESS)
        if not address:
            return self.async_abort(reason="no_devices_found")

        title = self._discovered.get(address) or address
        return self.async_create_entry(title=title, data={CONF_ADDRESS: address, CONF_NAME: title})
