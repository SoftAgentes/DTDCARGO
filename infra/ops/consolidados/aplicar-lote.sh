#!/usr/bin/env bash
# infra/ops/consolidados/aplicar-lote.sh — corre UN paso de un lote de consolidados (SDD-0543) en la base de PRUEBA.
#
# El lote lo genera `pnpm consolidados:lote` en un checkout (scripts/consolidados/)
# y llega al servidor por scp como una carpeta con previa.sql, simulacro.sql,
# aplicar.sql, verificar.sql, deshacer.sql, manifiesto.json, resumen.md y
# SHA256SUMS. Este script corre uno de esos scripts con psql dentro de
# `<proyecto>-db-1`, como `postgres`, y deja la evidencia sin nombres de
# clientes (sólo la salida de psql, los conteos y las huellas).
#
# Orden normal: previa → simulacro → aplicar → verificar. `aplicar` exige un
# simulacro PASÓ del mismo lote en la misma base (evidencia previa); `deshacer`
# borra lógicamente todo el lote y exige --confirm-deshacer <id del lote>.
#
# SOLO PRUEBA. El proyecto tiene que terminar en `-staging` y no puede ser el de
# producción (PROD_COMPOSE_PROJECT, por defecto dtd-cargo). Pasar un lote a la
# base oficial se decide con Sam y el Director, con otro procedimiento.
#
# Uso:
#   aplicar-lote.sh --project dtd-cargo-staging --confirm dtd-cargo-staging \
#       --lote /srv/ops/paquetes/lote-59 --paso previa|simulacro|aplicar|verificar|deshacer \
#       [--evidence-dir /srv/ops/evidencias] [--confirm-deshacer <id>] [--dry-run]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda · 4 integridad
# (SHA256SUMS) · 5 falta el simulacro previo · 6 psql falló (la transacción se
# deshizo) · 7 la salida no tiene la forma esperada (leer la evidencia).
set -uo pipefail
umask 077

die() { echo "aplicar-lote: $*" >&2; exit 2; }
refuse() { echo "aplicar-lote: RECHAZADO · $*" >&2; exit 3; }

PROJECT=""; CONFIRM=""; LOTE=""; PASO=""; EVIDENCE_DIR="/srv/ops/evidencias"; CONFIRM_DESHACER=""; DRY_RUN=0
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"
PASOS="previa simulacro aplicar verificar deshacer"

setopt() { local n="$1" v="${2-}"; [[ -n "${v}" && "${v}" != --* ]] || die "falta el valor de ${n}"; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt "$1" "${2-}"; PROJECT="$2"; shift 2 ;;
    --confirm) setopt "$1" "${2-}"; CONFIRM="$2"; shift 2 ;;
    --lote) setopt "$1" "${2-}"; LOTE="${2%/}"; shift 2 ;;
    --paso) setopt "$1" "${2-}"; PASO="$2"; shift 2 ;;
    --evidence-dir) setopt "$1" "${2-}"; EVIDENCE_DIR="$2"; shift 2 ;;
    --confirm-deshacer) setopt "$1" "${2-}"; CONFIRM_DESHACER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) die "argumento desconocido: $1" ;;
  esac
done
[[ -n "${PROJECT}" && -n "${LOTE}" && -n "${PASO}" ]] || die "faltan --project, --lote o --paso"

# ── Guardas ────────────────────────────────────────────────────────────────
[[ "${PROJECT}" != "${PROD_PROJECT}" ]] || refuse "${PROJECT} es producción: este script es sólo para prueba"
[[ "${PROJECT}" == *-staging ]] || refuse "${PROJECT} no termina en -staging"
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "--confirm tiene que repetir el proyecto (${PROJECT})"
[[ " ${PASOS} " == *" ${PASO} "* ]] || die "--paso tiene que ser uno de: ${PASOS}"
[[ -d "${LOTE}" ]] || refuse "no existe la carpeta del lote ${LOTE}"
[[ -f "${LOTE}/SHA256SUMS" ]] || refuse "el lote no trae SHA256SUMS"
( cd "${LOTE}" && sha256sum --check --quiet --strict SHA256SUMS ) || { echo "aplicar-lote: SHA256SUMS no coincide" >&2; exit 4; }
SCRIPT="${LOTE}/${PASO}.sql"
[[ -f "${SCRIPT}" ]] || refuse "el lote no trae ${PASO}.sql"
[[ "$(awk 'NF && $0 !~ /^[[:space:]]*--/ { print; exit }' "${SCRIPT}")" == '\set ON_ERROR_STOP on' ]] \
  || refuse "${PASO}.sql no empieza con \\set ON_ERROR_STOP on"
LOTE_ID="$(sed -nE 's/^[[:space:]]*"lote":[[:space:]]*"([^"]+)".*$/\1/p' "${LOTE}/manifiesto.json" | head -1)"
[[ -n "${LOTE_ID}" ]] || refuse "manifiesto.json no trae el id del lote"
grep -qF -- "${LOTE_ID}" "${SCRIPT}" || refuse "${PASO}.sql no es del lote ${LOTE_ID}"
ENTORNO="$(sed -nE 's/^[[:space:]]*"entorno":[[:space:]]*"([^"]+)".*$/\1/p' "${LOTE}/manifiesto.json" | head -1)"
[[ "${ENTORNO}" == "prueba" ]] || refuse "el lote se generó para «${ENTORNO}», no para prueba"
case "${PASO}" in
  aplicar|deshacer) CIERRE="COMMIT" ;;
  *) CIERRE="ROLLBACK" ;;
esac
if [[ "${PASO}" == "deshacer" ]]; then
  [[ "${CONFIRM_DESHACER}" == "${LOTE_ID}" ]] || refuse "deshacer exige --confirm-deshacer ${LOTE_ID}"
fi
if [[ "${PASO}" == "aplicar" ]]; then
  # Un simulacro PASÓ del MISMO lote en la MISMA base: su evidencia tiene el
  # id en LOTE.txt, la salida termina en ROLLBACK y el NOTICE del lote (que
  # psql manda a stderr) nombra el id.
  previo=""
  for d in "${EVIDENCE_DIR}"/lote-*-"${PROJECT}"-*/; do
    [[ -f "${d}LOTE.txt" && -f "${d}simulacro.out" && -f "${d}simulacro.err" ]] || continue
    grep -qx "lote=${LOTE_ID}" "${d}LOTE.txt" || continue
    [[ "$(awk 'NF { l = $0 } END { print l }' "${d}simulacro.out")" == "ROLLBACK" ]] || continue
    grep -q -- "NOTICE:.*lote ${LOTE_ID} " "${d}simulacro.err" || continue
    previo="${d}"
  done
  if [[ -z "${previo}" ]]; then
    echo "aplicar-lote: falta un simulacro PASÓ del lote ${LOTE_ID} en ${PROJECT} (corre --paso simulacro primero)" >&2
    exit 5
  fi
fi

DB="${PROJECT}-db-1"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
EVID="${EVIDENCE_DIR}/lote-${LOTE_ID//[^A-Za-z0-9]/_}-${PROJECT}-${TS}"
echo "aplicar-lote: lote ${LOTE_ID} · paso ${PASO} · base ${DB} · evidencia ${EVID}"
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "+ docker exec -i ${DB} psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < ${SCRIPT}  (cierre esperado: ${CIERRE})"
  exit 0
fi
mkdir -p "${EVID}"
cp "${LOTE}/SHA256SUMS" "${EVID}/SHA256SUMS.lote"
printf 'lote=%s\npaso=%s\nproyecto=%s\nhora=%s\n' "${LOTE_ID}" "${PASO}" "${PROJECT}" "${TS}" > "${EVID}/LOTE.txt"
# Los conteos esperados (la primera aparición de cada clave: la de `esperado`).
grep -oE '"(envios|recepciones|items|cajas|clientes|facturas|cbm|kg|base)":[[:space:]]*[0-9.]+' "${LOTE}/manifiesto.json" \
  | sed -E 's/"//g; s/:[[:space:]]*/=/' | awk -F= '!seen[$1]++' >> "${EVID}/LOTE.txt"

docker exec -i "${DB}" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < "${SCRIPT}" > "${EVID}/${PASO}.out" 2> "${EVID}/${PASO}.err"
rc=$?
( cd "${EVID}" && sha256sum -- * > SHA256SUMS ) 2>/dev/null
if [[ ${rc} -ne 0 ]]; then
  echo "aplicar-lote: FALLÓ · psql salió ${rc}: $(grep -m1 -E 'ERROR|FATAL' "${EVID}/${PASO}.err" || echo 'sin línea ERROR')" >&2
  exit 6
fi
primera="$(awk 'NF { print; exit }' "${EVID}/${PASO}.out")"
ultima="$(awk 'NF { l = $0 } END { print l }' "${EVID}/${PASO}.out")"
if [[ "${primera}" != "BEGIN" || "${ultima}" != "${CIERRE}" ]]; then
  echo "aplicar-lote: FALLÓ · la salida de ${PASO} no empieza en BEGIN o no termina en ${CIERRE} (leer ${EVID}/${PASO}.out)" >&2
  exit 7
fi
aviso="$(grep -E '^NOTICE:|^psql:.*NOTICE' "${EVID}/${PASO}.err" | tail -1)"
echo "aplicar-lote: PASÓ · ${PASO} · ${CIERRE}${aviso:+ · ${aviso#*NOTICE:  }}"
