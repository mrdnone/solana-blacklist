#!/usr/bin/env bash
set -euo pipefail

# Solana Blacklist — VPS deployment script
# Run from the repo root on your local machine.
#
# Usage:
#   ./deploy/deploy.sh user@your-vps-ip
#
# Prerequisites on the VPS:
#   - nginx installed
#   - Rust toolchain installed (for building), OR build locally and scp the binary

HOST="${1:?Usage: deploy.sh user@host}"
REMOTE_DIR="/var/www/solana-blacklist"

echo "==> Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "==> Building Rust API (release)..."
cargo build --release --bin api

echo "==> Uploading to ${HOST}..."
ssh "$HOST" "mkdir -p ${REMOTE_DIR}/frontend"

# Upload the API binary
scp target/release/api "${HOST}:${REMOTE_DIR}/api"

# Upload frontend dist
rsync -avz --delete frontend/dist/ "${HOST}:${REMOTE_DIR}/frontend/dist/"

# Upload nginx config
scp deploy/nginx.conf "${HOST}:/etc/nginx/sites-available/solana-blacklist"
ssh "$HOST" "ln -sf /etc/nginx/sites-available/solana-blacklist /etc/nginx/sites-enabled/"

# Upload systemd service
scp deploy/solana-blacklist-api.service "${HOST}:/etc/systemd/system/"

echo "==> Restarting services..."
ssh "$HOST" "systemctl daemon-reload && systemctl enable --now solana-blacklist-api && nginx -t && systemctl reload nginx"

echo "==> Done! Site is live at http://\$(echo $HOST | cut -d@ -f2)"
