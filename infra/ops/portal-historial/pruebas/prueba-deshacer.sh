#!/usr/bin/env bash
# infra/ops/portal-historial/pruebas/prueba-deshacer.sh — la prueba de la vuelta atrás dirigida de la carga P4 en
# Chatwoot (deshacer.sh y deshacer-carga.rb, SDD-0586 10.7, PR 2c). Corre en GitHub Actions
# (portal-historial-cargador.yml); nunca en el VPS. Solo datos inventados: el Studio del fixture de la 0523 y un
# Chatwoot efímero con rails y sidekiq vivos, como la prueba punta a punta. La carga es la real (extraer.sh,
# cargar.sh y vincular.sh); después, deshacer.sh.
#
#   D1  algo ajeno en la bandeja (un mensaje sin source_id; un contact_inbox de la cola): el seco aborta, sin archivo
#   D6  el flag chatwoot_portal encendido, o encendido alguna vez (entity_audit_log): no corre, sin tocar Chatwoot
#   D2  seco: no borra nada y escribe contactos-conservados.ndjson (0600) con el contacto que tiene otra bandeja
#   D3  la lista cambió entre el seco y el borrado: aborta sin borrar
#   D4  borrar con CONFIRMAR=no: hace todo y termina en ROLLBACK; la bandeja queda igual
#   D5  borrar con CONFIRMAR=si: la bandeja queda vacía, el contacto conservado sigue, los demás contactos dtd-portal:
#       de la carga se borran, la otra bandeja no cambia y el contenedor queda limpio
#   F   ni nombres ni textos en las salidas
#   M   mutantes de deshacer-carga.rb y de deshacer.sh: cada uno tiene que tumbar lo suyo
#
# Uso:  bash infra/ops/portal-historial/pruebas/prueba-deshacer.sh [--conservar] [--sin-mutantes]
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
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-deshacer.XXXXXX")"
D="$TRABAJO/stack"
P="chatwoot-deshacer"
EDGE="chatwoot_edge_deshacer"
PG="studio-deshacer-$$"
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
limpio_desde_afuera() { docker exec "$CONT" sh -c 'test ! -e /dev/shm/portal-historial && test ! -e /tmp/deshacer-carga.rb'; }
MARCAS=('SINT pregunta' 'SINT respuesta' 'SINT en el margen' 'SINT archivado' 'Cliente A' 'Cliente B' '5550101' 'SINT otra bandeja' 'SINT ajeno')

log "== prueba de la vuelta atrás dirigida · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"

# ── P. Studio y Chatwoot efímeros, como la prueba punta a punta ──────────────
log "== P. los dos stacks"
docker run -d --name "$PG" -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -v "$RAIZ/supabase:/supabase:ro" postgres:17 >/dev/null \
  || { mal P0 "no arrancó el Postgres de Studio"; exit 1; }
for _ in $(seq 1 60); do docker exec "$PG" pg_isready -q -h 127.0.0.1 -U postgres && break; sleep 1; done
docker exec -i "$PG" psql -X -q -U postgres -d postgres -f - <"$AQUI/studio-fixture.sql" >"$TRABAJO/fixture.txt" 2>&1 \
  || { mal P0 "el fixture de Studio no se aplicó"; tail -n 30 "$TRABAJO/fixture.txt"; exit 1; }
# La auditoría del flag (entity_audit_log), que el fixture no trae: deshacer.sh la exige.
q "create table public.entity_audit_log (id bigserial primary key, tenant_id uuid, entity_type text, event_type text, after_data jsonb)" >/dev/null
TENANT="$(q "select md5('0523-sintetico-T1')::uuid")"
U1="$(q "select md5('0523-sintetico-U1')::uuid")"
mkdir -p "$D/cargador" "$D/estado/shm"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$AQUI/sonda-pap.rb" "$AQUI/sonda-deshacer.rb" "$D/cargador/"
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
q "insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values ('$TENANT', '$U1', $AGENTE)" >/dev/null

extraer() { DB="$PG" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" bash "$PH/extraer.sh" >"$1" 2>&1; }
cargar() { DB_CW="$CONT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$SERVICIO" MODO="$2" bash "$PH/cargar.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }
vincular() { DB="$PG" TENANT="$TENANT" bash "$PH/vincular.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }
# deshacer salida carpeta MODO [VAR=valor...]: deshacer.sh de esa carpeta (la real o la de un mutante).
deshacer() {
  local sal="$1" carpeta="$2" modo="$3"
  shift 3
  env DB_CW="$CONT" DB="$PG" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" MODO="$modo" "$@" bash "$carpeta/deshacer.sh" >"$sal" 2>&1
  echo "HECHO salida_proceso=$?" >>"$sal"
}
sonda() { local sal="$1"; shift; rr "$sal" "CUENTA=$CUENTA" "BANDEJA=$BANDEJA" "OTRA=$OTRA" "$@" -- /tmp/cargador/sonda-deshacer.rb </dev/null; }

# La carga real, con su vinculación.
extraer "$TRABAJO/extraer.txt"
cp "$SHM/preparado.ndjson" "$TRABAJO/preparado.ndjson"
cargar "$TRABAJO/carga.txt" cargar
vincular "$TRABAJO/vincular.txt"
exigir P1 '[ "$(h "$TRABAJO/carga.txt" carga)" = ok ] && [ "$(h "$TRABAJO/vincular.txt" salida_proceso)" = 0 ] && [ ! -e "$SHM" ]' \
  "la carga real: $(h "$TRABAJO/carga.txt" conversaciones_nuevas) conversaciones y $(h "$TRABAJO/carga.txt" contactos_nuevos) contactos, vinculados en Studio"
sonda "$TRABAJO/otra-bandeja.txt" FASE=otra-bandeja
CONSERVADO="$(h "$TRABAJO/otra-bandeja.txt" conservado)"
[ "$FALLAS" = 0 ] || { tail -n 20 "$TRABAJO"/*.txt; exit 1; }
# Para cada escenario (la corrida real y cada mutante), la carga entera de nuevo. La primera vez ya está.
recargar() {
  rm -rf -- "$SHM"
  install -d -m 0700 "$SHM"
  install -m 0600 "$TRABAJO/preparado.ndjson" "$SHM/preparado.ndjson"
  cargar "$TRABAJO/recarga.txt" cargar
  rm -rf -- "$SHM"
  sonda "$TRABAJO/otra-bandeja.txt" FASE=otra-bandeja
}

# ── El escenario: todos los pasos de deshacer, con una carpeta de guiones ────
escenario() { # carpeta salidas
  local K="$1" O="$2"
  mkdir -p "$O"
  sonda "$O/contar-antes.txt" FASE=contar
  # D1: algo ajeno, de a uno.
  sonda "$O/ajeno-m.txt" FASE=ajeno CUAL=mensaje
  deshacer "$O/d1a.txt" "$K" seco
  [ -e "$SHM/contactos-conservados.ndjson" ] && echo "HECHO archivo=si" >>"$O/d1a.txt"
  rm -rf -- "$SHM"
  sonda "$O/quitar-m.txt" FASE=quitar-ajeno
  sonda "$O/ajeno-ci.txt" FASE=ajeno CUAL=contact_inbox
  deshacer "$O/d1b.txt" "$K" seco
  rm -rf -- "$SHM"
  sonda "$O/quitar-ci.txt" FASE=quitar-ajeno
  # D6: el flag, encendido ahora y encendido alguna vez.
  q "insert into public.feature_flags (tenant_id, key, enabled) values ('$TENANT', 'chatwoot_portal', true)
     on conflict (tenant_id, key) do update set enabled = true" >/dev/null
  deshacer "$O/d6a.txt" "$K" seco
  rm -rf -- "$SHM" # un mutante que no mira el flag deja el archivo: que no tumbe D6b por otro camino
  q "update public.feature_flags set enabled = false where tenant_id = '$TENANT' and key = 'chatwoot_portal'" >/dev/null
  q "insert into public.entity_audit_log (tenant_id, entity_type, event_type, after_data)
     values ('$TENANT', 'feature_flag', 'feature_flag_changed', '{\"key\":\"chatwoot_portal\",\"enabled\":\"true\"}')" >/dev/null
  deshacer "$O/d6b.txt" "$K" seco
  q "delete from public.entity_audit_log where tenant_id = '$TENANT'" >/dev/null
  rm -rf -- "$SHM"
  # D2: el seco.
  deshacer "$O/d2.txt" "$K" seco
  [ -e "$SHM/contactos-conservados.ndjson" ] && cp "$SHM/contactos-conservados.ndjson" "$O/conservados.ndjson"
  stat -c 'HECHO permiso=%a' "$SHM/contactos-conservados.ndjson" >>"$O/d2.txt" 2>/dev/null
  limpio_desde_afuera && echo "HECHO limpio_desde_afuera=si" >>"$O/d2.txt"
  sonda "$O/contar-seco.txt" FASE=contar
  # D3: la lista cambió (sin el contacto conservado).
  printf '%s\n' "$(head -n 1 "$O/conservados.ndjson" | sed 's/"contactos":[0-9]*/"contactos":0/')" >"$SHM/contactos-conservados.ndjson"
  deshacer "$O/d3.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/contar-d3.txt" FASE=contar
  install -m 0600 "$O/conservados.ndjson" "$SHM/contactos-conservados.ndjson"
  # D4: el ensayo con rollback.
  deshacer "$O/d4.txt" "$K" borrar CONFIRMAR=no
  sonda "$O/contar-d4.txt" FASE=contar
  # D5: el borrado.
  deshacer "$O/d5.txt" "$K" borrar CONFIRMAR=si
  limpio_desde_afuera && echo "HECHO limpio_desde_afuera=si" >>"$O/d5.txt"
  sonda "$O/contar-d5.txt" FASE=contar
  rm -rf -- "$SHM"
}

comprobar() { # salidas
  local O="$1" A F fugas=0 f m
  A="$(h "$O/contar-antes.txt" bandeja)"
  F="$O/d1a.txt"
  exigir D1a '[ "$(h "$F" salida_proceso)" = 1 ] && grep -q "^HECHO error=algo ajeno en la bandeja" "$F" && [ "$(h "$F" ajeno_mensajes)" = 1 ] && [ -z "$(h "$F" archivo)" ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
    "un mensaje sin source_id en la bandeja: el seco aborta ($(h "$F" error)), sin archivo y con el contenedor limpio"
  F="$O/d1b.txt"
  exigir D1b '[ "$(h "$F" salida_proceso)" = 1 ] && grep -q "^HECHO error=algo ajeno en la bandeja" "$F" && [ "$(h "$F" ajeno_contact_inboxes)" = 1 ]' \
    "un contact_inbox de la cola en la bandeja: el seco aborta ($(h "$F" error))"
  exigir D6a '[ "$(h "$O/d6a.txt" salida_proceso)" = 1 ] && [ "$(h "$O/d6a.txt" error)" = chatwoot_portal_encendido ] && [ -z "$(h "$O/d6a.txt" contenedor_limpio)" ]' \
    "con chatwoot_portal encendido, no corre y no toca Chatwoot ($(h "$O/d6a.txt" error))"
  exigir D6b '[ "$(h "$O/d6b.txt" salida_proceso)" = 1 ] && [ "$(h "$O/d6b.txt" error)" = chatwoot_portal_se_encendio_alguna_vez ]' \
    "con chatwoot_portal encendido alguna vez (entity_audit_log), no corre ($(h "$O/d6b.txt" error))"
  F="$O/d2.txt"
  exigir D2 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" deshacer)" = ok ] && [ "$(h "$F" contactos_conservados)" = 1 ] && [ "$(h "$F" permiso)" = 600 ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$O/contar-seco.txt" bandeja)" = "$A" ] && grep -q "\"contacto_id\":$CONSERVADO}" "$O/conservados.ndjson" && grep -q "\"tenant_id\":\"$TENANT\"" "$O/conservados.ndjson" && [ "$(wc -l <"$O/conservados.ndjson")" = 2 ]' \
    "seco: no borra nada ($(h "$O/contar-seco.txt" bandeja)) y escribe en 0600 el contacto conservado ($CONSERVADO): $(h "$F" contactos_de_la_bandeja) de la bandeja, $(h "$F" contactos_conservados) conservado, $(h "$F" contactos_a_borrar) a borrar"
  exigir D3 '[ "$(h "$O/d3.txt" salida_proceso)" = 1 ] && [ "$(h "$O/d3.txt" error)" = "la lista de conservados cambió desde el seco" ] && [ "$(h "$O/contar-d3.txt" bandeja)" = "$A" ]' \
    "la lista cambió entre el seco y el borrado: aborta sin borrar ($(h "$O/d3.txt" error))"
  F="$O/d4.txt"
  exigir D4 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = no ] && [ "$(h "$F" despues)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d4.txt" bandeja)" = "$A" ] && [ "$(h "$O/contar-d4.txt" contactos_dtd)" = "$(h "$O/contar-antes.txt" contactos_dtd)" ]' \
    "CONFIRMAR=no: dentro de la transacción la bandeja queda en 0, y después del ROLLBACK, igual que antes ($(h "$O/contar-d4.txt" bandeja))"
  F="$O/d5.txt"
  exigir D5 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = si ] && [ "$(h "$O/contar-d5.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d5.txt" contactos_dtd)" = 1 ] && [ "$(h "$O/contar-d5.txt" otra)" = "$(h "$O/contar-antes.txt" otra)" ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
    "CONFIRMAR=si: la bandeja vacía, queda solo el contacto conservado ($(h "$O/contar-d5.txt" contactos_dtd)), la otra bandeja igual ($(h "$O/contar-d5.txt" otra)) y el contenedor limpio"
  for f in "$O"/d*.txt "$O/conservados.ndjson"; do
    for m in "${MARCAS[@]}"; do grep -q -F -- "$m" "$f" 2>/dev/null && { fugas=$((fugas + 1)); [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $(basename "$f")"; }; done
  done
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/d2.txt" ]' "cero de ${#MARCAS[@]} valores inventados en las salidas de deshacer.sh y en los conservados"
  return 0
}

log "== D. la vuelta atrás, sobre la carga real"
escenario "$PH" "$TRABAJO/real"
comprobar "$TRABAJO/real"

# ── M. Mutantes ──────────────────────────────────────────────────────────────
mutar() { # archivo buscar reemplazo
  python3 -I -c 'import sys
a, b, r = sys.argv[1:4]
t = open(a, encoding="utf-8").read()
n = t.count(b)
if n != 1:
    print(f"el texto a mutar aparece {n} veces"); sys.exit(1)
open(a, "w", encoding="utf-8", newline="\n").write(t.replace(b, r))' "$1" "$2" "$3"
}
cayeron_en() { local k; for k in "${!RES[@]}"; do [ "${RES[$k]}" = FALLÓ ] && echo "$k"; done | sort | tr '\n' ' '; }
mutante() { # id qué archivo caen pasan buscar reemplazo
  local id="$1" que="$2" arch="$3" caen="$4" pasan="$5" K="$TRABAJO/m/$1" faltan="" otro="" c
  rm -rf -- "$K"; mkdir -p "$K"; cp -r "$PH/." "$K/"
  if ! mutar "$K/$arch" "$6" "$7" >"$K.mutar.txt" 2>&1; then mal "$id" "$que: no se pudo aplicar ($(cat "$K.mutar.txt"))"; return 0; fi
  recargar
  RES=(); MODO_LOG=0
  escenario "$K" "$TRABAJO/$id"
  comprobar "$TRABAJO/$id"
  MODO_LOG=1
  for c in $caen; do [ "${RES[$c]:-FALLÓ}" = FALLÓ ] || faltan="$faltan $c"; done
  for c in $pasan; do [ "${RES[$c]:-FALLÓ}" = PASÓ ] || otro="$otro $c"; done
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que: tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: $(cayeron_en)"
}
if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes"
  mutante MD0 "control: los guiones sin cambios, sobre una carga nueva" deshacer-carga.rb "" "D1a D1b D2 D3 D4 D5 D6a D6b F1" \
    "require 'set'" "require 'set'"
  mutante MD1 "no mira los mensajes ajenos" deshacer-carga.rb "D1a" "D1b D2 D5" \
    "'mensajes' => mensajes.where(\"source_id IS NULL OR source_id NOT LIKE 'dtd:%'\").count," "'mensajes' => 0,"
  mutante MD2 "no mira los contact_inboxes ajenos" deshacer-carga.rb "D1b" "D1a D2 D5" \
    "'contact_inboxes' => contact_inboxes.where(\"source_id NOT LIKE 'dtd-portal:%'\").count," "'contact_inboxes' => 0,"
  mutante MD3 "borra el contacto que tiene otra bandeja" deshacer-carga.rb "D2 D5" "D1a D4" \
    "conservados = todos.select { |_, id| con_otra.include?(id) }.sort" "conservados = []"
  mutante MD4 "borra mensajes fuera de la bandeja" deshacer-carga.rb "D5" "D2 D4" \
    "hecho('borrados_mensajes', mensajes.delete_all)" "hecho('borrados_mensajes', Message.where(account_id: @cuenta_id).delete_all)"
  mutante MD5 "el seco confirma lo que borra" deshacer-carga.rb "D2" "D1a" \
    "        escribir_conservados(conservados)
        raise ActiveRecord::Rollback" "        escribir_conservados(conservados)
        mensajes.delete_all"
  mutante MD6 "no compara la lista de conservados" deshacer-carga.rb "D3" "D2" \
    "raise 'la lista de conservados cambió desde el seco' unless leer_conservados == conservados" "leer_conservados"
  mutante MD7 "CONFIRMAR=no confirma" deshacer-carga.rb "D4" "D2 D3" \
    "raise ActiveRecord::Rollback unless @confirmar == 'si'" "nil"
  mutante MD8 "no mira el flag encendido" deshacer.sh "D6a" "D6b D2" \
    "  encendido) mal chatwoot_portal_encendido 1 ;;" "  encendido) ;;"
  mutante MD9 "no mira si el flag se encendió alguna vez" deshacer.sh "D6b" "D6a D2" \
    "  alguna_vez) mal chatwoot_portal_se_encendio_alguna_vez 1 ;;" "  alguna_vez) ;;"
else
  log "== M. mutantes NO EJECUTADOS (--sin-mutantes)"
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  # Solo datos inventados: las salidas ayudan a leer el rojo desde el log del CI.
  for f in "$TRABAJO"/real/*.txt; do echo "--- $(basename "$f")"; grep '^HECHO ' "$f" | tail -n 25; done
fi
log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
