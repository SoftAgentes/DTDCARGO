#!/usr/bin/env bash
# infra/ops/tests/prueba-resetear-base-efimera.sh — reset de la base de prueba contra una base efímera (SDD-0540, Fase 1).
#
# CORRIDA PESADA: arma el paquete con las migraciones del HEAD de este checkout y
# levanta, en una red interna desechable (zz540r-red, sin salida ni puertos):
#   · `supabase/postgres:17.6.1.136` (zz540r-staging-db-1, alias `db`);
#   · GoTrue y storage-api con las MISMAS imágenes de compose.supabase.yml, que
#     crean sus esquemas de `auth` y `storage` antes de las migraciones, como
#     resetear-base-prueba.sh en el servidor (paso d).
# Después corre resetear-base-prueba.sh --solo-base con la semilla. Tarda unos
# minutos (una transacción por migración). Pide turno al Director.
#
#   bash infra/ops/tests/prueba-resetear-base-efimera.sh
#
# Aceptación del §3 · Fase 1:
#   · aplica todas las migraciones y deja el ledger con una fila por archivo
#     (menos las esperas de pendingBelowCutoff, que producción no tiene);
#   · la semilla es idempotente: dos corridas, mismos conteos;
#   · cubre admin, operario VE, operario CN, cliente del Portal y proveedor CN;
#   · GoTrue lista las cuentas sembradas y el admin entra con su clave.
# Además mide lo que la Fase 1 dejó NO VERIFICADO: que `postgres` cree las
# policies de las migraciones sobre el storage.objects de storage-api.
# El HEAD tiene que incluir los archivos de la Fase 1 (si no, --preparar se niega).
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
IMG="supabase/postgres:17.6.1.136"
# Las de compose.supabase.yml (se leen de ahí para no desalinearlas).
IMG_AUTH="$(grep -oE 'image: supabase/gotrue:[^ ]+' "${R}/infra/dtd-cargo/compose.supabase.yml" | cut -d' ' -f2)"
IMG_STORAGE="$(grep -oE 'supabase/storage-api:[^ }]+' "${R}/infra/dtd-cargo/compose.supabase.yml")"
P=zz540r-staging
DB="${P}-db-1"
AUTH="${P}-auth-1"
STORAGE="${P}-storage-1"
RED=zz540r-red
T="$(mktemp -d)"
quitar() {
  docker rm -f -v "${AUTH}" "${STORAGE}" "${DB}" > /dev/null 2>&1
  docker network rm "${RED}" > /dev/null 2>&1
}
trap 'quitar; rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
q() { docker exec -i "${DB}" psql -U postgres -d postgres -X -At -c "$1"; }
command -v docker >/dev/null || { echo "NO DISPONIBLE · docker"; exit 2; }
[[ -n "${IMG_AUTH}" && -n "${IMG_STORAGE}" ]] || { echo "NO DISPONIBLE · no encontré las imágenes de GoTrue y storage-api en compose.supabase.yml"; exit 2; }
SHA="$(git -C "${R}" rev-parse HEAD)"
# shellcheck source=../staging/lib-prueba.sh
die() { echo "$*" >&2; exit 2; }; refuse() { die "$@"; }
source "${S}/staging/lib-prueba.sh"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # $1 role, $2 secreto (mismo formato que new-env.sh)
  local h p s
  h="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$(date +%s)" "$(( $(date +%s) + 3600 ))" | b64url)"
  s="$(printf '%s.%s' "${h}" "${p}" | openssl dgst -sha256 -hmac "$2" -binary | b64url)"
  printf '%s.%s.%s' "${h}" "${p}" "${s}"
}

echo "== paquete de ${SHA:0:12}"
bash "${S}/staging/resetear-base-prueba.sh" --preparar "${T}/paquete" --to-sha "${SHA}" --repo "${R}" > "${T}/prep.log" 2>&1 \
  && ok "$(head -n1 "${T}/prep.log")" || { ko "--preparar"; cat "${T}/prep.log"; exit 1; }

echo "== base efímera ${IMG}, ${IMG_AUTH} y ${IMG_STORAGE} en una red interna"
quitar   # restos de una corrida anterior cortada
PW="$(openssl rand -hex 16)"; JS="$(openssl rand -hex 32)"
SRK="$(jwt service_role "${JS}")"; ANON="$(jwt anon "${JS}")"
docker network create --internal "${RED}" > /dev/null || { echo "NO DISPONIBLE · no se pudo crear la red ${RED}"; exit 2; }
MSYS_NO_PATHCONV=1 docker run -d --name "${DB}" --network "${RED}" --network-alias db \
  -e POSTGRES_PASSWORD="${PW}" -e JWT_SECRET="${JS}" \
  "${IMG}" postgres -c config_file=/etc/postgresql/postgresql.conf -c fsync=off -c full_page_writes=off > /dev/null \
  || { echo "NO DISPONIBLE · no se pudo levantar ${IMG}"; exit 2; }
prueba_esperar_base "${DB}" 240 && ok "base estable" || { ko "la base no arrancó"; exit 1; }
# En el compose estas contraseñas las pone roles.sql al iniciar la base.
docker exec -i "${DB}" psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q > /dev/null <<SQL || { ko "contraseñas de los roles de servicio"; exit 1; }
alter user authenticator with password '${PW}';
alter user supabase_auth_admin with password '${PW}';
alter user supabase_storage_admin with password '${PW}';
SQL
docker run -d --name "${AUTH}" --network "${RED}" \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost:9999 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:${PW}@db:5432/postgres" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_JWT_SECRET="${JS}" -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_DISABLE_SIGNUP=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
  -e GOTRUE_EXTERNAL_PHONE_ENABLED=false \
  --health-cmd "wget --no-verbose --tries=1 --spider http://127.0.0.1:9999/health" --health-interval 3s --health-retries 40 \
  "${IMG_AUTH}" > /dev/null || { ko "no se pudo levantar ${IMG_AUTH}"; exit 1; }
docker run -d --name "${STORAGE}" --network "${RED}" \
  -e ANON_KEY="${ANON}" -e SERVICE_KEY="${SRK}" -e POSTGREST_URL=http://rest:3000 -e AUTH_JWT_SECRET="${JS}" \
  -e DATABASE_URL="postgres://supabase_storage_admin:${PW}@db:5432/postgres" -e STORAGE_PUBLIC_URL=http://localhost:8000 \
  -e REQUEST_ALLOW_X_FORWARDED_PATH=true -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e GLOBAL_S3_BUCKET=stub \
  -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage -e TENANT_ID=stub -e REGION=stub -e ENABLE_IMAGE_TRANSFORMATION=false \
  -e S3_PROTOCOL_ACCESS_KEY_ID="$(openssl rand -hex 16)" -e S3_PROTOCOL_ACCESS_KEY_SECRET="$(openssl rand -hex 32)" \
  --health-cmd "wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/status" --health-interval 3s --health-retries 40 \
  "${IMG_STORAGE}" > /dev/null || { ko "no se pudo levantar ${IMG_STORAGE}"; exit 1; }
for c in "${AUTH}" "${STORAGE}"; do
  prueba_esperar_sano "${c}" 240 && [[ "$(docker inspect -f '{{.State.Health.Status}}' "${c}")" == healthy ]] \
    && ok "${c} sano (creó su esquema)" || { ko "${c} no quedó sano"; docker logs --tail 15 "${c}" 2>&1; exit 1; }
done
[[ "$(q "select is_generated from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'confirmed_at'")" == ALWAYS \
   && "$(q "select tableowner from pg_tables where schemaname = 'storage' and tablename = 'objects'")" == supabase_storage_admin ]] \
  && ok "auth es el de GoTrue (confirmed_at generada) y storage.objects es de storage-api" || ko "los esquemas no son los de GoTrue y storage-api"

PD="${T}/${P}"; mkdir -p "${PD}"
t0="$(date +%s)"
bash "${S}/staging/resetear-base-prueba.sh" --project "${P}" --confirm "${P}" --to-sha "${SHA}" --bundle "${T}/paquete" \
  --project-dir "${PD}" --evidence-dir "${T}/evid" --solo-base --db-container "${DB}" > "${T}/reset.log" 2>&1; rc=$?
echo "   reset en $(( $(date +%s) - t0 )) s"
[[ ${rc} -eq 0 ]] && ok "reset completo (0)" || { ko "reset rc=${rc}"; tail -15 "${T}/reset.log"; }

esperadas="$(cd "${T}/paquete/migraciones" && ls -1 *.sql | sed 's/\.sql$//' | grep -vxF -f "${T}/paquete/PENDIENTES.txt" | LC_ALL=C sort)"
en_ledger="$(q "select name from supabase_migrations.schema_migrations" | LC_ALL=C sort)"
[[ -n "${esperadas}" && "${esperadas}" == "${en_ledger}" ]] && ok "una fila del ledger por archivo ($(wc -l <<< "${esperadas}" | tr -d ' ')), sin las de pendingBelowCutoff" \
  || { ko "ledger distinto de los archivos"; diff <(echo "${esperadas}") <(echo "${en_ledger}") | head -10; }
[[ "$(q "select count(*) from supabase_migrations.schema_migrations group by version having count(*) > 1" | wc -l | tr -d ' ')" == 0 ]] && ok "versiones únicas" || ko "versiones repetidas"
[[ "$(q "select count(*) from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and (d.defaclacl::text ~ 'anon=' or d.defaclacl::text ~ 'authenticated=')")" == 0 ]] \
  && ok "default privileges de postgres en public sin anon ni authenticated (como producción)" || ko "default privileges abiertos"

echo "== semilla: roles e idempotencia"
c1="$(grep -h 'semilla_conteo' "${T}"/evid/reset-*/semilla.out | tr -d ' ')"
[[ "${c1}" == "semilla_conteo|2|1|1|1|2|1|1" ]] && ok "admin, cliente del Portal, 2 operarios (VE y CN), proveedor CN y prealerta: ${c1}" || ko "conteos de la semilla: ${c1:-sin línea}"
[[ "$(q "select string_agg(region::text || ':' || role, ',' order by region) from public.operario_pins where id::text like '05400000-%'")" == "cn:operario,ve:bodeguero" ]] \
  && ok "operario CN y operario VE con PIN" || ko "operarios"
[[ "$(q "select count(*) from public.operario_pins where id::text like '05400000-%' and pin_cifrado is not null and pin_hash like '\$2%'")" == 2 ]] \
  && ok "PIN con bcrypt y cifrado con operario_pin_key" || ko "PIN sin hash o sin cifrar"
bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" --db-container "${DB}" --semilla "${T}/paquete/semilla-prueba.sql" \
  --salida "${T}/semilla2.out" > "${T}/sembrar2.log" 2>&1; rc=$?
c2="$(grep -h 'semilla_conteo' "${T}/semilla2.out" | tr -d ' ')"
[[ ${rc} -eq 0 && "${c2}" == "${c1}" ]] && ok "segunda corrida de la semilla: mismos conteos" || { ko "semilla 2 rc=${rc} (${c2})"; tail -5 "${T}/semilla2.out"; }
[[ "$(q "select count(*) from public.clients where email is not null and email !~* '@([a-z0-9-]+[.])*(test|invalid)\$'")" == 0 ]] \
  && ok "ningún cliente con correo fuera de .test/.invalid (también los demo de la 0006)" || ko "clientes con correos reales"
[[ "$(q "select count(*) from public.clients where phone is not null and phone !~ '^[+]120255501[0-9]{2}\$'")" == 0 ]] \
  && ok "ningún cliente con teléfono fuera de +1 202 555 0100-0199" || ko "clientes con teléfonos fuera del rango"
[[ "$(q "select count(*) from vault.secrets where name in ('kommo_cron_key','kommo_token_dtd_v1','functions_base_url')")" == 0 ]] \
  && ok "Vault sin claves de Kommo ni functions_base_url" || ko "Vault con claves de Kommo"

echo "== GoTrue y storage-api con la base migrada"
n_pol="$(q "select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'")"
[[ "${n_pol:-0}" =~ ^[0-9]+$ && "${n_pol}" -gt 0 ]] \
  && ok "postgres creó ${n_pol} policies de las migraciones sobre el storage.objects de storage-api" || ko "sin policies sobre storage.objects (${n_pol})"
# 127.0.0.1 y no localhost: en estas imágenes localhost no llega al servidor (medido).
# MSYS_NO_PATHCONV: en Git Bash, /tmp/... como argumento se volvería una ruta de Windows.
# Si falla, se muestra solo el error de wget (código HTTP), nunca la respuesta.
usuarios="$(docker exec "${AUTH}" wget -qO- --header "Authorization: Bearer ${SRK}" "http://127.0.0.1:9999/admin/users?per_page=50" 2> "${T}/wget-usuarios.err")"
[[ "${usuarios}" == *admin@prueba.example.test* && "${usuarios}" == *cliente@prueba.example.test* ]] \
  && ok "GoTrue lista las cuentas sembradas (los tokens NULL quedaron en '')" || ko "GoTrue no lista las cuentas: $(tail -n1 "${T}/wget-usuarios.err")"
clave="$(grep -E '^clave_admin=' "${PD}/secretos/cuentas-prueba.txt" | cut -d= -f2)"
printf '{"email":"admin@prueba.example.test","password":"%s"}' "${clave}" | docker exec -i "${AUTH}" sh -c 'cat > /tmp/entrar.json'
unset clave
sesion="$(MSYS_NO_PATHCONV=1 docker exec "${AUTH}" wget -qO- --header 'Content-Type: application/json' --post-file /tmp/entrar.json \
  'http://127.0.0.1:9999/token?grant_type=password' 2> "${T}/wget-sesion.err")"
MSYS_NO_PATHCONV=1 docker exec "${AUTH}" rm -f /tmp/entrar.json
[[ "${sesion}" == *access_token* ]] && ok "el admin sintético entra con su clave por GoTrue" || ko "el admin no pudo entrar por GoTrue: $(tail -n1 "${T}/wget-sesion.err")"
unset sesion

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
