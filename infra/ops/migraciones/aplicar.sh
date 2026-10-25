#!/usr/bin/env bash
# infra/ops/migraciones/aplicar.sh — aplica UNA migración en la base del servidor propio (SDD-0546).
#
# Corre EN EL VPS (en /srv/ops/migraciones/, copia de esta carpeta), sobre el
# paquete que armó infra/ops/migraciones/preparar.mjs en un checkout y que llegó
# por scp (lo hace aplicar-remoto.sh). Corre psql dentro de `<proyecto>-db-1`,
# como `postgres`, con ON_ERROR_STOP, VERBOSITY terse y SHOW_CONTEXT never:
#
#   --paso previa    solo la lectura previa (begin transaction read only … rollback)
#   --paso aplicar   lectura previa → apply (la migración y su fila del ledger en
#                    una sola transacción) → verificación (solo lectura)
#
# La lectura previa es obligatoria: `aplicar` siempre la corre justo antes del
# apply y no aplica si falla. Antes de tocar la base comprueba el paquete:
# SHA256SUMS, IDENTIDAD.txt del proyecto y la migración pedidos, el md5 de
# aplicar.sql, que aplicar.sql sea el envoltorio exacto de migracion.sql
# (infra/ops/lib/migracion.sh), que previa.sql y verificar.sql sean de solo
# lectura y que created_by corresponda al destino.
#
# Producción (PROD_COMPOSE_PROJECT, por defecto dtd-cargo) exige además, para
# `aplicar`, --autorizacion <archivo> con el texto literal del OK de Sam, que
# tiene que NOMBRAR la migración (su número). Un `*-staging` no lo exige.
#
# Uso:
#   aplicar.sh --proyecto dtd-cargo --confirm dtd-cargo --migracion <NNNN_nombre> \
#       --paquete <dir> --md5 <md5 de aplicar.sql> [--paso previa|aplicar] \
#       [--autorizacion <archivo>] [--evidencias /srv/ops/evidencias] [--en-seco]
#
# Evidencia: <evidencias>/apply-NNNN-<proyecto>-<ts>/ (o previa-NNNN-…) con los
# scripts, las salidas de psql, registro.txt y SHA256SUMS. Sin secretos ni filas
# de negocio: las consultas leen solo el ledger y el catálogo.
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda (incluye otra
# aplicación en curso) · 4 integridad (SHA256SUMS o md5) · 5 la lectura previa
# falló (no se aplicó nada) · 6 el apply falló (psql deshizo la transacción) ·
# 7 aplicada pero la verificación no coincide (leer la evidencia antes de seguir).
set -uo pipefail
umask 077

S="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
# shellcheck source=../lib/migracion.sh
source "${S}/lib/migracion.sh"

PROYECTO=""; CONFIRM=""; MIGRACION=""; PAQUETE=""; MD5=""; PASO="aplicar"
AUTORIZACION=""; EVIDENCIAS="/srv/ops/evidencias"; EN_SECO=0
PROD="${PROD_COMPOSE_PROJECT:-dtd-cargo}"
CANDADO="${MIGRACIONES_CANDADO:-/run/lock/dtd-migraciones.lock.d}"

uso() { sed -n '2,38p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "aplicar: $*" >&2; exit 2; }
refuse() { echo "aplicar: RECHAZADO · $*" >&2; exit 3; }
integridad() { echo "aplicar: INTEGRIDAD · $*" >&2; exit 4; }
valor() { [[ -n "${2-}" && "${2}" != --* ]] || die "falta el valor de $1"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --proyecto) valor "$1" "${2-}"; PROYECTO="$2"; shift 2 ;;
    --confirm) valor "$1" "${2-}"; CONFIRM="$2"; shift 2 ;;
    --migracion) valor "$1" "${2-}"; MIGRACION="${2%.sql}"; shift 2 ;;
    --paquete) valor "$1" "${2-}"; PAQUETE="${2%/}"; shift 2 ;;
    --md5) valor "$1" "${2-}"; MD5="$2"; shift 2 ;;
    --paso) valor "$1" "${2-}"; PASO="$2"; shift 2 ;;
    --autorizacion) valor "$1" "${2-}"; AUTORIZACION="$2"; shift 2 ;;
    --evidencias) valor "$1" "${2-}"; EVIDENCIAS="${2%/}"; shift 2 ;;
    --en-seco) EN_SECO=1; shift ;;
    -h|--help) uso; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── Guardas de uso y destino (ninguna toca docker) ─────────────────────────────
[[ "${PROYECTO}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--proyecto inválido: '${PROYECTO}'"
[[ "${PROYECTO}" == "${PROD}" || "${PROYECTO}" == *-staging ]] || refuse "${PROYECTO} no es producción (${PROD}) ni termina en -staging"
[[ "${CONFIRM}" == "${PROYECTO}" ]] || refuse "--confirm tiene que repetir el proyecto (${PROYECTO})"
[[ "${MIGRACION}" =~ ^[0-9]{4}[a-z]?_[a-z0-9_]+$ ]] || die "--migracion tiene que ser el nombre exacto, sin .sql (NNNN_nombre): '${MIGRACION}'"
[[ "${MD5}" =~ ^[0-9a-f]{32}$ ]] || die "--md5 tiene que ser el md5 de aplicar.sql que imprimió preparar.mjs"
[[ "${PASO}" == previa || "${PASO}" == aplicar ]] || die "--paso tiene que ser previa o aplicar"
[[ -d "${PAQUETE}" ]] || refuse "no existe el paquete ${PAQUETE}"
NUM="$(mig_prefijo "${MIGRACION}")"
if [[ "${PASO}" == aplicar && "${PROYECTO}" == "${PROD}" ]]; then
  [[ -n "${AUTORIZACION}" ]] || refuse "aplicar en producción exige --autorizacion <archivo> con el OK literal de Sam"
fi
if [[ -n "${AUTORIZACION}" ]]; then
  [[ -s "${AUTORIZACION}" ]] || refuse "la autorización ${AUTORIZACION} no existe o está vacía"
  # El OK es nominal: tiene que nombrar ESTA migración (su número; 0240b no nombra la 0240).
  grep -qE "(^|[^0-9A-Za-z])${NUM}([^0-9A-Za-z]|$)" -- "${AUTORIZACION}" \
    || refuse "la autorización no nombra la ${NUM}: el OK de Sam tiene que nombrar cada migración"
fi

# ── Integridad del paquete ─────────────────────────────────────────────────────
for f in migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt SHA256SUMS; do
  [[ -f "${PAQUETE}/${f}" ]] || refuse "el paquete no trae ${f}"
done
( cd "${PAQUETE}" && sha256sum --check --quiet --strict SHA256SUMS ) > /dev/null 2>&1 || integridad "SHA256SUMS no coincide en ${PAQUETE}"
for f in migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt; do
  # «  » (modo texto, Linux) o « *» (modo binario, el sha256sum de Git para Windows).
  grep -qE "^[0-9a-f]{64} [ *]${f}\$" "${PAQUETE}/SHA256SUMS" || integridad "SHA256SUMS no cubre ${f}"
done
ident() { grep -E "^$1=" "${PAQUETE}/IDENTIDAD.txt" | tail -n1 | cut -d= -f2-; }
[[ "$(ident nombre)" == "${MIGRACION}" ]] || refuse "el paquete es de $(ident nombre), no de ${MIGRACION}"
[[ "$(ident proyecto)" == "${PROYECTO}" ]] || refuse "el paquete se preparó para $(ident proyecto), no para ${PROYECTO}"
SDD="$(ident sdd)"
[[ "${SDD}" =~ ^[0-9]{4}$ ]] || refuse "IDENTIDAD.txt sin sdd válida"
if [[ "${PROYECTO}" == "${PROD}" ]]; then esperado="servidor-propio:psql:SDD-${SDD}"; else esperado="servidor-propio:psql:prueba:SDD-${SDD}"; fi
[[ "$(ident created_by)" == "${esperado}" ]] || refuse "created_by '$(ident created_by)' no corresponde a ${PROYECTO} (se esperaba ${esperado})"
real="$(mig_md5 "${PAQUETE}/aplicar.sql")"
[[ "${real}" == "${MD5}" ]] || integridad "el md5 de aplicar.sql es ${real}, no ${MD5}"
[[ "$(ident aplicar_md5)" == "${MD5}" ]] || integridad "IDENTIDAD.txt dice aplicar_md5=$(ident aplicar_md5), no ${MD5}"
for s in previa aplicar verificar; do
  [[ "$(mig_primera_util "${PAQUETE}/${s}.sql")" == '\set ON_ERROR_STOP on' ]] || refuse "${s}.sql: la primera línea útil no es \\set ON_ERROR_STOP on"
done
# previa y verificar: su primera sentencia abre una transacción de solo lectura y la última la deshace.
for s in previa verificar; do
  primera="$(awk 'NF && $0 !~ /^[[:space:]]*(--|\\)/ { print; exit }' "${PAQUETE}/${s}.sql")"
  ultima="$(awk 'NF { l = $0 } END { print l }' "${PAQUETE}/${s}.sql")"
  [[ "${primera}" == "begin transaction read only;" && "${ultima}" == "rollback;" ]] || refuse "${s}.sql no es de solo lectura (begin transaction read only … rollback)"
done
grep -qF "'PREVIA ${MIGRACION} OK'" "${PAQUETE}/previa.sql" || refuse "previa.sql no es la lectura previa de ${MIGRACION}"
grep -qF "'VERIFICACIÓN ${MIGRACION} OK'" "${PAQUETE}/verificar.sql" || refuse "verificar.sql no es la verificación de ${MIGRACION}"
motivo="$(mig_revisar "${PAQUETE}/migracion.sql" "${MIGRACION}" 0)" || refuse "${motivo}"
[[ "$(mig_md5 "${PAQUETE}/migracion.sql")" == "$(ident blob_md5)" ]] || refuse "migracion.sql no es el blob de IDENTIDAD.txt"
tmp_env="$(mktemp)"
trap 'rm -f -- "${tmp_env}"' EXIT
mig_envolver "${PAQUETE}/migracion.sql" "${MIGRACION}" "$(ident created_by)" "${MIG_VERSION_RELOJ}" "${tmp_env}" || refuse "no pude rehacer el envoltorio"
[[ "$(mig_md5 "${tmp_env}")" == "${real}" ]] || refuse "aplicar.sql no es el envoltorio de migracion.sql"

DB="${PROYECTO}-db-1"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ "${PASO}" == aplicar ]]; then EVID="${EVIDENCIAS}/apply-${NUM}-${PROYECTO}-${TS}"; else EVID="${EVIDENCIAS}/previa-${NUM}-${PROYECTO}-${TS}"; fi
PSQL=(psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never)

if (( EN_SECO )); then
  echo "aplicar: EN SECO · ${MIGRACION} en ${PROYECTO} (${PASO}) · comprobaciones del paquete PASÓ · no se toca la base"
  echo "+ docker exec -i ${DB} ${PSQL[*]} < ${PAQUETE}/previa.sql"
  if [[ "${PASO}" == aplicar ]]; then
    echo "+ docker exec -i ${DB} ${PSQL[*]} < ${PAQUETE}/aplicar.sql   (una transacción: migración + fila del ledger)"
    echo "+ docker exec -i ${DB} ${PSQL[*]} < ${PAQUETE}/verificar.sql"
  fi
  echo "+ evidencia en ${EVID}"
  exit 0
fi

# ── Una aplicación a la vez ────────────────────────────────────────────────────
[[ -d "$(dirname -- "${CANDADO}")" ]] || die "no existe $(dirname -- "${CANDADO}") para el candado (MIGRACIONES_CANDADO)"
mkdir -- "${CANDADO}" 2> /dev/null || refuse "otra aplicación en curso (candado ${CANDADO}); si no hay ninguna, revisa y borra el candado a mano"
trap 'rm -f -- "${tmp_env}"; rmdir -- "${CANDADO}" 2> /dev/null' EXIT
# Si ssh se cae (HUP) o alguien corta, sale por EXIT y libera el candado. La
# transacción en curso la resuelve Postgres: COMMIT completo o nada.
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

[[ "$(docker inspect -f '{{.State.Running}}' "${DB}" 2> /dev/null)" == "true" ]] || die "el contenedor ${DB} no está corriendo"
mkdir -p -- "${EVID}" || die "no puedo crear ${EVID}"
if [[ "${PASO}" == aplicar ]]; then
  cp -- "${PAQUETE}"/{migracion.sql,previa.sql,aplicar.sql,verificar.sql,IDENTIDAD.txt} "${EVID}/"
else
  cp -- "${PAQUETE}"/{previa.sql,IDENTIDAD.txt} "${EVID}/"
fi
[[ -n "${AUTORIZACION}" ]] && cp -- "${AUTORIZACION}" "${EVID}/AUTORIZACION.txt"
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$*" | tee -a "${EVID}/registro.txt"; }
cerrar() { ( cd "${EVID}" && find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | LC_ALL=C sort | xargs sha256sum -- > SHA256SUMS ); }
correr() { docker exec -i "${DB}" "${PSQL[@]}" < "${PAQUETE}/$1.sql" > "${EVID}/$1.out" 2> "${EVID}/$1.err"; }
log "aplicar ${MIGRACION} · paso ${PASO} · proyecto ${PROYECTO} · sha $(ident sha) · blob $(ident blob_md5) · aplicar.sql ${MD5}"

correr previa; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/previa.out" ROLLBACK || ! grep -qF "PREVIA ${MIGRACION} OK" "${EVID}/previa.out"; then
  log "FALLÓ la lectura previa (psql ${rc}): no se aplicó nada. $(grep -m1 -E 'ERROR|FATAL' "${EVID}/previa.err" 2> /dev/null | cut -c1-400)"
  cerrar; exit 5
fi
log "PASÓ lectura previa (deriva de: $(ident funciones_reemplazadas); aceptada: $(ident deriva_aceptada); preflight propio: $(ident preflight_propio))"
if [[ "${PASO}" == previa ]]; then
  log "evidencia en ${EVID}"
  cerrar; exit 0
fi

log "apply: inicio"
correr aplicar; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/aplicar.out" COMMIT || ! grep -qx 'INSERT 0 1' "${EVID}/aplicar.out"; then
  log "FALLÓ el apply (psql ${rc}): con ON_ERROR_STOP la transacción se deshace entera. $(grep -m1 -E 'ERROR|FATAL' "${EVID}/aplicar.err" 2> /dev/null | cut -c1-400)"
  cerrar; exit 6
fi
log "PASÓ apply: COMMIT con la fila del ledger"

correr verificar; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/verificar.out" ROLLBACK || ! grep -qF "VERIFICACIÓN ${MIGRACION} OK" "${EVID}/verificar.out"; then
  log "FALLÓ la verificación (psql ${rc}): la migración SE APLICÓ pero algo no coincide. No repitas el apply; lee verificar.err y el runbook (volver atrás). $(grep -m1 -E 'ERROR|FATAL' "${EVID}/verificar.err" 2> /dev/null | cut -c1-400)"
  cerrar; exit 7
fi
log "PASÓ verificación: una fila de ${MIGRACION} con md5 $(ident blob_md5) y $(ident blob_bytes) bytes; cuerpos vivos iguales al archivo"
log "siguiente: fusionar la PR con --match-head-commit y retirar la espera (infra/ops/migraciones/retirar-espera.mjs)"
log "evidencia en ${EVID}"
cerrar
