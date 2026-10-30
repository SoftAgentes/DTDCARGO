#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-revocar-sesiones.sh — prueba LOCAL de la revocación de
# sesiones desde Studio (rails/zz_dtd_revocar_sesiones.rb · SDD-0585, paso 2.7). Nunca en
# el VPS. Solo datos sintéticos. Es una corrida pesada (Docker): una a la vez.
#
# Levanta Postgres y Redis del compose real con el overlay local, migra con `prepare` y
# corre pruebas/sonda-revocar.rb con `rails runner` en `prepare` (red `interna`):
#
#   R  con el inicializador:
#      R0 cargado                         R5 la revocación: 200, y las DOS sesiones del
#      R1 sin token: 401                     panel quedan fuera (401)
#      R2 token de otra Platform App: 401 R6 tokens y user_sessions en 0
#      R3 usuario de servicio: 409        R7 pubsub_token y token de API rotados; el viejo da 401
#      R4 último admin humano: 409        R8 con otro admin humano, el primero sí se revoca
#      R9 sin DTD_CHATWOOT_SERVICIO_ID: 503 y no revoca nada
#      R10 RoomChannel: el pubsub viejo cuenta como revocado y hay temporizador de 30 s
#   C  CONTROL sin el inicializador (compose.sin-revocar.yml lo tapa con vacio.rb): la ruta no
#      existe (404) y las sesiones siguen vivas.
# El inicializador entra por el compose.yml real, el mismo montaje que en el VPS.
#
# Uso:  bash infra/chatwoot/pruebas/prueba-revocar-sesiones.sh [--conservar]
# Salida: PASÓ/FALLÓ por comprobación en stdout y en $TRABAJO/resumen.txt; sale 0 solo
# sin fallas.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
for a in "$@"; do
  case "$a" in --conservar) CONSERVAR=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-revocar}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-revocar"
EDGE="chatwoot_edge_revocar"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -d "$D" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
bajar_todo
rm -rf "$TRABAJO"; mkdir -p "$D"
: >"$RESUMEN"
limpiar() {
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stack arriba en $D)"; return; }
  bajar_todo
}
trap limpiar EXIT

log() { echo "$*" | tee -a "$RESUMEN"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() { # id "condición" descripción
  if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi
  return 0
}
h() { sed -n "s/^HECHO $2=//p" "$1" | tail -n 1 | tr -d '\r'; } # archivo clave → valor

# ── Preparación: copia como /srv/chatwoot + overlay local + .env de prueba ────
log "== prueba de revocación de sesiones · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
cp "$ORIGEN/compose.yml" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/marca" "$ORIGEN/pruebas" "$D/"
cp "$ORIGEN/pruebas/compose.local.yml" "$D/compose.override.yml"
cat >"$D/.env" <<EOF
CHATWOOT_HOST=chat.prueba.test
CHATWOOT_EDGE_NETWORK=$EDGE
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.prueba.test
CHATWOOT_FRONTEND_URL=http://chat.prueba.test
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 16)
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
EOF
docker network create "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f pruebas/compose.revocar.yml)

if ! dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1; then
  mal P0 "Postgres/Redis no arrancaron (ver $TRABAJO/up.txt)"; exit 1
fi
if ! dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1; then
  mal P0 "db:chatwoot_prepare falló (ver $TRABAJO/prepare.txt)"; exit 1
fi

caso() { # nombre [overlay extra] → ruta de la salida
  local nombre="$1" salida="$TRABAJO/caso-$1.txt"
  shift
  local extra=()
  [ "$#" -gt 0 ] && extra=(-f "$1")
  dc "${BASE[@]}" "${extra[@]}" run --rm -T prepare \
    bundle exec rails runner /tmp/sonda-revocar.rb >"$salida" 2>&1
  echo "$salida"
}

# ── R. Con el inicializador ──────────────────────────────────────────────────
log "== R. con el inicializador"
F="$(caso con)"
exigir R0 '[ "$(h "$F" inicializador)" = si ] && [ "$(h "$F" perfil_antes)" = 200 ] && [ "$(h "$F" sesiones_antes)" = 2 ]' \
  "inicializador cargado; el agente tiene dos sesiones del panel que funcionan (200)"
exigir R1 '[ "$(h "$F" sin_token)" = 401 ]' "sin token de la Platform App: 401"
exigir R2 '[ "$(h "$F" otra_app)" = 401 ] && [ "$(h "$F" perfil_tras_rechazos)" = 200 ]' \
  "con el token de otra Platform App: 401, y la sesión sigue viva"
exigir R3 '[ "$(h "$F" servicio)" = 409 ] && grep -q "HECHO servicio_cuerpo=.*servicio" "$F"' "el usuario de servicio se rechaza (409)"
exigir R4 '[ "$(h "$F" ultimo_admin)" = 409 ] && grep -q "HECHO ultimo_admin_cuerpo=.*ultimo_admin_humano" "$F"' \
  "el último admin humano se rechaza (409)"
exigir R9 '[ "$(h "$F" sin_servicio)" = 503 ] && [ "$(h "$F" perfil_tras_sin_servicio)" = 200 ]' \
  "sin DTD_CHATWOOT_SERVICIO_ID: 503 y no revoca (falla cerrado)"
exigir R5 '[ "$(h "$F" revocar)" = 200 ] && [ "$(h "$F" perfil_sesion1)" = 401 ] && [ "$(h "$F" perfil_sesion2)" = 401 ]' \
  "la revocación responde 200 y las DOS sesiones del panel quedan fuera (401)"
exigir R6 '[ "$(h "$F" tokens_despues)" = 0 ] && [ "$(h "$F" user_sessions_despues)" = 0 ] && grep -q "HECHO revocar_cuerpo=.*\"revocadas\":2" "$F"' \
  "users.tokens y user_sessions en 0; responde revocadas: 2"
exigir R7 '[ "$(h "$F" pubsub_rotado)" = si ] && [ "$(h "$F" api_rotado)" = si ] && [ "$(h "$F" api_vieja)" = 401 ] && [ "$(h "$F" api_nueva)" = 200 ]' \
  "pubsub_token y token de API rotados: el token viejo da 401"
exigir R8 '[ "$(h "$F" admin_con_otro)" = 200 ]' "con otro admin humano en la cuenta, un admin sí se revoca"
exigir R10 '[ "$(h "$F" canal_viejo_revocado)" = si ] && [ "$(h "$F" canal_nuevo_revocado)" = no ] && [ "$(h "$F" canal_temporizador)" = si ]' \
  "RoomChannel: el pubsub viejo cuenta como revocado, el nuevo no, y hay temporizador"
exigir R11 '! grep -E "\[DTD\].*@example\.test" "$F" >/dev/null' "los logs [DTD] no llevan correos"

# ── C. Control sin el inicializador ──────────────────────────────────────────
log "== C. control sin el inicializador"
F="$(caso control pruebas/compose.sin-revocar.yml)"
exigir C1 '[ "$(h "$F" inicializador)" = no ] && [ "$(h "$F" revocar)" = 404 ] && [ "$(h "$F" perfil_sesion1)" = 200 ]' \
  "sin el inicializador la ruta no existe (404) y la sesión sigue viva: la sonda sabe ver la diferencia"

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
