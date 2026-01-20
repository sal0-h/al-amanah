#!/bin/bash
# Cloudflare Tunnel Quick Deploy Script
# Usage: ./deploy-cloudflare.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   MSA Task Tracker - Cloudflare Tunnel Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

# Step 1: Check if cloudflared is installed
echo -e "${YELLOW}[1/5]${NC} Checking for cloudflared..."
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}cloudflared not found. Installing...${NC}"
    
    # Detect package manager and architecture
    ARCH=$(uname -m)
    
    if command -v pacman &> /dev/null; then
        # Arch Linux
        echo -e "${BLUE}Detected Arch Linux${NC}"
        if command -v yay &> /dev/null; then
            yay -S --noconfirm cloudflared
        elif command -v paru &> /dev/null; then
            paru -S --noconfirm cloudflared
        else
            echo -e "${YELLOW}Installing cloudflared from AUR requires yay or paru.${NC}"
            echo -e "${YELLOW}Installing manually...${NC}"
            if [ "$ARCH" = "x86_64" ]; then
                wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
            else
                wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O cloudflared
            fi
            chmod +x cloudflared
            sudo mv cloudflared /usr/local/bin/
        fi
    elif command -v apt &> /dev/null; then
        # Debian/Ubuntu
        echo -e "${BLUE}Detected Debian/Ubuntu${NC}"
        if [ "$ARCH" = "x86_64" ]; then
            PACKAGE="cloudflared-linux-amd64.deb"
        else
            PACKAGE="cloudflared-linux-arm64.deb"
        fi
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/$PACKAGE
        sudo dpkg -i $PACKAGE
        rm $PACKAGE
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL
        echo -e "${BLUE}Detected Fedora/RHEL${NC}"
        if [ "$ARCH" = "x86_64" ]; then
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
        else
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O cloudflared
        fi
        chmod +x cloudflared
        sudo mv cloudflared /usr/local/bin/
    else
        # Generic install
        echo -e "${BLUE}Unknown package manager, installing manually${NC}"
        if [ "$ARCH" = "x86_64" ]; then
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
        else
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O cloudflared
        fi
        chmod +x cloudflared
        sudo mv cloudflared /usr/local/bin/
    fi
    
    echo -e "${GREEN}✓ cloudflared installed${NC}"
else
    echo -e "${GREEN}✓ cloudflared found${NC}"
fi

# Step 2: Check if Docker is running
echo -e "\n${YELLOW}[2/5]${NC} Checking Docker..."
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Step 3: Start Docker containers
echo -e "\n${YELLOW}[3/5]${NC} Starting Docker containers..."
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✗ docker-compose.yml not found. Are you in the right directory?${NC}"
    exit 1
fi

docker-compose up -d > /dev/null 2>&1
echo -e "${GREEN}✓ Containers started${NC}"

# Wait a bit for containers to be ready
sleep 3

# Step 4: Test local health
echo -e "\n${YELLOW}[4/5]${NC} Testing local deployment..."
HEALTH=$(curl -s http://localhost/api/health 2>/dev/null || echo "")
if [ "$HEALTH" = '{"status":"healthy"}' ]; then
    echo -e "${GREEN}✓ Local deployment healthy${NC}"
else
    echo -e "${RED}✗ Local deployment not responding. Check logs: docker-compose logs${NC}"
    exit 1
fi

# Step 5: Start Cloudflare Tunnel
echo -e "\n${YELLOW}[5/5]${NC} Starting Cloudflare Tunnel..."
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Starting tunnel... Your public URL will appear below:${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

# Run tunnel in foreground (user can Ctrl+C to stop)
cloudflared tunnel --url http://localhost:80

# This line only runs if user stops the tunnel
echo -e "\n${YELLOW}Tunnel stopped. Your app is still running locally at http://localhost${NC}"
echo -e "${YELLOW}The app automatically handles HTTPS and CORS - no .env changes needed!${NC}"
echo -e "${YELLOW}To restart tunnel: cloudflared tunnel --url http://localhost:80${NC}"
