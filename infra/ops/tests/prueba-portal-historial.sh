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
#     salto de línea al final (revisiones del DG de la #456);
#   · deshacer-vinculos.sh (4.6b) sigue el orden de los .hecho: chatwoot-seco → studio-ensayo → chatwoot-borrar
#     → studio-aplicar, con el sha256 del .ndjson y el tenant. Con la carpeta durable (opción a de Sam) y 11 mutantes, uno por guarda (DG, 2026-11-09).
# Usa el nombre fijo de los scripts, /dev/shm/portal-historial: si ya existe (una carga de verdad en esta
# máquina), la prueba se niega a correr y no lo toca.
# Datos inventados: uuid y números sintéticos.
set -uo pipefail
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PH="${R}/infra/ops/portal-historial"
DS="${R}/supabase/cargas/portal-historial-deshacer"
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
# Los argumentos, como los vería `ps`: SISTEMA no tiene que estar aquí.
printf '%s\n' "$*" >> "${FALSO_ARGS:-/dev/null}"
# El entorno de docker: SISTEMA no tiene que llegar exportado (N1).
printf '%s\n' "${SISTEMA-__sin_sistema__}" >> "${FALSO_ENV:-/dev/null}"
case "${entrada}" in
  *deshacer_vinculos*)
    # El .ndjson cambia mientras corre psql: deshacer-vinculos.sh no tiene que dejar evidencia.
    if [ "${FALSO_CAMBIA_CONSERVADOS:-0}" = 1 ]; then printf '%s\n' '{"tipo":"contacto","x":1}' >> "${FALSO_CONSERVADOS:?}"; fi
    if [ "${FALSO_FALLA_DESHACER:-0}" = 1 ]; then echo 'ERROR:  sintético' >&2; exit 3; fi
    echo 'HECHO salida=1 hilos=1 espejo=1 contactos_vaciados=1 contactos_conservados=0 corte=nulo' ;;
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

# /dev/shm/portal-historial ya existe como enlace a otra carpeta: extraer.sh aborta sin escribir ni
# cambiar permisos en el destino. (Que la carpeta sea de otro usuario pide root; lo cubre el mismo `-O`.)
rm -rf "${D}"
mkdir -p "${T}/destino"; chmod 0755 "${T}/destino"
ln -s "${T}/destino" "${D}"
: > "${FALSO_REGISTRO}"
DB=db-falso TENANT=t CUENTA=1 BANDEJA=9 DIR="${D}" bash "${PH}/extraer.sh" > "${T}/e8.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && grep -q 'dir_no_propio_o_enlace' "${T}/e8.log" && [ -z "$(ls -A "${T}/destino")" ] \
  && [ "$(permisos "${T}/destino")" = 755 ] && [ ! -s "${FALSO_REGISTRO}" ] \
  && ok "extraer.sh no sigue un enlace en /dev/shm/portal-historial" || ko "extraer.sh siguió el enlace: ${rc} $(cat "${T}/e8.log")"
rm -f "${D}"

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

# ── deshacer-vinculos.sh (supabase/cargas/portal-historial-deshacer, el sub-paso 4.6b) ──
# El orden del 4.6b lo imponen los .hecho (DG, 2026-11-09): 1 chatwoot-seco → 2 studio-ensayo → 3 chatwoot-borrar
# → 4 studio-aplicar. Los de Chatwoot (1 y 3) los escribe la pieza de E5; aquí se escriben a mano, sintéticos.
TU=10000000-0000-4000-8000-000000000001
OTRO_T=10000000-0000-4000-8000-000000000002
CONS="${D}/contactos-conservados.ndjson"
export FALSO_CONSERVADOS="${CONS}"
# La carpeta durable (Sam eligió la opción a, 2026-11-09): en la prueba vive en el temporal, con DESHACER_PRUEBA=1.
DUR="${T}/deshacer"
# SISTEMA: un archivo 0600 de este usuario, con un system_identifier de mentira de 19 cifras.
SIS="${T}/sistema-produccion"
SISTEMA_VALOR=7234567890123456789
SISTEMA_SHA=deb576f0d6
poner_sistema() { ( umask 077; printf '%s' "${SISTEMA_VALOR}" > "${SIS}" ); chmod 0600 "${SIS}"; }
poner_sistema
dv() { DB=db-falso TENANT="${TENANT_DV:-$TU}" CUENTA=1 BANDEJA=9 ESPERADOS_SALIDA="${ESPERADOS_SALIDA_DV:-1}" ESPERADOS_HILOS=1 ESPERADOS_CONTACTOS=1 ESPERADOS_ESPEJO=1   ENTORNO="${ENTORNO_DV:-produccion}" DESHACER_SISTEMA="${SIS_DV:-$SIS}" DESHACER_SISTEMA_SHA="${SISTEMA_SHA_DV:-$SISTEMA_SHA}" DESHACER_SISTEMA_UID="${UID_DV:-$(id -u)}" MODO="${MODO_DV:-ensayo}" DIR="${DIR_DV:-$D}"   DESHACER_DURABLE="${DURABLE_DV:-$DUR}" DESHACER_PRUEBA="${PRUEBA_DV-1}"   bash "${DV_GUION:-${DS}/deshacer-vinculos.sh}" > "${T}/dv.log" 2>&1; }
cabecera() { printf '%s\n' '{"tipo":"cabecera","version":1,"tenant_id":"'"$TU"'","cuenta":1,"bandeja":9,"contactos":0}' > "${CONS}"; }
sha_cons() { sha256sum "${CONS}" | cut -c1-64; }
# hecho_cw <archivo> <paso> [sha] [tenant] [extra]: la evidencia sintética de un paso de Chatwoot.
hecho_cw() { printf '%s\n' "HECHO $2=ok conservados_sha256=${3:-$(sha_cons)} tenant=${4:-$TU} cuenta=1 bandeja=9 ${5:-}utc=2026-11-09T03:00:00Z" > "${D}/$1"; }
# sin_hecho: las dos carpetas vacías de verdad. Las secciones de arriba dejan cosas en ${D} (la centinela de los DIR):
# con solo borrar los .hecho, el primer caso_ensayo_ok fallaba y los mutantes que dependen de él «caían» sin probar nada.
sin_hecho() { rm -rf "${D}" "${DUR}"; mkdir -m 0700 "${D}"; poner_sistema; }
# paso3_durable: lo que deja el paso 3 de E5 en la carpeta durable (el .ndjson y los tres .hecho), y el
# «reinicio»: tmpfs vacío.
paso3_durable() { mkdir -m 0700 "${DUR}" && cp "${CONS}" "${D}/chatwoot-seco.hecho" "${D}/studio-ensayo.hecho" "${D}/chatwoot-borrar.hecho" "${DUR}/"; }
reinicio() { rm -rf "${D}"; }
OTRO_SHA=0000000000000000000000000000000000000000000000000000000000000000
mkdir -p -m 0700 "${D}"
rm -f "${CONS}"
: > "${FALSO_REGISTRO}"
dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'sin_contactos_conservados' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && ok "deshacer-vinculos.sh se niega sin el archivo de E5" || ko "deshacer sin archivo: ${rc} $(cat "${T}/dv.log")"
cabecera
MODO_DV=borrar dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'modo_invalido' "${T}/dv.log" && ok "deshacer-vinculos.sh pide MODO ensayo o aplicar" || ko "deshacer con modo inválido: ${rc}"
ENTORNO_DV=otro dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'entorno_invalido' "${T}/dv.log" && ok "deshacer-vinculos.sh pide ENTORNO copia o produccion" || ko "deshacer con entorno inválido: ${rc}"
rm -f "${SIS}"; dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'sin_archivo_de_sistema_0600' "${T}/dv.log" && ok "deshacer-vinculos.sh en produccion exige el archivo de SISTEMA" || ko "deshacer produccion sin sistema: ${rc}"
poner_sistema
TENANT_DV="t; select 1" dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'tenant_no_es_uuid' "${T}/dv.log" && ok "deshacer-vinculos.sh pide el tenant como uuid" || ko "deshacer con tenant no uuid: ${rc}"
ESPERADOS_SALIDA_DV=1x dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'numero_invalido' "${T}/dv.log" && ok "deshacer-vinculos.sh pide los conteos en números" || ko "deshacer con un conteo no numérico: ${rc}"
printf '%s\n' '{"tipo":"cabecera","x":"a\\b"}' > "${CONS}"
: > "${FALSO_REGISTRO}"
dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'barra_invertida_en_los_conservados' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && ok "deshacer-vinculos.sh rechaza la barra invertida sin llamar a psql" || ko "deshacer con barra invertida: ${rc}"
cabecera
DIR_DV=/dev/shm/ dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'dir_no_es_dev_shm_portal_historial' "${T}/dv.log" && ok "deshacer-vinculos.sh solo acepta /dev/shm/portal-historial" || ko "deshacer con otro DIR: ${rc}"

# Los casos del orden. Cada uno es una función que devuelve 0 si el guion hizo lo correcto: los mutantes de
# abajo corren el mismo caso con una guarda quitada y exigen que dé distinto de 0.
caso_seco_falta() { sin_hecho; cabecera; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && [ ! -e "${D}/studio-ensayo.hecho" ]; }
caso_seco_otro_sha() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco "${OTRO_SHA}"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_seco_otro_tenant() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco "" "${OTRO_T}"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_ensayo_ok() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; dv; rc=$?
  local s; s="$(sha_cons)"
  [ "${rc}" = 0 ] && grep -q '^HECHO modo=ensayo fin=rollback$' "${T}/dv.log" && grep -qx 'rollback;' "${FALSO_REGISTRO}" && ! grep -qx 'commit;' "${FALSO_REGISTRO}" \
    && grep -q 'pg_temp.deshacer_vinculos()' "${FALSO_REGISTRO}" && grep -qx '\\set VERBOSITY terse' "${FALSO_REGISTRO}" \
    && grep -qE "^HECHO studio_ensayo=ok conservados_sha256=${s} tenant=${TU} entorno=produccion fin=rollback utc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z$" "${D}/studio-ensayo.hecho" \
    && [ "$(permisos "${D}/studio-ensayo.hecho")" = 600 ] && grep -q '^HECHO studio_ensayo=ok' "${T}/dv.log" \
    && [ -z "$(ls -A "${D}" | grep -v -e '^contactos-conservados.ndjson$' -e '^chatwoot-seco.hecho$' -e '^studio-ensayo.hecho$')" ]; }
caso_ensayo_viejo() { caso_ensayo_ok || return 1; FALSO_FALLA_DESHACER=1 dv; rc=$?
  [ "${rc}" != 0 ] && [ ! -e "${D}/studio-ensayo.hecho" ]; }
caso_aplicar_sin_ensayo() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_ensayo_previo' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && [ ! -e "${D}/studio-aplicar.hecho" ]; }
caso_aplicar_ensayo_otro_sha() { caso_ensayo_ok || return 1; sed -i "s/conservados_sha256=[0-9a-f]*/conservados_sha256=${OTRO_SHA}/" "${D}/studio-ensayo.hecho"
  hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_ensayo_previo' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_aplicar_sin_borrar() { caso_ensayo_ok || return 1; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_borrado_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && [ ! -e "${D}/studio-aplicar.hecho" ]; }
caso_aplicar_borrar_otro_tenant() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "${OTRO_T}" "fin=commit "; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_borrado_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_aplicar_ok() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'commit;' "${FALSO_REGISTRO}" && ! grep -qx 'rollback;' "${FALSO_REGISTRO}" \
    && grep -qE "^HECHO studio_aplicar=ok conservados_sha256=$(sha_cons) tenant=${TU} entorno=produccion fin=commit utc=" "${D}/studio-aplicar.hecho" \
    && [ "$(permisos "${D}/studio-aplicar.hecho")" = 600 ]; }
caso_cambian_durante() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; FALSO_CAMBIA_CONSERVADOS=1 dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'conservados_cambiaron' "${T}/dv.log" && [ ! -e "${D}/studio-ensayo.hecho" ]; }
# La carpeta durable.
caso_reinicio() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; local s; s="$(sha_cons)"
  paso3_durable || return 1; reinicio; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'commit;' "${FALSO_REGISTRO}" \
    && grep -q "^HECHO studio_aplicar=ok conservados_sha256=${s} tenant=${TU} " "${D}/studio-aplicar.hecho" \
    && cmp -s "${D}/studio-aplicar.hecho" "${DUR}/studio-aplicar.hecho" && [ "$(permisos "${DUR}/studio-aplicar.hecho")" = 600 ] \
    && [ "$(permisos "${D}")" = 700 ] && [ ! -e "${D}/${CONS##*/}" ]; }
caso_durable_alterada() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "
  paso3_durable || return 1; printf '%s\n' '{"tipo":"contacto","x":2}' >> "${DUR}/${CONS##*/}"; reinicio; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && [ ! -e "${DUR}/studio-aplicar.hecho" ]; }
caso_copias_distintas() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "
  paso3_durable || return 1; sed -i 's/utc=2026-11-09T03:00:00Z/utc=2026-11-09T03:00:01Z/' "${DUR}/chatwoot-borrar.hecho"; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'copias_distintas' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_durable_no_0700() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "
  paso3_durable || return 1; chmod 0755 "${DUR}"; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  # tmpfs está completa: sin la guarda, el paso 4 seguiría con tmpfs y llamaría a psql. Con ella, no.
  chmod 0700 "${DUR}"; [ "${rc}" != 0 ] && grep -q 'durable_no_es_carpeta_0700' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_ensayo_no_usa_durable() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "
  paso3_durable || return 1; reinicio; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_contactos_conservados' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
# El simétrico de caso_durable_fijo: la durable es la fija y el archivo de SISTEMA no, sin DESHACER_PRUEBA. Sin la
# guarda, el ensayo seguiría y llamaría a psql (la durable fija no existe en el runner, y el ensayo no la usa).
# Los dos corren con ENTORNO=copia, que no lee SISTEMA: así, el mutante de cada guarda no lo frena otra guarda (la de
# la otra ruta, o el uid 0 de leer_sistema) y llega a psql (revisión del DG de la #480 en 65539df37).
caso_sistema_fijo() { [ ! -e /srv/ops/portal-historial/deshacer ] || return 1; sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; PRUEBA_DV= ENTORNO_DV=copia DURABLE_DV=/srv/ops/portal-historial/deshacer dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sistema_no_es_el_archivo_fijo' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_durable_fijo() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; PRUEBA_DV= ENTORNO_DV=copia SIS_DV=/srv/ops/portal-historial/sistema-produccion dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'durable_no_es_srv_ops_portal_historial_deshacer' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }

caso_seco_falta && ok "paso 2 sin chatwoot-seco.hecho: se niega sin llamar a psql" || ko "ensayo sin seco: $(cat "${T}/dv.log")"
caso_seco_otro_sha && ok "paso 2 con un seco de otro sha256: se niega" || ko "ensayo con seco de otro sha: $(cat "${T}/dv.log")"
caso_seco_otro_tenant && ok "paso 2 con un seco de otro tenant: se niega" || ko "ensayo con seco de otro tenant: $(cat "${T}/dv.log")"
caso_ensayo_ok && ok "paso 2 en ensayo: rollback, VERBOSITY terse y studio-ensayo.hecho en 0600 con el sha256 y el tenant; sin la foto" || ko "ensayo: $(cat "${T}/dv.log")"
caso_ensayo_viejo && ok "un ensayo que falla borra el studio-ensayo.hecho anterior" || ko "ensayo fallido deja el .hecho viejo"
caso_aplicar_sin_ensayo && ok "paso 4 sin studio-ensayo.hecho: se niega sin llamar a psql" || ko "aplicar sin ensayo: $(cat "${T}/dv.log")"
caso_aplicar_ensayo_otro_sha && ok "paso 4 con un ensayo de otro sha256: se niega" || ko "aplicar con ensayo de otro sha: $(cat "${T}/dv.log")"
caso_aplicar_sin_borrar && ok "paso 4 sin chatwoot-borrar.hecho: se niega sin llamar a psql" || ko "aplicar sin borrado de Chatwoot: $(cat "${T}/dv.log")"
caso_aplicar_borrar_otro_tenant && ok "paso 4 con un borrado de Chatwoot de otro tenant: se niega" || ko "aplicar con borrado de otro tenant: $(cat "${T}/dv.log")"
caso_aplicar_ok && ok "paso 4 en aplicar: commit y studio-aplicar.hecho en 0600" || ko "aplicar: $(cat "${T}/dv.log")"
caso_cambian_durante && ok "si el .ndjson cambia durante la corrida, no deja evidencia" || ko "conservados cambiados: $(cat "${T}/dv.log")"
caso_reinicio && ok "reinicio entre el 3 y el 4: el paso 4 corre con la copia durable y deja su evidencia en las dos carpetas" || ko "reinicio: $(cat "${T}/dv.log")"
caso_durable_alterada && ok "la copia durable alterada: el paso 4 se niega sin llamar a psql" || ko "durable alterada: $(cat "${T}/dv.log")"
caso_copias_distintas && ok "un archivo distinto en tmpfs y en la durable: el paso 4 se niega" || ko "copias distintas: $(cat "${T}/dv.log")"
caso_durable_no_0700 && ok "la carpeta durable sin 0700: el paso 4 se niega sin llamar a psql, aunque tmpfs esté completa" || ko "durable sin 0700: $(cat "${T}/dv.log")"
caso_ensayo_no_usa_durable && ok "el ensayo no lee la carpeta durable" || ko "ensayo con durable: $(cat "${T}/dv.log")"
# N2 (revisión del DG de la #480): cada campo que el guion exige, con su caso.
caso_seco_otra_cuenta() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; sed -i 's/ cuenta=1 / cuenta=2 /' "${D}/chatwoot-seco.hecho"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_seco_otra_bandeja() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; sed -i 's/ bandeja=9 / bandeja=8 /' "${D}/chatwoot-seco.hecho"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_seco_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_aplicar_ensayo_otro_entorno() { caso_ensayo_ok || return 1; sed -i 's/ entorno=produccion / entorno=copia /' "${D}/studio-ensayo.hecho"
  hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_ensayo_previo' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_aplicar_borrar_sin_fin_commit() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_borrado_de_chatwoot' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
# Un paso 4 que falla después de uno bueno no deja el studio-aplicar.hecho viejo en ninguna de las dos carpetas.
caso_aplicar_viejo() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; mkdir -m 0700 "${DUR}" || return 1
  MODO_DV=aplicar dv || return 1; [ -e "${D}/studio-aplicar.hecho" ] && [ -e "${DUR}/studio-aplicar.hecho" ] || return 1
  MODO_DV=aplicar FALSO_FALLA_DESHACER=1 dv; rc=$?
  [ "${rc}" != 0 ] && [ ! -e "${D}/studio-aplicar.hecho" ] && [ ! -e "${DUR}/studio-aplicar.hecho" ]; }
caso_seco_otra_cuenta && ok "paso 2 con un seco de otra cuenta: se niega" || ko "seco de otra cuenta: $(cat "${T}/dv.log")"
caso_seco_otra_bandeja && ok "paso 2 con un seco de otra bandeja: se niega" || ko "seco de otra bandeja: $(cat "${T}/dv.log")"
caso_aplicar_ensayo_otro_entorno && ok "paso 4 con un ensayo de otro entorno: se niega" || ko "ensayo de otro entorno: $(cat "${T}/dv.log")"
caso_aplicar_borrar_sin_fin_commit && ok "paso 4 con un chatwoot-borrar.hecho sin fin=commit: se niega" || ko "borrar sin fin=commit: $(cat "${T}/dv.log")"
caso_aplicar_viejo && ok "un paso 4 que falla borra el studio-aplicar.hecho anterior de las dos carpetas" || ko "aplicar fallido deja el .hecho viejo: $(cat "${T}/dv.log")"
# SISTEMA (aprobado por el DG): el system_identifier sale de un archivo 0600 y se imprime solo su sha256 corto, con
# la fórmula del DG (printf '%s', sin salto de línea). El valor de mentira tiene 19 cifras, como el real; su sha
# corto con printf es deb576f0d6 (con echo daría 937fa3b5f9).
caso_sistema_sha_corto() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; dv; rc=$?
  [ "${rc}" = 0 ] && grep -qx "HECHO sistema_sha256_corto=${SISTEMA_SHA}" "${T}/dv.log" && ! grep -q "${SISTEMA_VALOR}" "${T}/dv.log"; }
caso_sistema_sin_archivo() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; rm -f "${SIS}"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_archivo_de_sistema_0600' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_sistema_abierto() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; chmod 0644 "${SIS}"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_archivo_de_sistema_0600' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_sistema_en_el_entorno() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; SISTEMA="${SISTEMA_VALOR}" dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sistema_va_en_el_archivo_no_en_el_entorno' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_sistema_copia_sin_archivo() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; rm -f "${SIS}"; ENTORNO_DV=copia dv; rc=$?
  [ "${rc}" = 0 ] && ! grep -q 'sistema_sha256_corto' "${T}/dv.log"; }
[ "$(printf '%s' "${SISTEMA_VALOR}" | sha256sum | cut -c1-10)" = "${SISTEMA_SHA}" ] && ok "la fórmula del DG: printf '%s' de 19 cifras da ${SISTEMA_SHA}" || ko "la fórmula del sha corto no da ${SISTEMA_SHA}"
caso_sistema_sha_corto && ok "en produccion imprime solo el sha256 corto de SISTEMA, nunca el valor" || ko "sha corto de SISTEMA: $(cat "${T}/dv.log")"
caso_sistema_sin_archivo && ok "en produccion, sin el archivo de SISTEMA, se niega sin llamar a psql" || ko "sin archivo de SISTEMA: $(cat "${T}/dv.log")"
caso_sistema_abierto && ok "en produccion, con el archivo de SISTEMA en 0644, se niega sin llamar a psql" || ko "SISTEMA abierto: $(cat "${T}/dv.log")"
caso_sistema_en_el_entorno && ok "SISTEMA en el entorno se rechaza: va en el archivo" || ko "SISTEMA en el entorno: $(cat "${T}/dv.log")"
# N1 (revisión del DG de la #480 en a0c32c9cc): un SISTEMA= vacío y exportado pasa la guarda del entorno. El guion lo
# quita (unset), así que el valor leído del archivo no llega exportado al entorno de docker.
export FALSO_ENV="${T}/env.txt"
caso_sistema_no_exportado() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; : > "${FALSO_ENV}"; SISTEMA= dv; rc=$?
  [ "${rc}" = 0 ] && [ -s "${FALSO_REGISTRO}" ] && grep -qx '__sin_sistema__' "${FALSO_ENV}" && ! grep -q "${SISTEMA_VALOR}" "${FALSO_ENV}"; }
caso_sistema_no_exportado && ok "un SISTEMA= vacío y exportado no deja el valor del archivo en el entorno de docker" || ko "SISTEMA exportado: $(sed "s/${SISTEMA_VALOR}/<valor>/g" "${FALSO_ENV}")"
caso_sistema_copia_sin_archivo && ok "en la copia no pide ni imprime SISTEMA" || ko "copia sin SISTEMA: $(cat "${T}/dv.log")"
# El archivo de SISTEMA con un \n final da el mismo sha (lo quita el lector); con CR, un espacio o una segunda línea se
# rechaza (condición del DG al aprobar el 3.0).
sistema_con() { ( umask 077; printf "$1" "${SISTEMA_VALOR}" > "${SIS}" ); chmod 0600 "${SIS}"; }
caso_sistema_salto_final() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; sistema_con '%s\n'; dv; rc=$?
  [ "${rc}" = 0 ] && grep -qx "HECHO sistema_sha256_corto=${SISTEMA_SHA}" "${T}/dv.log"; }
caso_sistema_rechaza() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; sistema_con "$1"; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'archivo_de_sistema_no_es_un_numero' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] && ! grep -q "${SISTEMA_VALOR}" "${T}/dv.log"; }
caso_sistema_salto_final && ok "SISTEMA con un salto de línea final da el mismo sha corto (${SISTEMA_SHA})" || ko "SISTEMA con salto final: $(cat "${T}/dv.log")"
caso_sistema_rechaza '%s\r\n' && ok "SISTEMA con CR se rechaza sin llamar a psql" || ko "SISTEMA con CR: $(cat "${T}/dv.log")"
caso_sistema_rechaza '%s \n' && ok "SISTEMA con un espacio se rechaza sin llamar a psql" || ko "SISTEMA con espacio: $(cat "${T}/dv.log")"
caso_sistema_rechaza '%s\n1\n' && ok "SISTEMA con una segunda línea se rechaza sin llamar a psql" || ko "SISTEMA con dos líneas: $(cat "${T}/dv.log")"
# B1 (revisión del DG de la #480 en 65539df37): un archivo con otro identificador (el de staging, por ejemplo) se niega
# antes de psql, sin imprimir el valor. Fuera de la prueba, el esperado es el sha corto de producción.
OTRO_SISTEMA=7111111111111111111
caso_sistema_otro() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; ( umask 077; printf '%s' "${OTRO_SISTEMA}" > "${SIS}" ); chmod 0600 "${SIS}"
  : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q "sistema_no_es_el_de_produccion esperado=${SISTEMA_SHA}" "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ] \
    && ! grep -q "${OTRO_SISTEMA}" "${T}/dv.log"; }
# El archivo de SISTEMA tiene que ser de root (uid 0, «root 0600» del DG). En la prueba, el uid esperado es otro que el del runner.
caso_sistema_no_root() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; UID_DV=$(( $(id -u) + 1 )) dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'archivo_de_sistema_no_es_de_root' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
# SISTEMA entra a psql por la entrada (\set), no por -v: los argumentos se ven en `ps`.
export FALSO_ARGS="${T}/args.txt"
caso_sistema_por_stdin() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; : > "${FALSO_ARGS}"; dv; rc=$?
  [ "${rc}" = 0 ] && grep -qxF "\\set sistema '${SISTEMA_VALOR}'" "${FALSO_REGISTRO}" && [ -s "${FALSO_ARGS}" ] && ! grep -q "${SISTEMA_VALOR}" "${FALSO_ARGS}"; }
caso_sistema_otro && ok "en produccion, un archivo de SISTEMA con otro identificador se niega antes de psql y no imprime el valor" || ko "SISTEMA de otro sistema: $(cat "${T}/dv.log")"
caso_sistema_no_root && ok "en produccion, un archivo de SISTEMA que no es de root se niega sin llamar a psql" || ko "SISTEMA no de root: $(cat "${T}/dv.log")"
caso_sistema_por_stdin && ok "SISTEMA entra a psql por la entrada (\\set), no por los argumentos" || ko "SISTEMA por argumentos: $(cat "${FALSO_ARGS}" | sed "s/${SISTEMA_VALOR}/<valor>/g")"
grep -qx 'SISTEMA_SHA_ESPERADO=b4fbe1b236' "${DS}/deshacer-vinculos.sh" && grep -qx 'SISTEMA_UID=0' "${DS}/deshacer-vinculos.sh" \
  && ok "fuera de la prueba, el sha corto esperado es b4fbe1b236 (producción) y el uid del archivo es 0" || ko "el esperado de SISTEMA fuera de la prueba no es b4fbe1b236 y uid 0"
poner_sistema
caso_sistema_fijo && ok "fuera de la prueba, el archivo de SISTEMA es solo /srv/ops/portal-historial/sistema-produccion" || ko "SISTEMA no fijo: $(cat "${T}/dv.log")"
caso_durable_fijo && ok "fuera de la prueba, la durable es solo /srv/ops/portal-historial/deshacer" || ko "durable no fija: $(cat "${T}/dv.log")"
sin_hecho
printf '%s' '{"tipo":"cabecera","version":1,"tenant_id":"'"$TU"'","cuenta":1,"bandeja":9,"contactos":0}' > "${CONS}"
hecho_cw chatwoot-seco.hecho chatwoot_seco
: > "${FALSO_REGISTRO}"
dv; rc=$?
[ "${rc}" = 0 ] && grep -qx '{"tipo":"cabecera","version":1,"tenant_id":"'"$TU"'","cuenta":1,"bandeja":9,"contactos":0}' "${FALSO_REGISTRO}"   && ok "deshacer-vinculos.sh acepta el archivo de E5 sin salto de línea al final" || ko "deshacer sin salto final: ${rc} $(cat "${T}/dv.log")"

# MUTANTES: una copia del guion sin la línea de cada guarda (marcada `# guarda:<nombre>`); su caso tiene que fallar.
mkdir -p "${T}/mut"
cp "${DS}/deshacer-vinculos.sql" "${T}/mut/"
# probar_mutante <variable del guion> <guion real> <guarda> <caso>. La regla de la base limpia vale igual en los tres
# bucles (el desarme, el cierre y el abandono): el mutante solo cuenta si su caso PASA con el guion real y FALLA con
# el mutante. Devuelve 0 si cae, 1 si sobrevive, 2 si su caso no pasa con el guion real (el mutante no prueba nada)
# y 3 si la marca de la guarda no está una sola vez.
probar_mutante() {
  local var="$1" real="$2" g="$3" caso="$4" cambio="${5:-}" copia
  copia="${T}/mut/$(basename "$real")"
  [ "$(grep -c "# guarda:${g}\$" "$real")" = 1 ] || return 3
  "$caso" || return 2 # control:base
  if [ -n "$cambio" ]; then sed "/# guarda:${g}\$/ ${cambio}" "$real" > "$copia"; cmp -s "$real" "$copia" && return 3
  else grep -v "# guarda:${g}\$" "$real" > "$copia"; fi
  if ( export "$var=$copia"; "$caso" ); then return 1; fi
  return 0
}
# informar_mutante <código de probar_mutante> <guarda> <caso> <guion>
informar_mutante() {
  case "$1" in
    0) ok "mutante de $4 sin la guarda «$2» cae ($3)" ;;
    1) ko "mutante de $4 sin la guarda «$2» sobrevive ($3)" ;;
    2) ko "control: $3 no pasa con $4 real, así que el mutante «$2» no prueba nada" ;;
    *) ko "mutante $2: la marca no está una sola vez en $4" ;;
  esac
}
# MUTANTE DEL CONTROL: probar_mutante sin su línea `# control:base`, sacada de este mismo archivo. Con un caso que
# ya falla con el guion real, el control lo rechaza (2); sin el control, el mutante contaría como «cae» (0).
caso_siempre_falla() { return 1; }
probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" seco caso_siempre_falla; rc_con=$?
if [ "$(grep -c '# control:base$' "${BASH_SOURCE[0]}")" = 1 ]; then
  eval "$(sed -n '/^probar_mutante() {$/,/^}$/p' "${BASH_SOURCE[0]}" | grep -v '# control:base$' | sed '1s/^probar_mutante()/probar_mutante_sin_control()/')"
  probar_mutante_sin_control DV_GUION "${DS}/deshacer-vinculos.sh" seco caso_siempre_falla; rc_sin=$?
  [ "${rc_con}" = 2 ] && [ "${rc_sin}" = 0 ] \
    && ok "mutante del control: sin «el caso pasa primero con el guion real», un mutante vacío contaría como caído (${rc_sin}); con el control no cuenta (${rc_con})" \
    || ko "mutante del control: con el control da ${rc_con} (se espera 2) y sin él da ${rc_sin} (se espera 0)"
else
  ko "mutante del control: la marca control:base no está una sola vez"
fi
mutantes=0
for par in seco:caso_seco_falta sha:caso_seco_otro_sha tenant:caso_seco_otro_tenant viejo:caso_ensayo_viejo \
           ensayo:caso_aplicar_sin_ensayo borrar:caso_aplicar_sin_borrar despues:caso_cambian_durante \
           respaldo:caso_reinicio distintas:caso_copias_distintas durable0700:caso_durable_no_0700 \
           viejo_durable:caso_aplicar_viejo sistema_root:caso_sistema_no_root \
           sistema_entorno:caso_sistema_en_el_entorno sistema_0600:caso_sistema_abierto sistema_unset:caso_sistema_no_exportado; do
  g="${par%%:*}"; caso="${par#*:}"
  probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" "$g" "$caso"; r=$?
  informar_mutante "$r" "$g" "$caso" deshacer-vinculos.sh
  [ "$r" = 0 ] && mutantes=$((mutantes+1))
done
[ "${mutantes}" = 15 ] && ok "PISO: caen los 15 mutantes del orden, de la carpeta durable y de SISTEMA (uid, entorno, 0600 y unset)" || ko "caen ${mutantes} de 15 mutantes"
# N2 (revisión del DG de la #480 en a0c32c9cc): DESHACER_SISTEMA_SHA y DESHACER_SISTEMA_UID solo aparecen dentro del
# `if [ "${DESHACER_PRUEBA:-}" = 1 ]; then … fi`. Fuera de él, el esperado y el uid de producción no se pueden cambiar.
# El contrato exige al menos dos apariciones adentro (para que no pase vacío) y ninguna afuera.
contrato_solo_en_prueba() { awk -v si='if [ "${DESHACER_PRUEBA:-}" = 1 ]; then' '
  $0 == si { dentro = 1; next }
  dentro && $0 == "fi" { dentro = 0; next }
  index($0, "DESHACER_SISTEMA_SHA") || index($0, "DESHACER_SISTEMA_UID") { if (dentro) d++; else f++ }
  END { exit !(d >= 2 && f == 0) }' "$1"; }
contrato_solo_en_prueba "${DS}/deshacer-vinculos.sh" && ok "DESHACER_SISTEMA_SHA y DESHACER_SISTEMA_UID solo aparecen dentro del if de DESHACER_PRUEBA=1" || ko "DESHACER_SISTEMA_SHA o _UID fuera del if de la prueba, o no están"
# Su mutante: una copia con una línea más, fuera del if, que cambia el uid desde el entorno. El contrato la rechaza.
cp "${DS}/deshacer-vinculos.sh" "${T}/mut/n2-afuera.sh"
printf '%s\n' 'SISTEMA_UID="${DESHACER_SISTEMA_UID:-0}"' >> "${T}/mut/n2-afuera.sh"
! contrato_solo_en_prueba "${T}/mut/n2-afuera.sh" && ok "mutante del contrato N2: un DESHACER_SISTEMA_UID fuera del if se detecta" || ko "mutante del contrato N2: un DESHACER_SISTEMA_UID fuera del if pasa"
# MUTANTES que tienen que caer PORQUE LLEGAN A PSQL (revisión del DG de la #480 en 65539df37): no basta con que su caso
# falle, porque otra guarda podría frenarlos con otro texto. Después del mutante, el registro del docker falso tiene
# que tener la llamada.
mutantes_p=0
for par in durable_fijo:caso_durable_fijo sistema_fijo:caso_sistema_fijo sistema_esperado:caso_sistema_otro; do
  g="${par%%:*}"; caso="${par#*:}"
  probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" "$g" "$caso"; r=$?
  if [ "$r" = 0 ] && [ -s "${FALSO_REGISTRO}" ]; then ok "mutante de deshacer-vinculos.sh sin la guarda «$g» cae porque llega a psql ($caso)"; mutantes_p=$((mutantes_p+1))
  elif [ "$r" = 0 ]; then ko "mutante sin la guarda «$g» cae, pero sin llegar a psql: lo frena otra guarda ($caso)"
  else informar_mutante "$r" "$g" "$caso" deshacer-vinculos.sh; fi
done
[ "${mutantes_p}" = 3 ] && ok "PISO: caen llegando a psql los 3 mutantes de las rutas fijas y del SISTEMA esperado" || ko "caen llegando a psql ${mutantes_p} de 3 mutantes"
# MUTANTES de SISTEMA (con la misma regla): uno calcula el sha corto con echo (con salto de línea), otro imprime el
# valor en lugar del sha. Los dos tienen que caer en caso_sistema_sha_corto.
mutantes_s=0
probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" sistema_printf caso_sistema_sha_corto 's/printf .%s. "\$1"/echo "$1"/'; r=$?
informar_mutante "$r" sistema_printf caso_sistema_sha_corto deshacer-vinculos.sh; [ "$r" = 0 ] && mutantes_s=$((mutantes_s+1))
probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" sistema_corto caso_sistema_sha_corto 's/\$(sha_corto "\$SISTEMA")/$SISTEMA/'; r=$?
informar_mutante "$r" sistema_corto caso_sistema_sha_corto deshacer-vinculos.sh; [ "$r" = 0 ] && mutantes_s=$((mutantes_s+1))
# El tercero vuelve a pasar SISTEMA por -v (a la vista en `ps`): cae en caso_sistema_por_stdin.
probar_mutante DV_GUION "${DS}/deshacer-vinculos.sh" sistema_argv caso_sistema_por_stdin 's/-f -/-v sistema="$SISTEMA" -f -/'; r=$?
informar_mutante "$r" sistema_argv caso_sistema_por_stdin deshacer-vinculos.sh; [ "$r" = 0 ] && mutantes_s=$((mutantes_s+1))
[ "${mutantes_s}" = 3 ] && ok "PISO: caen los 3 mutantes de SISTEMA (echo, el valor en vez del sha, y por argumentos)" || ko "caen ${mutantes_s} de 3 mutantes de SISTEMA"
# Control: el guion de verdad pasa los casos de los mutantes (cada uno se comprobó también dentro del bucle).
caso_seco_falta && caso_aplicar_sin_borrar && caso_reinicio && caso_copias_distintas && caso_ensayo_ok && caso_ensayo_viejo && ok "control: el guion sin mutar pasa los casos de los mutantes" || ko "control del guion sin mutar"
sin_hecho; rm -rf "${DUR}"
rm -f "${CONS}"

# ── limpiar.sh ──
DIR="${D}" bash "${PH}/limpiar.sh" > /dev/null 2>&1
[ ! -e "${D}" ] && ok "limpiar.sh borra el directorio" || ko "limpiar.sh no borró el directorio"
mkdir -p "${T}/fuera2"
DIR="${T}/fuera2" bash "${PH}/limpiar.sh" > "${T}/l1.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && [ -e "${T}/fuera2" ] && ok "limpiar.sh no borra fuera de /dev/shm" || ko "limpiar.sh borró fuera de /dev/shm"
DIR="/dev/shm/../${T#/}/fuera2" bash "${PH}/limpiar.sh" > "${T}/l2.log" 2>&1; rc=$?
[ "${rc}" != 0 ] && [ -e "${T}/fuera2" ] && ok "limpiar.sh no sale de /dev/shm con .." || ko "limpiar.sh borró con /dev/shm/.."

# ── limpiar.sh --cierre-4-6b (el paso 5 del 4.6b) ──
lc() { DIR="${D}" DESHACER_SISTEMA="${SIS_DV:-$SIS}" DESHACER_DURABLE="${DURABLE_DV:-$DUR}" DESHACER_PRUEBA="${PRUEBA_DV-1}" bash "${LC_GUION:-${PH}/limpiar.sh}" "$@" > "${T}/lc.log" 2>&1; }
# cierre_listo [donde]: lo que queda después de un paso 4 bueno; [donde]=durable simula un reinicio después del 4.
cierre_listo() { caso_reinicio || return 1; [ "${1:-}" = durable ] && reinicio; return 0; }
caso_cierre_ok() { cierre_listo || return 1; lc --cierre-4-6b; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'HECHO cierre_4_6b=ok tmpfs=vacio durable=vacio' "${T}/lc.log" && grep -qx 'HECHO sistema=borrado' "${T}/lc.log" && [ ! -e "${D}" ] && [ ! -e "${DUR}" ] && [ ! -e "${SIS}" ]; }
caso_cierre_tras_reinicio() { cierre_listo durable || return 1; [ ! -e "${D}" ] && [ -e "${DUR}/studio-aplicar.hecho" ] || return 1
  lc --cierre-4-6b; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'HECHO cierre_4_6b=ok tmpfs=vacio durable=vacio' "${T}/lc.log" && [ ! -e "${D}" ] && [ ! -e "${DUR}" ]; }
caso_cierre_sin_aplicar() { cierre_listo || return 1; rm -f "${D}/studio-aplicar.hecho" "${DUR}/studio-aplicar.hecho"; lc --cierre-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_aplicar_del_4_6b' "${T}/lc.log" && [ -e "${DUR}/${CONS##*/}" ] && [ -e "${DUR}/chatwoot-borrar.hecho" ] && [ -e "${D}" ]; }
caso_cierre_otro_sha() { cierre_listo || return 1; sed -i "s/conservados_sha256=[0-9a-f]*/conservados_sha256=${OTRO_SHA}/" "${D}/studio-aplicar.hecho"; lc --cierre-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'aplicar_de_otros_conservados' "${T}/lc.log" && [ -e "${DUR}" ] && [ -e "${D}" ]; }
caso_cierre_durable_abierta() { cierre_listo || return 1; chmod 0755 "${DUR}"; lc --cierre-4-6b; rc=$?
  chmod 0700 "${DUR}"; [ "${rc}" != 0 ] && grep -q 'durable_no_es_carpeta_0700' "${T}/lc.log" && [ -e "${DUR}" ]; }
caso_cierre_ok && ok "limpiar.sh --cierre-4-6b borra las dos carpetas y lo comprueba" || ko "cierre: $(cat "${T}/lc.log")"
caso_cierre_tras_reinicio && ok "limpiar.sh --cierre-4-6b encuentra studio-aplicar.hecho en la durable después de un reinicio" || ko "cierre tras reinicio: $(cat "${T}/lc.log")"
caso_cierre_sin_aplicar_ni_ndjson() { cierre_listo || return 1; rm -f "${D}/studio-aplicar.hecho" "${DUR}/studio-aplicar.hecho" "${D}/${CONS##*/}" "${DUR}/${CONS##*/}"; lc --cierre-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_aplicar_del_4_6b' "${T}/lc.log" && [ -e "${DUR}" ] && [ -e "${D}" ]; }
caso_cierre_sin_aplicar_ni_ndjson && ok "limpiar.sh --cierre-4-6b sin studio-aplicar.hecho ni .ndjson no borra nada" || ko "cierre sin aplicar ni ndjson: $(cat "${T}/lc.log")"
caso_cierre_sin_aplicar && ok "limpiar.sh --cierre-4-6b sin studio-aplicar.hecho no borra nada" || ko "cierre sin aplicar: $(cat "${T}/lc.log")"
caso_cierre_otro_sha && ok "limpiar.sh --cierre-4-6b con un aplicar de otro sha256 no borra nada" || ko "cierre otro sha: $(cat "${T}/lc.log")"
caso_cierre_durable_abierta && ok "limpiar.sh --cierre-4-6b con la durable sin 0700 no borra nada" || ko "cierre durable abierta: $(cat "${T}/lc.log")"
sin_hecho; mkdir -m 0700 "${DUR}"; : > "${DUR}/x"; lc; rc=$?
[ "${rc}" = 0 ] && [ ! -e "${D}" ] && [ -e "${DUR}/x" ] && ok "limpiar.sh sin opción sigue igual: borra solo tmpfs, no la durable" || ko "limpiar.sh sin opción tocó la durable: $(cat "${T}/lc.log")"
lc --otra; rc=$?
[ "${rc}" != 0 ] && grep -q 'opcion_desconocida' "${T}/lc.log" && ok "limpiar.sh rechaza una opción desconocida" || ko "limpiar.sh con opción desconocida: ${rc}"
rm -rf "${DUR}"; mkdir -p -m 0700 "${D}"; : > "${D}/x"; PRUEBA_DV= lc --cierre-4-6b; rc=$?
[ "${rc}" != 0 ] && grep -q 'durable_no_es_srv_ops_portal_historial_deshacer' "${T}/lc.log" && [ -e "${D}/x" ] && ok "fuera de la prueba, el cierre usa solo la durable fija" || ko "cierre con durable no fija: $(cat "${T}/lc.log")"
# Si la durable real existe (en el VPS), estos dos casos no corren: el mutante de limpiar.sh la borraría.
caso_limpiar_sistema_fijo() { [ ! -e /srv/ops/portal-historial/deshacer ] || return 1; sin_hecho; : > "${D}/x"; PRUEBA_DV= DURABLE_DV=/srv/ops/portal-historial/deshacer lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sistema_no_es_el_archivo_fijo' "${T}/lc.log" && [ -e "${D}/x" ] && [ -e "${SIS}" ]; }
caso_limpiar_sistema_fijo && ok "fuera de la prueba, limpiar.sh usa solo el archivo de SISTEMA fijo, y no borra nada" || ko "limpiar con SISTEMA no fijo: $(cat "${T}/lc.log")"
# La guarda de la durable fija, aislada: el SISTEMA es el fijo (no existe en el runner), así que la guarda de SISTEMA
# no frena al mutante, y el abandono borraría tmpfs (la x).
caso_limpiar_durable_fijo() { [ ! -e /srv/ops/portal-historial/sistema-produccion ] || return 1; sin_hecho; : > "${D}/x"
  PRUEBA_DV= SIS_DV=/srv/ops/portal-historial/sistema-produccion lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'durable_no_es_srv_ops_portal_historial_deshacer' "${T}/lc.log" && [ -e "${D}/x" ]; }
caso_limpiar_durable_fijo && ok "fuera de la prueba, el abandono usa solo la durable fija, y no borra nada" || ko "abandono con durable no fija: $(cat "${T}/lc.log")"
# MUTANTES del cierre: una copia de limpiar.sh sin la guarda; su caso tiene que fallar (con la misma regla).
mutantes_c=0
for par in aplicar:caso_cierre_sin_aplicar_ni_ndjson sha_cierre:caso_cierre_otro_sha sistema_fijo:caso_limpiar_sistema_fijo durable_fijo:caso_limpiar_durable_fijo; do
  g="${par%%:*}"; caso="${par#*:}"
  probar_mutante LC_GUION "${PH}/limpiar.sh" "$g" "$caso"; r=$?
  informar_mutante "$r" "$g" "$caso" limpiar.sh
  [ "$r" = 0 ] && mutantes_c=$((mutantes_c+1))
done
[ "${mutantes_c}" = 4 ] && ok "PISO: caen los 4 mutantes del cierre y de las rutas fijas" || ko "caen ${mutantes_c} de 4 mutantes del cierre"
rm -rf "${D}" "${DUR}"

# ── limpiar.sh --abandono-4-6b (abandonar el 4.6b antes de que el paso 3 confirme) ──
# abandono_listo: lo que queda si el paso 3 empezó (dejó la durable) pero no confirmó: sin chatwoot-borrar.hecho.
abandono_listo() { caso_ensayo_ok || return 1; mkdir -m 0700 "${DUR}" && cp "${CONS}" "${D}/chatwoot-seco.hecho" "${D}/studio-ensayo.hecho" "${DUR}/"; }
caso_abandono_ok() { abandono_listo || return 1; lc --abandono-4-6b; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'HECHO abandono_4_6b=ok tmpfs=vacio durable=vacio' "${T}/lc.log" && grep -qx 'HECHO sistema=borrado' "${T}/lc.log" && [ ! -e "${D}" ] && [ ! -e "${DUR}" ] && [ ! -e "${SIS}" ]; }
caso_abandono_con_borrar_durable() { abandono_listo || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; cp "${D}/chatwoot-borrar.hecho" "${DUR}/"; reinicio; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'chatwoot_ya_borro_hay_que_terminar_el_paso_4' "${T}/lc.log" && [ -e "${DUR}/${CONS##*/}" ] && [ -e "${DUR}/chatwoot-borrar.hecho" ]; }
caso_abandono_con_borrar_tmpfs() { abandono_listo || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'chatwoot_ya_borro_hay_que_terminar_el_paso_4' "${T}/lc.log" && [ -e "${D}/${CONS##*/}" ] && [ -e "${DUR}/${CONS##*/}" ]; }
caso_abandono_ok && ok "limpiar.sh --abandono-4-6b sin chatwoot-borrar.hecho borra las dos carpetas y lo comprueba" || ko "abandono: $(cat "${T}/lc.log")"
caso_abandono_con_borrar_durable && ok "limpiar.sh --abandono-4-6b con chatwoot-borrar.hecho en la durable (tras un reinicio) se niega y no toca nada" || ko "abandono con borrar en la durable: $(cat "${T}/lc.log")"
caso_abandono_con_borrar_tmpfs && ok "limpiar.sh --abandono-4-6b con chatwoot-borrar.hecho en tmpfs se niega y no toca nada" || ko "abandono con borrar en tmpfs: $(cat "${T}/lc.log")"
# B1 (revisión del DG de la #480): el .hecho puede faltar aunque Chatwoot confirmó. Queda el chatwoot-borrar.inicio
# que el paso 3 escribe en la durable antes de abrir su transacción (formato de E5, 0586-p4-2c-orden-4-6b.md).
inicio_cw() { printf '%s\n' "INICIO chatwoot_borrar=en_curso conservados_sha256=$(sha256sum "${DUR}/${CONS##*/}" | cut -c1-64) tenant=${TU} cuenta=1 bandeja=9 utc=2026-11-09T03:00:00Z" > "${DUR}/chatwoot-borrar.inicio"; }
# Camino 1: el guion se cortó entre el COMMIT y la escritura del .hecho. Queda el .inicio, sin .hecho en ninguna.
caso_abandono_corte_tras_commit() { abandono_listo || return 1; inicio_cw; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'borrado_de_chatwoot_empezado_ver_runbook' "${T}/lc.log" && [ -e "${DUR}/${CONS##*/}" ] && [ -e "${DUR}/chatwoot-borrar.inicio" ] && [ -e "${D}" ]; }
# Camino 2: el borrado confirmó (el .inicio se queda) y después alguien borró el .hecho de las dos copias, y el VPS
# se reinició. La durable conserva el .inicio.
caso_abandono_hecho_borrado() { abandono_listo || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; cp "${D}/chatwoot-borrar.hecho" "${DUR}/"; inicio_cw
  rm -f "${D}/chatwoot-borrar.hecho" "${DUR}/chatwoot-borrar.hecho"; reinicio; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'borrado_de_chatwoot_empezado_ver_runbook' "${T}/lc.log" && [ -e "${DUR}/${CONS##*/}" ] && [ -e "${DUR}/chatwoot-borrar.inicio" ]; }
caso_abandono_corte_tras_commit && ok "limpiar.sh --abandono-4-6b con chatwoot-borrar.inicio y sin .hecho (corte tras el COMMIT) se niega y no toca nada" || ko "abandono con .inicio: $(cat "${T}/lc.log")"
caso_abandono_hecho_borrado && ok "limpiar.sh --abandono-4-6b con el .hecho borrado de las dos copias y el .inicio en la durable se niega y no toca nada" || ko "abandono con .hecho borrado: $(cat "${T}/lc.log")"
# MUTANTES del abandono (con la misma regla): sin la guarda del .hecho, borraría la durable después de un COMMIT de
# Chatwoot; sin la del .inicio, la borraría en los dos caminos del B1.
mutantes_a=0
for par in abandono:caso_abandono_con_borrar_durable abandono_inicio:caso_abandono_corte_tras_commit abandono_inicio:caso_abandono_hecho_borrado; do
  g="${par%%:*}"; caso="${par#*:}"
  probar_mutante LC_GUION "${PH}/limpiar.sh" "$g" "$caso"; r=$?
  informar_mutante "$r" "$g" "$caso" limpiar.sh
  [ "$r" = 0 ] && mutantes_a=$((mutantes_a+1))
done
[ "${mutantes_a}" = 3 ] && ok "PISO: caen los 3 mutantes del abandono" || ko "caen ${mutantes_a} de 3 mutantes del abandono"
rm -rf "${D}" "${DUR}"

# CONTRATO DE TIPOS (el --solo-copia del 2026-11-14): las tablas del CRM que el esquema de la copia
# (ensayo-studio-esquema.sql) y el fixture de la producción simulada (pruebas/studio-fixture.sql) escriben a mano tienen
# que tener el tipo de 0506_crm_modelo.sql en cada columna de la lista. crm_historial_etapas.id era uuid en los dos, y
# bigint en producción: el COPY falló, y la prueba de Actions no lo vio porque su «producción» tenía el mismo error.
# tipo_col archivo tabla columna: la primera palabra después del nombre de la columna en su `create table`.
tipo_col() {
  awk -v t="create table public.$2 (" -v c="$3" '
    !hecho && index($0, t) { en = 1; $0 = substr($0, index($0, t) + length(t)) }
    en { b = b " " $0; if ($0 ~ /\);/) { en = 0; hecho = 1 } }
    END {
      n = split(b, p, ",")
      for (i = 1; i <= n; i++) { s = p[i]; sub(/^[ \t]+/, "", s); split(s, w, /[ \t]+/); if (w[1] == c) { print w[2]; exit } }
    }' "$1"
}
M0506="${R}/supabase/migrations/0506_crm_modelo.sql"
contrato_tipos() { # esquema fixture: 0 si las 6 columnas tienen el tipo de la 0506
  local tabla col real n=0
  for tabla in crm_tarjetas crm_tareas crm_historial_etapas; do
    for col in id tenant_id; do
      real="$(tipo_col "${M0506}" "${tabla}" "${col}")"
      [ -n "${real}" ] && [ "$(tipo_col "$1" "${tabla}" "${col}")" = "${real}" ] && [ "$(tipo_col "$2" "${tabla}" "${col}")" = "${real}" ] && n=$((n+1))
    done
  done
  [ "${n}" = 6 ]
}
contrato_tipos "${PH}/ensayo-studio-esquema.sql" "${PH}/pruebas/studio-fixture.sql" \
  && ok "contrato de tipos: las 3 tablas del CRM del esquema de la copia y del fixture tienen los tipos de la 0506 (crm_historial_etapas.id $(tipo_col "${M0506}" crm_historial_etapas id))" \
  || ko "contrato de tipos: el esquema de la copia o el fixture no tienen los tipos de la 0506"
# MUTANTES del contrato, cada uno en su caso: el id de crm_historial_etapas vuelve a uuid en el esquema, o en el fixture.
for lado in esquema fixture; do
  cp "${PH}/ensayo-studio-esquema.sql" "${T}/esquema.sql"; cp "${PH}/pruebas/studio-fixture.sql" "${T}/fixture.sql"
  sed -i 's/^  id           bigint generated by default as identity primary key,$/  id           uuid primary key default gen_random_uuid(),/' "${T}/${lado}.sql"
  if cmp -s "${T}/${lado}.sql" "${PH}/$([ "${lado}" = esquema ] && echo ensayo-studio-esquema.sql || echo pruebas/studio-fixture.sql)"; then
    ko "MUTANTE del contrato de tipos (${lado}): no se pudo aplicar"
  elif contrato_tipos "${T}/esquema.sql" "${T}/fixture.sql"; then
    ko "MUTANTE del contrato de tipos (${lado}): crm_historial_etapas.id uuid SOBREVIVE"
  else
    ok "MUTANTE del contrato de tipos (${lado}): crm_historial_etapas.id uuid cae"
  fi
done
rm -f "${T}/esquema.sql" "${T}/fixture.sql"

# LA CONSULTA DE LA GUARDA DE TIPOS EN UN POSTGRES REAL (revisión del DG de la #563, B2): tipos_sql de ensayo-portal.sh
# arma la consulta del catálogo y PGlite la ejecuta. Un `order by 1 collate "C"` pasó los dobles de psql y Postgres lo
# rechaza («collations are not supported by type integer»). Pide node_modules (la Calidad instala antes).
tipos_en_pglite() { # guion lado → la salida de tipos-guarda-pglite.mjs
  bash -c 'eval "$(sed -n "/^tipos_sql() {/,/^}/p" "$1")"; LISTA="$2"; tipos_sql "$3"' _ "$1" "${PH}/copia-columnas.tsv" "$2" > "${T}/tipos-$2.sql" || return 1
  node "${R}/infra/ops/tests/tipos-guarda-pglite.mjs" "${T}/tipos-$2.sql"
}
for lado in studio chatwoot; do
  n="$(awk -F'\t' -v l="${lado}" '$1 == l { n += split($3, c, ";") } END { print n + 0 }' "${PH}/copia-columnas.tsv")"
  s="$(tipos_en_pglite "${PH}/ensayo-portal.sh" "${lado}" 2>&1)"
  if printf '%s\n' "${s}" | grep -qx "filas=${n} ausentes=[0-9]* orden_c=si" && { [ "${lado}" = chatwoot ] || printf '%s\n' "${s}" | grep -qx 'tipo public.crm_historial_etapas.id:bigint'; }; then
    ok "la consulta de la guarda de tipos corre en PGlite (${lado}): ${n} filas, ordenadas como LC_ALL=C sort"
  else
    ko "la consulta de la guarda de tipos en PGlite (${lado}): $(printf '%s' "${s}" | head -c 300)"
  fi
done
# MUTANTE: con el `order by 1 collate "C"` de la 17ad4e510, Postgres rechaza la consulta.
cp "${PH}/ensayo-portal.sh" "${T}/ensayo-b2.sh"
sed -i 's/), \\047ausente\\047)) collate \\042C\\042 from (values " v ") v(t, c) order by 1"$/), \\047ausente\\047) from (values " v ") v(t, c) order by 1 collate \\042C\\042"/; s/print "select (v\.t || /print "select v.t || /' "${T}/ensayo-b2.sh"
if cmp -s "${T}/ensayo-b2.sh" "${PH}/ensayo-portal.sh"; then
  ko "MUTANTE B2 de la guarda de tipos: no se pudo aplicar"
elif tipos_en_pglite "${T}/ensayo-b2.sh" studio > "${T}/b2.txt" 2>&1; then
  ko "MUTANTE B2 de la guarda de tipos: la consulta con «order by 1 collate» SOBREVIVE ($(head -c 200 "${T}/b2.txt"))"
else
  grep -q 'collations_are_not_supported' "${T}/b2.txt" && ok "MUTANTE B2 de la guarda de tipos: «order by 1 collate» cae en PGlite" \
    || ko "MUTANTE B2 de la guarda de tipos: cae por otro motivo ($(head -c 200 "${T}/b2.txt"))"
fi
rm -f "${T}/ensayo-b2.sh" "${T}/b2.txt" "${T}/tipos-studio.sql" "${T}/tipos-chatwoot.sql"

echo "== ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
