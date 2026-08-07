\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0355. Fixtures ficticios y rollback: no toca prod.
--
-- UN CAMBIO DE PERMISOS SE PRUEBA POR LOS DOS LADOS. Lo que defiende:
--   1. un admin NO-plataforma no puede SUSPENDER a otro admin  ← el hueco real
--   2. un admin SÍ-plataforma sí puede
--   3. un admin normal sigue pudiendo suspender a un NO-admin (cero regresión)
--   4. un admin puede actuar sobre SÍ MISMO (no lo encerramos)
--   5. un admin NO-plataforma no puede DEGRADAR a otro admin
--   6. ni ASCENDER a nadie a admin (si no, se fabrica aliados y da lo mismo)
--   7. el anti-lockout del último admin (0200) sigue vivo
--   8. feature_flags: un admin normal NO actualiza; el de plataforma SÍ
--
-- El punto 3 importa tanto como el 1: una regla de seguridad que además rompe
-- la operación diaria se termina revirtiendo.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
-- `email` porque 0355 busca por correo la cuenta de respaldo del founder.
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

-- platform_admins tal como la deja 0058
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  notes text
);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create table public.feature_flags (
  tenant_id uuid not null,
  key text not null,
  enabled boolean not null default false,
  primary key (tenant_id, key)
);
alter table public.feature_flags enable row level security;
grant select, update on public.feature_flags to authenticated;
create policy feature_flags_tenant_select on public.feature_flags
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
-- La policy VIEJA que 0355 debe reemplazar: cualquier admin del tenant.
create policy feature_flags_admin_update on public.feature_flags
  for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid()) and ut.tenant_id = feature_flags.tenant_id
        and ut.role = 'admin' and ut.disabled_at is null
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- Versiones VIVAS (0200) de las dos funciones, para que 0355 las reemplace.
create function public.studio_set_user_disabled(p_target_user_id uuid, p_disabled boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $f$
declare v_tenant_id uuid := public.get_user_tenant_id(); v_actor uuid := auth.uid();
        v_actor_role text; v_target_role text; v_target_disabled_at timestamptz; v_other int;
begin
  select role into v_actor_role from public.user_tenants
   where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins' using errcode = '42501'; end if;
  select role, disabled_at into v_target_role, v_target_disabled_at from public.user_tenants
   where user_id = p_target_user_id and tenant_id = v_tenant_id;
  update public.user_tenants set disabled_at = case when p_disabled then now() else null end
   where user_id = p_target_user_id and tenant_id = v_tenant_id;
  return true;
end; $f$;

create function public.studio_change_user_role(p_target_user_id uuid, p_new_role text)
returns boolean language plpgsql security definer set search_path to 'public' as $f$
begin
  update public.user_tenants set role = p_new_role where user_id = p_target_user_id;
  return true;
end; $f$;

-- ── Fixture ────────────────────────────────────────────────────────────────
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','sam@ejemplo.test'),      -- admin + PLATAFORMA
  ('a0000000-0000-0000-0000-000000000002','jose@ejemplo.test'),     -- admin normal
  ('a0000000-0000-0000-0000-000000000003','vzla@ejemplo.test'),     -- admin normal
  ('a0000000-0000-0000-0000-000000000004','yolimar@ejemplo.test'),  -- contabilidad
  -- La cuenta de respaldo, con el correo REAL que busca la migración: así el
  -- test ejerce el camino que de verdad va a correr en producción.
  ('a0000000-0000-0000-0000-000000000005','hailuway.com@hotmail.com');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','accounting');
insert into public.platform_admins (user_id) values ('a0000000-0000-0000-0000-000000000001');
insert into public.feature_flags (tenant_id, key, enabled) values
  ('11111111-1111-1111-1111-111111111111','whatsapp', true);

\ir ../migrations/0355_superadmin_llaves_del_sistema.sql

-- ── 0. El segundo juego de llaves quedó COMPLETO ───────────────────────────
-- No basta con la llave: sin membresía de admin, `is_platform_admin()` diría
-- true pero la cuenta no podría abrir ninguna pantalla del Studio — sostendría
-- un permiso que no puede ejercer. Se prueban las DOS mitades.
do $t0$
declare v_rol text; v_llave boolean;
begin
  select ut.role into v_rol from public.user_tenants ut
   where ut.user_id = 'a0000000-0000-0000-0000-000000000005';
  select exists(select 1 from public.platform_admins
                 where user_id='a0000000-0000-0000-0000-000000000005') into v_llave;

  if not v_llave then
    raise exception 'La cuenta de respaldo no recibio la llave de plataforma';
  end if;
  if v_rol is distinct from 'admin' then
    raise exception 'La cuenta de respaldo quedo SIN rol admin (rol: %) — la llave no abriria nada', coalesce(v_rol,'ninguno');
  end if;
end;
$t0$;

-- ── 1 + 2 + 3 + 4. Suspender ───────────────────────────────────────────────
do $t1$
declare ok boolean;
begin
  -- (1) Jose (admin, NO plataforma) intenta suspender a VZLA (admin) → NO
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  ok := false;
  begin
    perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000003', true);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then
    raise exception 'HUECO ABIERTO: un admin normal suspendio a otro admin';
  end if;

  -- (3) pero a un NO-admin sigue pudiendo (cero regresion operativa)
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000004', true);
  if (select disabled_at from public.user_tenants
       where user_id='a0000000-0000-0000-0000-000000000004') is null then
    raise exception 'Regresion: un admin ya no puede suspender a un no-admin';
  end if;
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000004', false);

  -- (4) y sobre si mismo tambien
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000002', true);
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000002', false);

  -- (2) Sam (plataforma) SI puede con otro admin
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000003', true);
  if (select disabled_at from public.user_tenants
       where user_id='a0000000-0000-0000-0000-000000000003') is null then
    raise exception 'El superadmin no pudo suspender a un admin';
  end if;
  perform public.studio_set_user_disabled('a0000000-0000-0000-0000-000000000003', false);
end;
$t1$;

-- ── 5 + 6. Cambiar rol ─────────────────────────────────────────────────────
do $t2$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);

  -- (5) degradar a otro admin → NO
  ok := false;
  begin
    perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000003','support');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: un admin normal degrado a otro admin'; end if;

  -- (6) ascender a alguien a admin → NO (si no, se fabrica aliados)
  ok := false;
  begin
    perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000004','admin');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: un admin normal fabrico otro admin'; end if;

  -- pero cambiar el rol de un NO-admin a un rol NO-admin sigue funcionando
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000004','support');
  if (select role from public.user_tenants
       where user_id='a0000000-0000-0000-0000-000000000004') <> 'support' then
    raise exception 'Regresion: un admin ya no puede cambiar el rol de un no-admin';
  end if;
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000004','accounting');

  -- y el superadmin sí puede ascender
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000004','admin');
  if (select role from public.user_tenants
       where user_id='a0000000-0000-0000-0000-000000000004') <> 'admin' then
    raise exception 'El superadmin no pudo ascender a nadie';
  end if;
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000004','accounting');
end;
$t2$;

-- ── 7. El anti-lockout del último admin sigue vivo ─────────────────────────
do $t3$
declare ok boolean;
begin
  -- Dejamos a Sam como UNICO admin activo y que intente degradarse.
  -- Ojo: la cuenta de respaldo (…005) tambien es admin desde que la migracion
  -- la creo, asi que hay que degradarla tambien o Sam nunca es el ultimo.
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000002','support');
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000003','support');
  perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000005','support');

  ok := false;
  begin
    perform public.studio_change_user_role('a0000000-0000-0000-0000-000000000001','support');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'El anti-lockout del ultimo admin se perdio'; end if;
end;
$t3$;

-- ── 8. Feature flags: sólo el de plataforma ────────────────────────────────
do $t4$
declare n int;
begin
  if exists (select 1 from pg_policies where schemaname='public'
              and tablename='feature_flags' and policyname='feature_flags_admin_update') then
    raise exception 'La policy vieja de feature_flags sigue viva';
  end if;
end;
$t4$;

set local role authenticated;

do $t5$
declare n int;
begin
  -- Jose (admin normal): la policy no lo deja → 0 filas afectadas
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  update public.feature_flags set enabled = false
   where tenant_id='11111111-1111-1111-1111-111111111111' and key='whatsapp';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'HUECO: un admin normal apago un feature flag (% filas)', n;
  end if;

  -- Sam (plataforma): sí
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  update public.feature_flags set enabled = false
   where tenant_id='11111111-1111-1111-1111-111111111111' and key='whatsapp';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'El superadmin no pudo apagar un feature flag (% filas)', n;
  end if;
end;
$t5$;

reset role;

rollback;
