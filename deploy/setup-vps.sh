#!/usr/bin/env bash
# VPS bootstrap script for solana-blacklist.
# Run ONCE on a fresh Ubuntu 22.04/24.04 server as root:
#
#   bash setup-vps.sh
#
# After this script completes:
#   1. Add the GitHub Actions secrets (see README → Deployment).
#   2. Push to main — the workflow will do all subsequent deploys.

set -euo pipefail

DOMAIN="solana.mrdn.one"
APP_DIR="/opt/solana-blacklist"
DEPLOY_USER="deploy"

echo "==> [1/7] System update"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> [2/7] Install dependencies"
apt-get install -y -qq \
    curl git rsync ufw \
    nginx certbot python3-certbot-nginx

echo "==> [3/7] Install Docker"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
# Ensure Docker Compose plugin is available
docker compose version &>/dev/null || apt-get install -y -qq docker-compose-plugin

echo "==> [4/7] Create deploy user"
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

# Allow deploy user to manage the systemd service without a password
cat > /etc/sudoers.d/deploy-solana-blacklist <<'EOF'
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart solana-blacklist-api, /usr/bin/systemctl status solana-blacklist-api
EOF
chmod 440 /etc/sudoers.d/deploy-solana-blacklist

echo "==> [5/7] Set up SSH key for GitHub Actions"
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
mkdir -p "${DEPLOY_HOME}/.ssh"
chmod 700 "${DEPLOY_HOME}/.ssh"

if [[ ! -f "${DEPLOY_HOME}/.ssh/authorized_keys" ]]; then
    touch "${DEPLOY_HOME}/.ssh/authorized_keys"
fi
chmod 600 "${DEPLOY_HOME}/.ssh/authorized_keys"

# Generate a deployment keypair (private key goes to GitHub secret DEPLOY_SSH_KEY)
if [[ ! -f "${DEPLOY_HOME}/.ssh/deploy_ed25519" ]]; then
    ssh-keygen -t ed25519 -C "github-actions-deploy" -N "" -f "${DEPLOY_HOME}/.ssh/deploy_ed25519"
    cat "${DEPLOY_HOME}/.ssh/deploy_ed25519.pub" >> "${DEPLOY_HOME}/.ssh/authorized_keys"
fi

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"

echo ""
echo ">>> COPY THIS PRIVATE KEY to GitHub secret DEPLOY_SSH_KEY <<<"
echo "------------------------------------------------------------------------"
cat "${DEPLOY_HOME}/.ssh/deploy_ed25519"
echo "------------------------------------------------------------------------"
echo ""

echo "==> [6/7] Prepare app directory"
mkdir -p "${APP_DIR}/data"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

echo "==> [7/7] Firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "==> TLS certificate (requires DNS A record for ${DOMAIN} → $(curl -s ifconfig.me))"
read -rp "Obtain TLS certificate via Certbot now? [y/N] " CERT
if [[ "${CERT,,}" == "y" ]]; then
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email admin@mrdn.one
else
    echo "Skipping Certbot. Run manually when DNS is ready:"
    echo "  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@mrdn.one"
fi

echo ""
echo "==========================================================="
echo " Setup complete!"
echo "==========================================================="
echo ""
echo " Next steps:"
echo "  1. Set these GitHub Actions secrets (Settings → Secrets):"
echo "     DEPLOY_HOST           178.104.218.193"
echo "     DEPLOY_USER           ${DEPLOY_USER}"
echo "     DEPLOY_SSH_KEY        (printed above)"
echo "     DEPLOY_KNOWN_HOSTS    $(ssh-keyscan -H 178.104.218.193 2>/dev/null)"
echo "     SOLANA_RPC_URL        https://api.mainnet-beta.solana.com"
echo "     SANDWICHED_ME_API_KEY (your key)"
echo "     ADMIN_KEY             (your admin key)"
echo ""
echo "  2. Push to main — GitHub Actions will deploy automatically."
echo "==========================================================="
