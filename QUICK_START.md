# 🚀 Quick Start Guide

Get your Ultra Skelly or Lethal Lily connected to Home Assistant in minutes!

## 📋 What You'll Need

- ✅ [Home Assistant](https://www.home-assistant.io/) installed and running
- ✅ [HACS](https://hacs.xyz/) (Home Assistant Community Store) installed
- ✅ Your device powered on
- ✅ Bluetooth enabled on your Home Assistant device

## 🎯 Basic Setup (5 Minutes)

This gets you basic control: lights, switches, sensors, and playing files stored on your device.

### Step 1: Install via HACS

1. Open **HACS** in your Home Assistant sidebar
2. Click the **3 dots menu** (⋮) in the top right corner
3. Select **Custom repositories**
4. Add this repository:
   - **Repository**: `https://github.com/martinecker/SkellyUltra`
   - **Category**: `Integration`
5. Click **Add**
6. Click **Download** on the Skelly Ultra card
7. **Restart Home Assistant**

### Step 2: Add the Integration

1. Go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for **"Skelly Ultra"**
4. **Select your device type**:
   - **Ultra Skelly** — the 6.5 ft skeleton animatronic
   - **Lethal Lily** — the 7 ft animatronic witch
5. Click **Submit**, then choose **Scan** to automatically find your device
   - *Or choose **Manual** if you know the Bluetooth MAC address*

### Step 3: Start Using It!

You now have control over:
- 💡 **Lights**: Ultra Skelly — Torso and Head colors; Lethal Lily — Lantern color
- 🔌 **Switches**: Toggle movements and color cycling
- 🎵 **Media Player**: Play audio files stored on your device
- 📊 **Sensors**: Monitor volume, storage, and more

**That's it!** You can now control your device from Home Assistant dashboards and automations.

## 🎤 Advanced Setup: Live Mode Audio (Optional)

Want to make your Skelly speak using Text-to-Speech? This requires additional setup.

### What is Live Mode?

Live Mode lets you:
- 🗣️ Use TTS (Text-to-Speech) to make your Skelly talk
- 🎵 Stream any audio file to the Skelly's speaker
- 🔊 Play sounds from automations in real-time

### Requirements

- 🐧 A Linux device (Raspberry Pi, Ubuntu server, etc.) with Bluetooth
- ⚙️ About 15-30 minutes for setup

### Quick Overview

1. **Set up REST Server** on your Linux device
   - Install Python, Bluetooth tools, and PipeWire
   - Run the server script (see [detailed guide](custom_components/skelly_ultra/skelly_ultra_srv/README.md))

2. **Pair Bluetooth** (one-time setup)
   - Use automatic pairing when running the REST Server (requires python3 to get elevanted iiviledges for pairing), or
   - Pair manually:
     - Enable Live Mode in Home Assistant
     - Use `bluetoothctl` to pair with your Skelly

3. **Configure** the integration
   - Add REST server URL: `http://<linux-device-ip>:8765`
   - Turn on "Live Mode" switch in Home Assistant

👉 For detailed Live Mode setup, see the [REST Server README](custom_components/skelly_ultra/skelly_ultra_srv/README.md)

## 💡 Quick Examples

> **Note on entity IDs**: Entity IDs are generated from the BLE device name and MAC address. Ultra Skelly examples below use `animated_skelly` (old firmware) or `ultra_skelly_v2` (new firmware). Lethal Lily entities use `lethal_lily`. Find your exact IDs under **Settings** → **Devices & Services** → **Skelly Ultra** → your device.

### Control Lights from Dashboard

Ultra Skelly torso:
```yaml
type: light
entity: light.animated_skelly_torso_light
```

Lethal Lily lantern:
```yaml
type: light
entity: light.lethal_lily_lantern
```

### Make Your Device Move on Motion

Ultra Skelly:
```yaml
automation:
  - alias: "Skelly Moves When Someone Approaches"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door_motion
        to: "on"
    action:
      - service: switch.turn_on
        target:
          entity_id: switch.animated_skelly_movement_all
```

Lethal Lily:
```yaml
automation:
  - alias: "Lily Moves When Someone Approaches"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door_motion
        to: "on"
    action:
      - service: switch.turn_on
        target:
          entity_id: switch.lethal_lily_movement_all
```

### Play Internal Files

```yaml
automation:
  - alias: "Play Spooky Sound at Sunset"
    trigger:
      - platform: sun
        event: sunset
    action:
      - service: skelly_ultra.play_file
        data:
          file_index: 1  # Play first file on device
```

### Use TTS (Live Mode Required)

```yaml
automation:
  - alias: "Greet Visitors"
    trigger:
      - platform: state
        entity_id: binary_sensor.doorbell
        to: "on"
    action:
      - service: tts.google_translate_say
        target:
          entity_id: media_player.animated_skelly_live_mode_speaker
        data:
          message: "Welcome to my haunted house!"
```

## 🆘 Troubleshooting

### Can't find integration after installing?

- Make sure you **restarted Home Assistant** after installing via HACS
- Check that the files are in `config/custom_components/skelly_ultra/`

### Integration won't discover my device?

- Make sure the device is **powered on**
- Check that **Bluetooth is enabled** on your Home Assistant device
- The scan filter accepts: "Animated Skelly" (Ultra Skelly old firmware), "Ultra Skelly v2" (Ultra Skelly new firmware), and "Lethal Lily". If your device shows up as something different, use **Manual** mode with the MAC address.
- Try using **Manual** mode and enter the MAC address if you know it (visible via `bluetoothctl scan on`)

### Live Mode not working?

- Did you set up the REST server? (It's optional, only needed for Live Mode)
- Is the REST server running on your Linux device?
- Did you pair the device using `bluetoothctl`? Check the HA and REST server logs for hints as to what could be wrong.

### Where do I find my entities?

Go to **Settings** → **Devices & Services** → **Skelly Ultra** → Click on your device name

Entity IDs are based on your BLE device name. Examples:

| Device | BLE Name | Example entity |
|---|---|---|
| Ultra Skelly (old firmware) | Animated Skelly | `light.animated_skelly_torso_light` |
| Ultra Skelly (new firmware) | Ultra Skelly v2 | `light.ultra_skelly_v2_torso_light` |
| Lethal Lily | Lethal Lily | `light.lethal_lily_lantern` |

## 📚 Learn More

- 📖 [Full README](README.md) - Complete documentation
- 🌐 [Web Controller](https://github.com/martinecker/SkellyUltraWebController) - Browser-based controller
- 🐛 [Report Issues](https://github.com/martinecker/SkellyUltra/issues) - Found a bug?

## ⚠️ Important Notes

- **Basic features** (lights, switches, internal file playback) work immediately after installation
- **Live Mode** (TTS, streaming audio) requires the optional REST server setup
- **Device type is set once** during config and determines which entities are created (they differ between Ultra Skelly and Lethal Lily — see the [full README](README.md) for details)
- This is an **unofficial community project** - use at your own risk!
- Your device's entities will have unique IDs based on the BLE device name and MAC address

---

**Ready to get started?** Follow Step 1 above and you'll be controlling your prop in just a few minutes! 🎃
