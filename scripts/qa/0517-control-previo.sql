-- SDD-0589 (9.3) · Control ANTES de aplicar la 0517 (`user_guide_prefs`) · SOLO LECTURA.
--
-- Lee solo el ledger y el catálogo: ni filas de negocio ni datos de personas. Comprueba lo que el
-- preflight de la 0517 exige y que la migración no esté. Cada fila es una comprobación con
-- `ok` = si/no; todas tienen que dar `si`. Va antes del apply; después, 0517-control-posterior.sql.
--
--   ledger_sin_0517        el ledger no tiene ninguna fila 0517
--   tabla_ausente          public.user_guide_prefs no existe
--   tenants · user_tenants · auth_users · touch_updated_at · user_tenants_disabled_at
--                          lo que la 0517 referencia (preflight)
--   gen_random_uuid        el default del id
--   rol_authenticated · rol_service_role
--                          los roles de los grants
\set ON_ERROR_STOP on
begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

select comprobacion, case when ok then 'si' else 'no' end as ok
from (values
  ('ledger_sin_0517',
   not exists (select 1 from supabase_migrations.schema_migrations where name like '0517%')),
  ('tabla_ausente', pg_catalog.to_regclass('public.user_guide_prefs') is null),
  ('tenants', pg_catalog.to_regclass('public.tenants') is not null),
  ('user_tenants', pg_catalog.to_regclass('public.user_tenants') is not null),
  ('auth_users', pg_catalog.to_regclass('auth.users') is not null),
  ('touch_updated_at', pg_catalog.to_regprocedure('public.touch_updated_at()') is not null),
  ('user_tenants_disabled_at', exists (
     select 1 from pg_catalog.pg_attribute
     where attrelid = pg_catalog.to_regclass('public.user_tenants') and attname = 'disabled_at'
       and not attisdropped)),
  ('gen_random_uuid', pg_catalog.to_regprocedure('gen_random_uuid()') is not null),
  ('rol_authenticated', exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated')),
  ('rol_service_role', exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role'))
) as c(comprobacion, ok)
order by comprobacion;

-- Referencia, sin filas de negocio: cuántas filas tiene el ledger y cuál es la última aplicada.
select (select count(*) from supabase_migrations.schema_migrations) as filas_ledger,
       (select name from supabase_migrations.schema_migrations order by version desc limit 1) as ultima_migracion;

rollback;
