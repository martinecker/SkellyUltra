#!/usr/bin/env python3
"""Example script to demonstrate using the Skelly Ultra REST server."""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path to import from skelly_ultra_srv
sys.path.insert(0, str(Path(__file__).parent.parent))

from skelly_ultra_srv.colored_logging import setup_colored_logging
from skelly_ultra_srv.server import SkellyUltraServer


async def main():
    """Run the server."""
    parser = argparse.ArgumentParser(
        description="Run the Skelly Ultra REST server for Bluetooth and audio management"
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose (DEBUG) logging",
    )
    parser.add_argument(
        "--debug-json",
        action="store_true",
        help="Enable debug logging of JSON requests and responses",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host address to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port to listen on (default: 8765)",
    )
    args = parser.parse_args()

    # Configure colored logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    setup_colored_logging(level=log_level)

    server = SkellyUltraServer(
        host=args.host, port=args.port, debug_json=args.debug_json
    )

    print(f"Starting Skelly Ultra REST server on http://{args.host}:{args.port}")
    print("\nAvailable endpoints:")
    print("\n  Pairing (requires root):")
    print("  POST /pair_and_trust_by_name  - Pair and trust device by name")
    print("  POST /pair_and_trust_by_mac   - Pair and trust device by MAC address")
    print("\n  Connection:")
    print("  POST /connect_by_name  - Connect by device name")
    print("  POST /connect_by_mac   - Connect by MAC address")
    print(
        "  POST /disconnect       - Disconnect device(s) (optional mac/device_name, defaults to all)"
    )
    print("\n  Device Info:")
    print(
        "  GET  /name             - Get connected device name(s) (optional ?mac= filter)"
    )
    print(
        "  GET  /mac              - Get connected device MAC(s) (optional ?name= search)"
    )
    print("  GET  /status           - Get full status (all devices and sessions)")
    print("\n  Audio Playback:")
    print("  POST /play             - Upload and play audio (multipart/form-data)")
    print("  POST /play_filename    - Play audio from file path (JSON with file_path)")
    print(
        "  POST /stop             - Stop playback (optional mac/device_name, defaults to all)"
    )
    print("\n  Health:")
    print("  GET  /health           - Health check")
    print(f"\nLog level: {'DEBUG (verbose)' if args.verbose else 'INFO'}")
    print("\nMulti-device support:")
    print("  - Connect multiple devices simultaneously")
    print("  - Upload audio files via HTTP and play on specific devices or all at once")
    print("  - Specify device by 'mac' (MAC address) or 'device_name'")
    print("  - Use 'macs' array for multiple targets or 'all' for all devices")
    print("  - Stop/disconnect specific devices or all devices")
    print("\nPress Ctrl+C to stop\n")

    await server.start()

    # Keep running
    try:
        while True:
            await asyncio.sleep(3600)
    except KeyboardInterrupt:
        print("\nShutting down server...")


if __name__ == "__main__":
    asyncio.run(main())
