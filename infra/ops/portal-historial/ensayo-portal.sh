#!/usr/bin/env bash
# infra/ops/portal-historial/ensayo-portal.sh — SDD-0586 10.7, PR 2b: el ENSAYO de la carga P4 del chat del portal
# (puerta 3 del runbook), en copias EFÍMERAS y AISLADAS de Studio y de Chatwoot. Corre en el VPS, como root, con su
# OK propio y después de los dos OK de Sam para copiar (primero Chatwoot, después Studio).
#
# Qué hace:
#   1. guardas: /dev/shm/portal-historial no existe (no pisa una carga real ni al revés); DB_CW, si viene, es el
#      contenedor de la copia; el proyecto y la carpeta del ensayo no existen; la carga y la memoria alcanzan;
#   2. mide producción, en solo lectura (P): lo que el ensayo nunca debe cambiar;
#   3. levanta las copias (proyecto portal-ensayo, red `internal: true`, sin puertos, PGDATA en tmpfs) y mide el
#      aislamiento (A);
#   4. crea el esquema SIN DATOS: Studio con ensayo-studio-esquema.sql y las migraciones del repo; Chatwoot con
#      db:chatwoot_prepare de la imagen fijada por digest. Nunca un pg_dump de producción;
#   5. copia los datos con la lista explícita de copia-columnas.tsv: `COPY (SELECT <lista> … WHERE <filtro>) TO STDOUT`
#      en una transacción de solo lectura de producción, por un tubo, a `COPY tabla (<lista>) FROM STDIN` en la copia.
#      Nada pasa por el disco del VPS. La evidencia lleva, por tabla, las filas y el md5 de sus columnas, y el md5 de
#      la lista entera (D). La copia de Chatwoot trae solo la cuenta y la bandeja del portal (O);
#   6. corre la carga en las copias: extraer.sh, cargar.sh (seco y cargar), los casos provocados (a), (B1) y (B2)
#      con vincular.sh, y (c) repetir desde la extracción; controles-studio.sql antes y después (E). Después ensaya
#      las dos vueltas atrás del 4.6b sin el paso que borra: deshacer.sh en seco y con CONFIRMAR=no, y
#      deshacer-vinculos.sh con ENTORNO=copia y MODO=ensayo, solo sobre los contenedores de la copia (R);
#   7. vuelve a medir producción (P) y limpia todo. El trap de EXIT borra el proyecto fijo, /dev/shm/portal-ensayo y
#      /dev/shm/portal-historial, y lo comprueba.
#
#   TENANT=<uuid> CUENTA=1 BANDEJA=<id de la puerta 2> AGENTE_SERVICIO=<id> bash ensayo-portal.sh
#   … bash ensayo-portal.sh --solo-copia   # 1 a 5 y 7: copia y comprueba, sin cargar
#   bash ensayo-portal.sh --limpiar        # solo borra un ensayo que haya quedado
#
# Salida: PASÓ/FALLÓ por comprobación. La evidencia (EVIDENCIA, 0600) guarda solo líneas HECHO: conteos, md5 y
# nombres de contenedores; nunca nombres de personas ni textos. Códigos (también `HECHO ensayo_codigo`): 0 pasó todo;
# 1 fallas; 2 opción o entrada mala; 3 carga o memoria; 4 la limpieza no terminó (y nada más falló); 5 la unidad de
# systemd tiene TimeoutStopSec de menos de 300 s; 6 --limpiar con docker sin responder, y no se borró nada (un ensayo
# que corrió borra sus carpetas igual y conserva su código); 7 los tipos de las columnas de la lista no son los mismos
# en producción y en la copia, y no se copió nada; 143, 130 y 129 parado por TERM, INT y HUP.
#
# Copia las guardas de infra/ops/kommo-historial/ensayo-archivo.sh (SDD-0590): el trap que sale con 4, la salida
# del guion en 7 y 8 para los traps, TimeoutStopSec, la carga del VPS y la memoria.
set -uo pipefail

SOLO_COPIA=0
LIMPIAR_SOLO=0
for a in "$@"; do
  case "$a" in
    --solo-copia) SOLO_COPIA=1 ;;
    --limpiar) LIMPIAR_SOLO=1 ;;
    *) echo "opción desconocida: $a"; exit 2 ;;
  esac
done

# Fijos: no se toman del entorno.
readonly PROYECTO=portal-ensayo
readonly DIR=/dev/shm/portal-ensayo
readonly SHM=/dev/shm/portal-historial
readonly RED="${PROYECTO}_aislada"
readonly STUDIO_COPIA=portal-ensayo-studio-1
readonly PG_COPIA=portal-ensayo-postgres-1
readonly RAILS_COPIA=portal-ensayo-rails-1
# La copia durable del 4.6b: el desarme del ensayo (R) nunca la crea ni la cambia, y lo comprueba (R4).
readonly DURABLE_4_6B=/srv/ops/portal-historial/deshacer

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LISTA="$AQUI/copia-columnas.tsv"
# El desarme de Studio del 4.6b. En el VPS, el sub-paso 3.0 lo deja junto a este guion.
DESHACER_VINCULOS="$AQUI/deshacer-vinculos.sh"
CUENTA="${CUENTA:-1}"
CHATWOOT_DIR="${CHATWOOT_DIR:-/srv/chatwoot}"
MIGRACIONES="${MIGRACIONES:-$AQUI/migraciones}"
PROD_PROYECTO="${PROD_PROYECTO:-chatwoot}"
PROD_STUDIO="${PROD_STUDIO:-dtd-cargo-db-1}"
PROD_STUDIO_USUARIO="${PROD_STUDIO_USUARIO:-postgres}"
PROD_STUDIO_DB="${PROD_STUDIO_DB:-postgres}"
PROD_PG="${PROD_PG:-chatwoot-postgres-1}"
PROD_RAILS="${PROD_RAILS:-chatwoot-rails-1}"
PROD_DB="${PROD_DB:-chatwoot_production}"
PROD_PG_USUARIO="${PROD_PG_USUARIO:-chatwoot}"
IMAGEN_CHATWOOT="${IMAGEN_CHATWOOT:-chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf}"
IMAGEN_PG="${IMAGEN_PG:-pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337}"
IMAGEN_REDIS="${IMAGEN_REDIS:-redis:7.2.11-alpine@sha256:1a34bdba051ecd8a58ec8a3cc460acef697a1605e918149cc53d920673c1a0a7}"
# El Postgres de la copia de Studio: el mismo de la prueba punta a punta. Su digest va a la evidencia.
IMAGEN_STUDIO="${IMAGEN_STUDIO:-postgres:17}"
TOPE_CARGA="${TOPE_CARGA:-8}"
MEMINFO_DE="${ENSAYO_MEMINFO_DE:-/proc/meminfo}"
CARGA_DE="${ENSAYO_CARGA_DE:-/proc/loadavg}"
readonly TIMEOUT_STOP_MIN_S=300
readonly NECESARIO_MB=5120 # Chatwoot (Postgres 768, Redis 128, Rails 1536), Studio 512 y un margen de 2 GB
EVIDENCIA="${EVIDENCIA:-$AQUI/evidencia-ensayo-portal-$(date -u +%Y%m%dT%H%M%SZ).txt}"
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
avance() { [ -n "$1" ] && [ "$(( ${1##*->} - ${1%%->*} ))" = "$2" ]; }
uuid() { printf '%s' "$1" | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; }
numero() { case "$1" in '' | *[!0-9]*) return 1 ;; esac; }

carga_vps() { awk '{ print $1 }' "$CARGA_DE"; }
vigilar_carga() {
  local c
  c="$(carga_vps)"
  evidencia "HECHO carga_vps_$1=$c"
  if awk -v c="$c" -v t="$TOPE_CARGA" 'BEGIN { exit !(c > t) }'; then
    mal CARGA "carga del VPS $c por encima de $TOPE_CARGA ($1): se para"
    exit 3
  fi
}

# ── El borrado: solo el proyecto fijo y las dos carpetas fijas ───────────────
contar_del_ensayo() { # ps | volume | network: cuántos hay del proyecto, o «?» si docker no responde
  local ids
  case "$1" in
    # Con tope de tiempo (N1 de la revisión del DG): un docker colgado, y no solo caído, también da «?».
    ps) ids="$(timeout 30 docker ps -aq --filter "label=com.docker.compose.project=$PROYECTO" 2>/dev/null)" ;;
    *) ids="$(timeout 30 docker "$1" ls -q --filter "label=com.docker.compose.project=$PROYECTO" 2>/dev/null)" ;;
  esac || { echo '?'; return 0; }
  printf '%s' "$ids" | grep -c .
}
recursos_del_ensayo() {
  echo "contenedores=$(contar_del_ensayo ps) volumenes=$(contar_del_ensayo volume) redes=$(contar_del_ensayo network)"
}
SIN_RESTOS="contenedores=0 volumenes=0 redes=0"
# El trap de EXIT sale con el código del ensayo. Si la limpieza no deja 0 contenedores, volúmenes y redes del proyecto
# y las dos carpetas ausentes, lo dice (FALLÓ L0) y, si el código era 0, sale con 4. Nunca sale con 0 dejando algo.
limpiar() {
  local rc=$? intento restos carpetas completa
  exec 1>&7 2>&8 # a la salida del guion, no a la del paso que se cortó
  trap 'evidencia "HECHO senal_durante_limpieza=si"' TERM INT HUP
  if [ "$CREADO" != 1 ] && [ "$LIMPIAR_SOLO" != 1 ]; then
    evidencia "HECHO ensayo_codigo=$rc"
    exit "$rc"
  fi
  # ¿Hay un ensayo que limpiar? Se mide antes de borrar nada: la carpeta del ensayo o recursos del proyecto. Si docker
  # no responde, el conteo da «?».
  #   · En un --limpiar puro (este proceso no creó nada), ante la duda no se borra nada, tampoco /dev/shm/portal-historial,
  #     y sale con 6 (revisión del DG, N2).
  #   · En un ensayo que corrió (CREADO=1), las dos carpetas son suyas y llevan datos de la copia: se borran igual, el
  #     código del ensayo se conserva (o queda en 4, porque la limpieza no se pudo comprobar) y se anota
  #     docker_no_responde (revisión del DG de la vuelta 9, B1).
  # Un ensayo que corrió borra primero sus dos carpetas, antes de llamar a docker: si docker se cuelga y llega un
  # SIGKILL, los datos de la copia ya no están (N1 de la revisión del DG).
  if [ "$CREADO" = 1 ]; then
    rm -rf -- /dev/shm/portal-ensayo /dev/shm/portal-historial
  fi
  RECURSOS_ANTES="$(recursos_del_ensayo)"
  case "$RECURSOS_ANTES" in *'?'*)
    if [ "$CREADO" != 1 ]; then # --limpiar puro: ante la duda no se borra
      mal L0 "docker no responde ($RECURSOS_ANTES): no se borra nada, tampoco $SHM. Revísalo y corre --limpiar"
      evidencia "HECHO limpieza_completa=no" "HECHO error=docker_no_responde" "HECHO ensayo_codigo=6"
      exit 6
    fi
    evidencia "HECHO docker_no_responde=si" ;;
  esac
  HABIA_ENSAYO=no
  { [ -e "$DIR" ] || [ "$RECURSOS_ANTES" != "$SIN_RESTOS" ]; } && HABIA_ENSAYO=si
  if [ "$PROYECTO" != portal-ensayo ] || [ "$PROYECTO" = "$PROD_PROYECTO" ]; then
    mal L0 "proyecto inesperado ($PROYECTO frente a $PROD_PROYECTO): no se borra nada"
    evidencia "HECHO limpieza_completa=no" "HECHO ensayo_codigo=1"
    exit 1
  fi
  for intento in 1 2 3; do
    [ "$(recursos_del_ensayo)" = "$SIN_RESTOS" ] && break
    if [ -f "$DIR/compose.yml" ]; then
      dc --profile runner down -v --remove-orphans >/dev/null 2>&1
    else
      (cd / && docker compose -p portal-ensayo down -v --remove-orphans) >/dev/null 2>&1
    fi
    docker ps -aq --filter "label=com.docker.compose.project=portal-ensayo" | xargs -r docker rm -f -v >/dev/null 2>&1
    docker network ls -q --filter "label=com.docker.compose.project=portal-ensayo" | xargs -r docker network rm >/dev/null 2>&1
    docker volume ls -q --filter "label=com.docker.compose.project=portal-ensayo" | xargs -r docker volume rm >/dev/null 2>&1
    [ "$(recursos_del_ensayo)" = "$SIN_RESTOS" ] && break
    [ "$intento" = 3 ] || sleep 2
  done
  rm -rf -- /dev/shm/portal-ensayo
  # /dev/shm/portal-historial, solo si este ensayo corrió (la guarda del principio exige que no existiera, así que lo
  # que haya es suyo) o si quedó un ensayo que limpiar. Un --limpiar sin ensayo no toca una carga real a medias.
  historial=no_tocada
  if [ "$CREADO" = 1 ] || [ "$HABIA_ENSAYO" = si ]; then
    rm -rf -- /dev/shm/portal-historial
    historial="$([ -e /dev/shm/portal-historial ] && echo presente || echo ausente)"
  fi
  restos="$(recursos_del_ensayo)"
  carpetas="$([ -e /dev/shm/portal-ensayo ] && echo presente || echo ausente),$historial"
  completa=si
  [ "$restos" = "$SIN_RESTOS" ] && [ "${carpetas%%,*}" = ausente ] && [ "$historial" != presente ] || completa=no
  evidencia "HECHO limpieza=$(echo "$restos" | tr ' ' ',')" \
            "HECHO limpieza_carpetas=$carpetas" \
            "HECHO limpieza_completa=$completa" \
            "HECHO produccion_studio=$(docker inspect -f '{{.State.Status}}' "$PROD_STUDIO" 2>/dev/null || echo ausente)" \
            "HECHO produccion_postgres=$(docker inspect -f '{{.State.Status}}' "$PROD_PG" 2>/dev/null || echo ausente)"
  log "== limpieza: $restos, carpetas (ensayo, portal-historial) $carpetas"
  if [ "$completa" != si ]; then
    mal L0 "la limpieza no terminó: quedan $restos y las carpetas están $carpetas. Revísalo y corre --limpiar"
    [ "$rc" = 0 ] && rc=4
  fi
  evidencia "HECHO ensayo_codigo=$rc"
  log "== código de salida: $rc"
  exit "$rc"
}
parada() { # señal código
  exec 1>&7 2>&8
  mal PARADA "el ensayo recibió $1 y no terminó: se limpia y sale con $2"
  evidencia "HECHO senal=$1"
  exit "$2"
}
exec 7>&1 8>&2
trap limpiar EXIT
trap 'parada TERM 143' TERM
trap 'parada INT 130' INT
trap 'parada HUP 129' HUP

umask 077
: >"$EVIDENCIA" && chmod 600 "$EVIDENCIA"
evidencia "HECHO ensayo_inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "$LIMPIAR_SOLO" = 1 ]; then
  log "== --limpiar: solo se borra el ensayo que haya quedado"
  exit 0
fi

# ── G. Antes de crear nada ───────────────────────────────────────────────────
log "== ensayo de la carga P4 del portal · $(date -u +%Y-%m-%dT%H:%M:%SZ) · evidencia $EVIDENCIA"
# DB_CW: el ensayo carga SOLO en el Chatwoot de la copia. Si quien opera lo trae puesto, tiene que ser ese.
if [ -n "${DB_CW:-}" ] && [ "$DB_CW" != "$RAILS_COPIA" ]; then
  mal G0 "DB_CW=$DB_CW no es el contenedor de la copia ($RAILS_COPIA): el ensayo nunca carga en otro"
  evidencia "HECHO error=db_cw_no_es_la_copia"
  exit 2
fi
# La carpeta fija de la carga: si existe, hay una carga real a medias (o un ensayo anterior). No se toca.
if [ -e "$SHM" ]; then
  mal G0 "$SHM ya existe: puede ser una carga real a medias. El ensayo no corre y no la toca"
  evidencia "HECHO error=ya_existe_portal_historial"
  exit 2
fi
uuid "${TENANT:-}" || { mal G0 "TENANT tiene que ser un uuid"; evidencia "HECHO error=tenant"; exit 2; }
for n in "$CUENTA" "${BANDEJA:-}" "${AGENTE_SERVICIO:-}"; do
  numero "$n" || { mal G0 "CUENTA, BANDEJA y AGENTE_SERVICIO tienen que ser números"; evidencia "HECHO error=numeros"; exit 2; }
done
# El volcado de las copias es SOLO para la prueba de marcas de Actions, con nombres de producción que no son los reales.
if [ -n "${ENSAYO_VOLCADO:-}" ]; then
  if [ "${ENSAYO_PRUEBA:-}" != 1 ] || [ "$PROD_STUDIO" = dtd-cargo-db-1 ] || [ "$PROD_PG" = chatwoot-postgres-1 ]; then
    mal G0 "ENSAYO_VOLCADO es solo para la prueba de Actions: en el VPS no se vuelca nada"
    evidencia "HECHO error=volcado_fuera_de_la_prueba"
    exit 2
  fi
fi
# Saltar el desarme (R) es SOLO para la prueba de Actions: su producción simulada tiene en la bandeja del portal
# conversaciones con marcas que no son de la carga, y deshacer.sh en seco se niega con ellas, como debe.
if [ -n "${ENSAYO_SIN_DESARME:-}" ]; then
  if [ "${ENSAYO_PRUEBA:-}" != 1 ] || [ "$PROD_PG" = chatwoot-postgres-1 ] || [ "$PROD_STUDIO" = dtd-cargo-db-1 ]; then
    mal G0 "ENSAYO_SIN_DESARME es solo para la prueba de Actions: en el VPS el ensayo completo ensaya el desarme"
    evidencia "HECHO error=sin_desarme_fuera_de_la_prueba"
    exit 2
  fi
fi
[ "$PROYECTO" != "$PROD_PROYECTO" ] || { mal G0 "el proyecto del ensayo es el de producción"; exit 2; }
[ "$(uname -s)" = Linux ] || { mal G0 "el ensayo corre en Linux (el VPS)"; exit 2; }
[ -r "$LISTA" ] || { mal G0 "falta $LISTA"; exit 2; }
# El desarme (R) usa los guiones del 4.6b que deja el 3.0. Si faltara uno, el ensayo completo fallaría al final.
if [ "$SOLO_COPIA" = 0 ] && [ "${ENSAYO_SIN_DESARME:-}" != 1 ]; then
  for f in "$AQUI/deshacer.sh" "$AQUI/deshacer-carga.rb" "$DESHACER_VINCULOS" "$AQUI/deshacer-vinculos.sql"; do
    [ -r "$f" ] || { mal G0 "falta $f (el desarme del ensayo)"; evidencia "HECHO error=falta_un_guion_del_desarme"; exit 2; }
  done
fi
for f in 0006_clients.sql 0106_conversaciones.sql 0337_feature_flags_seed_and_trigger.sql 0503_chatwoot_bandeja.sql \
         0504_chatwoot_eventos.sql 0508_chatwoot_bajas_purga.sql 0519_chatwoot_portal.sql 0520_chatwoot_portal_vuelta.sql \
         0523_chatwoot_portal_carga.sql 0524_chatwoot_portal_puerta4.sql; do
  [ -r "$MIGRACIONES/$f" ] || { mal G0 "falta la migración $MIGRACIONES/$f (MIGRACIONES)"; exit 2; }
done
for f in zz_dtd_redaccion_logs.rb zz_dtd_proteccion_register.rb zz_dtd_revocar_sesiones.rb zz_dtd_correo.rb; do
  [ -r "$CHATWOOT_DIR/rails/$f" ] || { mal G0 "falta $CHATWOOT_DIR/rails/$f"; exit 2; }
done
# Se monta en la copia de Rails: si faltara, Docker crearía en el VPS una carpeta vacía con ese nombre.
[ -d "$CHATWOOT_DIR/correo/views" ] || { mal G0 "falta $CHATWOOT_DIR/correo/views"; exit 2; }
if [ -e "$DIR" ]; then
  mal G0 "$DIR ya existe: quedó un ensayo anterior; revísalo y corre --limpiar"
  exit 1
fi
if docker ps -aq --filter "label=com.docker.compose.project=$PROYECTO" | grep -q .; then
  mal G0 "ya hay contenedores del proyecto $PROYECTO: corre --limpiar"
  exit 1
fi
for c in "$STUDIO_COPIA" "$PG_COPIA" "$RAILS_COPIA" portal-ensayo-redis-1; do
  docker inspect "$c" >/dev/null 2>&1 && { mal G0 "ya existe un contenedor $c que no es de este ensayo"; exit 1; }
done
docker inspect "$PROD_STUDIO" >/dev/null 2>&1 || { mal G0 "no existe $PROD_STUDIO"; exit 1; }
docker inspect "$PROD_PG" >/dev/null 2>&1 || { mal G0 "no existe $PROD_PG"; exit 1; }
LISTA_MD5="$(md5sum "$LISTA" | cut -c1-32)"
evidencia "HECHO lista=copia-columnas.tsv" "HECHO lista_md5=$LISTA_MD5" "HECHO modo=$([ "$SOLO_COPIA" = 1 ] && echo solo-copia || echo completo)"

# TimeoutStopSec de la unidad (SDD-0590 §10.18): solo si este bash es el proceso principal de una unidad.
segundos_systemd() {
  awk -v t="$1" 'BEGIN {
    if (t == "infinity") { print 999999; exit }
    n = split(t, p, " "); s = 0
    for (i = 1; i <= n; i++) {
      v = p[i]
      if (v ~ /^[0-9.]+ms$/) { sub(/ms$/, "", v); s += v / 1000 }
      else if (v ~ /^[0-9.]+min$/) { sub(/min$/, "", v); s += v * 60 }
      else if (v ~ /^[0-9.]+h$/) { sub(/h$/, "", v); s += v * 3600 }
      else if (v ~ /^[0-9.]+s$/) { sub(/s$/, "", v); s += v }
      else if (v ~ /^[0-9]+$/) { s += v }
      else { exit }
    }
    if (n > 0) printf "%d\n", s
  }'
}
UNIDAD_PROPIA=""
if [ -n "${INVOCATION_ID:-}" ]; then
  UNIDAD_PROPIA="$(sed -n 's|^[0-9]*:[^:]*:.*/\([^/]*\.service\)$|\1|p' /proc/self/cgroup 2>/dev/null | head -n 1)"
  if [ -n "$UNIDAD_PROPIA" ] && [ "$(systemctl show -p MainPID --value "$UNIDAD_PROPIA" 2>/dev/null)" != "$$" ]; then
    UNIDAD_PROPIA=""
  fi
fi
if [ -n "$UNIDAD_PROPIA" ]; then
  tope_parada="$(segundos_systemd "$(systemctl show -p TimeoutStopUSec --value "$UNIDAD_PROPIA" 2>/dev/null)")"
  evidencia "HECHO unidad=$UNIDAD_PROPIA" "HECHO unidad_timeout_stop_s=${tope_parada:-ilegible}"
  if ! [ "${tope_parada:-0}" -ge "$TIMEOUT_STOP_MIN_S" ] 2>/dev/null; then
    mal G1 "la unidad $UNIDAD_PROPIA tiene TimeoutStopSec de ${tope_parada:-?} s, menos de $TIMEOUT_STOP_MIN_S. No arranca"
    exit 5
  fi
else
  evidencia "HECHO unidad=ninguna"
fi
vigilar_carga inicio
DISPONIBLE_MB="$(awk '/^MemAvailable:/ { print int($2 / 1024) }' "$MEMINFO_DE" 2>/dev/null)"
evidencia "HECHO memoria_necesaria_mb=$NECESARIO_MB" "HECHO memoria_disponible_mb=${DISPONIBLE_MB:-ilegible}"
if ! [ "${DISPONIBLE_MB:-0}" -ge "$NECESARIO_MB" ] 2>/dev/null; then
  mal MEM0 "MemAvailable ${DISPONIBLE_MB:-ilegible} MB no alcanza: el ensayo necesita $NECESARIO_MB MB. No arranca"
  exit 3
fi

# ── P. Producción antes, en solo lectura ─────────────────────────────────────
# Solo lo que el ensayo nunca debe cambiar: en Studio, las tablas de la carga del tenant (ids y md5) y el flag; en
# Chatwoot, la bandeja del portal y los contactos dtd-portal: de la cuenta. Conteos y md5, nada más.
studio_prod() { # sql → stdout, en una transacción de solo lectura
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$PROD_STUDIO" \
    psql -X -q -At -v ON_ERROR_STOP=1 -U "$PROD_STUDIO_USUARIO" -d "$PROD_STUDIO_DB" -v tenant="$TENANT" "$@"
}
cw_prod() {
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$PROD_PG" \
    psql -X -q -At -v ON_ERROR_STOP=1 -U "$PROD_PG_USUARIO" -d "$PROD_DB" -v cuenta="$CUENTA" -v bandeja="$BANDEJA" "$@"
}
foto_prod() {
  studio_prod -f - <<'SQL'
select 'studio=' || (select count(*) || ':' || coalesce(md5(string_agg(client_id::text || ':' || coalesce(chatwoot_contact_id::text, '-'), ',' order by client_id)), '-') from public.chatwoot_portal_contactos where tenant_id = :'tenant')
  || ',' || (select count(*) || ':' || coalesce(md5(string_agg(conversation_id::text, ',' order by conversation_id)), '-') from public.chatwoot_portal_hilos where tenant_id = :'tenant')
  || ',' || (select count(*) || ':' || coalesce(md5(string_agg(message_id::text || ':' || estado, ',' order by message_id)), '-') from public.chatwoot_portal_salida where tenant_id = :'tenant')
  || ',' || (select count(*) || ':' || coalesce(md5(string_agg(coalesce(corte::text, '-'), ',')), '-') from public.chatwoot_portal_estado where tenant_id = :'tenant')
  || ',flag:' || coalesce((select enabled::text from public.feature_flags where tenant_id = :'tenant' and key = 'chatwoot_portal'), 'sin');
SQL
  cw_prod -f - <<'SQL'
select 'chatwoot=' || (select count(*) from public.conversations where inbox_id = :bandeja)
  || ',' || (select count(*) from public.messages where inbox_id = :bandeja)
  || ',' || (select count(*) from public.contact_inboxes where inbox_id = :bandeja)
  || ',' || (select count(*) from public.contacts where account_id = :cuenta and identifier like 'dtd-portal:%');
SQL
}
log "== P. producción antes (solo lectura)"
foto_prod >"$EVIDENCIA.prod-antes" 2>&1
PROD_ANTES_S="$(sed -n 's/^studio=//p' "$EVIDENCIA.prod-antes")"
PROD_ANTES_C="$(sed -n 's/^chatwoot=//p' "$EVIDENCIA.prod-antes")"
rm -f -- "$EVIDENCIA.prod-antes"
evidencia "HECHO produccion_antes_studio=$PROD_ANTES_S" "HECHO produccion_antes_chatwoot=$PROD_ANTES_C"
exigir P0 '[ -n "$PROD_ANTES_S" ] && [ -n "$PROD_ANTES_C" ]' "foto de producción antes: Studio $PROD_ANTES_S; Chatwoot $PROD_ANTES_C"
case "$PROD_ANTES_S" in *flag:true) mal P0b "chatwoot_portal está encendido para el tenant: la carga y el ensayo no corren con la cola viva" ;; esac
[ "$FALLAS" = 0 ] || exit 1

# ── Las copias ───────────────────────────────────────────────────────────────
mkdir -m 700 "$DIR" || { mal G0 "no se pudo crear $DIR"; exit 1; }
CREADO=1
cat >"$DIR/.env" <<EOF
IMAGEN_CHATWOOT=$IMAGEN_CHATWOOT
IMAGEN_PG=$IMAGEN_PG
IMAGEN_REDIS=$IMAGEN_REDIS
IMAGEN_STUDIO=$IMAGEN_STUDIO
RAILS_DIR=$CHATWOOT_DIR/rails
CORREO_DIR=$CHATWOOT_DIR/correo
MIGRACIONES=$MIGRACIONES
PG_CLAVE=$(openssl rand -hex 24)
STUDIO_CLAVE=$(openssl rand -hex 24)
REDIS_CLAVE=$(openssl rand -hex 24)
SECRET_KEY_BASE=$(openssl rand -hex 64)
AR_PRIMARIA=$(openssl rand -hex 16)
AR_DETERMINISTA=$(openssl rand -hex 16)
AR_SAL=$(openssl rand -hex 16)
EOF
cat >"$DIR/compose.yml" <<'EOF'
# Las copias EFÍMERAS del ensayo de la carga P4 (ensayo-portal.sh). Una sola red, interna, sin puertos.
name: portal-ensayo
services:
  studio:
    image: ${IMAGEN_STUDIO}
    container_name: portal-ensayo-studio-1
    environment:
      POSTGRES_PASSWORD: ${STUDIO_CLAVE}
    volumes:
      - ${MIGRACIONES}:/supabase/migrations:ro
    tmpfs:
      - /var/lib/postgresql/data:size=1g
    networks: [aislada]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 3s
      retries: 40
    mem_limit: 512m
  postgres:
    image: ${IMAGEN_PG}
    container_name: portal-ensayo-postgres-1
    environment:
      POSTGRES_USER: chatwoot
      POSTGRES_PASSWORD: ${PG_CLAVE}
      POSTGRES_DB: chatwoot_production
    tmpfs:
      - /var/lib/postgresql/data:size=1g
    networks: [aislada]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatwoot -d chatwoot_production"]
      interval: 3s
      retries: 40
    mem_limit: 768m
  redis:
    image: ${IMAGEN_REDIS}
    container_name: portal-ensayo-redis-1
    command: ["redis-server", "--requirepass", "${REDIS_CLAVE}", "--save", "", "--appendonly", "no"]
    networks: [aislada]
    mem_limit: 128m
  rails:
    # Sin servidor: solo mantiene un contenedor con la app, para `docker exec` (cargar.sh y db:chatwoot_prepare).
    image: ${IMAGEN_CHATWOOT}
    container_name: portal-ensayo-rails-1
    entrypoint: ["sh", "-c", "trap 'exit 0' TERM; while :; do sleep 3600 & wait $$!; done"]
    environment:
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
      RAILS_LOG_TO_STDOUT: "true"
      LOG_LEVEL: warn
      MAILER_SENDER_EMAIL: ensayo@example.invalid
      SMTP_ADDRESS: smtp.invalid
      SMTP_PORT: "25"
    volumes:
      - ${RAILS_DIR}/zz_dtd_redaccion_logs.rb:/app/config/initializers/zz_dtd_redaccion_logs.rb:ro
      - ${RAILS_DIR}/zz_dtd_proteccion_register.rb:/app/config/initializers/zz_dtd_proteccion_register.rb:ro
      - ${RAILS_DIR}/zz_dtd_revocar_sesiones.rb:/app/config/initializers/zz_dtd_revocar_sesiones.rb:ro
      - ${RAILS_DIR}/zz_dtd_correo.rb:/app/config/initializers/zz_dtd_correo.rb:ro
      - ${CORREO_DIR}/views:/app/dtd-correo/views:ro
    tmpfs:
      - /app/tmp
      - /dev/shm
    networks: [aislada]
    depends_on:
      postgres: { condition: service_healthy }
    mem_limit: 1536m
    cpus: 1.0
networks:
  aislada:
    internal: true
EOF
log "== las copias"
if ! dc up -d --wait studio postgres redis >"$DIR/up.txt" 2>&1 || ! dc up -d rails >>"$DIR/up.txt" 2>&1; then
  mal P1 "las copias no arrancaron"; tail -n 30 "$DIR/up.txt"; exit 1
fi
evidencia "HECHO imagen_studio=$(docker image inspect -f '{{index .RepoDigests 0}}' "$IMAGEN_STUDIO" 2>/dev/null || echo sin_digest)"
vigilar_carga copias

# ── A. Aislamiento, medido ───────────────────────────────────────────────────
log "== A. aislamiento"
contenedores="$(docker ps -q --filter "label=com.docker.compose.project=$PROYECTO")"
exigir A1 '[ "$(docker network inspect -f "{{.Internal}}" "$RED" 2>/dev/null)" = true ]' "la red $RED es internal"
redes_ok=1; puertos_ok=1; nombres_ok=1
for c in $contenedores; do
  [ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c" | xargs)" = "$RED" ] || redes_ok=0
  [ -z "$(docker port "$c")" ] || puertos_ok=0
  case "$(docker inspect -f '{{.Name}}' "$c")" in /portal-ensayo-*) ;; *) nombres_ok=0 ;; esac
done
exigir A2 '[ "$redes_ok" = 1 ] && [ "$(printf "%s\n" $contenedores | grep -c .)" = 4 ]' "los 4 contenedores del ensayo están solo en $RED"
exigir A3 '[ "$puertos_ok" = 1 ]' "ningún puerto publicado"
exigir A4 '[ "$nombres_ok" = 1 ]' "nombres propios (portal-ensayo-*), distintos de los de producción"
cruce=0
for r in $(docker network ls --format '{{.Name}}' | grep -E "^${PROD_PROYECTO}_"); do
  docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$r" | tr ' ' '\n' | grep -q '^portal-ensayo-' && cruce=1
done
exigir A5 '[ "$cruce" = 0 ]' "ningún contenedor del ensayo en una red de producción"
docker exec "$RAILS_COPIA" ruby -rsocket -e '
  ARGV.each do |n|
    begin
      Addrinfo.getaddrinfo(n, nil); puts "HECHO resuelve_#{n.tr("-.", "__")}=si"
    rescue SocketError
      puts "HECHO resuelve_#{n.tr("-.", "__")}=no"
    end
  end
  begin
    Socket.tcp("1.1.1.1", 443, connect_timeout: 3) { }; puts "HECHO salida_internet=si"
  rescue StandardError
    puts "HECHO salida_internet=no"
  end' "$PROD_PG" "$PROD_STUDIO" "$PROD_RAILS" postgres studio >"$DIR/aislamiento.txt" 2>&1 </dev/null
F="$DIR/aislamiento.txt"
r_() { h "$F" "resuelve_$(printf '%s' "$1" | tr -- '-.' '__')"; }
exigir A6 '[ "$(r_ "$PROD_PG")" = no ] && [ "$(r_ "$PROD_STUDIO")" = no ] && [ "$(r_ "$PROD_RAILS")" = no ] && [ "$(r_ postgres)" = si ] && [ "$(r_ studio)" = si ]' \
  "desde la copia no se resuelven $PROD_PG, $PROD_STUDIO ni $PROD_RAILS; postgres y studio son los de la copia"
exigir A7 '[ "$(h "$F" salida_internet)" = no ]' "sin salida a internet"
evidencia "$(grep '^HECHO ' "$F")" "HECHO db_cw=$RAILS_COPIA" "HECHO db_cw_red=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$RAILS_COPIA")"
[ "$FALLAS" = 0 ] || { log "aislamiento con fallas: no se copia nada"; exit 1; }

# ── Esquema, sin datos ───────────────────────────────────────────────────────
log "== esquema de las copias, sin datos"
studio_copia() { docker exec -i "$STUDIO_COPIA" psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
cw_copia() { docker exec -i "$PG_COPIA" psql -X -q -At -v ON_ERROR_STOP=1 -U chatwoot -d chatwoot_production "$@"; }
studio_copia -f - <"$AQUI/ensayo-studio-esquema.sql" >"$DIR/esquema-studio.txt" 2>&1
exigir S1 '[ "$(studio_copia -c "select count(distinct proname) from pg_proc where proname in ('"'"'chatwoot_portal_carga_lineas'"'"', '"'"'chatwoot_portal_vincular_carga'"'"', '"'"'chatwoot_portal_reservar_contactos'"'"')")" = 3 ] && [ "$(studio_copia -c "select count(*) from public.tenants")" = 0 ]' \
  "Studio: el esquema de ensayo-studio-esquema.sql, con las funciones de la carga y 0 tenants"
docker exec "$RAILS_COPIA" bundle exec rails db:chatwoot_prepare >"$DIR/esquema-chatwoot.txt" 2>&1 </dev/null
exigir S2 '[ "$(cw_copia -c "select to_regclass('"'"'public.conversations'"'"') is not null")" = t ] && [ "$(cw_copia -c "select count(*) from public.accounts")" = 0 ]' \
  "Chatwoot: el esquema de la imagen (db:chatwoot_prepare), con 0 cuentas"
[ "$FALLAS" = 0 ] || { tail -n 20 "$DIR/esquema-studio.txt" "$DIR/esquema-chatwoot.txt"; exit 1; }

# ── Los tipos de las columnas de la lista: producción frente a la copia ──────
# El esquema de la copia de Studio se arma en parte a mano (ensayo-studio-esquema.sql). El --solo-copia del 2026-11-14
# falló a medias porque crm_historial_etapas.id era uuid en la copia y bigint en producción: el COPY se cortó, y
# columnas_md5 no lo vio porque solo mide los nombres. Antes de copiar nada se compara «tabla.columna:tipo» de cada
# columna de la lista, a cada lado, en el catálogo (format_type). Solo nombres y tipos, nunca datos. Una columna que
# no existe sale como «ausente». Si un lado no coincide, se para con 7, sin copiar.
# El orden no depende de la base (revisión del DG de la #563, B1): producción de Studio es supabase/postgres y la copia
# es postgres:17, y pueden ordenar distinto «event:» y «event_key:». Por eso la consulta ordena con `collate "C"` y el
# `sort` corre con LC_ALL=C: sin eso, el `diff` daría un 7 falso sin ningún tipo distinto.
tipos_sql() { # lado → la consulta del catálogo para las columnas de ese lado de la lista
  awk -F'\t' -v lado="$1" '
    $1 == lado {
      n = split($3, c, ";")
      for (i = 1; i <= n; i++) { sub(/=.*/, "", c[i]); v = v (v ? ", " : "") "(\047" $2 "\047, \047" c[i] "\047)" }
    }
    END {
      if (v == "") exit 1
      print "select (v.t || \047.\047 || v.c || \047:\047 || coalesce((select pg_catalog.format_type(a.atttypid, a.atttypmod) from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(v.t) and a.attname = v.c and a.attnum > 0 and not a.attisdropped), \047ausente\047)) collate \042C\042 from (values " v ") v(t, c) order by 1"
    }' "$LISTA"
}
tipos_columnas() { awk -F'\t' -v lado="$1" '$1 == lado { n += split($3, c, ";") } END { print n + 0 }' "$LISTA"; }
comparar_tipos() { # lado id
  local lado="$1" q esperadas prod copia distintas ausentes consulta
  q="$(tipos_sql "$lado")" || { mal "$2" "$lado: copia-columnas.tsv no trae columnas de ese lado: no hay nada que comparar"; evidencia "HECHO tipos_$lado=lista_sin_columnas"; LISTA_SIN_COLUMNAS=1; return 0; }
  esperadas="$(tipos_columnas "$lado")"
  if [ "$lado" = studio ]; then
    studio_prod -c "$q" >"$DIR/tipos-$lado-prod.txt" 2>&1
    studio_copia -c "$q" >"$DIR/tipos-$lado-copia.txt" 2>&1
  else
    cw_prod -c "$q" >"$DIR/tipos-$lado-prod.txt" 2>&1
    cw_copia -c "$q" >"$DIR/tipos-$lado-copia.txt" 2>&1
  fi
  # Cada línea tiene que ser «esquema.tabla.columna:tipo»: si psql falló, su error no se lee como columna ni va a la
  # evidencia (solo «fallida»).
  prod="$(grep -cE '^[a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+:.+$' "$DIR/tipos-$lado-prod.txt")"
  copia="$(grep -cE '^[a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+:.+$' "$DIR/tipos-$lado-copia.txt")"
  consulta=ok
  [ "$prod" = "$esperadas" ] && [ "$prod" = "$(grep -c . "$DIR/tipos-$lado-prod.txt")" ] \
    && [ "$copia" = "$esperadas" ] && [ "$copia" = "$(grep -c . "$DIR/tipos-$lado-copia.txt")" ] || consulta=fallida
  distintas=ninguna
  if [ "$consulta" = ok ]; then
    # Las cinco primeras, y cuántas son: alcanza para encontrarlas en el esquema del ensayo.
    distintas="$(diff "$DIR/tipos-$lado-prod.txt" "$DIR/tipos-$lado-copia.txt" | sed -n 's/^[<>] \([^:]*\):.*/\1/p' | LC_ALL=C sort -u)"
    distintas="$([ -n "$distintas" ] && printf '%s' "$(printf '%s\n' "$distintas" | grep -c .):$(printf '%s\n' "$distintas" | head -n 5 | paste -sd, -)" || echo ninguna)"
  fi
  ausentes="$(cat "$DIR/tipos-$lado-prod.txt" "$DIR/tipos-$lado-copia.txt" | grep -c ':ausente$')"
  evidencia "HECHO tipos_${lado}_columnas=$esperadas" "HECHO tipos_${lado}_consulta=$consulta"
  if [ "$consulta" = ok ] && [ "$distintas" = ninguna ] && [ "$ausentes" = 0 ]; then
    evidencia "HECHO tipos_$lado=iguales" "HECHO tipos_${lado}_md5=$(md5sum <"$DIR/tipos-$lado-prod.txt" | cut -c1-12)"
    ok "$2" "$lado: las $esperadas columnas de la lista tienen el mismo tipo en producción y en la copia"
  else
    evidencia "HECHO tipos_$lado=distintos" "HECHO tipos_${lado}_distintos=$distintas" "HECHO tipos_${lado}_ausentes=$ausentes"
    mal "$2" "$lado: los tipos de la lista no son los mismos en producción y en la copia (consulta $consulta, distintas $distintas, $ausentes ausentes). No se copia nada"
  fi
  rm -f -- "$DIR/tipos-$lado-prod.txt" "$DIR/tipos-$lado-copia.txt"
}
log "== tipos de las columnas de la lista, producción frente a la copia"
LISTA_SIN_COLUMNAS=0
comparar_tipos studio S3
comparar_tipos chatwoot S4
if [ "$LISTA_SIN_COLUMNAS" = 1 ]; then
  # No es un tipo distinto: la lista está mal. Sale con 1, como cualquier otra falla.
  evidencia "HECHO error=lista_sin_columnas"
  exit 1
elif [ "$FALLAS" != 0 ]; then
  evidencia "HECHO error=tipos_distintos"
  exit 7
fi
# Marca de cada copia: una tabla que producción nunca tiene, con un valor aleatorio de este momento.
MARCA="$(openssl rand -hex 16)"
studio_copia -c "create table public._dtd_ensayo_marca (valor text not null); insert into public._dtd_ensayo_marca values ('$MARCA')" >/dev/null
cw_copia -c "create table public._dtd_ensayo_marca (valor text not null); insert into public._dtd_ensayo_marca values ('$MARCA')" >/dev/null

# ── D. Los datos, con la lista explícita ─────────────────────────────────────
# copiar_tabla lado tabla columnas filtro: COPY de producción (solo lectura, repeatable read: el conteo y el COPY ven
# la misma foto) a la copia (session_replication_role = replica: sin disparadores ni FK). El conteo sale por \warn.
copiar_tabla() {
  local lado="$1" tabla="$2" columnas="$3" filtro="$4" sel="" nombres="" item nombre sql salida err prod filas md5c
  local IFS=';'
  set -f # sin comodines: las expresiones pueden llevar `*`
  for item in $columnas; do
    if [ "${item#*=}" != "$item" ]; then
      nombre="${item%%=*}"; sel="$sel${sel:+, }(${item#*=}) as $nombre"
    else
      nombre="$item"; sel="$sel${sel:+, }$item"
    fi
    nombres="$nombres${nombres:+, }$nombre"
  done
  unset IFS
  set +f
  sql="\\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '300s';
select count(*) as filas from $tabla where $filtro \\gset
\\warn HECHO filas_prod=:filas
copy (select $sel from $tabla where $filtro) to stdout;
commit;"
  err="$DIR/copia-$lado-$tabla.err"
  if [ "$lado" = studio ]; then
    printf '%s\n' "$sql" | studio_prod -f - 2>"$err" \
      | docker exec -i -e PGOPTIONS='-c session_replication_role=replica' "$STUDIO_COPIA" \
          psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "copy $tabla ($nombres) from stdin" >>"$err" 2>&1
  else
    printf '%s\n' "$sql" | cw_prod -v usuarios="$USUARIOS" -f - 2>"$err" \
      | docker exec -i -e PGOPTIONS='-c session_replication_role=replica' "$PG_COPIA" \
          psql -X -q -v ON_ERROR_STOP=1 -U chatwoot -d chatwoot_production -c "copy $tabla ($nombres) from stdin" >>"$err" 2>&1
  fi
  salida="${PIPESTATUS[0]}:${PIPESTATUS[1]}:${PIPESTATUS[2]}"
  prod="$(sed -n 's/^HECHO filas_prod=//p' "$err" | tail -n 1)"
  if [ "$lado" = studio ]; then filas="$(studio_copia -c "select count(*) from $tabla")"; else filas="$(cw_copia -c "select count(*) from $tabla")"; fi
  md5c="$(printf '%s' "$columnas" | md5sum | cut -c1-12)"
  evidencia "HECHO copia_${lado}_${tabla}=filas:${filas:-?},produccion:${prod:-?},columnas_md5:$md5c"
  if [ "$salida" != 0:0:0 ] || [ -z "$prod" ] || [ "$filas" != "$prod" ]; then
    D_FALLAS=$((D_FALLAS + 1))
    mal D1 "$lado $tabla: la copia no salió entera (salida $salida, producción ${prod:-?} filas, copia ${filas:-?})"
    evidencia "HECHO copia_${lado}_${tabla}_error=$(grep -v '^HECHO' "$err" | grep -oE 'ERROR: +[a-z_ ]+' | head -n 1 | tr ' ' '_')"
  fi
  rm -f -- "$err"
}
copiar_lado() { # lado
  local lado tabla columnas filtro n=0
  # La lista entra por el descriptor 3: los `docker exec -i` de copiar_tabla leen la entrada estándar y se comerían el
  # resto de la lista (el run 42535639790 copió una sola tabla por lado).
  while IFS=$'\t' read -r -u 3 lado tabla columnas filtro; do
    case "$lado" in '' | '#'*) continue ;; esac
    [ "$lado" = "$1" ] || continue
    copiar_tabla "$lado" "$tabla" "$columnas" "$filtro"
    n=$((n + 1))
  done 3<"$LISTA"
  evidencia "HECHO copia_${1}_tablas=$n"
}
D_FALLAS=0
log "== D. copia de los datos, por la lista ($LISTA_MD5)"
copiar_lado studio
# Los usuarios de Chatwoot que la carga firma: el de servicio y los agentes vinculados en la copia de Studio.
USUARIOS="$( { echo "$AGENTE_SERVICIO"; studio_copia -v tenant="$TENANT" -c "select chatwoot_user_id from public.chatwoot_agent_links where tenant_id = '$TENANT'"; } | grep -E '^[0-9]+$' | sort -un | paste -sd, -)"
evidencia "HECHO usuarios_chatwoot=$(printf '%s' "$USUARIOS" | tr ',' '\n' | grep -c .)"
copiar_lado chatwoot
# Las secuencias de la copia de Chatwoot: los ids nuevos van después de los copiados, y los números de conversación
# (C-9) siguen al último de producción.
ULTIMO_DPID="$(cw_prod -c "select last_value from public.conv_dpid_seq_$CUENTA" 2>/dev/null)"
numero "$ULTIMO_DPID" || ULTIMO_DPID=0
cw_copia -f - >"$DIR/secuencias.txt" 2>&1 <<SQL
create sequence if not exists public.conv_dpid_seq_$CUENTA;
create sequence if not exists public.camp_dpid_seq_$CUENTA;
select setval('public.conv_dpid_seq_$CUENTA', greatest($ULTIMO_DPID, (select coalesce(max(display_id), 0) from public.conversations where account_id = $CUENTA), 1));
do \$\$ declare t text; begin
  foreach t in array array['accounts', 'channel_api', 'inboxes', 'users', 'account_users', 'contacts', 'contact_inboxes', 'conversations', 'messages', 'webhooks'] loop
    execute format('select setval(pg_get_serial_sequence(%L, %L), (select coalesce(max(id), 0) + 1 from public.%I), false)', 'public.' || t, 'id', t);
  end loop;
end \$\$;
SQL
evidencia "HECHO secuencia_conversaciones=$ULTIMO_DPID"
exigir D2 '[ "$D_FALLAS" = 0 ] && [ "$(h "$EVIDENCIA" copia_studio_tablas)" -gt 0 ] 2>/dev/null && [ "$(h "$EVIDENCIA" copia_chatwoot_tablas)" -gt 0 ] 2>/dev/null' "las $(h "$EVIDENCIA" copia_studio_tablas) tablas de Studio y las $(h "$EVIDENCIA" copia_chatwoot_tablas) de Chatwoot, con las filas de producción (ver copia_* en la evidencia)"

# ── O. Solo el tenant y la cuenta ────────────────────────────────────────────
otras_studio="$(studio_copia -c "select coalesce(sum(n), 0) from (
  select count(*) n from public.tenants where id <> '$TENANT'
  union all select count(*) from public.clients where tenant_id <> '$TENANT'
  union all select count(*) from public.conversations where tenant_id <> '$TENANT'
  union all select count(*) from public.conversation_messages where tenant_id <> '$TENANT'
  union all select count(*) from public.conversations where channel <> 'portal') x")"
otras_cw="$(cw_copia -c "select coalesce(sum(n), 0) from (
  select count(*) n from public.accounts where id <> $CUENTA
  union all select count(*) from public.inboxes where id <> $BANDEJA or account_id <> $CUENTA
  union all select count(*) from public.contacts where account_id <> $CUENTA or identifier not like 'dtd-portal:%'
  union all select count(*) from public.conversations where inbox_id <> $BANDEJA
  union all select count(*) from public.messages where inbox_id <> $BANDEJA
  union all select count(*) from public.account_users where account_id <> $CUENTA
  union all select count(*) from public.webhooks where account_id <> $CUENTA) x")"
evidencia "HECHO otras_filas_studio=$otras_studio" "HECHO otras_filas_chatwoot=$otras_cw"
exigir O1 '[ "$otras_studio" = 0 ] && [ "$otras_cw" = 0 ]' \
  "en las copias solo está el tenant, la cuenta $CUENTA y la bandeja $BANDEJA: 0 filas de otros en Studio ($otras_studio) y en Chatwoot ($otras_cw)"
if [ -n "${ENSAYO_VOLCADO:-}" ]; then
  # Solo en la prueba de Actions (guarda G0): el volcado de las copias, para buscar las marcas de la producción simulada.
  mkdir -p "$ENSAYO_VOLCADO"
  docker exec "$STUDIO_COPIA" pg_dump -U postgres -d postgres --data-only >"$ENSAYO_VOLCADO/studio.sql" 2>/dev/null
  docker exec "$PG_COPIA" pg_dump -U chatwoot -d chatwoot_production --data-only >"$ENSAYO_VOLCADO/chatwoot.sql" 2>/dev/null
fi
[ "$FALLAS" = 0 ] || { log "la copia no quedó como dice la lista: no se carga"; exit 1; }

# ── E. La carga, en las copias ───────────────────────────────────────────────
if [ "$SOLO_COPIA" = 0 ]; then
  log "== E. la carga en las copias"
  CTL() { studio_copia -v tenant="$TENANT" -f - <"$AQUI/controles-studio.sql" >"$1" 2>&1; }
  ctl() { sed -n "s/^$2 //p" "$1" | head -n 1; }
  extraer() { DB="$STUDIO_COPIA" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" bash "$AQUI/extraer.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }
  cargar() { DB_CW="$RAILS_COPIA" CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$AGENTE_SERVICIO" MODO="$2" bash "$AQUI/cargar.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }
  vincular() { DB="$STUDIO_COPIA" TENANT="$TENANT" bash "$AQUI/vincular.sh" >"$1" 2>&1; echo "HECHO salida_proceso=$?" >>"$1"; }
  corte() { studio_copia -c "select count(*) || ':' || count(corte) from public.chatwoot_portal_estado where tenant_id = '$TENANT'"; }
  paso() { evidencia "HECHO paso=$1" "$(grep '^HECHO ' "$DIR/$1.txt" | grep -v '^HECHO paso=')"; }
  # Antes de cada paso que escribe: el contenedor de Chatwoot es el de la copia, en su red.
  es_la_copia() {
    [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$RAILS_COPIA" 2>/dev/null)" = "$PROYECTO" ] \
      && [ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$RAILS_COPIA" | xargs)" = "$RED" ] \
      && [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$STUDIO_COPIA" 2>/dev/null)" = "$PROYECTO" ]
  }
  exigir E0 'es_la_copia' "$RAILS_COPIA y $STUDIO_COPIA son del proyecto $PROYECTO, en $RED"
  [ "$FALLAS" = 0 ] || exit 1
  CTL "$DIR/controles-antes.txt"
  vigilar_carga extraer
  extraer "$DIR/extraer-1.txt"; paso extraer-1
  cargar "$DIR/seco.txt" seco; paso seco
  F="$DIR/seco.txt"
  exigir E1 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" carga)" = ok ] && [ "$(h "$F" contenedor_limpio)" = si ] && avance "$(h "$F" secuencia)" 0 && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && [ "$(h "$F" correos_enviados)" = 0 ] && cero "$(h "$F" conversaciones_existentes)" && cero "$(h "$F" conversaciones_estado_actualizado)" && [ ! -e "$SHM/vinculos.ndjson" ]' \
    "seco: lee $(h "$F" leidas), no escribe, no consume números ($(h "$F" secuencia)), no encola, sin vínculos y el contenedor limpio"
  vigilar_carga cargar
  cargar "$DIR/carga-1.txt" cargar; paso carga-1
  F="$DIR/carga-1.txt"
  S="$DIR/seco.txt"
  exigir E2 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" carga)" = ok ] && [ "$(h "$F" conversaciones_nuevas)" = "$(h "$S" conversaciones_nuevas)" ] && [ "$(h "$F" mensajes_nuevos)" = "$(h "$S" mensajes_nuevos)" ] && [ "$(h "$F" contactos_nuevos)" = "$(h "$S" contactos_nuevos)" ] && avance "$(h "$F" secuencia)" "$(h "$F" conversaciones_nuevas)" && [ "$(h "$F" trabajos_nuevos)" = ninguno ] && [ "$(h "$F" correos_enviados)" = 0 ] && cero "$(h "$F" conversaciones_estado_actualizado)" && [ "$(stat -c %a "$SHM/vinculos.ndjson" 2>/dev/null)" = 600 ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
    "carga: $(h "$F" conversaciones_nuevas) conversaciones, $(h "$F" mensajes_nuevos) mensajes, $(h "$F" contactos_nuevos) contactos, lo mismo que el seco; la secuencia avanza eso ($(h "$F" secuencia)); vínculos en 0600"
  cp "$SHM/vinculos.ndjson" "$DIR/vinculos-1.ndjson" 2>/dev/null
  # C-10, C-12 y C-13 sobre lo cargado en la copia (revisión del DG de la #473): de la copia de Chatwoot salen solo ids,
  # estados y source_id; el preparado se lee en tmpfs y del cruce salen solo conteos.
  cw_copia -F '|' -c "select additional_attributes->>'dtd_hilo', status from public.conversations
    where inbox_id = $BANDEJA and additional_attributes ? 'dtd_hilo'" >"$DIR/cw-estados.txt" 2>&1
  cw_copia -F '|' -c "select c.additional_attributes->>'dtd_hilo', m.source_id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.inbox_id = $BANDEJA and m.source_id like 'dtd:%' and m.source_id not like 'dtd:archivado:%'
    order by c.id, m.created_at, m.id" >"$DIR/cw-orden.txt" 2>&1
  python3 -I -c 'import json, sys
estado, orden = {}, {}
for linea in open(sys.argv[1], encoding="utf-8"):
    f = json.loads(linea)
    if f["tipo"] == "conversacion":
        estado[f["hilo"]] = f["estado"]
    elif f["tipo"] == "mensaje":
        orden.setdefault(f["hilo"], []).append(f["source_id"])
nombre = {"0": "open", "1": "resolved", "2": "pending", "3": "snoozed"}
real_estado, real_orden = {}, {}
for linea in open(sys.argv[2], encoding="utf-8"):
    h, _, s = linea.strip().partition("|")
    real_estado[h] = nombre.get(s, s)
for linea in open(sys.argv[3], encoding="utf-8"):
    h, _, s = linea.strip().partition("|")
    real_orden.setdefault(h, []).append(s)
print("HECHO c13_hilos=%d" % len(estado))
print("HECHO c13_diferencias=%d" % sum(1 for h, e in estado.items() if real_estado.get(h) != e))
print("HECHO c12_hilos=%d" % len(orden))
print("HECHO c12_diferencias=%d" % sum(1 for h, o in orden.items() if real_orden.get(h) != o))' \
    "$SHM/preparado.ndjson" "$DIR/cw-estados.txt" "$DIR/cw-orden.txt" >"$DIR/c12-c13.txt" 2>&1
  rm -f -- "$DIR/cw-estados.txt" "$DIR/cw-orden.txt"
  cw_copia -c "select 'HECHO c10_contactos=' || count(*) || E'\nHECHO c10_con_datos=' || count(*) filter (where phone_number is not null or email is not null)
    from public.contacts where account_id = $CUENTA and identifier like 'dtd-portal:%'
      and id in (select contact_id from public.contact_inboxes where inbox_id = $BANDEJA)" >"$DIR/c10.txt" 2>&1
  cw_copia -c "select 'HECHO c10_huerfanos=' || (
      (select count(*) from public.messages m where m.inbox_id = $BANDEJA and not exists (select 1 from public.conversations c where c.id = m.conversation_id))
    + (select count(*) from public.conversations c where c.inbox_id = $BANDEJA and not exists (select 1 from public.contacts k where k.id = c.contact_id))
    + (select count(*) from public.contact_inboxes i where i.inbox_id = $BANDEJA and not exists (select 1 from public.contacts k where k.id = i.contact_id)))" >>"$DIR/c10.txt" 2>&1
  evidencia "$(grep '^HECHO ' "$DIR/c10.txt")" "$(grep '^HECHO ' "$DIR/c12-c13.txt")"
  F="$DIR/c10.txt"
  exigir V10 '[ "$(h "$F" c10_contactos)" -gt 0 ] 2>/dev/null && [ "$(h "$F" c10_con_datos)" = 0 ] && [ "$(h "$F" c10_huerfanos)" = 0 ]' \
    "C-10: los $(h "$F" c10_contactos) contactos de la bandeja, sin teléfono ni correo ($(h "$F" c10_con_datos)), y 0 huérfanos ($(h "$F" c10_huerfanos))"
  F="$DIR/c12-c13.txt"
  exigir V12 '[ "$(h "$F" c12_hilos)" -gt 0 ] 2>/dev/null && [ "$(h "$F" c12_diferencias)" = 0 ]' \
    "C-12: el orden de los mensajes de los $(h "$F" c12_hilos) hilos es el del preparado ($(h "$F" c12_diferencias) diferencias)"
  exigir V13 '[ "$(h "$F" c13_hilos)" -gt 0 ] 2>/dev/null && [ "$(h "$F" c13_diferencias)" = 0 ]' \
    "C-13: el estado de las $(h "$F" c13_hilos) conversaciones es el del preparado ($(h "$F" c13_diferencias) diferencias)"
  # Los casos provocados: vínculos alterados que vincular.sh tiene que negar sin cambiar Studio (22023).
  alterar() { # modo → $SHM/vinculos.ndjson
    python3 -I -c 'import json, sys
lineas = open(sys.argv[1], encoding="utf-8").read().splitlines()
modo = sys.argv[2]
if modo == "menos-sin-cabecera":
    del lineas[max(i for i, l in enumerate(lineas) if json.loads(l)["tipo"] == "mensaje")]
else:
    c = min(i for i, l in enumerate(lineas) if json.loads(l)["tipo"] == "contacto")
    fila = json.loads(lineas[c])
    if modo == "contacto-nulos":
        fila["contacto_id"] = None
    fila["source_id"] = ""
    lineas[c] = json.dumps(fila, separators=(",", ":"))
open(sys.argv[3], "w", encoding="utf-8", newline="\n").write("\n".join(lineas) + "\n")' "$DIR/vinculos-1.ndjson" "$1" "$SHM/vinculos.ndjson"
  }
  caso() { # id modo error-esperado descripción
    local id="$1"
    alterar "$2"
    CTL "$DIR/controles-$id-antes.txt"
    CORTE_ANTES="$(corte)"
    vincular "$DIR/vincular-$id.txt"; paso "vincular-$id"
    CTL "$DIR/controles-$id-despues.txt"
    ERR_C="$3"; VC="$DIR/vincular-$id.txt"; CA="$DIR/controles-$id-antes.txt"; CD="$DIR/controles-$id-despues.txt"
    exigir "$id" '[ "$(h "$VC" salida_proceso)" != 0 ] && grep -qF -- "$ERR_C" "$VC" && cmp -s "$CA" "$CD" && [ "$(corte)" = "$CORTE_ANTES" ]' \
      "$4: vincular se niega («$ERR_C») y Studio no cambia ($(corte))"
  }
  caso CA menos-sin-cabecera "los conteos de la cabecera no son los de las líneas" "(a) un mensaje menos"
  caso B1 contacto-nulos "id de contacto inválido" "(B1) contacto_id nulo y source_id vacío"
  caso B2 contacto-sin-source "falta el source_id del contacto" "(B2) solo el source_id vacío"
  # (c) repetir desde la extracción: limpiar.sh (4.7), extraer, cargar y vincular.
  bash "$AQUI/limpiar.sh" >"$DIR/limpiar.txt" 2>&1
  extraer "$DIR/extraer-2.txt"; paso extraer-2
  cargar "$DIR/carga-2.txt" cargar; paso carga-2
  vincular "$DIR/vincular.txt"; paso vincular
  F="$DIR/carga-2.txt"
  exigir C1 '[ "$(h "$F" salida_proceso)" = 0 ] && [ "$(h "$F" carga)" = ok ] && cero "$(h "$F" conversaciones_nuevas)" && cero "$(h "$F" mensajes_nuevos)" && cero "$(h "$F" contactos_nuevos)" && cero "$(h "$F" conversaciones_estado_actualizado)"' \
    "(c) repetir: no entra nada nuevo ($(h "$F" conversaciones_existentes) conversaciones existentes)"
  exigir C2 '[ "$(h "$DIR/vincular.txt" salida_proceso)" = 0 ] && [ ! -e "$SHM" ] && [ "$(corte)" = 1:1 ]' \
    "vincular entra, borra $SHM, y queda un solo corte ($(corte))"
  dobles="$(cw_copia -c "select (select count(*) - count(distinct additional_attributes->>'dtd_hilo') from public.conversations where inbox_id = $BANDEJA and additional_attributes ? 'dtd_hilo') + (select count(*) - count(distinct source_id) from public.messages where inbox_id = $BANDEJA)")"
  evidencia "HECHO dobles_chatwoot=$dobles"
  exigir C3 '[ "$dobles" = 0 ]' "en Chatwoot no quedó nada doble ($dobles)"
  CTL "$DIR/controles-despues.txt"
  A="$DIR/controles-antes.txt"; Z="$DIR/controles-despues.txt"
  evidencia "$(sed 's/^/HECHO controles_antes /' "$A")" "$(sed 's/^/HECHO controles_despues /' "$Z")"
  exigir K1 '[ -n "$(ctl "$A" "C-6 conversations")" ] && [ "$(ctl "$A" "C-6 conversations")" = "$(ctl "$Z" "C-6 conversations")" ] && [ "$(ctl "$A" "C-6 conversation_messages")" = "$(ctl "$Z" "C-6 conversation_messages")" ]' \
    "C-6: los hilos y los mensajes de Studio, iguales antes y después"
  exigir K2 '[ "$(grep "^C-7" "$A")" = "$(grep "^C-7" "$Z")" ] && [ -n "$(grep "^C-7" "$A")" ]' "C-7: el CRM y los eventos, iguales antes y después"
  c8() { sed -n "s/.*$1=\([0-9]*\).*/\1/p" "$Z" | head -n 1; } # c8 clave: el número de esa clave de C-8
  exigir K3 '[ "$(c8 hilos_vinculados)" -gt 0 ] 2>/dev/null && [ "$(c8 con_espejo)" = "$(c8 hilos_vinculados)" ] && [ "$(c8 client_id_distinto)" = 0 ]' \
    "C-8: $(c8 hilos_vinculados) hilos vinculados, con $(c8 con_espejo) espejos y $(c8 client_id_distinto) clientes distintos"
  # ── R. Las dos vueltas atrás del 4.6b, ensayadas en las copias ──────────────
  # Decisión A del DG (2026-11-14): el 3.1 ensaya también el desarme, sin el paso que borra. Sobre las copias:
  #   R0  la guarda: DB y DB_CW son los contenedores de la copia (proyecto portal-ensayo, solo en la red aislada) y
  #       nunca dtd-cargo-db-1, chatwoot-postgres-1 ni chatwoot-rails-1. Si no, la etapa no corre y no escribe nada;
  #   R1  deshacer.sh MODO=seco ve exactamente lo cargado: su antes= es el despues= de la última carga del ensayo;
  #   R2  deshacer.sh MODO=borrar CONFIRMAR=no: ROLLBACK, la bandeja de la copia de Chatwoot queda igual;
  #   R3  deshacer-vinculos.sh ENTORNO=copia MODO=ensayo: ROLLBACK, la copia de Studio y C-6 a C-8 quedan iguales;
  #   R4  la copia durable del 4.6b (/srv/ops/portal-historial/deshacer) no se crea ni cambia, y los .hecho y el
  #       .ndjson quedan solo en /dev/shm/portal-historial, que la limpieza del trap borra.
  # Los conteos esperados de deshacer-vinculos.sh salen de C-8 de la copia (como en 4.2) y de sus contactos. Solo
  # conteos, ids y hashes en la evidencia. La auditoría del flag (entity_audit_log) va vacía en la copia: en la copia no
  # se prueba «encendido alguna vez», que mide en producción el 4.1 (cola-y-flag.sql) y el paso 1 de verdad.
  if [ "${ENSAYO_SIN_DESARME:-}" = 1 ]; then
    log "== R. el desarme: NO EJECUTADO (ENSAYO_SIN_DESARME, solo en la prueba de Actions)"
    evidencia "HECHO desarme=omitido_en_la_prueba"
  else
    log "== R. las dos vueltas atrás del 4.6b, ensayadas en las copias"
    desarme_es_la_copia() { # studio chatwoot: los dos son de la copia, en la red aislada y con su nombre fijo
      local c
      for c in "$1" "$2"; do
        case "$c" in dtd-cargo-db-1 | chatwoot-postgres-1 | chatwoot-rails-1 | "$PROD_STUDIO" | "$PROD_PG" | "$PROD_RAILS") return 1 ;; esac
        [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null)" = "$PROYECTO" ] || return 1
        [ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c" 2>/dev/null | xargs)" = "$RED" ] || return 1
      done
      [ "$1" = "$STUDIO_COPIA" ] && [ "$2" = "$RAILS_COPIA" ]
    }
    durable_foto() { if [ -e "$DURABLE_4_6B" ]; then echo "presente:$(ls -A "$DURABLE_4_6B" 2>/dev/null | grep -c .)"; else echo ausente; fi; }
    bandeja_cw() {
      cw_copia -c "select 'conversaciones:' || (select count(*) from public.conversations where inbox_id = $BANDEJA)
        || ',mensajes:' || (select count(*) from public.messages where inbox_id = $BANDEJA)
        || ',contact_inboxes:' || (select count(*) from public.contact_inboxes where inbox_id = $BANDEJA)
        || ',contactos:' || (select count(*) from public.contacts where account_id = $CUENTA and identifier like 'dtd-portal:%')"
    }
    contactos_vinculados() { studio_copia -c "select count(*) from public.chatwoot_portal_contactos where tenant_id = '$TENANT' and chatwoot_contact_id is not null"; }
    deshacer_cw() { # salida modo [confirmar]
      env DB="$R_DB" DB_CW="$R_CW" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" MODO="$2" ${3:+CONFIRMAR="$3"} \
        bash "$AQUI/deshacer.sh" >"$1" 2>&1
      echo "HECHO salida_proceso=$?" >>"$1"
    }
    R_DB="$STUDIO_COPIA"; R_CW="$RAILS_COPIA"
    if desarme_es_la_copia "$R_DB" "$R_CW"; then
      ok R0 "el desarme corre solo en las copias: $R_DB y $R_CW son del proyecto $PROYECTO, en $RED"
      evidencia "HECHO desarme_guarda=ok"
      DURABLE_ANTES="$(durable_foto)"
      CARGADO="$(h "$DIR/carga-2.txt" despues)"
      deshacer_cw "$DIR/desarme-seco.txt" seco; paso desarme-seco
      F="$DIR/desarme-seco.txt"
      R1_ANTES="$(h "$F" antes)"
      exigir R1 '[ "$(h "$F" salida_proceso)" = 0 ] && grep -qx "HECHO deshacer=ok" "$F" && [ -n "$CARGADO" ] && [ "$R1_ANTES" = "$CARGADO" ] && [ "${CARGADO#conversaciones:0,}" = "$CARGADO" ] && [ -s "$SHM/chatwoot-seco.hecho" ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
        "deshacer.sh en seco ve exactamente lo cargado ($R1_ANTES, la carga dejó $CARGADO), con $(h "$F" contactos_a_borrar) contactos a borrar y el contenedor limpio"
      CW_ANTES="$(bandeja_cw)"
      deshacer_cw "$DIR/desarme-1b.txt" borrar no; paso desarme-1b
      CW_DESPUES="$(bandeja_cw)"
      evidencia "HECHO desarme_cw_antes=$CW_ANTES" "HECHO desarme_cw_despues=$CW_DESPUES"
      F="$DIR/desarme-1b.txt"
      exigir R2 '[ "$(h "$F" salida_proceso)" = 0 ] && grep -qx "HECHO deshacer=ok" "$F" && grep -qx "HECHO fin=rollback" "$F" && [ -n "$CW_ANTES" ] && [ "$CW_ANTES" = "$CW_DESPUES" ] && [ ! -e "$SHM/chatwoot-borrar.hecho" ] && [ "$(h "$F" contenedor_limpio)" = si ]' \
        "deshacer.sh MODO=borrar CONFIRMAR=no termina en ROLLBACK y la copia de Chatwoot queda igual ($CW_DESPUES)"
      # La marca de la copia que pide deshacer-vinculos.sql para ENTORNO=copia, guardada para la base de la copia.
      studio_copia -c "alter database postgres set dtd.entorno = 'copia'" >/dev/null 2>&1
      CTL "$DIR/controles-desarme-antes.txt"
      A="$DIR/controles-desarme-antes.txt"
      c8a() { sed -n "s/.*$1=\([0-9]*\).*/\1/p" "$A" | head -n 1; }
      ESP_SALIDA="$(c8a salida_cargado)"; ESP_HILOS="$(c8a hilos_vinculados)"; ESP_ESPEJO="$(c8a con_espejo)"
      ESP_CONTACTOS="$(contactos_vinculados)"
      evidencia "HECHO desarme_esperados=salida:$ESP_SALIDA,hilos:$ESP_HILOS,contactos:$ESP_CONTACTOS,espejo:$ESP_ESPEJO"
      env DB="$R_DB" TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" ESPERADOS_SALIDA="$ESP_SALIDA" ESPERADOS_HILOS="$ESP_HILOS" \
        ESPERADOS_CONTACTOS="$ESP_CONTACTOS" ESPERADOS_ESPEJO="$ESP_ESPEJO" ENTORNO=copia MODO=ensayo \
        bash "$DESHACER_VINCULOS" >"$DIR/desarme-studio.txt" 2>&1
      echo "HECHO salida_proceso=$?" >>"$DIR/desarme-studio.txt"
      paso desarme-studio
      CTL "$DIR/controles-desarme-despues.txt"
      Z="$DIR/controles-desarme-despues.txt"
      F="$DIR/desarme-studio.txt"
      exigir R3 '[ "$(h "$F" salida_proceso)" = 0 ] && grep -qx "HECHO modo=ensayo fin=rollback" "$F" && grep -q "^HECHO studio_ensayo=ok .* entorno=copia fin=rollback " "$F" && [ -n "$ESP_HILOS" ] && cmp -s "$A" "$Z" && [ "$(contactos_vinculados)" = "$ESP_CONTACTOS" ]' \
        "deshacer-vinculos.sh ENTORNO=copia MODO=ensayo termina en ROLLBACK: la copia de Studio, C-6, C-7 y C-8 quedan iguales ($ESP_HILOS hilos, $ESP_SALIDA salidas, $ESP_CONTACTOS contactos, $ESP_ESPEJO espejos)"
      DURABLE_DESPUES="$(durable_foto)"
      evidencia "HECHO desarme_durable_antes=$DURABLE_ANTES" "HECHO desarme_durable_despues=$DURABLE_DESPUES"
      exigir R4 '[ "$DURABLE_ANTES" = "$DURABLE_DESPUES" ] && [ -s "$SHM/chatwoot-seco.hecho" ] && [ -s "$SHM/studio-ensayo.hecho" ] && [ -s "$SHM/contactos-conservados.ndjson" ] && [ ! -e "$SHM/chatwoot-borrar.hecho" ] && [ ! -e "$SHM/studio-aplicar.hecho" ]' \
        "la copia durable del 4.6b no cambió ($DURABLE_DESPUES); los .hecho y el .ndjson están solo en $SHM, que borra la limpieza"
    else
      mal R0 "DB=$R_DB o DB_CW=$R_CW no son los contenedores de la copia ($PROYECTO, en $RED): el desarme no corre ni escribe nada"
      evidencia "HECHO error=desarme_no_es_la_copia"
    fi
  fi
else
  log "== E. la carga: NO EJECUTADA (--solo-copia)"
fi

# ── P. Producción después ────────────────────────────────────────────────────
log "== P. producción después (solo lectura)"
foto_prod >"$DIR/prod-despues.txt" 2>&1
PROD_DESPUES_S="$(sed -n 's/^studio=//p' "$DIR/prod-despues.txt")"
PROD_DESPUES_C="$(sed -n 's/^chatwoot=//p' "$DIR/prod-despues.txt")"
evidencia "HECHO produccion_despues_studio=$PROD_DESPUES_S" "HECHO produccion_despues_chatwoot=$PROD_DESPUES_C"
exigir P2 '[ "$PROD_DESPUES_S" = "$PROD_ANTES_S" ]' "Studio de producción igual: las tablas de la carga y el flag ($PROD_DESPUES_S)"
exigir P3 '[ "$PROD_DESPUES_C" = "$PROD_ANTES_C" ]' "Chatwoot de producción igual: la bandeja del portal y los contactos dtd-portal: ($PROD_DESPUES_C)"
evidencia "HECHO ensayo_fallas=$FALLAS" "HECHO ensayo_fin=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "== resultado: $FALLAS fallas · evidencia $EVIDENCIA"
[ "$FALLAS" = 0 ]
