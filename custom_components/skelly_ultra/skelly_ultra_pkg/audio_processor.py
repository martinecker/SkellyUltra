"""Audio processor for Skelly Ultra devices.

Handles audio file conversion to the format required by Skelly devices:
- 8 kHz sample rate
- Mono (single channel)
- MP3 format
"""

from __future__ import annotations

from io import BytesIO
import logging
import os
from pathlib import Path
import tempfile

from pydub import AudioSegment

logger = logging.getLogger(__name__)


class AudioProcessingError(Exception):
    """Base exception for audio processing errors."""


class AudioProcessor:
    """Process audio files for Skelly device compatibility.

    The Skelly device requires audio in a specific format:
    - Sample rate: 8000 Hz (8 kHz)
    - Channels: 1 (mono)
    - Format: MP3

    This processor takes any audio file supported by pydub (mp3, wav, ogg, flac, etc.)
    and converts it to the required format.
    """

    # Skelly device requirements
    TARGET_SAMPLE_RATE = 8000  # 8 kHz
    TARGET_CHANNELS = 1  # mono
    TARGET_FORMAT = "mp3"

    # MP3 encoding parameters
    MP3_BITRATE = "32k"  # Decent quality for 8kHz mono speech

    @classmethod
    def process_file(
        cls,
        input_path: str | Path,
        output_path: str | Path | None = None,
        bitrate: str | None = None,
    ) -> Path:
        """Process audio file to Skelly-compatible format.

        Args:
            input_path: Path to input audio file (any format supported by pydub)
            output_path: Path for output MP3 file. If None, creates temp file.
            bitrate: MP3 bitrate (e.g., "64k", "128k"). If None, uses MP3_BITRATE default.

        Returns:
            Path to the processed MP3 file

        Raises:
            AudioProcessingError: If processing fails
            FileNotFoundError: If input file doesn't exist
        """
        input_path = Path(input_path)
        if not input_path.exists():
            raise FileNotFoundError(f"Input audio file not found: {input_path}")

        logger.info("Processing audio file: %s", input_path)

        try:
            # Load audio file (pydub auto-detects format)
            audio = AudioSegment.from_file(str(input_path))
            logger.debug(
                "Loaded audio: %d Hz, %d channels, %.2f seconds",
                audio.frame_rate,
                audio.channels,
                len(audio) / 1000.0,
            )

            # Convert to required format
            processed_audio = cls._convert_audio(audio)

            # Determine output path
            if output_path is None:
                # Create temp file with .mp3 extension
                temp_fd, temp_path = tempfile.mkstemp(suffix=".mp3")
                os.close(temp_fd)  # Close the file descriptor
                output_path = Path(temp_path)
            else:
                output_path = Path(output_path)

            # Export to MP3
            processed_audio.export(
                str(output_path),
                format=cls.TARGET_FORMAT,
                bitrate=bitrate or cls.MP3_BITRATE,
                parameters=["-ar", str(cls.TARGET_SAMPLE_RATE)],  # Ensure sample rate
            )

        except Exception as exc:
            logger.exception("Failed to process audio file: %s", input_path)
            raise AudioProcessingError(f"Audio processing failed: {exc}") from exc
        else:
            logger.info(
                "Audio processed successfully: %s (%.2f seconds, %d bytes)",
                output_path,
                len(processed_audio) / 1000.0,
                output_path.stat().st_size,
            )

            return output_path

    @classmethod
    def _convert_audio(cls, audio: AudioSegment) -> AudioSegment:
        """Convert audio to Skelly-compatible format.

        Args:
            audio: Input AudioSegment

        Returns:
            Converted AudioSegment (8kHz mono)
        """
        # Convert to mono if stereo
        if audio.channels > 1:
            logger.debug("Converting from %d channels to mono", audio.channels)
            audio = audio.set_channels(cls.TARGET_CHANNELS)

        # Resample to 8 kHz if needed
        if audio.frame_rate != cls.TARGET_SAMPLE_RATE:
            logger.debug(
                "Resampling from %d Hz to %d Hz",
                audio.frame_rate,
                cls.TARGET_SAMPLE_RATE,
            )
            audio = audio.set_frame_rate(cls.TARGET_SAMPLE_RATE)

        return audio

    @classmethod
    def process_to_wav_bytes(
        cls,
        input_path: str | Path,
        target_sample_rate: int | None = None,
        target_channels: int | None = None,
        normalize_gain: bool = True,
        target_peak_db: float = -9.0,
    ) -> bytes:
        """Process audio file and return WAV data as bytes.

        Args:
            input_path: Path to input audio file (any format supported by pydub)
            target_sample_rate: Target sample rate (default: no resampling)
            target_channels: Target channels (default: no conversion)
            normalize_gain: Whether to normalize audio gain (default: True)
            target_peak_db: Target peak level in dB, between -12 and -6 (default: -9)

        Returns:
            WAV file data as bytes

        Raises:
            AudioProcessingError: If processing fails
            FileNotFoundError: If input file doesn't exist
        """
        input_path = Path(input_path)
        if not input_path.exists():
            raise FileNotFoundError(f"Input audio file not found: {input_path}")

        # Validate target_peak_db is in acceptable range
        if not -12.0 <= target_peak_db <= -6.0:
            logger.warning(
                "target_peak_db %.1f dB is outside recommended range [-12, -6], clamping",
                target_peak_db,
            )
            target_peak_db = max(-12.0, min(-6.0, target_peak_db))

        logger.info("Processing audio file to WAV: %s", input_path)

        try:
            # Load audio file (pydub auto-detects format)
            audio = AudioSegment.from_file(str(input_path))
            logger.debug(
                "Loaded audio: %d Hz, %d channels, %.2f seconds",
                audio.frame_rate,
                audio.channels,
                len(audio) / 1000.0,
            )

            # Convert to target channels if specified
            if target_channels and audio.channels != target_channels:
                logger.debug(
                    "Converting from %d channels to %d channels",
                    audio.channels,
                    target_channels,
                )
                audio = audio.set_channels(target_channels)

            # Resample if target sample rate specified
            if target_sample_rate and audio.frame_rate != target_sample_rate:
                logger.debug(
                    "Resampling from %d Hz to %d Hz",
                    audio.frame_rate,
                    target_sample_rate,
                )
                audio = audio.set_frame_rate(target_sample_rate)

            # Normalize gain if requested
            if normalize_gain:
                # Get current peak level in dBFS (dB relative to full scale)
                current_peak_db = audio.max_dBFS
                logger.debug("Current peak level: %.1f dBFS", current_peak_db)

                # Calculate gain adjustment needed
                # If audio is quieter than target, increase gain
                # If audio is louder than target, decrease gain
                gain_adjustment = target_peak_db - current_peak_db
                logger.debug(
                    "Applying gain adjustment: %.1f dB (target: %.1f dBFS)",
                    gain_adjustment,
                    target_peak_db,
                )

                # Apply gain adjustment
                audio = audio.apply_gain(gain_adjustment)

                # Verify final level
                final_peak_db = audio.max_dBFS
                logger.debug("Final peak level: %.1f dBFS", final_peak_db)

            # Export to WAV format in memory
            buffer = BytesIO()
            audio.export(buffer, format="wav")
            wav_data = buffer.getvalue()

        except Exception as exc:
            logger.exception("Failed to process audio file: %s", input_path)
            raise AudioProcessingError(f"Audio processing failed: {exc}") from exc
        else:
            logger.info(
                "Audio processed successfully: %.2f seconds, %d bytes",
                len(audio) / 1000.0,
                len(wav_data),
            )

            return wav_data

    @classmethod
    def validate_audio(cls, file_path: str | Path) -> dict[str, any]:
        """Validate and get info about an audio file.

        Args:
            file_path: Path to audio file

        Returns:
            Dictionary with audio info:
            - sample_rate: Current sample rate in Hz
            - channels: Number of audio channels
            - duration_seconds: Length of audio in seconds
            - format: File format
            - needs_conversion: Whether conversion is needed for Skelly

        Raises:
            AudioProcessingError: If file cannot be read
            FileNotFoundError: If file doesn't exist
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        try:
            audio = AudioSegment.from_file(str(file_path))

            needs_conversion = (
                audio.frame_rate != cls.TARGET_SAMPLE_RATE
                or audio.channels != cls.TARGET_CHANNELS
                or file_path.suffix.lower() != f".{cls.TARGET_FORMAT}"
            )

            return {
                "sample_rate": audio.frame_rate,
                "channels": audio.channels,
                "duration_seconds": len(audio) / 1000.0,
                "format": file_path.suffix.lstrip(".").lower(),
                "needs_conversion": needs_conversion,
            }

        except Exception as exc:
            logger.exception("Failed to validate audio file: %s", file_path)
            raise AudioProcessingError(f"Audio validation failed: {exc}") from exc
