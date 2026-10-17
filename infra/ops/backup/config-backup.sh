#!/usr/bin/env bash
# infra/ops/backup/config-backup.sh — respaldo CIFRADO de la configuración de un proyecto (SDD-0505).
#
# Sin esto el dump no sirve entero:
#   · `.env` del proyecto: JWT_SECRET (firma ANON_KEY/SERVICE_ROLE_KEY y las
#     sesiones), POSTGRES_PASSWORD, claves de SMTP, de S3 y de Supavisor.
#   · Volumen `<proyecto>_db-config` (/etc/postgresql-custom en el contenedor db):
#     guarda `pgsodium_root.key`, la clave RAÍZ con la que pgsodium cifra
#     vault.secrets. Sin ella, los secretos de Vault del dump no se pueden leer.
#     OJO: VAULT_ENC_KEY del .env NO es esa clave; es la de Supavisor.
#
# Qué hace:
#   1. copia `.env`, el contenido del volumen y los --include a --work-dir
#      (/dev/shm: memoria, nunca disco) y comprueba que esté pgsodium_root.key
#   2. si nada cambió desde el último respaldo subido (huella de los archivos),
#      termina sin subir nada; --force sube igual
#   3. tar | age → <out>/<proyecto>/config/<proyecto>-config-<stamp>.tar.age
#   4. sha256 y rclone copy a <remoto>/<proyecto>-config/ (prefijo propio: la
#      retención de los dumps nunca lo toca, y aquí no se borra nada remoto)
#   5. en disco local conserva los 8 más nuevos
#
# Imprime la huella sha256 de pgsodium_root.key (no la clave): sirve para
# comprobar, después de un restore, que el servidor nuevo tiene la misma raíz.
#
# Uso:
#   config-backup.sh --project <nombre> --remote <remoto>:<bucket>/<prefijo> \
#       --age-recipients <archivo> [--project-dir /srv/<proyecto>] \
#       [--volume <proyecto>_db-config] [--include <ruta>]… [--out /srv/backups] \
#       [--work-dir /dev/shm] [--rclone-config /srv/ops/backup/rclone] \
#       [--pg-image …] [--force] [--dry-run]
#
# Restaurar (a mano, en el servidor nuevo, con la clave privada en /dev/shm):
#   age -d -i /dev/shm/clave.txt <x>.tar.age | tar -x -C /dev/shm/cfg
#   install -m 600 /dev/shm/cfg/env/.env /srv/<proyecto>/.env
#   docker volume create <proyecto>_db-config
#   tar -C /dev/shm/cfg/volume -cf - . | docker run --rm -i -v <proyecto>_db-config:/dst \
#       supabase/postgres:17.6.1.136 tar -C /dst -xf -
#   … y borrar /dev/shm/cfg y la clave. Detalle: docs/runbooks/backup-restore-servidor.md §4.
set -euo pipefail
umask 077

PROJECT=""
REMOTE=""
PROJECT_DIR=""
VOLUME=""
INCLUDES=()
OUT="/srv/backups"
WORK_ROOT="/dev/shm"
AGE_RECIPIENTS="${BACKUP_AGE_RECIPIENTS_FILE:-}"
RCLONE_CONFIG="/srv/ops/backup/rclone"
PG_IMAGE="supabase/postgres:17.6.1.136"
RCLONE_IMAGE="rclone/rclone:1.75.1"
KEEP_LOCAL=8
FORCE=0
DRY_RUN=0

usage() {
  sed -n '2,41p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  echo "config-backup: $*" >&2
  exit 2
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
    --remote) setopt REMOTE "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --volume) setopt VOLUME "${2-}"; shift 2 ;;
    --include) [[ -n "${2-}" ]] && INCLUDES+=("$2"); shift 2 ;;
    --out) setopt OUT "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --age-recipients) setopt AGE_RECIPIENTS "${2-}"; shift 2 ;;
    --rclone-config) setopt RCLONE_CONFIG "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    --rclone-image) setopt RCLONE_IMAGE "${2-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${REMOTE}" =~ ^[A-Za-z0-9_-]+:[^/[:space:]]+/[^[:space:]]+$ ]] || die "--remote debe ser <remoto>:<bucket>/<prefijo>: '${REMOTE}'"
[[ "${PG_IMAGE}" != *:latest && "${PG_IMAGE}" == *:* ]] || die "--pg-image debe llevar tag fijo"
[[ "${RCLONE_IMAGE}" != *:latest && "${RCLONE_IMAGE}" == *:* ]] || die "--rclone-image debe llevar tag fijo"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
VOLUME="${VOLUME:-${PROJECT}_db-config}"
[[ -n "${AGE_RECIPIENTS}" ]] || die "--age-recipients es obligatorio (o BACKUP_AGE_RECIPIENTS_FILE): el .env y la clave raíz no se guardan sin cifrar"
[[ -f "${AGE_RECIPIENTS}" ]] || die "no existe el archivo de destinatarios age: ${AGE_RECIPIENTS}"
if grep -q 'AGE-SECRET-KEY-' "${AGE_RECIPIENTS}"; then
  die "${AGE_RECIPIENTS} contiene una clave PRIVADA: en el servidor solo va la pública"
fi
grep -Eq '^[[:space:]]*(age1[0-9a-z]{20,}|ssh-(ed25519|rsa) [A-Za-z0-9+/=]{20,})' "${AGE_RECIPIENTS}" \
  || die "${AGE_RECIPIENTS} no tiene ninguna clave pública age válida"
if (( ! DRY_RUN )); then
  [[ -f "${PROJECT_DIR}/.env" ]] || die "no existe ${PROJECT_DIR}/.env"
  [[ -f "${RCLONE_CONFIG}/rclone.conf" ]] || die "no existe ${RCLONE_CONFIG}/rclone.conf"
  command -v docker >/dev/null || die "docker no está en el PATH"
  command -v age >/dev/null || die "age no está instalado en el host (apt-get install age)"
  docker volume inspect "${VOLUME}" >/dev/null 2>&1 || die "no existe el volumen ${VOLUME}"
  for inc in ${INCLUDES[@]+"${INCLUDES[@]}"}; do
    [[ -e "${inc}" ]] || die "no existe --include ${inc}"
  done
fi

REMOTE="${REMOTE%/}"
remote_dir="${REMOTE}/${PROJECT}-config/"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dir="${OUT}/${PROJECT}/config"
base="${PROJECT}-config-${stamp}"
out_age="${dir}/${base}.tar.age"
sums="${dir}/${base}.sha256"
last="${dir}/ultima-huella"
work="${WORK_ROOT%/}/config-${PROJECT}-${stamp}"
run_label="dtd.backup.run=${PROJECT}-config-${stamp}-$$"

cleanup() {
  docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  if [[ -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
  rm -f -- "${out_age}.part"
}

if (( DRY_RUN )); then
  log "dry-run: copiaría ${PROJECT_DIR}/.env, el volumen ${VOLUME}${INCLUDES[*]:+ y ${INCLUDES[*]}} a ${work}, cifraría a ${out_age} y subiría a ${remote_dir}"
  exit 0
fi
trap cleanup EXIT
# Sin trap propio para INT/TERM/HUP a propósito: con trap, bash espera a que
# termine el docker run en curso antes de atender la señal; sin él, muere en el
# acto y el trap de EXIT igual limpia (probado en el VPS, SDD-0505).

log "respaldo de configuración de ${PROJECT} → ${dir} y ${remote_dir}"
mkdir -p "${dir}"
chmod 700 "${dir}"
mkdir -m 700 "${work}" "${work}/env" "${work}/volume" "${work}/include"

# 1. Reunir en memoria.
log "1/5 .env + volumen ${VOLUME} → ${WORK_ROOT} (memoria)"
cp -p "${PROJECT_DIR}/.env" "${work}/env/.env"
docker run --rm --label "${run_label}" -v "${VOLUME}:/src:ro" --entrypoint tar "${PG_IMAGE}" -C /src -cf - . \
  | tar -C "${work}/volume" -xf -
[[ -s "${work}/volume/pgsodium_root.key" ]] || die "el volumen ${VOLUME} no tiene pgsodium_root.key: ¿es el volumen db-config del proyecto?"
for inc in ${INCLUDES[@]+"${INCLUDES[@]}"}; do
  mkdir -p "${work}/include$(dirname "$(readlink -f "${inc}")")"
  cp -a "$(readlink -f "${inc}")" "${work}/include$(readlink -f "${inc}")"
done
root_fp="$(sha256sum "${work}/volume/pgsodium_root.key" | cut -d' ' -f1)"
log "huella de pgsodium_root.key: ${root_fp}"

# 2. ¿Cambió algo? La huella es de los contenidos, no del tar (que cambia con las fechas).
# Entran también los destinatarios age: si cambia la llave (el 2026-10-14 se perdió la
# privada y se creó otra), el último respaldo subido está cerrado con la vieja y hay
# que subir uno nuevo aunque el .env y la raíz no hayan cambiado.
fingerprint="$( { (cd "${work}" && find . -type f -print0 | sort -z | xargs -0 sha256sum); grep -E '^[[:space:]]*(age1|ssh-)' "${AGE_RECIPIENTS}" | sha256sum; } | sha256sum | cut -d' ' -f1)"
if (( ! FORCE )) && [[ -f "${last}" && "$(cat "${last}")" == "${fingerprint}" ]]; then
  log "2/5 sin cambios desde el último respaldo subido: no se sube nada (usa --force para subir igual)"
  log "listo"
  exit 0
fi
log "2/5 hay cambios (o --force): se respalda"

# 3. Cifrado directo desde la memoria.
log "3/5 tar | age → $(basename "${out_age}")"
tar -C "${work}" -cf - env volume include | age -R "${AGE_RECIPIENTS}" -o "${out_age}.part"
mv "${out_age}.part" "${out_age}"
rm -rf -- "${work}"

# 4. Huella y subida.
log "4/5 sha256 + rclone copy → ${remote_dir}"
(cd "${dir}" && sha256sum "$(basename "${out_age}")" > "${sums}")
for f in "${out_age}" "${sums}"; do
  docker run --rm --label "${run_label}" -v "${RCLONE_CONFIG}:/config/rclone:ro" -v "${dir}:/data:ro" "${RCLONE_IMAGE}" \
    --contimeout 30s --timeout 5m --retries 3 --low-level-retries 5 \
    copy "/data/$(basename "${f}")" "${remote_dir}"
done
printf '%s\n' "${fingerprint}" > "${last}"

# 5. En disco local, los 8 más nuevos.
log "5/5 conservar los ${KEEP_LOCAL} más nuevos en ${dir}"
find "${dir}" -maxdepth 1 -type f -name "${PROJECT}-config-*.tar.age" -printf '%T@ %p\n' \
  | sort -rn | tail -n "+$((KEEP_LOCAL + 1))" | cut -d' ' -f2- \
  | while read -r old; do rm -f -- "${old}" "${old%.tar.age}.sha256"; done

log "listo: $(basename "${out_age}") · raíz ${root_fp}"
