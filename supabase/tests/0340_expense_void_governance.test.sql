\set ON_ERROR_STOP on

-- Contrato desechable SDD-0243. Usa únicamente fixtures ficticios y rollback.
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
    create role service_role nologin;
  end if;
end;
$roles$;

create schema auth;
create function auth.uid()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz
);
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null,
  domain_code text not null,
  contract_version integer not null,
  introduced_by_ref text not null
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  source text not null,
  result text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}',
  correlation_id text,
  schema_version integer not null,
  sensitivity text not null
);
create table public.expenses (
  id uuid primary key,
  tenant_id uuid not null,
  user_id uuid not null,
  expense_code text not null,
  occurred_at timestamptz not null,
  receipt_path text,
  receipt_document_id uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.journal_entries (
  id uuid primary key,
  tenant_id uuid not null,
  expense_id uuid,
  entry_code text not null,
  entry_date date not null,
  source text not null,
  status text not null,
  deleted_at timestamptz
);
create table public.accounting_settings (
  tenant_id uuid primary key,
  closing_date date
);

insert into public.audit_entity_types values
  ('journal_entry', 'active', 'finance', 1, 'fixture');

create function public.get_accounting_closing_date(p_tenant_id uuid)
returns date language sql stable security definer set search_path = ''
as $$
  select closing_date from public.accounting_settings where tenant_id = p_tenant_id
$$;

create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.entity_audit_log (
    tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
    source, result, reason, before_data, after_data, payload, correlation_id,
    schema_version, sensitivity
  ) values (
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result,
    coalesce(nullif(current_setting('dtd.audit_reason', true), ''), p_reason),
    p_before_data, p_after_data, p_payload, p_correlation_id,
    p_schema_version, p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

create function public.audit_d2_financial_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'anulado' then
    perform public.append_audit_event(
      new.tenant_id,
      'journal_entry',
      new.id,
      case when auth.uid() is null then 'system' else 'user' end,
      auth.uid(),
      'journal_entry_voided',
      'rpc',
      'succeeded',
      'fixture fallback',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      '{}'::jsonb,
      concat('d2:journal_entries:', new.id::text, ':', txid_current()::text),
      1,
      'restricted'
    );
  end if;
  return new;
end $$;

create trigger audit_d2_journal_entries
after update on public.journal_entries
for each row execute function public.audit_d2_financial_change();

\ir ../migrations/0340_expense_void_governance.sql

grant select, update on public.expenses, public.journal_entries to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'accounting', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'warehouse', null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'operations', null),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'accounting', now());
insert into public.accounting_settings values
  ('10000000-0000-0000-0000-000000000001', '2026-01-31'),
  ('10000000-0000-0000-0000-000000000002', null);
insert into public.expenses values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'EXP-2026-0001', '2026-02-02', 't/e/receipt.jpg', '90000000-0000-0000-0000-000000000001', now(), null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'EXP-2026-0002', '2026-02-03', null, null, now(), null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'EXP-2026-0003', '2026-01-15', null, null, now(), null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'EXP-2026-0004', '2026-02-04', null, null, now(), null),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'EXP-2026-0005', '2026-02-05', null, null, now(), null);
insert into public.journal_entries values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ASI-0001', '2026-02-02', 'expense', 'asentado', null),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'ASI-0002', '2026-02-03', 'expense', 'asentado', null),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'ASI-0003', '2026-01-15', 'expense', 'asentado', null),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'ASI-0004', '2026-02-04', 'expense', 'asentado', null),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'ASI-0005', '2026-02-05', 'expense', 'asentado', null);

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

do $success$
declare
  v_result text;
  v_replay text;
begin
  v_result := public.void_expense_governed(
    '30000000-0000-0000-0000-000000000001',
    'Gasto duplicado confirmado en conciliación',
    'expense-void-request-0001'
  );
  if v_result <> 'voided' then
    raise exception 'TEST 0340: resultado inicial inesperado %', v_result;
  end if;
  if (select deleted_at is null from public.expenses where id = '30000000-0000-0000-0000-000000000001')
     or (select status from public.journal_entries where id = '40000000-0000-0000-0000-000000000001') <> 'anulado' then
    raise exception 'TEST 0340: gasto y asiento no quedaron anulados';
  end if;
  if (select receipt_path from public.expenses where id = '30000000-0000-0000-0000-000000000001') <> 't/e/receipt.jpg'
     or (select receipt_document_id from public.expenses where id = '30000000-0000-0000-0000-000000000001')
        <> '90000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'TEST 0340: se alteraron referencias del recibo';
  end if;
  if (
    select count(distinct correlation_id)
    from public.entity_audit_log
    where entity_id in (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000001'::uuid
    )
  ) <> 1 then
    raise exception 'TEST 0340: gasto y asiento no comparten correlación';
  end if;
  if (
    select count(*) from public.entity_audit_log
    where entity_id in (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000001'::uuid
    )
      and actor_id = '20000000-0000-0000-0000-000000000001'
      and reason = 'Gasto duplicado confirmado en conciliación'
  ) <> 2 then
    raise exception 'TEST 0340: actor o motivo no llegaron a ambos eventos';
  end if;
  v_replay := public.void_expense_governed(
    '30000000-0000-0000-0000-000000000001',
    'Gasto duplicado confirmado en conciliación',
    'expense-void-request-0001'
  );
  if v_replay <> 'replayed' then
    raise exception 'TEST 0340: replay no fue idempotente';
  end if;
  if (
    select count(*) from public.entity_audit_log
    where entity_id in (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000001'::uuid
    )
  ) <> 2 then
    raise exception 'TEST 0340: replay duplicó eventos';
  end if;
end;
$success$;

do $roles_and_tenant$
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
  begin
    perform public.void_expense_governed('30000000-0000-0000-0000-000000000002', 'Motivo warehouse', 'expense-void-role-1');
    raise exception 'TEST 0340: warehouse pudo anular';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
  begin
    perform public.void_expense_governed('30000000-0000-0000-0000-000000000002', 'Motivo operations', 'expense-void-role-2');
    raise exception 'TEST 0340: operations pudo anular';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000005', true);
  begin
    perform public.void_expense_governed('30000000-0000-0000-0000-000000000002', 'Motivo cross tenant', 'expense-void-role-3');
    raise exception 'TEST 0340: otro tenant pudo anular';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
  begin
    perform public.void_expense_governed('30000000-0000-0000-0000-000000000002', 'Membresía inactiva', 'expense-void-role-4');
    raise exception 'TEST 0340: membresía desactivada pudo anular';
  exception when no_data_found then null;
  end;
end;
$roles_and_tenant$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

do $admin_and_closed$
begin
  if public.void_expense_governed(
    '30000000-0000-0000-0000-000000000002',
    'Ajuste autorizado por administración',
    'expense-void-admin-1'
  ) <> 'voided' then
    raise exception 'TEST 0340: admin no pudo anular';
  end if;
  begin
    perform public.void_expense_governed(
      '30000000-0000-0000-0000-000000000003',
      'Intento en período cerrado',
      'expense-void-closed-1'
    );
    raise exception 'TEST 0340: anuló en período cerrado';
  exception when check_violation then null;
  end;
end;
$admin_and_closed$;

select set_config('dtd.expense_void', '', true);
select set_config('dtd.audit_reason', '', true);

do $direct_guard$
begin
  begin
    update public.expenses set deleted_at = now()
    where id = '30000000-0000-0000-0000-000000000003';
    raise exception 'TEST 0340: CRUD directo cambió lifecycle';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

reset role;

create or replace function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'forced_audit_failure'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

do $rollback$
begin
  begin
    perform public.void_expense_governed(
      '30000000-0000-0000-0000-000000000004',
      'Prueba de rollback del writer',
      'expense-void-rollback-1'
    );
    raise exception 'TEST 0340: fallo de auditoría no abortó';
  exception when others then
    if sqlerrm = 'TEST 0340: fallo de auditoría no abortó' then raise; end if;
  end;
  if (select deleted_at is not null from public.expenses where id = '30000000-0000-0000-0000-000000000004')
     or (select status from public.journal_entries where id = '40000000-0000-0000-0000-000000000004') <> 'asentado' then
    raise exception 'TEST 0340: mutación sobrevivió al fallo del evento';
  end if;
end;
$rollback$;

reset role;

do $acl$
begin
  if pg_catalog.has_function_privilege(
    'anon', 'public.void_expense_governed(uuid,text,text)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated', 'public.void_expense_governed(uuid,text,text)', 'EXECUTE'
  ) then
    raise exception 'TEST 0340: ACL inválida';
  end if;
end;
$acl$;

rollback;
select true as expense_void_fixture_rolled_back;
