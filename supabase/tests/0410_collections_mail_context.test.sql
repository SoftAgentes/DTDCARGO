\set ON_ERROR_STOP on

-- Contrato desechable de 0410. Identidades y emails ficticios; rollback total.
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
  deleted_at timestamptz
);
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text not null,
  email text,
  deleted_at timestamptz
);
create table public.mail_logs (
  id uuid primary key,
  tenant_id uuid not null,
  to_email text,
  complained_at timestamptz,
  sent_at timestamptz,
  metadata jsonb
);

grant select on public.mail_logs to authenticated;
grant all on public.invoices, public.clients, public.mail_logs to service_role;
alter table public.mail_logs enable row level security;
create policy "mail_logs_tenant_select" on public.mail_logs for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "mail_logs_no_insert_authenticated" on public.mail_logs for insert to authenticated with check (false);
create policy "mail_logs_no_update_authenticated" on public.mail_logs for update to authenticated using (false);
create policy "mail_logs_no_delete" on public.mail_logs for delete using (false);
create policy "mail_logs_service_role" on public.mail_logs for all to service_role using (true) with check (true);

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-3000-0000-0000-000000000003', '10000000-3000-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-3000-0000-0000-000000000004', '10000000-3000-0000-0000-000000000001', 'accounting', now()),
  ('bbbbbbbb-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'accounting', null);

insert into public.clients (id, tenant_id, markbox, email) values
  ('51000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'DTD-0001', 'uno@example.test'),
  ('51000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'DTD-0002', null),
  ('52000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'DTD-9001', 'otro@example.test');
insert into public.invoices (id, tenant_id, client_markbox) values
  ('53000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'DTD-0001'),
  ('53000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'DTD-0002'),
  ('54000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'DTD-9001');
insert into public.mail_logs (id, tenant_id, to_email, complained_at, sent_at, metadata) values
  ('55000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'uno@example.test', now(), null, '{}'),
  ('55000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'uno@example.test', null, '2026-08-20T10:00:00Z', '{"event":"invoice_overdue","source_ref":{"id":"53000000-3000-0000-0000-000000000001"}}'),
  ('55000000-3000-0000-0000-000000000003', '10000000-3000-0000-0000-000000000001', 'uno@example.test', null, '2026-08-30T10:00:00Z', '{"event":"invoice_overdue","source_ref":{"id":"53000000-3000-0000-0000-000000000001"}}'),
  ('56000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'otro@example.test', null, null, '{}');

\ir ../migrations/0410_collections_mail_context.sql

-- El runner 0415 repite la misma matriz DESPUÉS de la restricción. Sin esa
-- variable se prueba que expansión y consumidor antiguo son compatibles.
\if :{?apply_mail_logs_close}
  \ir ../migrations/0415_mail_logs_read_rbac.sql
  select pg_catalog.set_config('test.mail_logs_closed', 'true', true);
\else
  select pg_catalog.set_config('test.mail_logs_closed', 'false', true);
\endif

do $catalog_contract$
begin
  if pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('public.collections_mail_context(uuid[])')
     ) like '%to_email%'
     or pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('public.collections_mail_context(uuid[])')
     ) like '%metadata%' then
    raise exception 'TEST 0410: la RPC expone email o metadata';
  end if;
  if (exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select'
  )) = pg_catalog.current_setting('test.mail_logs_closed')::boolean then
    raise exception 'TEST 0410/0415: policy incompatible con la fase del release';
  end if;
end;
$catalog_contract$;

set local role authenticated;

-- Un rol no financiero nunca ejecuta la RPC. Su lectura histórica sobre logs
-- sólo desaparece al aplicar 0415, no al crear el facade en 0410.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000003';
do $commercial_blocked$
declare v_blocked boolean := false; v_count bigint;
begin
  select count(*) into v_count from public.mail_logs;
  if v_count <> (case when pg_catalog.current_setting('test.mail_logs_closed')::boolean then 0 else 3 end) then
    raise exception 'TEST 0410/0415: lectura de commercial incompatible con la fase';
  end if;
  begin
    perform * from public.collections_mail_context(
      array['53000000-3000-0000-0000-000000000001'::uuid]
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0410: commercial ejecutó el contexto de Cobranzas';
  end if;
end;
$commercial_blocked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000004';
do $disabled_blocked$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.collections_mail_context(
      array['53000000-3000-0000-0000-000000000001'::uuid]
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0410: accounting desactivado ejecutó la RPC';
  end if;
end;
$disabled_blocked$;

-- Accounting recibe sólo sus facturas y las señales mínimas correctas.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000002';
do $accounting_context$
declare v_count bigint;
begin
  select count(*) into v_count from public.mail_logs;
  if v_count <> (case when pg_catalog.current_setting('test.mail_logs_closed')::boolean then 0 else 3 end) then
    raise exception 'TEST 0410/0415: lectura de accounting incompatible con la fase';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid,
        '53000000-3000-0000-0000-000000000002'::uuid,
        '54000000-3000-0000-0000-000000000001'::uuid
      ])) <> 2 then
    raise exception 'TEST 0410: la RPC no acotó facturas por tenant';
  end if;
  if not exists (
    select 1 from public.collections_mail_context(array[
      '53000000-3000-0000-0000-000000000001'::uuid
    ]) as context
    where context.client_markbox = 'DTD-0001'
      and context.has_email
      and context.complained
      and context.last_reminder_on = date '2026-08-30'
  ) then
    raise exception 'TEST 0410: señales de DTD-0001 incorrectas';
  end if;
  if not exists (
    select 1 from public.collections_mail_context(array[
      '53000000-3000-0000-0000-000000000002'::uuid
    ]) as context
    where not context.has_email
      and not context.complained
      and context.last_reminder_on is null
  ) then
    raise exception 'TEST 0410: señales de DTD-0002 incorrectas';
  end if;
end;
$accounting_context$;

-- Otro tenant no puede forzar ids de tenant A.
set local "request.jwt.claim.sub" = 'bbbbbbbb-3000-0000-0000-000000000001';
do $other_tenant$
begin
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid
      ])) <> 0 then
    raise exception 'TEST 0410: tenant B obtuvo señales de tenant A';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '54000000-3000-0000-0000-000000000001'::uuid
      ])) <> 1 then
    raise exception 'TEST 0410: tenant B perdió su propia factura';
  end if;
end;
$other_tenant$;

-- Admin conserva la consola completa del tenant.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000001';
do $admin_allowed$
begin
  if (select count(*) from public.mail_logs) <> 3 then
    raise exception 'TEST 0410: admin no ve los logs de su tenant';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid
      ])) <> 1 then
    raise exception 'TEST 0410: admin no ejecuta el facade';
  end if;
end;
$admin_allowed$;

reset role;

set local role service_role;
do $service_role_kept$
begin
  if (select count(*) from public.mail_logs) <> 4 then
    raise exception 'TEST 0410: service_role perdió mail_logs';
  end if;
end;
$service_role_kept$;
reset role;

rollback;

select pg_catalog.to_regclass('public.mail_logs') is null
  as collections_mail_context_0410_fixture_rolled_back;
