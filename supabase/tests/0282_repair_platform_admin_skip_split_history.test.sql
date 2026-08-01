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
values
(
  '20260529071707',
  'platform_admins',
  array[
    $sdd0118_platform_admin_split_0$-- ─────────────────────────────────────────────────────────────
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
)$sdd0118_platform_admin_split_0$,
    $sdd0118_platform_admin_split_1$comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.'$sdd0118_platform_admin_split_1$,
    $sdd0118_platform_admin_split_2$alter table public.platform_admins enable row level security$sdd0118_platform_admin_split_2$,
    $sdd0118_platform_admin_split_3$-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  )$sdd0118_platform_admin_split_3$,
    $sdd0118_platform_admin_split_4$-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true)$sdd0118_platform_admin_split_4$,
    $sdd0118_platform_admin_split_5$grant select on public.platform_admins to authenticated$sdd0118_platform_admin_split_5$,
    $sdd0118_platform_admin_split_6$grant all on public.platform_admins to service_role$sdd0118_platform_admin_split_6$,
    $sdd0118_platform_admin_split_7$-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
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
$$$sdd0118_platform_admin_split_7$,
    $sdd0118_platform_admin_split_8$grant execute on function public.is_platform_admin() to authenticated$sdd0118_platform_admin_split_8$,
    $sdd0118_platform_admin_split_9$-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.$sdd0118_platform_admin_split_9$
  ]
),
(
  '20260729141805',
  '0273_skip_platform_admin_bootstrap_history',
  array[$sdd0118_platform_admin_split_original_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) in (
        '6c31b8ac8841b24815e3fb2463eabdd2',
        'bb99b54106d671457836daa0dc53b839',
        'cb374d4ad4c3b2bb62915e80a5a13793'
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839');

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_original_0273$ || chr(13) || chr(10)]
);

\ir ../migrations/0282_repair_platform_admin_skip_split_history.sql
\ir ../migrations/0282_repair_platform_admin_skip_split_history.sql

do $ledger_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729141805'
    and name = '0273_skip_platform_admin_bootstrap_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = '7866d00b211f8158f79117657fd8a8d1';

  if v_payload <> $sdd0118_platform_admin_split_expected_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            'cb374d4ad4c3b2bb62915e80a5a13793'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
        )
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
    )
  );

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_expected_0273$ || chr(13) || chr(10) then
    raise exception 'TEST 0282: payload 0273 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '4912baa3058c9f1a4f2281b843499fcd') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 10') = 0 then
    raise exception 'TEST 0282: falta compatibilidad con el split de R13';
  end if;
end
$ledger_contract$;

select unnest(statements[1:9])
from supabase_migrations.schema_migrations
where version = '20260529071707'
  and name = 'platform_admins'
\gexec

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729141805'
  and name = '0273_skip_platform_admin_bootstrap_history'
\gexec

do $replay_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'TEST 0282: el replay no colapsó platform_admins al target exacto';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'TEST 0282: el replay creó un platform_admin';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.platform_admins') is null
  as sdd_0118_platform_admin_split_fixture_rolled_back;
