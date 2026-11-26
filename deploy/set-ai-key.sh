#!/usr/bin/env bash
# Install AI provider keys on the server without them ever touching Git, the screen or the shell history.
#
#   sudo bash deploy/set-ai-key.sh              asks for Mistral, Cerebras and OpenRouter keys in turn (Enter skips one)
#   sudo bash deploy/set-ai-key.sh mistral      only one provider (mistral | cerebras | openrouter | groq | gemini)
#
# Each key is typed hidden, checked with a tiny test request (including tool calling, which the assistant needs),
# written to .env (mode 600), and the app restarts. Resulting chain: Mistral → Cerebras → Gemini → OpenRouter,
# every one of them optional; with none, the site answers from its own database.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env not found — run deploy/setup-server.sh first."; exit 1; }

HDR="$(mktemp)"; BODY="$(mktemp)"; OUT="$(mktemp)"
chmod 600 "$HDR" "$BODY" "$OUT"
trap 'rm -f "$HDR" "$BODY" "$OUT"' EXIT

upsert() { # upsert NAME VALUE (the value is never printed)
  if grep -q "^$1=" .env; then
    local tmp; tmp="$(mktemp)"; chmod 600 "$tmp"
    awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

# test_model BASE_URL KEY MODEL → prints the HTTP status of a 1-message chat request that offers one tool.
test_model() {
  printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$2" > "$HDR"
  printf '{"model":"%s","messages":[{"role":"user","content":"Reply with OK."}],"max_tokens":16,"tools":[{"type":"function","function":{"name":"ping","description":"Health check","parameters":{"type":"object","properties":{}}}}]}' "$3" > "$BODY"
  curl -s -m 40 -o "$OUT" -w '%{http_code}' -H @"$HDR" --data-binary @"$BODY" "$1/chat/completions" || echo 000
}

# setup_provider NAME KEY_VAR MODEL_VAR BASE_URL "model candidates…"
setup_provider() {
  local name="$1" var="$2" model_var="$3" base="$4" candidates="$5" key code model
  read -rsp "$name API key (input hidden, Enter to skip): " key; echo
  key="$(printf '%s' "$key" | tr -d '[:space:]')"
  [ -n "$key" ] || { echo "  skipped $name"; return 1; }
  for model in $candidates; do
    code="$(test_model "$base" "$key" "$model")"
    if [ "$code" = "200" ]; then
      upsert "$var" "$key"
      upsert "$model_var" "$model"
      echo "  ✓ $name works (model $model)"
      return 0
    fi
    echo "  · $name model $model answered HTTP $code"
    [ "$code" = "401" ] || [ "$code" = "403" ] && { echo "  ✗ $name rejected this key; nothing saved."; return 1; }
  done
  echo "  ✗ $name: no model answered; nothing saved."
  return 1
}

ONLY="${1:-}"
HAVE_MISTRAL=0
case "$ONLY" in
  ""|mistral)
    setup_provider Mistral MISTRAL_API_KEY MISTRAL_MODEL https://api.mistral.ai/v1 "mistral-small-latest mistral-medium-latest mistral-large-latest" && HAVE_MISTRAL=1 || true ;;
esac
case "$ONLY" in
  ""|cerebras)
    setup_provider Cerebras CEREBRAS_API_KEY CEREBRAS_MODEL https://api.cerebras.ai/v1 "gpt-oss-120b qwen-3.8-27b" || true ;;
esac
case "$ONLY" in
  ""|openrouter)
    setup_provider OpenRouter OPENROUTER_API_KEY OPENROUTER_MODEL https://openrouter.ai/api/v1 "openrouter/free" || true ;;
esac
case "$ONLY" in
  groq)
    setup_provider Groq GROQ_API_KEY GROQ_MODEL https://api.groq.com/openai/v1 "llama-3.3-70b-versatile" || true ;;
  gemini)
    read -rsp "Gemini API key (input hidden): " K; echo
    K="$(printf '%s' "$K" | tr -d '[:space:]')"
    [ -n "$K" ] && upsert GEMINI_API_KEY "$K" && echo "  ✓ Gemini key saved"
    unset K ;;
  ""|mistral|cerebras|openrouter) ;;
  *) echo "Usage: sudo bash deploy/set-ai-key.sh [mistral|cerebras|openrouter|groq|gemini]"; exit 1 ;;
esac

if [ "$HAVE_MISTRAL" = 1 ] || grep -q '^MISTRAL_API_KEY=.\+' .env; then
  upsert AI_PROVIDER mistral
  upsert AI_MODEL ""
  upsert AI_SECONDARY_MODEL none
  upsert AI_FALLBACK_PROVIDER "cerebras,gemini,openrouter"
  upsert AI_FALLBACK_MODEL ""
  echo "Order: Mistral → Cerebras → Gemini → OpenRouter (only those with a key are used)."
fi
chmod 600 .env

docker compose up -d app >/dev/null
echo "App restarted. Admin → AI shows the active chain (keys appear only as ••••last4)."
