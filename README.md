# Skelly Ultra Integration

Home Assistant integration for the Home Depot 6.5 ft Ultra Skelly Halloween animatronic BLE device.

## Features

- **Sensor entities**: Volume, live name, storage capacity, file count, file order
- **Light entities**: RGB lighting control for Torso and Head channels
- **Switch entities**:
  - Live Mode (enables classic Bluetooth speaker)
  - Color Cycle (rainbow effect for Torso and Head lights)
  - Movement controls (Head, Arm, Torso, and All body parts)
- **Number entities**: Volume control, effect speed (for Torso and Head)
- **Select entities**: Eye icon selection, effect mode (Static/Strobe/Pulse for Torso and Head)
- **Image entities**: Eye icon preview
- **Media Player entity**: Play audio to the device's Bluetooth speaker (when Live Mode is enabled)
  - Supports TTS (Text-to-Speech) services
  - Supports multiple audio formats (WAV, MP3, FLAC, OGG, etc.)
- **Services**: Play/stop individual files stored on the device, enable classic Bluetooth

## Prerequisites

### Required: Skelly Ultra REST Server

The Skelly Ultra REST server **must be running on a Linux host** (e.g., Raspberry Pi, Ubuntu server, etc.) that can connect to both:
1. Your Home Assistant instance (via network)
2. The Skelly Ultra device via Bluetooth

The REST server handles:
- Classic Bluetooth pairing and connections for Live Mode audio playback
- Audio processing and streaming to the Skelly Ultra speaker

**Important**: The REST server requires `pipewire`, `bluetoothctl`, and related audio tools on the Linux host where it runs.

For installation and setup of the REST server, see the [REST Server Documentation](custom_components/skelly_ultra/skelly_ultra_srv/README.md).

### Live Mode Bluetooth Pairing

**Live Mode uses Classic Bluetooth**, which requires manual, interactive pairing:

#### Step 1: Make the Bluetooth Speaker Discoverable

The Skelly Ultra device only makes its Classic Bluetooth speaker discoverable after you tell it to enable Live Mode:

1. **First, add the integration in Home Assistant** (see Installation section below)
2. **Turn on the "Live Mode" switch** in Home Assistant
   - This tells the Skelly device to enable its Bluetooth speaker
   - The switch will likely turn off again because pairing hasn't been completed yet - **this is expected**
   - Alternatively, you can call the `skelly_ultra.enable_classic_bt` service

The Skelly device will now be discoverable via Bluetooth as `<Device Name>(Live)`. For example, if your device is named "Animated Skelly" (the default), it will appear as **"Animated Skelly(Live)"**.

#### Step 2: Pair Using bluetoothctl

On the Linux host running the REST server, use `bluetoothctl` to pair with the device:

```bash
bluetoothctl
> scan on
# Wait for your device to appear as "Animated Skelly(Live)" or "<Your Device Name>(Live)"
> pair <MAC_ADDRESS>
# Enter PIN when prompted (default: 1234)
> trust <MAC_ADDRESS>
> exit
```

**Important notes**:
- Pairing only needs to be done **once per device**. The pairing will persist.
- You must enable Live Mode in HA first (even if it doesn't stay on) to make the speaker discoverable
- Look for the device name with **(Live)** suffix - this is the Classic Bluetooth speaker
- You can configure the PIN in the Home Assistant integration config flow (default: 1234)

**Why manual pairing?** Classic Bluetooth devices require interactive PIN entry during pairing. This is a limitation of the Bluetooth Classic protocol and cannot be automated by the integration.

## Installation

### Step 1: Install the Integration Files

Copy the integration files to your Home Assistant configuration directory:

```bash
# Copy to custom_components folder
cp -r skelly_ultra <config_directory>/custom_components/
```

Or use HACS and add https://github.com/martinecker/SkellyUltra as a custom repository, or manually download and extract to `<config>/custom_components/skelly_ultra/`.

### Step 2: Set Up the REST Server

Set up and start the Skelly Ultra REST server on your Linux host. See [skelly_ultra_srv/README.md](custom_components/skelly_ultra/skelly_ultra_srv/README.md) for detailed instructions.

### Step 3: Add the Integration in Home Assistant

1. **Restart Home Assistant** to load the custom component

2. **Add the integration**:
   - Go to **Settings** → **Devices & Services**
   - Click **"+ Add Integration"**
   - Search for **"Skelly Ultra"**
   - Choose configuration mode:
     - **Manual**: Enter the Bluetooth MAC address
     - **Scan**: Discover nearby Skelly devices automatically

3. **Configure connection settings**:
   - **REST server URL**: URL of the Skelly Ultra REST server (default: `http://localhost:8765`)
     - If the server is on a different host, use `http://<server-ip>:8765`
   - **Live Mode PIN**: Bluetooth PIN for pairing (default: 1234)
     - This is for reference only - actual pairing must be done manually via `bluetoothctl`

4. **Verify setup**:
   - The integration should show as "Connected"
   - Entities will be created for sensors, lights, switches, etc.

### Step 4: Enable Live Mode for Audio Playback

1. **Ensure Bluetooth pairing is complete** (see Prerequisites above)

2. **Turn on the "Live Mode" switch**:
   - This tells the Skelly device to enable its Classic Bluetooth speaker
   - The REST server will attempt to connect to the speaker

3. **Wait for connection** (may take 10-30 seconds):
   - The Media Player entity will become available once connected
   - Check the Live Mode switch - it should show as "On"

4. **Troubleshoot if needed**:
   - Check Home Assistant logs for error messages
   - Check REST server logs for connection details
   - Verify the device is paired and trusted in `bluetoothctl`

## Usage

### Available Entities

The integration creates the following entities:

- **Media Player** (`media_player.skelly_ultra_live_mode_speaker`):
  - Control audio playback when Live Mode is enabled
  - Supports volume control, play/pause, stop
  - Works with TTS (Text-to-Speech) services
  - Supports multiple audio formats (MP3, WAV, FLAC, OGG, M4A, etc.)

- **Sensors**: Monitor device status (mode, volume, battery, connection)
- **Switches**: Toggle Live Mode and other features
- **Lights**: Control LED patterns (if supported)

**Note about entity IDs**: The actual entity IDs in your Home Assistant instance will differ from the examples shown in this README. Entity IDs are generated based on:
1. The device name set in the Skelly Ultra mobile app (defaults to "Animated Skelly")
2. The device's Bluetooth MAC address (to support multiple Skelly devices)

For example, if your device is named "Animated Skelly" with MAC address `AA:BB:CC:DD:EE:FF`, the media player entity might be:
- `media_player.animated_skelly_aa_bb_cc_dd_ee_ff_live_mode_speaker`

You can find your actual entity IDs in **Settings** → **Devices & Services** → **Skelly Ultra** → click on your device.

### Playing Audio

> **Note**: In all examples below, replace `media_player.skelly_ultra_live_mode_speaker` with your actual media player entity ID (see note above about entity naming).

#### Using Text-to-Speech (TTS)

Make your Skelly speak using any TTS service:

```yaml
service: tts.google_translate_say
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker  # Replace with your actual entity ID
data:
  message: "Happy Halloween! Trick or treat!"
  language: "en"
```

Other TTS services also work:

```yaml
service: tts.cloud_say
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker  # Replace with your actual entity ID
data:
  message: "The front door is open"
```

#### Playing Media from URL

```yaml
service: media_player.play_media
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker
data:
  media_content_type: "music"
  media_content_id: "http://example.com/spooky-sound.mp3"
```

#### Playing Local Files

```yaml
service: media_player.play_media
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker
data:
  media_content_type: "music"
  media_content_id: "media-source://media_source/local/halloween_sounds.mp3"
```

Or using a file path accessible from the Home Assistant container:

```yaml
service: media_player.play_media
target:
  entity_id: media_player.skelly_ultra_live_mode_speaker
data:
  media_content_type: "music"
  media_content_id: "/config/www/sounds/my_audio.wav"
```

### Automation Examples

#### Announce When Someone Arrives

```yaml
automation:
  - alias: "Skelly Greets Visitors"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door
        to: "on"
    action:
      - service: tts.google_translate_say
        target:
          entity_id: media_player.skelly_ultra_live_mode_speaker
        data:
          message: "Welcome! Enter if you dare!"
```

#### Play Spooky Sounds at Sunset

```yaml
automation:
  - alias: "Skelly Sunset Sounds"
    trigger:
      - platform: sun
        event: sunset
    action:
      - service: media_player.play_media
        target:
          entity_id: media_player.skelly_ultra_live_mode_speaker
        data:
          media_content_type: "music"
          media_content_id: "media-source://media_source/local/spooky_ambience.mp3"
```

**Notes**:
- Supported audio formats: MP3, WAV, FLAC, OGG, M4A, and more
- The integration automatically handles connecting the Bluetooth speaker
- Pairing must be done manually via `bluetoothctl` (only needed once)
- First connection after enabling Live Mode may take 10-30 seconds

### Playing Files Stored on Device

The Skelly Ultra can store audio files on its internal storage. You can play or stop these files using the integration's services.

#### File Order Sensor

The **File Order** sensor shows the current playback order of files stored on the device as a list, for example: `[1, 2, 3, 4]`. This represents the order in which files will play.

#### Play File Service

Play a specific file from the device's internal storage:

```yaml
service: skelly_ultra.play_file
data:
  device_id: <device_id>  # Optional if you have only one device
  file_index: 1  # File index (1-based, must be ≥ 1)
```

Or using an entity ID instead of device ID:

```yaml
service: skelly_ultra.play_file
data:
  entity_id: sensor.skelly_ultra_volume  # Any entity from the device
  file_index: 2
```

#### Stop File Service

Stop a specific file that's currently playing:

```yaml
service: skelly_ultra.stop_file
data:
  device_id: <device_id>  # Optional if you have only one device
  file_index: 1  # File index (1-based, must be ≥ 1)
```

#### Automation Example: Play Different Files Based on Time

```yaml
automation:
  - alias: "Skelly Morning Greeting"
    trigger:
      - platform: time
        at: "09:00:00"
    action:
      - service: skelly_ultra.play_file
        data:
          file_index: 1  # Play the first stored file

  - alias: "Skelly Evening Sounds"
    trigger:
      - platform: time
        at: "18:00:00"
    action:
      - service: skelly_ultra.play_file
        data:
          file_index: 3  # Play the third stored file
```

**Notes**:
- File indices are 1-based (first file is index 1, not 0)
- The valid range is [1, N] where N is the number of files on the device
- Check the **File Count** sensor to see how many files are stored
- Check the **File Order** sensor to see the playback order
- If you have multiple Skelly devices, specify `device_id` or `entity_id`
- If you have only one device, these parameters can be omitted

## Troubleshooting

### Media Player Shows "Unavailable"

**Cause**: Live Mode is not enabled or the Bluetooth speaker is not connected.

**Solution**:
1. Turn on the **Live Mode switch** in Home Assistant
2. Wait 10-30 seconds for the connection to establish
3. Check Home Assistant logs for error messages
4. Verify the device is paired and trusted:
   ```bash
   bluetoothctl info <MAC_ADDRESS>
   ```
   - Look for `Paired: yes` and `Trusted: yes`

### "Device is NOT Paired" Error

**Cause**: The Skelly device has not been manually paired via Bluetooth.

**Solution**:
1. Pair the device manually (this only needs to be done once):
   ```bash
   bluetoothctl
   scan on
   # Wait for your device to appear
   pair <MAC_ADDRESS>
   # Enter PIN: 1234
   trust <MAC_ADDRESS>
   exit
   ```
2. Try enabling Live Mode again in Home Assistant

### Audio Playback Fails

**Symptom**: Media player accepts commands but no audio plays.

**Solution**:
1. **Check REST server logs** for PipeWire/Bluetooth errors
2. **Verify PipeWire is running** on the REST server host:
   ```bash
   systemctl --user status pipewire pipewire-pulse
   ```
3. **Test audio manually** on the REST server host:
   ```bash
   pw-play /path/to/test.wav
   ```
4. **Check Bluetooth connection** on the REST server host:
   ```bash
   bluetoothctl info <MAC_ADDRESS>
   # Look for "Connected: yes"
   ```

### REST Server Connection Fails

**Symptom**: Integration shows "Cannot connect to REST server" or similar error.

**Solution**:
1. **Verify the REST server is running**:
   ```bash
   curl http://localhost:8765/health
   ```
   - Should return `{"status": "ok"}`
2. **Check the REST server URL** in the integration configuration:
   - If on same host: `http://localhost:8765`
   - If on different host: `http://<server-ip>:8765`
3. **Check firewall rules** if the REST server is on a different host

### Bluetooth Connection Takes Too Long

**Symptom**: Live Mode switch takes 30+ seconds to turn on.

**Explanation**: Classic Bluetooth connections can take time, especially on first connect. This is normal behavior.

**Solutions**:
- Be patient and wait for the connection to establish
- Check REST server logs for progress
- If it fails, try disabling and re-enabling Live Mode

### Wrong PIN Error

**Symptom**: Cannot pair device, or pairing fails with authentication error.

**Solution**:
1. The default PIN is **1234**
2. If your device uses a different PIN, update it in the integration configuration
3. Remove any failed pairing attempts before trying again:
   ```bash
   bluetoothctl remove <MAC_ADDRESS>
   ```

### Still Having Issues?

1. **Check Home Assistant logs**: Settings → System → Logs
2. **Check REST server logs**: See output from the REST server terminal
3. **Verify prerequisites**: Ensure PipeWire, bluetoothctl, and all dependencies are installed on the REST server host
4. **Test manually**: Try connecting and playing audio directly on the REST server host before using Home Assistant

## License

This integration is provided as-is for use with Ultra Skelly devices. Use it at your own risk. It might brick your Skelly.

