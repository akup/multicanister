#!/bin/bash

# Input validation
if [ "$#" -ne 6 ]; then
    echo "Error: Required arguments missing"
    echo "Usage: $0 TEMPLATE_PATH CREDENTIALS_NAME ORGANIZATION_URL APP_ID INSTALLATION_ID APP_PRIVATE_KEY_PATH"
    exit 1
fi

TEMPLATE_PATH=$1
CREDENTIALS_NAME=$2
ORGANIZATION_URL=$3
APP_ID=$4  
INSTALLATION_ID=$5
APP_PRIVATE_KEY_PATH=$6

# Validate template exists
if [ ! -f "$TEMPLATE_PATH" ]; then
    echo "Error: Template file $TEMPLATE_PATH not found"
    exit 1
fi

# Validate private key exists
if [ ! -f "$APP_PRIVATE_KEY_PATH" ]; then
    echo "Error: Private key file $APP_PRIVATE_KEY_PATH not found" 
    exit 1
fi

# Read template
template=$(cat "$TEMPLATE_PATH")

# Base64 encode values
ORGANIZATION_URL_B64=$(echo -n "$ORGANIZATION_URL" | base64)
APP_ID_B64=$(echo -n "$APP_ID" | base64)
INSTALLATION_ID_B64=$(echo -n "$INSTALLATION_ID" | base64)
APP_PRIVATE_KEY_B64=$(cat "$APP_PRIVATE_KEY_PATH" | base64 | tr -d '\n')

# Replace placeholders
echo "$template" | \
sed "s|\${CREDENTIALS_NAME}|$CREDENTIALS_NAME|g" | \
sed "s|\${ORGANIZATION_URL}|$ORGANIZATION_URL_B64|g" | \
sed "s|\${APP_ID}|$APP_ID_B64|g" | \
sed "s|\${INSTALLATION_ID}|$INSTALLATION_ID_B64|g" | \
awk -v key="$APP_PRIVATE_KEY_B64" '{gsub(/\${APP_PRIVATE_KEY}/, key); print}'
