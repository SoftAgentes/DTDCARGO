#!/usr/bin/env bash
# infra/ops/staging/destroy-staging.sh — borra los DATOS de un staging con copia de producción (SDD-0505).
#
# El staging de la Fase 2 lleva una copia real de producción (base y Storage con
# datos personales). Vive lo que dura el ensayo y se destruye al cerrarlo
# (revisión del traslado, H6: docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md).
# El restore de prueba mensual NO usa staging: usa restore-test.sh, que restaura en
# un contenedor desechable en memoria.
#
# Qué borra (y lo comprueba después):
#   · contenedores, volúmenes y redes del proyecto compose (etiqueta
#     com.docker.compose.project=<proyecto>)
#   · el directorio de datos: PGDATA y Storage en archivos (DTD_DATA_DIR del .env,
#     por defecto <project-dir>/data)
#   · dumps locales del proyecto en <backups>/<proyecto>
#   · restos en /dev/shm de import-from-cloud.sh y restore.sh de ese proyecto
# Qué conserva: compose, .env y plantillas (sin datos), para el segundo ensayo.
# Con --purge-config borra también el .env (secretos del staging).
#
# Guardas:
#   · el proyecto tiene que terminar en `-staging` y no puede ser el de producción
#     (PROD_COMPOSE_PROJECT, por defecto dtd-cargo)
#   · --confirm <proyecto> tiene que repetir el nombre exacto
#
# Uso:
#   destroy-staging.sh --project dtd-cargo-staging --confirm dtd-cargo-staging \
#       [--project-dir /srv/dtd-cargo-staging] [--backups /srv/backups] \
#       [--purge-config] [--evidence <archivo>] [--dry-run]
#
# Códigos: 0 borrado y comprobado · 2 uso inválido · 3 rechazado por la guarda ·
# 6 quedó algo después de borrar (lee la evidencia).
set -euo pipefail
umask 077

PROJECT=""
CONFIRM=""
PROJECT_DIR=""
BACKUPS="/srv/backups"
EVIDENCE=""
PURGE_CONFIG=0
DRY_RUN=0
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

usage() {
  sed -n '2,31p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${EVIDENCE:-/dev/null}"
}

die() {
  echo "destroy-staging: $*" >&2
  exit 2
}

refuse() {
  echo "destroy-staging: RECHAZADO · $*" >&2
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
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --confirm) setopt CONFIRM "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --backups) setopt BACKUPS "${2-}"; shift 2 ;;
    --evidence) setopt EVIDENCE "${2-}"; shift 2 ;;
    --purge-config) PURGE_CONFIG=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${PROJECT}" != "${PROD_PROJECT}" ]] || refuse "${PROJECT} es el proyecto de producción"
[[ "${PROJECT}" == *-staging ]] || refuse "${PROJECT} no termina en -staging; este script solo borra stagings"
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "--confirm tiene que repetir exactamente '${PROJECT}'"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
PROJECT_DIR="${PROJECT_DIR%/}"
[[ "${PROJECT_DIR}" == /srv/*-staging || "${PROJECT_DIR}" == */*-staging ]] || refuse "--project-dir ${PROJECT_DIR} no es un directorio de staging"

# Directorio de datos: DTD_DATA_DIR del .env (sin `source`) o ./data.
data_dir="${PROJECT_DIR}/data"
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  v="$(grep -E '^DTD_DATA_DIR=' "${PROJECT_DIR}/.env" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"
  if [[ -n "${v}" ]]; then
    [[ "${v}" == /* ]] && data_dir="${v}" || data_dir="${PROJECT_DIR}/${v#./}"
  fi
fi
data_dir="${data_dir%/}"
# El directorio de datos de un staging nunca puede ser el de producción ni una raíz.
case "${data_dir}" in
  /|/srv|/srv/"${PROD_PROJECT}"|/srv/"${PROD_PROJECT}"/*) refuse "DTD_DATA_DIR=${data_dir} apunta a producción o a una raíz" ;;
esac
[[ "${data_dir}" == *-staging* ]] || refuse "DTD_DATA_DIR=${data_dir} no contiene '-staging': no lo borro"

label="com.docker.compose.project=${PROJECT}"

run() {
  if (( DRY_RUN )); then
    printf '+'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

if [[ -n "${EVIDENCE}" ]] && (( ! DRY_RUN )); then
  : > "${EVIDENCE}"
fi
log "destroy-staging ${PROJECT} · project-dir ${PROJECT_DIR} · datos ${data_dir} · backups ${BACKUPS}/${PROJECT}"

# 0. Inventario antes de borrar (va a la evidencia).
containers="$(docker ps -aq --filter "label=${label}" | wc -l)"
volumes="$(docker volume ls -q --filter "label=${label}" | wc -l)"
networks="$(docker network ls -q --filter "label=${label}" | wc -l)"
data_size="$( [[ -d "${data_dir}" ]] && du -sh "${data_dir}" 2>/dev/null | cut -f1 || echo 0)"
backups_size="$( [[ -d "${BACKUPS}/${PROJECT}" ]] && du -sh "${BACKUPS}/${PROJECT}" 2>/dev/null | cut -f1 || echo 0)"
shm_left="$(find /dev/shm -maxdepth 1 \( -name "import-${PROJECT}-*" -o -name "restore-${PROJECT}-*" -o -name "pg-dump-${PROJECT}-*" \) | wc -l)"
log "0/5 antes: ${containers} contenedores · ${volumes} volúmenes · ${networks} redes · datos ${data_size} · dumps ${backups_size} · /dev/shm ${shm_left}"

# 1. Contenedores (con sus volúmenes anónimos).
log "1/5 contenedores"
docker ps -aq --filter "label=${label}" | while read -r c; do run docker rm -f -v "${c}" >/dev/null; done

# 2. Volúmenes con nombre y redes del proyecto.
log "2/5 volúmenes y redes"
docker volume ls -q --filter "label=${label}" | while read -r v; do run docker volume rm "${v}" >/dev/null; done
docker network ls -q --filter "label=${label}" | while read -r n; do run docker network rm "${n}" >/dev/null; done

# 3. PGDATA y Storage en archivos.
log "3/5 datos en ${data_dir}"
if [[ -d "${data_dir}" ]]; then
  run rm -rf -- "${data_dir}"
fi

# 4. Dumps locales y restos en memoria.
log "4/5 dumps en ${BACKUPS}/${PROJECT} y restos en /dev/shm"
if [[ -d "${BACKUPS}/${PROJECT}" ]]; then
  run rm -rf -- "${BACKUPS:?}/${PROJECT}"
fi
find /dev/shm -maxdepth 1 \( -name "import-${PROJECT}-*" -o -name "restore-${PROJECT}-*" -o -name "pg-dump-${PROJECT}-*" \) -print0 \
  | while IFS= read -r -d '' d; do run rm -rf -- "${d}"; done
if (( PURGE_CONFIG )) && [[ -f "${PROJECT_DIR}/.env" ]]; then
  log "4/5 --purge-config: borro ${PROJECT_DIR}/.env"
  run rm -f -- "${PROJECT_DIR}/.env"
fi

if (( DRY_RUN )); then
  log "dry-run: nada borrado"
  exit 0
fi

# 5. Comprobación: tiene que quedar cero.
c="$(docker ps -aq --filter "label=${label}" | wc -l)"
v="$(docker volume ls -q --filter "label=${label}" | wc -l)"
n="$(docker network ls -q --filter "label=${label}" | wc -l)"
d="$( [[ -e "${data_dir}" ]] && echo 1 || echo 0)"
b="$( [[ -e "${BACKUPS}/${PROJECT}" ]] && echo 1 || echo 0)"
s="$(find /dev/shm -maxdepth 1 \( -name "import-${PROJECT}-*" -o -name "restore-${PROJECT}-*" -o -name "pg-dump-${PROJECT}-*" \) | wc -l)"
log "5/5 después: ${c} contenedores · ${v} volúmenes · ${n} redes · datos ${d} · dumps ${b} · /dev/shm ${s}"
if (( c + v + n + d + b + s != 0 )); then
  log "QUEDÓ ALGO: revisa la línea anterior antes de dar el staging por destruido"
  exit 6
fi
log "staging ${PROJECT} destruido y comprobado. Recordatorio: si hubo snapshot de Contabo durante el ensayo, también lleva la copia; bórralo en el panel."
