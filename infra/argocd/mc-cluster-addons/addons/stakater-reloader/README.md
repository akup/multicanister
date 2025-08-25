# Stakater Reloader Addon

This addon installs the Stakater Reloader controller in your Kubernetes cluster.

## Overview

The Stakater Reloader automatically restarts pods when ConfigMaps or Secrets change, eliminating the need for manual pod restarts.

## Features

- **Automatic pod restarts** when ConfigMaps/Secrets change
- **Declarative configuration** using annotations
- **High availability** with pod anti-affinity
- **Resource limits** for predictable resource usage
- **Security context** for secure operation

## Usage

### 1. Deploy the Reloader

### 2. Add annotations to your deployments

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  annotations:
    reloader.stakater.com/auto: "true"
    reloader.stakater.com/search: "my-configmap"
spec:
  # ... deployment spec
```

### 3. Watch multiple ConfigMaps

```yaml
annotations:
  reloader.stakater.com/auto: "true"
  reloader.stakater.com/search: "config1,config2,secret1"
```

## Configuration

### Node Scheduling

The reloader is configured to run on `system-workloads` nodes:

```yaml
nodeSelector:
  kubernetes.io/os: linux
  node-role.kubernetes.io/system-workloads: ""

tolerations:
  - key: node-role
    operator: Equal
    value: system-workloads
    effect: NoExecute
  - key: node-role.kubernetes.io/control-plane
    operator: Exists
    effect: NoSchedule
```

### Resource Limits

```yaml
resources:
  requests:
    memory: "64Mi"
    cpu: "50m"
  limits:
    memory: "128Mi"
    cpu: "100m"
```

## Examples

### WireGuard Proxy with Reloader

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wireguard-proxy-1
  namespace: wireguard-proxy
  annotations:
    reloader.stakater.com/auto: "true"
    reloader.stakater.com/search: "wireguard-config"
spec:
  # ... deployment spec
```

### Cert-Manager with Reloader

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cert-manager
  namespace: cert-manager
  annotations:
    reloader.stakater.com/auto: "true"
    reloader.stakater.com/search: "cert-manager-config"
spec:
  # ... deployment spec
```

## Troubleshooting

### Check Reloader Status

```bash
kubectl get pods -n security -l app=reloader
kubectl logs -n security deployment/reloader
```

### Check Annotations

```bash
kubectl get deployment my-app -o yaml | grep -A 5 -B 5 reloader
```

### Manual Restart

If automatic restarts aren't working:

```bash
kubectl rollout restart deployment/my-app
```

## Security

- Runs with non-root user (UID 1000)
- Uses security context for pod and container
- Implements RBAC for proper permissions
- Scanned with Trivy for vulnerabilities

## Monitoring

The reloader can be monitored with:

- Pod logs: `kubectl logs -n security deployment/reloader`
- Events: `kubectl get events -n security --field-selector involvedObject.name=reloader`
- Metrics: Available via Prometheus if monitoring is enabled
