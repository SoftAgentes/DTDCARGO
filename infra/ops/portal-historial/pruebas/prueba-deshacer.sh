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
#   D6j sin DB_CW (N4: tampoco tiene valor por defecto)
#   D18 el paso 3 con un ensayo de Studio sobre una copia (entorno=copia): se niega antes de escribir (B1 del DG)
#   D19a-g la huella SISTEMA de Studio en el paso 3 (B1 del DG, igual que la #480): sin el archivo 0600, de otro uid,
#          con dos saltos de línea, vacío, con otro sha corto, con el sha esperado pero otra base, SISTEMA en el
#          entorno. Todos se niegan antes de escribir nada, y el valor nunca se imprime
#   D18b el ensayo de Studio con la clave entorno repetida: no se lee la última ((b) del DG)
#   D19h un SISTEMA= vacío y exportado: el valor no llega exportado a docker (el patrón N1 de la #480)
#   D20-22 los pisos del seco (N1 y N3 del DG): la bandeja cambió desde el seco, lo borrado no cuadra con el seco
#          (lo que haría una conversación que entra a mitad del borrado), y un seco sin los conteos
#   D21b (carrera) N3 con caso propio: una conversación entra a la bandeja a mitad del borrado (un trigger); lo borrado
#          sobra y no confirma (revisión del DG sobre ff66d774f)
#   D23 los hilos cargados (N1, decisión del DG): el seco compara solo lo cargado; hC, que vinculó la cola, queda fuera
#   D24 (hilos) una conversación de la bandeja que no es un hilo de Studio: el seco se niega, sin archivo
#   R1-R10, A1-A9 (rb) las guardas de deshacer-carga.rb, de a una, con guardas-deshacer.rb (N2 del DG)
#   N10 (estático) DESHACER_SISTEMA, _SHA y _UID solo dentro del if DESHACER_PRUEBA ((a) del DG)
#   D2  seco: no borra nada y escribe contactos-conservados.ndjson (0600) con el contacto que tiene otra bandeja
#   D9  los conservados de otro tenant · D3 la lista cambió entre el seco y el borrado: abortan sin borrar
#   D4  borrar con CONFIRMAR=no: hace todo y termina en ROLLBACK; la bandeja queda igual
#   D5  borrar con CONFIRMAR=si: la bandeja queda vacía, el conservado sigue, los demás contactos dtd-portal: de la
#       carga se borran, la otra bandeja no cambia, el contenedor queda limpio y el archivo sigue (para Studio)
#   D7  (revisar-datos-ve, paso 3) las marcas de lo borrado no están en ninguna tabla de Chatwoot; lo conservado sí
#   F   ni nombres ni textos en las salidas, con su control
#   N9  cada caso de las listas tiene su resultado en la corrida real, con el nombre exacto
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
# SISTEMA (B1 del DG): el system_identifier de este Postgres de Studio, en un archivo 0600 de este usuario. Su sha corto,
# con la fórmula del DG, es el esperado de la prueba (DESHACER_SISTEMA_SHA, que vale solo con DESHACER_PRUEBA=1). El
# valor de mentira de la #480 (19 cifras, sha corto deb576f0d6) es «otra base»: pasa el sha corto si se lo dan como
# esperado, y la base lo rechaza (D19f).
SIS="$TRABAJO/sistema-produccion"
SISTEMA_VALOR="$(q "select system_identifier from pg_control_system()")"
( umask 077; printf '%s' "$SISTEMA_VALOR" >"$SIS" ); chmod 0600 "$SIS"
SIS_SHA="$(printf '%s' "$SISTEMA_VALOR" | sha256sum | cut -c1-10)"
FALSO_VALOR=7234567890123456789
FALSO_SHA="$(printf '%s' "$FALSO_VALOR" | sha256sum | cut -c1-10)"
U1="$(q "select md5('0523-sintetico-U1')::uuid")"
mkdir -p "$D/cargador" "$D/estado/shm"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$AQUI/sonda-pap.rb" "$AQUI/sonda-deshacer.rb" "$AQUI/guardas-deshacer.rb" "$D/cargador/"
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
    DESHACER_SISTEMA="$SIS" DESHACER_SISTEMA_SHA="$SIS_SHA" DESHACER_SISTEMA_UID="$(id -u)" "$@" bash "$carpeta/deshacer.sh" >"$sal" 2>&1
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
  # Después de un borrado (un mutante que lo deja pasar), la recarga crea las conversaciones de nuevo, con otro
  # display_id. Studio sigue con los viejos: se le ponen los nuevos al hilo y a su espejo, con el vinculos.ndjson de esta
  # recarga, para que el seco compare los hilos cargados de verdad (el rojo de la parte d del run 43017658601). Solo
  # arnés: en producción no hay recarga. hC (de la cola, 1100) no está en el archivo y no se toca.
  # La lista entra por el descriptor 3: q usa docker exec -i, que se comería la entrada del bucle y dejaría todo menos
  # el primer hilo sin actualizar (el rojo de ff66d774f, el mismo de la 2b).
  local linea hilo nuevo
  while IFS= read -r linea <&3; do
    hilo="$(printf '%s' "$linea" | sed -n 's/.*"hilo":"\([0-9a-f-]\{36\}\)".*/\1/p')"
    nuevo="$(printf '%s' "$linea" | sed -n 's/.*"conversacion_id":\([0-9]\{1,10\}\).*/\1/p')"
    [ -n "$hilo" ] && [ -n "$nuevo" ] || continue
    q "with h as (select chatwoot_conversation_id as viejo from public.chatwoot_portal_hilos where tenant_id = '$TENANT' and conversation_id = '$hilo')
       update public.chatwoot_conversations c set conversation_id = $nuevo from h
       where c.tenant_id = '$TENANT' and c.conversation_id = h.viejo and h.viejo <> $nuevo" </dev/null >/dev/null
    q "update public.chatwoot_portal_hilos set chatwoot_conversation_id = $nuevo
       where tenant_id = '$TENANT' and conversation_id = '$hilo' and chatwoot_conversation_id <> $nuevo" </dev/null >/dev/null
  done 3< <(grep '"tipo":"conversacion"' "$SHM/vinculos.ndjson")
  # Lo recableado se cuenta (revisión del DG sobre ff66d774f): cada conversación de la carga tiene que quedar con su
  # hilo de Studio, el display_id nuevo y el espejo en la bandeja. Si no da, la prueba se corta aquí, en vez de que el
  # seco siguiente se niegue y todo caiga «por otro camino».
  local n_vinc valores_r recableados
  n_vinc="$(grep -c '"tipo":"conversacion"' "$SHM/vinculos.ndjson")"
  valores_r="$(sed -n "s/.*\"hilo\":\"\([0-9a-f-]\{36\}\)\",\"conversacion_id\":\([0-9]\{1,10\}\).*/('\1'::uuid,\2)/p" "$SHM/vinculos.ndjson" | paste -sd, -)"
  recableados=0
  [ -n "$valores_r" ] && recableados="$(q "select count(*) from (values $valores_r) w (hilo, cid)
    join public.chatwoot_portal_hilos h on h.tenant_id = '$TENANT' and h.conversation_id = w.hilo and h.chatwoot_conversation_id = w.cid
    join public.chatwoot_conversations c on c.tenant_id = h.tenant_id and c.conversation_id = w.cid and c.inbox_id = $BANDEJA" </dev/null)"
  echo "HECHO recableados=$recableados de=$n_vinc" >>"$TRABAJO/recarga.txt"
  if [ "$n_vinc" -lt 1 ] || [ "$recableados" != "$n_vinc" ]; then
    mal R0 "la recarga no recableó los hilos de Studio ($recableados de $n_vinc conversaciones de la carga)"
    exit 1
  fi
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
  deshacer "$O/d6j.txt" "$K" seco DB_CW=
  rm -rf -- "$SHM"
}
# Las guardas de la huella y del entorno del paso 3 (B1 del DG), sin la carga: cada caso arma un .ndjson y los dos
# .hecho de mentira que cuadran entre sí. La cabecera dice un contacto y no trae ninguno, así que si un mutante deja
# pasar la guarda, el .rb aborta antes de borrar (la bandeja no cambia) y el caso cae porque se creó la durable.
sistema_caso() { # carpeta salida [VAR=valor...]: el paso 3 con los .hecho de mentira
  local K="$1" sal="$2" entorno="${ENTORNO_CASO:-produccion}" sha
  shift 2
  rm -rf -- "$SHM" "$TRABAJO/durable"
  install -d -m 0700 "$SHM"
  printf '{"tipo":"cabecera","version":1,"tenant_id":"%s","cuenta":%s,"bandeja":%s,"contactos":1}\n' "$TENANT" "$CUENTA" "$BANDEJA" >"$SHM/contactos-conservados.ndjson"
  sha="$(sha256sum "$SHM/contactos-conservados.ndjson" | cut -c1-64)"
  printf 'HECHO chatwoot_seco=ok conservados_sha256=%s tenant=%s cuenta=%s bandeja=%s utc=%s\n' "$sha" "$TENANT" "$CUENTA" "$BANDEJA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/chatwoot-seco.hecho"
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=%s fin=rollback utc=%s\n' "$sha" "$TENANT" "$entorno" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  chmod 0600 "$SHM"/*
  deshacer "$sal" "$K" borrar CONFIRMAR=si "$@"
  [ -e "$DUR" ] && echo "HECHO durable=si" >>"$sal"
  grep -qF -- "$SISTEMA_VALOR" "$sal" && echo "HECHO valor_impreso=si" >>"$sal"
  grep -qF -- "$FALSO_VALOR" "$sal" && echo "HECHO valor_impreso=si" >>"$sal"
  rm -rf -- "$SHM" "$TRABAJO/durable"
}
# N10, estático ((a) del DG): DESHACER_SISTEMA, _SHA y _UID aparecen solo dentro del if DESHACER_PRUEBA de deshacer.sh.
# D24: una conversación cargada con otro dtd_hilo; el seco se niega, y después se le devuelve el suyo.
parte_hilos() { # carpeta salidas
  local K="$1" O="$2"
  rm -rf -- "$SHM"
  sonda "$O/hilo-cambiado.txt" FASE=hilo-cambiado
  deshacer "$O/d24.txt" "$K" seco
  [ -e "$SHM/contactos-conservados.ndjson" ] && echo "HECHO archivo=si" >>"$O/d24.txt"
  rm -rf -- "$SHM"
  sonda "$O/hilo-restaurado.txt" FASE=hilo-restaurar "CONV=$(h "$O/hilo-cambiado.txt" conv)" "HILO=$(h "$O/hilo-cambiado.txt" hilo)"
}
# D21b: la carrera de N3, con su propio seco. Un trigger mete en la bandeja la conversación de la otra bandeja
# cuando se borran los mensajes: las conversaciones borradas sobran y el .rb no confirma. Después se quita el trigger.
parte_carrera() { # carpeta salidas
  local K="$1" O="$2" sha
  rm -rf -- "$SHM" "$TRABAJO/durable"
  deshacer "$O/carrera-seco.txt" "$K" seco
  sha="$(sha256sum "$SHM/contactos-conservados.ndjson" 2>/dev/null | cut -c1-64)"
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
    "$sha" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  chmod 0600 "$SHM/studio-ensayo.hecho"
  sonda "$O/trampa.txt" FASE=trampa-poner
  deshacer "$O/d21b.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/trampa-quitada.txt" FASE=trampa-quitar
  sonda "$O/contar-d21b.txt" FASE=contar
  rm -rf -- "$SHM" "$TRABAJO/durable"
}
parte_estatico() { # carpeta salidas
  local K="$1" O="$2" fuera dentro
  fuera="$(awk '$0 == "if [ \"${DESHACER_PRUEBA:-}\" = 1 ]; then" {d=1; next} d && $0 == "fi" {d=0; next} !d && !/^[[:space:]]*#/ && /DESHACER_SISTEMA/ {n++} END {print n+0}' "$K/deshacer.sh")"
  dentro="$(awk '$0 == "if [ \"${DESHACER_PRUEBA:-}\" = 1 ]; then" {d=1; next} d && $0 == "fi" {d=0; next} d && /DESHACER_SISTEMA/ {n++} END {print n+0}' "$K/deshacer.sh")"
  printf 'HECHO fuera=%s\nHECHO dentro=%s\n' "$fuera" "$dentro" >"$O/n10.txt"
}
# Las guardas de deshacer-carga.rb (N2 del DG), con la copia del .rb de esta carpeta (la real o la de un mutante).
parte_rb() { # carpeta salidas
  local K="$1" O="$2"
  cp "$K/deshacer-carga.rb" "$D/cargador/deshacer-carga-prueba.rb"
  rr "$O/rb.txt" "CUENTA=$CUENTA" "BANDEJA=$BANDEJA" "TENANT=$TENANT" GUION=/tmp/cargador/deshacer-carga-prueba.rb \
    -- /tmp/cargador/guardas-deshacer.rb </dev/null
}
parte_sistema() { # carpeta salidas
  local K="$1" O="$2" f="$TRABAJO/sistema-caso"
  ENTORNO_CASO=copia sistema_caso "$K" "$O/d18.txt"
  sistema_caso "$K" "$O/d19a.txt" "DESHACER_SISTEMA=$TRABAJO/no-existe"
  sistema_caso "$K" "$O/d19b.txt" DESHACER_SISTEMA_UID=12345
  ( umask 077; printf '%s\n\n' "$SISTEMA_VALOR" >"$f" ); chmod 0600 "$f"
  sistema_caso "$K" "$O/d19c.txt" "DESHACER_SISTEMA=$f"
  ( umask 077; : >"$f" ); chmod 0600 "$f"
  sistema_caso "$K" "$O/d19d.txt" "DESHACER_SISTEMA=$f"
  ( umask 077; printf '%s' "$FALSO_VALOR" >"$f" ); chmod 0600 "$f"
  sistema_caso "$K" "$O/d19e.txt" "DESHACER_SISTEMA=$f"
  sistema_caso "$K" "$O/d19f.txt" "DESHACER_SISTEMA=$f" "DESHACER_SISTEMA_SHA=$FALSO_SHA"
  sistema_caso "$K" "$O/d19g.txt" SISTEMA=123
  ENTORNO_CASO="copia entorno=produccion" sistema_caso "$K" "$O/d18b.txt"
  # D19h: un docker que anota si recibe SISTEMA con valor en su entorno, y después corre el real.
  mkdir -p "$TRABAJO/docker-mira-sistema"; rm -f -- "$TRABAJO/sistema-exportado"
  printf '#!/bin/sh\nenv | grep -q "^SISTEMA=." && echo si >>%s\nexec %s "$@"\n' "$TRABAJO/sistema-exportado" "$(command -v docker)" >"$TRABAJO/docker-mira-sistema/docker"
  chmod +x "$TRABAJO/docker-mira-sistema/docker"
  sistema_caso "$K" "$O/d19h.txt" SISTEMA= "PATH=$TRABAJO/docker-mira-sistema:$PATH"
  [ -s "$TRABAJO/sistema-exportado" ] && echo "HECHO sistema_exportado=si" >>"$O/d19h.txt"
  rm -f -- "$TRABAJO/sistema-exportado"
  rm -f -- "$f"
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
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
    "$(printf '%064d' 0)" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  deshacer "$O/d11b.txt" "$K" borrar CONFIRMAR=si
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
    "$sha" "$T2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  deshacer "$O/d11c.txt" "$K" borrar CONFIRMAR=si
  sonda "$O/contar-d11.txt" FASE=contar
  # D20 a D22, los pisos del seco (N1 y N3 del DG): con el ensayo de Studio válido y el seco cambiado. Un mutante que
  # deja pasar el borrado vacía la bandeja: la recarga de abajo lo arregla para D15 y D5.
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
    "$sha" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHM/studio-ensayo.hecho"
  chmod 0600 "$SHM/studio-ensayo.hecho"
  sed 's/ antes=[^ ]*/ antes=conversaciones:999,mensajes:999,contact_inboxes:999/' "$O/chatwoot-seco.hecho" >"$SHM/chatwoot-seco.hecho"
  deshacer "$O/d20.txt" "$K" borrar CONFIRMAR=si
  # D21 y D22 empiezan sin la evidencia de un borrado: si un mutante deja pasar el de D20 o el de D21 (MD48), su .hecho
  # y su .inicio no tumban el caso siguiente por ya_hay_un_borrado (el rojo de MD48 en el run 43017658601). En la
  # corrida real no hay nada que quitar: D20 y D21 exigen fin=rollback.
  rm -rf -- "$TRABAJO/durable" "$SHM/chatwoot-borrar.hecho"
  sed 's/ contactos_a_borrar=[^ ]*/ contactos_a_borrar=999/' "$O/chatwoot-seco.hecho" >"$SHM/chatwoot-seco.hecho"
  deshacer "$O/d21.txt" "$K" borrar CONFIRMAR=si
  rm -rf -- "$TRABAJO/durable" "$SHM/chatwoot-borrar.hecho"
  sed 's/ antes=[^ ]*//; s/ contactos_a_borrar=[^ ]*//' "$O/chatwoot-seco.hecho" >"$SHM/chatwoot-seco.hecho"
  deshacer "$O/d22.txt" "$K" borrar CONFIRMAR=si
  install -m 0600 "$O/chatwoot-seco.hecho" "$SHM/chatwoot-seco.hecho"
  rm -f -- "$SHM/chatwoot-borrar.hecho"
  # D11c mira el conteo de antes de D20 a D22: un borrado que deja pasar MD49 en D22 no lo tumba (el rojo de MD49 en la
  # parte d del run 43017658601). La recarga mira este otro, después de D22.
  sonda "$O/contar-d22.txt" FASE=contar
  # Un mutante que deja pasar el borrado de D11b o D11c (MD25, MD26) vacía la bandeja: se recarga, para que D5 mida de
  # verdad y no caiga en cascada. En la corrida real la bandeja sigue llena (D11c lo exige) y no se recarga nada.
  if [ "$(h "$O/contar-d22.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ]; then
    # recargar borra /dev/shm/portal-historial: el .ndjson y los .hecho del seco y del ensayo se guardan y se devuelven.
    rm -rf -- "$O/shm-guardado" && cp -a "$SHM" "$O/shm-guardado"
    # El chatwoot-borrar.hecho que dejó el borrado colado no es del seco ni del ensayo: no se devuelve (si no, la guarda
    # de la evidencia niega D15 y D5, el rojo del run 42618396536). En la corrida real D4 y D15 ya exigen que no exista.
    rm -f -- "$O/shm-guardado/chatwoot-borrar.hecho"
    recargar
    rm -rf -- "$SHM" && cp -a "$O/shm-guardado" "$SHM"
    echo "HECHO recargado_antes_de_d5=si" >>"$O/contar-d22.txt"
  fi
  # D15 empieza sin la evidencia de un borrado: ni la durable ni chatwoot-borrar.hecho en tmpfs. En la corrida real no
  # hay nada que quitar: D4 y D15 ya exigen que no exista.
  rm -rf -- "$TRABAJO/durable" "$SHM/chatwoot-borrar.hecho"
  # El ensayo de Studio (paso 2), como lo escribe E10, con el sha256 del .ndjson del seco.
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
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
  printf 'HECHO studio_ensayo=ok conservados_sha256=%s tenant=%s entorno=produccion fin=rollback utc=%s\n' \
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
    sistema) parte_sistema "$1" "$2" ;;
    estatico) parte_estatico "$1" "$2" ;;
    rb) parte_rb "$1" "$2" ;;
    hilos) parte_hilos "$1" "$2" ;;
    carrera) parte_carrera "$1" "$2" ;;
    ajeno) parte_ajeno "$1" "$2" ;;
    borrar) parte_borrar "$1" "$2" ;;
    corte) parte_corte "$1" "$2" ;;
    completo) parte_estatico "$1" "$2"; parte_rb "$1" "$2"; parte_sh "$1" "$2"; parte_sistema "$1" "$2"; parte_hilos "$1" "$2"; parte_carrera "$1" "$2"; parte_ajeno "$1" "$2"; parte_borrar "$1" "$2"; parte_corte "$1" "$2" ;;
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
  exigir D6j '[ "$(h "$O/d6j.txt" salida_proceso)" = 2 ] && [ "$(err "$O/d6j.txt")" = falta_db_cw ]' \
    "sin DB_CW, no corre: no hay valor por defecto ($(err "$O/d6j.txt"))"
}
comprobar_carrera() {
  local O="$1" F="$1/d21b.txt"
  exigir D21b '[ "$(h "$F" salida_proceso)" = 1 ] && [ "$(err "$F")" = "lo borrado no cuadra con el seco" ] && [ "$(h "$F" fin)" = rollback ] && [ "$(h "$O/trampa.txt" trampa)" = ok ] && [ "$(h "$O/trampa-quitada.txt" trampa_quitada)" = ok ] && [ "$(h "$O/contar-d21b.txt" bandeja)" = "$(h "$O/carrera-seco.txt" antes)" ]' \
    "una conversación que entra a mitad del borrado: sobra en lo borrado ($(h "$F" borrados_conversaciones) de $(h "$O/carrera-seco.txt" antes)) y no confirma ($(err "$F"), fin=$(h "$F" fin))"
}
comprobar_hilos() {
  # La carpeta en O: dentro de exigir, el eval lee $1 como el id del caso (el rojo de D24 en el run 43017658601).
  local O="$1" F="$1/d24.txt"
  exigir D24 '[ "$(h "$F" salida_proceso)" = 1 ] && [ "$(err "$F")" = las_conversaciones_no_son_los_hilos_cargados ] && [ -z "$(h "$F" archivo)" ] && [ "$(h "$O/hilo-restaurado.txt" hilo_restaurado)" = ok ]' \
    "una conversación de la bandeja que no es un hilo de Studio: el seco se niega, sin archivo ($(err "$F"); cargados $(h "$F" hilos_cargados))"
}
comprobar_rb() {
  local F="$1/rb.txt" c id esperado
  for c in "R1:la bandeja no existe en esa cuenta" "R2:la bandeja no es de canal API" "R3:la bandeja tiene webhook_url" \
           "R4:la bandeja no es «Conversaciones del portal»" "R5:otra carga o deshacer del portal en curso" \
           "R6:un contact_inbox de la bandeja es de un contacto de otra cuenta" \
           "R7:un contacto de la bandeja no es dtd-portal:<uuid>" "R8:los conservados no traen cabecera" \
           "R9:los conservados traen un tipo desconocido" "R10:la cabecera de los conservados no cuadra con las líneas" \
           "A1:ajeno actividad=1" "A2:ajeno actividad=1" "A3:ajeno actividad=1" "A4:ajeno actividad=1" "A5:ajeno actividad=1" \
           "A6:ajeno actividad=1" "A7:ajeno actividad=1" "A8:ajeno actividad=1" "A9:ajeno actividad=1"; do
    id="${c%%:*}"; esperado="${c#*:}"
    exigir "$id" '[ "$(h "$F" "caso_$id")" = "$esperado" ] && [ "$(h "$F" guardas)" = ok ]' \
      "la guarda de deshacer-carga.rb ($id): $(h "$F" "caso_$id")"
  done
}
comprobar_estatico() {
  local F="$1/n10.txt"
  exigir N10 '[ "$(h "$F" fuera)" = 0 ] && [ "$(h "$F" dentro)" = 3 ]' \
    "DESHACER_SISTEMA, _SHA y _UID solo dentro del if DESHACER_PRUEBA ($(h "$F" dentro) dentro, $(h "$F" fuera) fuera)"
}
comprobar_sistema() {
  local O="$1" c e s F
  # caso:código:error, todos sin durable y sin el valor impreso.
  for c in d18:2:el_ensayo_de_studio_no_es_de_produccion d19a:2:sin_archivo_de_sistema_0600 \
           d19b:2:archivo_de_sistema_no_es_de_root d19c:2:archivo_de_sistema_no_es_un_numero \
           d19d:2:archivo_de_sistema_no_es_un_numero d19e:2:sistema_no_es_el_de_produccion \
           d19g:2:sistema_va_en_el_archivo_no_en_el_entorno d18b:2:el_ensayo_de_studio_no_es_de_produccion; do
    c="${c#d}"; F="$O/d${c%%:*}.txt"; s="${c#*:}"; s="${s%%:*}"; e="${c##*:}"
    # El id es D más el resto: tr d D cambiaba todas las d (d19d daba D19D, el rojo de MD38 en el job 129292212612).
    exigir "D${c%%:*}" '[ "$(h "$F" salida_proceso)" = "$s" ] && [ "$(err "$F")" = "$e" ] && [ -z "$(h "$F" durable)" ] && [ -z "$(h "$F" valor_impreso)" ]' \
      "el paso 3 se niega antes de escribir ($(err "$F"), salida $(h "$F" salida_proceso)), sin copia durable y sin imprimir el valor"
  done
  # D19h: llegó a la huella (la base dijo si) y docker no recibió SISTEMA exportado.
  F="$O/d19h.txt"
  exigir D19h '[ "$(h "$F" studio_es_produccion)" = si ] && [ -z "$(h "$F" sistema_exportado)" ] && [ -z "$(h "$F" valor_impreso)" ]' \
    "un SISTEMA= vacío y exportado: llega a la huella ($(h "$F" studio_es_produccion)) y el valor no sale exportado a docker (exportado: $(h "$F" sistema_exportado))"
  # D19f, además: el sha corto que imprime es el del valor con printf (la fórmula del DG), y la base lo rechazó.
  F="$O/d19f.txt"
  exigir D19f '[ "$(h "$F" salida_proceso)" = 1 ] && [ "$(err "$F")" = la_base_de_studio_no_es_la_de_produccion ] && [ "$(h "$F" sistema_sha256_corto)" = "$FALSO_SHA" ] && [ "$(h "$F" studio_es_produccion)" = no ] && [ -z "$(h "$F" durable)" ] && [ -z "$(h "$F" valor_impreso)" ]' \
    "con el sha corto esperado pero otra base: imprime el sha con printf ($(h "$F" sistema_sha256_corto)), la base dice $(h "$F" studio_es_produccion) y se niega sin escribir"
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
  exigir D2b '[ "$(h "$O/d2.txt" permiso_hecho)" = 600 ] && grep -q "^HECHO chatwoot_seco=ok " "$F" && [ "$(H "$F" conservados_sha256)" = "$sha" ] && [ "$(H "$F" tenant)" = "$TENANT" ] && [ "$(H "$F" cuenta)" = "$CUENTA" ] && [ "$(H "$F" bandeja)" = "$BANDEJA" ] && [ "$(H "$F" antes)" = "$(h "$O/d2.txt" antes)" ] && [ "$(H "$F" contactos_a_borrar)" = "$(h "$O/d2.txt" contactos_a_borrar)" ] && [ "$(wc -l <"$F")" = 1 ]' \
    "el seco escribe chatwoot-seco.hecho en 0600, con el sha256 del .ndjson, el tenant, la cuenta, la bandeja y sus conteos ($(H "$F" antes), $(H "$F" contactos_a_borrar) a borrar)"
  local conv_d2; conv_d2="$(h "$O/d2.txt" antes)"; conv_d2="${conv_d2#conversaciones:}"; conv_d2="${conv_d2%%,*}"
  exigir D23 '[ -n "$conv_d2" ] && [ "$(h "$O/d2.txt" hilos_cargados)" = "$conv_d2" ] && [ "$(h "$O/d2.txt" hilos_del_tenant)" -gt "$conv_d2" ] && [ "$(H "$O/chatwoot-seco.hecho" hilos_cargados)" = "$conv_d2" ]' \
    "el seco compara solo los hilos cargados: $(h "$O/d2.txt" hilos_cargados) de $conv_d2 conversaciones; el tenant tiene $(h "$O/d2.txt" hilos_del_tenant) (hC, de la cola, queda fuera)"
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
  exigir D20 '[ "$(h "$O/d20.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d20.txt")" = "la bandeja cambió desde el seco" ] && [ "$(h "$O/d20.txt" fin)" = rollback ]' \
    "la bandeja no es la que contó el seco: no borra ($(err "$O/d20.txt"), fin=$(h "$O/d20.txt" fin))"
  exigir D21 '[ "$(h "$O/d21.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d21.txt")" = "lo borrado no cuadra con el seco" ] && [ "$(h "$O/d21.txt" fin)" = rollback ]' \
    "lo borrado no es lo que contó el seco (una conversación que entra a mitad del borrado): no confirma ($(err "$O/d21.txt"), fin=$(h "$O/d21.txt" fin))"
  exigir D22 '[ "$(h "$O/d22.txt" salida_proceso)" = 1 ] && [ "$(err "$O/d22.txt")" = "el seco no trae los conteos" ]' \
    "un seco sin los conteos no habilita el paso 3 ($(err "$O/d22.txt"))"
  F="$O/d15.txt"
  exigir D15 '[ "$(h "$F" salida_proceso)" = 1 ] && grep -q "^HECHO error=algo ajeno en la bandeja" "$F" && [ -z "$(h "$F" hecho_sin_commit)" ] && [ "$(h "$F" durable_d15)" = "chatwoot-seco.hecho,contactos-conservados.ndjson,studio-ensayo.hecho," ]' \
    "el borrado aborta antes del COMMIT: sin chatwoot-borrar.hecho en ninguna carpeta, y la copia durable con el .ndjson y los dos .hecho ($(h "$F" durable_d15))"
  F="$O/d5.txt"
  exigir D5 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" confirmado)" = si ] && [ "$(h "$O/contar-d5.txt" bandeja)" = "conversaciones:0,mensajes:0,contact_inboxes:0" ] && [ "$(h "$O/contar-d5.txt" contactos_dtd)" = 1 ] && [ "$(h "$O/contar-d5.txt" otra)" = "$(h "$O/contar-antes.txt" otra)" ] && [ "$(h "$F" limpio_desde_afuera)" = si ] && [ "$(h "$F" contenedor_limpio)" = si ] && [ "$(h "$F" archivo_despues)" = si ] && [ "$(h "$F" sistema_sha256_corto)" = "$SIS_SHA" ] && [ "$(h "$F" studio_es_produccion)" = si ] && ! grep -qF -- "$SISTEMA_VALOR" "$F"' \
    "CONFIRMAR=si: la huella de Studio es la esperada ($(h "$F" sistema_sha256_corto), $(h "$F" studio_es_produccion)); la bandeja vacía, queda solo el contacto conservado ($(h "$O/contar-d5.txt" contactos_dtd)), la otra bandeja igual ($(h "$O/contar-d5.txt" otra)), el contenedor limpio y el .ndjson sigue para Studio"
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
    sistema) comprobar_sistema "$1" ;;
    estatico) comprobar_estatico "$1" ;;
    rb) comprobar_rb "$1" ;;
    hilos) comprobar_hilos "$1" ;;
    carrera) comprobar_carrera "$1" ;;
    ajeno) comprobar_ajeno "$1" ;;
    borrar) comprobar_borrar "$1" ;;
    corte) comprobar_corte "$1" ;;
    completo) comprobar_estatico "$1"; comprobar_rb "$1"; comprobar_sh "$1"; comprobar_sistema "$1"; comprobar_hilos "$1"; comprobar_carrera "$1"; comprobar_ajeno "$1"; comprobar_borrar "$1"; comprobar_corte "$1" ;;
  esac
  return 0
}

PARTE="${PARTE:-todo}"
case "$PARTE" in todo | a | b | c | d) ;; *) echo "PARTE tiene que ser a, b, c, d o todo"; exit 2 ;; esac
en_parte() { # id del mutante: ¿corre en esta parte?
  local suya=a
  case "$1" in
    # La parte b tardó 54 min de 60 (job 129163939032 y run 42628321142): MD27, MD28 y MD30 (unos 4 min cada uno) pasan
    # a la parte a, que tardaba 28. Corren igual sobre el escenario del borrado.
    MD5 | MD6 | MD7 | MD21 | MD22 | MD24 | MD25 | MD26 | MD44 | MD45 | MD46 | MD47 | MD69) suya=b ;;
    # La parte d (N1 a N3 del DG): los mutantes de las guardas del .rb (modo rb, sin la carga), MD49 y MD30, que sale
    # de la a para que la a no pase de ~55 min con los casos nuevos de la corrida real.
    # MD32 y MD33 también: cada mutante del borrado suma D20 a D22 (~1 min), y la b se acercaba a 55.
    MD30 | MD32 | MD33 | MD49 | MD5[0-9] | MD6[0-8]) suya=d ;;
    # B1 del DG: los mutantes de la huella (sin la carga, unos 1 a 2 min) se reparten entre la a y la c.
    MD1 | MD2 | MD15 | MD16 | MD17 | MD18 | MD19 | MD31 | MD39 | MD40 | MD41 | MD42 | MD48 | MD70 | MD71) suya=c ;;
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
CASOS_SH="D6a D6b D6c D6d D6i D6e D6f D8 D6g D6h D10 D6j"
CASOS_SISTEMA="D18 D18b D19a D19b D19c D19d D19e D19f D19g D19h"
CASOS_ESTATICO="N10"
CASOS_AJENO="D1a D1b D1c D1d D1e D1f D1g"
CASOS_HILOS="D24"
CASOS_CARRERA="D21b"
CASOS_BORRAR="D2 D2b D23 D9 D3 D4 D11a D11b D11c D20 D21 D22 D5 D13 D14 D15 D17 D7 F1"
CASOS_RB="R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 A1 A2 A3 A4 A5 A6 A7 A8 A9"
CASOS_CORTE="D16 D17b"
corre_en() {
  case " $CASOS_SH " in *" $1 "*) echo sh; return ;; esac
  case " $CASOS_SISTEMA " in *" $1 "*) echo sistema; return ;; esac
  case " $CASOS_ESTATICO " in *" $1 "*) echo estatico; return ;; esac
  case " $CASOS_RB " in *" $1 "*) echo rb; return ;; esac
  case " $CASOS_HILOS " in *" $1 "*) echo hilos; return ;; esac
  case " $CASOS_CARRERA " in *" $1 "*) echo carrera; return ;; esac
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
  # El modo rb arma sus propias filas, dentro de una transacción que termina en ROLLBACK: no necesita la carga.
  case "$modo" in sh | sistema | estatico | rb) ;; *) recargar ;; esac
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
      *)
        # (c) del DG: un caso de «pasan» que corre en este modo y no tiene resultado también se marca.
        if [ "$(corre_en "$c")" = "no existe" ]; then otro="$otro $c(no existe)"
        elif [ "$modo" = completo ] || [ "$(corre_en "$c")" = "$modo" ]; then otro="$otro $c(sin resultado)"; fi ;;
    esac
  done
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que ($modo): tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: $(cayeron_en)"
}
# N9: cada caso de las listas tiene su resultado en la corrida real, con el nombre exacto. Un id mal armado (el D19D
# del job 129292212612) cae aquí, y no como un mutante que «sobrevive».
if [ "$PARTE" = a ] || [ "$PARTE" = todo ]; then
  sin_resultado=""
  for c in $CASOS_ESTATICO $CASOS_RB $CASOS_HILOS $CASOS_CARRERA $CASOS_SH $CASOS_SISTEMA $CASOS_AJENO $CASOS_BORRAR $CASOS_CORTE; do [ -n "${RES[$c]:-}" ] || sin_resultado="$sin_resultado $c"; done
  exigir N9 '[ -z "$sin_resultado" ]' "cada caso de las listas tiene su resultado con el nombre exacto (sin resultado:${sin_resultado:- ninguno})"
fi
if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes"
  mutante MD0 "control: los guiones sin cambios, sobre una carga nueva" deshacer-carga.rb completo "" \
    "D1a D1b D1c D1d D1e D1f D1g D2 D2b D3 D4 D5 D6a D6b D6c D6d D6e D6f D6g D6h D6i D6j D7 D8 D9 D10 D11a D11b D11c D13 D14 D15 D16 D17 D17b D18 D18b D19a D19b D19c D19d D19e D19f D19g D19h N10 D20 D21 D21b D22 D23 D24 R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 A1 A2 A3 A4 A5 A6 A7 A8 A9 F1" "require 'set'" "require 'set'"
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
  mutante MD43 "DB_CW con valor por defecto" deshacer.sh sh "D6j" "D6a D6g" \
    '[ -n "$DB_CW" ] || mal falta_db_cw' 'DB_CW="${DB_CW:-chatwoot-rails-1}"'
  S_TODOS="D18 D18b D19a D19b D19c D19d D19e D19f D19g D19h"
  sin() { local x y out="" fuera; for x in $S_TODOS; do fuera=0; for y in "$@"; do [ "$x" = "$y" ] && fuera=1; done; [ "$fuera" = 1 ] || out="$out $x"; done; echo "${out# }"; }
  mutante MD34 "el paso 3 no mira el entorno del ensayo de Studio" deshacer.sh sistema "D18 D18b" "$(sin D18 D18b)" \
    '[ "$(campo "$H_ENSAYO" entorno)" = produccion ] || mal el_ensayo_de_studio_no_es_de_produccion' ':'
  mutante MD35 "acepta un archivo de SISTEMA que no está en 0600" deshacer.sh sistema "D19a" "$(sin D19a)" \
    '[ -f "$f" ] && [ ! -L "$f" ] && [ -O "$f" ] && [ "$(stat -c %a "$f")" = 600 ] || { echo "HECHO error=sin_archivo_de_sistema_0600" >&2; return 1; }' ':'
  mutante MD36 "acepta un archivo de SISTEMA de otro uid" deshacer.sh sistema "D19b" "$(sin D19b)" \
    '[ "$(stat -c %u "$f")" = "$SISTEMA_UID" ] || { echo "HECHO error=archivo_de_sistema_no_es_de_root" >&2; return 1; }' ':'
  mutante MD37 "no cuenta los saltos de línea del archivo de SISTEMA" deshacer.sh sistema "D19c" "$(sin D19c)" \
    "[ \"\$(LC_ALL=C tr -d '0-9\\n' < \"\$f\" | wc -c)\" -eq 0 ] && [ \"\$(LC_ALL=C tr -cd '\\n' < \"\$f\" | wc -c)\" -le 1 ] || { echo \"HECHO error=archivo_de_sistema_no_es_un_numero\" >&2; return 1; }" ':'
  mutante MD38 "acepta un archivo de SISTEMA vacío" deshacer.sh sistema "D19d" "$(sin D19d)" \
    "case \"\$v\" in ''|*[!0-9]*) echo \"HECHO error=archivo_de_sistema_no_es_un_numero\" >&2; return 1 ;; esac" ':'
  mutante MD39 "no compara el sha corto con el esperado" deshacer.sh sistema "D19e" "$(sin D19e)" \
    '[ "$(sha_corto "$SISTEMA")" = "$SISTEMA_SHA_ESPERADO" ] || { echo "HECHO sistema_esperado=$SISTEMA_SHA_ESPERADO"; mal sistema_no_es_el_de_produccion; }' ':'
  mutante MD40 "no compara SISTEMA con la base de Studio" deshacer.sh sistema "D19f" "$(sin D19f)" \
    '[ "$huella" = si ] || mal la_base_de_studio_no_es_la_de_produccion 1' ':'
  mutante MD41 "acepta SISTEMA en el entorno" deshacer.sh sistema "D19g" "$(sin D19g)" \
    '[ -z "${SISTEMA:-}" ] || mal sistema_va_en_el_archivo_no_en_el_entorno' ':'
  mutante MD42 "el sha corto con echo (con salto de línea)" deshacer.sh sistema "D19f D19h" "$(sin D19f D19h)" \
    "sha_corto() { printf '%s' \"\$1\" | sha256sum | cut -c1-10; }" "sha_corto() { echo \"\$1\" | sha256sum | cut -c1-10; }"
  # D19h llega a la huella, así que el sha con echo también lo tumba (MD42, arriba). Los de esta vuelta, en la parte b.
  mutante MD44 "sin el unset de SISTEMA" deshacer.sh sistema "D19h" "$(sin D19h)" \
    'unset SISTEMA' ':'
  mutante MD45 "DESHACER_SISTEMA_SHA fuera del if DESHACER_PRUEBA" deshacer.sh estatico "N10" "" \
    'SISTEMA_SHA_ESPERADO=b4fbe1b236' 'SISTEMA_SHA_ESPERADO="${DESHACER_SISTEMA_SHA:-b4fbe1b236}"'
  mutante MD46 "campo() se queda con la última clave repetida" deshacer.sh sistema "D18b" "$(sin D18b)" \
    '[ "$(grep -o " $2=" "$1" 2>/dev/null | wc -l)" = 1 ] || return 0; ' ''
  # N1 y N3 del DG: los pisos del seco.
  B_TODOS="D2 D2b D23 D9 D3 D4 D11a D11b D11c D20 D21 D22 D5 D13 D14 D15 D17 D7 F1"
  sin_b() { local x y out="" fuera; for x in $B_TODOS; do fuera=0; for y in "$@"; do [ "$x" = "$y" ] && fuera=1; done; [ "$fuera" = 1 ] || out="$out $x"; done; echo "${out# }"; }
  mutante MD47 "no compara la bandeja con la del seco" deshacer-carga.rb borrar "D20" "$(sin_b D20)" \
    "      raise DeshacerError, 'la bandeja cambió desde el seco' if @modo == 'borrar' && @pisos && antes != @esperado_antes" ''
  mutante MD48 "no compara lo borrado con el seco" deshacer-carga.rb borrar "D21" "$(sin_b D21)" \
    "        raise DeshacerError, 'lo borrado no cuadra con el seco' unless borrados == [msg, conv, ci, Integer(@esperado_contactos, 10)]" ''
  mutante MD49 "CONFIRMAR=si sin los conteos del seco" deshacer-carga.rb borrar "D22" "$(sin_b D22)" \
    "      raise DeshacerError, 'el seco no trae los conteos' if @confirmar == 'si' && !@pisos" ''
  # Los hilos cargados (N1, decisión del DG). MD69 cuenta todos los hilos del tenant, hC incluido: el seco se niega y
  # cae todo lo de después (como MD5), así que solo se exige D2 y D23.
  mutante MD69 "cuenta también los hilos de la cola" deshacer.sh borrar "D2 D23" "" \
    "  sql_cargados=\"select count(*) from (values \$valores) w (hilo, cid) join public.chatwoot_portal_hilos h on h.tenant_id = :'tenant' and h.conversation_id = w.hilo and h.chatwoot_conversation_id = w.cid join public.chatwoot_conversations c on c.tenant_id = h.tenant_id and c.conversation_id = h.chatwoot_conversation_id and c.inbox_id = :bandeja;\"" \
    "  sql_cargados=\"select count(*) from public.chatwoot_portal_hilos h where h.tenant_id = :'tenant';\""
  mutante MD70 "no compara las conversaciones con los hilos" deshacer.sh hilos "D24" "" \
    '[ "$cargados" = "$lineas_hilo" ] && [ "$lineas_hilo" = "$conv_antes" ] || mal las_conversaciones_no_son_los_hilos_cargados 1' ':'
  # N3 con caso propio (revisión del DG sobre ff66d774f): sin las conversaciones en la comparación, la carrera confirma.
  mutante MD71 "no compara las conversaciones borradas con el seco" deshacer-carga.rb carrera "D21b" "" \
    "unless borrados == [msg, conv, ci, Integer(@esperado_contactos, 10)]" "unless borrados.values_at(0, 2, 3) == [msg, ci, Integer(@esperado_contactos, 10)]"
  # N2 del DG: las guardas de deshacer-carga.rb, de a una (modo rb).
  R_TODOS="R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 A1 A2 A3 A4 A5 A6 A7 A8 A9"
  sin_r() { local x out=""; for x in $R_TODOS; do [ "$x" = "$1" ] || out="$out $x"; done; echo "${out# }"; }
  mutante_rb() { mutante "$1" "$2" deshacer-carga.rb rb "$3" "$(sin_r "$3")" "$4" ''; }
  mutante_rb MD50 "no mira que la bandeja exista" R1 "    raise DeshacerError, 'la bandeja no existe en esa cuenta' unless bandeja"
  mutante_rb MD51 "no mira el canal API" R2 "    raise DeshacerError, 'la bandeja no es de canal API' unless bandeja.channel_type == 'Channel::Api'"
  mutante_rb MD52 "no mira el webhook_url" R3 "    raise DeshacerError, 'la bandeja tiene webhook_url' if bandeja.channel.webhook_url.present?"
  mutante_rb MD53 "no mira el nombre de la bandeja" R4 "    raise DeshacerError, 'la bandeja no es «Conversaciones del portal»' unless bandeja.name == NOMBRE_BANDEJA"
  mutante_rb MD54 "no respeta el candado" R5 "      raise DeshacerError, 'otra carga o deshacer del portal en curso' unless libre == true || libre == 't'"
  mutante_rb MD55 "acepta un contacto de otra cuenta" R6 "    raise DeshacerError, 'un contact_inbox de la bandeja es de un contacto de otra cuenta' unless filas.all? { |_, cuenta, _| cuenta == @cuenta_id }"
  mutante_rb MD56 "acepta un contacto sin dtd-portal:" R7 "      raise DeshacerError, 'un contacto de la bandeja no es dtd-portal:<uuid>' unless identifier.to_s.start_with?(PREFIJO_CONTACTO) && ident.match?(UUID)"
  mutante_rb MD57 "acepta los conservados sin cabecera" R8 "    raise DeshacerError, 'los conservados no traen cabecera' unless cab && cab['tipo'] == 'cabecera' && cab['version'] == 1"
  mutante_rb MD58 "acepta un tipo desconocido" R9 "    raise DeshacerError, 'los conservados traen un tipo desconocido' unless filas.all? { |l| l['tipo'] == 'contacto' }"
  mutante_rb MD59 "no compara la cabecera con las líneas" R10 "    raise DeshacerError, 'la cabecera de los conservados no cuadra con las líneas' unless cab['contactos'] == filas.size"
  mutante_rb MD60 "no mira attachments" A1 "    %w[attachments message_id mensajes],"
  mutante_rb MD61 "no mira mentions" A2 "    %w[mentions conversation_id conversaciones],"
  mutante_rb MD62 "no mira conversation_participants" A3 "    %w[conversation_participants conversation_id conversaciones],"
  mutante_rb MD63 "no mira reporting_events" A4 "    %w[reporting_events conversation_id conversaciones],"
  mutante_rb MD64 "no mira csat_survey_responses" A5 "    %w[csat_survey_responses conversation_id conversaciones],"
  mutante_rb MD65 "no mira notifications" A6 "    %w[notifications primary_actor_type Conversation primary_actor_id conversaciones],"
  mutante_rb MD66 "no mira las etiquetas de las conversaciones" A7 "    %w[taggings taggable_type Conversation taggable_id conversaciones],"
  mutante_rb MD67 "no mira las etiquetas de los contactos" A8 "    %w[taggings taggable_type Contact taggable_id contactos],"
  mutante_rb MD68 "no mira los adjuntos de los contactos" A9 "    %w[active_storage_attachments record_type Contact record_id contactos],"
  mutante MD20 "acepta ceros a la izquierda" deshacer.sh sh "D10" "D6a" \
    "'' | 0[0-9]* | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;" "'' | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;;"
  # El seco, la lista y CONFIRMAR (deshacer-carga.rb), con el escenario completo.
  mutante MD3 "borra el contacto que tiene otra bandeja" deshacer-carga.rb borrar "D2 D5" "D4" \
    "conservados = todos.select { |_, id| con_otra.include?(id) }.sort" "conservados = []"
  mutante MD4 "borra mensajes fuera de la bandeja" deshacer-carga.rb borrar "D5" "D2 D4" \
    "borrados = [mensajes.delete_all," "borrados = [Message.where(account_id: @cuenta_id).delete_all,"
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
