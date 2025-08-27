#!/bin/bash
set -e

# Configuration
GITHUB_TOKEN=${GITHUB_TOKEN}
REPO_OWNER=${REPO_OWNER}
REPO_NAME=${REPO_NAME}
CHART_NAME=${CHART_NAME}
CHART_VERSION=${CHART_VERSION}
HELM_REPO_DIR=${HELM_REPO_DIR}

# Create directory
mkdir -p "$HELM_REPO_DIR"

# Get raw GitHub URL for chart file
CHART_URL=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/contents/helm-repo/$CHART_NAME-$CHART_VERSION.tgz" | \
  jq -r '.download_url' | sed 's/?token=[^&]*//')

# Calculate digest
DIGEST=$(curl -s "$CHART_URL" | sha256sum | cut -d' ' -f1)

# Default: use current time
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000000Z")
CREATED=$NOW

if [ -f "$HELM_REPO_DIR/index.yaml" ]; then
  # Use yq to extract fields
  EXISTING_DIGEST=$(yq '.entries."'$CHART_NAME'"[0].digest' "$HELM_REPO_DIR/index.yaml")
  EXISTING_CREATED=$(yq '.entries."'$CHART_NAME'"[0].created' "$HELM_REPO_DIR/index.yaml")
  EXISTING_GENERATED=$(yq '.generated' "$HELM_REPO_DIR/index.yaml")
  if [ "$DIGEST" = "$EXISTING_DIGEST" ]; then
    CREATED=$EXISTING_CREATED
    NOW=$EXISTING_GENERATED
  fi
fi

# Create index.yaml with raw GitHub URL
cat > "$HELM_REPO_DIR/index.yaml" <<EOF
apiVersion: v1
entries:
  $CHART_NAME:
  - apiVersion: v2
    appVersion: 1.0.1
    created: "$CREATED"
    description: A Helm chart for all dex apps
    digest: $DIGEST
    icon: https://icon.png
    name: $CHART_NAME
    type: application
    urls:
    - $CHART_URL
    version: $CHART_VERSION
generated: "$NOW"
EOF

echo "Raw GitHub URL repository created successfully!"