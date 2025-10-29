# Skelly Ultra Integration

Home Assistant integration for the Skelly Ultra Halloween animatronic BLE device.

## Features

- **Sensor entities**: Volume, live name, storage capacity, sound count
- **Light entities**: RGB lighting control for multiple channels
- **Switch entities**: Live Mode (enables classic Bluetooth speaker)
- **Number entities**: Volume control, light speed/brightness
- **Select entities**: Eye icon selection
- **Image entities**: Eye icon preview
- **Media Player entity**: Play audio to the device's Bluetooth speaker (when Live Mode is enabled)
  - Automatic pairing with PIN support
  - Automatic connection management

## Installation

### Prerequisites

#### For Media Player (Audio Playback)

The media player entity requires PipeWire/PulseAudio utilities to play audio through the Bluetooth speaker. These are **optional** - all other features work without them.

#### Bluetooth Pairing

The integration automatically handles pairing and connecting to the Bluetooth speaker. If your device uses a different PIN than the default "0000", you can modify it in `media_player.py`:

```python
# Near the top of the file
DEFAULT_BT_PIN = "8947"  # Change this if your device uses a different PIN
```

**Home Assistant OS / Supervised**:
- Audio tools should be pre-installed on the host system

**Home Assistant Container**:
You need to install PipeWire in your container environment. Choose one of these options:

**Option 1: Custom Docker Image (Recommended)**

Create a custom Dockerfile:

```dockerfile
FROM homeassistant/home-assistant:latest

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    pipewire-pulse \
    libspa-0.2-bluetooth \
    pulseaudio-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

Build and run:
```bash
docker build -t ha-custom .
docker run -d --name homeassistant --privileged --restart=unless-stopped \
  -v /path/to/config:/config \
  -v /run/dbus:/run/dbus:ro \
  -v /run/user/1000:/run/user/1000:ro \
  --network=host \
  -e XDG_RUNTIME_DIR=/run/user/1000 \
  ha-custom
```

**Option 2: Docker Compose**

```yaml
version: '3'
services:
  homeassistant:
    image: homeassistant/home-assistant:latest
    container_name: homeassistant
    privileged: true
    restart: unless-stopped
    environment:
      - TZ=America/New_York
      - XDG_RUNTIME_DIR=/run/user/1000
    volumes:
      - ./config:/config
      - /etc/localtime:/etc/localtime:ro
      - /run/dbus:/run/dbus:ro
      - /run/user/1000:/run/user/1000:ro
    network_mode: host
    # Install audio tools on container start
    entrypoint: >
      sh -c "apt-get update &&
             apt-get install -y --no-install-recommends
             pipewire-pulse libspa-0.2-bluetooth pulseaudio-utils &&
             apt-get clean && rm -rf /var/lib/apt/lists/* &&
             exec python -m homeassistant --config /config"
```

**Important**: Make sure to mount:
- `/run/dbus` for Bluetooth access via BlueZ
- `/run/user/1000` for PipeWire/PulseAudio audio routing (adjust `1000` to your host user's UID)
- Set `XDG_RUNTIME_DIR` environment variable

**Home Assistant Core**:
Install PipeWire on your system:

```bash
# Debian/Ubuntu
sudo apt-get install pipewire-pulse libspa-0.2-bluetooth pulseaudio-utils

# Fedora
sudo dnf install pipewire-pulseaudio pipewire-plugin-bluez

# Arch
sudo pacman -S pipewire pipewire-pulse
```

## Setup

1. **Copy integration files** to `<config>/custom_components/skelly_ultra/`

2. **Add the integration**:
   - Go to Settings → Devices & Services
   - Click "+ Add Integration"
   - Search for "Skelly Ultra"
   - Enter the Bluetooth MAC address (or leave blank for auto-discovery)

3. **Enable Live Mode** (for audio playback):
   - Turn on the "Live Mode" switch entity
   - The integration will automatically:
     - Enable classic Bluetooth on the device
     - Scan for and discover the Bluetooth speaker
     - Pair with the speaker using the PIN (default "0000")
     - Trust and connect to the speaker
   - The Media Player entity will become available once connected

## Using the Media Player

Once Live Mode is enabled and the Bluetooth speaker is connected, you can play local audio files:

```yaml
service: media_player.play_media
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker
data:
  media_content_type: music
  media_content_id: /config/www/sounds/my_audio.wav
```

**Notes**:
- Audio files must be accessible from the Home Assistant container
- WAV format is recommended
- The integration automatically handles pairing, trusting, and connecting the Bluetooth device
- First connection may take 30+ seconds as it scans and pairs

## Troubleshooting

### Media Player shows "Unavailable"
- Ensure Live Mode switch is turned ON
- Check that the classic Bluetooth device is connected
- Verify `bluetoothctl devices` shows the device
- Wait a moment after enabling Live Mode for auto-pairing to complete

### Audio playback fails with "Host is down"
- Ensure PipeWire is installed and running
- Check `XDG_RUNTIME_DIR` is set correctly
- Verify `/run/user/UID` is mounted in the container

### "pw-play command not found"
- Install the `pipewire-pulse` package (see Prerequisites above)
- Restart Home Assistant after installation

### Bluetooth pairing/connection issues
- Ensure the container has access to `/run/dbus`
- Check that `bluetoothctl` is available in the container
- If pairing fails, try manually removing the device first: `bluetoothctl remove <MAC>`
- Check logs for detailed pairing output
- Verify the PIN matches your device (default is "0000", change in `client.py` if different)
- Run with `--privileged` or proper capabilities
- Check system logs: `journalctl -u bluetooth`

## Development

For development in VS Code devcontainer, the required packages are automatically installed via `.devcontainer/devcontainer.json`.

## License

This integration is provided as-is for use with Skelly Ultra devices.
