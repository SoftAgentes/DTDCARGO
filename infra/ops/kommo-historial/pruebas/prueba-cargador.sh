#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-cargador.sh — prueba del cargador del «Archivo Kommo» (SDD-0590 paso
# 5.5; mediciones E-4 a E-11 de §10.4). Corre en GitHub Actions (kommo-historial-cargador.yml) o en una PC con
# Docker; nunca en el VPS. Solo datos inventados, sobre la imagen real de Chatwoot del compose de infra/chatwoot.
#
#   D    el archivo de carga sale del extractor real (`vincular` + `preparar-carga`) con los conteos esperados
#   P    línea base: cuenta, bandeja viva con datos que ya existían, webhook de la cuenta; control de la cola
#   B    crear la bandeja: canal API sin webhook_url ni miembros; la segunda vez devuelve la misma
#   G    rechazos: bandeja con webhook_url y bandeja de otra cuenta → no carga nada
#   S    seco: cuenta lo mismo que cargará, no escribe nada ni consume números de conversación
#   C    carga: conteos, filas, números de conversación y cola de Sidekiq
#   F    la salida del cargador no trae nombres, teléfonos, correos ni textos
#   E45  0 trabajos en cola: ni webhooks (E-4) ni envíos a clientes (E-5)
#   E6   lo cargado coincide con el archivo de carga · E7 cargar dos veces no duplica · E8 números de
#        conversación · E9 contactos sin huérfanos ni duplicados · E10 búsqueda · E11 lo que ya existía
#   M    control M0 y mutantes: cada uno rompe una propiedad del cargador y TIENE que tumbar su comprobación,
#        sin caer por otro camino. Corren con escenario-mutante.rb, un arranque de Rails por escenario, cada
#        uno en una cuenta nueva sobre la misma base.
#
# E-1 y E-2 son del vínculo (vinculo-informe.json, pruebas de Python). E-3 (tarjetas de Studio) se mide en el
# ensayo con la base de Studio; aquí se ve por E-4: sin trabajos de webhook, a Studio no le llega nada.
#
# El archivo de carga entra al contenedor por la entrada estándar, como en el servidor. Vigila la memoria: si la
# libre (commit libre en Windows, MemAvailable en Linux) baja de PISO_MB (3072), para y baja el stack.
#
# Uso:  bash infra/ops/kommo-historial/pruebas/prueba-cargador.sh [--conservar] [--sin-mutantes]
# Salida: PASÓ/FALLÓ por comprobación y $TRABAJO/resumen.txt; sale 0 solo sin fallas.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
MUTANTES=1
for a in "$@"; do
  case "$a" in
    --conservar) CONSERVAR=1 ;;
    --sin-mutantes) MUTANTES=0 ;;
    *) echo "opción desconocida: $a"; exit 2 ;;
  esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KH="$(cd "$AQUI/.." && pwd)"
CW="$(cd "$KH/../../chatwoot" && pwd)"
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  if python3 -c 'import sys' >/dev/null 2>&1; then PY=python3; else PY=python; fi
fi
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-cargador.XXXXXX")"
# En Linux el extractor exige que los datos de personas vivan en /dev/shm, aunque sean inventados.
if [ "$(uname -s)" = Linux ] && [ -d /dev/shm ]; then
  S="$(mktemp -d /dev/shm/cw-cargador-staging.XXXXXX)"
else
  S="$TRABAJO/staging"
fi
D="$TRABAJO/stack"
REAL="$TRABAJO/real"
P="chatwoot-cargador"
EDGE="chatwoot_edge_cargador"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"
PISO_MB="${PISO_MB:-3072}"
CARGADOR=/tmp/cargador/cargar-archivo-kommo.rb
SONDA=/tmp/cargador/sonda-cargador.rb
MODO_LOG=1
MUT_FALLADOS=""
declare -A RES=()

win() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s\n' "$1"; fi; }
dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -f "$D/compose.yml" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
limpiar() {
  case "$S" in /dev/shm/cw-cargador-staging.*) rm -rf -- "$S" ;; esac
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stack arriba en $D)"; return; }
  bajar_todo
}
trap limpiar EXIT

log() { echo "$*" | tee -a "$RESUMEN"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() {
  local r=FALLÓ
  if eval "$2"; then r=PASÓ; fi
  RES["$1"]=$r
  if [ "$MODO_LOG" = 1 ]; then
    if [ "$r" = PASÓ ]; then log "PASÓ  $1 — $3"; else mal "$1" "$3"; fi
  fi
  return 0
}
h() { sed -n "s/^HECHO $2=//p" "$1" 2>/dev/null | tail -n 1 | tr -d '\r'; }
cero() { [ "${1:-0}" = 0 ]; }
cola_igual() { [ -n "$1" ] && [ "${1%%->*}" = "${1##*->}" ] && [ "${1%%->*}" != -1 ]; }
avance() { [ -n "$1" ] && [ "$(( ${1##*->} - ${1%%->*} ))" = "$2" ]; }
dif() { [ -n "$1" ] && echo "$(( ${1##*->} - ${1%%->*} ))"; }
# Lo que encola crear una bandeja con los modelos, igual que desde el panel: la invalidación de la caché de la
# cuenta (AccountCacheRevalidator), sin `inbox_created` porque ENABLE_INBOX_EVENTS está vacía (SDD-0590 §10.9).
AVISO_BANDEJA="ActionCableBroadcastJob(account.cache_invalidated):1,EventDispatcherJob(account.cache_invalidated):1"

memoria_libre_mb() {
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command '[int]((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1024)' 2>/dev/null | tr -d '\r'
  elif [ -r /proc/meminfo ]; then
    awk '/^MemAvailable:/ { print int($2 / 1024) }' /proc/meminfo
  else
    echo 999999
  fi
}
vigilar() {
  local mb
  mb="$(memoria_libre_mb)"
  log "   memoria libre: ${mb} MB ($1)"
  if [ "${mb:-0}" -lt "$PISO_MB" ]; then
    mal MEM "memoria libre ${mb} MB bajo el piso de ${PISO_MB} MB ($1): se para y se baja el stack"
    exit 3
  fi
}

# rr <salida> VAR=valor... -- <script>: rails runner en `prepare`; la entrada estándar pasa al contenedor.
rr() {
  local salida="$1" envs=()
  shift
  while [ "$1" != "--" ]; do envs+=(-e "$1"); shift; done
  shift
  dc "${BASE[@]}" run --rm -T "${envs[@]}" prepare bundle exec rails runner "$@" >"$salida" 2>&1
}

# ── Las comprobaciones de un escenario, sobre la carpeta de sus salidas ──────
comprobar() {
  local O="$1" F CUENTA CONW B CONTROL
  F="$O/sonda-preparar.txt"
  CUENTA="$(h "$F" cuenta)"
  CONW="$(h "$F" con_webhook)"
  CONTROL="$(h "$F" control_cola)"
  exigir P1 '[ "$(h "$F" preparar)" = ok ] && [ -n "$CUENTA" ] && [ -n "$CONW" ]' \
    "cuenta $CUENTA, bandeja viva con datos que ya existían, bandeja con webhook_url ($CONW) y webhook de la cuenta"
  exigir P2 '[ "${CONTROL:-0}" -gt 0 ] 2>/dev/null' \
    "control: crear con los modelos encola ${CONTROL:-?} trabajos, así que la medida de E-4 y E-5 ve lo que se encola"

  F="$O/bandeja-1.txt"
  B="$(h "$F" bandeja)"
  exigir B1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" bandeja_existia)" = no ] && [ -n "$B" ] && [ "$(h "$F" webhook_url)" = no ] && [ "$(h "$F" miembros)" = 0 ]' \
    "bandeja $B: canal API, sin webhook_url, sin miembros"
  exigir B2 '[ "$(h "$F" trabajos_nuevos)" = "$AVISO_BANDEJA" ] && [ "$(dif "$(h "$F" cola)")" = 2 ]' \
    "crear la bandeja encola solo la invalidación de caché de la cuenta, como desde el panel; ni inbox_created ni webhooks: $(h "$F" trabajos_nuevos)"
  F="$O/bandeja-2.txt"
  exigir B3 '[ "$(h "$F" bandeja)" = "$B" ] && [ "$(h "$F" bandeja_existia)" = si ]' "la segunda vez devuelve la misma bandeja"

  F="$O/rechazo-webhook.txt"
  exigir G1 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "la bandeja tiene webhook_url: no se carga" ]' \
    "bandeja con webhook_url: no carga"
  F="$O/rechazo-cuenta.txt"
  exigir G2 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "la bandeja no existe en esa cuenta" ]' \
    "bandeja de otra cuenta: no carga"

  F="$O/seco.txt"
  exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" leidas)" = "personas:4,conversaciones:5,mensajes:8" ]' \
    "lee el archivo entero: $(h "$F" leidas)"
  exigir S2 '[ "$(h "$F" conversaciones_nuevas)" = 5 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" personas_nuevas)" = 3 ] && [ "$(h "$F" personas_reusadas)" = 2 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 5 ]' \
    "cuenta lo que cargará: 5 conversaciones, 8 mensajes, 3 personas nuevas y 2 reusadas"
  exigir S3 '[ "$(h "$F" antes)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$F" despues)" = "$(h "$F" antes)" ]' \
    "no escribe nada ($(h "$F" despues))"
  exigir S4 'avance "$(h "$F" secuencia)" 0' "no consume números de conversación ($(h "$F" secuencia))"
  exigir S5 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' "no encola trabajos ($(h "$F" cola), $(h "$F" trabajos_nuevos))"

  F="$O/carga-1.txt"
  exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = 5 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" personas_nuevas)" = 3 ] && [ "$(h "$F" personas_reusadas)" = 2 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 5 ]' \
    "5 conversaciones, 8 mensajes, 3 personas nuevas (2 de Kommo y «sin contacto»), 2 reusadas, 5 contact_inboxes"
  exigir C2 '[ "$(h "$F" conversaciones_sin_contacto)" = 1 ] && [ "$(h "$F" adjuntos_pendientes)" = 1 ] && [ "$(h "$F" mensajes_sin_texto)" = 1 ]' \
    "1 conversación sin contacto, 1 adjunto pendiente, 1 mensaje sin texto"
  exigir C3 '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" personas_omitidas)" && cero "$(h "$F" conversaciones_omitidas)" && cero "$(h "$F" mensajes_omitidos)" && cero "$(h "$F" contact_inboxes_omitidos)" && cero "$(h "$F" mensajes_sin_conversacion)"' \
    "ninguna fila omitida por un conflicto ni mensaje sin conversación"
  exigir C4 '[ "$(h "$F" despues)" = "conversaciones:5,mensajes:8,contact_inboxes:5" ]' "filas en la bandeja después: $(h "$F" despues)"
  exigir C5 'avance "$(h "$F" secuencia)" 5' "los números de conversación avanzan 5 ($(h "$F" secuencia))"
  exigir C6 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
    "la carga no encola trabajos (cola $(h "$F" cola), $(h "$F" trabajos_nuevos))"
  F="$O/carga-2.txt"
  exigir E7a '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" personas_nuevas)" && cero "$(h "$F" contact_inboxes_nuevos)"' \
    "E-7: segunda carga, 0 filas nuevas"
  exigir E7b '[ "$(h "$F" conversaciones_existentes)" = 5 ] && [ "$(h "$F" mensajes_existentes)" = 8 ] && [ "$(h "$F" personas_reusadas)" = 4 ] && [ "$(h "$F" despues)" = "conversaciones:5,mensajes:8,contact_inboxes:5" ]' \
    "E-7: reconoce lo cargado: 5 conversaciones, 8 mensajes y 4 personas"
  exigir E7c 'avance "$(h "$F" secuencia)" 0 && cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
    "E-7: ni números ni trabajos ($(h "$F" secuencia), cola $(h "$F" cola), $(h "$F" trabajos_nuevos))"

  local fugas=0 f m
  for f in bandeja-1 bandeja-2 rechazo-webhook rechazo-cuenta seco carga-1 carga-2; do
    for m in "${MARCAS[@]}"; do
      if grep -q -F -- "$m" "$O/$f.txt" 2>/dev/null; then
        fugas=$((fugas + 1))
        [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $f"
      fi
    done
  done
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/carga-1.txt" ]' "cero de ${#MARCAS[@]} valores inventados en 7 salidas del cargador"

  F="$O/sonda-verificar.txt"
  exigir E0 '[ "$(h "$F" verificar)" = ok ]' "la sonda corrió entera"
  local base_carga
  base_carga="$(h "$O/bandeja-1.txt" cola)"
  base_carga="${base_carga##*->}"
  exigir E45 '[ -n "$base_carga" ] && [ "$(h "$F" cola_actual)" = "$base_carga" ] && [ -n "$(h "$F" trabajos_actuales)" ] && [ "$(h "$F" trabajos_actuales)" = "$(h "$O/bandeja-1.txt" trabajos_despues)" ] && [ "$(h "$F" con_webhook_conversaciones)" = 0 ]' \
    "E-4 y E-5: desde que existe la bandeja hasta la verificación, la cola es la misma por clase y evento (${base_carga:-?} trabajos), y 0 conversaciones en la bandeja con webhook"
  exigir E6a '[ "$(h "$F" conversaciones)" = 5 ] && [ "$(h "$F" mensajes)" = 8 ] && [ "$(h "$F" entrantes)" = 5 ] && [ "$(h "$F" salientes)" = 3 ] && [ "$(h "$F" resueltas)" = 5 ]' \
    "E-6: 5 conversaciones resueltas, 8 mensajes (5 entrantes, 3 salientes)"
  exigir E6b '[ "$(h "$F" historicas)" = 1 ] && [ "$(h "$F" mensajes_historicos)" = 3 ]' \
    "E-6: con sus fechas de Kommo, 1 conversación y 3 mensajes de hace más de 400 días"
  exigir E6c '[ "$(h "$F" autores)" = "Bot Kommo|SINT-Asesora|SINT-Asesora" ]' "E-6: los salientes llevan su autor por nombre de pila o «Bot Kommo»"
  exigir E6d '[ "$(h "$F" json_conv)" = 0 ] && [ "$(h "$F" json_msg_como_chatwoot | cut -d: -f1)" = si ] && [ "$(h "$F" no_reenviados)" = 8 ]' \
    "E-6: los atributos de la conversación son objeto JSON y los del mensaje quedan como los guarda Chatwoot ($(h "$F" json_msg_como_chatwoot)); su scope not_forwarded los lee ($(h "$F" no_reenviados))"
  exigir E6e '[ "$(h "$F" procesado_faltante)" = 0 ] || [ "$(h "$F" procesado_faltante)" = sin_columna ]' \
    "E-6: processed_message_content lleno donde hay texto ($(h "$F" procesado_faltante))"
  exigir E6f '[ "$(h "$F" no_leidos)" = 0 ]' "E-6: la bandeja no muestra entrantes viejos como no leídos ($(h "$F" no_leidos))"
  exigir E8a '[ "$(h "$F" display_nueva_mayor)" = si ] && [ "$(h "$F" display_duplicados)" = 0 ] && [ "$(h "$F" display_nulos)" = 0 ]' \
    "E-8: la conversación nueva va después, sin números repetidos ni vacíos"
  exigir E8b '[ "$(h "$F" display_en_orden)" = si ]' "E-8: los números del archivo siguen el orden de creación"
  exigir E9a 'cero "$(h "$F" huerfanos_mensaje)" && cero "$(h "$F" huerfanos_conversacion)" && cero "$(h "$F" sin_contact_inbox)" && cero "$(h "$F" contact_inbox_cruzado)" && cero "$(h "$F" remitente_cruzado)" && [ -n "$(h "$F" remitente_cruzado)" ]' \
    "E-9: 0 huérfanos, 0 cruces de contact_inbox y 0 remitentes cruzados"
  exigir E9b '[ "$(h "$F" tel_x1)" = 1 ] && [ "$(h "$F" correo_x2)" = 1 ] && [ "$(h "$F" tel_grupo)" = 1 ]' \
    "E-9: ni el teléfono ni el correo existentes se duplican; el grupo de dos contactos es una persona"
  exigir E9c '[ "$(h "$F" x1_reusado)" = si ] && [ "$(h "$F" x2_reusado)" = si ] && [ "$(h "$F" grupo_unido)" = si ] && [ "$(h "$F" sin_contacto)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 3 ]' \
    "E-9: reusa por teléfono y por correo, 3 contactos nuevos en total"
  exigir E10a '[ "$(h "$F" ilike_reciente)" = 1 ] && [ "$(h "$F" ilike_viejo)" = 1 ]' "E-10: el texto cargado se encuentra en la base"
  exigir E10b '[ "$(h "$F" buscador_reciente)" -ge 1 ] 2>/dev/null' "E-10: el buscador de Chatwoot encuentra un mensaje reciente ($(h "$F" buscador_reciente))"
  exigir E10d '[ "$(h "$F" conv_vieja_antigua)" = si ] && [ "$(h "$F" conv_vieja_por_nombre)" = si ] && [ "$(h "$F" conv_vieja_por_telefono)" = si ] && [ "$(h "$F" conv_vieja_por_numero)" = si ]' \
    "E-10d: con la ventana por defecto, la búsqueda de conversaciones encuentra la del Archivo de hace 500 días por nombre ($(h "$F" conv_vieja_por_nombre)), por teléfono ($(h "$F" conv_vieja_por_telefono)) y por número ($(h "$F" conv_vieja_por_numero))"
  exigir E11 '[ "$(h "$F" conv_viva_intacta)" = si ] && [ "$(h "$F" x1_intacto)" = si ] && [ "$(h "$F" x2_intacto)" = si ] && [ "$(h "$F" mensajes_vivos_delta)" = 0 ]' \
    "E-11: la conversación y los contactos que ya existían no cambiaron"
  return 0
}

MARCAS=(SINT-NOMBRE SINT-TEXTO SINTBUSCAR SINTVIEJO SINT-Asesora SINT-Salesbot 4120000001 4120000002 example.test SINT-C1 SINT-AVATAR Pérez kommo.example)

log "== prueba del cargador del Archivo Kommo · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
vigilar inicio

# ── D. Archivo de carga con el extractor real ────────────────────────────────
log "== D. archivo de carga"
"$PY" -I "$(win "$AQUI/generar-sintetico.py")" "$(win "$S")" >"$TRABAJO/generar.txt" 2>&1 \
  || { mal D0 "no se generaron los datos (ver $TRABAJO/generar.txt)"; exit 1; }
"$PY" -I "$(win "$KH/respaldar-historial.py")" vincular --staging "$(win "$S")" --clientes "$(win "$S/clientes.ndjson")" \
  >"$TRABAJO/vincular.txt" 2>&1 || { mal D0 "vincular falló (ver $TRABAJO/vincular.txt)"; cat "$TRABAJO/vincular.txt"; exit 1; }
"$PY" -I "$(win "$KH/respaldar-historial.py")" preparar-carga --staging "$(win "$S")" \
  >"$TRABAJO/preparar-carga.txt" 2>&1 || { mal D0 "preparar-carga falló (ver $TRABAJO/preparar-carga.txt)"; exit 1; }
inf() { "$PY" -I -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8")).get(sys.argv[2],0))' "$(win "$S/carga-informe.json")" "$1" | tr -d '\r'; }
exigir D1 '[ "$(inf personas)" = 4 ] && [ "$(inf conversaciones)" = 5 ] && [ "$(inf conversaciones_sin_contacto)" = 1 ]' \
  "4 personas, 5 conversaciones, 1 sin contacto"
exigir D2 '[ "$(inf mensajes)" = 8 ] && [ "$(inf entrantes)" = 5 ] && [ "$(inf salientes)" = 3 ] && [ "$(inf con_adjunto)" = 1 ] && [ "$(inf sin_texto)" = 1 ]' \
  "8 mensajes: 5 entrantes, 3 salientes, 1 con adjunto y sin texto"
CARGA="$S/carga.ndjson"

# ── Stack: copia como /srv/chatwoot + overlay local + .env de prueba ──────────
log "== stack"
mkdir -p "$D/cargador" "$D/estado/m" "$REAL"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$KH/cargar-archivo-kommo.rb" "$AQUI/sonda-cargador.rb" "$AQUI/escenario-mutante.rb" "$D/cargador/"
cp "$CARGA" "$D/estado/carga.ndjson"
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
bajar_todo
docker network create "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f compose.cargador.yml)
if ! dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1; then
  mal P0 "Postgres/Redis no arrancaron (ver $TRABAJO/up.txt)"; tail -n 40 "$TRABAJO/up.txt"; exit 1
fi
if ! dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null; then
  mal P0 "db:chatwoot_prepare falló (ver $TRABAJO/prepare.txt)"; tail -n 60 "$TRABAJO/prepare.txt"; exit 1
fi
vigilar "base migrada"

# ── Corrida real: un `rails runner` por paso, la carga por la entrada estándar ─
log "== corrida real"
rr "$REAL/sonda-preparar.txt" FASE=preparar -- "$SONDA" </dev/null
CUENTA="$(h "$REAL/sonda-preparar.txt" cuenta)"
CONW="$(h "$REAL/sonda-preparar.txt" con_webhook)"
rr "$REAL/bandeja-1.txt" MODO=crear-bandeja "CUENTA=$CUENTA" "NOMBRE=Archivo Kommo" -- "$CARGADOR" </dev/null
B="$(h "$REAL/bandeja-1.txt" bandeja)"
rr "$REAL/bandeja-2.txt" MODO=crear-bandeja "CUENTA=$CUENTA" "NOMBRE=Archivo Kommo" -- "$CARGADOR" </dev/null
rr "$REAL/rechazo-webhook.txt" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$CONW" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$REAL/rechazo-cuenta.txt" MODO=cargar CUENTA=999999 "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$REAL/seco.txt" MODO=seco "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$REAL/carga-1.txt" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$REAL/carga-2.txt" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$REAL/sonda-verificar.txt" FASE=verificar "BANDEJA=$B" -- "$SONDA" </dev/null
comprobar "$REAL"
log "MEDIDA E10c — el buscador de mensajes con un mensaje de hace 500 días: $(h "$REAL/sonda-verificar.txt" buscador_viejo) con la ventana de 90 días; $(h "$REAL/sonda-verificar.txt" buscador_viejo_ventana_1100) con SEARCH_TIME_RANGE_LIMIT_DAYS=1100"log "MEDIDA E8 — números de conversación en la carga: $(h "$REAL/carga-1.txt" secuencia)"
vigilar "corrida real"

# ── M. Control y mutantes ────────────────────────────────────────────────────
escenario() { # id → salidas en $D/estado/m/<id>/
  dc "${BASE[@]}" run --rm -T -e "CARGADOR_RB=/tmp/estado/m/$1.rb" -e CARGA_ARCHIVO=/tmp/estado/carga.ndjson \
    -e "SALIDAS=/tmp/estado/m/$1" prepare bundle exec rails runner /tmp/cargador/escenario-mutante.rb \
    >"$D/estado/m/$1.log" 2>&1 </dev/null
}
mutar() { # origen destino buscar reemplazo: el texto tiene que aparecer exactamente una vez
  "$PY" -I -c 'import sys
o, d, b, r = sys.argv[1:5]
t = open(o, encoding="utf-8").read()
n = t.count(b)
if n != 1:
    print(f"el texto a mutar aparece {n} veces")
    sys.exit(1)
open(d, "w", encoding="utf-8", newline="\n").write(t.replace(b, r))' "$(win "$1")" "$(win "$2")" "$3" "$4"
}
cayeron_en() { local k; for k in "${!RES[@]}"; do [ "${RES[$k]}" = FALLÓ ] && echo "$k"; done | sort | tr '\n' ' '; }
# mutante <id> <qué rompe> <tienen que caer> <tienen que pasar> <texto> <reemplazo>
mutante() {
  local id="$1" que="$2" caen="$3" pasan="$4" faltan="" otro="" c cayeron
  local rb="$D/estado/m/$id.rb"
  if ! mutar "$D/cargador/cargar-archivo-kommo.rb" "$rb" "$5" "$6" >"$D/estado/m/$id.mutar.txt" 2>&1; then
    mal "$id" "$que: no se pudo aplicar ($(tr -d '\r' <"$D/estado/m/$id.mutar.txt"))"; return 0
  fi
  if cmp -s "$D/cargador/cargar-archivo-kommo.rb" "$rb"; then mal "$id" "$que: la copia no cambió"; return 0; fi
  escenario "$id"
  RES=()
  MODO_LOG=0
  comprobar "$D/estado/m/$id"
  MODO_LOG=1
  for c in $caen; do [ "${RES[$c]:-FALLÓ}" = FALLÓ ] || faltan="$faltan $c"; done
  for c in $pasan; do [ "${RES[$c]:-FALLÓ}" = PASÓ ] || otro="$otro $c"; done
  cayeron="$(cayeron_en)"
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que: tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: ${cayeron:-ninguna}"
  [ "${RES[$id]}" = FALLÓ ] && MUT_FALLADOS="$MUT_FALLADOS $id"
  vigilar "$id"
}

if [ "$MUTANTES" = 1 ]; then
  log "== M. control y mutantes"
  cp "$D/cargador/cargar-archivo-kommo.rb" "$D/estado/m/M0.rb"
  escenario M0
  RES=()
  MODO_LOG=0
  comprobar "$D/estado/m/M0"
  MODO_LOG=1
  total=${#RES[@]}
  cayeron="$(cayeron_en)"
  exigir M0 '[ -z "$cayeron" ] && [ "$total" -ge 39 ]' \
    "control: el escenario en un solo proceso pasa las $total comprobaciones de la corrida real${cayeron:+ — cayeron: $cayeron}"
  [ "${RES[M0]}" = FALLÓ ] && MUT_FALLADOS="$MUT_FALLADOS M0"

  mutante M1 "escribe con los modelos (callbacks)" "C6 E45" "C1 C4" \
    "n = seco? ? lote.size : Message.insert_all(lote, returning: %w[id]).length" \
    "n = seco? ? lote.size : lote.each { |f| Message.create!(f) }.size"
  mutante M2 "sin la guarda de webhook_url" "G1 E45" "G2" \
    "raise 'la bandeja tiene webhook_url: no se carga' if" \
    "nil if false &&"
  mutante M3 "sin la guarda de cuenta" "G2" "G1" \
    "Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)" \
    "Inbox.find_by(id: @bandeja_id)"
  mutante M4 "el seco escribe" "S3" "S1 G1" \
    "@modo == 'seco'" \
    "@modo == 'nunca'"
  mutante M5 "el seco inserta conversaciones y las deshace" "S4" "S1 S3" \
    "lote.map { |f| { 'id' => falso, 'tid' => f[:additional_attributes]['kommo_talk_id'] } }" \
    "Conversation.insert_all(lote, returning: Arel.sql(\"id, (additional_attributes->>'kommo_talk_id')::bigint AS tid\")).to_a"
  mutante M6 "no salta los mensajes ya cargados" "E7a" "C1 C4" \
    "      if ya.include?(m['source_id'])" \
    "      if false"
  mutante M7 "no reconoce las conversaciones ya cargadas" "E7a" "C1 C4" \
    ".where(\"additional_attributes ? 'kommo_talk_id'\")" \
    ".where('1 = 0')"
  mutante M8 "no reusa por teléfono" "E9b E9c" "E9a S1" \
    "existente = Contact.where(account_id: @cuenta_id, phone_number: telefono).order(:id).pick(:id) if telefono" \
    "existente = nil"
  mutante M9 "no reusa por correo" "E9c" "S1" \
    "existente ||= Contact.where(account_id: @cuenta_id).where('LOWER(email) = ?', correo).order(:id).pick(:id) if correo" \
    "existente ||= nil"
  mutante M10 "contact_inbox de otro contacto" "E9a" "C1" \
    "contact_inbox_id: ci_de[contacto]," \
    "contact_inbox_id: ci_de.values.first,"
  mutante M11 "entrantes sin remitente" "E9a" "C1" \
    "sender_id: entrante ? @contacto_de_conv[conv] : nil," \
    "sender_id: nil,"
  mutante M12 "conversaciones en orden inverso" "E8b" "C1 E8a" \
    "conversaciones.sort_by { |c| [c['creada'].to_i, c['kommo_talk_id'].to_i] }" \
    "conversaciones.sort_by { |c| [-c['creada'].to_i, c['kommo_talk_id'].to_i] }"
  mutante M13 "sin agent_last_seen_at" "E6f" "C1" \
    "last_activity_at: ultima, agent_last_seen_at: ahora," \
    "last_activity_at: ultima,"
  mutante M14 "conversaciones con la fecha de hoy" "E6b" "C1" \
    "created_at: instante(c['creada']), updated_at: ultima," \
    "created_at: ahora, updated_at: ultima,"
  mutante M15 "atributos de la conversación como texto (Chatwoot los guarda como objeto jsonb)" "E6d" "S1" \
    "'kommo_origen' => c['origen'] }.compact }" \
    "'kommo_origen' => c['origen'] }.compact.to_json }"
  mutante M16 "imprime el nombre de la persona" "F1" "C1" \
    "personas.each do |p|" \
    "personas.each do |p|
      hecho('nombre', p['nombre'])"
  mutante M17 "toca los contactos que reusa" "E11" "C1" \
    "por_grupo[p['grupo']] = existente" \
    "por_grupo[p['grupo']] = existente
        Contact.where(id: existente).update_all(updated_at: Time.zone.now) unless seco?"
  mutante M18 "mensajes sin texto" "E10a" "C1" \
    "content: m['texto'], private: false," \
    "content: nil, private: false,"
  mutante M19 "salientes sin autor" "E6c" "C1" \
    "content_attributes: entrante ? {} : { 'kommo_autor' => m['autor'] }," \
    "content_attributes: {},"
  mutante M20 "conversaciones abiertas" "E6a" "C1" \
    "status: Conversation.statuses[:resolved]" \
    "status: Conversation.statuses[:open]"
  # Lo contrario de M15 para los mensajes: Chatwoot guarda content_attributes como texto JSON (store con
  # coder JSON sobre una columna json). Reescribirlo como objeto, saltándose el modelo, tiene que tumbar E6d.
  mutante M21 "atributos del mensaje como objeto (Chatwoot los guarda como texto JSON)" "E6d" "C1 C4" \
    "n = seco? ? lote.size : Message.insert_all(lote, returning: %w[id]).length" \
    "n = if seco?
            lote.size
          else
            ids = Message.insert_all(lote, returning: %w[id]).map { |f| f['id'] }
            Message.where(id: ids).where.not(content_attributes: nil)
                   .update_all(\"content_attributes = (content_attributes #>> '{}')::json\")
            ids.size
          end"
  # E-10d: si la conversación del Archivo no queda con la persona de Kommo, buscar por la persona no la encuentra.
  mutante M22 "todas las conversaciones al contacto «sin contacto»" "E10d" "C1" \
    "contacto = c['grupo'] ? contacto_de[c['grupo']] : nil" \
    "contacto = nil"
else
  log "== M. mutantes NO EJECUTADOS (--sin-mutantes)"
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  # Solo datos inventados: las colas de las salidas ayudan a leer el rojo desde el log del CI.
  for f in "$REAL"/*.txt; do echo "--- $(basename "$f")"; grep -v '^+ ' "$f" | tail -n 25; done
  for c in $MUT_FALLADOS; do
    [ -f "$D/estado/m/$c.log" ] && { echo "--- $c.log"; grep -v '^+ ' "$D/estado/m/$c.log" | tail -n 25; }
    for f in "$D/estado/m/$c"/carga-1.txt "$D/estado/m/$c"/sonda-verificar.txt; do
      [ -f "$f" ] && { echo "--- $c/$(basename "$f")"; grep '^HECHO ' "$f"; }
    done
  done
fi

log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
