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
# pg_cron · 3 restore · 4 (Storage: ya no aquí) · 5 verificación · 6 borrado y
# evidencia. Los ARCHIVOS de Storage los copia storage-from-cloud.sh después: el
# paso que había aquí no habría copiado nada (medido el 2026-10-12, ver la
# cabecera de ese script). --skip-storage se acepta y no hace nada.
#
# Ensayo (staging): los secretos de Vault no viajan (se escriben después con
# vault-set-secret.sh), las tablas de log llegan vacías y los jobs de pg_cron
# inactivos.
#
# CORTE (--corte, solo el proyecto de producción del VPS): pide escribir
# «CORTE <proyecto>» antes de conectar a nada, y entonces viaja TODO. Las tablas
# de log van con datos (son registro), los jobs de pg_cron quedan como en Cloud y
# los secretos de Vault se copian: se leen descifrados de Cloud y se vuelven a
# cifrar con la raíz del servidor. Pasan en memoria y nunca se imprimen; se
# verifican por huella.
#
# Uso (como root en el VPS):
#   import-from-cloud.sh --project dtd-cargo-staging \
#       [--cloud-user postgres.<ref> --cloud-host aws-1-us-east-1.pooler.supabase.com] \
#       [--project-dir /srv/dtd-cargo-staging] [--expect-auth-users 297] \
#       [--include-logs] [--cron-active] [--corte] [--restore-user supabase_admin] \
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
# Pide por la terminal la contraseña de la base de Cloud (o la cadena entera del
# Session pooler, puerto 5432). Nada más: las claves S3 las pide storage-from-cloud.sh.
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

# Lo que `supabase db dump` NO trae de los esquemas de la plataforma (medido en el
# corte del 2026-10-14): las policies de storage y auth, y los disparadores de la
# app sobre tablas de auth y storage (alta de usuarios, último ingreso). Sin las
# policies, toda subida con sesión de usuario cae en «new row violates row-level
# security policy». Se recrean con el texto de Cloud y el paso 5 compara huellas.
# Los disparadores propios de Supabase (función en storage/auth) no se tocan.
PLATFORM_DDL_SQL="
select format('drop policy if exists %I on %I.%I;', policyname, schemaname, tablename) || chr(10)
    || format('create policy %I on %I.%I as %s for %s to %s%s%s;', policyname, schemaname, tablename, permissive, cmd,
         (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(roles) r),
         case when qual is not null then ' using (' || qual || ')' else '' end,
         case when with_check is not null then ' with check (' || with_check || ')' else '' end)
  from pg_policies where schemaname in ('storage', 'auth')
union all
select format('drop trigger if exists %I on %I.%I;', t.tgname, n.nspname, c.relname) || chr(10) || pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = t.tgfoid
 where not t.tgisinternal and n.nspname in ('storage', 'auth')
   and p.pronamespace::regnamespace::text not in ('storage', 'auth', 'realtime', 'extensions', 'pgbouncer', 'supabase_functions')"
PLATFORM_POLICIES_FP_SQL="select count(*) || ':' || coalesce(md5(string_agg(schemaname || '.' || tablename || '.' || policyname || '|' || permissive || '|' || cmd || '|' || array_to_string(roles, ',') || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname)), '-') from pg_policies where schemaname in ('storage', 'auth')"
APP_TRIGGERS_FP_SQL="select count(*) || ':' || coalesce(md5(string_agg(pg_get_triggerdef(t.oid) || '|' || t.tgenabled::text, ',' order by n.nspname, c.relname, t.tgname)), '-') from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and n.nspname in ('storage', 'auth') and p.pronamespace::regnamespace::text not in ('storage', 'auth', 'realtime', 'extensions', 'pgbouncer', 'supabase_functions')"

PROJECT=""
PROJECT_DIR=""
EXPECT_AUTH_USERS=""
INCLUDE_LOGS=0
CRON_ACTIVE=0
CORTE=0
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
  sed -n '2,74p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

stamp="$(date -u +%Y%m%dT%H%M%SZ)"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${EVIDENCE:-/dev/null}"
}

die() {
  echo "import-from-cloud: $*" >&2
  # También a la evidencia (sin secretos: los mensajes solo dicen largo y forma),
  # para saber por qué cortó aunque la sesión de tmux ya se haya cerrado.
  [[ -z "${EVIDENCE:-}" || ! -f "${EVIDENCE}" ]] || printf '%s import-from-cloud: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "${EVIDENCE}"
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
    --skip-storage) shift ;;  # sin efecto: Storage va con storage-from-cloud.sh
    --corte) CORTE=1; shift ;;
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
if (( CORTE )); then
  [[ "${PROJECT}" == "${PROD_PROJECT}" ]] \
    || refuse "--corte es solo para el proyecto de producción del VPS (${PROD_PROJECT}); para ensayar, un *-staging sin --corte"
  INCLUDE_LOGS=1
  CRON_ACTIVE=1
else
  [[ "${PROJECT}" != "${PROD_PROJECT}" && "${PROJECT}" == *-staging ]] \
    || refuse "${PROJECT} no es un staging: sin --corte este script solo escribe en proyectos *-staging"
fi
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
  value="${value%$'\r'}"
  value="${value%\"}"; value="${value#\"}"
  # env-set.sh guarda las claves entre comillas simples (medido en el corte).
  value="${value%\'}"; value="${value#\'}"
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
if (( CORTE )); then
  read -r -p "CORTE de producción: todo Cloud → ${PROJECT}. Escribe exactamente 'CORTE ${PROJECT}' para seguir: " corte_ok < "${tty_in}" || corte_ok=""
  [[ "$(trim "${corte_ok}")" == "CORTE ${PROJECT}" ]] || refuse "confirmación del corte incorrecta: no se conectó a nada"
  log "0/6 CORTE confirmado: logs con datos, pg_cron como en Cloud y Vault copiado"
fi
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
  log "✗ intento $1: $2"
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
cloud_sql "${PLATFORM_DDL_SQL}" > "${work}/platform.sql"
log "2/6 esquemas de la plataforma a recrear: $(grep -c '^create policy' "${work}/platform.sql" || true) policies de storage/auth, $(grep -c '^CREATE TRIGGER' "${work}/platform.sql" || true) disparadores de la app"
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
# Policies y disparadores de storage/auth: aparte, porque esas tablas las crean los
# servicios de la plataforma (storage-api, GoTrue) y no el dump.
docker run --rm --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" \
  -v "${work}:/import:ro" "${PG_IMAGE}" \
  psql -h db -U "${RESTORE_USER}" -d postgres --single-transaction -v ON_ERROR_STOP=1 -q -f /import/platform.sql > "${work}/platform.log" 2>&1 \
  || { tail -n 5 "${work}/platform.log" | sed 's/^/   /' | tee -a "${EVIDENCE}"; die "no se pudieron recrear las policies/disparadores de storage y auth (la base ya está restaurada: revisa y repite solo ese paso)"; }
log "3/6 plataforma: $(staging_sql "select count(*) from pg_policies where schemaname in ('storage', 'auth')") policies de storage/auth recreadas"
if (( CORTE )); then
  # Secretos de Vault: descifrados en Cloud, re-cifrados aquí con la raíz del
  # servidor. El archivo vive en ${work} (memoria) y se borra con él.
  cloud_sql "select format('select vault.create_secret(%L, %L, %L);', decrypted_secret, name, coalesce(description, '')) from vault.decrypted_secrets order by name" > "${work}/vault.sql"
  docker run --rm --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" \
    -v "${work}:/import:ro" "${PG_IMAGE}" \
    psql -h db -U "${RESTORE_USER}" -d postgres --single-transaction -v ON_ERROR_STOP=1 -q -f /import/vault.sql > /dev/null 2>&1 \
    || die "no se pudieron escribir los secretos de Vault en ${PROJECT} (la base ya está restaurada: revisa y repite solo Vault)"
  rm -f -- "${work}/vault.sql"
  log "3/6 Vault: $(staging_sql "select count(*) from vault.secrets") secretos copiados (re-cifrados con la raíz del servidor)"
  # kommo_cron_key es el Bearer con que pg_cron llama a las Edge Functions, y la
  # función lo compara con SUPABASE_SERVICE_ROLE_KEY del stack. En Cloud guarda la
  # clave nueva (sb_secret_…), que el servidor no conoce: la tarea de las 00:15 del
  # corte respondió 403. Se reemplaza por la service key legada del servidor.
  SERVER_SERVICE_KEY="$(envget SERVICE_ROLE_KEY)"
  if [[ -n "${SERVER_SERVICE_KEY}" && -n "$(staging_sql "select 1 from vault.secrets where name = 'kommo_cron_key'")" ]]; then
    # Como vault-set-secret.sh: \getenv toma el valor del entorno del contenedor
    # (nunca por argumento) y :'valor' lo cita como literal. El heredoc es la
    # entrada de este docker run, no la del script: aquí ya no se pregunta nada.
    KEY="${SERVER_SERVICE_KEY}" docker run --rm -i --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" -e KEY "${PG_IMAGE}" \
      psql -h db -U "${RESTORE_USER}" -d postgres -v ON_ERROR_STOP=1 -Atq > /dev/null <<'SQL' \
      || die "no se pudo poner la service key del servidor en kommo_cron_key"
\getenv valor KEY
select vault.update_secret((select id from vault.secrets where name = 'kommo_cron_key'), :'valor');
SQL
    log "3/6 Vault: kommo_cron_key = SERVICE_ROLE_KEY del servidor (la de Cloud no sirve contra estas funciones)"
  else
    log "INFO  · kommo_cron_key se queda como en Cloud (sin SERVICE_ROLE_KEY en ${PROJECT_DIR}/.env o sin el secreto)"
  fi
fi

# ── 4 · Storage ──────────────────────────────────────────────────────────────
log "4/6 Storage: los archivos los copia storage-from-cloud.sh (paso siguiente del runbook)"

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
    vault.secrets)
      if (( CORTE )); then
        check "vault.secrets (copiados)" "${n}" "${s:-?}"
      else
        log "INFO  · vault.secrets · Cloud ${n} | staging ${s:-?} (en el ensayo no viajan: se escriben con vault-set-secret.sh)"
      fi ;;
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
check "policies de storage y auth idénticas a Cloud" \
  "$(cloud_sql "${PLATFORM_POLICIES_FP_SQL}" 2>/dev/null || echo '?cloud')" "$(staging_sql "${PLATFORM_POLICIES_FP_SQL}" 2>/dev/null || echo '?staging')"
check "disparadores de la app sobre auth y storage idénticos a Cloud" \
  "$(cloud_sql "${APP_TRIGGERS_FP_SQL}" 2>/dev/null || echo '?cloud')" "$(staging_sql "${APP_TRIGGERS_FP_SQL}" 2>/dev/null || echo '?staging')"
if (( CORTE )); then
  # kommo_cron_key se compara aparte: en el corte se reemplaza a propósito (arriba).
  vault_fp="select count(*) || ':' || coalesce(md5(string_agg(name || ':' || md5(coalesce(decrypted_secret, '')), ',' order by name)), '-') from vault.decrypted_secrets where name <> 'kommo_cron_key'"
  check "Vault: los secretos descifran igual que en Cloud (huella, sin kommo_cron_key)" "$(cloud_sql "${vault_fp}" 2>/dev/null || echo '?cloud')" "$(staging_sql "${vault_fp}" 2>/dev/null || echo '?staging')"
  if [[ -n "${SERVER_SERVICE_KEY:-}" ]]; then
    check "Vault: kommo_cron_key es la service key del servidor (huella)" \
      "$(printf '%s' "${SERVER_SERVICE_KEY}" | md5sum | cut -c1-32)" \
      "$(staging_sql "select md5(decrypted_secret) from vault.decrypted_secrets where name = 'kommo_cron_key'" 2>/dev/null || echo '?staging')"
  fi
  log "INFO  · cron.job activos: $(staging_sql "select count(*) from cron.job where active" 2>/dev/null || echo '?') — si pausaste pg_cron en Cloud antes del dump (runbook §3.6), llegan inactivos: enciéndelos después de escribir functions_base_url"
fi
unset SERVER_SERVICE_KEY

# ── 6 · Borrado y evidencia ─────────────────────────────────────────────────
log "6/6 borrado de la carpeta de trabajo"
rm -rf -- "${work}"
work=""
left="$(find "${WORK_ROOT}" -maxdepth 1 -name "import-${PROJECT}-*" | wc -l)"
check "nada del dump quedó en ${WORK_ROOT}" "0" "${left}"
unset PROD_DB_URL
log "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
log "evidencia: ${EVIDENCE} (solo cifras, sin filas). Copia su contenido al handoff."
(( fail == 0 )) || exit 7
