#!/usr/bin/env bash
# Guliston Travel goes live on this server, starting from the National Tours data.
# Run it from the Guliston Travel clone (not from ~/silkroadtours):
#
#   git clone https://github.com/ilhomisroilov/silkroadtours.git ~/gulistantravel   # first time only
#   cd ~/gulistantravel && git pull && sudo bash deploy/go-live.sh
#
# What it does (safe to run again; later runs only update the site):
#   1. first run: creates .env from the National Tours one (AI keys, Telegram, Turnstile carry over;
#      fresh session secret; hidden from search engines while the company tests it);
#   2. builds the Guliston Travel container (127.0.0.1:3102) and, while its database is empty, copies in
#      the National Tours database and uploaded media (names become "Guliston Travel" on start);
#   3. domain: while gulistantravel.uz does not point to this server yet, Guliston Travel answers on
#      nationaltours.uz (its existing certificate). Once gulistantravel.uz points here, a re-run issues its
#      certificate, serves the site there and turns nationaltours.uz into a 301 redirect to it;
#   4. stops the National Tours container and its cron job. Nothing is deleted: its container, data volume,
#      .env and nginx file stay, and `deploy/restore-national.sh` brings it back.
# yoshlikedu.uz, bilimjon.uz and other nginx sites are never touched.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
NATIONAL=silkroadtours
NEW_DOMAIN=gulistantravel.uz
OLD_DOMAIN=nationaltours.uz
say() { printf '\n== %s\n' "$*"; }

NATIONAL_DIR="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$NATIONAL" 2>/dev/null || true)"
if [ "$(readlink -f "${NATIONAL_DIR:-/nonexistent}")" = "$APP_DIR" ]; then
  echo "This is the National Tours directory ($APP_DIR). Clone the repository again for Guliston Travel:"
  echo "  git clone https://github.com/ilhomisroilov/silkroadtours.git ~/gulistantravel && cd ~/gulistantravel && sudo bash deploy/go-live.sh"
  exit 1
fi

if [ ! -f .env ]; then
  say ".env (from National Tours: keys carry over, new session secret)"
  if [ -n "$NATIONAL_DIR" ] && [ -f "$NATIONAL_DIR/.env" ]; then
    grep -vE '^(NEXT_PUBLIC_BRAND|CONTAINER_NAME|APP_PORT|SITE_URL|NEXT_PUBLIC_SITE_URL|SESSION_SECRET|SEARCH_INDEXING)=' "$NATIONAL_DIR/.env" > .env
    grep -q '^ADMIN_SECRET=' .env || echo "ADMIN_SECRET=$(openssl rand -hex 24)" >> .env
  else
    cp .env.example .env
    sed -i "s|^ADMIN_SECRET=.*|ADMIN_SECRET=$(openssl rand -hex 24)|" .env
    sed -i '/^SESSION_SECRET=/d' .env
  fi
  echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')" >> .env
  echo "SEARCH_INDEXING=off" >> .env
  chmod 600 .env
fi

resolve() { { getent ahostsv4 "$1" 2>/dev/null || true; } | awk 'NR==1{print $1}'; }
PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)
NEW_IP=$(resolve "$NEW_DOMAIN")
TAKE=""; docker ps -a --format '{{.Names}}' | grep -qx "$NATIONAL" && TAKE="$NATIONAL"
IMPORT=""; docker ps --format '{{.Names}}' | grep -qx "$NATIONAL" && IMPORT="$NATIONAL"
if [ -n "$NEW_IP" ] && [ -n "$PUBLIC_IP" ] && [ "$NEW_IP" = "$PUBLIC_IP" ]; then
  say "$NEW_DOMAIN points here: site on $NEW_DOMAIN, $OLD_DOMAIN → 301"
  BRAND=gulistan DOMAIN="$NEW_DOMAIN" OLD_DOMAINS="$OLD_DOMAIN" TAKE_OVER="$TAKE" IMPORT_FROM="$IMPORT" bash deploy/setup-server.sh
else
  say "$NEW_DOMAIN does not point here yet (${NEW_IP:-no A record}): Guliston Travel answers on $OLD_DOMAIN for now"
  BRAND=gulistan DOMAIN="$OLD_DOMAIN" TAKE_OVER="$TAKE" IMPORT_FROM="$IMPORT" bash deploy/setup-server.sh
fi

if docker ps --format '{{.Names}}' | grep -qx "$NATIONAL"; then
  say "National Tours: stop (kept, not deleted)"
  docker update --restart=no "$NATIONAL" >/dev/null
  docker stop "$NATIONAL" >/dev/null
  [ -f "/etc/cron.d/$NATIONAL" ] && mv "/etc/cron.d/$NATIONAL" "/etc/$NATIONAL.cron.disabled"
  echo "stopped container $NATIONAL; its data volume, .env and nginx file are kept"
fi

say "Guliston Travel is live"
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E "^(gulistantravel|$NATIONAL)\b" || true
echo "Admin: https://$( [ "${NEW_IP:-}" = "${PUBLIC_IP:-x}" ] && echo "$NEW_DOMAIN" || echo "$OLD_DOMAIN" )/admin (same logins as National Tours)"
