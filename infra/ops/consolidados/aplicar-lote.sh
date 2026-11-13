#!/usr/bin/env bash
# infra/ops/consolidados/aplicar-lote.sh — corre UN paso de un lote de consolidados (SDD-0543) en prueba o en producción.
#
# El lote lo genera `pnpm consolidados:lote` en un checkout (scripts/consolidados/)
# y llega al servidor por scp como una carpeta con previa.sql, simulacro.sql,
# aplicar.sql, verificar.sql, deshacer.sql, manifiesto.json, resumen.md y
# SHA256SUMS. Este script corre uno de esos scripts con psql dentro de
# `<proyecto>-db-1`, como `postgres`, y deja la evidencia sin nombres de
# clientes (sólo la salida de psql, los conteos y las huellas).
#
# Orden normal: previa → simulacro → aplicar → verificar. `aplicar` exige un
# simulacro PASÓ del mismo lote en la misma base (evidencia previa) y se niega
# si ya hay un aplicar PASÓ de ese lote en esa base; además aplicar.sql aborta
# en su preflight si el contenedor, los envíos o las facturas ya existen.
# `deshacer` borra lógicamente todo el lote y exige --confirm-deshacer <id del
# lote>; `purgar` borra FÍSICAMENTE el lote y los clientes que creó y exige
# --confirm-purga <id del lote>.
#
# Destinos:
# - Prueba: el proyecto termina en `-staging` y el lote se generó con
#   `--entorno prueba`.
# - Producción (PROD_COMPOSE_PROJECT, por defecto dtd-cargo; extensión F2 de la
#   SDD-0543): el lote se generó con `--entorno produccion` y CADA paso exige
#   `AUTORIZACION.txt` (en la carpeta del lote, o --autorizacion <archivo>) con
#   el OK literal de Sam que nombra el contenedor del lote (su número). Previa,
#   simulacro, aplicar y verificar van de a uno. `deshacer` y `purgar` están
#   deshabilitados: borrar en producción lo corre Sam, no este script.
#
# Uso:
#   aplicar-lote.sh --project dtd-cargo-staging|dtd-cargo --confirm <el mismo> #       --lote /srv/ops/paquetes/lote-59 --paso previa|simulacro|aplicar|verificar|deshacer|purgar #       [--autorizacion <archivo>] [--evidence-dir /srv/ops/evidencias] #       [--confirm-deshacer <id>] [--confirm-purga <id>] [--dry-run]
#   (--proyecto es sinónimo de --project.)
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda (incluye falta
# de autorización y lote ya aplicado) · 4 integridad (SHA256SUMS) · 5 falta el
# simulacro previo · 6 psql falló (la transacción se deshizo; también el
# preflight que encuentra el lote ya cargado) · 7 la salida no tiene la forma
# esperada (leer la evidencia).
set -uo pipefail
umask 077

die() { echo "aplicar-lote: $*" >&2; exit 2; }
refuse() { echo "aplicar-lote: RECHAZADO · $*" >&2; exit 3; }

PROJECT=""; CONFIRM=""; LOTE=""; PASO=""; EVIDENCE_DIR="/srv/ops/evidencias"; CONFIRM_DESHACER=""; CONFIRM_PURGA=""; AUTORIZACION=""; DRY_RUN=0
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"
PASOS="previa simulacro aplicar verificar deshacer purgar"

setopt() { local n="$1" v="${2-}"; [[ -n "${v}" && "${v}" != --* ]] || die "falta el valor de ${n}"; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|--proyecto) setopt "$1" "${2-}"; PROJECT="$2"; shift 2 ;;
    --confirm) setopt "$1" "${2-}"; CONFIRM="$2"; shift 2 ;;
    --lote) setopt "$1" "${2-}"; LOTE="${2%/}"; shift 2 ;;
    --paso) setopt "$1" "${2-}"; PASO="$2"; shift 2 ;;
    --evidence-dir) setopt "$1" "${2-}"; EVIDENCE_DIR="$2"; shift 2 ;;
    --confirm-deshacer) setopt "$1" "${2-}"; CONFIRM_DESHACER="$2"; shift 2 ;;
    --confirm-purga) setopt "$1" "${2-}"; CONFIRM_PURGA="$2"; shift 2 ;;
    --autorizacion) setopt "$1" "${2-}"; AUTORIZACION="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) die "argumento desconocido: $1" ;;
  esac
done
[[ -n "${PROJECT}" && -n "${LOTE}" && -n "${PASO}" ]] || die "faltan --project, --lote o --paso"

# ── Guardas ────────────────────────────────────────────────────────────────
if [[ "${PROJECT}" == "${PROD_PROJECT}" ]]; then
  ES_PROD=1; ENTORNO_ESPERADO="produccion"
elif [[ "${PROJECT}" == *-staging ]]; then
  ES_PROD=0; ENTORNO_ESPERADO="prueba"
else
  refuse "${PROJECT} no es producción (${PROD_PROJECT}) ni termina en -staging"
fi
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "--confirm tiene que repetir el proyecto (${PROJECT})"
[[ " ${PASOS} " == *" ${PASO} "* ]] || die "--paso tiene que ser uno de: ${PASOS}"
if [[ ${ES_PROD} -eq 1 && ( "${PASO}" == "deshacer" || "${PASO}" == "purgar" ) ]]; then
  refuse "${PASO} está deshabilitado en producción: borrar lo corre Sam, no este script"
fi
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
[[ "${ENTORNO}" == "${ENTORNO_ESPERADO}" ]] || refuse "el lote se generó para «${ENTORNO}», no para ${ENTORNO_ESPERADO} (${PROJECT})"
if [[ ${ES_PROD} -eq 1 ]]; then
  # El OK de Sam es nominal y por lote: el archivo tiene que existir, no estar
  # vacío y nombrar el número del contenedor (61 no nombra el 610 ni el 161).
  AUTORIZACION="${AUTORIZACION:-${LOTE}/AUTORIZACION.txt}"
  [[ -s "${AUTORIZACION}" ]] || refuse "producción exige ${AUTORIZACION} con el OK literal de Sam para este lote"
  NUMERO="$(sed -nE 's/^carga-consolidado:([0-9]+):.*$/\1/p' <<< "${LOTE_ID}")"
  [[ -n "${NUMERO}" ]] || refuse "el id del lote ${LOTE_ID} no trae el número del contenedor"
  grep -qE "(^|[^0-9])${NUMERO}([^0-9]|\$)" -- "${AUTORIZACION}" \
    || refuse "la autorización no nombra el contenedor ${NUMERO}: el OK de Sam tiene que nombrar cada lote"
fi
case "${PASO}" in
  aplicar|deshacer|purgar) CIERRE="COMMIT" ;;
  *) CIERRE="ROLLBACK" ;;
esac
if [[ "${PASO}" == "deshacer" ]]; then
  [[ "${CONFIRM_DESHACER}" == "${LOTE_ID}" ]] || refuse "deshacer exige --confirm-deshacer ${LOTE_ID}"
fi
if [[ "${PASO}" == "purgar" ]]; then
  # Borrado definitivo (físico) del lote y de los clientes que creó: sólo prueba,
  # y el propio SQL se niega si no encuentra el cliente sintético de la semilla.
  [[ "${CONFIRM_PURGA}" == "${LOTE_ID}" ]] || refuse "purgar exige --confirm-purga ${LOTE_ID}"
fi
if [[ "${PASO}" == "aplicar" ]]; then
  # Un simulacro PASÓ del MISMO lote en la MISMA base: su evidencia tiene el
  # id en LOTE.txt, la salida termina en ROLLBACK y el NOTICE del lote (que
  # psql manda a stderr) nombra el id.
  previo=""
  for d in "${EVIDENCE_DIR}"/lote-*-"${PROJECT}"-*-simulacro/; do
    [[ -f "${d}LOTE.txt" && -f "${d}simulacro.out" && -f "${d}simulacro.err" ]] || continue
    grep -qx "lote=${LOTE_ID}" "${d}LOTE.txt" || continue
    [[ "$(awk 'NF { l = $0 } END { print l }' "${d}simulacro.out")" == "ROLLBACK" ]] || continue
    grep -q -- "NOTICE:.*lote ${LOTE_ID} " "${d}simulacro.err" || continue
    previo="${d}"
  done
  # Idempotencia: un aplicar PASÓ del mismo lote en la misma base cierra el
  # camino (el preflight de aplicar.sql lo repite contra la base).
  for d in "${EVIDENCE_DIR}"/lote-*-"${PROJECT}"-*-aplicar/; do
    [[ -f "${d}LOTE.txt" && -f "${d}aplicar.out" ]] || continue
    grep -qx "lote=${LOTE_ID}" "${d}LOTE.txt" || continue
    [[ "$(awk 'NF { l = $0 } END { print l }' "${d}aplicar.out")" == "COMMIT" ]] || continue
    refuse "el lote ${LOTE_ID} ya se aplicó en ${PROJECT} (evidencia ${d%/}); no se aplica dos veces"
  done
  if [[ -z "${previo}" ]]; then
    echo "aplicar-lote: falta un simulacro PASÓ del lote ${LOTE_ID} en ${PROJECT} (corre --paso simulacro primero)" >&2
    exit 5
  fi
fi

DB="${PROJECT}-db-1"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
# El paso va en el nombre: dos pasos en el mismo segundo no pisan su evidencia.
EVID="${EVIDENCE_DIR}/lote-${LOTE_ID//[^A-Za-z0-9]/_}-${PROJECT}-${TS}-${PASO}"
echo "aplicar-lote: lote ${LOTE_ID} · paso ${PASO} · base ${DB} · evidencia ${EVID}"
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "+ docker exec -i ${DB} psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < ${SCRIPT}  (cierre esperado: ${CIERRE})"
  exit 0
fi
mkdir -p "${EVID}"
cp "${LOTE}/SHA256SUMS" "${EVID}/SHA256SUMS.lote"
if [[ ${ES_PROD} -eq 1 ]]; then cp "${AUTORIZACION}" "${EVID}/AUTORIZACION.txt"; fi
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
