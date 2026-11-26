#!/usr/bin/env bash
# One-time setup for GitHub Codespaces (runs automatically when the Codespace is created).
# Safe to run again: it never overwrites an existing .dev.vars or database.
set -euo pipefail
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false CI=true

echo ""
echo "▶ 1/4  Installing packages (takes 1–3 minutes)…"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo ""
echo "▶ 2/4  Creating local settings files…"
if [ ! -f .dev.vars ]; then
  gen() { node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"; }
  # Telegram values come from your GitHub Codespaces secrets if you added them; otherwise empty.
  cat > .dev.vars <<EOF
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
SESSION_SECRET=$(gen)
ADMIN_SECRET=$(gen)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
EOF
  echo "   Created .dev.vars (random local secrets, Turnstile test key). This file is never committed."
else
  echo "   .dev.vars already exists — left unchanged."
fi
if [ ! -f .env ]; then
  cat > .env <<'EOF'
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
EOF
  echo "   Created .env (public build settings for local testing)."
fi

echo ""
echo "▶ 3/4  Creating the local database and loading tours…"
if [ -d .wrangler/state/v3/d1 ]; then
  echo "   Local database already exists — applying any new migrations only."
  npm run db:migrate:local
else
  npm run db:migrate:local
  npm run db:seed:local
fi

echo ""
echo "▶ 4/4  Checking the database schema…"
python3 scripts/check-schema-parity.py

echo ""
echo "✅ Setup complete. Next: run  npm run test:unit  (see docs/CODESPACES_GUIDE.md)"
