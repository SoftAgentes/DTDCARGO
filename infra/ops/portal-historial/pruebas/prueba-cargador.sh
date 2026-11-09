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
#        cliente sin contacto, AGENTE_SERVICIO de otra cuenta; G10 otra bandeja API sin webhook (SINT WhatsApp y
#        «Archivo Kommo», como la 8 de producción); G11 VINCULOS en otra ruta; G12 otra carga con el candado tomado
#   G13  dos cargas a la vez: con el candado, una se niega y queda una sola copia · G14 un mensaje ya cargado que
#        llega en otro hilo: aborta · R4 repetir con otro estado en un hilo: se actualiza
#   N4   sin MODO, el script sale con error
#   F2   con el log de SQL en debug, nada de lo cargado sale en él
#   L    4.10, el log de Postgres: L1 control, el log escribe la fila y la sentencia de un insert que falla · L2 un
#        insert_all del cargador que falla deja el error en el log, pero no la marca SINT-LOG-<cuenta>-<sal> · L3 con un rol
#        sin superusuario, no carga (no_se_puede_bajar_el_detalle_del_log)
#   S    seco: cuenta lo que cargará, no escribe nada, ni vínculos, ni consume números de conversación
#   C    carga: conteos, filas, números de conversación y cola de Sidekiq
#   R    repetir la carga (C-3): 0 filas nuevas y los mismos vínculos, también con VINCULOS=- (a la salida estándar,
#        con el prefijo VINCULO, entre los logs de Rails)
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
    VX="$O/vinculos-$2"
    exigir "$1" '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "$ESPERADO" ] && [ ! -e "$VX.ndjson" ] && [ ! -e "$VX.parcial" ]' "$4: no carga ni deja vínculos ($(h "$F" error))"
  }
  rechazo G1 rechazo-webhook 'la bandeja tiene webhook_url: no se carga' "bandeja con webhook_url"
  rechazo G2 rechazo-cuenta 'la bandeja no existe en esa cuenta' "bandeja de otra cuenta"
  rechazo G3 rechazo-cabecera 'la cabecera no es de esta cuenta y esta bandeja' "cabecera de otra cuenta"
  rechazo G4 rechazo-conteos 'los conteos de la cabecera no coinciden con las líneas' "conteos que no cuadran"
  rechazo G5 rechazo-hilo 'un mensaje es de un hilo que no está en el archivo' "mensaje de un hilo ausente"
  rechazo G6 rechazo-agente 'agente_desconocido' "un agente que no es de la cuenta"
  rechazo G7 rechazo-contacto 'una conversación es de un cliente sin contacto' "una conversación de un cliente sin contacto"
  rechazo G8 rechazo-servicio 'AGENTE_SERVICIO no es un usuario de la cuenta' "AGENTE_SERVICIO de otra cuenta"
  rechazo G10a rechazo-whatsapp 'la bandeja no es «Conversaciones del portal»' "otra bandeja API sin webhook (SINT WhatsApp), con la cabecera de esa bandeja"
  rechazo G10b rechazo-archivo 'la bandeja no es «Conversaciones del portal»' "la bandeja «Archivo Kommo», API y sin webhook, como la 8 de producción"
  rechazo G11 rechazo-ruta 'VINCULOS tiene que ser /dev/shm/portal-historial/vinculos.ndjson o -' "VINCULOS en otra ruta"
  rechazo G12 rechazo-candado 'otra carga del portal en curso' "otra carga con el candado tomado"
  rechazo G15 rechazo-guarda-mensaje 'una conversación ya cargada cambió en Chatwoot (mensajes ajenos 1, asignadas 0, snoozed 0)' "R4: no actualiza el estado de una conversación con un mensaje de un agente"
  rechazo G16 rechazo-guarda-asignada 'una conversación ya cargada cambió en Chatwoot (mensajes ajenos 0, asignadas 1, snoozed 0)' "R4: no actualiza el estado de una conversación asignada"
  rechazo G17 rechazo-guarda-snoozed 'una conversación ya cargada cambió en Chatwoot (mensajes ajenos 0, asignadas 0, snoozed 1)' "R4: no actualiza el estado de una conversación en snoozed"
  rechazo G14 rechazo-movido 'un mensaje ya existe en otra conversación' "un mensaje ya cargado que llega en otro hilo"
  F="$O/concurrencia.txt"
  exigir G13 '[ "$(h "$F" concurrencia_conversaciones)" = 4 ] && [ "$(h "$F" concurrencia_mensajes)" = 9 ] && [ "$(h "$F" concurrencia_negadas)" = 1 ] && [ "$(h "$F" concurrencia_ok)" = 1 ] && [ "$(h "$F" concurrencia_esperando)" -ge 1 ] 2>/dev/null && [ "$(h "$F" concurrencia_cancelados)" = 0 ]' \
    "dos cargas a la vez: una se niega por el candado y queda una sola copia ($(h "$F" concurrencia_conversaciones) conversaciones, $(h "$F" concurrencia_mensajes) mensajes y notas; negadas $(h "$F" concurrencia_negadas), canceladas $(h "$F" concurrencia_cancelados), esperó $(h "$F" concurrencia_esperado_s) s de $(h "$F" concurrencia_tope_s), wait_event $(h "$F" concurrencia_wait_event))"
  [ "$MODO_LOG" = 1 ] && log "MEDIDA G13 — statement_timeout de las conexiones: $(h "$F" concurrencia_statement_timeout_ms) ms; tope de la espera: $(h "$F" concurrencia_tope_s) s"
  F="$O/carga-estado.txt"
  exigir R4 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_estado_actualizado)" = 1 ] && [ "$(h "$O/estado.txt" estado_h1)" = resolved ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
    "repetir con otro estado en un hilo ya cargado: se actualiza ese estado y nada más ($(h "$F" conversaciones_estado_actualizado))"
  F="$O/rechazo-conteos.txt"
  exigir G9 '[ "$(h "$F" antes)" = "" ] && [ "$(h "$O/seco.txt" antes)" = "conversaciones:1,mensajes:1,contact_inboxes:1" ]' \
    "los rechazos no llegan a escribir: la bandeja sigue con lo de la cola ($(h "$O/seco.txt" antes))"

  F="$O/seco.txt"
  exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" leidas)" = "contactos:3,conversaciones:4,mensajes:8" ]' \
    "lee el archivo entero: $(h "$F" leidas)"
  exigir S2 '[ "$(h "$F" conversaciones_nuevas)" = 4 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" notas_nuevas)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 2 ] && [ "$(h "$F" contactos_reusados)" = 1 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 2 ] && [ "$(h "$F" contact_inboxes_existentes)" = 1 ]' \
    "cuenta lo que cargará: 4 conversaciones, 8 mensajes, 1 nota, 2 contactos nuevos y 1 reusado con su contact_inbox"
  exigir S3 '[ "$(h "$F" despues)" = "$(h "$F" antes)" ] && [ ! -e "$O/vinculos-seco.ndjson" ]' "no escribe nada, ni vínculos ($(h "$F" despues))"
  exigir S4 'avance "$(h "$F" secuencia)" 0' "no consume números de conversación ($(h "$F" secuencia))"
  exigir S5 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' "no encola trabajos ($(h "$F" cola), $(h "$F" trabajos_nuevos))"

  F="$O/carga-1.txt"
  exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = 4 ] && [ "$(h "$F" mensajes_nuevos)" = 8 ] && [ "$(h "$F" notas_nuevas)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 2 ] && [ "$(h "$F" contactos_reusados)" = 1 ] && [ "$(h "$F" contact_inboxes_nuevos)" = 2 ] && [ "$(h "$F" firmados_por_servicio)" = 1 ]' \
    "4 conversaciones, 8 mensajes, 1 nota de archivo, 2 contactos nuevos, 1 reusado, 1 saliente firmado por el usuario de servicio"
  exigir C2 'cero "$(h "$F" contactos_omitidos)" && cero "$(h "$F" conversaciones_omitidas)" && cero "$(h "$F" mensajes_omitidos)" && cero "$(h "$F" contact_inboxes_omitidos)"' \
    "ninguna fila omitida por un conflicto"
  exigir C3 '[ "$(h "$F" despues)" = "conversaciones:5,mensajes:10,contact_inboxes:3" ] && [ "$(h "$F" vinculos)" = 16 ] && [ -s "$O/vinculos-carga-1.ndjson" ] && [ -r "$O/vinculos-carga-1.ndjson" ] && [ ! -e "$O/vinculos-carga-1.parcial" ]' \
    "filas en la bandeja después: $(h "$F" despues); 16 líneas de vínculos ($(h "$F" vinculos))"
  exigir C4 'avance "$(h "$F" secuencia)" 4' "los números de conversación avanzan 4 ($(h "$F" secuencia))"
  exigir C5 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && cero "$(h "$F" correos_enviados)"' \
    "C-4 y C-5: la carga no encola trabajos ni manda correos (cola $(h "$F" cola), $(h "$F" trabajos_nuevos), correos $(h "$F" correos_enviados))"

  for e in 2 3; do
    F="$O/carga-$e.txt"
    exigir "R$e" '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" notas_nuevas)" && cero "$(h "$F" contactos_nuevos)" && cero "$(h "$F" contact_inboxes_nuevos)" && [ "$(h "$F" conversaciones_existentes)" = 4 ] && [ "$(h "$F" mensajes_existentes)" = 8 ] && [ "$(h "$F" notas_existentes)" = 1 ] && [ "$(h "$F" contactos_reusados)" = 3 ] && avance "$(h "$F" secuencia)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && cero "$(h "$F" conversaciones_estado_actualizado)" && cmp -s "$O/vinculos-carga-1.ndjson" "$O/vinculos-carga-$e.ndjson"' \
      "C-3: la carga $e no agrega filas, ni números, ni trabajos, y devuelve los mismos vínculos$([ "$e" = 3 ] && echo ', con VINCULOS=- en la salida estándar')"
  done

  F="$O/sonda-verificar.txt"
  exigir V0 '[ "$(h "$F" verificar)" = ok ]' "la sonda corrió entera"
  exigir V1 '[ "$(h "$F" cola_igual)" = si ] && [ "$(h "$F" con_webhook_conversaciones)" = 0 ]' \
    "C-4 y C-5: desde la línea base hasta la verificación, la cola es la misma por clase y evento"
  exigir V2 '[ "$(h "$F" conversaciones)" = 4 ] && [ "$(h "$F" mensajes)" = 8 ] && [ "$(h "$F" entrantes)" = 5 ] && [ "$(h "$F" salientes)" = 3 ] && [ "$(h "$F" notas)" = 1:1 ] && [ "$(h "$F" contactos_portal)" = 3 ]' \
    "C-2: 4 conversaciones, 8 mensajes (5 entrantes y 3 salientes), 1 nota de actividad con su texto, 3 contactos"
  # C-13 se mide justo después de la carga 1 (estados-1.txt): una repetición ya no puede corregir un estado mal cargado.
  exigir V3 '[ "$(h "$O/estados-1.txt" estados)" = open,resolved,pending,resolved ] && [ "$(h "$O/estados-1.txt" nota_en_su_hilo)" = si ]' \
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
  # Piso: con la bandeja vacía, «0 no leídos» y «0 atributos malos» pasarían sin mirar nada.
  exigir V12 '[ "$(h "$F" pubsub_nulos)" = 3:0 ]' "los 3 contact_inbox de la bandeja tienen pubsub_token ($(h "$F" pubsub_nulos))"
  exigir V11 '[ "$(h "$F" conversaciones)" = 4 ] && [ "$(h "$F" entrantes)" = 5 ] && [ "$(h "$F" json_conv)" = 0 ] && [ "$(h "$F" no_leidos)" = 0 ]' "sobre las 4 conversaciones cargadas, los atributos son objeto JSON y no hay entrantes viejos como no leídos"

  local fugas=0 f m
  for f in rechazo-webhook seco carga-1 carga-2 carga-3 vinculos-carga-1.ndjson; do
    [ "${f%.ndjson}" = "$f" ] && f="$f.txt"
    for m in "${MARCAS[@]}"; do
      if grep -q -F -- "$m" "$O/$f" 2>/dev/null; then
        fugas=$((fugas + 1))
        [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $f"
      fi
    done
  done
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/carga-1.txt" ] && [ -s "$O/vinculos-carga-1.ndjson" ] && [ -r "$O/vinculos-carga-1.ndjson" ]' "cero de ${#MARCAS[@]} valores inventados en las salidas y en los vínculos"
  # F2: el log de SQL en debug durante la carga 1. La consulta de control prueba que el log escribía.
  local fugas_log=0
  for m in "${MARCAS[@]}"; do grep -q -F -- "$m" "$O/sql.log" 2>/dev/null && fugas_log=$((fugas_log + 1)); done
  exigir F2 '[ -r "$O/sql.log" ] && grep -q SINT-CONTROL-LOG "$O/sql.log" && [ "$fugas_log" = 0 ]' \
    "con el log de SQL en debug, la consulta de control sale y ninguno de los ${#MARCAS[@]} valores inventados ($fugas_log)"
  # L: el log de Postgres del escenario (docker compose logs, después del escenario). La restricción es de esta cuenta.
  F="$O/log-postgres.txt"
  PGL="$O.postgres.log" # junto a la carpeta: la carpeta del escenario la crea el contenedor
  RESTR="$(h "$F" log_restriccion)"
  MARCA_L="$(h "$F" log_marca)"
  CONTROL_L="$(h "$F" log_control)"
  local errores_l=0 marca_l=0
  if [ -n "$RESTR" ] && [ -n "$MARCA_L" ] && [ -r "$PGL" ]; then
    errores_l="$(grep -c -F -- "violates check constraint \"$RESTR\"" "$PGL")"
    marca_l="$(grep -c -F -- "$MARCA_L" "$PGL")"
  fi
  exigir L1 '[ "$(h "$F" log_postgres)" = ok ] && [ "$(h "$F" log_control_fallo)" = si ] && grep -F -- "$CONTROL_L" "$PGL" | grep -q "DETAIL:" && grep -F -- "$CONTROL_L" "$PGL" | grep -q "STATEMENT:"' \
    "control: un insert que falla, sin los SET LOCAL, deja en el log de Postgres la fila (DETAIL) y la sentencia (STATEMENT)"
  F="$O/rechazo-log.txt"
  exigir L2 '[ "$(h "$F" carga)" = error ] && [ "$errores_l" -ge 2 ] 2>/dev/null && [ "$marca_l" = 0 ] && ! grep -q -F -- "$MARCA_L" "$F" && [ "$(h "$O/log-postgres.txt" log_contactos_marca)" = 0 ] && [ ! -e "$O/vinculos-rechazo-log.ndjson" ]' \
    "4.10: un insert_all del cargador que falla llega al log de Postgres ($errores_l errores de $RESTR) sin la fila ni la sentencia (la marca sale $marca_l veces), y no carga nada ($(h "$F" error))"
  F="$O/rechazo-sin-super.txt"
  exigir L3 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = no_se_puede_bajar_el_detalle_del_log ] && [ ! -e "$O/vinculos-rechazo-sin-super.ndjson" ]' \
    "4.10: con un rol sin superusuario no puede bajar el detalle del log y no carga ($(h "$F" error))"
  return 0
}

log "== prueba del cargador del portal · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
vigilar inicio

# ── Stack: copia como /srv/chatwoot + overlay local + .env de prueba ──────────
log "== stack"
mkdir -p "$D/cargador" "$D/estado/real" "$D/estado/m" "$D/estado/shm"
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
SHM="$D/estado/shm" # montada en el contenedor como /dev/shm/portal-historial (compose.cargador.yml)
FIJA=/dev/shm/portal-historial/vinculos.ndjson
mover() { # paso: los vínculos de la ruta fija pasan a $R/vinculos-<paso>.*
  [ -e "$SHM/vinculos.ndjson" ] && mv -f "$SHM/vinculos.ndjson" "$R/vinculos-$1.ndjson"
  [ -e "$SHM/vinculos.ndjson.parcial" ] && mv -f "$SHM/vinculos.ndjson.parcial" "$R/vinculos-$1.parcial"
  return 0
}
rm -f "$SHM"/vinculos.ndjson*
rr "$R/sonda-preparar.txt" FASE=preparar "DIR=$RC" -- "$SONDA" </dev/null
C="$(h "$R/sonda-preparar.txt" cuenta)"
B="$(h "$R/sonda-preparar.txt" portal)"
SV="$(h "$R/sonda-preparar.txt" admin)"
W="$(h "$R/sonda-preparar.txt" con_webhook)"
AJ="$(h "$R/sonda-preparar.txt" ajeno)"
VV="$(h "$R/sonda-preparar.txt" viva)"
AR="$(h "$R/sonda-preparar.txt" archivo)"
cargar() { # salida archivo [VAR=valor...]
  local sal="$1" arch="$2"
  shift 2
  rr "$R/$sal.txt" MODO=cargar "CUENTA=$C" "BANDEJA=$B" "AGENTE_SERVICIO=$SV" CARGA=- "VINCULOS=$FIJA" "$@" -- "$CARGADOR" <"$R/$arch"
  mover "$sal"
}
cargar rechazo-webhook preparado.ndjson "BANDEJA=$W"
cargar rechazo-cuenta preparado.ndjson CUENTA=999999
cargar rechazo-cabecera preparado-otra-cuenta.ndjson
cargar rechazo-conteos preparado-truncado.ndjson
cargar rechazo-hilo preparado-hilo-ausente.ndjson
cargar rechazo-agente preparado-agente-ajeno.ndjson
cargar rechazo-contacto preparado-sin-contacto.ndjson
cargar rechazo-servicio preparado.ndjson "AGENTE_SERVICIO=$AJ"
cargar rechazo-whatsapp preparado-whatsapp.ndjson "BANDEJA=$VV"
cargar rechazo-archivo preparado-archivo.ndjson "BANDEJA=$AR"
cargar rechazo-ruta preparado.ndjson VINCULOS=/tmp/vinculos-en-otra-ruta.ndjson
rr "$R/sonda-candado.txt" FASE=candado "DIR=$RC" -- "$SONDA" </dev/null
mover rechazo-candado
cargar seco preparado.ndjson MODO=seco
# La carga 1, con el log de SQL en debug (F2), en el proceso de la sonda.
rr "$R/sonda-con-log.txt" FASE=con-log "DIR=$RC" -- "$SONDA" </dev/null
mover carga-1
rr "$R/estados-1.txt" FASE=estados "DIR=$RC" -- "$SONDA" </dev/null
cargar carga-2 preparado.ndjson
# Con VINCULOS=-, la salida de rails runner trae también Bundler y los logs de los inicializadores: los vínculos se
# extraen por su prefijo (solo en pruebas; en el VPS va la ruta fija).
cargar carga-3 preparado.ndjson VINCULOS=-
sed -n 's/^VINCULO //p' "$R/carga-3.txt" | tr -d '\r' >"$R/vinculos-carga-3.ndjson"
# N4: sin MODO, el script sale con error.
rr "$R/sin-modo.txt" "CUENTA=$C" "BANDEJA=$B" "AGENTE_SERVICIO=$SV" CARGA=- "VINCULOS=$FIJA" -- "$CARGADOR" </dev/null
echo "HECHO salida_proceso=$?" >>"$R/sin-modo.txt"
mover sin-modo
cargar rechazo-movido preparado-movido.ndjson
rr "$R/sonda-verificar.txt" FASE=verificar "DIR=$RC" -- "$SONDA" </dev/null
# Después de verificar: los dos encolan o cambian cosas que la verificación no espera.
cargar carga-estado preparado-estado.ndjson
rr "$R/estado.txt" FASE=estado "DIR=$RC" -- "$SONDA" </dev/null
for cual in mensaje asignada snoozed; do # las guardas de R4, de a una
  rr "$R/sonda-guarda-$cual.txt" FASE=guardas "DIR=$RC" "CUAL=$cual" -- "$SONDA" </dev/null
  cargar "rechazo-guarda-$cual" "preparado-guarda-$cual.ndjson"
done
rr "$R/sonda-concurrencia.txt" FASE=concurrencia "DIR=$RC" -- "$SONDA" </dev/null
# 4.10, al final: deja en contacts una restricción que solo toca los nombres SINT-LOG-<esta cuenta>.
rr "$R/sonda-log-postgres.txt" FASE=log-postgres "DIR=$RC" -- "$SONDA" </dev/null
mover rechazo-log
mover rechazo-sin-super
dc "${BASE[@]}" logs --no-color --no-log-prefix postgres >"$R.postgres.log" 2>&1
comprobar "$R"
F="$R/sin-modo.txt"
exigir N4 '[ "$(h "$F" carga)" = error ] && [ "$(h "$F" error)" = "falta MODO" ] && [ "$(h "$F" salida_proceso)" != 0 ] && [ ! -e "$R/vinculos-sin-modo.ndjson" ]' \
  "sin MODO, el script sale con error ($(h "$F" error), código $(h "$F" salida_proceso)) y no carga nada"
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
  # El log de Postgres hasta aquí: L1 y L2 miran solo la restricción y las marcas de la cuenta de este escenario.
  dc "${BASE[@]}" logs --no-color --no-log-prefix postgres >"$D/estado/m/$1.postgres.log" 2>&1
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
  # Diagnóstico de G13: si cae en este escenario, su detalle en una línea (conteos, esperas y los segundos por hilo).
  if [ "${RES[G13]:-}" = FALLÓ ]; then
    log "   G13 en $id: $(grep -E '^(HECHO concurrencia_|HILO[12] HECHO (error|hilo_))' "$D/estado/m/$id/concurrencia.txt" 2>/dev/null | sed 's/^HECHO concurrencia_//; s/^HILO\([12]\) HECHO /h\1:/' | tr '\n' ' ')"
  fi
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
  mutante M25 "acepta cualquier bandeja API sin webhook (B1)" "G10a G10b" "G1 S1"     "raise 'la bandeja no es «Conversaciones del portal»' unless" "nil unless true ||"
  mutante M26 "VINCULOS en cualquier ruta" "G11" "G1 S1"     "unless [RUTA_VINCULOS, '-'].include?(@ruta_vinculos)" "unless true"
  mutante M27 "sin el candado" "G12 G13" "G1 S1"     "raise 'otra carga del portal en curso' unless" "nil unless true ||"
  # M28 es neutro para G13: tiene que PASAR G13. Es el control de que G13 no cae siempre en los escenarios de
  # mutantes (revisión del Subdirector, run 42509944324), y lo que le da sentido a que G13 caiga en M27.
  mutante M28 "sin apagar el log de SQL" "F2" "C1 F1 G13"     "    ActiveRecord::Base.logger = nil" "    nil"
  log "MEDIDA M27 — sin el candado, dos cargas a la vez dejan $(h "$D/estado/m/M27/concurrencia.txt" concurrencia_conversaciones) conversaciones (con el candado, 4) y esperaron $(h "$D/estado/m/M27/concurrencia.txt" concurrencia_esperando_max)"
  mutante M29 "contact_inbox sin pubsub_token" "V12" "C1" \
    "          pubsub_token: SecureRandom.base58(24), created_at: ahora, updated_at: ahora }" \
    "          created_at: ahora, updated_at: ahora }"
  mutante M30 "vincula un mensaje que ya existe en otra conversación" "G14" "C1" \
    "    raise 'un mensaje ya existe en otra conversación' if otra" "    nil"
  mutante M32 "R4 sin mirar los mensajes ajenos" "G15" "C1 R4" \
    "if ajenos.positive? || asignadas.positive? || dormidas.positive?" "if asignadas.positive? || dormidas.positive?"
  mutante M33 "R4 sin mirar si está asignada" "G16" "C1 R4" \
    "if ajenos.positive? || asignadas.positive? || dormidas.positive?" "if ajenos.positive? || dormidas.positive?"
  mutante M34 "R4 sin mirar snoozed" "G17" "C1 R4" \
    "if ajenos.positive? || asignadas.positive? || dormidas.positive?" "if ajenos.positive? || asignadas.positive?"
  mutante M31 "no actualiza el estado de un hilo ya cargado" "R4" "C1 R2" \
    "      Conversation.where(id: ids).update_all(status: Conversation.statuses.fetch(estado)) unless seco?" "      nil"
  # 4.10. M35 es el que pidió el DG: sin los SET LOCAL, la marca sale en el log. M36 y M37, de a uno.
  mutante M35 "sin los SET LOCAL del log de Postgres" "L2 L3" "C1 L1" \
    "      bajar_detalle_del_log!
" ""
  mutante M36 "sin bajar log_min_error_statement (sale la sentencia)" "L2" "C1 L1 L3" \
    "'log_min_error_statement' => 'panic'" "'log_min_error_statement' => 'error'"
  mutante M37 "sin bajar log_error_verbosity (sale la fila)" "L2" "C1 L1 L3" \
    "'log_error_verbosity' => 'terse'" "'log_error_verbosity' => 'default'"
  mutante M38 "si no puede fijarlos, sigue" "L3" "C1 L1 L2" \
    "  rescue ActiveRecord::StatementInvalid
    raise 'no_se_puede_bajar_el_detalle_del_log'
" "  rescue ActiveRecord::StatementInvalid
    nil
"
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
