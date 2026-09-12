\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0338. Usa datos ficticios y rollback total.

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
  advisor_id uuid,
  deleted_at timestamptz
);

create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  tenant_id uuid not null,
  status text not null
);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  disabled_at timestamptz
);

create table public.user_profiles (
  user_id uuid primary key,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  position_label text,
  private_note text
);

insert into public.user_profiles (
  user_id, first_name, last_name, phone, avatar_url, position_label, private_note
) values
  ('30000000-0000-0000-0000-000000000001', 'Ana', 'Pérez', '+58 414 000 0001', 'https://cdn.example.test/ana.png', 'Asesora comercial', 'SECRETO-ANA'),
  ('30000000-0000-0000-0000-000000000002', 'Luis', 'Díaz', '+58 414 000 0002', null, 'Asesor logístico', 'SECRETO-LUIS'),
  ('30000000-0000-0000-0000-000000000003', 'Inactivo', 'Ahora', '+58 414 000 0003', null, 'Exasesor', 'SECRETO-INACTIVO');

insert into public.user_tenants (user_id, tenant_id, disabled_at) values
  ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('30000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', null),
  ('30000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', now());

insert into public.clients (id, tenant_id, advisor_id, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null),
  ('10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', null),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', null),
  ('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now());

insert into public.client_users (auth_user_id, client_id, tenant_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'revoked'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'active');

\ir ../migrations/0403_portal_advisor_por_principal.sql

do $contract$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.get_portal_advisor()');
  v_result text;
begin
  if v_oid is null then raise exception 'TEST 0403: la RPC no existe'; end if;

  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0403: ACL inválida';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = v_oid and p.prosecdef
      and exists (
        select 1
        from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
        where config ~ '^search_path=("")?$'
      )
  ) then
    raise exception 'TEST 0403: la RPC no es SECURITY DEFINER con search_path vacío';
  end if;

  select pg_catalog.pg_get_function_result(v_oid) into v_result;
  if v_result ~* '(user_id|tenant_id|advisor_id|private_note)'
     or v_result !~* 'position_label text' then
    raise exception 'TEST 0403: la firma expone datos internos: %', v_result;
  end if;
end;
$contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
do $own_advisor$
declare v_row record;
begin
  select * into v_row from public.get_portal_advisor();
  if v_row.name <> 'Ana Pérez'
     or v_row.phone <> '+58 414 000 0001'
     or v_row.position_label <> 'Asesora comercial'
     or pg_catalog.row_to_json(v_row)::text like '%SECRETO-ANA%' then
    raise exception 'TEST 0403: perfil propio incompleto o con datos internos';
  end if;
end;
$own_advisor$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
do $other_tenant$
declare v_names text[];
begin
  select pg_catalog.array_agg(name) into v_names from public.get_portal_advisor();
  if v_names <> array['Luis Díaz']::text[] then
    raise exception 'TEST 0403: el segundo tenant recibió un asesor ajeno: %', v_names;
  end if;
end;
$other_tenant$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if exists (select 1 from public.get_portal_advisor()) then
    raise exception 'TEST 0403: una vinculación revocada obtuvo asesor';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
do $disabled_advisor$
begin
  if exists (select 1 from public.get_portal_advisor()) then
    raise exception 'TEST 0403: un asesor deshabilitado siguió visible';
  end if;
end;
$disabled_advisor$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000005';
do $deleted_client$
begin
  if exists (select 1 from public.get_portal_advisor()) then
    raise exception 'TEST 0403: un cliente eliminado obtuvo asesor';
  end if;
end;
$deleted_client$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_advisor()') is null
  as portal_advisor_0403_fixture_rolled_back;
