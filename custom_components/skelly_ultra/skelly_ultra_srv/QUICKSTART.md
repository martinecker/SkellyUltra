# Skelly Ultra REST Server - Quick Start Guide

## Overview

The Skelly Ultra REST server provides a REST API to manage Bluetooth Classic audio device connections and playback for the Skelly Ultra Halloween animatronic. This solves the problem of managing Bluetooth Classic devices from within Home Assistant containers.

## Installation

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

## Running the Server

### Option 1: Using the provided run script

```bash
cd /path/to/custom_components/skelly_ultra/skelly_ultra_srv
python3 run_server.py
```

### Option 2: Using the server module directly

```bash
cd /path/to/custom_components/skelly_ultra
python3 -m skelly_ultra_srv.server
```

### Option 3: As a systemd service (recommended for production)

Create `/etc/systemd/system/skelly-ultra-server.service`:

```ini
[Unit]
Description=Skelly Ultra REST Server
After=network.target bluetooth.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/custom_components/skelly_ultra
ExecStart=/usr/bin/python3 -m skelly_ultra_srv.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable skelly-ultra-server
sudo systemctl start skelly-ultra-server
sudo systemctl status skelly-ultra-server
```

## Testing the Server

### Basic connectivity test:

```bash
curl http://localhost:8765/health
# Expected: {"status": "ok"}
```

### Check status:

```bash
curl http://localhost:8765/status
```

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

### Upload and play audio file on a specific device (by MAC):

```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "mac=AA:BB:CC:DD:EE:FF"
```

### Upload and play audio file on a specific device (by name):

```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "device_name=Skelly Speaker"
```

### Upload and play audio file on all connected devices:

```bash
curl -X POST http://localhost:8765/play \
  -F "file=@/path/to/audio.wav" \
  -F "all=true"
```

### Play audio from file path (legacy method):

```bash
curl -X POST http://localhost:8765/play_filename \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/audio.wav", "mac": "AA:BB:CC:DD:EE:FF"}'
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

## Troubleshooting

Running the server with `python3 run_server.py --verbose` runs with debug logging on and may give more hints as to what's wrong.

### Server won't start
- Check if port 8765 is already in use: `sudo netstat -tulpn | grep 8765`
- Check if bluetoothctl is available: `which bluetoothctl`
- Check if pw-play is available: `which pw-play`

### Can't connect to Bluetooth device
- Make sure Bluetooth is powered on: `bluetoothctl power on`
- Try scanning manually first: `bluetoothctl scan on`
- Check if device is already paired: `bluetoothctl devices`
- If device is already paired, try removing it first: `bluetoothctl remove AA:BB:CC:DD:EE:FF`

### Audio playback not working
- Check PipeWire is running: `systemctl --user status pipewire`
- List available audio devices: `pw-cli list-objects | grep node.name`
- Test pw-play directly: `pw-play /path/to/test.wav`

### Permission issues
- Make sure your user is in the `bluetooth` group: `sudo usermod -aG bluetooth $USER`
- Log out and back in for group changes to take effect

## Logs

When running directly, logs will appear in stdout. When running as a systemd service:

```bash
# View logs
sudo journalctl -u skelly-ultra-server -f

# View last 100 lines
sudo journalctl -u skelly-ultra-server -n 100

# View logs since boot
sudo journalctl -u skelly-ultra-server -b
```

## Default Configuration

- **Host**: `0.0.0.0` (all interfaces)
- **Port**: `8765`
- **Default PIN**: `0000` (if not specified)
- **Scan timeout**: 5 seconds
- **Connection timeout**: 30 seconds

These can be modified in the `SkellyUltraServer` class initialization.
