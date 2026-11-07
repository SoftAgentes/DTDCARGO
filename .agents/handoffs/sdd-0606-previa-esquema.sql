-- ─────────────────────────────────────────────────────────────
-- SDD-0606 · Lectura previa de ESQUEMA para las migraciones 0514 y 0515.
--
-- NO CORRER sin la confirmación del Director General. Sólo lee catálogo
-- (information_schema y pg_catalog): ninguna fila de negocio, ningún dato de
-- personas. `reltuples` es la estimación del planificador, no un conteo.
--
-- Complementa, no reemplaza, el `previa.sql` que arma
-- `infra/ops/migraciones/preparar.mjs` (ledger, deriva y el preflight propio de
-- cada migración). Esta lectura mide lo que esos dos no miran:
--   0514 · la forma actual de user_profiles y quién puede escribir su columna nueva;
--   0515 · que la tabla no exista, sus dependencias y los privilegios por defecto
--          que Supabase da a toda tabla nueva del esquema public.
--
-- Uso (en el VPS, como la previa del runbook):
--   docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
--     < sdd-0606-previa-esquema.sql > previa-esquema.out
-- ─────────────────────────────────────────────────────────────

begin transaction read only;

\echo '== 0. Hora y base'
select now() at time zone 'utc' as utc, current_database(), current_user, version();

-- ── 0514 · user_profiles.discord_user_id ──────────────────────

\echo '== 0514.1 Columnas de user_profiles (¿ya existe discord_user_id? ¿con qué tipo?)'
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'user_profiles'
 order by ordinal_position;

\echo '== 0514.2 Constraints de user_profiles (¿ya existe el CHECK de formato?)'
select conname, contype, pg_get_constraintdef(oid) as definicion
  from pg_catalog.pg_constraint
 where conrelid = 'public.user_profiles'::regclass
 order by conname;

\echo '== 0514.3 Tamaño estimado (para el tiempo del CHECK, sin contar filas)'
select c.reltuples::bigint as filas_estimadas, pg_size_pretty(pg_total_relation_size(c.oid)) as tamano
  from pg_catalog.pg_class c
 where c.oid = 'public.user_profiles'::regclass;

\echo '== 0514.4 Policies de user_profiles: la de UPDATE tiene que limitar a la fila propia'
select policyname, cmd, roles, permissive,
       qual as using_expr, with_check as with_check_expr
  from pg_catalog.pg_policies
 where schemaname = 'public' and tablename = 'user_profiles'
 order by cmd, policyname;

\echo '== 0514.5 Privilegios de tabla sobre user_profiles'
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'user_profiles'
   and grantee in ('anon', 'authenticated', 'service_role')
 order by grantee, privilege_type;

\echo '== 0514.6 Privilegios por columna (si hay, la columna nueva NO los hereda)'
select grantee, column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'user_profiles'
   and grantee in ('anon', 'authenticated')
 order by grantee, column_name, privilege_type;

\echo '== 0514.7 Triggers de user_profiles (que ninguno reescriba la columna nueva)'
select tgname, pg_get_triggerdef(oid) as definicion
  from pg_catalog.pg_trigger
 where tgrelid = 'public.user_profiles'::regclass and not tgisinternal
 order by tgname;

-- ── 0515 · studio_alert_outbox ───────────────────────────────

\echo '== 0515.1 La tabla todavía no existe (null = no existe)'
select pg_catalog.to_regclass('public.studio_alert_outbox') as tabla;

\echo '== 0515.2 Dependencias: tenants, su PK y gen_random_uuid en extensions'
select pg_catalog.to_regclass('public.tenants') as tenants,
       (select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
         where conrelid = 'public.tenants'::regclass and contype = 'p') as tenants_pk,
       pg_catalog.to_regprocedure('extensions.gen_random_uuid()') as gen_random_uuid;

\echo '== 0515.3 Roles que la migración nombra'
select rolname, rolbypassrls, rolsuper
  from pg_catalog.pg_roles
 where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
 order by rolname;

\echo '== 0515.4 Privilegios por defecto del esquema public (Supabase suele dar ALL a anon y authenticated; la migración los revoca)'
select pg_get_userbyid(d.defaclrole) as dueno, n.nspname as esquema, d.defaclobjtype as tipo, d.defaclacl as acl
  from pg_catalog.pg_default_acl d
  left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public' or d.defaclnamespace = 0
 order by 1, 2, 3;

\echo '== 0515.5 Disparadores de eventos (p. ej. el que activa RLS solo, migr 0277)'
select evtname, evtevent, evtenabled, evtfoid::regproc as funcion
  from pg_catalog.pg_event_trigger
 order by evtname;

\echo '== 0515.6 Publicaciones (que la tabla nueva no entre a realtime por FOR ALL TABLES)'
select pubname, puballtables
  from pg_catalog.pg_publication
 order by pubname;

\echo '== 0515.7 Quién es dueño del esquema public y si postgres puede crear en él'
select n.nspname, pg_get_userbyid(n.nspowner) as dueno,
       has_schema_privilege('postgres', 'public', 'CREATE') as postgres_puede_crear
  from pg_catalog.pg_namespace n
 where n.nspname = 'public';

-- ── Ledger: que ninguna de las dos esté ya ───────────────────

\echo '== L. Ledger: 0514 y 0515 no deben aparecer'
select version, name
  from supabase_migrations.schema_migrations
 where name in ('0514_user_profiles_discord_user_id', '0515_studio_alert_outbox')
    or name like '0514%' or name like '0515%';

rollback;
