"""REST API server for Skelly Ultra Bluetooth and audio management."""

from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path

from aiohttp import web

from .audio_player import AudioPlayer
from .bluetooth_manager import BluetoothManager

_LOGGER = logging.getLogger(__name__)


class SkellyUltraServer:
    """REST server for managing Bluetooth connections and audio playback."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765) -> None:
        """Initialize the server.

        Args:
            host: Host address to bind to
            port: Port to listen on
        """
        self.host = host
        self.port = port
        self.bt_manager = BluetoothManager()
        self.audio_player = AudioPlayer()
        self.app = web.Application()
        self.app["upload_dir"] = Path(tempfile.mkdtemp(prefix="skelly_audio_"))
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up API routes."""
        self.app.router.add_post("/connect_by_name", self.handle_connect_by_name)
        self.app.router.add_post("/connect_by_mac", self.handle_connect_by_mac)
        self.app.router.add_get("/name", self.handle_get_name)
        self.app.router.add_get("/mac", self.handle_get_mac)
        self.app.router.add_post("/play", self.handle_play)
        self.app.router.add_post("/play_filename", self.handle_play_filename)
        self.app.router.add_post("/stop", self.handle_stop)
        self.app.router.add_post("/disconnect", self.handle_disconnect)
        self.app.router.add_get("/status", self.handle_status)
        self.app.router.add_get("/health", self.handle_health)

    async def handle_connect_by_name(self, request: web.Request) -> web.Response:
        """Handle POST /connect_by_name endpoint.

        Expected JSON body:
        {
            "device_name": "Skelly Speaker",
            "pin": "1234"
        }
        """
        try:
            data = await request.json()
            device_name = data.get("device_name")
            pin = data.get("pin", "1234")

            if not device_name:
                return web.json_response(
                    {"success": False, "error": "device_name is required"}, status=400
                )

            _LOGGER.info("Received connect_by_name request for: %s", device_name)
            await self.bt_manager.connect_by_name(device_name, pin)

            return web.json_response(
                {
                    "success": True,
                    "device_name": self.bt_manager.get_connected_device_name(),
                    "mac": self.bt_manager.get_connected_device_mac(),
                }
            )

        except ValueError:
            return web.json_response(
                {"success": False, "error": "Invalid JSON"}, status=400
            )
        except RuntimeError as exc:
            # RuntimeError contains the specific error message from bluetooth_manager
            _LOGGER.warning("Connect by name failed: %s", exc)
            return web.json_response({"success": False, "error": str(exc)}, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in connect_by_name")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_connect_by_mac(self, request: web.Request) -> web.Response:
        """Handle POST /connect_by_mac endpoint.

        Expected JSON body:
        {
            "mac": "AA:BB:CC:DD:EE:FF",
            "pin": "1234"
        }
        """
        try:
            data = await request.json()
            mac = data.get("mac")
            pin = data.get("pin", "1234")

            if not mac:
                return web.json_response(
                    {"success": False, "error": "mac is required"}, status=400
                )

            _LOGGER.info("Received connect_by_mac request for: %s", mac)
            await self.bt_manager.connect_by_mac(mac, pin)

            return web.json_response(
                {
                    "success": True,
                    "device_name": self.bt_manager.get_connected_device_name(),
                    "mac": self.bt_manager.get_connected_device_mac(),
                }
            )

        except ValueError:
            return web.json_response(
                {"success": False, "error": "Invalid JSON"}, status=400
            )
        except RuntimeError as exc:
            # RuntimeError contains the specific error message from bluetooth_manager
            _LOGGER.warning("Connect by MAC failed: %s", exc)
            return web.json_response({"success": False, "error": str(exc)}, status=400)
        except Exception as exc:
            _LOGGER.exception("Unexpected error in connect_by_mac")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_get_name(self, request: web.Request) -> web.Response:
        """Handle GET /name endpoint.

        Returns names of all connected devices or a specific device.
        Query param: mac=<MAC> for specific device
        """
        mac = request.query.get("mac")
        if mac:
            device = self.bt_manager.get_device_by_mac(mac)
            return web.json_response(
                {
                    "device_name": device.name if device else None,
                    "mac": mac,
                    "connected": device is not None,
                }
            )

        # Return all connected devices
        devices = self.bt_manager.get_connected_devices()
        return web.json_response(
            {
                "devices": [
                    {"name": dev.name, "mac": dev.mac} for dev in devices.values()
                ],
                "count": len(devices),
            }
        )

    async def handle_get_mac(self, request: web.Request) -> web.Response:
        """Handle GET /mac endpoint.

        Returns MAC addresses of all connected devices or search by name.
        Query param: name=<NAME> to search by device name
        """
        name = request.query.get("name")
        if name:
            device = self.bt_manager.get_device_by_name(name)
            return web.json_response(
                {
                    "mac": device.mac if device else None,
                    "device_name": name,
                    "connected": device is not None,
                }
            )

        # Return all connected devices
        devices = self.bt_manager.get_connected_devices()
        return web.json_response(
            {
                "devices": [
                    {"name": dev.name, "mac": dev.mac} for dev in devices.values()
                ],
                "count": len(devices),
            }
        )

    async def handle_play(self, request: web.Request) -> web.Response:
        """Handle POST /play endpoint with file upload.

        Expected multipart/form-data with:
        - file: The audio file (required)
        - mac: Optional single target device MAC
        - device_name: Optional device name to find
        - macs: Optional JSON array of target MACs
        - all: Optional "true" to play on all devices
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
                        return web.json_response(
                            {
                                "success": False,
                                "error": f"Device '{device_name}' not found",
                            },
                            status=404,
                        )
                elif part.name == "macs":
                    macs_str = (await part.read()).decode()
                    targets = json.loads(macs_str)
                elif part.name == "all":
                    all_str = (await part.read()).decode()
                    play_all = all_str.lower() == "true"

            if not file_data:
                return web.json_response(
                    {"success": False, "error": "No file uploaded"}, status=400
                )

            # Save uploaded file to temporary directory
            upload_dir = self.app["upload_dir"]
            file_path = upload_dir / filename
            file_path.write_bytes(file_data)
            _LOGGER.info("Saved uploaded file to: %s", file_path)

            # Determine target(s)
            if play_all:
                # Play on all connected devices
                connected = self.bt_manager.get_connected_devices()
                targets = [dev.mac for dev in connected.values()]
                _LOGGER.info("Playing on all %d connected devices", len(targets))
            elif targets:
                # Multiple specific targets already set
                _LOGGER.info("Playing on %d specified targets", len(targets))

            _LOGGER.info("Received play request for uploaded file: %s", filename)
            success = await self.audio_player.play(
                str(file_path), target=target, targets=targets
            )

            return web.json_response(
                {
                    "success": success,
                    "filename": filename,
                    "is_playing": self.audio_player.is_playing(),
                    "sessions": self.audio_player.get_all_sessions(),
                }
            )

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
        """
        try:
            data = await request.json()
            file_path = data.get("file_path")

            if not file_path:
                return web.json_response(
                    {"success": False, "error": "file_path is required"}, status=400
                )

            # Determine target(s)
            target = None
            targets = None

            if data.get("all"):
                # Play on all connected devices
                connected = self.bt_manager.get_connected_devices()
                targets = [dev.mac for dev in connected.values()]
                _LOGGER.info("Playing on all %d connected devices", len(targets))
            elif data.get("macs"):
                # Multiple specific targets
                targets = data["macs"]
                _LOGGER.info("Playing on %d specified targets", len(targets))
            elif data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    target = device.mac
                    _LOGGER.info(
                        "Found device %s with MAC: %s", data["device_name"], target
                    )
                else:
                    return web.json_response(
                        {
                            "success": False,
                            "error": f"Device '{data['device_name']}' not found",
                        },
                        status=404,
                    )
            elif data.get("mac"):
                # Single target by MAC
                target = data["mac"]

            _LOGGER.info("Received play_filename request for: %s", file_path)
            success = await self.audio_player.play(
                file_path, target=target, targets=targets
            )

            return web.json_response(
                {
                    "success": success,
                    "file_path": file_path,
                    "is_playing": self.audio_player.is_playing(),
                    "sessions": self.audio_player.get_all_sessions(),
                }
            )

        except ValueError:
            return web.json_response(
                {"success": False, "error": "Invalid JSON"}, status=400
            )
        except Exception as exc:
            _LOGGER.exception("Error in play_filename")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_stop(self, request: web.Request) -> web.Response:
        """Handle POST /stop endpoint.

        Expected JSON body (optional):
        {
            "mac": "optional_device_mac",  # Stop specific device
            "device_name": "optional_device_name",  # Find by name
            "all": true  # Stop all (default if no params)
        }
        """
        try:
            data = {}
            if request.body_exists:
                data = await request.json()

            target = None
            if data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    target = device.mac
                else:
                    return web.json_response(
                        {
                            "success": False,
                            "error": f"Device '{data['device_name']}' not found",
                        },
                        status=404,
                    )
            elif data.get("mac"):
                target = data["mac"]
            # If no target specified, stop all (target=None)

            _LOGGER.info("Received stop request for target: %s", target or "all")
            success = await self.audio_player.stop(target)

            return web.json_response(
                {
                    "success": success,
                    "is_playing": self.audio_player.is_playing(),
                    "sessions": self.audio_player.get_all_sessions(),
                }
            )

        except ValueError:
            return web.json_response(
                {"success": False, "error": "Invalid JSON"}, status=400
            )
        except Exception as exc:
            _LOGGER.exception("Error in stop")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_disconnect(self, request: web.Request) -> web.Response:
        """Handle POST /disconnect endpoint.

        Expected JSON body (optional):
        {
            "mac": "optional_device_mac",  # Disconnect specific device
            "device_name": "optional_device_name",  # Find by name
            "all": true  # Disconnect all (default if no params)
        }
        """
        try:
            data = {}
            if request.body_exists:
                data = await request.json()

            mac = None
            if data.get("device_name"):
                # Find device by name
                device = self.bt_manager.get_device_by_name(data["device_name"])
                if device:
                    mac = device.mac
                else:
                    return web.json_response(
                        {
                            "success": False,
                            "error": f"Device '{data['device_name']}' not found",
                        },
                        status=404,
                    )
            elif data.get("mac"):
                mac = data["mac"]
            # If no MAC specified, disconnect all (mac=None)

            _LOGGER.info("Received disconnect request for: %s", mac or "all devices")
            success = await self.bt_manager.disconnect(mac)

            return web.json_response(
                {
                    "success": success,
                    "connected": self.bt_manager.get_connected_device_mac() is not None,
                }
            )

        except Exception as exc:
            _LOGGER.exception("Error in disconnect")
            return web.json_response({"success": False, "error": str(exc)}, status=500)

    async def handle_status(self, request: web.Request) -> web.Response:
        """Handle GET /status endpoint.

        Returns comprehensive status of both Bluetooth and audio player.
        """
        connected_devices = self.bt_manager.get_connected_devices()
        playback_sessions = self.audio_player.get_all_sessions()

        return web.json_response(
            {
                "bluetooth": {
                    "connected_count": len(connected_devices),
                    "devices": [
                        {"name": dev.name, "mac": dev.mac}
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
        )

    async def handle_health(self, request: web.Request) -> web.Response:
        """Handle GET /health endpoint.

        Simple health check endpoint.
        """
        return web.json_response({"status": "ok"})

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
