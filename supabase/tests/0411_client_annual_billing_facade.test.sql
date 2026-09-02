\set ON_ERROR_STOP on

-- Contrato desechable de 0411. Identidades e importes ficticios; rollback total.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
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
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null,
  client_markbox text not null,
  currency text not null,
  fx_rate numeric,
  total_amount numeric not null,
  status text not null,
  issued_at date,
  created_at timestamptz not null,
  deleted_at timestamptz
);
alter table public.invoices enable row level security;
grant select on public.invoices to authenticated;
create policy invoices_team_select on public.invoices for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-4100-0000-0000-000000000001', '10000000-4100-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-4100-0000-0000-000000000002', '10000000-4100-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-4100-0000-0000-000000000003', '10000000-4100-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-4100-0000-0000-000000000004', '10000000-4100-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-4100-0000-0000-000000000005', '10000000-4100-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-4100-0000-0000-000000000006', '10000000-4100-0000-0000-000000000001', 'commercial', now()),
  ('bbbbbbbb-4100-0000-0000-000000000001', '20000000-4100-0000-0000-000000000002', 'commercial', null);

insert into public.invoices
  (id, tenant_id, client_markbox, currency, fx_rate, total_amount, status, issued_at, created_at, deleted_at)
values
  ('51000000-4100-0000-0000-000000000001', '10000000-4100-0000-0000-000000000001', 'DTD-0001', 'USD', null, 1000, 'emitida', current_date - 30, now(), null),
  ('51000000-4100-0000-0000-000000000002', '10000000-4100-0000-0000-000000000001', 'DTD-0001', 'USDT', null, 500, 'pagada', current_date - 20, now(), null),
  ('51000000-4100-0000-0000-000000000003', '10000000-4100-0000-0000-000000000001', 'DTD-0001', 'USD', null, 9999, 'borrador', current_date - 10, now(), null),
  ('51000000-4100-0000-0000-000000000004', '10000000-4100-0000-0000-000000000001', 'DTD-0002', 'VES', 36.5, 36500, 'vencida', current_date - 40, now(), null),
  ('51000000-4100-0000-0000-000000000005', '10000000-4100-0000-0000-000000000001', 'DTD-0002', 'VES', null, 1000, 'emitida', current_date - 40, now(), null),
  ('51000000-4100-0000-0000-000000000006', '10000000-4100-0000-0000-000000000001', 'DTD-0002', 'CNY', null, 7000, 'emitida', current_date - 40, now(), null),
  ('51000000-4100-0000-0000-000000000007', '10000000-4100-0000-0000-000000000001', 'DTD-0003', 'USD', null, 4000, 'emitida', current_date - 730, now(), null),
  ('51000000-4100-0000-0000-000000000008', '10000000-4100-0000-0000-000000000001', 'DTD-0004', 'USD', null, 200, 'parcial', null, now() - interval '15 days', null),
  ('51000000-4100-0000-0000-000000000009', '10000000-4100-0000-0000-000000000001', 'DTD-0005', 'USD', null, 800, 'emitida', current_date - 5, now(), now()),
  ('52000000-4100-0000-0000-000000000001', '20000000-4100-0000-0000-000000000002', 'DTD-9001', 'USD', null, 777, 'emitida', current_date - 5, now(), null);

\ir ../migrations/0411_client_annual_billing_facade.sql

do $catalog_contract$
declare v_result text;
begin
  v_result := pg_catalog.pg_get_function_result(
    pg_catalog.to_regprocedure('public.studio_client_annual_billing(date)')
  );
  if v_result <> 'TABLE(client_markbox text, billed_usd numeric)' then
    raise exception 'TEST 0411: shape pública inesperada: %', v_result;
  end if;
end;
$catalog_contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4100-0000-0000-000000000005';
do $operations_blocked$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.studio_client_annual_billing(current_date);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0411: operations ejecutó el agregado financiero';
  end if;
end;
$operations_blocked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4100-0000-0000-000000000006';
do $disabled_blocked$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.studio_client_annual_billing(current_date);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0411: membresía desactivada ejecutó la RPC';
  end if;
end;
$disabled_blocked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4100-0000-0000-000000000002';
do $commercial_aggregate$
declare v_blocked boolean := false;
begin
  if (select count(*) from public.studio_client_annual_billing(current_date)) <> 3 then
    raise exception 'TEST 0411: cantidad de agregados de tenant A incorrecta';
  end if;
  if not exists (
    select 1 from public.studio_client_annual_billing(current_date)
    where client_markbox = 'DTD-0001' and billed_usd = 1500
  ) or not exists (
    select 1 from public.studio_client_annual_billing(current_date)
    where client_markbox = 'DTD-0002' and billed_usd = 1000
  ) or not exists (
    select 1 from public.studio_client_annual_billing(current_date)
    where client_markbox = 'DTD-0004' and billed_usd = 200
  ) then
    raise exception 'TEST 0411: normalización o ventana trailing-12m incorrecta';
  end if;

  begin
    perform * from public.studio_client_annual_billing(current_date - 30);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0411: se aceptó una ventana histórica arbitraria';
  end if;
end;
$commercial_aggregate$;

set local "request.jwt.claim.sub" = 'bbbbbbbb-4100-0000-0000-000000000001';
do $tenant_isolation$
begin
  if (select count(*) from public.studio_client_annual_billing(current_date)) <> 1
     or not exists (
       select 1 from public.studio_client_annual_billing(current_date)
       where client_markbox = 'DTD-9001' and billed_usd = 777
     ) then
    raise exception 'TEST 0411: aislamiento por tenant incorrecto';
  end if;
end;
$tenant_isolation$;

do $allowed_roles$
declare v_user uuid;
begin
  foreach v_user in array array[
    'aaaaaaaa-4100-0000-0000-000000000001'::uuid,
    'aaaaaaaa-4100-0000-0000-000000000003'::uuid,
    'aaaaaaaa-4100-0000-0000-000000000004'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if (select count(*) from public.studio_client_annual_billing(current_date)) <> 3 then
      raise exception 'TEST 0411: rol permitido % no recibió su agregado', v_user;
    end if;
  end loop;
end;
$allowed_roles$;

reset role;

rollback;

select pg_catalog.to_regclass('public.invoices') is null
  as client_annual_billing_0411_fixture_rolled_back;
