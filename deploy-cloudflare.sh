#!/bin/bash
# Cloudflare Tunnel Deploy
# Usage: CF env file (optional): CLOUDFLARE_ENV=.cloudflared.env ./deploy-cloudflare.sh
# Vars: CF_TUNNEL_NAME=msa-tracker, CF_TUNNEL_HOSTNAME=tasks.cmuqmsa.org, CF_LOCAL_SERVICE=http://localhost:80

set -e

ENV_FILE="${CLOUDFLARE_ENV:-.env}"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

TUNNEL_NAME="${CF_TUNNEL_NAME:-}"
TUNNEL_HOSTNAME="${CF_TUNNEL_HOSTNAME:-}"
LOCAL_SERVICE="${CF_LOCAL_SERVICE:-http://localhost:80}"

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

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}✗ Docker Compose is not installed. Please install it first.${NC}"
    exit 1
fi

$COMPOSE_CMD up -d > /dev/null 2>&1
echo -e "${GREEN}✓ Containers started${NC}"

# Wait a bit for containers to be ready
sleep 3

# Step 4: Test local health
echo -e "\n${YELLOW}[4/5]${NC} Testing local deployment..."
HEALTH=$(curl -s "${LOCAL_SERVICE%/}/api/health" 2>/dev/null || echo "")
if [ "$HEALTH" = '{"status":"healthy"}' ]; then
    echo -e "${GREEN}✓ Local deployment healthy${NC}"
else
    echo -e "${RED}✗ Local deployment not responding. Check logs: docker compose logs${NC}"
    exit 1
fi

# Step 5: Start Cloudflare Tunnel
echo -e "\n${YELLOW}[5/5]${NC} Starting Cloudflare Tunnel..."
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

if [ -n "$TUNNEL_NAME" ] || [ -n "$TUNNEL_HOSTNAME" ]; then
    if [ -z "$TUNNEL_NAME" ] || [ -z "$TUNNEL_HOSTNAME" ]; then
        echo -e "${RED}✗ Set both CF_TUNNEL_NAME and CF_TUNNEL_HOSTNAME (or leave both empty for a quick URL).${NC}"
        exit 1
    fi

    CONFIG_FILE="$HOME/.cloudflared/config.yml"
    mkdir -p "$HOME/.cloudflared"

    # Check if tunnel exists, create if not
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}')
    if [ -z "$TUNNEL_ID" ]; then
        echo -e "${YELLOW}Creating tunnel ${TUNNEL_NAME}...${NC}"
        cloudflared tunnel create "$TUNNEL_NAME"
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}')
    fi

    # Find credentials file (cloudflared names it by tunnel ID, not name)
    CREDS_FILE="$HOME/.cloudflared/${TUNNEL_ID}.json"
    if [ ! -f "$CREDS_FILE" ]; then
        echo -e "${RED}✗ Credentials file not found at ${CREDS_FILE}${NC}"
        echo -e "${RED}  Try: cloudflared tunnel delete ${TUNNEL_NAME} && cloudflared tunnel create ${TUNNEL_NAME}${NC}"
        exit 1
    fi

    cat > "$CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}
ingress:
  - hostname: ${TUNNEL_HOSTNAME}
    service: ${LOCAL_SERVICE}
  - service: http_status:404
EOF

    echo -e "${YELLOW}Routing DNS ${TUNNEL_HOSTNAME} -> ${TUNNEL_NAME}${NC}"
    cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME"

    echo -e "${GREEN}✓ Config written to ${CONFIG_FILE}${NC}"
    echo -e "${GREEN}Running named tunnel ${TUNNEL_NAME} (Ctrl+C to stop)...${NC}"
    cloudflared tunnel run "$TUNNEL_ID"
else
    echo -e "${GREEN}Starting quick tunnel (random *.trycloudflare.com)...${NC}"
    cloudflared tunnel --url "$LOCAL_SERVICE"
fi

echo -e "\n${YELLOW}Tunnel stopped. App still at ${LOCAL_SERVICE}${NC}"
echo -e "${YELLOW}Restart quick tunnel: cloudflared tunnel --url ${LOCAL_SERVICE}${NC}"
