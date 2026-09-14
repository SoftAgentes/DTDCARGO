\set ON_ERROR_STOP on
-- Contrato integrado: policies RLS + los tres facades reales; datos sintéticos.
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null,
  can_view boolean not null, primary key (tenant_id, role, module_id)
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null, markbox text not null,
  deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.client_users (
  auth_user_id uuid primary key, tenant_id uuid not null,
  client_id uuid not null references public.clients(id), status text not null
);
create function public.get_portal_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select cu.client_id from public.client_users cu
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active' limit 1
$$;
create function public.get_portal_client_markbox() returns text
language sql stable security definer set search_path = '' as $$
  select c.markbox from public.client_users cu join public.clients c on c.id = cu.client_id
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active' limit 1
$$;
grant select on public.clients, public.client_users to authenticated;
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
create policy "clients by tenant" on public.clients for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "clients portal self read" on public.clients for select to authenticated
  using (deleted_at is null and id = public.get_portal_client_id());
create policy "client_users self or tenant read" on public.client_users for select to authenticated
  using (auth_user_id = auth.uid() or tenant_id = public.get_user_tenant_id());
create table public.conversations (
  id uuid primary key, tenant_id uuid not null, client_id uuid, deleted_at timestamptz
);
create table public.sales_orders (
  id uuid primary key, tenant_id uuid not null, deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, invoice_code text not null,
  client_markbox text, total_amount numeric not null, paid_amount numeric,
  currency text not null, fx_rate numeric, status text not null,
  issued_at date, created_at timestamptz not null, sales_order_id uuid, deleted_at timestamptz
);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "invoices by tenant" on public.invoices for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
\ir ../migrations/0085_portal_invoices_rls.sql
\ir ../migrations/0407_invoices_write_rbac.sql
\ir ../migrations/0411_client_annual_billing_facade.sql
\ir ../migrations/0412_conversation_outstanding_facade.sql
\ir ../migrations/0413_sales_order_invoice_facade.sql

insert into public.user_tenants values
  ('aaaaaaaa-4140-0000-0000-000000000001', '10000000-4140-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-4140-0000-0000-000000000002', '10000000-4140-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-4140-0000-0000-000000000003', '10000000-4140-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-4140-0000-0000-000000000004', '10000000-4140-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-4140-0000-0000-000000000005', '10000000-4140-0000-0000-000000000001', 'warehouse', null),
  ('aaaaaaaa-4140-0000-0000-000000000006', '10000000-4140-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-4140-0000-0000-000000000007', '10000000-4140-0000-0000-000000000001', 'marketing', null),
  ('aaaaaaaa-4140-0000-0000-000000000008', '10000000-4140-0000-0000-000000000001', 'accounting', now()),
  ('bbbbbbbb-4140-0000-0000-000000000002', '20000000-4140-0000-0000-000000000002', 'accounting', null);
insert into public.clients values
  ('31000000-4140-0000-0000-000000000001', '10000000-4140-0000-0000-000000000001', 'DUP', null),
  ('31000000-4140-0000-0000-000000000002', '10000000-4140-0000-0000-000000000001', 'OTHER', null),
  ('31000000-4140-0000-0000-000000000003', '10000000-4140-0000-0000-000000000001', 'DEAD', now()),
  ('32000000-4140-0000-0000-000000000001', '20000000-4140-0000-0000-000000000002', 'DUP', null);
insert into public.client_users values
  ('aaaaaaaa-4140-0000-0000-000000000101', '10000000-4140-0000-0000-000000000001', '31000000-4140-0000-0000-000000000001', 'active'),
  ('bbbbbbbb-4140-0000-0000-000000000101', '20000000-4140-0000-0000-000000000002', '32000000-4140-0000-0000-000000000001', 'active'),
  ('aaaaaaaa-4140-0000-0000-000000000102', '10000000-4140-0000-0000-000000000001', '31000000-4140-0000-0000-000000000002', 'revoked'),
  ('aaaaaaaa-4140-0000-0000-000000000103', '10000000-4140-0000-0000-000000000001', '31000000-4140-0000-0000-000000000003', 'active'),
  ('aaaaaaaa-4140-0000-0000-000000000104', '10000000-4140-0000-0000-000000000001', '32000000-4140-0000-0000-000000000001', 'active');
insert into public.conversations values
  ('61000000-4140-0000-0000-000000000001', '10000000-4140-0000-0000-000000000001', '31000000-4140-0000-0000-000000000001', null);
insert into public.sales_orders values
  ('71000000-4140-0000-0000-000000000001', '10000000-4140-0000-0000-000000000001', null);
insert into public.invoices values
  ('81000000-4140-0000-0000-000000000001', '10000000-4140-0000-0000-000000000001', 'FA-1', 'DUP', 100, 20, 'USD', 1, 'emitida', current_date, now(), '71000000-4140-0000-0000-000000000001', null),
  ('81000000-4140-0000-0000-000000000002', '10000000-4140-0000-0000-000000000001', 'FA-2', 'OTHER', 50, 0, 'USD', 1, 'emitida', current_date, now(), null, null),
  ('81000000-4140-0000-0000-000000000003', '10000000-4140-0000-0000-000000000001', 'FA-3', 'DUP', 40, 0, 'USD', 1, 'borrador', current_date, now(), '71000000-4140-0000-0000-000000000001', null),
  ('81000000-4140-0000-0000-000000000004', '10000000-4140-0000-0000-000000000001', 'FA-4', 'DUP', 30, 0, 'USD', 1, 'anulada', current_date, now(), null, null),
  ('81000000-4140-0000-0000-000000000005', '10000000-4140-0000-0000-000000000001', 'FA-5', 'DUP', 60, 0, 'USD', 1, 'emitida', current_date, now(), null, now()),
  ('81000000-4140-0000-0000-000000000006', '10000000-4140-0000-0000-000000000001', 'FA-6', 'DEAD', 80, 0, 'USD', 1, 'emitida', current_date, now(), null, null),
  ('82000000-4140-0000-0000-000000000001', '20000000-4140-0000-0000-000000000002', 'FB-1', 'DUP', 777, 0, 'USD', 1, 'emitida', current_date, now(), null, null);

-- Prueba que el fixture reproduce la falla previa: código repetido cruza tenant.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4140-0000-0000-000000000101';
do $regression_reproduced$
begin
  if (select count(*) from public.invoices where invoice_code = 'FB-1') <> 1 then
    raise exception 'TEST 0414: el fixture no reproduce la lectura cruzada histórica';
  end if;
end;
$regression_reproduced$;
reset role;
-- Importación L07: 0407 ya fijó los topes en esta transacción; se anulan para
-- que la comprobación posterior demuestre que 0414 los fija por sí misma.
set local lock_timeout = 0;
set local statement_timeout = 0;
\ir ../migrations/0414_invoices_read_rbac.sql

-- 0414 toma ACCESS EXCLUSIVE sobre invoices: lock_timeout y statement_timeout
-- van antes de su primer lock o DDL (lectura estática, sin comentarios) y
-- quedan vigentes en la transacción de aplicación.
do $lock_timeout_0414_static$
declare
  v_code text := pg_catalog.regexp_replace(
    pg_catalog.pg_read_file('/sb/migrations/0414_invoices_read_rbac.sql'),
    '--[^\n]*', '', 'g'
  );
  v_lock integer := pg_catalog.strpos(v_code, 'set local lock_timeout = ''5s'';');
  v_statement integer := pg_catalog.strpos(v_code, 'set local statement_timeout = ''60s'';');
  v_first integer := pg_catalog.regexp_instr(
    v_code,
    '^[[:space:]]*(do|create|alter|drop|grant|revoke|comment|lock|select|insert|update|delete|truncate)\M',
    1, 1, 0, 'in', 1
  );
begin
  if v_lock = 0 or v_statement = 0 or v_first = 0
     or v_lock > v_first or v_statement > v_first then
    raise exception 'TEST 0414: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=%, statement_timeout=%, primera sentencia=%)',
      v_lock, v_statement, v_first;
  end if;
  if (select setting from pg_catalog.pg_settings where name = 'lock_timeout') <> '5000'
     or (select setting from pg_catalog.pg_settings where name = 'statement_timeout') <> '60000' then
    raise exception 'TEST 0414: la transacción de aplicación no quedó con lock_timeout 5s y statement_timeout 60s';
  end if;
end;
$lock_timeout_0414_static$;

set local role authenticated;
do $nonfinancial_roles$
declare v_user uuid;
begin
  foreach v_user in array array[
    'aaaaaaaa-4140-0000-0000-000000000003'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000004'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000005'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000006'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000007'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000008'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000099'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if exists (select 1 from public.invoices) then
      raise exception 'TEST 0414: identidad interna no autorizada leyó facturas: %', v_user;
    end if;
  end loop;
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  if exists (select 1 from public.invoices) then raise exception 'TEST 0414: sin identidad hay lectura'; end if;
end;
$nonfinancial_roles$;

do $financial_roles$
declare v_user uuid; v_rows bigint;
begin
  foreach v_user in array array[
    'aaaaaaaa-4140-0000-0000-000000000001'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000002'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if (select count(*) from public.invoices) <> 6
       or exists (select 1 from public.invoices where invoice_code = 'FB-1') then
      raise exception 'TEST 0414: financiero perdió históricos o cruzó tenant';
    end if;
    update public.invoices set total_amount = total_amount
      where id = '81000000-4140-0000-0000-000000000001';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'TEST 0414: se perdió UPDATE legítimo'; end if;
  end loop;
end;
$financial_roles$;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4140-0000-0000-000000000002';
do $tenant_b$
begin
  if (select count(*) from public.invoices) <> 1
     or not exists (select 1 from public.invoices where invoice_code = 'FB-1') then
    raise exception 'TEST 0414: financiero B cruzó tenant o perdió su factura';
  end if;
end;
$tenant_b$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4140-0000-0000-000000000101';
do $portal_a$
declare v_rows bigint;
begin
  if (select count(*) from public.invoices) <> 2
     or exists (select 1 from public.invoices where invoice_code not in ('FA-1', 'FA-4')) then
    raise exception 'TEST 0414: Portal A ve ajenas/borradores/retiradas o perdió anuladas históricas';
  end if;
  update public.invoices set total_amount = 999 where invoice_code = 'FA-1';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0414: Portal pudo actualizar'; end if;
end;
$portal_a$;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4140-0000-0000-000000000101';
do $portal_b$
begin
  if (select count(*) from public.invoices) <> 1
     or not exists (select 1 from public.invoices where invoice_code = 'FB-1') then
    raise exception 'TEST 0414: Portal B no quedó aislado con Shipping Mark repetido';
  end if;
end;
$portal_b$;
do $invalid_portal$
declare v_user uuid;
begin
  foreach v_user in array array[
    'aaaaaaaa-4140-0000-0000-000000000102'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000103'::uuid,
    'aaaaaaaa-4140-0000-0000-000000000104'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if exists (select 1 from public.invoices) then
      raise exception 'TEST 0414: Portal revocado/retirado/incoherente leyó facturas';
    end if;
  end loop;
end;
$invalid_portal$;

-- Las migraciones reales, no stubs de RPC, preservan los tres caminos mínimos.
set local "request.jwt.claim.sub" = 'aaaaaaaa-4140-0000-0000-000000000003';
do $facades_after_rls$
begin
  if exists (select 1 from public.invoices) then raise exception 'TEST 0414: comercial aún lee crudo'; end if;
  if not exists (select 1 from public.studio_client_annual_billing(current_date)
                 where client_markbox = 'DUP' and billed_usd = 100) then
    raise exception 'TEST 0414: agregado anual roto después de cerrar RLS';
  end if;
  if not exists (select 1 from public.conversation_client_outstanding('61000000-4140-0000-0000-000000000001')
                 where balance = 80 and currency = 'USD') then
    raise exception 'TEST 0414: contexto de conversación roto después de cerrar RLS';
  end if;
  if (select count(*) from public.sales_order_invoice_refs(array['71000000-4140-0000-0000-000000000001'::uuid])) <> 2 then
    raise exception 'TEST 0414: referencias de órdenes rotas después de cerrar RLS';
  end if;
end;
$facades_after_rls$;
reset role;

-- Una identidad dual no hereda todo el tenant: conserva sólo su derecho Portal.
insert into public.client_users values
  ('aaaaaaaa-4140-0000-0000-000000000003', '10000000-4140-0000-0000-000000000001', '31000000-4140-0000-0000-000000000001', 'active');
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4140-0000-0000-000000000003';
do $dual_principal$
begin
  if (select count(*) from public.invoices) <> 2 then
    raise exception 'TEST 0414: la identidad dual perdió Portal o recibió acceso interno amplio';
  end if;
end;
$dual_principal$;
reset role;
set local role service_role;
do $service_access$
begin
  if (select count(*) from public.invoices) <> 7 then
    raise exception 'TEST 0414: service_role perdió el camino controlado';
  end if;
end;
$service_access$;
reset role;
rollback;
select pg_catalog.to_regclass('public.invoices') is null as invoices_read_0414_fixture_rolled_back;
