#!/usr/bin/env bash
# infra/ops/staging/resetear-base-prueba.sh — base de prueba reconstruida desde main (SDD-0540 §2.6, Fase 1).
#
# Deja la base de prueba igual a la de un SHA de main, desde cero y con datos
# sintéticos. Dos pasos, en dos lugares:
#
#   1. --preparar <dir> --to-sha <sha>, en un checkout del repo (el servidor no
#      tiene el repo). Arma un paquete con los blobs EXACTOS de ese SHA:
#        migraciones/*.sql      supabase/migrations, con `git cat-file`
#        SOLO-LEDGER.txt        las LEDGER_ONLY de scripts/check-schema-rebuild.mjs
#        PENDIENTES.txt         las esperas de supabase/migrations-baseline.json
#                               (pendingBelowCutoff: no están en producción)
#        plataforma-prueba.sql y semilla-prueba.sql (infra/ops/staging)
#        MANIFIESTO.txt y SHA256SUMS
#   2. En el VPS, con el paquete copiado:
#        a. comprueba SHA256SUMS y que el paquete sea del --to-sha;
#        b. revisa que cada migración se pueda envolver (mig_revisar), antes de borrar nada;
#        c. destroy-staging.sh borra SOLO los datos (conserva compose y .env);
#        d. levanta db y espera la base estable; levanta auth, rest, storage e
#           imgproxy (GoTrue y storage-api crean sus esquemas, como en producción);
#        e. plataforma-prueba.sql: extensiones, default privileges iguales a
#           producción y el ledger con sus columnas;
#        f. aplica TODAS las migraciones en orden (LC_ALL=C), cada una con el
#           envoltorio de lib/migracion.sh (una transacción con su fila del ledger),
#           con versiones seguidas que terminan en la hora del reset. Las de
#           PENDIENTES se saltan (producción no las tiene); las de SOLO-LEDGER
#           registran su fila sin ejecutarse (sobre una base nueva no tienen nada
#           que reparar; el rebuild tampoco las aplica);
#        g. vuelve a encender la RLS de cron.job y cron.job_run_details;
#        h. siembra los datos sintéticos (sembrar-prueba.sh), salvo --sin-semilla;
#        i. comprueba que el ledger tenga una fila por archivo aplicado o registrado.
#      Evidencia en <evidencias>/reset-<proyecto>-<ts>/.
#
# --solo-base --db-container <proyecto>-db-N salta c y d: aplica e a i sobre una
# base ya levantada (la prueba efímera de infra/ops/tests). La plataforma se niega
# si el ledger ya tiene filas, así que tampoco sirve contra una base con historia.
#
# Uso:
#   resetear-base-prueba.sh --preparar <dir> --to-sha <sha> [--repo <checkout>]
#   resetear-base-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --to-sha <sha> \
#       --bundle <dir> [--project-dir /srv/dtd-cargo-staging] [--evidence-dir /srv/ops/evidencias] \
#       [--sin-semilla] [--solo-base --db-container <c>] [--dry-run]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda · 4 integridad del
# paquete · 5 la base no arrancó · 6 una migración falló (la base queda a medias:
# se vuelve a resetear) · 7 el ledger no cuadra · 8 la semilla falló.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
OPS="$(cd "${HERE}/.." && pwd)"
# shellcheck source=../lib/migracion.sh
source "${OPS}/lib/migracion.sh"

PROJECT=""
CONFIRM=""
SHA=""
BUNDLE=""
PREPARAR=""
REPO="."
PROJECT_DIR=""
EVIDENCE_DIR="/srv/ops/evidencias"
SIN_SEMILLA=0
SOLO_BASE=0
DB=""
DRY_RUN=0

die() { echo "resetear-base-prueba: $*" >&2; exit 2; }
refuse() { echo "resetear-base-prueba: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
# shellcheck source=lib-prueba.sh
source "${HERE}/lib-prueba.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --confirm) setopt CONFIRM "${2-}"; shift 2 ;;
    --to-sha) setopt SHA "${2-}"; shift 2 ;;
    --bundle) setopt BUNDLE "${2-}"; shift 2 ;;
    --preparar) setopt PREPARAR "${2-}"; shift 2 ;;
    --repo) setopt REPO "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --evidence-dir) setopt EVIDENCE_DIR "${2-}"; shift 2 ;;
    --sin-semilla) SIN_SEMILLA=1; shift ;;
    --solo-base) SOLO_BASE=1; shift ;;
    --db-container) setopt DB "${2-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,48p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done
prueba_guarda_sha "${SHA}"

# ── 1. Preparar el paquete, en el checkout ────────────────────────────────────
if [[ -n "${PREPARAR}" ]]; then
  command -v git >/dev/null || die "falta git: --preparar corre en un checkout del repo"
  command -v node >/dev/null || die "falta node: --preparar lee migrations-baseline.json con node"
  git -C "${REPO}" cat-file -e "${SHA}^{commit}" 2>/dev/null || die "${SHA} no es un commit de ${REPO} (¿falta git fetch?)"
  [[ ! -e "${PREPARAR}" ]] || die "${PREPARAR} ya existe: usa una carpeta nueva"
  for r in infra/ops/staging/plataforma-prueba.sql infra/ops/staging/semilla-prueba.sql scripts/check-schema-rebuild.mjs supabase/migrations-baseline.json; do
    git -C "${REPO}" cat-file -e "${SHA}:${r}" 2>/dev/null || refuse "${r} no existe en ${SHA:0:12}: el SHA tiene que incluir la Fase 1 de la SDD-0540"
  done
  mkdir -p -- "${PREPARAR}/migraciones" || die "no puedo crear ${PREPARAR}"
  n=0
  while IFS= read -r ruta; do
    [[ "${ruta}" == *.sql ]] || continue
    git -C "${REPO}" cat-file blob "${SHA}:${ruta}" > "${PREPARAR}/migraciones/${ruta##*/}"
    n=$((n + 1))
  done < <(git -C "${REPO}" ls-tree --name-only "${SHA}" supabase/migrations/)
  git -C "${REPO}" cat-file blob "${SHA}:infra/ops/staging/plataforma-prueba.sql" > "${PREPARAR}/plataforma-prueba.sql"
  git -C "${REPO}" cat-file blob "${SHA}:infra/ops/staging/semilla-prueba.sql" > "${PREPARAR}/semilla-prueba.sql"
  # LEDGER_ONLY: los nombres entre `const LEDGER_ONLY = new Set([` y `]);`.
  git -C "${REPO}" cat-file blob "${SHA}:scripts/check-schema-rebuild.mjs" \
    | sed -n '/^const LEDGER_ONLY = new Set(\[/,/^\]);/p' \
    | grep -oE '"[0-9]{4}[a-z]?_[a-z0-9_]+\.sql"' | tr -d '"' > "${PREPARAR}/SOLO-LEDGER.txt"
  git -C "${REPO}" cat-file blob "${SHA}:supabase/migrations-baseline.json" \
    | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{for(const k of Object.keys(JSON.parse(s).pendingBelowCutoff||{}))console.log(k)})' \
    > "${PREPARAR}/PENDIENTES.txt" || die "no pude leer pendingBelowCutoff"
  {
    printf 'sha=%s\nmigraciones=%s\nsolo_ledger=%s\npendientes=%s\npreparado=%s\n' "${SHA}" "${n}" \
      "$(wc -l < "${PREPARAR}/SOLO-LEDGER.txt" | tr -d '[:space:]')" "$(wc -l < "${PREPARAR}/PENDIENTES.txt" | tr -d '[:space:]')" \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "${PREPARAR}/MANIFIESTO.txt"
  ( cd "${PREPARAR}" && find . -type f ! -name SHA256SUMS | LC_ALL=C sort | xargs sha256sum > SHA256SUMS )
  echo "resetear-base-prueba: paquete ${PREPARAR} · ${SHA:0:12} · ${n} migraciones · $(wc -l < "${PREPARAR}/SOLO-LEDGER.txt" | tr -d '[:space:]') sólo-ledger · $(wc -l < "${PREPARAR}/PENDIENTES.txt" | tr -d '[:space:]') pendientes"
  echo "resetear-base-prueba: sha256 de SHA256SUMS: $(sha256sum < "${PREPARAR}/SHA256SUMS" | cut -c1-64)"
  exit 0
fi

# ── 2. Resetear, en el VPS ────────────────────────────────────────────────────
prueba_guarda_proyecto "${PROJECT}"
[[ "${CONFIRM}" == "${PROJECT}" ]] || refuse "--confirm tiene que repetir exactamente '${PROJECT}'"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"; PROJECT_DIR="${PROJECT_DIR%/}"
prueba_guarda_carpeta "${PROJECT_DIR}"
DB="${DB:-${PROJECT}-db-1}"
[[ "${DB}" == "${PROJECT}-"* ]] || refuse "--db-container ${DB} no es un contenedor de ${PROJECT}"
[[ -d "${BUNDLE}" ]] || die "--bundle no existe: '${BUNDLE}'"
for f in MANIFIESTO.txt SHA256SUMS SOLO-LEDGER.txt PENDIENTES.txt plataforma-prueba.sql semilla-prueba.sql; do
  [[ -f "${BUNDLE}/${f}" ]] || die "falta ${BUNDLE}/${f}"
done
( cd "${BUNDLE}" && sha256sum -c --quiet SHA256SUMS ) >/dev/null 2>&1 || { echo "resetear-base-prueba: INTEGRIDAD · SHA256SUMS no coincide en ${BUNDLE}" >&2; exit 4; }
[[ "$(grep -E '^sha=' "${BUNDLE}/MANIFIESTO.txt" | cut -d= -f2)" == "${SHA}" ]] || { echo "resetear-base-prueba: INTEGRIDAD · el paquete no es de ${SHA:0:12}" >&2; exit 4; }

mapfile -t ARCHIVOS < <(cd "${BUNDLE}/migraciones" && ls -1 -- *.sql 2>/dev/null | LC_ALL=C sort)
(( ${#ARCHIVOS[@]} > 0 )) || die "el paquete no trae migraciones"
declare -A SOLO=() PEND=()
while IFS= read -r x; do [[ -n "${x}" ]] && SOLO["${x}"]=1; done < "${BUNDLE}/SOLO-LEDGER.txt"
while IFS= read -r x; do [[ -n "${x}" ]] && PEND["${x}"]=1; done < "${BUNDLE}/PENDIENTES.txt"

# b. Todo lo que se va a aplicar se puede envolver. Las históricas pueden traer
#    CR (0336 entera en CRLF; los blobs son así en git): se aplican tal cual.
aplicar=0; registrar=0; saltar=0; malas=()
for f in "${ARCHIVOS[@]}"; do
  nombre="$(mig_nombre "${f}")"
  if [[ -n "${PEND[${nombre}]+x}" ]]; then saltar=$((saltar + 1)); continue; fi
  if [[ -n "${SOLO[${f}]+x}" ]]; then registrar=$((registrar + 1)); continue; fi
  motivo="$(mig_revisar "${BUNDLE}/migraciones/${f}" "${nombre}" 1)" || malas+=("${motivo}")
  aplicar=$((aplicar + 1))
done
if (( ${#malas[@]} )); then
  printf 'resetear-base-prueba: no se pueden envolver:\n' >&2; printf '  %s\n' "${malas[@]}" >&2
  exit 3
fi
TOTAL=$((aplicar + registrar))

if (( DRY_RUN )); then
  echo "resetear-base-prueba: dry-run · ${PROJECT} a ${SHA:0:12} · ${aplicar} migraciones a aplicar, ${registrar} sólo-ledger, ${saltar} pendientes (se saltan)"
  (( SOLO_BASE )) || {
    echo "+ ${HERE}/destroy-staging.sh --project ${PROJECT} --confirm ${PROJECT} --project-dir ${PROJECT_DIR}"
    echo "+ docker compose -p ${PROJECT} … up -d db; luego up -d auth rest storage imgproxy"
  }
  echo "+ plataforma-prueba.sql como supabase_admin en ${DB}"
  echo "+ ${TOTAL} scripts envueltos como postgres en ${DB}"
  (( SIN_SEMILLA )) || echo "+ ${HERE}/sembrar-prueba.sh --project ${PROJECT} --db-container ${DB}"
  exit 0
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
EVID="${EVIDENCE_DIR%/}/reset-${PROJECT}-${TS}"
mkdir -p -- "${EVID}" || die "no puedo crear ${EVID}"
log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "${EVID}/registro.txt"; }
cerrar() { ( cd "${EVID}" && find . -type f ! -name SHA256SUMS | LC_ALL=C sort | xargs sha256sum > SHA256SUMS ) 2>/dev/null; }
log "reset ${PROJECT} a ${SHA} · ${aplicar} a aplicar, ${registrar} sólo-ledger, ${saltar} pendientes saltadas · paquete ${BUNDLE}"
cp -- "${BUNDLE}/MANIFIESTO.txt" "${BUNDLE}/SOLO-LEDGER.txt" "${BUNDLE}/PENDIENTES.txt" "${EVID}/"

# c y d. Datos fuera y base nueva.
if (( ! SOLO_BASE )); then
  log "c. destroy-staging (solo datos; compose y .env se conservan)"
  bash "${HERE}/destroy-staging.sh" --project "${PROJECT}" --confirm "${PROJECT}" --project-dir "${PROJECT_DIR}" \
    --evidence "${EVID}/destroy.txt" > "${EVID}/destroy.out" 2>&1 || { log "FALLÓ destroy-staging (lee destroy.txt)"; cerrar; exit 5; }
  log "d. db"
  prueba_compose up -d db > "${EVID}/compose-db.out" 2>&1 || { log "FALLÓ compose up db"; cerrar; exit 5; }
fi
prueba_esperar_base "${DB}" 180 || { log "FALLÓ: ${DB} no quedó estable en 180 s"; cerrar; exit 5; }
if (( ! SOLO_BASE )); then
  log "d. auth rest storage imgproxy"
  prueba_compose up -d auth rest storage imgproxy > "${EVID}/compose-servicios.out" 2>&1 || { log "FALLÓ compose up de servicios"; cerrar; exit 5; }
  for s in auth storage; do
    prueba_esperar_sano "${PROJECT}-${s}-1" 180 || { log "FALLÓ: ${PROJECT}-${s}-1 no quedó sano"; cerrar; exit 5; }
  done
fi

# e. Plataforma.
log "e. plataforma-prueba.sql"
docker exec -i "${DB}" psql -U supabase_admin -d postgres -X < "${BUNDLE}/plataforma-prueba.sql" > "${EVID}/plataforma.out" 2>&1 \
  || { log "FALLÓ la plataforma (lee plataforma.out)"; cerrar; exit 6; }

# f. Migraciones: versiones seguidas, la última un segundo antes del reset.
log "f. ${TOTAL} migraciones"
work="$(mktemp -d)"; trap 'rm -rf -- "${work}"' EXIT
fin="$(date -u +%s)"; i=0
CREATED_BY="servidor-propio:psql:prueba:reset@${SHA:0:12}"
for f in "${ARCHIVOS[@]}"; do
  nombre="$(mig_nombre "${f}")"
  [[ -z "${PEND[${nombre}]+x}" ]] || { log "   salta ${nombre} (pendingBelowCutoff: producción no la tiene)"; continue; }
  version_sql="to_char(to_timestamp($(( fin - TOTAL + i ))) at time zone 'utc','YYYYMMDDHH24MISS')"
  i=$((i + 1))
  if [[ -n "${SOLO[${f}]+x}" ]]; then
    mig_solo_ledger "${BUNDLE}/migraciones/${f}" "${nombre}" "${CREATED_BY}:solo-ledger" "${version_sql}" "${work}/s.sql"
  else
    mig_envolver "${BUNDLE}/migraciones/${f}" "${nombre}" "${CREATED_BY}" "${version_sql}" "${work}/s.sql"
  fi
  t0="$(date +%s%N)"
  docker exec -i "${DB}" psql -U postgres -d postgres -X < "${work}/s.sql" > "${work}/o.txt" 2> "${work}/e.txt"; rc=$?
  ms=$(( ($(date +%s%N) - t0) / 1000000 ))
  if (( rc != 0 )) || ! mig_salida_ok "${work}/o.txt" COMMIT; then
    cp -- "${work}/o.txt" "${EVID}/falla-${nombre}.out"; cp -- "${work}/e.txt" "${EVID}/falla-${nombre}.err"
    log "FALLÓ ${nombre} (psql ${rc}, ${ms} ms): $(grep -m1 'ERROR' "${work}/e.txt" || echo 'sin línea ERROR')"
    log "la base quedó con $(( i - 1 )) migraciones: corrige y vuelve a resetear"
    cerrar; exit 6
  fi
  printf '%s %s %s ms\n' "${i}" "${nombre}" "${ms}" >> "${EVID}/migraciones.txt"
done
log "f. ${i} migraciones en el ledger ($(awk '{ s += $3 } END { print s + 0 }' "${EVID}/migraciones.txt") ms)"

# g. RLS de cron, como en la imagen.
docker exec -i "${DB}" psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 \
  -c 'alter table cron.job enable row level security' -c 'alter table cron.job_run_details enable row level security' \
  > "${EVID}/cron-rls.out" 2>&1 || { log "FALLÓ al volver a encender la RLS de cron"; cerrar; exit 6; }

# h. Semilla.
if (( SIN_SEMILLA )); then
  log "h. sin semilla (--sin-semilla)"
else
  log "h. semilla sintética"
  bash "${HERE}/sembrar-prueba.sh" --project "${PROJECT}" --project-dir "${PROJECT_DIR}" --db-container "${DB}" \
    --semilla "${BUNDLE}/semilla-prueba.sql" --salida "${EVID}/semilla.out" > "${EVID}/sembrar.txt" 2>&1 \
    || { log "FALLÓ la semilla (lee semilla.out)"; cerrar; exit 8; }
  log "   $(tail -n2 "${EVID}/sembrar.txt" | head -n1)"
fi

# i. Una fila del ledger por archivo aplicado o registrado.
filas="$(docker exec -i "${DB}" psql -U postgres -d postgres -X -At -c 'select count(*) from supabase_migrations.schema_migrations' 2>/dev/null)"
if [[ "${filas}" != "${TOTAL}" ]]; then
  log "FALLÓ el ledger: ${filas:-?} filas, se esperaban ${TOTAL} (${aplicar} aplicadas + ${registrar} sólo-ledger)"
  cerrar; exit 7
fi
log "i. PASÓ ledger: ${filas} filas = ${aplicar} aplicadas + ${registrar} sólo-ledger · ${saltar} pendientes fuera"
log "reset listo · evidencia en ${EVID}"
cerrar
