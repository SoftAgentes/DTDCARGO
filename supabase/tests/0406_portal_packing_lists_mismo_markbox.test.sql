\set ON_ERROR_STOP on

-- SDD-0342 · L06: frontera de tenant con el MISMO Shipping Mark.
-- clients es unique (tenant_id, markbox) (0006), así que 'DTD-1001' puede
-- existir en dos tenants. La lectura previa filtraba packing lists sólo por
-- Shipping Mark con service_role; la RPC 0406 exige además tenant coherente en
-- vínculo, cliente, packing list y compra. Fixture propia; termina en ROLLBACK.

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
  ('1000000a-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', null),
  ('1000000b-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-1001', null);
insert into public.client_users values
  ('2000000a-0000-0000-0000-000000000001', '1000000a-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('2000000b-0000-0000-0000-000000000002', '1000000b-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'active');
insert into public.prealertas values
  ('3000000a-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'PRE-A', null),
  ('3000000b-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-1001', 'PRE-B', null);
insert into public.packing_list_submissions values
  ('4000000a-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '3000000a-0000-0000-0000-000000000001', 'DTD-1001', 'PL-A', 3, true, '2026-09-02T00:00:00Z', null, 'a@test', '[]', 10),
  ('4000000b-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '3000000b-0000-0000-0000-000000000002', 'DTD-1001', 'PL-B', 5, true, '2026-09-03T00:00:00Z', null, 'b@test', '[]', 20),
  ('4000000c-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3000000b-0000-0000-0000-000000000002', 'DTD-1001', 'PL-CRUZADA', 7, true, '2026-09-04T00:00:00Z', null, 'c@test', '[]', 30);

\ir ../migrations/0406_portal_packing_lists_por_principal.sql

set local role authenticated;
set local "request.jwt.claim.sub" = '2000000a-0000-0000-0000-000000000001';
do $tenant_a$
declare v_rows jsonb;
begin
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)) into v_rows
  from public.get_portal_packing_list_documents() as x;
  if pg_catalog.jsonb_array_length(v_rows) <> 1
     or v_rows#>>'{0,folio}' <> 'PL-A'
     or v_rows#>>'{0,purchase_code}' <> 'PRE-A'
     or v_rows::text ~ '(PL-B|PRE-B|PL-CRUZADA)' then
    raise exception 'TEST 0406 mismo Shipping Mark: tenant A recibió filas ajenas o incoherentes: %', v_rows;
  end if;
end;
$tenant_a$;

set local "request.jwt.claim.sub" = '2000000b-0000-0000-0000-000000000002';
do $tenant_b$
declare v_rows jsonb;
begin
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)) into v_rows
  from public.get_portal_packing_list_documents() as x;
  if pg_catalog.jsonb_array_length(v_rows) <> 1
     or v_rows#>>'{0,folio}' <> 'PL-B'
     or v_rows#>>'{0,purchase_code}' <> 'PRE-B'
     or v_rows::text ~ '(PL-A|PRE-A|PL-CRUZADA)' then
    raise exception 'TEST 0406 mismo Shipping Mark: tenant B recibió filas ajenas o incoherentes: %', v_rows;
  end if;
end;
$tenant_b$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_packing_list_documents()') is null
  as portal_packing_0406_mismo_markbox_rolled_back;
