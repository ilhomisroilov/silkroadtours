#!/usr/bin/env bash
# Create the first administrator (owner) on the server. Works only while no administrator exists;
# after that, add staff in the admin panel under Settings → Users.
#
#   sudo bash deploy/create-admin.sh
#
# The password is typed hidden and is sent only to the app on this server (127.0.0.1), never shown or logged.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env not found — run deploy/setup-server.sh first."; exit 1; }
SECRET="$(grep '^ADMIN_SECRET=' .env | cut -d= -f2- || true)"
[ "${#SECRET}" -ge 16 ] || { echo "ADMIN_SECRET in .env is missing or shorter than 16 characters."; exit 1; }
PORT="$(grep '^APP_PORT=' .env | cut -d= -f2- || true)"; PORT="${PORT:-3100}"

HDR="$(mktemp)"; BODY="$(mktemp)"; OUT="$(mktemp)"
chmod 600 "$HDR" "$BODY" "$OUT"
trap 'rm -f "$HDR" "$BODY" "$OUT"' EXIT

read -rp "Email: " EMAIL
read -rp "Name: " NAME
read -rsp "Password (at least 12 characters, hidden): " PASS; echo
read -rsp "Repeat the password: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "The passwords do not match; nothing was created."; exit 1; }
[ "${#PASS}" -ge 12 ] || { echo "The password must have at least 12 characters; nothing was created."; exit 1; }

printf 'x-admin-secret: %s\nContent-Type: application/json\n' "$SECRET" > "$HDR"
EMAIL="$EMAIL" NAME="${NAME:-Owner}" PASS="$PASS" python3 -c \
  'import json, os; print(json.dumps({"email": os.environ["EMAIL"], "name": os.environ["NAME"], "password": os.environ["PASS"]}))' > "$BODY"
unset PASS PASS2 SECRET

code="$(curl -s -m 20 -o "$OUT" -w '%{http_code}' -H @"$HDR" --data-binary @"$BODY" "http://127.0.0.1:$PORT/api/admin/auth/bootstrap" 2>/dev/null)" || true
code="${code:-000}"
case "$code" in
  201) echo "✓ Administrator $EMAIL created. Sign in at /admin on your domain." ;;
  409) echo "An administrator already exists. Sign in at /admin, or ask the owner to add you under Settings → Users." ;;
  422) echo "The email or name was not accepted (name: at least 2 characters). Nothing was created." ;;
  *)   echo "Could not create the administrator (HTTP $code). Is the app running? Try: sudo docker ps" ;;
esac
