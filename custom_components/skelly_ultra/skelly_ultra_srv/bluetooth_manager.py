"""Bluetooth classic device manager backed by dbus_next/BlueZ."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, NamedTuple

from dbus_next import BusType, Variant
from dbus_next.aio import MessageBus
from dbus_next.service import ServiceInterface, method, signal

_LOGGER = logging.getLogger(__name__)


class DeviceInfo(NamedTuple):
    """Information about a connected Bluetooth device."""

    name: str | None
    mac: str | None


class PairingAgent(ServiceInterface):
    """D-Bus agent for handling Bluetooth pairing with PIN codes.

    This agent implements the org.bluez.Agent1 interface to handle
    pairing requests from BlueZ, allowing automated PIN code entry.
    """

    def __init__(self, pin_code: str) -> None:
        """Initialize the pairing agent.

        Args:
            pin_code: PIN code to use for pairing
        """
        super().__init__("org.bluez.Agent1")
        self.pin_code = pin_code
        _LOGGER.debug("PairingAgent initialized with PIN: %s", pin_code)

    @method()
    def RequestPinCode(self, device: "o") -> "s":
        """Handle PIN code request from BlueZ.

        Args:
            device: D-Bus object path of the device

        Returns:
            PIN code as string
        """
        _LOGGER.info("PIN code requested for device: %s", device)
        _LOGGER.debug("Returning PIN code: %s", self.pin_code)
        return self.pin_code

    @method()
    def DisplayPinCode(self, device: "o", pincode: "s"):
        """Display PIN code (informational).

        Args:
            device: D-Bus object path of the device
            pincode: PIN code to display
        """
        _LOGGER.info("Display PIN code %s for device: %s", pincode, device)

    @method()
    def RequestPasskey(self, device: "o") -> "u":
        """Handle passkey request from BlueZ.

        Args:
            device: D-Bus object path of the device

        Returns:
            Passkey as integer (0-999999)
        """
        _LOGGER.info("Passkey requested for device: %s", device)
        try:
            passkey = int(self.pin_code)
            _LOGGER.debug("Returning passkey: %d", passkey)
            return passkey
        except ValueError:
            _LOGGER.error("PIN code %s is not a valid integer passkey", self.pin_code)
            raise

    @method()
    def DisplayPasskey(self, device: "o", passkey: "u", entered: "q"):
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

    @method()
    def RequestConfirmation(self, device: "o", passkey: "u"):
        """Handle confirmation request from BlueZ.

        Args:
            device: D-Bus object path of the device
            passkey: Passkey to confirm
        """
        _LOGGER.info(
            "Confirmation requested for device %s with passkey: %06d", device, passkey
        )
        _LOGGER.debug("Auto-confirming passkey")
        # Auto-confirm by not raising an exception

    @method()
    def RequestAuthorization(self, device: "o"):
        """Handle authorization request from BlueZ.

        Args:
            device: D-Bus object path of the device
        """
        _LOGGER.info("Authorization requested for device: %s", device)
        # Auto-authorize by not raising an exception

    @method()
    def AuthorizeService(self, device: "o", uuid: "s"):
        """Handle service authorization request from BlueZ.

        Args:
            device: D-Bus object path of the device
            uuid: Service UUID to authorize
        """
        _LOGGER.info(
            "Service authorization requested for device %s, UUID: %s", device, uuid
        )
        # Auto-authorize by not raising an exception

    @method()
    def Cancel(self):
        """Handle cancellation of pairing."""
        _LOGGER.warning("Pairing cancelled by BlueZ or device")
        import traceback

        _LOGGER.debug("Cancel called from:\n%s", "".join(traceback.format_stack()))

    @method()
    def Release(self):
        """Handle agent release."""
        _LOGGER.info("Agent released")


class BluetoothManager:
    """Manager for Bluetooth classic device connections via dbus_next."""

    def __init__(self, allow_scanner: bool = True) -> None:
        """Initialize the Bluetooth manager.

        Args:
            allow_scanner: Whether to allow background scanner (False for subprocess operations)
        """
        self._connected_devices: dict[str, DeviceInfo] = {}  # MAC -> DeviceInfo
        self._device_cache: dict[str, str] = {}  # Device name -> MAC address
        self._scanner_task: asyncio.Task | None = None
        self._scanner_running = False
        self._allow_scanner = allow_scanner
        self._bus: MessageBus | None = None
        self._adapter_path = "/org/bluez/hci0"
        self._adapter = None
        self._adapter_props = None
        self._object_manager = None

    async def start_background_scanner(self) -> None:
        """Start background Bluetooth scanning to populate device cache."""
        if not self._allow_scanner:
            _LOGGER.debug("Background scanner disabled for this instance")
            return
        if self._scanner_task is None:
            self._scanner_task = asyncio.create_task(self._background_scanner())
            _LOGGER.info("Started background Bluetooth scanner")

    async def stop_background_scanner(self) -> None:
        """Stop background Bluetooth scanning."""
        if self._scanner_task:
            self._scanner_running = False
            self._scanner_task.cancel()
            try:
                await self._scanner_task
            except asyncio.CancelledError:
                pass
            self._scanner_task = None
            _LOGGER.info("Stopped background Bluetooth scanner")

    async def _async_get_bus(self) -> MessageBus:
        """Return a cached D-Bus system bus connection."""
        if self._bus is None:
            try:
                self._bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
                _LOGGER.debug("Connected to D-Bus system bus")
            except Exception as exc:  # pragma: no cover - connection errors are rare
                raise RuntimeError(f"Failed to connect to D-Bus system bus: {exc}")
            # Reset cached interfaces when reconnecting
            self._adapter = None
            self._adapter_props = None
            self._object_manager = None
        return self._bus

    async def _async_get_object_manager(self) -> Any:
        """Return the shared ObjectManager interface."""
        if self._object_manager is None:
            bus = await self._async_get_bus()
            introspection = await bus.introspect("org.bluez", "/")
            proxy = bus.get_proxy_object("org.bluez", "/", introspection)
            self._object_manager = proxy.get_interface(
                "org.freedesktop.DBus.ObjectManager"
            )
        return self._object_manager

    async def _async_get_adapter(self) -> tuple[Any, Any]:
        """Return Adapter1 and its property interface."""
        if self._adapter is None or self._adapter_props is None:
            bus = await self._async_get_bus()
            introspection = await bus.introspect("org.bluez", self._adapter_path)
            proxy = bus.get_proxy_object("org.bluez", self._adapter_path, introspection)
            self._adapter = proxy.get_interface("org.bluez.Adapter1")
            self._adapter_props = proxy.get_interface("org.freedesktop.DBus.Properties")
        return self._adapter, self._adapter_props

    @staticmethod
    def _variant_value(value: Any) -> Any:
        """Unwrap Variant objects returned by dbus_next."""
        return value.value if hasattr(value, "value") else value

    def _device_path_from_mac(self, mac: str) -> str:
        """Return the BlueZ object path for the given MAC address."""
        return f"{self._adapter_path}/dev_{mac.replace(':', '_')}"

    async def _async_collect_discovered_devices(self) -> dict[str, str | None]:
        """Return mapping of MAC -> device name for all known devices."""
        obj_manager = await self._async_get_object_manager()
        objects = await obj_manager.call_get_managed_objects()
        devices: dict[str, str | None] = {}
        for interfaces in objects.values():
            device_props = interfaces.get("org.bluez.Device1")
            if not device_props:
                continue
            address_variant = device_props.get("Address")
            name_variant = device_props.get("Name")
            address = self._variant_value(address_variant) if address_variant else None
            name = self._variant_value(name_variant) if name_variant else None
            if address:
                devices[address] = name
        return devices

    async def _async_device_known(self, mac: str) -> bool:
        """Return True if BlueZ currently knows about the device."""
        device_path = self._device_path_from_mac(mac)
        obj_manager = await self._async_get_object_manager()
        objects = await obj_manager.call_get_managed_objects()
        return device_path in objects

    async def _async_discover_device(self, mac: str, timeout: float = 8.0) -> None:
        """Start discovery and wait for the device to appear."""
        adapter, _ = await self._async_get_adapter()
        await adapter.call_start_discovery()
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        try:
            while True:
                if await self._async_device_known(mac):
                    _LOGGER.debug("Device %s discovered", mac)
                    return
                remaining = deadline - loop.time()
                if remaining <= 0:
                    break
                await asyncio.sleep(min(0.5, remaining))
        finally:
            try:
                await adapter.call_stop_discovery()
            except Exception:  # pragma: no cover - best effort cleanup
                pass
        raise RuntimeError(
            f"Device {mac} was not discovered within {timeout} seconds. "
            "Ensure it is in pairing mode and in range."
        )

    async def _async_get_device_interfaces(
        self,
        mac: str,
        *,
        ensure_discovered: bool = False,
        discovery_timeout: float = 8.0,
    ) -> tuple[Any, Any]:
        """Return Device1 and property interfaces for a MAC address."""
        normalized_mac = mac.upper()
        device_path = self._device_path_from_mac(normalized_mac)
        bus = await self._async_get_bus()
        try:
            introspection = await bus.introspect("org.bluez", device_path)
        except Exception as exc:
            if not ensure_discovered:
                raise RuntimeError(
                    f"Device {normalized_mac} is unknown to BlueZ. Pair it first or "
                    "trigger discovery before connecting."
                ) from exc
            await self._async_discover_device(normalized_mac, discovery_timeout)
            introspection = await bus.introspect("org.bluez", device_path)

        proxy = bus.get_proxy_object("org.bluez", device_path, introspection)
        device = proxy.get_interface("org.bluez.Device1")
        device_props = proxy.get_interface("org.freedesktop.DBus.Properties")
        return device, device_props

    async def _async_ensure_adapter_powered(self) -> None:
        """Power on the adapter when necessary."""
        _, adapter_props = await self._async_get_adapter()
        try:
            await adapter_props.call_set(
                "org.bluez.Adapter1", "Powered", Variant("b", True)
            )
        except Exception as exc:
            _LOGGER.debug("Adapter already powered or cannot power on: %s", exc)

    async def _async_device_property(
        self, device_props: Any, property_name: str
    ) -> Any:
        """Read a Device1 property and unwrap the Variant."""
        value = await device_props.call_get("org.bluez.Device1", property_name)
        return self._variant_value(value)

    async def _scan_and_update_cache(
        self, scan_duration: float = 15.0, stop_scan: bool = True
    ) -> None:
        """Scan for Bluetooth devices and update cache.

        Args:
            scan_duration: How long to scan for devices (in seconds)
            stop_scan: Whether to stop scanning after getting results
        """
        await self._async_ensure_adapter_powered()
        adapter, _ = await self._async_get_adapter()

        _LOGGER.debug("Starting discovery for %.1f seconds", scan_duration)
        await adapter.call_start_discovery()

        try:
            await asyncio.sleep(scan_duration)
            devices = await self._async_collect_discovered_devices()
            for mac_address, device_name in devices.items():
                if not device_name:
                    continue
                self._device_cache[device_name] = mac_address
                _LOGGER.debug("Cached device: %s -> %s", device_name, mac_address)
        finally:
            if stop_scan:
                try:
                    await adapter.call_stop_discovery()
                except Exception:
                    _LOGGER.debug("Discovery already stopped")

    async def _background_scanner(self) -> None:
        """Continuously scan for Bluetooth devices and update cache."""
        _LOGGER.info("Background Bluetooth scanner started")
        self._scanner_running = True

        while self._scanner_running:
            try:
                # Scan and update cache
                await self._scan_and_update_cache(scan_duration=15.0, stop_scan=True)

                # Wait before next scan cycle
                await asyncio.sleep(5)

            except asyncio.CancelledError:
                _LOGGER.info("Background scanner cancelled")
                break
            except Exception:
                _LOGGER.exception("Error in background scanner, will retry")
                await asyncio.sleep(10)

        # Cleanup: stop scanning
        try:
            adapter, _ = await self._async_get_adapter()
            await adapter.call_stop_discovery()
        except Exception:
            pass

        _LOGGER.info("Background Bluetooth scanner stopped")

    async def _discover_device_mac_by_name(self, device_name: str) -> str:
        """Discover a Bluetooth device's MAC address by name.

        Args:
            device_name: Name of the Bluetooth device to find

        Returns:
            MAC address of the device

        Raises:
            RuntimeError: If device not found or scan fails
        """
        _LOGGER.debug("Looking up device by name: %s", device_name)

        # Check cache first
        if device_name in self._device_cache:
            mac_address = self._device_cache[device_name]
            _LOGGER.info(
                "Found device %s in cache with MAC: %s", device_name, mac_address
            )
            return mac_address

        # Cache miss - wait for cache to populate if scanner is running
        if self._scanner_running:
            _LOGGER.info(
                "Device %s not in cache, waiting up to 10 seconds for background scan",
                device_name,
            )
            for i in range(20):  # Check every 0.5 seconds for 10 seconds
                await asyncio.sleep(0.5)
                if device_name in self._device_cache:
                    mac_address = self._device_cache[device_name]
                    _LOGGER.info(
                        "Found device %s in cache with MAC: %s (after %s seconds)",
                        device_name,
                        mac_address,
                        (i + 1) * 0.5,
                    )
                    return mac_address

        # Still not found - do a manual scan
        _LOGGER.info(
            "Device %s not found in cache, performing manual scan", device_name
        )

        try:
            # Scan and update cache (5 second scan, then stop)
            await self._scan_and_update_cache(scan_duration=5.0, stop_scan=True)

            # Check cache again after manual scan
            if device_name in self._device_cache:
                mac_address = self._device_cache[device_name]
                _LOGGER.info("Found device %s with MAC: %s", device_name, mac_address)
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
import logging

# Configure logging for subprocess
logging.basicConfig(
    level=logging.DEBUG,
    format='[skelly_ultra_srv.sudo_pairing] %(levelname)s - %(message)s',
    stream=sys.stderr
)

_LOGGER = logging.getLogger(__name__)

_LOGGER.info("Starting sudo pairing subprocess")

# Add parent directory to path for imports
sys.path.insert(0, {repr(os.path.dirname(os.path.dirname(__file__)))})

from skelly_ultra_srv.bluetooth_manager import BluetoothManager

async def main():
    manager = BluetoothManager(allow_scanner=False)
    try:
        success = await manager.pair_and_trust_by_mac({repr(mac)}, {repr(pin)}, {timeout})
        sys.exit(0 if success else 1)
    except Exception as e:
        _LOGGER.error(f"Pairing failed: {{e}}")
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())
"""

        cmd_line = f'sudo -n {sys.executable} -c "<python script>"'
        _LOGGER.info(
            "Attempting pairing with sudo elevation for %s - Command: %s", mac, cmd_line
        )
        _LOGGER.debug("Sudo script content:\n%s", script)

        # Pause background scanner during sudo pairing to avoid discovery conflicts
        scanner_was_running = self._scanner_task is not None
        if scanner_was_running:
            _LOGGER.debug("Pausing background scanner during sudo pairing")
            await self.stop_background_scanner()

        try:
            # Run the script with sudo -n (non-interactive, fail if password required)
            # Note: stderr is NOT captured so subprocess output flows immediately to console
            proc = await asyncio.create_subprocess_exec(
                "sudo",
                "-n",  # Non-interactive mode - fail if password required
                sys.executable,
                "-c",
                script,
                stdout=asyncio.subprocess.PIPE,
                stderr=None,  # Let stderr flow to parent for real-time output
            )

            _LOGGER.debug("Subprocess started with PID: %s", proc.pid)

            try:
                stdout, _ = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout + 10
                )
                _LOGGER.debug(
                    "Subprocess completed with returncode: %s, stdout: %s",
                    proc.returncode,
                    stdout.decode() if stdout else "",
                )
            except asyncio.TimeoutError:
                _LOGGER.error(
                    "Subprocess timed out after %s seconds, killing process",
                    timeout + 10,
                )
                proc.kill()
                await proc.wait()
                error_msg = f"Sudo pairing timed out after {timeout + 10}s"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from None

            stdout_str = stdout.decode() if stdout else ""

            if proc.returncode == 0:
                _LOGGER.info("Sudo pairing successful for %s", mac)
                if stdout_str:
                    _LOGGER.debug("Sudo stdout: %s", stdout_str)
                return True

            # Exit code 1 from sudo -n typically means password required
            # Exit code 2 is what our subprocess uses for exceptions
            if proc.returncode == 1:
                error_msg = (
                    f"Sudo requires password but cannot prompt interactively. "
                    f"To fix this, configure passwordless sudo for Python:\n"
                    f"1. Run: sudo visudo\n"
                    f"2. Add line: {os.getenv('USER', 'youruser')} ALL=(ALL) NOPASSWD: /usr/bin/python3\n"
                    f"3. Save and try again.\n"
                    f"Alternatively, run the server as root or manually pair: bluetoothctl -> pair {mac}"
                )
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)

            # Exit code 2 means our subprocess caught an exception (stderr has details)
            error_msg = f"Sudo pairing failed (exit code {proc.returncode})"
            if stdout_str:
                error_msg += f" - stdout: {stdout_str}"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        except FileNotFoundError:
            error_msg = (
                "sudo command not found. Please install sudo or run the server as root. "
                f"Alternatively, manually pair the device: bluetoothctl -> pair {mac}"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)
        except RuntimeError:
            # Re-raise RuntimeError as-is
            raise
        except Exception as exc:
            error_msg = f"Failed to execute sudo pairing: {exc}"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg) from exc
        finally:
            # Resume background scanner if it was running before
            if scanner_was_running:
                _LOGGER.debug("Resuming background scanner after sudo pairing")
                await self.start_background_scanner()

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

        Note: Some devices (like Animated Skelly) may time out with automated
        pairing because they don't properly request the PIN from the agent.
        For such devices, manual pairing may be required:
            bluetoothctl
            > pair MAC_ADDRESS
            > (enter PIN when prompted)

        Args:
            mac: MAC address of the device to pair (format: XX:XX:XX:XX:XX:XX)
            pin: PIN code for pairing
            timeout: Maximum time to wait for pairing to complete

        Returns:
            True if pairing and trust successful, False otherwise

        Raises:
            RuntimeError: If D-Bus not available or pairing fails
        """
        # Check if running as root (required for D-Bus agent registration)
        if os.geteuid() != 0:
            # Check if device is already paired
            try:
                device, device_props = await self._async_get_device_interfaces(
                    mac, ensure_discovered=False
                )
                paired = await self._async_device_property(device_props, "Paired")
                if paired:
                    _LOGGER.info("Device %s is already paired", mac)
                    try:
                        await device_props.call_set(
                            "org.bluez.Device1", "Trusted", Variant("b", True)
                        )
                    except Exception as exc:
                        _LOGGER.debug(
                            "Failed to set device trusted without root: %s", exc
                        )
                    return True
            except RuntimeError:
                pass
            except Exception as exc:  # pragma: no cover - defensive logging
                _LOGGER.debug("Non-root paired check failed: %s", exc)

            # Not running as root and device not paired - try using sudo
            _LOGGER.info(
                "Not running as root, attempting to use sudo for pairing %s", mac
            )
            return await self._pair_with_sudo(mac, pin, timeout)

        _LOGGER.info("Starting D-Bus pairing for device: %s", mac)

        agent_path = "/org/bluez/agent_skelly"
        bus = None

        try:
            # Get the system bus
            try:
                bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
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
                introspection = await bus.introspect("org.bluez", "/")
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
                # Export the agent object at the specified path
                bus.export(agent_path, agent)
                _LOGGER.debug("Registered pairing agent at %s", agent_path)
            except Exception as exc:
                error_msg = f"Failed to register pairing agent: {exc}"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Get the agent manager proxy
            try:
                introspection = await bus.introspect("org.bluez", "/org/bluez")
                proxy_obj = bus.get_proxy_object(
                    "org.bluez", "/org/bluez", introspection
                )
                agent_manager = proxy_obj.get_interface("org.bluez.AgentManager1")
                _LOGGER.debug("Got BlueZ agent manager")
            except Exception as exc:
                error_msg = f"Failed to get BlueZ agent manager: {exc}"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg) from exc

            # Register agent with capability "KeyboardDisplay" (supports PIN entry and display)
            try:
                await agent_manager.call_register_agent(agent_path, "KeyboardDisplay")
                _LOGGER.info(
                    "Skelly Agent registered with BlueZ at path: %s", agent_path
                )
            except Exception as exc:
                _LOGGER.warning("Failed to register agent (may already exist): %s", exc)
                # Try to unregister old agent and re-register
                try:
                    await agent_manager.call_unregister_agent(agent_path)
                    _LOGGER.debug("Unregistered old Skelly agent")
                    await agent_manager.call_register_agent(
                        agent_path, "KeyboardDisplay"
                    )
                    _LOGGER.info(
                        "Re-registered Skelly agent after unregistering old one"
                    )
                except Exception as rereg_exc:
                    error_msg = f"Failed to register/re-register agent: {rereg_exc}"
                    _LOGGER.error(error_msg)
                    raise RuntimeError(error_msg) from rereg_exc

            # Request to make this the default agent
            try:
                await agent_manager.call_request_default_agent(agent_path)
                _LOGGER.info(
                    "Skelly Agent set as DEFAULT - BlueZ will use this for pairing"
                )
            except Exception as exc:
                _LOGGER.error(
                    "Failed to set Skelly agent as default agent - pairing may fail! Error: %s",
                    exc,
                )
                # This is actually critical for automated pairing to work
                raise RuntimeError(
                    f"Failed to set Skelly agent as default agent: {exc}"
                ) from exc

            # Get the adapter (usually hci0)
            adapter_path = "/org/bluez/hci0"
            try:
                introspection = await bus.introspect("org.bluez", adapter_path)
                proxy_obj = bus.get_proxy_object(
                    "org.bluez", adapter_path, introspection
                )
                adapter = proxy_obj.get_interface("org.bluez.Adapter1")
                adapter_props = proxy_obj.get_interface(
                    "org.freedesktop.DBus.Properties"
                )
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
                await adapter_props.call_set(
                    "org.bluez.Adapter1", "Powered", Variant("b", True)
                )
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
            await adapter.call_start_discovery()

            # Wait for device to be discovered
            # Increased from 3 to 8 seconds to give more time
            await asyncio.sleep(8)

            # Stop discovery
            await adapter.call_stop_discovery()
            _LOGGER.debug("Discovery stopped")

            # Verify device was discovered before trying to access it
            try:
                introspection = await bus.introspect("org.bluez", "/")
                proxy_obj = bus.get_proxy_object("org.bluez", "/", introspection)
                obj_manager = proxy_obj.get_interface(
                    "org.freedesktop.DBus.ObjectManager"
                )
                objects = await obj_manager.call_get_managed_objects()
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
                introspection = await bus.introspect("org.bluez", device_path)
                proxy_obj = bus.get_proxy_object(
                    "org.bluez", device_path, introspection
                )
                device = proxy_obj.get_interface("org.bluez.Device1")
                device_props = proxy_obj.get_interface(
                    "org.freedesktop.DBus.Properties"
                )
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
                    introspection = await bus.introspect("org.bluez", "/")
                    proxy_obj = bus.get_proxy_object("org.bluez", "/", introspection)
                    obj_manager = proxy_obj.get_interface(
                        "org.freedesktop.DBus.ObjectManager"
                    )
                    objects = await obj_manager.call_get_managed_objects()
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
                paired_variant = await device_props.call_get(
                    "org.bluez.Device1", "Paired"
                )
                paired = (
                    paired_variant.value
                    if hasattr(paired_variant, "value")
                    else paired_variant
                )
                _LOGGER.debug(
                    "Device %s paired status: %s (type: %s)", mac, paired, type(paired)
                )
                if paired:
                    _LOGGER.info("Device %s is already paired", mac)
                    trusted_variant = await device_props.call_get(
                        "org.bluez.Device1", "Trusted"
                    )
                    trusted = (
                        trusted_variant.value
                        if hasattr(trusted_variant, "value")
                        else trusted_variant
                    )
                    if not trusted:
                        await device_props.call_set(
                            "org.bluez.Device1", "Trusted", Variant("b", True)
                        )
                        _LOGGER.info("Device %s trusted", mac)
                    return True
            except Exception as exc:
                _LOGGER.debug("Could not check paired status: %s", exc)

            # Pair the device (this will trigger PIN code request)
            _LOGGER.info("Initiating pairing with device: %s", mac)

            try:
                # Run pairing with timeout
                await asyncio.wait_for(
                    device.call_pair(),
                    timeout=timeout,
                )
                _LOGGER.info("Pairing successful for device: %s", mac)
            except asyncio.TimeoutError:
                error_msg = f"Pairing timed out after {timeout} seconds"
                _LOGGER.error(error_msg)
                raise RuntimeError(error_msg)
            except Exception as exc:
                _LOGGER.error("Pairing failed: %s", exc)
                raise RuntimeError(f"Pairing failed: {exc}") from exc

            # Trust the device
            _LOGGER.info("Trusting device: %s", mac)
            try:
                await device_props.call_set(
                    "org.bluez.Device1", "Trusted", Variant("b", True)
                )
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
                    await agent_manager.call_unregister_agent(agent_path)
                    _LOGGER.debug("Agent unregistered")
            except Exception:
                pass

            # Disconnect the bus
            if bus is not None:
                try:
                    bus.disconnect()
                except Exception:
                    pass

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

        await self._async_ensure_adapter_powered()

        try:
            device, device_props = await self._async_get_device_interfaces(
                mac, ensure_discovered=False
            )
        except RuntimeError:
            device, device_props = await self._async_get_device_interfaces(
                mac, ensure_discovered=True, discovery_timeout=10.0
            )

        try:
            paired = await self._async_device_property(device_props, "Paired")
        except Exception as exc:
            raise RuntimeError(
                f"Failed to determine paired state for {mac}: {exc}"
            ) from exc

        if not paired:
            error_msg = (
                f"Device {mac} is NOT paired. You must manually pair it first "
                f"(typically via bluetoothctl -> pair {mac} -> enter PIN: {pin} when prompted)"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        try:
            trusted = await self._async_device_property(device_props, "Trusted")
        except Exception as exc:
            _LOGGER.debug("Failed to read trusted state for %s: %s", mac, exc)
            trusted = False

        if not trusted:
            _LOGGER.debug("Trusting device %s", mac)
            try:
                await device_props.call_set(
                    "org.bluez.Device1", "Trusted", Variant("b", True)
                )
            except Exception as exc:
                raise RuntimeError(f"Failed to trust device {mac}: {exc}") from exc

        connected = False
        try:
            await asyncio.wait_for(device.call_connect(), timeout=30.0)
            connected = True
        except asyncio.TimeoutError as exc:
            raise RuntimeError(f"Connection timed out for device {mac}") from exc
        except Exception as exc:
            _LOGGER.warning("connect() raised for %s: %s", mac, exc)
        finally:
            try:
                connected = await self._async_device_property(device_props, "Connected")
            except Exception as exc:
                _LOGGER.debug("Failed to read Connected state for %s: %s", mac, exc)

        if not connected:
            error_msg = f"Connection failed for device {mac} (device is paired but connection did not succeed)"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        device_name = None
        try:
            device_name = await self._async_device_property(device_props, "Name")
        except Exception as exc:
            _LOGGER.debug("Failed to read device name for %s: %s", mac, exc)

        self._connected_devices[mac] = DeviceInfo(name=device_name, mac=mac)
        _LOGGER.info("Successfully connected to %s (%s)", device_name or "Unknown", mac)
        return True

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
            device, _ = await self._async_get_device_interfaces(
                mac, ensure_discovered=False
            )
        except RuntimeError:
            _LOGGER.info("Device %s unknown to BlueZ, assuming disconnected", mac)
            self._connected_devices.pop(mac, None)
            return True

        try:
            await device.call_disconnect()
            _LOGGER.info("Successfully disconnected device: %s", mac)
        except Exception as exc:
            _LOGGER.debug("Disconnect call failed for %s: %s", mac, exc)

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
