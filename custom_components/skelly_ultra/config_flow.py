"""Config flow for Skelly Ultra integration.

This simple flow allows the user to manually enter a BLE address (and optional name)
or pick from a scan of discovered "Animated Skelly" BLE devices when configuring the
integration via Home Assistant's UI.
"""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from bleak import BleakScanner

from homeassistant import config_entries
from homeassistant.components import bluetooth
from homeassistant.const import CONF_ADDRESS, CONF_NAME

_LOGGER = logging.getLogger(__name__)

DOMAIN = "skelly_ultra"
SHOW_ALL_TOKEN = "__show_all__"


class SkellyFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Skelly Ultra with discovery option."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize flow state."""
        self._discovered: dict[str, str] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Initial step offering manual entry or discovery.

        The form accepts:
        - mode: 'manual' or 'scan'
        - CONF_ADDRESS: optional address when using manual mode
        - CONF_NAME: optional friendly name
        """
        # Build form schema
        schema = vol.Schema(
            {
                vol.Required("mode", default="manual"): vol.In(["manual", "scan"]),
                vol.Optional(CONF_ADDRESS, default=""): str,
                vol.Optional(CONF_NAME, default="Animated Skelly"): str,
            }
        )

        # Require that the user has a bluetooth config entry (i.e. the
        # bluetooth integration is actually set up).
        bt_entries = self.hass.config_entries.async_entries("bluetooth")
        if not bt_entries:
            # Show the same form but with an error explaining bluetooth is
            # required so the user can take action in the UI.
            return self.async_show_form(
                step_id="user",
                data_schema=schema,
                errors={"base": "bluetooth_integration_required"},
            )

        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=schema)

        mode = user_input.get("mode", "manual")
        if mode == "scan":
            return await self.async_step_scan()

        # Manual mode: create entry directly
        title = (
            user_input.get(CONF_NAME) or user_input.get(CONF_ADDRESS) or "Skelly Ultra"
        )
        return self.async_create_entry(
            title=title,
            data={
                CONF_ADDRESS: user_input.get(CONF_ADDRESS, ""),
                CONF_NAME: user_input.get(CONF_NAME, ""),
            },
        )

    async def async_step_scan(self, user_input: dict[str, Any] | None = None):
        """Scan for nearby BLE devices and present a selection list."""
        _LOGGER.debug("async_step_scan called, user_input=%s", user_input)
        # Defensive check: scanning requires the bluetooth integration to be
        # configured/installed (a config entry exists).
        bt_entries = self.hass.config_entries.async_entries("bluetooth")
        if not bt_entries:
            # Abort the flow with a readable reason. The frontend will show
            # the abort reason; alternatively we could redirect back to the
            # user form with an error message.
            return self.async_abort(reason="bluetooth_integration_required")
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
                    scanner = bluetooth.async_get_scanner(self.hass)
                    devices = await scanner.discover(timeout=5.0)
                except (TimeoutError, OSError):
                    devices = []
                _LOGGER.debug("HA scanner returned %d devices (show_all)", len(devices))

                # If HA's shared scanner returned nothing, fall back to calling
                # Bleak directly. This helps when the shared scanner isn't
                # reporting devices even though BLE hardware can see them.
                if not devices:
                    try:
                        _LOGGER.debug(
                            "HA scanner returned no devices; falling back to BleakScanner.discover()"
                        )
                        devices = await BleakScanner.discover(timeout=5.0)
                    except (TimeoutError, OSError):
                        devices = []

                choices: dict[str, str] = {}
                for d in devices:
                    addr = getattr(d, "address", None)
                    if not addr:
                        continue
                    name = getattr(d, "name", None)
                    # Use friendly label when name present, otherwise show
                    # only the address so the UI doesn't display 'Unknown'.
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
                return await self.async_step_user()

        if user_input is None:
            # perform an asynchronous filtered BLE scan
            devices = []
            try:
                scanner = bluetooth.async_get_scanner(self.hass)
                devices = await scanner.discover(timeout=5.0)
            except (TimeoutError, OSError):
                devices = []

            _LOGGER.debug("Scanner discovered %d devices (initial)", len(devices))

            # If HA's shared scanner returned nothing, fall back to Bleak
            # discovery directly to improve robustness.
            if not devices:
                try:
                    _LOGGER.debug(
                        "HA scanner returned no devices during filtered scan; falling back to BleakScanner.discover()"
                    )
                    devices = await BleakScanner.discover(timeout=5.0)
                except (TimeoutError, OSError):
                    devices = []

            for d in devices:
                _LOGGER.debug(
                    "discovered device: address=%s name=%s",
                    getattr(d, "address", None),
                    getattr(d, "name", None),
                )

            _LOGGER.debug(
                "Scanner discovered %d devices after fallback (filtered)", len(devices)
            )

            choices: dict[str, str] = {}
            for d in devices:
                # Only include devices that advertise a name and match our product
                if not d.name:
                    _LOGGER.debug(
                        "filtered out device (no name): address=%s",
                        getattr(d, "address", None),
                    )
                    continue
                try:
                    if "animated skelly" not in d.name.lower():
                        _LOGGER.debug(
                            "filtered out device (name mismatch): address=%s name=%s",
                            getattr(d, "address", None),
                            d.name,
                        )
                        continue
                except Exception:
                    _LOGGER.exception(
                        "Error examining device name: %s", getattr(d, "address", None)
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

            # Save discovered mapping for the next step
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
                description_placeholders={"count": len(choices)},
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

        title = self._discovered.get(address) or address
        return self.async_create_entry(
            title=title, data={CONF_ADDRESS: address, CONF_NAME: title}
        )
