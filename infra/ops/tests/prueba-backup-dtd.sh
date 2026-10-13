#!/usr/bin/env bash
# infra/ops/tests/prueba-backup-dtd.sh — prueba de infra/dtd-cargo/backup.sh y de sus
# unidades de systemd (SDD-0505). Corre en el VPS como root.
#
# No toca /srv ni el bucket: el proyecto es un directorio temporal con un .env
# inventado, los dos scripts de ops son dobles que anotan con qué los llamaron y
# salen como se les pida, la «base» es un contenedor dormido con las etiquetas de
# compose, y el monitor es un servidor HTTP local que cuenta los latidos.
# Uso: bash infra/ops/tests/prueba-backup-dtd.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BK="${S}/../dtd-cargo/backup.sh"
UNITS="${S}/../dtd-cargo/systemd"
T="$(mktemp -d)"; P="${T}/proj"; O="${T}/ops/backup"
NOMBRE=zzbk
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
limpiar() {
  [ -n "${WEB_PID:-}" ] && kill "${WEB_PID}" 2>/dev/null
  # Anclado al comando: un `-f` suelto también mataría al shell que lo invoca.
  pkill -f '^python3 -m http.server 18099' 2>/dev/null
  docker rm -f "${NOMBRE}-db-falsa" >/dev/null 2>&1
  rm -rf "${T}" "/run/lock/backup-${NOMBRE}.lock"
}
trap limpiar EXIT

echo "== preparación =="
mkdir -p "${P}" "${O}" "${T}/web/latido" "${T}/out" "${T}/rc"
cp "${BK}" "${P}/backup.sh"; chmod 700 "${P}/backup.sh"
echo "age1prueba" > "${T}/rec"
# Dobles: anotan los argumentos y el largo de PGPASSWORD; salen según ${T}/rc-<nombre>.
for s in pg-dump-to-s3.sh config-backup.sh; do
  cat > "${O}/${s}" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" > "${T}/args-${s}"
printf '%s\n' "\${#PGPASSWORD}" > "${T}/pw-${s}"
[ -f "${T}/dormir" ] && sleep 3
exit "\$(cat "${T}/rc-${s}" 2>/dev/null || echo 0)"
EOF
  chmod 700 "${O}/${s}"
done
TOKEN="$(openssl rand -hex 6)"
echo ok > "${T}/web/latido/${TOKEN}"   # el monitor contesta 200 solo en esta ruta
# `exec`: así WEB_PID es el de python y el trap lo mata de verdad (sin exec
# moría la subshell y el servidor quedaba huérfano ocupando el puerto).
( cd "${T}/web" && exec python3 -m http.server 18099 --bind 127.0.0.1 > "${T}/web.log" 2>&1 ) &
WEB_PID=$!
sleep 1
curl -fsS -m 5 -o /dev/null "http://127.0.0.1:18099/latido/${TOKEN}" || { echo "el monitor local no arrancó (¿puerto 18099 ocupado?)"; cat "${T}/web.log"; exit 1; }
: > "${T}/web.log"   # el latido de comprobación no cuenta
latidos() { grep -c "GET /latido/${TOKEN}" "${T}/web.log" || true; }
cat > "${P}/.env" <<EOF
PROYECTO=${NOMBRE}
OPS_DIR=${T}/ops
POSTGRES_PASSWORD='clave-de-prueba'
BACKUP_RCLONE_REMOTE=zz:prueba/db
BACKUP_HEARTBEAT_URL=http://127.0.0.1:18099/latido/${TOKEN}
BACKUP_DIR=${T}/out
RCLONE_CONFIG_DIR=${T}/rc
BACKUP_AGE_RECIPIENTS_FILE=${T}/rec
EOF
chmod 600 "${P}/.env"
correr() { rm -f "${T}"/args-* "${T}"/pw-*; bash "${P}/backup.sh" "$@" > "${T}/salida.log" 2>&1; echo $?; }

echo; echo "== con la marca de apagado =="
echo "NO ENCENDER" > "${P}/NO-ENCENDER-HASTA-EL-CORTE.txt"
rc=$(correr)
[ "${rc}" = 0 ] && grep -q 'RESULTADO: APAGADO' "${T}/salida.log" && [ ! -f "${T}/args-pg-dump-to-s3.sh" ] && [ "$(latidos)" = 0 ] \
  && ok "con la marca: sale 0, dice APAGADO, no llama a nada y no late" || { ko "con la marca rc=${rc}"; tail -3 "${T}/salida.log"; }
rc=$(correr --dry-run)
[ "${rc}" = 0 ] && grep -q 'RESULTADO: DRY-RUN' "${T}/salida.log" && [ -f "${T}/args-pg-dump-to-s3.sh" ] \
  && ok "con la marca, el dry-run igual imprime los comandos del dump" || { ko "dry-run con marca rc=${rc}"; tail -3 "${T}/salida.log"; }
rm -f "${P}/NO-ENCENDER-HASTA-EL-CORTE.txt"

echo; echo "== sin la marca y sin base corriendo =="
rc=$(correr)
[ "${rc}" = 1 ] && grep -q 'no está corriendo' "${T}/salida.log" && grep -q 'RESULTADO: FALLÓ' "${T}/salida.log" && [ ! -f "${T}/args-pg-dump-to-s3.sh" ] \
  && ok "sin marca y sin base: falla (1) y lo dice" || { ko "sin base rc=${rc}"; tail -3 "${T}/salida.log"; }

echo; echo "== dry-run =="
rc=$(correr --dry-run)
args="$(cat "${T}/args-pg-dump-to-s3.sh" 2>/dev/null)"
[ "${rc}" = 0 ] && grep -q 'RESULTADO: DRY-RUN' "${T}/salida.log" && [[ "${args}" == *"--dry-run"* ]] \
  && ok "dry-run: sale 0 sin base y pasa --dry-run al dump" || { ko "dry-run rc=${rc}"; tail -3 "${T}/salida.log"; }
[[ "${args}" == *"--project ${NOMBRE} "* && "${args}" == *"--network ${NOMBRE}_dtd_internal "* && "${args}" == *"--remote zz:prueba/db "* \
  && "${args}" == *"--age-recipients ${T}/rec "* && "${args}" == *"--rclone-config ${T}/rc "* && "${args}" == *"--retention-days 30 "* && "${args}" == *"--local-retention-days 7 "* \
  && "${args}" == *"--host db "* && "${args}" == *"--db postgres "* ]] && ok "el dump recibe proyecto, red, remoto, destinatarios, rclone y retención de DTD" || ko "argumentos del dump: ${args}"
[ "$(cat "${T}/pw-pg-dump-to-s3.sh")" = 15 ] && ok "la contraseña llega por el entorno sin las comillas del .env (15 caracteres)" || ko "PGPASSWORD largo $(cat "${T}/pw-pg-dump-to-s3.sh")"
grep -q 'clave-de-prueba' "${T}/salida.log" && ko "la contraseña aparece en la salida" || ok "la contraseña no aparece en la salida"
[ ! -f "${T}/args-config-backup.sh" ] && [ "$(latidos)" = 0 ] && ok "dry-run: no respalda la configuración ni late" || ko "dry-run llamó a config o lateó"

echo; echo "== corrida completa con una base «corriendo» =="
docker run -d --name "${NOMBRE}-db-falsa" --label "com.docker.compose.project=${NOMBRE}" --label "com.docker.compose.service=db" \
  --entrypoint sleep supabase/postgres:17.6.1.136 600 >/dev/null
rc=$(correr)
cargs="$(cat "${T}/args-config-backup.sh" 2>/dev/null)"
[ "${rc}" = 0 ] && grep -q 'RESULTADO: PASÓ' "${T}/salida.log" && [ "$(latidos)" = 1 ] && ok "dump y configuración en 0: PASÓ y un latido" || { ko "completa rc=${rc} latidos $(latidos)"; tail -3 "${T}/salida.log"; }
[[ "${cargs}" == *"--project-dir ${P} "* && "${cargs}" == *"--volume ${NOMBRE}_db-config "* && "${cargs}" == *"--remote zz:prueba/db "* ]] && ok "la configuración recibe el directorio del proyecto, el volumen y el remoto" || ko "argumentos de config: ${cargs}"
[ "$(cat "${T}/pw-config-backup.sh")" = 0 ] && ok "config-backup.sh corre sin PGPASSWORD en el entorno" || ko "PGPASSWORD llegó a config-backup"

echo 1 > "${T}/rc-pg-dump-to-s3.sh"
rc=$(correr)
[ "${rc}" = 1 ] && grep -q 'pg-dump-to-s3.sh salió 1' "${T}/salida.log" && [ ! -f "${T}/args-config-backup.sh" ] && [ "$(latidos)" = 1 ] \
  && ok "dump en 1: FALLÓ, no respalda la configuración y no late" || { ko "dump en 1 rc=${rc}"; tail -3 "${T}/salida.log"; }
rm -f "${T}/rc-pg-dump-to-s3.sh"; echo 1 > "${T}/rc-config-backup.sh"
rc=$(correr)
[ "${rc}" = 1 ] && grep -q 'config-backup.sh salió 1' "${T}/salida.log" && [ "$(latidos)" = 1 ] && ok "configuración en 1: FALLÓ y no late" || { ko "config en 1 rc=${rc}"; tail -3 "${T}/salida.log"; }
rm -f "${T}/rc-config-backup.sh"

echo; echo "== sin monitor y con latido roto =="
sed -i 's#^BACKUP_HEARTBEAT_URL=.*#BACKUP_HEARTBEAT_URL=#' "${P}/.env"
rc=$(correr)
[ "${rc}" = 0 ] && grep -q 'sin BACKUP_HEARTBEAT_URL' "${T}/salida.log" && ok "sin URL de latido: respalda igual y lo dice" || ko "sin URL rc=${rc}"
sed -i "s#^BACKUP_HEARTBEAT_URL=.*#BACKUP_HEARTBEAT_URL=http://127.0.0.1:18098/nadie#" "${P}/.env"
rc=$(correr)
[ "${rc}" = 1 ] && grep -q 'el latido al monitor falló' "${T}/salida.log" && ok "monitor caído: el respaldo se hace y sale 1 avisando" || ko "monitor caído rc=${rc}"

echo; echo "== dos corridas a la vez =="
touch "${T}/dormir"
bash "${P}/backup.sh" > "${T}/primera.log" 2>&1 &
PRIMERA=$!
sleep 1
rc=$(correr)
[ "${rc}" = 3 ] && grep -q 'ya hay un respaldo' "${T}/salida.log" && ok "una segunda corrida mientras dura la primera: sale 3 sin tocar nada" || ko "candado rc=${rc}"
rm -f "${T}/dormir"; wait "${PRIMERA}"

echo; echo "== unidades de systemd =="
# Copias con el ExecStart apuntando al backup.sh de esta prueba: verify exige
# que el ejecutable exista, y /srv/dtd-cargo/backup.sh puede no estar instalado.
mkdir -p "${T}/units"
sed "s#^ExecStart=.*#ExecStart=${P}/backup.sh#" "${UNITS}/dtd-cargo-backup.service" > "${T}/units/dtd-cargo-backup.service"
cp "${UNITS}/dtd-cargo-backup.timer" "${T}/units/"
systemd-analyze verify "${T}/units/dtd-cargo-backup.service" "${T}/units/dtd-cargo-backup.timer" > "${T}/units.log" 2>&1 \
  && ok "service y timer pasan systemd-analyze verify" || { ko "systemd-analyze verify"; cat "${T}/units.log"; }
# «Next elapse» sale en la zona del VPS (Berlín); la línea «(in UTC)» es la que importa.
prox="$(systemd-analyze calendar "$(grep '^OnCalendar=' "${UNITS}/dtd-cargo-backup.timer" | cut -d= -f2-)" 2>/dev/null | grep -i '(in UTC)' | head -1)"
[[ "${prox}" == *"06:00:00 UTC"* ]] && ok "el timer cae a las 06:00 UTC (${prox#*: })" || ko "OnCalendar: ${prox}"
grep -q '^ExecStart=/srv/dtd-cargo/backup.sh$' "${UNITS}/dtd-cargo-backup.service" && grep -q '^Persistent=true' "${UNITS}/dtd-cargo-backup.timer" \
  && ok "el service corre backup.sh y el timer recupera la corrida perdida" || ko "contenido de las unidades"
echo; echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
