# Input variables
CLUSTER_NAME=${1}
S3_CREDENTIALS_FOLDER=${2}
S3_CREDENTIALS_FILENAME=${3}
SECRET_NAME=${4}

# Validate required inputs
if [ -z "$CLUSTER_NAME" ]; then
    echo "Error: CLUSTER_NAME is required"
    echo "Usage: $0 CLUSTER_NAME [S3_CREDENTIALS_FILE]"
    exit 1
fi

KUBECONFIG_FILE="${CLUSTER_NAME}.kubeconfig"
if [ ! -f "$KUBECONFIG_FILE" ]; then
    echo "Error: kubeconfig file $KUBECONFIG_FILE not found"
    exit 1
fi

S3_CREDENTIALS_FILE="${S3_CREDENTIALS_FOLDER}/${S3_CREDENTIALS_FILENAME}"

if [ ! -f "$S3_CREDENTIALS_FILE" ]; then
    echo "Error: Config file $S3_CREDENTIALS_FILE not found in ${S3_CREDENTIALS_FOLDER}"
    exit 1
fi

if [ -z "$SECRET_NAME" ]; then
    echo "Error: SECRET_NAME is required"
    echo "Usage: $0 CLUSTER_NAME [S3_CREDENTIALS_FILE]"
    exit 1
fi

# Extract values from JSON file using jq
# Try to find jq in common locations
JQ_CMD=""
if command -v jq &> /dev/null; then
    JQ_CMD="jq"
elif [ -x "/usr/bin/jq" ]; then
    JQ_CMD="/usr/bin/jq"
elif [ -x "/usr/local/bin/jq" ]; then
    JQ_CMD="/usr/local/bin/jq"
else
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

ACCESS_KEY_ID=$($JQ_CMD -r '.accessKey' "$S3_CREDENTIALS_FILE")
SECRET_ACCESS_KEY=$($JQ_CMD -r '.secretKey' "$S3_CREDENTIALS_FILE")

if [ "$ACCESS_KEY_ID" = "null" ] || [ "$SECRET_ACCESS_KEY" = "null" ]; then
    echo "Error: Failed to extract accessKey or secretKey from $S3_CREDENTIALS_FILE"
    exit 1
fi

# Base64 encode the credentials
ACCESS_KEY_ID_B64=$(echo -n "$ACCESS_KEY_ID" | base64)
SECRET_ACCESS_KEY_B64=$(echo -n "$SECRET_ACCESS_KEY" | base64)

# Generate Kubernetes secret YAML
cat << EOF > "${S3_CREDENTIALS_FOLDER}/${SECRET_NAME}.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  namespace: logging
type: Opaque
data:
  ACCESS_KEY_ID: $ACCESS_KEY_ID_B64
  SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY_B64
EOF

# Apply secret to kubernetes cluster
kubectl apply -f "${S3_CREDENTIALS_FOLDER}/${SECRET_NAME}.yaml" --kubeconfig "$KUBECONFIG_FILE"

#TODO: delete secret for security reasons
# rm "${S3_CREDENTIALS_FOLDER}/${SECRET_NAME}.yaml"
# rm "$S3_CREDENTIALS_FILE"


