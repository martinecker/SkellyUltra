# Skelly Ultra REST Server

A Python REST API server using aiohttp for managing Bluetooth Classic device connections and audio playback for the Skelly Ultra Halloween animatronic.

## Purpose

This server is designed to work around limitations of managing Bluetooth Classic audio devices from within Home Assistant containers. It provides a REST API interface to:
- Connect and pair with Bluetooth Classic devices (the speaker inside the Skelly animatronic)
- Play audio files through the connected device
- Manage device connections

## Requirements

- Python 3.11+
- aiohttp
- bluetoothctl (part of bluez)
- pw-play (part of PipeWire)

## Installation

```bash
pip install aiohttp
```

Ensure system dependencies are installed:
```bash
# On Debian/Ubuntu
sudo apt-get install bluez pipewire-bin

# On Fedora
sudo dnf install bluez pipewire-utils
```

## Running the Server

### As a standalone script:
```bash
python -m skelly_ultra_srv.server
```

### Programmatically:
```python
from skelly_ultra_srv.server import SkellyUltraServer

server = SkellyUltraServer(host="0.0.0.0", port=8765)
server.run()
```

## Important: Bluetooth Pairing

**Bluetooth Classic devices that require a PIN must be paired manually first.**

The REST API cannot fully automate PIN entry for Bluetooth Classic devices. Before using the `/connect_by_name` or `/connect_by_mac` endpoints, you must pair the device manually:

### Option 1: Use the helper script
```bash
chmod +x pair_device.sh
./pair_device.sh <MAC_ADDRESS> <PIN>
# Example: ./pair_device.sh F5:A1:BC:80:63:EC 8947
```

### Option 2: Manual pairing with bluetoothctl
```bash
bluetoothctl
> power on
> agent on
> default-agent
> scan on
# Wait for your device to appear
> scan off
> pair <MAC_ADDRESS>
# Enter PIN when prompted
> trust <MAC_ADDRESS>
> exit
```

**After pairing once, the REST API can connect/disconnect automatically.**

## API Endpoints

### POST /connect_by_name
Connect to a Bluetooth device by name.

**Request Body:**
```json
{
    "device_name": "Skelly Speaker",
    "pin": "1234"
}
```

**Response:**
```json
{
    "success": true,
    "device_name": "Skelly Speaker",
    "mac": "AA:BB:CC:DD:EE:FF"
}
```

### POST /connect_by_mac
Connect to a Bluetooth device by MAC address.

**Request Body:**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",
    "pin": "1234"
}
```

**Response:**
```json
{
    "success": true,
    "device_name": "Skelly Speaker",
    "mac": "AA:BB:CC:DD:EE:FF"
}
```

### GET /name
Get the name of the currently connected device.

**Response:**
```json
{
    "device_name": "Skelly Speaker",
    "connected": true
}
```

### GET /mac
Get the MAC address of the currently connected device.

**Response:**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",
    "connected": true
}
```

### POST /play
Upload and play an audio file through the connected device(s).

**Request:** multipart/form-data with the following fields:
- `file`: The audio file (required)
- `mac`: Optional single target device MAC address
- `device_name`: Optional device name to look up
- `macs`: Optional JSON array of MAC addresses for multiple targets
- `all`: Optional "true" to play on all connected devices

**Example (single device by MAC):**
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

**Example (by device name):**
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "device_name=Skelly Speaker"
```

**Example (all devices):**
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "all=true"
```

**Response:**
```json
{
    "success": true,
    "filename": "audio.wav",
    "is_playing": true,
    "sessions": {
        "AA:BB:CC:DD:EE:FF": ["/tmp/skelly_audio_xyz/audio.wav", true]
    }
}
```

### POST /play_filename
Play an audio file from a file path (legacy endpoint for direct file access).

**Request Body:**
```json
{
    "file_path": "/path/to/audio.wav",
    "mac": "AA:BB:CC:DD:EE:FF",  // Optional: single target
    "device_name": "Skelly Speaker",  // Optional: find device by name
    "macs": ["mac1", "mac2"],  // Optional: multiple targets
    "all": true  // Optional: play on all devices
}
```

**Response:**
```json
{
    "success": true,
    "file_path": "/path/to/audio.wav",
    "is_playing": true,
    "sessions": {
        "AA:BB:CC:DD:EE:FF": ["/path/to/audio.wav", true]
    }
}
```

### POST /stop
Stop currently playing audio.

**Request Body (optional):**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",  // Optional: stop specific device
    "device_name": "Skelly Speaker",  // Optional: find device by name
    "all": true  // Optional: explicitly stop all (default behavior)
}
```

**Response:**
```json
{
    "success": true,
    "is_playing": false,
    "sessions": {}
}
```

### POST /disconnect
Disconnect Bluetooth device(s).

**Request Body (optional):**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",  // Optional: disconnect specific device
    "device_name": "Skelly Speaker",  // Optional: find device by name
    "all": true  // Optional: explicitly disconnect all (default behavior)
}
```

**Response:**
```json
{
    "success": true,
    "connected": false
}
```

### GET /status
Get comprehensive status information.

**Response:**
```json
{
    "bluetooth": {
        "connected": true,
        "device_name": "Skelly Speaker",
        "mac": "AA:BB:CC:DD:EE:FF"
    },
    "audio": {
        "is_playing": true,
        "current_file": "/path/to/audio.wav"
    }
}
```

### GET /health
Simple health check endpoint.

**Response:**
```json
{
    "status": "ok"
}
```

## Usage Examples

### Connect to device by name:
```bash
curl -X POST http://localhost:8765/connect_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'
```

### Connect to device by MAC:
```bash
curl -X POST http://localhost:8765/connect_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF", "pin": "1234"}'
```

### Upload and play audio on specific device:
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

### Upload and play audio on all devices:
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "all=true"
```

### Play audio from file path (legacy):
```bash
curl -X POST http://localhost:8765/play_filename \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/spooky_sound.wav", "mac": "AA:BB:CC:DD:EE:FF"}'
```

### Stop playback on specific device:
```bash
curl -X POST http://localhost:8765/stop \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### Stop playback on all devices:
```bash
curl -X POST http://localhost:8765/stop
```

### Get status:
```bash
curl http://localhost:8765/status
```

### Disconnect specific device:
```bash
curl -X POST http://localhost:8765/disconnect \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### Disconnect all devices:
```bash
curl -X POST http://localhost:8765/disconnect
```

## Architecture

The server consists of three main components:

1. **server.py**: Main REST API server using aiohttp
2. **bluetooth_manager.py**: Manages Bluetooth connections using bluetoothctl
3. **audio_player.py**: Manages audio playback using pw-play

## Running as a Service

You can run this as a systemd service for automatic startup. Create `/etc/systemd/system/skelly-ultra-server.service`:

```ini
[Unit]
Description=Skelly Ultra REST Server
After=network.target bluetooth.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/custom_components/skelly_ultra
ExecStart=/usr/bin/python3 -m skelly_ultra_srv.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable skelly-ultra-server
sudo systemctl start skelly-ultra-server
```

## Logging

The server logs to stdout with INFO level by default. You can adjust the logging level by modifying the `main()` function in `server.py`.

## Notes

- The server uses bluetoothctl in interactive mode to handle pairing and connections
- Audio playback uses PipeWire's pw-play command
- The server is designed to run outside of the Home Assistant container to have direct access to the host's Bluetooth stack
- Only .wav files are supported for audio playback
