\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0341. Usa datos ficticios y rollback total.

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
  avatar_path text,
  cedula_photo_path text,
  deleted_at timestamptz
);

create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  tenant_id uuid not null,
  status text not null
);

create table public.client_markbox_history (
  tenant_id uuid not null,
  client_id uuid not null,
  markbox text not null,
  retired_at timestamptz not null
);

insert into public.clients values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'tenant-a/DTD-1001/avatar.webp', 'tenant-a/DTD-1001/cedula.webp', null),
  ('10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'tenant-b/DTD-2002/avatar.webp', null, null),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'tenant-a/deleted.webp', null, now());

insert into public.client_users values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'revoked'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'active');

insert into public.client_markbox_history values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-A000', '2026-01-01T00:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-A001', '2026-02-01T00:00:00Z'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'DTD-B001', '2026-03-01T00:00:00Z');

\ir ../migrations/0405_portal_perfil_privado_por_principal.sql

do $contract$
declare v_oid oid := pg_catalog.to_regprocedure('public.get_portal_private_profile_context()');
begin
  if v_oid is null then raise exception 'TEST 0405: la RPC no existe'; end if;
  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0405: ACL inválida';
  end if;
  if pg_catalog.pg_get_function_result(v_oid) <> 'jsonb' then
    raise exception 'TEST 0405: la firma no devuelve jsonb';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = v_oid and p.prosecdef
      and exists (
        select 1 from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
        where config ~ '^search_path=("")?$'
      )
  ) then
    raise exception 'TEST 0405: falta SECURITY DEFINER con search_path vacío';
  end if;
end;
$contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
do $own_context$
declare v_context jsonb := public.get_portal_private_profile_context();
begin
  if v_context->>'avatar_path' <> 'tenant-a/DTD-1001/avatar.webp'
     or v_context->>'cedula_photo_path' <> 'tenant-a/DTD-1001/cedula.webp'
     or v_context#>>'{previous_markboxes,0}' <> 'DTD-A001'
     or v_context#>>'{previous_markboxes,1}' <> 'DTD-A000'
     or v_context::text like '%DTD-B001%'
     or v_context::text like '%tenant-b/%' then
    raise exception 'TEST 0405: contexto propio/orden/aislamiento inválido: %', v_context;
  end if;
end;
$own_context$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
do $other_tenant$
declare v_context jsonb := public.get_portal_private_profile_context();
begin
  if v_context->>'avatar_path' <> 'tenant-b/DTD-2002/avatar.webp'
     or v_context#>>'{previous_markboxes,0}' <> 'DTD-B001'
     or v_context::text like '%DTD-A001%' then
    raise exception 'TEST 0405: el segundo tenant recibió contexto ajeno: %', v_context;
  end if;
end;
$other_tenant$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if public.get_portal_private_profile_context() is not null then
    raise exception 'TEST 0405: una vinculación revocada obtuvo contexto';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
do $deleted$
begin
  if public.get_portal_private_profile_context() is not null then
    raise exception 'TEST 0405: un cliente eliminado obtuvo contexto';
  end if;
end;
$deleted$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_private_profile_context()') is null
  as portal_profile_0405_fixture_rolled_back;
