#!/usr/bin/env bash
# infra/ops/portal-historial/pruebas/prueba-deshacer.sh — la prueba de la vuelta atrás dirigida de la carga P4 en
# Chatwoot (deshacer.sh y deshacer-carga.rb, SDD-0586 10.7, PR 2c). Corre en GitHub Actions
# (portal-historial-cargador.yml); nunca en el VPS. Solo datos inventados: el Studio del fixture de la 0523 y un
# Chatwoot efímero con rails y sidekiq vivos, como la prueba punta a punta. La carga es la real (extraer.sh,
# cargar.sh y vincular.sh); después, deshacer.sh.
#
#   D1a-g  algo ajeno en la bandeja, de a uno: un mensaje sin source_id, un contact_inbox de la cola, una conversación
#          sin dtd_hilo, una asignada, una en snoozed, un contacto con teléfono, una nota: el seco aborta, sin archivo
#   D6a-h  las guardas de deshacer.sh, en Studio y en solo lectura: el flag encendido, encendido alguna vez, sin la
#          fila del flag del tenant, la cola corrió, un tenant sin hilos, el espejo en otra bandeja, sin DB, un DB que
#          no es Studio · D8 BANDEJA de otra bandeja · D10 un número con un cero adelante
#   D2  seco: no borra nada y escribe contactos-conservados.ndjson (0600) con el contacto que tiene otra bandeja
#   D9  los conservados de otro tenant · D3 la lista cambió entre el seco y el borrado: abortan sin borrar
#   D4  borrar con CONFIRMAR=no: hace todo y termina en ROLLBACK; la bandeja queda igual
#   D5  borrar con CONFIRMAR=si: la bandeja queda vacía, el conservado sigue, los demás contactos dtd-portal: de la
#       carga se borran, la otra bandeja no cambia, el contenedor queda limpio y el archivo sigue (para Studio)
#   D7  (revisar-datos-ve, paso 3) las marcas de lo borrado no están en ninguna tabla de Chatwoot; lo conservado sí
#   F   ni nombres ni textos en las salidas, con su control
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
# La fila del flag que la 0519 siembra para cada tenant, apagada; y el espejo de hC (vinculado por la cola) en la bandeja
# del portal, como lo crea chatwoot_portal_vincular (0519). deshacer.sh exige las dos cosas (revisión del DG, B1).
T2="$(q "select md5('0523-sintetico-T2')::uuid")"
q "insert into public.feature_flags (tenant_id, key, enabled) values ('$TENANT', 'chatwoot_portal', false), ('$T2', 'chatwoot_portal', false)
   on conflict (tenant_id, key) do update set enabled = false" >/dev/null
q "insert into public.chatwoot_conversations as cc (tenant_id, conversation_id, inbox_id, status, client_id)
   values ('$TENANT', 1100, $BANDEJA, 'open', md5('0523-sintetico-C')::uuid)
   on conflict (tenant_id, conversation_id) do update set inbox_id = excluded.inbox_id" >/dev/null
# El fixture del contrato de la 0523 trae una salida «enviado» de hC (la cola corrió para él). En producción, antes de
# la puerta 4, la cola nunca corrió (runbook, 4.3): aquí pasa a «cargado», que es lo que la guarda de la cola acepta.
q "update public.chatwoot_portal_salida set estado = 'cargado' where tenant_id = '$TENANT' and estado <> 'cargado'" >/dev/null

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
[ "$FALLAS" = 0 ] || { tail -n 20 "$TRABAJO"/*.txt; exit 1; }
# Para cada escenario completo (la corrida real y cada mutante), la carga entera de nuevo. La primera vez ya está.
recargar() {
  rm -rf -- "$SHM"
  install -d -m 0700 "$SHM"
  install -m 0600 "$TRABAJO/preparado.ndjson" "$SHM/preparado.ndjson"
  cargar "$TRABAJO/recarga.txt" cargar
  rm -rf -- "$SHM"
  sonda "$TRABAJO/otra-bandeja.txt" FASE=otra-bandeja
}

# ── El escenario, por partes: sh (las guardas de deshacer.sh, sin Rails), ajeno (lo ajeno en la bandeja) y completo
# (sh, ajeno y después el seco, los dos borrados y la búsqueda de marcas). Cada parte deja la base como la encontró.
parte_sh() { # carpeta salidas
  local K="$1" O="$2"
  # D6a y D6b: el flag encendido ahora, y encendido alguna vez.
  q "update public.feature_flags set enabled = true where tenant_id = '$TENANT' and key = 'chatwoot_portal'" >/dev/null
  deshacer "$O/d6a.txt" "$K" seco
  rm -rf -- "$SHM" # un mutante que no mira el flag deja el archivo: que no tumbe lo siguiente por otro camino
  q "update public.feature_flags set enabled = false where tenant_id = '$TENANT' and key = 'chatwoot_portal'" >/dev/null
  q "insert into public.entity_audit_log (tenant_id, entity_type, event_type, after_data)
     values ('$TENANT', 'feature_flag', 'feature_flag_changed', '{\"key\":\"chatwoot_portal\",\"enabled\":\"true\"}')" >/dev/null
  deshacer "$O/d6b.txt" "$K" seco
  rm -rf -- "$SHM"
  q "delete from public.entity_audit_log where tenant_id = '$TENANT'" >/dev/null
  # D6c: sin la fila del flag del tenant (un TENANT que no es de esa base, u otra base).
  q "delete from public.feature_flags where tenant_id = '$TENANT' and key = 'chatwoot_portal'" >/dev/null
  deshacer "$O/d6c.txt" "$K" seco
  rm -rf -- "$SHM"
  q "insert into public.feature_flags (tenant_id, key, enabled) values ('$TENANT', 'chatwoot_portal', false)" >/dev/null
  # D6d: la cola corrió (una salida que no está cargado).
  q "update public.chatwoot_portal_salida set estado = 'pendiente', proximo_at = now()
     where message_id = (select message_id from public.chatwoot_portal_salida where tenant_id = '$TENANT' and estado = 'cargado' order by message_id limit 1)
     returning message_id" >"$O/salida.txt"
  deshacer "$O/d6d.txt" "$K" seco
  rm -rf -- "$SHM"
  q "update public.chatwoot_portal_salida set estado = 'cargado', proximo_at = null where message_id = '$(head -n 1 "$O/salida.txt")'" >/dev/null
  # D6e: otro tenant, que tiene su fila del flag pero ningún hilo vinculado.
  deshacer "$O/d6e.txt" "$K" seco "TENANT=$T2"
  rm -rf -- "$SHM"
  # D6f: el espejo de un hilo en otra bandeja; D8: BANDEJA es la otra bandeja de la cuenta.
  q "update public.chatwoot_conversations set inbox_id = 999 where tenant_id = '$TENANT' and conversation_id = 1100" >/dev/null
  deshacer "$O/d6f.txt" "$K" seco
  rm -rf -- "$SHM"
  q "update public.chatwoot_conversations set inbox_id = $BANDEJA where tenant_id = '$TENANT' and conversation_id = 1100" >/dev/null
  deshacer "$O/d8.txt" "$K" seco "BANDEJA=$OTRA"
  rm -rf -- "$SHM"
  # D6g: sin DB; D6h: DB no es una base de Studio (el flag no se puede leer); D10: un número con un cero adelante.
  deshacer "$O/d6g.txt" "$K" seco DB=
  rm -rf -- "$SHM"
  deshacer "$O/d6h.txt" "$K" seco "DB=$P-postgres-1"
  rm -rf -- "$SHM"
  deshacer "$O/d10.txt" "$K" seco "CUENTA=0$CUENTA"
  rm -rf -- "$SHM"
}
parte_ajeno() { # carpeta salidas
  local K="$1" O="$2" cual
  for cual in mensaje contact_inbox sin-hilo asignada snoozed telefono nota; do
    sonda "$O/ajeno-$cual.txt" FASE=ajeno "CUAL=$cual"
    deshacer "$O/d1-$cual.txt" "$K" seco
    [ -e "$SHM/contactos-conservados.ndjson" ] && echo "HECHO archivo=si" >>"$O/d1-$cual.txt"
    rm -rf -- "$SHM"
    sonda "$O/quitar-$cual.txt" FASE=quitar-ajeno
  done
}
parte_borrar() { # carpeta salidas
  local K="$1" O="$2"
  # El conservado de este escenario: después de un mutante que lo borró, la recarga crea otro contacto con otro id.
  sonda "$O/otra-bandeja.txt" FASE=otra-bandeja
  sonda "$O/contar-antes.txt" FASE=contar
  # D2: el seco.
  deshacer "$O/d2.txt" "$K" seco
  [ -e "$SHM/contactos-conservados.ndjson" ] && cp "$SHM/contactos-conservados.ndjson" "$O/conservados.ndjson"
  stat -c 'HECHO permiso=%a' "$SHM/contactos-conservados.ndjson" >>"$O/d2.txt" 2>/dev/null
  limpio_desde_afuera && echo "HECHO limpio_desde_afuera=si" >>"$O/d2.txt"
  sonda "$O/contar-seco.txt" FASE=contar
  # D9: los conservados de otro tenant.
  sed "s/\"tenant_id\":\"$TENANT\"/\"tenant_id\":\"$T2\"/" "$O/conservados.ndjson" >"$SHM/contactos-conservados.ndjson"
  deshacer "$O/d9.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/contar-d9.txt" FASE=contar
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
  [ -e "$SHM/contactos-conservados.ndjson" ] && echo "HECHO archivo_despues=si" >>"$O/d5.txt"
  sonda "$O/contar-d5.txt" FASE=contar
  # D7 (revisar-datos-ve, paso 3): las marcas de lo borrado, buscadas en toda la base de Chatwoot.
  docker exec "$P-postgres-1" pg_dump -U chatwoot -d chatwoot_production --data-only >"$O/volcado.sql" 2>/dev/null
  rm -rf -- "$SHM"
}
escenario() { # carpeta salidas modo
  mkdir -p "$2"
  case "$3" in
    sh) parte_sh "$1" "$2" ;;
    ajeno) parte_ajeno "$1" "$2" ;;
    completo) parte_sh "$1" "$2"; parte_ajeno "$1" "$2"; parte_borrar "$1" "$2" ;;
  esac
}

err() { h "$1" error; }
comprobar_sh() {
  local O="$1"
  exigir D6a '[ "$(h "$O/d6a.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6a.txt")" = chatwoot_portal_encendido ] && [ -z "$(h "$O/d6a.txt" contenedor_limpio)" ]' \
    "con chatwoot_portal encendido, no corre y no toca Chatwoot ($(err "$O/d6a.txt"))"
  exigir D6b '[ "$(h "$O/d6b.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6b.txt")" = chatwoot_portal_se_encendio_alguna_vez ]' \
    "con chatwoot_portal encendido alguna vez (entity_audit_log), no corre ($(err "$O/d6b.txt"))"
  exigir D6c '[ "$(h "$O/d6c.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6c.txt")" = el_tenant_no_tiene_la_fila_del_flag ]' \
    "sin la fila del flag del tenant (otro TENANT u otra base), no corre ($(err "$O/d6c.txt"))"
  exigir D6d '[ "$(h "$O/d6d.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6d.txt")" = la_cola_corrio ]' \
    "con una salida que no está cargado (la cola corrió), no corre ($(err "$O/d6d.txt"))"
  exigir D6e '[ "$(h "$O/d6e.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6e.txt")" = el_tenant_no_tiene_hilos_vinculados ]' \
    "otro tenant, sin hilos vinculados: no corre ($(err "$O/d6e.txt"))"
  exigir D6f '[ "$(h "$O/d6f.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6f.txt")" = un_hilo_del_tenant_no_es_de_esta_bandeja ]' \
    "el espejo de un hilo en otra bandeja: no corre ($(err "$O/d6f.txt"))"
  exigir D8 '[ "$(h "$O/d8.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d8.txt")" = un_hilo_del_tenant_no_es_de_esta_bandeja ]' \
    "BANDEJA es otra bandeja de la cuenta: no corre ($(err "$O/d8.txt"))"
  exigir D6g '[ "$(h "$O/d6g.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d6g.txt")" = falta_db ]' \
    "sin DB, no corre: no hay valor por defecto ($(err "$O/d6g.txt"))"
  exigir D6h '[ "$(h "$O/d6h.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6h.txt")" = no_se_pudo_comprobar_el_flag ]' \
    "con DB que no es una base de Studio, el flag no se puede leer y no corre ($(err "$O/d6h.txt"))"
  exigir D10 '[ "$(h "$O/d10.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d10.txt")" = cuenta_o_bandeja_no_numerica ]' \
    "CUENTA con un cero adelante: no corre ($(err "$O/d10.txt"))"
}
comprobar_ajeno() {
  local O="$1" cual clave F
  for cual in mensaje:mensajes:D1a contact_inbox:contact_inboxes:D1b sin-hilo:conversaciones_sin_dtd_hilo:D1c \
              asignada:asignadas:D1d snoozed:snoozed:D1e telefono:contactos_con_datos:D1f nota:actividad:D1g; do
    F="$O/d1-${cual%%:*}.txt"; clave="${cual#*:}"; clave="${clave%%:*}"
    exigir "${cual##*:}" '[ "$(h "$F" salida_proceso)" = 1 ] && grep -q "^HECHO error=algo ajeno en la bandeja" "$F" && [ "$(h "$F" "ajeno_$clave")" = 1 ] && [ -z "$(h "$F" archivo)" ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
      "lo ajeno (${cual%%:*}): el seco aborta, con ajeno_$clave=$(h "$F" "ajeno_$clave"), sin archivo y con el contenedor limpio"
  done
}
comprobar_borrar() {
  local O="$1" A F fugas=0 f m cons
  A="$(h "$O/contar-antes.txt" bandeja)"
  cons="$(h "$O/otra-bandeja.txt" conservado)"
  F="$O/d2.txt"
  exigir D2 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" deshacer)" = ok ] && [ "$(h "$F" contactos_conservados)" = 1 ] && [ "$(h "$F" permiso)" = 600 ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$O/contar-seco.txt" bandeja)" = "$A" ] && grep -q "\"contacto_id\":$cons}" "$O/conservados.ndjson" && grep -q "\"tenant_id\":\"$TENANT\"" "$O/conservados.ndjson" && [ "$(wc -l <"$O/conservados.ndjson")" = 2 ]' \
    "seco: no borra nada ($(h "$O/contar-seco.txt" bandeja)) y escribe en 0600 el contacto conservado ($cons): $(h "$F" contactos_de_la_bandeja) de la bandeja, $(h "$F" contactos_conservados) conservado, $(h "$F" contactos_a_borrar) a borrar"
  exigir D9 '[ "$(h "$O/d9.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d9.txt")" = "los conservados no son de este tenant, cuenta y bandeja" ] && [ "$(h "$O/contar-d9.txt" bandeja)" = "$A" ]' \
    "los conservados de otro tenant: aborta sin borrar ($(err "$O/d9.txt"))"
  exigir D3 '[ "$(h "$O/d3.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d3.txt")" = "la lista de conservados cambió desde el seco" ] && [ "$(h "$O/contar-d3.txt" bandeja)" = "$A" ]' \
    "la lista cambió entre el seco y el borrado: aborta sin borrar ($(err "$O/d3.txt"))"
  F="$O/d4.txt"
  exigir D4 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = no ] && [ "$(h "$F" despues)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d4.txt" bandeja)" = "$A" ] && [ "$(h "$O/contar-d4.txt" contactos_dtd)" = "$(h "$O/contar-antes.txt" contactos_dtd)" ]' \
    "CONFIRMAR=no: dentro de la transacción la bandeja queda en 0, y después del ROLLBACK, igual que antes ($(h "$O/contar-d4.txt" bandeja))"
  F="$O/d5.txt"
  exigir D5 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = si ] && [ "$(h "$O/contar-d5.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d5.txt" contactos_dtd)" = 1 ] && [ "$(h "$O/contar-d5.txt" otra)" = "$(h "$O/contar-antes.txt" otra)" ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$F" contenedor_limpio)" = si ] && [ "$(h "$F" archivo_despues)" = si ]' \
    "CONFIRMAR=si: la bandeja vacía, queda solo el contacto conservado ($(h "$O/contar-d5.txt" contactos_dtd)), la otra bandeja igual ($(h "$O/contar-d5.txt" otra)), el contenedor limpio, y el archivo sigue para el desarme de Studio"
  # D7: lo borrado ya no está en ninguna tabla de Chatwoot. El control: lo que no se borra sí está.
  # Los textos de los mensajes de la bandeja se borran todos; de los dos contactos de la carga queda uno, el conservado.
  local quedan=0 control=0 nombres=0
  for m in 'SINT pregunta' 'SINT respuesta' 'SINT en el margen' 'SINT archivado'; do grep -q -F -- "$m" "$O/volcado.sql" 2>/dev/null && quedan=$((quedan + 1)); done
  grep -q -F -- 'SINT otra bandeja' "$O/volcado.sql" 2>/dev/null && control=1
  for m in 'Cliente A' 'Cliente B'; do grep -q -F -- "$m" "$O/volcado.sql" 2>/dev/null && nombres=$((nombres + 1)); done
  exigir D7 '[ -s "$O/volcado.sql" ] && [ "$quedan" = 0 ] && [ "$control" = 1 ] && [ "$nombres" = 1 ]' \
    "las marcas de lo borrado no están en ninguna tabla de Chatwoot ($quedan de 4 textos; $nombres de 2 nombres, el del conservado), y lo de la otra bandeja sí ($control)"
  for f in "$O"/d*.txt "$O/conservados.ndjson"; do
    for m in "${MARCAS[@]}"; do grep -q -F -- "$m" "$f" 2>/dev/null && { fugas=$((fugas + 1)); [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $(basename "$f")"; }; done
  done
  # El control de F1: la marca sí está en el preparado, así que el grep encuentra lo que busca.
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/d2.txt" ] && grep -q -F "Cliente A" "$TRABAJO/preparado.ndjson"' \
    "cero de ${#MARCAS[@]} valores inventados en las salidas de deshacer.sh y en los conservados (control: el preparado sí los trae)"
}
comprobar() { # salidas modo
  case "$2" in
    sh) comprobar_sh "$1" ;;
    ajeno) comprobar_ajeno "$1" ;;
    completo) comprobar_sh "$1"; comprobar_ajeno "$1"; comprobar_borrar "$1" ;;
  esac
  return 0
}

log "== D. la vuelta atrás, sobre la carga real"
escenario "$PH" "$TRABAJO/real" completo
comprobar "$TRABAJO/real" completo

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
mutante() { # id qué archivo modo caen pasan buscar reemplazo
  local id="$1" que="$2" arch="$3" modo="$4" caen="$5" pasan="$6" K="$TRABAJO/m/$1" faltan="" otro="" c
  rm -rf -- "$K"; mkdir -p "$K"; cp -r "$PH/." "$K/"
  if ! mutar "$K/$arch" "$7" "$8" >"$K.mutar.txt" 2>&1; then mal "$id" "$que: no se pudo aplicar ($(cat "$K.mutar.txt"))"; return 0; fi
  [ "$modo" = completo ] && recargar
  RES=(); MODO_LOG=0
  escenario "$K" "$TRABAJO/$id" "$modo"
  comprobar "$TRABAJO/$id" "$modo"
  MODO_LOG=1
  for c in $caen; do [ "${RES[$c]:-FALLÓ}" = FALLÓ ] || faltan="$faltan $c"; done
  for c in $pasan; do [ "${RES[$c]:-FALLÓ}" = PASÓ ] || otro="$otro $c"; done
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que ($modo): tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: $(cayeron_en)"
}
if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes"
  mutante MD0 "control: los guiones sin cambios, sobre una carga nueva" deshacer-carga.rb completo "" \
    "D1a D1b D1c D1d D1e D1f D1g D2 D3 D4 D5 D6a D6b D6c D6d D6e D6f D6g D6h D7 D8 D9 D10 F1" "require 'set'" "require 'set'"
  # Lo ajeno (deshacer-carga.rb), con la parte ajeno sola.
  mutante MD1 "no mira los mensajes ajenos" deshacer-carga.rb ajeno "D1a" "D1b D1c" \
    "'mensajes' => mensajes.where(\"source_id IS NULL OR source_id NOT LIKE 'dtd:%'\").count," "'mensajes' => 0,"
  mutante MD2 "no mira los contact_inboxes ajenos" deshacer-carga.rb ajeno "D1b" "D1a D1c" \
    "'contact_inboxes' => contact_inboxes.where(\"source_id NOT LIKE 'dtd-portal:%'\").count," "'contact_inboxes' => 0,"
  mutante MD15 "no mira las conversaciones sin dtd_hilo" deshacer-carga.rb ajeno "D1c" "D1a D1b" \
    "'conversaciones_sin_dtd_hilo' => conversaciones.where(\"NOT (coalesce(additional_attributes, '{}'::jsonb) ? 'dtd_hilo')\").count," \
    "'conversaciones_sin_dtd_hilo' => 0,"
  mutante MD16 "no mira las asignadas" deshacer-carga.rb ajeno "D1d" "D1a D1e" \
    "'asignadas' => conversaciones.where.not(assignee_id: nil).count," "'asignadas' => 0,"
  mutante MD17 "no mira las snoozed" deshacer-carga.rb ajeno "D1e" "D1a D1d" \
    "'snoozed' => conversaciones.where(status: Conversation.statuses.fetch('snoozed')).count" "'snoozed' => 0"
  mutante MD18 "no mira los contactos con teléfono o correo" deshacer-carga.rb ajeno "D1f" "D1a D1g" \
    "ajeno['contactos_con_datos'] = Contact.where(id: ids_contactos).where('phone_number IS NOT NULL OR email IS NOT NULL').count" \
    "ajeno['contactos_con_datos'] = 0"
  mutante MD19 "no mira las notas" deshacer-carga.rb ajeno "D1g" "D1a D1f" \
    "%w[notes contact_id contactos]," ""
  # Las guardas de deshacer.sh, con la parte sh sola.
  mutante MD8 "no mira el flag encendido" deshacer.sh sh "D6a" "D6b D6c" \
    "  encendido) mal chatwoot_portal_encendido 1 ;;" "  encendido) ;;"
  mutante MD9 "no mira si el flag se encendió alguna vez" deshacer.sh sh "D6b" "D6a D6c" \
    "  alguna_vez) mal chatwoot_portal_se_encendio_alguna_vez 1 ;;" "  alguna_vez) ;;"
  mutante MD10 "acepta un tenant sin la fila del flag" deshacer.sh sh "D6c" "D6a D6d" \
    "  sin_fila) mal el_tenant_no_tiene_la_fila_del_flag 1 ;;" "  sin_fila) ;;"
  mutante MD11 "no mira la cola" deshacer.sh sh "D6d" "D6a D6c" \
    "  cola) mal la_cola_corrio 1 ;;" "  cola) ;;"
  mutante MD12 "acepta un tenant sin hilos" deshacer.sh sh "D6e" "D6a D6f" \
    "  sin_hilos) mal el_tenant_no_tiene_hilos_vinculados 1 ;;" "  sin_hilos) ;;"
  mutante MD13 "no mira la bandeja del espejo" deshacer.sh sh "D6f D8" "D6a D6e" \
    "  otra_bandeja) mal un_hilo_del_tenant_no_es_de_esta_bandeja 1 ;;" "  otra_bandeja) ;;"
  mutante MD14 "DB con valor por defecto" deshacer.sh sh "D6g" "D6a D6h" \
    '[ -n "${DB:-}" ] || mal falta_db' 'DB="${DB:-dtd-cargo-db-1}"'
  mutante MD20 "acepta ceros a la izquierda" deshacer.sh sh "D10" "D6a" \
    "'' | 0[0-9]* | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;" "'' | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;"
  # El seco, la lista y CONFIRMAR (deshacer-carga.rb), con el escenario completo.
  mutante MD3 "borra el contacto que tiene otra bandeja" deshacer-carga.rb completo "D2 D5" "D1a D6a" \
    "conservados = todos.select { |_, id| con_otra.include?(id) }.sort" "conservados = []"
  mutante MD4 "borra mensajes fuera de la bandeja" deshacer-carga.rb completo "D5" "D2 D4" \
    "hecho('borrados_mensajes', mensajes.delete_all)" "hecho('borrados_mensajes', Message.where(account_id: @cuenta_id).delete_all)"
  mutante MD5 "el seco confirma lo que borra" deshacer-carga.rb completo "D2" "D1a" \
    "        escribir_conservados(conservados)
        raise ActiveRecord::Rollback" "        escribir_conservados(conservados)
        mensajes.delete_all"
  mutante MD6 "no compara la lista de conservados" deshacer-carga.rb completo "D3" "D2" \
    "raise DeshacerError, 'la lista de conservados cambió desde el seco' unless leer_conservados == conservados" "leer_conservados"
  mutante MD7 "CONFIRMAR=no confirma" deshacer-carga.rb completo "D4" "D2 D3" \
    "raise ActiveRecord::Rollback unless @confirmar == 'si'" "nil"
  mutante MD21 "no mira el tenant de los conservados" deshacer-carga.rb completo "D9" "D2" \
    "unless cab['tenant_id'] == @tenant && cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id" \
    "unless cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id"
else
  log "== M. mutantes NO EJECUTADOS (--sin-mutantes)"
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  # Solo datos inventados: las salidas ayudan a leer el rojo desde el log del CI.
  for f in "$TRABAJO"/real/*.txt; do echo "--- $(basename "$f")"; grep '^HECHO ' "$f" | tail -n 25; done
fi
log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
