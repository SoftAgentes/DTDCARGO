#!/usr/bin/env bash
# infra/ops/backup/pg-dump-to-s3.sh — dump de Postgres + copia a R2/B2 con rclone (SDD-0505).
#
# Qué hace, en orden:
#   1. pg_dump -Fc de la base (formato custom, comprimido; se restaura con pg_restore)
#   2. pg_dumpall --roles-only (los roles no viajan en pg_dump; sin ellos el restore
#      de un Supabase falla en los GRANT/OWNER)
#   3. pg_restore --list sobre el dump: comprueba que el archivo es legible
#   4. sha256 de ambos
#   5. rclone copy al remoto. NUNCA sync: un sync borra en un lado lo que no esté
#      en el otro; copy solo agrega.
#   6. rclone delete --min-age <N>d SOLO dentro de <remoto>/<proyecto>/ (retención)
#   7. borra los dumps locales más viejos que N días
#
# Corre en el host con Docker: pg_dump sale de la MISMA imagen que corre la base
# (supabase/postgres:17.6.1.136) y se conecta por la red interna del proyecto, así
# que la versión del cliente nunca es más vieja que la del servidor. rclone también
# va en contenedor (rclone/rclone:1.75.1) con su rclone.conf montado solo lectura.
#
# Uso:
#   PGPASSWORD=… pg-dump-to-s3.sh --project <nombre> --network <red interna> \
#       --remote <remoto>:<bucket>/<prefijo> [--host db] [--db postgres] [--user postgres] \
#       [--out /srv/backups] [--rclone-config /srv/ops/backup/rclone] \
#       [--retention-days 30] [--local-retention-days 7] [--pg-image …] [--dry-run]
#
# La contraseña entra por PGPASSWORD en el entorno, nunca por argumento (quedaría
# en `ps` y en el log). `--dry-run` imprime los comandos y no toca nada.
#
# Lo que NO hace (pendiente documentado en infra/ops/README.md y en
# docs/runbooks/backup-restore-servidor.md): WAL continuo / point-in-time recovery
# (pgBackRest). Un dump diario pierde hasta 24 h; aceptado para la Fase 0.
set -euo pipefail

PROJECT=""
NETWORK=""
REMOTE=""
HOST="db"
DB="postgres"
PGUSER_="postgres"
OUT="/srv/backups"
RCLONE_CONFIG="/srv/ops/backup/rclone"
RETENTION_DAYS="30"
LOCAL_RETENTION_DAYS="7"
PG_IMAGE="supabase/postgres:17.6.1.136"
RCLONE_IMAGE="rclone/rclone:1.75.1"
DRY_RUN=0

usage() {
  sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  echo "pg-dump-to-s3: $*" >&2
  exit 2
}

# Asigna solo si el valor no está vacío: así un wrapper puede pasar "" y conservar
# el valor por defecto.
setopt() {
  local name="$1" value="${2-}"
  if [[ -n "${value}" ]]; then
    printf -v "${name}" '%s' "${value}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --network) setopt NETWORK "${2-}"; shift 2 ;;
    --remote) setopt REMOTE "${2-}"; shift 2 ;;
    --host) setopt HOST "${2-}"; shift 2 ;;
    --db) setopt DB "${2-}"; shift 2 ;;
    --user) setopt PGUSER_ "${2-}"; shift 2 ;;
    --out) setopt OUT "${2-}"; shift 2 ;;
    --rclone-config) setopt RCLONE_CONFIG "${2-}"; shift 2 ;;
    --retention-days) setopt RETENTION_DAYS "${2-}"; shift 2 ;;
    --local-retention-days) setopt LOCAL_RETENTION_DAYS "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    --rclone-image) setopt RCLONE_IMAGE "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── Validaciones: todo lo que pueda borrar algo se comprueba antes de empezar ──
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}' (minúsculas, dígitos, - y _)"
[[ -n "${NETWORK}" ]] || die "--network es obligatorio (red interna del proyecto, p. ej. ${PROJECT}_internal)"
# <remoto>:<bucket>/<prefijo>: exige un prefijo detrás del bucket para que la
# retención (rclone delete) nunca corra sobre la raíz de un bucket.
[[ "${REMOTE}" =~ ^[A-Za-z0-9_-]+:[^/[:space:]]+/[^[:space:]]+$ ]] || die "--remote debe ser <remoto>:<bucket>/<prefijo> (nunca la raíz del bucket): '${REMOTE}'"
[[ "${RETENTION_DAYS}" =~ ^[1-9][0-9]*$ ]] || die "--retention-days debe ser un entero ≥ 1"
[[ "${LOCAL_RETENTION_DAYS}" =~ ^[1-9][0-9]*$ ]] || die "--local-retention-days debe ser un entero ≥ 1"
[[ "${PG_IMAGE}" != *:latest && "${PG_IMAGE}" == *:* ]] || die "--pg-image debe llevar tag fijo (nunca latest): '${PG_IMAGE}'"
[[ "${RCLONE_IMAGE}" != *:latest && "${RCLONE_IMAGE}" == *:* ]] || die "--rclone-image debe llevar tag fijo (nunca latest): '${RCLONE_IMAGE}'"
if (( ! DRY_RUN )); then
  [[ -n "${PGPASSWORD-}" ]] || die "PGPASSWORD no está en el entorno"
  [[ -f "${RCLONE_CONFIG}/rclone.conf" ]] || die "no existe ${RCLONE_CONFIG}/rclone.conf"
  command -v docker >/dev/null || die "docker no está en el PATH"
fi

REMOTE="${REMOTE%/}"
remote_dir="${REMOTE}/${PROJECT}/"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dir="${OUT}/${PROJECT}"
base="${PROJECT}-${stamp}"
dump="${dir}/${base}.dump"
roles="${dir}/${base}-roles.sql"
sums="${dir}/${base}.sha256"

# run: ejecuta o, en dry-run, imprime. run_to: igual, con la salida a un archivo.
run() {
  if (( DRY_RUN )); then
    printf '+'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}
run_to() {
  local target="$1"; shift
  if (( DRY_RUN )); then
    printf '+'; printf ' %q' "$@"; printf ' > %q\n' "${target}"
  else
    "$@" > "${target}"
  fi
}

docker_pg=(docker run --rm --network "${NETWORK}" -e PGPASSWORD "${PG_IMAGE}")
docker_rclone=(docker run --rm -v "${RCLONE_CONFIG}:/config/rclone:ro" -v "${dir}:/data:ro" "${RCLONE_IMAGE}")

log "backup de ${PROJECT} (${HOST}/${DB} en ${NETWORK}) → ${dir} y ${remote_dir}"
run mkdir -p "${dir}"
run chmod 700 "${dir}"

# 1. Dump a .part y luego mv: un dump cortado a medias no debe parecer completo.
log "1/7 pg_dump -Fc"
run_to "${dump}.part" "${docker_pg[@]}" pg_dump -h "${HOST}" -U "${PGUSER_}" -d "${DB}" -Fc -Z 6
run mv "${dump}.part" "${dump}"

# 2. Roles del cluster (globales): no viajan en pg_dump.
log "2/7 pg_dumpall --roles-only"
run_to "${roles}.part" "${docker_pg[@]}" pg_dumpall -h "${HOST}" -U "${PGUSER_}" -l "${DB}" --roles-only
run mv "${roles}.part" "${roles}"

# 3. ¿Se puede leer el archivo? pg_restore --list lo recorre entero sin restaurar.
log "3/7 pg_restore --list (verificación del archivo)"
if (( DRY_RUN )); then
  printf '+ docker run --rm -i %q pg_restore --list < %q > /dev/null\n' "${PG_IMAGE}" "${dump}"
else
  docker run --rm -i "${PG_IMAGE}" pg_restore --list < "${dump}" > /dev/null
fi

# 4. Huellas: el restore de prueba mensual las compara antes de restaurar.
log "4/7 sha256"
if (( DRY_RUN )); then
  printf '+ (cd %q && sha256sum %q %q > %q)\n' "${dir}" "$(basename "${dump}")" "$(basename "${roles}")" "${sums}"
else
  (cd "${dir}" && sha256sum "$(basename "${dump}")" "$(basename "${roles}")" > "${sums}")
fi

# 5. Subida: copy, archivo por archivo. Nunca sync.
log "5/7 rclone copy → ${remote_dir}"
for f in "${dump}" "${roles}" "${sums}"; do
  run "${docker_rclone[@]}" copy "/data/$(basename "${f}")" "${remote_dir}"
done

# 6. Retención remota acotada al prefijo del proyecto (validado arriba).
log "6/7 rclone delete --min-age ${RETENTION_DAYS}d en ${remote_dir}"
run "${docker_rclone[@]}" delete --min-age "${RETENTION_DAYS}d" "${remote_dir}"

# 7. Retención local: solo archivos de este proyecto en su carpeta.
log "7/7 limpieza local (> ${LOCAL_RETENTION_DAYS} días)"
run find "${dir}" -maxdepth 1 -type f -name "${PROJECT}-*" -mtime "+${LOCAL_RETENTION_DAYS}" -delete

if (( DRY_RUN )); then
  log "dry-run: nada ejecutado"
else
  log "listo: $(basename "${dump}") ($(du -h "${dump}" | cut -f1)) · $(basename "${roles}") · $(basename "${sums}")"
fi
