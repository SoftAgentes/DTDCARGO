\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clients (
  id uuid primary key, tenant_id uuid not null, markbox text not null,
  deleted_at timestamptz
);
create table public.client_users (
  auth_user_id uuid, client_id uuid not null, tenant_id uuid not null,
  status text not null
);
create table public.prealertas (
  id uuid primary key, tenant_id uuid not null, client_markbox text not null,
  code text not null, deleted_at timestamptz
);
create table public.packing_list_submissions (
  id uuid primary key, tenant_id uuid not null, prealerta_id uuid not null,
  client_markbox text not null, folio text, total_ctns numeric not null,
  is_current boolean not null, created_at timestamptz not null,
  deleted_at timestamptz, supplier_email text, rows jsonb, total_amount numeric
);

insert into public.clients values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', null),
  ('10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-2002', null),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1003', now());
insert into public.client_users values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'revoked'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'active');
insert into public.prealertas values
  ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'PRE-1001', null),
  ('30000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-2002', 'PRE-2002', null),
  ('30000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'PRE-DELETED', now());
insert into public.packing_list_submissions values
  ('40000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'DTD-1001', 'PL-A', 4, true, '2026-09-02T00:00:00Z', null, 'secret-a@test', '[{"secret":true}]', 1000),
  ('40000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'DTD-1001', 'PL-OLD', 9, false, '2026-09-01T00:00:00Z', null, 'old@test', '[]', 900),
  ('40000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'DTD-2002', 'PL-B', 2, true, '2026-09-03T00:00:00Z', null, 'secret-b@test', '[]', 500),
  ('40000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'DTD-1001', 'PL-DELETED', 1, true, '2026-09-04T00:00:00Z', null, 'deleted@test', '[]', 100);

\ir ../migrations/0406_portal_packing_lists_por_principal.sql

do $contract$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.get_portal_packing_list_documents()');
  v_result text;
begin
  if v_oid is null then raise exception 'TEST 0406: la RPC no existe'; end if;
  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0406: ACL inválida';
  end if;
  select pg_catalog.pg_get_function_result(v_oid) into v_result;
  if v_result ~* '(tenant|client|email|rows|amount)' or v_result !~* 'purchase_code text' then
    raise exception 'TEST 0406: firma expone campos internos: %', v_result;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = v_oid and p.prosecdef
      and exists (
        select 1 from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
        where config ~ '^search_path=("")?$'
      )
  ) then
    raise exception 'TEST 0406: falta SECURITY DEFINER con search_path vacío';
  end if;
end;
$contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
do $own_docs$
declare v_rows jsonb;
begin
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)) into v_rows
  from public.get_portal_packing_list_documents() as x;
  if pg_catalog.jsonb_array_length(v_rows) <> 1
     or v_rows#>>'{0,purchase_code}' <> 'PRE-1001'
     or v_rows#>>'{0,folio}' <> 'PL-A'
     or (v_rows#>>'{0,boxes}')::numeric <> 4
     or v_rows::text like '%PL-B%'
     or v_rows::text ~ '(secret-a|rows|total_amount)' then
    raise exception 'TEST 0406: snapshot propio/aislamiento/minimización inválido: %', v_rows;
  end if;
end;
$own_docs$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
do $other_tenant$
declare v_code text;
begin
  select purchase_code into v_code from public.get_portal_packing_list_documents();
  if v_code <> 'PRE-2002' then
    raise exception 'TEST 0406: segundo tenant recibió compra incorrecta: %', v_code;
  end if;
end;
$other_tenant$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if exists (select 1 from public.get_portal_packing_list_documents()) then
    raise exception 'TEST 0406: vínculo revocado obtuvo documentos';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
do $deleted$
begin
  if exists (select 1 from public.get_portal_packing_list_documents()) then
    raise exception 'TEST 0406: cliente eliminado obtuvo documentos';
  end if;
end;
$deleted$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_packing_list_documents()') is null
  as portal_packing_0406_fixture_rolled_back;
