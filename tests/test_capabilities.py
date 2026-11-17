"""Features gated on the device type and its firmware version."""

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.skelly_ultra.const import (
    CAPABILITY_JAW_DATA,
    CAPABILITY_LIGHT_SCENES,
    CAPABILITY_SET_ALL_LIGHTS,
    CONF_DEVICE_TYPE,
    DEVICE_PROFILES,
    DEVICE_TYPE_LILY,
    DEVICE_TYPE_SANTA,
    DEVICE_TYPE_SKELLY,
    DEVICE_TYPE_SKELLY_12FT,
    DOMAIN,
    has_capability,
)

from .conftest import coordinator

ALL_CAPABILITIES = (
    CAPABILITY_LIGHT_SCENES,
    CAPABILITY_SET_ALL_LIGHTS,
    CAPABILITY_JAW_DATA,
)


@pytest.mark.parametrize(
    ("device_type", "firmware", "capable"),
    [
        # Tested: the Ultra's v66 ("Animated Skelly") has no scenes, v68 has
        (DEVICE_TYPE_SKELLY, 66, False),
        (DEVICE_TYPE_SKELLY, 68, True),
        (DEVICE_TYPE_SKELLY_12FT, 14, True),
        (DEVICE_TYPE_LILY, 24, True),
        # Untested newer firmware keeps what the older one had
        (DEVICE_TYPE_SKELLY, 70, True),
        (DEVICE_TYPE_SKELLY_12FT, 15, True),
        # Older than anything tested
        (DEVICE_TYPE_SKELLY_12FT, 13, False),
        (DEVICE_TYPE_LILY, 23, False),
        # No Santa firmware seen yet, so any version has them
        (DEVICE_TYPE_SANTA, 1, True),
        # Not read yet
        (DEVICE_TYPE_SKELLY, None, False),
        (DEVICE_TYPE_SKELLY_12FT, None, False),
        (DEVICE_TYPE_SANTA, None, False),
    ],
)
def test_capabilities_by_firmware(device_type, firmware, capable) -> None:
    profile = DEVICE_PROFILES[device_type]
    for capability in ALL_CAPABILITIES:
        assert has_capability(profile, capability, firmware) is capable, capability


def test_unknown_capability_is_off() -> None:
    profile = DEVICE_PROFILES[DEVICE_TYPE_SKELLY]
    assert not has_capability(profile, "time_travel", 99)


@pytest.mark.parametrize(
    ("device_type", "firmware", "capable"),
    [
        (DEVICE_TYPE_SKELLY, 66, False),
        (DEVICE_TYPE_SKELLY, 68, True),
        (DEVICE_TYPE_SKELLY_12FT, 14, True),
        (DEVICE_TYPE_LILY, 24, True),
        # The device doesn't answer the version query
        (DEVICE_TYPE_SKELLY, None, False),
    ],
)
async def test_connected_device_capabilities(
    hass, mock_ble, device_type, firmware, capable
) -> None:
    """The capabilities follow the firmware the connected device reports."""
    mock_ble.firmware_version = firmware
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"address": mock_ble.address, CONF_DEVICE_TYPE: device_type},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    for capability in ALL_CAPABILITIES:
        assert coordinator(hass, entry).has_capability(capability) is capable
