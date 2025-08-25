#!/bin/bash

# WireGuard Installation Script for Debian/Ubuntu
# This script installs WireGuard and the wg command on Debian-based systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create wg-tunnel user if it doesn't exist
if ! id "wg-tunnel" &>/dev/null; then
    useradd -m wg-tunnel
    print_status "Created user wg-tunnel"
else
    print_status "User wg-tunnel already exists"
fi

cd /home/wg-tunnel

# Function to install WireGuard on Ubuntu/Debian
install_wireguard() {
    print_status "Installing WireGuard on Debian/Ubuntu..."
    
    # Install WireGuard and tools
    apt install -y wireguard wireguard-tools
    
    # Install additional useful packages
    apt install -y iptables resolvconf
    
    print_status "WireGuard installed successfully on Debian/Ubuntu"

    # Enable IP forwarding
    echo 'net.ipv4.ip_forward=1' | tee -a /etc/sysctl.conf
    sysctl -p
}

# Function to install Nginx web server
install_nginx() {
    print_status "Installing Nginx web server..."
    
    # Install nginx if not already installed
    if ! command -v nginx >/dev/null 2>&1; then
        apt install -y nginx
        print_status "Nginx installed successfully."
    else
        print_status "Nginx is already installed."
    fi
    
    # Enable and start nginx service
    systemctl enable nginx
    systemctl start nginx
    
    print_status "Nginx installation completed"
}

# Function to verify installation
verify_wireguard_installation() {
    print_status "Verifying WireGuard installation..."
    
    # Check if wg command is available
    if command -v wg >/dev/null 2>&1; then
        print_status "✓ wg command is available"
        wg version
    else
        print_error "✗ wg command not found"
        return 1
    fi
    
    # Check if WireGuard module is loaded
    if modprobe -n wireguard 2>/dev/null; then
        print_status "✓ WireGuard kernel module is available"
    else
        print_warning "⚠ WireGuard kernel module not available - you may need to load it manually"
    fi
    
    # Check if wg-quick is available
    if command -v wg-quick >/dev/null 2>&1; then
        print_status "✓ wg-quick command is available"
    else
        print_warning "⚠ wg-quick command not found"
    fi
    
    print_status "Installation verification completed"
}

# Function to verify Nginx installation
verify_nginx() {
    print_status "Verifying Nginx installation..."
    
    # Check if nginx command is available
    if command -v nginx >/dev/null 2>&1; then
        print_status "✓ nginx command is available"
        nginx -v
    else
        print_error "✗ nginx command not found"
        return 1
    fi
    
    # Check if nginx service is running
    if systemctl is-active --quiet nginx; then
        print_status "✓ Nginx service is running"
    else
        print_error "✗ Nginx service is not running"
        return 1
    fi
    
    # Check if nginx service is enabled
    if systemctl is-enabled --quiet nginx; then
        print_status "✓ Nginx service is enabled"
    else
        print_warning "⚠ Nginx service is not enabled"
    fi
    
    # Check nginx configuration
    if nginx -t >/dev/null 2>&1; then
        print_status "✓ Nginx configuration is valid"
    else
        print_error "✗ Nginx configuration is invalid"
        return 1
    fi
    
    print_status "Nginx verification completed"
}

# Function to create basic configuration directory
setup_config() {
    print_status "Setting up WireGuard configuration directory..."
    
    # Create WireGuard configuration directory
    mkdir -p /etc/wireguard
    
    # Set proper permissions
    chmod 700 /etc/wireguard
    
    print_status "WireGuard configuration directory created at /etc/wireguard"
    print_status "Remember to set proper permissions for your configuration files"
}

# Main installation function
main() {
    print_status "Starting WireGuard installation for Debian/Ubuntu..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run this script as root (use sudo)"
        exit 1
    fi
    
    # Update package list
    apt update -y

    # Install WireGuard
    install_wireguard
    
    # Install Nginx
    install_nginx
    
    # Setup configuration directory
    setup_config
    
    # Verify installations
    verify_wireguard_installation
    verify_nginx
    
    print_status "All installations completed successfully!"
    print_status ""
    print_status "Next steps:"
    print_status "1. Generate private/public key pair: wg genkey | tee privatekey | wg pubkey > publickey"
    print_status "2. Create configuration file in /etc/wireguard/"
    print_status "3. Start WireGuard interface: wg-quick up <interface_name>"
    print_status "4. Enable at boot: systemctl enable wg-quick@<interface_name>"


    #Open ports 80 and 443 in the firewall to allow nginx to serve traffic
    ufw allow 80/tcp
    ufw allow 443/tcp

    # TODO: load from github script for wireguard and nginx configuration
}

# Run main function
main "$@"


