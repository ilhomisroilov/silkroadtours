#!/usr/bin/env bash
# Consistent SQLite backup inside the container volume, then a copy on the host (/var/backups/silkroadtours).
# Keeps the newest 14 in each place. Copy /var/backups/silkroadtours off the server regularly (e.g. Object Storage).
set -euo pipefail
DEST="${DEST:-/var/backups/silkroadtours}"
mkdir -p "$DEST"
OUT=$(docker exec silkroadtours node scripts/db.mjs backup | sed -n 's/^backup written: //p')
[ -n "$OUT" ] || { echo "backup failed"; exit 1; }
docker cp "silkroadtours:$OUT" "$DEST/"
gzip -f "$DEST/$(basename "$OUT")"
ls -1t "$DEST"/silkroad-*.db.gz | tail -n +15 | xargs -r rm -f
echo "$(date -Is) backup ok: $DEST/$(basename "$OUT").gz"
