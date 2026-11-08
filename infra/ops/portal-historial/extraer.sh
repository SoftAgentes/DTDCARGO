#!/usr/bin/env bash
# infra/ops/portal-historial/extraer.sh — SDD-0586 10.7 (P4): la reserva y la extracción del chat del portal
# a /dev/shm/portal-historial/preparado.ndjson, para el cargador de E5 (§10.5.10, formato cerrado con E5).
#
# Corre en el VPS. Toca la base de Studio:
#   1. reservar.sql ESCRIBE el identificador de cada ficha por cargar (en producción, puerta 4, con su OK);
#   2. extraer.sql LEE en una transacción de solo lectura (en producción, puerta 1 para el ensayo, con su OK).
# Con chatwoot_portal encendido, la 0523 se niega: la carga corre con la cola quieta.
#
# Datos personales: preparado.ndjson lleva el nombre de la ficha y el texto de los mensajes. Vive solo en
# /dev/shm (tmpfs, 0700, nunca en disco ni en Git), y se borra con limpiar.sh o al terminar la vinculación.
# Si algo falla aquí, se borra lo escrito. La salida de este script lleva solo conteos.
#
# Uso:  DB=<contenedor de la base de Studio> TENANT=<uuid> CUENTA=<n> BANDEJA=<n> bash extraer.sh
set -euo pipefail
umask 077

: "${DB:?falta DB}" "${TENANT:?falta TENANT}" "${CUENTA:?falta CUENTA}" "${BANDEJA:?falta BANDEJA}"
DIR="${DIR:-/dev/shm/portal-historial}"
AQUI="$(cd "$(dirname "$0")" && pwd)"

case "$DIR" in
  *..*) echo "HECHO error=dir_fuera_de_dev_shm" >&2; exit 2 ;;
  /dev/shm/?*) ;;
  *) echo "HECHO error=dir_fuera_de_dev_shm" >&2; exit 2 ;;
esac
# La cuenta y la bandeja entran a extraer.sql como números (:cuenta, :bandeja): solo dígitos.
for n in "$CUENTA" "$BANDEJA"; do
  case "$n" in
    ''|*[!0-9]*) echo "HECHO error=cuenta_o_bandeja_no_numerica" >&2; exit 2 ;;
  esac
done
if [ -e "$DIR/preparado.ndjson" ]; then
  echo "HECHO error=ya_hay_un_preparado (borrar con limpiar.sh antes)" >&2
  exit 2
fi
mkdir -p -m 0700 "$DIR"
chmod 0700 "$DIR"

psql_db() {
  docker exec -i "$DB" psql -X -q -U postgres -d postgres "$@"
}

# Si algo falla, no queda un preparado a medias con datos de clientes.
trap 'rm -f "$DIR/preparado.ndjson.parcial"' EXIT

reservados="$(psql_db -At -v tenant="$TENANT" -f - < "$AQUI/reservar.sql")"
echo "HECHO reservados=$reservados"

psql_db -v tenant="$TENANT" -v cuenta="$CUENTA" -v bandeja="$BANDEJA" -f - < "$AQUI/extraer.sql" > "$DIR/preparado.ndjson.parcial"

lineas="$(wc -l < "$DIR/preparado.ndjson.parcial" | tr -d ' ')"
primera="$(head -n 1 "$DIR/preparado.ndjson.parcial")"
case "$primera" in
  *'"tipo": "cabecera"'*) ;;
  *) echo "HECHO error=sin_cabecera" >&2; exit 1 ;;
esac
mv "$DIR/preparado.ndjson.parcial" "$DIR/preparado.ndjson"
chmod 0600 "$DIR/preparado.ndjson"
echo "HECHO lineas=$lineas"
echo "HECHO preparado=$DIR/preparado.ndjson"
