#!/bin/bash

# WireGuard Setup Script
# This script generates WireGuard keys and creates configuration files

set -e

# Function to display usage
usage() {
    echo "Usage: $0 [VPC_NETWORK_RANGE]"
    echo "  VPC_NETWORK_RANGE: Network range in CIDR notation or wildcard format (optional)"
    echo "                     Examples: 192.168.1.0/24, 10.0.0.0/16, 172.16.0.*"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.0/24        # Use specific network range"
    echo "  $0 10.0.0.*              # Use wildcard network range"
    echo "  $0                        # Auto-detect network range"
    echo ""
    echo "If no network range is provided, the script will attempt to auto-detect it"
}

# Function to auto-detect network range
get_network_range() {
    echo "🔍 Auto-detecting network range..."
    
    NETWORK_RANGE=""
    
    # Method 1: Check ifconfig for local network ranges
    if command -v ifconfig >/dev/null 2>&1; then
        # Look for common private network ranges
        LOCAL_NETWORK=$(ifconfig | grep -E "inet (192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
        if [ -n "$LOCAL_NETWORK" ]; then
            # Extract network portion and add /24 mask
            NETWORK_PART=$(echo "$LOCAL_NETWORK" | cut -d. -f1-3)
            NETWORK_RANGE="${NETWORK_PART}.0/24"
            echo "📡 Found local network range: $NETWORK_RANGE (from IP: $LOCAL_NETWORK)"
        fi
    fi
    
    # Method 2: Check for common VPC ranges
    if [ -z "$NETWORK_RANGE" ]; then
        echo "🔍 Checking for common VPC network ranges..."
        # Common VPC ranges
        COMMON_RANGES=("10.0.0.0/16" "10.1.0.0/16" "192.168.0.0/16" "172.16.0.0/16" "172.17.0.0/16")
        for range in "${COMMON_RANGES[@]}"; do
            echo "  - Checking $range"
            # For now, use the first common range as default
            if [ -z "$NETWORK_RANGE" ]; then
                NETWORK_RANGE="$range"
                echo "✅ Using common VPC range: $NETWORK_RANGE"
            fi
        done
    fi
    
    # Method 3: Use default private range as fallback
    if [ -z "$NETWORK_RANGE" ]; then
        echo "⚠️  Could not auto-detect network range, using default"
        NETWORK_RANGE="10.0.0.0/16"
    fi
    
    echo "✅ Auto-detected network range: $NETWORK_RANGE"
    return 0
}

# Function to get gateway IP from network range
get_gateway_ip() {
    local network_range="$1"
    
    echo "🔍 Finding your IP address that matches network range: $network_range" >&2
    
    # Extract network base from the provided range
    local network_base=""
    local cidr=""
    
    # Handle CIDR notation (e.g., 192.168.1.0/24)
    if [[ $network_range =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/([0-9]+)$ ]]; then
        network_base="${BASH_REMATCH[1]}"
        cidr="${BASH_REMATCH[2]}"
    # Handle wildcard notation (e.g., 192.168.1.*)
    elif [[ $network_range =~ ^([0-9]+\.[0-9]+\.[0-9]+)\.\*$ ]]; then
        network_base="${BASH_REMATCH[1]}.0"
        cidr="24"
    else
        # If it's just an IP, assume it's the gateway
        echo "$network_range"
        return 0
    fi
    
    # Calculate network mask based on CIDR
    local network_mask=""
    case $cidr in
        8)  network_mask="255.0.0.0" ;;
        16) network_mask="255.255.0.0" ;;
        24) network_mask="255.255.255.0" ;;
        32) network_mask="255.255.255.255" ;;
        *)  network_mask="255.255.255.0" ;; # Default to /24
    esac
    
    # Extract network octets
    local net_octets=($(echo "$network_base" | tr '.' ' '))
    local mask_octets=($(echo "$network_mask" | tr '.' ' '))
    
    # Find your IP that matches this network range
    local your_ip=""
    
    # Method 1: Try ip a command
    if command -v ip >/dev/null 2>&1; then
        echo "📡 Using 'ip a' to find matching IP..." >&2
        # Get all IPs and check if they match the network range
        while IFS= read -r line; do
            if [[ $line =~ inet[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
                local ip="${BASH_REMATCH[1]}"
                if [ "$ip" != "127.0.0.1" ]; then
                    # Check if IP is in the specified network range
                    if is_ip_in_network "$ip" "$network_base" "$cidr"; then
                        your_ip="$ip"
                        echo "✅ Found matching IP via 'ip a': $your_ip" >&2
                        break
                    fi
                fi
            fi
        done < <(ip a)
    fi
    
    # Method 2: Fallback to ifconfig
    if [ -z "$your_ip" ] && command -v ifconfig >/dev/null 2>&1; then
        echo "📡 Using 'ifconfig' to find matching IP..." >&2
        # Get all IPs and check if they match the network range
        while IFS= read -r line; do
            if [[ $line =~ inet[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
                local ip="${BASH_REMATCH[1]}"
                if [ "$ip" != "127.0.0.1" ]; then
                    # Check if IP is in the specified network range
                    if is_ip_in_network "$ip" "$network_base" "$cidr"; then
                        your_ip="$ip"
                        echo "✅ Found matching IP via 'ifconfig': $your_ip" >&2
                        break
                    fi
                fi
            fi
        done < <(ifconfig)
    fi
    
    # If no matching IP found, use the first IP from the network range
    if [ -z "$your_ip" ]; then
        echo "⚠️  No matching IP found in network range, using first IP from range" >&2
        case $cidr in
            8)  your_ip="${net_octets[0]}.0.0.1" ;;
            16) your_ip="${net_octets[0]}.${net_octets[1]}.0.1" ;;
            24) your_ip="${net_octets[0]}.${net_octets[1]}.${net_octets[2]}.1" ;;
            *)  your_ip="${net_octets[0]}.${net_octets[1]}.${net_octets[2]}.1" ;;
        esac
    fi
    
    echo "🌐 Your IP in network $network_range: $your_ip" >&2
    echo "$your_ip"
}

# Helper function to check if IP is in network range
is_ip_in_network() {
    local ip="$1"
    local network="$2"
    local cidr="$3"
    
    # Convert IP and network to decimal for comparison
    local ip_dec=$(ip_to_decimal "$ip")
    local network_dec=$(ip_to_decimal "$network")
    
    # Calculate network mask
    local mask_dec=$(( 0xFFFFFFFF << (32 - cidr) ))
    
    # Check if IP is in network range
    local network_start=$((network_dec & mask_dec))
    local network_end=$((network_start + (1 << (32 - cidr)) - 1))
    
    if [ $ip_dec -ge $network_start ] && [ $ip_dec -le $network_end ]; then
        return 0  # IP is in range
    else
        return 1  # IP is not in range
    fi
}

# Helper function to convert IP to decimal
ip_to_decimal() {
    local ip="$1"
    local IFS='.'
    local -a octets=($ip)
    echo $(( (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3] ))
}

# Parse command line arguments
VPC_NETWORK_RANGE=""
if [ $# -eq 1 ]; then
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        usage
        exit 0
    fi
    
    # Validate network range format (CIDR or wildcard)
    if [[ $1 =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/([0-9]+)$ ]] || [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+\.\*$ ]] || [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        VPC_NETWORK_RANGE="$1"
        echo "🌐 Using provided VPC/Network range: $VPC_NETWORK_RANGE"
    else
        echo "❌ Error: Invalid network range format: $1"
        echo "   Valid formats: 192.168.1.0/24, 10.0.0.*, or 192.168.1.100"
        usage
        exit 1
    fi
elif [ $# -gt 1 ]; then
    echo "❌ Error: Too many arguments"
    usage
    exit 1
else
    # No arguments provided, auto-detect network range
    get_network_range
    VPC_NETWORK_RANGE="$NETWORK_RANGE"
fi

# Get gateway IP from network range
GATEWAY_IP=$(get_gateway_ip "$VPC_NETWORK_RANGE")
echo "🔐 Setting up WireGuard configuration with network range: $VPC_NETWORK_RANGE (gateway: $GATEWAY_IP)"

# Create directories
mkdir -p wireguard-configs
mkdir -p server-configs
mkdir -p k8s-configs

# Generate WireGuard keys
echo "📝 Generating WireGuard keys..."

# Server keys
wg genkey | tee wireguard-configs/server_private.key | wg pubkey > wireguard-configs/server_public.key
SERVER_PRIVATE_KEY=$(cat wireguard-configs/server_private.key)
SERVER_PUBLIC_KEY=$(cat wireguard-configs/server_public.key)

# Pod 1 keys
wg genkey | tee wireguard-configs/pod1_private.key | wg pubkey > wireguard-configs/pod1_public.key
POD1_PRIVATE_KEY=$(cat wireguard-configs/pod1_private.key)
POD1_PUBLIC_KEY=$(cat wireguard-configs/pod1_public.key)

# Pod 2 keys
wg genkey | tee wireguard-configs/pod2_private.key | wg pubkey > wireguard-configs/pod2_public.key
POD2_PRIVATE_KEY=$(cat wireguard-configs/pod2_private.key)
POD2_PUBLIC_KEY=$(cat wireguard-configs/pod2_public.key)

echo "✅ Keys generated successfully!"

# Create server configuration
echo "📋 Creating server configuration..."
cat > server-configs/wg0.conf << EOF
[Interface]
PrivateKey = ${SERVER_PRIVATE_KEY}
Address = 10.0.0.1/24
ListenPort = 51820
#Accept UDP traffic on port 51820 for WireGuard and forward the tunnel traffic
#For some reason routes for peers (10.0.0.2 dev wg0 scope link, 10.0.0.3 dev wg0 scope link ) are not added automatically
#so we need to add them manually
PostUp = iptables -t raw -A PREROUTING -p udp --dport 51820 -j ACCEPT; iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT; iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip route add 10.0.0.2/32 dev wg0; ip route add 10.0.0.3/32 dev wg0
PostDown = iptables -t raw -D PREROUTING -p udp --dport 51820 -j ACCEPT; iptables -D INPUT -p udp --dport 51820 -j ACCEPT; iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip route del 10.0.0.2/32 dev wg0 2>/dev/null; ip route del 10.0.0.3/32 dev wg0 2>/dev/null

# Kubernetes Pod 1
[Peer]
PublicKey = ${POD1_PUBLIC_KEY}
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25

# Kubernetes Pod 2
[Peer]
PublicKey = ${POD2_PUBLIC_KEY}
AllowedIPs = 10.0.0.3/32
PersistentKeepalive = 25
EOF

# Create Kubernetes configs
echo "📋 Creating Kubernetes configurations..."

# Pod 1 config
cat > k8s-configs/pod1-wg0.conf << EOF
[Interface]
PrivateKey = ${POD1_PRIVATE_KEY}
Address = 10.0.0.2/24
DNS = 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUBLIC_KEY}
Endpoint = ${GATEWAY_IP}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

# Pod 2 config
cat > k8s-configs/pod2-wg0.conf << EOF
[Interface]
PrivateKey = ${POD2_PRIVATE_KEY}
Address = 10.0.0.3/24
DNS = 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUBLIC_KEY}
Endpoint = ${GATEWAY_IP}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

# Create nginx configuration for server A
echo "📋 Creating nginx configuration for gateway server..."
cat > server-configs/nginx.conf << EOF
upstream wireguard_backend {
    # Round-robin between the two WireGuard clients
    server 10.0.0.2:80 max_fails=3 fail_timeout=30s;
    server 10.0.0.3:80 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name vault.dev.mc-ops.tech; # List hosts here
    
    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Proxy settings
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    
    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    # Buffer settings
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    # Main proxy location
    location / {
        # Set backend_host variable based on request host
        set \$backend_host "";

        if (\$host = "vault.dev.mc-ops.tech") {
          set \$backend_host "test-app-backend";
        }

        # Use the variable for Host header
        proxy_set_header Host \$backend_host;
        # Proxy to wireguard backend
        proxy_pass http://wireguard_backend;
        
        # Error handling
        proxy_intercept_errors on;
        error_page 502 503 504 = @fallback;
    }
    
    # Fallback location
    location @fallback {
        return 502 "Service temporarily unavailable";
        add_header Content-Type text/plain;
    }
}

# Default server block for unmatched hosts
server {
    listen 80 default_server;
    server_name _;
    
    # Return 404 for any unmatched hostnames
    return 404 "Host not found\n";
    add_header Content-Type text/plain;
}
EOF

# Create shared Kubernetes configuration
echo "📋 Creating shared Kubernetes configuration..."
cat > k8s-configs/wireguard-shared-config.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: wireguard-shared-config
  namespace: wireguard-proxy
data:
  # Server configuration (shared values)
  server-public-key: "${SERVER_PUBLIC_KEY}"
  gateway-server-ip: "${GATEWAY_IP}"
  gateway-server-port: "51820"

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: wireguard-config-1
  namespace: wireguard-proxy
data:
  pod-ip: "10.0.0.2"

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: wireguard-config-2
  namespace: wireguard-proxy
data:
  pod-ip: "10.0.0.3"
EOF

# Create wireguard pod secrets
echo "📋 Create wireguard pod secrets..."
cat > k8s-configs/wireguard-pod-secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: wireguard-secret-1
  namespace: wireguard-proxy
type: Opaque
data:
  pod-private-key: "$(echo -n "${POD1_PRIVATE_KEY}" | base64)"

---
apiVersion: v1
kind: Secret
metadata:
  name: wireguard-secret-2
  namespace: wireguard-proxy
type: Opaque
data:
  pod-private-key: "$(echo -n "${POD2_PRIVATE_KEY}" | base64)"
EOF

echo "✅ Configuration files created!"
echo ""
echo "📁 Files created:"
echo "  - server-configs/wg0.conf (WireGuard server config)"
echo "  - server-configs/nginx.conf (Nginx proxy config)"
echo "  - k8s-configs/pod1-wg0.conf (Pod 1 WireGuard config)"
echo "  - k8s-configs/pod2-wg0.conf (Pod 2 WireGuard config)"
echo "  - k8s-configs/wireguard-shared-config.yaml (Shared Kubernetes config)"
echo ""
echo "🔑 Keys generated:"
echo "  - wireguard-configs/server_private.key"
echo "  - wireguard-configs/server_public.key"
echo "  - wireguard-configs/pod1_private.key"
echo "  - wireguard-configs/pod1_public.key"
echo "  - wireguard-configs/pod2_private.key"
echo "  - wireguard-configs/pod2_public.key"
echo ""
echo "🌐 Network configuration:"
echo "  - VPC Network Range: $VPC_NETWORK_RANGE"
echo "  - Gateway IP: $GATEWAY_IP"
echo ""
echo "📋 Next steps:"
echo "1. Copy server-configs/wg0.conf to /etc/wireguard/ on Gateway Server"
echo "2. Copy server-configs/nginx.conf to /etc/nginx/sites-available/ on Gateway Server"
echo "3. Apply k8s-configs/wireguard-shared-config.yaml to your cluster"
echo "4. Deploy wireguard-proxy.yaml manifest"
echo ""
echo "💡 Benefits of shared configuration:"
echo "  - Single source of truth for server public key and gateway IP"
echo "  - Easy to update server details across all pods"
echo "  - Reduced duplication and maintenance overhead"
echo "  - Private keys stored securely in Kubernetes Secrets"
echo ""
echo "🔐 Security features:"
echo "  - Private keys are base64 encoded in Secrets"
echo "  - Secrets are encrypted at rest in etcd"
echo "  - Access controlled by RBAC"
echo ""
echo "🛠️  Helper scripts:"
echo "  - generate-secrets.sh: Create individual Secrets from private key files" 