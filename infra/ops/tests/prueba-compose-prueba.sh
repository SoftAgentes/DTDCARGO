#!/usr/bin/env bash
# infra/ops/tests/prueba-compose-prueba.sh — el overlay de prueba con `docker compose config` (SDD-0540, Fase 1).
#
# Copia los tres compose de infra/dtd-cargo a una carpeta temporal con un .env
# FALSO (ningún valor real) y corre `docker compose -p dtd-cargo-staging … config
# --format json`. Solo lee y valida: no levanta nada. Necesita Docker con compose
# v2 y node. Las reglas están en revisar-compose-prueba.mjs.
#
#   bash infra/ops/tests/prueba-compose-prueba.sh
#
# Controles rojos: sin PRUEBA_WEB_USUARIOS el compose se niega a validar, y un
# overlay sin el noindex de la API o con una lista de IP hace fallar al revisor.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
command -v docker >/dev/null && docker compose version >/dev/null 2>&1 || { echo "NO DISPONIBLE · docker compose (esta prueba necesita Docker)"; exit 2; }

D="${T}/zz-staging"; mkdir -p "${D}"
cp "${R}/infra/dtd-cargo/compose.yml" "${R}/infra/dtd-cargo/compose.supabase.yml" "${R}/infra/dtd-cargo/compose.staging.yml" "${D}/"
cat > "${D}/.env" <<'EOF'
APP_ENV=staging
APP_URL=https://prueba.dtdcargo.com
DTD_WEB_HOST=prueba.dtdcargo.com
SUPABASE_PUBLIC_HOST=supabase-prueba.dtdcargo.com
NEXT_PUBLIC_SUPABASE_URL=https://supabase-prueba.dtdcargo.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=falsa
SUPABASE_SERVICE_ROLE_KEY=falsa
CRON_SECRET=falsa
POSTGRES_PASSWORD=falsa
JWT_SECRET=falsa
ANON_KEY=falsa
SERVICE_ROLE_KEY=falsa
SUPABASE_PUBLIC_URL=https://supabase-prueba.dtdcargo.com
API_EXTERNAL_URL=https://supabase-prueba.dtdcargo.com/auth/v1
DASHBOARD_USERNAME=falso
DASHBOARD_PASSWORD=falsa
SITE_URL=https://prueba.dtdcargo.com
REALTIME_DB_ENC_KEY=falsa
SECRET_KEY_BASE=falsa
S3_PROTOCOL_ACCESS_KEY_ID=falsa
S3_PROTOCOL_ACCESS_KEY_SECRET=falsa
PG_META_CRYPTO_KEY=falsa
VAULT_ENC_KEY=falsa
PRUEBA_WEB_USUARIOS='sam:$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0'
EOF
cfg() { ( cd "${D}" && docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml config --format json ); }

cfg > "${T}/config.json" 2> "${T}/config.err"; rc=$?
[[ ${rc} -eq 0 ]] && ok "docker compose config valida con el .env falso" || { ko "config rc=${rc}"; cat "${T}/config.err"; }
node "${S}/tests/revisar-compose-prueba.mjs" < "${T}/config.json" > "${T}/revisar.log"; rc=$?
cat "${T}/revisar.log"
[[ ${rc} -eq 0 ]] && ok "revisor del overlay: $(grep -c '^PASÓ' "${T}/revisar.log") reglas PASÓ" || ko "revisor del overlay: $(grep -c '^FALLÓ' "${T}/revisar.log") reglas FALLÓ"
grep -q 'suma de límites 3072 MiB' "${T}/revisar.log" && ok "la suma es exactamente la del §2.8 (3.072 MiB)" || ko "la suma no es 3.072 MiB"

# Control rojo 1: sin la puerta, el compose no valida.
grep -v '^PRUEBA_WEB_USUARIOS=' "${D}/.env" > "${T}/sin-puerta.env"
( cd "${D}" && docker compose --env-file "${T}/sin-puerta.env" -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml config -q ) > /dev/null 2> "${T}/sin-puerta.err"; rc=$?
[[ ${rc} -ne 0 ]] && grep -q 'PRUEBA_WEB_USUARIOS' "${T}/sin-puerta.err" && ok "sin PRUEBA_WEB_USUARIOS el compose se niega (prueba nunca queda sin clave)" || ko "sin puerta rc=${rc}"

# Control rojo 2: la API sin su noindex.
cp "${D}/compose.staging.yml" "${T}/staging.bak"
sed -i 's/-supabase.middlewares=security-headers@file,${COMPOSE_PROJECT_NAME}-prueba-noindex-api@docker/-supabase.middlewares=security-headers@file/' "${D}/compose.staging.yml"
cfg 2>/dev/null | node "${S}/tests/revisar-compose-prueba.mjs" > "${T}/rojo2.log"; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'FALLÓ · router dtd-cargo-staging-supabase: X-Robots-Tag noindex' "${T}/rojo2.log" && ok "control rojo: la API sin noindex → el revisor falla" || ko "control rojo noindex rc=${rc}"
cp "${T}/staging.bak" "${D}/compose.staging.yml"

# Control rojo 3: un servicio con el límite de producción pasa el tope.
sed -i '0,/memory: 1024m/s//memory: 4g/' "${D}/compose.staging.yml"
cfg 2>/dev/null | node "${S}/tests/revisar-compose-prueba.mjs" > "${T}/rojo3.log"; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'FALLÓ · suma de límites' "${T}/rojo3.log" && ok "control rojo: db con 4g → la suma pasa de 3.072 MiB y falla" || ko "control rojo memoria rc=${rc}"
cp "${T}/staging.bak" "${D}/compose.staging.yml"

# Producción no carga el overlay: sus límites no cambian.
( cd "${D}" && docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml config --format json ) 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);let t=0;for(const v of Object.values(c.services))t+=Number(v.deploy?.resources?.limits?.memory||0);console.log(Math.round(t/1048576))})' > "${T}/prod.txt"
[[ "$(cat "${T}/prod.txt")" == 9728 ]] && ok "producción sin el overlay sigue en 9.728 MiB" || ko "producción suma $(cat "${T}/prod.txt") MiB"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
