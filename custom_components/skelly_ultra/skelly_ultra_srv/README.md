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

The server can also act as a BLE proxy to control the BLE device in on or more Skelly devices. It can:

- Forward raw BLE command bytes sent from clients to the Skelly.
- Receive and buffer raw notification bytes from the Skelly that can be polled by clients.

For details see the [🔷 BLE Proxy Endpoints](#-ble-proxy-endpoints)

**Note**: The BLE proxy functionality works on Windows, Linux, and other platforms. However, the Bluetooth Classic A2DP speaker endpoints require a Linux-based system due to dependencies on command line tools like `bluetoothctl` that are only available there.

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

To install the Python dependencies, which are specified in `pyproject.toml`, simply run `pip`:

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
pip3 install .
```

On some Linux distributions you may instead have to manually install these dependencies via `sudo apt-get` using distribution-provided packages.
These will often have a `python3-` prefix followed by the package name, for example:

```bash
sudo apt-get install python3-pydbus
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
# Replace 1000 with your user ID (run 'id -u' to find it)
docker run -d \
  --name skelly-ultra-server \
  --privileged \
  --network host \
  -v /var/run/dbus:/var/run/dbus \
  -v /run/dbus:/run/dbus \
  -v /run/user/1000/pipewire-0:/run/user/0/pipewire-0 \
  -e XDG_RUNTIME_DIR=/run/user/0 \
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
- PipeWire socket mount is **required** for audio playback (see docker-compose.yml)
- The host system must have a working Bluetooth adapter and PipeWire running
- Automated pairing works because the container runs as root by default
- **Important**: Update the PipeWire volume mount in docker-compose.yml with your user ID (run `id -u`)

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
curl -X POST http://localhost:8765/classic/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'
```

**Pair by MAC address:**

```bash
curl -X POST http://localhost:8765/classic/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF", "pin": "1234"}'
```

**After pairing once, the device can connect/disconnect automatically without sudo.**

#### Requirements

- Python package: `pydbus` (included in `pyproject.toml`)
- Sudo access for pairing (configured above)
- Device must be in pairing mode and within range. Pairing mode is automatically enabled by the HA integration if called from it. See the HA integration service `skelly_ultra.enable_classic_bt`.

### Manual Pairing (Fallback)

If you cannot configure sudo, you can pair manually:

#### Option 1: Use the helper script

```bash
chmod +x pair_device.sh
./pair_device.sh <MAC_ADDRESS> <PIN>
# Example: ./pair_device.sh F5:A1:BC:80:63:EC 1234
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

### 📑 Endpoint Table of Contents

- [GET /health](#-get-health) - Health check

#### Bluetooth Classic Audio Endpoints

- [POST /classic/pair_and_trust_by_name](#-post-classicpair_and_trust_by_name) - Automatically pair and trust device by name
- [POST /classic/pair_and_trust_by_mac](#-post-classicpair_and_trust_by_mac) - Automatically pair and trust device by MAC
- [POST /classic/connect_by_name](#-post-classicconnect_by_name) - Connect to device by name
- [POST /classic/connect_by_mac](#-post-classicconnect_by_mac) - Connect to device by MAC
- [GET /classic/name](#-get-classicname) - Get connected device names
- [GET /classic/mac](#-get-classicmac) - Get connected device MACs
- [POST /classic/play](#️-post-classicplay) - Upload and play audio file
- [POST /classic/play_filename](#-post-classicplay_filename) - Play audio from file path
- [POST /classic/stop](#️-post-classicstop) - Stop audio playback
- [POST /classic/disconnect](#-post-classicdisconnect) - Disconnect Bluetooth device
- [GET /classic/status](#-get-classicstatus) - Get comprehensive status

#### BLE Proxy Endpoints (Remote BLE Control)

- [GET /ble/scan_devices](#-get-blescan_devices) - Scan for nearby BLE devices
- [POST /ble/connect](#-post-bleconnect) - Connect to BLE device and create session
- [POST /ble/send_command](#-post-blesend_command) - Send raw command bytes to BLE device
- [GET /ble/notifications](#-get-blenotifications) - Long-poll for raw BLE notifications
- [POST /ble/disconnect](#-post-bledisconnect) - Disconnect BLE session
- [GET /ble/sessions](#-get-blesessions) - List active BLE sessions

---


### ✅ GET /health

Simple health check endpoint.

**Response:**

```json
{
    "status": "ok"
}
```

### 🔐 POST /classic/pair_and_trust_by_name

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
curl -X POST http://localhost:8765/classic/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'

# With custom timeout
curl -X POST http://localhost:8765/classic/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234", "timeout": 60}'
```

### 🔐 POST /classic/pair_and_trust_by_mac

**Automatically pair and trust a Bluetooth device by MAC address using D-Bus agent.**

**✨ Auto-elevates with sudo when needed** - Server can run as regular user

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
    "error": "error message indicating pairing failure"
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
curl -X POST http://localhost:8765/classic/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "1234"}'

# With custom timeout
curl -X POST http://localhost:8765/classic/pair_and_trust_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "1234", "timeout": 60}'
```

**Notes:**

- First time pairing requires root to register D-Bus agent
- Once paired, device can be connected without root using `/classic/connect_by_mac`
- Device will be automatically trusted after successful pairing
- If device is already paired, trusts it and returns success (no root needed)

### 🔗 POST /classic/connect_by_name
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

### 🔗 POST /classic/connect_by_mac

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

### 📛 GET /classic/name

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
curl http://localhost:8765/classic/name

# Get specific device by MAC
curl "http://localhost:8765/classic/name?mac=AA:BB:CC:DD:EE:FF"
```

### 🔍 GET /classic/mac

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
curl http://localhost:8765/classic/mac

# Search for device by name
curl "http://localhost:8765/classic/mac?name=Skelly%20Speaker"
```

### ▶️ POST /classic/play

Upload and play an audio file through the connected device(s).

**Request:** multipart/form-data with the following fields:

- `file`: The audio file (required)
- `mac`: Optional single target device MAC address
- `device_name`: Optional device name to look up
- `macs`: Optional JSON array of MAC addresses for multiple targets
- `all`: Optional "true" to play on all connected devices

**Example (single device by MAC):**

```bash
curl -X POST http://localhost:8765/classic/play \
  -F "file=@/path/to/audio.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

**Example (by device name):**

```bash
curl -X POST http://localhost:8765/classic/play \
  -F "file=@/path/to/audio.wav" \
  -F "device_name=Skelly Speaker"
```

**Example (all devices):**

```bash
curl -X POST http://localhost:8765/classic/play \
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

### 🎵 POST /classic/play_filename

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

### ⏹️ POST /classic/stop

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

### 🔌 POST /classic/disconnect

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

### 📊 GET /classic/status

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

---

## 🔷 BLE Proxy Endpoints

These endpoints enable remote BLE communication, allowing clients without BLE hardware to control Skelly Ultra devices through this server. The server acts as a BLE proxy, forwarding raw command bytes and buffering raw notification bytes.

**Use Case:** Run this server on a machine with BLE hardware (e.g., Raspberry Pi), and control devices from Home Assistant running in a container or on a different machine.

### 🔍 GET /ble/scan_devices

**Scan for nearby BLE devices.**

Discovers Bluetooth Low Energy devices within range. Useful for finding device MAC addresses or verifying devices are visible to the server.

**Query Parameters:**

- `name_filter` (optional): Filter devices by name (case-insensitive substring match)
- `timeout` (optional): Scan duration in seconds. Default: 10.0

**Response (success):**

```json
{
    "success": true,
    "devices": [
        {
            "name": "Animated Skelly",
            "address": "F5:A1:BC:26:B0:86",
            "rssi": -45
        },
        {
            "name": "Another BLE Device",
            "address": "AA:BB:CC:DD:EE:FF",
            "rssi": -67
        }
    ],
    "count": 2
}
```

**Response (failure):**
```json
{
    "success": false,
    "error": "Scan error message"
}
```

**Status Codes:**

- `200`: Scan successful
- `400`: Invalid parameters
- `500`: Internal server error

**Example:**

```bash
# Scan for all BLE devices (10 second scan)
curl "http://localhost:8765/ble/scan_devices"

# Scan for devices with "Skelly" in the name
curl "http://localhost:8765/ble/scan_devices?name_filter=Skelly"

# Quick 5-second scan
curl "http://localhost:8765/ble/scan_devices?timeout=5.0"

# Scan for devices matching "Animated" with custom timeout
curl "http://localhost:8765/ble/scan_devices?name_filter=Animated&timeout=15.0"

# Pretty print with jq
curl -s "http://localhost:8765/ble/scan_devices?name_filter=Skelly" | jq
```

**Notes:**

- Devices must be powered on and advertising to be discovered
- RSSI (signal strength) indicates proximity (-30 is very close, -90 is far)
- Longer timeouts may discover more devices but take more time
- Use `name_filter` to reduce results and speed up discovery
- Returns empty list if no devices match the filter

**Use Cases:**

- Find your Skelly's MAC address if unknown
- Verify Skelly is advertising and visible to the server
- Debug BLE connectivity issues
- Discover multiple Skelly devices in range
- Monitor BLE device availability

### 🔗 POST /ble/connect

**Connect to a BLE device and create a proxy session.**

This endpoint discovers and connects to a Skelly Ultra BLE device, then creates a session for sending commands and receiving notifications.

**Request Body:**

```json
{
    "address": "AA:BB:CC:DD:EE:FF",  // Optional: specific MAC address
    "name_filter": "Animated Skelly",  // Optional: device name filter (default: "Animated Skelly")
    "timeout": 10.0  // Optional: discovery timeout in seconds (default: 10.0)
}
```

**Parameters:**

- `address` (optional): BLE device MAC address. If provided, connects directly to this address.
- `name_filter` (optional): Device name substring for discovery. Default is "Animated Skelly".
- `timeout` (optional): Maximum time to wait for device discovery. Default is 10 seconds.

**Response (success):**

```json
{
    "success": true,
    "session_id": "sess-abc12345",
    "address": "AA:BB:CC:DD:EE:FF"
}
```

**Response (failure):**

```json
{
    "success": false,
    "error": "Device not found: Animated Skelly"
}
```

**Status Codes:**

- `200`: Connection successful
- `400`: Invalid request or device not found
- `500`: Internal server error

**Example:**

```bash
# Connect by name filter
curl -X POST http://localhost:8765/ble/connect \
  -H "Content-Type: application/json" \
  -d '{"name_filter": "Animated Skelly"}'

# Connect by specific address
curl -X POST http://localhost:8765/ble/connect \
  -H "Content-Type: application/json" \
  -d '{"address": "AA:BB:CC:DD:EE:FF"}'

# Connect with custom timeout
curl -X POST http://localhost:8765/ble/connect \
  -H "Content-Type: application/json" \
  -d '{"name_filter": "Animated Skelly", "timeout": 20.0}'
```

**Notes:**

- Save the returned `session_id` for subsequent requests
- Each session maintains its own notification buffer
- Sessions automatically timeout after 5 minutes of inactivity

### 📤 POST /ble/send_command

**Send raw command bytes to the BLE device.**

Sends command bytes (as hex string) to the connected BLE device. The server forwards bytes directly without parsing.

**Request Body:**

```json
{
    "session_id": "sess-abc12345",  // Optional if only one session exists
    "command": "AA E0 00 00 E0"  // Required: hex string (spaces optional)
}
```

**Parameters:**

- `session_id` (optional): Session identifier. If omitted and only one session exists, that session is used automatically.
- `command` (required): Command bytes as hex string. Spaces are optional and will be removed.

**Response (success):**
```json
{
    "success": true
}
```

**Response (failure):**
```json
{
    "success": false,
    "error": "Invalid session_id: sess-xyz"
}
```

**Status Codes:**

- `200`: Command sent successfully
- `400`: Invalid request (bad hex string, missing session_id when multiple sessions, etc.)
- `500`: Internal server error

**Example:**

```bash
# Send command with session ID
curl -X POST http://localhost:8765/ble/send_command \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-abc12345", "command": "AA E0 00 00 E0"}'

# Send command (auto-select if only one session)
curl -X POST http://localhost:8765/ble/send_command \
  -H "Content-Type: application/json" \
  -d '{"command": "AAE00000E0"}'

# Query device volume
curl -X POST http://localhost:8765/ble/send_command \
  -H "Content-Type: application/json" \
  -d '{"command": "AA E3 00 00 E3"}'
```

**Notes:**

- Hex string can have spaces or be continuous: `"AA E0"` and `"AAE0"` are equivalent
- Commands are forwarded as raw bytes - no validation or parsing
- Response notifications are buffered and retrieved via `/ble/notifications`

### 📥 GET /ble/notifications

**Long-poll for raw BLE notifications.**

Retrieves buffered BLE notifications as raw bytes (hex strings). This endpoint uses long-polling: if no notifications are available, the connection is held open until notifications arrive or the timeout expires.

**Query Parameters:**

- `session_id` (optional): Session identifier. If omitted and only one session exists, that session is used.
- `since` (optional): Last sequence number received. Only notifications with higher sequence numbers are returned. Default: 0.
- `timeout` (optional): Maximum time to wait for notifications in seconds. Default: 30.0.

**Response (with notifications):**

```json
{
    "notifications": [
        {
            "sequence": 1,
            "timestamp": "2025-11-14T10:30:00.123456",
            "sender": "0000ffe1-0000-1000-8000-00805f9b34fb",
            "data": "BB E0 32 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 FF"
        },
        {
            "sequence": 2,
            "timestamp": "2025-11-14T10:30:00.234567",
            "sender": "0000ffe1-0000-1000-8000-00805f9b34fb",
            "data": "BB D1 00 00 00 01 61 75 64 69 6F 31 2E 6D 70 33 00 FF"
        }
    ],
    "next_sequence": 3,
    "has_more": false
}
```

**Response (no notifications - timeout):**

```json
{
    "notifications": [],
    "next_sequence": 5,
    "has_more": false
}
```

**Response (error):**

```json
{
    "notifications": [],
    "next_sequence": 0,
    "has_more": false,
    "error": "Invalid session_id: sess-xyz"
}
```

**Status Codes:**

- `200`: Success (may have empty notifications list if timeout)
- `400`: Invalid request
- `500`: Internal server error

**Example:**

```bash
# Initial poll (get all notifications)
curl "http://localhost:8765/ble/notifications?session_id=sess-abc12345&since=0&timeout=30"

# Poll for new notifications after receiving up to sequence 5
curl "http://localhost:8765/ble/notifications?session_id=sess-abc12345&since=5&timeout=30"

# Quick poll with short timeout
curl "http://localhost:8765/ble/notifications?session_id=sess-abc12345&since=10&timeout=5"

# Auto-select session (if only one exists)
curl "http://localhost:8765/ble/notifications?since=0&timeout=30"
```

**Notes:**

- **Long-polling behavior**: Connection stays open until notifications arrive or timeout
- Always use `next_sequence` from the response for the next poll
- `has_more=true` indicates buffered notifications are available (poll again immediately)
- Notifications are raw bytes (hex strings) - client must parse them
- Buffer holds up to 200 notifications per session
- Continuous polling maintains near real-time notification delivery

**Typical polling pattern:**

```bash
# 1. Initial poll
RESPONSE=$(curl -s "http://localhost:8765/ble/notifications?since=0&timeout=30")
NEXT=$(echo $RESPONSE | jq -r '.next_sequence')

# 2. Continuous polling loop
while true; do
    RESPONSE=$(curl -s "http://localhost:8765/ble/notifications?since=$NEXT&timeout=30")
    NEXT=$(echo $RESPONSE | jq -r '.next_sequence')
    # Process notifications...
done
```

### 🔌 POST /ble/disconnect

**Disconnect BLE session and cleanup.**

Cleanly disconnects from the BLE device and removes the session.

**Request Body:**

```json
{
    "session_id": "sess-abc12345"  // Optional if only one session exists
}
```

**Parameters:**

- `session_id` (optional): Session identifier to disconnect. If omitted and only one session exists, that session is disconnected.

**Response (success):**
```json
{
    "success": true
}
```

**Response (failure):**
```json
{
    "success": false,
    "error": "Invalid session_id: sess-xyz"
}
```

**Status Codes:**

- `200`: Disconnection successful
- `400`: Invalid request
- `500`: Internal server error

**Example:**

```bash
# Disconnect specific session
curl -X POST http://localhost:8765/ble/disconnect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-abc12345"}'

# Disconnect (auto-select if only one session)
curl -X POST http://localhost:8765/ble/disconnect \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Notes:**

- Session is completely removed and cannot be reused
- Buffered notifications are discarded
- Subsequent requests with that session_id will fail
- Sessions also auto-disconnect after 5 minutes of inactivity

### 📋 GET /ble/sessions

**List all active BLE sessions.**

Returns information about all currently active BLE proxy sessions.

**Response:**

```json
{
    "sessions": [
        {
            "session_id": "sess-abc12345",
            "address": "AA:BB:CC:DD:EE:FF",
            "created_at": "2025-11-14T10:00:00.000000",
            "last_activity": "2025-11-14T10:30:00.123456",
            "buffer_size": 5,
            "is_connected": true
        },
        {
            "session_id": "sess-xyz67890",
            "address": "BB:CC:DD:EE:FF:00",
            "created_at": "2025-11-14T10:15:00.000000",
            "last_activity": "2025-11-14T10:31:00.456789",
            "buffer_size": 0,
            "is_connected": true
        }
    ]
}
```

**Response fields:**

- `session_id`: Unique session identifier
- `address`: BLE device MAC address
- `created_at`: Session creation timestamp (ISO 8601)
- `last_activity`: Last activity timestamp (ISO 8601)
- `buffer_size`: Number of notifications currently buffered
- `is_connected`: Whether BLE device is still connected

**Status Codes:**
- `200`: Success
- `500`: Internal server error

**Example:**

```bash
# List all sessions
curl http://localhost:8765/ble/sessions

# Pretty print with jq
curl -s http://localhost:8765/ble/sessions | jq
```

**Notes:**

- Useful for monitoring and debugging
- Sessions with `last_activity` older than 5 minutes will be auto-cleaned
- `buffer_size` indicates how many notifications are waiting to be retrieved

---

## 💡 Usage Examples

### � Pair and trust device (automated):

```bash
# Start server
python3 run_server.py

# Pair device with PIN
curl -X POST http://localhost:8765/classic/pair_and_trust_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'

# After pairing, can connect without root
curl -X POST http://localhost:8765/classic/connect_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "F5:A1:BC:80:63:EC", "pin": "1234"}'
```

### 🔗 Connect to device by name:

```bash
curl -X POST http://localhost:8765/classic/connect_by_name \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Skelly Speaker", "pin": "1234"}'
```

### 🔗 Connect to device by MAC:

```bash
curl -X POST http://localhost:8765/classic/connect_by_mac \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF", "pin": "1234"}'
```

### ▶️ Upload and play audio on specific device:

```bash
curl -X POST http://localhost:8765/classic/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

### ▶️ Upload and play audio on all devices:

```bash
curl -X POST http://localhost:8765/classic/play \
  -F "file=@/path/to/spooky_sound.wav" \
  -F "all=true"
```

### 🎵 Play audio from file path (legacy):

```bash
curl -X POST http://localhost:8765/classic/play_filename \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/spooky_sound.wav", "mac": "AA:BB:CC:DD:EE:FF"}'
```

### ⏹️ Stop playback on specific device:

```bash
curl -X POST http://localhost:8765/classic/stop \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### ⏹️ Stop playback on all devices:

```bash
curl -X POST http://localhost:8765/classic/stop
```

### 📊 Get status:

```bash
curl http://localhost:8765/classic/status
```

### 🔌 Disconnect specific device:

```bash
curl -X POST http://localhost:8765/classic/disconnect \
  -H "Content-Type: application/json" \
  -d '{"mac": "AA:BB:CC:DD:EE:FF"}'
```

### 🔌 Disconnect all devices:

```bash
curl -X POST http://localhost:8765/classic/disconnect
```

### 🔷 Complete BLE proxy workflow:

```bash
# 1. Connect to BLE device
RESPONSE=$(curl -s -X POST http://localhost:8765/ble/connect \
  -H "Content-Type: application/json" \
  -d '{"name_filter": "Animated Skelly"}')
SESSION_ID=$(echo $RESPONSE | jq -r '.session_id')
echo "Connected with session: $SESSION_ID"

# 2. Start notification polling in background
(while true; do
  curl -s "http://localhost:8765/ble/notifications?session_id=$SESSION_ID&since=0&timeout=30" | \
    jq -r '.notifications[] | "[\(.sequence)] \(.data)"'
done) &
POLL_PID=$!

# 3. Send query commands
curl -X POST http://localhost:8765/ble/send_command \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"command\": \"AA E0 00 00 E0\"}"
sleep 1

curl -X POST http://localhost:8765/ble/send_command \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"command\": \"AA E3 00 00 E3\"}"
sleep 2

# 4. Check active sessions
curl -s http://localhost:8765/ble/sessions | jq

# 5. Cleanup
kill $POLL_PID
curl -X POST http://localhost:8765/ble/disconnect \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\"}"
```

### 🔷 Monitor BLE notifications in real-time:

```bash
# Start monitoring (run in separate terminal)
SESSION_ID="sess-abc12345"
SEQUENCE=0
while true; do
  RESPONSE=$(curl -s "http://localhost:8765/ble/notifications?session_id=$SESSION_ID&since=$SEQUENCE&timeout=30")
  echo "$RESPONSE" | jq -r '.notifications[] | "[\(.timestamp)] [\(.sequence)] \(.data)"'
  SEQUENCE=$(echo "$RESPONSE" | jq -r '.next_sequence')
done
```

## 🧪 Quick Testing

### ✅ Basic connectivity test:

```bash
curl http://localhost:8765/health
# Expected: {"status": "ok"}
```

### 📊 Check status:

```bash
curl http://localhost:8765/classic/status
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
