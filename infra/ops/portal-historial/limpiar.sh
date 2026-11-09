#!/usr/bin/env bash
# infra/ops/portal-historial/limpiar.sh — SDD-0586 10.7 (P4): borra de /dev/shm lo que haya quedado de la
# carga (preparado.ndjson con datos de clientes y vinculos.ndjson). Se corre si la carga no terminó.
#
# Uso:  bash limpiar.sh                 (solo borra /dev/shm/portal-historial: otro DIR se rechaza)
#       bash limpiar.sh --cierre-4-6b   (el paso 5 de la vuelta atrás dirigida 4.6b; lo corre Sam)
#       bash limpiar.sh --abandono-4-6b (abandonar el 4.6b antes de que el paso 3 confirme; lo corre Sam, con OK)
#
# --abandono-4-6b: la salida si el paso 3 falla (o no se corre) y la vuelta atrás se abandona. Borra las dos
# carpetas SOLO si no hay chatwoot-borrar.hecho en ninguna NI chatwoot-borrar.inicio en la durable: con el .hecho,
# Chatwoot ya borró con COMMIT y hay que terminar el paso 4; con el .inicio (lo escribe el paso 3 antes de abrir
# su transacción y lo retira solo si comprobó el ROLLBACK), no se sabe si confirmó. En los dos casos se niega y no
# toca nada.
#
# --cierre-4-6b: después de que el paso 4 (deshacer-vinculos.sh MODO=aplicar) salió con 0. Exige
# studio-aplicar.hecho, en tmpfs o en la carpeta durable /srv/ops/portal-historial/deshacer/, con
# `HECHO studio_aplicar=ok … fin=commit` y, si queda el contactos-conservados.ndjson, con su sha256. Borra las
# dos carpetas y comprueba que no quedó ninguna. Sin el .hecho no borra nada: la durable es lo único que
# permite correr el paso 4 después de un reinicio. La durable solo cambia en la prueba bash (DESHACER_PRUEBA=1).
set -euo pipefail
DIR="${DIR:-/dev/shm/portal-historial}"
# La copia durable, con la misma variable que deshacer.sh de la #478: DESHACER_DURABLE vale solo con
# DESHACER_PRUEBA=1 (la prueba bash) y tiene que terminar en /deshacer; si no, es siempre la fija.
DURABLE="${DESHACER_DURABLE:-/srv/ops/portal-historial/deshacer}"
# El archivo de SISTEMA (deshacer-vinculos.sh): lo borran el cierre y el abandono del 4.6b. Fijo, salvo en la prueba.
SISTEMA_ARCHIVO="${DESHACER_SISTEMA:-/srv/ops/portal-historial/sistema-produccion}"
# Solo el nombre fijo: con un patrón, `/dev/shm//` o `/dev/shm/otro` borraban lo de otros procesos.
if [ "$DIR" != /dev/shm/portal-historial ]; then
  echo "HECHO error=dir_no_es_dev_shm_portal_historial" >&2
  exit 2
fi
case "${1:-}" in
  '')
    rm -rf -- "$DIR"
    echo "HECHO borrado=$DIR"
    exit 0 ;;
  --cierre-4-6b|--abandono-4-6b) ;;
  *) echo "HECHO error=opcion_desconocida" >&2; exit 2 ;;
esac

[ "$SISTEMA_ARCHIVO" = /srv/ops/portal-historial/sistema-produccion ] || [ "${DESHACER_PRUEBA:-}" = 1 ] || { echo "HECHO error=sistema_no_es_el_archivo_fijo" >&2; exit 2; }
[ "$DURABLE" = /srv/ops/portal-historial/deshacer ] || { [ "${DESHACER_PRUEBA:-}" = 1 ] && [ "${DURABLE%/deshacer}" != "$DURABLE" ]; } || { echo "HECHO error=durable_no_es_srv_ops_portal_historial_deshacer" >&2; exit 2; }
# Las dos carpetas, si existen: de verdad, de este usuario (-O) y, la durable, en 0700. Si no, no se toca nada.
if [ -e "$DURABLE" ] && { [ ! -d "$DURABLE" ] || [ -L "$DURABLE" ] || [ ! -O "$DURABLE" ] || [ "$(stat -c %a "$DURABLE")" != 700 ]; }; then
  echo "HECHO error=durable_no_es_carpeta_0700" >&2
  exit 2
fi
if [ -e "$DIR" ] && { [ ! -d "$DIR" ] || [ -L "$DIR" ] || [ ! -O "$DIR" ]; }; then
  echo "HECHO error=dir_no_es_carpeta_de_este_usuario" >&2
  exit 2
fi

if [ "$1" = --abandono-4-6b ]; then
  # B1 (revisión del DG de la #480): chatwoot-borrar.hecho puede faltar aunque Chatwoot ya confirmó (el guion se
  # cortó entre el COMMIT y el .hecho). Por eso el abandono también se niega con un chatwoot-borrar.inicio de la
  # durable: el paso 3 empezó y no se sabe si confirmó. Eso se resuelve con el runbook, mirando la bandeja.
  [ ! -e "$DURABLE/chatwoot-borrar.inicio" ] || { echo "HECHO error=borrado_de_chatwoot_empezado_ver_runbook" >&2; exit 2; } # guarda:abandono_inicio
  for d in "$DIR" "$DURABLE"; do [ ! -e "$d/chatwoot-borrar.hecho" ] || { echo "HECHO error=chatwoot_ya_borro_hay_que_terminar_el_paso_4" >&2; exit 2; }; done # guarda:abandono
  rm -rf -- "$DIR"
  [ ! -e "$DURABLE" ] || rm -rf -- "$DURABLE"
  rm -f -- "$SISTEMA_ARCHIVO"
  [ ! -e "$DIR" ] && [ ! -e "$DURABLE" ] && [ ! -e "$SISTEMA_ARCHIVO" ] || { echo "HECHO error=quedo_algo" >&2; exit 4; }
  echo "HECHO abandono_4_6b=ok tmpfs=vacio durable=vacio"
  echo "HECHO sistema=borrado"
  exit 0
fi
# El studio-aplicar.hecho, de tmpfs o de la durable (un enlace no vale), y el .ndjson que quede, si queda.
A=""; for d in "$DIR" "$DURABLE"; do [ -z "$A" ] && [ -f "$d/studio-aplicar.hecho" ] && [ ! -L "$d/studio-aplicar.hecho" ] && A="$d/studio-aplicar.hecho"; done
N=""; for d in "$DIR" "$DURABLE"; do [ -z "$N" ] && [ -f "$d/contactos-conservados.ndjson" ] && N="$d/contactos-conservados.ndjson"; done
l=""; [ -z "$A" ] || { IFS= read -r l < "$A" || true; }
case "$l" in "HECHO studio_aplicar=ok "*" fin=commit "*) ;; *) l="" ;; esac
[ -n "$l" ] || { echo "HECHO error=sin_aplicar_del_4_6b" >&2; exit 2; } # guarda:aplicar
[ -z "$N" ] || case " $l " in *" conservados_sha256=$(sha256sum "$N" | cut -c1-64) "*) ;; *) echo "HECHO error=aplicar_de_otros_conservados" >&2; exit 2 ;; esac # guarda:sha_cierre

rm -rf -- "$DIR"
[ ! -e "$DURABLE" ] || rm -rf -- "$DURABLE"
rm -f -- "$SISTEMA_ARCHIVO"
[ ! -e "$DIR" ] && [ ! -e "$DURABLE" ] && [ ! -e "$SISTEMA_ARCHIVO" ] || { echo "HECHO error=quedo_algo" >&2; exit 4; }
echo "HECHO cierre_4_6b=ok tmpfs=vacio durable=vacio"
echo "HECHO sistema=borrado"
