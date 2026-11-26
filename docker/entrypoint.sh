#!/bin/sh
# Applies pending migrations, loads the starter catalogue on an empty database, then starts Next.js.
set -e
node scripts/db.mjs migrate
if [ "${SEED_ON_EMPTY:-true}" = "true" ]; then
  node scripts/db.mjs seed
fi
exec node server.js
