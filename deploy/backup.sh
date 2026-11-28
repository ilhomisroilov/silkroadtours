#!/usr/bin/env bash
# Consistent SQLite backup inside the container volume, then a copy on the host (/var/backups/<instance>).
# Keeps the newest 14 in each place. Copy /var/backups/<instance> off the server regularly (e.g. Object Storage).
# The instance (container) name comes from CONTAINER_NAME in .env: silkroadtours (National Tours) or
# gulistantravel (Gulistan Travel).
set -euo pipefail
cd "$(dirname "$0")/.."
C="$( { grep -m1 '^CONTAINER_NAME=' .env 2>/dev/null || true; } | cut -d= -f2-)"; C="${C:-silkroadtours}"
DEST="${DEST:-/var/backups/$C}"
mkdir -p "$DEST"
OUT=$(docker exec "$C" node scripts/db.mjs backup | sed -n 's/^backup written: //p')
[ -n "$OUT" ] || { echo "backup failed"; exit 1; }
docker cp "$C:$OUT" "$DEST/"
gzip -f "$DEST/$(basename "$OUT")"
ls -1t "$DEST"/silkroad-*.db.gz | tail -n +15 | xargs -r rm -f
echo "$(date -Is) backup ok: $DEST/$(basename "$OUT").gz"
