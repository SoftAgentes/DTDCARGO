-- Medición DESPUÉS de aplicar la 0520 (SDD-0586, 10.5, PR 1b). Solo lectura: el ledger, las dos funciones nuevas y
-- sus permisos, las de la 0519, el catálogo de flags, las filas del flag (configuración) y el conteo de la cola de la
-- ida (estado de integración). No lee ninguna tabla de negocio ni de personas (N9 de la revisión de la #433).
-- Uso (lo corre el Director General): docker exec -i <contenedor de la base> psql -U postgres -d postgres -X \
--   -v ON_ERROR_STOP=1 < chatwoot-portal-0520-despues.sql > despues.out
-- Runbook: docs/runbooks/chatwoot-portal-0520-ensayo.md §3.
\set ON_ERROR_STOP on
begin transaction read only;

-- D1 · una sola fila en el ledger, con el md5 y los bytes del blob.
--      Esperado: 1 fila; md5 03bcee54616204644a6981d33ec7764c; bytes 12500; created_by el del host
select 'D1' as bloque, version, created_by,
       pg_catalog.md5(pg_catalog.array_to_string(statements, '')) as md5,
       pg_catalog.octet_length(pg_catalog.array_to_string(statements, '')) as bytes
from supabase_migrations.schema_migrations where name = '0520_chatwoot_portal_vuelta';

-- D2 · las dos funciones: security definer, search_path vacío y quién las ejecuta. La única permisión de una función
--      es EXECUTE, así que esto mide TODOS sus privilegios (N8). search_path_vacio compara el texto normalizado
--      (array_to_string): psql mostraría el arreglo crudo como {"search_path=\"\""}.
--      Esperado: chatwoot_portal_respuesta → t, t, public f, anon f, authenticated f, service_role t
--                chatwoot_portal_destrabar → t, t, public f, anon f, authenticated t; service_role se anota (los
--                privilegios por defecto de Supabase pueden dárselo; no lo usa)
select 'D2' as bloque, p.proname as funcion, p.prosecdef as definer,
       pg_catalog.array_to_string(p.proconfig, ',') = 'search_path=""' as search_path_vacio,
       pg_catalog.array_to_string(p.proconfig, ',') as config_texto,
       pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') as public,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('chatwoot_portal_respuesta', 'chatwoot_portal_destrabar')
order by p.proname;

-- D3 · la 0519 sigue igual: sus cuatro RPC y el catálogo de 24 flags.              Esperado: 4, 24
select 'D3' as bloque,
       (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('chatwoot_portal_tomar', 'chatwoot_portal_marcar', 'chatwoot_portal_vincular', 'chatwoot_portal_rezagados')
       ) as rpc_0519,
       (select count(*) from public.feature_flag_catalog()) as flags;

-- D4 · el flag sigue apagado en todas sus filas, las mismas que en A4.               Esperado: filas = A4, encendidas = 0
select 'D4' as bloque, count(*) as filas_flag, count(*) filter (where enabled) as encendidas
from public.feature_flags where key = 'chatwoot_portal';

-- D5 · la cola de la ida, igual que en A5 (aplicar no destraba nada).              Esperado: los mismos de A5
select 'D5' as bloque, count(*) as filas_salida, count(*) filter (where estado = 'atascado') as atascados
from public.chatwoot_portal_salida;

rollback;
