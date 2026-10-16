#!/usr/bin/env bash
# infra/ops/staging/env-prueba.sh — arma el .env del entorno de prueba (SDD-0540, Fase 1).
#
# 1. new-env.sh genera en el servidor TODOS los secretos (distintos de los de
#    producción) con los valores fijos de prueba.sets como `--set`, más la imagen
#    de prueba y una puerta del web cerrada (PRUEBA_WEB_USUARIOS=pendiente:sin-clave:
#    Traefik rechaza toda clave hasta que clave-web-prueba.sh ponga el bcrypt).
# 2. Del resultado BORRA:
#      · toda línea `X=` vacía: el .env va entero al contenedor web y con "" el
#        `??` de la app no cae al respaldo (runbook servidor-contabo §3.6,
#        registro del 2026-10-15). Así también desaparecen las claves de
#        integración, que en prueba no existen (D8, D9);
#      · las marcas `<...>` que quedaron (STORAGE_S3_*: Storage va en archivos).
# El archivo queda en 600 y el script imprime solo NOMBRES, nunca valores.
#
# Uso (en el VPS):
#   env-prueba.sh --example /srv/dtd-cargo-staging/.env.example --out /srv/dtd-cargo-staging/.env \
#       --image ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-<sha> [--sets prueba.sets] [--force]
#
# Códigos: 0 listo · 2 uso inválido · 3 el destino ya existe (usa --force: regenera
# TODOS los secretos) · 4 new-env.sh falló.
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
EXAMPLE=""
OUT=""
IMAGE=""
SETS="${HERE}/prueba.sets"
FORCE=0
NEW_ENV="${NEW_ENV_SH:-${HERE}/new-env.sh}"

die() { echo "env-prueba: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --example) setopt EXAMPLE "${2-}"; shift 2 ;;
    --out) setopt OUT "${2-}"; shift 2 ;;
    --image) setopt IMAGE "${2-}"; shift 2 ;;
    --sets) setopt SETS "${2-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done
[[ -f "${EXAMPLE}" ]] || die "--example no existe: '${EXAMPLE}'"
[[ -f "${SETS}" ]] || die "--sets no existe: '${SETS}'"
[[ -n "${OUT}" ]] || die "--out es obligatorio"
[[ "${IMAGE}" =~ ^ghcr\.io/hailuwaycom-sketch/dtdcargo:prueba-sha-[0-9a-f]{40}$ ]] || die "--image tiene que ser ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-<40 hex>"
if [[ -e "${OUT}" && ${FORCE} -eq 0 ]]; then
  echo "env-prueba: ${OUT} ya existe; no lo piso (con --force se regeneran TODOS los secretos de prueba)" >&2
  exit 3
fi

args=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  [[ "${line}" =~ ^[A-Z_][A-Z0-9_]*= ]] || continue
  args+=(--set "${line}")
done < "${SETS}"
dir_out="$(cd "$(dirname "${OUT}")" && pwd)" || die "no existe la carpeta de --out"
[[ "${dir_out}" == *-staging ]] || die "--out tiene que estar en la carpeta de un proyecto *-staging, no en ${dir_out}"
# Los datos viven junto a su .env: destroy-staging.sh los borra desde ahí.
args+=(--set "DTD_DATA_DIR=${dir_out}/data")
args+=(--set "DTD_WEB_IMAGE=${IMAGE}" --set "PRUEBA_WEB_USUARIOS=pendiente:sin-clave")
for k in STORAGE_S3_BUCKET STORAGE_S3_ACCESS_KEY_ID STORAGE_S3_SECRET_ACCESS_KEY; do
  args+=(--allow-placeholder "${k}")
done

work="$(mktemp -d "$(dirname "${OUT}")/.env-prueba.XXXXXX")"
trap 'rm -rf -- "${work}"' EXIT
if ! bash "${NEW_ENV}" --example "${EXAMPLE}" --out "${work}/.env" "${args[@]}" > "${work}/new-env.log" 2>&1; then
  sed 's/^/env-prueba: new-env: /' "${work}/new-env.log" >&2
  exit 4
fi

# Nombres de lo que se borra (para el registro), sin valores.
vacias="$(grep -E "^[A-Z_][A-Z0-9_]*=(''|\"\")?[[:space:]]*$" "${work}/.env" | cut -d= -f1 | tr '\n' ' ' || true)"
marcas="$(grep -E '^[A-Z_][A-Z0-9_]*=.*<[^>]+>' "${work}/.env" | cut -d= -f1 | tr '\n' ' ' || true)"
awk '
  /^[A-Z_][A-Z0-9_]*=(\047\047|"")?[[:space:]]*$/ { next }
  /^[A-Z_][A-Z0-9_]*=.*<[^>]+>/ { next }
  /^STORAGE_S3_[A-Z0-9_]*=/ { next }
  { print }
' "${work}/.env" > "${work}/.env.limpio"
chmod 600 "${work}/.env.limpio"
mv -f -- "${work}/.env.limpio" "${OUT}"

echo "env-prueba: ${OUT} escrito (600) · $(grep -cE '^[A-Z_][A-Z0-9_]*=' "${OUT}") variables"
echo "env-prueba: generados por new-env.sh: $(grep -oE 'generados: .*' "${work}/new-env.log" | cut -d: -f2- || true)"
echo "env-prueba: borradas por vacías ($(wc -w <<< "${vacias}" | tr -d '[:space:]')): ${vacias:-ninguna}"
echo "env-prueba: borradas por marca o Storage S3: ${marcas:-ninguna} STORAGE_S3_*"
echo "env-prueba: siguiente paso: clave-web-prueba.sh (con la base arriba) pone el bcrypt de la puerta del web"
