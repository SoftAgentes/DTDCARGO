#!/usr/bin/env bash
# infra/ops/migrate/storage-from-cloud.sh — copia los ARCHIVOS de Storage de Supabase Cloud a un staging del VPS (SDD-0505).
#
# Segunda parte del traslado: import-from-cloud.sh (con --skip-storage) ya restauró
# la base, incluidas las filas de storage.objects (nombre, dueño, fecha). Faltan
# los archivos. Este script los copia con rclone, de S3 de Cloud a S3 del staging,
# y después comprueba en el DISCO del staging que cada objeto tiene su archivo.
#
# Medido en el staging el 2026-10-12, con un bucket de prueba y archivos inventados:
#   · Con la fila restaurada y sin archivo, `rclone copy` normal no copia NADA: el
#     S3 del staging responde con los metadatos de la fila y rclone da el objeto por
#     igual. Por eso va con --ignore-times, y por eso la verificación mira el disco
#     y no el listado S3, que saldría «igual» aunque falten todos los archivos.
#   · Con --ignore-times, storage-api reemplaza el objeto y conserva id, owner_id y
#     created_at de la fila. Solo cambia `version`, que es la carpeta del archivo.
#   · El S3 del staging solo acepta la firma por su URL pública
#     (https://<host>/storage/v1/s3). Por http://storage:5000/s3 o por el gateway
#     interno da SignatureDoesNotMatch. El contenedor de rclone va en la red edge,
#     que sale a internet y entra a Traefik por la puerta de enlace de esa red
#     (STAGING_INTERNAL_IPS de compose.staging.yml).
#
# Pide por la terminal la access key S3 TEMPORAL de Cloud (Storage › S3 Connection)
# y, al final, que se revoque. La prueba de cada clave se hace apenas llega
# (listado de buckets de Cloud) y, si no sirve, se vuelve a pedir.
#
# CORTE (--corte, solo el proyecto de producción del VPS): pide escribir
# «CORTE <proyecto>» antes de pedir las claves; el resto es igual.
#
# Uso (como root en el VPS, mejor dentro de tmux):
#   storage-from-cloud.sh --project dtd-cargo-staging --cloud-ref <ref> [--corte] \
#       [--project-dir /srv/dtd-cargo-staging] [--evidence <archivo>] [--work-dir /dev/shm]
#
# Códigos: 0 todo PASÓ · 2 uso inválido o credenciales · 3 rechazado por una guarda ·
# 7 terminó, pero alguna comprobación FALLÓ (lee la evidencia).
set -euo pipefail
umask 077

PROJECT=""
PROJECT_DIR=""
CLOUD_REF=""
EVIDENCE=""
CORTE=0
WORK_ROOT="/dev/shm"
PG_IMAGE="supabase/postgres:17.6.1.136"
RCLONE_IMAGE="rclone/rclone:1.75.1"
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

usage() {
  sed -n '2,34p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${EVIDENCE:-/dev/null}"
}
die() {
  echo "storage-from-cloud: $*" >&2
  [[ -z "${EVIDENCE:-}" || ! -f "${EVIDENCE}" ]] || printf '%s storage-from-cloud: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "${EVIDENCE}"
  exit 2
}
refuse() {
  echo "storage-from-cloud: RECHAZADO · $*" | tee -a "${EVIDENCE:-/dev/null}" >&2
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
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --cloud-ref) setopt CLOUD_REF "${2-}"; shift 2 ;;
    --evidence) setopt EVIDENCE "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --rclone-image) setopt RCLONE_IMAGE "${2-}"; shift 2 ;;
    --corte) CORTE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── 0 · Guardas ──────────────────────────────────────────────────────────────
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
if (( CORTE )); then
  [[ "${PROJECT}" == "${PROD_PROJECT}" ]] \
    || refuse "--corte es solo para el proyecto de producción del VPS (${PROD_PROJECT})"
else
  [[ "${PROJECT}" != "${PROD_PROJECT}" && "${PROJECT}" == *-staging ]] \
    || refuse "${PROJECT} no es un staging: sin --corte este script solo escribe en proyectos *-staging"
fi
[[ "${CLOUD_REF}" =~ ^[a-z0-9]{20}$ ]] || die "--cloud-ref debe ser el id de 20 caracteres del proyecto de Cloud"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
EVIDENCE="${EVIDENCE:-/srv/ops/evidencias/storage-${PROJECT}-${stamp}.txt}"
mkdir -p "$(dirname "${EVIDENCE}")"
: > "${EVIDENCE}"
chmod 600 "${EVIDENCE}"
[[ -f "${PROJECT_DIR}/.env" ]] || die "no existe ${PROJECT_DIR}/.env"
command -v docker >/dev/null || die "docker no está en el PATH"
[[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"

envget() {
  local value
  value="$(grep -E "^${1}=" "${PROJECT_DIR}/.env" | tail -n1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "${value}"
}
STAGING_PASSWORD="$(envget POSTGRES_PASSWORD)"
[[ -n "${STAGING_PASSWORD}" ]] || die "POSTGRES_PASSWORD vacío en ${PROJECT_DIR}/.env"
NET_INTERNAL="${PROJECT}_dtd_internal"
NET_EDGE="$(envget DTD_EDGE_NETWORK)"; NET_EDGE="${NET_EDGE:-dtd_edge}"
PUBLIC_HOST="$(envget SUPABASE_PUBLIC_HOST)"
[[ -n "${PUBLIC_HOST}" ]] || die "SUPABASE_PUBLIC_HOST vacío en ${PROJECT_DIR}/.env"
STORAGE_CONTAINER="${PROJECT}-storage-1"

run_label="dtd.storage.run=${PROJECT}-${stamp}-$$"
work=""
cleanup() {
  docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  if [[ -n "${work}" && -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
}
tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then
  tty_in=/dev/tty
fi
# trim, describe_input, ask_secret, retry_or_die y pause_in_tmux.
# shellcheck source=../lib/prompt.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/prompt.sh"
trap 'cleanup; pause_in_tmux' EXIT

staging_sql() { # $1 = sql
  docker run --rm --label "${run_label}" --network "${NET_INTERNAL}" -e PGPASSWORD="${STAGING_PASSWORD}" "${PG_IMAGE}" \
    psql -h db -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atq -c "$1"
}

log "storage-from-cloud → ${PROJECT} · evidencia ${EVIDENCE}"
log "0/5 guardas"
staging_sql "select 1" >/dev/null || refuse "no entro a la base del staging por ${NET_INTERNAL}"
n_public="$(staging_sql "select count(*) from pg_tables where schemaname = 'public'")"
n_objects="$(staging_sql "select count(*) from storage.objects")"
[[ "${n_public}" != "0" && "${n_objects}" != "0" ]] \
  || refuse "el staging no tiene la base importada (public: ${n_public} tablas, storage.objects: ${n_objects}): primero import-from-cloud.sh"
# El backend tiene que ser de archivos: la verificación cuenta en el disco.
cenv() { docker inspect "${STORAGE_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E "^$1=" | cut -d= -f2- || true; }
[[ "$(cenv STORAGE_BACKEND)" == "file" ]] || refuse "el Storage del staging no usa backend de archivos (STORAGE_BACKEND=$(cenv STORAGE_BACKEND)): esta verificación no aplica"
TENANT="$(cenv TENANT_ID)"; BACKEND_PATH="$(cenv FILE_STORAGE_BACKEND_PATH)"; GLOBAL_BUCKET="$(cenv GLOBAL_S3_BUCKET)"
[[ -n "${TENANT}" && -n "${BACKEND_PATH}" && -n "${GLOBAL_BUCKET}" ]]   || die "no pude leer TENANT_ID / FILE_STORAGE_BACKEND_PATH / GLOBAL_S3_BUCKET de ${STORAGE_CONTAINER}"
# Archivos de ${BACKEND_PATH} en el contenedor = <data>/storage en el host.
DATA_DIR="$(envget DTD_DATA_DIR)"; DATA_DIR="${DATA_DIR:-./data}"
[[ "${DATA_DIR}" == /* ]] || DATA_DIR="${PROJECT_DIR}/${DATA_DIR#./}"
# Disposición del backend de archivos, medida el 2026-10-12 con un archivo de prueba:
# <FILE_STORAGE_BACKEND_PATH>/<GLOBAL_S3_BUCKET>/<TENANT_ID>/<bucket>/<nombre>/<version>.
DISK_ROOT="${DATA_DIR}/storage/${GLOBAL_BUCKET}/${TENANT}"
log "0/5 staging con la base importada (public: ${n_public} tablas · storage.objects: ${n_objects}) · archivos en ${DISK_ROOT}"

# Remotos de rclone por variables de entorno: ni rclone.conf en disco ni claves en
# la línea de comandos (`-e VAR` pasa el nombre; el valor sale del entorno).
export RCLONE_CONFIG_STAGING_TYPE=s3 RCLONE_CONFIG_STAGING_PROVIDER=Other RCLONE_CONFIG_STAGING_FORCE_PATH_STYLE=true \
  RCLONE_CONFIG_STAGING_ENDPOINT="https://${PUBLIC_HOST}/storage/v1/s3" \
  RCLONE_CONFIG_STAGING_REGION="$(envget REGION)" \
  RCLONE_CONFIG_STAGING_ACCESS_KEY_ID="$(envget S3_PROTOCOL_ACCESS_KEY_ID)" \
  RCLONE_CONFIG_STAGING_SECRET_ACCESS_KEY="$(envget S3_PROTOCOL_ACCESS_KEY_SECRET)"
[[ -n "${RCLONE_CONFIG_STAGING_REGION}" ]] || export RCLONE_CONFIG_STAGING_REGION=stub
[[ -n "${RCLONE_CONFIG_STAGING_ACCESS_KEY_ID}" && -n "${RCLONE_CONFIG_STAGING_SECRET_ACCESS_KEY}" ]] \
  || die "S3_PROTOCOL_ACCESS_KEY_* vacío en ${PROJECT_DIR}/.env"
export RCLONE_CONFIG_CLOUD_TYPE=s3 RCLONE_CONFIG_CLOUD_PROVIDER=Other RCLONE_CONFIG_CLOUD_REGION=us-east-1 \
  RCLONE_CONFIG_CLOUD_FORCE_PATH_STYLE=true \
  RCLONE_CONFIG_CLOUD_ENDPOINT="${CLOUD_S3_ENDPOINT:-https://${CLOUD_REF}.storage.supabase.co/storage/v1/s3}" \
  RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID="" RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY=""
rclone_run() {
  local envs=() v
  for v in $(compgen -e | grep -E '^RCLONE_CONFIG_(CLOUD|STAGING)_'); do envs+=(-e "${v}"); done
  docker run --rm --label "${run_label}" --network "${NET_EDGE}" "${envs[@]}" "${RCLONE_IMAGE}" \
    --contimeout 30s --timeout 5m --retries 3 --low-level-retries 5 "$@"
}
# El S3 del staging tiene que responder ANTES de pedir las claves de Cloud.
rclone_run lsd staging: > /dev/null 2>&1 \
  || refuse "el S3 del staging (https://${PUBLIC_HOST}/storage/v1/s3) no responde a rclone desde ${NET_EDGE}: revisa STAGING_INTERNAL_IPS y que api-gw esté arriba"
log "0/5 S3 del staging responde por https://${PUBLIC_HOST}/storage/v1/s3"

if (( CORTE )); then
  read -r -p "CORTE de producción: archivos de Cloud → ${PROJECT}. Escribe exactamente 'CORTE ${PROJECT}' para seguir: " corte_ok < "${tty_in}" || corte_ok=""
  [[ "$(trim "${corte_ok}")" == "CORTE ${PROJECT}" ]] || refuse "confirmación del corte incorrecta: no se pidieron claves ni se copió nada"
  log "0/5 CORTE confirmado"
fi

# ── 1 · Claves S3 de Cloud (probadas al llegar) ─────────────────────────────
problem=""
for (( try = 1; ; try++ )); do
  ask_secret "Access key ID S3 temporal de Cloud: " CLOUD_S3_KEY || die "${problem:-el Access key ID no llegó: fin de la entrada}"
  if [[ -z "${CLOUD_S3_KEY}" || "${CLOUD_S3_KEY}" =~ [[:space:]] ]]; then
    problem="el Access key ID no llegó bien: $(describe_input "${CLOUD_S3_KEY}")"
  else
    echo "access key ID recibida (${#CLOUD_S3_KEY} caracteres)"
    ask_secret "Secret access key S3 temporal de Cloud: " CLOUD_S3_SECRET || die "${problem:-el Secret access key no llegó: fin de la entrada}"
    if [[ -z "${CLOUD_S3_SECRET}" || "${CLOUD_S3_SECRET}" =~ [[:space:]] ]]; then
      problem="el Secret access key no llegó bien: $(describe_input "${CLOUD_S3_SECRET}")"
    else
      echo "secret access key recibido (${#CLOUD_S3_SECRET} caracteres)"
      export RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID="${CLOUD_S3_KEY}" RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY="${CLOUD_S3_SECRET}"
      if rclone_run lsd cloud: > /dev/null 2>&1; then
        log "1/5 acceso a Storage de Cloud: OK"
        break
      fi
      problem="Storage de Cloud no aceptó esas claves (¿se copiaron completas, cada una por separado? ¿la key sigue activa?)"
    fi
  fi
  retry_or_die "${try}" "${problem}" "Pega las DOS claves de nuevo, una por una, con Enter después de cada una"
done

work="$(mktemp -d "${WORK_ROOT%/}/storage-${PROJECT}-XXXXXX")"

# ── 2 · Buckets ─────────────────────────────────────────────────────────────
rclone_run lsd cloud: 2>/dev/null | awk '{print $NF}' | sort > "${work}/buckets-cloud.txt"
staging_sql "select id from storage.buckets order by 1" | sort > "${work}/buckets-staging.txt"
log "2/5 buckets · Cloud $(wc -l < "${work}/buckets-cloud.txt") · staging $(wc -l < "${work}/buckets-staging.txt")"
missing_buckets="$(comm -23 "${work}/buckets-cloud.txt" "${work}/buckets-staging.txt" | tr '\n' ' ')"
[[ -z "${missing_buckets// /}" ]] || die "buckets de Cloud que el staging no tiene (¿import viejo?): ${missing_buckets}"

# ── 3 · Copia ───────────────────────────────────────────────────────────────
# Tipos de archivo antes de copiar (los de Cloud, que trajo el import): después se
# comparan, porque la subida reescribe los metadatos de cada fila.
# storage-api v1.77 guarda las subidas HTML como text/plain (medido el 2026-10-12: los
# 74 .html de brand-assets llegaron así). La app no se entera: /marca/doc fija el
# Content-Type por la extensión. Por eso se comparan con text/html contado como
# text/plain, y el cambio se informa aparte.
mime_sql="select m || ':' || n from (select case coalesce(metadata->>'mimetype', '-') when 'text/html' then 'text/plain' else coalesce(metadata->>'mimetype', '-') end as m, count(*) as n from storage.objects group by 1) t order by 1"
html_sql="select count(*) from storage.objects where metadata->>'mimetype' = 'text/html'"
staging_sql "${mime_sql}" > "${work}/tipos-antes.txt"
html_before="$(staging_sql "${html_sql}")"
# Huella de id + dueño + fecha de creación: la copia no los debe tocar (medido).
copy_start="$(staging_sql "select now()")"
owners_sql="select count(*) || ':' || count(owner_id) || ':' || md5(string_agg(id::text || coalesce(owner_id, '') || created_at::text, ',' order by id)) from storage.objects where created_at < '${copy_start}'"
owners_before="$(staging_sql "${owners_sql}")"
copy_rc=0
while read -r bucket; do
  [[ -n "${bucket}" ]] || continue
  log "3/5 copiando ${bucket}"
  rclone_run copy "cloud:${bucket}" "staging:${bucket}" --ignore-times --transfers 4 --checkers 8 \
    --stats-one-line --stats 30s >> "${work}/rclone.log" 2>&1 \
    || { copy_rc=1; log "3/5 rclone falló en ${bucket}: $(grep -E 'ERROR' "${work}/rclone.log" | tail -n 1 | grep -oE '(StatusCode: [0-9]+|api error [A-Za-z]+|[A-Za-z]+Error)' | head -n 2 | tr '\n' ' ')"; }
done < "${work}/buckets-cloud.txt"

# ── 4 · Verificación en el disco ────────────────────────────────────────────
log "4/5 verificación (Cloud | staging, archivos en disco)"
pass=0; fail=0
check() { # $1 = descripción, $2 = esperado, $3 = obtenido
  if [[ "$2" == "$3" ]]; then
    pass=$((pass + 1)); log "PASÓ  · $1 · $3"
  else
    fail=$((fail + 1)); log "FALLÓ · $1 · esperado '$2', obtenido '$3'"
  fi
}
check "rclone: copia sin errores" "0" "${copy_rc}"
# Ruta de cada objeto debajo de DISK_ROOT: <bucket>/<nombre>/<version>. Los nombres pueden traer datos personales: el listado
# vive en ${work} (memoria) y no se imprime, solo se cuenta.
staging_sql "select bucket_id || '/' || name || coalesce('/' || version, '') from storage.objects order by 1" > "${work}/esperados.txt"
total_cloud_n=0; total_cloud_b=0; total_disk_n=0; total_disk_b=0; total_missing=0
while read -r bucket; do
  [[ -n "${bucket}" ]] || continue
  cj="$(rclone_run size --json "cloud:${bucket}" 2>/dev/null || echo '{}')"
  cn="$(grep -oE '"count":[0-9]+' <<< "${cj}" | cut -d: -f2)"; cb="$(grep -oE '"bytes":[0-9]+' <<< "${cj}" | cut -d: -f2)"
  dn="$(staging_sql "select count(*) from storage.objects where bucket_id = '${bucket//\'/\'\'}'")"
  missing=0; disk_b=0
  while IFS= read -r rel; do
    if [[ -f "${DISK_ROOT}/${rel}" ]]; then
      disk_b=$(( disk_b + $(stat -c %s "${DISK_ROOT}/${rel}") ))
    else
      missing=$((missing + 1))
    fi
  done < <(awk -v b="${bucket}/" 'index($0, b) == 1' "${work}/esperados.txt")
  check "${bucket}: objetos en Cloud = filas en staging" "${cn:-?}" "${dn}"
  check "${bucket}: filas sin archivo en el disco" "0" "${missing}"
  check "${bucket}: bytes en Cloud = bytes en el disco" "${cb:-?}" "${disk_b}"
  total_cloud_n=$((total_cloud_n + ${cn:-0})); total_cloud_b=$((total_cloud_b + ${cb:-0}))
  total_disk_n=$((total_disk_n + dn - missing)); total_disk_b=$((total_disk_b + disk_b)); total_missing=$((total_missing + missing))
done < "${work}/buckets-cloud.txt"
log "      total · Cloud ${total_cloud_n} objetos / ${total_cloud_b} bytes · disco ${total_disk_n} archivos / ${total_disk_b} bytes · filas sin archivo ${total_missing}"
log "INFO  · archivos con text/html: ${html_before} antes · $(staging_sql "${html_sql}") después (storage-api los guarda como text/plain)"
check "tipos de archivo (mimetype) iguales antes y después de copiar, HTML contado como texto" \
  "$(tr '\n' ' ' < "${work}/tipos-antes.txt")" "$(staging_sql "${mime_sql}" | tr '\n' ' ')"
check "dueños y fechas conservados: filas con owner_id antes y después" \
  "${owners_before}" "$(staging_sql "${owners_sql}")"

# ── 5 · Borrado y cierre ────────────────────────────────────────────────────
log "5/5 borrado de la carpeta de trabajo"
rm -rf -- "${work}"
work=""
check "nada quedó en ${WORK_ROOT}" "0" "$(find "${WORK_ROOT}" -maxdepth 1 -name "storage-${PROJECT}-*" | wc -l)"
unset CLOUD_S3_KEY CLOUD_S3_SECRET RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY
log "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
# Solo vale «revocada» o «pendiente». Medido el 2026-10-12: unas flechas del teclado
# llegaron como respuesta («^[[B…») y quedaron en la evidencia como si fueran
# la confirmación.
answer=""
until [[ "${answer}" == "revocada" || "${answer}" == "pendiente" ]]; do
  read -r -p "Revoca AHORA la access key S3 temporal en el panel de Supabase y escribe 'revocada' (o 'pendiente'): " answer < "${tty_in}" || { answer="sin respuesta"; break; }
  answer="$(trim "${answer}")"
  answer="${answer//[^a-z ]/}"
done
log "claves S3 temporales: ${answer} a las $(date -u +%H:%M:%SZ)"
log "evidencia: ${EVIDENCE} (solo cifras y nombres de bucket)."
(( fail == 0 )) || exit 7
