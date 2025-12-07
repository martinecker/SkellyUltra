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
    # Python GObject bindings (required for pydbus)
    python3-gi \
    python3-gi-cairo \
    gir1.2-glib-2.0 \
    # Audio format support
    ffmpeg \
    # Utilities
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy package configuration and install Python dependencies
COPY pyproject.toml .
COPY . ./skelly_ultra_srv

# Make system-installed gi module available to pip's Python by copying (not symlinking)
# This is more reliable than symlinks which can break
RUN echo "Checking for gi module..." && \
    ls -la /usr/lib/python3/dist-packages/ | grep gi || echo "No gi in dist-packages" && \
    ls -la /usr/lib/python3.11/dist-packages/ | grep gi || echo "No gi in python3.11/dist-packages" && \
    echo "Copying gi module..." && \
    cp -r /usr/lib/python3/dist-packages/gi /usr/local/lib/python3.11/site-packages/ 2>&1 || \
    cp -r /usr/lib/python3.11/dist-packages/gi /usr/local/lib/python3.11/site-packages/ 2>&1 && \
    cp /usr/lib/python3/dist-packages/_gi*.so /usr/local/lib/python3.11/site-packages/ 2>/dev/null || \
    cp /usr/lib/python3.11/dist-packages/_gi*.so /usr/local/lib/python3.11/site-packages/ 2>/dev/null || true && \
    echo "Verifying gi import..." && \
    python3 -c "import gi; print('gi module successfully available')"

# Install Python dependencies
RUN pip install --no-cache-dir -e .

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
