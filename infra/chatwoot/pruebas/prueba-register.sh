#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-register.sh — prueba LOCAL de la protección de /register
# y /deregister de WhatsApp (SDD-0584, paso 4.2 de SDD-0582). Nunca en el VPS.
# Solo IDs sintéticos y un servidor falso de Graph API dentro del contenedor: no toca Meta.
# Es una corrida pesada (Docker): una a la vez.
#
# Levanta Postgres y Redis del compose real con el overlay local, migra con `prepare` y
# corre pruebas/sonda-register.rb con `rails runner` en `prepare` (red `interna`, sin
# salida a internet), una vez por caso, porque el inicializador lee la variable al arrancar:
#
#   L  lista válida (solo el ID protegido):
#      L1 /register del protegido: Bloqueado y 0 llamadas    L5 HTTParty directo: Bloqueado
#      L2 error y logs [DTD] sin IDs, con huella             L6 CW-1 de punta a punta: la
#      L3 /register de otro número: 1 llamada (no se rompe)      verificación falla, 0 /register,
#      L4 /deregister: protegido 0, otro 1                       webhook sí, error Bloqueado
#      L7 CW-1 con otro número: sí registra                   L8 lectura de la variable
#   V  variable vacía     → modo cerrado: 0 llamadas para todos
#   I  variable inválida  → modo cerrado: 0 llamadas para todos
#   C  CONTROL sin el inicializador (compose.sin-proteccion.yml): las mismas exigencias de L
#      tienen que FALLAR y el /register del protegido tiene que LLEGAR al servidor falso.
#
# Uso:  bash infra/chatwoot/pruebas/prueba-register.sh [--conservar]
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
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-register}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-register"
EDGE="chatwoot_edge_register"
PROTEGIDO="100000000000001"   # sintéticos: los mismos que sonda-register.rb
LIBRE="100000000000002"
BLOQUEADO="DtdProteccionRegister::Bloqueado"
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

# MODO=prueba registra PASÓ/FALLÓ; MODO=control solo cuenta en FALLAS_CONTROL.
MODO=prueba; FALLAS_CONTROL=0
exigir() { # id "condición" descripción
  if eval "$2"; then
    [ "$MODO" = prueba ] && ok "$1" "$3"
  else
    if [ "$MODO" = prueba ]; then mal "$1" "$3"; else FALLAS_CONTROL=$((FALLAS_CONTROL + 1)); fi
  fi
  return 0
}
h() { sed -n "s/^HECHO $2=//p" "$1" | tail -n 1 | tr -d '\r'; } # archivo clave → valor
cuenta() { grep -c -- "$1" "$2" 2>/dev/null || true; }

# ── Preparación: copia como /srv/chatwoot + overlay local + .env de prueba ────
log "== prueba de /register · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
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
BASE=(-f compose.yml -f compose.override.yml -f pruebas/compose.register.yml)

if ! dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1; then
  mal P0 "Postgres/Redis no arrancaron (ver $TRABAJO/up.txt)"; exit 1
fi
if ! dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1; then
  mal P0 "db:chatwoot_prepare falló (ver $TRABAJO/prepare.txt)"; exit 1
fi

caso() { # nombre valor-de-la-variable [overlay extra] → ruta de la salida
  local nombre="$1" valor="$2" salida="$TRABAJO/caso-$1.txt"
  shift 2
  local extra=()
  [ "$#" -gt 0 ] && extra=(-f "$1")
  dc "${BASE[@]}" "${extra[@]}" run --rm -T -e "DTD_WHATSAPP_IDS_PROTEGIDOS=$valor" prepare \
    bundle exec rails runner /tmp/sonda-register.rb >"$salida" 2>&1
  echo "$salida"
}

# Exigencias del caso con lista válida. Las corre L (MODO=prueba) y el control C (MODO=control).
exigencias_lista() {
  local f="$1"
  exigir L0 '[ "$(h "$f" inicializador)" = si ] && [ "$(h "$f" modo)" = lista ] && [ "$(cuenta "protección de /register activa: 1 " "$f")" -ge 1 ]' \
    "inicializador cargado con 1 ID protegido (log de arranque sin el ID)"
  exigir L1 '[ "$(h "$f" reg_protegido_error)" = "$BLOQUEADO" ] && [ "$(h "$f" reg_protegido_llamadas)" = 0 ]' \
    "/register del número protegido: Bloqueado y 0 llamadas al servidor falso"
  exigir L2 '[ "$(h "$f" mensaje_sin_id)" = si ] && [ "$(h "$f" mensaje_con_huella)" = si ] && [ "$(grep "\[DTD\]" "$f" | grep -c -E "$PROTEGIDO|$LIBRE")" = 0 ] && [ "$(cuenta "/register bloqueado" "$f")" -ge 1 ]' \
    "error claro con huella; ningún log [DTD] ni mensaje lleva el ID"
  exigir L3 '[ "$(h "$f" reg_libre_error)" = ok ] && [ "$(h "$f" reg_libre_llamadas)" = 1 ]' \
    "/register de un número NO protegido llega (1 llamada): las otras bandejas siguen"
  exigir L4 '[ "$(h "$f" dereg_protegido_error)" = "$BLOQUEADO" ] && [ "$(h "$f" dereg_protegido_llamadas)" = 0 ] && [ "$(h "$f" dereg_libre_error)" = ok ] && [ "$(h "$f" dereg_libre_llamadas)" = 1 ]' \
    "/deregister: protegido Bloqueado con 0 llamadas; no protegido 1 llamada"
  exigir L5 '[ "$(h "$f" http_protegido_error)" = "$BLOQUEADO" ] && [ "$(h "$f" http_protegido_llamadas)" = 0 ]' \
    "POST de HTTParty directo a /<protegido>/register: Bloqueado (segunda red)"
  exigir L6 '[ "$(h "$f" cw1_protegido_perform)" = ok ] && [ "$(h "$f" cw1_protegido_register)" = 0 ] && [ "$(h "$f" cw1_protegido_error)" = "$BLOQUEADO" ] && [ "$(h "$f" cw1_protegido_webhook)" -ge 1 ]' \
    "CW-1: con la verificación fallando, WebhookSetupService no llega a /register y sí configura el webhook"
  exigir L7 '[ "$(h "$f" cw1_libre_register)" = 1 ]' \
    "CW-1 con un número no protegido: el servicio sí registra (comportamiento de Chatwoot intacto)"
  exigir L8 '[ "$(h "$f" lectura_malas_cerradas)" = si ] && [ "$(h "$f" lectura_buena)" = 2 ]' \
    "lectura: nil, vacía, letras, cortos, «;», coma final y largos → modo cerrado; lista con espacios → 2 IDs"
}

# ── L. Lista válida ──────────────────────────────────────────────────────────
log "== L. lista válida"
F="$(caso lista "$PROTEGIDO")"
exigencias_lista "$F"

# ── V. Variable vacía: falla cerrado ─────────────────────────────────────────
log "== V. variable vacía"
F="$(caso vacia "")"
exigir V1 '[ "$(h "$F" modo)" = cerrado ] && [ "$(cuenta "modo cerrado" "$F")" -ge 1 ]' "modo cerrado, avisado en el log de arranque"
exigir V2 '[ "$(h "$F" reg_libre_error)" = "$BLOQUEADO" ] && [ "$(h "$F" reg_libre_llamadas)" = 0 ] && [ "$(h "$F" reg_protegido_llamadas)" = 0 ] && [ "$(h "$F" cw1_libre_register)" = 0 ] && [ "$(h "$F" dereg_libre_llamadas)" = 0 ]' \
  "ningún /register ni /deregister llega, de ningún número"

# ── I. Variable inválida: falla cerrado ──────────────────────────────────────
log "== I. variable inválida"
F="$(caso invalida "$PROTEGIDO,abc")"
exigir I1 '[ "$(h "$F" modo)" = cerrado ] && [ "$(cuenta "modo cerrado" "$F")" -ge 1 ]' "un elemento mal formado → modo cerrado (no se aceptan listas a medias)"
exigir I2 '[ "$(h "$F" reg_libre_error)" = "$BLOQUEADO" ] && [ "$(h "$F" reg_libre_llamadas)" = 0 ] && [ "$(h "$F" reg_protegido_llamadas)" = 0 ] && [ "$(h "$F" cw1_libre_register)" = 0 ]' \
  "ningún /register llega, ni del ID que sí estaba bien escrito"

# ── C. Control sin el inicializador ──────────────────────────────────────────
log "== C. control sin el inicializador"
F="$(caso control "$PROTEGIDO" pruebas/compose.sin-proteccion.yml)"
MODO=control; exigencias_lista "$F"; MODO=prueba
log "   control: $FALLAS_CONTROL de 9 exigencias de L fallan sin el inicializador"
exigir C1 '[ "$(h "$F" inicializador)" = no ] && [ "$(h "$F" reg_protegido_llamadas)" = 1 ] && [ "$(h "$F" cw1_protegido_register)" = 1 ]' \
  "sin el inicializador, el /register del protegido LLEGA al servidor falso, directo y por CW-1 (la sonda sabe verlo)"
exigir C2 '[ "$FALLAS_CONTROL" -ge 6 ]' \
  "sin el inicializador la prueba sale en ROJO (L0, L1, L2, L4, L5 y L6 fallan)"

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
