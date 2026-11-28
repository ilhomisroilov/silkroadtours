#!/usr/bin/env bash
# Starts (or updates) this brand's Python accounts service next to the live site: sign-up, sign-in, profile,
# "my bookings". Run from the site's clone after the site is up (deploy/go-live.sh calls it at the end):
#
#   cd ~/gulistantravel && sudo bash deploy/accounts-up.sh
#
# Safe to run again. What it does:
#   1. first run: writes backend/.env with fresh random secrets (database password, encryption key). The file
#      stays on this server only (chmod 600) and is never committed;
#   2. every run: points the service at the site's current address and lets the site reach it on a private
#      Docker network (nothing new is published to the internet, nginx is not touched);
#   3. builds and starts the service (API, worker, PostgreSQL, Redis), each with a memory cap, then checks that
#      the site can reach it.
# yoshlikedu.uz, bilimjon.uz and other sites are never touched.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
say() { printf '\n== %s\n' "$*"; }
from() { [ -f "$1" ] && grep -m1 "^$2=" "$1" | cut -d= -f2- || true; }
upsert() { # file key value
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else echo "$2=$3" >> "$1"; fi
}

[ -f .env ] || { echo "no .env here: run deploy/go-live.sh first"; exit 1; }
SITE="$(from .env CONTAINER_NAME)"; SITE="${SITE:-silkroadtours}"
SITE_URL="$(from .env SITE_URL)"; SITE_URL="${SITE_URL:-https://gulistantravel.uz}"
APP_PORT="$(from .env APP_PORT)"; APP_PORT="${APP_PORT:-3100}"
NET="$SITE-accounts"
BENV=backend/.env

# ── 1. backend/.env ─────────────────────────────────────────────────────────
if [ ! -f "$BENV" ]; then
  say "backend/.env (new random secrets, kept on this server only)"
  cp backend/.env.example "$BENV"
  upsert "$BENV" POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  upsert "$BENV" NT_SECRET_KEY "$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n')"
  upsert "$BENV" NT_ENV staging
fi
chmod 600 "$BENV"

say "settings for $SITE_URL"
upsert "$BENV" COMPOSE_PROJECT_NAME "$SITE-backend"
upsert "$BENV" SITE_NETWORK "$NET"
upsert "$BENV" NT_SITE_URL "$SITE_URL"
upsert "$BENV" NT_API_URL "$SITE_URL"            # Google/Facebook return to <site>/v1/auth/<provider>/callback
host="${SITE_URL#https://}"; host="${host#www.}"
origins="\"https://$host\",\"https://www.$host\""
for d in gulistantravel.uz nationaltours.uz; do
  [ "$d" = "$host" ] || origins="$origins,\"https://$d\",\"https://www.$d\""
done
upsert "$BENV" NT_ALLOWED_ORIGINS "[$origins]"
sed -i '/^NT_COOKIE_DOMAIN=/d' "$BENV"            # sign-in cookie belongs to the site's own address
# Local port for checks from this server only. Keep the saved one; otherwise take the first free one from 3101.
PORT="$(from "$BENV" API_PORT)"
running_api="$(docker ps -q --filter "label=com.docker.compose.project=$SITE-backend" --filter "label=com.docker.compose.service=api")"
port_busy() { ss -ltnH "sport = :$1" | grep -q .; }
if [ -z "$running_api" ] && { [ -z "$PORT" ] || port_busy "$PORT"; }; then
  PORT=3101; while port_busy "$PORT"; do PORT=$((PORT + 2)); done
fi
upsert "$BENV" API_PORT "$PORT"

# ── 2. the site reaches the service on a private network ────────────────────
before="$(from .env ACCOUNTS_API_URL)"
upsert .env ACCOUNTS_API_URL "http://accounts-api:8000"
if [ "$before" != "http://accounts-api:8000" ] || ! docker network inspect "$NET" >/dev/null 2>&1 \
   || ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$SITE" 2>/dev/null | grep -q "\"$NET\""; then
  say "site: join the private network ($NET)"
  docker compose up -d
  for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1 && break; sleep 2; done
fi

# ── 3. start the service ────────────────────────────────────────────────────
if [ -z "$running_api" ]; then
  avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if [ "$avail" -lt 1200 ]; then
    echo "Only ${avail} MB of memory is free. The accounts service needs about 1 GB; it was not started so the"
    echo "other sites keep running. Free some memory or move to the bigger server, then run this again."
    exit 1
  fi
fi
say "accounts service: build and start ($SITE-backend)"
( cd backend && docker compose up -d --build )

say "check"
ok=""
for _ in $(seq 1 60); do
  if docker exec "$SITE" node -e "fetch('http://accounts-api:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then ok=1; break; fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "the site cannot reach the accounts service yet; last log lines:"
  ( cd backend && docker compose logs --tail 60 migrate api )
  exit 1
fi
curl -fsS "http://127.0.0.1:$APP_PORT/v1/auth/providers" >/dev/null && echo "sign-in works through the site ($SITE_URL/account)"
( cd backend && docker compose ps --format '{{.Service}}\t{{.Status}}' )
echo
echo "Optional, in $APP_DIR/backend/.env (then run this script again):"
echo "  NT_SMTP_PASSWORD      Google Workspace app password of no-reply@ (account emails)"
echo "  NT_TELEGRAM_BOT_TOKEN and NT_TELEGRAM_BOT_USERNAME   'Sign in with Telegram' (BotFather: /setdomain ${host})"
echo "  NT_GOOGLE_CLIENT_ID/SECRET, NT_FACEBOOK_APP_ID/SECRET   later"
