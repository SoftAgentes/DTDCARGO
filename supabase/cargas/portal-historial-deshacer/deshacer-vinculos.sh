#!/usr/bin/env bash
# supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh — SDD-0586 10.7, sub-paso 4.6b del runbook
# docs/runbooks/chatwoot-portal-p4-puertas.md: deshace en Studio los vínculos de la carga P4, con
# deshacer-vinculos.sql, en UNA transacción.
#
#   MODO=ensayo  → termina en ROLLBACK (lo corre el DG para ensayar).
#   MODO=aplicar → termina en COMMIT. BORRADO PERMANENTE en producción: lo corre Sam, con su OK nominal.
#
# Lee /dev/shm/portal-historial/contactos-conservados.ndjson (de la pieza de E5, solo ids) y los
# conteos esperados, sacados del conteo previo de solo lectura. Imprime solo líneas HECHO con conteos.
#
# Uso:  DB=<contenedor de la base de Studio> TENANT=<uuid> CUENTA=<n> BANDEJA=<n> \
#       ESPERADOS_SALIDA=<n> ESPERADOS_HILOS=<n> ESPERADOS_CONTACTOS=<n> ESPERADOS_ESPEJO=<n> \
#       ENTORNO=copia|produccion [SISTEMA=<system_identifier, solo produccion>] \
#       MODO=ensayo|aplicar bash deshacer-vinculos.sh
#
# El VPS lo tiene en /srv/ops/portal-historial/ (sub-paso 3.0 del runbook), junto a deshacer-vinculos.sql.
set -euo pipefail
umask 077

: "${DB:?falta DB}" "${TENANT:?falta TENANT}" "${CUENTA:?falta CUENTA}" "${BANDEJA:?falta BANDEJA}"
: "${ESPERADOS_SALIDA:?falta ESPERADOS_SALIDA}" "${ESPERADOS_HILOS:?falta ESPERADOS_HILOS}"
: "${ESPERADOS_CONTACTOS:?falta ESPERADOS_CONTACTOS}" "${ESPERADOS_ESPEJO:?falta ESPERADOS_ESPEJO}"
: "${MODO:?falta MODO (ensayo o aplicar)}" "${ENTORNO:?falta ENTORNO (copia o produccion)}"
SISTEMA="${SISTEMA:-}"
DIR="${DIR:-/dev/shm/portal-historial}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
C="$DIR/contactos-conservados.ndjson"

# Solo el nombre fijo, como los demás guiones de esta carpeta.
if [ "$DIR" != /dev/shm/portal-historial ]; then
  echo "HECHO error=dir_no_es_dev_shm_portal_historial" >&2
  exit 2
fi
case "$MODO" in
  ensayo) FIN=rollback ;;
  aplicar) FIN=commit ;;
  *) echo "HECHO error=modo_invalido" >&2; exit 2 ;;
esac
case "$ENTORNO" in
  copia) ;;
  produccion)
    case "$SISTEMA" in
      ''|*[!0-9]*) echo "HECHO error=produccion_exige_sistema" >&2; exit 2 ;;
    esac ;;
  *) echo "HECHO error=entorno_invalido" >&2; exit 2 ;;
esac
case "$TENANT" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) echo "HECHO error=tenant_no_es_uuid" >&2; exit 2 ;;
esac
for n in "$CUENTA" "$BANDEJA" "$ESPERADOS_SALIDA" "$ESPERADOS_HILOS" "$ESPERADOS_CONTACTOS" "$ESPERADOS_ESPEJO"; do
  case "$n" in
    ''|*[!0-9]*) echo "HECHO error=numero_invalido" >&2; exit 2 ;;
  esac
done
test -s "$C" || { echo "HECHO error=sin_contactos_conservados" >&2; exit 2; }
# El archivo entra a psql por COPY de texto, que interpreta la barra invertida: solo lleva ids.
if grep -q '\\' "$C"; then
  echo "HECHO error=barra_invertida_en_los_conservados" >&2
  exit 2
fi

{
  # Sin DETAIL ni CONTEXT: un error o un deadlock no imprime filas (como crm-kommo/correr.sh).
  printf '%s\n' '\set ON_ERROR_STOP on' '\set VERBOSITY terse' 'begin;'
  printf '%s\n' 'create temp table deshacer_param (tenant uuid, cuenta bigint, bandeja bigint, esperados_salida integer, esperados_hilos integer, esperados_contactos integer, esperados_espejo integer, entorno text, sistema text);'
  printf '%s\n' "insert into deshacer_param values (:'tenant', :cuenta, :bandeja, :esperados_salida, :esperados_hilos, :esperados_contactos, :esperados_espejo, :'entorno', nullif(:'sistema', ''));"
  printf '%s\n' 'create temp table conservados (n serial, linea text);' 'copy conservados (linea) from stdin;'
  cat "$C"
  # Sin salto de línea al final, la última línea se juntaría con el fin del COPY.
  [ -z "$(tail -c 1 "$C")" ] || printf '\n'
  printf '%s\n' '\.'
  cat "$AQUI/deshacer-vinculos.sql"
  printf '%s\n' 'select l from pg_temp.deshacer_vinculos() as t(l);'
  printf '%s\n' "$FIN;"
} | docker exec -i "$DB" psql -X -q -At -U postgres -d postgres \
      -v tenant="$TENANT" -v cuenta="$CUENTA" -v bandeja="$BANDEJA" \
      -v esperados_salida="$ESPERADOS_SALIDA" -v esperados_hilos="$ESPERADOS_HILOS" \
      -v esperados_contactos="$ESPERADOS_CONTACTOS" -v esperados_espejo="$ESPERADOS_ESPEJO" \
      -v entorno="$ENTORNO" -v sistema="$SISTEMA" -f -

echo "HECHO modo=$MODO fin=$FIN"
