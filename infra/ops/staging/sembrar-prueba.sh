#!/usr/bin/env bash
# infra/ops/staging/sembrar-prueba.sh — carga la semilla sintética en la base de prueba (SDD-0540, Fase 1).
#
# Corre semilla-prueba.sql como supabase_admin en `<proyecto>-db-1`. Las claves de
# las cuentas sintéticas nacen en el servidor la primera vez y se guardan en
# <project-dir>/secretos/cuentas-prueba.txt (600); las corridas siguientes las
# reusan, así que sembrar dos veces deja las mismas cuentas con las mismas claves
# (idempotente). Las claves viajan a psql por la entrada estándar como `\set`,
# nunca por argumentos, y el script no las imprime.
#
# Uso (en el VPS):
#   sembrar-prueba.sh --project dtd-cargo-staging [--project-dir /srv/dtd-cargo-staging] \
#       [--semilla <semilla-prueba.sql>] [--db-container <proyecto>-db-1] [--salida <archivo>] [--dry-run]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por la guarda · 5 la semilla falló.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT=""
PROJECT_DIR=""
SEMILLA="${HERE}/semilla-prueba.sql"
DB=""
SALIDA=""
DRY_RUN=0

die() { echo "sembrar-prueba: $*" >&2; exit 2; }
refuse() { echo "sembrar-prueba: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
# shellcheck source=lib-prueba.sh
source "${HERE}/lib-prueba.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --semilla) setopt SEMILLA "${2-}"; shift 2 ;;
    --db-container) setopt DB "${2-}"; shift 2 ;;
    --salida) setopt SALIDA "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done
prueba_guarda_proyecto "${PROJECT}"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"; PROJECT_DIR="${PROJECT_DIR%/}"
prueba_guarda_carpeta "${PROJECT_DIR}"
DB="${DB:-${PROJECT}-db-1}"
[[ "${DB}" == "${PROJECT}-"* ]] || refuse "--db-container ${DB} no es un contenedor de ${PROJECT}"
[[ -f "${SEMILLA}" ]] || die "no existe la semilla ${SEMILLA}"
[[ "$(awk 'NF && $0 !~ /^[[:space:]]*--/ { print; exit }' "${SEMILLA}")" == '\set ON_ERROR_STOP on' ]] \
  || refuse "la primera línea útil de ${SEMILLA} no es \\set ON_ERROR_STOP on"

if (( DRY_RUN )); then
  echo "sembrar-prueba: dry-run · ${SEMILLA##*/} en ${DB} como supabase_admin · cuentas en ${PROJECT_DIR}/secretos/cuentas-prueba.txt"
  printf '+ docker exec -i %q psql -U supabase_admin -d postgres -X < (\\set de claves + %q)\n' "${DB}" "${SEMILLA}"
  exit 0
fi

[[ "$(docker inspect -f '{{.State.Running}}' "${DB}" 2>/dev/null)" == "true" ]] || die "el contenedor ${DB} no está corriendo"

# PIN de 4 dígitos que la app acepta (misma lista negra que validate_operario_pin_format).
DEBILES=" 0000 1111 2222 3333 4444 5555 6666 7777 8888 9999 1234 4321 0123 0987 1212 2121 0101 1010 1313 6969 2580 1357 2468 1379 "
pin_nuevo() {
  local p n
  while :; do
    n="$(od -An -N2 -tu2 /dev/urandom | tr -d '[:space:]')"
    p="$(printf '%04d' $(( n % 10000 )))"
    [[ "${DEBILES}" != *" ${p} "* && "${p}" != "${1:-}" ]] && { printf '%s' "${p}"; return; }
  done
}

CRED="${PROJECT_DIR}/secretos/cuentas-prueba.txt"
mkdir -p -m 700 -- "${PROJECT_DIR}/secretos"
leer() { grep -E "^$1=" "${CRED}" 2>/dev/null | tail -n1 | cut -d= -f2-; }
clave_admin="$(leer clave_admin)"; pin_ve="$(leer pin_ve)"; pin_cn="$(leer pin_cn)"
nuevas=0
if [[ ! "${clave_admin}" =~ ^[0-9a-f]{24}$ ]]; then clave_admin="$(openssl rand -hex 12)"; nuevas=1; fi
if [[ ! "${pin_ve}" =~ ^[0-9]{4}$ ]]; then pin_ve="$(pin_nuevo)"; nuevas=1; fi
if [[ ! "${pin_cn}" =~ ^[0-9]{4}$ ]]; then pin_cn="$(pin_nuevo "${pin_ve}")"; nuevas=1; fi
web_host="$(prueba_env_valor "${PROJECT_DIR}/.env" DTD_WEB_HOST)"; web_host="${web_host:-prueba.dtdcargo.com}"
{
  printf '# Cuentas SINTÉTICAS del entorno de prueba (sembrar-prueba.sh, %s). No sirven en producción.\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'url=https://%s\n' "${web_host}"
  printf 'admin_correo=admin@prueba.example.test\nclave_admin=%s\n' "${clave_admin}"
  printf 'pin_ve=%s\npin_cn=%s\n' "${pin_ve}" "${pin_cn}"
  printf 'portal_correo=cliente@prueba.example.test (enlace mágico en https://%s/correo/: uno por minuto, y se abre en el mismo navegador que lo pidió)\n' "${web_host}"
  printf 'proveedor_link=https://%s/p/05400000-0000-4000-8000-000000000303\n' "${web_host}"
} > "${CRED}.tmp"
chmod 600 "${CRED}.tmp"; mv -f -- "${CRED}.tmp" "${CRED}"

SALIDA="${SALIDA:-$(mktemp)}"
{
  # VERBOSITY terse y SHOW_CONTEXT never: un error no copia la sentencia (con las
  # claves ya sustituidas) en la salida.
  printf '%s\n' '\set ON_ERROR_STOP on' '\set VERBOSITY terse' '\set SHOW_CONTEXT never' \
    "\\set clave_admin '${clave_admin}'" "\\set pin_ve '${pin_ve}'" "\\set pin_cn '${pin_cn}'"
  cat -- "${SEMILLA}"
} | docker exec -i "${DB}" psql -U supabase_admin -d postgres -X > "${SALIDA}" 2>&1
rc=$?
unset clave_admin pin_ve pin_cn
if (( rc != 0 )) || [[ "$(awk 'NF { l = $0 } END { print l }' "${SALIDA}")" != "COMMIT" ]]; then
  echo "sembrar-prueba: FALLÓ la semilla (psql ${rc}); salida en ${SALIDA}:" >&2
  grep -E 'ERROR|semilla:' "${SALIDA}" | head -5 >&2
  exit 5
fi
echo "sembrar-prueba: semilla cargada en ${DB} · $(grep -E 'semilla_conteo' "${SALIDA}" | tr -s ' ' | head -n1)"
echo "sembrar-prueba: cuentas en ${CRED} (600)$( (( nuevas )) && echo ', claves nuevas' || echo ', claves de antes')"
