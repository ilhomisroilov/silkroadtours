#!/usr/bin/env bash
# Server setup for National Tours on a Linux server that may ALREADY host other sites
# (e.g. yoshlikedu.uz, bilimjon.uz). Ubuntu/Debian, amd64 or arm64 (Oracle Cloud Ampere A1 OK).
#
#   cd silkroadtours && sudo DOMAIN=nationaltours.uz EMAIL=you@example.com bash deploy/setup-server.sh
#
# Safe for neighbours:
#   • never removes or edits other nginx sites, never touches the default site;
#   • adds only /etc/nginx/sites-available/silkroadtours.conf (+ one snippet) and validates with
#     `nginx -t` before reloading — if validation fails, our file is removed and nginx is left as it was;
#   • the app listens only on 127.0.0.1:$APP_PORT (default 3100, must be free);
#   • certbot is asked only for $DOMAIN (+ www.$DOMAIN when that name points here; webroot, no nginx plugin);
#   • stops with a message instead of installing a second web server if :80 belongs to something else.
# It does NOT change DNS and does NOT create cloud resources. Re-running it is safe.
set -euo pipefail

DOMAIN="${DOMAIN:-nationaltours.uz}"
EMAIL="${EMAIL:-}"
APP_PORT="${APP_PORT:-3100}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE=/etc/nginx/sites-available/silkroadtours.conf
LINK=/etc/nginx/sites-enabled/silkroadtours.conf

[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
cd "$APP_DIR"
say() { printf '\n== %s\n' "$*"; }

say "checks"
OWNER80=$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | sed 's/users:(("//' || true)
if [ -n "$OWNER80" ] && [ "$OWNER80" != "nginx" ]; then
  echo "Port 80 is served by '$OWNER80', not by host nginx. Not installing a second web server."
  echo "Add a reverse proxy for $DOMAIN → 127.0.0.1:$APP_PORT in '$OWNER80' instead (see deploy/nginx/silkroadtours.conf)."
  exit 1
fi
if ss -ltnH "sport = :$APP_PORT" | grep -q . && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx silkroadtours; then
  echo "Port $APP_PORT is already used by another service. Re-run with APP_PORT=<free port>."; exit 1
fi
free -m | awk '/Mem:/ { if ($2 < 1800) print "Note: less than 2 GB RAM — the image build may be slow; consider adding swap." }'

say ".env"
if [ ! -f .env ]; then
  cp .env.example .env
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
grep -q '^APP_PORT=' .env || echo "APP_PORT=$APP_PORT" >> .env
for k in SITE_URL NEXT_PUBLIC_SITE_URL; do
  if grep -q "^$k=" .env; then sed -i "s|^$k=.*|$k=https://$DOMAIN|" .env; else echo "$k=https://$DOMAIN" >> .env; fi
done
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
  sed -e "s/127\.0\.0\.1:3000/127.0.0.1:$APP_PORT/g" -e "s/__DOMAIN__/$DOMAIN/g" "$1" > "$SITE"
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
cat > /etc/cron.d/silkroadtours <<CRON
15 3 * * * root cd $APP_DIR && bash deploy/backup.sh >> /var/log/silkroadtours-backup.log 2>&1
45 3 * * * root docker exec silkroadtours node scripts/db.mjs prune >> /var/log/silkroadtours-backup.log 2>&1
CRON

say "done"
curl -fsS -o /dev/null -w "local health: %{http_code}\n" "http://127.0.0.1:$APP_PORT/api/health"
# nginx reloads in the background: give the new workers a moment before the final check.
for i in 1 2 3 4 5; do
  curl -fsS -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" 2>/dev/null && break; sleep 2
done
curl -fsS -o /dev/null -w "https://$DOMAIN: %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" || true
echo "First admin: see docs/DEPLOYMENT.md §3 (ADMIN_SECRET is in $APP_DIR/.env)."
