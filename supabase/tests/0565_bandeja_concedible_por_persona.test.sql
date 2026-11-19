\set ON_ERROR_STOP on

-- SDD-0675 · contrato de la 0565 (la Bandeja se concede por persona).
--
-- Monta lo mismo que el contrato de la 0538 (tenants, usuarios, auditoría) y aplica
-- la 0357, la 0538 y la 0565 REALES. Después concede, mide y revoca un extra de
-- bandeja como lo hará Usuarios.
--
-- CONTROL ROJO: sin 0565 cae en la primera aserción (bandeja no es concedible).
-- Termina siempre en ROLLBACK. Solo ids y correos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.studio_user_module_grants') is not null then
    raise exception 'Fixture 0565 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  warehouse_scope text not null default 'all',
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

-- Forma de 0288.
create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Forma de 0258 + entity_audit_log con FK al catálogo.
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
grant select on public.entity_audit_log to authenticated;

-- Doble de append_audit_event (firma de 0294).
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if not exists (select 1 from public.audit_entity_types where entity_type = p_entity_type and status = 'active') then
    raise exception 'audit: entity_type inexistente o inactivo';
  end if;
  if p_reason is not null and pg_catalog.char_length(p_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres';
  end if;
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, before_data, after_data, payload)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_before_data, p_after_data, p_payload)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1, T2 = 1…2.
-- a1 admin T1 · a2 admin T1 superadmin · c1 contabilidad que también atiende el CRM · c2 contabilidad
-- k1 comercial · s1 support · w1 almacén con scope VE · x1 contabilidad desactivada · o1 admin T2
insert into public.tenants values ('11111111-1111-1111-1111-111111111111'), ('11111111-1111-1111-1111-111111111112');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'), ('a0000000-0000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000c1'), ('a0000000-0000-0000-0000-0000000000c2'),
  ('a0000000-0000-0000-0000-0000000000b1'), ('a0000000-0000-0000-0000-0000000000d1'),
  ('a0000000-0000-0000-0000-0000000000e1'), ('a0000000-0000-0000-0000-0000000000f1'),
  ('a0000000-0000-0000-0000-0000000000f2');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at, warehouse_scope) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'support', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'warehouse', null, 've'),
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'accounting', now(), 'all'),
  ('a0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111112', 'admin', null, 'all');
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');

\ir ../migrations/0357_role_module_overrides.sql
\ir ../migrations/0538_studio_user_module_grants.sql
\ir ../migrations/0565_bandeja_concedible_por_persona.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0565: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Corre un SQL como un usuario (authenticated con su sub) o, con null, como service_role.
create function pg_temp.como(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute p_sql;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create function pg_temp.valor(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute 'select (' || p_sql || ')::text' into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

create function pg_temp.falla(p_user uuid, p_sql text, p_patron text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    perform pg_temp.como(p_user, p_sql);
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_msg is not null and v_msg ~ p_patron,
    p_label || ' (error: ' || coalesce(v_msg, 'ninguno') || ')');
end;
$$;

-- ¿Tiene el módulo? como el usuario.
create function pg_temp.tiene(p_user text, p_module text, p_edit boolean) returns boolean language sql as $$
  select pg_temp.valor(('a0000000-0000-0000-0000-0000000000' || p_user)::uuid,
    format('public.user_has_module(%L, %L)', p_module, p_edit))::boolean;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;


-- ── SDD-0675 · 0565: la Bandeja se concede por persona ────────────────────
select pg_temp.assert_true(public.studio_module_is_grantable('bandeja'), '1: la 0565 deja conceder bandeja');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'bandeja', false), '2a: sin extra, contabilidad no ve la Bandeja');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'bandeja', true, false, 'Atiende chats de leads y clientes')$q$, pg_temp.u('c1')));
select pg_temp.assert_true(pg_temp.tiene('c1', 'bandeja', false), '2b: con el extra ve la Bandeja');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'bandeja', true), '2c: un extra de solo ver no edita');
select pg_temp.assert_true(not pg_temp.tiene('c2', 'bandeja', false), '2d: otra persona de contabilidad sigue sin Bandeja');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'bandeja', true, true, 'Atiende y une chats a fichas')$q$, pg_temp.u('c1')));
select pg_temp.assert_true(pg_temp.tiene('c1', 'bandeja', true), '2e: ver y editar edita (unir chat a ficha, 0554)');
select pg_temp.falla(pg_temp.u('c2'),
  format($q$select public.studio_grant_user_module(%L, 'bandeja', true, false, 'Se lo da contabilidad')$q$, pg_temp.u('c1')),
  'Solo un administrador', '3: solo un admin concede la Bandeja');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'cn', true, false, 'Mira el almacén de China')$q$, pg_temp.u('c2')),
  'no se puede conceder', '4: la lista no se abrió de más: un módulo no cubierto sigue rechazado');
select pg_temp.assert_true(not public.studio_module_is_grantable('admin') and not public.studio_module_is_grantable('users'),
  '5: admin y users siguen fuera de la lista');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_revoke_user_module_grant(%L, 'bandeja', 'Ya no atiende chats')$q$, pg_temp.u('c1')));
select pg_temp.assert_true(not pg_temp.tiene('c1', 'bandeja', false), '6: al revocar deja de ver la Bandeja');
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.studio_module_is_grantable(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.studio_module_is_grantable(text)', 'EXECUTE'),
  '7: los privilegios de la función no cambian');

select 'TEST 0565 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
