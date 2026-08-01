\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.audit_entity_types (
  entity_type text primary key, status text not null, domain_code text not null,
  contract_version integer not null, introduced_by_ref text not null
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, source text not null,
  result text not null, reason text, before_data jsonb, after_data jsonb,
  payload jsonb not null default '{}', correlation_id text,
  schema_version integer not null, sensitivity text not null
);
create table public.client_claims (
  id uuid primary key, tenant_id uuid not null, claim_code text not null,
  amount_usd numeric(14,2) not null, status text not null,
  resolution_note text, resolved_at timestamptz,
  created_at timestamptz not null default now() - interval '30 days',
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.client_claim_financials (
  claim_id uuid primary key, tenant_id uuid not null,
  payment_method text not null
);
create table public.accounts (
  id uuid primary key, tenant_id uuid not null, code text not null,
  is_postable boolean not null default true,
  unique (tenant_id, code)
);
create table public.accounting_settings (
  tenant_id uuid primary key, closing_date date
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entry_code text not null, entry_date date not null, memo text not null,
  status text not null, source text not null, claim_id uuid,
  posted_at timestamptz, deleted_at timestamptz,
  unique (tenant_id, entry_code)
);
create unique index je_one_live_entry_per_claim
  on public.journal_entries (claim_id)
  where claim_id is not null and deleted_at is null;
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(), entry_id uuid not null,
  account_id uuid not null, debit numeric(14,2) not null,
  credit numeric(14,2) not null, line_memo text
);

create function public.client_claims_guard_pago()
returns trigger language plpgsql security definer set search_path = '' as $$
begin return new; end $$;
create trigger client_claims_guard_pago_trg before update on public.client_claims
for each row execute function public.client_claims_guard_pago();

create function public.next_entry_code(p_tenant_id uuid)
returns text language sql security definer set search_path = '' as $$
  select 'A-2026-' || lpad((count(*) + 1)::text, 4, '0')
  from public.journal_entries where tenant_id = p_tenant_id
$$;

create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_reason = 'force audit failure' then
    raise exception 'forced audit failure' using errcode = 'P0001';
  end if;
  insert into public.entity_audit_log (
    tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
    source, result, reason, before_data, after_data, payload, correlation_id,
    schema_version, sensitivity
  ) values (
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, p_reason, p_before_data, p_after_data,
    p_payload, p_correlation_id, p_schema_version, p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

\ir ../migrations/0319_claim_indemnity_payment_governance.sql

grant select, update, delete on public.client_claims to authenticated;
grant select, insert, update, delete on public.client_claim_financials to authenticated;
grant select on public.journal_entries, public.journal_lines, public.entity_audit_log to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','accounting',null),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','admin',null),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','operations',null),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','accounting',now()),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','admin',null);

insert into public.accounting_settings values
  ('10000000-0000-0000-0000-000000000001',null),
  ('10000000-0000-0000-0000-000000000002',null);
insert into public.accounts (id, tenant_id, code) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','6.20'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','1.1.1.1'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','1.1.1.2'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','6.20'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','1.1.1.2');

insert into public.client_claims (id, tenant_id, claim_code, amount_usd, status) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','REC-001',500,'aprobado'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','REC-002',700,'aprobado'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','REC-003',900,'aprobado'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','REC-004',100,'evaluacion'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','REC-005',0,'aprobado'),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','REC-006',250,'aprobado'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','REC-007',300,'aprobado'),
  ('40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','REC-008',350,'aprobado');
insert into public.client_claim_financials values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','transfer'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','cash'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','transfer'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','transfer'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','transfer'),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','transfer'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','usdt'),
  ('40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','transfer');

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);

do $direct_guard$
begin
  begin
    update public.client_claims set status = 'pagado'
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0319: UPDATE directo no fue bloqueado';
  exception when insufficient_privilege then null;
  end;
end;
$direct_guard$;

do $method_mismatch$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000001','cash',current_date,
      'Pago validado por Contabilidad','claim-pay-method'
    );
    raise exception 'TEST 0319: aceptó un medio distinto al guardado';
  exception when serialization_failure then null;
  end;
end;
$method_mismatch$;

do $success_and_replay$
declare v_first text; v_replay text;
begin
  v_first := public.pay_claim_indemnity_governed(
    '40000000-0000-0000-0000-000000000001','transfer',current_date,
    'Pago validado por Contabilidad','claim-pay-0001'
  );
  v_replay := public.pay_claim_indemnity_governed(
    '40000000-0000-0000-0000-000000000001','transfer',current_date,
    'Pago validado por Contabilidad','claim-pay-0001'
  );
  if v_first <> 'transitioned' or v_replay <> 'replayed' then
    raise exception 'TEST 0319: resultado/replay inesperado %/%', v_first, v_replay;
  end if;
  if (select status from public.client_claims where id='40000000-0000-0000-0000-000000000001') <> 'pagado'
     or (select count(*) from public.journal_entries where claim_id='40000000-0000-0000-0000-000000000001') <> 1
     or (select count(*) from public.journal_lines jl join public.journal_entries je on je.id=jl.entry_id where je.claim_id='40000000-0000-0000-0000-000000000001') <> 2
     or (select sum(debit) from public.journal_lines jl join public.journal_entries je on je.id=jl.entry_id where je.claim_id='40000000-0000-0000-0000-000000000001') <> 500
     or (select sum(credit) from public.journal_lines jl join public.journal_entries je on je.id=jl.entry_id where je.claim_id='40000000-0000-0000-0000-000000000001') <> 500 then
    raise exception 'TEST 0319: pago o asiento no son atómicos y balanceados';
  end if;
  if not exists (
    select 1 from public.entity_audit_log
    where entity_id='40000000-0000-0000-0000-000000000001'
      and actor_id='20000000-0000-0000-0000-000000000001'
      and reason='Pago validado por Contabilidad'
      and payload->>'request_ref'='claim-pay-0001'
      and payload->>'payment_method'='transfer'
      and payload->>'amount_usd'='500.00'
      and payload ? 'journal_entry_id'
  ) then raise exception 'TEST 0319: evidencia AUD-01 incompleta'; end if;
end;
$success_and_replay$;

do $sealed_hito$
begin
  begin
    update public.client_claims set status='aprobado'
    where id='40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0319: revirtió el pago';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.client_claims set amount_usd=501
    where id='40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0319: alteró el monto pagado';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.client_claim_financials
    where claim_id='40000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0319: borró la resolución pagada';
  exception when insufficient_privilege then null;
  end;
end;
$sealed_hito$;

do $request_reuse$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000002','cash',current_date,
      'Segundo pago confirmado','claim-pay-0001'
    );
    raise exception 'TEST 0319: reutilizó referencia en otro reclamo';
  exception when serialization_failure then null;
  end;
end;
$request_reuse$;

do $invalid_cases$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000004','transfer',current_date,
      'Estado todavía no aprobado','claim-pay-state'
    );
    raise exception 'TEST 0319: pagó desde estado inválido';
  exception when serialization_failure then null;
  end;
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000005','transfer',current_date,
      'Monto validado como cero','claim-pay-zero'
    );
    raise exception 'TEST 0319: pagó monto cero';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000007','usdt',current_date,
      'Cuenta USDT revisada','claim-pay-no-account'
    );
    raise exception 'TEST 0319: pagó sin cuenta contable';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$invalid_cases$;

reset role;
update public.accounting_settings set closing_date=current_date
where tenant_id='10000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $closed_period$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000006','transfer',current_date,
      'Pago dentro del período cerrado','claim-pay-closed'
    );
    raise exception 'TEST 0319: pagó en período cerrado';
  exception when check_violation then null;
  end;
  if (select status from public.client_claims where id='40000000-0000-0000-0000-000000000006') <> 'aprobado'
     or exists (select 1 from public.journal_entries where claim_id='40000000-0000-0000-0000-000000000006') then
    raise exception 'TEST 0319: período cerrado dejó mutación parcial';
  end if;
end;
$closed_period$;
reset role;
update public.accounting_settings set closing_date=null
where tenant_id='10000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $wrong_role$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000002','cash',current_date,
      'Operaciones intentó pagar','claim-pay-role'
    );
    raise exception 'TEST 0319: rol Operaciones pudo pagar';
  exception when no_data_found then null;
  end;
end;
$wrong_role$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $disabled_member$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000002','cash',current_date,
      'Membresía deshabilitada','claim-pay-disabled'
    );
    raise exception 'TEST 0319: membresía deshabilitada pudo pagar';
  exception when no_data_found then null;
  end;
end;
$disabled_member$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
do $other_tenant$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000002','cash',current_date,
      'Administrador de otro tenant','claim-pay-tenant'
    );
    raise exception 'TEST 0319: cruzó el tenant';
  exception when no_data_found then null;
  end;
end;
$other_tenant$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $audit_atomicity$
begin
  begin
    perform public.pay_claim_indemnity_governed(
      '40000000-0000-0000-0000-000000000008','transfer',current_date,
      'force audit failure','claim-pay-audit-fail'
    );
    raise exception 'TEST 0319: ignoró la falla de auditoría';
  exception when raise_exception then null;
  end;
  if (select status from public.client_claims where id='40000000-0000-0000-0000-000000000008') <> 'aprobado'
     or exists (select 1 from public.journal_entries where claim_id='40000000-0000-0000-0000-000000000008') then
    raise exception 'TEST 0319: la falla AUD dejó mutación parcial';
  end if;
end;
$audit_atomicity$;

do $admin_success$
begin
  if public.pay_claim_indemnity_governed(
    '40000000-0000-0000-0000-000000000002','cash',current_date,
    'Administrador confirmó el efectivo','claim-pay-admin'
  ) <> 'transitioned' then
    raise exception 'TEST 0319: Admin no pudo completar el pago';
  end if;
end;
$admin_success$;

reset role;
do $privileges$
begin
  if has_function_privilege('anon','public.pay_claim_indemnity_governed(uuid,text,date,text,text)','execute')
     or has_function_privilege('service_role','public.pay_claim_indemnity_governed(uuid,text,date,text,text)','execute')
     or not has_function_privilege('authenticated','public.pay_claim_indemnity_governed(uuid,text,date,text,text)','execute') then
    raise exception 'TEST 0319: grants del RPC inválidos';
  end if;
end;
$privileges$;

rollback;
\echo 'TEST 0319 OK: pago de indemnización gobernado'
