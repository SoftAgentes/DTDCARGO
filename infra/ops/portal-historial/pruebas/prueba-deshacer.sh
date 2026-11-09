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
  env DB_CW="$CONT" DB="$PG" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" MODO="$modo" DESHACER_PRUEBA=1 DESHACER_DURABLE="$DUR" \
    "$@" bash "$carpeta/deshacer.sh" >"$sal" 2>&1
  echo "HECHO salida_proceso=$?" >>"$sal"
}
# La copia durable del paso 3 (Sam, la (a): «si protegidos»). En el VPS es /srv/ops/portal-historial/deshacer.
DUR="$TRABAJO/durable/deshacer"
H() { sed -n "s/.* $2=\([^ ]*\).*/\1/p" "$1" 2>/dev/null | head -n 1; } # H archivo campo: un campo de un .hecho
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
  # D6i: una salida «enviado», con su chatwoot_message_id: también es la cola.
  q "update public.chatwoot_portal_salida set estado = 'enviado', chatwoot_message_id = 4242
     where message_id = '$(head -n 1 "$O/salida.txt")'" >/dev/null
  deshacer "$O/d6i.txt" "$K" seco
  rm -rf -- "$SHM"
  q "update public.chatwoot_portal_salida set estado = 'cargado', chatwoot_message_id = null where message_id = '$(head -n 1 "$O/salida.txt")'" >/dev/null
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
  local K="$1" O="$2" sha
  rm -rf -- "$TRABAJO/durable"
  # El conservado de este escenario: después de un mutante que lo borró, la recarga crea otro contacto con otro id.
  sonda "$O/otra-bandeja.txt" FASE=otra-bandeja
  sonda "$O/contar-antes.txt" FASE=contar
  # D2: el seco (paso 1): el .ndjson y chatwoot-seco.hecho.
  deshacer "$O/d2.txt" "$K" seco
  [ -e "$SHM/contactos-conservados.ndjson" ] && cp "$SHM/contactos-conservados.ndjson" "$O/conservados.ndjson"
  [ -e "$SHM/chatwoot-seco.hecho" ] && cp "$SHM/chatwoot-seco.hecho" "$O/chatwoot-seco.hecho"
  stat -c 'HECHO permiso=%a' "$SHM/contactos-conservados.ndjson" >>"$O/d2.txt" 2>/dev/null
  stat -c 'HECHO permiso_hecho=%a' "$SHM/chatwoot-seco.hecho" >>"$O/d2.txt" 2>/dev/null
  limpio_desde_afuera && echo "HECHO limpio_desde_afuera=si" >>"$O/d2.txt"
  sonda "$O/contar-seco.txt" FASE=contar
  sha="$(sha256sum "$O/conservados.ndjson" 2>/dev/null | cut -c1-64)"
  # D9 y D3, con CONFIRMAR=no (el ensayo suelto del DG, que no exige los .hecho): las guardas del .rb.
  sed "s/\"tenant_id\":\"$TENANT\"/\"tenant_id\":\"$T2\"/" "$O/conservados.ndjson" >"$SHM/contactos-conservados.ndjson"
  deshacer "$O/d9.txt" "$K" borrar CONFIRMAR=no
  sonda "$O/contar-d9.txt" FASE=contar
  printf '%s\n' "$(head -n 1 "$O/conservados.ndjson" | sed 's/"contactos":[0-9]*/"contactos":0/')" >"$SHM/contactos-conservados.ndjson"
  deshacer "$O/d3.txt" "$K" borrar CONFIRMAR=no
  sonda "$O/contar-d3.txt" FASE=contar
  install -m 0600 "$O/conservados.ndjson" "$SHM/contactos-conservados.ndjson"
  # D4: el ensayo con rollback: no escribe chatwoot-borrar.hecho, ni crea la copia durable.
  deshacer "$O/d4.txt" "$K" borrar CONFIRMAR=no
  [ -e "$SHM/chatwoot-borrar.hecho" ] && echo "HECHO hecho_borrar=si" >>"$O/d4.txt"
  [ -e "$DUR" ] && echo "HECHO durable=si" >>"$O/d4.txt"
  sonda "$O/contar-d4.txt" FASE=contar
  # D11: el borrado (paso 3) sin el ensayo de Studio, con otro sha256 y con otro tenant.
  deshacer "$O/d11a.txt" "$K" borrar CONFIRMAR=si
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=copia fin=rollback utc=%s\n' \
    "$(printf '%064d' 0)" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  deshacer "$O/d11b.txt" "$K" borrar CONFIRMAR=si
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=copia fin=rollback utc=%s\n' \
    "$sha" "$T2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  deshacer "$O/d11c.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/contar-d11.txt" FASE=contar
  # Un mutante que deja pasar el borrado de D11b o D11c (MD25, MD26) vacía la bandeja: se recarga, para que D5 mida de
  # verdad y no caiga en cascada. En la corrida real la bandeja sigue llena (D11c lo exige) y no se recarga nada.
  if [ "$(h "$O/contar-d11.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ]; then
    # recargar borra /dev/shm/portal-historial: el .ndjson y los .hecho del seco y del ensayo se guardan y se devuelven.
    rm -rf -- "$O/shm-guardado" && cp -a "$SHM" "$O/shm-guardado"
    # El chatwoot-borrar.hecho que dejó el borrado colado no es del seco ni del ensayo: no se devuelve (si no, la guarda
    # de la evidencia niega D15 y D5, el rojo del run 42618396536). En la corrida real D4 y D15 ya exigen que no exista.
    rm -f -- "$O/shm-guardado/chatwoot-borrar.hecho"
    recargar
    rm -rf -- "$SHM" && cp -a "$O/shm-guardado" "$SHM"
    echo "HECHO recargado_antes_de_d5=si" >>"$O/contar-d11.txt"
  fi
  # D15 empieza sin la evidencia de un borrado: ni la durable ni chatwoot-borrar.hecho en tmpfs. En la corrida real no
  # hay nada que quitar: D4 y D15 ya exigen que no exista.
  rm -rf -- "$TRABAJO/durable" "$SHM/chatwoot-borrar.hecho"
  # El ensayo de Studio (paso 2), como lo escribe E10, con el sha256 del .ndjson del seco.
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=copia fin=rollback utc=%s\n' \
    "$sha" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  chmod 0600 "$SHM/studio-ensayo.hecho"
  # D15: con los .hecho válidos, el borrado aborta antes del COMMIT (algo ajeno en la bandeja): la copia durable queda
  # con el .ndjson y los dos .hecho, y sin chatwoot-borrar.hecho en ninguna de las dos carpetas.
  sonda "$O/ajeno-d15.txt" FASE=ajeno CUAL=mensaje
  deshacer "$O/d15.txt" "$K" borrar CONFIRMAR=si
  { [ -e "$SHM/chatwoot-borrar.hecho" ] || [ -e "$DUR/chatwoot-borrar.hecho" ]; } && echo "HECHO hecho_sin_commit=si" >>"$O/d15.txt"
  echo "HECHO durable_d15=$(find "$DUR" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | sort | tr '\n' ',')" >>"$O/d15.txt"
  sonda "$O/quitar-d15.txt" FASE=quitar-ajeno
  # D5 empieza con la durable limpia y sin chatwoot-borrar.hecho en tmpfs: así un mutante que deja el .inicio (MD33) o el
  # .hecho (MD30) en D15 cae solo en D15, no en D5 por la guarda de la evidencia (condición del DG: cada mutante cae en
  # su propio caso). En la corrida real D4 y D15 ya exigen que no exista.
  rm -rf -- "$TRABAJO/durable" "$SHM/chatwoot-borrar.hecho"
  # D5: el borrado (paso 3): deja la copia durable, borra y escribe chatwoot-borrar.hecho en las dos copias.
  deshacer "$O/d5.txt" "$K" borrar CONFIRMAR=si
  limpio_desde_afuera && echo "HECHO limpio_desde_afuera=si" >>"$O/d5.txt"
  [ -e "$SHM/contactos-conservados.ndjson" ] && echo "HECHO archivo_despues=si" >>"$O/d5.txt"
  stat -c 'HECHO durable_permiso=%a' "$DUR" >>"$O/d5.txt" 2>/dev/null
  echo "HECHO durable_archivos=$(find "$DUR" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')" >>"$O/d5.txt"
  echo "HECHO durable_permisos=$(find "$DUR" -maxdepth 1 -type f -printf '%m\n' 2>/dev/null | sort -u | tr '\n' ',')" >>"$O/d5.txt"
  local f iguales=0
  for f in contactos-conservados.ndjson chatwoot-seco.hecho studio-ensayo.hecho chatwoot-borrar.hecho; do
    [ -s "$SHM/$f" ] && cmp -s "$SHM/$f" "$DUR/$f" && iguales=$((iguales + 1))
  done
  echo "HECHO durable_iguales=$iguales" >>"$O/d5.txt"
  [ -s "$DUR/chatwoot-borrar.inicio" ] && cp "$DUR/chatwoot-borrar.inicio" "$O/chatwoot-borrar.inicio"
  [ -e "$SHM/chatwoot-borrar.hecho" ] && cp "$SHM/chatwoot-borrar.hecho" "$O/chatwoot-borrar.hecho"
  sonda "$O/contar-d5.txt" FASE=contar
  # D17: otro MODO=borrar después del borrado, aunque sea CONFIRMAR=no, se niega y la evidencia de la durable queda.
  deshacer "$O/d17.txt" "$K" borrar CONFIRMAR=no
  echo "HECHO evidencia_despues=$(find "$DUR" -maxdepth 1 -type f -name 'chatwoot-borrar.*' -printf '%f\n' 2>/dev/null | sort | tr '\n' ',')" >>"$O/d17.txt"
  # D7 (revisar-datos-ve, paso 3): las marcas de lo borrado, buscadas en toda la base de Chatwoot.
  docker exec "$P-postgres-1" pg_dump -U chatwoot -d chatwoot_production --data-only >"$O/volcado.sql" 2>/dev/null
  rm -rf -- "$SHM" "$TRABAJO/durable"
}
# El corte entre el COMMIT y chatwoot-borrar.hecho (B1 de la revisión del DG de la #480), con su propia carga: la
# escritura del .hecho falla (una carpeta donde va el .parcial) después de que el .rb confirmó.
parte_corte() { # carpeta salidas
  local K="$1" O="$2" sha
  recargar
  rm -rf -- "$TRABAJO/durable" "$SHM"
  deshacer "$O/c-seco.txt" "$K" seco
  sha="$(sha256sum "$SHM/contactos-conservados.ndjson" 2>/dev/null | cut -c1-64)"
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=copia fin=rollback utc=%s\n' \
    "$sha" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  chmod 0600 "$SHM/studio-ensayo.hecho"
  mkdir "$SHM/chatwoot-borrar.hecho.parcial"
  deshacer "$O/d16.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/contar-d16.txt" FASE=contar
  echo "HECHO durable_d16=$(find "$DUR" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | sort | tr '\n' ',')" >>"$O/d16.txt"
  rmdir "$SHM/chatwoot-borrar.hecho.parcial"
  # El segundo MODO=borrar, con CONFIRMAR=no: se niega y no toca el .inicio.
  deshacer "$O/d17b.txt" "$K" borrar CONFIRMAR=no
  echo "HECHO inicio_despues=$([ -s "$DUR/chatwoot-borrar.inicio" ] && echo si || echo no)" >>"$O/d17b.txt"
  rm -rf -- "$SHM" "$TRABAJO/durable"
}
escenario() { # carpeta salidas modo
  mkdir -p "$2"
  case "$3" in
    sh) parte_sh "$1" "$2" ;;
    ajeno) parte_ajeno "$1" "$2" ;;
    borrar) parte_borrar "$1" "$2" ;;
    corte) parte_corte "$1" "$2" ;;
    completo) parte_sh "$1" "$2"; parte_ajeno "$1" "$2"; parte_borrar "$1" "$2"; parte_corte "$1" "$2" ;;
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
  exigir D6i '[ "$(h "$O/d6i.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d6i.txt")" = la_cola_corrio ]' \
    "con una salida «enviado» (la cola corrió), no corre ($(err "$O/d6i.txt"))"
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
  local O="$1" A F fugas=0 f m cons sha
  A="$(h "$O/contar-antes.txt" bandeja)"
  cons="$(h "$O/otra-bandeja.txt" conservado)"
  sha="$(sha256sum "$O/conservados.ndjson" 2>/dev/null | cut -c1-64)"
  F="$O/d2.txt"
  exigir D2 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" deshacer)" = ok ] && [ "$(h "$F" contactos_conservados)" = 1 ] && [ "$(h "$F" permiso)" = 600 ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$O/contar-seco.txt" bandeja)" = "$A" ] && grep -q "\"contacto_id\":$cons}" "$O/conservados.ndjson" && grep -q "\"tenant_id\":\"$TENANT\"" "$O/conservados.ndjson" && [ "$(wc -l <"$O/conservados.ndjson")" = 2 ]' \
    "seco: no borra nada ($(h "$O/contar-seco.txt" bandeja)) y escribe en 0600 el contacto conservado ($cons): $(h "$F" contactos_de_la_bandeja) de la bandeja, $(h "$F" contactos_conservados) conservado, $(h "$F" contactos_a_borrar) a borrar"
  F="$O/chatwoot-seco.hecho"
  exigir D2b '[ "$(h "$O/d2.txt" permiso_hecho)" = 600 ] && grep -q "^HECHO chatwoot_seco=ok " "$F" && [ "$(H "$F" conservados_sha256)" = "$sha" ] && [ "$(H "$F" tenant)" = "$TENANT" ] && [ "$(H "$F" cuenta)" = "$CUENTA" ] && [ "$(H "$F" bandeja)" = "$BANDEJA" ] && [ "$(wc -l <"$F")" = 1 ]' \
    "el seco escribe chatwoot-seco.hecho en 0600, con el sha256 del .ndjson, el tenant, la cuenta y la bandeja"
  exigir D9 '[ "$(h "$O/d9.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d9.txt")" = "los conservados no son de este tenant, cuenta y bandeja" ] && [ "$(h "$O/contar-d9.txt" bandeja)" = "$A" ]' \
    "los conservados de otro tenant: aborta sin borrar ($(err "$O/d9.txt"))"
  exigir D3 '[ "$(h "$O/d3.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d3.txt")" = "la lista de conservados cambió desde el seco" ] && [ "$(h "$O/contar-d3.txt" bandeja)" = "$A" ]' \
    "la lista cambió entre el seco y el borrado: aborta sin borrar ($(err "$O/d3.txt"))"
  F="$O/d4.txt"
  exigir D4 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = no ] && [ "$(h "$F" despues)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d4.txt" bandeja)" = "$A" ] && [ "$(h "$O/contar-d4.txt" contactos_dtd)" = "$(h "$O/contar-antes.txt" contactos_dtd)" ] && [ -z "$(h "$F" hecho_borrar)" ] && [ -z "$(h "$F" durable)" ]' \
    "CONFIRMAR=no: dentro de la transacción la bandeja queda en 0, después del ROLLBACK igual que antes ($(h "$O/contar-d4.txt" bandeja)), sin chatwoot-borrar.hecho ni copia durable"
  exigir D11a '[ "$(h "$O/d11a.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d11a.txt")" = falta_studio_ensayo_hecho ]' \
    "el borrado sin el ensayo de Studio: se niega ($(err "$O/d11a.txt"))"
  exigir D11b '[ "$(h "$O/d11b.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d11b.txt")" = el_sha256_de_los_conservados_no_coincide ]' \
    "el borrado con otro sha256 en el ensayo de Studio: se niega ($(err "$O/d11b.txt"))"
  exigir D11c '[ "$(h "$O/d11c.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d11c.txt")" = el_tenant_de_los_hecho_no_coincide ] && [ "$(h "$O/contar-d11.txt" bandeja)" = "$A" ]' \
    "el borrado con otro tenant en el ensayo de Studio: se niega, y la bandeja sigue igual ($(err "$O/d11c.txt"))"
  F="$O/d15.txt"
  exigir D15 '[ "$(h "$F" salida_proceso)" = 1 ] && grep -q "^HECHO error=algo ajeno en la bandeja" "$F" && [ -z "$(h "$F" hecho_sin_commit)" ] && [ "$(h "$F" durable_d15)" = "chatwoot-seco.hecho,contactos-conservados.ndjson,studio-ensayo.hecho," ]' \
    "el borrado aborta antes del COMMIT: sin chatwoot-borrar.hecho en ninguna carpeta, y la copia durable con el .ndjson y los dos .hecho ($(h "$F" durable_d15))"
  F="$O/d5.txt"
  exigir D5 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = si ] && [ "$(h "$O/contar-d5.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d5.txt" contactos_dtd)" = 1 ] && [ "$(h "$O/contar-d5.txt" otra)" = "$(h "$O/contar-antes.txt" otra)" ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$F" contenedor_limpio)" = si ] && [ "$(h "$F" archivo_despues)" = si ]' \
    "CONFIRMAR=si: la bandeja vacía, queda solo el contacto conservado ($(h "$O/contar-d5.txt" contactos_dtd)), la otra bandeja igual ($(h "$O/contar-d5.txt" otra)), el contenedor limpio y el .ndjson sigue para Studio"
  F="$O/chatwoot-borrar.hecho"
  exigir D13 'grep -q "^HECHO chatwoot_borrar=ok " "$F" && [ "$(H "$F" conservados_sha256)" = "$sha" ] && [ "$(H "$F" tenant)" = "$TENANT" ] && [ "$(H "$F" cuenta)" = "$CUENTA" ] && [ "$(H "$F" bandeja)" = "$BANDEJA" ] && [ "$(H "$F" fin)" = commit ]' \
    "el borrado escribe chatwoot-borrar.hecho, con el sha256, el tenant, la cuenta, la bandeja y fin=commit"
  F="$O/d5.txt"
  exigir D14 '[ "$(h "$F" durable_permiso)" = 700 ] && [ "$(h "$F" durable_archivos)" = 5 ] && grep -q "^INICIO chatwoot_borrar=en_curso conservados_sha256=$sha tenant=$TENANT cuenta=$CUENTA bandeja=$BANDEJA utc=" "$O/chatwoot-borrar.inicio" && [ "$(h "$F" durable_permisos)" = "600," ] && [ "$(h "$F" durable_iguales)" = 4 ]' \
    "la copia durable: la carpeta en 0700 ($(h "$F" durable_permiso)), los 4 archivos en 0600 ($(h "$F" durable_permisos)) e iguales a los de tmpfs ($(h "$F" durable_iguales) de 4)"
  F="$O/d17.txt"
  exigir D17 '[ "$(h "$F" salida_proceso)" = 2 ] && [ "$(err "$F")" = ya_hay_un_borrado_en_la_copia_durable ] && [ "$(h "$F" evidencia_despues)" = "chatwoot-borrar.hecho,chatwoot-borrar.inicio," ]' \
    "otro MODO=borrar después del borrado, aunque sea CONFIRMAR=no: se niega, y la evidencia de la durable queda ($(h "$F" evidencia_despues))"
  # D7: lo borrado ya no está en ninguna tabla de Chatwoot. El control: lo que no se borra sí está.
  # Los textos de los mensajes de la bandeja se borran todos; de los dos contactos de la carga queda uno, el conservado.
  local quedan=0 control=0 nombres=0
  for m in 'SINT pregunta' 'SINT respuesta' 'SINT en el margen' 'SINT archivado'; do grep -q -F -- "$m" "$O/volcado.sql" 2>/dev/null && quedan=$((quedan + 1)); done
  grep -q -F -- 'SINT otra bandeja' "$O/volcado.sql" 2>/dev/null && control=1
  for m in 'Cliente A' 'Cliente B'; do grep -q -F -- "$m" "$O/volcado.sql" 2>/dev/null && nombres=$((nombres + 1)); done
  exigir D7 '[ -s "$O/volcado.sql" ] && [ "$quedan" = 0 ] && [ "$control" = 1 ] && [ "$nombres" = 1 ]' \
    "las marcas de lo borrado no están en ninguna tabla de Chatwoot ($quedan de 4 textos; $nombres de 2 nombres, el del conservado), y lo de la otra bandeja sí ($control)"
  for f in "$O"/d*.txt "$O/conservados.ndjson" "$O"/*.hecho; do
    for m in "${MARCAS[@]}"; do grep -q -F -- "$m" "$f" 2>/dev/null && { fugas=$((fugas + 1)); [ "$MODO_LOG" = 1 ] && log "   fuga: $m en $(basename "$f")"; }; done
  done
  # El control de F1: la marca sí está en el preparado, así que el grep encuentra lo que busca.
  exigir F1 '[ "$fugas" = 0 ] && [ -s "$O/d2.txt" ] && grep -q -F "Cliente A" "$TRABAJO/preparado.ndjson"' \
    "cero de ${#MARCAS[@]} valores inventados en las salidas de deshacer.sh, los conservados y los .hecho (control: el preparado sí los trae)"
}
comprobar_corte() {
  local O="$1" F
  F="$O/d16.txt"
  exigir D16 '[ "$(h "$F" salida_proceso)" = 1 ] && [ "$(err "$F")" = no_se_pudo_escribir_el_hecho ] && [ "$(h "$F" fin)" = commit ] && [ "$(h "$O/contar-d16.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$F" durable_d16)" = "chatwoot-borrar.inicio,chatwoot-seco.hecho,contactos-conservados.ndjson,studio-ensayo.hecho," ]' \
    "el corte entre el COMMIT y chatwoot-borrar.hecho: Chatwoot ya está vacío, y la durable queda con el .inicio y sin el .hecho ($(h "$F" durable_d16))"
  F="$O/d17b.txt"
  exigir D17b '[ "$(h "$F" salida_proceso)" = 2 ] && [ "$(err "$F")" = ya_hay_un_borrado_en_la_copia_durable ] && [ "$(h "$F" inicio_despues)" = si ]' \
    "después del corte, otro MODO=borrar con CONFIRMAR=no se niega y el .inicio queda ($(err "$F"))"
}
comprobar() { # salidas modo
  case "$2" in
    sh) comprobar_sh "$1" ;;
    ajeno) comprobar_ajeno "$1" ;;
    borrar) comprobar_borrar "$1" ;;
    corte) comprobar_corte "$1" ;;
    completo) comprobar_sh "$1"; comprobar_ajeno "$1"; comprobar_borrar "$1"; comprobar_corte "$1" ;;
  esac
  return 0
}

PARTE="${PARTE:-todo}"
case "$PARTE" in todo | a | b | c) ;; *) echo "PARTE tiene que ser a, b, c o todo"; exit 2 ;; esac
en_parte() { # id del mutante: ¿corre en esta parte?
  local suya=a
  case "$1" in
    MD5 | MD6 | MD7 | MD21 | MD22 | MD24 | MD25 | MD26 | MD27 | MD28 | MD30 | MD32 | MD33) suya=b ;;
    MD1 | MD2 | MD15 | MD16 | MD17 | MD18 | MD19 | MD31) suya=c ;;
  esac
  [ "$PARTE" = todo ] || [ "$PARTE" = "$suya" ]
}
if [ "$PARTE" = a ] || [ "$PARTE" = todo ]; then
  log "== D. la vuelta atrás, sobre la carga real"
  escenario "$PH" "$TRABAJO/real" completo
  comprobar "$TRABAJO/real" completo
else
  log "== D. la corrida real va en la parte a; esta parte ($PARTE) corre solo sus mutantes"
fi

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
# Los casos de cada parte del escenario: corre_en id → «sh», «ajeno», «borrar» o «no existe».
CASOS_SH="D6a D6b D6c D6d D6i D6e D6f D8 D6g D6h D10"
CASOS_AJENO="D1a D1b D1c D1d D1e D1f D1g"
CASOS_BORRAR="D2 D2b D9 D3 D4 D11a D11b D11c D5 D13 D14 D15 D17 D7 F1"
CASOS_CORTE="D16 D17b"
corre_en() {
  case " $CASOS_SH " in *" $1 "*) echo sh; return ;; esac
  case " $CASOS_AJENO " in *" $1 "*) echo ajeno; return ;; esac
  case " $CASOS_BORRAR " in *" $1 "*) echo borrar; return ;; esac
  case " $CASOS_CORTE " in *" $1 "*) echo corte; return ;; esac
  echo "no existe"
}
mutante() { # id qué archivo modo caen pasan buscar reemplazo
  local id="$1" que="$2" arch="$3" modo="$4" caen="$5" pasan="$6" K="$TRABAJO/m/$1" faltan="" otro="" c
  en_parte "$id" || return 0
  rm -rf -- "$K"; mkdir -p "$K"; cp -r "$PH/." "$K/"
  if ! mutar "$K/$arch" "$7" "$8" >"$K.mutar.txt" 2>&1; then mal "$id" "$que: no se pudo aplicar ($(cat "$K.mutar.txt"))"; return 0; fi
  # Lo ajeno y el borrado necesitan la carga en la bandeja: la corrida de antes (o un mutante completo) la dejó vacía
  # (el rojo previo del run 42588248456: los mutantes de lo ajeno corrían sobre la bandeja vacía). Las guardas de
  # deshacer.sh (sh) no llegan a la bandeja.
  [ "$modo" = sh ] || recargar
  RES=(); MODO_LOG=0
  escenario "$K" "$TRABAJO/$id" "$modo"
  comprobar "$TRABAJO/$id" "$modo"
  MODO_LOG=1
  # Solo los casos que corren en este modo: uno de otro modo no cuenta; uno que no existe en ningún modo, sí (mal
  # escrito). Lo pidió el Subdirector después del run de la parte b: que la prueba haga sola esa cuenta.
  for c in $caen; do
    case "${RES[$c]:-}" in FALLÓ) ;; PASÓ) faltan="$faltan $c" ;; *) faltan="$faltan $c($(corre_en "$c"))" ;; esac
  done
  for c in $pasan; do
    case "${RES[$c]:-}" in
      PASÓ) ;;
      FALLÓ) otro="$otro $c" ;;
      *) [ "$(corre_en "$c")" = "no existe" ] && otro="$otro $c(no existe)" ;;
    esac
  done
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que ($modo): tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: $(cayeron_en)"
}
if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes"
  mutante MD0 "control: los guiones sin cambios, sobre una carga nueva" deshacer-carga.rb completo "" \
    "D1a D1b D1c D1d D1e D1f D1g D2 D2b D3 D4 D5 D6a D6b D6c D6d D6e D6f D6g D6h D6i D7 D8 D9 D10 D11a D11b D11c D13 D14 D15 D16 D17 D17b F1" "require 'set'" "require 'set'"
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
  mutante MD29 "la cola solo con pendiente" deshacer.sh sh "D6i" "D6a D6d" \
    "when exists (select 1 from public.chatwoot_portal_salida s where s.tenant_id = :'tenant' and s.estado <> 'cargado') then 'cola'" \
    "when exists (select 1 from public.chatwoot_portal_salida s where s.tenant_id = :'tenant' and s.estado = 'pendiente') then 'cola'"
  mutante MD12 "acepta un tenant sin hilos" deshacer.sh sh "D6e" "D6a D6f" \
    "  sin_hilos) mal el_tenant_no_tiene_hilos_vinculados 1 ;;" "  sin_hilos) ;;"
  mutante MD13 "no mira la bandeja del espejo" deshacer.sh sh "D6f D8" "D6a D6e" \
    "  otra_bandeja) mal un_hilo_del_tenant_no_es_de_esta_bandeja 1 ;;" "  otra_bandeja) ;;"
  mutante MD14 "DB con valor por defecto" deshacer.sh sh "D6g" "D6a D6h" \
    '[ -n "${DB:-}" ] || mal falta_db' 'DB="${DB:-dtd-cargo-db-1}"'
  mutante MD20 "acepta ceros a la izquierda" deshacer.sh sh "D10" "D6a" \
    "'' | 0[0-9]* | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;" "'' | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;"
  # El seco, la lista y CONFIRMAR (deshacer-carga.rb), con el escenario completo.
  mutante MD3 "borra el contacto que tiene otra bandeja" deshacer-carga.rb borrar "D2 D5" "D4" \
    "conservados = todos.select { |_, id| con_otra.include?(id) }.sort" "conservados = []"
  mutante MD4 "borra mensajes fuera de la bandeja" deshacer-carga.rb borrar "D5" "D2 D4" \
    "hecho('borrados_mensajes', mensajes.delete_all)" "hecho('borrados_mensajes', Message.where(account_id: @cuenta_id).delete_all)"
  # MD5 confirma el borrado ya en el seco: lo de después cae en cascada, y no se exige.
  mutante MD5 "el seco confirma lo que borra" deshacer-carga.rb borrar "D2" "" \
    "        escribir_conservados(conservados)
        raise ActiveRecord::Rollback" "        escribir_conservados(conservados)
        mensajes.delete_all"
  mutante MD6 "no compara la lista de conservados" deshacer-carga.rb borrar "D3" "D2" \
    "raise DeshacerError, 'la lista de conservados cambió desde el seco' unless leer_conservados == conservados" "leer_conservados"
  mutante MD7 "CONFIRMAR=no confirma" deshacer-carga.rb borrar "D4" "D2 D3" \
    "raise ActiveRecord::Rollback unless @confirmar == 'si'" "nil"
  # Los .hecho y la copia durable (la secuencia del DG y la (a) de Sam).
  mutante MD22 "CONFIRMAR=no escribe chatwoot-borrar.hecho" deshacer.sh borrar "D4" "D2 D5" \
    '[ "$MODO" = borrar ] && [ "$CONFIRMAR" = si ] && escribir_hecho_borrar' '[ "$MODO" = borrar ] && escribir_hecho_borrar'
  mutante MD30 "escribe chatwoot-borrar.hecho antes del COMMIT" deshacer.sh borrar "D15" "D2 D5" \
    '  copiar_durable "$C" "$H_SECO" "$H_ENSAYO"' '  copiar_durable "$C" "$H_SECO" "$H_ENSAYO"; escribir_hecho_borrar'
  # MD31 a MD33 (B1 de la #480): cada uno cae en su propio caso, y todo lo demás de su parte tiene que pasar.
  mutante MD32 "otro MODO=borrar no se niega con la evidencia de un borrado" deshacer.sh borrar "D17" "D2 D2b D9 D3 D4 D11a D11b D11c D5 D13 D14 D15 D7 F1" \
    'if [ -e "$DURABLE/chatwoot-borrar.hecho" ] || [ -e "$DURABLE/chatwoot-borrar.inicio" ] || [ -e "$H_BORRAR" ]; then' 'if false; then'
  mutante MD33 "no retira el .inicio con un ROLLBACK comprobado" deshacer.sh borrar "D15" "D2 D2b D9 D3 D4 D11a D11b D11c D5 D13 D14 D17 D7 F1" \
    '    rm -f -- "$DURABLE/chatwoot-borrar.inicio"' '    :'
  mutante MD31 "sin el .inicio antes de la transacción" deshacer.sh corte "D16 D17b" "" \
    '  escribir_hecho "$DURABLE/chatwoot-borrar.inicio"' '  : escribir_hecho "$DURABLE/chatwoot-borrar.inicio"'
  mutante MD24 "borra sin el ensayo de Studio" deshacer.sh borrar "D11a" "D2 D5" \
    '[ -s "$H_ENSAYO" ] || mal falta_studio_ensayo_hecho' ':'
  # MD25 y MD26 dejan pasar el borrado de D11b y D11c; la prueba recarga antes de D5, así que D5 tiene que pasar.
  mutante MD25 "no compara el sha256" deshacer.sh borrar "D11b" "D2 D5" \
    '[ "$sha_seco" = "$sha_actual" ] && [ "$sha_ensayo" = "$sha_actual" ] || mal el_sha256_de_los_conservados_no_coincide' ':'
  mutante MD26 "no compara el tenant de los .hecho" deshacer.sh borrar "D11c" "D2 D5" \
    '[ "$(campo "$H_SECO" tenant)" = "$TENANT" ] && [ "$(campo "$H_ENSAYO" tenant)" = "$TENANT" ] || mal el_tenant_de_los_hecho_no_coincide' ':'
  # MD27 crea la carpeta sin copiar los tres archivos: sin carpeta, el .inicio no se escribe y D5 aborta (bien), pero
  # el mutante tiene que caer solo en D14.
  mutante MD27 "sin la copia durable" deshacer.sh borrar "D14" "D2 D5" \
    '  copiar_durable "$C" "$H_SECO" "$H_ENSAYO"' '  install -d -m 0700 "$DURABLE"'
  mutante MD28 "la copia durable con permisos abiertos" deshacer.sh borrar "D14" "D2 D5" \
    'install -d -m 0700 "$DURABLE"' 'install -d -m 0755 "$DURABLE"'
  mutante MD21 "no mira el tenant de los conservados" deshacer-carga.rb borrar "D9" "D2" \
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
