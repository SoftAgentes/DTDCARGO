\set ON_ERROR_STOP on

-- Contrato desechable de 0407. Usa identidades ficticias y termina en rollback.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;

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
  select ut.tenant_id
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  limit 1
$$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  limit 1
$$;

create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null,
  total_amount numeric(14,2) not null,
  status text not null default 'borrador',
  deleted_at timestamptz
);

grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;

create policy "invoices by tenant"
  on public.invoices for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- Policy aditiva del Portal: 0407 debe conservarla intacta.
create policy "invoices portal self read"
  on public.invoices for select to authenticated
  using (false);

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'warehouse', null),
  ('aaaaaaaa-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'marketing', null),
  ('aaaaaaaa-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'accounting', now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'accounting', null);

insert into public.invoices (id, tenant_id, total_amount, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 100, 'emitida'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 200, 'emitida');

\ir ../migrations/0407_invoices_write_rbac.sql

do $catalog_contract$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices by tenant'
  ) then
    raise exception 'TEST 0407: sobrevivió la policy FOR ALL';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices portal self read' and cmd = 'SELECT'
  ) then
    raise exception 'TEST 0407: se perdió la policy del Portal';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices_accounting_insert' and cmd = 'INSERT'
      and with_check like '%current_studio_role%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices_accounting_update' and cmd = 'UPDATE'
      and qual like '%current_studio_role%'
      and with_check like '%current_studio_role%'
  ) then
    raise exception 'TEST 0407: las escrituras no quedaron ligadas al rol';
  end if;
  if has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'TEST 0407: authenticated conserva DELETE físico';
  end if;
end;
$catalog_contract$;

set local role authenticated;

-- Compatibilidad deliberada de este slice: no modifica el SELECT tenant-wide.
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000003';
do $read_compatibility$
begin
  if (select count(*) from public.invoices) <> 1 then
    raise exception 'TEST 0407: cambió la lectura tenant-wide o fugó otro tenant';
  end if;
end;
$read_compatibility$;

-- Ningún rol no financiero puede insertar o actualizar.
do $unauthorized_writes$
declare
  v_uid uuid;
  v_rows bigint;
  v_blocked boolean;
begin
  foreach v_uid in array array[
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000007'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_uid::text, true);

    update public.invoices set total_amount = 999
    where id = '30000000-0000-0000-0000-000000000001';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'TEST 0407: usuario no financiero % actualizó una factura', v_uid;
    end if;

    v_blocked := false;
    begin
      insert into public.invoices (id, tenant_id, total_amount)
      values (pg_catalog.gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 50);
    exception when insufficient_privilege then
      v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'TEST 0407: usuario no financiero % insertó una factura', v_uid;
    end if;
  end loop;
end;
$unauthorized_writes$;

-- Un accounting desactivado no conserva ni tenant ni rol efectivo.
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000008';
do $disabled$
declare v_rows bigint;
begin
  update public.invoices set total_amount = 888
  where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0407: accounting desactivado actualizó una factura';
  end if;
end;
$disabled$;

-- Accounting de otro tenant no cruza la frontera.
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000001';
do $other_tenant$
declare v_rows bigint;
begin
  update public.invoices set total_amount = 777
  where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0407: accounting de otro tenant actualizó la factura';
  end if;
end;
$other_tenant$;

-- Accounting y admin sí conservan la escritura legítima.
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000002';
do $accounting$
declare v_rows bigint;
begin
  update public.invoices set total_amount = 110
  where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 0407: accounting no pudo actualizar';
  end if;
  insert into public.invoices (id, tenant_id, total_amount)
  values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 300);
end;
$accounting$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';
do $admin_and_delete$
declare v_rows bigint; v_blocked boolean := false;
begin
  update public.invoices set total_amount = 310
  where id = '30000000-0000-0000-0000-000000000003';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 0407: admin no pudo actualizar';
  end if;
  begin
    delete from public.invoices
    where id = '30000000-0000-0000-0000-000000000003';
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0407: admin authenticated hizo DELETE físico';
  end if;
end;
$admin_and_delete$;

reset role;

-- service_role conserva el camino privilegiado explícito para jobs/RPCs.
set local role service_role;
delete from public.invoices
where id = '30000000-0000-0000-0000-000000000003';
reset role;

rollback;

select pg_catalog.to_regclass('public.invoices') is null
  as invoices_write_rbac_0407_fixture_rolled_back;
