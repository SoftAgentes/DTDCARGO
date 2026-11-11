#!/usr/bin/env bash
# infra/ops/staging/desplegar-prueba.sh — sube la imagen de una rama a prueba (SDD-0540 §2.5, Fase 1).
#
# Lo corre la sesión de Contabo por SSH cuando el Director lo pide. No necesita el
# OK de Sam por despliegue (decisión D5): prueba no toca clientes ni producción.
# La imagen la construyó antes `.github/workflows/build-image-prueba.yml`.
#
# Pasos:
#   1. Guardas: proyecto `*-staging` y nunca producción; imagen
#      ghcr.io/softagentes/dtdcargo:prueba-sha-<sha>, exactamente la del --sha.
#   2. `docker pull` de la imagen.
#   3. verificar-aislamiento.sh completo (secretos, integraciones, Vault, bundle):
#      si algo FALLA, no se cambia nada.
#   4. Respaldo del .env (.env.bak-desplegar-<ts>) y DTD_WEB_IMAGE nuevo.
#   5. `up -d --no-deps web` y espera del healthcheck.
#   6. Smoke de la puerta: sin clave 401, con clave 200 (/, /studio/login,
#      /correo/), `X-Robots-Tag: noindex` en los dos hosts y la API sin apikey 401.
#      (smoke-web.sh todavía no manda la clave del web: queda como propuesta.)
#   7. Registro en <project-dir>/EN-PRUEBA.txt (PR, SHA, desde cuándo, quién) y
#      evidencia en <evidencias>/prueba-desplegar-<ts>.txt.
# Si el paso 5 o el 6 fallan, el script imprime cómo volver a la imagen anterior;
# no lo hace solo.
#
# Uso (en el VPS):
#   desplegar-prueba.sh --project dtd-cargo-staging --sha <40 hex> \
#       --image ghcr.io/softagentes/dtdcargo:prueba-sha-<40 hex> \
#       [--pr <número>] [--quien <texto>] [--project-dir /srv/dtd-cargo-staging] \
#       [--prod-env /srv/dtd-cargo/.env] [--ip 127.0.0.1] [--evidence-dir /srv/ops/evidencias] [--dry-run]
#
# Códigos: 0 desplegado · 2 uso inválido · 3 rechazado por una guarda · 4 el
# aislamiento FALLÓ (no se cambió nada) · 5 pull o compose fallaron · 6 el web no
# quedó sano o el smoke FALLÓ (imagen nueva puesta: lee la evidencia).
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT=""
SHA=""
IMAGE=""
PR="-"
QUIEN="sesión de Contabo"
PROJECT_DIR=""
PROD_ENV="/srv/dtd-cargo/.env"
IP="127.0.0.1"
EVIDENCE_DIR="/srv/ops/evidencias"
DRY_RUN=0

die() { echo "desplegar-prueba: $*" >&2; exit 2; }
refuse() { echo "desplegar-prueba: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
# shellcheck source=lib-prueba.sh
source "${HERE}/lib-prueba.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --sha) setopt SHA "${2-}"; shift 2 ;;
    --image) setopt IMAGE "${2-}"; shift 2 ;;
    --pr) setopt PR "${2-}"; shift 2 ;;
    --quien) setopt QUIEN "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --prod-env) setopt PROD_ENV "${2-}"; shift 2 ;;
    --ip) setopt IP "${2-}"; shift 2 ;;
    --evidence-dir) setopt EVIDENCE_DIR "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

prueba_guarda_proyecto "${PROJECT}"
prueba_guarda_sha "${SHA}"
prueba_guarda_imagen "${IMAGE}" "${SHA}"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"; PROJECT_DIR="${PROJECT_DIR%/}"
prueba_guarda_carpeta "${PROJECT_DIR}"
[[ "${PR}" =~ ^(-|[0-9]{1,6})$ ]] || die "--pr tiene que ser un número de PR"
[[ "${QUIEN}" =~ ^[[:print:]]{1,80}$ ]] || die "--quien inválido"
ENV_FILE="${PROJECT_DIR}/.env"
WEB_HOST=""; API_HOST=""

if (( DRY_RUN )); then
  echo "desplegar-prueba: dry-run · ${IMAGE##*:} en ${PROJECT} · no se toca nada"
  echo "+ docker pull ${IMAGE}"
  echo "+ ${HERE}/verificar-aislamiento.sh --env ${ENV_FILE} --prod-env ${PROD_ENV} --project ${PROJECT} --image ${IMAGE}"
  echo "+ cp ${ENV_FILE} ${ENV_FILE}.bak-desplegar-<ts>; DTD_WEB_IMAGE=${IMAGE}"
  echo "+ docker compose -p ${PROJECT} -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps web"
  echo "+ smoke de la puerta en ${IP}; registro en ${PROJECT_DIR}/EN-PRUEBA.txt"
  exit 0
fi

[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE} (primero crear-prueba.sh)"
WEB_HOST="$(prueba_env_valor "${ENV_FILE}" DTD_WEB_HOST)"
API_HOST="$(prueba_env_valor "${ENV_FILE}" SUPABASE_PUBLIC_HOST)"
[[ -n "${WEB_HOST}" && -n "${API_HOST}" ]] || die "DTD_WEB_HOST o SUPABASE_PUBLIC_HOST faltan en ${ENV_FILE}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p -- "${EVIDENCE_DIR}" || die "no puedo crear ${EVIDENCE_DIR}"
EVID="${EVIDENCE_DIR%/}/prueba-desplegar-${TS}.txt"
: > "${EVID}" && chmod 600 "${EVID}"
log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "${EVID}"; }
anterior="$(prueba_env_valor "${ENV_FILE}" DTD_WEB_IMAGE)"
log "desplegar ${IMAGE##*:} en ${PROJECT} · PR ${PR} · ${QUIEN} · antes: ${anterior##*:}"

docker pull "${IMAGE}" > /dev/null 2>&1 || { log "FALLÓ docker pull ${IMAGE}"; exit 5; }
log "pull PASÓ"

if ! bash "${HERE}/verificar-aislamiento.sh" --env "${ENV_FILE}" --prod-env "${PROD_ENV}" --project "${PROJECT}" \
     --image "${IMAGE}" >> "${EVID}" 2>&1; then
  log "FALLÓ verificar-aislamiento (líneas FALLÓ arriba): no se cambió nada"
  exit 4
fi
log "verificar-aislamiento PASÓ"

cp -p -- "${ENV_FILE}" "${ENV_FILE}.bak-desplegar-${TS}"
prueba_fijar_env "${ENV_FILE}" DTD_WEB_IMAGE "${IMAGE}"
log ".env respaldado en .env.bak-desplegar-${TS}; DTD_WEB_IMAGE=${IMAGE##*:}"
volver="cp -p ${ENV_FILE}.bak-desplegar-${TS} ${ENV_FILE} && cd ${PROJECT_DIR} && docker compose -p ${PROJECT} -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps web"

if ! prueba_compose up -d --no-deps web >> "${EVID}" 2>&1; then
  log "FALLÓ compose up web. Para volver: ${volver}"; exit 5
fi
if ! prueba_esperar_sano "${PROJECT}-web-1" 180; then
  log "FALLÓ: ${PROJECT}-web-1 no quedó sano en 180 s. Para volver: ${volver}"; exit 6
fi
log "web sano"

if ! prueba_smoke_puerta "${WEB_HOST}" "${API_HOST}" "${IP}" "${PROJECT_DIR}/secretos/clave-web.txt" | tee -a "${EVID}"; then
  log "FALLÓ el smoke de la puerta. Para volver: ${volver}"; exit 6
fi

{
  printf 'En prueba desde %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'PR: %s\nSHA: %s\nImagen: %s\nQuién: %s\nAntes: %s\n' "${PR}" "${SHA}" "${IMAGE}" "${QUIEN}" "${anterior}"
} > "${PROJECT_DIR}/EN-PRUEBA.txt"
log "EN-PRUEBA.txt escrito · listo: https://${WEB_HOST} con ${IMAGE##*:}"
