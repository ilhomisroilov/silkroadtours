#!/usr/bin/env bash
# Undo deploy/go-live.sh: National Tours answers on nationaltours.uz again and Guliston Travel stops.
#   cd ~/gulistantravel && sudo bash deploy/restore-national.sh
# Nothing is deleted; Guliston Travel's data stays in its own volume.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
cd "$(dirname "$0")/.."
NATIONAL=silkroadtours; GT=gulistantravel
rm -f "/etc/nginx/sites-enabled/$GT.conf" "/etc/nginx/sites-enabled/$GT-redirects.conf"
ln -sf "/etc/nginx/sites-available/$NATIONAL.conf" "/etc/nginx/sites-enabled/$NATIONAL.conf"
nginx -t && systemctl reload nginx
docker update --restart=unless-stopped "$NATIONAL" >/dev/null && docker start "$NATIONAL" >/dev/null
[ -f "/etc/$NATIONAL.cron.disabled" ] && mv "/etc/$NATIONAL.cron.disabled" "/etc/cron.d/$NATIONAL"
docker stop "$GT" >/dev/null 2>&1 || true
echo "National Tours is back on nationaltours.uz; Guliston Travel is stopped (data kept)."
