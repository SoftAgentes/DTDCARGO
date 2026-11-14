#!/usr/bin/env bash
# infra/ops/consolidados/aplicar-lote.sh — corre UN paso de un lote de consolidados (SDD-0543) en prueba o en producción.
#
# El lote lo genera `pnpm consolidados:lote` en un checkout (scripts/consolidados/)
# y llega al servidor por scp como una carpeta con previa.sql, simulacro.sql,
# aplicar.sql, verificar.sql, deshacer.sql y purgar.sql (sólo en prueba),
# manifiesto.json, resumen.md y SHA256SUMS. Este script corre uno de esos scripts con psql dentro de
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
#   el OK literal de Sam que cita el id COMPLETO del lote
#   (`carga-consolidado:<N>:<hash>`). Un `--autorizacion` que apunte a otro
#   archivo de la carpeta del lote (el manifiesto, el resumen) se rechaza, igual
#   que un enlace simbólico o un texto con `"nombreExcel"` o `"lote":` (eso es
#   un manifiesto, no el OK de Sam). Se copia UNA vez a un temporal (`cp -P`) y
#   el grep y la evidencia usan esa copia, no el original.
#   Previa, simulacro, aplicar y verificar van de a uno. `deshacer` y `purgar`
#   están deshabilitados: borrar en producción lo corre Sam, no este script. Un
#   paquete de producción que traiga deshacer.sql o purgar.sql se rechaza (el
#   generador no los emite para producción).
#
# Candado: simulacro, aplicar, deshacer y purgar toman
# LOTES_CANDADO (por defecto /run/lock/dtd-lotes.lock.d), un directorio que se
# crea con mkdir (atómico), igual que el de migraciones/aplicar.sh: dos pasos
# que escriben no corren a la vez. Adentro queda `pid` con el dueño; al salir
# (también por HUP, INT o TERM: 129, 130, 143) sólo se suelta si sigue siendo
# suyo. Si quedó de una corrida muerta, se borra a mano después de revisar con
# ese pid que no haya otra en curso. La autorización no puede ser un enlace
# simbólico.
#
# Uso:
#   aplicar-lote.sh --project dtd-cargo-staging|dtd-cargo --confirm <el mismo> \
#       --lote /srv/ops/paquetes/lote-59 \
#       --paso previa|simulacro|aplicar|verificar|deshacer|purgar \
#       [--autorizacion <archivo>] [--evidence-dir /srv/ops/evidencias] \
#       [--confirm-deshacer <id>] [--confirm-purga <id>] [--dry-run]
#   (--proyecto es sinónimo de --project.)
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda (incluye falta
# de autorización, candado tomado y lote ya aplicado) · 4 integridad (SHA256SUMS) · 5 falta el
# simulacro previo · 6 psql falló (la transacción se deshizo; también el
# preflight que encuentra el lote ya cargado) · 7 la salida no tiene la forma
# esperada (leer la evidencia) · 129 HUP · 130 INT · 143 TERM: el guion se cortó
# por una señal. Una señal NO hace rollback: con TERM, psql puede haber llegado
# al COMMIT y el guion igual sale 143; con HUP o INT, el psql del contenedor
# puede seguir corriendo después de que EXIT soltó el candado. Con 129, 130 o
# 143 (como con 7) no se repite el paso: primero se lee la evidencia y se
# comprueba que no quede psql vivo en `<proyecto>-db-1`.
set -uo pipefail
umask 077

die() { echo "aplicar-lote: $*" >&2; exit 2; }
refuse() { echo "aplicar-lote: RECHAZADO · $*" >&2; exit 3; }

# Una sola salida que limpia: la copia temporal de la autorización y, si es
# nuestro, el candado. Los traps de señal van desde el principio, antes de tomar
# el candado y de escribir su pid: una señal en cualquier punto sale por EXIT.
AUT_COPIA=""; CANDADO=""; CANDADO_MIO=0
soltar_candado() {
  [[ ${CANDADO_MIO} -eq 1 ]] || return 0
  local dueno
  dueno="$(cat -- "${CANDADO}/pid" 2> /dev/null)"
  # Nuestro: el pid es el nuestro, o todavía no se alcanzó a escribir (la señal
  # cayó entre el mkdir y el printf). Con otro pid, alguien lo rehízo: no se toca.
  [[ "${dueno}" == "$$" || -z "${dueno}" ]] || return 0
  rm -f -- "${CANDADO}/pid" && rmdir -- "${CANDADO}" 2> /dev/null
}
al_salir() {
  [[ -n "${AUT_COPIA}" ]] && rm -f -- "${AUT_COPIA}"
  soltar_candado
}
trap al_salir EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

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
  # vacío y citar el id COMPLETO del lote (un número suelto lo cumplen una
  # fecha o «no autorizo el 61»; el id además fija el packing exacto).
  AUTORIZACION="${AUTORIZACION:-${LOTE}/AUTORIZACION.txt}"
  # Un paquete de producción no trae deshacer.sql ni purgar.sql (el generador no
  # los emite): si están, alguien mezcló paquetes o copió uno de prueba.
  for f in deshacer.sql purgar.sql; do
    [[ -e "${LOTE}/${f}" || -L "${LOTE}/${f}" ]] \
      && refuse "el paquete de producción trae ${f}: el generador no lo emite para producción; regenera el lote en una carpeta nueva"
  done
  # Enlace simbólico: la guarda de carpeta de abajo resuelve el DIRECTORIO de la
  # ruta, no el último componente, así que un enlace fuera del lote que apunte al
  # manifiesto (que cita el id y lleva nombres) la pasaría; y el destino de un
  # enlace puede cambiar entre el chequeo y el uso. Sólo un archivo regular.
  [[ -L "${AUTORIZACION}" ]] && refuse "la autorización ${AUTORIZACION} es un enlace simbólico: tiene que ser un archivo regular"
  [[ -f "${AUTORIZACION}" && -s "${AUTORIZACION}" ]] || refuse "producción exige ${AUTORIZACION} con el OK literal de Sam para este lote"
  # Dentro de la carpeta del lote sólo vale AUTORIZACION.txt: cualquier otro
  # archivo (manifiesto.json, resumen.md) cita el id y lleva nombres, y se
  # copiaría a la evidencia.
  lote_real="$(cd "${LOTE}" && pwd -P)"
  aut_real="$(cd "$(dirname -- "${AUTORIZACION}")" && pwd -P)/$(basename -- "${AUTORIZACION}")"
  if [[ "${aut_real}" == "${lote_real}/"* && "${aut_real}" != "${lote_real}/AUTORIZACION.txt" ]]; then
    refuse "--autorizacion apunta a $(basename -- "${AUTORIZACION}") dentro del lote: sólo vale AUTORIZACION.txt"
  fi
  # Una sola lectura: se copia a un temporal (cp -P no sigue enlaces) y todo lo
  # que sigue (contenido, grep del id, evidencia) usa la copia.
  AUT_COPIA="$(mktemp)" || die "no puedo crear el temporal de la autorización"
  cp -P -- "${AUTORIZACION}" "${AUT_COPIA}" || refuse "no pude copiar la autorización ${AUTORIZACION}"
  [[ -f "${AUT_COPIA}" && ! -L "${AUT_COPIA}" && -s "${AUT_COPIA}" ]] || refuse "la autorización cambió entre el chequeo y la copia"
  # Un manifiesto (o un trozo) cita el id y lleva nombres: no es el OK de Sam.
  if grep -qE '"nombreExcel"|"lote"[[:space:]]*:' -- "${AUT_COPIA}"; then
    refuse "la autorización parece un manifiesto (trae \"nombreExcel\" o \"lote\":): tiene que ser el OK literal de Sam"
  fi
  grep -qF -- "${LOTE_ID}" "${AUT_COPIA}" \
    || refuse "la autorización no cita el lote ${LOTE_ID}: el OK de Sam tiene que nombrar el id completo de cada lote"
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
if [[ ${DRY_RUN} -eq 0 && " simulacro aplicar deshacer purgar " == *" ${PASO} "* ]]; then
  # Antes de mirar la evidencia: el candado cierra la carrera entre «no hay
  # aplicar previo» y el aplicar mismo.
  CANDADO="${LOTES_CANDADO:-/run/lock/dtd-lotes.lock.d}"
  [[ -d "$(dirname -- "${CANDADO}")" ]] || die "no existe $(dirname -- "${CANDADO}") para el candado (LOTES_CANDADO)"
  mkdir -- "${CANDADO}" 2> /dev/null \
    || refuse "otro paso de un lote está en curso (candado ${CANDADO}, dueño pid $(cat -- "${CANDADO}/pid" 2> /dev/null || echo '?')); si no hay ninguno, revisa y borra el candado a mano"
  # Los traps ya están puestos (arriba): desde aquí el candado es nuestro y EXIT
  # lo suelta aunque una señal caiga antes de escribir el pid. El dueño queda
  # escrito adentro y sólo se suelta si sigue siendo nuestro (nunca uno ajeno,
  # aunque alguien lo haya rehecho a mano).
  CANDADO_MIO=1
  printf '%s\n' "$$" > "${CANDADO}/pid"
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
if [[ ${ES_PROD} -eq 1 ]]; then cp -- "${AUT_COPIA}" "${EVID}/AUTORIZACION.txt"; fi
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
