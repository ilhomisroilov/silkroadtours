#!/usr/bin/env bash
# Server setup for one brand of the travel platform on a Linux server that may ALREADY host other sites
# (e.g. yoshlikedu.uz, bilimjon.uz). Ubuntu/Debian, amd64 or arm64 (Oracle Cloud Ampere A1 OK).
#
# Each brand is its own deployment: its own clone directory, .env, container, data volume, local port,
# nginx file and certificate. Two brands run side by side on one server:
#
#   National Tours  (existing):  cd ~/silkroadtours  && sudo bash deploy/setup-server.sh
#   Gulistan Travel (second):    git clone https://github.com/ilhomisroilov/silkroadtours.git ~/gulistantravel
#                                cd ~/gulistantravel && sudo BRAND=gulistan bash deploy/setup-server.sh
#
#   BRAND      national (default) | gulistan        → name, logo, texts, contact email
#   DOMAIN     nationaltours.uz | gulistantravel.uz (default by brand)
#   APP_PORT   3100 | 3102                          (default by brand; 3101 is the backend API)
#   INSTANCE   silkroadtours | gulistantravel       (container, nginx file, cron and backup names)
# BRAND, APP_PORT and INSTANCE are remembered in .env, so later runs need no variables.
#
# Safe for neighbours:
#   • never removes or edits other nginx sites, never touches the default site;
#   • adds only /etc/nginx/sites-available/$INSTANCE.conf (+ one shared snippet) and validates with
#     `nginx -t` before reloading — if validation fails, our file is removed and nginx is left as it was;
#   • the app listens only on 127.0.0.1:$APP_PORT (default 3100, must be free);
#   • certbot is asked only for $DOMAIN (+ www.$DOMAIN when that name points here; webroot, no nginx plugin);
#   • stops with a message instead of installing a second web server if :80 belongs to something else.
# It does NOT change DNS and does NOT create cloud resources. Re-running it is safe.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
cd "$APP_DIR"
say() { printf '\n== %s\n' "$*"; }
from_env() { [ -f .env ] && grep -m1 "^$1=" .env | cut -d= -f2- || true; }

SAVED_BRAND="$(from_env NEXT_PUBLIC_BRAND)"
BRAND="${BRAND:-${SAVED_BRAND:-national}}"
case "$BRAND" in
  national) DEF_DOMAIN=nationaltours.uz;  DEF_PORT=3100; DEF_INSTANCE=silkroadtours ;;
  gulistan) DEF_DOMAIN=gulistantravel.uz; DEF_PORT=3102; DEF_INSTANCE=gulistantravel ;;
  *) echo "BRAND must be 'national' or 'gulistan'"; exit 1 ;;
esac
if [ -n "$SAVED_BRAND" ] && [ "$SAVED_BRAND" != "$BRAND" ]; then
  echo "This directory ($APP_DIR) already runs the '$SAVED_BRAND' brand. Not switching it to '$BRAND'."
  echo "Each brand needs its own clone, e.g.: git clone https://github.com/ilhomisroilov/silkroadtours.git ~/$DEF_INSTANCE"
  exit 1
fi
DOMAIN="${DOMAIN:-$DEF_DOMAIN}"
EMAIL="${EMAIL:-}"
SAVED_PORT="$(from_env APP_PORT)"; APP_PORT="${APP_PORT:-${SAVED_PORT:-$DEF_PORT}}"
SAVED_INSTANCE="$(from_env CONTAINER_NAME)"; INSTANCE="${INSTANCE:-${SAVED_INSTANCE:-$DEF_INSTANCE}}"
case "$INSTANCE" in *[!a-z0-9-]*|"") echo "INSTANCE may use only a-z, 0-9 and '-'"; exit 1 ;; esac
ZONE="${INSTANCE//-/_}"   # nginx rate-limit zone and upstream names must be unique per site
SITE=/etc/nginx/sites-available/$INSTANCE.conf
LINK=/etc/nginx/sites-enabled/$INSTANCE.conf
echo "brand: $BRAND · domain: $DOMAIN · local port: $APP_PORT · instance: $INSTANCE · directory: $APP_DIR"
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  [ "$(readlink -f "$f")" = "$(readlink -f "$SITE")" ] && continue
  if grep -qE "server_name[^;]*[[:space:]]${DOMAIN//./\\.}[[:space:];]" "$f" 2>/dev/null; then
    echo "$DOMAIN is already served by $f (another deployment). Not touching it."; exit 1
  fi
done

say "checks"
OWNER80=$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | sed 's/users:(("//' || true)
if [ -n "$OWNER80" ] && [ "$OWNER80" != "nginx" ]; then
  echo "Port 80 is served by '$OWNER80', not by host nginx. Not installing a second web server."
  echo "Add a reverse proxy for $DOMAIN → 127.0.0.1:$APP_PORT in '$OWNER80' instead (see deploy/nginx/silkroadtours.conf)."
  exit 1
fi
if ss -ltnH "sport = :$APP_PORT" | grep -q . && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$INSTANCE"; then
  echo "Port $APP_PORT is already used by another service. Re-run with APP_PORT=<free port>."; exit 1
fi
free -m | awk '/Mem:/ { if ($2 < 1800) print "Note: less than 2 GB RAM — the image build may be slow; consider adding swap." }'

say ".env"
if [ ! -f .env ]; then
  cp .env.example .env
  NEW_ENV=1
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env
  sed -i "s|^ADMIN_SECRET=.*|ADMIN_SECRET=$(openssl rand -hex 24)|" .env
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${GEMINI_API_KEY}|" .env
  elif [ -t 0 ]; then
    read -rsp "Gemini API key (Enter to skip; the site then answers from the database only): " K; echo
    [ -n "$K" ] && sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${K}|" .env
  fi
  echo "created .env with fresh random SESSION_SECRET and ADMIN_SECRET"
fi
chmod 600 .env
upsert() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
upsert NEXT_PUBLIC_BRAND "$BRAND"
upsert CONTAINER_NAME "$INSTANCE"
upsert APP_PORT "$APP_PORT"
upsert SITE_URL "https://$DOMAIN"
upsert NEXT_PUBLIC_SITE_URL "https://$DOMAIN"
# A new brand deployment starts hidden from search engines; set SEARCH_INDEXING=on in .env at launch.
[ "${NEW_ENV:-0}" = 1 ] && [ "$BRAND" != national ] && upsert SEARCH_INDEXING off
echo "site URL: https://$DOMAIN"

say "packages (only what is missing)"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
NEED=()
command -v nginx >/dev/null || NEED+=(nginx)
command -v certbot >/dev/null || NEED+=(certbot)
if [ ${#NEED[@]} -gt 0 ]; then apt-get update -y && apt-get install -y "${NEED[@]}"; fi

say "host firewall: make sure 80/443 are accepted (no other rules are changed)"
for p in 80 443; do
  iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
command -v netfilter-persistent >/dev/null && netfilter-persistent save || true

say "app container (127.0.0.1:$APP_PORT)"
APP_PORT="$APP_PORT" docker compose up -d --build
for i in $(seq 1 90); do curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null || { echo "app did not become healthy"; docker compose logs --tail 80 app; exit 1; }

say "DNS"
PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)
# Never fails (set -e): an empty answer means "not found". If the server's own resolver has no answer yet
# (for example a cached NXDOMAIN from before the record existed), ask a public resolver.
resolve() {
  local ip
  ip=$( { getent ahostsv4 "$1" 2>/dev/null || true; } | awk 'NR==1{print $1}')
  if [ -z "$ip" ] && command -v dig >/dev/null; then
    ip=$( { dig +short +time=3 +tries=1 A "$1" @1.1.1.1 2>/dev/null || true; } | grep -E '^[0-9]+(\.[0-9]+){3}$' | tail -n1 || true)
  fi
  printf '%s' "$ip"
}
APEX_IP=$(resolve "$DOMAIN"); WWW_IP=$(resolve "www.$DOMAIN")
echo "this server: ${PUBLIC_IP:-unknown} · $DOMAIN → ${APEX_IP:-not found} · www.$DOMAIN → ${WWW_IP:-not found}"
DOMAINS=(-d "$DOMAIN")
if [ -n "$WWW_IP" ] && { [ -z "$PUBLIC_IP" ] || [ "$WWW_IP" = "$PUBLIC_IP" ]; }; then DOMAINS+=(-d "www.$DOMAIN"); fi

install_site() { # $1 = source file; validates and rolls back on failure
  local backup=""
  [ -f "$SITE" ] && backup=$(mktemp) && cp "$SITE" "$backup"
  sed -e "s/127\.0\.0\.1:3000/127.0.0.1:$APP_PORT/g" -e "s/__DOMAIN__/$DOMAIN/g" \
      -e "s/srt_api/${ZONE}_api/g" -e "s/silkroad_app/${ZONE}_app/g" "$1" > "$SITE"
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && ! openssl x509 -noout -text -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | grep -q "DNS:www.$DOMAIN"; then
    sed -i '/# BEGIN WWW/,/# END WWW/d' "$SITE"   # certificate does not cover www yet
  fi
  ln -sf "$SITE" "$LINK"
  if ! nginx -t; then
    echo "nginx config test failed — restoring previous state, other sites untouched"
    if [ -n "$backup" ]; then cp "$backup" "$SITE"; else rm -f "$SITE" "$LINK"; fi
    nginx -t && systemctl reload nginx
    exit 1
  fi
  systemctl reload nginx
}

say "nginx site for $DOMAIN"
mkdir -p /var/www/certbot
install -m 644 deploy/nginx/silkroad-ssl.conf /etc/nginx/snippets/silkroad-ssl.conf
NEED_CERT=0
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then NEED_CERT=1
elif [ ${#DOMAINS[@]} -gt 2 ] && ! openssl x509 -noout -text -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | grep -q "DNS:www.$DOMAIN"; then NEED_CERT=1; fi
if [ "$NEED_CERT" = 1 ]; then
  install_site deploy/nginx/silkroadtours-http-only.conf
  if [ -n "$APEX_IP" ] && [ -n "$PUBLIC_IP" ] && [ "$APEX_IP" != "$PUBLIC_IP" ]; then
    echo "$DOMAIN points to $APEX_IP, not to this server ($PUBLIC_IP). Fix the A record, wait a few minutes, re-run."; exit 1
  fi
  if [ -n "$EMAIL" ]; then EM=(--email "$EMAIL"); else EM=(--register-unsafely-without-email); fi
  certbot certonly --webroot -w /var/www/certbot "${DOMAINS[@]}" --expand --agree-tos --non-interactive "${EM[@]}" \
    || { echo "Certificate not issued yet: make sure the A record of $DOMAIN points to this server, then re-run. The site already answers on http://$DOMAIN"; exit 1; }
fi
install_site deploy/nginx/silkroadtours.conf
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

say "daily backup (03:15) and AI log retention (03:45)"
cat > "/etc/cron.d/$INSTANCE" <<CRON
15 3 * * * root cd $APP_DIR && bash deploy/backup.sh >> /var/log/$INSTANCE-backup.log 2>&1
45 3 * * * root docker exec $INSTANCE node scripts/db.mjs prune >> /var/log/$INSTANCE-backup.log 2>&1
CRON

say "done"
curl -fsS -o /dev/null -w "local health: %{http_code}\n" "http://127.0.0.1:$APP_PORT/api/health"
# nginx reloads in the background: give the new workers a moment before the final check.
for i in 1 2 3 4 5; do
  curl -fsS -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" 2>/dev/null && break; sleep 2
done
curl -fsS -o /dev/null -w "https://$DOMAIN: %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" || true
echo "First admin: see docs/DEPLOYMENT.md §3 (ADMIN_SECRET is in $APP_DIR/.env)."
