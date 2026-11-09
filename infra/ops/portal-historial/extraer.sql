-- infra/ops/portal-historial/extraer.sql — SDD-0586 10.7 (P4), pasos 1 y 2 de §10.5.10: la foto, en una
-- transacción de SOLO LECTURA, y las líneas de preparado.ndjson (una por fila, sin adornos).
-- `chatwoot_portal_carga_lineas` (0523) se niega fuera de solo lectura, con el flag encendido o sin la
-- reserva. El corte va 5 minutos antes de que empiece esta transacción.
--
-- Uso (lo corre extraer.sh, que manda la salida a /dev/shm):
--   psql -X -v ON_ERROR_STOP=1 -v tenant=<uuid> -v cuenta=<n> -v bandeja=<n> -f extraer.sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\pset footer off
begin transaction isolation level repeatable read read only;
set local role service_role;
set local statement_timeout = '120s';
select l from public.chatwoot_portal_carga_lineas(:'tenant'::uuid, :cuenta::integer, :bandeja::bigint) as t(l);
commit;
