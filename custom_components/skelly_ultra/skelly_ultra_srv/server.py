"""REST API server for Skelly Ultra Bluetooth and audio management."""

from __future__ import annotations

import json
import logging
from pathlib import Path
import tempfile

from aiohttp import web

from .audio_player import AudioPlayer
from .ble_session_manager import BLESessionManager
from .bluetooth_manager import BluetoothManager, DeviceInfo

_LOGGER = logging.getLogger(__name__)


@web.middleware
async def cors_middleware(request, handler):
    """Add CORS headers to all responses."""
    if request.method == "OPTIONS":
        # Handle preflight requests
        response = web.Response()
    else:
        response = await handler(request)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Max-Age"] = "3600"

    return response


class SkellyUltraServer:
    """REST server for managing Bluetooth connections and audio playback."""

    def __init__(
        self, host: str = "0.0.0.0", port: int = 8765, debug_json: bool = False
    ) -> None:
        """Initialize the server.

        Args:
            host: Host address to bind to
            port: Port to listen on
            debug_json: Enable debug logging of JSON requests/responses
        """
        self.host = host
        self.port = port
        self.debug_json = debug_json
        self.bt_manager = BluetoothManager()
        self.audio_player = AudioPlayer()
        self.ble_manager = BLESessionManager()
        self.app = web.Application(middlewares=[cors_middleware])
        self.app["upload_dir"] = Path(tempfile.mkdtemp(prefix="skelly_audio_"))
        self.app.on_startup.append(self._on_startup)
        self.app.on_cleanup.append(self._on_cleanup)
        self._setup_routes()

    def _log_request(self, endpoint: str, data: dict | None) -> None:
        """Log incoming request data in debug mode.

        Args:
            endpoint: The endpoint name
            data: The request data (JSON body or query params)
        """
        if self.debug_json and data:
            _LOGGER.debug("📥 REQUEST to %s:\n%s", endpoint, json.dumps(data, indent=2))

    def _log_response(self, endpoint: str, data: dict) -> None:
        """Log outgoing response data in debug mode.

        Args:
            endpoint: The endpoint name
            data: The response data
        """
        if self.debug_json:
            _LOGGER.debug(
                "📤 RESPONSE from %s:\n%s", endpoint, json.dumps(data, indent=2)
            )

    @staticmethod
    def _serialize_device_info(device: DeviceInfo | None) -> dict[str, str | None]:
        """Return a JSON-friendly representation of a DeviceInfo."""

        return {
            "name": device.name if device else None,
            "mac": device.mac if device else None,
            "adapter_path": device.adapter_path if device else None,
        }

    def _validate_connected_targets(self, targets: list[str] | None) -> str | None:
        """Return an error message if any requested targets are disconnected."""

        if not targets:
            return None

        connected_devices = self.bt_manager.get_connected_devices()
        connected_macs = {
            dev_mac.upper()
            for dev_mac in (
                device.mac for device in connected_devices.values() if device.mac
            )
        }

        missing: list[str] = []
        seen: set[str] = set()
        for mac in targets:
            if not mac:
                continue
            normalized = mac.upper()
            if normalized in seen:
                continue
            seen.add(normalized)
            if normalized not in connected_macs:
                missing.append(normalized)

        if missing:
            missing.sort()
            return "The following devices are not connected: " + ", ".join(missing)

        return None

    def _resolve_play_targets(
        self,
        *,
        target: str | None,
        targets: list[str] | None,
        play_all: bool,
    ) -> tuple[list[str] | None, str | None]:
        """Normalize requested playback targets and ensure they are connected."""

        resolved_targets: list[str] | None
        if play_all:
            connected = self.bt_manager.get_connected_devices()
            resolved_targets = [dev.mac for dev in connected.values() if dev.mac]
            _LOGGER.info("Playing on all %d connected devices", len(resolved_targets))
        elif targets:
            resolved_targets = list(targets)
            _LOGGER.info("Playing on %d specified targets", len(resolved_targets))
        elif target:
            resolved_targets = [target]
        else:
            resolved_targets = None

        validation_error = self._validate_connected_targets(resolved_targets)
        if validation_error:
            return resolved_targets, validation_error

        return resolved_targets, None

    def _setup_routes(self) -> None:
        """Set up API routes."""
        # Classic Bluetooth A2DP speaker endpoints
        self.app.router.add_post(
            "/classic/pair_and_trust_by_name", self.handle_pair_and_trust_by_name
        )
        self.app.router.add_post(
            "/classic/pair_and_trust_by_mac", self.handle_pair_and_trust_by_mac
        )
        self.app.router.add_post(
            "/classic/connect_by_name", self.handle_connect_by_name
        )
        self.app.router.add_post("/classic/connect_by_mac", self.handle_connect_by_mac)
        self.app.router.add_get("/classic/name", self.handle_get_name)
        self.app.router.add_get("/classic/mac", self.handle_get_mac)
        self.app.router.add_post("/classic/play", self.handle_play)
        self.app.router.add_post("/classic/play_filename", self.handle_play_filename)
        self.app.router.add_post("/classic/stop", self.handle_stop)
        self.app.router.add_post("/classic/disconnect", self.handle_disconnect)
        self.app.router.add_get("/classic/status", self.handle_status)

        self.app.router.add_get("/health", self.handle_health)

        # BLE proxy endpoints
        self.app.router.add_get("/ble/scan_devices", self.handle_ble_scan_devices)
        self.app.router.add_post("/ble/connect", self.handle_ble_connect)
        self.app.router.add_post("/ble/send_command", self.handle_ble_send_command)
        self.app.router.add_get("/ble/notifications", self.handle_ble_notifications)
        self.app.router.add_post("/ble/disconnect", self.handle_ble_disconnect)
        self.app.router.add_get("/ble/sessions", self.handle_ble_sessions)

    async def handle_connect_by_name(self, request: web.Request) -> web.Response:
        """Handle POST /connect_by_name endpoint.

        Expected JSON body:
        {
            "device_name": "Skelly Speaker",
            "pin": "1234"
        }

        Returns:
        {
            "success": true/false,
            "device_name": "Skelly Speaker",
            "mac": "AA:BB:CC:DD:EE:FF",
            "adapter_path": "/org/bluez/hci0",
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("connect_by_name", data)

            device_name = data.get("device_name")
            pin = data.get("pin", "1234")

            if not device_name:
                response_data = {"success": False, "error": "device_name is required"}
                self._log_response("connect_by_name", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received connect_by_name request for: %s", device_name)
            success, mac = await self.bt_manager.connect_by_name(device_name, pin)
            device_info = self.bt_manager.get_device_by_mac(mac) if mac else None
            adapter_path = (
                device_info.adapter_path
                if device_info
                else self.bt_manager.get_device_adapter_path(mac)
            )

            response_data = {
                "success": success,
                "device_name": (device_info.name if device_info else device_name),
                "mac": mac,
                "adapter_path": adapter_path,
            }
            self._log_response("connect_by_name", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("connect_by_name", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            # RuntimeError contains the specific error message from bluetooth_manager
            _LOGGER.warning("Connect by name failed: %s", exc)
            response_data = {"success": False, "error": str(exc)}
            self._log_response("connect_by_name", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in connect_by_name")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("connect_by_name", response_data)
            return web.json_response(response_data, status=500)

    async def handle_connect_by_mac(self, request: web.Request) -> web.Response:
        """Handle POST /connect_by_mac endpoint.

        Expected JSON body:
        {
            "mac": "AA:BB:CC:DD:EE:FF",
            "pin": "1234"
        }

        Returns:
        {
            "success": true/false,
            "device_name": "Skelly Speaker",
            "mac": "AA:BB:CC:DD:EE:FF",
            "adapter_path": "/org/bluez/hci0",
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("connect_by_mac", data)

            mac = data.get("mac")
            pin = data.get("pin", "1234")

            if not mac:
                response_data = {"success": False, "error": "mac is required"}
                self._log_response("connect_by_mac", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received connect_by_mac request for: %s", mac)
            success = await self.bt_manager.connect_by_mac(mac, pin)
            device_info = self.bt_manager.get_device_by_mac(mac)
            adapter_path = (
                device_info.adapter_path
                if device_info
                else self.bt_manager.get_device_adapter_path(mac)
            )

            response_data = {
                "success": success,
                "device_name": device_info.name if device_info else None,
                "mac": mac,
                "adapter_path": adapter_path,
            }
            self._log_response("connect_by_mac", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("connect_by_mac", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            # RuntimeError contains the specific error message from bluetooth_manager
            _LOGGER.warning("Connect by MAC failed: %s", exc)
            response_data = {"success": False, "error": str(exc)}
            self._log_response("connect_by_mac", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in connect_by_mac")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("connect_by_mac", response_data)
            return web.json_response(response_data, status=500)

    async def handle_pair_and_trust_by_name(self, request: web.Request) -> web.Response:
        """Handle POST /pair_and_trust_by_name endpoint.

        Uses D-Bus agent to automatically pair and trust a Bluetooth device by name.
        Requires root privileges to register D-Bus agent.

        Expected JSON body:
        {
            "device_name": "Skelly Speaker",
            "pin": "1234",
            "timeout": 30,  # optional, default 30 seconds
            "adapter_path": "/org/bluez/hci0"  # optional adapter override
        }

        Returns:
        {
            "success": true/false,
            "error": "error message if failed",
            "paired": true/false,
            "trusted": true/false,
            "device_name": "Skelly Speaker",
            "mac": "AA:BB:CC:DD:EE:FF",
            "adapter_path": "/org/bluez/hci0"
        }
        """
        try:
            data = await request.json()
            self._log_request("pair_and_trust_by_name", data)

            device_name = data.get("device_name")
            pin = data.get("pin", "1234")
            timeout = data.get("timeout", 30.0)
            adapter_path = data.get("adapter_path")

            if not device_name:
                response_data = {"success": False, "error": "device_name is required"}
                self._log_response("pair_and_trust_by_name", response_data)
                return web.json_response(response_data, status=400)

            if not pin:
                response_data = {"success": False, "error": "pin is required"}
                self._log_response("pair_and_trust_by_name", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received pair_and_trust_by_name request for: %s", device_name)
            success, mac = await self.bt_manager.pair_and_trust_by_name(
                device_name, pin, timeout, adapter_path=adapter_path
            )

            mapped_adapter = self.bt_manager.get_device_adapter_path(mac)

            response_data = {
                "success": success,
                "paired": success,
                "trusted": success,
                "device_name": device_name,
                "mac": mac,
                "adapter_path": mapped_adapter,
            }
            self._log_response("pair_and_trust_by_name", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("pair_and_trust_by_name", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            # RuntimeError contains specific error messages:
            # - Device not found
            # - D-Bus not available
            # - Not running as root (and device not paired)
            # - Pairing failed
            _LOGGER.warning("Pair and trust by name failed: %s", exc)
            error_str = str(exc)

            # Determine appropriate status code
            if "root privileges" in error_str or "not paired" in error_str.lower():
                status_code = 403  # Forbidden
            elif "not available" in error_str or "not found" in error_str:
                status_code = 503  # Service Unavailable
            else:
                status_code = 400  # Bad Request

            response_data = {"success": False, "error": error_str}
            self._log_response("pair_and_trust_by_name", response_data)
            return web.json_response(response_data, status=status_code)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in pair_and_trust_by_name")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("pair_and_trust_by_name", response_data)
            return web.json_response(response_data, status=500)

    async def handle_pair_and_trust_by_mac(self, request: web.Request) -> web.Response:
        """Handle POST /pair_and_trust_by_mac endpoint.

        Uses D-Bus agent to automatically pair and trust a Bluetooth device by MAC.
        Requires root privileges to register D-Bus agent.

        Expected JSON body:
        {
            "mac": "AA:BB:CC:DD:EE:FF",
            "pin": "1234",
            "timeout": 30,  # optional, default 30 seconds
            "adapter_path": "/org/bluez/hci0"  # optional adapter override
        }

        Returns:
        {
            "success": true/false,
            "error": "error message if failed",
            "paired": true/false,
            "trusted": true/false,
            "mac": "AA:BB:CC:DD:EE:FF",
            "adapter_path": "/org/bluez/hci0"
        }
        """
        try:
            data = await request.json()
            self._log_request("pair_and_trust_by_mac", data)

            mac = data.get("mac")
            pin = data.get("pin", "1234")
            timeout = data.get("timeout", 30.0)
            adapter_path = data.get("adapter_path")

            if not mac:
                response_data = {"success": False, "error": "mac is required"}
                self._log_response("pair_and_trust_by_mac", response_data)
                return web.json_response(response_data, status=400)

            if not pin:
                response_data = {"success": False, "error": "pin is required"}
                self._log_response("pair_and_trust_by_mac", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received pair_and_trust_by_mac request for: %s", mac)
            success = await self.bt_manager.pair_and_trust_by_mac(
                mac, pin, timeout, adapter_path=adapter_path
            )

            mapped_adapter = self.bt_manager.get_device_adapter_path(mac)

            response_data = {
                "success": success,
                "paired": success,
                "trusted": success,
                "mac": mac,
                "adapter_path": mapped_adapter,
            }
            self._log_response("pair_and_trust_by_mac", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("pair_and_trust_by_mac", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            # RuntimeError contains specific error messages:
            # - D-Bus not available
            # - Not running as root (and device not paired)
            # - Pairing failed
            _LOGGER.warning("Pair and trust by MAC failed: %s", exc)
            error_str = str(exc)

            # Determine appropriate status code
            if "root privileges" in error_str or "not paired" in error_str.lower():
                status_code = 403  # Forbidden
            elif "not available" in error_str or "not found" in error_str:
                status_code = 503  # Service Unavailable
            else:
                status_code = 400  # Bad Request

            response_data = {"success": False, "error": error_str}
            self._log_response("pair_and_trust_by_mac", response_data)
            return web.json_response(response_data, status=status_code)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in pair_and_trust_by_mac")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("pair_and_trust_by_mac", response_data)
            return web.json_response(response_data, status=500)

    async def handle_get_name(self, request: web.Request) -> web.Response:
        """Handle GET /name endpoint.

        Returns names of all connected devices or a specific device.
        Query param: mac=<MAC> for specific device

        Returns:
        {
            "device_name": "Skelly Speaker",  # If mac param provided
            "mac": "AA:BB:CC:DD:EE:FF",
            "connected": true/false,
            "adapter_path": "/org/bluez/hci0"
        }
        or
        {
            "devices": [{"name": "...", "mac": "...", "adapter_path": "..."}],
            "count": 1
        }
        """
        mac = request.query.get("mac")
        query_params = {"mac": mac} if mac else {}
        self._log_request("get_name", query_params)

        if mac:
            device = self.bt_manager.get_device_by_mac(mac)
            response_data = {
                "device_name": device.name if device else None,
                "mac": mac,
                "connected": device is not None,
                "adapter_path": device.adapter_path if device else None,
            }
            self._log_response("get_name", response_data)
            return web.json_response(response_data)

        # Return all connected devices
        devices = self.bt_manager.get_connected_devices()
        response_data = {
            "devices": [self._serialize_device_info(dev) for dev in devices.values()],
            "count": len(devices),
        }
        self._log_response("get_name", response_data)
        return web.json_response(response_data)

    async def handle_get_mac(self, request: web.Request) -> web.Response:
        """Handle GET /mac endpoint.

        Returns MAC addresses of all connected devices or search by name.
        Query param: name=<NAME> to search by device name

        Returns:
        {
            "mac": "AA:BB:CC:DD:EE:FF",  # If name param provided
            "device_name": "Skelly Speaker",
            "connected": true/false,
            "adapter_path": "/org/bluez/hci0"
        }
        or
        {
            "devices": [{"name": "...", "mac": "...", "adapter_path": "..."}],
            "count": 1
        }
        """
        name = request.query.get("name")
        query_params = {"name": name} if name else {}
        self._log_request("get_mac", query_params)

        if name:
            device = self.bt_manager.get_device_by_name(name)
            response_data = {
                "mac": device.mac if device else None,
                "device_name": name,
                "connected": device is not None,
                "adapter_path": device.adapter_path if device else None,
            }
            self._log_response("get_mac", response_data)
            return web.json_response(response_data)

        # Return all connected devices
        devices = self.bt_manager.get_connected_devices()
        response_data = {
            "devices": [self._serialize_device_info(dev) for dev in devices.values()],
            "count": len(devices),
        }
        self._log_response("get_mac", response_data)
        return web.json_response(response_data)

    async def handle_play(self, request: web.Request) -> web.Response:
        """Handle POST /play endpoint with file upload.

        Expected multipart/form-data with:
        - file: The audio file (required)
        - mac: Optional single target device MAC
        - device_name: Optional device name to find
        - macs: Optional JSON array of target MACs
        - all: Optional "true" to play on all devices

        Returns:
        {
            "success": true/false,
            "filename": "audio.wav",
            "is_playing": true/false,
            "sessions": {...},
            "error": "error message if failed"
        }
        """
        try:
            reader = await request.multipart()

            file_data = None
            filename = "audio.wav"
            target = None
            targets = None
            play_all = False

            # Read multipart fields
            async for part in reader:
                if part.name == "file":
                    # Read the uploaded file
                    filename = part.filename or "audio.wav"
                    file_data = await part.read()
                elif part.name == "mac":
                    target = (await part.read()).decode()
                elif part.name == "device_name":
                    device_name = (await part.read()).decode()
                    # Find device by name
                    device = self.bt_manager.get_device_by_name(device_name)
                    if device:
                        target = device.mac
                        _LOGGER.info(
                            "Found device %s with MAC: %s", device_name, target
                        )
                    else:
                        response_data = {
                            "success": False,
                            "error": f"Device '{device_name}' not found",
                        }
                        self._log_response("play", response_data)
                        return web.json_response(response_data, status=404)
                elif part.name == "macs":
                    macs_str = (await part.read()).decode()
                    targets = json.loads(macs_str)
                elif part.name == "all":
                    all_str = (await part.read()).decode()
                    play_all = all_str.lower() == "true"

            # Log request metadata (not binary file data)
            request_data = {
                "filename": filename,
                "file_size": len(file_data) if file_data else 0,
                "target": target,
                "targets": targets,
                "play_all": play_all,
            }
            self._log_request("play", request_data)

            if not file_data:
                response_data = {"success": False, "error": "No file uploaded"}
                self._log_response("play", response_data)
                return web.json_response(response_data, status=400)

            # Save uploaded file to temporary directory
            upload_dir = self.app["upload_dir"]
            file_path = upload_dir / filename
            file_path.write_bytes(file_data)
            _LOGGER.info("Saved uploaded file to: %s", file_path)

            # Determine target(s)
            final_targets, validation_error = self._resolve_play_targets(
                target=target, targets=targets, play_all=play_all
            )
            if validation_error:
                response_data = {"success": False, "error": validation_error}
                self._log_response("play", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received play request for uploaded file: %s", filename)
            success = await self.audio_player.play(
                str(file_path), targets=final_targets
            )

            response_data = {
                "success": success,
                "filename": filename,
                "is_playing": self.audio_player.is_playing(),
                "sessions": self.audio_player.get_all_sessions(),
            }
            self._log_response("play", response_data)
            return web.json_response(response_data)

        except ValueError as exc:
            return web.json_response(
                {"success": False, "error": f"Invalid data: {exc}"}, status=400
            )
        except Exception as exc:
            _LOGGER.exception("Error in play")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_play_filename(self, request: web.Request) -> web.Response:
        """Handle POST /play_filename endpoint with file path.

        Expected JSON body:
        {
            "file_path": "/path/to/audio.wav",
            "mac": "optional_bt_device_mac",  # Single target
            "device_name": "optional_device_name",  # Find by name
            "macs": ["mac1", "mac2"],  # Multiple targets
            "all": true  # Play on all connected devices
        }

        Returns:
        {
            "success": true/false,
            "file_path": "/path/to/audio.wav",
            "is_playing": true/false,
            "sessions": {...},
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("play_filename", data)

            file_path = data.get("file_path")

            if not file_path:
                response_data = {"success": False, "error": "file_path is required"}
                self._log_response("play_filename", response_data)
                return web.json_response(response_data, status=400)

            # Determine target(s)
            target = None
            targets = None

            play_all = bool(data.get("all"))
            if not play_all and data.get("macs"):
                # Multiple specific targets
                targets = data["macs"]
            elif data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    target = device.mac
                    _LOGGER.info(
                        "Found device %s with MAC: %s", data["device_name"], target
                    )
                else:
                    response_data = {
                        "success": False,
                        "error": f"Device '{data['device_name']}' not found",
                    }
                    self._log_response("play_filename", response_data)
                    return web.json_response(response_data, status=404)
            elif data.get("mac"):
                # Single target by MAC
                target = data["mac"]

            final_targets, validation_error = self._resolve_play_targets(
                target=target, targets=targets, play_all=play_all
            )
            if validation_error:
                response_data = {"success": False, "error": validation_error}
                self._log_response("play_filename", response_data)
                return web.json_response(response_data, status=400)

            _LOGGER.info("Received play_filename request for: %s", file_path)
            success = await self.audio_player.play(file_path, targets=final_targets)

            response_data = {
                "success": success,
                "file_path": file_path,
                "is_playing": self.audio_player.is_playing(),
                "sessions": self.audio_player.get_all_sessions(),
            }
            self._log_response("play_filename", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("play_filename", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Error in play_filename")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("play_filename", response_data)
            return web.json_response(response_data, status=500)

    async def handle_stop(self, request: web.Request) -> web.Response:
        """Handle POST /stop endpoint.

        Expected JSON body (optional):
        {
            "mac": "optional_device_mac",  # Stop specific device
            "device_name": "optional_device_name",  # Find by name
            "all": true  # Stop all (default if no params)
        }

        Returns:
        {
            "success": true/false,
            "is_playing": true/false,
            "sessions": {...},
            "error": "error message if failed"
        }
        """
        try:
            data = {}
            if request.body_exists:
                data = await request.json()

            self._log_request("stop", data if data else None)

            target = None
            if data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    target = device.mac
                else:
                    response_data = {
                        "success": False,
                        "error": f"Device '{data['device_name']}' not found",
                    }
                    self._log_response("stop", response_data)
                    return web.json_response(response_data, status=404)
            elif data.get("mac"):
                target = data["mac"]
            # If no target specified, stop all (target=None)

            _LOGGER.info("Received stop request for target: %s", target or "all")
            success = await self.audio_player.stop(target)

            response_data = {
                "success": success,
                "is_playing": self.audio_player.is_playing(),
                "sessions": self.audio_player.get_all_sessions(),
            }
            self._log_response("stop", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("stop", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Error in stop")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("stop", response_data)
            return web.json_response(response_data, status=500)

    async def handle_disconnect(self, request: web.Request) -> web.Response:
        """Handle POST /disconnect endpoint.

        Expected JSON body (optional):
        {
            "mac": "optional_device_mac",  # Disconnect specific device
            "device_name": "optional_device_name",  # Find by name
            "all": true  # Disconnect all (default if no params)
        }

        Returns:
        {
            "success": true/false,
            "connected": true/false,
            "error": "error message if failed"
        }
        """
        try:
            data = {}
            if request.body_exists:
                data = await request.json()

            self._log_request("disconnect", data if data else None)

            mac = None
            if data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    mac = device.mac
                else:
                    response_data = {
                        "success": False,
                        "error": f"Device '{data['device_name']}' not found",
                    }
                    self._log_response("disconnect", response_data)
                    return web.json_response(response_data, status=404)
            elif data.get("mac"):
                mac = data["mac"]
            # If no MAC specified, disconnect all (mac=None)

            _LOGGER.info("Received disconnect request for: %s", mac or "all devices")
            success = await self.bt_manager.disconnect(mac)

            response_data = {
                "success": success,
                "connected": bool(self.bt_manager.get_connected_devices()),
            }
            self._log_response("disconnect", response_data)
            return web.json_response(response_data)

        except Exception as exc:
            _LOGGER.exception("Error in disconnect")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("disconnect", response_data)
            return web.json_response(response_data, status=500)

    async def handle_status(self, request: web.Request) -> web.Response:
        """Handle GET /status endpoint.

        Returns comprehensive status of both Bluetooth and audio player.

        Returns:
        {
            "bluetooth": {
                "connected_count": 1,
                "devices": [{"name": "...", "mac": "...", "adapter_path": "..."}]
            },
            "audio": {
                "is_playing": true/false,
                "active_sessions": 1,
                "sessions": [{"target": "...", "file_path": "...", "is_playing": true/false}]
            }
        }
        """
        self._log_request("status", None)

        connected_devices = self.bt_manager.get_connected_devices()
        playback_sessions = self.audio_player.get_all_sessions()

        response_data = {
            "bluetooth": {
                "connected_count": len(connected_devices),
                "devices": [
                    self._serialize_device_info(dev)
                    for dev in connected_devices.values()
                ],
            },
            "audio": {
                "is_playing": self.audio_player.is_playing(),
                "active_sessions": len(playback_sessions),
                "sessions": [
                    {
                        "target": target_key,
                        "file_path": file_path,
                        "is_playing": is_playing,
                    }
                    for target_key, (
                        file_path,
                        is_playing,
                    ) in playback_sessions.items()
                ],
            },
        }
        self._log_response("status", response_data)
        return web.json_response(response_data)

    async def handle_health(self, request: web.Request) -> web.Response:
        """Handle GET /health endpoint.

        Simple health check endpoint.

        Returns:
        {
            "status": "ok"
        }
        """
        self._log_request("health", None)

        response_data = {"status": "ok"}
        self._log_response("health", response_data)
        return web.json_response(response_data)

    async def handle_ble_scan_devices(self, request: web.Request) -> web.Response:
        """Handle GET /ble/scan_devices endpoint.

        Query parameters:
            name_filter: Optional name filter (case-insensitive substring match)
            timeout: Scan duration in seconds (default: 10.0)
                    - If name_filter is provided but no matching device in cache,
                      polls cache until timeout or device found
                    - If no name_filter and cache has 0-1 devices, waits full timeout
                      to collect more devices

        Returns:
        {
            "success": true/false,
            "devices": [
                {
                    "name": "Device Name",
                    "address": "AA:BB:CC:DD:EE:FF",
                    "rssi": -50
                },
                ...
            ],
            "error": "error message if failed"
        }
        """
        try:
            # Get query parameters
            name_filter = request.query.get("name_filter")
            timeout = float(request.query.get("timeout", "10.0"))

            self._log_request(
                "ble/scan_devices", {"name_filter": name_filter, "timeout": timeout}
            )

            devices = await self.ble_manager.scan_devices(
                name_filter=name_filter, timeout=timeout
            )

            response_data = {
                "success": True,
                "devices": devices,
                "count": len(devices),
            }
            self._log_response("ble/scan_devices", response_data)
            return web.json_response(response_data)

        except ValueError as exc:
            response_data = {"success": False, "error": f"Invalid parameter: {exc}"}
            self._log_response("ble/scan_devices", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE scan")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/scan_devices", response_data)
            return web.json_response(response_data, status=500)

    async def handle_ble_connect(self, request: web.Request) -> web.Response:
        """Handle POST /ble/connect endpoint.

        Expected JSON body:
        {
            "address": "AA:BB:CC:DD:EE:FF",  # optional
            "name_filter": "Animated Skelly",  # optional, defaults to "Animated Skelly"
            "timeout": 10.0  # optional, defaults to 10.0
        }

        Returns:
        {
            "success": true/false,
            "session_id": "sess-abc123",
            "address": "AA:BB:CC:DD:EE:FF",
            "mtu": 517,  # optional, BLE MTU size in bytes if available
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("ble/connect", data)

            address = data.get("address")
            name_filter = data.get("name_filter", "Animated Skelly")
            timeout = data.get("timeout", 10.0)

            session_id, device_address, mtu = await self.ble_manager.create_session(
                address=address, name_filter=name_filter, timeout=timeout
            )

            response_data = {
                "success": True,
                "session_id": session_id,
                "address": device_address,
            }
            # Include MTU if available
            if mtu is not None:
                response_data["mtu"] = mtu
            self._log_response("ble/connect", response_data)
            return web.json_response(response_data)

        except ValueError:
            response_data = {"success": False, "error": "Invalid JSON"}
            self._log_response("ble/connect", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            _LOGGER.warning("BLE connect failed: %s", exc)
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/connect", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE connect")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/connect", response_data)
            return web.json_response(response_data, status=500)

    async def handle_ble_send_command(self, request: web.Request) -> web.Response:
        """Handle POST /ble/send_command endpoint.

        Expected JSON body:
        {
            "session_id": "sess-abc123",  # optional if only one session
            "command": "AA E0 00 00 E0"  # hex string (spaces optional)
        }

        Returns:
        {
            "success": true/false,
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("ble/send_command", data)

            session_id = data.get("session_id")
            command_hex = data.get("command")

            if not command_hex:
                response_data = {"success": False, "error": "command is required"}
                self._log_response("ble/send_command", response_data)
                return web.json_response(response_data, status=400)

            # If no session_id provided, use the only session if there's exactly one
            if not session_id:
                sessions = self.ble_manager.list_sessions()
                if len(sessions) == 1:
                    session_id = sessions[0]["session_id"]
                else:
                    response_data = {
                        "success": False,
                        "error": "session_id required when multiple sessions exist",
                    }
                    self._log_response("ble/send_command", response_data)
                    return web.json_response(response_data, status=400)

            # Convert hex string to bytes (remove spaces and convert)
            try:
                cmd_bytes = bytes.fromhex(command_hex.replace(" ", ""))
            except ValueError as exc:
                response_data = {
                    "success": False,
                    "error": f"Invalid hex string: {exc}",
                }
                self._log_response("ble/send_command", response_data)
                return web.json_response(response_data, status=400)

            await self.ble_manager.send_command(session_id, cmd_bytes)

            response_data = {"success": True}
            self._log_response("ble/send_command", response_data)
            return web.json_response(response_data)

        except ValueError as exc:
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/send_command", response_data)
            return web.json_response(response_data, status=400)
        except RuntimeError as exc:
            _LOGGER.warning("BLE send command failed: %s", exc)
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/send_command", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE send command")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/send_command", response_data)
            return web.json_response(response_data, status=500)

    async def handle_ble_notifications(self, request: web.Request) -> web.Response:
        """Handle GET /ble/notifications endpoint (long-polling).

        Expected query parameters:
        - session_id: Session identifier (optional if only one session)
        - since: Last sequence number received (default: 0)
        - timeout: Long-poll timeout in seconds (default: 30.0)

        Returns:
        {
            "notifications": [
                {
                    "sequence": 1,
                    "timestamp": "2025-11-14T10:30:00.123456",
                    "sender": "0000ffe1-0000-1000-8000-00805f9b34fb",
                    "data": "BB E0 32 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 FF"
                },
                ...
            ],
            "next_sequence": 2,
            "has_more": false,
            "error": "error message if failed"
        }
        """
        try:
            params = dict(request.query)
            self._log_request("ble/notifications", params)

            session_id = params.get("session_id")
            since = int(params.get("since", 0))
            timeout = float(params.get("timeout", 30.0))

            # If no session_id provided, use the only session if there's exactly one
            if not session_id:
                sessions = self.ble_manager.list_sessions()
                if len(sessions) == 1:
                    session_id = sessions[0]["session_id"]
                else:
                    response_data = {
                        "notifications": [],
                        "next_sequence": since,
                        "has_more": False,
                        "error": "session_id required when multiple sessions exist",
                    }
                    self._log_response("ble/notifications", response_data)
                    return web.json_response(response_data, status=400)

            response_data = await self.ble_manager.get_notifications(
                session_id, since, timeout
            )
            # Add success field for client compatibility
            response_data["success"] = True
            self._log_response("ble/notifications", response_data)
            return web.json_response(response_data)

        except ValueError as exc:
            response_data = {
                "notifications": [],
                "next_sequence": since,
                "has_more": False,
                "error": str(exc),
            }
            self._log_response("ble/notifications", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE notifications")
            response_data = {
                "notifications": [],
                "next_sequence": since,
                "has_more": False,
                "error": str(exc),
            }
            self._log_response("ble/notifications", response_data)
            return web.json_response(response_data, status=500)

    async def handle_ble_disconnect(self, request: web.Request) -> web.Response:
        """Handle POST /ble/disconnect endpoint.

        Expected JSON body:
        {
            "session_id": "sess-abc123"  # optional if only one session
        }

        Returns:
        {
            "success": true/false,
            "error": "error message if failed"
        }
        """
        try:
            data = await request.json()
            self._log_request("ble/disconnect", data)

            session_id = data.get("session_id")

            # If no session_id provided, disconnect the only session if there's exactly one
            if not session_id:
                sessions = self.ble_manager.list_sessions()
                if len(sessions) == 1:
                    session_id = sessions[0]["session_id"]
                else:
                    response_data = {
                        "success": False,
                        "error": "session_id required when multiple sessions exist",
                    }
                    self._log_response("ble/disconnect", response_data)
                    return web.json_response(response_data, status=400)

            await self.ble_manager.disconnect_session(session_id)

            response_data = {"success": True}
            self._log_response("ble/disconnect", response_data)
            return web.json_response(response_data)

        except ValueError as exc:
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/disconnect", response_data)
            return web.json_response(response_data, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE disconnect")
            response_data = {"success": False, "error": str(exc)}
            self._log_response("ble/disconnect", response_data)
            return web.json_response(response_data, status=500)

    async def handle_ble_sessions(self, request: web.Request) -> web.Response:
        """Handle GET /ble/sessions endpoint.

        Returns list of active BLE sessions.

        Returns:
        {
            "sessions": [
                {
                    "session_id": "sess-abc123",
                    "address": "AA:BB:CC:DD:EE:FF",
                    "created_at": "2025-11-14T10:00:00",
                    "last_activity": "2025-11-14T10:30:00",
                    "buffer_size": 5,
                    "is_connected": true
                },
                ...
            ]
        }
        """
        try:
            self._log_request("ble/sessions", None)

            sessions = self.ble_manager.list_sessions()

            response_data = {"sessions": sessions}
            self._log_response("ble/sessions", response_data)
            return web.json_response(response_data)

        except Exception as exc:
            _LOGGER.exception("Unexpected error in BLE sessions")
            response_data = {"sessions": [], "error": str(exc)}
            self._log_response("ble/sessions", response_data)
            return web.json_response(response_data, status=500)

    async def _on_startup(self, app: web.Application) -> None:
        """Called when application starts."""
        await self.ble_manager.start()
        _LOGGER.info("BLE session manager started")
        await self.bt_manager.start_background_scanner()
        _LOGGER.info("Bluetooth Classic background scanner started")

    async def _on_cleanup(self, app: web.Application) -> None:
        """Called when application shuts down."""
        await self.bt_manager.stop_background_scanner()
        _LOGGER.info("Bluetooth Classic background scanner stopped")
        await self.ble_manager.stop()
        _LOGGER.info("BLE session manager stopped")

    async def start(self) -> None:
        """Start the server."""
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        _LOGGER.info("Skelly Ultra server started on %s:%d", self.host, self.port)

    def run(self) -> None:
        """Run the server (blocking call)."""
        web.run_app(self.app, host=self.host, port=self.port)


def main() -> None:
    """Main entry point for running the server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    server = SkellyUltraServer()
    _LOGGER.info("Starting Skelly Ultra REST server")
    server.run()


if __name__ == "__main__":
    main()
