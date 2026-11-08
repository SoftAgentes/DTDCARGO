-- Medición ANTES de aplicar la 0520 (SDD-0586, 10.5, PR 1b). Solo lectura: el ledger, el catálogo de funciones, lo
-- que exige el preflight de la 0520, las filas del flag chatwoot_portal (configuración) y el conteo de la cola de la
-- ida (estado de integración). No lee ninguna tabla de negocio ni de personas (N9 de la revisión de la #433).
-- Uso (lo corre el Director General): docker exec -i <contenedor de la base> psql -U postgres -d postgres -X \
--   -v ON_ERROR_STOP=1 < chatwoot-portal-0520-antes.sql > antes.out
-- Runbook: docs/runbooks/chatwoot-portal-0520-ensayo.md §3.
\set ON_ERROR_STOP on
begin transaction read only;

-- A1 · el ledger: la 0519 está, la 0520 no.                                       Esperado: 1, 0
select 'A1' as bloque,
       (select count(*) from supabase_migrations.schema_migrations where name = '0519_chatwoot_portal') as filas_0519,
       (select count(*) from supabase_migrations.schema_migrations where name = '0520_chatwoot_portal_vuelta') as filas_0520;

-- A2 · las dos funciones de la 0520 no existen.                                   Esperado: 0
select 'A2' as bloque, count(*) as funciones_0520
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('chatwoot_portal_respuesta', 'chatwoot_portal_destrabar');

-- A3 · lo que exige el preflight de la 0520.                                      Esperado: las ocho en t
select 'A3' as bloque,
       pg_catalog.to_regclass('public.chatwoot_portal_hilos') is not null as hilos,
       pg_catalog.to_regclass('public.chatwoot_portal_salida') is not null as salida,
       pg_catalog.to_regprocedure('public.chatwoot_portal_tomar(uuid, integer, uuid)') is not null as tomar,
       pg_catalog.to_regclass('public.chatwoot_agent_links') is not null as agent_links,
       pg_catalog.to_regclass('public.user_profiles') is not null as user_profiles,
       pg_catalog.to_regprocedure('public.is_tenant_admin()') is not null as is_tenant_admin,
       pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null as get_user_tenant_id,
       coalesce(pg_catalog.pg_get_indexdef(pg_catalog.to_regclass('public.conversation_messages_external_idx')), '')
         like 'CREATE UNIQUE INDEX %(tenant_id, external_msg_id) WHERE (external_msg_id IS NOT NULL)' as indice_external;

-- A4 · el flag chatwoot_portal, apagado en todas sus filas.                         Esperado: encendidas = 0
select 'A4' as bloque, count(*) as filas_flag, count(*) filter (where enabled) as encendidas
from public.feature_flags where key = 'chatwoot_portal';

-- A5 · la cola de la ida (con el flag apagado no corre).                           Esperado: 0, 0
select 'A5' as bloque, count(*) as filas_salida, count(*) filter (where estado = 'atascado') as atascados
from public.chatwoot_portal_salida;

rollback;
