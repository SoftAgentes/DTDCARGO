-- infra/ops/portal-historial/reservar.sql — SDD-0586 10.7 (P4), paso previo a la extracción: guarda el
-- identificador al azar de cada ficha con un hilo del portal por cargar, ANTES de llamar a Chatwoot
-- (riesgo 1 de §10.5.10). ESCRIBE en la base de Studio: en producción, dentro de la puerta 4.
-- Se niega con chatwoot_portal encendido. Repetirlo no cambia ningún identificador.
--
-- Uso (lo corre extraer.sh):  psql -X -v ON_ERROR_STOP=1 -v tenant=<uuid> -f reservar.sql
\set ON_ERROR_STOP on
set role service_role;
select public.chatwoot_portal_reservar_contactos(:'tenant'::uuid) as reservados;
reset role;
