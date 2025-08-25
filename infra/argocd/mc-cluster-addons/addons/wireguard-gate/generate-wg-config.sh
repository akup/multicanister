#!/bin/bash

# Generate WireGuard configuration using shared values
# Usage: ./generate-wg-config.sh <pod-private-key> <pod-ip> <output-file>

set -e

POD_PRIVATE_KEY="$1"
POD_IP="$2"
OUTPUT_FILE="$3"

if [ -z "$POD_PRIVATE_KEY" ] || [ -z "$POD_IP" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: $0 <pod-private-key> <pod-ip> <output-file>"
    exit 1
fi

# Read shared configuration
SERVER_PUBLIC_KEY=$(cat /shared-config/server-public-key)
GATEWAY_SERVER_IP=$(cat /shared-config/gateway-server-ip)
GATEWAY_SERVER_PORT=$(cat /shared-config/gateway-server-port)

# Read template
TEMPLATE=$(cat /shared-config/wg-client-template)

# Replace variables in template
CONFIG=$(echo "$TEMPLATE" | sed \
    -e "s/\${POD_PRIVATE_KEY}/$POD_PRIVATE_KEY/g" \
    -e "s/\${POD_IP}/$POD_IP/g" \
    -e "s/\${SERVER_PUBLIC_KEY}/$SERVER_PUBLIC_KEY/g" \
    -e "s/\${GATEWAY_SERVER_IP}/$GATEWAY_SERVER_IP/g" \
    -e "s/\${GATEWAY_SERVER_PORT}/$GATEWAY_SERVER_PORT/g")

# Write configuration
echo "$CONFIG" > "$OUTPUT_FILE"

echo "Generated WireGuard configuration for pod $POD_IP"
echo "Output file: $OUTPUT_FILE" 