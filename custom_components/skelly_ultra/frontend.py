"""Serve the Skelly Ultra frontend: the sidebar panel and the dashboard card.

Both come from one JavaScript bundle, frontend/skelly-ultra.js, built from
the frontend/ folder at the repository root. The bundle is loaded on every
page (so the card is defined wherever a dashboard shows it) and is also the
panel's module, so the browser loads it once.

The bundle URL carries a hash of its content, so browsers fetch the new
bundle after an update instead of using a cached copy.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL, DOMAIN

_LOGGER = logging.getLogger(__name__)

FRONTEND_URL = f"/{DOMAIN}/frontend"
FRONTEND_DIR = Path(__file__).parent / "frontend"
BUNDLE_NAME = "skelly-ultra.js"

PANEL_URL_PATH = "skelly-ultra"
PANEL_COMPONENT = "skelly-ultra-panel"
PANEL_TITLE = "Skelly"
PANEL_ICON = "mdi:skull"

# hass.data key: {"url": bundle URL, "version": hash, "panel": shown} once
# the bundle is served; None if it couldn't be (no bundle built)
_DATA_KEY = f"{DOMAIN}_frontend"


def _bundle_hash() -> str | None:
    """Return a short hash of the bundle, or None if it doesn't exist."""
    try:
        content = (FRONTEND_DIR / BUNDLE_NAME).read_bytes()
    except OSError:
        return None
    return hashlib.sha256(content).hexdigest()[:16]


async def async_setup_frontend(hass: HomeAssistant) -> None:
    """Serve the bundle and load it on every page.

    Neither the static path nor the extra JS URL can be unregistered, so
    this runs once per Home Assistant run, on the first entry that is set up.
    """
    if _DATA_KEY in hass.data:
        return
    # Claim the key before the first await, so entries set up at the same
    # time don't register twice
    hass.data[_DATA_KEY] = None

    version = await hass.async_add_executor_job(_bundle_hash)
    if version is None:
        _LOGGER.error(
            "Frontend bundle %s is missing, so the Skelly panel and card are "
            "not available",
            FRONTEND_DIR / BUNDLE_NAME,
        )
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(FRONTEND_DIR), cache_headers=True)]
    )
    url = f"{FRONTEND_URL}/{BUNDLE_NAME}?v={version}"
    frontend.add_extra_js_url(hass, url)
    hass.data[_DATA_KEY] = {"url": url, "version": version, "panel": False}


async def async_update_panel(hass: HomeAssistant) -> None:
    """Show the sidebar panel if any loaded entry wants it, else remove it.

    Call after an entry is set up or unloaded, or its options change.
    """
    data = hass.data.get(_DATA_KEY)
    if not data:
        return

    show = any(
        entry.options.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)
        for entry_id in hass.data.get(DOMAIN, {})
        if (entry := hass.config_entries.async_get_entry(entry_id)) is not None
    )
    if show == data["panel"]:
        return
    # Update the state before the await, so a concurrent call doesn't register
    # (or remove) the panel a second time
    data["panel"] = show

    if show:
        try:
            await panel_custom.async_register_panel(
                hass,
                frontend_url_path=PANEL_URL_PATH,
                webcomponent_name=PANEL_COMPONENT,
                module_url=data["url"],
                sidebar_title=PANEL_TITLE,
                sidebar_icon=PANEL_ICON,
                require_admin=False,
                config={"version": data["version"]},
            )
        except ValueError:
            # Another panel (e.g. a panel_custom in YAML) already uses the URL.
            # Keep the Skellies working without the panel. Later updates
            # (every options write) try again, but only the first logs an error.
            data["panel"] = False
            _LOGGER.log(
                logging.DEBUG if data.get("conflict_logged") else logging.ERROR,
                "Can't add the Skelly sidebar panel: another panel already uses /%s",
                PANEL_URL_PATH,
            )
            data["conflict_logged"] = True
    else:
        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
