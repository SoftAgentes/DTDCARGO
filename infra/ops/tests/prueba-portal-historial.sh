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
DUR="${T}/durable"
dv() { DB=db-falso TENANT="${TENANT_DV:-$TU}" CUENTA=1 BANDEJA=9 ESPERADOS_SALIDA="${ESPERADOS_SALIDA_DV:-1}" ESPERADOS_HILOS=1 ESPERADOS_CONTACTOS=1 ESPERADOS_ESPEJO=1   ENTORNO="${ENTORNO_DV:-produccion}" SISTEMA="${SISTEMA_DV-7234567890123456789}" MODO="${MODO_DV:-ensayo}" DIR="${DIR_DV:-$D}"   DURABLE="${DURABLE_DV:-$DUR}" DESHACER_PRUEBA="${PRUEBA_DV-1}"   bash "${DV_GUION:-${DS}/deshacer-vinculos.sh}" > "${T}/dv.log" 2>&1; }
cabecera() { printf '%s\n' '{"tipo":"cabecera","version":1,"tenant_id":"'"$TU"'","cuenta":1,"bandeja":9,"contactos":0}' > "${CONS}"; }
sha_cons() { sha256sum "${CONS}" | cut -c1-64; }
# hecho_cw <archivo> <paso> [sha] [tenant] [extra]: la evidencia sintética de un paso de Chatwoot.
hecho_cw() { printf '%s\n' "HECHO $2=ok conservados_sha256=${3:-$(sha_cons)} tenant=${4:-$TU} cuenta=1 bandeja=9 ${5:-}utc=2026-11-09T03:00:00Z" > "${D}/$1"; }
# sin_hecho: las dos carpetas vacías de verdad. Las secciones de arriba dejan cosas en ${D} (la centinela de los DIR):
# con solo borrar los .hecho, el primer caso_ensayo_ok fallaba y los mutantes que dependen de él «caían» sin probar nada.
sin_hecho() { rm -rf "${D}" "${DUR}"; mkdir -m 0700 "${D}"; }
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
SISTEMA_DV= dv; rc=$?
[ "${rc}" != 0 ] && grep -q 'produccion_exige_sistema' "${T}/dv.log" && ok "deshacer-vinculos.sh en produccion exige SISTEMA" || ko "deshacer produccion sin sistema: ${rc}"
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
  paso3_durable || return 1; chmod 0755 "${DUR}"; reinicio; : > "${FALSO_REGISTRO}"; MODO_DV=aplicar dv; rc=$?
  chmod 0700 "${DUR}"; [ "${rc}" != 0 ] && grep -q 'durable_no_es_carpeta_0700' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_ensayo_no_usa_durable() { caso_ensayo_ok || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "
  paso3_durable || return 1; reinicio; : > "${FALSO_REGISTRO}"; dv; rc=$?
  [ "${rc}" != 0 ] && grep -q 'sin_contactos_conservados' "${T}/dv.log" && [ ! -s "${FALSO_REGISTRO}" ]; }
caso_durable_fijo() { sin_hecho; cabecera; hecho_cw chatwoot-seco.hecho chatwoot_seco; : > "${FALSO_REGISTRO}"; PRUEBA_DV= dv; rc=$?
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
caso_durable_no_0700 && ok "la carpeta durable sin 0700: el paso 4 se niega" || ko "durable sin 0700: $(cat "${T}/dv.log")"
caso_ensayo_no_usa_durable && ok "el ensayo no lee la carpeta durable" || ko "ensayo con durable: $(cat "${T}/dv.log")"
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
# Cada mutante cuenta solo si su caso PASA con el guion real y FALLA con el mutante: si no, el mutante no prueba nada.
mutantes=0
for par in seco:caso_seco_falta sha:caso_seco_otro_sha tenant:caso_seco_otro_tenant viejo:caso_ensayo_viejo \
           ensayo:caso_aplicar_sin_ensayo borrar:caso_aplicar_sin_borrar despues:caso_cambian_durante \
           respaldo:caso_reinicio distintas:caso_copias_distintas durable0700:caso_durable_no_0700 durable_fijo:caso_durable_fijo; do
  g="${par%%:*}"; caso="${par#*:}"
  [ "$(grep -c "# guarda:${g}\$" "${DS}/deshacer-vinculos.sh")" = 1 ] || { ko "mutante ${g}: la marca no está una sola vez"; continue; }
  "${caso}" || { ko "control: ${caso} no pasa con el guion real, así que el mutante «${g}» no prueba nada"; continue; }
  grep -v "# guarda:${g}\$" "${DS}/deshacer-vinculos.sh" > "${T}/mut/deshacer-vinculos.sh"
  if DV_GUION="${T}/mut/deshacer-vinculos.sh" "${caso}"; then ko "mutante sin la guarda «${g}» sobrevive (${caso})"
  else ok "mutante sin la guarda «${g}» cae (${caso})"; mutantes=$((mutantes+1)); fi
done
[ "${mutantes}" = 11 ] && ok "PISO: caen los 11 mutantes del orden y de la carpeta durable" || ko "caen ${mutantes} de 11 mutantes"
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
lc() { DIR="${D}" DURABLE="${DURABLE_DV:-$DUR}" DESHACER_PRUEBA="${PRUEBA_DV-1}" bash "${LC_GUION:-${PH}/limpiar.sh}" "$@" > "${T}/lc.log" 2>&1; }
# cierre_listo [donde]: lo que queda después de un paso 4 bueno; [donde]=durable simula un reinicio después del 4.
cierre_listo() { caso_reinicio || return 1; [ "${1:-}" = durable ] && reinicio; return 0; }
caso_cierre_ok() { cierre_listo || return 1; lc --cierre-4-6b; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'HECHO cierre_4_6b=ok tmpfs=vacio durable=vacio' "${T}/lc.log" && [ ! -e "${D}" ] && [ ! -e "${DUR}" ]; }
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
caso_cierre_sin_aplicar && ok "limpiar.sh --cierre-4-6b sin studio-aplicar.hecho no borra nada" || ko "cierre sin aplicar: $(cat "${T}/lc.log")"
caso_cierre_otro_sha && ok "limpiar.sh --cierre-4-6b con un aplicar de otro sha256 no borra nada" || ko "cierre otro sha: $(cat "${T}/lc.log")"
caso_cierre_durable_abierta && ok "limpiar.sh --cierre-4-6b con la durable sin 0700 no borra nada" || ko "cierre durable abierta: $(cat "${T}/lc.log")"
sin_hecho; mkdir -m 0700 "${DUR}"; : > "${DUR}/x"; lc; rc=$?
[ "${rc}" = 0 ] && [ ! -e "${D}" ] && [ -e "${DUR}/x" ] && ok "limpiar.sh sin opción sigue igual: borra solo tmpfs, no la durable" || ko "limpiar.sh sin opción tocó la durable: $(cat "${T}/lc.log")"
lc --otra; rc=$?
[ "${rc}" != 0 ] && grep -q 'opcion_desconocida' "${T}/lc.log" && ok "limpiar.sh rechaza una opción desconocida" || ko "limpiar.sh con opción desconocida: ${rc}"
rm -rf "${DUR}"; mkdir -p -m 0700 "${D}"; : > "${D}/x"; PRUEBA_DV= lc --cierre-4-6b; rc=$?
[ "${rc}" != 0 ] && grep -q 'durable_no_es_srv_ops_portal_historial_deshacer' "${T}/lc.log" && [ -e "${D}/x" ] && ok "fuera de la prueba, el cierre usa solo la durable fija" || ko "cierre con durable no fija: $(cat "${T}/lc.log")"
# MUTANTES del cierre: una copia de limpiar.sh sin la guarda; su caso tiene que fallar.
mutantes_c=0
for par in aplicar:caso_cierre_sin_aplicar sha_cierre:caso_cierre_otro_sha; do
  g="${par%%:*}"; caso="${par#*:}"
  [ "$(grep -c "# guarda:${g}\$" "${PH}/limpiar.sh")" = 1 ] || { ko "mutante ${g}: la marca no está una sola vez"; continue; }
  "${caso}" || { ko "control: ${caso} no pasa con limpiar.sh real, así que el mutante «${g}» no prueba nada"; continue; }
  grep -v "# guarda:${g}\$" "${PH}/limpiar.sh" > "${T}/mut/limpiar.sh"
  if LC_GUION="${T}/mut/limpiar.sh" "${caso}"; then ko "mutante de limpiar.sh sin la guarda «${g}» sobrevive (${caso})"
  else ok "mutante de limpiar.sh sin la guarda «${g}» cae (${caso})"; mutantes_c=$((mutantes_c+1)); fi
done
[ "${mutantes_c}" = 2 ] && ok "PISO: caen los 2 mutantes del cierre" || ko "caen ${mutantes_c} de 2 mutantes del cierre"
rm -rf "${D}" "${DUR}"

# ── limpiar.sh --abandono-4-6b (abandonar el 4.6b antes de que el paso 3 confirme) ──
# abandono_listo: lo que queda si el paso 3 empezó (dejó la durable) pero no confirmó: sin chatwoot-borrar.hecho.
abandono_listo() { caso_ensayo_ok || return 1; mkdir -m 0700 "${DUR}" && cp "${CONS}" "${D}/chatwoot-seco.hecho" "${D}/studio-ensayo.hecho" "${DUR}/"; }
caso_abandono_ok() { abandono_listo || return 1; lc --abandono-4-6b; rc=$?
  [ "${rc}" = 0 ] && grep -qx 'HECHO abandono_4_6b=ok tmpfs=vacio durable=vacio' "${T}/lc.log" && [ ! -e "${D}" ] && [ ! -e "${DUR}" ]; }
caso_abandono_con_borrar_durable() { abandono_listo || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; cp "${D}/chatwoot-borrar.hecho" "${DUR}/"; reinicio; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'chatwoot_ya_borro_hay_que_terminar_el_paso_4' "${T}/lc.log" && [ -e "${DUR}/${CONS##*/}" ] && [ -e "${DUR}/chatwoot-borrar.hecho" ]; }
caso_abandono_con_borrar_tmpfs() { abandono_listo || return 1; hecho_cw chatwoot-borrar.hecho chatwoot_borrar "" "" "fin=commit "; lc --abandono-4-6b; rc=$?
  [ "${rc}" != 0 ] && grep -q 'chatwoot_ya_borro_hay_que_terminar_el_paso_4' "${T}/lc.log" && [ -e "${D}/${CONS##*/}" ] && [ -e "${DUR}/${CONS##*/}" ]; }
caso_abandono_ok && ok "limpiar.sh --abandono-4-6b sin chatwoot-borrar.hecho borra las dos carpetas y lo comprueba" || ko "abandono: $(cat "${T}/lc.log")"
caso_abandono_con_borrar_durable && ok "limpiar.sh --abandono-4-6b con chatwoot-borrar.hecho en la durable (tras un reinicio) se niega y no toca nada" || ko "abandono con borrar en la durable: $(cat "${T}/lc.log")"
caso_abandono_con_borrar_tmpfs && ok "limpiar.sh --abandono-4-6b con chatwoot-borrar.hecho en tmpfs se niega y no toca nada" || ko "abandono con borrar en tmpfs: $(cat "${T}/lc.log")"
# MUTANTE del abandono: sin la guarda, borraría la durable después de un COMMIT de Chatwoot.
[ "$(grep -c "# guarda:abandono\$" "${PH}/limpiar.sh")" = 1 ] || ko "mutante abandono: la marca no está una sola vez"
caso_abandono_con_borrar_durable || ko "control: caso_abandono_con_borrar_durable no pasa con limpiar.sh real"
grep -v "# guarda:abandono\$" "${PH}/limpiar.sh" > "${T}/mut/limpiar.sh"
if LC_GUION="${T}/mut/limpiar.sh" caso_abandono_con_borrar_durable; then ko "mutante de limpiar.sh sin la guarda «abandono» sobrevive"
else ok "mutante de limpiar.sh sin la guarda «abandono» cae (caso_abandono_con_borrar_durable)"; fi
rm -rf "${D}" "${DUR}"

echo "== ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
