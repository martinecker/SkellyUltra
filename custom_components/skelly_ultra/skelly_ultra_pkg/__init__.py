"""skelly_ultra_pkg package: exports client, commands, and parser helpers.

This package is intended as the library used by other code (Home Assistant components).
"""

from .client import SkellyClient
from .commands import *  # re-export command builders
from .commands import NOTIFY_UUID, WRITE_UUID, build_cmd, crc8
from .parser import handle_notification, parse_notification

__all__ = [
    "SkellyClient",
    "parse_notification",
    "handle_notification",
]
