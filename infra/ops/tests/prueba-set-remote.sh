#!/usr/bin/env bash
# infra/ops/tests/prueba-set-remote.sh — prueba de backup/set-remote.sh (SDD-0505).
# S3 falso (rclone serve s3) en una red propia y claves inventadas: nada real.
# Corre en el VPS: bash infra/ops/tests/prueba-set-remote.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SR="${S}/backup/set-remote.sh"
T="$(mktemp -d)"; NET=zz-setremote
limpiar() { docker rm -f zz-setremote-s3 >/dev/null 2>&1; docker network rm "${NET}" >/dev/null 2>&1; rm -rf "${T}"; }
trap limpiar EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
docker network create "${NET}" >/dev/null
mkdir -p "${T}/datos/zz-respaldos"
docker run -d --name zz-setremote-s3 --network "${NET}" -v "${T}/datos:/data" rclone/rclone:1.75.1 serve s3 /data --addr :8080 --auth-key kprueba,sprueba >/dev/null
sleep 2
export RCLONE_NETWORK="${NET}"
run() { bash "${SR}" --tipo s3 --nombre zzs3 --bucket zz-respaldos --dir "${T}/rclone" "$@"; }

printf '%s\n%s\n%s\n' "http://zz-setremote-s3:8080" "kprueba" "malo" | run > "${T}/m.log" 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'no se pudo listar' "${T}/m.log" && [ ! -f "${T}/rclone/rclone.conf" ] && ok "claves malas: rechaza (2) y no guarda nada" || { ko "claves malas rc=$rc"; tail -3 "${T}/m.log"; }

printf '%s\n%s\n%s\n' "http://zz-setremote-s3:8080" "kprueba" "sprueba" | run > "${T}/b.log" 2>&1; rc=$?
[ $rc -eq 0 ] && grep -q 'listar, escribir, leer y borrar de verdad PASÓ' "${T}/b.log" && ok "claves buenas: lista, escribe, lee y borra; guarda" || { ko "claves buenas rc=$rc"; tail -3 "${T}/b.log"; }
[ "$(stat -c %a "${T}/rclone/rclone.conf" 2>/dev/null)" = 600 ] && [ "$(stat -c %a "${T}/rclone")" = 700 ] && ok "rclone.conf 600 en carpeta 700" || ko "permisos"
grep -q '^\[zzs3\]' "${T}/rclone/rclone.conf" && grep -q '^type = s3' "${T}/rclone/rclone.conf" && grep -q '^secret_access_key = sprueba' "${T}/rclone/rclone.conf" && ok "el remoto quedó completo en rclone.conf" || ko "rclone.conf incompleto"
grep -q 'sprueba' "${T}/b.log" && ko "la clave aparece en la salida" || ok "la clave no aparece en la salida"
[ -z "$(find "${T}/datos/zz-respaldos" -type f)" ] && ok "el archivo de prueba no quedó en el bucket" || ko "quedó el archivo de prueba"
# Otra corrida reemplaza solo su sección y conserva las demás.
printf '[otro]\ntype = local\n\n' >> "${T}/rclone/rclone.conf"
printf '%s\n%s\n%s\n' "http://zz-setremote-s3:8080" "kprueba" "sprueba" | run > /dev/null 2>&1
[ "$(grep -c '^\[zzs3\]' "${T}/rclone/rclone.conf")" = 1 ] && grep -q '^\[otro\]' "${T}/rclone/rclone.conf" && ok "volver a correrlo reemplaza su sección y conserva las otras" || ko "secciones: $(grep '^\[' "${T}/rclone/rclone.conf" | tr '\n' ' ')"
docker run --rm --network "${NET}" -v "${T}/rclone:/config/rclone:ro" rclone/rclone:1.75.1 lsf zzs3:zz-respaldos >/dev/null 2>&1 && ok "rclone usa el rclone.conf guardado" || ko "el rclone.conf guardado no funciona"

# B2: la clave maestra (keyID de 12) se rechaza antes de conectar. Sin red
# (--network none) ninguna clave llega a Backblaze: lo que se mide es qué
# pregunta vuelve y por qué.
b2() { RCLONE_NETWORK=none bash "${SR}" --tipo b2 --nombre zzb2 --bucket zz-respaldos --dir "${T}/b2" "$@"; }
MAESTRA="a1b2c3d4e5f6"; RESTRINGIDA="005a1b2c3d4e5f60000000001"
printf '%s\nclave-falsa\n%s\nclave-falsa\n%s\nclave-falsa\n' "${MAESTRA}" "${MAESTRA}" "${MAESTRA}" | b2 > "${T}/b2m.log" 2>&1; rc=$?
[ $rc -eq 2 ] && [ "$(grep -c 'clave MAESTRA' "${T}/b2m.log")" -ge 3 ] && [ ! -f "${T}/b2/rclone.conf" ] && ! grep -q 'clave-falsa' "${T}/b2m.log" \
  && ok "b2 con la clave maestra 3 veces: la rechaza, explica cuál va y no guarda nada" || { ko "b2 maestra rc=$rc"; tail -3 "${T}/b2m.log"; }
printf '%s\nclave-falsa\n%s\nK005clave-falsa\n%s\nK005clave-falsa\n' "${MAESTRA}" "${RESTRINGIDA}" "${RESTRINGIDA}" | b2 > "${T}/b2r.log" 2>&1; rc=$?
[ "$(grep -c 'clave MAESTRA' "${T}/b2r.log")" = 1 ] && grep -q 'intento 2: no se pudo listar' "${T}/b2r.log" \
  && ok "b2: tras la maestra, una restringida (keyID de 25) pasa al intento de conexión" || { ko "b2 restringida rc=$rc"; tail -3 "${T}/b2r.log"; }
printf '%s\nclave-falsa\n%s\nclave-falsa\n%s\nclave-falsa\n' "${MAESTRA}" "${MAESTRA}" "${MAESTRA}" | b2 --permitir-maestra > "${T}/b2p.log" 2>&1
! grep -q 'clave MAESTRA' "${T}/b2p.log" && grep -q 'no se pudo listar' "${T}/b2p.log" && ok "b2 --permitir-maestra: la deja pasar a la conexión" || { ko "--permitir-maestra"; tail -3 "${T}/b2p.log"; }
echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
