-- SDD-0589 (9.3) · Control DESPUÉS de aplicar la 0517 (`user_guide_prefs`) · SOLO LECTURA.
--
-- Lee el ledger, el catálogo y un conteo de filas de la tabla nueva: ni ids, ni estados, ni datos
-- de personas. Cada fila es una comprobación con `ok` = si/no; todas tienen que dar `si`. La
-- verificación de aplicar.sh ya compara el md5 y los bytes del ledger con el blob; esto mira lo que
-- la tabla tiene que ser para que la guía funcione y nadie lea la fila de otro. Antes del apply,
-- 0517-control-previo.sql.
--
--   ledger_una_fila        una sola fila 0517_user_guide_prefs en el ledger
--   tabla_existe · columnas
--                          la tabla y sus 6 columnas con su tipo
--   unico_tenant_usuario   unique (tenant_id, user_id)
--   fk_tenants_cascada · fk_users_cascada
--                          las dos llaves foráneas, con on delete cascade
--   check_state            el check de state (objeto, hasta 16 KB)
--   trigger_touch          user_guide_prefs_touch, habilitado
--   rls_activa             RLS habilitada en la tabla
--   policy_owner           una sola policy, user_guide_prefs_owner, para todo, a authenticated, con
--                          using y with check que exigen el dueño y el tenant activo
--   grants_anon_ninguno · grants_public_ninguno
--                          ni anon ni public tienen privilegios
--   grants_authenticated   exactamente select, insert, update y delete
--   grants_service_role    los privilegios de tabla que da `grant all` (PG 17 suma MAINTAIN: se admite)
--   filas                  la tabla recién creada está vacía (filas = 0 justo después del apply)
\set ON_ERROR_STOP on
begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

with t as (select pg_catalog.to_regclass('public.user_guide_prefs') as oid),
cols as (
  select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' order by a.attname) as lista
  from pg_catalog.pg_attribute a, t
  where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
),
cons as (
  select c.contype, pg_catalog.pg_get_constraintdef(c.oid) as def
  from pg_catalog.pg_constraint c, t where c.conrelid = t.oid
),
pol as (
  select p.polname, p.polcmd, p.polroles, pg_catalog.pg_get_expr(p.polqual, p.polrelid) as qual,
         pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as chk
  from pg_catalog.pg_policy p, t where p.polrelid = t.oid
),
priv as (
  select g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type) as lista
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.table_name = 'user_guide_prefs'
  group by g.grantee
)
select comprobacion, case when ok then 'si' else 'no' end as ok
from (values
  ('ledger_una_fila',
   (select count(*) from supabase_migrations.schema_migrations where name = '0517_user_guide_prefs') = 1),
  ('tabla_existe', (select oid from t) is not null),
  ('columnas', (select lista from cols) =
     'created_at:timestamp with time zone,id:uuid,state:jsonb,tenant_id:uuid,updated_at:timestamp with time zone,user_id:uuid'),
  ('unico_tenant_usuario', exists (select 1 from cons where contype = 'u' and def = 'UNIQUE (tenant_id, user_id)')),
  ('fk_tenants_cascada', exists (select 1 from cons where contype = 'f'
     and def = 'FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE')),
  ('fk_users_cascada', exists (select 1 from cons where contype = 'f'
     and def = 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE')),
  ('check_state', exists (select 1 from cons where contype = 'c'
     and def like '%jsonb_typeof(state)%object%' and def like '%pg_column_size(state) <= 16384%')),
  ('trigger_touch', exists (
     select 1 from pg_catalog.pg_trigger tg, t
     where tg.tgrelid = t.oid and tg.tgname = 'user_guide_prefs_touch' and tg.tgenabled = 'O'
       and tg.tgfoid = pg_catalog.to_regprocedure('public.touch_updated_at()'))),
  ('rls_activa', (select c.relrowsecurity from pg_catalog.pg_class c, t where c.oid = t.oid)),
  ('policy_owner', (select count(*) from pol) = 1 and exists (
     select 1 from pol
     where polname = 'user_guide_prefs_owner' and polcmd = '*'
       and polroles = array[(select oid from pg_catalog.pg_roles where rolname = 'authenticated')]::oid[]
       and qual like '%auth.uid()%' and qual like '%disabled_at IS NULL%'
       and chk like '%auth.uid()%' and chk like '%disabled_at IS NULL%')),
  ('grants_anon_ninguno', not exists (select 1 from priv where grantee = 'anon')),
  ('grants_public_ninguno', not exists (select 1 from priv where grantee = 'PUBLIC')),
  ('grants_authenticated', (select lista from priv where grantee = 'authenticated') = 'DELETE,INSERT,SELECT,UPDATE'),
  ('grants_service_role', coalesce((select lista from priv where grantee = 'service_role'), '')
     ~ '^DELETE,INSERT,(MAINTAIN,)?REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE$'),
  ('filas', (select oid from t) is not null
     and (select count(*) from public.user_guide_prefs) = 0)
) as c(comprobacion, ok)
order by comprobacion;

rollback;
