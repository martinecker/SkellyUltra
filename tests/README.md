# Tests

The tests run the real integration (config entry setup, coordinator,
entities, actions, `skelly_ultra_pkg`) inside a real Home Assistant, against
a **simulated Skelly** instead of a Bluetooth radio:

- `device_sim.py`: `FakeSkellyDevice` stands in for the `BleakClient`. It
  decodes the command frames the integration writes, keeps the device's
  state (volume, eyes, lights, movement, files with their settings, play
  order, uploads) and answers with notification frames that go through the
  integration's own parser. It ignores frames with a bad checksum.
- `rest_sim.py`: `FakeRestServer` answers the REST server's HTTP endpoints
  for live mode (pairing, connecting, playing audio).

Tests act like a user or automation (entity services, `skelly_ultra.*`
actions) and check the result on the simulated device and in Home
Assistant's states, not which internal functions were called. So a refactor
that keeps the behavior keeps the tests green.

Tests marked `xfail(strict=True)` describe known bugs. When a fix lands,
they start passing and pytest reports them as failures (XPASS), as a
reminder to remove the marker.

## Running them

Home Assistant doesn't run on Windows, so on Windows use WSL2 (Ubuntu).
You need Python 3.14 and ffmpeg (a few upload and perform tests are skipped
without it).

One-time setup, from the repository root:

```bash
sudo apt install python3.14 python3.14-venv ffmpeg   # or use uv / deadsnakes
python3.14 -m venv .venv
. .venv/bin/activate
pip install -r requirements_test.txt
```

Then:

```bash
. .venv/bin/activate
pytest                              # everything, about 30 s
pytest tests/test_files.py          # one file
pytest -k reconnect                 # tests whose name contains "reconnect"
pytest -x --log-level=DEBUG         # stop at the first failure, with logs
```

From Windows you can reach the repository in WSL as
`/mnt/e/Projects/SkellyUltra`. Running from there works but is slower than
a copy inside the WSL file system.

`requirements_test.txt` pins `pytest-homeassistant-custom-component`, which
pins one Home Assistant release: the latest one tested. To test against a
newer Home Assistant, bump it (and the component requirements below it, from
that release's `homeassistant/components/<name>/manifest.json`).

`requirements_test_min.txt` does the same for the oldest release the
integration supports (`homeassistant` in `hacs.json`, 2025.8.0), which needs
Python 3.13. To run against it, make a second venv:

```bash
python3.13 -m venv .venv-min
.venv-min/bin/pip install -r requirements_test_min.txt
.venv-min/bin/pytest
```

GitHub Actions runs the tests against both on every push
(`.github/workflows/tests.yaml`).

## Files

| File | What it covers |
| --- | --- |
| `test_init.py` | Setting up the integration |
| `test_connection.py` | Link drops, reconnecting, the Connected switch, unloading |
| `test_entities.py` | Lights, eyes, movement, volume, sensors; entities per device model |
| `test_playback.py` | Playing files on the device; no polling while a file plays |
| `test_files.py` | Upload, delete, `edit_file`, `set_file_order` |
| `test_websocket.py` | The `skelly_ultra/files/*` websocket commands for a file manager UI |
| `test_live_mode.py` | Live mode, `perform`, `send_file_from_tts` |
| `test_config_flow.py` | Adding a Skelly in the UI |
| `test_audio_sources.py` | What `send_file` accepts as `file_path`; TTS filenames |
| `test_client.py` | `skelly_ultra_pkg` without Home Assistant: replies, drops, file transfer |

## Writing a test

```python
async def test_something(hass, setup_integration, device):
    entry = setup_integration  # loaded and connected
    eid = entity_id(hass, entry, "number", "volume_number")  # by unique id suffix
    await hass.services.async_call(
        "number", "set_value", {"entity_id": eid, "value": 80}, blocking=True
    )
    assert device.volume == 80  # the simulated device's state
```

Useful helpers in `conftest.py`: `advance(hass, seconds)` lets time pass
(polls, reconnect backoff, timers), `wait_for(hass, condition)` waits for
background loops, and `coordinator(hass, entry)`. `device.drop_connection()`,
`device.reachable`, `device.unresponsive` and `device.finish_playback()`
simulate the device's misbehavior.
