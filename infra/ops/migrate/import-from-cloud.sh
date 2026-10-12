#!/usr/bin/env bash
# infra/ops/migrate/import-from-cloud.sh — copia producción de Supabase Cloud a un STAGING del VPS (SDD-0505).
#
# Procedimiento escrito y verificable del traslado (revisión de datos del traslado,
# H5 y H11: docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md). Corre en
# el VPS, lo lanza Sam en una terminal, y solo con el OK de exportar producción.
#
# Lo que garantiza:
#   · Los datos no pasan por la laptop: el dump sale de Cloud directo al VPS.
#   · Ningún claro toca disco: todo se escribe en --work-dir (/dev/shm, memoria) y
#     un trap lo borra al salir, también si algo falla o se corta la sesión.
#   · La cadena de conexión y las claves S3 se piden con `read -s` (no quedan en
#     el historial ni en la pantalla) y viajan por entorno, no por argumento,
#     salvo la cadena que exige `supabase db dump --db-url` (ver Riesgos abajo).
#   · Minimización: sin --include-logs, los DATOS de las tablas de log no se copian
#     (las tablas existen, vacías). La lista está en LOG_TABLES.
#   · Solo escribe en un proyecto que termina en -staging y que esté VACÍO
#     (sin tablas en public), con los default privileges ya iguales a producción.
#   · Termina con una verificación por conteos (Cloud contra staging) y una
#     evidencia sin datos personales: solo nombres de tablas y cifras.
#
# Pasos: 0 guardas · 1 conteos de Cloud · 2 supabase db dump (roles, schema,
# datos) + lo que ese dump no trae: el ledger (supabase_migrations) y los jobs de
# pg_cron · 3 restore en staging · 4 Storage con rclone · 5 verificación ·
# 6 borrado y evidencia. Los secretos de Vault tampoco viajan: después,
# vault-set-secret.sh.
#
# Uso (como root en el VPS):
#   import-from-cloud.sh --project dtd-cargo-staging \
#       [--cloud-user postgres.<ref> --cloud-host aws-1-us-east-1.pooler.supabase.com] \
#       [--project-dir /srv/dtd-cargo-staging] [--expect-auth-users 297] \
#       [--include-logs] [--skip-storage] [--cron-active] [--restore-user supabase_admin] \
#       [--work-dir /dev/shm] [--evidence <archivo>] [--cli supabase]
#
# Con --cloud-user y --cloud-host solo se pide la CONTRASEÑA de la base (el script
# arma la cadena del Session pooler, puerto 5432, y codifica los caracteres
# especiales). Sin ellos se pide la cadena entera. Lo recomendado es lanzarlo
# dentro de tmux (`tmux new -A -s traslado …`): si se corta el SSH, el script
# sigue esperando y el mismo comando vuelve a la misma pregunta. Medido el
# 2026-10-11: la conexión de la casa de Sam se cae sola con el SSH quieto
# («client_loop: send disconnect: Connection reset»), y lo pegado fue a parar a
# PowerShell, que lo guarda en su historial.
#
# Los jobs de pg_cron quedan inactivos en staging; --cron-active conserva el
# estado de Cloud (solo cuando las integraciones del staging apunten a pruebas).
#
# Pide por la terminal: la contraseña de la base de Cloud (o la cadena entera del
# Session pooler, puerto 5432) y, si no hay --skip-storage, una access key S3
# TEMPORAL de Cloud (Storage › S3 Connection) que se revoca al terminar.
#
# --restore-user es supabase_admin, el superusuario del Postgres self-hosted: un
# objeto de un rol de la plataforma en el dump (OWNER/SET ROLE) hace fallar a
# postgres («must be able to SET ROLE supabase_admin», visto en el ensayo con un
# Cloud falso el 2026-10-09), y session_replication_role exige superusuario. Los
# dueños quedan los que declara el dump.
#
# Riesgos conocidos: `supabase db dump` solo acepta la cadena por --db-url, así que
# mientras dura el dump es visible en `ps` del VPS (solo root entra). Por eso la
# recomendación del runbook es rotar la contraseña de la base de Cloud al cerrar
# el ensayo si Sam no quiere dejar ese rastro.
#
# Códigos: 0 todo PASÓ · 2 uso inválido · 3 rechazado por una guarda ·
# 7 terminó, pero alguna comprobación FALLÓ (lee la evidencia).
set -euo pipefail
umask 077

# Tablas cuyos DATOS no viajan al staging (log y auditoría con datos personales
# que el ensayo no necesita). Lista de la revisión del traslado, H5.
LOG_TABLES=(
  public.mail_logs
  public.sync_logs
  public.public_track_log
  public.no_olvidar_access_log
  public.operario_pin_attempts
  public.entity_audit_log
  auth.audit_log_entries
)

# ACL_CTES, ACL_SYNC_SQL y ACL_FINGERPRINT_SQL: permisos de public para los roles
# cliente, compartidos con los respaldos.
# shellcheck source=../lib/acl.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/acl.sh"

PROJECT=""
PROJECT_DIR=""
EXPECT_AUTH_USERS=""
INCLUDE_LOGS=0
CRON_ACTIVE=0
SKIP_STORAGE=0
RESTORE_USER="supabase_admin"
WORK_ROOT="/dev/shm"
EVIDENCE=""
CLI="supabase"
CLOUD_USER=""
CLOUD_HOST=""
PG_IMAGE="supabase/postgres:17.6.1.136"
RCLONE_IMAGE="rclone/rclone:1.75.1"
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

usage() {
  sed -n '2,63p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

stamp="$(date -u +%Y%m%dT%H%M%SZ)"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${EVIDENCE:-/dev/null}"
}

die() {
  echo "import-from-cloud: $*" >&2
  exit 2
}

refuse() {
  echo "import-from-cloud: RECHAZADO · $*" | tee -a "${EVIDENCE:-/dev/null}" >&2
  exit 3
}

setopt() {
  local name="$1" value="${2-}"
  if [[ -n "${value}" ]]; then
    printf -v "${name}" '%s' "${value}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --expect-auth-users) setopt EXPECT_AUTH_USERS "${2-}"; shift 2 ;;
    --include-logs) INCLUDE_LOGS=1; shift ;;
    --cron-active) CRON_ACTIVE=1; shift ;;
    --skip-storage) SKIP_STORAGE=1; shift ;;
    --restore-user) setopt RESTORE_USER "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --evidence) setopt EVIDENCE "${2-}"; shift 2 ;;
    --cli) setopt CLI "${2-}"; shift 2 ;;
    --cloud-user) setopt CLOUD_USER "${2-}"; shift 2 ;;
    --cloud-host) setopt CLOUD_HOST "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    --rclone-image) setopt RCLONE_IMAGE "${2-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── 0 · Guardas ──────────────────────────────────────────────────────────────
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${PROJECT}" != "${PROD_PROJECT}" && "${PROJECT}" == *-staging ]] \
  || refuse "${PROJECT} no es un staging: este script solo escribe en proyectos *-staging (el corte de la Fase 3 tiene su propio procedimiento)"
[[ -z "${EXPECT_AUTH_USERS}" || "${EXPECT_AUTH_USERS}" =~ ^[0-9]+$ ]] || die "--expect-auth-users debe ser un entero"
[[ "${RESTORE_USER}" =~ ^[a-z_][a-z0-9_]*$ ]] || die "--restore-user inválido"
[[ -z "${CLOUD_USER}${CLOUD_HOST}" || ( -n "${CLOUD_USER}" && -n "${CLOUD_HOST}" ) ]] \
  || die "--cloud-user y --cloud-host van juntos"
[[ -z "${CLOUD_USER}" || "${CLOUD_USER}" =~ ^[a-z_][a-z0-9_.]*$ ]] || die "--cloud-user inválido: '${CLOUD_USER}'"
[[ -z "${CLOUD_HOST}" || "${CLOUD_HOST}" =~ ^[A-Za-z0-9.-]+$ ]] || die "--cloud-host inválido: '${CLOUD_HOST}'"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
EVIDENCE="${EVIDENCE:-/srv/ops/evidencias/import-${PROJECT}-${stamp}.txt}"
mkdir -p "$(dirname "${EVIDENCE}")"
: > "${EVIDENCE}"
chmod 600 "${EVIDENCE}"

[[ -f "${PROJECT_DIR}/.env" ]] || die "no existe ${PROJECT_DIR}/.env"
command -v docker >/dev/null || die "docker no está en el PATH"
command -v "${CLI}" >/dev/null || die "no encuentro la CLI de Supabase (${CLI}); instálala con la versión fijada del runbook servidor-contabo.md §2.2"
[[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"

envget() {
  local value
  value="$(grep -E "^${1}=" "${PROJECT_DIR}/.env" | tail -n1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "${value}"
}

STAGING_PASSWORD="$(envget POSTGRES_PASSWORD)"
[[ -n "${STAGING_PASSWORD}" ]] || die "POSTGRES_PASSWORD vacío en ${PROJECT_DIR}/.env"
NET_INTERNAL="${PROJECT}_dtd_internal"
NET_EGRESS="${PROJECT}_dtd_egress"
docker network inspect "${NET_INTERNAL}" >/dev/null 2>&1 || die "no existe la red ${NET_INTERNAL}: ¿está levantado el stack de ${PROJECT}?"

run_label="dtd.import.run=${PROJECT}-${stamp}-$$"
work=""
cleanup() {
  docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  if [[ -n "${work}" && -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
}
# Dentro de tmux, la sesión se cierra cuando el script termina y con ella el
# resultado en pantalla: se espera un Enter antes de salir (también si falló).
pause_in_tmux() {
  if [[ -n "${TMUX:-}" ]] && { : < /dev/tty; } 2>/dev/null; then
    read -r -p "Terminó. Revisa el resultado de arriba y pulsa Enter para cerrar. " _ < /dev/tty || true
  fi
}
trap 'cleanup; pause_in_tmux' EXIT
# Sin trap propio para INT/TERM/HUP a propósito: con trap, bash espera a que
# termine el docker run en curso antes de atender la señal; sin él, muere en el
# acto y el trap de EXIT igual limpia (probado en el VPS, SDD-0505).

# psql contra el staging (red interna) y contra Cloud (cadena por entorno). Sin
# `docker run -i`: con -i el contenedor se come la entrada estándar y la pregunta
# por la cadena de conexión llega vacía (medido en el VPS, SDD-0505).
staging_sql() { # $1 = sql
  docker run --rm --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" "${PG_IMAGE}" \
    psql -h db -U "${RESTORE_USER}" -d postgres -v ON_ERROR_STOP=1 -Atq -c "$1"
}
cloud_sql() { # $1 = sql
  docker run --rm --label "${run_label}" -e PROD_DB_URL "${PG_IMAGE}" \
    sh -c 'exec psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -Atq -F "|" -c "$1"' sh "$1"
}

log "import-from-cloud → ${PROJECT} · evidencia ${EVIDENCE}"
log "0/6 guardas"
staging_sql "select 1" >/dev/null || refuse "no entro al staging como ${RESTORE_USER} por ${NET_INTERNAL}"
n_public="$(staging_sql "select count(*) from pg_tables where schemaname = 'public'")"
[[ "${n_public}" == "0" ]] || refuse "el staging ya tiene ${n_public} tablas en public: este script solo restaura en un staging vacío (destroy-staging.sh y levantar de nuevo)"
open_acl="$(staging_sql "select count(*) from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and (d.defaclacl::text ~ '(^|[{,])(anon|authenticated)=')")"
[[ "${open_acl}" == "0" ]] || refuse "los default privileges de postgres en public todavía conceden a anon/authenticated (runbook servidor-contabo.md §2.1 paso 4)"
log "0/6 staging vacío y con default privileges de producción · CLI $(${CLI} --version 2>/dev/null | head -n1)"

# Credenciales: siempre desde la terminal, sin eco.
# /dev/tty existe aunque no haya terminal (ssh sin -t): se prueba abriéndolo.
tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then
  tty_in=/dev/tty
fi
# Quita espacios, tabuladores y \r de los extremos: copiar desde el Bloc de notas
# de Windows puede arrastrar el fin de línea CRLF (medido el 2026-10-09: tres
# intentos rechazados sin decir por qué). Sin subprocesos: el valor no pasa por `ps`.
trim() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "${s}"
}
# Describe lo que llegó sin mostrar ningún secreto: largo y forma, nunca el texto.
describe_input() { # $1 = lo recibido, $2 = url | clave
  local s="$1" d
  if [[ -z "${s}" ]]; then
    printf '%s' "no llegó nada: el pegado no entró (en la terminal de la app prueba Ctrl+Shift+V; en PowerShell del menú Inicio, clic derecho)"
    return
  fi
  d="llegaron ${#s} caracteres"
  if [[ "${2-}" == url ]]; then
    [[ "${s}" == postgres://* || "${s}" == postgresql://* ]] || d="${d}; no empieza con postgresql:// (¿se pegó otra cosa?)"
    [[ "${s}" == *"[YOUR-PASSWORD]"* ]] && d="${d}; todavía dice [YOUR-PASSWORD]: falta poner la contraseña"
  fi
  [[ "${s}" =~ [[:space:]] ]] && d="${d}; tiene espacios o saltos de línea en el medio (¿se copiaron dos líneas?)"
  printf '%s' "${d}"
}
# Percent-encoding de la contraseña para la URL (RFC 3986: solo pasan sin tocar
# letras, dígitos y -._~). Byte a byte con LC_ALL=C, así una ñ o una tilde
# salen como sus bytes UTF-8. Sin subprocesos: el valor no pasa por `ps`.
urlencode() {
  local LC_ALL=C s="$1" out="" c i
  for (( i = 0; i < ${#s}; i++ )); do
    c="${s:i:1}"
    case "${c}" in
      [A-Za-z0-9._~-]) out+="${c}" ;;
      *) printf -v c '%%%02X' "'${c}"; out+="${c}" ;;
    esac
  done
  printf '%s' "${out}"
}
BRACKETS_HINT="empieza con [ y termina con ]: esos corchetes son los de [YOUR-PASSWORD] en el panel de Supabase, no van; pega solo la contraseña"
# Cada credencial se prueba apenas llega (la base con un `select 1`, Storage con un
# listado de buckets) y, si no sirve, se vuelve a pedir: hasta MAX_TRIES intentos.
# Medido el 2026-10-11: un pegado con una línea en blanco en el medio dejó vacío el
# Secret y obligaba a empezar de cero, contraseña incluida. Fin de la entrada
# (sin terminal o Ctrl+D) corta en el acto con el último problema.
MAX_TRIES=3
ask_secret() { # $1 = pregunta, $2 = variable; sin eco, recortado; 1 si no hay más entrada
  local v=""
  read -rs -p "$1" v < "${tty_in}" || { echo; return 1; }
  echo
  printf -v "$2" '%s' "$(trim "${v}")"
}
# Por qué Cloud rechazó la conexión, sin mostrar ningún secreto: psql nombra el
# host y el usuario, nunca la contraseña. Medido el 2026-10-11: dos rechazos
# seguidos sin saber si era la contraseña, la red o un bloqueo.
classify_pg_error() { # $1 = stderr de psql
  local e="$1" fatal
  fatal="$(grep -oE '(FATAL|ERROR): .*' <<< "${e}" | head -n 1 | cut -c1-140 || true)"
  case "${e}" in
    *"password authentication failed"*)
      printf '%s' "la contraseña no es la de la base: si la reseteaste, va la nueva, sin corchetes [${fatal}]" ;;
    *"Tenant or user not found"*)
      printf '%s' "el pooler no reconoce el usuario o el proyecto: revisa --cloud-user y la región de --cloud-host [${fatal}]" ;;
    *"timeout"*|*"timed out"*|*"could not connect"*|*"Connection refused"*|*"No route"*|*"could not translate"*)
      printf '%s' "no hay conexión de red con Cloud: ¿la IP del VPS quedó bloqueada en Supabase › Database › Network bans?" ;;
    *)
      printf '%s' "${fatal:-$(head -n 1 <<< "${e}" | cut -c1-140)}" ;;
  esac
}
retry_or_die() { # $1 = intento, $2 = problema, $3 = qué hacer
  echo "✗ $2"
  (( $1 < MAX_TRIES )) || die "$2 (${MAX_TRIES} intentos)"
  echo "$3 (intento $(( $1 + 1 )) de ${MAX_TRIES})"
}
problem=""
for (( try = 1; ; try++ )); do
  if [[ -n "${CLOUD_USER}" ]]; then
    ask_secret "Contraseña de la base de Cloud (solo la contraseña, sin corchetes; no se ve al pegar, Enter al final): " CLOUD_DB_PASSWORD \
      || die "${problem:-la contraseña no llegó: fin de la entrada}"
    if [[ -z "${CLOUD_DB_PASSWORD}" || "${CLOUD_DB_PASSWORD}" =~ [[:space:]] ]]; then
      problem="la contraseña no llegó bien: $(describe_input "${CLOUD_DB_PASSWORD}" clave)"
    elif [[ "${CLOUD_DB_PASSWORD}" == postgres://* || "${CLOUD_DB_PASSWORD}" == postgresql://* ]]; then
      problem="llegó una cadena postgresql:// entera: aquí va SOLO la contraseña"
    elif [[ "${CLOUD_DB_PASSWORD}" == "["*"]" ]]; then
      problem="la contraseña ${BRACKETS_HINT}"
    else
      echo "contraseña recibida (${#CLOUD_DB_PASSWORD} caracteres)"
      PROD_DB_URL="postgresql://${CLOUD_USER}:$(urlencode "${CLOUD_DB_PASSWORD}")@${CLOUD_HOST}:5432/postgres"
      problem=""
    fi
    unset CLOUD_DB_PASSWORD
  else
    ask_secret "Cadena de conexión de Cloud (Session pooler, postgresql://…:5432/postgres): " PROD_DB_URL \
      || die "${problem:-la cadena no llegó: fin de la entrada}"
    if ! [[ "${PROD_DB_URL}" =~ ^postgres(ql)?://[^[:space:]]+$ ]] || [[ "${PROD_DB_URL}" == *"[YOUR-PASSWORD]"* ]]; then
      problem="la cadena no parece una URL de Postgres: $(describe_input "${PROD_DB_URL}" url)"
    elif [[ "${PROD_DB_URL}" =~ ^postgres(ql)?://[^:@/]+:\[[^@]*\]@ ]]; then
      problem="la contraseña de la cadena ${BRACKETS_HINT} (o usa --cloud-user/--cloud-host y pega solo la contraseña)"
    else
      problem=""
    fi
  fi
  if [[ -z "${problem}" ]]; then
    # Eco sin la contraseña, para que quien la pegó confirme que es la correcta.
    if [[ "${PROD_DB_URL}" =~ ^postgres(ql)?://([^:@/]+)(:[^@]*)?@([^/:?]+)(:([0-9]+))?/([^?]*) ]]; then
      echo "cadena recibida: ${BASH_REMATCH[2]}@${BASH_REMATCH[4]}:${BASH_REMATCH[6]:-5432}/${BASH_REMATCH[7]} (contraseña oculta, ${#PROD_DB_URL} caracteres)"
    fi
    export PROD_DB_URL
    if cloud_err="$(cloud_sql "select 1" 2>&1 >/dev/null)"; then
      echo "conexión a Cloud: OK"
      break
    fi
    problem="Cloud no aceptó la conexión: $(classify_pg_error "${cloud_err}")"
  fi
  retry_or_die "${try}" "${problem}" "Pega de nuevo SOLO lo que se pide y pulsa Enter"
done
cloud_ref=""
if [[ "${PROD_DB_URL}" =~ postgres\.([a-z0-9]{20}) ]]; then cloud_ref="${BASH_REMATCH[1]}";
elif [[ "${PROD_DB_URL}" =~ db\.([a-z0-9]{20})\.supabase\.co ]]; then cloud_ref="${BASH_REMATCH[1]}"; fi
if (( ! SKIP_STORAGE )); then
  CLOUD_S3_ENDPOINT="${CLOUD_S3_ENDPOINT:-}"
  if [[ -z "${CLOUD_S3_ENDPOINT}" ]]; then
    [[ -n "${cloud_ref}" ]] || die "no pude deducir el proyecto de Cloud de la cadena: exporta CLOUD_S3_ENDPOINT"
    CLOUD_S3_ENDPOINT="https://${cloud_ref}.supabase.co/storage/v1/s3"
  fi
  docker network inspect "${NET_EGRESS}" >/dev/null 2>&1 || die "no existe la red ${NET_EGRESS}"
  # Las claves viajan por nombre (-e VAR), nunca como valor en la línea de docker.
  s3_ok() {
    export RCLONE_CONFIG_CLOUD_TYPE=s3 RCLONE_CONFIG_CLOUD_PROVIDER=Other RCLONE_CONFIG_CLOUD_REGION=us-east-1 \
      RCLONE_CONFIG_CLOUD_ENDPOINT="${CLOUD_S3_ENDPOINT}" RCLONE_CONFIG_CLOUD_FORCE_PATH_STYLE=true \
      RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID="${CLOUD_S3_KEY}" RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY="${CLOUD_S3_SECRET}"
    docker run --rm --label "${run_label}" --network "${NET_EGRESS}" \
      -e RCLONE_CONFIG_CLOUD_TYPE -e RCLONE_CONFIG_CLOUD_PROVIDER -e RCLONE_CONFIG_CLOUD_REGION \
      -e RCLONE_CONFIG_CLOUD_ENDPOINT -e RCLONE_CONFIG_CLOUD_FORCE_PATH_STYLE \
      -e RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID -e RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY \
      "${RCLONE_IMAGE}" --contimeout 15s --timeout 60s --retries 1 --low-level-retries 1 lsd cloud: >/dev/null 2>&1
  }
  problem=""
  for (( try = 1; ; try++ )); do
    ask_secret "Access key ID S3 temporal de Cloud: " CLOUD_S3_KEY || die "${problem:-el Access key ID no llegó: fin de la entrada}"
    if [[ -z "${CLOUD_S3_KEY}" || "${CLOUD_S3_KEY}" =~ [[:space:]] ]]; then
      problem="el Access key ID no llegó bien: $(describe_input "${CLOUD_S3_KEY}" clave)"
    else
      echo "access key ID recibida (${#CLOUD_S3_KEY} caracteres)"
      ask_secret "Secret access key S3 temporal de Cloud: " CLOUD_S3_SECRET || die "${problem:-el Secret access key no llegó: fin de la entrada}"
      if [[ -z "${CLOUD_S3_SECRET}" || "${CLOUD_S3_SECRET}" =~ [[:space:]] ]]; then
        problem="el Secret access key no llegó bien: $(describe_input "${CLOUD_S3_SECRET}" clave)"
      else
        echo "secret access key recibido (${#CLOUD_S3_SECRET} caracteres)"
        if s3_ok; then
          echo "acceso a Storage de Cloud: OK"
          break
        fi
        problem="Storage de Cloud no aceptó esas claves (¿se copiaron completas, cada una por separado? ¿la key sigue activa?)"
      fi
    fi
    retry_or_die "${try}" "${problem}" "Pega las DOS claves de nuevo, una por una, con Enter después de cada una"
  done
fi

work="$(mktemp -d "${WORK_ROOT%/}/import-${PROJECT}-XXXXXX")"
log "carpeta de trabajo en memoria: ${work}"

# ── 1 · Conteos de Cloud (cifras, no filas) ──────────────────────────────────
log "1/6 conteos de Cloud"
count_query="select 'public.' || quote_ident(tablename) from pg_tables where schemaname = 'public' order by 1"
cloud_sql "${count_query}" > "${work}/tablas.txt"
gen_counts() { # lee nombres por stdin, escribe un select union all
  awk 'BEGIN{first=1} {printf "%s select %s as t, count(*) as n from %s", (first?"":" union all"), "\x27" $0 "\x27", $0; first=0} END{print " order by 1"}'
}
gen_counts < "${work}/tablas.txt" > "${work}/conteo.sql"
cloud_sql "$(cat "${work}/conteo.sql")" > "${work}/cloud-public.txt"
# Un conteo por consulta: si falta una relación en un lado, esa línea sale '?' y
# las demás se comparan igual (una sola consulta con union fallaba entera).
SUMMARY=(
  "auth.users|select count(*) from auth.users"
  "storage.buckets|select count(*) from storage.buckets"
  "storage.objects|select count(*) from storage.objects"
  "cron.job|select count(*) from cron.job"
  "vault.secrets|select count(*) from vault.secrets"
  "ledger|select count(*) from supabase_migrations.schema_migrations"
)
summary() { # $1 = cloud_sql | staging_sql
  local item value
  for item in "${SUMMARY[@]}"; do
    value="$("$1" "${item#*|}" 2>/dev/null || echo '?')"
    printf '%s|%s\n' "${item%%|*}" "${value:-?}"
  done
}
summary cloud_sql > "${work}/cloud-resumen.txt"
cloud_sql "select bucket_id, count(*) from storage.objects group by 1 order by 1" > "${work}/cloud-buckets.txt"
cloud_sql "select id from storage.buckets order by 1" > "${work}/cloud-bucket-ids.txt"
log "1/6 Cloud: $(tr '\n' ' ' < "${work}/cloud-resumen.txt")· $(wc -l < "${work}/tablas.txt") tablas en public"

# ── 2 · Dumps (en memoria) ───────────────────────────────────────────────────
log "2/6 supabase db dump (roles, schema, datos$( (( INCLUDE_LOGS )) || echo ' sin tablas de log'))"
exclude_args=()
if (( ! INCLUDE_LOGS )); then
  for t in "${LOG_TABLES[@]}"; do exclude_args+=(-x "${t}"); done
fi
"${CLI}" db dump --db-url "${PROD_DB_URL}" -f "${work}/roles.sql" --role-only
"${CLI}" db dump --db-url "${PROD_DB_URL}" -f "${work}/schema.sql"
"${CLI}" db dump --db-url "${PROD_DB_URL}" -f "${work}/data.sql" --data-only --use-copy ${exclude_args[@]+"${exclude_args[@]}"}
# El ledger de migraciones NO viene en `supabase db dump` (ni el schema ni los datos
# de supabase_migrations; medido el 2026-10-09). Sin él, applied_migration_names()
# queda vacía y el gate de migraciones pendientes no sirve: va aparte, con pg_dump
# de la misma imagen que corre la base del VPS.
docker run --rm --label "${run_label}" -e PROD_DB_URL "${PG_IMAGE}" \
  sh -c 'exec pg_dump "$PROD_DB_URL" --schema=supabase_migrations' > "${work}/ledger.sql"
# Tampoco trae los jobs de pg_cron (medido el 2026-10-09). Se recrean con
# cron.schedule_in_database (mismo nombre, horario, comando, base y usuario). En
# staging quedan INACTIVOS salvo --cron-active: un job activo le pegaría a Kommo
# u otras integraciones reales desde el ensayo.
cron_active_expr="false"
(( CRON_ACTIVE )) && cron_active_expr="active"
cloud_sql "select format('select cron.schedule_in_database(%L, %L, %L, %L, %L, %L::boolean);', jobname, schedule, command, database, username, ${cron_active_expr}) from cron.job order by jobid" > "${work}/cron.sql"
# Permisos de public: el restore crea los objetos como supabase_admin y la imagen
# le da a ese rol default privileges ABIERTOS (ALL para anon y authenticated);
# pg_dump solo emite los GRANT que difieren del valor por defecto, así que no los
# revoca. Medido el 2026-10-09: tenants con solo SELECT de authenticated en el
# origen quedaba con ALL para anon y authenticated en staging. Se igualan aquí,
# objeto por objeto, a lo que dice Cloud, y el paso 5 lo comprueba por huella.
cloud_sql "${ACL_SYNC_SQL}" > "${work}/acl.sql"
log "2/6 permisos de public a igualar: $(grep -c '^revoke' "${work}/acl.sql" || true) objetos, $(grep -c '^grant' "${work}/acl.sql" || true) grants"
log "2/6 tamaños: roles $(du -h "${work}/roles.sql" | cut -f1) · schema $(du -h "${work}/schema.sql" | cut -f1) · ledger $(du -h "${work}/ledger.sql" | cut -f1) · datos $(du -h "${work}/data.sql" | cut -f1)"

# ── 3 · Restore en staging (una transacción) ─────────────────────────────────
log "3/6 restore en ${PROJECT} como ${RESTORE_USER} (single-transaction, session_replication_role=replica para los datos)"
docker run --rm --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" \
  -v "${work}:/import:ro" "${PG_IMAGE}" \
  psql -h db -U "${RESTORE_USER}" -d postgres --single-transaction -v ON_ERROR_STOP=1 -q \
    -f /import/roles.sql -f /import/schema.sql -f /import/ledger.sql \
    -c 'SET session_replication_role = replica' -f /import/data.sql \
    -c 'SET session_replication_role = origin' -f /import/cron.sql -f /import/acl.sql > "${work}/restore.log" 2>&1 \
  || { tail -n 20 "${work}/restore.log" | sed 's/^/   /' | tee -a "${EVIDENCE}"; die "el restore falló (no quedó nada: era una sola transacción)"; }
log "3/6 restore terminado"

# ── 4 · Storage: rclone desde el VPS, S3 de Cloud → S3 del staging ──────────
storage_rc=0
if (( SKIP_STORAGE )); then
  log "4/6 Storage omitido (--skip-storage)"
else
  S3_ID="$(envget S3_PROTOCOL_ACCESS_KEY_ID)"; S3_SECRET="$(envget S3_PROTOCOL_ACCESS_KEY_SECRET)"
  [[ -n "${S3_ID}" && -n "${S3_SECRET}" ]] || die "S3_PROTOCOL_ACCESS_KEY_* vacío en ${PROJECT_DIR}/.env"
  docker network inspect "${NET_EGRESS}" >/dev/null 2>&1 || die "no existe la red ${NET_EGRESS}"
  # Remotos por variables de entorno de rclone: ni un rclone.conf en disco ni
  # claves en la línea de comandos.
  export RCLONE_CONFIG_CLOUD_TYPE=s3 RCLONE_CONFIG_CLOUD_PROVIDER=Other RCLONE_CONFIG_CLOUD_REGION=us-east-1 \
    RCLONE_CONFIG_CLOUD_ENDPOINT="${CLOUD_S3_ENDPOINT}" RCLONE_CONFIG_CLOUD_FORCE_PATH_STYLE=true \
    RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID="${CLOUD_S3_KEY}" RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY="${CLOUD_S3_SECRET}"
  export RCLONE_CONFIG_STAGING_TYPE=s3 RCLONE_CONFIG_STAGING_PROVIDER=Other RCLONE_CONFIG_STAGING_REGION="$(envget REGION)"
  export RCLONE_CONFIG_STAGING_ENDPOINT="http://storage:5000/s3" RCLONE_CONFIG_STAGING_FORCE_PATH_STYLE=true \
    RCLONE_CONFIG_STAGING_ACCESS_KEY_ID="${S3_ID}" RCLONE_CONFIG_STAGING_SECRET_ACCESS_KEY="${S3_SECRET}"
  [[ -n "${RCLONE_CONFIG_STAGING_REGION}" ]] || export RCLONE_CONFIG_STAGING_REGION=stub
  rclone_env=()
  for v in $(compgen -e | grep -E '^RCLONE_CONFIG_(CLOUD|STAGING)_'); do rclone_env+=(-e "${v}"); done
  rclone_run() {
    docker run --rm --label "${run_label}" --network "${NET_EGRESS}" "${rclone_env[@]}" "${RCLONE_IMAGE}" \
      --contimeout 30s --timeout 5m --retries 3 --low-level-retries 5 "$@"
  }
  while read -r bucket; do
    [[ -n "${bucket}" ]] || continue
    log "4/6 bucket ${bucket}"
    rclone_run copy "cloud:${bucket}" "staging:${bucket}" --transfers 4 --stats-one-line --stats 30s >> "${work}/rclone.log" 2>&1 \
      || { storage_rc=1; log "4/6 rclone falló en ${bucket} (ver el resumen)"; }
  done < "${work}/cloud-bucket-ids.txt"
  rclone_run size --json "cloud:" > "${work}/rclone-cloud.json" 2>>"${work}/rclone.log" || storage_rc=1
  rclone_run size --json "staging:" > "${work}/rclone-staging.json" 2>>"${work}/rclone.log" || storage_rc=1
  log "4/6 tamaño total · Cloud $(cat "${work}/rclone-cloud.json" 2>/dev/null) · staging $(cat "${work}/rclone-staging.json" 2>/dev/null)"
fi

# ── 5 · Verificación ────────────────────────────────────────────────────────
log "5/6 verificación (Cloud | staging)"
pass=0; fail=0
check() { # $1 = descripción, $2 = esperado, $3 = obtenido
  if [[ "$2" == "$3" ]]; then
    pass=$((pass + 1)); log "PASÓ  · $1 · $3"
  else
    fail=$((fail + 1)); log "FALLÓ · $1 · esperado '$2', obtenido '$3'"
  fi
}
staging_sql "$(cat "${work}/conteo.sql")" | tr -s ' ' > "${work}/staging-public.txt" || true
# Tablas de public: iguales, salvo las de log excluidas (que tienen que estar en 0).
while IFS='|' read -r t n; do
  s="$(grep -E "^${t//./\\.}\|" "${work}/staging-public.txt" | cut -d'|' -f2 || true)"
  excluded=0
  for lt in "${LOG_TABLES[@]}"; do [[ "${lt}" == "${t}" ]] && excluded=1; done
  if (( excluded && ! INCLUDE_LOGS )); then
    check "${t} (log excluido: vacío en staging)" "0" "${s:-?}"
  elif [[ "${s}" != "${n}" ]]; then
    check "${t}" "${n}" "${s:-?}"
  else
    pass=$((pass + 1))
  fi
done < "${work}/cloud-public.txt"
log "      $(wc -l < "${work}/cloud-public.txt") tablas de public comparadas"
summary staging_sql > "${work}/staging-resumen.txt"
while IFS='|' read -r k n; do
  s="$(grep -E "^${k//./\\.}\|" "${work}/staging-resumen.txt" | cut -d'|' -f2 || true)"
  case "${k}" in
    vault.secrets) log "INFO  · vault.secrets · Cloud ${n} | staging ${s:-?} (no viajan en el dump y estarían cifrados con la raíz de Cloud: se escriben con vault-set-secret.sh)";;
    cron.job)
      check "cron.job (recreados)" "${n}" "${s:-?}"
      log "INFO  · cron.job activos en staging: $(staging_sql "select count(*) from cron.job where active" 2>/dev/null || echo '?')$( (( CRON_ACTIVE )) || echo ' (inactivos a propósito; --cron-active los deja como en Cloud)')" ;;
    *) check "${k}" "${n}" "${s:-?}" ;;
  esac
done < "${work}/cloud-resumen.txt"
if [[ -n "${EXPECT_AUTH_USERS}" ]]; then
  check "auth.users contra --expect-auth-users" "${EXPECT_AUTH_USERS}" "$(grep '^auth.users|' "${work}/staging-resumen.txt" | cut -d'|' -f2)"
fi
check "storage.objects por bucket" "$(cat "${work}/cloud-buckets.txt")" "$(staging_sql "select bucket_id, count(*) from storage.objects group by 1 order by 1" | tr -s ' ' || true)"
check "default privileges de postgres en public sin anon/authenticated" "0" \
  "$(staging_sql "select count(*) from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and (d.defaclacl::text ~ '(^|[{,])(anon|authenticated)=')")"
check "permisos de public (tablas, secuencias, funciones y columnas para anon, authenticated, service_role y PUBLIC) idénticos a Cloud" \
  "$(cloud_sql "${ACL_FINGERPRINT_SQL}" 2>/dev/null || echo '?cloud')" "$(staging_sql "${ACL_FINGERPRINT_SQL}" 2>/dev/null || echo '?staging')"
check "anon/authenticated sin DELETE en public.tenants" "0" \
  "$(staging_sql "select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tenants' and grantee in ('anon','authenticated') and privilege_type = 'DELETE'" 2>/dev/null || echo '?')"
check "ledger: applied_migration_names() igual a Cloud" \
  "$(cloud_sql "select md5(string_agg(version || ':' || name, ',' order by version)) from public.applied_migration_names()")" \
  "$(staging_sql "select md5(string_agg(version || ':' || name, ',' order by version)) from public.applied_migration_names()" 2>/dev/null || echo '?')"
if (( ! SKIP_STORAGE )); then
  check "rclone: copia de Storage sin errores" "0" "${storage_rc}"
  c_count="$(grep -o '"count":[0-9]*' "${work}/rclone-cloud.json" 2>/dev/null | cut -d: -f2)"
  s_count="$(grep -o '"count":[0-9]*' "${work}/rclone-staging.json" 2>/dev/null | cut -d: -f2)"
  check "rclone: objetos en Cloud = objetos en staging" "${c_count:-?}" "${s_count:-?}"
fi

# ── 6 · Borrado y evidencia ─────────────────────────────────────────────────
log "6/6 borrado de la carpeta de trabajo"
rm -rf -- "${work}"
work=""
left="$(find "${WORK_ROOT}" -maxdepth 1 -name "import-${PROJECT}-*" | wc -l)"
check "nada del dump quedó en ${WORK_ROOT}" "0" "${left}"
unset PROD_DB_URL CLOUD_S3_KEY CLOUD_S3_SECRET
log "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
if (( ! SKIP_STORAGE )); then
  read -r -p "Revoca AHORA la access key S3 temporal en el panel de Supabase y escribe 'revocada': " answer < "${tty_in}" || answer=""
  log "claves S3 temporales: '${answer}' a las $(date -u +%H:%M:%SZ)"
fi
log "evidencia: ${EVIDENCE} (solo cifras, sin filas). Copia su contenido al handoff."
(( fail == 0 )) || exit 7
