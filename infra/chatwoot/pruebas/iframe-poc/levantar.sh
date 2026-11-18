#!/usr/bin/env bash
# infra/chatwoot/pruebas/iframe-poc/levantar.sh — Chatwoot LOCAL para la PoC del iframe
# (SDD-0585, paso 2.1). Nunca en el VPS. Solo datos sintéticos. Corrida pesada: una a la vez.
#
# Levanta el compose real de infra/chatwoot (con el overlay local de E1) detrás del
# Traefik de compose.traefik-poc.yml, con FORCE_SSL=true como en el VPS y
# CHATWOOT_FRAME_ANCESTORS con los dos orígenes de «Studio» de la prueba. Después:
#   1. cierra el onboarding por consola (runbook chatwoot-servidor.md §5);
#   2. crea la Platform App y guarda su token en $TRABAJO/secretos (0600);
#   3. por la Platform API, como hará Studio: cuenta, agente y su rol en la cuenta;
#   4. siembra una bandeja API y una conversación sintética (sembrar-poc.rb);
#   5. escribe $TRABAJO/poc.json y el certificado de prueba para frente.mjs.
#
# Uso:  bash levantar.sh            (levanta)
#       bash levantar.sh --bajar    (baja todo y borra volúmenes)
set -euo pipefail
export MSYS_NO_PATHCONV=1

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && { pwd -W 2>/dev/null || pwd; })"
ORIGEN="$(cd "$AQUI/../.." && pwd)"
TRABAJO="${POC_TRABAJO:-${TEMP:-/tmp}/cw-e2-poc}"
# En Git Bash, la ruta en forma C:/… (pwd -W): openssl, node y docker son binarios de
# Windows y con MSYS_NO_PATHCONV=1 no entienden /c/…
mkdir -p "$TRABAJO"; TRABAJO="$(cd "$TRABAJO" && { pwd -W 2>/dev/null || pwd; })"
D="$TRABAJO/chatwoot"; P=chatwoot-poc
HOST_CHAT=chat.localtest.me
URL=http://127.0.0.1:18080

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar() {
  [ -d "$D" ] && dc down -v --remove-orphans >/dev/null 2>&1 || true
  (cd "$AQUI" && docker compose -f compose.traefik-poc.yml down >/dev/null 2>&1) || true
  docker network rm chatwoot_edge_poc >/dev/null 2>&1 || true
}
if [ "${1:-}" = --bajar ]; then bajar; echo "abajo"; exit 0; fi
bajar
rm -rf "$D" "$TRABAJO/secretos"; mkdir -p "$D" "$TRABAJO/secretos" "$TRABAJO/tls"
chmod 700 "$TRABAJO/secretos"

# Certificado de prueba (autofirmado) para los cuatro nombres de la prueba.
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=poc-iframe.localtest.me" \
  -addext "subjectAltName=DNS:chat.localtest.me,DNS:studio.localtest.me,DNS:localhost,IP:127.0.0.1" \
  -keyout "$TRABAJO/tls/clave.pem" -out "$TRABAJO/tls/cert.pem" >/dev/null 2>&1

cp "$ORIGEN/compose.yml" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/cf-access" "$ORIGEN/marca" "$ORIGEN/pruebas" "$D/"
cp "$ORIGEN/pruebas/compose.local.yml" "$D/compose.override.yml"
cat >"$D/.env" <<EOF
CHATWOOT_HOST=$HOST_CHAT
CHATWOOT_EDGE_NETWORK=chatwoot_edge_poc
TRAEFIK_ENTRYPOINT=websecure
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=true
CHATWOOT_FRAME_ANCESTORS=https://studio.localtest.me:18444 https://localhost:18444
CHATWOOT_FRONTEND_URL=https://$HOST_CHAT:18443
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_MAX_USER_SESSIONS=5
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 16)
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
CHATWOOT_SMTP_AUTHENTICATION=
CHATWOOT_SMTP_ENABLE_STARTTLS_AUTO=false
CHATWOOT_SMTP_OPENSSL_VERIFY_MODE=none
CHATWOOT_BACKUP_AGE_RECIPIENTS=/dev/null
EOF

docker network create chatwoot_edge_poc >/dev/null
(cd "$AQUI" && docker compose -f compose.traefik-poc.yml up -d --wait >/dev/null)
T0="$(date +%s)"
dc up -d --wait >"$TRABAJO/up.txt" 2>&1 || { echo "FALLÓ el arranque (ver $TRABAJO/up.txt)"; exit 1; }
echo "chatwoot arriba en $(( $(date +%s) - T0 )) s"

runner() { dc exec -T "${@:2}" rails bundle exec rails runner "$1"; }
runner 'Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)' >/dev/null 2>&1
runner 'print "TOKEN:" + PlatformApp.create!(name: "DTD Studio PoC").access_token.token' 2>/dev/null \
  | grep -o 'TOKEN:[A-Za-z0-9_-]*' | cut -d: -f2 | tr -d '\n' >"$TRABAJO/secretos/platform-token"
chmod 600 "$TRABAJO/secretos/platform-token"
T="$(cat "$TRABAJO/secretos/platform-token")"
[ -n "$T" ] || { echo "FALLÓ: sin token de Platform App"; exit 1; }

api() { # método ruta [json]
  curl -sf -X "$1" "$URL$2" -H "Host: $HOST_CHAT" -H 'X-Forwarded-Proto: https' \
    -H "api_access_token: $T" -H 'Content-Type: application/json' ${3:+-d "$3"}
}
campo() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]))' "$1"; }
CUENTA="$(api POST /platform/api/v1/accounts '{"name":"Cuenta sintetica E2","locale":"es"}' | campo id)"
USUARIO="$(api POST /platform/api/v1/users "{\"name\":\"Agente Sintetica E2\",\"email\":\"agente.sintetica.e2@example.test\",\"password\":\"Pw-$(openssl rand -hex 8)-a1!\"}" | campo id)"
api POST "/platform/api/v1/accounts/$CUENTA/account_users" "{\"user_id\":$USUARIO,\"role\":\"agent\"}" >/dev/null
dc cp "$AQUI/sembrar-poc.rb" rails:/tmp/sembrar-poc.rb >/dev/null
CONV="$(runner /tmp/sembrar-poc.rb -e "CUENTA_ID=$CUENTA" -e "USUARIO_ID=$USUARIO" 2>/dev/null | grep -o 'POC:[0-9]*' | cut -d: -f2)"
unset T

cat >"$TRABAJO/poc.json" <<EOF
{"tokenArchivo":"$TRABAJO/secretos/platform-token","cuenta":$CUENTA,"usuario":$USUARIO,"conversacion":$CONV,
 "contenedorRails":"$(dc ps -q rails)",
 "cert":"$TRABAJO/tls/cert.pem","clave":"$TRABAJO/tls/clave.pem","traefik":"$URL","hostChat":"$HOST_CHAT"}
EOF
echo "listo: cuenta=$CUENTA usuario=$USUARIO conversación=$CONV → $TRABAJO/poc.json"
curl -s -D - -o /dev/null -H "Host: $HOST_CHAT" -H 'X-Forwarded-Proto: https' "$URL/app/login" | tr -d '\r' \
  | grep -i -E '^(x-frame-options|content-security-policy|set-cookie)' | sed -E 's/(_session=)[^;]*/\1…/'
