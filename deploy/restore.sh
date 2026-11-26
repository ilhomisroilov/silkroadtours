#!/usr/bin/env bash
# Restore a backup made by deploy/backup.sh:  sudo bash deploy/restore.sh /var/backups/silkroadtours/silkroad-XXXX.db.gz
set -euo pipefail
SRC="${1:?usage: restore.sh <backup.db[.gz]>}"
TMP=$(mktemp)
case "$SRC" in *.gz) gunzip -c "$SRC" > "$TMP" ;; *) cp "$SRC" "$TMP" ;; esac
cd "$(dirname "$0")/.."
bash deploy/backup.sh || true   # safety copy of the current state first
docker compose stop app
chmod 644 "$TMP"
docker compose run --rm --no-deps -v "$TMP":/restore.db:ro --entrypoint sh app -c \
  'rm -f /data/silkroad.db-wal /data/silkroad.db-shm && cp /restore.db /data/silkroad.db'
docker compose start app
rm -f "$TMP"
echo "restored from $SRC"
