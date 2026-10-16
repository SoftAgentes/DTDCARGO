#!/usr/bin/env bash
# infra/ops/staging/ips-prueba.sh — la lista de IP del entorno de prueba (SDD-0540).
#
# Desde el 2026-10-16 prueba guarda datos reales de los consolidados (excepción
# D2) y Sam eligió protegerlo «Solo desde mis IP». compose.staging.yml exige dos
# variables en el .env de prueba y este script las escribe:
#
#   STAGING_ALLOWED_IPS   la IP de Sam, medida desde SU conexión SSH al VPS
#                         (${SSH_CLIENT%% *}), o una que se pasa con --cidr.
#   STAGING_INTERNAL_IPS  el propio VPS: la puerta de enlace de la red de Traefik
#                         (--red, dtd_edge), por donde el web de prueba llega a su
#                         API, y la IP pública (--ip), por donde llegan los smokes
#                         desde el host. Medido el 2026-10-16 en el log de Traefik.
#                         Cualquier contenedor del VPS, de cualquier red, sale por
#                         el NAT de Docker con esa misma puerta: del VPS entra
#                         todo; de internet, solo la lista de Sam.
#
# Nunca imprime una IP: solo cuántos rangos hay y su huella (sha256 corto).
#
#   ips-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging          # IP de Sam por SSH (reemplaza)
#   ips-prueba.sh … --agregar                                                      # suma la IP actual (otra red de Sam)
#   ips-prueba.sh … --cidr 203.0.113.7/32                                          # una IP dada, sin SSH
#   ips-prueba.sh … --aplicar                                                      # además recrea web, mailpit y api-gw
#   ips-prueba.sh … --dry-run
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT=""; CONFIRM=""; PROJECT_DIR=""; CIDR=""; AGREGAR=0; APLICAR=0; DRY_RUN=0
IP_PUBLICA="217.216.54.70"; RED="dtd_edge"; EVIDENCE_DIR="/srv/ops/evidencias"

die() { echo "ips-prueba: $*" >&2; exit 2; }
refuse() { echo "ips-prueba: RECHAZADO · $*" >&2; exit 3; }
log() { echo "$(date -u +%H:%M:%SZ) $*"; }
# shellcheck source=lib-prueba.sh
source "${HERE}/lib-prueba.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2-}"; shift 2 ;;
    --confirm) CONFIRM="${2-}"; shift 2 ;;
    --project-dir) PROJECT_DIR="${2-}"; shift 2 ;;
    --cidr) CIDR="${2-}"; shift 2 ;;
    --agregar) AGREGAR=1; shift ;;
    --aplicar) APLICAR=1; shift ;;
    --ip) IP_PUBLICA="${2-}"; shift 2 ;;
    --red) RED="${2-}"; shift 2 ;;
    --evidence-dir) EVIDENCE_DIR="${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done

prueba_guarda_proyecto "${PROJECT}"
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "falta --confirm ${PROJECT}"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
prueba_guarda_carpeta "${PROJECT_DIR}"
ENV_FILE="${PROJECT_DIR}/.env"
[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE} (primero crear-prueba.sh)"

cidr_valido() { # IPv4/32..8 o IPv6/128..32, sin rangos abiertos
  local c="$1"
  if [[ "${c}" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/([0-9]{1,2})$ ]]; then
    for o in "${BASH_REMATCH[@]:1:4}"; do (( 10#${o} <= 255 )) || return 1; done
    (( 10#${BASH_REMATCH[5]} >= 8 && 10#${BASH_REMATCH[5]} <= 32 ))
  elif [[ "${c}" =~ ^[0-9a-fA-F]*:[0-9a-fA-F:]+/([0-9]{1,3})$ ]]; then
    (( 10#${BASH_REMATCH[1]} >= 32 && 10#${BASH_REMATCH[1]} <= 128 ))
  else
    return 1
  fi
}
a_cidr() { [[ "$1" == */* ]] && echo "$1" || { [[ "$1" == *:* ]] && echo "$1/128" || echo "$1/32"; }; }
huella() { printf '%s' "$1" | sha256sum | cut -c1-16; }

# 1. La IP de Sam.
if [[ -n "${CIDR}" ]]; then
  nueva="$(a_cidr "${CIDR}")"
else
  [[ -n "${SSH_CLIENT-}" ]] || die "sin \$SSH_CLIENT: corre esto en una sesión SSH de Sam, o usa --cidr"
  nueva="$(a_cidr "${SSH_CLIENT%% *}")"
fi
cidr_valido "${nueva}" || die "la IP de Sam no es un CIDR válido y cerrado (largo ${#nueva})"

actual="$(grep -E '^STAGING_ALLOWED_IPS=' "${ENV_FILE}" | tail -1 | cut -d= -f2- | tr -d "\"' \r")"
if (( AGREGAR )) && [[ -n "${actual}" ]]; then
  lista="$(printf '%s\n' "${actual//,/$'\n'}" "${nueva}" | awk 'NF && !v[$0]++' | paste -sd, -)"
else
  lista="${nueva}"
fi

# 2. El propio VPS: puerta de enlace de la red de Traefik e IP pública.
if (( DRY_RUN )); then
  gw="172.18.0.1"
else
  gw="$(docker network inspect "${RED}" --format '{{range .IPAM.Config}}{{.Gateway}} {{end}}' 2>/dev/null | awk '{print $1}')"
fi
[[ -n "${gw}" ]] || die "no pude leer la puerta de enlace de la red ${RED}"
internas="$(a_cidr "${gw}"),$(a_cidr "${IP_PUBLICA}")"
for c in ${lista//,/ } ${internas//,/ }; do cidr_valido "${c}" || die "rango inválido o abierto (largo ${#c})"; done

log "ips-prueba · ${PROJECT} · Sam: $(tr ',' '\n' <<< "${lista}" | wc -l) rango(s), huella $(huella "${lista}") · VPS: 2 rangos (${RED} + IP pública), huella $(huella "${internas}")"
if (( DRY_RUN )); then
  log "dry-run: no se escribe nada"
  exit 0
fi

ts="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "${ENV_FILE}" "${ENV_FILE}.bak-ips-${ts}"
prueba_fijar_env "${ENV_FILE}" STAGING_ALLOWED_IPS "${lista}"
prueba_fijar_env "${ENV_FILE}" STAGING_INTERNAL_IPS "${internas}"
log ".env actualizado (copia ${ENV_FILE##*/}.bak-ips-${ts}); el valor anterior de Sam tenía huella $(huella "${actual}")"
mkdir -p "${EVIDENCE_DIR}"
{
  echo "ips-prueba ${ts} · ${PROJECT}"
  echo "STAGING_ALLOWED_IPS: $(tr ',' '\n' <<< "${lista}" | wc -l) rango(s) · huella $(huella "${lista}") · anterior $(huella "${actual}")"
  echo "STAGING_INTERNAL_IPS: puerta de ${RED} + IP pública · huella $(huella "${internas}")"
} > "${EVIDENCE_DIR}/ips-prueba-${ts}.txt"

if (( APLICAR )); then
  # Solo los routers que leen la lista; los que no están arriba se quedan así.
  arriba=()
  for s in web mailpit api-gw; do
    docker ps -q --filter "label=com.docker.compose.project=${PROJECT}" --filter "label=com.docker.compose.service=${s}" | grep -q . && arriba+=("${s}")
  done
  if (( ${#arriba[@]} )); then
    prueba_compose up -d --no-deps --force-recreate "${arriba[@]}" > /dev/null 2>&1 || die "falló el compose up de ${arriba[*]}"
    log "recreados: ${arriba[*]}"
  else
    log "ningún router de prueba arriba: la lista entra al arrancar"
  fi
fi
log "listo · evidencia ${EVIDENCE_DIR}/ips-prueba-${ts}.txt"
