\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0485 con el writer AUD-01 REAL.
--
-- El contrato de 0319 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('claim-pay-0001'). La pantalla
-- (ReclamosClient.tsx:513) manda `claim-indemnity-payment:<id>:<uuid>`, 97
-- caracteres, y la 0319 arma con ella un correlation_id de 158. Este contrato
-- monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294 reales), la
-- fixture del contrato 0319 sin su writer simulado, y después 0319 y 0485. Sin
-- 0485 cae en el escenario 2 con 22023 «audit: correlation_id inválido»: ése es
-- el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Reclamos: la fixture del contrato 0319 ──────────────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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

\ir ../migrations/0319_claim_indemnity_payment_governance.sql
\ir ../migrations/0485_reclamos_pagar_indemnizacion_correlation_id.sql

grant select, update, delete on public.client_claims to authenticated;
grant select, insert, update, delete on public.client_claim_financials to authenticated;
grant select on public.journal_entries, public.journal_lines, public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','accounting',null);
insert into public.accounting_settings values ('10000000-0000-0000-0000-000000000001',null);
insert into public.accounts (id, tenant_id, code) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','6.20'),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','1.1.1.2');
insert into public.client_claims (id, tenant_id, claim_code, amount_usd, status) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','REC-001',500,'aprobado'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','REC-002',700,'aprobado'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','REC-003',900,'aprobado');
insert into public.client_claim_financials values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','transfer'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','transfer'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','transfer');

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0485: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Paga como el contador de la fixture, igual que la Server Action.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result text;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.pay_claim_indemnity_governed(
    p_id, 'transfer', current_date, 'Pago validado por Contabilidad', p_ref
  );
  reset role;
  return v_result;
end;
$$;

-- Lo que el pago tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.client_claims c
    where c.id = p_id and c.status = 'pagado'
      and (select count(*) from public.journal_entries je where je.claim_id = c.id) = 1
      and (select count(*) from public.journal_lines jl
           join public.journal_entries je on je.id = jl.entry_id
           where je.claim_id = c.id) = 2
  ), p_label || ': el reclamo queda pagado con su asiento de dos líneas');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'client_claim_indemnity_paid';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'claim-indemnity-payment:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 93,
    p_label || ': correlation_id de 93 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'client_claim_indemnity_paid'
      and payload->>'request_ref' = p_ref
  ), p_label || ': payload.request_ref conserva la referencia completa');
end;
$$;

-- 1. El writer de este contrato es el real: rechaza un correlation_id de 129.
do $writer_real$
declare v_state text; v_message text;
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001', 'client_claim',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'client_claim_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'client_claim_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (ReclamosClient.tsx:513): 97.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'claim-indemnity-payment:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 97, 'la referencia de la pantalla mide 97');
  perform pg_temp.assert_true(
    char_length('claim-indemnity-payment:' || v_id::text || ':' || v_ref) = 158,
    'con la 0319 el correlation_id mediría 158');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'client_claim_indemnity_paid') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 68 es la referencia más corta que la 0319 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 67);
begin
  perform pg_temp.assert_true(
    char_length('claim-indemnity-payment:' || v_id::text || ':' || v_ref) = 129,
    'con la 0319 una referencia de 68 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 68');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'claim-indemnity-payment:' || v_id::text || ':' || repeat('f', 128 - 61);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0485 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.pay_claim_indemnity_governed(uuid,text,date,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0485 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
