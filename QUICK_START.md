# 🚀 Quick Start Guide

Get your Ultra Skelly connected to Home Assistant in minutes!

## 📋 What You'll Need

- ✅ [Home Assistant](https://www.home-assistant.io/) installed and running
- ✅ [HACS](https://hacs.xyz/) (Home Assistant Community Store) installed
- ✅ Your Skelly powered on
- ✅ Bluetooth enabled on your Home Assistant device

## 🎯 Basic Setup (5 Minutes)

This gets you basic control: lights, switches, sensors, and playing files stored on your Skelly.

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
4. Choose **Scan** to automatically find your Skelly
   - *Or choose **Manual** if you know the Bluetooth MAC address*
5. Click **Submit**

### Step 3: Start Using It!

You now have control over:
- 💡 **Lights**: Change head and torso colors
- 🔌 **Switches**: Toggle movements and color cycling
- 🎵 **Media Player**: Play audio files stored on your Skelly
- 📊 **Sensors**: Monitor volume, storage, and more

**That's it!** You can now control your Skelly from Home Assistant dashboards and automations.

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
   - Use automatic pairing when running the REST Server as root, or
   - Pair manually:
     - Enable Live Mode in Home Assistant
     - Use `bluetoothctl` to pair with your Skelly

3. **Configure** the integration
   - Add REST server URL: `http://<linux-device-ip>:8765`
   - Turn on "Live Mode" switch in Home Assistant

👉 For detailed Live Mode setup, see the [REST Server README](custom_components/skelly_ultra/skelly_ultra_srv/README.md)

## 💡 Quick Examples

### Control Lights from Dashboard

Add to your dashboard:
```yaml
type: light
entity: light.animated_skelly_torso
```

### Make Skelly Move on Motion

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

### Integration won't discover my Skelly?

- Make sure Skelly is **powered on**
- Check that **Bluetooth is enabled** on your Home Assistant device
- Try using **Manual** mode and enter the MAC address
  - Find MAC on the Skelly's control panel or mobile app

### Live Mode not working?

- Did you set up the REST server? (It's optional, only needed for Live Mode)
- Is the REST server running on your Linux device?
- Did you pair the device using `bluetoothctl`?

### Where do I find my entities?

Go to **Settings** → **Devices & Services** → **Skelly Ultra** → Click on your device name

Entity IDs are based on your device name. If your Skelly is named "Animated Skelly", look for entities like:
- `light.animated_skelly_torso`
- `switch.animated_skelly_live_mode`
- `media_player.animated_skelly_internal_files`

## 📚 Learn More

- 📖 [Full README](README.md) - Complete documentation
- 🌐 [Web Controller](https://github.com/martinecker/SkellyUltraWebController) - Browser-based controller
- 🐛 [Report Issues](https://github.com/martinecker/SkellyUltra/issues) - Found a bug?

## ⚠️ Important Notes

- **Basic features** (lights, switches, internal file playback) work immediately after installation
- **Live Mode** (TTS, streaming audio) requires the optional REST server setup
- This is an **unofficial community project** - use at your own risk!
- Your Skelly's entities will have unique IDs based on your device name and MAC address

---

**Ready to get started?** Follow Step 1 above and you'll be controlling your Skelly in just a few minutes! 🎃
