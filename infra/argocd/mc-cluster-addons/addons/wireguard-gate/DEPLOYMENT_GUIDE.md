# WireGuard + Nginx Proxy Setup Guide

## Overview

This setup creates a secure tunnel between Gateway Server (with nginx and WireGuard server) and Kubernetes Cluster (with WireGuard client pods) to proxy HTTP requests based on hostnames.

## Architecture

```txt
Internet → Gateway Server (nginx) → WireGuard Tunnel → Kubernetes Cluster
                                    ↓
                            Pod1 or Pod2 (WireGuard clients)
                                    ↓
                            Kubernetes Service (based on hostname)
```

## Prerequisites

### Gateway Server Requirements

- Ubuntu/Debian system
- WireGuard installed
- Nginx installed
- Root access

### Kubernetes Cluster Requirements

- Kubernetes cluster with access to internet
- kubectl configured
- Namespace creation permissions

## Step 1: Generate Configuration

1. **Install wireguard and nginx:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install wireguard

# RHEL/CentOS
# sudo yum install epel-release
# sudo yum install wireguard-tools

# macOS
# brew install wireguard-tools
```

<!-- markdownlint-disable-next-line MD029 -->
2. **Run the setup script:**

```bash
chmod +x setup-gate.sh
./setup-gate.sh
```

<!-- markdownlint-disable-next-line MD029 -->
3. **The script will generate:**

   - WireGuard keys for server and pods
   - Server configuration files
   - Shared Kubernetes configuration files
   - Individual pod configuration files

## Step 2: Configure Gateway Server

### Install WireGuard

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install wireguard

# Enable IP forwarding
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Install Nginx

```bash
sudo apt install nginx
```

### Configure WireGuard

```bash
# Copy the generated config
sudo cp server-configs/wg0.conf /etc/wireguard/

# Set proper permissions
sudo chmod 600 /etc/wireguard/wg0.conf

# Start WireGuard
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

### Configure Nginx

```bash
# Copy the nginx config
sudo cp server-configs/nginx.conf /etc/nginx/sites-available/wireguard-proxy

# Enable the site
sudo ln -s /etc/nginx/sites-available/wireguard-proxy /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Step 3: Deploy Kubernetes Resources

### Create Namespace

It should be done via ArgoCD

```bash
kubectl create namespace wireguard-proxy
```

### Apply Shared Configuration

1. **Apply the shared configuration first:**

It should be done via ArgoCD. Don't use manual apply like:

```bash
kubectl apply -f k8s-configs/wireguard-shared-config.yaml
```

Just copy `k8s-configs/wireguard-shared-config.yaml` to `wireguard-shared-data.yaml` in ArgoCD addon folder.

### Deploy WireGuard Proxy Pods

<!-- markdownlint-disable-next-line MD029 -->
2. **Deploy the Secrets:**

Secrets should be generated and applyed to cluster. Thuis part should not use ArgoCD, because secrets should never appear in git.

```bash
kubectl apply -f k8s-configs/wireguard-pod-secrets.yaml --kubeconfig /home/k0s/your-cluster.kubeconfig
```

<!-- markdownlint-disable-next-line MD029 -->
3. **Update the nginx configuration** in the ConfigMap to include your services:

```conf
upstream test-app-backend {
  server test-app.dev-dex.svc.cluster.local:80;
}
```

`test-app-backend` will be used as a host and redirect to `test-app` service in `dev-dex` namespace.

### Verify Shared Configuration

```bash
# Check shared config
kubectl get configmap -n wireguard-proxy wireguard-shared-config -o yaml

# Check pod-specific configs
kubectl get configmap -n wireguard-proxy wireguard-config-1 -o yaml
kubectl get configmap -n wireguard-proxy wireguard-config-2 -o yaml

# Check secrets (base64 encoded)
kubectl get secret -n wireguard-proxy wireguard-secret-1 -o yaml
kubectl get secret -n wireguard-proxy wireguard-secret-2 -o yaml
```

## Step 4: Verify Setup

### Check WireGuard Status (Gateway Server)

```bash
# Check WireGuard interface
sudo wg show

# Check nginx status
sudo systemctl status nginx

# Test connectivity
curl -H "Host: test-app.dev-dex.svc.cluster.local" http://localhost/health
```

### Check Kubernetes Pods

```bash
# Check pod status
kubectl get pods -n wireguard-proxy

# Check logs
kubectl logs -n wireguard-proxy deployment/wireguard-proxy-1 -c wireguard
kubectl logs -n wireguard-proxy deployment/wireguard-proxy-1 -c nginx-proxy

# Check init container logs (for config generation)
kubectl logs -n wireguard-proxy deployment/wireguard-proxy-1 -c generate-wg-config
```

## Step 5: Test the Setup

### Test from Gateway Server

```bash
# Test health endpoint
curl http://localhost/health

# Test with specific domain
curl -H "Host: your-domain.com" http://localhost/
```

or

```bash
# Test with specific hostname to wireguard (10.0.0.2 or 10.0.0.3)
curl -H "Host: test-app-backend" 10.0.0.2
```

Host here should match the nginx upstream name from the ConfigMap described in the [Deploy WireGuard Proxy Pods](#deploy-wireguard-proxy-pods) section.

### Test from External

```bash
# Test from external network
curl -H "Host: your-domain.com" http://SERVER_A_IP/
```

## Troubleshooting

### WireGuard Issues

```bash
# Check WireGuard status
sudo wg show

# Check WireGuard logs
sudo journalctl -u wg-quick@wg0

# Restart WireGuard
sudo systemctl restart wg-quick@wg0
```

### Nginx Issues

```bash
# Check nginx config
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Kubernetes Issues

```bash
# Check pod status
kubectl get pods -n wireguard-proxy

# Check pod logs
kubectl logs -n wireguard-proxy deployment/wireguard-proxy-1

# Check service endpoints
kubectl get endpoints -n wireguard-proxy
```

## Security Considerations

1. **Firewall Rules**: Ensure UDP port 51820 is open on Gateway Server
2. **Private Keys**:
   - Private keys are stored in Kubernetes Secrets (base64 encoded)
   - Secrets are encrypted at rest in etcd
   - Access to Secrets is controlled by RBAC
   - Never expose private keys in ConfigMaps or logs
3. **Network Policies**: Consider implementing Kubernetes network policies
4. **Monitoring**: Set up monitoring for WireGuard and nginx connections
5. **Secret Rotation**: Consider implementing secret rotation for WireGuard keys

## Performance Optimization

1. **WireGuard MTU**: Adjust MTU if needed (typically 1420 for WireGuard)
2. **Nginx Buffering**: Adjust buffer sizes based on traffic patterns
3. **Connection Pooling**: Consider connection pooling for high-traffic scenarios

## Maintenance

### Updating Configurations

1. **Update shared configuration:**

```bash
kubectl patch configmap wireguard-shared-config -n wireguard-proxy --patch '{"data":{"gateway-server-ip":"NEW_IP"}}'
```

<!-- markdownlint-disable-next-line MD029 -->
2. **Update pod-specific configurations:**

```bash
# Update ConfigMap for pod IP
kubectl patch configmap wireguard-config-1 -n wireguard-proxy --patch '{"data":{"pod-ip":"NEW_IP"}}'

# Update Secret for private key (base64 encoded)
kubectl patch secret wireguard-secret-1 -n wireguard-proxy --patch '{"data":{"pod-private-key":"NEW_KEY_BASE64"}}'
```

<!-- markdownlint-disable-next-line MD029 -->
3. **Restart the affected pods:**

```bash
kubectl rollout restart deployment/wireguard-proxy-1
kubectl rollout restart deployment/wireguard-proxy-2
```

<!-- markdownlint-disable-next-line MD029 -->
4. **Test connectivity**

### Scaling

- Add more WireGuard client pods for redundancy
- Update the nginx upstream configuration accordingly

### Monitoring

- Monitor WireGuard connection status
- Monitor nginx proxy performance
- Set up alerts for connection failures
