\set ON_ERROR_STOP on

-- Contrato desechable de 0408. Identidades ficticias; rollback total.
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

-- Las seis tablas comparten una forma mínima para probar la matriz RLS. La
-- migración sólo depende de id/tenant_id para sus policies.
create table public.mail_templates (id uuid primary key, tenant_id uuid not null, payload text);
create table public.mail_signatures (id uuid primary key, tenant_id uuid not null, payload text);
create table public.mail_rules (id uuid primary key, tenant_id uuid not null, payload text);
create table public.mail_config (id uuid primary key, tenant_id uuid not null, payload text);
create table public.mail_blacklist (id uuid primary key, tenant_id uuid not null, payload text);
create table public.mail_scheduled (id uuid primary key, tenant_id uuid not null, payload text);

grant select, insert, update, delete on public.mail_templates to authenticated;
grant select, insert, update, delete on public.mail_signatures to authenticated;
grant select, insert, update, delete on public.mail_rules to authenticated;
grant select, update on public.mail_config to authenticated;
grant select, insert, delete on public.mail_blacklist to authenticated;
grant select, insert, update, delete on public.mail_scheduled to authenticated;
grant all on public.mail_templates, public.mail_signatures, public.mail_rules,
  public.mail_config, public.mail_blacklist, public.mail_scheduled to service_role;

alter table public.mail_templates enable row level security;
alter table public.mail_signatures enable row level security;
alter table public.mail_rules enable row level security;
alter table public.mail_config enable row level security;
alter table public.mail_blacklist enable row level security;
alter table public.mail_scheduled enable row level security;

create policy "mail_templates_by_tenant" on public.mail_templates for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "mail_rules_by_tenant" on public.mail_rules for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "mail_config_by_tenant_select" on public.mail_config for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "mail_config_by_tenant_update" on public.mail_config for update to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "mail_blacklist_by_tenant" on public.mail_blacklist for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "mail_scheduled_by_tenant" on public.mail_scheduled for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());

create policy "mail_signatures_owner_select" on public.mail_signatures for select to authenticated using (true);
create policy "mail_signatures_owner_insert" on public.mail_signatures for insert to authenticated with check (true);
create policy "mail_signatures_owner_update" on public.mail_signatures for update to authenticated using (true) with check (true);
create policy "mail_signatures_owner_delete" on public.mail_signatures for delete to authenticated using (true);
create policy "mail_signatures_tenant_select" on public.mail_signatures for select to authenticated using (true);
create policy "mail_signatures_tenant_insert" on public.mail_signatures for insert to authenticated with check (true);
create policy "mail_signatures_tenant_update" on public.mail_signatures for update to authenticated using (true) with check (true);
create policy "mail_signatures_tenant_delete" on public.mail_signatures for delete to authenticated using (true);

create function public.mail_increment_template_metrics(uuid, text, integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  return;
end;
$$;
create function public.mail_check_blacklist(uuid, text) returns boolean
language sql stable security definer set search_path = '' as $$ select false $$;
grant execute on function public.mail_increment_template_metrics(uuid, text, integer) to authenticated, service_role;
grant execute on function public.mail_check_blacklist(uuid, text) to authenticated, service_role;

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-1000-0000-0000-000000000001', '10000000-1000-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-1000-0000-0000-000000000002', '10000000-1000-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-1000-0000-0000-000000000003', '10000000-1000-0000-0000-000000000001', 'admin', now()),
  ('bbbbbbbb-1000-0000-0000-000000000001', '20000000-1000-0000-0000-000000000002', 'admin', null);

do $fixtures$
declare v_table text; v_index integer := 0;
begin
  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules',
    'mail_config', 'mail_blacklist', 'mail_scheduled'
  ] loop
    v_index := v_index + 1;
    execute pg_catalog.format(
      'insert into public.%I (id, tenant_id, payload) values ($1, $2, $3), ($4, $5, $6)',
      v_table
    ) using
      ('31000000-1000-0000-0000-' || pg_catalog.lpad(v_index::text, 12, '0'))::uuid,
      '10000000-1000-0000-0000-000000000001'::uuid,
      'tenant-a',
      ('32000000-1000-0000-0000-' || pg_catalog.lpad(v_index::text, 12, '0'))::uuid,
      '20000000-1000-0000-0000-000000000002'::uuid,
      'tenant-b';
  end loop;
end;
$fixtures$;

\ir ../migrations/0408_mailing_admin_rbac.sql

do $catalog_contract$
declare
  v_old text[] := array[
    'mail_templates_by_tenant', 'mail_rules_by_tenant',
    'mail_config_by_tenant_select', 'mail_config_by_tenant_update',
    'mail_blacklist_by_tenant', 'mail_scheduled_by_tenant',
    'mail_signatures_owner_select', 'mail_signatures_owner_insert',
    'mail_signatures_owner_update', 'mail_signatures_owner_delete',
    'mail_signatures_tenant_select', 'mail_signatures_tenant_insert',
    'mail_signatures_tenant_update', 'mail_signatures_tenant_delete'
  ];
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and policyname = any(v_old)
  ) then
    raise exception 'TEST 0408: sobrevivió una policy tenant/owner permisiva';
  end if;
  if has_function_privilege('authenticated', 'public.mail_increment_template_metrics(uuid,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.mail_check_blacklist(uuid,text)', 'EXECUTE') then
    raise exception 'TEST 0408: authenticated conserva una RPC interna';
  end if;
  if has_table_privilege('authenticated', 'public.mail_templates', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.mail_scheduled', 'TRUNCATE') then
    raise exception 'TEST 0408: authenticated conserva TRUNCATE';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-1000-0000-0000-000000000002';

-- Un miembro no-admin del tenant no ve ni muta el dominio administrativo.
do $commercial_blocked$
declare
  v_table text;
  v_count bigint;
  v_rows bigint;
  v_blocked boolean;
  v_new_id uuid;
begin
  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules',
    'mail_config', 'mail_blacklist', 'mail_scheduled'
  ] loop
    execute pg_catalog.format('select count(*) from public.%I', v_table) into v_count;
    if v_count <> 0 then
      raise exception 'TEST 0408: commercial leyó %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules', 'mail_config', 'mail_scheduled'
  ] loop
    execute pg_catalog.format('update public.%I set payload = $1', v_table) using 'blocked';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'TEST 0408: commercial actualizó %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules', 'mail_blacklist', 'mail_scheduled'
  ] loop
    v_new_id := pg_catalog.gen_random_uuid();
    v_blocked := false;
    begin
      execute pg_catalog.format(
        'insert into public.%I (id, tenant_id, payload) values ($1, $2, $3)',
        v_table
      ) using v_new_id, '10000000-1000-0000-0000-000000000001'::uuid, 'blocked';
    exception when insufficient_privilege then
      v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'TEST 0408: commercial insertó %', v_table;
    end if;

    execute pg_catalog.format('delete from public.%I', v_table);
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'TEST 0408: commercial borró %', v_table;
    end if;
  end loop;
end;
$commercial_blocked$;

do $rpc_blocked$
declare v_blocked boolean;
begin
  v_blocked := false;
  begin
    perform public.mail_check_blacklist(
      '10000000-1000-0000-0000-000000000001'::uuid,
      'persona@example.test'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0408: authenticated ejecutó mail_check_blacklist';
  end if;

  v_blocked := false;
  begin
    perform public.mail_increment_template_metrics(
      '31000000-1000-0000-0000-000000000001'::uuid,
      'sent',
      1
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0408: authenticated ejecutó mail_increment_template_metrics';
  end if;
end;
$rpc_blocked$;

-- Una membresía admin desactivada tampoco ve ni escribe.
set local "request.jwt.claim.sub" = 'aaaaaaaa-1000-0000-0000-000000000003';
do $disabled_admin$
declare v_count bigint; v_rows bigint;
begin
  select count(*) into v_count from public.mail_templates;
  if v_count <> 0 then
    raise exception 'TEST 0408: admin desactivado leyó plantillas';
  end if;
  update public.mail_templates set payload = 'blocked';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0408: admin desactivado actualizó plantillas';
  end if;
end;
$disabled_admin$;

-- Admin de otro tenant ve sólo su fila y no toca tenant A.
set local "request.jwt.claim.sub" = 'bbbbbbbb-1000-0000-0000-000000000001';
do $other_tenant$
declare v_count bigint; v_rows bigint;
begin
  select count(*) into v_count from public.mail_templates;
  if v_count <> 1 then
    raise exception 'TEST 0408: admin de tenant B no quedó acotado a su tenant';
  end if;
  update public.mail_templates set payload = 'crossed'
  where tenant_id = '10000000-1000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0408: admin de tenant B escribió tenant A';
  end if;
end;
$other_tenant$;

-- Admin activo conserva las operaciones que la UI usa.
set local "request.jwt.claim.sub" = 'aaaaaaaa-1000-0000-0000-000000000001';
do $admin_allowed$
declare
  v_table text;
  v_count bigint;
  v_rows bigint;
  v_new_id uuid;
begin
  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules',
    'mail_config', 'mail_blacklist', 'mail_scheduled'
  ] loop
    execute pg_catalog.format('select count(*) from public.%I', v_table) into v_count;
    if v_count <> 1 then
      raise exception 'TEST 0408: admin no leyó una fila de %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules', 'mail_config', 'mail_scheduled'
  ] loop
    execute pg_catalog.format(
      'update public.%I set payload = $1 where tenant_id = $2', v_table
    ) using 'admin-updated', '10000000-1000-0000-0000-000000000001'::uuid;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'TEST 0408: admin no actualizó %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'mail_templates', 'mail_signatures', 'mail_rules', 'mail_blacklist', 'mail_scheduled'
  ] loop
    v_new_id := pg_catalog.gen_random_uuid();
    execute pg_catalog.format(
      'insert into public.%I (id, tenant_id, payload) values ($1, $2, $3)',
      v_table
    ) using v_new_id, '10000000-1000-0000-0000-000000000001'::uuid, 'admin-inserted';
    execute pg_catalog.format('delete from public.%I where id = $1', v_table) using v_new_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'TEST 0408: admin no borró la fila nueva de %', v_table;
    end if;
  end loop;
end;
$admin_allowed$;

reset role;

set local role service_role;
select public.mail_check_blacklist(
  '10000000-1000-0000-0000-000000000001'::uuid,
  'persona@example.test'
);
select public.mail_increment_template_metrics(
  '31000000-1000-0000-0000-000000000001'::uuid,
  'sent',
  1
);
reset role;

rollback;

select pg_catalog.to_regclass('public.mail_templates') is null
  as mailing_admin_rbac_0408_fixture_rolled_back;
