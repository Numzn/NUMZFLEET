#!/bin/bash
# OCI Server Initial Setup Script
# Run this script on your OCI Ubuntu instance to prepare it for deployment
# Usage: bash oci-server-setup.sh
#
# Paths default to ~/NUMZFLEET (clone of https://github.com/Numzn/NUMZFLEET.git).
# Adjust directory names if you clone into a different folder.

set -e  # Exit on error

echo "=========================================="
echo "NumzTrak OCI Server Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root. This script will use sudo when needed.${NC}"
   exit 1
fi

echo -e "${GREEN}Step 1: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${GREEN}Step 2: Installing essential tools...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    nano \
    htop \
    ufw \
    certbot \
    python3-certbot-nginx \
    nginx \
    fail2ban

echo -e "${GREEN}Step 3: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${YELLOW}Docker installed. You may need to log out and back in for group changes.${NC}"
else
    echo -e "${GREEN}Docker is already installed.${NC}"
fi

echo -e "${GREEN}Step 4: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installed.${NC}"
else
    echo -e "${GREEN}Docker Compose is already installed.${NC}"
fi

echo -e "${GREEN}Step 5: Installing Node.js (for frontend builds)...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}Node.js installed.${NC}"
else
    echo -e "${GREEN}Node.js is already installed.${NC}"
fi

echo -e "${GREEN}Step 6: Configuring firewall (UFW)...${NC}"
# Allow SSH first (critical!)
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 8082/tcp comment 'Traccar HTTP'
sudo ufw allow 8443/tcp comment 'Traccar HTTPS'
# GPS protocol ports
sudo ufw allow 5001:5020/tcp comment 'GPS Protocols'
sudo ufw allow 5055/tcp comment 'OsmAnd'

# Enable firewall (non-interactive)
echo "y" | sudo ufw enable
sudo ufw status verbose

echo -e "${GREEN}Step 7: Setting up automatic security updates...${NC}"
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo -e "${GREEN}Step 8: Configuring fail2ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo -e "${GREEN}Step 9: Creating deployment directory...${NC}"
mkdir -p ~/NUMZFLEET
cd ~/NUMZFLEET

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Log out and back in (or run: newgrp docker) for Docker group to take effect"
echo "2. Clone your repository (adjust URL/path to your fork):"
echo "   cd ~/NUMZFLEET"
echo "   git clone https://github.com/Numzn/NUMZFLEET.git ."
echo "3. Configure backend/.env and deployment/.env (see deployment/REGISTRY_DEPLOY.md)"
echo "4. Deploy a SHA (pull + up only — no build on server):"
echo "   cd ~/NUMZFLEET"
echo "   bash deployment/deploy/deploy-from-registry.sh <full-git-sha> deployment/.env"
echo ""
echo "Use Docker Compose v2: docker compose version (install Docker plugin if needed)."
echo ""
echo -e "${YELLOW}Note: If you just installed Docker, you may need to log out and back in.${NC}"
echo ""

# Verify installations
echo -e "${GREEN}Verification:${NC}"
echo "Docker: $(docker --version 2>/dev/null || echo 'Not available - log out and back in')"
echo "Docker Compose v2: $(docker compose version 2>/dev/null || echo 'Not available')"
echo "Legacy docker-compose: $(docker-compose --version 2>/dev/null || echo 'Not installed')"
echo "Node.js: $(node --version 2>/dev/null || echo 'Not available')"
echo "NPM: $(npm --version 2>/dev/null || echo 'Not available')"
echo ""

