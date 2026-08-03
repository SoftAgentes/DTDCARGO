\set ON_ERROR_STOP on

-- Contrato desechable SDD-0226. No lee PII y termina en rollback.
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
  introduced_by_ref text
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
create table public.journal_entries (
  id uuid primary key,
  tenant_id uuid not null,
  status text not null,
  deleted_at timestamptz
);
create table public.nomina_settlements (
  id uuid primary key,
  tenant_id uuid not null,
  settlement_code text not null,
  status text not null,
  journal_entry_id uuid,
  total_net_usd numeric not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.nomina_settlement_lines (
  id uuid primary key,
  tenant_id uuid not null,
  settlement_id uuid not null,
  amount_usd numeric not null
);

insert into public.audit_entity_types values
  ('journal_entry', 'active', 'finance', 1, 'fixture');

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
declare
  v_id uuid;
  v_reason text := coalesce(
    nullif(current_setting('dtd.audit_reason', true), ''),
    p_reason
  );
begin
  insert into public.entity_audit_log (
    tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
    source, result, reason, before_data, after_data, payload, correlation_id,
    schema_version, sensitivity
  ) values (
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, v_reason, p_before_data, p_after_data,
    p_payload, p_correlation_id, p_schema_version, p_sensitivity
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

\ir ../migrations/0316_nomina_settlement_void_governance.sql

grant select, update on public.nomina_settlements, public.journal_entries to authenticated;
grant select, update, delete on public.nomina_settlement_lines to authenticated;
grant select on public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'accounting', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'admin', now());

insert into public.journal_entries values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'asentado', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'asentado', null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'asentado', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'asentado', null);
insert into public.nomina_settlements values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'FIN-0001', 'confirmado', '30000000-0000-0000-0000-000000000001', 1250, now(), null),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'FIN-0002', 'confirmado', '30000000-0000-0000-0000-000000000002', 900, now(), null),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'FIN-0003', 'borrador', '30000000-0000-0000-0000-000000000003', 800, now(), null),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'FIN-0004', 'confirmado', '30000000-0000-0000-0000-000000000004', 700, now(), null);
insert into public.nomina_settlement_lines values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 800);
update public.nomina_settlements set status = 'confirmado'
where id = '40000000-0000-0000-0000-000000000003';

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

do $success$
declare
  v_result text;
  v_replay text;
  v_correlation_count integer;
begin
  v_result := public.void_payroll_settlement_governed(
    '40000000-0000-0000-0000-000000000001',
    'Finiquito duplicado luego de conciliación',
    'payroll-void-request-0001'
  );
  if v_result <> 'voided' then
    raise exception 'TEST 0316: resultado inicial inesperado %', v_result;
  end if;

  if (select status from public.nomina_settlements where id = '40000000-0000-0000-0000-000000000001') <> 'anulado'
     or (select journal_entry_id from public.nomina_settlements where id = '40000000-0000-0000-0000-000000000001')
        <> '30000000-0000-0000-0000-000000000001'
     or (select status from public.journal_entries where id = '30000000-0000-0000-0000-000000000001') <> 'anulado' then
    raise exception 'TEST 0316: asiento, finiquito o vínculo no quedaron cerrados';
  end if;

  select count(distinct correlation_id) into v_correlation_count
  from public.entity_audit_log
  where entity_id in (
    '30000000-0000-0000-0000-000000000001'::uuid,
    '40000000-0000-0000-0000-000000000001'::uuid
  );
  if v_correlation_count <> 1 then
    raise exception 'TEST 0316: los eventos no comparten correlación';
  end if;
  if (
    select count(*) from public.entity_audit_log
    where entity_id in (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000001'::uuid
    )
      and actor_id = '20000000-0000-0000-0000-000000000001'
      and reason = 'Finiquito duplicado luego de conciliación'
  ) <> 2 then
    raise exception 'TEST 0316: actor o motivo no llegaron a ambos eventos';
  end if;

  v_replay := public.void_payroll_settlement_governed(
    '40000000-0000-0000-0000-000000000001',
    'Finiquito duplicado luego de conciliación',
    'payroll-void-request-0001'
  );
  if v_replay <> 'replayed' then
    raise exception 'TEST 0316: replay no fue idempotente';
  end if;
  if (
    select count(*) from public.entity_audit_log
    where entity_id in (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000001'::uuid
    )
  ) <> 2 then
    raise exception 'TEST 0316: replay duplicó eventos';
  end if;
end;
$success$;

do $role_and_tenant$
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
  begin
    perform public.void_payroll_settlement_governed(
      '40000000-0000-0000-0000-000000000002', 'Motivo de accounting', 'payroll-void-request-0002'
    );
    raise exception 'TEST 0316: accounting pudo anular';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
  begin
    perform public.void_payroll_settlement_governed(
      '40000000-0000-0000-0000-000000000002', 'Motivo cross tenant', 'payroll-void-request-0003'
    );
    raise exception 'TEST 0316: otro tenant pudo anular';
  exception when no_data_found then null;
  end;

  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
  begin
    perform public.void_payroll_settlement_governed(
      '40000000-0000-0000-0000-000000000002', 'Membresía desactivada', 'payroll-void-request-0004'
    );
    raise exception 'TEST 0316: membership desactivada pudo anular';
  exception when insufficient_privilege then null;
  end;
end;
$role_and_tenant$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('dtd.payroll_settlement_void', '', true);
select set_config('dtd.audit_reason', '', true);

do $direct_guards$
begin
  begin
    update public.nomina_settlements set status = 'anulado'
    where id = '40000000-0000-0000-0000-000000000003';
    raise exception 'TEST 0316: CRUD directo cambió lifecycle';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.nomina_settlements set total_net_usd = 1
    where id = '40000000-0000-0000-0000-000000000003';
    raise exception 'TEST 0316: CRUD directo cambió totales';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.nomina_settlement_lines
    where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0316: borró renglón confirmado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guards$;

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
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

do $rollback$
begin
  begin
    perform public.void_payroll_settlement_governed(
      '40000000-0000-0000-0000-000000000004',
      'Prueba de rollback del writer',
      'payroll-void-request-rollback'
    );
    raise exception 'TEST 0316: fallo de auditoría no abortó';
  exception when others then
    if sqlerrm = 'TEST 0316: fallo de auditoría no abortó' then raise; end if;
  end;

  if (select status from public.nomina_settlements where id = '40000000-0000-0000-0000-000000000004') <> 'confirmado'
     or (select status from public.journal_entries where id = '30000000-0000-0000-0000-000000000004') <> 'asentado' then
    raise exception 'TEST 0316: mutación sobrevivió al fallo del evento';
  end if;
end;
$rollback$;

reset role;

do $acl$
begin
  if pg_catalog.has_function_privilege(
    'anon', 'public.void_payroll_settlement_governed(uuid,text,text)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated', 'public.void_payroll_settlement_governed(uuid,text,text)', 'EXECUTE'
  ) then
    raise exception 'TEST 0316: ACL inválida';
  end if;
end;
$acl$;

rollback;
select true as nomina_settlement_void_fixture_rolled_back;
