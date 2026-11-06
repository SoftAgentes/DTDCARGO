#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-cargador.sh — prueba LOCAL del cargador del «Archivo Kommo»
# (SDD-0590 paso 5.5, mediciones E-3 a E-11). Nunca en el VPS. Solo datos inventados, sobre la imagen real
# de Chatwoot (la del compose de infra/chatwoot). Es una corrida pesada (Docker): una a la vez.
#
#   D  el archivo de carga sale del extractor real (`vincular` + `preparar-carga`) con los conteos esperados
#   P  línea base: cuenta, bandeja viva con datos que ya existían, webhook de la cuenta; control de la cola
#   B  crear la bandeja: canal API sin webhook_url ni miembros; la segunda vez devuelve la misma
#   G  rechazos: bandeja con webhook_url y bandeja de otra cuenta → no carga nada
#   S  seco: cuenta lo mismo que cargará, no escribe nada ni consume números de conversación
#   C  carga y segunda carga (0 filas nuevas)
#   F  la salida del cargador no trae nombres, teléfonos, correos ni textos
#   E  la sonda: E-3 cola, E-4 lo cargado, E-8 números, E-9 huérfanos y duplicados, E-10 búsqueda,
#      E-11 lo que ya existía
#
# El archivo de carga entra al contenedor por la entrada estándar, como en el servidor.
# Vigila la memoria de Windows: si el commit libre baja de PISO_MB (3072), para y baja el stack.
#
# Uso:  bash infra/ops/kommo-historial/pruebas/prueba-cargador.sh [--conservar]
# Salida: PASÓ/FALLÓ por comprobación y $TRABAJO/resumen.txt; sale 0 solo sin fallas.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
for a in "$@"; do
  case "$a" in --conservar) CONSERVAR=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KH="$(cd "$AQUI/.." && pwd)"
CW="$(cd "$KH/../../chatwoot" && pwd)"
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  if python3 -c 'import sys' >/dev/null 2>&1; then PY=python3; else PY=python; fi
fi
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-cargador.XXXXXX")"
D="$TRABAJO/stack"
S="$TRABAJO/staging"
P="chatwoot-cargador"
EDGE="chatwoot_edge_cargador"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"
PISO_MB="${PISO_MB:-3072}"
CARGADOR=/tmp/cargador/cargar-archivo-kommo.rb
SONDA=/tmp/cargador/sonda-cargador.rb

win() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s\n' "$1"; fi; }
dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -f "$D/compose.yml" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
limpiar() {
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stack arriba en $D)"; return; }
  bajar_todo
}
trap limpiar EXIT

log() { echo "$*" | tee -a "$RESUMEN"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() { if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi; return 0; }
h() { sed -n "s/^HECHO $2=//p" "$1" | tail -n 1 | tr -d '\r'; }
cero() { [ "${1:-0}" = 0 ]; }
cola_igual() { [ -n "$1" ] && [ "${1%%->*}" = "${1##*->}" ] && [ "${1%%->*}" != -1 ]; }
avance() { [ -n "$1" ] && [ $(( ${1##*->} - ${1%%->*} )) = "$2" ]; }

memoria_libre_mb() {
  command -v powershell.exe >/dev/null 2>&1 || { echo 999999; return; }
  powershell.exe -NoProfile -Command '[int]((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1024)' 2>/dev/null | tr -d '\r'
}
vigilar() {
  local mb
  mb="$(memoria_libre_mb)"
  log "   memoria: commit libre ${mb} MB ($1)"
  if [ "${mb:-0}" -lt "$PISO_MB" ]; then
    mal MEM "commit libre ${mb} MB bajo el piso de ${PISO_MB} MB ($1): se para y se baja el stack"
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

log "== prueba del cargador del Archivo Kommo · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
vigilar inicio

# ── D. Archivo de carga con el extractor real ────────────────────────────────
log "== D. archivo de carga"
"$PY" -I "$(win "$AQUI/generar-sintetico.py")" "$(win "$S")" >"$TRABAJO/generar.txt" 2>&1 \
  || { mal D0 "no se generaron los datos (ver $TRABAJO/generar.txt)"; exit 1; }
"$PY" -I "$(win "$KH/respaldar-historial.py")" vincular --staging "$(win "$S")" --clientes "$(win "$S/clientes.ndjson")" \
  >"$TRABAJO/vincular.txt" 2>&1 || { mal D0 "vincular falló (ver $TRABAJO/vincular.txt)"; exit 1; }
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
mkdir -p "$D/cargador" "$D/estado"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$KH/cargar-archivo-kommo.rb" "$AQUI/sonda-cargador.rb" "$D/cargador/"
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
  mal P0 "Postgres/Redis no arrancaron (ver $TRABAJO/up.txt)"; exit 1
fi
if ! dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null; then
  mal P0 "db:chatwoot_prepare falló (ver $TRABAJO/prepare.txt)"; exit 1
fi
vigilar "base migrada"

# ── P. Línea base ────────────────────────────────────────────────────────────
log "== P. línea base"
F="$TRABAJO/sonda-preparar.txt"
rr "$F" FASE=preparar -- "$SONDA" </dev/null
CUENTA="$(h "$F" cuenta)"
CONW="$(h "$F" con_webhook)"
CONTROL="$(h "$F" control_cola)"
exigir P1 '[ "$(h "$F" preparar)" = ok ] && [ -n "$CUENTA" ] && [ -n "$CONW" ]' \
  "cuenta $CUENTA, bandeja viva con datos que ya existían, bandeja con webhook_url ($CONW) y webhook de la cuenta"
exigir P2 '[ "${CONTROL:-0}" -gt 0 ] 2>/dev/null' \
  "control: crear con los modelos encola ${CONTROL:-?} trabajos, así que la medida de E-3 ve lo que se encola"
vigilar "línea base"

# ── B. Crear la bandeja ──────────────────────────────────────────────────────
log "== B. bandeja Archivo Kommo"
F="$TRABAJO/bandeja-1.txt"
rr "$F" MODO=crear-bandeja "CUENTA=$CUENTA" "NOMBRE=Archivo Kommo" -- "$CARGADOR" </dev/null
B="$(h "$F" bandeja)"
exigir B1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" bandeja_existia)" = no ] && [ -n "$B" ] && [ "$(h "$F" webhook_url)" = no ] && [ "$(h "$F" miembros)" = 0 ]' \
  "bandeja $B: canal API, sin webhook_url, sin miembros"
exigir B2 'cola_igual "$(h "$F" cola)"' "crear la bandeja no encola trabajos (cola $(h "$F" cola))"
F="$TRABAJO/bandeja-2.txt"
rr "$F" MODO=crear-bandeja "CUENTA=$CUENTA" "NOMBRE=Archivo Kommo" -- "$CARGADOR" </dev/null
exigir B3 '[ "$(h "$F" bandeja)" = "$B" ] && [ "$(h "$F" bandeja_existia)" = si ]' "la segunda vez devuelve la misma bandeja"

# ── G. Rechazos ──────────────────────────────────────────────────────────────
log "== G. rechazos"
F="$TRABAJO/rechazo-webhook.txt"
rr "$F" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$CONW" CARGA=- -- "$CARGADOR" <"$CARGA"
exigir G1 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "la bandeja tiene webhook_url: no se carga" ]' \
  "bandeja con webhook_url: no carga"
F="$TRABAJO/rechazo-cuenta.txt"
rr "$F" MODO=cargar CUENTA=999999 "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
exigir G2 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "la bandeja no existe en esa cuenta" ]' \
  "bandeja de otra cuenta: no carga"

# ── S. Seco ──────────────────────────────────────────────────────────────────
log "== S. seco"
F="$TRABAJO/seco.txt"
rr "$F" MODO=seco "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" leidas)" = "personas:4,conversaciones:5,mensajes:8" ]' \
  "lee el archivo entero por la entrada estándar: $(h "$F" leidas)"
exigir S2 '[ "$(h "$F" conversaciones_nuevas)" = 5 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" personas_nuevas)" = 3 ] && [ "$(h "$F" personas_reusadas)" = 2 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 5 ]' \
  "cuenta lo que cargará: 5 conversaciones, 8 mensajes, 3 personas nuevas y 2 reusadas"
exigir S3 '[ "$(h "$F" antes)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$F" despues)" = "$(h "$F" antes)" ]' \
  "no escribe nada ($(h "$F" despues))"
exigir S4 'avance "$(h "$F" secuencia)" 0' "no consume números de conversación ($(h "$F" secuencia))"
exigir S5 'cola_igual "$(h "$F" cola)"' "no encola trabajos ($(h "$F" cola))"
vigilar seco

# ── C. Carga y segunda carga ─────────────────────────────────────────────────
log "== C. carga"
F="$TRABAJO/carga-1.txt"
rr "$F" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = 5 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" personas_nuevas)" = 3 ] && [ "$(h "$F" personas_reusadas)" = 2 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 5 ]' \
  "5 conversaciones, 8 mensajes, 3 personas nuevas (2 de Kommo y «sin contacto»), 2 reusadas, 5 contact_inboxes"
exigir C2 '[ "$(h "$F" conversaciones_sin_contacto)" = 1 ] && [ "$(h "$F" adjuntos_pendientes)" = 1 ] && [ "$(h "$F" mensajes_sin_texto)" = 1 ]' \
  "1 conversación sin contacto, 1 adjunto pendiente, 1 mensaje sin texto"
exigir C3 'cero "$(h "$F" personas_omitidas)" && cero "$(h "$F" conversaciones_omitidas)" && cero "$(h "$F" mensajes_omitidos)" && cero "$(h "$F" contact_inboxes_omitidos)" && cero "$(h "$F" mensajes_sin_conversacion)"' \
  "ninguna fila omitida por un conflicto ni mensaje sin conversación"
exigir C4 '[ "$(h "$F" despues)" = "conversaciones:5,mensajes:8,contact_inboxes:5" ]' "lo cargado es el archivo de carga, E-4 ($(h "$F" despues))"
exigir C5 'avance "$(h "$F" secuencia)" 5' "los números de conversación avanzan 5 ($(h "$F" secuencia))"
exigir C6 'cola_igual "$(h "$F" cola)"' "E-3: la carga no encola trabajos ($(h "$F" cola))"
F="$TRABAJO/carga-2.txt"
rr "$F" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
exigir C7 '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" personas_nuevas)" && cero "$(h "$F" contact_inboxes_nuevos)"' \
  "segunda carga: 0 filas nuevas (E-5)"
exigir C8 '[ "$(h "$F" conversaciones_existentes)" = 5 ] && [ "$(h "$F" mensajes_existentes)" = 8 ] && [ "$(h "$F" personas_reusadas)" = 4 ] && [ "$(h "$F" despues)" = "conversaciones:5,mensajes:8,contact_inboxes:5" ]' \
  "reconoce lo cargado: 5 conversaciones, 8 mensajes y 4 personas"
exigir C9 'avance "$(h "$F" secuencia)" 0 && cola_igual "$(h "$F" cola)"' "ni números ni trabajos ($(h "$F" secuencia), cola $(h "$F" cola))"
vigilar carga

# ── F. La salida del cargador no trae datos de personas ──────────────────────
log "== F. fugas en la salida del cargador"
MARCAS=(SINT-NOMBRE SINT-TEXTO SINTBUSCAR SINTVIEJO SINT-Asesora SINT-Salesbot 4120000001 4120000002 example.test SINT-C1 SINT-AVATAR Pérez kommo.example)
fugas=0
for f in bandeja-1 bandeja-2 rechazo-webhook rechazo-cuenta seco carga-1 carga-2; do
  for m in "${MARCAS[@]}"; do
    if grep -q -F -- "$m" "$TRABAJO/$f.txt"; then fugas=$((fugas + 1)); log "   fuga: $m en $f"; fi
  done
done
exigir F1 '[ "$fugas" = 0 ]' "cero de ${#MARCAS[@]} valores inventados en 7 salidas del cargador"

# ── E. La sonda ──────────────────────────────────────────────────────────────
log "== E. mediciones"
F="$TRABAJO/sonda-verificar.txt"
rr "$F" FASE=verificar "BANDEJA=$B" -- "$SONDA" </dev/null
exigir E0 '[ "$(h "$F" verificar)" = ok ]' "la sonda corrió entera"
exigir E3 '[ "$(h "$F" cola_delta)" = 0 ] && [ "$(h "$F" con_webhook_conversaciones)" = 0 ]' \
  "E-3: 0 trabajos encolados desde la línea base y 0 conversaciones en la bandeja con webhook"
exigir E4a '[ "$(h "$F" conversaciones)" = 5 ] && [ "$(h "$F" mensajes)" = 8 ] && [ "$(h "$F" entrantes)" = 5 ] && [ "$(h "$F" salientes)" = 3 ] && [ "$(h "$F" resueltas)" = 5 ]' \
  "E-4: 5 conversaciones resueltas, 8 mensajes (5 entrantes, 3 salientes)"
exigir E4b '[ "$(h "$F" historicas)" = 1 ] && [ "$(h "$F" mensajes_historicos)" = 3 ]' "con sus fechas de Kommo: 1 conversación y 3 mensajes de hace más de 400 días"
exigir E4c '[ "$(h "$F" autores)" = "Bot Kommo|SINT-Asesora|SINT-Asesora" ]' "los salientes llevan su autor por nombre de pila o «Bot Kommo»"
exigir E4d '[ "$(h "$F" json_conv)" = 0 ] && [ "$(h "$F" json_msg)" = 0 ]' "los atributos quedan como objeto JSON, no como texto"
exigir E4e '[ "$(h "$F" procesado_faltante)" = 0 ] || [ "$(h "$F" procesado_faltante)" = sin_columna ]' \
  "processed_message_content lleno donde hay texto ($(h "$F" procesado_faltante))"
exigir E4f '[ "$(h "$F" no_leidos)" = 0 ]' "la bandeja no muestra entrantes viejos como no leídos ($(h "$F" no_leidos))"
exigir E8a '[ "$(h "$F" display_nueva_mayor)" = si ] && [ "$(h "$F" display_duplicados)" = 0 ] && [ "$(h "$F" display_nulos)" = 0 ]' \
  "E-8: la conversación nueva va después, sin números repetidos ni vacíos"
exigir E8b '[ "$(h "$F" display_en_orden)" = si ]' "los números del archivo siguen el orden de creación"
exigir E9a 'cero "$(h "$F" huerfanos_mensaje)" && cero "$(h "$F" huerfanos_conversacion)" && cero "$(h "$F" sin_contact_inbox)" && cero "$(h "$F" contact_inbox_cruzado)" && cero "$(h "$F" remitente_cruzado)"' \
  "E-9: 0 huérfanos, 0 cruces de contact_inbox y 0 remitentes cruzados"
exigir E9b '[ "$(h "$F" tel_x1)" = 1 ] && [ "$(h "$F" correo_x2)" = 1 ] && [ "$(h "$F" tel_grupo)" = 1 ]' \
  "E-9: ni el teléfono ni el correo existentes se duplican; el grupo de dos contactos es una persona"
exigir E9c '[ "$(h "$F" x1_reusado)" = si ] && [ "$(h "$F" x2_reusado)" = si ] && [ "$(h "$F" grupo_unido)" = si ] && [ "$(h "$F" sin_contacto)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 3 ]' \
  "E-9: reusa por teléfono y por correo (mayúsculas distintas), 3 contactos nuevos en total"
exigir E10a '[ "$(h "$F" ilike_reciente)" = 1 ] && [ "$(h "$F" ilike_viejo)" = 1 ]' "E-10: el texto cargado se encuentra en la base"
exigir E10b '[ "$(h "$F" buscador_reciente)" -ge 1 ] 2>/dev/null' "E-10: el buscador de Chatwoot encuentra un mensaje reciente ($(h "$F" buscador_reciente))"
log "MEDIDA E10c — el buscador de Chatwoot con un mensaje de hace 500 días: $(h "$F" buscador_viejo)"
exigir E11 '[ "$(h "$F" conv_viva_intacta)" = si ] && [ "$(h "$F" x1_intacto)" = si ] && [ "$(h "$F" x2_intacto)" = si ] && [ "$(h "$F" mensajes_vivos_delta)" = 0 ]' \
  "E-11: la conversación y los contactos que ya existían no cambiaron"
vigilar fin

log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
