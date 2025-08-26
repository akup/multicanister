# App Helm Chart

A comprehensive Helm chart for deploying applications with configurable settings for various Kubernetes resources.

## Overview

This chart provides a flexible way to deploy applications with support for:

- Deployment with configurable replicas and update strategies
- Service with multiple port configurations
- Ingress with SSL and annotations
- Persistent Volume Claims
- Service Accounts
- Init Containers
- Custom launch commands and arguments
- Resource limits and requests
- Node selectors and tolerations
- Health checks and probes

## Installation

```bash
# Add the repository
helm repo add dex-apps file://../../app-helm-chart

# Install the chart
helm install my-app dex-apps/app-helm-chart --values values.yaml
```

## Configuration

### Chart Metadata

| Parameter | Description | Default |
|-----------|-------------|---------|
| `nameOverride` | Override the chart name | `""` |
| `fullnameOverride` | Override the full name | `""` |

### Application Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `env` | Environment name | `""` |
| `setupType` | Setup producer name in kafka queue | `""` |
| `replicaCount` | Number of replicas | `1` |
| `statefulSet.enabled` | Choose between Deployment (false) or StatefulSet (true) | `false` |
| `statefulSet.podManagementPolicy` | Pod management policy for StatefulSet (OrderedReady, Parallel) | `OrderedReady` |
| `revisionHistoryLimit` | Number of revisions to keep | `5` |

### Update Strategy

| Parameter | Description | Default |
|-----------|-------------|---------|
| `updateStrategy.type` | Update strategy type (Recreate, RollingUpdate) | `Recreate` |
| `updateStrategy.rollingUpdate.maxUnavailable` | Max unavailable pods during rolling update | `0` |
| `updateStrategy.rollingUpdate.maxSurge` | Max surge pods during rolling update | `1` |

### Image Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Docker image repository | `""` |
| `image.tag` | Docker image tag | `""` |
| `image.pullPolicy` | Image pull policy (Always, IfNotPresent, Never) | `Always` |

### Image Pull Secrets

| Parameter | Description | Default |
|-----------|-------------|---------|
| `imagePullSecrets` | List of image pull secrets | `[{"name": "dex-registry"}]` |

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.alwaysRedeploy` | Always redeploy on every release | `true` |
| `global.terminationGracePeriodSeconds` | Grace period for pod termination | `30` |
| `global.shareProcessNamespace` | Share process namespace between containers | `false` |

### Init Container

| Parameter | Description | Default |
|-----------|-------------|---------|
| `initContainer.enabled` | Enable init container | `false` |
| `initContainer.name` | Init container name | `db-boostrap` |
| `initContainer.image.repository` | Init container image repository | `ghcr.io/jjoinvest/db-boostrap` |
| `initContainer.image.tag` | Init container image tag | `1.0.0` |
| `initContainer.image.pullPolicy` | Init container image pull policy | `Always` |
| `initContainer.env_vars` | Environment variables for init container | `{}` |

### Host Aliases

| Parameter | Description | Default |
|-----------|-------------|---------|
| `hostAliases` | Host aliases for the pod | `{}` |

### Secrets

| Parameter | Description | Default |
|-----------|-------------|---------|
| `secrets.enabled` | Enable secrets mounting | `false` |
| `secrets.secretsList` | List of secrets to mount | `{}` |

### Service Account

| Parameter | Description | Default |
|-----------|-------------|---------|
| `serviceAccount.create` | Create service account | `true` |
| `serviceAccount.annotations` | Service account annotations | `{}` |
| `serviceAccount.name` | Service account name (if not set, uses fullname) | `""` |

### Pod Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podAnnotations` | Additional pod annotations | `{}` |
| `podLabels` | Additional pod labels | `{}` |
| `podSecurityContext` | Pod security context | `{}` |
| `securityContext` | Container security context | `{}` |

#### Pod Labels Example

```yaml
podLabels:
  app.kubernetes.io/component: "api"
  app.kubernetes.io/part-of: "microservices"
  environment: "production"
  team: "backend"
  version: "v1.0.0"
  tier: "frontend"
  release: "stable"
```

### Pod Disruption Budget

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podDisruptionBudget.enabled` | Enable PodDisruptionBudget | `false` |
| `podDisruptionBudget.minAvailable` | Minimum available pods | `1` |
| `podDisruptionBudget.maxUnavailable` | Maximum unavailable pods | `0` |

### Service Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Service type (ClusterIP, NodePort, LoadBalancer) | `ClusterIP` |
| `service.ports` | Service ports configuration | See example below |

#### Service Ports Example

```yaml
service:
  ports:
    http:
      pod_port: 8000
      service_port: 8000
      protocol: TCP
      ingress: true
```

### Health Checks and Probes

| Parameter | Description | Default |
|-----------|-------------|---------|
| `probes` | Liveness, readiness, and startup probes | `{}` |

#### Probes Example

```yaml
probes:
  livenessProbe:
    httpGet:
      path: /status
      port: http
    initialDelaySeconds: 30
    periodSeconds: 60
    timeoutSeconds: 5
    successThreshold: 1
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /status
      port: http
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    successThreshold: 1
    failureThreshold: 3
```

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.annotations` | Ingress annotations | See example below |
| `ingress.hosts` | Ingress hosts configuration | See example below |
| `ingress.tls` | TLS configuration | See example below |

#### Ingress Example

```yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-http
  hosts:
    - host: example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: example-tls
      hosts:
        - example.com
```

### Multiple Hosts with Different Service Ports

```yaml
service:
  type: ClusterIP
  ports:
    api:
      pod_port: 4944
      service_port: 80
      protocol: TCP
      ingress: true
    admin:
      pod_port: 8080
      service_port: 8080
      protocol: TCP
      ingress: true
    metrics:
      pod_port: 9090
      service_port: 9090
      protocol: TCP
      ingress: true

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
          servicePort: 80      # Route to API service
    - host: admin.example.com
      paths:
        - path: /
          pathType: Prefix
          servicePort: 8080    # Route to admin service
    - host: metrics.example.com
      paths:
        - path: /
          pathType: Prefix
          servicePort: 9090    # Route to metrics service
```

**Access:**

- `http://api.example.com` → Service port 80 (API)
- `http://admin.example.com` → Service port 8080 (Admin)
- `http://metrics.example.com` → Service port 9090 (Metrics)

### With Persistence

```yaml
persistence:
  enabled: true
  pvc:
    enabled: true
    pvcList:
      data:
        storageClass: fast-ssd
        accessMode: ReadWriteOnce
        size: 10Gi
        mountPath: /app/data
        readOnly: false
```

### With StatefulSet

```yaml
# Enable StatefulSet
statefulSet:
  enabled: true
  podManagementPolicy: "OrderedReady"

# Persistence will use volumeClaimTemplates instead of PVCs
persistence:
  enabled: true
  pvc:
    enabled: true
    pvcList:
      data:
        storageClass: fast-ssd
        accessMode: ReadWriteOnce
        size: 10Gi
        mountPath: /app/data
        readOnly: false
      logs:
        storageClass: fast-ssd
        accessMode: ReadWriteOnce
        size: 5Gi
        mountPath: /app/logs
        readOnly: false
```

### With Health Checks

```yaml
probes:
  livenessProbe:
    httpGet:
      path: /health
      port: http
    initialDelaySeconds: 30
    periodSeconds: 60
  readinessProbe:
    httpGet:
      path: /ready
      port: http
    initialDelaySeconds: 5
    periodSeconds: 10
```

## Notes

- The chart automatically creates a ServiceAccount if `serviceAccount.create` is true
- PVCs are only created during initial installation, not during upgrades
- When using StatefulSet, PVCs are created automatically via volumeClaimTemplates
- The `global.alwaysRedeploy` setting adds a random annotation to force redeployment
- Custom launch commands and arguments are only applied if `customLaunch.enabled` is true
- Environment variables can be provided as a map and will be mounted as secrets
- The chart supports both HTTP and HTTPS ingress configurations
- Resource limits and requests can be configured for both CPU and memory
- StatefulSets provide stable network identities and ordered scaling/updates
