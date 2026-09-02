\set ON_ERROR_STOP on

-- Contrato desechable de 0409. Identidades ficticias; rollback total.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

grant usage on schema public to authenticated, service_role;
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

create table public.bank_statements (
  id uuid primary key,
  tenant_id uuid not null,
  payload text
);
create table public.bank_statement_lines (
  id uuid primary key,
  tenant_id uuid not null,
  payload text
);

grant select, insert, update, delete on public.bank_statements to authenticated;
grant select, insert, update, delete on public.bank_statement_lines to authenticated;
grant all on public.bank_statements, public.bank_statement_lines to service_role;
alter table public.bank_statements enable row level security;
alter table public.bank_statement_lines enable row level security;

create policy "bank_statements by tenant"
  on public.bank_statements for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "bank_statement_lines by tenant"
  on public.bank_statement_lines for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "service_role_all_bank_statements"
  on public.bank_statements for all to service_role using (true) with check (true);
create policy "service_role_all_bank_statement_lines"
  on public.bank_statement_lines for all to service_role using (true) with check (true);

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-2000-0000-0000-000000000001', '10000000-2000-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-2000-0000-0000-000000000002', '10000000-2000-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-2000-0000-0000-000000000003', '10000000-2000-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-2000-0000-0000-000000000004', '10000000-2000-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-2000-0000-0000-000000000005', '10000000-2000-0000-0000-000000000001', 'warehouse', null),
  ('aaaaaaaa-2000-0000-0000-000000000006', '10000000-2000-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-2000-0000-0000-000000000007', '10000000-2000-0000-0000-000000000001', 'marketing', null),
  ('aaaaaaaa-2000-0000-0000-000000000008', '10000000-2000-0000-0000-000000000001', 'accounting', now()),
  ('bbbbbbbb-2000-0000-0000-000000000001', '20000000-2000-0000-0000-000000000002', 'accounting', null);

insert into public.bank_statements (id, tenant_id, payload) values
  ('41000000-2000-0000-0000-000000000001', '10000000-2000-0000-0000-000000000001', 'tenant-a'),
  ('42000000-2000-0000-0000-000000000001', '20000000-2000-0000-0000-000000000002', 'tenant-b');
insert into public.bank_statement_lines (id, tenant_id, payload) values
  ('41000000-2000-0000-0000-000000000002', '10000000-2000-0000-0000-000000000001', 'tenant-a'),
  ('42000000-2000-0000-0000-000000000002', '20000000-2000-0000-0000-000000000002', 'tenant-b');

\ir ../migrations/0409_bank_reconciliation_rbac.sql

do $catalog_contract$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in ('bank_statements by tenant', 'bank_statement_lines by tenant')
  ) then
    raise exception 'TEST 0409: sobrevivió una policy FOR ALL';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bank_statements'
      and policyname = 'bank_statements_accounting_update'
      and qual like '%current_studio_role%'
      and with_check like '%current_studio_role%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bank_statement_lines'
      and policyname = 'bank_statement_lines_accounting_update'
      and qual like '%current_studio_role%'
      and with_check like '%current_studio_role%'
  ) then
    raise exception 'TEST 0409: UPDATE no quedó ligado al rol';
  end if;
  if has_table_privilege('authenticated', 'public.bank_statements', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.bank_statement_lines', 'TRUNCATE') then
    raise exception 'TEST 0409: authenticated conserva TRUNCATE';
  end if;
end;
$catalog_contract$;

set local role authenticated;

-- Ningún rol no financiero puede leer o mutar conciliación.
do $non_financial_blocked$
declare
  v_uid uuid;
  v_table text;
  v_count bigint;
  v_rows bigint;
  v_blocked boolean;
  v_new_id uuid;
begin
  foreach v_uid in array array[
    'aaaaaaaa-2000-0000-0000-000000000003'::uuid,
    'aaaaaaaa-2000-0000-0000-000000000004'::uuid,
    'aaaaaaaa-2000-0000-0000-000000000005'::uuid,
    'aaaaaaaa-2000-0000-0000-000000000006'::uuid,
    'aaaaaaaa-2000-0000-0000-000000000007'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_uid::text, true);
    foreach v_table in array array['bank_statements', 'bank_statement_lines'] loop
      execute pg_catalog.format('select count(*) from public.%I', v_table) into v_count;
      if v_count <> 0 then
        raise exception 'TEST 0409: no-financiero % leyó %', v_uid, v_table;
      end if;

      execute pg_catalog.format('update public.%I set payload = $1', v_table) using 'blocked';
      get diagnostics v_rows = row_count;
      if v_rows <> 0 then
        raise exception 'TEST 0409: no-financiero % actualizó %', v_uid, v_table;
      end if;

      execute pg_catalog.format('delete from public.%I', v_table);
      get diagnostics v_rows = row_count;
      if v_rows <> 0 then
        raise exception 'TEST 0409: no-financiero % borró %', v_uid, v_table;
      end if;

      v_new_id := pg_catalog.gen_random_uuid();
      v_blocked := false;
      begin
        execute pg_catalog.format(
          'insert into public.%I (id, tenant_id, payload) values ($1, $2, $3)',
          v_table
        ) using v_new_id, '10000000-2000-0000-0000-000000000001'::uuid, 'blocked';
      exception when insufficient_privilege then
        v_blocked := true;
      end;
      if not v_blocked then
        raise exception 'TEST 0409: no-financiero % insertó %', v_uid, v_table;
      end if;
    end loop;
  end loop;
end;
$non_financial_blocked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-2000-0000-0000-000000000008';
do $disabled_accounting$
declare v_count bigint; v_rows bigint;
begin
  select count(*) into v_count from public.bank_statements;
  if v_count <> 0 then
    raise exception 'TEST 0409: accounting desactivado leyó extractos';
  end if;
  update public.bank_statements set payload = 'blocked';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0409: accounting desactivado actualizó extractos';
  end if;
end;
$disabled_accounting$;

set local "request.jwt.claim.sub" = 'bbbbbbbb-2000-0000-0000-000000000001';
do $other_tenant$
declare v_count bigint; v_rows bigint;
begin
  select count(*) into v_count from public.bank_statements;
  if v_count <> 1 then
    raise exception 'TEST 0409: accounting de tenant B no quedó acotado';
  end if;
  update public.bank_statement_lines set payload = 'crossed'
  where tenant_id = '10000000-2000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0409: accounting de tenant B escribió tenant A';
  end if;
end;
$other_tenant$;

-- Accounting y admin activos conservan el CRUD del flujo.
do $financial_allowed$
declare
  v_uid uuid;
  v_table text;
  v_count bigint;
  v_rows bigint;
  v_new_id uuid;
begin
  foreach v_uid in array array[
    'aaaaaaaa-2000-0000-0000-000000000002'::uuid,
    'aaaaaaaa-2000-0000-0000-000000000001'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_uid::text, true);
    foreach v_table in array array['bank_statements', 'bank_statement_lines'] loop
      execute pg_catalog.format('select count(*) from public.%I', v_table) into v_count;
      if v_count <> 1 then
        raise exception 'TEST 0409: financiero % no leyó %', v_uid, v_table;
      end if;

      execute pg_catalog.format(
        'update public.%I set payload = $1 where tenant_id = $2', v_table
      ) using 'financial-updated', '10000000-2000-0000-0000-000000000001'::uuid;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'TEST 0409: financiero % no actualizó %', v_uid, v_table;
      end if;

      v_new_id := pg_catalog.gen_random_uuid();
      execute pg_catalog.format(
        'insert into public.%I (id, tenant_id, payload) values ($1, $2, $3)',
        v_table
      ) using v_new_id, '10000000-2000-0000-0000-000000000001'::uuid, 'financial-inserted';
      execute pg_catalog.format('delete from public.%I where id = $1', v_table) using v_new_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'TEST 0409: financiero % no borró fila nueva de %', v_uid, v_table;
      end if;
    end loop;
  end loop;
end;
$financial_allowed$;

reset role;

set local role service_role;
do $service_role_kept$
begin
  if (select count(*) from public.bank_statements) <> 2
     or (select count(*) from public.bank_statement_lines) <> 2 then
    raise exception 'TEST 0409: service_role perdió acceso';
  end if;
end;
$service_role_kept$;
reset role;

rollback;

select pg_catalog.to_regclass('public.bank_statements') is null
  as bank_reconciliation_rbac_0409_fixture_rolled_back;
