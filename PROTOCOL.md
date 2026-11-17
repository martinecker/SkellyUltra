# Skelly BLE protocol

This document describes the Bluetooth Low Energy protocol of the Seasonal Visions International animatronics sold by Home Depot (Ultra Skelly, 12 ft Skelly, Lethal Lily, Ultra Santa and others). It is the reference for this integration (`custom_components/skelly_ultra/skelly_ultra_pkg`) and for the [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController).

Sources, in order of weight:

- **Device**: observed on real devices (Ultra Skelly v66 and v68, 12 ft Skelly v14, Lethal Lily v24).
- **App**: read from the decompiled DecorPro SVI Android app, the vendor's own controller app.
- Anything not confirmed either way is marked *unknown* or *unverified*.

The constants named here are in `skelly_ultra_pkg/constants.py` (HA) and `js/constants.js` (web controller).

## Contents

1. [Transport](#1-transport)
2. [Frames](#2-frames)
3. [Data types](#3-data-types)
4. [Files: serial, cluster and position](#4-files-serial-cluster-and-position)
5. [Devices, firmware and capabilities](#5-devices-firmware-and-capabilities)
6. [Command reference](#6-command-reference)
7. [Reply reference](#7-reply-reference)
8. [Lights and scenes](#8-lights-and-scenes)
9. [Movement and eyes](#9-movement-and-eyes)
10. [Uploading a file](#10-uploading-a-file)
11. [Play order](#11-play-order)
12. [Playback, delete and format](#12-playback-delete-and-format)
13. [Jaw movement data (CD)](#13-jaw-movement-data-cd)
14. [Live mode (classic Bluetooth)](#14-live-mode-classic-bluetooth)
15. [Audio format](#15-audio-format)
16. [Device quirks](#16-device-quirks)

---

## 1. Transport

| Item | Value |
|---|---|
| GATT service | `0000ae00-0000-1000-8000-00805f9b34fb` |
| Write characteristic | `0000ae01-0000-1000-8000-00805f9b34fb`, written **without response** |
| Notify characteristic | `0000ae02-0000-1000-8000-00805f9b34fb`, carries every reply |
| MTU | The app requests 512 and uses whatever is negotiated. A write may be at most MTU − 3 bytes. |
| Pairing | None on the BLE side. The PIN in BBE0/FB is for the classic Bluetooth audio link ([§14](#14-live-mode-classic-bluetooth)). |

Commands go to `ae01`; every reply arrives as a notification on `ae02`. Replies are not tied to a request: a reply carries no request id, so a client matches it by its tag, and two queries of the same kind must not be waiting at the same time. The device also sends some notifications on its own (BBC6 when a file stops playing, FEDC keep-alives).

**Advertisement.** The device advertises its BLE name, for example "Animated Skelly", "Ultra Skelly v2", "12ft Skelly" or "Lethal Lily". Users can rename a device, so the name only hints at the type. The app reads the firmware version from bytes 4–5 (little endian) of the raw advertising data; this integration asks for it with `AA EE` instead, which also works through the REST proxy.

## 2. Frames

### Commands (to the device)

```
AA <tag> <payload...> [00 padding] <crc8>
```

- `AA` marks a command; `<tag>` is one byte, so the constants hold both bytes, e.g. `AAE5`.
- The payload is right-padded with `00` to **at least 8 bytes**. Longer payloads are not padded.
- `<crc8>` is CRC-8 over every byte before it, including `AA` and the tag: initial value 0, reflected polynomial `0x8C` (CRC-8/MAXIM reflected form), no final XOR.

```python
def crc8(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8C if crc & 1 else crc >> 1
    return crc
```

Example, captured from the app on a 12 ft Skelly (live head movement on): `AA CA 02 00 00000000 00` padded to 8 payload bytes, then CRC `94`:

```
AA CA 02 00 00 00 00 00 00 00 94
```

The device ignores frames with a wrong CRC.

### Replies (from the device)

```
BB <tag> <payload...> <crc8>
```

`BB` marks a reply, and the tag usually matches the command's (`AA E5` → `BB E5`). Replies end with a CRC byte, which the app and this integration don't check. Byte offsets in this document count from the `BB` byte (offset 0).

The one exception is the keep-alive, `FE DC <payload> EF`.

## 3. Data types

- **Integers** are unsigned and **big endian** (u8, u16, u32), unless noted otherwise.
- **Colors** are three bytes, R G B.
- **ASCII strings** (PIN, Wi-Fi password, classic Bluetooth name) are plain bytes. A length byte, where there is one, comes first.
- **File names** are UTF-16LE, preceded by the marker `5C 55` (`PROTOCOL_MARKER_FILENAME`). There are two forms:
  - **With length**: `<len u8> 5C 55 <UTF-16LE name>`, where `len` = 2 + name bytes. The per-file setting commands use it (F2, F3, F4, F6, F9, CA, C9). An empty name is a single `00` (length 0, no marker).
  - **Bare**: `5C 55 <UTF-16LE name>`. The upload commands C0 and C3 use it; the device ignores the upload if there is a length byte.

  In replies (BBD0) the name runs from after the marker to the byte before the CRC.

  Device file names include the `.mp3` extension. Names over **33 characters** (`MAX_FILENAME_LENGTH`) are silently dropped on upload (see [§16](#16-device-quirks)).

## 4. Files: serial, cluster and position

Each file on the device has three numbers:

| Name | Size | Meaning |
|---|---|---|
| **Serial** ("file index") | u16, 1-based | The file's number. Play order (C9, BBD1), playback (C6, BBC6) and delete (C7) use it. Default sounds have the low serials. |
| **Cluster** | u32 | Where the file starts in the device's flash. Per-file setting commands (F2–F6, F9, CA) address a file by its cluster plus its name, F1 and CD by the cluster alone, and delete (C7) by serial plus cluster. **Cluster 0 with an empty name means the live settings**: what the device shows when no file plays. |
| **Position** ("db pos") | u8 | A position byte in BBD0. Not the play order, which is BBD1; its meaning is *unknown*. |

## 5. Devices, firmware and capabilities

### Firmware version

`AA EE` → `BB EE <version u8>`, e.g. `BB EE 44` = v68. HA reads it on every connect, shows it on the device page and as the "Firmware Version" sensor, and gates features on it.

### Capabilities

Features are gated by device type and firmware, **never by the BLE name**, because a user can rename the device. The app itself gates on the name (its `isNewPage` list), but has no firmware check. HA keeps these thresholds in `DEVICE_PROFILES[...]["capabilities"]` (`const.has_capability()`); the web controller in `DEVICE_PROFILES[...].capabilities` (`hasCapability()`).

| Device | Firmware seen | Light scenes, F1 | CD jaw data | BBD0 tail layout |
|---|---|---|---|---|
| Ultra Skelly, advertises "Animated Skelly" | v66 | no (device) | no | position at 56, marker at 57 |
| Ultra Skelly, advertises "Ultra Skelly v2" | v68 | yes (device) | assumed yes | scene at 56, position at 57, marker at 58 |
| 12 ft Skelly | v14 | yes (device) | assumed yes | scene layout (device) |
| Lethal Lily | v24 | yes (device) | assumed yes | scene layout |
| Ultra Santa | unknown | yes (app) | yes (app) | scene layout (app) |

Firmware newer than the lowest one seen keeps the capabilities; older firmware, or a version not read yet, gets none.

### Product names in the app

- **"New page" models**, which get scenes, F1, CD and the scene layout: Lilly, Lethal Lily, Skelly3, 12ft Skelly, Harvester, Ultra Skelly v2, Santa Claus, Ultra Santa.
- **Older models**: Animated Skelly, 12ft Skeleton, Medusa, Headless Horseman, Connectivity Santa, Nightshade Witch, Reaper, App Reaper.
- **Not released:** of all these names, only Ultra Skelly, 12 ft Skelly, Lethal Lily and Ultra Santa are known to be on sale. The others are test devices or upcoming products.

The app also has firmware thresholds of its own:
- v48 adds "open classic mode".
- v55 adds "change to class mode", which goes with the FE command.

## 6. Command reference

All tags are shown without the `AA` prefix. "Name" is a file name in the with-length form unless it says *bare*. "Live" means cluster 0 and an empty name (`00`).

### Queries

| Tag | Constant | Payload | Reply | Purpose |
|---|---|---|---|---|
| E0 | `CMD_QUERY_DEVICE_PARAMS` | `00` | BBE0 | Channels, PIN, show mode, classic BT name |
| E1 | `CMD_QUERY_LIVE_MODE` | `00` | BBE1 | Live movement, lights, eye icon, scene |
| E5 | `CMD_QUERY_VOLUME` | `00` | BBE5 | Volume |
| E6 | `CMD_QUERY_LIVE_NAME` | `00` | BBE6 | Classic Bluetooth name |
| EE | `CMD_QUERY_VERSION` | `00` | BBEE | Firmware version |
| D0 | `CMD_QUERY_FILE_LIST` | `00` | one BBD0 per file | File list |
| D1 | `CMD_QUERY_FILE_ORDER` | `00` | BBD1 | Play order |
| D2 | `CMD_QUERY_CAPACITY` | `00` | BBD2 | Free space and file count |

### Device settings and media

| Tag | Constant | Payload | Reply | Purpose |
|---|---|---|---|---|
| FA | `CMD_SET_VOLUME` | volume u8 (0–100) | none | Set the volume |
| FB | `CMD_SET_PIN_AND_NAME` | PIN 4 ASCII, Wi-Fi password 8 ASCII, len u8, name ASCII | none known | Set the classic BT PIN and name. The app appends its "(Live)" suffix to the name. |
| FC | `CMD_PLAY_PAUSE` | `01` play / `00` pause | none known | Play or pause the device's own playback |
| FD | `CMD_ENABLE_CLASSIC_BT` | `01` | BBFD | Turn on classic Bluetooth audio (live mode) |
| FE | `CMD_SET_MUSIC_MODE` | `00` device music / `01` classic BT | none known | Switch the music source. The app has a builder for it but no longer sends it. |

### Lights (live or per file)

`ch` is a channel 0–5, or `FF` for all channels. `cluster` and the name pick a file, or the live settings when they are 0 and empty.

| Tag | Constant | Payload | Purpose |
|---|---|---|---|
| F1 | `CMD_SET_ALL_LIGHTS` | cluster u32, audioMode u8, scene u8, 6 × (mode, brightness, R, G, B, colorCycle, speed) | Set every channel and the scene at once. audioMode is 0 for live, 1 for a file. There is no name. Scene firmware only ([§8](#8-lights-and-scenes)). |
| F2 | `CMD_SET_LIGHT_MODE` | ch, mode u8, cluster u32, name | Effect mode 1–3 ([§8](#8-lights-and-scenes)) |
| F3 | `CMD_SET_LIGHT_BRIGHTNESS` | ch, brightness u8, cluster u32, name | Brightness 0–255 |
| F4 | `CMD_SET_LIGHT_RGB` | ch, R, G, B, colorCycle u8, cluster u32, name | Color. colorCycle 1 cycles through all colors. |
| F5 | `CMD_SELECT_RGB_CHANNEL` | ch | Selects the channel the app's color picker edits. Its effect on the device is *unknown*. |
| F6 | `CMD_SET_LIGHT_SPEED` | ch, speed u8, cluster u32, name | Effect speed: 0 fastest, 254 slowest |

No reply is known for F1–F6.

### Movement and eyes (live or per file)

| Tag | Constant | Payload | Purpose |
|---|---|---|---|
| F9 | `CMD_SET_EYE_ICON` | icon u8 (1-based), `00`, cluster u32, name | Eye image ([§9](#9-movement-and-eyes)) |
| CA | `CMD_SET_MOVEMENT_ACTION` | action u8 (bit field), `00`, cluster u32, name | Which parts move ([§9](#9-movement-and-eyes)) |
| CD | `CMD_SET_JAW_DATA` | cluster u32, byteCount u8, bitmap | Jaw movement for a file ([§13](#13-jaw-movement-data-cd)). There is no name. |

### Files

| Tag | Constant | Payload | Reply | Purpose |
|---|---|---|---|---|
| C0 | `CMD_START_SEND_DATA` | size u32, chunkCount u16, *bare* name | BBC0 | Start an upload ([§10](#10-uploading-a-file)) |
| C1 | `CMD_SEND_DATA_CHUNK` | index u16 (0-based), data | BBC1 (status, mostly on loss) | One chunk of the file |
| C2 | `CMD_END_SEND_DATA` | `00` | BBC2 | All chunks sent |
| C3 | `CMD_CONFIRM_FILE` | *bare* name | BBC3 | Store the file under this name |
| C4 | `CMD_CANCEL_SEND` | `00` | BBC4 | Cancel the upload |
| C5 | `CMD_RESUME_SEND` | *unknown* | BBC5 | Listed for completeness. The app never sends it, though it parses BBC5. |
| C6 | `CMD_PLAY_STOP_FILE` | serial u16, `01` play / `00` stop | BBC6 | Play or stop one file |
| C7 | `CMD_DELETE_FILE` | serial u16, cluster u32 | BBC7 | Delete a file |
| C8 | `CMD_FORMAT_DEVICE` | `00` | BBC8 | Erase every file, the default sounds included ([§12](#12-playback-delete-and-format)) |
| C9 | `CMD_SET_FILE_ORDER` | total u8, position u8 (1-based), serial u16, name | none | Put one file into the play order ([§11](#11-play-order)) |

### Wi-Fi (not used by any known product)

| Tag | Constant | Payload | Reply | Purpose |
|---|---|---|---|---|
| CB | `CMD_SET_WIFI_POWER` | u8 on/off | none known | Wi-Fi power |
| CC | `CMD_QUERY_WIFI_MAC` | `00` | BBCC | Read the Wi-Fi MAC |

The app also has code to upload files over UDP (to `192.168.167.16:7090`), but nothing calls it. The Wi-Fi password in BBE0/FB belongs to this feature.

## 7. Reply reference

Offsets are bytes from the `BB` byte. Hex-string offsets in code are twice these.

### BBE0 device parameters

| Offset | Field |
|---|---|
| 2–7 | Channel present flags, one byte per light channel (1 = the device has it) |
| 8–11 | Classic Bluetooth PIN, 4 ASCII |
| 12–19 | Wi-Fi password, 8 ASCII |
| 20 | Show (demo) mode: 1 = on. The app doesn't send upload chunks in show mode, and this integration needs normal mode. |
| 21–27 | *unknown* |
| 28 | Name length |
| 29… | Classic Bluetooth name, ASCII |

### BBE1 live mode

| Offset | Field |
|---|---|
| 2 | Movement bit field ([§9](#9-movement-and-eyes)) |
| 3–44 | 6 light channels × 7 bytes: mode, brightness, R, G, B, colorCycle, speed |
| 45 | Eye icon |
| 46 | Live light scene. Scene firmware only: the app reads it when the reply is longer than 47 bytes, CRC included. |

### BBE5 volume, BBE6 name, BBEE version, BBFD classic BT

| Reply | Layout |
|---|---|
| BBE5 | 2: volume (0–100) |
| BBE6 | 2: length, 3…: classic Bluetooth name, ASCII |
| BBEE | 2: firmware version |
| BBFD | 2: classic Bluetooth on (1). The app then opens the phone's Bluetooth settings so the user can pair. |

### BBD0 file info

D0 makes the device send one BBD0 per file, in no fixed order.

| Offset | Field |
|---|---|
| 2–3 | Serial |
| 4–7 | Cluster |
| 8–9 | Total file count; every BBD0 of one listing carries it |
| 10–11 | "Song length" in the app, which never uses it. Always 0 on the devices seen. |
| 12 | Movement bit field |
| 13–54 | 6 light channels × 7 bytes, as in BBE1 |
| 55 | Eye icon |
| 56… | The tail, whose layout depends on the firmware (below) |

The tail is told apart by where the `5C 55` name marker sits:

| Firmware | 56 | 57 | Marker | Name |
|---|---|---|---|---|
| Scene firmware (12 ft, Lily, Ultra v68, Santa) | light scene | position | 58–59 | 60 to end − 1 |
| Older (Ultra v66) | position | marker | 57–58 | 59 to end − 1 |

### BBD1 play order

| Offset | Field |
|---|---|
| 2 | Count |
| 3… | Count × serial u16, in play order |

### BBD2 capacity

| Offset | Field |
|---|---|
| 2–5 | Free space in KB |
| 6 | File count |
| 7 | "Action mode" in this integration (0 = transfer mode); meaning *unverified* |

### Upload replies

| Reply | Layout | Meaning |
|---|---|---|
| BBC0 | 2: failed, 3–6: written u32 | Upload accepted (failed = 0). The app ignores `written` and always starts at chunk 0. |
| BBC1 | 2: lost, 3–4: index u16 | Chunk status. **lost = 0 means no loss**, and the app ignores it. lost = 1 means chunks from `index` on were lost. |
| BBC2 | 2: failed, 3–4: last chunk index | All chunks received (failed = 0). The app doesn't read the index. |
| BBC3 | 2: failed | File stored |
| BBC4 | 2: failed | Upload cancelled |
| BBC5 | 2–5: written u32 | Resume information. The app parses it but never uses it. |

### Other replies

| Reply | Layout | Meaning |
|---|---|---|
| BBC6 | 2–3: serial, 4: playing, 5–6: duration in seconds | Playback started or stopped. Also sent unprompted when a file ends. |
| BBC7 | 2: failed | Delete result (0 = deleted) |
| BBC8 | 2: result | Format result (0 = done) |
| BBCC | 2–7: Wi-Fi MAC | Reply to CC |
| FEDC | `FE DC <payload> EF` | Keep-alive the device sends on its own. Ignored. |

## 8. Lights and scenes

**Channels.** There are 6 channels; BBE0 says which ones a device has.

| Device | Channels |
|---|---|
| Ultra Skelly | 0 torso, 1 head |
| 12 ft Skelly | 0 torso |
| Lethal Lily | 0 lantern |
| Ultra Santa (app) | 0 lantern |

**Mode** (F2, byte 0 of a channel):

| Device | 1 | 2 | 3 |
|---|---|---|---|
| Skellys | static | strobe | pulsing |
| Lethal Lily | flickering | pulsing | chasing |
| Ultra Santa (app) | static | sparkle | pulsing |

**Speed** (F6) runs from 0 (fastest) to 254 (slowest), and the device also reports 255 for fastest. It only matters for the moving modes. The integration's entities show it inverted, so that higher is faster.

**Color cycle** (F4) set to 1 makes the device cycle through all colors.

**Scenes.** Scene firmware has a light scene for the live settings (BBE1) and per file (BBD0), set with F1. Values are `LightScene` in HA and `LIGHT_SCENES` in the web controller:

| Value | Scene | What the app sends |
|---|---|---|
| 0 | Custom | Each channel's own settings |
| 1 | Halloween | Channel 0 orange `#FD942A`, channels 1–5 purple `#7637FD` |
| 2 | Christmas | Channel 0 red `#960100`, channels 1–5 green `#036400` |

For a preset the app sends mode 1, brightness 255 and speed 0 on every channel, in the same F1. The device stores the scene number, and BBE1/BBD0 report it back.

## 9. Movement and eyes

**Movement** (CA, and the action byte of BBE1/BBD0) is a bit field. A set bit moves that part; 255 means "all", which the app shows as an icon of its own.

| Device | Bits |
|---|---|
| Ultra Skelly | head `0x01`, arm `0x02`, torso `0x04`, all 255 |
| 12 ft Skelly | head `0x02` (captured from the app), no "all" |
| Lethal Lily | wrist `0x01`, elbow `0x02`, head `0x10`, eyes `0x20`, all 255 |
| Ultra Santa (app) | eyes `0x01`, head `0x02`, torso `0x04`, arm `0x08`, all 255 |

**Eye icons** (F9, BBE1 byte 45, BBD0 byte 55) are 1-based:

| Device | Icons |
|---|---|
| Ultra Skelly | 18 |
| 12 ft Skelly | 20, in a different order |
| Lethal Lily, Ultra Santa | none |

The integration's profiles hold the names, and its `images/` folder the pictures.

## 10. Uploading a file

The upload as the app does it (`RecordActivity`, its only upload path):

1. **Checks.**
   - Fewer than **30 files** on the device; the app's hard limit.
   - No file with the same name already. The app never overwrites a file.
   - Sends D2 and refuses if `ceil(bytes / 1000) >= free KB` or the file count is 30 or more.
2. **C0** 500 ms later: size, chunk count, *bare* name with `.mp3`. On BBC0 with failed ≠ 0, the app retries C0 up to twice.
3. **C1 chunks**, starting at index 0 whatever BBC0's `written` says.
   - **Size:** each chunk carries **MTU − 8** data bytes, so a C1 frame is MTU − 3 bytes, the most one write may hold. The last chunk is shorter.
   - **Pacing:** one chunk every **100 ms**, written without response, without waiting for a reply.
4. **Losses.** On **BBC1 with lost = 1**:
   - The app stops, waits 1 s, then resumes from the reported index (2 s later).
   - Repeated BBC1s for the same index within 1 s count once.
   - After 10 losses it sends C4 and gives up.
   - BBC1 with lost = 0 is ignored.
5. **C2** after the last chunk.
   - **BBC2 with failed = 0** is the go-ahead for C3.
   - **BBC2 with failed ≠ 0** is treated like a loss: the app resumes from the last BBC1 index.
6. **C3** with the *bare* name. BBC3 with failed = 0 means the file is stored.
7. **Refresh.** 500 ms later the app sends D0 twice (500 ms apart), then D1.
   - On scene firmware it then sends CD (jaw data) for the new file's cluster.
   - Then it opens the file's settings.
   - It never sends C9 after an upload.

**On failure:** any write error during the transfer makes the app send C4.

**This integration differs** in a few places, some of which may still change:
- It resumes from BBC0's `written`.
- It retries a failed transfer from the start with smaller chunks.
- It writes the play order after an upload ([§11](#11-play-order)).
- It overwrites existing files, restoring their settings after the upload ([§16](#16-device-quirks)).

## 11. Play order

The play order is the list of serials the device plays in turn; BBD1 reports it. A file not in the list is disabled, and the device doesn't play it.

**Writing the order:**
- C9 puts one file at a 1-based position. `total` is the length of the new list, and every C9 of one write carries the same `total`.
- To write an order, send one C9 per enabled file. The app does this in a tight loop when the user reorders, or one every 100 ms after a delete, then reads D1 back.
- An **empty order** is a single C9 with total 0, position 0, serial 0 and the name `"0"`.

**After an upload of a new file**, the firmware rewrites the order wrongly: from `[3, 1]` it makes `[4, 1, 1]`.
- The first previously enabled file is lost, and the last one is listed twice.
- Overwrites leave the order alone.
- The app doesn't fix this. This integration writes `[new] + previous order` instead.

## 12. Playback, delete and format

- **C6** plays or stops one file by serial. BBC6 reports playing (1/0) and the file's duration in seconds, and comes again when the file ends. **FC** pauses or resumes the device's own playback.
- **Querying during playback:** while a file plays, a burst of queries (the capacity query in particular) can stop it. The integration holds off polling while a file plays.
- **C7** deletes a file by serial and cluster. Afterwards the app writes the play order again without the deleted file.
- **C8** formats the storage: every file goes, the default sounds included. The app lists it as a factory reset. Whether the default sounds come back is *unknown*, and they can't be downloaded from the device.

## 13. Jaw movement data (CD)

```
AA CD <cluster u32> <byteCount u8> <bitmap...>
```

The app sends CD once after an upload, on scene firmware, for the new file's cluster. It waits for no reply (there is no known BBCD).

**Building the bitmap** (the app's `MP3MouthDetectionUtil`):
1. Decode the MP3 to 16-bit PCM.
2. Make `n = ceil(duration_ms / 60)` windows of `floor(samples / n)` samples each, about **60 ms**.
3. Take each window's peak absolute sample.
4. A window's bit is 1 (jaw open) if its peak is above the average of all window peaks.
5. Pack the bits **LSB first**, 8 windows per byte: window 0 is bit 0 of byte 0.

`byteCount` is the number of bitmap bytes. The app ends up sending `floor(n / 8)` bytes: when `n` isn't a multiple of 8, it drops the last partial byte. A 30 s file is 500 windows, so 62 bytes.

*Unverified on a device*: whether the jaw follows CD, whether it replaces audio-driven jaw movement, and whether CD survives a reboot.

## 14. Live mode (classic Bluetooth)

Live mode makes the device a Bluetooth speaker.
1. **FD 01** turns on the device's classic Bluetooth audio, and BBFD confirms.
2. The device then shows up as a classic Bluetooth device named `<name>(Live)` (BBE6, set with FB).
3. A phone, or the REST server in this project, pairs with it using the PIN from BBE0 and streams audio over A2DP.

**Phone app:** its live microphone mode records at 44.1 kHz stereo, doubles the gain and plays the result over that link, with no compression of its own.

**Device behavior:** the device mutes its speaker on digital silence and cuts off about the first 0.1 s when it unmutes. That's why the integration starts live audio with 500 ms of faint noise.

## 15. Audio format

**Uploads** are MP3. The app's recordings, and this integration's uploads, are:
- MPEG-1 Layer III, 44.1 kHz, mono, **CBR 32 kbps** (about 4 KB per second)
- Up to 30 s long
- Without ID3 or Xing tags

The app asks LAME for 16 kbps; LAME raises it to 32, the lowest bitrate MPEG-1 allows.

**Other formats the device plays:**
- 22.05 kHz MPEG-2 at 32 kbps: the app's cloud voice effects (ElevenLabs `mp3_22050_32`). The web controller's encoder also produces this at 32 kbps.
- 8 kHz MPEG-2.5: the app's fallback `mp3_8000_16`, and this integration's earlier format.

## 16. Device quirks

| Quirk | What happens |
|---|---|
| **Long file names** | A name over 33 characters, `.mp3` included, uploads with every reply OK, but the file never shows up in D0. |
| **Overwriting** | Uploading a file under an existing name replaces it. The device resets that file's movement, eye and light settings to defaults. |
| **New file and the play order** | Uploading a new file garbles the play order ([§11](#11-play-order)). |
| **Settings after power-up** | After a power-up the device may show a different look than it reports in BBE1, until the first light write. This integration's "HA controls settings" option sends the live settings on every connect for that reason. |
| **Show mode** | With show (demo) mode on (BBE0 byte 20), the device plays its demo. The app doesn't upload then, and this integration asks for normal mode. Holding the device's button for about 10 s leaves show mode. |
| **Stray file info** | A BBD0 can arrive outside a D0 listing, and a listing's total can change midway when files change. Clients should start a listing over when the total changes. |
| **Lost connection** | The 12 ft Skelly occasionally resets itself (the link drops with "Remote User Terminated"); the cause is on the device side. |
