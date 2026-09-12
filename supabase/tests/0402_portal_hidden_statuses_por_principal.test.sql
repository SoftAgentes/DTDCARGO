\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0337. Usa datos ficticios y rollback total.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  deleted_at timestamptz
);

create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  tenant_id uuid not null,
  status text not null
);

create table public.client_notification_rules (
  tenant_id uuid not null,
  client_id uuid,
  trigger_event text not null,
  visible_in_portal boolean not null
);

insert into public.clients (id, tenant_id, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('10000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', null),
  ('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', now());

insert into public.client_users (auth_user_id, client_id, tenant_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'revoked'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'active');

insert into public.client_notification_rules (
  tenant_id, client_id, trigger_event, visible_in_portal
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'status:in_customs', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'status:shipped', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'status:shipped', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'status:delivered', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'status:delivered', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'status:in_customs', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', null, 'status:received_ve', false),
  ('bbbbbbbb-0000-0000-0000-000000000002', null, 'status:in_customs', true);

\ir ../migrations/0402_portal_hidden_statuses_por_principal.sql

do $contract$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.get_portal_hidden_shipment_statuses()');
  v_result text;
begin
  if v_oid is null then
    raise exception 'TEST 0402: la RPC no existe';
  end if;

  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0402: ACL inválida';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid = v_oid
      and p.prosecdef
      and exists (
        select 1
        from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
        where config ~ '^search_path=("")?$'
      )
  ) then
    raise exception 'TEST 0402: la RPC no es SECURITY DEFINER con search_path vacío';
  end if;

  select pg_catalog.pg_get_function_result(v_oid) into v_result;
  if v_result !~* '^TABLE\(status text\)$'
     or v_result ~* '(tenant_id|client_id|trigger_event|visible_in_portal)' then
    raise exception 'TEST 0402: la firma expone configuración interna: %', v_result;
  end if;
end;
$contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
do $own_rules$
declare v_statuses text[];
begin
  select pg_catalog.array_agg(status order by status) into v_statuses
  from public.get_portal_hidden_shipment_statuses();
  if v_statuses <> array['delivered', 'in_customs']::text[] then
    raise exception 'TEST 0402: precedencia o aislamiento incorrectos: %', v_statuses;
  end if;
end;
$own_rules$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
do $other_tenant$
declare v_statuses text[];
begin
  select pg_catalog.array_agg(status order by status) into v_statuses
  from public.get_portal_hidden_shipment_statuses();
  if v_statuses <> array['received_ve']::text[] then
    raise exception 'TEST 0402: el segundo tenant recibió reglas ajenas: %', v_statuses;
  end if;
end;
$other_tenant$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if exists (select 1 from public.get_portal_hidden_shipment_statuses()) then
    raise exception 'TEST 0402: una vinculación revocada obtuvo reglas';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
do $deleted_client$
begin
  if exists (select 1 from public.get_portal_hidden_shipment_statuses()) then
    raise exception 'TEST 0402: un cliente eliminado obtuvo reglas';
  end if;
end;
$deleted_client$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_hidden_shipment_statuses()') is null
  as portal_hidden_statuses_0402_fixture_rolled_back;
