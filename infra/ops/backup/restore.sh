#!/usr/bin/env bash
# infra/ops/backup/restore.sh — restaura un dump en una base NUEVA o en staging (SDD-0505).
#
# La regla que importa: NUNCA pisa la base viva de producción por accidente.
#   · El destino es siempre `--target <base>` dentro del Postgres de `--project`.
#   · Si `--project` es el proyecto de producción (PROD_COMPOSE_PROJECT, por defecto
#     dtd-cargo), `--target` tiene que ser una base que NO exista todavía: se crea
#     y se restaura ahí (sirve para verificar un dump al lado de la viva).
#   · `--target postgres` (la base viva de Supabase), template0 y template1 son
#     destructivos en cualquier proyecto.
#   · Un destino destructivo exige `--i-know-this-destroys-prod` Y escribir la
#     confirmación exacta en una terminal interactiva. Sin terminal, se rechaza.
#   · Sobre el destino: `pg_restore --clean --if-exists` y, al final, un
#     `select count(*)` de verificación (por defecto auth.users).
#
# Dumps cifrados (`.age`, los que deja pg-dump-to-s3.sh): hace falta
# `--age-identity <archivo>` con la clave PRIVADA. Antes de descifrar compara el
# sha256 del cifrado con el `.sha256` hermano (o `--sums`); el claro se escribe
# en --work-dir (por defecto /dev/shm, memoria) y un trap lo borra al salir.
# La clave privada no vive en el servidor: tráela a /dev/shm solo para el restore
# y bórrala después, o usa una identidad protegida con frase (`age -p`), que age
# pide por la terminal.
#
# Uso:
#   PGPASSWORD=… restore.sh --file <x.dump[.age]> --project <compose destino> --target <base> \
#       [--roles <x-roles.sql[.age]>] [--age-identity <clave>] [--sums <x.sha256>] \
#       [--network <red>] [--host db] [--user postgres] [--work-dir /dev/shm] \
#       [--verify-table auth.users] [--pg-image …] [--jobs 2] \
#       [--i-know-this-destroys-prod] [--dry-run]
#
# Códigos de salida: 0 ok · 2 uso inválido · 3 RECHAZADO por la guarda ·
# 4 restaurado con advertencias de pg_restore (lee el log antes de confiar) ·
# 5 el sha256 del cifrado no coincide (no se descifró nada).
#
# Restore de prueba mensual: restore-test.sh (contenedor desechable en memoria).
set -euo pipefail
umask 077

FILE=""
PROJECT=""
TARGET=""
ROLES=""
NETWORK=""
HOST="db"
PGUSER_="postgres"
VERIFY_TABLE="auth.users"
PG_IMAGE="supabase/postgres:17.6.1.136"
JOBS="2"
AGE_IDENTITY="${BACKUP_AGE_IDENTITY_FILE:-}"
SUMS=""
WORK_ROOT="/dev/shm"
FORCE=0
DRY_RUN=0
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"
LIVE_DB="${PROD_DB_NAME:-postgres}"

usage() {
  sed -n '2,36p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  echo "restore: $*" >&2
  exit 2
}

refuse() {
  echo "restore: RECHAZADO · $*" >&2
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
    --file) setopt FILE "${2-}"; shift 2 ;;
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --target) setopt TARGET "${2-}"; shift 2 ;;
    --roles) setopt ROLES "${2-}"; shift 2 ;;
    --network) setopt NETWORK "${2-}"; shift 2 ;;
    --host) setopt HOST "${2-}"; shift 2 ;;
    --user) setopt PGUSER_ "${2-}"; shift 2 ;;
    --verify-table) setopt VERIFY_TABLE "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    --jobs) setopt JOBS "${2-}"; shift 2 ;;
    --age-identity) setopt AGE_IDENTITY "${2-}"; shift 2 ;;
    --sums) setopt SUMS "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --i-know-this-destroys-prod) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── Validaciones de forma (antes de cualquier guarda o conexión) ──
[[ -n "${FILE}" ]] || die "--file es obligatorio"
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
# Nombre de base que no necesita comillas ni permite inyectar SQL en el psql de abajo.
[[ "${TARGET}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "--target inválido: '${TARGET}' (minúsculas, dígitos y _)"
[[ "${VERIFY_TABLE}" =~ ^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$ ]] || die "--verify-table inválido: '${VERIFY_TABLE}'"
[[ "${JOBS}" =~ ^[1-9][0-9]*$ ]] || die "--jobs debe ser un entero ≥ 1"
[[ "${PG_IMAGE}" != *:latest && "${PG_IMAGE}" == *:* ]] || die "--pg-image debe llevar tag fijo (nunca latest): '${PG_IMAGE}'"
NETWORK="${NETWORK:-${PROJECT}_internal}"
encrypted=0
if [[ "${FILE}" == *.age || "${ROLES}" == *.age ]]; then
  encrypted=1
  [[ -n "${AGE_IDENTITY}" ]] || die "el dump está cifrado (.age): falta --age-identity <clave privada>"
fi
if (( ! DRY_RUN )); then
  [[ -f "${FILE}" ]] || die "no existe ${FILE}"
  [[ -z "${ROLES}" || -f "${ROLES}" ]] || die "no existe ${ROLES}"
  [[ -n "${PGPASSWORD-}" ]] || die "PGPASSWORD no está en el entorno"
  command -v docker >/dev/null || die "docker no está en el PATH"
  if (( encrypted )); then
    command -v age >/dev/null || die "age no está instalado en el host (apt-get install age)"
    [[ -f "${AGE_IDENTITY}" ]] || die "no existe la identidad age ${AGE_IDENTITY}"
    [[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"
  fi
fi

# Limpieza al salir, también por kill o corte de SSH: los contenedores con la
# etiqueta de esta corrida y la carpeta de claros en /dev/shm (si se creó).
run_label="dtd.restore.run=${PROJECT}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
work=""
cleanup() {
  docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  if [[ -n "${work}" && -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
}
if (( ! DRY_RUN )); then
  trap cleanup EXIT
  # Sin trap propio para INT/TERM/HUP a propósito: con trap, bash espera a que
  # termine el docker run en curso antes de atender la señal; sin él, muere en el
  # acto y el trap de EXIT igual limpia (probado en el VPS, SDD-0505).
fi

docker_pg=(docker run --rm -i --label "${run_label}" --network "${NETWORK}" -e PGPASSWORD "${PG_IMAGE}")
# Consultas con -c: sin `-i`, para no comerse la entrada estándar (la confirmación
# interactiva de la guarda se lee después de db_exists).
psql_admin=(docker run --rm --label "${run_label}" --network "${NETWORK}" -e PGPASSWORD "${PG_IMAGE}"
  psql -h "${HOST}" -U "${PGUSER_}" -d postgres -v ON_ERROR_STOP=1 -Atq)

db_exists() {
  local found
  found="$("${psql_admin[@]}" -c "select 1 from pg_database where datname = '${TARGET}'")"
  [[ "${found}" == "1" ]]
}

# ── La guarda ──────────────────────────────────────────────────────────────
destructive=0
reason=""
case "${TARGET}" in
  postgres|template0|template1)
    destructive=1
    reason="--target ${TARGET} es la base viva o una plantilla de Postgres"
    ;;
esac
if [[ "${PROJECT}" == "${PROD_PROJECT}" ]]; then
  if [[ "${TARGET}" == "${LIVE_DB}" ]]; then
    destructive=1
    reason="--project ${PROJECT} es producción y --target ${TARGET} es su base viva"
  elif (( ! DRY_RUN )) && db_exists; then
    destructive=1
    reason="--project ${PROJECT} es producción y la base ${TARGET} ya existe (solo se restaura en una base nueva)"
  fi
fi

if (( destructive )); then
  if (( ! FORCE )); then
    refuse "${reason}. Restaura en una base nueva (--target <nombre_nuevo>) o en staging (--project <proyecto-staging>)."
  fi
  if (( DRY_RUN )); then
    refuse "${reason}. Con --i-know-this-destroys-prod haría falta confirmar en una terminal interactiva (dry-run no confirma)."
  fi
  [[ -t 0 ]] || refuse "${reason}. --i-know-this-destroys-prod exige una terminal interactiva para confirmar."
  expected="DESTRUIR ${PROJECT}/${TARGET}"
  echo "ATENCIÓN: ${reason}."
  echo "Esto va a ejecutar pg_restore --clean sobre ${PROJECT}/${TARGET} y pisar lo que haya."
  read -r -p "Escribe exactamente '${expected}' para continuar: " answer
  [[ "${answer}" == "${expected}" ]] || refuse "confirmación incorrecta."
  log "confirmación aceptada para ${PROJECT}/${TARGET}"
fi

# ── Plan ───────────────────────────────────────────────────────────────────
run() {
  if (( DRY_RUN )); then
    printf '+'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

log "restore de $(basename "${FILE}") → ${PROJECT}/${TARGET} (${HOST} en ${NETWORK}) · verificación: select count(*) from ${VERIFY_TABLE}"

# 0. Descifrado (solo si hay .age). Huellas primero: un cifrado alterado no se abre.
dump_path="${FILE}"
roles_path="${ROLES}"
if (( encrypted )); then
  if [[ -z "${SUMS}" ]]; then
    guess="${FILE%.age}"
    guess="${guess%.dump}.sha256"
    [[ -f "${guess}" ]] && SUMS="${guess}"
  fi
  if [[ -n "${SUMS}" ]]; then
    log "0/4 sha256 de los cifrados contra $(basename "${SUMS}")"
    if (( ! DRY_RUN )); then
      for f in "${FILE}" ${ROLES:+"${ROLES}"}; do
        [[ "${f}" == *.age ]] || continue
        expected_sum="$(grep -E "[[:space:]]\*?$(basename "${f}")\$" "${SUMS}" | cut -d' ' -f1 || true)"
        [[ -n "${expected_sum}" ]] || { echo "restore: $(basename "${f}") no figura en ${SUMS}" >&2; exit 5; }
        actual_sum="$(sha256sum "${f}" | cut -d' ' -f1)"
        [[ "${expected_sum}" == "${actual_sum}" ]] || { echo "restore: sha256 NO coincide para $(basename "${f}")" >&2; exit 5; }
      done
    fi
  else
    log "0/4 sin .sha256 al lado ni --sums: se descifra sin comparar huellas"
  fi
  if (( ! DRY_RUN )); then
    if [[ "$(head -c 21 "${AGE_IDENTITY}")" != "age-encryption.org/v1" && "$(readlink -f "${AGE_IDENTITY}")" != "$(readlink -f "${WORK_ROOT}")"/* ]]; then
      log "ADVERTENCIA: la clave privada ${AGE_IDENTITY} está en disco y sin frase; bórrala al terminar"
    fi
    work="$(mktemp -d "${WORK_ROOT%/}/restore-${PROJECT}-XXXXXX")"
  else
    work="${WORK_ROOT%/}/restore-${PROJECT}-XXXXXX"
  fi
  log "0/4 age -d → ${work} (memoria)"
  if [[ "${FILE}" == *.age ]]; then
    dump_path="${work}/$(basename "${FILE%.age}")"
    run age -d -i "${AGE_IDENTITY}" -o "${dump_path}" "${FILE}"
  fi
  if [[ "${ROLES}" == *.age ]]; then
    roles_path="${work}/$(basename "${ROLES%.age}")"
    run age -d -i "${AGE_IDENTITY}" -o "${roles_path}" "${ROLES}"
  fi
fi

file_abs="${dump_path}"
if (( ! DRY_RUN )); then
  file_abs="$(readlink -f "${dump_path}")"
fi

# 1. Roles (opcional). `CREATE ROLE` de roles que ya existen da error: esperado,
#    por eso ON_ERROR_STOP=0 solo aquí. Se quitan las cláusulas PASSWORD: traen
#    los hashes del ORIGEN y le cambiarían la contraseña al usuario con el que
#    este mismo script se conecta. Las contraseñas de los roles las fija el .env
#    del destino (en un DR, el .env restaurado del respaldo de configuración).
if [[ -n "${roles_path}" ]]; then
  log "1/4 roles desde $(basename "${roles_path}") sin contraseñas (errores de 'ya existe' son normales)"
  if (( DRY_RUN )); then
    printf '+ sed -E %q %q | %s psql -h %q -U %q -d postgres -v ON_ERROR_STOP=0 -q\n' "s/ PASSWORD '[^']*'//" "${roles_path}" "docker run … ${PG_IMAGE}" "${HOST}" "${PGUSER_}"
  else
    sed -E "s/ PASSWORD '[^']*'//" "${roles_path}" \
      | "${docker_pg[@]}" psql -h "${HOST}" -U "${PGUSER_}" -d postgres -v ON_ERROR_STOP=0 -q || true
  fi
else
  log "1/4 sin --roles: se asume que los roles ya existen en el destino"
fi

# 2. Crear la base si no existe (en producción la guarda ya garantizó que no existe).
log "2/4 create database ${TARGET} (si no existe)"
if (( DRY_RUN )); then
  printf '+ %s psql … -c %q\n' "docker run … ${PG_IMAGE}" "create database ${TARGET}"
elif ! db_exists; then
  "${psql_admin[@]}" -c "create database ${TARGET}"
fi

# 3. Restaurar. El archivo se monta en el contenedor para poder usar --jobs.
#    pg_restore devuelve 1 si hubo advertencias (extensiones ya presentes, etc.):
#    se registra y se sigue a la verificación, pero el script no sale 0.
log "3/4 pg_restore --clean --if-exists --jobs ${JOBS}"
restore_rc=0
if (( DRY_RUN )); then
  printf '+ docker run --rm --network %q -e PGPASSWORD -v %q:/restore.dump:ro %q pg_restore -h %q -U %q -d %q --clean --if-exists --jobs %q /restore.dump\n' \
    "${NETWORK}" "${file_abs}" "${PG_IMAGE}" "${HOST}" "${PGUSER_}" "${TARGET}" "${JOBS}"
else
  docker run --rm --label "${run_label}" --network "${NETWORK}" -e PGPASSWORD -v "${file_abs}:/restore.dump:ro" "${PG_IMAGE}" \
    pg_restore -h "${HOST}" -U "${PGUSER_}" -d "${TARGET}" --clean --if-exists --jobs "${JOBS}" /restore.dump \
    || restore_rc=$?
fi

# 4. Verificación: una consulta real sobre la base restaurada.
log "4/4 select count(*) from ${VERIFY_TABLE}"
if (( DRY_RUN )); then
  printf '+ %s psql -h %q -U %q -d %q -Atq -c %q\n' "docker run … ${PG_IMAGE}" "${HOST}" "${PGUSER_}" "${TARGET}" "select count(*) from ${VERIFY_TABLE}"
  log "dry-run: nada ejecutado · plan aceptado por la guarda"
  exit 0
fi
count="$("${docker_pg[@]}" psql -h "${HOST}" -U "${PGUSER_}" -d "${TARGET}" -v ON_ERROR_STOP=1 -Atq -c "select count(*) from ${VERIFY_TABLE}")"
log "verificación: ${VERIFY_TABLE} tiene ${count} filas en ${PROJECT}/${TARGET}"

if (( restore_rc != 0 )); then
  log "pg_restore terminó con código ${restore_rc}: hubo advertencias. Léelas antes de dar el restore por bueno."
  exit 4
fi
log "listo"
