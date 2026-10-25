#!/usr/bin/env bash
# One-time server setup for Retro Play (Ubuntu/Debian). Run as a sudo-capable user:
#   bash bootstrap-server.sh
# Installs Docker Engine + Compose from Docker's apt repository, prepares ~/apps/retroplay,
# and creates ~/apps/retroplay/.env with generated secrets if it does not exist. Safe to re-run.
set -euo pipefail

APP_DIR=${APP_DIR:-$HOME/apps/retroplay}
APP_USER=${APP_USER:-$(id -un)}

if ! command -v docker >/dev/null 2>&1; then
  . /etc/os-release
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
fi
id -nG "$APP_USER" | grep -qw docker || sudo usermod -aG docker "$APP_USER"

install -d -m 750 "$APP_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  secret() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48; }
  umask 077
  cat > "$APP_DIR/.env" <<EOF
SITE_ADDRESS=${SITE_ADDRESS:-156-67-27-54.sslip.io}
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_SECRET=$(secret)
POSTGRES_PASSWORD=$(secret)
EOF
  echo "Created $APP_DIR/.env with generated APP_SECRET and POSTGRES_PASSWORD. Fill in the Spotify and Google values."
fi

if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
fi
echo "Bootstrap done. Log out and back in once so the docker group applies to $APP_USER."
