#!/usr/bin/env bash
# infra/ops/backup/pg-dump-to-s3.sh — dump de Postgres CIFRADO + copia a R2/B2 con rclone (SDD-0505).
#
# Qué hace, en orden:
#   1. pg_dump -Fc de la base (formato custom, comprimido; se restaura con pg_restore)
#   2. pg_dumpall --roles-only (los roles no viajan en pg_dump; sin ellos el restore
#      de un Supabase falla en los GRANT/OWNER)
#   3. pg_restore --list sobre el dump: comprueba que el archivo es legible
#   4. cifra los dos con age para los destinatarios de --age-recipients
#   5. borra los claros y comprueba que no queda ninguno
#   6. sha256 de los cifrados
#   7. rclone copy al remoto. NUNCA sync: un sync borra en un lado lo que no esté
#      en el otro; copy solo agrega.
#   8. rclone delete --min-age <N>d SOLO dentro de <remoto>/<proyecto>/ (retención)
#   9. borra los cifrados locales más viejos que N días
#
# El dump es la base completa con datos personales (revisión del traslado,
# docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md, H1). Por eso:
#   · El cifrado es OBLIGATORIO: sin un archivo de destinatarios válido el script
#     no corre, y no hay bandera para saltarlo.
#   · Los claros (pasos 1-3) se escriben en --work-dir, por defecto /dev/shm: es
#     tmpfs, vive en RAM y no llega al disco ni a los snapshots de Contabo. Un trap
#     borra la carpeta al salir, también si algo falla a la mitad.
#   · Al disco local y al remoto solo llegan `.age`. La clave PRIVADA no vive en el
#     servidor: quien se lleve el servidor o el bucket se lleva archivos ilegibles.
#
# Corre en el host con Docker: pg_dump sale de la MISMA imagen que corre la base
# (supabase/postgres:17.6.1.136) y se conecta por la red interna del proyecto, así
# que la versión del cliente nunca es más vieja que la del servidor. rclone también
# va en contenedor (rclone/rclone:1.75.1) con su rclone.conf montado solo lectura.
# `age` corre en el host (paquete `age` de Ubuntu 24.04).
#
# Uso:
#   PGPASSWORD=… pg-dump-to-s3.sh --project <nombre> --network <red interna> \
#       --remote <remoto>:<bucket>/<prefijo> --age-recipients <archivo> \
#       [--host db] [--db postgres] [--user postgres] [--out /srv/backups] \
#       [--work-dir /dev/shm] [--rclone-config /srv/ops/backup/rclone] \
#       [--retention-days 30] [--local-retention-days 7] [--pg-image …] [--dry-run]
#
# --age-recipients (o BACKUP_AGE_RECIPIENTS_FILE): una clave PÚBLICA por línea
# (`age1…` o `ssh-ed25519 …`); las líneas `#` son comentarios. Con varias líneas
# descifra cualquiera de las privadas (p. ej. la de Sam y una de emergencia
# guardada fuera de línea). Si el archivo trae una clave privada, se rechaza.
#
# La contraseña entra por PGPASSWORD en el entorno, nunca por argumento (quedaría
# en `ps` y en el log). `--dry-run` imprime los comandos y no toca nada.
#
# Lo que NO hace (pendiente documentado en infra/ops/README.md y en
# docs/runbooks/backup-restore-servidor.md): WAL continuo / point-in-time recovery
# (pgBackRest). Un dump diario pierde hasta 24 h; aceptado para la Fase 0.
set -euo pipefail
umask 077

PROJECT=""
NETWORK=""
REMOTE=""
HOST="db"
DB="postgres"
PGUSER_="postgres"
OUT="/srv/backups"
WORK_ROOT="/dev/shm"
AGE_RECIPIENTS="${BACKUP_AGE_RECIPIENTS_FILE:-}"
RCLONE_CONFIG="/srv/ops/backup/rclone"
RETENTION_DAYS="30"
LOCAL_RETENTION_DAYS="7"
PG_IMAGE="supabase/postgres:17.6.1.136"
RCLONE_IMAGE="rclone/rclone:1.75.1"
DRY_RUN=0

usage() {
  sed -n '2,51p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --age-recipients) setopt AGE_RECIPIENTS "${2-}"; shift 2 ;;
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
# El cifrado se valida también en dry-run: un cron mal configurado tiene que fallar
# en la prueba, no la primera noche.
[[ -n "${AGE_RECIPIENTS}" ]] || die "--age-recipients es obligatorio (o BACKUP_AGE_RECIPIENTS_FILE): el dump lleva datos personales y no se guarda sin cifrar"
[[ -f "${AGE_RECIPIENTS}" ]] || die "no existe el archivo de destinatarios age: ${AGE_RECIPIENTS}"
if grep -q 'AGE-SECRET-KEY-' "${AGE_RECIPIENTS}"; then
  die "${AGE_RECIPIENTS} contiene una clave PRIVADA: en el servidor solo va la pública (age-keygen -y)"
fi
grep -Eq '^[[:space:]]*(age1[0-9a-z]{20,}|ssh-(ed25519|rsa) [A-Za-z0-9+/=]{20,})' "${AGE_RECIPIENTS}" \
  || die "${AGE_RECIPIENTS} no tiene ninguna clave pública age válida (age1… o ssh-ed25519 …)"
if (( ! DRY_RUN )); then
  [[ -n "${PGPASSWORD-}" ]] || die "PGPASSWORD no está en el entorno"
  [[ -f "${RCLONE_CONFIG}/rclone.conf" ]] || die "no existe ${RCLONE_CONFIG}/rclone.conf"
  command -v docker >/dev/null || die "docker no está en el PATH"
  command -v age >/dev/null || die "age no está instalado en el host (apt-get install age)"
  [[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"
fi

REMOTE="${REMOTE%/}"
remote_dir="${REMOTE}/${PROJECT}/"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dir="${OUT}/${PROJECT}"
base="${PROJECT}-${stamp}"
dump_age="${dir}/${base}.dump.age"
roles_age="${dir}/${base}-roles.sql.age"
sums="${dir}/${base}.sha256"

# Carpeta de los claros: en tmpfs, modo 700, borrada al salir pase lo que pase.
work="${WORK_ROOT%/}/pg-dump-${PROJECT}-${stamp}"
dump="${work}/${base}.dump"
roles="${work}/${base}-roles.sql"
# Cada contenedor lleva esta etiqueta: si el script muere a la mitad (kill, corte
# de SSH), la limpieza también baja el pg_dump o el rclone que quedó corriendo.
run_label="dtd.backup.run=${PROJECT}-${stamp}-$$"
cleanup() {
  docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  if [[ -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
  rm -f -- "${dump_age}.part" "${roles_age}.part"
}
if (( ! DRY_RUN )); then
  trap cleanup EXIT
  # Sin trap propio para INT/TERM/HUP a propósito: con trap, bash espera a que
  # termine el docker run en curso antes de atender la señal; sin él, muere en el
  # acto y el trap de EXIT igual limpia (probado en el VPS, SDD-0505).
fi

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

docker_pg=(docker run --rm --label "${run_label}" --network "${NETWORK}" -e PGPASSWORD "${PG_IMAGE}")
# Plazos explícitos: un remoto que no responde tiene que fallar (y avisar por el
# latido), no dejar el cron colgado toda la noche.
docker_rclone=(docker run --rm --label "${run_label}" -v "${RCLONE_CONFIG}:/config/rclone:ro" -v "${dir}:/data:ro" "${RCLONE_IMAGE}"
  --contimeout 30s --timeout 5m --retries 3 --low-level-retries 5)

log "backup cifrado de ${PROJECT} (${HOST}/${DB} en ${NETWORK}) → ${dir} y ${remote_dir}"
run mkdir -p "${dir}"
run chmod 700 "${dir}"
run mkdir -m 700 "${work}"

# 1. Dump a .part y luego mv: un dump cortado a medias no debe parecer completo.
log "1/9 pg_dump -Fc (en ${WORK_ROOT}, memoria)"
run_to "${dump}.part" "${docker_pg[@]}" pg_dump -h "${HOST}" -U "${PGUSER_}" -d "${DB}" -Fc -Z 6
run mv "${dump}.part" "${dump}"

# 2. Roles del cluster (globales): no viajan en pg_dump.
log "2/9 pg_dumpall --roles-only"
run_to "${roles}.part" "${docker_pg[@]}" pg_dumpall -h "${HOST}" -U "${PGUSER_}" -l "${DB}" --roles-only
run mv "${roles}.part" "${roles}"

# 3. ¿Se puede leer el archivo? pg_restore --list lo recorre entero sin restaurar.
log "3/9 pg_restore --list (verificación del archivo)"
if (( DRY_RUN )); then
  printf '+ docker run --rm -i %q pg_restore --list < %q > /dev/null\n' "${PG_IMAGE}" "${dump}"
else
  docker run --rm -i --label "${run_label}" "${PG_IMAGE}" pg_restore --list < "${dump}" > /dev/null
fi

# 4. Cifrado a .part y mv: un .age a medias no debe parecer bueno.
log "4/9 age → $(basename "${dump_age}") y $(basename "${roles_age}")"
run age -R "${AGE_RECIPIENTS}" -o "${dump_age}.part" "${dump}"
run mv "${dump_age}.part" "${dump_age}"
run age -R "${AGE_RECIPIENTS}" -o "${roles_age}.part" "${roles}"
run mv "${roles_age}.part" "${roles_age}"

# 5. Fuera los claros, y se comprueba que no quedó ninguno.
log "5/9 borrado de los claros"
run rm -f -- "${dump}" "${roles}"
if (( ! DRY_RUN )); then
  [[ -z "$(ls -A "${work}")" ]] || die "quedó algo sin cifrar en ${work}: $(ls -A "${work}")"
  [[ ! -e "${dir}/${base}.dump" && ! -e "${dir}/${base}-roles.sql" ]] || die "quedó un claro en ${dir}"
fi

# 6. Huellas de los CIFRADOS: el restore las compara antes de descifrar.
log "6/9 sha256"
if (( DRY_RUN )); then
  printf '+ (cd %q && sha256sum %q %q > %q)\n' "${dir}" "$(basename "${dump_age}")" "$(basename "${roles_age}")" "${sums}"
else
  (cd "${dir}" && sha256sum "$(basename "${dump_age}")" "$(basename "${roles_age}")" > "${sums}")
fi

# 7. Subida: copy, archivo por archivo. Nunca sync.
log "7/9 rclone copy → ${remote_dir}"
for f in "${dump_age}" "${roles_age}" "${sums}"; do
  run "${docker_rclone[@]}" copy "/data/$(basename "${f}")" "${remote_dir}"
done

# 8. Retención remota acotada al prefijo del proyecto (validado arriba).
log "8/9 rclone delete --min-age ${RETENTION_DAYS}d en ${remote_dir}"
run "${docker_rclone[@]}" delete --min-age "${RETENTION_DAYS}d" "${remote_dir}"

# 9. Retención local: solo archivos de este proyecto en su carpeta.
log "9/9 limpieza local (> ${LOCAL_RETENTION_DAYS} días)"
run find "${dir}" -maxdepth 1 -type f -name "${PROJECT}-*" -mtime "+${LOCAL_RETENTION_DAYS}" -delete

if (( DRY_RUN )); then
  log "dry-run: nada ejecutado"
else
  log "listo: $(basename "${dump_age}") ($(du -h "${dump_age}" | cut -f1)) · $(basename "${roles_age}") · $(basename "${sums}")"
fi
