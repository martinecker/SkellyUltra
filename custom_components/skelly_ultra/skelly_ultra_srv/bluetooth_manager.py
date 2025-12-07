"""Bluetooth classic device manager using bluetoothctl."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import NamedTuple

_LOGGER = logging.getLogger(__name__)


# Check if we can import dbus-related modules for pairing
try:
    import pydbus

    DBUS_AVAILABLE = True
except ImportError as e:
    DBUS_AVAILABLE = False
    _LOGGER.warning(
        "pydbus not available, pair_and_trust will not work. Import error: %s", e
    )


class DeviceInfo(NamedTuple):
    """Information about a connected Bluetooth device."""

    name: str | None
    mac: str | None


class PairingAgent:
    """D-Bus agent for handling Bluetooth pairing with PIN codes.

    This agent implements the org.bluez.Agent1 interface to handle
    pairing requests from BlueZ, allowing automated PIN code entry.
    """

    # D-Bus interface XML for BlueZ Agent1
    dbus = """
    <node>
        <interface name='org.bluez.Agent1'>
            <method name='RequestPinCode'>
                <arg type='o' name='device' direction='in'/>
                <arg type='s' name='pincode' direction='out'/>
            </method>
            <method name='DisplayPinCode'>
                <arg type='o' name='device' direction='in'/>
                <arg type='s' name='pincode' direction='in'/>
            </method>
            <method name='RequestPasskey'>
                <arg type='o' name='device' direction='in'/>
                <arg type='u' name='passkey' direction='out'/>
            </method>
            <method name='DisplayPasskey'>
                <arg type='o' name='device' direction='in'/>
                <arg type='u' name='passkey' direction='in'/>
                <arg type='q' name='entered' direction='in'/>
            </method>
            <method name='RequestConfirmation'>
                <arg type='o' name='device' direction='in'/>
                <arg type='u' name='passkey' direction='in'/>
            </method>
            <method name='RequestAuthorization'>
                <arg type='o' name='device' direction='in'/>
            </method>
            <method name='AuthorizeService'>
                <arg type='o' name='device' direction='in'/>
                <arg type='s' name='uuid' direction='in'/>
            </method>
            <method name='Cancel'/>
            <method name='Release'/>
        </interface>
    </node>
    """

    def __init__(self, pin_code: str) -> None:
        """Initialize the pairing agent.

        Args:
            pin_code: PIN code to use for pairing
        """
        self.pin_code = pin_code

    def RequestPinCode(self, device: str) -> str:
        """Handle PIN code request from BlueZ.

        Args:
            device: D-Bus object path of the device

        Returns:
            PIN code as string
        """
        _LOGGER.info("PIN code requested for device: %s", device)
        return self.pin_code

    def DisplayPinCode(self, device: str, pincode: str) -> None:
        """Display PIN code (informational).

        Args:
            device: D-Bus object path of the device
            pincode: PIN code to display
        """
        _LOGGER.info("Display PIN code %s for device: %s", pincode, device)

    def RequestPasskey(self, device: str) -> int:
        """Handle passkey request from BlueZ.

        Args:
            device: D-Bus object path of the device

        Returns:
            Passkey as integer (0-999999)
        """
        _LOGGER.info("Passkey requested for device: %s", device)
        try:
            return int(self.pin_code)
        except ValueError:
            _LOGGER.error("PIN code %s is not a valid integer passkey", self.pin_code)
            raise

    def DisplayPasskey(self, device: str, passkey: int, entered: int) -> None:
        """Display passkey (informational).

        Args:
            device: D-Bus object path of the device
            passkey: Passkey to display
            entered: Number of digits entered so far
        """
        _LOGGER.info(
            "Display passkey %06d for device: %s (entered: %d)",
            passkey,
            device,
            entered,
        )

    def RequestConfirmation(self, device: str, passkey: int) -> None:
        """Handle confirmation request from BlueZ.

        Args:
            device: D-Bus object path of the device
            passkey: Passkey to confirm
        """
        _LOGGER.info(
            "Confirmation requested for device %s with passkey: %06d", device, passkey
        )
        # Auto-confirm by not raising an exception

    def RequestAuthorization(self, device: str) -> None:
        """Handle authorization request from BlueZ.

        Args:
            device: D-Bus object path of the device
        """
        _LOGGER.info("Authorization requested for device: %s", device)
        # Auto-authorize by not raising an exception

    def AuthorizeService(self, device: str, uuid: str) -> None:
        """Handle service authorization request from BlueZ.

        Args:
            device: D-Bus object path of the device
            uuid: Service UUID to authorize
        """
        _LOGGER.info(
            "Service authorization requested for device %s, UUID: %s", device, uuid
        )
        # Auto-authorize by not raising an exception

    def Cancel(self) -> None:
        """Handle cancellation of pairing."""
        _LOGGER.info("Pairing cancelled")

    def Release(self) -> None:
        """Handle agent release."""
        _LOGGER.info("Agent released")


class BluetoothManager:
    """Manager for Bluetooth classic device connections via bluetoothctl."""

    def __init__(self) -> None:
        """Initialize the Bluetooth manager."""
        self._connected_devices: dict[str, DeviceInfo] = {}  # MAC -> DeviceInfo

    async def _discover_device_mac_by_name(self, device_name: str) -> str:
        """Discover a Bluetooth device's MAC address by name.

        Args:
            device_name: Name of the Bluetooth device to find

        Returns:
            MAC address of the device

        Raises:
            RuntimeError: If device not found or scan fails
        """
        _LOGGER.debug("Scanning for device by name: %s", device_name)

        try:
            # Scan for devices
            stdout, _ = await self._run_bluetoothctl(
                ["power on", "agent on", "default-agent", "scan on"], timeout=25.0
            )

            # Wait a bit for scan results
            await asyncio.sleep(5)

            # Get scan results and stop scanning
            stdout2, _ = await self._run_bluetoothctl(["devices", "scan off"])
            combined_output = stdout + "\n" + stdout2

            # Parse devices to find matching name
            # Format: "Device XX:XX:XX:XX:XX:XX Device Name"
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
                        return mac_address

            error_msg = f"Could not find device with name: {device_name}"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        except RuntimeError:
            raise
        except Exception as exc:
            _LOGGER.exception("Failed to discover device by name")
            raise RuntimeError(f"Failed to discover device by name: {exc}") from exc

    async def _pair_with_sudo(self, mac: str, pin: str, timeout: float = 30.0) -> bool:
        """Pair device using sudo to elevate privileges only for pairing.

        This method invokes a Python subprocess with sudo that performs
        the D-Bus pairing operation. This allows the main server to run
        as a regular user (for PipeWire access) while only elevating
        for the pairing operation.

        Args:
            mac: MAC address of the device to pair
            pin: PIN code for pairing
            timeout: Maximum time to wait for pairing

        Returns:
            True if pairing successful, False otherwise

        Raises:
            RuntimeError: If sudo fails or pairing fails
        """
        import sys

        # Create a Python script that will run with sudo
        # This script will perform the D-Bus pairing
        script = f"""
import sys
import os
import asyncio

# Add parent directory to path for imports
sys.path.insert(0, {repr(os.path.dirname(os.path.dirname(__file__)))})

from skelly_ultra_srv.bluetooth_manager import BluetoothManager

async def main():
    manager = BluetoothManager()
    try:
        success = await manager.pair_and_trust_by_mac({repr(mac)}, {repr(pin)}, {timeout})
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Pairing failed: {{e}}", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())
"""

        _LOGGER.info("Attempting pairing with sudo elevation for %s", mac)

        try:
            # Run the script with sudo
            proc = await asyncio.create_subprocess_exec(
                "sudo",
                sys.executable,
                "-c",
                script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout + 10
                )
            except TimeoutError:
                proc.kill()
                await proc.wait()
                error_msg = f"Sudo pairing timed out after {timeout + 10}s"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

            if proc.returncode == 0:
                _LOGGER.info("Sudo pairing successful for %s", mac)
                return True
            else:
                error_output = stderr.decode() if stderr else "Unknown error"
                error_msg = f"Sudo pairing failed: {error_output}"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

        except FileNotFoundError:
            error_msg = (
                "sudo command not found. Please install sudo or run the server as root. "
                f"Alternatively, manually pair the device: bluetoothctl -> pair {mac}"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)
        except Exception as exc:
            error_msg = f"Failed to execute sudo pairing: {exc}"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg) from exc

    async def pair_and_trust_by_name(
        self, device_name: str, pin: str, timeout: float = 30.0
    ) -> tuple[bool, str | None]:
        """Pair and trust a Bluetooth device by name using D-Bus agent.

        This method first discovers the device by name to find its MAC address,
        then calls pair_and_trust_by_mac to perform the actual pairing.

        Args:
            device_name: Name of the Bluetooth device
            pin: PIN code for pairing
            timeout: Maximum time to wait for pairing to complete

        Returns:
            Tuple of (success: bool, mac_address: str | None)
            Returns (True, MAC) if pairing successful, (False, None) otherwise

        Raises:
            RuntimeError: If device not found, D-Bus not available,
                         not running as root, or pairing fails
        """
        _LOGGER.info("Attempting to pair device by name: %s", device_name)

        try:
            # Discover the device's MAC address
            mac_address = await self._discover_device_mac_by_name(device_name)

            # Now pair using the MAC address
            success = await self.pair_and_trust_by_mac(mac_address, pin, timeout)
            return (success, mac_address if success else None)

        except RuntimeError:
            # Re-raise RuntimeError with specific message
            raise
        except Exception as exc:
            _LOGGER.exception("Failed to pair by name")
            raise RuntimeError(f"Failed to pair by name: {exc}") from exc

    async def pair_and_trust_by_mac(
        self, mac: str, pin: str, timeout: float = 30.0
    ) -> bool:
        """Pair and trust a Bluetooth device by MAC address using D-Bus agent.

        This method registers a D-Bus agent to handle PIN code requests,
        then initiates pairing with the device. If not running as root,
        it will attempt to use sudo to elevate privileges only for the
        pairing operation.

        Args:
            mac: MAC address of the device to pair (format: XX:XX:XX:XX:XX:XX)
            pin: PIN code for pairing
            timeout: Maximum time to wait for pairing to complete

        Returns:
            True if pairing and trust successful, False otherwise

        Raises:
            RuntimeError: If D-Bus not available or pairing fails
        """
        if not DBUS_AVAILABLE:
            error_msg = (
                "D-Bus pairing not available: pydbus is required. "
                "Install with: pip install pydbus"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        # Check if running as root (required for D-Bus agent registration)
        if os.geteuid() != 0:
            # Check if device is already paired
            try:
                info_stdout, _ = await self._run_bluetoothctl(
                    [f"info {mac}"], timeout=10.0
                )
                if "Paired: yes" in info_stdout:
                    _LOGGER.info("Device %s is already paired", mac)
                    # Try to trust it
                    await self._run_bluetoothctl([f"trust {mac}"], timeout=10.0)
                    return True
            except Exception:
                pass

            # Not running as root and device not paired - try using sudo
            _LOGGER.info(
                "Not running as root, attempting to use sudo for pairing %s", mac
            )
            return await self._pair_with_sudo(mac, pin, timeout)

        _LOGGER.info("Starting D-Bus pairing for device: %s", mac)

        # Import here to avoid errors if not available
        import pydbus

        agent_path = "/org/bluez/agent_skelly"

        try:
            # Get the system bus
            try:
                bus = pydbus.SystemBus()
                _LOGGER.debug("Connected to D-Bus system bus")
            except Exception as exc:
                error_msg = (
                    f"Failed to connect to D-Bus system bus: {exc}. "
                    "Ensure D-Bus service is running and accessible."
                )
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Verify BlueZ is available
            try:
                bluez_obj = bus.get("org.bluez", "/")
                _LOGGER.debug("BlueZ service is available on D-Bus")
            except Exception as exc:
                error_msg = (
                    f"BlueZ service not available on D-Bus: {exc}. "
                    "Ensure bluetooth service is running: sudo systemctl status bluetooth"
                )
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Create and register the pairing agent
            agent = PairingAgent(pin)
            try:
                # Register the agent object at the specified path with its XML interface
                bus.register_object(agent_path, agent, PairingAgent.dbus)
                _LOGGER.debug("Registered pairing agent at %s", agent_path)
            except Exception as exc:
                error_msg = f"Failed to register pairing agent: {exc}"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Get the agent manager
            try:
                agent_manager = bus.get("org.bluez", "/org/bluez")
                _LOGGER.debug("Got BlueZ agent manager")
            except Exception as exc:
                error_msg = f"Failed to get BlueZ agent manager: {exc}"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Register agent with capability "KeyboardDisplay" (supports PIN entry and display)
            try:
                agent_manager.RegisterAgent(agent_path, "KeyboardDisplay")
                _LOGGER.debug("Agent registered with BlueZ")
            except Exception as exc:
                _LOGGER.warning("Failed to register agent (may already exist): %s", exc)
                # Try to unregister old agent and re-register
                try:
                    agent_manager.UnregisterAgent(agent_path)
                    agent_manager.RegisterAgent(agent_path, "KeyboardDisplay")
                    _LOGGER.debug("Re-registered agent after unregistering old one")
                except Exception as rereg_exc:
                    error_msg = f"Failed to register/re-register agent: {rereg_exc}"
                    _LOGGER.error(error_msg)
                    raise RuntimeError(error_msg) from rereg_exc

            # Request to make this the default agent
            try:
                agent_manager.RequestDefaultAgent(agent_path)
                _LOGGER.debug("Agent set as default")
            except Exception as exc:
                _LOGGER.warning(
                    "Failed to set default agent (may not be critical): %s", exc
                )

            # Get the adapter (usually hci0)
            adapter_path = "/org/bluez/hci0"
            try:
                adapter = bus.get("org.bluez", adapter_path)
                _LOGGER.debug("Got Bluetooth adapter at %s", adapter_path)
            except Exception as exc:
                error_msg = (
                    f"Failed to get Bluetooth adapter at {adapter_path}: {exc}. "
                    "Ensure Bluetooth hardware is available and enabled."
                )
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Power on the adapter
            try:
                adapter.Powered = True
                _LOGGER.debug("Adapter powered on")
            except Exception as exc:
                _LOGGER.warning(
                    "Failed to power on adapter (may already be on): %s", exc
                )

            # Format device path from MAC address
            # BlueZ uses format: /org/bluez/hci0/dev_XX_XX_XX_XX_XX_XX
            device_path = f"{adapter_path}/dev_{mac.replace(':', '_')}"

            # Start discovery to find the device
            _LOGGER.info(
                "Starting device discovery for %s (this may take 5-10 seconds)", mac
            )
            adapter.StartDiscovery()

            # Wait for device to be discovered
            # Increased from 3 to 8 seconds to give more time
            await asyncio.sleep(8)

            # Stop discovery
            adapter.StopDiscovery()
            _LOGGER.debug("Discovery stopped")

            # Verify device was discovered before trying to access it
            try:
                obj_manager = bus.get("org.bluez", "/")
                objects = obj_manager.GetManagedObjects()
                if device_path not in objects:
                    device_paths = [path for path in objects if "/dev_" in path]
                    _LOGGER.error(
                        "Device path %s not found in discovered devices. Available: %s",
                        device_path,
                        device_paths if device_paths else "none",
                    )
                    raise RuntimeError(
                        f"Device {mac} was not discovered. "
                        "Ensure device is in pairing mode and in range. "
                        f"Available devices: {device_paths if device_paths else 'none'}"
                    )
                _LOGGER.debug("Device %s found in discovery", device_path)
            except RuntimeError:
                raise
            except Exception as exc:
                _LOGGER.warning("Could not verify device discovery: %s", exc)

            # Get the device
            try:
                device = bus.get("org.bluez", device_path)
                _LOGGER.debug("Got device object for path: %s", device_path)
            except Exception as exc:
                _LOGGER.error(
                    "Failed to get device at path %s: %s (type: %s)",
                    device_path,
                    exc,
                    type(exc).__name__,
                )
                # Try to list available devices for debugging
                try:
                    from pydbus import SystemBus

                    bus_obj = SystemBus()
                    obj_manager = bus_obj.get("org.bluez", "/")
                    objects = obj_manager.GetManagedObjects()
                    device_paths = [path for path in objects.keys() if "/dev_" in path]
                    _LOGGER.error(
                        "Available device paths: %s",
                        device_paths if device_paths else "none found",
                    )
                except Exception as list_exc:
                    _LOGGER.debug("Could not list devices: %s", list_exc)

                error_msg = (
                    f"Device {mac} not found at path {device_path}. "
                    "Ensure device is in pairing mode, powered on, and in range. "
                    "The device may need more time to be discovered - try increasing discovery time."
                )
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Check if already paired
            try:
                if device.Paired:
                    _LOGGER.info("Device %s is already paired", mac)
                    if not device.Trusted:
                        device.Trusted = True
                        _LOGGER.info("Device %s trusted", mac)
                    return True
            except Exception:
                pass

            # Pair the device (this will trigger PIN code request)
            _LOGGER.info("Initiating pairing with device: %s", mac)

            # Run the pairing operation in executor to avoid blocking asyncio event loop
            # The D-Bus Pair() call is synchronous and may take several seconds
            def do_pair_sync():
                try:
                    device.Pair()
                    _LOGGER.info("Pairing successful for device: %s", mac)
                    return True
                except Exception as exc:
                    _LOGGER.error("Pairing failed: %s", exc)
                    raise RuntimeError(f"Pairing failed: {exc}") from exc

            try:
                # Run pairing with timeout
                pair_success = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(None, do_pair_sync),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                error_msg = f"Pairing timed out after {timeout} seconds"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

            if not pair_success:
                raise RuntimeError("Pairing failed with unknown error")

            # Trust the device
            _LOGGER.info("Trusting device: %s", mac)
            try:
                device.Trusted = True
                _LOGGER.info("Device %s trusted", mac)
            except Exception as exc:
                _LOGGER.warning("Failed to set device as trusted: %s", exc)

            _LOGGER.info("Successfully paired and trusted device: %s", mac)
            return True

        except RuntimeError:
            raise
        except Exception as exc:
            _LOGGER.exception("D-Bus pairing failed")
            raise RuntimeError(f"D-Bus pairing failed: {exc}") from exc
        finally:
            # Unregister the agent
            try:
                if "agent_manager" in locals():
                    agent_manager.UnregisterAgent(agent_path)
                    _LOGGER.debug("Agent unregistered")
            except Exception:
                pass

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

    async def connect_by_name(
        self, device_name: str, pin: str
    ) -> tuple[bool, str | None]:
        """Connect and pair to a Bluetooth device by name.

        Args:
            device_name: Name of the Bluetooth device
            pin: PIN code for pairing

        Returns:
            Tuple of (success: bool, mac_address: str | None)
            Returns (True, MAC) if connection successful, (False, None) otherwise
        """
        _LOGGER.info("Attempting to connect to device by name: %s", device_name)

        try:
            # Discover the device's MAC address
            mac_address = await self._discover_device_mac_by_name(device_name)

            # Now connect using the MAC address
            success = await self.connect_by_mac(mac_address, pin)
            return (success, mac_address if success else None)

        except RuntimeError:
            # Re-raise RuntimeError with specific message
            raise
        except Exception as exc:
            _LOGGER.exception("Failed to connect by name")
            raise RuntimeError(f"Failed to connect by name: {exc}") from exc

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
                error_msg = f"Device {mac} is NOT paired. You must manually pair it first (bluetoothctl -> pair {mac} -> enter PIN: {pin} when prompted)"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

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

            if not connected:
                error_msg = f"Connection failed for device {mac} (device is paired but connection did not succeed)"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

        except RuntimeError:
            # Re-raise RuntimeError with specific message
            raise
        except Exception as exc:
            _LOGGER.exception("Failed to connect by MAC")
            raise RuntimeError(f"Failed to connect by MAC: {exc}") from exc
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

            error_msg = f"Connection attempt did not succeed for MAC: {mac}"
            _LOGGER.warning(error_msg)
            raise RuntimeError(error_msg)

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
