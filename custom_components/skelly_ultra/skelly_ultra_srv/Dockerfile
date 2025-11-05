# Skelly Ultra REST Server Docker Image
# Provides Bluetooth Classic audio playback support for Home Assistant integration

FROM python:3.11-slim-bookworm

# Install system dependencies for Bluetooth, audio, and D-Bus
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Bluetooth tools and libraries
    bluez \
    bluetooth \
    # Audio processing and streaming
    pipewire \
    pipewire-pulse \
    wireplumber \
    libspa-0.2-bluetooth \
    # D-Bus for automated pairing
    dbus \
    dbus-x11 \
    # Audio format support
    ffmpeg \
    # Utilities
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY . .

# Expose REST API port
EXPOSE 8765

# Set up environment for D-Bus system bus access
ENV DBUS_SYSTEM_BUS_ADDRESS=unix:path=/var/run/dbus/system_bus_socket

# Create directory for runtime files
RUN mkdir -p /tmp/skelly_audio

# Note: This container must be run with --privileged flag and host network
# to access Bluetooth hardware and D-Bus system bus
#
# Example run command:
# docker run -d \
#   --name skelly-ultra-server \
#   --privileged \
#   --network host \
#   -v /var/run/dbus:/var/run/dbus \
#   -v /run/dbus:/run/dbus \
#   skelly-ultra-server

# Start the server
CMD ["python3", "-m", "skelly_ultra_srv.server"]
