#!/usr/bin/env bash
# infra/templates/proyecto/backup.sh — respaldo CIFRADO de ESTE proyecto (SDD-0505).
#
# Envuelve dos scripts de infra/ops/backup/ con los valores del `.env` que está al
# lado (PROYECTO, POSTGRES_*, BACKUP_*):
#   1. pg-dump-to-s3.sh: dump de la base + roles, cifrados con age, al remoto.
#   2. config-backup.sh: este .env + la clave raíz de pgsodium/Vault, cifrados,
#      solo cuando cambiaron (sin ellos el dump no se puede usar entero).
# Pensado para un cron del host:
#   15 3 * * * /srv/<proyecto>/backup.sh >> /var/log/backup-<proyecto>.log 2>&1
#
# Cualquier argumento extra pasa al script del dump (por ejemplo `--dry-run`, que
# imprime los comandos sin ejecutarlos; en dry-run no se respalda la configuración).
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
dump_script="${ops_dir}/backup/pg-dump-to-s3.sh"
config_script="${ops_dir}/backup/config-backup.sh"
for s in "${dump_script}" "${config_script}"; do
  if [[ ! -x "${s}" ]]; then
    echo "backup.sh: no encuentro ${s} (OPS_DIR=${ops_dir}); ¿está desplegado infra/ops?" >&2
    exit 1
  fi
done
recipients="$(require BACKUP_AGE_RECIPIENTS_FILE)"
remote="$(require BACKUP_RCLONE_REMOTE)"

# La contraseña viaja por el entorno al contenedor de pg_dump; nunca por argumento
# (quedaría en `ps` y en el log).
PGPASSWORD="$(require POSTGRES_PASSWORD)"
export PGPASSWORD

"${dump_script}" \
  --project "${proyecto}" \
  --network "${proyecto}_internal" \
  --host "$(envget POSTGRES_HOST)" \
  --db "$(envget POSTGRES_DB)" \
  --out "$(envget BACKUP_DIR)" \
  --remote "${remote}" \
  --age-recipients "${recipients}" \
  --rclone-config "$(envget RCLONE_CONFIG_DIR)" \
  --retention-days "$(envget BACKUP_RETENTION_DAYS)" \
  --local-retention-days "$(envget BACKUP_LOCAL_RETENTION_DAYS)" \
  "$@"

for arg in "$@"; do
  [[ "${arg}" == "--dry-run" ]] && exit 0
done

unset PGPASSWORD
exec "${config_script}" \
  --project "${proyecto}" \
  --project-dir "${here}" \
  --volume "$(envget BACKUP_DB_CONFIG_VOLUME)" \
  --out "$(envget BACKUP_DIR)" \
  --remote "${remote}" \
  --age-recipients "${recipients}" \
  --rclone-config "$(envget RCLONE_CONFIG_DIR)"
