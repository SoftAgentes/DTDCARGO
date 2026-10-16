#!/usr/bin/env bash
# infra/ops/tests/prueba-ips-prueba.sh — prueba de staging/ips-prueba.sh (SDD-0540).
#
# Doble de docker en una carpeta temporal y un proyecto inventado (`zz-staging`):
# ninguna red, ningún contenedor. Comprueba que la lista de IP se escriba en el
# .env de prueba, que la IP nunca salga por pantalla, que --agregar sume sin
# repetir y las guardas (producción, --confirm, rangos abiertos o inválidos).
#
#   bash infra/ops/tests/prueba-ips-prueba.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IPS="${S}/staging/ips-prueba.sh"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }

mkdir -p "${T}/bin" "${T}/zz-staging" "${T}/evid"
cat > "${T}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_LOG}"
case "$1 $2" in
  "network inspect") echo "172.18.0.1 " ;;
  "ps -q") [[ "$*" == *service=web* && -n "${DOBLE_WEB_ARRIBA-}" ]] && echo abc123 ;;
esac
exit 0
DOBLE
chmod +x "${T}/bin/docker"
export PATH="${T}/bin:${PATH}" DOBLE_LOG="${T}/docker.log"
P="${T}/zz-staging"
printf 'APP_ENV=staging\nDTD_WEB_HOST=prueba.example.test\n' > "${P}/.env"
corre() { bash "${IPS}" --project zz-staging --confirm zz-staging --project-dir "${P}" --ip 198.51.100.1 --evidence-dir "${T}/evid" "$@"; }

# 1. Por SSH: escribe las dos variables y no imprime la IP.
out="$(SSH_CLIENT="203.0.113.7 51515 22" corre 2>&1)"; rc=$?
[[ ${rc} -eq 0 ]] && ok "por SSH sale 0" || ko "por SSH rc=${rc}: ${out}"
grep -qx 'STAGING_ALLOWED_IPS=203.0.113.7/32' "${P}/.env" && ok "STAGING_ALLOWED_IPS = la IP del SSH en /32" || ko "STAGING_ALLOWED_IPS: $(grep STAGING_ALLOWED "${P}/.env")"
grep -qx 'STAGING_INTERNAL_IPS=172.18.0.1/32,198.51.100.1/32' "${P}/.env" && ok "STAGING_INTERNAL_IPS = puerta de dtd_edge + IP pública" || ko "STAGING_INTERNAL_IPS: $(grep STAGING_INTERNAL "${P}/.env")"
grep -qE '203\.0\.113\.7|172\.18\.0\.1|198\.51\.100\.1' <<< "${out}" && ko "la salida muestra una IP" || ok "la salida no muestra ninguna IP"
grep -rqE '203\.0\.113\.7' "${T}/evid" && ko "la evidencia muestra la IP" || ok "la evidencia no muestra la IP (solo huellas)"
ls "${P}"/.env.bak-ips-* > /dev/null 2>&1 && ok "deja copia del .env" || ko "sin copia del .env"
touch "${T}/permiso"; chmod 600 "${T}/permiso"
if [[ "$(stat -c '%a' "${T}/permiso")" != 600 ]]; then
  echo "NO VERIFICADO · .env en 600: este sistema de archivos no guarda permisos (NTFS)"
else
  [[ "$(stat -c '%a' "${P}/.env")" == 600 ]] && ok ".env en 600" || ko ".env en $(stat -c '%a' "${P}/.env")"
fi
grep -q -- 'compose' "${DOBLE_LOG}" && ko "sin --aplicar llamó a compose" || ok "sin --aplicar no toca contenedores"

# 2. --agregar: suma otra red sin repetir.
SSH_CLIENT="192.0.2.44 40000 22" corre --agregar > /dev/null 2>&1
SSH_CLIENT="192.0.2.44 40001 22" corre --agregar > /dev/null 2>&1
grep -qx 'STAGING_ALLOWED_IPS=203.0.113.7/32,192.0.2.44/32' "${P}/.env" && ok "--agregar suma la segunda IP una sola vez" || ko "--agregar: $(grep STAGING_ALLOWED "${P}/.env")"
SSH_CLIENT="192.0.2.50 40002 22" corre > /dev/null 2>&1
grep -qx 'STAGING_ALLOWED_IPS=192.0.2.50/32' "${P}/.env" && ok "sin --agregar reemplaza la lista" || ko "reemplazo: $(grep STAGING_ALLOWED "${P}/.env")"
[[ "$(grep -c '^STAGING_ALLOWED_IPS=' "${P}/.env")" == 1 ]] && ok "una sola línea STAGING_ALLOWED_IPS" || ko "líneas repetidas"

# 3. --aplicar: recrea solo los routers que están arriba.
: > "${DOBLE_LOG}"
DOBLE_WEB_ARRIBA=1 SSH_CLIENT="192.0.2.50 1 22" corre --aplicar > /dev/null 2>&1
grep -q -- 'up -d --no-deps --force-recreate web' "${DOBLE_LOG}" && ok "--aplicar recrea el web (arriba) con la lista nueva" || ko "--aplicar: $(grep compose "${DOBLE_LOG}")"
grep -q -- '--force-recreate web mailpit\|--force-recreate web api-gw' "${DOBLE_LOG}" && ko "--aplicar recreó servicios que no estaban arriba" || ok "--aplicar no levanta lo que estaba abajo"

# 4. Guardas.
SSH_CLIENT="203.0.113.7 1 22" bash "${IPS}" --project dtd-cargo --confirm dtd-cargo --project-dir "${P}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "rechaza el proyecto de producción (3)" || ko "producción rc=${rc}"
SSH_CLIENT="203.0.113.7 1 22" bash "${IPS}" --project zz-staging --project-dir "${P}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "sin --confirm rechaza (3)" || ko "sin --confirm rc=${rc}"
SSH_CLIENT="203.0.113.7 1 22" bash "${IPS}" --project zz-staging --confirm zz-staging --project-dir /srv/dtd-cargo > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "rechaza la carpeta de producción (3)" || ko "carpeta de producción rc=${rc}"
for malo in 0.0.0.0/0 10.0.0.0/4 300.1.1.1 1.2.3 ::/0 abc; do
  antes="$(sha256sum "${P}/.env")"
  corre --cidr "${malo}" > /dev/null 2>&1; rc=$?
  [[ ${rc} -eq 2 && "$(sha256sum "${P}/.env")" == "${antes}" ]] && ok "--cidr ${malo}: sale 2 sin tocar el .env" || ko "--cidr ${malo} rc=${rc}"
done
( unset SSH_CLIENT; corre > /dev/null 2>&1 ); rc=$?
[[ ${rc} -eq 2 ]] && ok "sin SSH y sin --cidr sale 2" || ko "sin SSH rc=${rc}"
corre --cidr 203.0.113.9 --dry-run > /dev/null 2>&1
grep -q '203.0.113.9' "${P}/.env" && ko "--dry-run escribió" || ok "--dry-run no escribe"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ ${fail} -eq 0 ]]
