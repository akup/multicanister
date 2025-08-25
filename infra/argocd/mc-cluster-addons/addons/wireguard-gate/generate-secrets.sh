#!/bin/bash

# Generate base64-encoded private keys for Kubernetes Secrets
# Usage: ./generate-secrets.sh <private-key-file> <output-secret-name>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <private-key-file> <output-secret-name>"
    echo "Example: $0 wireguard-configs/pod1_private.key wireguard-secret-1"
    exit 1
fi

PRIVATE_KEY_FILE="$1"
SECRET_NAME="$2"

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "Error: Private key file '$PRIVATE_KEY_FILE' not found"
    exit 1
fi

# Read private key and encode to base64
PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE")
PRIVATE_KEY_BASE64=$(echo -n "$PRIVATE_KEY" | base64)

# Generate Secret YAML
cat > "${SECRET_NAME}.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET_NAME}
  namespace: wireguard-proxy
type: Opaque
data:
  pod-private-key: ${PRIVATE_KEY_BASE64}
EOF

echo "✅ Generated Secret: ${SECRET_NAME}.yaml"
echo "📝 To apply: kubectl apply -f ${SECRET_NAME}.yaml"
echo ""
echo "🔐 Private key from: $PRIVATE_KEY_FILE"
echo "📦 Secret name: $SECRET_NAME"
echo "🔒 Base64 encoded: ${PRIVATE_KEY_BASE64:0:20}..." 