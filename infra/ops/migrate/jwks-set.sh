#!/usr/bin/env bash
# infra/ops/migrate/jwks-set.sh — las sesiones abiertas sobreviven al corte (SDD-0505).
#
# Supabase Cloud firma los access tokens de las sesiones con una clave ECC P-256
# (JWT Signing Keys, desde mayo de 2026); el secreto HS256 legacy solo firma las
# keys anon/service_role. Un stack self-hosted con solo JWT_SECRET rechaza esos
# tokens y todos tendrían que volver a entrar después del corte.
#
# Este script arma en el .env del proyecto las dos variables que el compose ya
# espera (mismo mecanismo que docker/utils/add-new-auth-keys.sh del upstream):
#   JWT_KEYS  → GOTRUE_JWT_KEYS: lo que Auth usa para FIRMAR y verificar. Aquí el
#               único firmante es el secreto HS256 (kty oct, key_ops sign+verify):
#               las sesiones nuevas salen HS256, como hasta hoy la anon key. La
#               clave pública ECC de Cloud va solo con key_ops verify.
#   JWT_JWKS  → PGRST_JWT_SECRET, API_JWT_JWKS (realtime), JWT_JWKS (storage) y
#               SUPABASE_JWKS (functions): verifican con las dos.
# La clave pública ECC se lee del JWKS público de Cloud
# (https://<ref>.supabase.co/auth/v1/.well-known/jwks.json); la privada no sale de
# Cloud y no hace falta: cuando el token ES256 vence (1 h), el cliente lo refresca
# con su refresh token (que viaja en el dump) y recibe uno HS256 del servidor.
#
# Uso (root en el VPS):
#   jwks-set.sh --project dtd-cargo (--cloud-ref <ref> | --jwks-url <url> | --jwks-file <archivo>)
#       [--extra-verify-jwk <archivo>]…  [--project-dir /srv/<proyecto>] [--dry-run]
# --extra-verify-jwk suma otra clave pública (p. ej. la de una prueba). Después hay
# que recrear auth, rest, realtime, storage y functions (`up -d --force-recreate`).
# Códigos: 0 listo · 2 uso inválido o JWKS que no sirve (no se toca el .env).
set -euo pipefail
umask 077

PROJECT=""; PROJECT_DIR=""; CLOUD_REF=""; JWKS_URL=""; JWKS_FILE=""; DRY=0
EXTRA=()
die() { echo "jwks-set: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --cloud-ref) setopt CLOUD_REF "${2-}"; shift 2 ;;
    --jwks-url) setopt JWKS_URL "${2-}"; shift 2 ;;
    --jwks-file) setopt JWKS_FILE "${2-}"; shift 2 ;;
    --extra-verify-jwk) EXTRA+=("${2-}"); shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
ENV_FILE="${PROJECT_DIR}/.env"
[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE}"
[[ -n "${CLOUD_REF}" ]] && JWKS_URL="https://${CLOUD_REF}.supabase.co/auth/v1/.well-known/jwks.json"
[[ -n "${JWKS_URL}${JWKS_FILE}" ]] || die "falta --cloud-ref, --jwks-url o --jwks-file"
command -v python3 >/dev/null || die "falta python3"

work="$(mktemp -d /dev/shm/jwks-XXXXXX)"
trap 'rm -rf -- "${work}"' EXIT
if [[ -n "${JWKS_FILE}" ]]; then
  cp "${JWKS_FILE}" "${work}/cloud.json"
else
  curl -fsS --max-time 20 "${JWKS_URL}" -o "${work}/cloud.json" || die "no se pudo leer el JWKS de ${JWKS_URL}"
fi
for e in ${EXTRA[@]+"${EXTRA[@]}"}; do [[ -f "${e}" ]] || die "no existe ${e}"; done

# El secreto viaja por el entorno al intérprete, nunca por argumento.
JWT_SECRET_VALUE="$(grep -E '^JWT_SECRET=' "${ENV_FILE}" | tail -n1 | cut -d= -f2-)"
JWT_SECRET_VALUE="${JWT_SECRET_VALUE#\'}"; JWT_SECRET_VALUE="${JWT_SECRET_VALUE%\'}"
[[ ${#JWT_SECRET_VALUE} -ge 32 ]] || die "JWT_SECRET del .env tiene menos de 32 caracteres"
export JWT_SECRET_VALUE
EXTRA_LIST="$(printf '%s\n' ${EXTRA[@]+"${EXTRA[@]}"})"
export EXTRA_LIST
python3 - "${work}/cloud.json" "${work}/keys.txt" "${work}/jwks.txt" <<'PY'
import base64, json, os, sys
cloud = json.load(open(sys.argv[1]))
pub = []
for k in cloud.get("keys", []):
    if k.get("kty") != "EC" or "d" in k:
        continue
    pub.append({"kty": "EC", "kid": k["kid"], "use": "sig", "key_ops": ["verify"], "alg": k.get("alg", "ES256"),
                "ext": True, "crv": k["crv"], "x": k["x"], "y": k["y"]})
if not pub:
    sys.exit("jwks-set: el JWKS de Cloud no trae ninguna clave EC pública")
for path in [p for p in os.environ.get("EXTRA_LIST", "").split("\n") if p]:
    k = json.load(open(path))
    if "d" in k or k.get("kty") != "EC":
        sys.exit(f"jwks-set: {path} no es una clave EC pública")
    pub.append({"kty": "EC", "kid": k["kid"], "use": "sig", "key_ops": ["verify"], "alg": k.get("alg", "ES256"),
                "ext": True, "crv": k["crv"], "x": k["x"], "y": k["y"]})
# Como en add-new-auth-keys.sh del upstream: el secreto en bytes, base64url, sin kid.
oct_sign = {"kty": "oct", "k": base64.urlsafe_b64encode(os.environ["JWT_SECRET_VALUE"].encode()).decode().rstrip("="),
            "alg": "HS256", "key_ops": ["sign", "verify"]}
oct_verify = {"kty": "oct", "k": oct_sign["k"], "alg": "HS256"}
keys = [oct_sign] + pub           # Auth: un solo firmante (el oct), las EC solo verifican
jwks = {"keys": pub + [oct_verify]}
for v in (keys, jwks):
    s = json.dumps(v, separators=(",", ":"))
    if "'" in s or "\n" in s:
        sys.exit("jwks-set: el JSON trae comilla simple o salto de línea")
open(sys.argv[2], "w").write(json.dumps(keys, separators=(",", ":")))
open(sys.argv[3], "w").write(json.dumps(jwks, separators=(",", ":")))
print(f"claves EC para verificar: {len(pub)} (kid: {', '.join(k['kid'] for k in pub)}) · firmante: HS256 (oct)")
PY

if (( DRY )); then
  echo "dry-run: JWT_KEYS tendría $(wc -c < "${work}/keys.txt") bytes y JWT_JWKS $(wc -c < "${work}/jwks.txt"); el .env no se toca"
  exit 0
fi
# Reemplaza (o agrega) las dos líneas en una copia 600 y mv encima; el valor va
# entre comillas simples (compose no interpola $ ahí; el JSON no trae comillas simples).
tmp="$(mktemp "${ENV_FILE}.XXXXXX")"; chmod 600 "${tmp}"
KEYS_="$(cat "${work}/keys.txt")" JWKS_="$(cat "${work}/jwks.txt")" awk '
  BEGIN { k = ENVIRON["KEYS_"]; j = ENVIRON["JWKS_"]; dk = 0; dj = 0 }
  index($0, "JWT_KEYS=") == 1 { if (!dk) { print "JWT_KEYS=\x27" k "\x27"; dk = 1 }; next }
  index($0, "JWT_JWKS=") == 1 { if (!dj) { print "JWT_JWKS=\x27" j "\x27"; dj = 1 }; next }
  { print }
  END { if (!dk) print "JWT_KEYS=\x27" k "\x27"; if (!dj) print "JWT_JWKS=\x27" j "\x27" }
' "${ENV_FILE}" > "${tmp}"
mv -f "${tmp}" "${ENV_FILE}"
echo "listo: JWT_KEYS y JWT_JWKS escritas en ${ENV_FILE}. Recrea auth, rest, realtime, storage y functions."
