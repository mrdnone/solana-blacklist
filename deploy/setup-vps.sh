#!/usr/bin/env bash
# One-time VPS bootstrap for solana-blacklist.
# Installs Docker, sets up Traefik + Watchtower, and starts the app.
#
# Usage (as root or sudo):
#   ACME_EMAIL=you@example.com \
#   GHCR_USER=your-github-user \
#   GHCR_TOKEN=ghp_xxx \
#   ./setup-vps.sh
#
# Re-running is safe (idempotent).

set -euo pipefail

APP_DIR="/opt/solana-blacklist"
APP_USER="${SUDO_USER:-$USER}"

echo "==> Installing Docker (if missing)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Ensuring '${APP_USER}' is in docker group..."
if id "$APP_USER" >/dev/null 2>&1; then
  usermod -aG docker "$APP_USER" || true
fi

echo "==> Creating shared 'web' network (Traefik <-> app)..."
docker network inspect web >/dev/null 2>&1 || docker network create web

echo "==> Creating ${APP_DIR} ..."
mkdir -p "${APP_DIR}/data" "${APP_DIR}/traefik/letsencrypt"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# -- Traefik + Watchtower stack ------------------------------------------------
if [[ -z "${ACME_EMAIL:-}" ]]; then
  echo "ERROR: ACME_EMAIL env var is required (for Let's Encrypt)." >&2
  exit 1
fi

echo "==> Writing Traefik stack env..."
cat > "${APP_DIR}/traefik/.env" <<EOF
ACME_EMAIL=${ACME_EMAIL}
GHCR_USER=${GHCR_USER:-}
GHCR_TOKEN=${GHCR_TOKEN:-}
EOF
chmod 600 "${APP_DIR}/traefik/.env"

# Copy the stack file next to the env
cp "$(dirname "$0")/traefik-stack.yml" "${APP_DIR}/traefik/docker-compose.yml"

# GHCR login so Watchtower can pull private images (safe for public too)
if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "==> Logging into GHCR..."
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

echo "==> Starting Traefik + Watchtower..."
(cd "${APP_DIR}/traefik" && docker compose up -d)

# -- App ----------------------------------------------------------------------
if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "==> Creating placeholder app .env (EDIT THIS)..."
  cat > "${APP_DIR}/.env" <<'EOF'
BLACKLIST_DB_PATH=/data/blacklist.db
SOLANA_RPC_URL=
BLACKLIST_REFRESH_SECS=300
BLACKLIST_FILTER_INACTIVE=true
ADMIN_KEY=
SANDWICHED_ME_API_KEY=
EOF
  chmod 600 "${APP_DIR}/.env"
  echo "    -> Edit ${APP_DIR}/.env, then re-run: (cd ${APP_DIR} && docker compose up -d)"
fi

# Copy app compose file if the repo is not checked out here
if [[ ! -f "${APP_DIR}/docker-compose.yml" ]]; then
  cp "$(dirname "$0")/../docker-compose.yml" "${APP_DIR}/docker-compose.yml"
fi

echo "==> Pulling and starting the app..."
(cd "${APP_DIR}" && docker compose pull && docker compose up -d)

echo
echo "Done."
echo "  App:       ${APP_DIR}"
echo "  Traefik:   ${APP_DIR}/traefik"
echo "  Domain:    point DNS A-record to this server -- Traefik will issue a cert."
echo "  Updates:   push to main and Watchtower pulls the new image automatically."
