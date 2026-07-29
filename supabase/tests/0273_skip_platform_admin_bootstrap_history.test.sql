\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260529071707',
  'platform_admins',
  array[$sdd0118_platform_admin_source$-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- ─── Seed: primer platform_admin ─────────────────────────────
-- hailuway.com@gmail.com (user_id resuelto en Paso 0) = vendor / founder.
insert into public.platform_admins (user_id, notes)
values (
  '83c98d22-ea54-4d7a-b10f-a23098a2edbe',
  'Bootstrap inicial — founder / vendor HailuWay (Paso 0 SDD-0037)'
)
on conflict (user_id) do nothing;
$sdd0118_platform_admin_source$]
);

\ir ../migrations/0273_skip_platform_admin_bootstrap_history.sql
\ir ../migrations/0273_skip_platform_admin_bootstrap_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'TEST 0273: estado final incorrecto en 20260529071707';
  end if;
end
$ledger_contract$;

-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.


do $replay_contract$
begin
  if to_regclass('public.platform_admins') is null then
    raise exception 'TEST 0273: falta public.platform_admins';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'TEST 0273: el replay creó un platform_admin';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'platform_admins'
      and c.conname = 'platform_admins_user_id_fkey'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
      and c.confdeltype = 'c'
  ) then
    raise exception 'TEST 0273: FK platform_admins_user_id_fkey incorrecta';
  end if;
  if not coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.platform_admins'::regclass
  ), false) then
    raise exception 'TEST 0273: RLS no está habilitado';
  end if;
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_admins'
      and policyname in (
        'platform_admins_self_select',
        'service_role_all_platform_admins'
      )
  ) <> 2 then
    raise exception 'TEST 0273: policies incompletas';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.platform_admins',
    'SELECT'
  ) then
    raise exception 'TEST 0273: falta SELECT de authenticated';
  end if;
  if not has_table_privilege(
    'service_role',
    'public.platform_admins',
    'SELECT, INSERT, UPDATE, DELETE'
  ) then
    raise exception 'TEST 0273: grants de service_role incompletos';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.is_platform_admin()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0273: falta EXECUTE de authenticated';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_platform_admin'
      and p.prosecdef
      and p.proconfig @> array['search_path=public']
  ) then
    raise exception 'TEST 0273: is_platform_admin no conserva hardening';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.platform_admins') is null
  as sdd_0118_platform_admin_fixture_rolled_back;
