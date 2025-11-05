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

**Important**: When using a Raspberry Pi to run the server it is *highly* recommended to use a dedicated Bluetooth USB dongle. The built-in Bluetooth controller usually has problems to stream audio to a classic Bluetooth speaker device like the Ultra Skelly, resulting in very choppy playback. I've successfully used the TP-Link UB500 Plus.

## ⚙️ Installation

### 1. Install System and Pytthon Dependencies

```bash
# On Debian/Ubuntu
sudo apt-get update
sudo apt-get install bluez pipewire-bin python3-pip

# On Fedora
sudo dnf install bluez pipewire-utils python3-pip
```

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
pip3 install -r requirements.txt
```

### 2. Docker Installation (Alternative)

If you prefer containerized deployment, you can use Docker:

#### 🐳 Build the Docker Image

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
docker build -t skelly-ultra-server .
```

After building the image, see [Option 5: Using Docker](#-option-5-using-docker-containerized-deployment) in the Running the Server section below.

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

### 🐳 Option 5: Using Docker (containerized deployment)

Run the server in a Docker container. First, [build the Docker image](#-build-the-docker-image) if you haven't already.

**Using docker run:**
```bash
docker run -d \
  --name skelly-ultra-server \
  --privileged \
  --network host \
  -v /var/run/dbus:/var/run/dbus \
  -v /run/dbus:/run/dbus \
  --restart unless-stopped \
  skelly-ultra-server
```

**Using docker-compose (recommended):**
```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

**Important Docker notes:**
- `--privileged` flag is **required** for Bluetooth hardware access
- `--network host` is **required** for Bluetooth device discovery
- D-Bus socket mounts (`/var/run/dbus`, `/run/dbus`) are **required** for automated pairing
- The host system must have a working Bluetooth adapter
- Automated pairing works because the container runs as root by default

**Monitor Docker container:**
```bash
# View logs
docker logs -f skelly-ultra-server

# Check status
docker ps | grep skelly-ultra-server

# Enter container for debugging
docker exec -it skelly-ultra-server /bin/bash

# Restart container
docker restart skelly-ultra-server
```

## 🔐 Important: Bluetooth Pairing

### Automated Pairing (Recommended)

The server supports **automated pairing using D-Bus** via the `/pair_and_trust_by_name` and `/pair_and_trust_by_mac` endpoints. The server automatically handles privilege elevation when needed for pairing operations.

**✨ Key Features:**
- ✅ Server runs as regular user (for PipeWire/audio access)
- ✅ Automatically uses `sudo` only when pairing/trusting devices
- ✅ Fully automated PIN entry via D-Bus
- ✅ No manual intervention needed

#### Setup: Configure Sudo for Pairing (One-time)

**Check if you need this step:**

First, test if you already have passwordless sudo:
```bash
sudo -l
```

If you see `(ALL) NOPASSWD: ALL` or similar, you can **skip this setup** - your system already allows passwordless sudo. This is common on:
- **Raspberry Pi OS** (default `pi` user configuration)
- Systems where you're in the `wheel` or `admin` group with NOPASSWD
- Development environments with relaxed sudo policies

**If sudo prompts for a password**, configure passwordless sudo for the Python executable:

1. **Add to sudoers**:
   ```bash
   sudo visudo -f /etc/sudoers.d/skelly-ultra-server
   ```

2. **Add this line** (replace `your_username` with your actual username):
   ```
   your_username ALL=(ALL) NOPASSWD: /usr/bin/python3
   ```

3. **Save and exit** (Ctrl+X, then Y, then Enter)

**Note:** This configuration only grants passwordless access to the Python executable, not all commands. If you already have broader sudo access (like on Raspberry Pi OS), this explicit rule is redundant but harmless.

#### Running the Server

Simply run as your regular user:
```bash
python3 -m skelly_ultra_srv.server
```

**How it works:**
1. Server runs as your user → ✅ PipeWire audio works perfectly
2. When pairing needed → Automatically uses `sudo` for that operation only
3. After pairing completes → Returns to user context
4. Audio playback continues → ✅ Uses your user's PipeWire session

#### Pairing Usage

**Pair by device name:**
```bash
curl -X POST http://localhost:8765/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'
```

**Pair by MAC address:**
```bash
curl -X POST http://localhost:8765/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF", "pin": "1234"}'
```

**After pairing once, the device can connect/disconnect automatically without sudo.**

#### Requirements

- Python package: `pydbus` (included in requirements.txt)
- Sudo access for pairing (configured above)
- Device must be in pairing mode and within range. Pairing mode is automatically enabled by the HA integration if called from it. See the HA integration service `skelly_ultra.enable_classic_bt`.

### Manual Pairing (Fallback)

If you cannot configure sudo, you can pair manually:

#### Option 1: Use the helper script
```bash
chmod +x pair_device.sh
./pair_device.sh <MAC_ADDRESS> <PIN>
# Example: ./pair_device.sh F5:A1:BC:80:63:EC 8947
```

#### Option 2: Manual pairing with bluetoothctl
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

**After pairing once (either method), the REST API can connect/disconnect automatically without root.**

## 🌐 API Endpoints

### 🔐 POST /pair_and_trust_by_name
**Automatically pair and trust a Bluetooth device by name using D-Bus agent.**

**✨ Auto-elevates with sudo when needed** - Server can run as regular user

This endpoint discovers the device by name, then uses a D-Bus agent to handle PIN code requests automatically, eliminating the need for manual pairing through `bluetoothctl`. If the server is not running as root and the device is not already paired, it will automatically use `sudo` to elevate privileges only for the pairing operation.

**Request Body:**
```json
{
    "device_name": "Skelly Speaker",
    "pin": "1234",
    "timeout": 30
}
```

**Parameters:**
- `device_name` (required): Name of the Bluetooth device to pair
- `pin` (required): PIN code for pairing
- `timeout` (optional): Maximum time to wait for pairing, default 30 seconds

**Response (success):**
```json
{
    "success": true,
    "paired": true,
    "trusted": true,
    "device_name": "Skelly Speaker",
    "mac": "AA:BB:CC:DD:EE:FF"
}
```

**Response (device not found):**
```json
{
    "success": false,
    "error": "Could not find device with name: Skelly Speaker"
}
```

**Status Codes:**
- `200`: Pairing successful
- `403`: Not running as root, no sudo available, and device not paired
- `503`: D-Bus not available or device not found
- `400`: Invalid request or pairing failed

**Note:** If not running as root, the server will automatically attempt to use `sudo` for pairing. Ensure your user has sudo privileges (preferably passwordless for automation).

**Example:**
```bash
# Pair device by name with PIN
curl -X POST http://localhost:8765/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "8947"}'

# With custom timeout
curl -X POST http://localhost:8765/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "8947", "timeout": 60}'
```

### � POST /pair_and_trust_by_mac
**Automatically pair and trust a Bluetooth device by MAC address using D-Bus agent.**

**⚠️ Requires root privileges** - Server must be started with `sudo`

This endpoint uses a D-Bus agent to handle PIN code requests automatically, eliminating the need for manual pairing through `bluetoothctl`.

**Request Body:**
```json
{
    "mac": "AA:BB:CC:DD:EE:FF",
    "pin": "1234",
    "timeout": 30
}
```

**Parameters:**
- `mac` (required): MAC address of the device to pair
- `pin` (required): PIN code for pairing
- `timeout` (optional): Maximum time to wait for pairing, default 30 seconds

**Response (success):**
```json
{
    "success": true,
    "paired": true,
    "trusted": true,
    "mac": "AA:BB:CC:DD:EE:FF"
}
```

**Response (not root, device not paired):**
```json
{
    "success": false,
    "error": "Pairing requires root privileges. Device AA:BB:CC:DD:EE:FF is not paired. Run this server as root (e.g., sudo python server.py) or manually pair the device first: bluetoothctl -> pair AA:BB:CC:DD:EE:FF -> enter PIN: 1234"
}
```

**Response (already paired):**
```json
{
    "success": true,
    "paired": true,
    "trusted": true,
    "mac": "AA:BB:CC:DD:EE:FF"
}
```

**Status Codes:**
- `200`: Pairing successful
- `403`: Not running as root and device not paired
- `503`: D-Bus not available or device not found
- `400`: Invalid request or pairing failed

**Example:**
```bash
# Pair device with PIN
curl -X POST http://localhost:8765/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "8947"}'

# With custom timeout
curl -X POST http://localhost:8765/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "8947", "timeout": 60}'
```

**Notes:**
- First time pairing requires root to register D-Bus agent
- Once paired, device can be connected without root using `/connect_by_mac`
- Device will be automatically trusted after successful pairing
- If device is already paired, trusts it and returns success (no root needed)

### �🔗 POST /connect_by_name
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

### � Pair and trust device (automated):
```bash
# Start server as root
sudo python3 run_server.py

# Pair device with PIN
curl -X POST http://localhost:8765/pair_and_trust \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "8947"}'

# After pairing, can connect without root
curl -X POST http://localhost:8765/connect_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "8947"}'
```

### �🔗 Connect to device by name:
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
- List available audio devices: `pw-cli list-objects | grep node.name`. You should see a device called `bluez_output.AA_BB_CC_DD_EE_FF.1` or similar with the MAC address of the Skelly live speaker.
- Test pw-play directly: `pw-play --target AA:BB:CC:DD:EE:FF /path/to/test.wav` where `AA:BB:CC:DD:EE:FF` should be replaced with the MAC address of your Skelly live speaker.
- Check that certain packages that often conflict with pipewire's ability to use Bluetooth speakers. Remove them via `sudo apt purge`. In particular:
  - bluez-alsa-utils
  - libasound2-plugin-bluez
  - pulseaudio
  - pulseaudio-utils

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
