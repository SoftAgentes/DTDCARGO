#!/usr/bin/env bash
# infra/ops/backup/set-remote.sh — conecta los respaldos a su bucket fuera de Contabo (SDD-0505).
#
# Escribe el remoto de rclone que usan pg-dump-to-s3.sh y config-backup.sh
# (`--rclone-config /srv/ops/backup/rclone`) con las claves que pega Sam. Las claves
# se piden sin eco y nunca se imprimen ni van por argumento. Antes de guardar
# prueba de verdad: lista el bucket, sube un archivo de prueba, lo lee, lo borra
# y comprueba que se borró del todo (sin versiones ocultas).
#
#   --tipo b2   Backblaze B2: pide keyID y applicationKey. Con `hard_delete = true`:
#               sin eso, un borrado en B2 solo OCULTA el archivo y la versión vieja
#               queda guardada, así que la retención de 30 días no borraría nada
#               (y la política de privacidad promete que sí).
#               La clave MAESTRA de la cuenta (keyID de 12 caracteres) se rechaza y
#               se vuelve a pedir: con ella, quien entre al servidor maneja toda la
#               cuenta (crear claves, borrar buckets). Entre el 2026-10-12 y el 13
#               quedó guardada así tres veces y el mensaje de éxito no lo delataba.
#               `--permitir-maestra` la acepta, solo para una emergencia.
#   --tipo s3   S3 genérico (R2 u otro): pide endpoint, access key y secret.
#
# Uso (como root en el VPS, mejor dentro de tmux):
#   set-remote.sh --tipo b2 --nombre b2 --bucket dtdcargo-respaldos [--dir /srv/ops/backup/rclone]
#
# Códigos: 0 listo · 2 uso inválido o claves que no sirven (no se guarda nada).
set -euo pipefail
umask 077

TIPO=""
NOMBRE=""
BUCKET=""
DIR="/srv/ops/backup/rclone"
RCLONE_IMAGE="rclone/rclone:1.75.1"
NETWORK="${RCLONE_NETWORK:-bridge}"
PERMITIR_MAESTRA=0

usage() { sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { echo "set-remote: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tipo) setopt TIPO "${2-}"; shift 2 ;;
    --nombre) setopt NOMBRE "${2-}"; shift 2 ;;
    --bucket) setopt BUCKET "${2-}"; shift 2 ;;
    --dir) setopt DIR "${2-}"; shift 2 ;;
    --permitir-maestra) PERMITIR_MAESTRA=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done
[[ "${TIPO}" == "b2" || "${TIPO}" == "s3" ]] || die "--tipo b2 o --tipo s3"
[[ "${NOMBRE}" =~ ^[a-z][a-z0-9_-]*$ ]] || die "--nombre inválido: '${NOMBRE}' (p. ej. b2)"
[[ "${BUCKET}" =~ ^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$ ]] || die "--bucket inválido: '${BUCKET}'"
command -v docker >/dev/null || die "docker no está en el PATH"

tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then tty_in=/dev/tty; fi
# shellcheck source=../lib/prompt.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/prompt.sh"
trap 'pause_in_tmux' EXIT

# Variables del remoto por entorno (RCLONE_CONFIG_<NOMBRE>_*), nunca por argumento.
PFX="RCLONE_CONFIG_$(tr '[:lower:]-' '[:upper:]_' <<< "${NOMBRE}")"
rc() {
  local envs=() v
  for v in $(compgen -e | grep -E "^${PFX}_"); do envs+=(-e "${v}"); done
  docker run --rm --network "${NETWORK}" "${envs[@]}" "${RCLONE_IMAGE}" \
    --contimeout 15s --timeout 60s --retries 1 --low-level-retries 2 "$@"
}
# Igual, con -i: solo para `rcat`, con su entrada redirigida explícitamente (sin
# -i el contenedor no recibe nada; con -i en las demás llamadas se comería la
# entrada del script).
rc_in() {
  local envs=() v
  for v in $(compgen -e | grep -E "^${PFX}_"); do envs+=(-e "${v}"); done
  docker run --rm -i --network "${NETWORK}" "${envs[@]}" "${RCLONE_IMAGE}"     --contimeout 15s --timeout 60s --retries 1 --low-level-retries 2 "$@"
}

problem=""
for (( try = 1; ; try++ )); do
  if [[ "${TIPO}" == "b2" ]]; then
    ask_secret "keyID de Backblaze: " K1 || die "${problem:-no llegó el keyID}"
    ask_secret "applicationKey de Backblaze: " K2 || die "${problem:-no llegó la applicationKey}"
    if [[ -z "${K1}" || -z "${K2}" || "${K1}${K2}" =~ [[:space:]] ]]; then
      problem="las claves no llegaron bien: keyID $(describe_input "${K1}"); applicationKey $(describe_input "${K2}")"
    elif (( ${#K1} == 12 )) && [[ "${PERMITIR_MAESTRA}" != 1 ]]; then
      problem="esa es la clave MAESTRA de tu cuenta de Backblaze (keyID de 12 caracteres): en el servidor va una clave restringida al bucket ${BUCKET}, cuyo keyID tiene 25 caracteres y suele empezar con 00, y cuya applicationKey empieza con K"
    else
      echo "claves recibidas (keyID ${#K1} caracteres, applicationKey ${#K2})"
      export "${PFX}_TYPE=b2" "${PFX}_ACCOUNT=${K1}" "${PFX}_KEY=${K2}" "${PFX}_HARD_DELETE=true"
      problem=""
    fi
  else
    ask_secret "endpoint S3 (https://…): " EP || die "${problem:-no llegó el endpoint}"
    ask_secret "access key ID: " K1 || die "${problem:-no llegó la access key}"
    ask_secret "secret access key: " K2 || die "${problem:-no llegó el secret}"
    if [[ ! "${EP}" =~ ^https?://[^[:space:]]+$ || -z "${K1}" || -z "${K2}" || "${K1}${K2}" =~ [[:space:]] ]]; then
      problem="los datos no llegaron bien (endpoint: $(describe_input "${EP}"); key: $(describe_input "${K1}"); secret: $(describe_input "${K2}"))"
    else
      export "${PFX}_TYPE=s3" "${PFX}_PROVIDER=Other" "${PFX}_ENDPOINT=${EP}" "${PFX}_ACCESS_KEY_ID=${K1}" \
        "${PFX}_SECRET_ACCESS_KEY=${K2}" "${PFX}_REGION=auto" "${PFX}_FORCE_PATH_STYLE=true"
      problem=""
    fi
  fi
  if [[ -z "${problem}" ]]; then
    prueba="prueba-conexion-$(date -u +%Y%m%dT%H%M%SZ).txt"
    if ! rc lsf "${NOMBRE}:${BUCKET}" --max-depth 1 > /dev/null 2>&1; then
      problem="no se pudo listar el bucket ${BUCKET} con esas claves (¿el nombre del bucket es ese? ¿la llave tiene acceso a ese bucket?)"
    elif ! rc_in rcat "${NOMBRE}:${BUCKET}/${prueba}" <<< "conexion VPS DTD Cargo" > /dev/null 2>&1; then
      problem="se pudo listar pero NO escribir: la llave tiene que ser «Read and Write»"
    elif [[ "$(rc cat "${NOMBRE}:${BUCKET}/${prueba}" 2>/dev/null)" != "conexion VPS DTD Cargo" ]]; then
      problem="se escribió pero no se pudo leer de vuelta"
    elif ! rc deletefile "${NOMBRE}:${BUCKET}/${prueba}" > /dev/null 2>&1; then
      problem="se escribió pero NO se pudo borrar: la retención de 30 días no funcionaría"
    elif [[ -n "$(rc lsf "${NOMBRE}:${BUCKET}" --include "${prueba}" $([[ "${TIPO}" == "b2" ]] && echo --b2-versions) 2>/dev/null)" ]]; then
      problem="el archivo de prueba quedó como versión oculta: el borrado no es real (revisa «Keep only the last version» en el bucket)"
    else
      break
    fi
  fi
  retry_or_die "${try}" "${problem}" "Pega de nuevo las claves, una por una, con Enter después de cada una"
done

# Guardar el remoto (archivo 600 en una carpeta 700, reemplazando solo esta sección).
install -d -m 700 "${DIR}"
conf="${DIR}/rclone.conf"
tmp="$(mktemp "${DIR}/.rclone.conf.XXXXXX")"
chmod 600 "${tmp}"
{
  [[ -f "${conf}" ]] && awk -v s="[${NOMBRE}]" 'BEGIN{skip=0} /^\[/{skip=($0==s)} !skip' "${conf}"
  echo "[${NOMBRE}]"
  for v in $(compgen -e | grep -E "^${PFX}_" | sort); do
    k="${v#"${PFX}_"}"
    printf '%s = %s\n' "$(tr '[:upper:]' '[:lower:]' <<< "${k}")" "${!v}"
  done
  echo
} > "${tmp}"
mv -f "${tmp}" "${conf}"
unset K1 K2
log "listo: remoto «${NOMBRE}» guardado en ${conf} (600). Bucket ${BUCKET}: listar, escribir, leer y borrar de verdad PASÓ."
