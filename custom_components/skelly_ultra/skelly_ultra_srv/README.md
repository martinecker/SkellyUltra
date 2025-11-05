# 🖥️ Skelly Ultra REST Server

A Python REST API server using aiohttp for managing Bluetooth Classic device connections and audio playback for the Home Depot Ultra Skelly Halloween animatronic.

## 📑 Table of Contents

- [📖 Overview](#-overview)
- [📋 Requirements](#-requirements)
- [⚙️ Installation](#️-installation)
- [🚀 Running the Server](#-running-the-server)
- [🔐 Important: Bluetooth Pairing](#-important-bluetooth-pairing)
- [🌐 API Endpoints](#-api-endpoints)
- [💡 Usage Examples](#-usage-examples)
- [🧪 Quick Testing](#-quick-testing)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [⚙️ Default Configuration](#️-default-configuration)
- [🏗️ Architecture](#️-architecture)
- [📝 Notes](#-notes)

## 📖 Overview

This server is designed to work around limitations of managing Bluetooth Classic audio devices from within Home Assistant containers. It provides a REST API interface to:
- 📡 Connect and pair with Bluetooth Classic devices (the speaker inside the Skelly animatronic)
- 🎵 Play audio files through connected devices
- 🔗 **Manage multiple device connections simultaneously** - connect to and control multiple Skelly devices at once

## 📋 Requirements

- 🐍 **Python 3.11+**
- 🌐 **aiohttp** (Python web framework)
- 📡 **bluetoothctl** (part of bluez - Bluetooth management)
- 🔊 **pw-play** (part of PipeWire - audio playback)

## ⚙️ Installation

### 1. Install System Dependencies

```bash
# On Debian/Ubuntu
sudo apt-get update
sudo apt-get install bluez pipewire-bin python3-pip

# On Fedora
sudo dnf install bluez pipewire-utils python3-pip
```

### 2. Install Python Dependencies

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
pip3 install -r requirements.txt
```

## 🚀 Running the Server

### ▶️ Option 1: Using the provided run script (easiest)

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
python3 run_server.py
```

For debug logging:
```bash
python3 run_server.py --verbose
```

### 🔧 Option 2: Using the server module directly

```bash
cd /path/to/custom_components/skelly_ultra
python3 -m skelly_ultra_srv.server
```

### 💻 Option 3: Programmatically

```python
from skelly_ultra_srv.server import SkellyUltraServer

server = SkellyUltraServer(host="0.0.0.0", port=8765)
server.run()
```

### 🔄 Option 4: As a systemd service (recommended for production)

A systemd service file is provided: `skelly-ultra-server.service`

1. Edit the service file to set your username and paths:
   ```bash
   nano skelly-ultra-server.service
   ```

2. Copy to systemd directory:
   ```bash
   sudo cp skelly-ultra-server.service /etc/systemd/system/
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable skelly-ultra-server
   sudo systemctl start skelly-ultra-server
   sudo systemctl status skelly-ultra-server
   ```

4. View logs:
   ```bash
   sudo journalctl -u skelly-ultra-server -f
   ```

## 🔐 Important: Bluetooth Pairing

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

## 🌐 API Endpoints

### 🔗 POST /connect_by_name
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

### 🔗 POST /connect_by_mac
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

### 📛 GET /name
Get the names of all connected devices, or query for a specific device by MAC address.

**Query Parameters:**
- `mac` (optional): MAC address to query a specific device

**Response (all devices):**
```json
{
    "devices": [
        {"name": "Skelly Speaker 1", "mac": "AA:BB:CC:DD:EE:FF"},
        {"name": "Skelly Speaker 2", "mac": "AA:BB:CC:DD:EE:FE"}
    ],
    "count": 2
}
```

**Response (specific device by MAC):**
```json
{
    "device_name": "Skelly Speaker",
    "mac": "AA:BB:CC:DD:EE:FF",
    "connected": true
}
```

**Example:**
```bash
# Get all connected devices
curl http://localhost:8765/name

# Get specific device by MAC
curl "http://localhost:8765/name?mac=AA:BB:CC:DD:EE:FF"
```

### 🔍 GET /mac
Get the MAC addresses of all connected devices, or search for a device by name.

**Query Parameters:**
- `name` (optional): Device name to search for

**Response (all devices):**
```json
{
    "devices": [
        {"name": "Skelly Speaker 1", "mac": "AA:BB:CC:DD:EE:FF"},
        {"name": "Skelly Speaker 2", "mac": "AA:BB:CC:DD:EE:FE"}
    ],
    "count": 2
}
```

**Response (specific device by name):**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",
    "device_name": "Skelly Speaker",
    "connected": true
}
```

**Example:**
```bash
# Get all connected devices
curl http://localhost:8765/mac

# Search for device by name
curl "http://localhost:8765/mac?name=Skelly%20Speaker"
```

### ▶️ POST /play
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

### 🎵 POST /play_filename
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

### ⏹️ POST /stop
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

### 🔌 POST /disconnect
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

### 📊 GET /status
Get comprehensive status information including all connected devices and their playback sessions.

**Response:**
```json
{
    "bluetooth": {
        "connected": true,
        "devices": [
            {
                "name": "Skelly Speaker",
                "mac": "AA:BB:CC:DD:EE:FF",
                "connected": true
            }
        ]
    },
    "audio": {
        "is_playing": true,
        "sessions": {
            "AA:BB:CC:DD:EE:FF": {
                "file": "/tmp/skelly_audio_xyz/audio.wav",
                "playing": true
            }
        }
    }
}
```

### ✅ GET /health
Simple health check endpoint.

**Response:**
```json
{
    "status": "ok"
}
```

## 💡 Usage Examples

### 🔗 Connect to device by name:
```bash
curl -X POST http://localhost:8765/connect_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'
```

### 🔗 Connect to device by MAC:
```bash
curl -X POST http://localhost:8765/connect_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF", "pin": "1234"}'
```

### ▶️ Upload and play audio on specific device:
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

### ▶️ Upload and play audio on all devices:
```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "all=true"
```

### 🎵 Play audio from file path (legacy):
```bash
curl -X POST http://localhost:8765/play_filename \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/spooky_sound.wav", "mac": "AA:BB:CC:DD:EE:FF"}'
```

### ⏹️ Stop playback on specific device:
```bash
curl -X POST http://localhost:8765/stop \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### ⏹️ Stop playback on all devices:
```bash
curl -X POST http://localhost:8765/stop
```

### 📊 Get status:
```bash
curl http://localhost:8765/status
```

### 🔌 Disconnect specific device:
```bash
curl -X POST http://localhost:8765/disconnect \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### 🔌 Disconnect all devices:
```bash
curl -X POST http://localhost:8765/disconnect
```

## 🧪 Quick Testing

### ✅ Basic connectivity test:

```bash
curl http://localhost:8765/health
# Expected: {"status": "ok"}
```

### 📊 Check status:

```bash
curl http://localhost:8765/status
```

## 🛠️ Troubleshooting

### ❌ Server won't start
- Check if port 8765 is already in use: `sudo netstat -tulpn | grep 8765`
- Check if bluetoothctl is available: `which bluetoothctl`
- Check if pw-play is available: `which pw-play`

### 📡 Can't connect to Bluetooth device
- Make sure Bluetooth is powered on: `bluetoothctl power on`
- Try scanning manually first: `bluetoothctl scan on`
- Check if device is already paired: `bluetoothctl devices`
- If device is already paired, try removing it first: `bluetoothctl remove AA:BB:CC:DD:EE:FF`

### 🔇 Audio playback not working
- Check PipeWire is running: `systemctl --user status pipewire`
- List available audio devices: `pw-cli list-objects | grep node.name`
- Test pw-play directly: `pw-play /path/to/test.wav`

### 🔐 Permission issues
- Make sure your user is in the `bluetooth` group: `sudo usermod -aG bluetooth $USER`
- Log out and back in for group changes to take effect

## ⚙️ Default Configuration

- **Host**: `0.0.0.0` (all interfaces)
- **Port**: `8765`
- **Default PIN**: `1234` (if not specified)
- **Scan timeout**: 5 seconds
- **Connection timeout**: 30 seconds

These can be modified in the `SkellyUltraServer` class initialization.

## 🏗️ Architecture

The server consists of three main components:

1. **server.py**: Main REST API server using aiohttp
2. **bluetooth_manager.py**: Manages Bluetooth connections using bluetoothctl
3. **audio_player.py**: Manages audio playback using pw-play (PipeWire)

## 📝 Notes

- The server uses bluetoothctl in interactive mode to handle pairing and connections
- Audio playback uses PipeWire's pw-play command for streaming
- The server is designed to run outside of the Home Assistant container to have direct access to the host's Bluetooth stack
- Multiple devices can be connected and controlled simultaneously
