#!/usr/bin/env bash
# infra/ops/tests/prueba-scripts-entorno-prueba.sh — pruebas de los scripts del entorno de prueba (SDD-0540, Fase 1).
#
# env-prueba, verificar-aislamiento, clave-web-prueba, sembrar-prueba,
# resetear-base-prueba, desplegar-prueba y crear-prueba, con dobles de docker,
# curl y getent (dobles-prueba.sh): ningún contenedor, red ni servidor real. Corre
# en Linux o en Git Bash con bash 4+, openssl, git y node (los de un checkout del
# repo). Proyecto inventado `zz540-staging` en una carpeta temporal.
#
#   bash infra/ops/tests/prueba-scripts-entorno-prueba.sh
#
# Termina con «RESULTADO: N PASÓ · M FALLÓ» y sale 1 si algo falló. Los controles
# rojos (una clave de producción copiada, una integración encendida, una imagen
# sin prefijo, una migración que falla…) tienen que FALLAR en el script probado.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
# shellcheck source=dobles-prueba.sh
source "${S}/tests/dobles-prueba.sh"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
dobles_instalar "${T}/doble"
pass=0; fail=0; nv=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
# NTFS (Git Bash en Windows) no guarda los permisos POSIX: ahí el 600 no se puede
# comprobar y sale NO VERIFICADO, nunca PASÓ. En Linux (CI, VPS) se comprueba.
touch "${T}/modo"; chmod 600 "${T}/modo"
[[ "$(stat -c %a "${T}/modo")" == 600 ]] && FS_MODOS=1 || FS_MODOS=0
perm600() { # $1 archivo, $2 descripción
  if (( ! FS_MODOS )); then echo "NO VERIFICADO · $2 (este sistema de archivos no guarda permisos)"; nv=$((nv + 1)); return; fi
  [[ "$(stat -c %a "$1")" == 600 ]] && ok "$2" || ko "$2: permisos $(stat -c %a "$1")"
}
val() { grep -E "^$2=" "$1" | tail -n1 | cut -d= -f2-; }
huella() { sha256sum < "$1" | cut -c1-64; }

SHA_A="0123456789abcdef0123456789abcdef01234567"
SHA_B="89abcdef0123456789abcdef0123456789abcdef"
IMG_A="ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-${SHA_A}"
IMG_B="ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-${SHA_B}"
P=zz540-staging
PD="${T}/srv/${P}"
EV="${T}/evid"
mkdir -p "${PD}" "${EV}" "${T}/prod"
cp "${R}/infra/dtd-cargo/.env.example" "${PD}/.env.example"

echo "== 1. env-prueba.sh: .env de prueba sin vacías ni integraciones"
bash "${S}/staging/env-prueba.sh" --example "${PD}/.env.example" --out "${PD}/.env" --image "${IMG_A}" > "${T}/envp.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && ok "env-prueba sale 0" || { ko "env-prueba rc=${rc}"; cat "${T}/envp.log"; }
[[ "$(val "${PD}/.env" APP_ENV)" == staging && "$(val "${PD}/.env" DISABLE_SIGNUP)" == true && "$(val "${PD}/.env" ENABLE_ANONYMOUS_USERS)" == false ]] \
  && ok "APP_ENV=staging, DISABLE_SIGNUP=true y sin anónimos" || ko "entorno o registro mal"
[[ "$(val "${PD}/.env" DTD_WEB_HOST)" == prueba.dtdcargo.com && "$(val "${PD}/.env" SUPABASE_PUBLIC_HOST)" == supabase-prueba.dtdcargo.com \
   && "$(val "${PD}/.env" NEXT_PUBLIC_SUPABASE_URL)" == https://supabase-prueba.dtdcargo.com && "$(val "${PD}/.env" API_EXTERNAL_URL)" == https://supabase-prueba.dtdcargo.com/auth/v1 ]] \
  && ok "hosts de prueba (D3)" || ko "hosts de prueba"
[[ "$(val "${PD}/.env" DTD_DATA_DIR)" == "$(cd "${PD}" && pwd)/data" ]] && ok "DTD_DATA_DIR dentro de la carpeta de prueba" || ko "DTD_DATA_DIR=$(val "${PD}/.env" DTD_DATA_DIR)"
[[ "$(val "${PD}/.env" DTD_WEB_IMAGE)" == "${IMG_A}" && "$(val "${PD}/.env" PRUEBA_WEB_USUARIOS)" == "pendiente:sin-clave" ]] \
  && ok "imagen de prueba y puerta cerrada con el marcador" || ko "imagen o puerta"
n_vacias="$(grep -cE "^[A-Z_][A-Z0-9_]*=(''|\"\")?[[:space:]]*$" "${PD}/.env")"
n_marcas="$(grep -cE '^[A-Z_][A-Z0-9_]*=.*<[^>]+>' "${PD}/.env")"
[[ "${n_vacias}" == 0 && "${n_marcas}" == 0 ]] && ok "0 líneas X= vacías y 0 marcas <...>" || ko "${n_vacias} vacías y ${n_marcas} marcas"
mapfile -t integ < <(awk '/^# ── Integraciones de la app/ { on = 1; next } on && /^#{4,}/ { on = 0 } on && /^[A-Z_][A-Z0-9_]*=/ { split($0, a, "="); print a[1] }' "${PD}/.env.example")
presentes=0; for k in "${integ[@]}" SMTP_HOST SMTP_USER SMTP_PASS KOMMO_WEBHOOK_SECRET KOMMO_PUSH_DRY_RUN NEXT_PUBLIC_VAPID_PUBLIC_KEY NEXT_PUBLIC_TELEGRAM_BOT_USERNAME STORAGE_S3_BUCKET; do
  grep -qE "^${k}=" "${PD}/.env" && presentes=$((presentes + 1))
done
(( ${#integ[@]} > 40 && presentes == 0 )) && ok "las ${#integ[@]} claves del bloque de integraciones y las extra no existen en el .env" || ko "${presentes} integraciones presentes (bloque de ${#integ[@]})"
[[ "$(val "${PD}/.env" POSTGRES_PASSWORD)" =~ ^[0-9a-f]{64}$ && "$(val "${PD}/.env" ANON_KEY)" == eyJ* && "$(val "${PD}/.env" NEXT_PUBLIC_SUPABASE_ANON_KEY)" == "$(val "${PD}/.env" ANON_KEY)" ]] \
  && ok "secretos generados en el servidor y anon coherente" || ko "secretos generados"
perm600 "${PD}/.env" ".env en 600"
grep -qF -- "$(val "${PD}/.env" POSTGRES_PASSWORD)" "${T}/envp.log" && ko "la salida muestra un secreto" || ok "la salida no muestra secretos"
antes="$(huella "${PD}/.env")"
bash "${S}/staging/env-prueba.sh" --example "${PD}/.env.example" --out "${PD}/.env" --image "${IMG_A}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(huella "${PD}/.env")" == "${antes}" ]] && ok "sin --force no pisa un .env (3)" || ko "pisó el .env rc=${rc}"
bash "${S}/staging/env-prueba.sh" --example "${PD}/.env.example" --out "${T}/otro.env" --image "ghcr.io/hailuwaycom-sketch/dtdcargo:sha-${SHA_A}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 && ! -e "${T}/otro.env" ]] && ok "imagen sha-* (de producción): rechaza (2)" || ko "aceptó una imagen sha-* rc=${rc}"

echo "== 2. verificar-aislamiento.sh: limpio da 0, una clave de producción copiada falla"
cat > "${T}/prod/.env" <<EOF
APP_ENV=production
APP_URL=https://dtdcargo.com
DTD_WEB_HOST=dtdcargo.com
SUPABASE_PUBLIC_HOST=supabase.dtdcargo.com
NEXT_PUBLIC_SITE_URL=https://dtdcargo.com
NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com
SUPABASE_PUBLIC_URL=https://supabase.dtdcargo.com
API_EXTERNAL_URL=https://supabase.dtdcargo.com/auth/v1
SITE_URL=https://dtdcargo.com
NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token
DTD_DATA_DIR=/srv/dtd-cargo/data
POSTGRES_HOST=db
JWT_EXPIRY=3600
MAILER_TEMPLATES_MAGIC_LINK=http://auth-templates/magic-link.html
POSTGRES_PASSWORD='$(openssl rand -hex 32)'
JWT_SECRET='$(openssl rand -hex 32)'
SERVICE_ROLE_KEY='eyJprod.$(openssl rand -hex 40)'
SUPABASE_SERVICE_ROLE_KEY='eyJprod.$(openssl rand -hex 40)'
CRON_SECRET='$(openssl rand -hex 32)'
RESEND_API_KEY='re_$(openssl rand -hex 16)'
TELEGRAM_BOT_TOKEN='$(openssl rand -hex 20)'
VAPID_PRIVATE_KEY='$(openssl rand -hex 22)'
NEXT_PUBLIC_VAPID_PUBLIC_KEY='$(openssl rand -hex 32)'
EOF
cp "${PD}/.env" "${T}/limpio.env"
# Puerta con un bcrypt de formato válido (lo pone clave-web-prueba.sh en el servidor).
fijar() { # $1 archivo, $2 línea completa CLAVE=valor
  local k="${2%%=*}"; grep -vE "^${k}=" "$1" > "$1.t"; printf '%s\n' "$2" >> "$1.t"; mv "$1.t" "$1"
}
fijar "${T}/limpio.env" "PRUEBA_WEB_USUARIOS='sam:\$2a\$10\$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0'"
va() { bash "${S}/staging/verificar-aislamiento.sh" --env "$1" --prod-env "${T}/prod/.env" --project "${P}" --example "${PD}/.env.example" "${@:2}"; }
va "${T}/limpio.env" > "${T}/va-limpio.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && grep -q '· 0 FALLÓ ·' "${T}/va-limpio.log" && ok "limpio → 0 ($(grep RESULTADO "${T}/va-limpio.log"))" || { ko "limpio rc=${rc}"; grep FALLÓ "${T}/va-limpio.log"; }
grep -q 'AVISO · bundle con Google Analytics' "${T}/va-limpio.log" && ok "GA y Ads en el bundle salen como AVISO (Fase 2)" || ko "sin aviso de GA"
cp "${T}/limpio.env" "${T}/rojo.env"; fijar "${T}/rojo.env" "SUPABASE_SERVICE_ROLE_KEY=$(val "${T}/prod/.env" SERVICE_ROLE_KEY)"
va "${T}/rojo.env" > "${T}/va-rojo.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'FALLÓ · valores iguales a un secreto de producción (por sha256): SUPABASE_SERVICE_ROLE_KEY' "${T}/va-rojo.log" \
  && ok "control rojo: la service_role de producción copiada → falla y nombra la variable" || { ko "control rojo rc=${rc}"; cat "${T}/va-rojo.log"; }
cp "${T}/limpio.env" "${T}/rojo2.env"; printf "OTRA_COSA='%s'\n" "$(val "${T}/prod/.env" JWT_SECRET | tr -d "'")" >> "${T}/rojo2.env"
va "${T}/rojo2.env" > "${T}/va-rojo2.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'OTRA_COSA' "${T}/va-rojo2.log" && ok "un secreto de producción con otro nombre → falla" || ko "secreto con otro nombre rc=${rc}"
cp "${T}/limpio.env" "${T}/rojo3.env"; printf 'RESEND_API_KEY=re_prueba_falsa_123\n' >> "${T}/rojo3.env"
va "${T}/rojo3.env" > "${T}/va-rojo3.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'integraciones con valor en prueba: RESEND_API_KEY' "${T}/va-rojo3.log" && ok "una integración encendida → falla" || ko "integración rc=${rc}"
va "${T}/rojo3.env" --permitir RESEND_API_KEY > "${T}/va-perm.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && grep -q 'AVISO · RESEND_API_KEY tiene valor y está permitida' "${T}/va-perm.log" && ok "con --permitir pasa como AVISO" || ko "--permitir rc=${rc}"
cp "${T}/limpio.env" "${T}/rojo4.env"; printf 'IDENTITY_CNE_PROVIDER=\n' >> "${T}/rojo4.env"
va "${T}/rojo4.env" > "${T}/va-rojo4.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'líneas X= vacías' "${T}/va-rojo4.log" && ok "una línea X= vacía → falla" || ko "vacía rc=${rc}"
cp "${T}/limpio.env" "${T}/rojo5.env"; fijar "${T}/rojo5.env" "NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com"
va "${T}/rojo5.env" > "${T}/va-rojo5.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'NEXT_PUBLIC_SUPABASE_URL es igual al de producción' "${T}/va-rojo5.log" && grep -q 'valores que apuntan a producción' "${T}/va-rojo5.log" \
  && ok "una URL de producción → falla" || ko "URL de producción rc=${rc}"
cp "${T}/limpio.env" "${T}/rojo6.env"; fijar "${T}/rojo6.env" "APP_ENV=production"
va "${T}/rojo6.env" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && ok "APP_ENV=production → falla" || ko "APP_ENV rc=${rc}"
va "${T}/limpio.env" --image "ghcr.io/hailuwaycom-sketch/dtdcargo:sha-${SHA_A}" > "${T}/va-img.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'la imagen no es' "${T}/va-img.log" && ok "imagen sha-* → falla" || ko "imagen sha-* rc=${rc}"
DOBLE_VAULT=1 va "${T}/limpio.env" > "${T}/va-vault.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'Vault de prueba: 1' "${T}/va-vault.log" && ok "Vault con una clave de Kommo → falla" || ko "Vault rc=${rc}"
DOBLE_BUNDLE="3 2 0 0 0 1 1" va "${T}/limpio.env" > "${T}/va-bundle.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'bundle: 2 archivos con el host de producción' "${T}/va-bundle.log" && ok "bundle con el host de producción → falla" || ko "bundle rc=${rc}"
DOBLE_BUNDLE="3 0 0 2 1 0 1" va "${T}/limpio.env" > "${T}/va-anon.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'bundle sin la anon de este .env' "${T}/va-anon.log" && ok "imagen construida con otra anon → falla" || ko "anon rc=${rc}"
DOBLE_BUNDLE="3 0 0 2 1 1 0" va "${T}/limpio.env" > "${T}/va-cookie.log" 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && grep -q 'bundle sin la cookie de este .env' "${T}/va-cookie.log" && ok "imagen construida con otra cookie → falla" || ko "cookie rc=${rc}"
grep -qF -- "$(val "${T}/limpio.env" NEXT_PUBLIC_SUPABASE_ANON_KEY)" "${DOBLE_DIR}/docker.log" && ko "la anon viajó en los argumentos de docker run" || ok "la anon viaja a docker run por entorno"
va "${T}/limpio.env" --exigir-sin-ga > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && ok "--exigir-sin-ga con GA en el bundle → falla" || ko "--exigir-sin-ga rc=${rc}"
va "${PD}/.env" --sin-base > "${T}/va-marcador.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && grep -q 'AVISO · puerta del web cerrada con el marcador' "${T}/va-marcador.log" && ok "--sin-base: el marcador de la puerta es AVISO" || ko "marcador --sin-base rc=${rc}"
va "${PD}/.env" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 1 ]] && ok "con base: el marcador de la puerta → falla" || ko "marcador con base rc=${rc}"
touch "${DOBLE_DIR}/caido-${P}-db-1"; va "${T}/limpio.env" > "${T}/va-caido.log" 2>&1; rc=$?; rm -f "${DOBLE_DIR}/caido-${P}-db-1"
[[ ${rc} -eq 1 ]] && grep -q 'no está corriendo' "${T}/va-caido.log" && ok "sin la base corriendo no da Vault por bueno" || ko "base caída rc=${rc}"
bash "${S}/staging/verificar-aislamiento.sh" --env "${T}/limpio.env" --prod-env "${T}/prod/.env" --project dtd-cargo > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "--project dtd-cargo: rechaza (2)" || ko "--project dtd-cargo rc=${rc}"
filtro="$(mktemp)"
for f in "${T}/prod/.env" "${T}/limpio.env"; do
  grep -E '^[A-Z_][A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)=' "${f}" | cut -d= -f2- | tr -d "'" | awk 'length($0) >= 8' >> "${filtro}"
done
grep -qF -f "${filtro}" "${T}"/va-*.log && ko "una salida de verificar-aislamiento muestra un valor" || ok "ninguna salida muestra un valor ($(wc -l < "${filtro}" | tr -d ' ') secretos buscados)"

echo "== 3. clave-web-prueba.sh: bcrypt en la base de prueba, clave solo en secretos/"
dobles_limpiar_log
bash "${S}/staging/clave-web-prueba.sh" --project dtd-cargo > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(dobles_llamadas)" == 0 ]] && ok "--project dtd-cargo: rechaza (3) sin llamar a docker" || ko "clave-web dtd-cargo rc=${rc}"
bash "${S}/staging/clave-web-prueba.sh" --project "${P}" --project-dir "${PD}" > "${T}/cw.log" 2>&1; rc=$?
cw="$(grep '^sam:' "${PD}/secretos/clave-web.txt" | cut -d: -f2)"
[[ ${rc} -eq 0 && "$(val "${PD}/.env" PRUEBA_WEB_USUARIOS)" == "'sam:\$2a\$10\$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0'" ]] \
  && ok "PRUEBA_WEB_USUARIOS con el bcrypt, entre comillas simples" || { ko "clave-web rc=${rc}"; cat "${T}/cw.log"; }
[[ "${cw}" =~ ^[0-9a-f]{32}$ ]] && ok "clave de 32 hex en secretos/clave-web.txt" || ko "archivo de la clave"
perm600 "${PD}/secretos/clave-web.txt" "secretos/clave-web.txt en 600"
grep -qF -- "${cw}" "${T}/cw.log" "${DOBLE_DIR}/docker.log" && ko "la clave aparece en la salida o en los argumentos de docker" || ok "la clave no aparece en la salida ni en los argumentos"
grep -qF "\\set clave '${cw}'" "${DOBLE_DIR}"/stdin-*.sql && ok "la clave viaja a psql por la entrada estándar" || ko "la clave no llegó por stdin"

echo "== 4. sembrar-prueba.sh: credenciales nacen una vez y se reusan"
dobles_limpiar_log
bash "${S}/staging/sembrar-prueba.sh" --project dtd-cargo > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(dobles_llamadas)" == 0 ]] && ok "--project dtd-cargo: rechaza (3)" || ko "sembrar dtd-cargo rc=${rc}"
bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" --dry-run > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(dobles_llamadas)" == 0 && ! -e "${PD}/secretos/cuentas-prueba.txt" ]] && ok "--dry-run no toca nada" || ko "sembrar dry-run rc=${rc}"
bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" --salida "${T}/sem1.out" > "${T}/sem1.log" 2>&1; rc=$?
cred="${PD}/secretos/cuentas-prueba.txt"
ca="$(val "${cred}" clave_admin)"; pv="$(val "${cred}" pin_ve)"; pc="$(val "${cred}" pin_cn)"
[[ ${rc} -eq 0 && "${ca}" =~ ^[0-9a-f]{24}$ && "${pv}" =~ ^[0-9]{4}$ && "${pc}" =~ ^[0-9]{4}$ && "${pv}" != "${pc}" ]] \
  && ok "cuentas-prueba.txt: clave de 24 hex y dos PIN distintos" || { ko "sembrar rc=${rc}"; cat "${T}/sem1.log"; }
perm600 "${cred}" "cuentas-prueba.txt en 600"
debiles=" 0000 1111 2222 3333 4444 5555 6666 7777 8888 9999 1234 4321 0123 0987 1212 2121 0101 1010 1313 6969 2580 1357 2468 1379 "
[[ "${debiles}" != *" ${pv} "* && "${debiles}" != *" ${pc} "* ]] && ok "los PIN no están en la lista negra de validate_operario_pin_format" || ko "PIN débil"
s1="$(ls "${DOBLE_DIR}"/stdin-*.sql | tail -n1)"
[[ "$(sed -n 1p "${s1}")" == '\set ON_ERROR_STOP on' && "$(sed -n 2p "${s1}")" == "\\set clave_admin '${ca}'" ]] \
  && grep -q '^\\set ON_ERROR_STOP on$' "${s1}" && grep -q 'semilla_conteo' "${s1}" && ok "psql recibe \\set de las claves y después la semilla" || ko "stdin de la semilla"
bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" > "${T}/sem2.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(val "${cred}" clave_admin)" == "${ca}" && "$(val "${cred}" pin_ve)" == "${pv}" && "$(val "${cred}" pin_cn)" == "${pc}" ]] \
  && grep -q 'claves de antes' "${T}/sem2.log" && ok "segunda corrida: mismas cuentas, mismas claves" || ko "segunda corrida rc=${rc}"
grep -qE -- "${ca}" "${T}/sem1.log" "${T}/sem2.log" "${DOBLE_DIR}/docker.log" && ko "la clave del admin aparece en la salida o en los argumentos" || ok "la clave del admin no aparece en la salida ni en los argumentos"
DOBLE_FALLA="semilla_conteo" bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 5 ]] && ok "si psql falla, sembrar sale 5" || ko "falla de la semilla rc=${rc}"

echo "== 5. resetear-base-prueba.sh: paquete del SHA, guardas, envoltorio y ledger"
FX="${T}/repo"; mkdir -p "${FX}/supabase/migrations" "${FX}/scripts" "${FX}/infra/ops/staging"
printf 'create table public.zz_a (id int);\n' > "${FX}/supabase/migrations/0001_zz_a.sql"
printf -- '-- repara el ledger de producción\nselect 1;\n' > "${FX}/supabase/migrations/0002_zz_solo_ledger.sql"
printf 'create table public.zz_pendiente (id int);\n' > "${FX}/supabase/migrations/0003_zz_pendiente.sql"
printf 'create function public.zz_b() returns int language sql as $$ select 1 $$;\n' > "${FX}/supabase/migrations/0004_zz_b.sql"
printf 'const LEDGER_ONLY = new Set([\n  "0002_zz_solo_ledger.sql",\n]);\n' > "${FX}/scripts/check-schema-rebuild.mjs"
printf '{ "cutoff": 0, "pendingBelowCutoff": { "0003_zz_pendiente": "espera de prueba" } }\n' > "${FX}/supabase/migrations-baseline.json"
cp "${S}/staging/plataforma-prueba.sql" "${S}/staging/semilla-prueba.sql" "${FX}/infra/ops/staging/"
git -C "${FX}" init -q && git -C "${FX}" add -A && git -C "${FX}" -c user.email=prueba@example.test -c user.name=prueba commit -qm fixture
FXSHA="$(git -C "${FX}" rev-parse HEAD)"
B="${T}/paquete"
bash "${S}/staging/resetear-base-prueba.sh" --preparar "${B}" --to-sha "${FXSHA}" --repo "${FX}" > "${T}/prep.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(ls "${B}/migraciones" | wc -l | tr -d ' ')" == 4 && "$(cat "${B}/SOLO-LEDGER.txt")" == 0002_zz_solo_ledger.sql && "$(cat "${B}/PENDIENTES.txt")" == 0003_zz_pendiente ]] \
  && grep -q "^sha=${FXSHA}$" "${B}/MANIFIESTO.txt" && ok "--preparar: 4 migraciones, 1 sólo-ledger, 1 pendiente, MANIFIESTO del SHA" || { ko "--preparar rc=${rc}"; cat "${T}/prep.log"; }
cmp -s "${B}/migraciones/0004_zz_b.sql" "${FX}/supabase/migrations/0004_zz_b.sql" && ok "las migraciones del paquete son los blobs exactos" || ko "blob distinto"
dobles_limpiar_log
rb() { bash "${S}/staging/resetear-base-prueba.sh" --to-sha "${FXSHA}" --bundle "${B}" --project-dir "${PD}" --evidence-dir "${EV}" "$@"; }
rb --project dtd-cargo --confirm dtd-cargo > /dev/null 2>&1; r1=$?
rb --project zz540 --confirm zz540 > /dev/null 2>&1; r2=$?
rb --project "${P}" --confirm otro-staging > /dev/null 2>&1; r3=$?
rb --project "${P}" --confirm "${P}" --db-container dtd-cargo-db-1 > /dev/null 2>&1; r4=$?
[[ ${r1} -eq 3 && ${r2} -eq 3 && ${r3} -eq 3 && ${r4} -eq 3 && "$(dobles_llamadas)" == 0 ]] \
  && ok "rechaza dtd-cargo, un proyecto sin -staging, --confirm distinto y el contenedor de producción (3), sin llamar a docker" || ko "guardas del reset ${r1} ${r2} ${r3} ${r4}"
rb --project "${P}" --confirm "${P}" --dry-run > "${T}/rb-dry.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(dobles_llamadas)" == 0 ]] && grep -q '2 migraciones a aplicar, 1 sólo-ledger, 1 pendientes' "${T}/rb-dry.log" && ok "--dry-run no toca nada y cuenta lo que haría" || { ko "reset dry-run rc=${rc}"; cat "${T}/rb-dry.log"; }
cp -r "${B}" "${T}/paquete-roto"; printf -- '-- cambiado\n' >> "${T}/paquete-roto/migraciones/0001_zz_a.sql"
bash "${S}/staging/resetear-base-prueba.sh" --to-sha "${FXSHA}" --bundle "${T}/paquete-roto" --project "${P}" --confirm "${P}" --project-dir "${PD}" --dry-run > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 4 ]] && ok "paquete alterado: integridad (4)" || ko "paquete alterado rc=${rc}"
bash "${S}/staging/resetear-base-prueba.sh" --to-sha "${SHA_A}" --bundle "${B}" --project "${P}" --confirm "${P}" --project-dir "${PD}" --dry-run > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 4 ]] && ok "paquete de otro SHA: integridad (4)" || ko "otro SHA rc=${rc}"
rb --project "${P}" --confirm "${P}" > "${T}/rb.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(cat "${DOBLE_DIR}/ledger")" == 3 ]] && grep -q 'PASÓ ledger: 3 filas = 2 aplicadas + 1 sólo-ledger' "${T}/rb.log" \
  && ok "reset con dobles: 3 filas en el ledger (2 aplicadas + 1 sólo-ledger)" || { ko "reset rc=${rc}"; cat "${T}/rb.log"; }
grep -q "ps -aq --filter label=com.docker.compose.project=${P}" "${DOBLE_DIR}/docker.log" && grep -q '^compose ' "${DOBLE_DIR}/docker.log" \
  && ok "pasó por destroy-staging y por compose del proyecto de prueba" || ko "no pasó por destroy-staging o compose"
grep -l 'zz_pendiente' "${DOBLE_DIR}"/stdin-*.sql > /dev/null 2>&1 && ko "la pendiente llegó a psql" || ok "la pendiente (pendingBelowCutoff) no se aplica"
sb="$(grep -l 'create function public.zz_b' "${DOBLE_DIR}"/stdin-*.sql | head -n1)"
[[ -n "${sb}" && "$(sed -n 1p "${sb}")" == '\set ON_ERROR_STOP on' && "$(sed -n 2p "${sb}")" == 'begin;' && "$(tail -n1 "${sb}")" == 'commit;' \
   && "$(grep -c 'create function public.zz_b' "${sb}")" == 2 ]] && grep -q "servidor-propio:psql:prueba:reset@${FXSHA:0:12}'" "${sb}" \
  && ok "envoltorio: ON_ERROR_STOP, begin, texto, insert con el texto exacto, commit" || ko "envoltorio de 0004"
ss="$(grep -l '0002_zz_solo_ledger' "${DOBLE_DIR}"/stdin-*.sql | head -n1)"
[[ -n "${ss}" && "$(grep -c 'repara el ledger' "${ss}")" == 1 ]] && grep -q ':solo-ledger' "${ss}" && ok "la sólo-ledger registra su fila sin ejecutarse" || ko "sólo-ledger"
mapfile -t vers < <(grep -ho 'to_timestamp([0-9]*)' "${DOBLE_DIR}"/stdin-*.sql | tr -dc '0-9\n')
[[ ${#vers[@]} == 3 && ${vers[0]} -lt ${vers[1]} && ${vers[1]} -lt ${vers[2]} && ${vers[2]} -le $(date -u +%s) ]] \
  && ok "versiones seguidas, la última antes de la hora del reset" || ko "versiones ${vers[*]}"
dobles_limpiar_log
DOBLE_FALLA="create function public.zz_b" rb --project "${P}" --confirm "${P}" > "${T}/rb-falla.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && grep -q 'FALLÓ 0004_zz_b' "${T}/rb-falla.log" && ls "${EV}"/reset-"${P}"-*/falla-0004_zz_b.err > /dev/null 2>&1 \
  && ok "una migración que falla: sale 6 y deja su error en la evidencia" || { ko "falla de migración rc=${rc}"; cat "${T}/rb-falla.log"; }

echo "== 6. desplegar-prueba.sh: guardas, dry-run y despliegue con dobles"
dobles_limpiar_log
dp() { bash "${S}/staging/desplegar-prueba.sh" --project-dir "${PD}" --prod-env "${T}/prod/.env" --evidence-dir "${EV}" "$@"; }
dp --project dtd-cargo --sha "${SHA_B}" --image "${IMG_B}" > /dev/null 2>&1; r1=$?
dp --project zz540 --sha "${SHA_B}" --image "${IMG_B}" > /dev/null 2>&1; r2=$?
dp --project "${P}" --sha "${SHA_B}" --image "ghcr.io/hailuwaycom-sketch/dtdcargo:sha-${SHA_B}" > /dev/null 2>&1; r3=$?
dp --project "${P}" --sha "${SHA_B}" --image "${IMG_A}" > /dev/null 2>&1; r4=$?
dp --project "${P}" --sha "${SHA_B}" --image "ghcr.io/hailuwaycom-sketch/dtdcargo:main" > /dev/null 2>&1; r5=$?
[[ ${r1} -eq 3 && ${r2} -eq 3 && ${r3} -eq 3 && ${r4} -eq 3 && ${r5} -eq 3 && "$(dobles_llamadas)" == 0 ]] \
  && ok "rechaza dtd-cargo, sin -staging, sha-*, la imagen de otro SHA y :main (3), sin llamar a docker" || ko "guardas de desplegar ${r1} ${r2} ${r3} ${r4} ${r5}"
antes="$(huella "${PD}/.env")"
dp --project "${P}" --sha "${SHA_B}" --image "${IMG_B}" --dry-run > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(dobles_llamadas)" == 0 && "$(huella "${PD}/.env")" == "${antes}" ]] && ok "--dry-run no toca nada" || ko "desplegar dry-run rc=${rc}"
# El .env del servidor ya tiene la puerta (paso 3); el de producción es el falso.
DOBLE_VAULT=1 dp --project "${P}" --sha "${SHA_B}" --image "${IMG_B}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 4 && "$(huella "${PD}/.env")" == "${antes}" ]] && ok "aislamiento que falla: sale 4 sin cambiar el .env" || ko "aislamiento en desplegar rc=${rc}"
dobles_limpiar_log
dp --project "${P}" --sha "${SHA_B}" --image "${IMG_B}" --pr 999 --quien prueba > "${T}/dp.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(val "${PD}/.env" DTD_WEB_IMAGE)" == "${IMG_B}" ]] && ls "${PD}"/.env.bak-desplegar-* > /dev/null 2>&1 \
  && grep -q "SHA: ${SHA_B}" "${PD}/EN-PRUEBA.txt" && grep -q 'PR: 999' "${PD}/EN-PRUEBA.txt" \
  && ok "despliegue: imagen nueva en el .env, respaldo, EN-PRUEBA.txt" || { ko "desplegar rc=${rc}"; cat "${T}/dp.log"; }
grep -q -- "compose -p ${P} -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps web" "${DOBLE_DIR}/docker.log" \
  && ok "compose con los tres archivos y --no-deps web" || ko "comando de compose"
grep -q 'PASÓ  · prueba.dtdcargo.com/ sin clave → 401' "${T}/dp.log" && grep -q 'PASÓ  · supabase-prueba.dtdcargo.com manda X-Robots-Tag: noindex' "${T}/dp.log" \
  && ok "smoke de la puerta: 401 sin clave, 200 con clave, noindex en los dos hosts" || ko "smoke de la puerta"
grep -qF -- "${cw}" "${DOBLE_DIR}/curl.log" && ko "la clave del web viajó en los argumentos de curl" || ok "la clave del web no viaja en los argumentos de curl"
grep -qF "user = \"sam:${cw}\"" "${DOBLE_DIR}/curl-config-visto" && ok "la clave viaja a curl en un archivo de configuración" || ko "archivo de configuración de curl"
ls "${EV}"/prueba-desplegar-*.txt > /dev/null 2>&1 && ok "evidencia prueba-desplegar-<ts>.txt" || ko "sin evidencia"
DOBLE_CURL_SIN=200 dp --project "${P}" --sha "${SHA_B}" --image "${IMG_B}" > "${T}/dp-abierto.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && grep -q 'Para volver' "${T}/dp-abierto.log" && ok "web abierto sin clave: el smoke falla (6) y dice cómo volver" || ko "smoke abierto rc=${rc}"

echo "== 7. crear-prueba.sh: guardas, dry-run y orquestación con dobles"
dobles_limpiar_log
PN="${T}/srv/zz541-staging"; mkdir -p "${PN}/supabase/volumes/db" "${PN}/functions/main"
for f in compose.yml compose.supabase.yml compose.staging.yml .env.example; do cp "${R}/infra/dtd-cargo/${f}" "${PN}/${f}"; done
touch "${PN}/supabase/volumes/db/roles.sql" "${PN}/functions/main/index.ts"
cp -r "${B}" "${T}/paquete2"
cr() { bash "${S}/staging/crear-prueba.sh" --sha "${FXSHA}" --bundle "${T}/paquete2" --project-dir "${PN}" --prod-env "${T}/prod/.env" --evidence-dir "${EV}" "$@"; }
cr --project dtd-cargo --confirm dtd-cargo > /dev/null 2>&1; r1=$?
cr --project zz541 --confirm zz541 > /dev/null 2>&1; r2=$?
cr --project zz541-staging --confirm zz540-staging > /dev/null 2>&1; r3=$?
[[ ${r1} -eq 3 && ${r2} -eq 3 && ${r3} -eq 3 && "$(dobles_llamadas)" == 0 ]] && ok "rechaza dtd-cargo, sin -staging y --confirm distinto (3)" || ko "guardas de crear ${r1} ${r2} ${r3}"
cr --project zz541-staging --confirm zz541-staging --dry-run > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(dobles_llamadas)" == 0 && ! -e "${PN}/.env" ]] && ok "--dry-run no toca nada (ni crea el .env)" || ko "crear dry-run rc=${rc}"
cr --project zz541-staging --confirm zz541-staging --bundle "${T}/no-existe" > "${T}/cr0.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && -f "${PN}/.env" && "$(dobles_llamadas)" == 0 ]] && grep -q 'PRUEBA_SUPABASE_ANON_KEY' "${T}/cr0.log" \
  && ok "primera corrida: crea el .env y para hasta que la imagen tenga su anon (sin paquete ni docker)" || { ko "crear primera corrida rc=${rc}"; cat "${T}/cr0.log"; }
cr --project zz541-staging --confirm zz541-staging --bundle "${T}/no-existe" > "${T}/cr-sin-paquete.log" 2>&1; rc=$?
[[ ${rc} -eq 2 && "$(dobles_llamadas)" == 0 ]] && grep -q 'FALTA el paquete' "${T}/cr-sin-paquete.log" && ok "segunda corrida sin paquete: para (2) antes de tocar docker" || ko "sin paquete rc=${rc}"
cr --project zz541-staging --confirm zz541-staging > "${T}/cr.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && -f "${PN}/.env" && -f "${PN}/secretos/clave-web.txt" && -f "${PN}/secretos/cuentas-prueba.txt" ]] && grep -q 'base lista' "${T}/cr.log" \
  && ! grep -q 'up -d api-gw' "${DOBLE_DIR}/docker.log" && ok "sin --con-dns: .env, base, semilla y clave; no levanta api-gw" || { ko "crear rc=${rc}"; cat "${T}/cr.log"; }
[[ "$(val "${PN}/.env" DTD_WEB_IMAGE)" == "ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-${FXSHA}" ]] && ok "imagen de prueba del SHA de main" || ko "imagen de crear"
DOBLE_IP=10.9.9.9 cr --project zz541-staging --confirm zz541-staging --solo-arrancar --con-dns > "${T}/cr-dns.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && ! grep -q 'up -d api-gw' "${DOBLE_DIR}/docker.log" && ok "DNS que no resuelve al VPS: sale 6 y no levanta api-gw" || ko "DNS malo rc=${rc}"
cr --project zz541-staging --confirm zz541-staging --solo-arrancar --con-dns > "${T}/cr-dns2.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && grep -q 'up -d api-gw realtime functions mailpit web cron' "${DOBLE_DIR}/docker.log" && grep -q 'prueba arriba' "${T}/cr-dns2.log" \
  && ok "--solo-arrancar --con-dns: levanta el resto y pasa el smoke" || { ko "crear con DNS rc=${rc}"; cat "${T}/cr-dns2.log"; }

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ · ${nv} NO VERIFICADO"
[[ "${fail}" == 0 ]]
