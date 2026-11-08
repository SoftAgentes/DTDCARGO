#!/usr/bin/env bash
# infra/ops/tests/prueba-portal-historial.sh — prueba de infra/ops/portal-historial/extraer.sh, vincular.sh y
# limpiar.sh (SDD-0586 10.7, P4) con un `docker` falso que hace de psql: nada toca una base.
# Pide /dev/shm (Linux): la corre «Calidad continua» con infra/ops/tests/pruebas-linux.sh.
#
# Comprueba lo que pidió el Subdirector:
#   · /dev/shm/<dir> queda con 0700 y el preparado con 0600;
#   · si la extracción falla, no queda ni el preparado ni lo parcial;
#   · si la vinculación sale bien, el directorio se borra; si falla, queda para repetir;
#   · ninguno acepta otro directorio que /dev/shm/portal-historial (ni `/dev/shm//`, `/dev/shm/`,
#     `/dev/shm/a/b`, `/dev/shm/.x` o `/dev/shm/../x`), ni borra nada con uno de ellos;
#   · la vinculación rechaza la barra invertida;
#   · la extracción pide la cuenta y la bandeja en números; la vinculación acepta un vinculos.ndjson sin
#     salto de línea al final (revisiones del DG de la #456).
# Usa el nombre fijo de los scripts, /dev/shm/portal-historial: si ya existe (una carga de verdad en esta
# máquina), la prueba se niega a correr y no lo toca.
# Datos inventados: uuid y números sintéticos.
set -uo pipefail
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PH="${R}/infra/ops/portal-historial"
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }

if [ ! -d /dev/shm ]; then
  echo "FALLÓ · no hay /dev/shm: esta prueba es de Linux (pruebas-linux.sh)"
  exit 1
fi

D="/dev/shm/portal-historial"
if [ -e "${D}" ]; then
  echo "FALLÓ · ya existe ${D}: puede ser una carga de verdad, la prueba no lo toca"
  exit 1
fi
# Algo de otro proceso en /dev/shm: ningún rechazo puede borrarlo.
C="/dev/shm/ph-centinela-$$"
T="$(mktemp -d)"
trap 'rm -rf "${T}" "${D}" "${C}"' EXIT

# El docker falso: `docker exec -i <db> psql ... -f -` lee el SQL de la entrada y responde según lo que pida.
mkdir -p "${T}/bin"
cat > "${T}/bin/docker" <<'FALSO'
#!/usr/bin/env bash
entrada="$(cat)"
printf '%s\n' "${entrada}" >> "${FALSO_REGISTRO:?}"
case "${entrada}" in
  *chatwoot_portal_reservar_contactos*) echo 2 ;;
  *chatwoot_portal_carga_lineas*)
    if [ "${FALSO_FALLA_EXTRAER:-0}" = 1 ]; then
      echo '{"tipo": "cabecera", "a medias": true}'
      echo 'ERROR:  sintético' >&2
      exit 3
    fi
    echo '{"tipo": "cabecera", "corte": "2026-11-10T14:00:00.000000Z", "version": 1, "contactos": 1, "mensajes": 1, "conversaciones": 1}'
    echo '{"tipo": "contacto", "nombre": "Cliente Sintético", "cliente": "20000000-0000-4000-8000-0000000000a1", "identificador": "30000000-0000-4000-8000-0000000000b1"}'
    echo '{"tipo": "conversacion", "hilo": "40000000-0000-4000-8000-0000000000c1", "estado": "open"}'
    echo '{"tipo": "mensaje", "hilo": "40000000-0000-4000-8000-0000000000c1", "texto": "SINT hola"}'
    ;;
  *chatwoot_portal_vincular_carga*)
    if [ "${FALSO_FALLA_VINCULAR:-0}" = 1 ]; then
      echo 'ERROR:  sintético' >&2
      exit 3
    fi
    echo 'HECHO contactos=1 hilos=1 mensajes=1'
    ;;
  *) echo "docker falso: pedido inesperado" >&2; exit 9 ;;
esac
FALSO
chmod +x "${T}/bin/docker"
export PATH="${T}/bin:${PATH}"
export FALSO_REGISTRO="${T}/registro.sql"
: > "${FALSO_REGISTRO}"
permisos() { stat -c '%a' "$1"; }

# ── extraer.sh ──
DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 CUENTA=1 BANDEJA=9 DIR="${D}" \
  bash "${PH}/extraer.sh" > "${T}/e1.log" 2>&1; rc=$?
[ "${rc}" = 0 ] && ok "extraer.sh sale bien con el psql falso" || ko "extraer.sh salió con ${rc}: $(cat "${T}/e1.log")"
[ -f "${D}/preparado.ndjson" ] && ok "deja preparado.ndjson" || ko "no dejó preparado.ndjson"
[ "$(permisos "${D}")" = 700 ] && ok "el directorio de /dev/shm queda con 0700" || ko "el directorio quedó con $(permisos "${D}")"
[ "$(permisos "${D}/preparado.ndjson")" = 600 ] && ok "el preparado queda con 0600" || ko "el preparado quedó con $(permisos "${D}/preparado.ndjson")"
[ ! -e "${D}/preparado.ndjson.parcial" ] && ok "no queda lo parcial" || ko "quedó lo parcial"
[ "$(wc -l < "${D}/preparado.ndjson" | tr -d ' ')" = 4 ] && ok "el preparado tiene sus 4 líneas" || ko "el preparado tiene $(wc -l < "${D}/preparado.ndjson") líneas"
grep -q '^HECHO reservados=2$' "${T}/e1.log" && grep -q '^HECHO lineas=4$' "${T}/e1.log" && ok "informa solo conteos" || ko "no informó los conteos: $(cat "${T}/e1.log")"
grep -q 'Cliente Sintético\|SINT hola' "${T}/e1.log" && ko "la salida del script lleva datos" || ok "la salida del script no lleva nombres ni textos"
grep -q 'chatwoot_portal_reservar_contactos' "${FALSO_REGISTRO}" && grep -q 'read only' "${FALSO_REGISTRO}" \
  && ok "pide la reserva y la extracción en solo lectura" || ko "no pidió la reserva o la transacción de solo lectura"

DB=db-falso TENANT=t CUENTA=1 BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e2.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'ya_hay_un_preparado' "${T}/e2.log" && ok "no pisa un preparado que ya existe" || ko "pisó un preparado: ${rc}"

rm -rf "${D}"
FALSO_FALLA_EXTRAER=1 DB=db-falso TENANT=t CUENTA=1 BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e3.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && ok "si la extracción falla, extraer.sh falla" || ko "la extracción falló y extraer.sh salió con 0"
[ ! -e "${D}/preparado.ndjson" ] && [ ! -e "${D}/preparado.ndjson.parcial" ] && ok "si la extracción falla, no queda ni el preparado ni lo parcial" \
  || ko "quedó algo: $(ls -la "${D}" 2>&1)"

DB=db-falso TENANT=t CUENTA=1 BANDEJA=9 DIR="${T}/fuera" bash "${PH}/extraer.sh" > "${T}/e4.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'dir_no_es_dev_shm_portal_historial' "${T}/e4.log" && [ ! -e "${T}/fuera" ] && ok "extraer.sh no acepta un directorio fuera de /dev/shm" || ko "aceptó un directorio fuera de /dev/shm"

rm -rf "${D}"
DB=db-falso TENANT=t CUENTA='1; select 1' BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e5.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'cuenta_o_bandeja_no_numerica' "${T}/e5.log" && [ ! -e "${D}" ] \
  && ok "extraer.sh pide la cuenta en números, sin tocar nada" || ko "aceptó una cuenta no numérica: ${rc}"
DB=db-falso TENANT=t CUENTA=1 BANDEJA='' DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e6.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && [ ! -e "${D}" ] && ok "extraer.sh pide la bandeja" || ko "aceptó una bandeja vacía: ${rc}"
DB=db-falso TENANT=t CUENTA=1 BANDEJA=9x DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e7.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'cuenta_o_bandeja_no_numerica' "${T}/e7.log" && [ ! -e "${D}" ] \
  && ok "extraer.sh pide la bandeja en números" || ko "aceptó una bandeja no numérica: ${rc}"

# ── vincular.sh ──
rm -rf "${D}"
DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 CUENTA=1 BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > /dev/null 2>&1
printf '%s\n' '{"tipo":"cabecera","version":1,"corte":"2026-11-10T14:00:00.000000Z","contactos":1,"conversaciones":1,"mensajes":1}' \
  '{"tipo":"mensaje","mensaje":"50000000-0000-4000-8000-0000000000d1","mensaje_id":90001}' > "${D}/vinculos.ndjson"

FALSO_FALLA_VINCULAR=1 DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 DIR="${D}" bash "${PH}/vincular.sh" > "${T}/v1.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && ok "si la vinculación falla, vincular.sh falla" || ko "la vinculación falló y vincular.sh salió con 0"
[ -f "${D}/preparado.ndjson" ] && [ -f "${D}/vinculos.ndjson" ] && ok "si la vinculación falla, los archivos quedan para repetir" || ko "se borraron los archivos tras una falla"

: > "${FALSO_REGISTRO}"
DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 DIR="${D}" bash "${PH}/vincular.sh" > "${T}/v2.log" 2>&1; rc=$?
[ "${rc}" = 0 ] && grep -q '^HECHO contactos=1 hilos=1 mensajes=1$' "${T}/v2.log" && ok "vincular.sh sale bien e informa solo conteos" || ko "vincular.sh: ${rc} $(cat "${T}/v2.log")"
[ ! -e "${D}" ] && ok "si la vinculación sale bien, el directorio de /dev/shm se borra" || ko "quedó el directorio: $(ls -la "${D}" 2>&1)"
grep -q '"mensaje_id":90001' "${FALSO_REGISTRO}" && grep -q '"corte": "2026-11-10T14:00:00.000000Z"' "${FALSO_REGISTRO}" \
  && grep -q 'chatwoot_portal_vincular_carga' "${FALSO_REGISTRO}" && ok "le pasa a la vinculación los vínculos y la cabecera del preparado" \
  || ko "a la vinculación no le llegaron los vínculos o la cabecera"
grep -q 'SINT hola\|Cliente Sintético' "${FALSO_REGISTRO}" && ko "a la vinculación le llegó el texto del preparado" || ok "a la vinculación solo le llega la cabecera del preparado"

mkdir -p -m 0700 "${D}"
echo '{"tipo":"cabecera"}' > "${D}/preparado.ndjson"
printf '%s\n' '{"tipo":"cabecera","x":"a\\b"}' > "${D}/vinculos.ndjson"
DB=db-falso TENANT=t DIR="${D}" bash "${PH}/vincular.sh" > "${T}/v3.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'barra_invertida' "${T}/v3.log" && [ -e "${D}" ] && ok "vincular.sh rechaza la barra invertida sin tocar nada" || ko "aceptó una barra invertida: ${rc}"

# vincular.sh borra su directorio al terminar: fuera de /dev/shm se niega antes de tocar nada.
mkdir -p "${T}/fuera3"
cp "${D}/preparado.ndjson" "${T}/fuera3/preparado.ndjson"
printf '%s\n' '{"tipo":"cabecera"}' > "${T}/fuera3/vinculos.ndjson"
: > "${FALSO_REGISTRO}"
DB=db-falso TENANT=t DIR="${T}/fuera3" bash "${PH}/vincular.sh" > "${T}/v4.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'dir_no_es_dev_shm_portal_historial' "${T}/v4.log" && [ -f "${T}/fuera3/preparado.ndjson" ] && [ -f "${T}/fuera3/vinculos.ndjson" ] \
  && [ ! -s "${FALSO_REGISTRO}" ] && ok "vincular.sh no acepta un directorio fuera de /dev/shm ni lo borra" || ko "vincular.sh aceptó un directorio fuera de /dev/shm: ${rc}"
DB=db-falso TENANT=t DIR="/dev/shm/../${T#/}/fuera3" bash "${PH}/vincular.sh" > "${T}/v5.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'dir_no_es_dev_shm_portal_historial' "${T}/v5.log" && [ -d "${T}/fuera3" ] \
  && ok "vincular.sh no acepta salir de /dev/shm con .." || ko "vincular.sh aceptó /dev/shm/..: ${rc}"

# Un vinculos.ndjson sin salto de línea al final: su última línea entra entera al COPY.
rm -rf "${D}"
DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 CUENTA=1 BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > /dev/null 2>&1
printf '%s\n%s' '{"tipo":"cabecera","version":1,"corte":"2026-11-10T14:00:00.000000Z","contactos":1,"conversaciones":1,"mensajes":1}' \
  '{"tipo":"mensaje","mensaje":"50000000-0000-4000-8000-0000000000d2","mensaje_id":90002}' > "${D}/vinculos.ndjson"
: > "${FALSO_REGISTRO}"
DB=db-falso TENANT=10000000-0000-4000-8000-000000000001 DIR="${D}" bash "${PH}/vincular.sh" > "${T}/v6.log" 2>&1; rc=$?
[ "${rc}" = 0 ] && grep -qx '{"tipo":"mensaje","mensaje":"50000000-0000-4000-8000-0000000000d2","mensaje_id":90002}' "${FALSO_REGISTRO}" \
  && ok "vincular.sh acepta un vinculos.ndjson sin salto de línea al final" || ko "vinculos sin salto final: ${rc} $(grep -c 90002 "${FALSO_REGISTRO}")"
mkdir -p -m 0700 "${D}"

# ── El DIR: solo el nombre fijo, en los tres scripts ──
# Con el patrón /dev/shm/?* de 202b5daea, `DIR=/dev/shm//` en limpiar.sh borraba todo /dev/shm.
echo c > "${D}/centinela"
echo c > "${C}"
for s in extraer vincular limpiar; do
  for d in '/dev/shm//' '/dev/shm/' '/dev/shm/a/b' '/dev/shm/.x' '/dev/shm/../x'; do
    : > "${FALSO_REGISTRO}"
    DB=db-falso TENANT=t CUENTA=1 BANDEJA=9 DIR="${d}" bash "${PH}/${s}.sh" > "${T}/dir.log" 2>&1; rc=$?
    [ "${rc}" != 0 ] && grep -q 'dir_no_es_dev_shm_portal_historial' "${T}/dir.log" && [ -f "${D}/centinela" ] && [ -f "${C}" ] \
      && [ ! -s "${FALSO_REGISTRO}" ] && ok "${s}.sh rechaza DIR=${d} sin borrar nada" || ko "${s}.sh con DIR=${d}: ${rc} $(cat "${T}/dir.log")"
  done
done
rm -f "${C}"

# ── limpiar.sh ──
DIR="${D}" bash "${PH}/limpiar.sh" > /dev/null 2>&1
[ ! -e "${D}" ] && ok "limpiar.sh borra el directorio" || ko "limpiar.sh no borró el directorio"
mkdir -p "${T}/fuera2"
DIR="${T}/fuera2" bash "${PH}/limpiar.sh" > "${T}/l1.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && [ -e "${T}/fuera2" ] && ok "limpiar.sh no borra fuera de /dev/shm" || ko "limpiar.sh borró fuera de /dev/shm"
DIR="/dev/shm/../${T#/}/fuera2" bash "${PH}/limpiar.sh" > "${T}/l2.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && [ -e "${T}/fuera2" ] && ok "limpiar.sh no sale de /dev/shm con .." || ko "limpiar.sh borró con /dev/shm/.."

echo "== ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
