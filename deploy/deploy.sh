#!/usr/bin/env bash
set -euo pipefail

# Solana Blacklist — initial VPS setup script.
# Run from the repo root on your LOCAL machine.
#
# Usage:
#   ./deploy/deploy.sh user@your-vps-ip
#
# Prerequisites on the VPS:
#   - Docker + Docker Compose plugin installed
#   - nginx installed (for TLS termination)
#   - Certbot configured for solana.mrdn.one

HOST="${1:?Usage: deploy.sh user@host}"
REMOTE_DIR="/opt/solana-blacklist"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "==> Uploading repository to ${HOST}:${REMOTE_DIR}..."
ssh "$HOST" "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete \
    --exclude='.git/' \
    --exclude='target/' \
    --exclude='frontend/node_modules/' \
    --exclude='data/' \
    --exclude='.env' \
    ./ "${HOST}:${REMOTE_DIR}/"

echo "==> Uploading nginx config..."
scp deploy/nginx.conf "${HOST}:/etc/nginx/sites-available/solana-blacklist"
ssh "$HOST" "ln -sf /etc/nginx/sites-available/solana-blacklist /etc/nginx/sites-enabled/solana-blacklist"

echo "==> Uploading systemd unit..."
scp deploy/solana-blacklist-api.service "${HOST}:/etc/systemd/system/solana-blacklist-api.service"

echo "==> Building and starting service on ${HOST}..."
ssh "$HOST" "
    cd ${REMOTE_DIR}
    # Create .env from example if it doesn't already exist
    [ -f .env ] || cp .env.example .env
    # Create data directory for the SQLite volume
    mkdir -p data
    systemctl daemon-reload
    systemctl enable solana-blacklist-api
    systemctl restart solana-blacklist-api
    nginx -t && systemctl reload nginx
    docker compose ps
"

echo "==> Done! Site is live at https://$(echo "$HOST" | cut -d@ -f2)/blacklist/"
