 #!/bin/bash

# Script to download default values from remote Helm chart
# Usage: ./scripts/load-defaults.sh

set -e

echo "Downloading default values from remote chart..."

# Download default values from remote chart
helm show values app-helm-chart --repo https://jjoinvest.github.io/dex-apps > app-helm-chart-values.yaml

echo "Default values saved to app-helm-chart-values.yaml"
echo "File size: $(wc -l < app-helm-chart-values.yaml) lines"

# Optional: Show first few lines to verify
echo "First 10 lines of downloaded values:"
head -10 app-helm-chart-values.yaml