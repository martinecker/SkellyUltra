"""Bluetooth classic device manager using bluetoothctl."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import NamedTuple

_LOGGER = logging.getLogger(__name__)


class DeviceInfo(NamedTuple):
    """Information about a connected Bluetooth device."""

    name: str | None
    mac: str | None


class BluetoothManager:
    """Manager for Bluetooth classic device connections via bluetoothctl."""

    def __init__(self) -> None:
        """Initialize the Bluetooth manager."""
        self._connected_devices: dict[str, DeviceInfo] = {}  # MAC -> DeviceInfo

    async def _run_bluetoothctl(
        self, commands: list[str], timeout: float = 30.0, wait_after: float = 0.0
    ) -> tuple[str, str]:
        """Run bluetoothctl commands and return stdout, stderr.

        Args:
            commands: List of commands to send to bluetoothctl
            timeout: Maximum time to wait for command completion
            wait_after: Seconds to wait after sending commands before exit

        Returns:
            Tuple of (stdout, stderr)

        Raises:
            asyncio.TimeoutError: If command times out
            RuntimeError: If bluetoothctl fails
        """
        # Add wait command if requested
        if wait_after > 0:
            # Use sleep command to wait (bluetoothctl doesn't have sleep, so we add it to input)
            cmd_input = "\n".join(commands) + "\n"
            # Don't exit immediately - let asyncio.sleep handle the wait
        else:
            cmd_input = "\n".join(commands) + "\nexit\n"

        try:
            proc = await asyncio.create_subprocess_exec(
                "bluetoothctl",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Send commands
            if proc.stdin:
                proc.stdin.write(cmd_input.encode())
                await proc.stdin.drain()

            # Wait if requested before sending exit
            if wait_after > 0:
                await asyncio.sleep(wait_after)
                if proc.stdin:
                    proc.stdin.write(b"exit\n")
                    await proc.stdin.drain()

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )

        except TimeoutError:
            _LOGGER.error("bluetoothctl command timed out after %s seconds", timeout)
            raise
        except Exception as exc:
            _LOGGER.exception("Failed to run bluetoothctl")
            raise RuntimeError(f"bluetoothctl execution failed: {exc}") from exc
        else:
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")

            _LOGGER.debug(
                "bluetoothctl commands: %s\nstdout: %s\nstderr: %s",
                commands,
                stdout,
                stderr,
            )

            return stdout, stderr

    async def connect_by_name(self, device_name: str, pin: str) -> bool:
        """Connect and pair to a Bluetooth device by name.

        Args:
            device_name: Name of the Bluetooth device
            pin: PIN code for pairing

        Returns:
            True if connection successful, False otherwise
        """
        _LOGGER.info("Attempting to connect to device by name: %s", device_name)

        try:
            # First, scan for devices to find the MAC address
            stdout, _ = await self._run_bluetoothctl(
                ["power on", "agent on", "default-agent", "scan on"], timeout=15.0
            )

            # Wait a bit for scan results
            await asyncio.sleep(5)

            # Get scan results and stop scanning
            stdout2, _ = await self._run_bluetoothctl(["devices", "scan off"])
            combined_output = stdout + "\n" + stdout2

            # Parse devices to find matching name
            # Format: "Device XX:XX:XX:XX:XX:XX Device Name"
            mac_address = None
            for line in combined_output.split("\n"):
                if "Device" in line and device_name in line:
                    match = re.search(
                        r"Device\s+([0-9A-Fa-f:]{17})\s+(.+)", line.strip()
                    )
                    if match:
                        mac_address = match.group(1)
                        _LOGGER.info(
                            "Found device %s with MAC: %s", device_name, mac_address
                        )
                        break

            if not mac_address:
                _LOGGER.error("Could not find device with name: %s", device_name)
                return False

            # Now connect using the MAC address
            return await self.connect_by_mac(mac_address, pin)

        except Exception:
            _LOGGER.exception("Failed to connect by name")
            return False

    async def connect_by_mac(self, mac: str, pin: str) -> bool:
        """Connect and pair to a Bluetooth device by MAC address.

        Args:
            mac: MAC address of the Bluetooth device
            pin: PIN code for pairing (provided for logging/reference)

        Returns:
            True if connection successful, False otherwise

        Note:
            Bluetooth Classic devices requiring PIN cannot be fully automated.
            If device is not already paired, manually pair it first using:
            bluetoothctl
            > pair <MAC>
            > <enter PIN when prompted>
        """
        _LOGGER.info("Attempting to connect to device by MAC: %s", mac)

        try:
            # First check if device is already paired
            _LOGGER.debug("Checking if device is already paired")
            info_stdout, _ = await self._run_bluetoothctl([f"info {mac}"], timeout=10.0)

            already_paired = "Paired: yes" in info_stdout
            already_trusted = "Trusted: yes" in info_stdout

            if already_paired:
                _LOGGER.info("Device %s is already paired, attempting connection", mac)
            else:
                _LOGGER.warning(
                    "Device %s is NOT paired. You must manually pair it first.", mac
                )
                _LOGGER.info(
                    "To pair manually: bluetoothctl -> pair %s -> enter PIN: %s when prompted",
                    mac,
                    pin,
                )
                # Still try to connect in case it pairs automatically

            # Build commands to connect
            commands = ["power on"]

            # Trust the device if not already trusted
            if not already_trusted:
                _LOGGER.debug("Trusting device %s", mac)
                commands.append(f"trust {mac}")

            # Try to connect (will work if already paired)
            commands.append(f"connect {mac}")

            # Wait 5 seconds for connection to establish before checking status
            _LOGGER.debug("Attempting connection, waiting for completion...")
            stdout, stderr = await self._run_bluetoothctl(
                commands, timeout=30.0, wait_after=5.0
            )

            # Check if connection was successful in output
            success_indicators = [
                "Connection successful",
                "Connected: yes",
            ]

            output = stdout + stderr
            connected = any(indicator in output for indicator in success_indicators)

            # Also verify by checking device info
            if not connected:
                _LOGGER.debug("Checking device info to verify connection")
                info_stdout, _ = await self._run_bluetoothctl(
                    [f"info {mac}"], timeout=10.0
                )
                # Check if device is now connected
                connected = "Connected: yes" in info_stdout

            if not connected and not already_paired:
                _LOGGER.error(
                    "Connection failed. Device must be paired manually first with PIN: %s",
                    pin,
                )

        except Exception:
            _LOGGER.exception("Failed to connect by MAC")
            return False
        else:
            if connected:
                # Try to get device name
                info_stdout, _ = await self._run_bluetoothctl([f"info {mac}"])
                device_name = None
                for line in info_stdout.split("\n"):
                    if "Name:" in line:
                        device_name = line.split("Name:", 1)[1].strip()
                        break

                self._connected_devices[mac] = DeviceInfo(name=device_name, mac=mac)
                _LOGGER.info(
                    "Successfully connected to %s (%s)", device_name or "Unknown", mac
                )
                return True

            _LOGGER.warning("Connection attempt did not succeed for MAC: %s", mac)
            return False

    async def disconnect(self, mac: str | None = None) -> bool:
        """Disconnect a device or all devices.

        Args:
            mac: MAC address of device to disconnect, or None to disconnect all

        Returns:
            True if disconnection successful, False on error
        """
        if mac is None:
            # Disconnect all devices
            if not self._connected_devices:
                _LOGGER.info("No devices connected to disconnect")
                return True

            success = True
            for device_mac in list(self._connected_devices.keys()):
                if not await self.disconnect(device_mac):
                    success = False
            return success

        # Disconnect specific device
        if mac not in self._connected_devices:
            _LOGGER.info("Device %s not in connected list", mac)
            return True

        _LOGGER.info("Disconnecting device: %s", mac)

        try:
            stdout, stderr = await self._run_bluetoothctl(
                [f"disconnect {mac}"], timeout=10.0
            )

            output = stdout + stderr

        except Exception:
            _LOGGER.exception("Failed to disconnect")
            return False
        else:
            if "Successful disconnected" in output or "not connected" in output:
                _LOGGER.info("Successfully disconnected device: %s", mac)
                self._connected_devices.pop(mac, None)
                return True

            _LOGGER.warning("Disconnect command completed but status unclear: %s", mac)
            self._connected_devices.pop(mac, None)
            return True

    def get_connected_devices(self) -> dict[str, DeviceInfo]:
        """Get all connected devices.

        Returns:
            Dictionary mapping MAC addresses to DeviceInfo
        """
        return self._connected_devices.copy()

    def get_device_by_mac(self, mac: str) -> DeviceInfo | None:
        """Get device info by MAC address.

        Args:
            mac: MAC address of the device

        Returns:
            DeviceInfo or None if not connected
        """
        return self._connected_devices.get(mac)

    def get_device_by_name(self, name: str) -> DeviceInfo | None:
        """Get device info by name.

        Args:
            name: Name of the device

        Returns:
            DeviceInfo or None if not found
        """
        for device in self._connected_devices.values():
            if device.name and name.lower() in device.name.lower():
                return device
        return None

    def get_connected_device_name(self) -> str | None:
        """Get the name of a connected device (for backwards compatibility).

        Returns:
            Device name or None if no devices connected
        """
        if self._connected_devices:
            # Return first device name
            return next(iter(self._connected_devices.values())).name
        return None

    def get_connected_device_mac(self) -> str | None:
        """Get the MAC address of a connected device (for backwards compatibility).

        Returns:
            Device MAC or None if no devices connected
        """
        if self._connected_devices:
            # Return first device MAC
            return next(iter(self._connected_devices.values())).mac
        return None
