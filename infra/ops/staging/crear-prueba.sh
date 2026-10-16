#!/usr/bin/env bash
# infra/ops/staging/crear-prueba.sh — levanta el entorno de prueba desde cero (SDD-0540 §2.9, Fase 1).
#
# Orquesta lo que la Fase 2 de la SDD-0505 hizo a mano, ahora con datos
# sintéticos. Antes, la sesión de Contabo copia por scp, desde su checkout en el
# SHA de main, `infra/dtd-cargo/` a <project-dir>, `infra/ops/` a /srv/ops, arma
# <project-dir>/functions (README de infra/dtd-cargo › Arrancar) y prepara el
# paquete de la base con `resetear-base-prueba.sh --preparar`.
#
# Pasos:
#   1. Guardas (proyecto `*-staging`, --confirm, carpeta) y archivos presentes.
#   2. .env: si no existe, env-prueba.sh lo genera (secretos nuevos, sin líneas
#      vacías, puerta cerrada) y el script PARA: la imagen se construye con la
#      anon de ese .env (PRUEBA_SUPABASE_ANON_KEY en GitHub), y recién después se
#      vuelve a correr. Si existe, se conserva y solo cambia DTD_WEB_IMAGE.
#   3. `docker pull` de la imagen de prueba de ese SHA y verificar-aislamiento.sh
#      --sin-base: si algo FALLA, se para antes de levantar nada.
#   4. resetear-base-prueba.sh: base nueva, migraciones de main y semilla.
#   5. clave-web-prueba.sh si la puerta sigue con el marcador inicial.
#   6. verificar-aislamiento.sh completo.
#   7. Solo con --con-dns: comprueba que los dos hosts resuelvan a --ip (Let's
#      Encrypt corta a los 5 fallos por hora) y levanta api-gw, realtime,
#      functions, mailpit, web y cron; espera el web y corre el smoke de la puerta.
#      Sin --con-dns termina con la base lista y dice el comando que falta.
# --solo-arrancar salta 2, 4 y 5: para cuando el DNS llega después.
#
# Uso (en el VPS):
#   crear-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --sha <sha de main> \
#       --bundle <paquete> [--project-dir /srv/dtd-cargo-staging] [--prod-env /srv/dtd-cargo/.env] \
#       [--con-dns] [--ip 217.216.54.70] [--solo-arrancar] [--evidence-dir /srv/ops/evidencias] [--dry-run]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda · 4 el
# aislamiento FALLÓ · 5 un paso falló (lee la evidencia) · 6 el DNS no resuelve al VPS.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT=""
CONFIRM=""
SHA=""
BUNDLE=""
PROJECT_DIR=""
PROD_ENV="/srv/dtd-cargo/.env"
CON_DNS=0
SOLO_ARRANCAR=0
IP="217.216.54.70"
EVIDENCE_DIR="/srv/ops/evidencias"
DRY_RUN=0

die() { echo "crear-prueba: $*" >&2; exit 2; }
refuse() { echo "crear-prueba: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
# shellcheck source=lib-prueba.sh
source "${HERE}/lib-prueba.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --confirm) setopt CONFIRM "${2-}"; shift 2 ;;
    --sha) setopt SHA "${2-}"; shift 2 ;;
    --bundle) setopt BUNDLE "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --prod-env) setopt PROD_ENV "${2-}"; shift 2 ;;
    --con-dns) CON_DNS=1; shift ;;
    --ip) setopt IP "${2-}"; shift 2 ;;
    --solo-arrancar) SOLO_ARRANCAR=1; shift ;;
    --evidence-dir) setopt EVIDENCE_DIR "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,31p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

prueba_guarda_proyecto "${PROJECT}"
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "--confirm tiene que repetir exactamente '${PROJECT}'"
prueba_guarda_sha "${SHA}"
IMAGE="${PRUEBA_IMAGE_REPO}:prueba-sha-${SHA}"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"; PROJECT_DIR="${PROJECT_DIR%/}"
prueba_guarda_carpeta "${PROJECT_DIR}"
[[ "${IP}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "--ip inválida: '${IP}'"
(( SOLO_ARRANCAR )) || [[ -n "${BUNDLE}" ]] || die "falta --bundle (resetear-base-prueba.sh --preparar)"
ENV_FILE="${PROJECT_DIR}/.env"

if (( DRY_RUN )); then
  echo "crear-prueba: dry-run · ${PROJECT} con ${IMAGE##*:} · no se toca nada"
  (( SOLO_ARRANCAR )) || echo "+ ${HERE}/env-prueba.sh --example ${PROJECT_DIR}/.env.example --out ${ENV_FILE} --image ${IMAGE} (si falta el .env)"
  echo "+ docker pull ${IMAGE}; ${HERE}/verificar-aislamiento.sh --sin-base"
  (( SOLO_ARRANCAR )) || {
    echo "+ ${HERE}/resetear-base-prueba.sh --project ${PROJECT} --confirm ${PROJECT} --to-sha ${SHA} --bundle ${BUNDLE}"
    echo "+ ${HERE}/clave-web-prueba.sh --project ${PROJECT} (si la puerta sigue cerrada)"
  }
  echo "+ ${HERE}/verificar-aislamiento.sh (completo)"
  if (( CON_DNS )); then echo "+ DNS a ${IP}; up -d api-gw realtime functions mailpit web cron; smoke de la puerta"
  else echo "+ sin --con-dns: termina con la base lista"; fi
  exit 0
fi

for f in compose.yml compose.supabase.yml compose.staging.yml .env.example supabase/volumes/db/roles.sql functions/main/index.ts; do
  [[ -f "${PROJECT_DIR}/${f}" ]] || die "falta ${PROJECT_DIR}/${f} (la sesión de Contabo copia infra/dtd-cargo en el SHA de main y arma functions/)"
done
[[ -f "${PROD_ENV}" ]] || die "no existe ${PROD_ENV}: sin el .env de producción no se puede comprobar el aislamiento"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p -- "${EVIDENCE_DIR}" || die "no puedo crear ${EVIDENCE_DIR}"
EVID="${EVIDENCE_DIR%/}/prueba-crear-${TS}.txt"
: > "${EVID}" && chmod 600 "${EVID}"
log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "${EVID}"; }
log "crear ${PROJECT} · ${IMAGE##*:} · con DNS: ${CON_DNS} · solo arrancar: ${SOLO_ARRANCAR}"

# 2. .env
if (( ! SOLO_ARRANCAR )); then
  if [[ -f "${ENV_FILE}" ]]; then
    prueba_fijar_env "${ENV_FILE}" DTD_WEB_IMAGE "${IMAGE}"
    log "2. .env existente conservado; DTD_WEB_IMAGE=${IMAGE##*:}"
  else
    bash "${HERE}/env-prueba.sh" --example "${PROJECT_DIR}/.env.example" --out "${ENV_FILE}" --image "${IMAGE}" >> "${EVID}" 2>&1 \
      || { log "FALLÓ env-prueba.sh"; exit 5; }
    # La imagen lleva adentro la anon de prueba (NEXT_PUBLIC_*, en el build): con un
    # .env recién nacido, cualquier imagen construida antes tiene otra. Se para aquí.
    log "2. .env nuevo con env-prueba.sh. Antes de seguir:"
    log "   a. cargar en el entorno prueba de GitHub PRUEBA_SUPABASE_ANON_KEY = ANON_KEY de ${ENV_FILE} (por SSH, sin pasar por el chat)"
    log "   b. gh workflow run build-image-prueba.yml --ref main -f sha=${SHA}"
    log "   c. volver a correr este mismo comando: el .env se conserva"
    exit 0
  fi
fi
[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE}"
if (( ! SOLO_ARRANCAR )) && [[ ! -d "${BUNDLE}" ]]; then
  log "FALTA el paquete ${BUNDLE} (en el checkout: resetear-base-prueba.sh --preparar; después scp)"; exit 2
fi

# 3. Imagen y aislamiento antes de levantar nada.
docker pull "${IMAGE}" > /dev/null 2>&1 || { log "FALLÓ docker pull ${IMAGE}"; exit 5; }
if ! bash "${HERE}/verificar-aislamiento.sh" --env "${ENV_FILE}" --prod-env "${PROD_ENV}" --project "${PROJECT}" \
     --image "${IMAGE}" --sin-base >> "${EVID}" 2>&1; then
  log "FALLÓ verificar-aislamiento (--sin-base): no se levantó nada"; exit 4
fi
log "3. pull y aislamiento previo PASÓ"

# 4 y 5. Base, migraciones, semilla y puerta.
if (( ! SOLO_ARRANCAR )); then
  bash "${HERE}/resetear-base-prueba.sh" --project "${PROJECT}" --confirm "${PROJECT}" --to-sha "${SHA}" \
    --bundle "${BUNDLE}" --project-dir "${PROJECT_DIR}" --evidence-dir "${EVIDENCE_DIR}" >> "${EVID}" 2>&1 \
    || { log "FALLÓ resetear-base-prueba.sh (su evidencia está en ${EVIDENCE_DIR}/reset-${PROJECT}-*)"; exit 5; }
  log "4. base reseteada a ${SHA:0:12} con la semilla"
  if [[ "$(prueba_env_valor "${ENV_FILE}" PRUEBA_WEB_USUARIOS)" == "pendiente:sin-clave" ]]; then
    bash "${HERE}/clave-web-prueba.sh" --project "${PROJECT}" --project-dir "${PROJECT_DIR}" >> "${EVID}" 2>&1 \
      || { log "FALLÓ clave-web-prueba.sh"; exit 5; }
    log "5. clave del web generada (secretos/clave-web.txt)"
  fi
fi

# 6. Aislamiento completo, con la base arriba.
if ! bash "${HERE}/verificar-aislamiento.sh" --env "${ENV_FILE}" --prod-env "${PROD_ENV}" --project "${PROJECT}" \
     --image "${IMAGE}" >> "${EVID}" 2>&1; then
  log "FALLÓ verificar-aislamiento con la base arriba: no se levanta el web"; exit 4
fi
log "6. aislamiento PASÓ"

if (( ! CON_DNS )); then
  log "base lista. Cuando prueba.dtdcargo.com y supabase-prueba.dtdcargo.com resuelvan a ${IP}:"
  log "  ${HERE}/crear-prueba.sh --project ${PROJECT} --confirm ${PROJECT} --sha ${SHA} --solo-arrancar --con-dns"
  exit 0
fi

# 7. Con el DNS resolviendo, el resto del stack.
WEB_HOST="$(prueba_env_valor "${ENV_FILE}" DTD_WEB_HOST)"
API_HOST="$(prueba_env_valor "${ENV_FILE}" SUPABASE_PUBLIC_HOST)"
for h in "${WEB_HOST}" "${API_HOST}"; do
  resuelve="$(getent ahostsv4 "${h}" 2>/dev/null | awk '{ print $1 }' | sort -u | tr '\n' ' ')"
  [[ " ${resuelve}" == *" ${IP} "* ]] || { log "FALLÓ DNS: ${h} resuelve a '${resuelve:-nada}', no a ${IP}. No se levanta api-gw (Let's Encrypt)"; exit 6; }
done
log "7. DNS PASÓ: los dos hosts resuelven a ${IP}"
prueba_compose up -d api-gw realtime functions mailpit web cron >> "${EVID}" 2>&1 || { log "FALLÓ compose up del stack"; exit 5; }
prueba_esperar_sano "${PROJECT}-web-1" 240 || { log "FALLÓ: ${PROJECT}-web-1 no quedó sano"; exit 5; }
if ! prueba_smoke_puerta "${WEB_HOST}" "${API_HOST}" "127.0.0.1" "${PROJECT_DIR}/secretos/clave-web.txt" | tee -a "${EVID}"; then
  log "FALLÓ el smoke de la puerta"; exit 5
fi
{
  printf 'En prueba desde %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'PR: -\nSHA: %s\nImagen: %s\nQuién: crear-prueba.sh (main)\n' "${SHA}" "${IMAGE}"
} > "${PROJECT_DIR}/EN-PRUEBA.txt"
log "prueba arriba: https://${WEB_HOST} · cuentas en ${PROJECT_DIR}/secretos/ · evidencia ${EVID}"
