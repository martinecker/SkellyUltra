"""Bluetooth classic device manager backed by dbus_next/BlueZ."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import sys
from pathlib import Path
from typing import Any, NamedTuple, cast
import traceback

from dbus_next import BusType, Variant
from dbus_next.aio import MessageBus
from dbus_next.errors import DBusError
from dbus_next.service import ServiceInterface, method, signal

_LOGGER = logging.getLogger(__name__)


class DeviceInfo(NamedTuple):
    """Information about a connected Bluetooth device."""

    name: str | None
    mac: str | None
    adapter_path: str | None


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
        except ValueError:
            _LOGGER.error("PIN code %s is not a valid integer passkey", self.pin_code)
            raise
        else:
            _LOGGER.debug("Returning passkey: %d", passkey)
            return passkey

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
        self._object_manager = None
        self._adapter_paths: list[str] = []
        self._adapter_lock = asyncio.Lock()
        self._adapter_interfaces: dict[str, Any] = {}
        self._adapter_props: dict[str, Any] = {}
        self._adapter_connections: dict[str, str | None] = {}
        self._device_adapter_map: dict[str, list[str]] = {}
        self._adapter_rr_index = 0
        self._active_pairing_agent: PairingAgent | None = None

    @staticmethod
    def _normalize_mac(mac: str) -> str:
        """Return MAC address in upper-case format."""

        return mac.upper()

    @staticmethod
    def _adapter_label(adapter_path: str) -> str:
        """Human friendly adapter name for logs."""

        return adapter_path.rsplit("/", maxsplit=1)[-1]

    def _remember_device_adapter(
        self, normalized_mac: str, adapter_path: str | None
    ) -> None:
        """Track that a device is paired on the provided adapter."""

        if not adapter_path:
            return
        adapters = self._device_adapter_map.setdefault(normalized_mac, [])
        if adapter_path not in adapters:
            adapters.append(adapter_path)

    def _forget_device_adapter(
        self, normalized_mac: str, adapter_path: str | None = None
    ) -> None:
        """Remove adapter mapping(s) for a device."""

        if adapter_path is None:
            self._device_adapter_map.pop(normalized_mac, None)
            return

        adapters = self._device_adapter_map.get(normalized_mac)
        if not adapters:
            return

        if adapter_path in adapters:
            adapters.remove(adapter_path)

        if not adapters:
            self._device_adapter_map.pop(normalized_mac, None)

    def _known_device_adapters(self, normalized_mac: str) -> list[str]:
        """Return adapters currently cached for the device."""

        return list(self._device_adapter_map.get(normalized_mac, []))

    def _adapters_reserved_for_other_devices(
        self, normalized_mac: str | None = None
    ) -> set[str]:
        """Return adapters assigned to devices other than normalized_mac."""

        excluded: set[str] = set()
        for mapped_mac, adapters in self._device_adapter_map.items():
            if normalized_mac is not None and mapped_mac == normalized_mac:
                continue
            excluded.update(adapters)
        return excluded

    def _adapter_is_available(
        self, adapter_path: str, normalized_mac: str | None = None
    ) -> bool:
        """Return True if adapter is not connected or already assigned to mac."""

        occupant = self._adapter_connections.get(adapter_path)
        return occupant is None or (
            normalized_mac is not None and occupant == normalized_mac
        )

    def _find_available_adapter(self, normalized_mac: str | None = None) -> str | None:
        """Return the next adapter that is not currently connected."""

        if not self._adapter_paths:
            return None

        reserved = self._adapters_reserved_for_other_devices(normalized_mac)
        for offset in range(len(self._adapter_paths)):
            index = (self._adapter_rr_index + offset) % len(self._adapter_paths)
            adapter_path = self._adapter_paths[index]
            if adapter_path in reserved:
                continue
            if self._adapter_is_available(adapter_path, normalized_mac):
                self._adapter_rr_index = (index + 1) % len(self._adapter_paths)
                return adapter_path
        return None

    def _format_adapter(self, adapter_path: str | None) -> str:
        """Return a friendly adapter label with path for logging."""

        if not adapter_path:
            return "unknown adapter"
        return f"{self._adapter_label(adapter_path)} ({adapter_path})"

    async def _async_refresh_adapters(self) -> list[str]:
        """Discover available Bluetooth adapters."""

        obj_manager = await self._async_get_object_manager()
        objects = await obj_manager.call_get_managed_objects()
        adapter_paths = sorted(
            path
            for path, interfaces in objects.items()
            if "org.bluez.Adapter1" in interfaces
        )
        if not adapter_paths:
            raise RuntimeError("No Bluetooth adapters found")

        removed = set(self._adapter_connections) - set(adapter_paths)
        for path in removed:
            self._adapter_connections.pop(path, None)
            self._adapter_interfaces.pop(path, None)
            self._adapter_props.pop(path, None)

        for path in adapter_paths:
            self._adapter_connections.setdefault(path, None)

        self._adapter_paths = adapter_paths
        return adapter_paths

    async def _async_get_adapter_paths(self) -> list[str]:
        """Return cached adapter paths, refreshing if necessary."""

        if not self._adapter_paths:
            return await self._async_refresh_adapters()
        return self._adapter_paths

    async def _async_get_adapter(
        self, adapter_path: str | None = None
    ) -> tuple[Any, Any]:
        """Return Adapter1 and Property interfaces for specified adapter."""

        adapter_paths = await self._async_get_adapter_paths()
        if adapter_path is None:
            adapter_path = adapter_paths[0]

        if (
            adapter_path not in self._adapter_interfaces
            or adapter_path not in self._adapter_props
        ):
            bus = await self._async_get_bus()
            introspection = await bus.introspect("org.bluez", adapter_path)
            proxy = bus.get_proxy_object("org.bluez", adapter_path, introspection)
            self._adapter_interfaces[adapter_path] = self._proxy_interface(
                proxy, "org.bluez.Adapter1"
            )
            self._adapter_props[adapter_path] = self._proxy_interface(
                proxy, "org.freedesktop.DBus.Properties"
            )

        return self._adapter_interfaces[adapter_path], self._adapter_props[adapter_path]

    async def _async_find_device_path(self, mac: str) -> str | None:
        """Return the BlueZ object path for the given MAC address."""

        normalized_mac = self._normalize_mac(mac)
        obj_manager = await self._async_get_object_manager()
        objects = await obj_manager.call_get_managed_objects()
        for path, interfaces in objects.items():
            device_props = interfaces.get("org.bluez.Device1")
            if not device_props:
                continue
            address_variant = device_props.get("Address")
            address = self._variant_value(address_variant) if address_variant else None
            if address and address.upper() == normalized_mac:
                adapter_variant = device_props.get("Adapter")
                adapter_path = (
                    self._variant_value(adapter_variant) if adapter_variant else None
                )
                if adapter_path:
                    self._remember_device_adapter(normalized_mac, adapter_path)
                return path
        return None

    async def _async_get_device_path_for_adapter(
        self, normalized_mac: str, adapter_path: str
    ) -> str | None:
        """Return the device path for a specific adapter if it exists."""

        expected_path = self._device_path_for_adapter(adapter_path, normalized_mac)
        obj_manager = await self._async_get_object_manager()
        objects = await obj_manager.call_get_managed_objects()
        interfaces = objects.get(expected_path)
        if not interfaces:
            return None
        device_props = interfaces.get("org.bluez.Device1")
        if not device_props:
            return None
        address_variant = device_props.get("Address")
        address = self._variant_value(address_variant) if address_variant else None
        if not address or address.upper() != normalized_mac:
            return None
        self._remember_device_adapter(normalized_mac, adapter_path)
        return expected_path

    async def _async_get_device_adapter_path(self, mac: str) -> str | None:
        """Return adapter path associated with device if known."""

        normalized_mac = self._normalize_mac(mac)
        adapters = self._known_device_adapters(normalized_mac)
        if adapters:
            return adapters[0]

        device_path = await self._async_find_device_path(normalized_mac)
        if not device_path:
            return None

        bus = await self._async_get_bus()
        introspection = await bus.introspect("org.bluez", device_path)
        assert device_path is not None
        proxy = bus.get_proxy_object("org.bluez", device_path, introspection)
        device_props = self._proxy_interface(proxy, "org.freedesktop.DBus.Properties")
        adapter_variant = await device_props.call_get("org.bluez.Device1", "Adapter")
        adapter_path = self._variant_value(adapter_variant)
        self._remember_device_adapter(normalized_mac, adapter_path)
        return adapter_path

    async def _async_select_adapter_for_pairing(self, mac: str | None = None) -> str:
        """Select adapter to use for pairing a device."""

        await self._async_get_adapter_paths()
        normalized_mac = self._normalize_mac(mac) if mac else None

        if normalized_mac:
            adapter_path = await self._async_get_device_adapter_path(normalized_mac)
            if adapter_path:
                return adapter_path

        available_adapters = [
            path
            for path in self._adapter_paths
            if self._adapter_is_available(path, normalized_mac)
        ]
        if not available_adapters:
            raise RuntimeError(
                "All Bluetooth adapters are currently connected to other devices. "
                "Disconnect one before pairing another speaker."
            )

        assignments: dict[str, int] = dict.fromkeys(available_adapters, 0)

        for mapped_adapters in self._device_adapter_map.values():
            for mapped_adapter in mapped_adapters:
                if mapped_adapter in assignments:
                    assignments[mapped_adapter] += 1

        min_count = min(assignments.values())
        candidates = [path for path, count in assignments.items() if count == min_count]
        candidates.sort()
        if not candidates:
            raise RuntimeError("No Bluetooth adapters available for pairing")

        index = self._adapter_rr_index % len(candidates)
        adapter_path = candidates[index]
        self._adapter_rr_index = (self._adapter_rr_index + 1) % len(self._adapter_paths)
        if normalized_mac:
            self._remember_device_adapter(normalized_mac, adapter_path)
        return adapter_path

    @staticmethod
    def _device_path_for_adapter(adapter_path: str, mac: str) -> str:
        """Return deterministic device path for adapter and MAC."""

        return f"{adapter_path}/dev_{mac.replace(':', '_')}"

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
            with contextlib.suppress(asyncio.CancelledError):
                await self._scanner_task
            self._scanner_task = None
            _LOGGER.info("Stopped background Bluetooth scanner")

    async def _async_get_bus(self) -> MessageBus:
        """Return a cached D-Bus system bus connection."""
        if self._bus is None:
            try:
                self._bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
                _LOGGER.debug("Connected to D-Bus system bus")
            except (
                DBusError,
                OSError,
            ) as exc:  # pragma: no cover - connection errors are rare
                raise RuntimeError("Failed to connect to D-Bus system bus") from exc
            # Reset cached interfaces when reconnecting
            self._object_manager = None
            self._adapter_interfaces.clear()
            self._adapter_props.clear()
            self._adapter_paths = []
        return self._bus

    async def _async_get_object_manager(self) -> Any:
        """Return the shared ObjectManager interface."""
        if self._object_manager is None:
            bus = await self._async_get_bus()
            introspection = await bus.introspect("org.bluez", "/")
            proxy = bus.get_proxy_object("org.bluez", "/", introspection)
            self._object_manager = self._proxy_interface(
                proxy, "org.freedesktop.DBus.ObjectManager"
            )
        return self._object_manager

    @staticmethod
    def _variant_value(value: Any) -> Any:
        """Unwrap Variant objects returned by dbus_next."""
        return value.value if hasattr(value, "value") else value

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
        return (await self._async_find_device_path(mac)) is not None

    async def _async_discover_device(self, mac: str, timeout: float = 8.0) -> None:
        """Start discovery and wait for the device to appear."""
        adapter_paths = await self._async_get_adapter_paths()
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout

        for adapter_path in adapter_paths:
            adapter, _ = await self._async_get_adapter(adapter_path)
            adapter_label = self._adapter_label(adapter_path)
            await adapter.call_start_discovery()
            try:
                while True:
                    if await self._async_device_known(mac):
                        _LOGGER.debug(
                            "Device %s discovered on %s (%s)",
                            mac,
                            adapter_label,
                            adapter_path,
                        )
                        return
                    remaining = deadline - loop.time()
                    if remaining <= 0:
                        break
                    await asyncio.sleep(min(0.5, remaining))
            finally:
                with contextlib.suppress(
                    Exception
                ):  # pragma: no cover - best effort cleanup
                    await adapter.call_stop_discovery()
        raise RuntimeError(
            f"Device {mac} was not discovered within {timeout} seconds. "
            "Ensure it is in pairing mode and in range."
        )

    async def _async_get_device_interfaces(
        self,
        mac: str,
        *,
        adapter_path: str | None = None,
        ensure_discovered: bool = False,
        discovery_timeout: float = 8.0,
    ) -> tuple[Any, Any]:
        """Return Device1 and property interfaces for a MAC address."""
        normalized_mac = self._normalize_mac(mac)
        device_path: str | None = None
        if adapter_path:
            device_path = await self._async_get_device_path_for_adapter(
                normalized_mac, adapter_path
            )
        if device_path is None:
            device_path = await self._async_find_device_path(normalized_mac)
        bus = await self._async_get_bus()
        last_exc: Exception | None = None
        if device_path:
            try:
                introspection = await bus.introspect("org.bluez", device_path)
            except DBusError as exc:  # pragma: no cover - dbus errors handled
                last_exc = exc
                introspection = None
        else:
            introspection = None

        if introspection is None:
            message = (
                f"Device {normalized_mac} is unknown to BlueZ. Pair it first or "
                "trigger discovery before connecting."
            )
            if not ensure_discovered:
                if last_exc is not None:
                    raise RuntimeError(message) from last_exc
                raise RuntimeError(message)
            await self._async_discover_device(normalized_mac, discovery_timeout)
            device_path = await self._async_find_device_path(normalized_mac)
            if device_path is None:
                raise RuntimeError(
                    f"Device {normalized_mac} is unknown to BlueZ after discovery."
                )
            introspection = await bus.introspect("org.bluez", device_path)

        if (
            adapter_path
            and device_path
            and not device_path.startswith(f"{adapter_path}/")
        ):
            raise RuntimeError(
                f"Device {normalized_mac} is not paired on adapter {adapter_path}"
            )

        proxy = bus.get_proxy_object("org.bluez", device_path, introspection)
        device = self._proxy_interface(proxy, "org.bluez.Device1")
        device_props = self._proxy_interface(proxy, "org.freedesktop.DBus.Properties")
        return device, device_props

    @staticmethod
    def _proxy_interface(proxy_obj: Any, interface: str) -> Any:
        """Return a proxy interface with loose typing for dbus_next."""

        return cast(Any, proxy_obj.get_interface(interface))

    async def _async_ensure_adapter_powered(
        self, adapter_path: str | None = None
    ) -> None:
        """Power on one or all adapters when necessary."""

        adapter_paths = (
            [adapter_path] if adapter_path else await self._async_get_adapter_paths()
        )
        for path in adapter_paths:
            _, adapter_props = await self._async_get_adapter(path)
            adapter_label = self._adapter_label(path)
            try:
                await adapter_props.call_set(
                    "org.bluez.Adapter1", "Powered", Variant("b", True)
                )
            except DBusError as exc:  # pragma: no cover - harmless failures
                _LOGGER.debug(
                    "Adapter %s (%s) already powered or cannot power on: %s",
                    adapter_label,
                    path,
                    exc,
                )

    async def _async_device_property(
        self, device_props: Any, property_name: str
    ) -> Any:
        """Read a Device1 property and unwrap the Variant."""
        value = await device_props.call_get("org.bluez.Device1", property_name)
        return self._variant_value(value)

    async def _async_record_connection(
        self,
        normalized_mac: str,
        mac: str,
        adapter_path: str,
        device_props: Any,
    ) -> str | None:
        """Track a successful connection and populate metadata."""

        for path, occupant in list(self._adapter_connections.items()):
            if path != adapter_path and occupant == normalized_mac:
                self._adapter_connections[path] = None

        self._adapter_connections[adapter_path] = normalized_mac
        self._remember_device_adapter(normalized_mac, adapter_path)

        device_name: str | None = None
        try:
            device_name = await self._async_device_property(device_props, "Name")
        except DBusError as exc:
            _LOGGER.debug("Failed to read device name for %s: %s", mac, exc)

        self._connected_devices[mac] = DeviceInfo(
            name=device_name, mac=mac, adapter_path=adapter_path
        )
        return device_name

    async def _async_confirm_existing_connection(
        self,
        normalized_mac: str,
        mac: str,
    ) -> bool:
        """Return True if the device is already connected via a known adapter."""

        existing_connection = next(
            (
                path
                for path, occupant in self._adapter_connections.items()
                if occupant == normalized_mac
            ),
            None,
        )
        if not existing_connection:
            return False

        adapter_display = self._format_adapter(existing_connection)
        try:
            device, device_props = await self._async_get_device_interfaces(
                normalized_mac,
                adapter_path=existing_connection,
                ensure_discovered=False,
            )
        except RuntimeError as exc:
            _LOGGER.debug(
                "Existing connection on %s invalid for %s: %s",
                adapter_display,
                mac,
                exc,
            )
            self._adapter_connections[existing_connection] = None
            return False

        try:
            already_connected = await self._async_device_property(
                device_props, "Connected"
            )
        except DBusError as exc:
            _LOGGER.debug("Failed to read Connected state for %s: %s", mac, exc)
            already_connected = False

        if not already_connected:
            self._adapter_connections[existing_connection] = None
            return False

        device_name = await self._async_record_connection(
            normalized_mac, mac, existing_connection, device_props
        )
        _LOGGER.info(
            "Device %s (%s) already connected via %s",
            device_name or "Unknown",
            mac,
            adapter_display,
        )
        return True

    async def _async_get_paired_adapter_interfaces(
        self, normalized_mac: str
    ) -> tuple[list[str], dict[str, tuple[Any, Any]]]:
        """Return adapters and cached interfaces for paired-but-idle adapters."""

        ordered: list[str] = []
        interfaces: dict[str, tuple[Any, Any]] = {}
        for adapter_path in self._known_device_adapters(normalized_mac):
            if adapter_path not in self._adapter_paths:
                self._forget_device_adapter(normalized_mac, adapter_path)
                continue
            if self._adapter_connections.get(adapter_path):
                continue
            try:
                interface_pair = await self._async_get_device_interfaces(
                    normalized_mac,
                    adapter_path=adapter_path,
                    ensure_discovered=False,
                )
            except RuntimeError as exc:
                adapter_label = self._adapter_label(adapter_path)
                _LOGGER.debug(
                    "Device %s not available on %s (%s): %s",
                    normalized_mac,
                    adapter_label,
                    adapter_path,
                    exc,
                )
                continue
            ordered.append(adapter_path)
            interfaces[adapter_path] = interface_pair

        return ordered, interfaces

    async def _scan_and_update_cache(
        self, scan_duration: float = 15.0, stop_scan: bool = True
    ) -> None:
        """Scan for Bluetooth devices and update cache.

        Args:
            scan_duration: How long to scan for devices (in seconds)
            stop_scan: Whether to stop scanning after getting results
        """
        await self._async_ensure_adapter_powered()
        adapter_paths = await self._async_get_adapter_paths()

        for adapter_path in adapter_paths:
            adapter, _ = await self._async_get_adapter(adapter_path)
            adapter_label = self._adapter_label(adapter_path)
            _LOGGER.debug(
                "Starting discovery on %s (%s) for %.1f seconds",
                adapter_label,
                adapter_path,
                scan_duration,
            )
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
                    with contextlib.suppress(DBusError):
                        await adapter.call_stop_discovery()

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
            except (DBusError, RuntimeError):
                _LOGGER.exception("Error in background scanner, will retry")
                await asyncio.sleep(10)

        # Cleanup: stop scanning
        adapter_paths = await self._async_get_adapter_paths()
        for adapter_path in adapter_paths:
            with contextlib.suppress(DBusError):
                adapter, _ = await self._async_get_adapter(adapter_path)
                await adapter.call_stop_discovery()

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
        except RuntimeError:
            raise
        except (DBusError, OSError) as exc:
            _LOGGER.exception("Failed to discover device by name")
            raise RuntimeError("Failed to discover device by name") from exc

        # Check cache again after manual scan
        if device_name in self._device_cache:
            mac_address = self._device_cache[device_name]
            _LOGGER.info("Found device %s with MAC: %s", device_name, mac_address)
            return mac_address

        error_msg = f"Could not find device with name: {device_name}"
        _LOGGER.error(error_msg)
        raise RuntimeError(error_msg)

    async def _pair_with_sudo(
        self, mac: str, pin: str, adapter_path: str, timeout: float = 30.0
    ) -> bool:
        """Pair device using sudo to elevate privileges only for pairing.

        This method invokes a Python subprocess with sudo that performs
        the D-Bus pairing operation. This allows the main server to run
        as a regular user (for PipeWire access) while only elevating
        for the pairing operation.

        Args:
            mac: MAC address of the device to pair
            pin: PIN code for pairing
            adapter_path: Adapter path that should handle the pairing
            timeout: Maximum time to wait for pairing

        Returns:
            True if pairing successful, False otherwise

        Raises:
            RuntimeError: If sudo fails or pairing fails
        """
        component_root = Path(__file__).resolve().parent.parent

        script = f"""
import asyncio
import logging
import sys

logging.basicConfig(
    level=logging.DEBUG,
    format='[skelly_ultra_srv.sudo_pairing] %(levelname)s - %(message)s',
    stream=sys.stderr,
)

_LOGGER = logging.getLogger(__name__)
_LOGGER.info("Starting sudo pairing subprocess")

sys.path.insert(0, {component_root.as_posix()!r})

from skelly_ultra_srv.bluetooth_manager import BluetoothManager


async def main() -> None:
    manager = BluetoothManager(allow_scanner=False)
    try:
        success = await manager.pair_and_trust_by_mac(
            {mac!r}, {pin!r}, {timeout}, adapter_path={adapter_path!r}
        )
    except Exception as exc:  # pragma: no cover - executed in subproc
        _LOGGER.error("Pairing failed: %s", exc)
        sys.exit(2)
    else:
        sys.exit(0 if success else 1)


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
            except TimeoutError:
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

        except FileNotFoundError as exc:
            error_msg = (
                "sudo command not found. Please install sudo or run the server as root. "
                f"Alternatively, manually pair the device: bluetoothctl -> pair {mac}"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg) from exc
        except OSError as exc:
            error_msg = f"Failed to execute sudo pairing: {exc}"
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg) from exc
        finally:
            # Resume background scanner if it was running before
            if scanner_was_running:
                _LOGGER.debug("Resuming background scanner after sudo pairing")
                await self.start_background_scanner()

    async def _async_pair_without_root(
        self,
        normalized_mac: str,
        pin: str,
        adapter_path: str,
        adapter_label: str,
        timeout: float,
    ) -> bool:
        """Handle pairing attempts when the process is not running as root."""

        try:
            _, device_props = await self._async_get_device_interfaces(
                normalized_mac,
                adapter_path=adapter_path,
                ensure_discovered=False,
            )
        except RuntimeError:
            device_props = None
        except DBusError as exc:  # pragma: no cover - defensive logging
            _LOGGER.debug("Non-root paired check failed: %s", exc)
            device_props = None

        if device_props is not None:
            try:
                paired = await self._async_device_property(device_props, "Paired")
            except (DBusError, RuntimeError) as exc:
                _LOGGER.debug(
                    "Unable to read paired state for %s: %s", normalized_mac, exc
                )
                paired = False
            else:
                if paired:
                    _LOGGER.info(
                        "Device %s is already paired on %s (%s)",
                        normalized_mac,
                        adapter_label,
                        adapter_path,
                    )
                    try:
                        await device_props.call_set(
                            "org.bluez.Device1", "Trusted", Variant("b", True)
                        )
                    except DBusError as exc:
                        _LOGGER.debug(
                            "Failed to set device trusted without root via %s (%s): %s",
                            adapter_label,
                            adapter_path,
                            exc,
                        )
                    return True

        _LOGGER.info(
            "Not running as root, attempting to use sudo for pairing %s via %s (%s)",
            normalized_mac,
            adapter_label,
            adapter_path,
        )
        success = await self._pair_with_sudo(normalized_mac, pin, adapter_path, timeout)
        if success:
            self._remember_device_adapter(normalized_mac, adapter_path)
        return success

    async def _async_connect_pairing_bus(self) -> MessageBus:
        """Create a dedicated system bus connection for pairing."""

        try:
            bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
        except (DBusError, OSError) as exc:
            raise RuntimeError("Failed to connect to D-Bus system bus") from exc

        try:
            await bus.introspect("org.bluez", "/")
        except DBusError as exc:
            raise RuntimeError(
                "BlueZ service not available on D-Bus. Ensure bluetooth service is running"
            ) from exc

        return bus

    async def _async_register_pairing_agent(
        self, bus: MessageBus, agent_path: str, pin: str
    ) -> tuple[Any, PairingAgent]:
        """Register the Skelly pairing agent and set it as default."""

        agent = PairingAgent(pin)
        try:
            bus.export(agent_path, agent)
        except DBusError as exc:
            raise RuntimeError(f"Failed to register pairing agent: {exc}") from exc

        try:
            introspection = await bus.introspect("org.bluez", "/org/bluez")
            proxy_obj = bus.get_proxy_object("org.bluez", "/org/bluez", introspection)
            agent_manager = self._proxy_interface(proxy_obj, "org.bluez.AgentManager1")
        except DBusError as exc:
            raise RuntimeError("Failed to get BlueZ agent manager") from exc

        try:
            await agent_manager.call_register_agent(agent_path, "KeyboardDisplay")
            _LOGGER.info("Skelly agent registered with BlueZ at path: %s", agent_path)
        except DBusError as exc:
            _LOGGER.warning("Failed to register agent (may already exist): %s", exc)
            with contextlib.suppress(DBusError):
                await agent_manager.call_unregister_agent(agent_path)
            await agent_manager.call_register_agent(agent_path, "KeyboardDisplay")
            _LOGGER.info("Re-registered Skelly agent after unregistering old one")

        try:
            await agent_manager.call_request_default_agent(agent_path)
            _LOGGER.info("Skelly agent set as default")
        except DBusError as exc:
            raise RuntimeError(
                f"Failed to set Skelly agent as default agent: {exc}"
            ) from exc

        return agent_manager, agent

    async def _async_prepare_adapter_for_pairing(
        self, bus: MessageBus, adapter_path: str, adapter_label: str
    ) -> tuple[Any, Any]:
        """Return adapter interfaces ready for discovery."""

        try:
            introspection = await bus.introspect("org.bluez", adapter_path)
            proxy_obj = bus.get_proxy_object("org.bluez", adapter_path, introspection)
        except DBusError as exc:
            raise RuntimeError(
                f"Failed to get Bluetooth adapter {adapter_label}: {exc}. "
                "Ensure Bluetooth hardware is available and enabled."
            ) from exc

        adapter = self._proxy_interface(proxy_obj, "org.bluez.Adapter1")
        adapter_props = self._proxy_interface(
            proxy_obj, "org.freedesktop.DBus.Properties"
        )

        try:
            await adapter_props.call_set(
                "org.bluez.Adapter1", "Powered", Variant("b", True)
            )
        except DBusError as exc:
            _LOGGER.warning(
                "Failed to power on adapter %s (%s) (may already be on): %s",
                adapter_label,
                adapter_path,
                exc,
            )

        return cast(Any, adapter), adapter_props

    async def _async_discover_device_on_adapter(
        self,
        bus: MessageBus,
        adapter: Any,
        adapter_path: str,
        adapter_label: str,
        device_path: str,
        normalized_mac: str,
    ) -> None:
        """Run discovery on the adapter and ensure the target device appears."""

        _LOGGER.info(
            "Starting device discovery for %s on %s (%s) (this may take 5-10 seconds)",
            normalized_mac,
            adapter_label,
            adapter_path,
        )
        await adapter.call_start_discovery()
        await asyncio.sleep(8)
        with contextlib.suppress(DBusError):
            await adapter.call_stop_discovery()
        _LOGGER.debug("Discovery stopped on %s (%s)", adapter_label, adapter_path)

        try:
            introspection = await bus.introspect("org.bluez", "/")
            proxy_obj = bus.get_proxy_object("org.bluez", "/", introspection)
            obj_manager = self._proxy_interface(
                proxy_obj, "org.freedesktop.DBus.ObjectManager"
            )
            objects = await obj_manager.call_get_managed_objects()
        except DBusError as exc:
            _LOGGER.warning("Could not verify device discovery: %s", exc)
            return

        if device_path in objects:
            _LOGGER.debug("Device %s found in discovery", device_path)
            return

        device_paths = [path for path in objects if "/dev_" in path]
        _LOGGER.error(
            "Device path %s not found on %s (%s). Available: %s",
            device_path,
            adapter_label,
            adapter_path,
            device_paths if device_paths else "none",
        )
        raise RuntimeError(
            f"Device {normalized_mac} was not discovered on {adapter_label} ({adapter_path}). "
            "Ensure device is in pairing mode and in range. "
            f"Available devices: {device_paths if device_paths else 'none'}"
        )

    async def _async_get_device_proxies_for_pairing(
        self, bus: MessageBus, device_path: str, adapter_label: str, normalized_mac: str
    ) -> tuple[Any, Any]:
        """Return device interfaces for pairing via the dedicated bus."""

        try:
            introspection = await bus.introspect("org.bluez", device_path)
            proxy_obj = bus.get_proxy_object("org.bluez", device_path, introspection)
        except DBusError as exc:
            await self._async_log_available_device_paths(bus)
            raise RuntimeError(
                f"Device {normalized_mac} not found at path {device_path}. "
                "Ensure device is in pairing mode, powered on, and in range. "
                "The device may need more time to be discovered - try increasing discovery time."
            ) from exc

        adapter = self._proxy_interface(proxy_obj, "org.bluez.Device1")
        adapter_props = self._proxy_interface(
            proxy_obj, "org.freedesktop.DBus.Properties"
        )
        _LOGGER.debug(
            "Got device object for path: %s on %s", device_path, adapter_label
        )
        return adapter, adapter_props

    async def _async_log_available_device_paths(self, bus: MessageBus) -> None:
        """Log available device paths to help debug discovery issues."""

        with contextlib.suppress(DBusError):
            introspection = await bus.introspect("org.bluez", "/")
            proxy_obj = bus.get_proxy_object("org.bluez", "/", introspection)
            obj_manager = self._proxy_interface(
                proxy_obj, "org.freedesktop.DBus.ObjectManager"
            )
            objects = await obj_manager.call_get_managed_objects()
            device_paths = [path for path in objects if "/dev_" in path]
            _LOGGER.error(
                "Available device paths: %s",
                device_paths if device_paths else "none found",
            )

    async def _async_handle_existing_pairing(
        self,
        device_props: Any,
        normalized_mac: str,
        adapter_path: str,
    ) -> bool:
        """Return True if the device is already paired and trusted."""

        adapter_label = self._adapter_label(adapter_path)

        try:
            paired_variant = await device_props.call_get("org.bluez.Device1", "Paired")
        except DBusError as exc:
            _LOGGER.debug("Could not check paired status: %s", exc)
            return False

        paired = (
            paired_variant.value if hasattr(paired_variant, "value") else paired_variant
        )
        if not paired:
            return False

        _LOGGER.info(
            "Device %s is already paired on %s (%s)",
            normalized_mac,
            adapter_label,
            adapter_path,
        )
        trusted_variant = await device_props.call_get("org.bluez.Device1", "Trusted")
        trusted = (
            trusted_variant.value
            if hasattr(trusted_variant, "value")
            else trusted_variant
        )
        if not trusted:
            await device_props.call_set(
                "org.bluez.Device1", "Trusted", Variant("b", True)
            )
            _LOGGER.info(
                "Device %s trusted on %s (%s)",
                normalized_mac,
                adapter_label,
                adapter_path,
            )
        self._remember_device_adapter(normalized_mac, adapter_path)
        return True

    async def _async_unpair_device(
        self, mac: str, adapter_path: str | None = None
    ) -> None:
        """Remove a paired device from BlueZ and clear internal mappings."""

        normalized_mac = self._normalize_mac(mac)
        device_path = await self._async_find_device_path(normalized_mac)
        if device_path is None:
            self._forget_device_adapter(normalized_mac)
            return

        target_adapter = adapter_path
        if target_adapter is None:
            adapters = self._known_device_adapters(normalized_mac)
            target_adapter = adapters[0] if adapters else None
        if target_adapter is None:
            self._forget_device_adapter(normalized_mac)
            return

        try:
            adapter, _ = await self._async_get_adapter(target_adapter)
        except RuntimeError:
            self._forget_device_adapter(normalized_mac, target_adapter)
        else:
            with contextlib.suppress(DBusError):
                await adapter.call_remove_device(device_path)

        self._forget_device_adapter(normalized_mac, target_adapter)

        device_info = self._connected_devices.pop(mac, None)
        connected_adapter = device_info.adapter_path if device_info else None
        if (
            connected_adapter
            and self._adapter_connections.get(connected_adapter) == normalized_mac
        ):
            self._adapter_connections[connected_adapter] = None

        if self._adapter_connections.get(target_adapter) == normalized_mac:
            self._adapter_connections[target_adapter] = None

    async def _async_pair_device(self, device: Any, timeout: float) -> None:
        """Run the BlueZ pair command with a timeout."""

        try:
            await asyncio.wait_for(device.call_pair(), timeout=timeout)
        except TimeoutError as exc:
            raise RuntimeError(f"Pairing timed out after {timeout} seconds") from exc
        except DBusError as exc:
            raise RuntimeError(f"Pairing failed: {exc}") from exc

    async def _async_trust_device(self, device_props: Any, normalized_mac: str) -> None:
        """Set the BlueZ device as trusted."""

        try:
            await device_props.call_set(
                "org.bluez.Device1", "Trusted", Variant("b", True)
            )
        except DBusError as exc:
            _LOGGER.warning(
                "Failed to set device %s as trusted: %s", normalized_mac, exc
            )

    async def pair_and_trust_by_name(
        self,
        device_name: str,
        pin: str,
        timeout: float = 30.0,
        *,
        adapter_path: str | None = None,
    ) -> tuple[bool, str | None]:
        """Pair and trust a Bluetooth device by name using D-Bus agent.

        This method first discovers the device by name to find its MAC address,
        then calls pair_and_trust_by_mac to perform the actual pairing.

        Args:
            device_name: Name of the Bluetooth device
            pin: PIN code for pairing
            timeout: Maximum time to wait for pairing to complete
            adapter_path: Optional adapter path override to force pairing via
                a specific adapter

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
            success = await self.pair_and_trust_by_mac(
                mac_address, pin, timeout, adapter_path=adapter_path
            )
        except RuntimeError:
            raise
        except (DBusError, OSError) as exc:
            _LOGGER.exception("Failed to pair by name")
            raise RuntimeError("Failed to pair by name") from exc
        else:
            return (success, mac_address if success else None)

    async def pair_and_trust_by_mac(
        self,
        mac: str,
        pin: str,
        timeout: float = 30.0,
        *,
        adapter_path: str | None = None,
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
            adapter_path: Optional adapter path override

        Returns:
            True if pairing and trust successful, False otherwise

        Raises:
            RuntimeError: If D-Bus not available or pairing fails
        """
        normalized_mac = self._normalize_mac(mac)
        await self._async_get_adapter_paths()

        known_adapters = self._known_device_adapters(normalized_mac)
        if not known_adapters:
            adapter_from_bluez = await self._async_get_device_adapter_path(
                normalized_mac
            )
            if adapter_from_bluez:
                known_adapters = self._known_device_adapters(normalized_mac)

        existing_adapter = known_adapters[0] if known_adapters else None
        reserved_adapters = self._adapters_reserved_for_other_devices(normalized_mac)

        busy_error = (
            "All Bluetooth adapters are currently connected to other devices. "
            "Disconnect one before pairing another speaker."
        )

        target_adapter: str | None
        if adapter_path:
            if adapter_path not in self._adapter_paths:
                raise RuntimeError(f"Adapter {adapter_path} is not available")
            occupant = self._adapter_connections.get(adapter_path)
            if occupant and occupant != normalized_mac:
                raise RuntimeError(busy_error)
            if adapter_path in reserved_adapters:
                adapter_label = self._adapter_label(adapter_path)
                raise RuntimeError(
                    f"{adapter_label} ({adapter_path}) is reserved for another speaker. "
                    "Disconnect and unpair it before pairing a new device."
                )
            target_adapter = adapter_path
        else:
            candidate: str | None = None
            for adapter in known_adapters:
                if adapter not in self._adapter_paths:
                    self._forget_device_adapter(normalized_mac, adapter)
                    continue
                if self._adapter_connections.get(adapter) is not None:
                    continue
                candidate = adapter
                break

            if candidate is None:
                candidate = self._find_available_adapter(normalized_mac)
                if candidate is None:
                    raise RuntimeError(busy_error)
            target_adapter = candidate

        adapter_label = self._adapter_label(target_adapter)
        if existing_adapter and existing_adapter != target_adapter:
            old_label = self._adapter_label(existing_adapter)
            _LOGGER.info(
                "Device %s currently mapped to %s (%s) - moving to %s (%s)",
                normalized_mac,
                old_label,
                existing_adapter,
                adapter_label,
                target_adapter,
            )
            await self._async_unpair_device(normalized_mac, existing_adapter)

        _LOGGER.info(
            "Starting pairing workflow for %s using %s (%s)",
            normalized_mac,
            adapter_label,
            target_adapter,
        )

        if os.geteuid() != 0:
            return await self._async_pair_without_root(
                normalized_mac, pin, target_adapter, adapter_label, timeout
            )

        agent_path = "/org/bluez/agent_skelly"
        bus: MessageBus | None = None
        agent_manager: Any | None = None
        agent: PairingAgent | None = None

        try:
            bus = await self._async_connect_pairing_bus()
            agent_manager, agent = await self._async_register_pairing_agent(
                bus, agent_path, pin
            )
            self._active_pairing_agent = agent
            adapter, _ = await self._async_prepare_adapter_for_pairing(
                bus, target_adapter, adapter_label
            )
            device_path = self._device_path_for_adapter(target_adapter, normalized_mac)
            await self._async_discover_device_on_adapter(
                bus,
                adapter,
                target_adapter,
                adapter_label,
                device_path,
                normalized_mac,
            )
            device, device_props = await self._async_get_device_proxies_for_pairing(
                bus, device_path, adapter_label, normalized_mac
            )

            if await self._async_handle_existing_pairing(
                device_props, normalized_mac, target_adapter
            ):
                return True

            _LOGGER.info("Initiating pairing with device: %s", normalized_mac)
            await self._async_pair_device(device, timeout)
            await self._async_trust_device(device_props, normalized_mac)

            _LOGGER.info(
                "Successfully paired and trusted device: %s on %s (%s)",
                normalized_mac,
                adapter_label,
                target_adapter,
            )
        except RuntimeError:
            raise
        except (DBusError, OSError) as exc:
            _LOGGER.exception("D-Bus pairing failed")
            raise RuntimeError("D-Bus pairing failed") from exc
        else:
            self._remember_device_adapter(normalized_mac, target_adapter)
            return True
        finally:
            if agent_manager is not None:
                with contextlib.suppress(DBusError):
                    await agent_manager.call_unregister_agent(agent_path)
                    _LOGGER.debug("Agent unregistered")
            if bus is not None:
                with contextlib.suppress(DBusError):
                    bus.disconnect()
            self._active_pairing_agent = None

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
        except RuntimeError:
            raise
        except (DBusError, OSError) as exc:
            _LOGGER.exception("Failed to connect by name")
            raise RuntimeError("Failed to connect by name") from exc
        else:
            return (success, mac_address if success else None)

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
        normalized_mac = self._normalize_mac(mac)

        await self._async_ensure_adapter_powered()
        await self._async_get_adapter_paths()
        if not self._known_device_adapters(normalized_mac):
            await self._async_get_device_adapter_path(normalized_mac)

        if await self._async_confirm_existing_connection(normalized_mac, mac):
            return True

        (
            ordered_candidates,
            candidate_interfaces,
        ) = await self._async_get_paired_adapter_interfaces(normalized_mac)

        if not ordered_candidates:
            error_msg = (
                f"Device {mac} is NOT paired. You must manually pair it first "
                f"(typically via bluetoothctl -> pair {mac} -> enter PIN: {pin} when prompted)"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        adapter_path = ordered_candidates[0]
        device, device_props = candidate_interfaces[adapter_path]
        adapter_display = self._format_adapter(adapter_path)

        occupant_mac = self._adapter_connections.get(adapter_path)
        if occupant_mac and occupant_mac != normalized_mac:
            occupant_display: str = occupant_mac
            for device_info in self._connected_devices.values():
                device_mac = device_info.mac
                if device_mac and self._normalize_mac(device_mac) == occupant_mac:
                    occupant_display = (
                        f"{device_info.name} ({device_mac})"
                        if device_info.name
                        else device_mac
                    )
                    break

            error_msg = (
                f"{adapter_display} is already connected to {occupant_display}. "
                "Disconnect it before connecting another speaker."
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        try:
            paired = await self._async_device_property(device_props, "Paired")
        except DBusError as exc:
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

        already_connected = False
        try:
            already_connected = await self._async_device_property(
                device_props, "Connected"
            )
        except DBusError as exc:
            _LOGGER.debug("Failed to read Connected state for %s: %s", mac, exc)

        if already_connected:
            has_record = (
                self._adapter_connections.get(adapter_path) == normalized_mac
                or mac in self._connected_devices
            )
            if has_record:
                device_name = await self._async_record_connection(
                    normalized_mac, mac, adapter_path, device_props
                )
                _LOGGER.info(
                    "Device %s (%s) already connected via %s",
                    device_name or "Unknown",
                    mac,
                    adapter_display,
                )
                return True

        try:
            trusted = await self._async_device_property(device_props, "Trusted")
        except DBusError as exc:
            _LOGGER.debug("Failed to read trusted state for %s: %s", mac, exc)
            trusted = False

        if not trusted:
            _LOGGER.debug("Trusting device %s", mac)
            try:
                await device_props.call_set(
                    "org.bluez.Device1", "Trusted", Variant("b", True)
                )
            except DBusError as exc:
                raise RuntimeError(f"Failed to trust device {mac}: {exc}") from exc

        connected = False
        try:
            await asyncio.wait_for(device.call_connect(), timeout=30.0)
            connected = True
        except TimeoutError as exc:
            raise RuntimeError(f"Connection timed out for device {mac}") from exc
        except DBusError as exc:
            _LOGGER.warning(
                "Connect() raised for %s via %s: %s", mac, adapter_display, exc
            )
        finally:
            try:
                connected = await self._async_device_property(device_props, "Connected")
            except DBusError as exc:
                _LOGGER.debug("Failed to read Connected state for %s: %s", mac, exc)

        if not connected:
            error_msg = (
                f"Connection failed for device {mac} via {adapter_display} "
                "(device is paired but connection did not succeed)"
            )
            _LOGGER.error(error_msg)
            raise RuntimeError(error_msg)

        device_name = await self._async_record_connection(
            normalized_mac, mac, adapter_path, device_props
        )
        _LOGGER.info(
            "Successfully connected to %s (%s) via %s",
            device_name or "Unknown",
            mac,
            adapter_display,
        )
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
        normalized_mac = self._normalize_mac(mac)
        device_info = self._connected_devices.get(mac)
        adapters = self._known_device_adapters(normalized_mac)
        adapter_path = adapters[0] if adapters else None
        if not adapter_path and device_info and device_info.adapter_path:
            adapter_path = device_info.adapter_path

        if device_info is None:
            _LOGGER.info("Device %s not in connected list", mac)
            if (
                adapter_path
                and self._adapter_connections.get(adapter_path) == normalized_mac
            ):
                self._adapter_connections[adapter_path] = None
            return True

        _LOGGER.info("Disconnecting device: %s", mac)

        try:
            device, _ = await self._async_get_device_interfaces(
                mac, ensure_discovered=False
            )
        except RuntimeError:
            _LOGGER.info("Device %s unknown to BlueZ, assuming disconnected", mac)
            self._connected_devices.pop(mac, None)
            if (
                adapter_path
                and self._adapter_connections.get(adapter_path) == normalized_mac
            ):
                self._adapter_connections[adapter_path] = None
            return True

        try:
            await device.call_disconnect()
            _LOGGER.info("Successfully disconnected device: %s", mac)
        except DBusError as exc:
            _LOGGER.debug("Disconnect call failed for %s: %s", mac, exc)

        self._connected_devices.pop(mac, None)
        if (
            adapter_path
            and self._adapter_connections.get(adapter_path) == normalized_mac
        ):
            self._adapter_connections[adapter_path] = None
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

    def get_device_adapter_path(self, mac: str | None) -> str | None:
        """Return the adapter path mapped to the provided MAC if known."""

        if not mac:
            return None
        adapters = self._known_device_adapters(self._normalize_mac(mac))
        return adapters[0] if adapters else None
