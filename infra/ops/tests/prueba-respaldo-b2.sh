#!/usr/bin/env bash
# infra/ops/tests/prueba-respaldo-b2.sh — la cadena de respaldo contra el bucket REAL (SDD-0505).
#
# prueba-traslado-y-respaldos.sh prueba la mecánica contra un S3 falso; esta prueba
# lo que esa no alcanza: que el remoto de verdad (el de /srv/ops/backup/rclone,
# Backblaze B2) recibe solo cifrados, que se bajan íntegros y se restauran, y que
# el borrado es real (sin versiones ocultas que dejen datos más allá de la
# retención). Datos sintéticos en un supabase/postgres desechable y una llave age
# de usar y tirar en /dev/shm: nunca la llave de Sam ni datos reales. Todo va bajo
# <remoto>/prueba-<fecha>-<azar>/ y se purga al terminar, también si algo falla.
#
# Uso (root en el VPS): bash infra/ops/tests/prueba-respaldo-b2.sh [--remote b2:dtdcargo-respaldos]
# Termina con «RESULTADO: N PASÓ · M FALLÓ»; sale 1 si algo falló.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="b2:dtdcargo-respaldos"
[[ "${1:-}" == --remote && -n "${2:-}" ]] && REMOTE="$2"
CONF=/srv/ops/backup/rclone
IMG=supabase/postgres:17.6.1.136
RC=rclone/rclone:1.75.1
P="prueba-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 3)"
PREF="${REMOTE}/${P}"
NAME=zzb2-src
NET="${NAME}_internal"
T="$(mktemp -d)"
K="$(mktemp -d /dev/shm/zzb2key-XXXXXX)"
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
rcl() { docker run --rm -v "${CONF}:/config/rclone:ro" -v "${T}:/data" "${RC}" "$@"; }
limpiar() {
  rcl purge "${PREF}" >/dev/null 2>&1
  docker rm -f -v "${NAME}-db" >/dev/null 2>&1
  docker network rm "${NET}" >/dev/null 2>&1
  rm -rf "${T}" "${K}" /dev/shm/pg-dump-${NAME}-*
}
trap limpiar EXIT
wait_ready() {
  local streak=0 i
  for i in $(seq 1 150); do
    if docker exec "$1" psql -U postgres -h localhost -Atc "select 1 from pg_roles where rolname='supabase_admin'" 2>/dev/null | grep -q 1; then
      streak=$((streak+1)); [ $streak -ge 5 ] && return 0
    else streak=0; fi
    sleep 1
  done
  return 1
}
asadmin() { docker exec -i "$1" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -Atq "${@:2}"; }

echo "== preparación · ${PREF} =="
[ -f "${CONF}/rclone.conf" ] || { echo "no existe ${CONF}/rclone.conf: primero set-remote.sh"; exit 1; }
rcl lsf "${REMOTE}" --max-depth 1 >/dev/null 2>&1 && ok "el remoto real responde (${REMOTE})" || { ko "el remoto ${REMOTE} no responde"; exit 1; }
age-keygen -o "${K}/key.txt" 2>/dev/null; age-keygen -y "${K}/key.txt" > "${T}/recipients.txt"
PW=$(openssl rand -hex 16)
docker network create "${NET}" >/dev/null
docker run -d --name "${NAME}-db" --network "${NET}" --network-alias db -e POSTGRES_PASSWORD="${PW}" "${IMG}" \
  postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
wait_ready "${NAME}-db" || { ko "la base sintética no arrancó"; exit 1; }
MARK="marcador-$(openssl rand -hex 4)"
asadmin "${NAME}-db" <<SQL
create table public.prueba (id int primary key, nota text);
insert into public.prueba values (1, '${MARK}'), (2, 'otra fila');
insert into auth.users (instance_id, id, aud, role, email) values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${MARK}@example.test');
SQL
N_USERS=$(asadmin "${NAME}-db" -c "select count(*) from auth.users")
echo "   base sintética lista: public.prueba=2 · auth.users=${N_USERS}"

echo; echo "== respaldo al bucket real =="
t0=$(date +%s)
PGPASSWORD="${PW}" bash "${S}/backup/pg-dump-to-s3.sh" --project "${NAME}" --network "${NET}" --remote "${PREF}" \
  --age-recipients "${T}/recipients.txt" --out "${T}/out" --rclone-config "${CONF}" > "${T}/dump.log" 2>&1; rc=$?
t_dump=$(( $(date +%s) - t0 ))
[ $rc -eq 0 ] && ok "pg-dump-to-s3 contra el bucket real salió 0 (${t_dump}s)" || { ko "pg-dump-to-s3 salió ${rc}"; tail -5 "${T}/dump.log"; }
lista="$(rcl lsf -R --files-only "${PREF}" 2>/dev/null)"
echo "${lista}" | sed 's/^/   remoto: /'
n_total=$(printf '%s\n' "${lista}" | grep -c . || true)
n_claro=$(printf '%s\n' "${lista}" | grep . | grep -vcE '\.(age|sha256)$' || true)
[ "${n_total}" -ge 4 ] && [ "${n_claro}" = 0 ] && ok "en el bucket solo hay .age y .sha256 (${n_total} archivos)" || ko "en el bucket: ${n_total} archivos, ${n_claro} sin cifrar"

echo; echo "== bajar del bucket y restaurar =="
rcl copy "${PREF}" /data/bajado >/dev/null 2>&1 && ok "se bajó todo del bucket" || ko "no se pudo bajar del bucket"
B="${T}/bajado/${NAME}"
DUMP=$(find "${B}" -name '*.dump.age' 2>/dev/null | head -1); ROLES=$(find "${B}" -name '*-roles.sql.age' 2>/dev/null | head -1)
(cd "${B}" 2>/dev/null && sha256sum -c --quiet ./*.sha256) && ok "sha256 de lo bajado coincide con el de la subida" || ko "sha256 de lo bajado"
n_age=0; n_mala=0
for f in "${B}"/*.age; do
  [ -f "$f" ] || continue; n_age=$((n_age+1))
  [ "$(head -c 21 "$f")" = "age-encryption.org/v1" ] || n_mala=$((n_mala+1))
done
[ "${n_age}" -ge 3 ] && [ "${n_mala}" = 0 ] && ok "los ${n_age} .age bajados tienen cabecera age" || ko "cabeceras: ${n_age} .age, ${n_mala} sin cabecera"
grep -rlaq "${MARK}" "${B}" && ko "el marcador se lee en claro en lo bajado" || ok "el marcador no se lee en lo bajado (todo cifrado)"
t0=$(date +%s)
bash "${S}/backup/restore-test.sh" --file "${DUMP}" --roles "${ROLES}" --age-identity "${K}/key.txt" \
  --expect public.prueba=2 --expect "auth.users=${N_USERS}" > "${T}/rt.log" 2>&1; rc=$?
t_rt=$(( $(date +%s) - t0 ))
sed 's/^/   /' "${T}/rt.log" | grep -E 'PASÓ|FALLÓ|permisos|RTO' | tail -8
[ $rc -eq 0 ] && ok "restore-test desde lo bajado del bucket: todas sus comprobaciones PASÓ (${t_rt}s)" || ko "restore-test salió ${rc}"

echo; echo "== borrado real =="
# Se lista desde la raíz del bucket (un prefijo vacío da error en B2) y con
# --b2-versions; el conteo de antes del purge es el control de que la lista ve.
versiones() {
  rcl lsf -R --files-only --b2-versions --include "/${P}/**" "${REMOTE}" > "${T}/versiones.txt" 2>&1 || { echo error; return; }
  grep -c . "${T}/versiones.txt" || true
}
antes="$(versiones)"
rcl purge "${PREF}" >/dev/null 2>&1 && ok "purge del prefijo de prueba" || ko "purge falló"
quedan="$(versiones)"
[[ "${antes}" =~ ^[0-9]+$ ]] && [ "${antes}" -ge 4 ] && [ "${quedan}" = 0 ] && ok "borrado real: antes ${antes} archivos, después 0 archivos y 0 versiones ocultas" || ko "borrado: antes ${antes} · después ${quedan}"
n_local_claro=$(find "${T}/out" -type f ! -name '*.age' ! -name '*.sha256' 2>/dev/null | wc -l)
[ "${n_local_claro}" = 0 ] && ok "en el disco local solo quedaron cifrados" || ko "${n_local_claro} archivos sin cifrar en el disco local"
[ "$(ls -A /dev/shm | grep -cE "^(pg-dump-${NAME}|restore-)" || true)" = 0 ] && ok "nada quedó en /dev/shm" || ko "quedaron restos en /dev/shm"
echo; echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
