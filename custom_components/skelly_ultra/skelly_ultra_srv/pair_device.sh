#!/bin/bash
# Helper script to manually pair a Bluetooth device
# Usage: ./pair_device.sh <MAC_ADDRESS> <PIN>
#
# Example: ./pair_device.sh F5:A1:BC:80:63:EC 1234

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <MAC_ADDRESS> <PIN>"
    echo "Example: $0 F5:A1:BC:80:63:EC 1234"
    exit 1
fi

MAC="$1"
PIN="$2"

echo "=== Bluetooth Device Pairing Helper ==="
echo "Device MAC: $MAC"
echo "PIN: $PIN"
echo ""
echo "This script will guide you through pairing your Bluetooth device."
echo "When bluetoothctl asks for a PIN, enter: $PIN"
echo ""
read -p "Press Enter to start bluetoothctl..."

# Create a command file for bluetoothctl
cat << EOF | bluetoothctl
power on
agent on
default-agent
scan on
EOF

echo ""
echo "Scanning for devices..."
sleep 5

cat << EOF | bluetoothctl
scan off
pair $MAC
EOF

echo ""
echo "=== Pairing Instructions ==="
echo "1. If prompted 'Confirm passkey', type 'yes' and press Enter"
echo "2. If prompted 'Enter PIN code', type '$PIN' and press Enter"
echo ""
echo "After pairing, run these commands in bluetoothctl:"
echo "  trust $MAC"
echo "  connect $MAC"
echo ""
echo "Or use the REST API to connect:"
echo "  curl -X POST http://localhost:8765/connect_by_mac \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mac\": \"$MAC\", \"pin\": \"$PIN\"}'"
