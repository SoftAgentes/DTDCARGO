#!/usr/bin/env bash
# infra/ops/portal-historial/pruebas/prueba-punta-a-punta.sh — la prueba que une los dos lados de la P4 (SDD-0586
# 10.7, §10.5.10): extraer.sh y vincular.sh de E10 contra un Postgres de Studio desechable, y cargar.sh con el
# cargador de E5 contra un Chatwoot desechable. Corre en GitHub Actions (portal-historial-cargador.yml); nunca en el
# VPS. Solo datos inventados: la base de Studio es el fixture sintético del contrato de la 0523 (studio-fixture.sql).
#
#   P    los dos stacks: Studio (Postgres 17 con las migraciones reales) y Chatwoot (rails y sidekiq vivos)
#   S    cargar.sh en seco: cuenta lo que cargará, no deja vínculos, el contenedor queda limpio
#   A    (a) vincular con un mensaje menos: 22023 y Studio no cambia
#   C    (c) después de (a), repetir todo desde la extracción, con un mensaje nuevo en el hilo (d): entra lo nuevo,
#        no se duplica nada, la vinculación entra y queda un solo corte
#   K    controles-studio.sql antes y después: C-6 y C-7 iguales; C-8 con los hilos vinculados y lo cargado
#   E    (e) un mensaje por la API de Chatwoot a una conversación cargada: 0 reintentos y 0 muertos en Sidekiq
#   F    (f) cargar.sh con fallos inyectados: el contenedor queda limpio y en el VPS no quedan vínculos
#   B    (b) el contacto_id nulo: PENDIENTE, espera la 0524 (no se da por cubierto)
#   M    mutantes de cargar.sh: cada uno tiene que tumbar su comprobación
#
# Uso:  bash infra/ops/portal-historial/pruebas/prueba-punta-a-punta.sh [--conservar] [--sin-mutantes]
# Escribe en /dev/shm/portal-historial (la carpeta fija de extraer.sh y vincular.sh): se niega si ya existe.
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
RAIZ="$(cd "$PH/../../.." && pwd)"
CW="$RAIZ/infra/chatwoot"
SHM=/dev/shm/portal-historial
[ -e "$SHM" ] && { echo "se niega: ya existe $SHM (¿una carga real a medias?)"; exit 2; }
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-pap.XXXXXX")"
D="$TRABAJO/stack"
P="chatwoot-pap"
EDGE="chatwoot_edge_pap"
PG="studio-pap-$$"
CONT="$P-rails-1"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"
declare -A RES=()
MODO_LOG=1

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
BASE=(-f compose.yml -f compose.override.yml -f compose.cargador.yml)
limpiar() {
  rm -rf -- "$SHM"
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stacks arriba en $D y $PG)"; return; }
  [ -f "$D/compose.yml" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  docker rm -f "$PG" >/dev/null 2>&1
  return 0
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
q() { docker exec -i "$PG" psql -X -q -At -U postgres -d postgres -c "$1"; }
rr() { # salida VAR=valor... -- script
  local salida="$1" envs=()
  shift
  while [ "$1" != "--" ]; do envs+=(-e "$1"); shift; done
  shift
  dc "${BASE[@]}" run --rm -T "${envs[@]}" prepare bundle exec rails runner "$@" >"$salida" 2>&1
}
limpio_desde_afuera() { docker exec "$CONT" sh -c 'test ! -e /dev/shm/portal-historial && test ! -e /tmp/cargar-portal.rb'; }
sin_vinculos_en_el_vps() { [ ! -e "$SHM/vinculos.ndjson" ] && [ ! -e "$SHM/vinculos.ndjson.parcial" ]; }
MARCAS=('SINT pregunta' 'SINT respuesta' 'SINT en el margen' 'SINT archivado' 'Cliente A' 'Cliente B' '5550101' 'SINT nuevo')

log "== prueba punta a punta de la P4 · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"

# ── P. Studio: Postgres 17 desechable con el fixture sintético de la 0523 ─────
log "== P. los dos stacks"
docker run -d --name "$PG" -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -v "$RAIZ/supabase:/supabase:ro" postgres:17 >/dev/null \
  || { mal P0 "no arrancó el Postgres de Studio"; exit 1; }
for _ in $(seq 1 60); do docker exec "$PG" pg_isready -q -h 127.0.0.1 -U postgres && break; sleep 1; done
docker exec -i "$PG" psql -X -q -U postgres -d postgres -f - <"$AQUI/studio-fixture.sql" >"$TRABAJO/fixture.txt" 2>&1 \
  || { mal P0 "el fixture de Studio no se aplicó (ver $TRABAJO/fixture.txt)"; tail -n 30 "$TRABAJO/fixture.txt"; exit 1; }
TENANT="$(q "select md5('0523-sintetico-T1')::uuid")"
U1="$(q "select md5('0523-sintetico-U1')::uuid")"
HA="$(q "select md5('0523-sintetico-hA')::uuid")"

# ── P. Chatwoot: el compose de infra/chatwoot con rails y sidekiq vivos ───────
mkdir -p "$D/cargador" "$D/estado/shm"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$AQUI/sonda-pap.rb" "$D/cargador/"
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
dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1 || { mal P0 "Postgres/Redis de Chatwoot no arrancaron"; tail -n 30 "$TRABAJO/up.txt"; exit 1; }
dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null || { mal P0 "db:chatwoot_prepare falló"; tail -n 40 "$TRABAJO/prepare.txt"; exit 1; }
dc "${BASE[@]}" up -d --wait rails sidekiq >"$TRABAJO/up2.txt" 2>&1 || { mal P0 "rails o sidekiq no arrancaron"; tail -n 30 "$TRABAJO/up2.txt"; exit 1; }
rr "$TRABAJO/preparar.txt" FASE=preparar -- /tmp/cargador/sonda-pap.rb </dev/null
CUENTA="$(h "$TRABAJO/preparar.txt" cuenta)"
BANDEJA="$(h "$TRABAJO/preparar.txt" portal)"
SERVICIO="$(h "$TRABAJO/preparar.txt" servicio)"
AGENTE="$(h "$TRABAJO/preparar.txt" agente)"
OTRA="$(h "$TRABAJO/preparar.txt" otra)"
exigir P1 '[ "$(h "$TRABAJO/preparar.txt" preparar)" = ok ] && [ -n "$TENANT" ] && docker inspect "$CONT" >/dev/null 2>&1' \
  "Studio con el fixture de la 0523 (tenant ${TENANT:0:8}…) y Chatwoot con la bandeja del portal $BANDEJA (cuenta $CUENTA)"
q "insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values ('$TENANT', '$U1', $AGENTE)" >/dev/null

CTL() { docker exec -i "$PG" psql -X -q -At -U postgres -d postgres -v tenant="$TENANT" -f - <"$PH/controles-studio.sql" >"$1" 2>&1; }
ctl() { sed -n "s/^$2 //p" "$1" | head -n 1; } # archivo prefijo («C-6 conversation_messages»)
CTL "$TRABAJO/controles-antes.txt"
c8() { sed -n "s/^C-8 $2=\([^ ]*\).*/\1/p; s/^C-8 .* $2=\([^ ]*\).*/\1/p" "$1" | head -n 1; }
corte() { q "select count(*) || ':' || count(corte) from public.chatwoot_portal_estado where tenant_id = '$TENANT'"; }

extraer() { DB="$PG" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" bash "$PH/extraer.sh" >"$1" 2>&1; }
cargar() { # salida modo [VAR=valor...]
  local sal="$1" modo="$2"
  shift 2
  env DB_CW="$CONT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$SERVICIO" MODO="$modo" "$@" bash "${CARGAR_SH:-$PH/cargar.sh}" >"$sal" 2>&1
  echo "HECHO salida_proceso=$?" >>"$sal"
}
vincular() { DB="$PG" TENANT="$TENANT" bash "$PH/vincular.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }

# ── S. extraer y cargar en seco ──────────────────────────────────────────────
log "== S. extraer y cargar en seco"
extraer "$TRABAJO/extraer-1.txt"
exigir X1 '[ -s "$SHM/preparado.ndjson" ] && [ "$(stat -c %a "$SHM/preparado.ndjson")" = 600 ] && [ "$(h "$TRABAJO/extraer-1.txt" reservados)" = 2 ]' \
  "extraer.sh deja el preparado en 0600 y reserva 2 fichas (A y B; C ya tenía, D está borrada): $(h "$TRABAJO/extraer-1.txt" reservados)"
cp "$SHM/preparado.ndjson" "$TRABAJO/preparado-1.ndjson" # para los fallos inyectados (F), sin volver a extraer
cargar "$TRABAJO/seco.txt" seco
F="$TRABAJO/seco.txt"
exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" leidas)" = "contactos:2,conversaciones:3,mensajes:6" ] && [ "$(h "$F" salida_proceso)" = 0 ]' \
  "seco: lee 2 contactos, 3 conversaciones (hA, hP y hX archivado) y 6 mensajes ($(h "$F" leidas))"
exigir S2 'sin_vinculos_en_el_vps && [ "$(h "$F" contenedor_limpio)" = si ] && limpio_desde_afuera' \
  "seco: sin vínculos en el VPS y el contenedor limpio, según cargar.sh y mirado desde afuera"

# ── A. cargar y vincular con un mensaje menos ────────────────────────────────
log "== A. vincular con un mensaje menos"
cargar "$TRABAJO/carga-1.txt" cargar
F="$TRABAJO/carga-1.txt"
exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = 3 ] && [ "$(h "$F" mensajes_nuevos)" = 6 ] && [ "$(h "$F" notas_nuevas)" = 1 ] && [ "$(h "$F" contactos_nuevos)" = 2 ] && [ "$(h "$F" salida_proceso)" = 0 ]' \
  "carga: 3 conversaciones, 6 mensajes, 1 nota de archivo y 2 contactos"
exigir C2 '[ -s "$SHM/vinculos.ndjson" ] && [ "$(stat -c %a "$SHM/vinculos.ndjson")" = 600 ] && [ ! -e "$SHM/vinculos.ndjson.parcial" ] && [ "$(h "$F" contenedor_limpio)" = si ] && limpio_desde_afuera' \
  "los vínculos quedan en $SHM/vinculos.ndjson con 0600 y el contenedor, limpio"
cp "$SHM/vinculos.ndjson" "$TRABAJO/vinculos-1.ndjson"
# (a): sin la última línea de mensaje.
awk 'BEGIN{n=0} {l[NR]=$0} /"tipo":"mensaje"/{u=NR} END{for(i=1;i<=NR;i++) if(i!=u) print l[i]}' "$TRABAJO/vinculos-1.ndjson" >"$SHM/vinculos.ndjson"
CTL "$TRABAJO/controles-a-antes.txt"
corte_antes="$(corte)"
vincular "$TRABAJO/vincular-a.txt"
CTL "$TRABAJO/controles-a-despues.txt"
exigir A1 '[ "$(h "$TRABAJO/vincular-a.txt" salida_proceso)" != 0 ] && grep -q "no son los del preparado" "$TRABAJO/vincular-a.txt" && cmp -s "$TRABAJO/controles-a-antes.txt" "$TRABAJO/controles-a-despues.txt" && [ "$(corte)" = "$corte_antes" ]' \
  "(a) vincular con un mensaje menos se niega («no son los del preparado») y Studio no cambia: controles y corte iguales ($(corte))"

# ── C. repetir desde la extracción, con un mensaje nuevo (d) ─────────────────
log "== C. repetir desde la extracción, con un mensaje nuevo en hA"
bash "$PH/limpiar.sh" >/dev/null
q "insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, body, sent_at)
   values (md5('pap-nuevo')::uuid, '$TENANT', '$HA', 'in', 'Cliente A', 'SINT nuevo después de la primera carga', now() - interval '10 minutes')" >/dev/null
extraer "$TRABAJO/extraer-2.txt"
exigir X2 '[ "$(h "$TRABAJO/extraer-2.txt" reservados)" = 0 ]' "repetir la reserva no reserva otra vez ($(h "$TRABAJO/extraer-2.txt" reservados)): el identificador es el mismo"
cargar "$TRABAJO/carga-2.txt" cargar
F="$TRABAJO/carga-2.txt"
exigir C3 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" mensajes_nuevos)" = 1 ] && [ "$(h "$F" mensajes_existentes)" = 6 ] && [ -z "$(h "$F" conversaciones_nuevas)" ] && [ -z "$(h "$F" contactos_nuevos)" ] && [ "$(h "$F" contactos_reusados)" = 2 ] && [ "$(h "$F" conversaciones_existentes)" = 3 ]' \
  "(c) y (d) repetir: entra solo el mensaje nuevo; contactos y conversaciones se reusan (reusados $(h "$F" contactos_reusados), existentes $(h "$F" conversaciones_existentes))"
vincular "$TRABAJO/vincular-c.txt"
exigir C4 '[ "$(h "$TRABAJO/vincular-c.txt" salida_proceso)" = 0 ] && grep -q "^HECHO contactos=2 hilos=3 mensajes=7" "$TRABAJO/vincular-c.txt" && [ ! -e "$SHM" ]' \
  "vincular entra (2 contactos, 3 hilos y 7 mensajes) y borra $SHM"
rr "$TRABAJO/contar.txt" FASE=contar "CUENTA=$CUENTA" "BANDEJA=$BANDEJA" -- /tmp/cargador/sonda-pap.rb </dev/null
F="$TRABAJO/contar.txt"
exigir C5 '[ "$(h "$F" contactos)" = 2 ] && [ "$(h "$F" conversaciones)" = 3 ] && [ "$(h "$F" mensajes)" = 7 ] && [ "$(h "$F" notas)" = 1 ] && [ "$(h "$F" conversaciones_dobles)" = 0 ] && [ "$(h "$F" mensajes_dobles)" = 0 ] && [ "$(h "$F" contactos_con_datos)" = 0 ] && [ "$(h "$F" pubsub_nulos)" = 0 ]' \
  "Chatwoot: 2 contactos sin teléfono ni correo, 3 conversaciones, 7 mensajes y 1 nota, sin dobles y sin pubsub_token nulo"
exigir C6 '[ "$(corte)" = 1:1 ]' "un solo corte en Studio ($(corte))"

# ── K. controles de Studio antes y después ───────────────────────────────────
CTL "$TRABAJO/controles-despues.txt"
A="$TRABAJO/controles-antes.txt"
Z="$TRABAJO/controles-despues.txt"
exigir K1 '[ -n "$(ctl "$A" "C-6 conversations")" ] && [ "$(ctl "$A" "C-6 conversations")" = "$(ctl "$Z" "C-6 conversations")" ]' \
  "C-6: conversations igual antes y después"
# conversation_messages tiene una fila más: la que agregó la prueba (d). Lo demás del portal no cambia.
exigir K2 '[ "$(ctl "$A" "C-7 crm_tarjetas")" = "$(ctl "$Z" "C-7 crm_tarjetas")" ] && [ "$(ctl "$A" "C-7 crm_tareas")" = "$(ctl "$Z" "C-7 crm_tareas")" ] && [ "$(ctl "$A" "C-7 crm_historial_etapas")" = "$(ctl "$Z" "C-7 crm_historial_etapas")" ] && [ "$(ctl "$A" "C-7 chatwoot_webhook_events")" = "$(ctl "$Z" "C-7 chatwoot_webhook_events")" ]' \
  "C-7: el CRM igual antes y después"
exigir K3 '[ "$(c8 "$Z" hilos_vinculados)" = 4 ] && [ "$(c8 "$Z" con_espejo)" = 4 ] && [ "$(c8 "$Z" client_id_distinto)" = 0 ] && [ "$(c8 "$Z" salida_cargado)" = 7 ] && [ "$(c8 "$Z" salida_enviado)" = 1 ]' \
  "C-8: 4 hilos vinculados (hC de la cola y los 3 cargados) con su espejo, 7 mensajes cargado y 1 enviado ($(grep '^C-8' "$Z" | tr '\n' ' '))"

# ── E. un mensaje por la API a una conversación cargada ──────────────────────
log "== E. un mensaje por la API"
rr "$TRABAJO/api.txt" FASE=api "CUENTA=$CUENTA" "BANDEJA=$BANDEJA" "HILO=$HA" "AGENTE=$AGENTE" -- /tmp/cargador/sonda-pap.rb </dev/null
F="$TRABAJO/api.txt"
exigir E1 '[ "$(h "$F" api)" = ok ] && [ "$(h "$F" api_codigo)" = 200 ] && [ "$(h "$F" mensaje_api)" = 1 ] && [ "$(h "$F" colas_vacias)" = si ] && [ "$(h "$F" reintentos_nuevos)" = 0 ] && [ "$(h "$F" muertos_nuevos)" = 0 ]' \
  "(e) un mensaje del agente por la API a una conversación cargada: $(h "$F" api_codigo), Sidekiq vacía las colas con $(h "$F" reintentos_nuevos) reintentos y $(h "$F" muertos_nuevos) muertos; programó $(h "$F" programados_nuevos)"
log "MEDIDA E1 — lo que Chatwoot programó por el mensaje de la API, por clase: $(h "$F" programados_nuevos)"

# ── F. cargar.sh con fallos inyectados ───────────────────────────────────────
log "== F. fallos inyectados"
f_corrida() { # script → $TRABAJO/f*.txt. Sobre el preparado de la primera extracción: el cargador ya lo cargó, así
  # que cada corrida reconoce todo y no agrega filas.
  local s="$1"
  rm -rf -- "$SHM"
  install -d -m 0700 "$SHM"
  install -m 0600 "$TRABAJO/preparado-1.ndjson" "$SHM/preparado.ndjson"
  # F1: el cargador da carga=error (otra bandeja API de la cuenta, que no es la del portal).
  CARGAR_SH="$s" cargar "$TRABAJO/f1.txt" cargar "BANDEJA=$OTRA"
  F1_LIMPIO=no; limpio_desde_afuera && F1_LIMPIO=si
  F1_VPS=no; sin_vinculos_en_el_vps && F1_VPS=si
  # F2: el traslado falla: la carpeta del VPS no se puede escribir, así que docker cp no puede traer los vínculos.
  chmod 0500 "$SHM"
  CARGAR_SH="$s" cargar "$TRABAJO/f2.txt" cargar
  chmod 0700 "$SHM"
  F2_LIMPIO=no; limpio_desde_afuera && F2_LIMPIO=si
  F2_VPS=no; sin_vinculos_en_el_vps && F2_VPS=si
  # F3: una corrida buena, para el permiso de los vínculos.
  CARGAR_SH="$s" cargar "$TRABAJO/f3.txt" cargar
  F3_PERM="$(stat -c %a "$SHM/vinculos.ndjson" 2>/dev/null || echo ausente)"
  F3_LIMPIO=no; limpio_desde_afuera && F3_LIMPIO=si
  rm -rf -- "$SHM"
}
f_comprobar() {
  exigir F1 '[ "$(h "$TRABAJO/f1.txt" carga)" = error ] && [ "$(h "$TRABAJO/f1.txt" salida_proceso)" = 1 ] && [ "$F1_LIMPIO" = si ] && [ "$F1_VPS" = si ] && [ "$(h "$TRABAJO/f1.txt" contenedor_limpio)" = si ]' \
    "el cargador da error: cargar.sh sale con 1, sin vínculos en el VPS y con el contenedor limpio"
  exigir F2 '[ "$(h "$TRABAJO/f2.txt" salida_proceso)" != 0 ] && [ "$F2_LIMPIO" = si ] && [ "$F2_VPS" = si ]' \
    "el traslado falla (carpeta del VPS sin escritura): cargar.sh no sale con 0, el contenedor queda limpio y no queda ningún vínculo"
  exigir F3 '[ "$(h "$TRABAJO/f3.txt" salida_proceso)" = 0 ] && [ "$F3_PERM" = 600 ] && [ "$F3_LIMPIO" = si ]' \
    "una corrida buena deja los vínculos en 0600 ($F3_PERM) y el contenedor limpio"
}
f_corrida "$PH/cargar.sh"
f_comprobar

# ── B. el contacto_id nulo: espera la 0524 ───────────────────────────────────
log "PENDIENTE B — (b) un contacto con contacto_id nulo tiene que dar 22023: espera la 0524 (E10), que todavía no está en main. NO CUBIERTO"

# ── F (datos personales): ni nombres ni textos en las salidas de cargar.sh ───
fugas=0
for f in "$TRABAJO"/seco.txt "$TRABAJO"/carga-1.txt "$TRABAJO"/carga-2.txt "$TRABAJO"/f1.txt "$TRABAJO"/f3.txt "$TRABAJO/vinculos-1.ndjson"; do
  for m in "${MARCAS[@]}"; do grep -q -F -- "$m" "$f" 2>/dev/null && { fugas=$((fugas + 1)); log "   fuga: $m en $(basename "$f")"; }; done
done
exigir D1 '[ "$fugas" = 0 ] && [ -s "$TRABAJO/carga-1.txt" ]' "cero de ${#MARCAS[@]} valores inventados en las salidas de cargar.sh y en los vínculos"

# ── M. mutantes de cargar.sh ─────────────────────────────────────────────────
mutar() {
  python3 -I -c 'import sys
o, d, b, r = sys.argv[1:5]
t = open(o, encoding="utf-8").read()
n = t.count(b)
if n != 1:
    print(f"el texto a mutar aparece {n} veces"); sys.exit(1)
open(d, "w", encoding="utf-8", newline="\n").write(t.replace(b, r))' "$@"
}
mutante() { # id qué caen buscar reemplazo
  local id="$1" que="$2" caen="$3" faltan="" c
  if ! mutar "$PH/cargar.sh" "$TRABAJO/$id.sh" "$4" "$5" >"$TRABAJO/$id.mutar.txt" 2>&1; then
    mal "$id" "$que: no se pudo aplicar ($(cat "$TRABAJO/$id.mutar.txt"))"; return 0
  fi
  # La copia mutada tiene que encontrar el cargador y los guiones de E10 en su carpeta.
  cp "$TRABAJO/$id.sh" "$PH/.mutante-$id.sh"
  RES=()
  MODO_LOG=0
  f_corrida "$PH/.mutante-$id.sh"
  f_comprobar
  MODO_LOG=1
  rm -f "$PH/.mutante-$id.sh"
  for c in $caen; do [ "${RES[$c]:-FALLÓ}" = FALLÓ ] || faltan="$faltan $c"; done
  exigir "$id" '[ -z "$faltan" ]' "$que: tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}"
}
if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes de cargar.sh"
  mutante MC1 "sin el trap" "F1 F2" 'trap limpiar_contenedor EXIT' ': trap limpiar_contenedor EXIT'
  mutante MC2 "no borra /tmp/cargar-portal.rb del contenedor" "F1 F2 F3" \
    'docker exec "$DB_CW" rm -rf -- "$EN_CW_DIR" "$EN_CW_RB"' 'docker exec "$DB_CW" rm -rf -- "$EN_CW_DIR"'
  # Quitar el chmod sería un mutante equivalente: el umask 077 del guion (y el del traslado) ya crea los vínculos con
  # 0600, y el chmod es defensa en profundidad (run 42509666073: «sin chmod» sobrevivió). El mutante pone un permiso
  # MALO, 0644, para probar que F3 mira el permiso de verdad.
  mutante MC3 "los vínculos con 0644" "F3" 'cerrar() { chmod 0600 "$@"; }' 'cerrar() { chmod 0644 "$@"; }'
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  for f in "$TRABAJO"/*.txt; do echo "--- $(basename "$f")"; grep -E '^(HECHO|C-[0-9]|ERROR|psql)' "$f" | tail -n 25; done
fi
log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
