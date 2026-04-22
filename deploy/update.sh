#!/usr/bin/env bash
# Run this ON THE SERVER to pull latest code and restart.
# Usage: ./deploy/update.sh
set -euo pipefail

cd /var/www/solana-blacklist

echo "==> Pulling latest code..."
git pull

echo "==> Stopping old service (if any)..."
systemctl stop solana-blacklist-api 2>/dev/null || true
systemctl disable solana-blacklist-api 2>/dev/null || true

echo "==> Rebuilding and restarting container..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo "==> Done. Container status:"
docker compose ps
