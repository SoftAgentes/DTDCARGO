#!/usr/bin/env bash
# Corre la carga de la 6.5 (Kommo → CRM propio) contra una base, en una sola transacción.
#
#   correr.sh seco   --servicio <archivo> --tenant <uuid> --corte <ISO-8601 UTC> [--dias 180]
#   correr.sh cargar --servicio <archivo> --tenant <uuid> --corte <ISO-8601 UTC> [--dias 180] --confirmo-ok-de-sam
#
# · La conexión sale de un archivo de servicio de libpq (PGSERVICEFILE, sección [dtd]) en tmpfs y con permisos
#   0600. La contraseña nunca va en argv ni en la pantalla.
# · `seco` corre todo y termina en ROLLBACK: da los mismos conteos que la carga y no deja nada.
# · `cargar` termina en COMMIT. Exige --confirmo-ok-de-sam: en producción, solo con el OK nominal de Sam.
# · La salida son solo conteos `clave=valor`. Nada de nombres, teléfonos, correos ni textos.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
modo="${1:-}"; shift || true
servicio="" tenant="" corte="" dias="180" confirmo=0
while [ $# -gt 0 ]; do
  case "$1" in
    --servicio) servicio="${2:-}"; shift 2 ;;
    --tenant) tenant="${2:-}"; shift 2 ;;
    --corte) corte="${2:-}"; shift 2 ;;
    --dias) dias="${2:-}"; shift 2 ;;
    --confirmo-ok-de-sam) confirmo=1; shift ;;
    *) echo "argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

case "$modo" in
  seco) fin="rollback" ;;
  cargar) fin="commit"
    if [ "$confirmo" -ne 1 ]; then echo "cargar exige --confirmo-ok-de-sam" >&2; exit 2; fi ;;
  *) echo "uso: correr.sh seco|cargar --servicio <archivo> --tenant <uuid> --corte <ISO> [--dias N]" >&2; exit 2 ;;
esac

[[ "$tenant" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || { echo "tenant inválido" >&2; exit 2; }
[[ "$corte" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { echo "corte: AAAA-MM-DDTHH:MM:SSZ" >&2; exit 2; }
[[ "$dias" =~ ^[0-9]{1,4}$ ]] || { echo "días inválidos" >&2; exit 2; }
[ -f "$servicio" ] || { echo "falta el archivo de servicio" >&2; exit 2; }
permisos="$(stat -c '%a' "$servicio" 2>/dev/null || echo '?')"
[ "$permisos" = "600" ] || { echo "el archivo de servicio tiene que ser 0600 (tiene $permisos)" >&2; exit 2; }

export PGSERVICEFILE="$servicio" PGSERVICE=dtd PGAPPNAME="dtd-carga-kommo-crm-$modo"
echo "INICIO modo=$modo corte=$corte dias=$dias $(date -u +%Y-%m-%dT%H:%M:%SZ)"
psql -X -q -At -F '=' -v ON_ERROR_STOP=1 <<SQL
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15min';
\i $DIR/carga.sql
select clave, valor from pg_temp.crm_carga_kommo('$tenant'::uuid, '$corte'::timestamptz, $dias);
$fin;
SQL
echo "FIN modo=$modo $fin $(date -u +%Y-%m-%dT%H:%M:%SZ)"
