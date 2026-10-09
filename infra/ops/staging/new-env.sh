#!/usr/bin/env bash
# infra/ops/staging/new-env.sh — genera un .env nuevo a partir de un .env.example (SDD-0505).
#
# Los secretos nacen en el servidor y no pasan por ninguna laptop ni por la
# pantalla: el script escribe el archivo en modo 600 e imprime solo los NOMBRES
# de lo que generó.
#
# Entiende las marcas del .env.example del repo:
#   <generar: openssl rand -hex N>     → openssl rand -hex N
#   <generar: openssl rand -base64 N>  → openssl rand -base64 N (una línea)
#   <JWT HS256 firmado con JWT_SECRET, role=R> → JWT HS256 con role=R, iss=supabase,
#                                         válido 5 años, firmado con el JWT_SECRET generado
#   <igual-a-OTRA>                     → el valor final de OTRA
# y aplica `--set CLAVE=valor` (reemplaza o agrega) antes de resolver <igual-a-…>.
# Lo que quede entre < > se informa como «sin resolver» y el script sale 4, salvo
# las claves de --allow-placeholder (p. ej. STORAGE_S3_* cuando Storage va en
# archivos).
#
# Uso:
#   new-env.sh --example infra/dtd-cargo/.env.example --out /srv/dtd-cargo-staging/.env \
#       --set APP_ENV=staging --set DTD_WEB_HOST=staging.dtdcargo.com … \
#       [--allow-placeholder STORAGE_S3_BUCKET]… [--force]
#
# Códigos: 0 listo · 2 uso inválido · 3 el destino ya existe (usa --force) ·
# 4 quedaron marcas sin resolver.
set -euo pipefail
umask 077

EXAMPLE=""
OUT=""
FORCE=0
SETS=()
ALLOWED=()

die() { echo "new-env: $*" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --example) EXAMPLE="${2-}"; shift 2 ;;
    --out) OUT="${2-}"; shift 2 ;;
    --set) [[ "${2-}" =~ ^[A-Z_][A-Z0-9_]*= ]] || die "--set espera CLAVE=valor: '${2-}'"; SETS+=("$2"); shift 2 ;;
    --allow-placeholder) ALLOWED+=("${2-}"); shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done
[[ -f "${EXAMPLE}" ]] || die "--example no existe: '${EXAMPLE}'"
[[ -n "${OUT}" ]] || die "--out es obligatorio"
if [[ -e "${OUT}" && ${FORCE} -eq 0 ]]; then
  echo "new-env: ${OUT} ya existe; no lo piso (usa --force si de verdad quieres regenerar TODOS los secretos)" >&2
  exit 3
fi
command -v openssl >/dev/null || die "falta openssl"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # $1 role, $2 secreto
  local now exp header payload sig
  now="$(date +%s)"; exp=$(( now + 5 * 365 * 24 * 3600 ))
  header="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  payload="$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "${now}" "${exp}" | b64url)"
  sig="$(printf '%s.%s' "${header}" "${payload}" | openssl dgst -sha256 -hmac "$2" -binary | b64url)"
  printf '%s.%s.%s' "${header}" "${payload}" "${sig}"
}

# Patrones en variables: dentro de [[ =~ ]], una barra antes de < sería «inicio de palabra».
RE_HEX='^<generar: openssl rand -hex ([0-9]+)>$'
RE_B64='^<generar: openssl rand -base64 ([0-9]+)>$'
RE_JWT='^<JWT HS256 firmado con JWT_SECRET, role=([a-z_]+)>$'
RE_SAME='^<igual-a-([A-Z_][A-Z0-9_]*)>$'

declare -A VAL
ORDER=()
generated=()
# Pasada 1: copiar el ejemplo y generar los aleatorios.
while IFS= read -r line || [[ -n "${line}" ]]; do
  if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
    k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"
    if [[ "${v}" =~ ${RE_HEX} ]]; then
      v="$(openssl rand -hex "${BASH_REMATCH[1]}")"; generated+=("${k}")
    elif [[ "${v}" =~ ${RE_B64} ]]; then
      v="$(openssl rand -base64 "${BASH_REMATCH[1]}" | tr -d '\n')"; generated+=("${k}")
    fi
    [[ -z "${VAL[${k}]+x}" ]] && ORDER+=("${k}")
    VAL["${k}"]="${v}"
  fi
done < "${EXAMPLE}"

# Pasada 2: JWT firmados con el JWT_SECRET ya generado.
for k in "${ORDER[@]}"; do
  if [[ "${VAL[${k}]}" =~ ${RE_JWT} ]]; then
    [[ -n "${VAL[JWT_SECRET]-}" && "${VAL[JWT_SECRET]}" != \<* ]] || die "hay un JWT que firmar y JWT_SECRET no se generó"
    VAL["${k}"]="$(jwt "${BASH_REMATCH[1]}" "${VAL[JWT_SECRET]}")"; generated+=("${k}")
  fi
done

# Pasada 3: --set (reemplaza o agrega al final).
for s in ${SETS[@]+"${SETS[@]}"}; do
  k="${s%%=*}"; v="${s#*=}"
  [[ -z "${VAL[${k}]+x}" ]] && ORDER+=("${k}")
  VAL["${k}"]="${v}"
done

# Pasada 4: <igual-a-OTRA>.
for k in "${ORDER[@]}"; do
  if [[ "${VAL[${k}]}" =~ ${RE_SAME} ]]; then
    ref="${BASH_REMATCH[1]}"
    [[ -n "${VAL[${ref}]+x}" && "${VAL[${ref}]}" != \<* ]] || die "${k} pide el valor de ${ref}, que no está resuelto"
    VAL["${k}"]="${VAL[${ref}]}"
  fi
done

# Marcas que quedaron.
pending=()
for k in "${ORDER[@]}"; do
  if [[ "${VAL[${k}]}" == \<*\> ]]; then
    ok=0
    for a in ${ALLOWED[@]+"${ALLOWED[@]}"}; do [[ "${a}" == "${k}" ]] && ok=1; done
    (( ok )) || pending+=("${k}")
  fi
done

# Escribir: misma forma que el ejemplo (comentarios incluidos), valores nuevos.
tmp="$(mktemp "$(dirname "${OUT}")/.env.tmp.XXXXXX")"
trap 'rm -f -- "${tmp}"' EXIT
{
  declare -A written=()
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      k="${BASH_REMATCH[1]}"
      if [[ -z "${written[${k}]+x}" ]]; then
        printf '%s=%s\n' "${k}" "${VAL[${k}]}"; written["${k}"]=1
      fi
    else
      printf '%s\n' "${line}"
    fi
  done < "${EXAMPLE}"
  extra=0
  for k in "${ORDER[@]}"; do
    if [[ -z "${written[${k}]+x}" ]]; then
      (( extra )) || printf '\n# Agregadas con new-env.sh --set\n'
      extra=1
      printf '%s=%s\n' "${k}" "${VAL[${k}]}"; written["${k}"]=1
    fi
  done
} > "${tmp}"
chmod 600 "${tmp}"
mv "${tmp}" "${OUT}"
trap - EXIT

echo "new-env: ${OUT} escrito (600) · generados: ${generated[*]:-ninguno}"
echo "new-env: fijados con --set: $(for s in ${SETS[@]+"${SETS[@]}"}; do printf '%s ' "${s%%=*}"; done)"
if (( ${#pending[@]} )); then
  echo "new-env: SIN RESOLVER (quedaron como marca): ${pending[*]}" >&2
  exit 4
fi
