#!/usr/bin/env bash
# infra/ops/portal-historial/pruebas/prueba-cargador.sh — prueba del cargador del chat del portal (SDD-0586
# §10.5.10, paso 3; mediciones C-2 a C-5 y C-9 a C-14). Corre en GitHub Actions (portal-historial-cargador.yml) o en
# una PC con Docker y turno; nunca en el VPS. Solo datos inventados, sobre la imagen real de Chatwoot del compose de
# infra/chatwoot. Es una copia adaptada de infra/ops/kommo-historial/pruebas/prueba-cargador.sh.
#
#   P    línea base: cuenta, bandeja del portal con un contacto y una conversación que ya existían (la cola), otra
#        bandeja viva, una bandeja con webhook_url y el webhook de la cuenta; control de la cola
#   G    rechazos, sin escribir nada ni dejar vínculos: bandeja con webhook_url, bandeja de otra cuenta, cabecera de
#        otra cuenta, conteos que no cuadran, mensaje de un hilo ausente, agente de otra cuenta, conversación de un
#        cliente sin contacto, AGENTE_SERVICIO de otra cuenta
#   S    seco: cuenta lo que cargará, no escribe nada, ni vínculos, ni consume números de conversación
#   C    carga: conteos, filas, números de conversación y cola de Sidekiq
#   R    repetir la carga (C-3): 0 filas nuevas y los mismos vínculos, también con VINCULOS=- (a la salida estándar)
#   V    lo cargado (C-2, C-9 a C-14) y los vínculos (solo ids, y cada uno es el de Chatwoot)
#   F    la salida del cargador y los vínculos no traen nombres ni textos
#   M    control M0 y mutantes: cada uno rompe una propiedad del cargador y TIENE que tumbar su comprobación, sin
#        caer por otro camino. Corren con escenario-portal.rb, un arranque de Rails por escenario, cada uno en una
#        cuenta nueva sobre la misma base.
#
# Uso:  bash infra/ops/portal-historial/pruebas/prueba-cargador.sh [--conservar] [--sin-mutantes]
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
PH="$(cd "$AQUI/.." && pwd)"
CW="$(cd "$PH/../../chatwoot" && pwd)"
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  if python3 -c 'import sys' >/dev/null 2>&1; then PY=python3; else PY=python; fi
fi
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-portal.XXXXXX")"
D="$TRABAJO/stack"
P="chatwoot-portal"
EDGE="chatwoot_edge_portal"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"
PISO_MB="${PISO_MB:-3072}"
CARGADOR=/tmp/cargador/cargar-portal.rb
SONDA=/tmp/cargador/sonda-portal.rb
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
# rr2 <salida estándar> <salida de errores> VAR=valor... -- <script>: como rr, pero con las dos salidas separadas.
rr2() {
  local sal="$1" err="$2" envs=()
  shift 2
  while [ "$1" != "--" ]; do envs+=(-e "$1"); shift; done
  shift
  dc "${BASE[@]}" run --rm -T "${envs[@]}" prepare bundle exec rails runner "$@" >"$sal" 2>"$err"
}

MARCAS=(SINT-NOMBRE SINT-TEXTO SINTBUSCAR SINT-COLA SINT-EXISTENTE 'Hilo archivado' 4120000001)

# ── Las comprobaciones de un escenario, sobre la carpeta de sus salidas ──────
comprobar() {
  local O="$1" F e
  F="$O/sonda-preparar.txt"
  exigir P1 '[ "$(h "$F" preparar)" = ok ] && [ -n "$(h "$F" cuenta)" ] && [ -n "$(h "$F" portal)" ] && [ -s "$O/preparado.ndjson" ]' \
    "cuenta $(h "$F" cuenta), bandeja del portal $(h "$F" portal) con lo que ya había, y el preparado inventado"
  exigir P2 '[ "$(h "$F" control_cola)" -gt 0 ] 2>/dev/null' \
    "control: crear con los modelos encola $(h "$F" control_cola) trabajos, así que la medida de C-4 y C-5 ve lo que se encola"

  rechazo() { # id archivo error descripción
    F="$O/$2.txt"
    ESPERADO="$3" # una variable: dentro del eval de exigir, $3 sería el argumento de exigir
    exigir "$1" '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "$ESPERADO" ] && [ ! -e "$O/v-x.ndjson" ] && [ ! -e "$O/v-x.ndjson.parcial" ]' "$4: no carga ni deja vínculos ($(h "$F" error))"
  }
  rechazo G1 rechazo-webhook 'la bandeja tiene webhook_url: no se carga' "bandeja con webhook_url"
  rechazo G2 rechazo-cuenta 'la bandeja no existe en esa cuenta' "bandeja de otra cuenta"
  rechazo G3 rechazo-cabecera 'la cabecera no es de esta cuenta y esta bandeja' "cabecera de otra cuenta"
  rechazo G4 rechazo-conteos 'los conteos de la cabecera no coinciden con las líneas' "conteos que no cuadran"
  rechazo G5 rechazo-hilo 'un mensaje es de un hilo que no está en el archivo' "mensaje de un hilo ausente"
  rechazo G6 rechazo-agente 'agente_desconocido' "un agente que no es de la cuenta"
  rechazo G7 rechazo-contacto 'una conversación es de un cliente sin contacto' "una conversación de un cliente sin contacto"
  rechazo G8 rechazo-servicio 'AGENTE_SERVICIO no es un usuario de la cuenta' "AGENTE_SERVICIO de otra cuenta"
  F="$O/rechazo-conteos.txt"
  exigir G9 '[ "$(h "$F" antes)" = "" ] && [ "$(h "$O/seco.txt" antes)" = "conversaciones:1,mensajes:1,contact_inboxes:1" ]' \
    "los rechazos no llegan a escribir: la bandeja sigue con lo de la cola ($(h "$O/seco.txt" antes))"

  F="$O/seco.txt"
  exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" leidas)" = "contactos:3,conversaciones:4,mensajes:8" ]' \
    "lee el archivo entero: $(h "$F" leidas)"
  exigir S2 '[ "$(h "$F" conversaciones_nuevas)" = 4 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" notas_nuevas)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 2 ] && [ "$(h "$F" contactos_reusados)" = 1 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 2 ] && [ "$(h "$F" contact_inboxes_existentes)" = 1 ]' \
    "cuenta lo que cargará: 4 conversaciones, 8 mensajes, 1 nota, 2 contactos nuevos y 1 reusado con su contact_inbox"
  exigir S3 '[ "$(h "$F" despues)" = "$(h "$F" antes)" ] && [ ! -e "$O/v-seco.ndjson" ]' "no escribe nada, ni vínculos ($(h "$F" despues))"
  exigir S4 'avance "$(h "$F" secuencia)" 0' "no consume números de conversación ($(h "$F" secuencia))"
  exigir S5 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' "no encola trabajos ($(h "$F" cola), $(h "$F" trabajos_nuevos))"

  F="$O/carga-1.txt"
  exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = 4 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" notas_nuevas)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 2 ] && [ "$(h "$F" contactos_reusados)" = 1 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 2 ] && [ "$(h "$F" firmados_por_servicio)" = 1 ]' \
    "4 conversaciones, 8 mensajes, 1 nota de archivo, 2 contactos nuevos, 1 reusado, 1 saliente firmado por el usuario de servicio"
  exigir C2 'cero "$(h "$F" contactos_omitidos)" && cero "$(h "$F" conversaciones_omitidas)" && cero "$(h "$F" mensajes_omitidos)" && cero "$(h "$F" contact_inboxes_omitidos)"' \
    "ninguna fila omitida por un conflicto"
  exigir C3 '[ "$(h "$F" despues)" = "conversaciones:5,mensajes:10,contact_inboxes:3" ] && [ "$(h "$F" vinculos)" = 16 ] && [ -s "$O/vinculos-1.ndjson" ] && [ ! -e "$O/vinculos-1.ndjson.parcial" ]' \
    "filas en la bandeja después: $(h "$F" despues); 16 líneas de vínculos ($(h "$F" vinculos))"
  exigir C4 'avance "$(h "$F" secuencia)" 4' "los números de conversación avanzan 4 ($(h "$F" secuencia))"
  exigir C5 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && cero "$(h "$F" correos_enviados)"' \
    "C-4 y C-5: la carga no encola trabajos ni manda correos (cola $(h "$F" cola), $(h "$F" trabajos_nuevos), correos $(h "$F" correos_enviados))"

  for e in 2 3; do
    F="$O/carga-$e.txt"
    exigir "R$e" '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" notas_nuevas)" && cero "$(h "$F" contactos_nuevos)" && cero "$(h "$F" contact_inboxes_nuevos)" && [ "$(h "$F" conversaciones_existentes)" = 4 ] && [ "$(h "$F" mensajes_existentes)" = 8 ] && [ "$(h "$F" notas_existentes)" = 1 ] && [ "$(h "$F" contactos_reusados)" = 3 ] && avance "$(h "$F" secuencia)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && cmp -s "$O/vinculos-1.ndjson" "$O/vinculos-$e.ndjson"' \
      "C-3: la carga $e no agrega filas, ni números, ni trabajos, y devuelve los mismos vínculos$([ "$e" = 3 ] && echo ', con VINCULOS=- en la salida estándar')"
  done

  F="$O/sonda-verificar.txt"
  exigir V0 '[ "$(h "$F" verificar)" = ok ]' "la sonda corrió entera"
  exigir V1 '[ "$(h "$F" cola_igual)" = si ] && [ "$(h "$F" con_webhook_conversaciones)" = 0 ]' \
    "C-4 y C-5: desde la línea base hasta la verificación, la cola es la misma por clase y evento"
  exigir V2 '[ "$(h "$F" conversaciones)" = 4 ] && [ "$(h "$F" mensajes)" = 8 ] && [ "$(h "$F" entrantes)" = 5 ] && [ "$(h "$F" salientes)" = 3 ] && [ "$(h "$F" notas)" = 1:1 ] && [ "$(h "$F" contactos_portal)" = 3 ]' \
    "C-2: 4 conversaciones, 8 mensajes (5 entrantes y 3 salientes), 1 nota de actividad con su texto, 3 contactos"
  exigir V3 '[ "$(h "$F" estados)" = open,resolved,pending,resolved ] && [ "$(h "$F" nota_en_su_hilo)" = si ]' \
    "C-13: los estados ($(h "$F" estados)), y la nota en el hilo archivado"
  exigir V4 '[ "$(h "$F" orden_diferencias)" = 0 ] && [ "$(h "$F" fechas_de_studio)" = si ]' \
    "C-12: el orden de cada hilo es el del preparado ($(h "$F" orden_diferencias) diferencias), con las fechas de Studio"
  exigir V5 'cero "$(h "$F" remitente_cruzado)" && [ -n "$(h "$F" remitente_cruzado)" ] && [ "$(h "$F" firma_servicio)" = si ] && [ "$(h "$F" firma_agente)" = si ]' \
    "remitentes: el entrante es su contacto, el saliente su agente o el usuario de servicio"
  exigir V6 'cero "$(h "$F" contactos_con_datos)" && [ -n "$(h "$F" contactos_con_datos)" ] && [ "$(h "$F" c3_reusado)" = si ] && [ "$(h "$F" ci3_reusado)" = si ] && cero "$(h "$F" huerfanos)" && cero "$(h "$F" contact_inbox_cruzado)"' \
    "C-10: contactos sin teléfono ni correo; el que ya existía, reusado con el contact_inbox de la cola; 0 huérfanos y 0 cruces"
  exigir V7 '[ "$(h "$F" previo_intacto)" = si,si,si,si ]' "C-11: lo que ya había no cambió ($(h "$F" previo_intacto))"
  exigir V8 '[ "$(h "$F" vinculos)" = "lineas:16,claves_malas:0,ids_ok:16,c3_source:si" ]' \
    "los vínculos traen solo ids y cada uno es el de Chatwoot; el contacto reusado devuelve el source_id de su contact_inbox ($(h "$F" vinculos))"
  exigir V9 '[ "$(h "$F" buscador)" -ge 1 ] 2>/dev/null' "C-14: el buscador encuentra un mensaje cargado ($(h "$F" buscador))"
  exigir V10 '[ "$(h "$F" display_nueva_mayor)" = si ] && cero "$(h "$F" display_duplicados)" && [ "$(h "$F" display_en_orden)" = si ]' \
    "C-9: la conversación nueva va después, sin números repetidos, y los cargados siguen el orden de creación"
  exigir V11 '[ "$(h "$F" json_conv)" = 0 ] && [ "$(h "$F" no_leidos)" = 0 ]' "los atributos son objeto JSON y no hay entrantes viejos como no leídos"

  local fugas=0 f m
  for f in rechazo-webhook seco carga-1 carga-2 carga-3 vinculos-1.ndjson; do
    [ "${f%.ndjson}" = "$f" ] && f="$f.txt"
    for m in "${MARCAS[@]}"; do
      if grep -q -F -- "$m" "$O/$f" 2>/dev/null; then
        fugas=$((fugas + 1))
        [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $f"
      fi
    done
  done
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/carga-1.txt" ] && [ -s "$O/vinculos-1.ndjson" ]' "cero de ${#MARCAS[@]} valores inventados en las salidas y en los vínculos"
  return 0
}

log "== prueba del cargador del portal · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
vigilar inicio

# ── Stack: copia como /srv/chatwoot + overlay local + .env de prueba ──────────
log "== stack"
mkdir -p "$D/cargador" "$D/estado/real" "$D/estado/m"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$PH/cargar-portal.rb" "$AQUI/sonda-portal.rb" "$AQUI/escenario-portal.rb" "$D/cargador/"
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

# ── Corrida real: un `rails runner` por paso, el preparado por la entrada estándar ─
log "== corrida real"
R="$D/estado/real"
RC=/tmp/estado/real
rr "$R/sonda-preparar.txt" FASE=preparar "DIR=$RC" -- "$SONDA" </dev/null
C="$(h "$R/sonda-preparar.txt" cuenta)"
B="$(h "$R/sonda-preparar.txt" portal)"
SV="$(h "$R/sonda-preparar.txt" admin)"
W="$(h "$R/sonda-preparar.txt" con_webhook)"
AJ="$(h "$R/sonda-preparar.txt" ajeno)"
cargar() { # salida archivo [VAR=valor...]
  local sal="$1" arch="$2"
  shift 2
  rr "$R/$sal.txt" MODO=cargar "CUENTA=$C" "BANDEJA=$B" "AGENTE_SERVICIO=$SV" CARGA=- "VINCULOS=$RC/v-x.ndjson" "$@" -- "$CARGADOR" <"$R/$arch"
}
cargar rechazo-webhook preparado.ndjson "BANDEJA=$W"
cargar rechazo-cuenta preparado.ndjson CUENTA=999999
cargar rechazo-cabecera preparado-otra-cuenta.ndjson
cargar rechazo-conteos preparado-truncado.ndjson
cargar rechazo-hilo preparado-hilo-ausente.ndjson
cargar rechazo-agente preparado-agente-ajeno.ndjson
cargar rechazo-contacto preparado-sin-contacto.ndjson
cargar rechazo-servicio preparado.ndjson "AGENTE_SERVICIO=$AJ"
cargar seco preparado.ndjson MODO=seco "VINCULOS=$RC/v-seco.ndjson"
cargar carga-1 preparado.ndjson "VINCULOS=$RC/vinculos-1.ndjson"
cargar carga-2 preparado.ndjson "VINCULOS=$RC/vinculos-2.ndjson"
rr2 "$R/vinculos-3.ndjson" "$R/carga-3.txt" MODO=cargar "CUENTA=$C" "BANDEJA=$B" "AGENTE_SERVICIO=$SV" CARGA=- VINCULOS=- \
  -- "$CARGADOR" <"$R/preparado.ndjson"
rr "$R/sonda-verificar.txt" FASE=verificar "DIR=$RC" -- "$SONDA" </dev/null
comprobar "$R"
log "MEDIDA C-9 — números de conversación en la carga: $(h "$R/carga-1.txt" secuencia); rss_pico_kb $(h "$R/carga-1.txt" rss_pico_kb)"
vigilar "corrida real"

# ── M. Control y mutantes ────────────────────────────────────────────────────
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
escenario() { # id → salidas en $D/estado/m/<id>/
  dc "${BASE[@]}" run --rm -T -e "CARGADOR_RB=/tmp/estado/m/$1.rb" -e "SALIDAS=/tmp/estado/m/$1" \
    prepare bundle exec rails runner /tmp/cargador/escenario-portal.rb >"$D/estado/m/$1.log" 2>&1 </dev/null
}
cayeron_en() { local k; for k in "${!RES[@]}"; do [ "${RES[$k]}" = FALLÓ ] && echo "$k"; done | sort | tr '\n' ' '; }
# mutante <id> <qué rompe> <tienen que caer> <tienen que pasar> <texto> <reemplazo>
mutante() {
  local id="$1" que="$2" caen="$3" pasan="$4" faltan="" otro="" c cayeron
  local rb="$D/estado/m/$id.rb"
  if ! mutar "$D/cargador/cargar-portal.rb" "$rb" "$5" "$6" >"$D/estado/m/$id.mutar.txt" 2>&1; then
    mal "$id" "$que: no se pudo aplicar ($(tr -d '\r' <"$D/estado/m/$id.mutar.txt"))"; return 0
  fi
  if cmp -s "$D/cargador/cargar-portal.rb" "$rb"; then mal "$id" "$que: la copia no cambió"; return 0; fi
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
  cp "$D/cargador/cargar-portal.rb" "$D/estado/m/M0.rb"
  escenario M0
  RES=()
  MODO_LOG=0
  comprobar "$D/estado/m/M0"
  MODO_LOG=1
  total=${#RES[@]}
  cayeron="$(cayeron_en)"
  exigir M0 '[ -z "$cayeron" ] && [ "$total" -ge 35 ]' \
    "control: el escenario en un solo proceso pasa las $total comprobaciones de la corrida real${cayeron:+ — cayeron: $cayeron}"
  [ "${RES[M0]}" = FALLÓ ] && MUT_FALLADOS="$MUT_FALLADOS M0"

  mutante M1 "escribe los mensajes con los modelos (callbacks)" "C5 V1" "C1 S1" \
    "Message.insert_all(lote.map(&:last), returning: %w[id source_id]).to_a.to_h { |f| [f['source_id'], f['id'].to_i] }" \
    "lote.map { |_, f| Message.create!(f) }.to_h { |m| [m.source_id, m.id] }"
  mutante M2 "sin la guarda de webhook_url" "G1" "G2 C1" \
    "raise 'la bandeja tiene webhook_url: no se carga' if" "nil if false &&"
  mutante M3 "sin la guarda de cuenta" "G2" "G1 C1" \
    "Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)" "Inbox.find_by(id: @bandeja_id)"
  mutante M4 "sin mirar la cuenta y la bandeja de la cabecera" "G3" "S1" \
    "unless cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id" "unless true"
  mutante M5 "sin mirar los conteos" "G4" "S1" \
    "raise 'los conteos de la cabecera no coinciden con las líneas' unless" "nil unless true ||"
  mutante M6 "sin mirar el hilo de cada mensaje" "G5" "G4 C1" \
    "raise 'un mensaje es de un hilo que no está en el archivo' unless" "nil unless true ||"
  mutante M7 "sin mirar los agentes" "G6" "S1" \
    "raise 'agente_desconocido' unless" "nil unless true ||"
  mutante M8 "sin mirar el usuario de servicio" "G8" "S1" \
    "raise 'AGENTE_SERVICIO no es un usuario de la cuenta' unless" "nil unless true ||"
  mutante M9 "el seco escribe" "S3" "S1 G1" \
    "@modo == 'seco'" "@modo == 'nunca'"
  mutante M10 "el seco inserta conversaciones y las deshace" "S4" "S1 S3" \
    "lote.map { |f| { 'id' => falso, 'display_id' => falso, 'hilo' => f[:additional_attributes]['dtd_hilo'] } }" \
    "Conversation.insert_all(lote, returning: Arel.sql(\"id, display_id, additional_attributes->>'dtd_hilo' AS hilo\")).to_a"
  mutante M11 "no reconoce las conversaciones ya cargadas por dtd_hilo" "R2" "C1 S1" \
    ".where(\"additional_attributes ? 'dtd_hilo'\")" ".where('1 = 0')"
  mutante M12 "no salta los mensajes ya cargados" "R2" "C1" \
    "      if ya.key?(m['source_id'])" "      if false"
  mutante M13 "no reusa el contacto por su identificador" "S2 C1 V6" "S1" \
    "ya = Contact.where(account_id: @cuenta_id, identifier: identificadores).pluck(:identifier, :id).to_h" "ya = {}"
  mutante M14 "no usa el contact_inbox que ya tenía el contacto" "V6 V8" "S1" \
    "@cuenta[:contact_inboxes_existentes] += existentes.size" "existentes = {}"
  mutante M15 "salientes sin su agente" "V5" "C1" \
    "(m['agente'] ? Integer(m['agente']) : @servicio_id)" "@servicio_id"
  mutante M16 "todo como resolved" "V3" "C1" \
    "status: Conversation.statuses.fetch(c['estado'])," "status: Conversation.statuses.fetch('resolved'),"
  mutante M17 "sin la nota de archivo" "S2 C1 V2" "S1" \
    "      nota = c['nota_archivo'] or next" "      next"
  mutante M18 "mensajes en orden inverso" "V4" "C1" \
    "    mensajes.each do |m|
      if ya.key?(m['source_id'])" \
    "    mensajes.reverse_each do |m|
      if ya.key?(m['source_id'])"
  mutante M19 "conversacion_id con el id interno, no el display_id" "V8" "C1" \
    "conversacion_id: conv_de.fetch(c['hilo'])[:display_id]" "conversacion_id: conv_de.fetch(c['hilo'])[:id]"
  mutante M20 "los vínculos llevan el nombre" "V8 F1" "C1" \
    "contacto_id: p[:contacto_id]," "contacto_id: p[:contacto_id], nombre: c['nombre'],"
  mutante M21 "imprime el nombre del contacto" "F1" "C1" \
    "    contactos.each do |c|
      ident =" \
    "    contactos.each do |c|
      hecho('nombre', c['nombre'])
      ident ="
  mutante M22 "mensajes con la fecha de hoy" "V4" "C1" \
    "cuando = instante(m['created_at'])" "cuando = Time.zone.now"
  mutante M23 "sin agent_last_seen_at" "V11" "C1" \
    "last_activity_at: fin, agent_last_seen_at: ahora," "last_activity_at: fin,"
  mutante M24 "los contactos con el teléfono del primero que exista" "V6" "C1" \
    "name: c['nombre'].presence || 'Cliente del portal', identifier: ident," \
    "name: c['nombre'].presence || 'Cliente del portal', identifier: ident, phone_number: '+58412#{rand(1_000_000..9_999_999)}',"
else
  log "== M. mutantes NO EJECUTADOS (--sin-mutantes)"
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  # Solo datos inventados: las salidas ayudan a leer el rojo desde el log del CI.
  for f in "$R"/*.txt; do echo "--- $(basename "$f")"; grep -v '^+ ' "$f" | tail -n 25; done
  for c in $MUT_FALLADOS; do
    [ -f "$D/estado/m/$c.log" ] && { echo "--- $c.log"; grep -v '^+ ' "$D/estado/m/$c.log" | tail -n 25; }
    for f in "$D/estado/m/$c"/carga-1.txt "$D/estado/m/$c"/sonda-verificar.txt; do
      [ -f "$f" ] && { echo "--- $c/$(basename "$f")"; grep '^HECHO ' "$f"; }
    done
  done
fi

log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
