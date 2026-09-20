\set ON_ERROR_STOP on
-- SDD-0487: identidad de facturación del cliente y sello del titular al emitir.
-- Sólo datos sintéticos, PostgreSQL desechable vacío, BEGIN/ROLLBACK. Sin Cloud
-- ni datos reales. Parte de la fixture real de 0421 (facturas, reportes de pago,
-- anulación 0294 y auditoría 0267) y aplica la cadena 0464 → 0392 → 0445 →
-- 0462 → 0466.
-- RED: psql -v apply_billing=false -f /sb/tests/0466_client_billing_identity.test.sql
\if :{?apply_billing}
\else
\set apply_billing true
\endif
\set apply_fix true
\set fixture_in_transaction true
begin;
\ir 0421_payment_report_commands.test.sql
\set fixture_in_transaction false

\ir ../migrations/0464_reporte_pago_factura_pagada.sql
\ir ../migrations/0392_factura_congela_documento_del_cliente.sql

-- Columnas reales de clients que leen 0445, 0462 y 0466 (0006, 0092, 0383).
alter table public.clients
  add column name text,
  add column rif text,
  add column phone text,
  add column doc_kind text,
  add column doc_verify_status text,
  add column doc_verified_at timestamptz,
  add column phone_last10 text generated always as (
    case
      when pg_catalog.length(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
      then pg_catalog."right"(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    end
  ) stored;
-- Mismo índice que 0095.
create unique index clients_tenant_doc_unique
  on public.clients (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;
-- Forma de 0151 que usan 0445 y 0462.
create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  proposed_name text, proposed_rif text, proposed_phone text,
  prev_name text, prev_rif text, prev_phone text,
  status text not null default 'pending',
  source text not null default 'client',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index client_change_requests_one_open
  on public.client_change_requests (client_id) where status = 'pending';

-- Fila de 0293: la entidad client activa en el catálogo de auditoría.
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('client', 'active', 'commercial', 1, 'migration:0293')
on conflict (entity_type) do nothing;

\ir ../migrations/0445_portal_profile_edit_limit.sql
\ir ../migrations/0462_portal_profile_direct_edit.sql
\if :apply_billing
\ir ../migrations/0466_client_billing_identity.sql
\endif

create temporary sequence billing_assertions;
create function pg_temp.bill_assert(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'TEST 0466: %', label; end if;
  perform nextval('pg_temp.billing_assertions');
end;
$$;
-- Ejecuta como un principal real (authenticated) y devuelve el resultado.
create function pg_temp.bill_as(actor text, statement text) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(actor)::text, ''), true);
  execute 'set local role authenticated';
  execute statement into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
-- Rechazo exacto por SQLSTATE y mensaje; nada cambia.
create function pg_temp.bill_denied(label text, statement text, expected_state text, expected_message text)
returns void language plpgsql as $$
declare denied boolean := false; code text; message text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics code = returned_sqlstate, message = message_text;
    if code <> expected_state or message <> expected_message then
      raise exception 'TEST 0466: % esperaba % %, obtuvo % %', label, expected_state, expected_message, code, message;
    end if;
    denied := true;
  end;
  perform pg_temp.bill_assert(denied, label || ': se esperaba rechazo ' || expected_message);
end;
$$;
create function pg_temp.inv(label text) returns public.invoices language sql as $$
  select * from public.invoices where id = pg_temp.fixture_id(label)
$$;
create function pg_temp.upsert(actor text, name text, doc text, address text, set_default text) returns text
language sql as $$
  select pg_temp.bill_as(actor, format(
    'select to_jsonb(outcome) from public.portal_upsert_my_billing_identity(%L, %L, %L, %s)',
    name, doc, address, set_default)) #>> '{}'
$$;
create function pg_temp.set_kind(actor text, kind text) returns text language sql as $$
  select pg_temp.bill_as(actor, format(
    'select to_jsonb(outcome) from public.portal_set_my_billing_kind(%L)', kind)) #>> '{}'
$$;

-- ── Datos sintéticos ─────────────────────────────────────────
update public.clients set name = 'Cliente Persona A', rif = 'V-12345678', doc_kind = 'persona',
  phone = '584125550101' where id = pg_temp.fixture_id('client-A');
update public.clients set name = 'Otra Empresa C.A.', rif = 'J-40123456-7', doc_kind = 'empresa'
  where id = pg_temp.fixture_id('client-A-other');
update public.clients set name = 'Sin Documento', rif = null, doc_kind = null
  where id = pg_temp.fixture_id('client-invited');
update public.clients set name = 'Cliente B', rif = 'J-12345678-9', doc_kind = 'empresa'
  where id = pg_temp.fixture_id('client-B');
insert into auth.users (id, email) values (pg_temp.fixture_id('portal-C'), 'portal-C@example.invalid');
insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind)
values (pg_temp.fixture_id('client-C'), pg_temp.fixture_id('tenant-A'), 'CCC', 'Comercial Andina C.A.', 'J-50123456-1', 'empresa');
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
values (pg_temp.fixture_id('portal-C'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('client-C'),
  'portal-C@example.invalid', 'active');

-- ── Portal · perfil y empresa ────────────────────────────────
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select public.portal_get_my_billing_profile()')) = jsonb_build_object(
    'principal_kind', 'persona', 'principal_name', 'Cliente Persona A', 'principal_doc', 'V-12345678',
    'secondary', null, 'billing_kind', 'persona'),
  'perfil inicial: persona sin empresa');
select pg_temp.bill_assert(pg_temp.set_kind('portal-A', 'empresa') = 'missing_identity',
  'sin empresa no se puede facturar a la empresa');
select pg_temp.bill_assert(
  pg_temp.upsert('portal-A', '  Importadora Pérez C.A. ', 'J-12345678-9', 'Av. Bolívar Norte, local 14, Valencia', 'true') = 'applied',
  'agrega su empresa con el RIF que otro tenant usa');
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select public.portal_get_my_billing_profile()')) -> 'secondary' = jsonb_build_object(
    'kind', 'empresa', 'legal_name', 'Importadora Pérez C.A.', 'doc', 'J-12345678-9',
    'fiscal_address', 'Av. Bolívar Norte, local 14, Valencia'),
  'la empresa queda con la razón social recortada');
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select public.portal_get_my_billing_profile()')) ->> 'billing_kind' = 'empresa',
  'la casilla deja la empresa como preferencia');
select pg_temp.bill_assert(
  pg_temp.upsert('portal-A', 'Importadora Pérez C.A.', 'J12345678-9', 'Av. Bolívar Norte, local 14, Valencia', 'null') = 'no_changes',
  'el formato del RIF no es un cambio');
select pg_temp.bill_assert(
  (select count(*) from public.client_profile_edits where client_id = pg_temp.fixture_id('client-A')) = 0,
  'la empresa no gasta cupo');
select pg_temp.bill_assert(
  exists (select 1 from public.entity_audit_log
          where entity_id = pg_temp.fixture_id('client-A') and event_type = 'client_billing_identity_saved')
  and not exists (select 1 from public.entity_audit_log
          where entity_id = pg_temp.fixture_id('client-A') and payload::text like '%12345678%'),
  'la auditoría registra el cambio sin el documento');

-- RIF de otra ficha del mismo tenant: bloqueo genérico, intento sin el valor.
select pg_temp.bill_assert(
  pg_temp.upsert('portal-A', 'Otra Razón', 'J-40123456-7', null, 'null') = 'blocked',
  'el RIF de otra ficha se bloquea');
select pg_temp.bill_assert(
  (select doc from public.client_billing_identities where client_id = pg_temp.fixture_id('client-A')) = 'J-12345678-9',
  'el bloqueo no toca la empresa guardada');
select pg_temp.bill_assert(
  (select row(field, conflicting_client_id)::text from public.client_profile_blocked_attempts
   where client_id = pg_temp.fixture_id('client-A') order by created_at desc limit 1)
  = row('company_rif', pg_temp.fixture_id('client-A-other'))::text,
  'el intento queda con el campo company_rif y la ficha en conflicto');

-- Unicidad cruzada desde clients: registro, Studio o 0462.
select pg_temp.bill_denied('otra ficha no puede tomar el RIF de una empresa secundaria',
  format('update public.clients set rif = %L where id = %L', 'J-12345678-9', pg_temp.fixture_id('client-A-other')),
  '23505', 'client_doc_taken_by_billing_identity');
select pg_temp.bill_denied('un alta con el RIF sin guiones también choca',
  format('insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind) values (%L, %L, %L, %L, %L, %L)',
    pg_temp.fixture_id('client-new'), pg_temp.fixture_id('tenant-A'), 'NEW', 'Nuevo', 'j123456789', 'empresa'),
  '23505', 'client_doc_taken_by_billing_identity');
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-C', format(
    'select to_jsonb(outcome) from public.portal_update_my_profile(null, %L, null)', 'J-12345678-9')) #>> '{}') = 'blocked',
  '0462 recibe el choque como bloqueo y no cambia el documento');
select pg_temp.bill_assert(
  (select rif from public.clients where id = pg_temp.fixture_id('client-C')) = 'J-50123456-1',
  'el documento de la ficha C sigue igual');

-- Cuenta registrada como empresa: agrega sus datos personales.
select pg_temp.bill_assert(
  pg_temp.upsert('portal-C', 'Juan Gómez', 'v-20000000', null, 'false') = 'applied',
  'la cuenta de empresa agrega nombre y cédula');
select pg_temp.bill_assert(
  (select row(kind, doc, is_billing_default)::text from public.client_billing_identities
   where client_id = pg_temp.fixture_id('client-C')) = row('persona', 'V-20000000', false)::text,
  'la identidad secundaria de una empresa es la persona');
select pg_temp.bill_assert(pg_temp.set_kind('portal-C', 'persona') = 'applied', 'elige facturar a su nombre');
select pg_temp.bill_assert(pg_temp.set_kind('portal-C', 'persona') = 'no_changes', 'elegir lo mismo no cambia nada');
select pg_temp.bill_assert(
  (select count(*) from public.client_profile_edits where client_id = pg_temp.fixture_id('client-C')) = 0,
  'los datos personales de una empresa tampoco gastan cupo');

-- Anti-enumeración: 5 bloqueos en 24 h frenan también un documento libre.
select pg_temp.upsert('portal-C', 'Juan Gómez', 'V-12345678', null, 'null') from generate_series(1, 4);
select pg_temp.bill_assert(
  (select count(*) from public.client_profile_blocked_attempts
   where client_id = pg_temp.fixture_id('client-C') and field = 'personal_doc') = 4
  and (select count(*) from public.client_profile_blocked_attempts
   where client_id = pg_temp.fixture_id('client-C')) = 5,
  'la cédula de otra ficha queda como personal_doc; 5 bloqueos con el de 0462');
select pg_temp.bill_assert(
  pg_temp.upsert('portal-C', 'Juan Gómez', 'V-30000000', null, 'null') = 'rate_limited',
  'con 5 bloqueos en 24 h un documento libre también se frena');
select pg_temp.bill_assert(
  pg_temp.upsert('portal-C', 'Juan Gómez Pérez', 'V-20000000', null, 'null') = 'applied',
  'con el límite, el nombre sigue editable si el documento no cambia');

-- Quitar la empresa y volver a agregarla.
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select to_jsonb(outcome) from public.portal_delete_my_billing_identity()') #>> '{}') = 'applied',
  'quita su empresa');
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select to_jsonb(outcome) from public.portal_delete_my_billing_identity()') #>> '{}') = 'no_changes',
  'quitar dos veces no hace nada');
select pg_temp.bill_assert(
  (pg_temp.bill_as('portal-A', 'select public.portal_get_my_billing_profile()')) ->> 'billing_kind' = 'persona',
  'sin empresa la preferencia vuelve a la persona');
select pg_temp.upsert('portal-A', 'Importadora Pérez C.A.', 'J-12345678-9', 'Av. Bolívar Norte, local 14, Valencia', 'true');

-- ── Studio · sello del titular ───────────────────────────────
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('accounting-A')::text, true);
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
values
  (pg_temp.fixture_id('seal-insert'), pg_temp.fixture_id('tenant-A'), 'F-SEAL-1', 'DUP', 'Escrito a mano', 1000, 1000, 0, 'emitida', 'USD'),
  (pg_temp.fixture_id('seal-draft'), pg_temp.fixture_id('tenant-A'), 'F-SEAL-2', 'DUP', 'Escrito a mano', 1000, 1000, 0, 'borrador', 'USD'),
  (pg_temp.fixture_id('seal-orphan'), pg_temp.fixture_id('tenant-A'), 'F-SEAL-3', 'NOPE', 'Sin ficha', 1000, 1000, 0, 'emitida', 'USD'),
  (pg_temp.fixture_id('seal-nodoc'), pg_temp.fixture_id('tenant-A'), 'F-SEAL-4', 'INVITED', 'Escrito', 1000, 1000, 0, 'emitida', 'USD');

select pg_temp.bill_assert(
  (select row(client_name, client_rif, client_doc_kind, client_fiscal_address)::text from pg_temp.inv('seal-insert'))
  = row('Importadora Pérez C.A.', 'J-12345678-9', 'empresa', 'Av. Bolívar Norte, local 14, Valencia')::text,
  'INSERT emitida (camino de la RPC 0128) sella la empresa preferida');
select pg_temp.bill_assert(
  (select row(client_name, client_rif, client_doc_kind, client_fiscal_address)::text from pg_temp.inv('seal-draft'))
  = row('Escrito a mano', null, null, null)::text,
  'un borrador no se sella');
select pg_temp.bill_assert(
  (select row(client_name, client_rif, client_doc_kind)::text from pg_temp.inv('seal-orphan'))
  = row('Sin ficha', null, null)::text,
  'sin cliente vivo se emite como viene');
select pg_temp.bill_assert(
  (select row(client_name, client_rif, client_doc_kind)::text from pg_temp.inv('seal-nodoc'))
  = row('Sin Documento', null, null)::text,
  'cliente sin documento: nombre de la ficha, sin documento');

-- Borrador: el operador elige la persona; se audita el override.
update public.invoices set bill_to_kind = 'empresa' where id = pg_temp.fixture_id('seal-draft');
update public.invoices set bill_to_kind = 'persona' where id = pg_temp.fixture_id('seal-draft');
update public.invoices set status = 'emitida' where id = pg_temp.fixture_id('seal-draft');
select pg_temp.bill_assert(
  (select row(client_name, client_rif, client_doc_kind, client_fiscal_address)::text from pg_temp.inv('seal-draft'))
  = row('Cliente Persona A', 'V-12345678', 'persona', null)::text,
  'borrador → emitida sella la persona elegida en el Studio');
select pg_temp.bill_assert(
  (select count(*) from public.entity_audit_log
   where entity_id = pg_temp.fixture_id('seal-draft') and event_type = 'invoice_bill_to_overridden'
     and actor_id = pg_temp.fixture_id('accounting-A')
     and payload = jsonb_build_object('bill_to_kind', 'persona', 'preferred_kind', 'empresa', 'applied_kind', 'persona')) = 1,
  'el override queda auditado sin PII');

-- Después de emitir, el titular no cambia.
select pg_temp.bill_denied('no se cambia el nombre de una factura emitida',
  format('update public.invoices set client_name = %L where id = %L', 'Otro', pg_temp.fixture_id('seal-insert')),
  '55000', 'invoice_titular_frozen');
select pg_temp.bill_denied('no se cambia el RIF de una factura emitida',
  format('update public.invoices set client_rif = %L where id = %L', 'J-99999999-9', pg_temp.fixture_id('seal-insert')),
  '55000', 'invoice_titular_frozen');
select pg_temp.bill_denied('no se cambia el tipo de documento',
  format('update public.invoices set client_doc_kind = %L where id = %L', 'persona', pg_temp.fixture_id('seal-insert')),
  '55000', 'invoice_titular_frozen');
select pg_temp.bill_denied('no se cambia el domicilio fiscal',
  format('update public.invoices set client_fiscal_address = null where id = %L', pg_temp.fixture_id('seal-insert')),
  '55000', 'invoice_titular_frozen');
select pg_temp.bill_denied('no se cambia la elección del borrador después de emitir',
  format('update public.invoices set bill_to_kind = %L where id = %L', 'persona', pg_temp.fixture_id('seal-insert')),
  '55000', 'invoice_titular_frozen');

-- La preferencia nueva no toca lo emitido.
select pg_temp.set_kind('portal-A', 'persona');
select pg_temp.bill_assert(
  (select client_name from pg_temp.inv('seal-insert')) = 'Importadora Pérez C.A.',
  'cambiar la preferencia no cambia facturas emitidas');

-- Escritores posteriores a la emisión: siguen funcionando y no re-sellan.
update public.invoices set paid_amount = 400, status = 'parcial', last_payment_at = now()
  where id = pg_temp.fixture_id('seal-insert');                                   -- recibos 0122
update public.invoices set paid_amount = 0, status = 'emitida'
  where id = pg_temp.fixture_id('seal-insert');                                   -- anular recibo 0467
select pg_temp.bill_assert(
  (select row(status, client_name, client_rif)::text from pg_temp.inv('seal-insert'))
  = row('emitida', 'Importadora Pérez C.A.', 'J-12345678-9')::text,
  'parcial → emitida (Cobranzas 0467) no vuelve a sellar con la preferencia nueva');
update public.invoices set status = 'vencida' where id = pg_temp.fixture_id('seal-insert');  -- vencimiento
update public.invoices set due_date = current_date + 10 where id = pg_temp.fixture_id('seal-insert');
update public.invoices set client_markbox = 'DUP2' where id = pg_temp.fixture_id('seal-insert'); -- 0367/0371
update public.invoices set client_markbox = 'DUP' where id = pg_temp.fixture_id('seal-insert');
select pg_temp.bill_assert(
  (select row(status, client_name)::text from pg_temp.inv('seal-insert'))
  = row('vencida', 'Importadora Pérez C.A.')::text,
  'vencimiento, fecha y renombre de Shipping Mark pasan sin tocar el titular');

-- Confirmación real de un reporte de pago (0421 + 0464) sobre la factura sellada.
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
select pg_temp.fixture_id('seal-report'), i.tenant_id, i.id, i.invoice_code, i.client_markbox, 100, i.currency,
  'transferencia', current_date - 1, 'Nota sintética', pg_temp.proof_path('tenant-A', 'seal-draft', 'seal-report')
from public.invoices i where i.id = pg_temp.fixture_id('seal-draft');
insert into storage.objects (bucket_id, name)
values ('payment-proofs', pg_temp.proof_path('tenant-A', 'seal-draft', 'seal-report'));
select pg_temp.bill_as('accounting-A', format(
  'select to_jsonb(public.resolve_payment_report(%L::uuid, %L::uuid, %L::public.payment_report_status, %L))',
  pg_temp.fixture_id('seal-request'), pg_temp.fixture_id('seal-report'), 'confirmado', 'Pago cotejado por finanzas'));
select pg_temp.bill_assert(
  (select row(paid_amount, client_name, client_rif)::text from pg_temp.inv('seal-draft'))
  = row(100::numeric(14,2), 'Cliente Persona A', 'V-12345678')::text,
  'confirmar un reporte suma el pago y deja el titular');

-- Anulación real con motivo (0294).
select pg_temp.bill_as('accounting-A', format(
  'select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid, %L))',
  pg_temp.fixture_id('seal-draft'), 'Factura anulada en la prueba sintética'));
select pg_temp.bill_assert(
  (select row(status, client_name)::text from pg_temp.inv('seal-draft')) = row('anulada', 'Cliente Persona A')::text,
  'anular con motivo pasa y deja el titular');

-- ── Privilegios ──────────────────────────────────────────────
select pg_temp.bill_assert(
  has_function_privilege('authenticated', 'public.portal_upsert_my_billing_identity(text,text,text,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.portal_upsert_my_billing_identity(text,text,text,boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.portal_set_my_billing_kind(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.invoices_seal_billing_titular()', 'execute')
  and not has_function_privilege('authenticated', 'public.clients_doc_not_billing_identity_elsewhere()', 'execute'),
  'sólo authenticated ejecuta las RPC del Portal; los triggers no son API');
select pg_temp.bill_assert(
  has_table_privilege('service_role', 'public.client_profile_blocked_attempts', 'delete')
  and not has_table_privilege('authenticated', 'public.client_profile_blocked_attempts', 'delete')
  and not has_table_privilege('authenticated', 'public.client_billing_identities', 'insert')
  and not has_table_privilege('authenticated', 'public.client_billing_identities', 'update'),
  'la purga la hace service_role y nadie escribe la tabla por API');
select pg_temp.bill_assert(
  (pg_temp.bill_as('accounting-A', 'select to_jsonb(count(*)) from public.client_billing_identities'))::int = 2
  and (pg_temp.bill_as('admin-A', 'select to_jsonb(count(*)) from public.client_billing_identities'))::int = 2
  and (pg_temp.bill_as('marketing-A', 'select to_jsonb(count(*)) from public.client_billing_identities'))::int = 0
  and (pg_temp.bill_as('accounting-B', 'select to_jsonb(count(*)) from public.client_billing_identities'))::int = 0
  and (pg_temp.bill_as('portal-A', 'select to_jsonb(count(*)) from public.client_billing_identities'))::int = 0,
  'el Studio lee por tenant y rol; el Portal sólo por RPC');

do $done$
begin
  raise notice 'TEST 0466 GREEN: % aserciones', (select last_value from pg_temp.billing_assertions);
end;
$done$;
rollback;
