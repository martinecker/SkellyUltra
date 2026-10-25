"""Read RSSI of active Bluetooth links through the kernel's mgmt interface.

BlueZ's D-Bus API only reports RSSI from discovery results, which a connected
Skelly no longer sends. The kernel's Bluetooth management socket can query a
live connection instead (MGMT_OP_GET_CONN_INFO, what `btmgmt conn-info` uses),
for both LE and BR/EDR (classic) links on any adapter.

Querying connections needs CAP_NET_ADMIN (root, or the privileged Docker
container); without it the kernel answers with "Permission Denied".

Note on classic links: for BR/EDR the controller reports RSSI relative to its
"Golden Receive Power Range" (0 = inside the range, negative = weaker, positive
= stronger) rather than absolute dBm. Only LE links report absolute dBm.
"""

from __future__ import annotations

import asyncio
import ctypes
import ctypes.util
import os
import socket
import struct
import logging
import time

_LOGGER = logging.getLogger(__name__)

AF_BLUETOOTH = 31
BTPROTO_HCI = 1
HCI_CHANNEL_CONTROL = 3
MGMT_INDEX_NONE = 0xFFFF

MGMT_OP_READ_INDEX_LIST = 0x0003
MGMT_OP_GET_CONNECTIONS = 0x0015
MGMT_OP_GET_CONN_INFO = 0x0031
MGMT_EV_CMD_COMPLETE = 0x0001
MGMT_EV_CMD_STATUS = 0x0002

MGMT_STATUS_PERMISSION_DENIED = 0x14

# Kernel value for "RSSI/TX power not available"
INVALID_POWER = 127

ADDRESS_TYPES = {0: "bredr", 1: "le_public", 2: "le_random"}

_libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)


class MgmtError(Exception):
    """A mgmt command failed."""

    def __init__(self, opcode: int, status: int) -> None:
        """Store the failed opcode and mgmt status code."""
        super().__init__(
            f"mgmt command 0x{opcode:04x} failed with status 0x{status:02x}"
        )
        self.opcode = opcode
        self.status = status


class MgmtPermissionError(MgmtError):
    """The process lacks CAP_NET_ADMIN for the mgmt command."""


def _open_mgmt_socket(timeout: float) -> socket.socket:
    sock = socket.socket(
        AF_BLUETOOTH, socket.SOCK_RAW | socket.SOCK_CLOEXEC, BTPROTO_HCI
    )
    try:
        # Python's bind() for BTPROTO_HCI can't select a channel, so bind the
        # sockaddr_hci (family, dev, channel) through libc.
        addr = struct.pack("<HHH", AF_BLUETOOTH, MGMT_INDEX_NONE, HCI_CHANNEL_CONTROL)
        if _libc.bind(sock.fileno(), ctypes.c_char_p(addr), len(addr)) != 0:
            err = ctypes.get_errno()
            raise OSError(err, f"binding mgmt socket failed: {os.strerror(err)}")
        sock.settimeout(timeout)
    except Exception:
        sock.close()
        raise
    return sock


def _mgmt_command(
    sock: socket.socket, opcode: int, index: int, params: bytes, timeout: float
) -> bytes:
    """Send a mgmt command and return its reply parameters."""
    sock.send(struct.pack("<HHH", opcode, index, len(params)) + params)
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"no reply to mgmt command 0x{opcode:04x}")
        sock.settimeout(remaining)
        packet = sock.recv(1024)
        if len(packet) < 9:
            continue
        event, ev_index, _length = struct.unpack_from("<HHH", packet)
        if event not in (MGMT_EV_CMD_COMPLETE, MGMT_EV_CMD_STATUS) or ev_index != index:
            # The control channel also carries unrelated events (device found,
            # connected, ...), so skip anything that isn't our reply.
            continue
        ev_opcode, status = struct.unpack_from("<HB", packet, 6)
        if ev_opcode != opcode:
            continue
        if status == MGMT_STATUS_PERMISSION_DENIED:
            raise MgmtPermissionError(opcode, status)
        if status != 0:
            raise MgmtError(opcode, status)
        return packet[9:]


def _parse_mac(mac: str) -> bytes:
    """Return a MAC address as the little-endian bdaddr the kernel uses."""
    return bytes(reversed(bytes.fromhex(mac.replace(":", ""))))


def _format_mac(bdaddr: bytes) -> str:
    return ":".join(f"{b:02X}" for b in reversed(bdaddr))


def _power(value: int) -> int | None:
    return None if value == INVALID_POWER else value


def get_link_info(mac: str, timeout: float = 2.0) -> list[dict]:
    """Return RSSI/TX power of every active link to `mac`, on any adapter.

    Blocking; call from a worker thread. Returns an empty list when the
    device isn't connected. Raises MgmtPermissionError without CAP_NET_ADMIN.
    """
    wanted = _parse_mac(mac)
    links: list[dict] = []
    with _open_mgmt_socket(timeout) as sock:
        reply = _mgmt_command(
            sock, MGMT_OP_READ_INDEX_LIST, MGMT_INDEX_NONE, b"", timeout
        )
        (count,) = struct.unpack_from("<H", reply)
        indices = struct.unpack_from(f"<{count}H", reply, 2)

        for index in indices:
            try:
                reply = _mgmt_command(
                    sock, MGMT_OP_GET_CONNECTIONS, index, b"", timeout
                )
            except MgmtPermissionError:
                raise
            except MgmtError:
                continue  # e.g. adapter powered off
            (conn_count,) = struct.unpack_from("<H", reply)
            for i in range(conn_count):
                bdaddr = reply[2 + i * 7 : 8 + i * 7]
                addr_type = reply[8 + i * 7]
                if bdaddr != wanted:
                    continue
                try:
                    info = _mgmt_command(
                        sock,
                        MGMT_OP_GET_CONN_INFO,
                        index,
                        bdaddr + bytes([addr_type]),
                        timeout,
                    )
                except MgmtPermissionError:
                    raise
                except MgmtError as err:
                    # e.g. dropped in between, or the controller's Read RSSI
                    # failed; report the other links anyway
                    _LOGGER.debug("No link info for %s on hci%d: %s", mac, index, err)
                    continue
                rssi, tx_power, max_tx_power = struct.unpack_from("<bbb", info, 7)
                links.append(
                    {
                        "adapter": f"hci{index}",
                        "address": _format_mac(bdaddr),
                        "address_type": ADDRESS_TYPES.get(addr_type, str(addr_type)),
                        "transport": "bredr" if addr_type == 0 else "le",
                        "rssi": _power(rssi),
                        "tx_power": _power(tx_power),
                        "max_tx_power": _power(max_tx_power),
                    }
                )
    return links


async def async_get_link_info(mac: str, timeout: float = 2.0) -> list[dict]:
    """Async wrapper around get_link_info()."""
    return await asyncio.to_thread(get_link_info, mac, timeout)


if __name__ == "__main__":
    import json
    import sys

    for arg in sys.argv[1:]:
        print(arg, json.dumps(get_link_info(arg), indent=2))
