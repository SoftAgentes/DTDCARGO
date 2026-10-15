#!/usr/bin/env bash
# Webhook de Telegram del bot de producción, para el paso 2 del corte (SDD-0505).
#
#   telegram-webhook.sh info              # adónde manda Telegram hoy y si falla
#   telegram-webhook.sh set               # https://dtdcargo.com/api/telegram/webhook
#                                         # con secret_token = TELEGRAM_WEBHOOK_SECRET
#   telegram-webhook.sh info --env otro.env
#
# Lee TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET del .env del proyecto y no
# los imprime: el token viaja a curl por stdin (-K -), no por la línea de
# comandos, y de la URL registrada se muestra solo el host y la ruta (la de
# Vercel traía un `?secret=` histórico). La app valida el header
# `X-Telegram-Bot-Api-Secret-Token` (app/api/telegram/webhook/route.ts).
set -euo pipefail

MODO="${1:-info}"; shift || true
ENV_FILE="/srv/dtd-cargo/.env"
URL_WEBHOOK="https://dtdcargo.com/api/telegram/webhook"
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --url) URL_WEBHOOK="$2"; shift 2 ;;
    *) echo "argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/" | tr -d '\r'; }
TOKEN="$(val TELEGRAM_BOT_TOKEN)"
[ -n "$TOKEN" ] || { echo "falta TELEGRAM_BOT_TOKEN en $ENV_FILE" >&2; exit 2; }

api() { # $1 = método; el resto, pares campo=valor para --data-urlencode
  local metodo="$1"; shift
  local args=()
  for kv in "$@"; do args+=(--data-urlencode "$kv"); done
  printf 'url = "https://api.telegram.org/bot%s/%s"\n' "$TOKEN" "$metodo" \
    | curl -s -m 30 -K - ${args[@]+"${args[@]}"}
}

info() {
  api getWebhookInfo | python3 -c '
import json, sys, time, urllib.parse
r = json.load(sys.stdin)
if not r.get("ok"): print("getWebhookInfo falló:", r.get("description")); sys.exit(1)
w = r["result"]; u = urllib.parse.urlsplit(w.get("url", ""))
print("url:", (u.scheme + "://" + u.netloc + u.path) if u.netloc else "(sin webhook)", "· con query" if u.query else "")
print("pendientes:", w.get("pending_update_count"), "· ip:", w.get("ip_address", "-"))
if w.get("last_error_date"):
    print("último error:", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(w["last_error_date"])), "·", w.get("last_error_message"))
else:
    print("último error: ninguno")
'
  api getMe | python3 -c 'import json,sys; r=json.load(sys.stdin); print("bot:", r["result"]["username"] if r.get("ok") else r.get("description"))'
}

case "$MODO" in
  info) info ;;
  set)
    SECRET="$(val TELEGRAM_WEBHOOK_SECRET)"
    [[ "$SECRET" =~ ^[A-Za-z0-9_-]{1,256}$ ]] || { echo "TELEGRAM_WEBHOOK_SECRET vacío o con caracteres que Telegram no acepta" >&2; exit 2; }
    echo "antes:"; info
    # Sin allowed_updates: Telegram conserva los que ya tenía el webhook.
    api setWebhook "url=${URL_WEBHOOK}" "secret_token=${SECRET}" \
      | python3 -c 'import json,sys; r=json.load(sys.stdin); print("setWebhook:", "OK" if r.get("ok") else "FALLÓ", "·", r.get("description")); sys.exit(0 if r.get("ok") else 1)'
    echo "después:"; info
    ;;
  *) echo "modo desconocido: $MODO (info | set)" >&2; exit 2 ;;
esac
