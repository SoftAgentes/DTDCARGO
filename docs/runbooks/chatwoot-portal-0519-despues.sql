-- Medición DESPUÉS de aplicar la 0519 (SDD-0586, 10.5). Solo lectura: el ledger, el catálogo, los permisos, y
-- conteos de filas del flag y de la cola (configuración y estado de integración, no datos de personas).
-- Uso (lo corre el Director General): docker exec -i <contenedor de la base> psql -U postgres -d postgres -X \
--   -v ON_ERROR_STOP=1 < chatwoot-portal-0519-despues.sql > despues.out
-- Runbook: docs/runbooks/chatwoot-portal-0519-ensayo.md §3.
\set ON_ERROR_STOP on
begin transaction read only;

-- D1 · una sola fila en el ledger, con el md5 y los bytes del blob.
--      Esperado: 1 fila; md5 f613559d5ca34b2932995c8ff051e97e; bytes 30710; created_by el del host
select 'D1' as bloque, version, created_by,
       pg_catalog.md5(pg_catalog.array_to_string(statements, '')) as md5,
       pg_catalog.octet_length(pg_catalog.array_to_string(statements, '')) as bytes
from supabase_migrations.schema_migrations where name = '0519_chatwoot_portal';

-- D2 · el catálogo: 24 flags, chatwoot_portal apagado.                           Esperado: 24, f
select 'D2' as bloque, count(*) as flags,
       bool_or(enabled) filter (where key = 'chatwoot_portal') as portal_encendido
from public.feature_flag_catalog();

-- D3 · una fila del flag por tenant, ninguna encendida.                          Esperado: filas = tenants (A5), encendidas = 0
select 'D3' as bloque, (select count(*) from public.tenants) as tenants,
       count(*) as filas_flag, count(*) filter (where enabled) as encendidas
from public.feature_flags where key = 'chatwoot_portal';

-- D4 · las cuatro tablas: RLS activada, nada para anon ni authenticated, todo para service_role.
--      Esperado: 4 filas con rls = t, anon = f, auth = f, service = t
select 'D4' as bloque, c.relname, c.relrowsecurity as rls,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
         or pg_catalog.has_table_privilege('anon', c.oid, 'INSERT') as anon,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
         or pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
         or pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
         or pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE') as auth,
       pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT') as service
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'chatwoot\_portal\_%'
order by c.relname;

-- D5 · las políticas de esas tablas: solo para service_role.                      Esperado: 4 filas, roles = {service_role}
select 'D5' as bloque, tablename, policyname, roles
from pg_catalog.pg_policies where schemaname = 'public' and tablename like 'chatwoot\_portal\_%'
order by tablename;

-- D6 · las cuatro RPC: security definer, search_path vacío y EXECUTE solo para service_role.
--      Esperado: 4 filas con definer = t, config = {search_path=""}, anon = f, auth = f, service = t
select 'D6' as bloque, p.oid::pg_catalog.regprocedure as funcion, p.prosecdef as definer, p.proconfig as config,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'chatwoot\_portal\_%'
order by 2;

-- D7 · la cola está inerte: sin corte, sin filas.                                 Esperado: 0, 0, 0, 0
select 'D7' as bloque,
       (select count(*) from public.chatwoot_portal_estado) as cortes,
       (select count(*) from public.chatwoot_portal_salida) as en_cola,
       (select count(*) from public.chatwoot_portal_contactos) as contactos,
       (select count(*) from public.chatwoot_portal_hilos) as hilos;

rollback;
