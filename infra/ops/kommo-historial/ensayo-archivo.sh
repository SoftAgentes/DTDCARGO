#!/usr/bin/env bash
# infra/ops/kommo-historial/ensayo-archivo.sh — ENSAYO del Archivo Kommo (SDD-0590 paso 5.6, plan A aprobado por el
# Director General el 2026-11-06 dentro del OK de Sam). Corre en el VPS, como root.
#
# Copia la base de Chatwoot de producción a un stack EFÍMERO y AISLADO (proyecto chatwoot-ensayo, todo en
# /dev/shm/cw-ensayo), carga ahí el archivo de carga con el cargador real y mide E-1 a E-11 con datos reales.
# Producción solo se lee (pg_dump en solo lectura). Al terminar, o si algo falla, borra el stack y la carpeta.
#
#   CARGA=/dev/shm/kommo-e5-carga/carga.ndjson \
#   INFORME_CARGA=/dev/shm/kommo-e5-carga/carga-informe.json \
#   INFORME_VINCULO=/dev/shm/kommo-e5-carga/vinculo-informe.json \
#   STAGING=/dev/shm/kommo-e5-carga \                       # 5.5b: de ahí salen los adjuntos en claro
#   BUSQUEDA_DIAS=1540 \                                    # la ventana de búsqueda que se ensaya (por defecto 1540)
#     bash ensayo-archivo.sh            # el ensayo
#     bash ensayo-archivo.sh --limpiar  # solo borra un ensayo que haya quedado (con las mismas guardas)
#
# Guardas (pedidas por el Director General, cada una se mide):
#   1. Aislamiento: red propia `internal: true`, sin puertos publicados, contenedores con nombre propio. Antes de
#      cargar se comprueba que ningún contenedor del ensayo está en una red de producción, que desde el ensayo no
#      se resuelven chatwoot-postgres-1 ni chatwoot-redis-1, y que no hay salida a internet.
#   2. El borrado no toca producción: `-p chatwoot-ensayo` fijo (nunca «chatwoot»), solo la ruta exacta
#      /dev/shm/cw-ensayo, y solo si este guion los creó (o con --limpiar).
#   3. Los inicializadores de /srv/chatwoot/rails se montan en solo lectura (SDD-0590 §10.10: qué hace cada uno).
#   4. pg_dump con un rol de solo lectura si existe; si no, con default_transaction_read_only=on. Se anotan bytes
#      y sha256 corto, y el dump se borra apenas restaurado.
#   5. Si la carga del VPS pasa de TOPE_CARGA (8), se para.
#
# Salida: PASÓ/FALLÓ por comprobación. La evidencia (EVIDENCIA) guarda solo líneas HECHO: conteos y huellas.
set -uo pipefail

LIMPIAR_SOLO=0
for a in "$@"; do
  case "$a" in --limpiar) LIMPIAR_SOLO=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

# Fijos: no se toman del entorno.
readonly PROYECTO=chatwoot-ensayo
readonly DIR=/dev/shm/cw-ensayo
readonly RED="${PROYECTO}_aislada"

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUENTA="${CUENTA:-1}"
CHATWOOT_DIR="${CHATWOOT_DIR:-/srv/chatwoot}"
PROD_PROYECTO="${PROD_PROYECTO:-chatwoot}"
PROD_PG="${PROD_PG:-chatwoot-postgres-1}"
PROD_REDIS="${PROD_REDIS:-chatwoot-redis-1}"
PROD_DB="${PROD_DB:-chatwoot_production}"
PROD_PG_USUARIO="${PROD_PG_USUARIO:-chatwoot}"
IMAGEN_CHATWOOT="${IMAGEN_CHATWOOT:-chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf}"
IMAGEN_PG="${IMAGEN_PG:-pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337}"
IMAGEN_REDIS="${IMAGEN_REDIS:-redis:7.2.11-alpine@sha256:1a34bdba051ecd8a58ec8a3cc460acef697a1605e918149cc53d920673c1a0a7}"
TOPE_CARGA="${TOPE_CARGA:-8}"
# La ventana de búsqueda de mensajes que se ensaya (plan de SEARCH_TIME_RANGE_LIMIT_DAYS, SDD-0590 §10.14).
BUSQUEDA_DIAS="${BUSQUEDA_DIAS:-1540}"
case "$BUSQUEDA_DIAS" in ''|*[!0-9]*) echo "BUSQUEDA_DIAS tiene que ser un número de días"; exit 2 ;; esac
EVIDENCIA="${EVIDENCIA:-$AQUI/evidencia-ensayo-$(date -u +%Y%m%dT%H%M%SZ).txt}"
CREADO=0
FALLAS=0

log() { echo "$*"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() { if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi; return 0; }
h() { sed -n "s/^HECHO $2=//p" "$1" 2>/dev/null | tail -n 1 | tr -d '\r'; }
evidencia() { printf '%s\n' "$@" >>"$EVIDENCIA"; }
dc() { (cd "$DIR" && docker compose -p "$PROYECTO" "$@"); }
cero() { [ "${1:-0}" = 0 ]; }
cola_igual() { [ -n "$1" ] && [ "${1%%->*}" = "${1##*->}" ] && [ "${1%%->*}" != -1 ]; }
avance() { [ -n "$1" ] && [ "$(( ${1##*->} - ${1%%->*} ))" = "$2" ]; }
solo_invalidacion() {
  [ -n "$1" ] && [ "$1" != desconocido ] || return 1
  [ "$1" = ninguno ] && return 0
  ! printf '%s\n' "$1" | tr ',' '\n' | grep -qvE '^(ActionCableBroadcastJob|EventDispatcherJob)\(account\.cache_invalidated\):[0-9]+$'
}
AVISO_BANDEJA="ActionCableBroadcastJob(account.cache_invalidated):1,EventDispatcherJob(account.cache_invalidated):1"
# «nombre:si,numero:si,telefono:si»: todas «si» (o todas «no»), al menos una, y ningún error.
todas() { [ -n "$2" ] && ! printf '%s' "$2" | grep -qE "error|:$( [ "$1" = si ] && echo no || echo si )(,|\$)"; }
# Cada número de la copia entre el conteo de producción antes y después del dump (producción sigue viva).
entre() { # antes copia despues, cada uno «a,b,c,d»
  local i a c d
  for i in 1 2 3 4; do
    a="$(echo "$1" | cut -d, -f"$i")"; c="$(echo "$2" | cut -d, -f"$i")"; d="$(echo "$3" | cut -d, -f"$i")"
    [ -n "$c" ] && [ "$a" -le "$c" ] 2>/dev/null && [ "$c" -le "$d" ] 2>/dev/null || return 1
  done
}

carga_vps() { awk '{ print $1 }' /proc/loadavg; }
vigilar_carga() {
  local c
  c="$(carga_vps)"
  evidencia "HECHO carga_vps_$1=$c"
  if awk -v c="$c" -v t="$TOPE_CARGA" 'BEGIN { exit !(c > t) }'; then
    mal CARGA "carga del VPS $c por encima de $TOPE_CARGA ($1): se para"
    exit 3
  fi
}

# ── Guarda 2: el borrado ─────────────────────────────────────────────────────
recursos_del_ensayo() {
  echo "contenedores=$(docker ps -aq --filter "label=com.docker.compose.project=$PROYECTO" | wc -l)" \
       "volumenes=$(docker volume ls -q --filter "label=com.docker.compose.project=$PROYECTO" | wc -l)" \
       "redes=$(docker network ls -q --filter "label=com.docker.compose.project=$PROYECTO" | wc -l)"
}
limpiar() {
  local rc=$?
  if [ "$CREADO" != 1 ] && [ "$LIMPIAR_SOLO" != 1 ]; then
    return "$rc"
  fi
  # El proyecto es el fijo y no es el de producción.
  if [ "$PROYECTO" != chatwoot-ensayo ] || [ "$PROYECTO" = "$PROD_PROYECTO" ]; then
    echo "proyecto inesperado ($PROYECTO frente a $PROD_PROYECTO): no se borra nada"
    return 1
  fi
  if docker ps -aq --filter "label=com.docker.compose.project=$PROYECTO" | grep -q . \
     || docker network ls -q --filter "label=com.docker.compose.project=$PROYECTO" | grep -q . \
     || docker volume ls -q --filter "label=com.docker.compose.project=$PROYECTO" | grep -q .; then
    docker compose -p chatwoot-ensayo down -v --remove-orphans >/dev/null 2>&1
  fi
  # El volumen del almacenamiento (5.5b), por si `down -v` sin el compose no lo encontró. Solo los del proyecto fijo.
  docker volume ls -q --filter "label=com.docker.compose.project=chatwoot-ensayo" | xargs -r docker volume rm >/dev/null 2>&1
  rm -rf -- /dev/shm/cw-ensayo
  evidencia "HECHO limpieza=$(recursos_del_ensayo | tr ' ' ',')" \
            "HECHO limpieza_carpeta=$([ -e /dev/shm/cw-ensayo ] && echo presente || echo ausente)" \
            "HECHO produccion_postgres=$(docker inspect -f '{{.State.Status}}' "$PROD_PG" 2>/dev/null || echo ausente)" \
            "HECHO produccion_redis=$(docker inspect -f '{{.State.Status}}' "$PROD_REDIS" 2>/dev/null || echo ausente)"
  log "== limpieza: $(recursos_del_ensayo), carpeta $([ -e /dev/shm/cw-ensayo ] && echo presente || echo ausente)," \
      "producción: postgres $(docker inspect -f '{{.State.Status}}' "$PROD_PG" 2>/dev/null || echo ausente)"
  return "$rc"
}
trap limpiar EXIT

umask 077
: >"$EVIDENCIA" && chmod 600 "$EVIDENCIA"
evidencia "HECHO ensayo_inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "$LIMPIAR_SOLO" = 1 ]; then
  log "== --limpiar: solo se borra el ensayo que haya quedado"
  exit 0
fi

# ── Antes de crear nada ──────────────────────────────────────────────────────
log "== ensayo del Archivo Kommo · $(date -u +%Y-%m-%dT%H:%M:%SZ) · evidencia $EVIDENCIA"
[ "$PROYECTO" != "$PROD_PROYECTO" ] || { mal G0 "el proyecto del ensayo es el de producción"; exit 1; }
[ "$(uname -s)" = Linux ] || { mal G0 "el ensayo corre en Linux (el VPS)"; exit 1; }
[ -r "${CARGA:-}" ] || { mal G0 "falta CARGA (archivo de carga legible)"; exit 1; }
if [ -e "$DIR" ]; then
  mal G0 "$DIR ya existe: quedó un ensayo anterior; revísalo y corre --limpiar"
  exit 1
fi
if docker ps -aq --filter "label=com.docker.compose.project=$PROYECTO" | grep -q .; then
  mal G0 "ya hay contenedores del proyecto $PROYECTO: corre --limpiar"
  exit 1
fi
if docker inspect chatwoot-ensayo-postgres-1 >/dev/null 2>&1 || docker inspect chatwoot-ensayo-redis-1 >/dev/null 2>&1 \
   || docker inspect chatwoot-ensayo-almacen-1 >/dev/null 2>&1; then
  mal G0 "ya existe un contenedor chatwoot-ensayo-postgres-1, -redis-1 o -almacen-1: revísalo, no es de este ensayo"
  exit 1
fi
docker inspect "$PROD_PG" >/dev/null 2>&1 || { mal G0 "no existe $PROD_PG"; exit 1; }
for f in zz_dtd_redaccion_logs.rb zz_dtd_proteccion_register.rb zz_dtd_revocar_sesiones.rb zz_dtd_correo.rb; do
  [ -r "$CHATWOOT_DIR/rails/$f" ] || { mal G0 "falta $CHATWOOT_DIR/rails/$f"; exit 1; }
done
vigilar_carga inicio

# ── Stack efímero ────────────────────────────────────────────────────────────
mkdir -m 700 "$DIR" || { mal G0 "no se pudo crear $DIR"; exit 1; }
CREADO=1
mkdir -m 700 "$DIR/cargador" "$DIR/estado"
cp "$AQUI/cargar-archivo-kommo.rb" "$AQUI/pruebas/sonda-ensayo.rb" "$DIR/cargador/"
chmod 644 "$DIR/cargador/"*.rb
chmod 777 "$DIR/estado" # el contenedor escribe la foto de antes; la carpeta padre sigue en 0700
cat >"$DIR/.env" <<EOF
IMAGEN_CHATWOOT=$IMAGEN_CHATWOOT
IMAGEN_PG=$IMAGEN_PG
IMAGEN_REDIS=$IMAGEN_REDIS
RAILS_DIR=$CHATWOOT_DIR/rails
CORREO_DIR=$CHATWOOT_DIR/correo
PG_CLAVE=$(openssl rand -hex 24)
REDIS_CLAVE=$(openssl rand -hex 24)
SECRET_KEY_BASE=$(openssl rand -hex 64)
AR_PRIMARIA=$(openssl rand -hex 16)
AR_DETERMINISTA=$(openssl rand -hex 16)
AR_SAL=$(openssl rand -hex 16)
EOF
cat >"$DIR/compose.yml" <<'EOF'
# Stack EFÍMERO del ensayo del Archivo Kommo (ensayo-archivo.sh). Una sola red, interna, sin puertos.
name: chatwoot-ensayo
x-entorno: &entorno
  RAILS_ENV: production
  NODE_ENV: production
  INSTALLATION_ENV: docker
  SECRET_KEY_BASE: ${SECRET_KEY_BASE}
  FRONTEND_URL: http://chat-ensayo.invalid
  DEFAULT_LOCALE: es
  FORCE_SSL: "false"
  ENABLE_ACCOUNT_SIGNUP: "false"
  DISABLE_TELEMETRY: "true"
  ENABLE_PUSH_RELAY_SERVER: "false"
  DISABLE_GRAVATAR: "true"
  DTD_WHATSAPP_IDS_PROTEGIDOS: ""
  DTD_CHATWOOT_SERVICIO_ID: ""
  POSTGRES_HOST: postgres
  POSTGRES_PORT: "5432"
  POSTGRES_USERNAME: chatwoot
  POSTGRES_PASSWORD: ${PG_CLAVE}
  POSTGRES_DATABASE: chatwoot_production
  REDIS_URL: redis://redis:6379
  REDIS_PASSWORD: ${REDIS_CLAVE}
  ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY: ${AR_PRIMARIA}
  ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY: ${AR_DETERMINISTA}
  ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT: ${AR_SAL}
  ACTIVE_STORAGE_SERVICE: local
  RAILS_LOG_TO_STDOUT: "true"
  LOG_LEVEL: warn
  MAILER_SENDER_EMAIL: ensayo@example.invalid
  SMTP_ADDRESS: smtp.invalid
  SMTP_PORT: "25"
services:
  postgres:
    image: ${IMAGEN_PG}
    # Nombre fijo: el borrado de otras cuentas solo se corre con `docker exec chatwoot-ensayo-postgres-1`.
    container_name: chatwoot-ensayo-postgres-1
    environment:
      POSTGRES_USER: chatwoot
      POSTGRES_PASSWORD: ${PG_CLAVE}
      POSTGRES_DB: chatwoot_production
    tmpfs:
      - /var/lib/postgresql/data:size=2g
    networks: [aislada]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatwoot -d chatwoot_production"]
      interval: 3s
      retries: 40
    mem_limit: 768m
  redis:
    image: ${IMAGEN_REDIS}
    container_name: chatwoot-ensayo-redis-1
    command: ["redis-server", "--requirepass", "${REDIS_CLAVE}", "--save", "", "--appendonly", "no"]
    networks: [aislada]
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$$REDIS_CLAVE\" --no-auth-warning ping | grep -q PONG"]
      interval: 3s
      retries: 40
    environment:
      REDIS_CLAVE: ${REDIS_CLAVE}
    mem_limit: 128m
  almacen:
    # 5.5b: solo mantiene montado el volumen tmpfs del almacenamiento mientras dura el ensayo. Un volumen tmpfs se
    # desmonta, y pierde lo que tiene, cuando para el último contenedor que lo usa, y cada paso del runner es un
    # `run --rm`: sin esto, los adjuntos subidos en un paso no están en el siguiente (la prueba de CI, AD3).
    image: ${IMAGEN_REDIS}
    container_name: chatwoot-ensayo-almacen-1
    entrypoint: ["sh", "-c", "trap 'exit 0' TERM; while :; do sleep 3600 & wait $$!; done"]
    volumes:
      - almacenamiento:/almacen
    networks: [aislada]
    mem_limit: 32m
  runner:
    image: ${IMAGEN_CHATWOOT}
    profiles: ["runner"]
    entrypoint: docker/entrypoints/rails.sh
    environment: *entorno
    volumes:
      - ${RAILS_DIR}/zz_dtd_redaccion_logs.rb:/app/config/initializers/zz_dtd_redaccion_logs.rb:ro
      - ${RAILS_DIR}/zz_dtd_proteccion_register.rb:/app/config/initializers/zz_dtd_proteccion_register.rb:ro
      - ${RAILS_DIR}/zz_dtd_revocar_sesiones.rb:/app/config/initializers/zz_dtd_revocar_sesiones.rb:ro
      - ${RAILS_DIR}/zz_dtd_correo.rb:/app/config/initializers/zz_dtd_correo.rb:ro
      - ${CORREO_DIR}/views:/app/dtd-correo/views:ro
      - ./cargador:/tmp/cargador:ro
      - ./estado:/tmp/estado
      # 5.5b: el almacenamiento de la copia, en un volumen tmpfs del proyecto (abajo).
      - almacenamiento:/app/storage
    tmpfs:
      - /app/tmp
    networks: [aislada]
    # Las páginas de un tmpfs se le cargan al cgroup del proceso que las escribe: los ~2,1 GB de adjuntos que sube
    # MODO=adjuntos cuentan contra este límite, además de Rails. Con 1536m terminaría en OOM.
    mem_limit: 4g
    cpus: 1.0
networks:
  aislada:
    internal: true
volumes:
  # 5.5b: los adjuntos subidos siguen ahí de un paso al siguiente (cada paso es un `run --rm`), viven en memoria y
  # se borran con el proyecto. Con 3 GB caben los ~2,1 GB del Archivo; si no cupieran, la subida falla y AD1 cae.
  # Un bind de /dev/shm dejaría carpetas de root que el borrado sin root no puede quitar (la prueba de CI).
  almacenamiento:
    driver_opts:
      type: tmpfs
      device: tmpfs
      o: "size=3g,mode=0700"
EOF
log "== stack"
if ! dc up -d --wait postgres redis almacen >"$DIR/up.txt" 2>&1; then
  mal P0 "Postgres, Redis o el almacén del ensayo no arrancaron"; tail -n 30 "$DIR/up.txt"; exit 1
fi
vigilar_carga stack

# ── Guarda 1: aislamiento, medido ────────────────────────────────────────────
log "== A. aislamiento"
contenedores="$(docker ps -q --filter "label=com.docker.compose.project=$PROYECTO")"
exigir A1 '[ "$(docker network inspect -f "{{.Internal}}" "$RED" 2>/dev/null)" = true ]' "la red $RED es internal"
redes_ok=1
puertos_ok=1
nombres_ok=1
for c in $contenedores; do
  redes="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c" | xargs)"
  [ "$redes" = "$RED" ] || redes_ok=0
  [ -z "$(docker port "$c")" ] || puertos_ok=0
  case "$(docker inspect -f '{{.Name}}' "$c")" in /chatwoot-ensayo-*) ;; *) nombres_ok=0 ;; esac
done
exigir A2 '[ "$redes_ok" = 1 ] && [ -n "$contenedores" ]' "cada contenedor del ensayo está solo en $RED"
exigir A3 '[ "$puertos_ok" = 1 ]' "ningún puerto publicado"
exigir A4 '[ "$nombres_ok" = 1 ]' "nombres propios (chatwoot-ensayo-*), distintos de los de producción"
cruce=0
for r in $(docker network ls --format '{{.Name}}' | grep -E "^${PROD_PROYECTO}_"); do
  docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$r" | tr ' ' '\n' | grep -q '^chatwoot-ensayo-' && cruce=1
done
exigir A5 '[ "$cruce" = 0 ]' "ningún contenedor del ensayo en una red de producción"
dc run --rm -T --no-deps --entrypoint ruby runner -rsocket -e '
  %w[chatwoot-postgres-1 chatwoot-redis-1 postgres].each do |n|
    begin
      Addrinfo.getaddrinfo(n, nil); puts "HECHO resuelve_#{n.tr("-", "_")}=si"
    rescue SocketError
      puts "HECHO resuelve_#{n.tr("-", "_")}=no"
    end
  end
  begin
    Socket.tcp("1.1.1.1", 443, connect_timeout: 3) { }; puts "HECHO salida_internet=si"
  rescue StandardError
    puts "HECHO salida_internet=no"
  end' >"$DIR/aislamiento.txt" 2>&1 </dev/null
F="$DIR/aislamiento.txt"
exigir A6 '[ "$(h "$F" resuelve_chatwoot_postgres_1)" = no ] && [ "$(h "$F" resuelve_chatwoot_redis_1)" = no ] && [ "$(h "$F" resuelve_postgres)" = si ]' \
  "desde el ensayo no se resuelven chatwoot-postgres-1 ni chatwoot-redis-1; postgres es el del ensayo"
exigir A7 '[ "$(h "$F" salida_internet)" = no ]' "sin salida a internet"
evidencia "$(grep '^HECHO ' "$F")"
if [ "$FALLAS" -gt 0 ]; then log "aislamiento con fallas: no se copia la base"; exit 1; fi

# ── Guarda 4: la copia, en solo lectura ──────────────────────────────────────
log "== D. copia de la base"
rol="$(docker exec "$PROD_PG" psql -U "$PROD_PG_USUARIO" -d "$PROD_DB" -At -c \
  "select rolname from pg_roles where rolcanlogin and rolname ~* '(lectura|readonly|read_only)' order by rolname limit 1" 2>/dev/null)"
modo_lectura="default_transaction_read_only"
[ -n "$rol" ] && modo_lectura="rol $rol"
conteo_prod() {
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$PROD_PG" psql -U "${rol:-$PROD_PG_USUARIO}" -d "$PROD_DB" -At -c \
    "select (select count(*) from conversations)||','||(select count(*) from messages)||','||(select count(*) from contacts)||','||(select count(*) from inboxes)"
}
prod_antes="$(conteo_prod)"
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$PROD_PG" \
  pg_dump -U "${rol:-$PROD_PG_USUARIO}" -d "$PROD_DB" -Fc --no-owner --no-privileges >"$DIR/base.dump" 2>"$DIR/dump.err"
dump_rc=$?
dump_bytes="$(stat -c %s "$DIR/base.dump" 2>/dev/null || echo 0)"
dump_sha="$(sha256sum "$DIR/base.dump" | cut -c1-12)"
evidencia "HECHO dump_modo=$modo_lectura" "HECHO dump_bytes=$dump_bytes" "HECHO dump_sha=$dump_sha"
exigir D1 '[ "$dump_rc" = 0 ] && [ "$dump_bytes" -gt 0 ]' "pg_dump en solo lectura ($modo_lectura): $dump_bytes bytes, sha256 $dump_sha"
docker exec -i chatwoot-ensayo-postgres-1 \
  pg_restore -U chatwoot -d chatwoot_production --no-owner --no-privileges <"$DIR/base.dump" >"$DIR/restore.txt" 2>&1
restore_errores="$(grep -c 'error:' "$DIR/restore.txt" || true)"
rm -f -- /dev/shm/cw-ensayo/base.dump
exigir D2 '[ ! -e /dev/shm/cw-ensayo/base.dump ]' "el dump se borró apenas restaurado"
evidencia "HECHO restore_errores=$restore_errores"
# Marca de la copia: una tabla que producción nunca tiene, con un valor aleatorio de este momento. El borrado de
# otras cuentas (ensayo-otras-cuentas.sql) la verifica antes de tocar nada, en la misma transacción.
MARCA="$(openssl rand -hex 16)"
docker exec chatwoot-ensayo-postgres-1 psql -U chatwoot -d chatwoot_production -At -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE public._dtd_ensayo_marca (valor text NOT NULL); INSERT INTO public._dtd_ensayo_marca VALUES ('$MARCA');" \
  >"$DIR/marca.txt" 2>&1
exigir D4 '[ "$(docker exec chatwoot-ensayo-postgres-1 psql -U chatwoot -d chatwoot_production -At -c "SELECT valor FROM public._dtd_ensayo_marca")" = "$MARCA" ]' \
  "la copia lleva la marca del ensayo (tabla _dtd_ensayo_marca con un valor aleatorio de este momento)"
prod_despues="$(conteo_prod)"
copia_conteo="$(docker exec chatwoot-ensayo-postgres-1 \
  psql -U chatwoot -d chatwoot_production -At -c \
  "select (select count(*) from conversations)||','||(select count(*) from messages)||','||(select count(*) from contacts)||','||(select count(*) from inboxes)")"
evidencia "HECHO conteo_produccion_antes=$prod_antes" "HECHO conteo_copia=$copia_conteo" "HECHO conteo_produccion_despues=$prod_despues"
exigir D3 'entre "$prod_antes" "$copia_conteo" "$prod_despues"' \
  "la copia tiene las filas de producción en conversaciones, mensajes, contactos y bandejas ($prod_antes ≤ $copia_conteo ≤ $prod_despues); errores de restauración: $restore_errores"
vigilar_carga copia

# ── Las otras cuentas, fuera de la copia antes de cargar ─────────────────────
# El ensayo solo necesita la cuenta CUENTA. pg_dump copia tablas enteras, así que la copia trae las demás (en
# producción, la cuenta de prueba). Se borran en la COPIA: cada tabla con account_id, la cuenta, y los restos
# sin account_id que colgaban de ella (contact_inboxes, miembros de bandejas y usuarios sin cuenta).
log "== O. otras cuentas fuera de la copia"
# Capa 1 (Director General): el borrado se corre solo con el nombre escrito tal cual, y antes se verifica que ese
# contenedor es del proyecto del ensayo y que su PGDATA está en tmpfs.
etiqueta="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' chatwoot-ensayo-postgres-1 2>/dev/null)"
pgdata_fs="$(docker exec chatwoot-ensayo-postgres-1 stat -f -c %T /var/lib/postgresql/data 2>/dev/null)"
tmpfs_cfg="$(docker inspect -f '{{json .HostConfig.Tmpfs}}' chatwoot-ensayo-postgres-1 2>/dev/null)"
evidencia "HECHO borrado_contenedor_proyecto=$etiqueta" "HECHO borrado_pgdata=$pgdata_fs"
exigir O0 '[ "$etiqueta" = chatwoot-ensayo ] && [ "$pgdata_fs" = tmpfs ] && printf "%s" "$tmpfs_cfg" | grep -q "/var/lib/postgresql/data"' \
  "chatwoot-ensayo-postgres-1 es del proyecto chatwoot-ensayo ($etiqueta) y su PGDATA está en tmpfs ($pgdata_fs)"
if [ "$FALLAS" -gt 0 ]; then log "no es el Postgres del ensayo: no se borra nada"; exit 1; fi
# Capa 2: ensayo-otras-cuentas.sql empieza, en la misma transacción, por verificar la marca de la copia.
docker exec -i chatwoot-ensayo-postgres-1 psql -U chatwoot -d chatwoot_production -At -v ON_ERROR_STOP=1 \
  -v "cuenta=$CUENTA" -v "marca=$MARCA" <"$AQUI/ensayo-otras-cuentas.sql" >"$DIR/otras-cuentas.txt" 2>&1
F="$DIR/otras-cuentas.txt"
evidencia "$(grep '^HECHO ' "$F")"
exigir O1a '[ "$(h "$F" marca)" = ok ]' "el borrado encontró la marca de la copia antes de tocar nada"
exigir O1 '[ "$(h "$F" cuenta_del_ensayo)" = 1 ] && [ "$(h "$F" otras_cuentas)" = 0 ] && [ "$(h "$F" otras_cuentas_filas)" = 0 ]' \
  "la copia queda solo con la cuenta $CUENTA: se borraron $(h "$F" otras_cuentas_antes) cuentas y $(h "$F" otras_cuentas_filas_antes) filas con account_id; quedan 0"
exigir O2 '[ "$(h "$F" contact_inboxes_huerfanos)" = 0 ] && [ "$(h "$F" miembros_huerfanos)" = 0 ] && [ "$(h "$F" usuarios_sin_cuenta)" = 0 ]' \
  "sin restos de las otras cuentas: 0 contact_inboxes, 0 miembros de bandeja y 0 usuarios sin cuenta"
if [ "$FALLAS" -gt 0 ]; then log "la copia no quedó solo con la cuenta del ensayo: no se carga"; exit 1; fi

# ── Pasos con el cargador real ───────────────────────────────────────────────
rr() { # salida VAR=valor... -- script: rails runner en el ensayo; la entrada estándar pasa al contenedor
  local salida="$1" envs=()
  shift
  while [ "$1" != "--" ]; do envs+=(-e "$1"); shift; done
  shift
  vigilar_carga "$(basename "$salida" .txt)"
  dc run --rm -T "${envs[@]}" runner bundle exec rails runner "$@" >"$salida" 2>&1
  evidencia "HECHO paso=$(basename "$salida" .txt)" "$(grep '^HECHO ' "$salida")"
}
CARGADOR=/tmp/cargador/cargar-archivo-kommo.rb
SONDA=/tmp/cargador/sonda-ensayo.rb
log "== pasos"
rr "$DIR/antes.txt" FASE=antes "CUENTA=$CUENTA" -- "$SONDA" </dev/null
rr "$DIR/bandeja.txt" MODO=crear-bandeja "CUENTA=$CUENTA" "NOMBRE=Archivo Kommo" -- "$CARGADOR" </dev/null
B="$(h "$DIR/bandeja.txt" bandeja)"
rr "$DIR/seco.txt" MODO=seco "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$DIR/carga-1.txt" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
rr "$DIR/carga-2.txt" MODO=cargar "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR" <"$CARGA"
# 5.5b: los adjuntos en claro del staging (STAGING), por la entrada estándar, dos veces (la segunda no duplica).
# inf tiene que estar definida antes de usarla aquí: si no, ADJ_ESPERADOS queda vacío y los adjuntos no se cargan.
inf() { [ -r "${2:-}" ] && python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' "$2" "$1"; }
ADJ_ESPERADOS="$(inf con_adjunto_para_carga "${INFORME_CARGA:-}")"
if [ "${ADJ_ESPERADOS:-0}" -gt 0 ] 2>/dev/null; then
  if [ -d "${STAGING:-}/adjuntos-carga" ]; then
    for n in 1 2; do
      python3 -I "$AQUI/respaldar-historial.py" flujo-adjuntos --staging "$STAGING" 2>"$DIR/flujo-$n.err" \
        | rr "$DIR/adjuntos-$n.txt" MODO=adjuntos "CUENTA=$CUENTA" "BANDEJA=$B" CARGA=- -- "$CARGADOR"
      evidencia "HECHO flujo_adjuntos_$n=$(sed -n 's/^flujo-adjuntos: //p' "$DIR/flujo-$n.err" | tr -d ' ')"
    done
  else
    mal AD0 "el informe trae $ADJ_ESPERADOS adjuntos para carga, pero falta STAGING con adjuntos-carga/"
  fi
fi
rr "$DIR/despues.txt" FASE=despues "CUENTA=$CUENTA" "BANDEJA=$B" -- "$SONDA" </dev/null
# Miembros (Sam, 2026-11-06: «todo el equipo»), después de `despues`: E45b compara la cola con la de la creación de
# la bandeja, y agregar miembros encola la invalidación de caché. E-10 con un usuario real, antes y después.
rr "$DIR/real-antes.txt" FASE=usuario-real ETAPA=antes "CUENTA=$CUENTA" "BANDEJA=$B" -- "$SONDA" </dev/null
rr "$DIR/miembros-seco.txt" MODO=miembros-seco "CUENTA=$CUENTA" "BANDEJA=$B" -- "$CARGADOR" </dev/null
rr "$DIR/miembros-1.txt" MODO=miembros "CUENTA=$CUENTA" "BANDEJA=$B" -- "$CARGADOR" </dev/null
rr "$DIR/miembros-2.txt" MODO=miembros "CUENTA=$CUENTA" "BANDEJA=$B" -- "$CARGADOR" </dev/null
rr "$DIR/real-despues.txt" FASE=usuario-real ETAPA=despues "CUENTA=$CUENTA" "BANDEJA=$B" -- "$SONDA" </dev/null
# Búsqueda de mensajes con la ventana de hoy (90 días) y con la propuesta (BUSQUEDA_DIAS), con todo cargado.
rr "$DIR/busqueda-90.txt" FASE=busqueda "CUENTA=$CUENTA" "BANDEJA=$B" -- "$SONDA" </dev/null
rr "$DIR/busqueda-amplia.txt" FASE=busqueda "SEARCH_TIME_RANGE_LIMIT_DAYS=$BUSQUEDA_DIAS" "CUENTA=$CUENTA" "BANDEJA=$B" \
  -- "$SONDA" </dev/null

# ── Comprobaciones ───────────────────────────────────────────────────────────
log "== E. mediciones"
F="$DIR/antes.txt"
exigir P1 '[ "$(h "$F" antes)" = ok ]' "foto de antes: $(h "$F" conversaciones) conversaciones, $(h "$F" contactos) contactos, secuencia $(h "$F" secuencia)"
F="$DIR/bandeja.txt"
exigir B1 '[ "$(h "$F" carga)" = ok ] && [ -n "$B" ] && [ "$(h "$F" webhook_url)" = no ] && [ "$(h "$F" asignacion_automatica)" = no ] && [ "$(h "$F" saludo)" = no ] && [ "$(h "$F" encuesta)" = no ] && [ "$(h "$F" miembros)" = 0 ]' \
  "bandeja $B ($(h "$F" bandeja_existia) existía): canal API sin webhook_url, sin asignación automática, sin saludo ni encuesta, sin miembros"
exigir B2 '[ "$(h "$F" bandeja_existia)" = si ] || [ "$(h "$F" trabajos_nuevos)" = "$AVISO_BANDEJA" ]' "crear la bandeja encola solo la invalidación de caché: $(h "$F" trabajos_nuevos)"
F="$DIR/seco.txt"
exigir S1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" modo)" = seco ] && [ "$(h "$F" despues)" = "$(h "$F" antes)" ] && avance "$(h "$F" secuencia)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
  "seco: no escribe ($(h "$F" despues)), no consume números ($(h "$F" secuencia)), no encola"
SECO_CONV="$(h "$F" conversaciones_nuevas)"
SECO_MSG="$(h "$F" mensajes_nuevos)"
F="$DIR/carga-1.txt"
exigir C1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = "$SECO_CONV" ] && [ "$(h "$F" mensajes_nuevos)" = "$SECO_MSG" ]' \
  "carga: $(h "$F" conversaciones_nuevas) conversaciones y $(h "$F" mensajes_nuevos) mensajes, lo mismo que contó el seco"
exigir C2 'cero "$(h "$F" personas_omitidas)" && cero "$(h "$F" conversaciones_omitidas)" && cero "$(h "$F" mensajes_omitidos)" && cero "$(h "$F" contact_inboxes_omitidos)" && cero "$(h "$F" mensajes_sin_conversacion)"' \
  "ninguna fila omitida por un conflicto ni mensaje sin conversación"
exigir E45a 'cola_igual "$(h "$F" cola)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' "E-4 y E-5: la carga no encola trabajos ($(h "$F" trabajos_nuevos))"
if [ -n "${INFORME_CARGA:-}" ]; then
  exigir E6 '[ "$(h "$F" conversaciones_nuevas)" = "$(inf conversaciones "$INFORME_CARGA")" ] && [ "$(h "$F" mensajes_nuevos)" = "$(inf mensajes "$INFORME_CARGA")" ]' \
    "E-6: lo cargado es el archivo de carga (informe: $(inf conversaciones "$INFORME_CARGA") conversaciones, $(inf mensajes "$INFORME_CARGA") mensajes)"
else
  log "E-6 frente al informe: NO EJECUTADO (sin INFORME_CARGA)"
fi
exigir E8a 'avance "$(h "$F" secuencia)" "$(h "$F" conversaciones_nuevas)"' "E-8: los números de conversación avanzan lo cargado ($(h "$F" secuencia))"
F="$DIR/carga-2.txt"
exigir E7 '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" personas_nuevas)" && avance "$(h "$F" secuencia)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
  "E-7: segunda carga, 0 filas nuevas, 0 números, 0 trabajos"
F="$DIR/despues.txt"
base_carga="$(h "$DIR/bandeja.txt" trabajos_despues)"
exigir E45b '[ "$(h "$F" despues)" = ok ] && [ -n "$base_carga" ] && [ "$(h "$F" trabajos_actuales)" = "$base_carga" ] && [ "$(h "$F" mensajes_fuera_del_archivo)" = 0 ]' \
  "E-4 y E-5: la cola por clase es la misma desde que existe la bandeja, y 0 mensajes nuevos fuera del Archivo"
exigir E6b '[ "$(h "$F" archivo_resueltas)" = "$(h "$F" archivo_conversaciones)" ] && cero "$(h "$F" archivo_asignadas)" && [ "$(h "$F" json_conv)" = 0 ] && [ "$(h "$F" no_reenviados)" = "$(h "$F" archivo_mensajes)" ] && [ "$(h "$F" no_leidos)" = 0 ]' \
  "E-6: $(h "$F" archivo_conversaciones) conversaciones resueltas y sin asignar, $(h "$F" archivo_mensajes) mensajes legibles, 0 no leídos"
exigir E8b '[ "$(h "$F" display_duplicados)" = 0 ] && [ "$(h "$F" display_en_orden)" = si ] && [ "$(h "$F" display_nueva_mayor)" = si ]' \
  "E-8: sin números repetidos, en orden de creación, y la conversación nueva va después ($(h "$F" secuencia))"
exigir E9a 'cero "$(h "$F" huerfanos_mensaje)" && cero "$(h "$F" huerfanos_conversacion)" && cero "$(h "$F" sin_contact_inbox)" && cero "$(h "$F" contact_inbox_cruzado)" && cero "$(h "$F" remitente_cruzado)" && [ -n "$(h "$F" remitente_cruzado)" ]' \
  "E-9: 0 huérfanos, 0 cruces de contact_inbox, 0 remitentes cruzados"
exigir E9b 'cola_igual "$(h "$F" tel_repetidos)" && cola_igual "$(h "$F" correo_repetidos)"' \
  "E-9: los teléfonos y correos repetidos no aumentan (tel $(h "$F" tel_repetidos), correo $(h "$F" correo_repetidos)); $(h "$F" contactos_reusados_en_archivo) contactos existentes reusados"
exigir E10d '[ -n "$(h "$F" busqueda_consultas)" ] && todas si "$(h "$F" admin_encuentra)"' \
  "E-10d: como administrador, la búsqueda de conversaciones encuentra la del Archivo más vieja ($(h "$F" admin_encuentra))"
exigir E10e 'todas no "$(h "$F" agente_sin_ser_miembro)" && todas si "$(h "$F" agente_miembro)"' \
  "E-10e: un agente no la encuentra sin ser miembro ($(h "$F" agente_sin_ser_miembro)) y sí siéndolo ($(h "$F" agente_miembro))"
exigir E10f 'solo_invalidacion "$(h "$F" miembros_trabajos)" && [ "$(h "$F" miembros_notificaciones)" = 0 ] && cero "$(h "$F" miembros_asignadas)"' \
  "E-10f: agregar un miembro no asigna ni notifica ($(h "$F" miembros_trabajos))"
exigir E11 '[ "$(h "$F" conversaciones_existentes_intactas)" = si ] && [ "$(h "$F" contactos_existentes_intactos)" = si ] && [ "$(h "$F" mensajes_existentes_intactos)" = si ]' \
  "E-11: las conversaciones, contactos y mensajes que ya existían no cambiaron (huellas)"
if [ "${ADJ_ESPERADOS:-0}" -gt 0 ] 2>/dev/null && [ -f "$DIR/adjuntos-1.txt" ]; then
  ADJ_BYTES="$(inf bytes_adjuntos_para_carga "$INFORME_CARGA")"
  F="$DIR/adjuntos-1.txt"
  exigir AD1 '[ "$(h "$F" carga)" = ok ] && [ "$(h "$F" adjuntos_nuevos)" = "$ADJ_ESPERADOS" ] && [ "$(h "$F" bytes_nuevos)" = "$ADJ_BYTES" ] && cero "$(h "$F" adjuntos_sin_mensaje)" && cero "$(h "$F" adjuntos_no_coinciden)" && cero "$(h "$F" adjuntos_fallidos)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
    "5.5b: $(h "$F" adjuntos_nuevos) de $ADJ_ESPERADOS adjuntos subidos, $(h "$F" bytes_nuevos) de $ADJ_BYTES bytes, sin trabajos encolados ($(h "$F" trabajos_nuevos))"
  F="$DIR/adjuntos-2.txt"
  exigir AD2 '[ "$(h "$F" carga)" = ok ] && cero "$(h "$F" adjuntos_nuevos)" && [ "$(h "$F" adjuntos_existentes)" = "$ADJ_ESPERADOS" ] && avance "$(h "$F" blobs)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ]' \
    "5.5b: la segunda carga de adjuntos no duplica: 0 nuevos, $(h "$F" adjuntos_existentes) existentes"
  F="$DIR/despues.txt"
  exigir AD3 '[ "$(h "$F" adjuntos_archivo)" = "$ADJ_ESPERADOS" ] && [ "$(h "$F" adjuntos_bytes)" = "$ADJ_BYTES" ] && [ "$(h "$F" adjuntos_integros)" = "$ADJ_ESPERADOS" ] && cero "$(h "$F" blobs_huerfanos)" && cero "$(h "$F" blobs_sin_archivo)" && cero "$(h "$F" archivos_sin_blob)" && [ -n "$(h "$F" archivos_sin_blob)" ]' \
    "5.5b: en la copia, $(h "$F" adjuntos_archivo) adjuntos con $(h "$F" adjuntos_bytes) bytes, $(h "$F" adjuntos_integros) íntegros, 0 huérfanos"
  VOL_ALM="$(docker volume ls -q --filter "label=com.docker.compose.project=$PROYECTO" --filter "label=com.docker.compose.volume=almacenamiento")"
  exigir A8 '[ -n "$VOL_ALM" ] && [ "$(docker volume inspect -f "{{.Options.type}}" "$VOL_ALM" 2>/dev/null)" = tmpfs ]' \
    "5.5b: los adjuntos de la copia viven en un volumen tmpfs del proyecto del ensayo ($VOL_ALM)"
elif [ -r "${INFORME_CARGA:-}" ] && [ -z "$ADJ_ESPERADOS" ]; then
  # Un informe que no trae el conteo es de un extractor sin la 5.5b o se leyó mal: no es «sin adjuntos».
  mal AD0 "carga-informe.json no trae con_adjunto_para_carga: no se sabe cuántos adjuntos esperar"
else
  log "5.5b, adjuntos: NO EJECUTADO (el informe trae ${ADJ_ESPERADOS:-0} adjuntos para carga)"
fi
correos_pasos=0
for p in bandeja seco carga-1 carga-2 $([ -f "$DIR/adjuntos-1.txt" ] && echo adjuntos-1 adjuntos-2) miembros-seco miembros-1 miembros-2; do
  [ "$(h "$DIR/$p.txt" correos_enviados)" = 0 ] || correos_pasos=$((correos_pasos + 1))
done
exigir SMTP1 '[ "$correos_pasos" = 0 ] && [ "$(h "$F" correos_enviados_sonda)" = 0 ] && [ "$(h "$F" correos_en_cola)" = 0 ]' \
  "0 correos enviados en cada paso del cargador y en la sonda, y 0 trabajos de correo en cola en todo el ensayo (además, la red no tiene salida y SMTP apunta a smtp.invalid)"
if [ -n "${INFORME_VINCULO:-}" ]; then
  exigir E1 '[ "$(inf clientes_en_varios_grupos "$INFORME_VINCULO")" = 0 ]' "E-1: 0 clientes del ERP en dos grupos"
  exigir E2 '[ "$(inf ambiguos_vinculados "$INFORME_VINCULO")" = 0 ]' "E-2: 0 ambiguos cargados como vinculados"
  evidencia "HECHO e1_clientes_en_varios_grupos=$(inf clientes_en_varios_grupos "$INFORME_VINCULO")" \
            "HECHO e2_ambiguos_vinculados=$(inf ambiguos_vinculados "$INFORME_VINCULO")"
else
  log "E-1 y E-2: NO EJECUTADO (sin INFORME_VINCULO)"
fi

# Miembros del Archivo (Sam, 2026-11-06: «todo el equipo»), con MODO=miembros del cargador.
S1="$DIR/miembros-seco.txt"
M1="$DIR/miembros-1.txt"
M2="$DIR/miembros-2.txt"
exigir MI1 '[ "$(h "$S1" carga)" = ok ] && [ "$(h "$S1" modo)" = miembros-seco ] && [ "$(h "$S1" miembros_nuevos)" -gt 0 ] 2>/dev/null && [ "$(h "$S1" miembros_despues)" = "$(h "$S1" miembros_antes)" ] && [ "$(h "$S1" trabajos_nuevos)" = ninguno ]' \
  "miembros, seco: cuenta $(h "$S1" miembros_nuevos) por agregar y no agrega a nadie ni encola nada"
exigir MI2 '[ "$(h "$M1" carga)" = ok ] && [ "$(h "$M1" miembros_despues)" = "$(h "$M1" usuarios_cuenta)" ] && [ "$(h "$M1" miembros_nuevos)" = "$(h "$S1" miembros_nuevos)" ] && cero "$(h "$M1" notificaciones_nuevas)" && cola_igual "$(h "$M1" asignadas)" && solo_invalidacion "$(h "$M1" trabajos_nuevos)"' \
  "miembros: todos los usuarios de la cuenta en el Archivo ($(h "$M1" miembros_despues) de $(h "$M1" usuarios_cuenta), con los temporales del ensayo), sin notificar ni asignar ($(h "$M1" asignadas)); encola $(h "$M1" trabajos_nuevos)"
exigir MI3 '[ "$(h "$M2" carga)" = ok ] && cero "$(h "$M2" miembros_nuevos)" && [ "$(h "$M2" miembros_despues)" = "$(h "$M1" miembros_despues)" ] && [ "$(h "$M2" trabajos_nuevos)" = ninguno ]' \
  "miembros: la segunda vez no agrega a nadie ni encola nada"
RA="$DIR/real-antes.txt"
RD="$DIR/real-despues.txt"
case "$(h "$RD" usuario_real_rol)" in
  agente)
    exigir E10g '[ "$(h "$RA" usuario_real_fase)" = ok ] && [ "$(h "$RD" usuario_real_fase)" = ok ] && [ "$(h "$RA" usuario_real_miembro)" = no ] && todas no "$(h "$RA" usuario_real_encuentra)" && [ "$(h "$RD" usuario_real_miembro)" = si ] && todas si "$(h "$RD" usuario_real_encuentra)"' \
      "E-10e con un usuario real (agente): no la encuentra antes de ser miembro ($(h "$RA" usuario_real_encuentra)) y sí después ($(h "$RD" usuario_real_encuentra))" ;;
  administrador)
    exigir E10g '[ "$(h "$RA" usuario_real_fase)" = ok ] && [ "$(h "$RD" usuario_real_fase)" = ok ] && [ "$(h "$RD" usuario_real_miembro)" = si ] && todas si "$(h "$RA" usuario_real_encuentra)" && todas si "$(h "$RD" usuario_real_encuentra)"' \
      "E-10e con un usuario real (administrador; la cuenta tiene $(h "$RD" agentes_reales) agentes): la encuentra antes y después ($(h "$RD" usuario_real_encuentra)) y quedó como miembro" ;;
  *)
    mal E10g "no hubo usuario real para medir E-10e ($(h "$RD" usuario_real_rol), fase $(h "$RD" usuario_real_fase))" ;;
esac

# Búsqueda de mensajes: la ventana de hoy (90 días) frente a la propuesta (BUSQUEDA_DIAS), con todo el Archivo.
BA="$DIR/busqueda-90.txt"
BB="$DIR/busqueda-amplia.txt"
vieja_fuera_de_90() { [ "$(h "$BA" vieja_dias)" -le 90 ] 2>/dev/null || [ "$(h "$BA" vieja_encontrada)" = no ]; }
exigir BQ1 '[ "$(h "$BA" busqueda)" = ok ] && [ "$(h "$BB" busqueda)" = ok ] && [ "$(h "$BA" ventana_dias)" = 90 ] && [ "$(h "$BB" ventana_dias)" = "$BUSQUEDA_DIAS" ] && vieja_fuera_de_90 && [ "$(h "$BB" vieja_encontrada)" = si ]' \
  "búsqueda de mensajes: el mensaje con texto más viejo del Archivo (de hace $(h "$BB" vieja_dias) días) con 90 días: $(h "$BA" vieja_encontrada); con $BUSQUEDA_DIAS: $(h "$BB" vieja_encontrada)"
log "MEDIDA BQ — 90 días: $(h "$BA" mensajes_cuenta_en_ventana) mensajes de la cuenta en la ventana ($(h "$BA" mensajes_archivo_en_ventana) del Archivo), palabra $(h "$BA" palabra_ms) ms, sin coincidencias $(h "$BA" sin_coincidencias_ms) ms"
log "MEDIDA BQ — $BUSQUEDA_DIAS días: $(h "$BB" mensajes_cuenta_en_ventana) mensajes de la cuenta en la ventana ($(h "$BB" mensajes_archivo_en_ventana) del Archivo), palabra $(h "$BB" palabra_ms) ms, sin coincidencias $(h "$BB" sin_coincidencias_ms) ms; GIN $(h "$BB" busqueda_gin), índices GIN sobre content $(h "$BB" indice_gin_contenido)"

evidencia "HECHO ensayo_fallas=$FALLAS" "HECHO ensayo_fin=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "== resultado: $FALLAS fallas · evidencia $EVIDENCIA"
[ "$FALLAS" = 0 ]
