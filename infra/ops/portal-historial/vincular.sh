#!/usr/bin/env bash
# infra/ops/portal-historial/vincular.sh — SDD-0586 10.7 (P4), paso 4 de §10.5.10: vincula en Studio lo que
# cargó el cargador de E5, con `chatwoot_portal_vincular_carga` (0523). ESCRIBE en la base de Studio: en
# producción, dentro de la puerta 4, con su OK.
#
# Lee la cabecera de /dev/shm/portal-historial/preparado.ndjson y todo vinculos.ndjson (solo ids). La 0523
# compara las dos cabeceras y los conteos, y hace todo o nada. Con chatwoot_portal encendido se niega.
# Si sale bien, borra el directorio de /dev/shm (los datos de clientes no quedan). Si falla, lo deja para
# repetir, y hay que borrarlo con limpiar.sh si no se repite.
#
# Los archivos entran a psql por COPY de texto, que interpreta la barra invertida: vinculos.ndjson y la
# cabecera del preparado no llevan ninguna (solo ids, fechas y conteos), y aquí se comprueba.
#
# Uso:  DB=<contenedor de la base de Studio> TENANT=<uuid> bash vincular.sh
set -euo pipefail
umask 077

: "${DB:?falta DB}" "${TENANT:?falta TENANT}"
DIR="${DIR:-/dev/shm/portal-historial}"
P="$DIR/preparado.ndjson"
V="$DIR/vinculos.ndjson"

# Borra el directorio al terminar: solo /dev/shm/portal-historial, como extraer.sh y limpiar.sh.
# Solo el nombre fijo: con un patrón, `/dev/shm//` o `/dev/shm/otro` borraban lo de otros procesos.
if [ "$DIR" != /dev/shm/portal-historial ]; then
  echo "HECHO error=dir_no_es_dev_shm_portal_historial" >&2
  exit 2
fi

test -s "$P" || { echo "HECHO error=sin_preparado" >&2; exit 2; }
test -s "$V" || { echo "HECHO error=sin_vinculos" >&2; exit 2; }
cabecera="$(head -n 1 "$P")"
if printf '%s' "$cabecera" | grep -q '\\' || grep -q '\\' "$V"; then
  echo "HECHO error=barra_invertida_en_los_archivos" >&2
  exit 2
fi

{
  printf '%s\n' '\set ON_ERROR_STOP on' 'create temp table vinculos (n serial, linea text);' 'copy vinculos (linea) from stdin;'
  cat "$V"
  # Un vinculos.ndjson sin salto de línea al final juntaría su última línea con el fin del COPY.
  [ -z "$(tail -c 1 "$V")" ] || printf '\n'
  printf '%s\n' '\.' 'create temp table preparado (linea text);' 'copy preparado from stdin;'
  printf '%s\n' "$cabecera" '\.'
  printf '%s\n' 'set role service_role;'
  printf '%s\n' "select 'HECHO contactos=' || contactos || ' hilos=' || hilos || ' mensajes=' || mensajes from public.chatwoot_portal_vincular_carga(:'tenant'::uuid, (select linea::jsonb from preparado), (select jsonb_agg(linea::jsonb order by n) from vinculos));"
} | docker exec -i "$DB" psql -X -q -At -U postgres -d postgres -v tenant="$TENANT" -f -

rm -rf -- "$DIR"
echo "HECHO borrado=$DIR"
