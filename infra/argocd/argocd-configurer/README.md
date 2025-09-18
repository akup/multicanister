# Cluster API Configuration Server

A Python HTTP server that provides cluster information and ArgoCD repositories and docker registry secrets management for Kubernetes clusters.

## Quick Start Guide

### Overview

- **Docker Secrets**: Used for pulling images from private repositories. Name them according to your pods' `imagePullSecrets` and place them in all namespaces where the corresponding pods run.
- **Helm Repository Secrets**: Used by ArgoCD to download Helm charts from private repositories.

//TODO: add multiple helm secrets with different source urls and same credentials.
//TODO: add type helm or git for adding repository secrets

### 1. Start the Server

```bash
# Start the server on port 8091
python server.py --port 8091

# Or use the server manager script
./server_manager.sh start
```

### 2. Check Server Health

```bash
curl http://localhost:8091/health
```

### 3. List Available Clusters

```bash
curl http://localhost:8091/clusters
```

### 4. View Secrets in a Cluster

```bash
curl "http://localhost:8091/secrets?cluster=test-cluster"
```

### 5. Add Docker Registry Secret

```bash
curl -X POST http://localhost:8091/secrets/add_docker \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your_token",
    "username": "your_username",
    "cluster_name": "test-cluster",
    "name": "my-docker-secret",
    "namespaces": "kube-system,default"
  }'
```

### 6. Add Helm Repository Secret

```bash
curl -X POST http://localhost:8091/secrets/add_helm_repo \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-helm-repo",
    "repository_url": "charts.bitnami.com/bitnami",
    "cluster_name": "test-cluster",
    "username": "helmuser",
    "password": "helmpass123",
    "use_oci": false
  }'
```

### 7. Run Tests

```bash
python test_client.py
```

## Features

- **Health Monitoring**: Server health check endpoint
- **Cluster Discovery**: Lists available clusters from kubeconfig files
- **Secrets Management**: Retrieves secrets from Kubernetes clusters using kubectl
- **Parallel Execution**: Efficient parallel kubectl commands for faster response times
- **Configurable Timeouts**: Adjustable timeout settings for kubectl operations
- **CORS Support**: Cross-origin resource sharing enabled
- **Comprehensive Logging**: Detailed logging of all operations
- **Error Handling**: Proper error responses with meaningful messages

## How to add helm repo token

To add a GitHub Container Registry (ghcr.io) Helm repository using a GitHub Personal Access Token (PAT), use the `/secrets/add_helm_repo` endpoint:

**Request:**

```bash
curl -X POST http://localhost:8091/secrets/add_helm_repo \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ghcr-helm-repo",
    "repository_url": "https://ghcr.io/",
    "cluster_name": "test-cluster",
    "username": "your-github-username",
    "password": "ghp_your_personal_access_token_here",
    "upsert": false
  }'
```

**Notes:**

- **Repository URL**: Use `https://ghcr.io/*` for GitHub Container Registry
- **Username**: Your GitHub username
- **Password**: Your GitHub Personal Access Token (PAT) with appropriate permissions
- **Secret Name**: Choose a descriptive name for your helm repository secret
- **Upsert**: Set to `true` if you want to replace an existing secret with the same name

**Required PAT Permissions:**

Your GitHub Personal Access Token should have the following permissions:

- `read:packages` - To read container packages
- `repo` - To access private repositories (if using private packages)

**Verification:**

After creating the secret, you can verify it was created correctly:

```bash
# Check the secret in the argocd namespace
kubectl get secret ghcr-helm-repo -n argocd -o yaml

# Verify the secret has the correct label
kubectl get secret ghcr-helm-repo -n argocd --show-labels
```

The secret will be created in the `argocd` namespace with the label `argocd.argoproj.io/secret-type=repository` and can be used by ArgoCD to authenticate with your GitHub Container Registry Helm repository.

## API Endpoints

### GET /health

Returns server health status.

**Response:**

```json
{
  "status": "healthy",
  "service": "Cluster API Configuration Server",
  "timestamp": "Fri, 11 Jul 2025 15:14:35 GMT"
}
```

### GET /clusters

Lists all available clusters by scanning the configured clusters folder for `.kubeconfig` files.

**Response:**

```json
{
  "clusters": [
    "production-cluster",
    "test-cluster"
  ],
  "total": 2
}
```

### GET /secrets?cluster={cluster-name}

Retrieves secrets from a specific Kubernetes cluster. Requires the `cluster` parameter.

**Parameters:**

- `cluster` (required): Name of the cluster to query

**Response:**

```json
{
  "cluster": "test-cluster",
  "repo_creds_secrets": [
    {
      "name": "repo-creds-secret",
      "namespace": "argocd",
      "labels": {
        "argocd.argoproj.io/secret-type": "repo-creds"
      },
      "type": "Opaque",
      "creation_timestamp": "2025-07-11T10:00:00Z"
    }
  ],
  "docker_creds_secrets": [
    {
      "name": "docker-registry-secret",
      "namespace": "default",
      "labels": {
        "jjo.finance/secret-type": "docker-creds"
      },
      "type": "kubernetes.io/dockerconfigjson",
      "creation_timestamp": "2025-07-11T10:00:00Z"
    }
  ],
  "helm_creds_secrets": [
    {
      "name": "helm-repo-secret",
      "namespace": "argocd",
      "labels": {
        "argocd.argoproj.io/secret-type": "repository"
      },
      "type": "Opaque",
      "creation_timestamp": "2025-07-11T10:00:00Z"
    }
  ],
  "total_repo_creds": 1,
  "total_docker_creds": 1,
  "total_helm_creds": 1,
  "status": "success"
}
```

**Error Responses:**

Missing cluster parameter:

```json
{
  "error": true,
  "message": "Missing required parameter 'cluster'",
  "status_code": 400
}
```

Cluster not found:

```json
{
  "error": true,
  "message": "Cluster 'non-existent' not found. No kubeconfig file at clusters/non-existent.kubeconfig",
  "status_code": 404
}
```

Cluster unreachable:

```json
{
  "cluster": "test-cluster",
  "repo_creds_secrets": [],
  "docker_creds_secrets": [],
  "total_repo_creds": 0,
  "total_docker_creds": 0,
  "status": "cluster_unreachable",
  "message": "Cannot connect to cluster. Please check if the cluster is running and accessible."
}
```

Timeout:

```json
{
  "cluster": "test-cluster",
  "repo_creds_secrets": [],
  "docker_creds_secrets": [],
  "total_repo_creds": 0,
  "total_docker_creds": 0,
  "status": "timeout",
  "message": "Commands timed out after 10 seconds"
}
```

### POST /secrets/add_docker

Adds a Docker registry secret to the kube-system namespace and an ArgoCD image updater secret to the argocd namespace in a specific cluster.

**Parameters:**

- `password` (required): Password/token for Docker registry authentication
- `username` (required): Username for Docker registry authentication
- `cluster_name` (required): Name of the cluster
- `name` (required): Name of the secret
- `namespaces` (required): Comma-separated list of namespaces where secrets should be created (argocd namespace is prohibited)
- `upsert` (optional): If true, replaces existing secrets; if false, returns error if secrets exist

**Request Body:**

```json
{
  "password": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "username": "myuser",
  "cluster_name": "test-cluster",
  "name": "my-docker-secret",
  "namespaces": "kube-system,argocd",
  "upsert": false
}
```

**Success Response:**

```json
{
  "success": true,
  "cluster": "test-cluster",
  "name": "my-docker-secret",
  "namespaces": ["kube-system", "argocd"],
  "results": [
    {
      "namespace": "kube-system",
      "result": {
        "success": true,
        "namespace": "kube-system",
        "output": "secret/my-docker-secret created"
      }
    },
    {
      "namespace": "argocd",
      "result": {
        "success": true,
        "namespace": "argocd",
        "output": "secret/my-docker-secret created"
      }
    }
  ],
  "message": "Docker registry secrets created successfully in 2 namespace(s)"
}
```

**Error Responses:**

Secrets already exist (when upsert=false):

```json
{
  "error": true,
  "message": "Secrets already exist in namespaces: kube-system, argocd",
  "existing_secrets": {
    "kube-system": {
      "exists": true,
      "description": {
        "name": "my-docker-secret",
        "namespace": "kube-system",
        "type": "kubernetes.io/dockerconfigjson",
        "labels": {
          "mcops.tech/secret-type": "docker-creds"
        }
      }
    },
    "argocd": {
      "exists": true,
      "description": {
        "name": "my-docker-secret",
        "namespace": "argocd",
        "type": "kubernetes.io/dockerconfigjson",
        "labels": {
          "mcops.tech/secret-type": "docker-creds"
        }
      }
    }
  },
  "upsert_required": true
}
```

Missing required field:

```json
{
  "error": true,
  "message": "Missing required field: username",
  "status_code": 400
}
```

Cluster not found:

```json
{
  "error": true,
  "message": "Cluster 'non-existent' not found. No kubeconfig file at clusters/non-existent.kubeconfig",
  "status_code": 400
}
```

### POST /secrets/add_helm_repo

Adds a Helm repository secret to the ArgoCD namespace in a specific cluster.

**Parameters:**

- `name` (required): Name of the secret
- `repository_url` (required): URL of the Helm repository
- `cluster_name` (required): Name of the cluster
- `username` (required): Username for the Helm repository
- `password` (required): Password for the Helm repository
- `upsert` (optional): If true, replaces existing secret; if false, returns error if secret exists

**Request Body:**

```json
{
  "name": "my-helm-repo",
  "repository_url": "https://charts.bitnami.com/bitnami",
  "cluster_name": "test-cluster",
  "username": "helmuser",
  "password": "helmpass123",
  "upsert": false
}
```

**Success Response:**

```json
{
  "success": true,
  "cluster": "test-cluster",
  "secret_name": "my-helm-repo",
  "repository_url": "https://charts.bitnami.com/bitnami",
  "helm_secret_applied": {
    "success": true,
    "namespace": "argocd",
    "output": "secret/my-helm-repo created"
  },
  "message": "Helm repository secret created successfully"
}
```

**Error Responses:**

Secret already exists (when upsert=false):

```json
{
  "error": true,
  "message": "Helm repository secret already exists",
  "existing_secret": {
    "exists": true,
    "description": {
      "name": "my-helm-repo",
      "namespace": "argocd",
      "type": "Opaque",
      "labels": {
        "argocd.argoproj.io/secret-type": "repository"
      }
    }
  },
  "upsert_required": true
}
```

Missing required field:

```json
{
  "error": true,
  "message": "Missing required field: username",
  "status_code": 400
}
```

Cluster not found:

```json
{
  "error": true,
  "message": "Cluster 'non-existent' not found. No kubeconfig file at clusters/non-existent.kubeconfig",
  "status_code": 400
}
```

## Configuration

The server uses configuration from `configs/defaults.yaml`:

```yaml
clusters-folder: "clusters"
kubectl_timeout: 10
```

### Configuration Options

- `clusters-folder`: Directory containing `.kubeconfig` files (default: "clusters")
- `kubectl_timeout`: Timeout in seconds for kubectl commands (default: 30)

## Server Management

Use the provided server manager script for easy server control:

```bash
# Start the server
./server_manager.sh start

# Stop the server
./server_manager.sh stop

# Restart the server
./server_manager.sh restart

# Check server status
./server_manager.sh status

# View live logs
./server_manager.sh logs
```

The script automatically:

- Manages the virtual environment
- Captures and stores the process ID
- Redirects output to log files
- Provides graceful shutdown
- Shows server status and recent logs

## Development

For development with auto-reload functionality:

### Quick Start

```bash
# Start development server with auto-reload
./dev.sh
```

### Manual Development Setup

```bash
# Activate virtual environment
source venv/bin/activate

# Install development dependencies
pip install -r requirements.txt

# Start auto-reload server
python dev_server.py
```

### Auto-Reload Features

- **Automatic restarts** when Python files (`.py`) change
- **Config file monitoring** for `.yaml` and `.json` files
- **Debounced restarts** to avoid multiple restarts for rapid changes
- **Clean process management** with graceful shutdown
- **Real-time logging** of file changes and server restarts

### Development Workflow

1. Start the development server: `./dev.sh`
2. Edit your code files (server.py, secrets_handler.py, etc.)
3. Save changes - server automatically restarts
4. Test your changes immediately
5. No manual server restarts needed!

## Manual Setup

If you prefer to run the server manually:

1. **Create Virtual Environment:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Run Server:**

   ```bash
   python server.py --port 8091
   ```

## File Structure

```txt
argocd-configurer/
├── server.py              # Main server application
├── secrets_handler.py     # Secrets management logic
├── server_manager.sh      # Server management script
├── requirements.txt       # Python dependencies
├── test_client.py         # Test client for API testing
├── clusters/              # Kubeconfig files directory
│   ├── test-cluster.kubeconfig
│   └── production-cluster.kubeconfig
├── configs/               # Configuration files
│   └── defaults.yaml      # Server configuration
├── server.pid            # Server process ID (auto-generated)
├── server.log            # Server logs (auto-generated)
└── README.md             # This file
```

## Testing

Run the test client to verify all functionality:

```bash
python test_client.py
```

### Manual Testing

Test the endpoints manually:

```bash
# Health check
curl -s http://localhost:8091/health | jq .

# List clusters
curl -s http://localhost:8091/clusters | jq .

# Get secrets for a cluster
curl -s "http://localhost:8091/secrets?cluster=test-cluster" | jq .

# Test error handling
curl -s "http://localhost:8091/secrets" | jq .
curl -s "http://localhost:8091/secrets?cluster=non-existent" | jq .
```

## Secrets Management

The server retrieves two types of secrets from Kubernetes clusters:

### Repository Credentials Secrets

- **Label**: `argocd.argoproj.io/secret-type=repo-creds`
- **Purpose**: ArgoCD repository credentials for Git repositories
- **Usage**: Used by ArgoCD to authenticate with Git repositories

### Docker Credentials Secrets

- **Label**: `jjo.finance/secret-type=docker-creds`
- **Purpose**: Docker registry credentials
- **Usage**: Used for pulling images from private Docker registries

### Helm Repository Credentials Secrets

- **Label**: `argocd.argoproj.io/secret-type=helm-repo-creds`
- **Purpose**: Helm repository credentials for private Helm charts
- **Usage**: Used by ArgoCD to authenticate with private Helm repositories

### Parallel Execution

The server uses parallel execution to improve performance:

- **Two kubectl commands run simultaneously**: One for repo-creds, one for docker-creds
- **Configurable timeout**: Both commands share the same timeout setting
- **Efficient resource usage**: Uses thread pool for parallel execution
- **Better response times**: Reduces total response time significantly

## Error Handling

The server returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (missing parameters, validation errors)
- `404`: Not Found (cluster not found)
- `500`: Internal Server Error

Error responses include detailed error messages to help with debugging.

## Logging

The server provides comprehensive logging including:

- Request processing
- Kubectl command execution
- Connection errors and timeouts
- File operations
- Server lifecycle events

Logs are written to `server.log` when using the server manager script.

## Use Cases

### Cluster Discovery

Use the `/clusters` endpoint to:

- Discover available clusters
- Get cluster inventory
- Verify cluster accessibility

### Secrets Monitoring

Use the `/secrets` endpoint to:

- Monitor repository credentials across clusters
- Track Docker registry credentials
- Audit secret configurations
- Verify secret accessibility

### Health Monitoring

Use the `/health` endpoint to:

- Monitor server status
- Verify service availability
- Integrate with monitoring systems
