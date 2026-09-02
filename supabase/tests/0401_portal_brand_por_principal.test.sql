\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0336. Prueba la RPC con datos ficticios y rollback:
-- no consulta ni modifica una base alojada.

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
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid
$$;

create table public.aliados (
  id uuid primary key,
  trade_name text not null,
  brand_name text,
  brand_primary text,
  brand_secondary text,
  support_email text,
  support_whatsapp text,
  support_website text,
  hide_dtd_brand boolean not null default true,
  agreement_notes text,
  billing_value numeric,
  tenant_id uuid not null
);

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  aliado_id uuid,
  deleted_at timestamptz
);

create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  status text not null
);

insert into public.aliados (
  id, tenant_id, trade_name, brand_name, brand_primary, brand_secondary,
  support_email, support_whatsapp, support_website, hide_dtd_brand,
  agreement_notes, billing_value
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Aliado Uno', 'Marca Uno', '#123456', '#ABC', 'uno@example.test',
    '+58 000 0000001', 'https://uno.example.test', true,
    'SECRETO-UNO', 17.25
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Aliado Dos', 'Marca Dos', '#654321', '#DEF', 'dos@example.test',
    '+58 000 0000002', 'https://dos.example.test', false,
    'SECRETO-DOS', 31.50
  );

insert into public.clients (id, tenant_id, aliado_id, deleted_at) values
  (
    '20000000-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', null
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002', null
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    null, null
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', now()
  );

insert into public.client_users (auth_user_id, client_id, status) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'revoked'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'active'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'active');

\ir ../migrations/0401_portal_brand_por_principal.sql

do $contract$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.get_portal_brand()');
  v_result text;
begin
  if v_oid is null then
    raise exception 'TEST 0401: la RPC no existe';
  end if;

  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0401: ACL inválida';
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
    raise exception 'TEST 0401: la RPC no es SECURITY DEFINER con search_path vacío';
  end if;

  select pg_catalog.pg_get_function_result(v_oid) into v_result;
  if v_result ~* '(tenant_id|client_id|agreement_notes|billing_value|marked_by)'
     or v_result !~* 'hide_dtd_brand boolean' then
    raise exception 'TEST 0401: la firma expone columnas internas o perdió la marca';
  end if;
end;
$contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
do $own_brand$
declare
  v_row record;
  v_count integer;
begin
  select count(*) into v_count from public.get_portal_brand();
  if v_count <> 1 then
    raise exception 'TEST 0401: el cliente activo no recibió exactamente una marca';
  end if;

  select * into v_row from public.get_portal_brand();
  if v_row.brand_name <> 'Marca Uno'
     or v_row.support_email <> 'uno@example.test'
     or v_row.hide_dtd_brand is not true then
    raise exception 'TEST 0401: la marca propia llegó incompleta o incorrecta';
  end if;

  if pg_catalog.row_to_json(v_row)::text like '%SECRETO-UNO%'
     or pg_catalog.row_to_json(v_row)::text like '%17.25%'
     or pg_catalog.row_to_json(v_row)::text like '%aaaaaaaa-0000%' then
    raise exception 'TEST 0401: la respuesta filtró datos internos del aliado';
  end if;
end;
$own_brand$;

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000002';
do $other_brand$
declare v_names text[];
begin
  select pg_catalog.array_agg(brand_name) into v_names
  from public.get_portal_brand();
  if v_names <> array['Marca Dos']::text[] then
    raise exception 'TEST 0401: el segundo tenant recibió una marca ajena: %', v_names;
  end if;
end;
$other_brand$;

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if exists (select 1 from public.get_portal_brand()) then
    raise exception 'TEST 0401: una vinculación revocada obtuvo marca';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000004';
do $direct_client$
begin
  if exists (select 1 from public.get_portal_brand()) then
    raise exception 'TEST 0401: un cliente directo obtuvo una fila de aliado';
  end if;
end;
$direct_client$;

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000005';
do $deleted_client$
begin
  if exists (select 1 from public.get_portal_brand()) then
    raise exception 'TEST 0401: un cliente eliminado obtuvo marca';
  end if;
end;
$deleted_client$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_brand()') is null
  as portal_brand_0401_fixture_rolled_back;
