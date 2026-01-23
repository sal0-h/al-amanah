#!/bin/bash
# =============================================================================
# Al-Amanah Task Tracker - Simple Server Setup
# =============================================================================
# This script sets up EVERYTHING and keeps your website running 24/7
# Just run: ./server-setup.sh
# =============================================================================

set -e
PROJECT_DIR="/home/salman/coding/al-amanah"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       Al-Amanah Task Tracker - Server Setup                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Install Docker if not present
echo "📦 Step 1/5: Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "   Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "   ✅ Docker installed!"
else
    echo "   ✅ Docker already installed"
fi

# Make sure user is in docker group
if ! groups | grep -q docker; then
    echo "   Adding user to docker group..."
    sudo usermod -aG docker $USER
    echo ""
    echo "   ⚠️  You were added to the docker group."
    echo "   Please run: newgrp docker"
    echo "   Then run this script again: ./server-setup.sh"
    exit 0
fi

# Step 2: Install Docker Compose if not present
echo ""
echo "📦 Step 2/5: Checking Docker Compose..."
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    echo "   Installing Docker Compose..."
    # Try the standalone method (works on all Ubuntu versions)
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Determine which compose command to use
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi
echo "   ✅ Docker Compose ready (using: $COMPOSE_CMD)"

# Step 3: Create .env file
echo ""
echo "⚙️  Step 3/5: Setting up configuration..."
cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
    # Generate a random secret key
    SECRET=$(openssl rand -hex 32)
    
    cat > .env << EOF
# Al-Amanah Task Tracker Configuration
# Generated on $(date)

# Security - DO NOT SHARE THIS
SECRET_KEY=$SECRET
DEBUG=False

# Database (auto-created)
DATABASE_URL=sqlite:///./data/msa_tracker.db

# Discord Notifications (optional - fill in later if needed)
REMINDER_WEBHOOK_URL=
ADMIN_WEBHOOK_URL=
DISCORD_ENABLED=False

# Admin Login (CHANGE THE PASSWORD!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123
ADMIN_DISCORD_ID=
EOF
    echo "   ✅ Created .env file"
    echo ""
    echo "   ⚠️  IMPORTANT: Change your admin password!"
    echo "   Run: nano $PROJECT_DIR/.env"
    echo "   And change ADMIN_PASSWORD=changeme123 to something secure"
else
    echo "   ✅ .env already exists"
fi

# Step 4: Create data directory
echo ""
echo "📁 Step 4/5: Creating data directory..."
mkdir -p "$PROJECT_DIR/data"
echo "   ✅ Data directory ready"

# Step 5: Start the application
echo ""
echo "🚀 Step 5/5: Starting the application..."
cd "$PROJECT_DIR"
$COMPOSE_CMD up -d --build

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP COMPLETE!                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Your website is now running at: http://localhost"
echo ""
echo "To make it accessible from the internet with Cloudflare:"
echo ""
echo "  1. Install Cloudflare Tunnel:"
echo "     curl -fsSL https://pkg.cloudflare.com/cloudflared-ascii.repo | sudo tee /etc/yum.repos.d/cloudflared.repo"
echo "     # OR for Ubuntu/Debian:"
echo "     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
echo "     sudo dpkg -i cloudflared.deb"
echo ""
echo "  2. Run the tunnel (quick test - gives you a URL instantly):"
echo "     cloudflared tunnel --url http://localhost:80"
echo ""
echo "  3. For permanent setup, see: $PROJECT_DIR/CLOUDFLARE_DEPLOYMENT.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Useful commands:"
echo "  View logs:      cd $PROJECT_DIR && docker compose logs -f"
echo "  Stop:           cd $PROJECT_DIR && docker compose down"
echo "  Restart:        cd $PROJECT_DIR && docker compose restart"
echo "  Update:         cd $PROJECT_DIR && git pull && docker compose up -d --build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
