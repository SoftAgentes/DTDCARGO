#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-redaccion-canales.sh — prueba LOCAL de la redacción de las
# líneas de los canales (SDD-0583, seguimiento del 2026-11-05). Nunca en el VPS.
# Solo valores inventados, sobre la imagen real. Es una corrida pesada (Docker): una a la vez.
#
# Levanta Postgres y Redis del compose real con el overlay local, migra con `prepare` y corre
# pruebas/sonda-redaccion-canales.rb con `rails runner` en `prepare`, sin salida a internet:
#
#   T  con el inicializador: T0 cero valores inventados en la salida, T1 cada línea queda
#      tapada, conservando lo que sirve para diagnosticar, T2 el resto del log sigue igual
#   R  la sonda de S5b del runbook de versiones, que también usa la receta de instalación
#   C  CONTROL sin el inicializador (compose.sin-redaccion.yml): cada valor inventado TIENE
#      que aparecer. Si no aparece, esa línea ya no existe y su «cero» no vale nada
#   M  mutantes (pruebas/mutantes-redaccion-canales.rb), sin arrancar Rails: se quita un patrón
#      a la vez y TIENE que reaparecer su valor en las líneas del control
#
# Uso:  bash infra/chatwoot/pruebas/prueba-redaccion-canales.sh [--conservar]
# Salida: PASÓ/FALLÓ por comprobación en stdout y en $TRABAJO/resumen.txt; sale 0 solo sin fallas.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
for a in "$@"; do
  case "$a" in --conservar) CONSERVAR=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-canales}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-canales"
EDGE="chatwoot_edge_canales"
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
exigir() { if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi; return 0; }
cuenta() { grep -c -F -- "$1" "$2" 2>/dev/null || true; }
h() { sed -n "s/^HECHO $2=//p" "$1" | tail -n 1 | tr -d '\r'; }

# Un valor inventado por línea de log. Los números empiezan por 1 y 99 para que no los tape
# el patrón general de teléfonos (58 y 86): así cada uno prueba su propio patrón.
MARCAS=(
  SINT-IG53-REMITENTE SINT-IG53-TEXTO SINT-IG53-MID
  SINT-IGTEST-REMITENTE SINT-IGTEST-TEXTO
  SINT-IG65-DESTINO SINT-IG65-TEXTO
  9900000000067 9900000000070
  SINT-FB-ACUSE-REMITENTE SINT-FB-LEIDO-REMITENTE
  13055550180
  SINT-CAMP55 13055550155 SINT-CAMP64 SINT-CAMP86 SINT-CAMP90 13055550114
  13055550136 SINT-ROT185
  SINT-CIB70
  SINT-WEB-IG-REMITENTE 13055550190 13055550191
)

# Lo que tiene que quedar de cada línea. Si se tapa de más, también sale en rojo.
LINEAS=(
  'Instagram Events Job Messaging: [REDACTADO]'
  'Processing Instagram test webhook event, [REDACTADO]'
  'Instagram response: 100 - Error sintetico de Meta : [REDACTADO]'
  'inbox_id 5 ig_scope_id [REDACTADO]'
  'IG Scope ID: [REDACTADO])'
  'Recieved delivery status [REDACTADO]'
  'Recieved read status  [REDACTADO]'
  'Whatsapp Error: Titulo sintetico - contact: [REDACTADO]'
  'Processing contact: [REDACTADO]'
  'Skipping contact [REDACTADO] - no template_params found for WhatsApp campaign'
  'Skipping contact [REDACTADO] - liquid variables resolved to blank values'
  'Failed to process liquid template params for contact [REDACTADO]: Error sintetico liquid'
  'Failed to send WhatsApp template message to [REDACTADO]: Error sintetico envio'
  'identity rotation: [REDACTADO] already belongs to contact 31 in account 1; cleared the previous phone from contact 32'
  'identity rotation: [REDACTADO] already belongs to contact 33 in inbox 5, not attaching it to contact 34'
  '[ContactInboxBuilder] RecordNotUnique [REDACTADO] 35 5'
)

# ── Preparación: copia como /srv/chatwoot + overlay local + .env de prueba ────
log "== prueba de redacción de canales · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
cp "$ORIGEN/compose.yml" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/marca" "$ORIGEN/correo" "$ORIGEN/pruebas" "$D/"
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
BASE=(-f compose.yml -f compose.override.yml -f pruebas/compose.redaccion-canales.yml)

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
    bundle exec rails runner /tmp/pruebas/sonda-redaccion-canales.rb >"$salida" 2>&1
  echo "$salida"
}

# ── T. Con el inicializador ──────────────────────────────────────────────────
log "== T. con el inicializador"
F="$(caso con)"
exigir T0a '[ "$(h "$F" sonda)" = ok ] && [ -z "$(h "$F" falta)" ] && [ "$(cuenta "redacción de logs activa" "$F")" -ge 1 ]' \
  "inicializador cargado, sonda completa y todas las líneas siguen en la imagen"
fugas=0
for m in "${MARCAS[@]}"; do [ "$(cuenta "$m" "$F")" = 0 ] || { fugas=$((fugas + 1)); log "   fuga: $m"; }; done
exigir T0b '[ "$fugas" = 0 ]' "cero de ${#MARCAS[@]} valores inventados en la salida"
i=0
for l in "${LINEAS[@]}"; do
  i=$((i + 1))
  exigir "T1.$i" '[ "$(cuenta "$l" "$F")" -ge 1 ]' "queda así: $l"
done
exigir T1w '[ "$(h "$F" web_instagram)" != "" ] && [ "$(h "$F" web_whatsapp)" != "" ] && [ "$(cuenta "Processing by Webhooks::InstagramController" "$F")" -ge 1 ] && [ "$(cuenta "Processing by Webhooks::WhatsappController" "$F")" -ge 1 ] && [ "$(cuenta "\"entry\" => \"[FILTERED]\"" "$F")" -ge 2 ]' \
  "los dos webhooks de Meta: Parameters con entry tapado (Instagram $(h "$F" web_instagram), WhatsApp $(h "$F" web_whatsapp))"
for n in 1 2 3 4; do
  frase="$(case "$n" in
    1) echo 'NORMAL-1 [IMAP::FETCH_EMAIL_SERVICE] Job started for inbox 7' ;;
    2) echo 'NORMAL-2 Skipping campaign recipient contact_id=12: motivo sintetico' ;;
    3) echo 'NORMAL-3 Instagram webhook received events' ;;
    4) echo 'NORMAL-4 [WHATSAPP] Webhook setup failed: motivo sintetico' ;;
  esac)"
  exigir "T2.$n" '[ "$(cuenta "$frase" "$F")" -ge 1 ]' "el resto del log sigue igual: $frase"
done

# ── R. La sonda de S5b del runbook de versiones, tal cual ─────────────────────
log "== R. sonda de S5b"
F="$TRABAJO/caso-s5b.txt"
dc "${BASE[@]}" run --rm -T prepare bundle exec rails runner 'Rails.logger.info(%q(Instagram Events Job Messaging: {"text" => "SONDA-CANALES"})); Rails.logger.error(%q(Instagram response: 100 - sonda : {"text" => "SONDA-CANALES"})); p ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters).filter("entry" => [{"sender" => {"id" => "SONDA-CANALES"}}])' 2>&1 \
  | grep -v '^+ ' >"$F" # el `set -x` del entrypoint repite el comando; con `docker exec` no pasa
exigir R1 '[ "$(cuenta "SONDA-CANALES" "$F")" = 0 ] && [ "$(cuenta "Instagram Events Job Messaging: [REDACTADO]" "$F")" = 1 ] && [ "$(cuenta "Instagram response: 100 - sonda : [REDACTADO]" "$F")" = 1 ] && [ "$(cuenta "\"entry\" => \"[FILTERED]\"" "$F")" = 1 ]' \
  "la sonda que usa la receta del VPS da 0, 1, 1 y 1"

# ── C. Control sin el inicializador ──────────────────────────────────────────
log "== C. control sin el inicializador"
F="$(caso control pruebas/compose.sin-redaccion.yml)"
exigir C0 '[ "$(h "$F" sonda)" = ok ] && [ "$(cuenta "redacción de logs activa" "$F")" = 0 ]' "la sonda corre sin el inicializador"
ausentes=0
for m in "${MARCAS[@]}"; do [ "$(cuenta "$m" "$F")" -ge 1 ] || { ausentes=$((ausentes + 1)); log "   sin aparecer: $m"; }; done
exigir C1 '[ "$ausentes" = 0 ]' "sin el inicializador aparecen los ${#MARCAS[@]} valores: la prueba sabe ver cada fuga"

# ── M. Mutantes: un patrón menos a la vez, sobre las líneas del control ──────
log "== M. mutantes"
cp "$F" "$D/pruebas/caso-control.txt"
M="$TRABAJO/caso-mutantes.txt"
dc "${BASE[@]}" run --rm -T prepare bundle exec ruby /tmp/pruebas/mutantes-redaccion-canales.rb >"$M" 2>&1
exigir M0 '[ "$(h "$M" mutantes)" = ok ] && [ "$(h "$M" base_fugas)" = 0 ] && [ "$(h "$M" base_lineas)" -ge 20 ]' \
  "con el filtro entero no aparece ninguno, sobre $(h "$M" base_lineas) líneas del control"
for id in M1 M2 M3 M4 M5 M6 M6b M7 M8 M9 M9b M10 M11 M12 M12b M13 M14; do
  exigir "$id" '[ "$(h "$M" "$id")" = reaparece ]' "sin su patrón reaparece su valor"
done

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
