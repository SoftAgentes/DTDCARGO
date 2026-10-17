#!/usr/bin/env bash
# infra/ops/migrate/aplicar-migracion.sh — aplica UNA migración con su fila del ledger (SDD-0540, Fase 1).
#
# Versiona el método con el que el Director aplica hoy en el servidor propio
# (handoff 0506 § APLICACIÓN; 0474 y 0475 con `\set ON_ERROR_STOP on` y la versión
# calculada en el SQL). Dos pasos, en dos lugares:
#
#   1. --generar <dir>, en un checkout del repo (el servidor no tiene el repo).
#      Saca el blob EXACTO de `supabase/migrations/<archivo>` en <sha> con
#      `git cat-file`, lo revisa (sin CR, sin líneas que empiecen con barra
#      invertida, sin el delimitador `$migNNNN$`, sin begin/commit/rollback
#      propios) y escribe:
#        migracion.sql   el blob tal cual
#        previa.sql      lectura previa: begin transaction read only … rollback
#        aplicar.sql     \set ON_ERROR_STOP on · begin · texto · insert del ledger · commit
#        verificar.sql   verificación: begin transaction read only … rollback
#        IDENTIDAD.txt   sha, archivo, md5 y bytes del blob, md5 de cada script
#        SHA256SUMS
#      Imprime el md5 de aplicar.sql: es el que se pasa en el paso 2.
#   2. --ejecutar <dir> --md5 <md5 de aplicar.sql>, en el VPS, después del scp.
#      Comprueba SHA256SUMS, que la identidad sea la del sha y archivo pedidos, que
#      el md5 de aplicar.sql sea el impreso en el paso 1, que la primera línea útil
#      de cada script sea `\set ON_ERROR_STOP on` y que aplicar.sql sea el
#      envoltorio de migracion.sql. Después corre, en `<proyecto>-db-1` y como
#      `postgres`: la lectura previa, el apply y la verificación. Deja la evidencia
#      en <evidencias>/apply-<NNNN>-<proyecto>-<ts>/ con su SHA256SUMS.
#
# SOLO PRUEBA. El proyecto tiene que terminar en `-staging` y no puede ser el de
# producción (PROD_COMPOSE_PROJECT, por defecto dtd-cargo). Producción usa
# infra/ops/migraciones/ con el mismo envoltorio (SDD-0546 y el runbook
# aplicar-migraciones-prod.md). created_by = servidor-propio:psql:prueba:SDD-<NNNN>.
#
# Uso:
#   aplicar-migracion.sh --project dtd-cargo-staging --sha <40 hex> --file 0491_algo.sql \
#       --sdd 0540 --generar <dir> [--repo <checkout>]
#   aplicar-migracion.sh --project dtd-cargo-staging --sha <40 hex> --file 0491_algo.sql \
#       --ejecutar <dir> --md5 <md5> [--evidence-dir /srv/ops/evidencias] [--dry-run]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda o por el archivo ·
# 4 integridad (md5 o SHA256SUMS) · 5 la lectura previa falló (no se aplicó nada) ·
# 6 el apply falló (psql deshizo la transacción) · 7 aplicada pero la verificación
# no coincide (leer la evidencia antes de seguir).
set -uo pipefail
umask 077

S="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
# shellcheck source=../lib/migracion.sh
source "${S}/lib/migracion.sh"

PROJECT=""
SHA=""
FILE=""
SDD=""
GEN_DIR=""
RUN_DIR=""
MD5=""
REPO="."
EVIDENCE_DIR="/srv/ops/evidencias"
DRY_RUN=0
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

usage() { sed -n '2,44p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "aplicar-migracion: $*" >&2; exit 2; }
refuse() { echo "aplicar-migracion: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --sha) setopt SHA "${2-}"; shift 2 ;;
    --file) setopt FILE "${2-}"; shift 2 ;;
    --sdd) setopt SDD "${2-}"; shift 2 ;;
    --generar) setopt GEN_DIR "${2-}"; shift 2 ;;
    --ejecutar) setopt RUN_DIR "${2-}"; shift 2 ;;
    --md5) setopt MD5 "${2-}"; shift 2 ;;
    --repo) setopt REPO "${2-}"; shift 2 ;;
    --evidence-dir) setopt EVIDENCE_DIR "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${PROJECT}" != "${PROD_PROJECT}" ]] || refuse "${PROJECT} es producción: este script es solo para prueba (producción usa infra/ops/migraciones/aplicar.sh, SDD-0546)"
[[ "${PROJECT}" == *-staging ]] || refuse "${PROJECT} no termina en -staging"
[[ "${SHA}" =~ ^[0-9a-f]{40}$ ]] || die "--sha tiene que ser el SHA completo (40 hex): '${SHA}'"
[[ "${FILE}" =~ ^[0-9]{4}[a-z]?_[a-z0-9_]+\.sql$ ]] || die "--file tiene que ser el nombre del archivo de supabase/migrations: '${FILE}'"
if [[ -n "${GEN_DIR}" && -n "${RUN_DIR}" ]] || [[ -z "${GEN_DIR}" && -z "${RUN_DIR}" ]]; then
  die "usa --generar <dir> (en el checkout) o --ejecutar <dir> (en el VPS), uno de los dos"
fi

NOMBRE="$(mig_nombre "${FILE}")"
NUM="$(mig_prefijo "${FILE}")"
DB="${PROJECT}-db-1"

escribir_previa() { # $1 salida
  cat > "$1" <<SQL
\\set ON_ERROR_STOP on
begin transaction read only;
select 'ledger_filas' as dato, count(*)::text as valor from supabase_migrations.schema_migrations
union all select 'ultima_version', coalesce(max(version), '') from supabase_migrations.schema_migrations
union all select 'ya_aplicada', count(*)::text from supabase_migrations.schema_migrations where name = '${NOMBRE}';
do \$previa\$
begin
  if exists (select 1 from supabase_migrations.schema_migrations where name = '${NOMBRE}') then
    raise exception 'previa: ${NOMBRE} ya está en el ledger';
  end if;
end
\$previa\$;
rollback;
SQL
}

escribir_verificar() { # $1 salida, $2 md5 del blob, $3 bytes del blob
  cat > "$1" <<SQL
\\set ON_ERROR_STOP on
begin transaction read only;
select version, name, created_by, array_length(statements, 1) as sentencias,
       md5(array_to_string(statements, '')) as md5, octet_length(array_to_string(statements, '')) as bytes
  from supabase_migrations.schema_migrations where name = '${NOMBRE}';
do \$verificar\$
declare
  n int;
  m text;
  b int;
begin
  select count(*), max(md5(array_to_string(statements, ''))), max(octet_length(array_to_string(statements, '')))
    into n, m, b
    from supabase_migrations.schema_migrations where name = '${NOMBRE}';
  if n <> 1 then
    raise exception 'verificar: % filas de ${NOMBRE} en el ledger (se esperaba 1)', n;
  end if;
  if m <> '$2' or b <> $3 then
    raise exception 'verificar: el ledger no coincide con el blob (md5 %, % bytes)', m, b;
  end if;
end
\$verificar\$;
select count(*) as ledger_filas from supabase_migrations.schema_migrations;
rollback;
SQL
}

# ── 1. Generar, en el checkout ─────────────────────────────────────────────────
if [[ -n "${GEN_DIR}" ]]; then
  [[ "${SDD}" =~ ^[0-9]{4}$ ]] || die "--sdd tiene que ser el número de la SDD de la migración (4 dígitos): '${SDD}'"
  command -v git >/dev/null || die "falta git: --generar corre en un checkout del repo"
  git -C "${REPO}" cat-file -e "${SHA}^{commit}" 2>/dev/null || die "${SHA} no es un commit de ${REPO} (¿falta git fetch?)"
  ruta="supabase/migrations/${FILE}"
  git -C "${REPO}" cat-file -e "${SHA}:${ruta}" 2>/dev/null || refuse "${ruta} no existe en ${SHA}"
  [[ ! -e "${GEN_DIR}" ]] || die "${GEN_DIR} ya existe: usa una carpeta nueva"
  mkdir -p -- "${GEN_DIR}" || die "no puedo crear ${GEN_DIR}"
  # cat-file da el blob crudo, sin conversión de fin de línea del checkout.
  git -C "${REPO}" cat-file blob "${SHA}:${ruta}" > "${GEN_DIR}/migracion.sql"
  if ! motivo="$(mig_revisar "${GEN_DIR}/migracion.sql" "${NOMBRE}" 0)"; then
    rm -rf -- "${GEN_DIR}"
    refuse "${motivo}"
  fi
  CREATED_BY="servidor-propio:psql:prueba:SDD-${SDD}"
  mig_envolver "${GEN_DIR}/migracion.sql" "${NOMBRE}" "${CREATED_BY}" "${MIG_VERSION_RELOJ}" "${GEN_DIR}/aplicar.sql" || die "no pude envolver ${FILE}"
  blob_md5="$(mig_md5 "${GEN_DIR}/migracion.sql")"
  blob_bytes="$(mig_bytes "${GEN_DIR}/migracion.sql")"
  escribir_previa "${GEN_DIR}/previa.sql"
  escribir_verificar "${GEN_DIR}/verificar.sql" "${blob_md5}" "${blob_bytes}"
  {
    printf 'sha=%s\narchivo=%s\nnombre=%s\nsdd=%s\nproyecto=%s\ncreated_by=%s\n' \
      "${SHA}" "${FILE}" "${NOMBRE}" "${SDD}" "${PROJECT}" "${CREATED_BY}"
    printf 'blob_md5=%s\nblob_bytes=%s\n' "${blob_md5}" "${blob_bytes}"
    for s in previa aplicar verificar; do printf '%s_md5=%s\n' "${s}" "$(mig_md5 "${GEN_DIR}/${s}.sql")"; done
    printf 'generado=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "${GEN_DIR}/IDENTIDAD.txt"
  ( cd "${GEN_DIR}" && sha256sum migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt > SHA256SUMS )
  echo "aplicar-migracion: generado ${GEN_DIR} · ${FILE} en ${SHA:0:12} · blob ${blob_md5} (${blob_bytes} bytes)"
  echo "aplicar-migracion: md5 de aplicar.sql: $(mig_md5 "${GEN_DIR}/aplicar.sql")"
  echo "aplicar-migracion: siguiente paso, en el VPS: --ejecutar <dir> --md5 <ese md5>"
  exit 0
fi

# ── 2. Ejecutar, en el VPS ─────────────────────────────────────────────────────
[[ "${MD5}" =~ ^[0-9a-f]{32}$ ]] || die "--md5 tiene que ser el md5 de aplicar.sql que imprimió --generar"
[[ -d "${RUN_DIR}" ]] || die "--ejecutar: no existe ${RUN_DIR}"
for f in migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt SHA256SUMS; do
  [[ -f "${RUN_DIR}/${f}" ]] || die "falta ${RUN_DIR}/${f}"
done
( cd "${RUN_DIR}" && sha256sum -c --quiet SHA256SUMS ) >/dev/null 2>&1 || { echo "aplicar-migracion: INTEGRIDAD · SHA256SUMS no coincide en ${RUN_DIR}" >&2; exit 4; }
ident() { grep -E "^$1=" "${RUN_DIR}/IDENTIDAD.txt" | tail -n1 | cut -d= -f2-; }
[[ "$(ident sha)" == "${SHA}" && "$(ident archivo)" == "${FILE}" && "$(ident proyecto)" == "${PROJECT}" ]] \
  || refuse "IDENTIDAD.txt es de otro sha, archivo o proyecto"
real_md5="$(mig_md5 "${RUN_DIR}/aplicar.sql")"
[[ "${real_md5}" == "${MD5}" ]] || { echo "aplicar-migracion: INTEGRIDAD · el md5 de aplicar.sql en destino es ${real_md5}, no ${MD5}" >&2; exit 4; }
for s in previa aplicar verificar; do
  [[ "$(mig_primera_util "${RUN_DIR}/${s}.sql")" == '\set ON_ERROR_STOP on' ]] \
    || refuse "${s}.sql: la primera línea útil no es \\set ON_ERROR_STOP on"
done
motivo="$(mig_revisar "${RUN_DIR}/migracion.sql" "${NOMBRE}" 0)" || refuse "${motivo}"
[[ "$(mig_md5 "${RUN_DIR}/migracion.sql")" == "$(ident blob_md5)" ]] || refuse "migracion.sql no es el blob de IDENTIDAD.txt"
# aplicar.sql tiene que ser exactamente el envoltorio de migracion.sql.
tmp_env="$(mktemp)"; trap 'rm -f -- "${tmp_env}"' EXIT
mig_envolver "${RUN_DIR}/migracion.sql" "${NOMBRE}" "$(ident created_by)" "${MIG_VERSION_RELOJ}" "${tmp_env}"
[[ "$(mig_md5 "${tmp_env}")" == "${real_md5}" ]] || refuse "aplicar.sql no es el envoltorio de migracion.sql"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
EVID="${EVIDENCE_DIR%/}/apply-${NUM}-${PROJECT}-${TS}"
if (( DRY_RUN )); then
  echo "aplicar-migracion: dry-run · ${FILE} en ${PROJECT} · comprobaciones locales PASÓ · no se toca la base"
  printf '+ docker exec -i %q psql -U postgres -d postgres -X < %q\n' "${DB}" "${RUN_DIR}/previa.sql" "${DB}" "${RUN_DIR}/aplicar.sql" "${DB}" "${RUN_DIR}/verificar.sql"
  echo "+ evidencia en ${EVID}"
  exit 0
fi

[[ "$(docker inspect -f '{{.State.Running}}' "${DB}" 2>/dev/null)" == "true" ]] || die "el contenedor ${DB} no está corriendo"
mkdir -p -- "${EVID}" || die "no puedo crear ${EVID}"
cp -- "${RUN_DIR}"/{migracion.sql,previa.sql,aplicar.sql,verificar.sql,IDENTIDAD.txt} "${EVID}/"
log() { printf '%s %s\n' "$(date -u +%H:%M:%S.%3NZ)" "$*" | tee -a "${EVID}/registro.txt"; }
cerrar() { ( cd "${EVID}" && sha256sum -- * 2>/dev/null | grep -v ' SHA256SUMS$' > SHA256SUMS ); }
correr() { # $1 nombre del script
  docker exec -i "${DB}" psql -U postgres -d postgres -X < "${RUN_DIR}/$1.sql" > "${EVID}/$1.out" 2> "${EVID}/$1.err"
}
log "aplicar-migracion ${FILE} · sha ${SHA} · proyecto ${PROJECT} · md5 aplicar.sql ${MD5}"

correr previa; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/previa.out" ROLLBACK; then
  log "FALLÓ la lectura previa (psql ${rc}): no se aplicó nada. Lee previa.err"
  cerrar; exit 5
fi
log "PASÓ lectura previa: $(grep -E '^(ledger_filas|ultima_version|ya_aplicada)' "${EVID}/previa.out" | tr '\n' ' ')"

log "apply: inicio"
correr aplicar; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/aplicar.out" COMMIT || ! grep -qx 'INSERT 0 1' "${EVID}/aplicar.out"; then
  log "FALLÓ el apply (psql ${rc}): con ON_ERROR_STOP la transacción se deshace entera. Lee aplicar.err"
  cerrar; exit 6
fi
log "PASÓ apply: COMMIT con la fila del ledger"

correr verificar; rc=$?
if (( rc != 0 )) || ! mig_salida_ok "${EVID}/verificar.out" ROLLBACK; then
  log "FALLÓ la verificación (psql ${rc}): la migración se aplicó pero el ledger no coincide con el blob. Lee verificar.err"
  cerrar; exit 7
fi
log "PASÓ verificación: una fila de ${NOMBRE}, md5 $(ident blob_md5) y $(ident blob_bytes) bytes iguales al blob"
log "evidencia en ${EVID}"
cerrar
