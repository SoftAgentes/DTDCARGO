#!/usr/bin/env bash
# infra/templates/proyecto/backup.sh — respaldo de la base de ESTE proyecto (SDD-0505).
#
# Envuelve infra/ops/backup/pg-dump-to-s3.sh con los valores del `.env` que está
# al lado (PROYECTO, POSTGRES_*, BACKUP_*). Pensado para un cron del host:
#   15 3 * * * /srv/<proyecto>/backup.sh >> /var/log/backup-<proyecto>.log 2>&1
#
# Cualquier argumento extra pasa al script de ops (por ejemplo `--dry-run`, que
# imprime los comandos sin ejecutarlos).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${here}/.env"
if [[ ! -f "${env_file}" ]]; then
  echo "backup.sh: falta ${env_file} (copia .env.example y rellénalo)" >&2
  exit 1
fi

# Lee una clave del .env sin hacer `source`: el formato de compose admite valores
# que el shell interpretaría (espacios, paréntesis) y un `source` los rompería.
envget() {
  local value
  value="$(grep -E "^${1}=" "${env_file}" | tail -n1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "${value}"
}

require() {
  local value
  value="$(envget "$1")"
  if [[ -z "${value}" ]]; then
    echo "backup.sh: ${1} está vacío en ${env_file}" >&2
    exit 1
  fi
  printf '%s' "${value}"
}

proyecto="$(require PROYECTO)"
ops_dir="$(envget OPS_DIR)"
ops_dir="${ops_dir:-/srv/ops}"
script="${ops_dir}/backup/pg-dump-to-s3.sh"
if [[ ! -x "${script}" ]]; then
  echo "backup.sh: no encuentro ${script} (OPS_DIR=${ops_dir}); ¿está desplegado infra/ops?" >&2
  exit 1
fi

# La contraseña viaja por el entorno al contenedor de pg_dump; nunca por argumento
# (quedaría en `ps` y en el log).
PGPASSWORD="$(require POSTGRES_PASSWORD)"
export PGPASSWORD

exec "${script}" \
  --project "${proyecto}" \
  --network "${proyecto}_internal" \
  --host "$(envget POSTGRES_HOST)" \
  --db "$(envget POSTGRES_DB)" \
  --out "$(envget BACKUP_DIR)" \
  --remote "$(require BACKUP_RCLONE_REMOTE)" \
  --rclone-config "$(envget RCLONE_CONFIG_DIR)" \
  --retention-days "$(envget BACKUP_RETENTION_DAYS)" \
  --local-retention-days "$(envget BACKUP_LOCAL_RETENTION_DAYS)" \
  "$@"
