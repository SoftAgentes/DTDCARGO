\set ON_ERROR_STOP on
-- Fixture desechable sin datos reales; rollback total.
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null,
  can_view boolean not null, primary key (tenant_id, role, module_id)
);
create table public.sales_orders (
  id uuid primary key, tenant_id uuid not null, deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, sales_order_id uuid,
  invoice_code text not null, total_amount numeric not null, status text not null,
  created_at timestamptz not null, deleted_at timestamptz
);
insert into public.user_tenants values
  ('aaaaaaaa-4130-0000-0000-000000000001', '10000000-4130-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-4130-0000-0000-000000000002', '10000000-4130-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-4130-0000-0000-000000000003', '10000000-4130-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-4130-0000-0000-000000000004', '10000000-4130-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-4130-0000-0000-000000000005', '10000000-4130-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-4130-0000-0000-000000000006', '10000000-4130-0000-0000-000000000001', 'commercial', now()),
  ('bbbbbbbb-4130-0000-0000-000000000001', '20000000-4130-0000-0000-000000000002', 'commercial', null);
insert into public.sales_orders values
  ('71000000-4130-0000-0000-000000000001', '10000000-4130-0000-0000-000000000001', null),
  ('71000000-4130-0000-0000-000000000002', '10000000-4130-0000-0000-000000000001', now()),
  ('72000000-4130-0000-0000-000000000001', '20000000-4130-0000-0000-000000000002', null);
insert into public.invoices values
  ('81000000-4130-0000-0000-000000000001', '10000000-4130-0000-0000-000000000001', '71000000-4130-0000-0000-000000000001', 'F-1', 100, 'emitida', now(), null),
  ('81000000-4130-0000-0000-000000000002', '10000000-4130-0000-0000-000000000001', '71000000-4130-0000-0000-000000000001', 'F-2', 50, 'borrador', now(), null),
  ('81000000-4130-0000-0000-000000000003', '10000000-4130-0000-0000-000000000001', '71000000-4130-0000-0000-000000000001', 'F-3', 50, 'anulada', now(), now()),
  ('81000000-4130-0000-0000-000000000004', '10000000-4130-0000-0000-000000000001', '71000000-4130-0000-0000-000000000002', 'F-4', 50, 'emitida', now(), null),
  ('82000000-4130-0000-0000-000000000001', '20000000-4130-0000-0000-000000000002', '72000000-4130-0000-0000-000000000001', 'F-B1', 777, 'emitida', now(), null),
  ('82000000-4130-0000-0000-000000000002', '20000000-4130-0000-0000-000000000002', '71000000-4130-0000-0000-000000000001', 'F-B2', 888, 'emitida', now(), null);

\ir ../migrations/0413_sales_order_invoice_facade.sql

do $shape$
begin
  if pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure('public.sales_order_invoice_refs(uuid[])'))
     <> 'TABLE(id uuid, sales_order_id uuid, invoice_code text, total_amount numeric, status text, created_at timestamp with time zone)' then
    raise exception 'TEST 0413: shape de la RPC no es mínima';
  end if;
end;
$shape$;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4130-0000-0000-000000000002';
do $scope_and_limit$
declare v_blocked boolean := false;
begin
  if (select count(*) from public.sales_order_invoice_refs(array[
    '71000000-4130-0000-0000-000000000001'::uuid,
    '71000000-4130-0000-0000-000000000002'::uuid,
    '72000000-4130-0000-0000-000000000001'::uuid
  ])) <> 2 then
    raise exception 'TEST 0413: filtro de tenant/soft-delete incorrecto';
  end if;
  if not exists (
    select 1 from public.sales_order_invoice_refs(array['71000000-4130-0000-0000-000000000001'::uuid])
    where invoice_code = 'F-2' and status = 'borrador' and total_amount = 50
  ) then raise exception 'TEST 0413: se perdió la trazabilidad por estado'; end if;
  if (select count(*) from public.sales_order_invoice_refs(array[]::uuid[])) <> 0 then
    raise exception 'TEST 0413: lote vacío no debe devolver facturas';
  end if;
  begin
    perform * from public.sales_order_invoice_refs(array_fill('71000000-4130-0000-0000-000000000001'::uuid, array[501]));
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0413: se aceptó un lote excesivo'; end if;
end;
$scope_and_limit$;
do $denied_roles$
declare v_user uuid; v_blocked boolean;
begin
  foreach v_user in array array[
    'aaaaaaaa-4130-0000-0000-000000000005'::uuid,
    'aaaaaaaa-4130-0000-0000-000000000006'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    v_blocked := false;
    begin
      perform * from public.sales_order_invoice_refs(array['71000000-4130-0000-0000-000000000001'::uuid]);
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception 'TEST 0413: identidad sin acceso ejecutó la RPC'; end if;
  end loop;
end;
$denied_roles$;
do $allowed_roles$
declare v_user uuid;
begin
  foreach v_user in array array[
    'aaaaaaaa-4130-0000-0000-000000000001'::uuid,
    'aaaaaaaa-4130-0000-0000-000000000003'::uuid,
    'aaaaaaaa-4130-0000-0000-000000000004'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if (select count(*) from public.sales_order_invoice_refs(array['71000000-4130-0000-0000-000000000001'::uuid])) <> 2 then
      raise exception 'TEST 0413: rol permitido perdió sus referencias';
    end if;
  end loop;
end;
$allowed_roles$;
reset role;
insert into public.studio_role_module_overrides values
  ('10000000-4130-0000-0000-000000000001', 'commercial', 'sales-orders', false),
  ('10000000-4130-0000-0000-000000000001', 'support', 'sales-orders', true);
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4130-0000-0000-000000000002';
do $revoke$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.sales_order_invoice_refs(array['71000000-4130-0000-0000-000000000001'::uuid]);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0413: revocación explícita ignorada'; end if;
end;
$revoke$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4130-0000-0000-000000000005';
do $grant$
begin
  if (select count(*) from public.sales_order_invoice_refs(array['71000000-4130-0000-0000-000000000001'::uuid])) <> 2 then
    raise exception 'TEST 0413: concesión explícita ignorada';
  end if;
end;
$grant$;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4130-0000-0000-000000000001';
do $tenant_b$
begin
  if (select count(*) from public.sales_order_invoice_refs(array['72000000-4130-0000-0000-000000000001'::uuid])) <> 1 then
    raise exception 'TEST 0413: override del tenant A afectó al B';
  end if;
end;
$tenant_b$;
reset role;
rollback;
select pg_catalog.to_regclass('public.invoices') is null as sales_order_invoice_0413_fixture_rolled_back;
