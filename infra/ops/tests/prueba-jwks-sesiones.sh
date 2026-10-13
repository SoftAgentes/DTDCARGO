#!/usr/bin/env bash
# infra/ops/tests/prueba-jwks-sesiones.sh — las sesiones firmadas por Cloud (ES256)
# se aceptan en el stack del servidor (SDD-0505). Corre en el VPS como root contra
# un stack de Supabase LEVANTADO y VACÍO (por defecto dtd-cargo, antes del corte).
#
# Qué mide, con un par EC de prueba cuya pública se suma al JWKS (jwks-set.sh
# --extra-verify-jwk) y después se quita:
#   1. un token ES256 firmado con la privada de prueba pasa la firma en auth, rest,
#      storage y realtime (no es «bad_jwt»/401); otro firmado con una clave que no
#      está en el JWKS da 401 en los cuatro (control rojo);
#   2. la anon key HS256 sigue valiendo;
#   3. Auth sigue firmando las sesiones nuevas con HS256 (usuario de prueba creado
#      y borrado por la API admin; auth.users vuelve a 0);
#   4. sin la pública de prueba en el JWKS, ese token vuelve a dar 401.
# Uso: bash infra/ops/tests/prueba-jwks-sesiones.sh [--project dtd-cargo] [--cloud-ref xpfuzqombmjmxvprjgmi]
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
P=dtd-cargo; REF=xpfuzqombmjmxvprjgmi
while [[ $# -gt 0 ]]; do case "$1" in --project) P="$2"; shift 2;; --cloud-ref) REF="$2"; shift 2;; *) echo "argumento desconocido: $1"; exit 2;; esac; done
D="/srv/${P}"; ENVF="${D}/.env"
T="$(mktemp -d /dev/shm/jwks-prueba-XXXXXX)"
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
val() { local v; v="$(grep -E "^$1=" "${ENVF}" | tail -n1 | cut -d= -f2-)"; v="${v#\'}"; printf '%s' "${v%\'}"; }
HOST="$(val SUPABASE_PUBLIC_URL)"; ANON="$(val ANON_KEY)"; SRK="$(val SERVICE_ROLE_KEY)"
C="docker compose -p ${P} -f ${D}/compose.yml -f ${D}/compose.supabase.yml --env-file ${ENVF}"
recrear() {
  $C up -d --force-recreate --no-deps auth rest realtime storage functions >/dev/null 2>&1
  local i s
  for i in $(seq 1 40); do
    s="$(for c in auth rest realtime storage functions; do docker inspect -f '{{.State.Health.Status}}' "${P}-${c}-1" 2>/dev/null; done | sort -u | tr '\n' ' ')"
    [[ "${s}" == "healthy " ]] && return 0; sleep 3
  done
  echo "servicios: ${s}"; return 1
}
limpiar() {
  # Deja el JWKS solo con la clave de Cloud, el usuario de prueba borrado y nada en /dev/shm.
  bash "${S}/migrate/jwks-set.sh" --project "${P}" --cloud-ref "${REF}" >/dev/null 2>&1 && recrear >/dev/null 2>&1
  [[ -n "${UID_PRUEBA:-}" ]] && curl -s -o /dev/null -X DELETE -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" "${HOST}/auth/v1/admin/users/${UID_PRUEBA}"
  rm -rf "${T}"
}
trap limpiar EXIT
command -v python3 >/dev/null || { echo "falta python3"; exit 2; }
python3 -c "import cryptography" 2>/dev/null || { echo "falta python3-cryptography"; exit 2; }

echo "== par EC de prueba y otro que NO va al JWKS =="
python3 - "${T}" <<'PY'
import json, sys, base64, secrets
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
t = sys.argv[1]
def b64(b): return base64.urlsafe_b64encode(b).decode().rstrip("=")
for nombre in ("buena", "ajena"):
    k = ec.generate_private_key(ec.SECP256R1())
    n = k.public_key().public_numbers()
    kid = "prueba-" + nombre + "-" + secrets.token_hex(4)
    pub = {"kty": "EC", "kid": kid, "alg": "ES256", "crv": "P-256", "x": b64(n.x.to_bytes(32, "big")), "y": b64(n.y.to_bytes(32, "big"))}
    open(f"{t}/{nombre}.pub.json", "w").write(json.dumps(pub))
    open(f"{t}/{nombre}.pem", "wb").write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    open(f"{t}/{nombre}.kid", "w").write(kid)
PY
firmar() { # $1 = nombre del par · imprime un access token ES256 como los de Cloud
  python3 - "${T}" "$1" "https://${REF}.supabase.co/auth/v1" <<'PY'
import json, sys, base64, time, uuid
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
t, nombre, iss = sys.argv[1:4]
def b64(b): return base64.urlsafe_b64encode(b).decode().rstrip("=")
k = serialization.load_pem_private_key(open(f"{t}/{nombre}.pem", "rb").read(), None)
kid = open(f"{t}/{nombre}.kid").read()
now = int(time.time())
h = b64(json.dumps({"alg": "ES256", "typ": "JWT", "kid": kid}, separators=(",", ":")).encode())
c = b64(json.dumps({"iss": iss, "sub": str(uuid.uuid4()), "aud": "authenticated", "exp": now + 3600, "iat": now,
                     "email": "prueba@example.test", "role": "authenticated", "session_id": str(uuid.uuid4()),
                     "is_anonymous": False}, separators=(",", ":")).encode())
der = k.sign(f"{h}.{c}".encode(), ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der)
print(f"{h}.{c}.{b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}")
PY
}
# Código HTTP y, si lo hay, el error_code/message del cuerpo, para cada servicio.
sonda() { # $1 = token · imprime "auth=<code>/<err> rest=<code> storage=<code> realtime=<code>"
  local tok="$1" a r s w
  a="$(curl -s --max-time 15 -w '\n%{http_code}' -H "apikey: ${ANON}" -H "Authorization: Bearer ${tok}" "${HOST}/auth/v1/user")"
  r="$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' -H "apikey: ${ANON}" -H "Authorization: Bearer ${tok}" "${HOST}/rest/v1/rpc/zz_no_existe")"
  s="$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' -H "apikey: ${ANON}" -H "Authorization: Bearer ${tok}" "${HOST}/storage/v1/bucket")"
  # Realtime: Traefik no enruta /realtime/v1/api, así que el broadcast HTTP se
  # prueba desde la red interna, con el Host del tenant (realtime-dev): 202 si el
  # JWT verifica, 401 si no.
  w="$(docker run --rm --network "${P}_dtd_internal" curlimages/curl:8.11.1 -s -o /dev/null --max-time 15 -w '%{http_code}' -X POST \
        -H "Host: realtime-dev" -H "Content-Type: application/json" -H "apikey: ${ANON}" -H "Authorization: Bearer ${tok}" \
        -d '{"messages":[{"topic":"zz-prueba","event":"ping","payload":{}}]}' http://realtime:4000/api/broadcast)"
  printf 'auth=%s/%s rest=%s storage=%s realtime=%s\n' "$(tail -n1 <<< "${a}")" "$(head -n1 <<< "${a}" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); print(d.get("error_code") or d.get("code") or d.get("msg") or "-")
except Exception: print("-")')" "${r}" "${s}" "${w}"
}

echo "== JWKS con la clave de Cloud + la pública de prueba =="
bash "${S}/migrate/jwks-set.sh" --project "${P}" --cloud-ref "${REF}" --extra-verify-jwk "${T}/buena.pub.json" > "${T}/set.log" 2>&1 && ok "jwks-set.sh escribe JWT_KEYS y JWT_JWKS ($(tail -n1 "${T}/set.log" | cut -c1-60)…)" || { ko "jwks-set.sh"; cat "${T}/set.log"; }
n="$(python3 -c "import json; print(len(json.loads('$(val JWT_JWKS)')['keys']))")"
[ "${n}" = 3 ] && ok "JWT_JWKS tiene 3 claves (Cloud EC, prueba EC, oct HS256)" || ko "JWT_JWKS tiene ${n} claves"
recrear && ok "auth, rest, realtime, storage y functions recreados y healthy" || ko "servicios no healthy tras recrear"

echo "== 1. token ES256 de prueba vs token de una clave ajena =="
TB="$(firmar buena)"; TA="$(firmar ajena)"
rb="$(sonda "${TB}")"; ra="$(sonda "${TA}")"
echo "   buena: ${rb}"; echo "   ajena: ${ra}"
# Auth responde 403 con error_code: user_not_found si la firma pasó y el usuario no
# existe (el sub es inventado), y bad_jwt si la firma no pasó. Storage da 400 a un
# JWT que no verifica; rest, 401.
[[ "${rb}" == *"auth=403/user_not_found"* ]] && ok "auth verifica la firma ES256 de una clave del JWKS (llega a buscar el usuario)" || ko "auth con el ES256 bueno: ${rb%% *}"
[[ "${ra}" == *"/bad_jwt"* ]] && ok "auth rechaza (bad_jwt) un ES256 de una clave que no está en el JWKS" || ko "auth con la clave ajena: ${ra%% *}"
[[ "${rb}" == *"rest=404"* && "${ra}" == *"rest=401"* ]] && ok "rest: 404 (rpc inexistente) con la buena y 401 con la ajena" || ko "rest: buena ${rb##*rest=} · ajena ${ra##*rest=}"
[[ "${rb}" == *"storage=200"* && ( "${ra}" == *"storage=400"* || "${ra}" == *"storage=401"* ) ]] && ok "storage: 200 con la buena y rechaza la ajena" || ko "storage: buena/ajena"
[[ "${rb}" == *"realtime=2"* && ( "${ra}" == *"realtime=401"* || "${ra}" == *"realtime=403"* ) ]] && ok "realtime: acepta la buena y rechaza la ajena" || ko "realtime: buena/ajena"

echo "== 2. la anon key HS256 sigue valiendo =="
rk="$(sonda "${ANON}")"; echo "   anon: ${rk}"
[[ "${rk}" == *"rest=404"* && "${rk}" == *"storage=200"* && "${rk}" == *"realtime=202"* ]] && ok "anon key: rest 404, storage 200 y realtime 202" || ko "anon key: ${rk}"

echo "== 3. Auth firma las sesiones nuevas con HS256 =="
EMAIL="zz-prueba-$(openssl rand -hex 3)@example.test"; PW="Pr-$(openssl rand -hex 8)"
UID_PRUEBA="$(curl -s --max-time 15 -X POST -H "Content-Type: application/json" -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PW}\",\"email_confirm\":true}" "${HOST}/auth/v1/admin/users" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')"
[ -n "${UID_PRUEBA}" ] && ok "usuario de prueba creado por la API admin" || ko "no se pudo crear el usuario de prueba"
TOK="$(curl -s --max-time 15 -X POST -H "Content-Type: application/json" -H "apikey: ${ANON}" -d "{\"email\":\"${EMAIL}\",\"password\":\"${PW}\"}" \
  "${HOST}/auth/v1/token?grant_type=password" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')"
alg="$(cut -d. -f1 <<< "${TOK}" | python3 -c 'import sys,base64,json; s=sys.stdin.read().strip(); print(json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("alg"))' 2>/dev/null)"
[ "${alg}" = HS256 ] && ok "el access token de la sesión nueva va firmado con HS256" || ko "alg del token nuevo: ${alg:-ninguno}"
rn="$(sonda "${TOK}")"; echo "   sesión nueva: ${rn}"
[[ "${rn}" == *"auth=200"* && "${rn}" == *"rest=404"* && "${rn}" == *"storage=200"* && "${rn}" == *"realtime=202"* ]] && ok "la sesión nueva vale en auth (200), rest (404), storage (200) y realtime (202)" || ko "sesión nueva: ${rn}"
curl -s -o /dev/null --max-time 15 -X DELETE -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" "${HOST}/auth/v1/admin/users/${UID_PRUEBA}"; UID_PRUEBA=""
nusers="$(docker exec "${P}-db-1" psql -U supabase_admin -h localhost -d postgres -Atc 'select count(*) from auth.users')"
[ "${nusers}" = 0 ] && ok "usuario de prueba borrado: auth.users = 0" || ko "auth.users = ${nusers}"

echo "== 4. sin la pública de prueba en el JWKS =="
bash "${S}/migrate/jwks-set.sh" --project "${P}" --cloud-ref "${REF}" > /dev/null 2>&1 && recrear >/dev/null 2>&1
n="$(python3 -c "import json; print(len(json.loads('$(val JWT_JWKS)')['keys']))")"
r4="$(sonda "${TB}")"; echo "   buena, ya sin su clave: ${r4}"
[ "${n}" = 2 ] && [[ "${r4}" == *"/bad_jwt"* && "${r4}" == *"rest=401"* && "${r4}" == *"realtime=401"* ]] && ok "JWKS con 2 claves (Cloud + oct) y el ES256 de prueba vuelve a rechazarse en auth, rest y realtime: la verificación sí dependía del JWKS" || ko "sin la clave de prueba: n=${n} ${r4}"
grep -q '"d"' <<< "$(val JWT_JWKS)" && ko "JWT_JWKS trae una clave privada" || ok "JWT_JWKS no trae ninguna clave privada"
echo; echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
