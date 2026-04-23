#!/usr/bin/env bash
set -euo pipefail

# Run this ON THE SERVER to rebuild and restart the currently deployed tree.
# If this directory is a git checkout, the script will also pull the latest code.
# Usage: ./deploy/update.sh

REMOTE_DIR="/opt/solana-blacklist"

cd "$REMOTE_DIR"

if [[ -d .git ]]; then
	echo "==> Pulling latest code..."
	git pull --ff-only
else
	echo "==> No git checkout found; skipping git pull."
	echo "==> Re-run deploy/deploy.sh from your local checkout to sync code changes."
fi

echo "==> Rebuilding and restarting container..."
# --build triggers a rebuild only if Dockerfile or build context changed.
# Docker layer cache is preserved — no --no-cache.
docker compose up -d --build --remove-orphans

echo "==> Waiting for healthcheck..."
sleep 5
docker compose ps

echo "==> Done."
