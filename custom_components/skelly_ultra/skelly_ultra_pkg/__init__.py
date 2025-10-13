"""skelly_ultra_pkg package: exports client, commands, and parser helpers.

This package is intended as the library used by other code (Home Assistant components).
"""
from .client import SkellyClient
from .commands import (
    WRITE_UUID,
    NOTIFY_UUID,
    crc8,
    build_cmd,
)
from .commands import *  # re-export command builders
from .parser import parse_notification, handle_notification

__all__ = [
    "SkellyClient",
    "parse_notification",
    "handle_notification",
]
