"""Where send_file can take its audio from, and how uploads are named.

file_path accepts a local path, a /media/... URL, an http(s) URL or a
media-source:// ID. These tests pin down what resolves, and that paths can't
escape the media folders.
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from homeassistant.components.media_source import PlayMedia
from homeassistant.exceptions import HomeAssistantError
from homeassistant.setup import async_setup_component

from custom_components.skelly_ultra import uploads


@pytest.fixture
async def media(hass, tmp_path):
    base = tmp_path / "m"
    (base / "sounds").mkdir(parents=True)
    (base / "sounds" / "a.mp3").write_bytes(b"x")
    hass.config.media_dirs = {"local": str(base)}
    assert await async_setup_component(hass, "media_source", {})
    return base


async def test_media_source_local(hass, media):
    temps = []
    p = await uploads.async_resolve_audio_source(
        hass, "media-source://media_source/local/sounds/a.mp3", temps
    )
    assert p == media / "sounds" / "a.mp3" and temps == []


async def test_media_source_missing(hass, media):
    with pytest.raises(HomeAssistantError):
        await uploads.async_resolve_audio_source(
            hass, "media-source://media_source/local/nope.mp3", []
        )
    with pytest.raises(HomeAssistantError, match="Could not resolve"):
        await uploads.async_resolve_audio_source(hass, "media-source://bogus/x", [])


async def test_media_source_url_signed(hass, media, aioclient_mock):
    hass.config.internal_url = "http://ha.local:8123"
    aioclient_mock.get("http://ha.local:8123/api/x", content=b"data")

    async def fake(hass_, src, tgt):
        return PlayMedia("/api/x", "audio/mpeg")

    temps = []
    with patch.object(uploads.media_source, "async_resolve_media", fake):
        p = await uploads.async_resolve_audio_source(
            hass, "media-source://other/x", temps
        )
    assert temps == [p] and p.read_bytes() == b"data"
    url = str(aioclient_mock.mock_calls[0][1])
    assert url.startswith("http://ha.local:8123/api/x?authSig="), url
    uploads.remove_temp_files(temps)
    assert not p.exists()


async def test_media_url_mapping(hass, media, tmp_path):
    p = await uploads.async_resolve_audio_source(hass, "/media/local/sounds/a.mp3", [])
    assert p == media / "sounds" / "a.mp3"
    # no fallback to the old <config>/media/<rest> mapping
    old = Path(hass.config.path("media")) / "local" / "b.mp3"
    old.parent.mkdir(parents=True, exist_ok=True)
    old.write_bytes(b"y")
    with pytest.raises(HomeAssistantError, match="not found"):
        await uploads.async_resolve_audio_source(hass, "/media/local/b.mp3", [])
    with pytest.raises(HomeAssistantError, match="Unknown media directory"):
        await uploads.async_resolve_audio_source(hass, "/media/sounds/a.mp3", [])
    with pytest.raises(HomeAssistantError, match="Invalid media path"):
        await uploads.async_resolve_audio_source(
            hass, "/media/local/../../etc/passwd", []
        )
    with pytest.raises(HomeAssistantError, match="not found"):
        await uploads.async_resolve_audio_source(hass, "/media/local/zzz.mp3", [])


async def test_media_source_unknown_extension(hass, media):
    (media / "a.weirdext").write_bytes(b"x")
    with pytest.raises(HomeAssistantError, match="unsupported file type"):
        await uploads.async_resolve_audio_source(
            hass, "media-source://media_source/local/a.weirdext", []
        )


async def test_media_source_not_audio(hass, media):
    async def fake(hass_, src, tgt):
        return PlayMedia(
            "/api/camera_proxy_stream/camera.x", "multipart/x-mixed-replace"
        )

    with (
        patch.object(uploads.media_source, "async_resolve_media", fake),
        pytest.raises(HomeAssistantError, match="not audio"),
    ):
        await uploads.async_resolve_audio_source(
            hass, "media-source://camera/camera.x", []
        )


async def test_download_error_wrapped(hass, media, aioclient_mock):
    aioclient_mock.get("http://example.com/a.mp3", exc=TimeoutError())
    temps = []
    with pytest.raises(
        HomeAssistantError, match="Failed to download file: TimeoutError"
    ):
        await uploads.async_resolve_audio_source(
            hass, "http://example.com/a.mp3", temps
        )
    uploads.remove_temp_files(temps)


async def test_media_url_symlink_and_absolute(hass, media, tmp_path):
    other = tmp_path / "other"
    other.mkdir()
    (other / "c.mp3").write_bytes(b"z")
    (media / "link").symlink_to(other)
    assert (
        await uploads.async_resolve_audio_source(hass, "/media/local/link/c.mp3", [])
        == media / "link" / "c.mp3"
    )
    with pytest.raises(HomeAssistantError, match="Invalid media path"):
        await uploads.async_resolve_audio_source(hass, "/media/local//etc/passwd", [])


async def test_media_source_malformed(hass, media):
    for bad in ("media-source://", "media-source://media_source"):
        with pytest.raises(HomeAssistantError, match="Could not resolve"):
            await uploads.async_resolve_audio_source(hass, bad, [])


def test_filename_rules():
    assert (
        uploads.tts_filename_from_message("Hello there, friend!")
        == "hello_there_friend.mp3"
    )
    long = uploads.tts_filename_from_message("word " * 50)
    assert (
        len(long) <= uploads.MAX_FILENAME_LENGTH
        and long.endswith(".mp3")
        and not long[:-4].endswith("_")
    )
    assert uploads.tts_filename_from_message("?!...") == "tts.mp3"
    assert (
        uploads.tts_filename_from_message("\ua62a") == "tts.mp3"
    )  # untransliterable letter
    assert uploads.tts_filename_from_message("Unknown visitor") == "unknown_visitor.mp3"
