#!/bin/bash
# Redeploy the Al-Amanah Task Tracker without wiping data
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Pick compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Docker Compose is not installed. Please install it first." >&2
  exit 1
fi

echo "📦 Pulling latest code..."
git -C "$PROJECT_DIR" pull --ff-only

echo "🔨 Building and restarting containers..."
cd "$PROJECT_DIR"
$COMPOSE_CMD build --pull
$COMPOSE_CMD up -d --remove-orphans

# Restart nginx to refresh upstream DNS (backend IP may change)
$COMPOSE_CMD restart nginx >/dev/null 2>&1 || true

echo "🧹 Pruning old dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Redeploy complete. Containers should be running."