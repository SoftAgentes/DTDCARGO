\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0357. Fixtures ficticios y rollback: no toca prod.
--
-- UN CAMBIO DE PERMISOS SE PRUEBA POR LOS DOS LADOS. Lo que defiende:
--   1. un NO-admin no puede llamar al RPC (ni ver ni editar la matriz)
--   2. un admin SÍ puede otorgar acceso a un módulo no bloqueado
--   3. el RPC RECHAZA cualquier módulo de LOCKED_MODULES (candado de
--      gobernanza) — el hueco real que esto existe para cerrar
--   4. el RPC rechaza un rol inválido ('admin' incluido — no aplica acá)
--   5. can_view=false, can_edit=false se GUARDA tal cual — es una revocación
--      explícita, no un sinónimo de "sin override"
--   6. studio_reset_role_module_access SÍ borra la fila (vuelve al default);
--      un no-admin no puede llamarlo
--   7. authenticated NO puede insertar directo en la tabla (bypass del RPC)
--   8. la lectura (select) sigue abierta a cualquier autenticado del tenant
--   9. el CHECK de la tabla frena un insert directo con service_role sobre un
--      módulo candado — defensa en profundidad aunque alguien bypasee el RPC

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id),
  constraint user_tenants_user_id_profile_fkey
    foreign key (user_id) references public.user_profiles(user_id)
);
grant select on public.user_tenants to authenticated;

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

-- ── Fixture ─────────────────────────────────────────────────────────────
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','sam@ejemplo.test'),        -- admin
  ('a0000000-0000-0000-0000-000000000002','fiorella@ejemplo.test');   -- marketing
insert into public.user_profiles (user_id) values
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','marketing');

\ir ../migrations/0357_role_module_overrides.sql

set local role authenticated;

-- ── 1. un NO-admin no puede llamar al RPC ──────────────────────────────────
do $t1$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  ok := false;
  begin
    perform public.studio_set_role_module_access('marketing','reports', true, false);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: un no-admin editó la matriz de permisos'; end if;
end;
$t1$;

-- ── 2. un admin SÍ puede otorgar un módulo no bloqueado ────────────────────
do $t2$
declare v_view boolean; v_edit boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_set_role_module_access('marketing','tracking', true, false);
  select can_view, can_edit into v_view, v_edit
    from public.studio_role_module_overrides
    where tenant_id='11111111-1111-1111-1111-111111111111' and role='marketing' and module_id='tracking';
  if v_view is distinct from true or v_edit is distinct from false then
    raise exception 'El admin no pudo otorgar Ver sobre tracking a marketing';
  end if;
end;
$t2$;

-- ── 3. el RPC rechaza cualquier LOCKED_MODULE ──────────────────────────────
do $t3$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  -- money
  ok := false;
  begin
    perform public.studio_set_role_module_access('marketing','nomina', true, false);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: la matriz dejó tocar nomina (dinero)'; end if;

  -- admin-only
  ok := false;
  begin
    perform public.studio_set_role_module_access('marketing','legal', true, false);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: la matriz dejó tocar legal (admin-only)'; end if;

  if exists (
    select 1 from public.studio_role_module_overrides
    where role='marketing' and module_id in ('nomina','legal')
  ) then
    raise exception 'Quedó guardado un override sobre un módulo candado';
  end if;
end;
$t3$;

-- ── 4. rol inválido ─────────────────────────────────────────────────────
do $t4$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  ok := false;
  begin
    perform public.studio_set_role_module_access('admin','tracking', true, false);
  exception when invalid_text_representation or others then ok := true;
  end;
  if not ok then raise exception 'HUECO: el RPC aceptó rol=admin (admin ya lo ve todo, no debe listarse)'; end if;
end;
$t4$;

-- ── 5. false/false se GUARDA como revocación explícita ─────────────────────
do $t5$
declare v_view boolean; v_edit boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_set_role_module_access('marketing','tracking', false, false);
  select can_view, can_edit into v_view, v_edit
    from public.studio_role_module_overrides
    where role='marketing' and module_id='tracking';
  if v_view is distinct from false or v_edit is distinct from false then
    raise exception 'false/false debió guardarse tal cual (revocación explícita)';
  end if;
end;
$t5$;

-- ── 6. reset SÍ borra; un no-admin no puede llamarlo ───────────────────────
do $t6$
declare ok boolean;
begin
  -- Jose (marketing, no-admin) no puede resetear
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  ok := false;
  begin
    perform public.studio_reset_role_module_access('marketing','tracking');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: un no-admin reseteó la matriz'; end if;

  -- Sam (admin) sí puede, y la fila desaparece
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_reset_role_module_access('marketing','tracking');
  if exists (
    select 1 from public.studio_role_module_overrides
    where role='marketing' and module_id='tracking'
  ) then
    raise exception 'El reset no borró el override';
  end if;
end;
$t6$;

-- ── 7. authenticated no puede insertar directo (bypass del RPC) ───────────
do $t7$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  ok := false;
  begin
    insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view)
    values ('11111111-1111-1111-1111-111111111111','marketing','tracking', true);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'HUECO: authenticated insertó directo, bypaseando el RPC'; end if;
end;
$t7$;

-- ── 8. lectura sigue abierta a cualquier autenticado del tenant ───────────
do $t8$
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  perform public.studio_set_role_module_access('marketing','tracking', true, false);
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  if not exists (
    select 1 from public.studio_role_module_overrides
    where role='marketing' and module_id='tracking'
  ) then
    raise exception 'Un no-admin del tenant no pudo LEER la matriz';
  end if;
end;
$t8$;

reset role;

-- ── 9. el CHECK frena incluso a service_role sobre un módulo candado ──────
do $t9$
declare ok boolean;
begin
  ok := false;
  begin
    insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view)
    values ('11111111-1111-1111-1111-111111111111','marketing','legal', true);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'El CHECK de candado no frenó un insert directo sobre legal'; end if;
end;
$t9$;

rollback;
