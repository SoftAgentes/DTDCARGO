-- Medición ANTES de aplicar la 0519 (SDD-0586, 10.5). Solo lectura: el ledger, el catálogo y cuántas filas del flag
-- chatwoot_portal hay en feature_flags (configuración, no datos de personas). Ninguna fila de negocio.
-- Uso (lo corre el Director General): docker exec -i <contenedor de la base> psql -U postgres -d postgres -X \
--   -v ON_ERROR_STOP=1 < chatwoot-portal-0519-antes.sql > antes.out
-- Runbook: docs/runbooks/chatwoot-portal-0519-ensayo.md §3.
\set ON_ERROR_STOP on
begin transaction read only;

-- A1 · la 0519 todavía no está en el ledger.                                    Esperado: 0
select 'A1' as bloque, count(*) as filas_0519
from supabase_migrations.schema_migrations where name = '0519_chatwoot_portal';

-- A2 · ninguna de sus cuatro tablas existe.                                       Esperado: 0
select 'A2' as bloque, count(c.oid) as tablas_portal
from (values ('public.chatwoot_portal_contactos'), ('public.chatwoot_portal_hilos'),
             ('public.chatwoot_portal_salida'), ('public.chatwoot_portal_estado')) as t(nombre)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(t.nombre);

-- A3 · el catálogo es el de la 0503: 23 flags, con chatwoot_inbox y sin chatwoot_portal.   Esperado: 23, f, t
select 'A3' as bloque, count(*) as flags,
       coalesce(bool_or(key = 'chatwoot_portal'), false) as tiene_portal,
       coalesce(bool_or(key = 'chatwoot_inbox'), false) as tiene_inbox
from public.feature_flag_catalog();

-- A4 · ninguna fila del flag todavía.                                             Esperado: 0
select 'A4' as bloque, count(*) as filas_flag_portal from public.feature_flags where key = 'chatwoot_portal';

-- A5 · cuántos tenants hay: después, cada uno tiene que tener su fila, apagada.   Esperado: un número; se anota
select 'A5' as bloque, count(*) as tenants from public.tenants;

rollback;
