\set ON_ERROR_STOP on
-- SDD-0559 · Fixture sintética de scripts/qa/radiografia-integridad.sql.
-- NUNCA contra una base de red: la guarda de abajo aborta si ya hay objetos de aplicación.
-- Arma la plataforma mínima, aplica con \ir las migraciones REALES de las tablas que lee la
-- radiografía (0077, 0078, 0079, 0088, 0098, 0122, 0195, 0237), agrega las tres columnas de
-- 0421 que lee (la migración entera pide auditoría, identidad y el bucket) y siembra diecisiete
-- tenants (A-N, P, S y T), cada uno con una trampa. Todo texto lleva CENTINELA y los montos tienen
-- centavos: la prueba exige que la salida de conteos traiga exactamente sus cinco columnas y
-- ningún valor con forma de monto. La usa
-- scripts/__tests__/radiografia-integridad.test.ts (PGlite); también corre con psql en un
-- postgres:17 desechable:
--   psql -U postgres -v ON_ERROR_STOP=1 -f radiografia-integridad.fixture.sql  (desde scripts/qa)
do $guarda$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.invoices') is not null then
    raise exception 'SDD-0559: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
end;
$guarda$;
do $g$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$g$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create function public.get_user_tenant_id() returns uuid language sql stable security definer set search_path = '' as $$
  select null::uuid
$$;
create function public.get_portal_client_markbox() returns text language sql stable set search_path = '' as $$
  select null::text
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, deleted_at timestamptz
);
create table public.fiscal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
-- El tenant 'dtd' existe ANTES de las migraciones: los seeds reales de 0078/0122 le siembran el plan de cuentas.
insert into public.tenants (id, slug, display_name)
  values (md5('0559-tenant-A')::uuid, 'dtd', 'CENTINELA-TENANT-A');

\ir ../../supabase/migrations/0077_invoices.sql
\ir ../../supabase/migrations/0078_contabilidad.sql
\ir ../../supabase/migrations/0079_cobranzas.sql
\ir ../../supabase/migrations/0088_tesoreria.sql
\ir ../../supabase/migrations/0098_fidelizacion_referidos.sql
\ir ../../supabase/migrations/0122_recibos_cobranza.sql
\ir ../../supabase/migrations/0195_payment_reports.sql
\ir ../../supabase/migrations/0237_referral_credit_apply.sql

-- Las columnas y el CHECK que 0421_payment_report_commands.sql:41-50 agrega a payment_reports.
-- El resto de 0421 (comandos, auditoría, bucket) no lo lee la radiografía; el esquema completo
-- lo prueba scripts/check-schema-rebuild.mjs.
alter table public.payment_reports
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  add column resolution_reason text,
  add constraint payment_reports_cancellation_pair check (
    (cancelled_at is null) = (cancelled_by is null)
    and (cancelled_at is null or (status = 'reportado' and deleted_at is null))
  );

-- ── datos sintéticos ── (la prueba corre la radiografía sobre el esquema vacío antes de esta línea)
create function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('0559-' || p)::uuid $$;
create function pg_temp.t(p text) returns uuid language sql immutable as $$ select md5('0559-tenant-' || p)::uuid $$;
create function pg_temp.cta(p_t text, p_code text) returns uuid language sql stable as $$
  select id from public.accounts where tenant_id = pg_temp.t(p_t) and code = p_code
$$;
create function pg_temp.factura(p_t text, p_l text, p_estado text, p_moneda text, p_total numeric,
  p_pagado numeric, p_emision date, p_tasa numeric default null, p_borrada boolean default false)
  returns void language sql as $$
  insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency, fx_rate,
    base_amount, total_amount, status, issued_at, paid_amount, notes, shipment_code, deleted_at)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-F-' || p_l, 'CENTINELA-MB', 'CENTINELA-NOMBRE',
    p_moneda::invoice_currency, p_tasa, p_total, p_total, p_estado::invoice_status, p_emision, p_pagado,
    'CENTINELA-NOTA', 'CENTINELA-EMBARQUE', case when p_borrada then now() end)
$$;
-- Un asiento de dos líneas (debe y haber por el mismo monto). p_doc es el documento al que se
-- une DEL LADO DEL ASIENTO (asiento.<doc>_id), según el origen; el lado del documento
-- (doc.journal_entry_id) se une aparte con vincula_*.
create function pg_temp.asiento(p_t text, p_l text, p_estado text, p_origen text, p_debe text, p_haber text,
  p_monto numeric, p_doc text default null, p_borrado boolean default false) returns void language sql as $$
  insert into public.journal_entries (id, tenant_id, entry_code, memo, status, source,
    invoice_id, receipt_id, bill_id, supplier_payment_id, deleted_at)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-A-' || p_l, 'CENTINELA-MEMO', p_estado::entry_status, p_origen,
    case when p_origen in ('invoice', 'referral_credit') then pg_temp.id(p_doc) end,
    case when p_origen in ('receipt', 'receipt_reclass') then pg_temp.id(p_doc) end,
    case when p_origen = 'supplier_bill' then pg_temp.id(p_doc) end,
    case when p_origen = 'supplier_payment' then pg_temp.id(p_doc) end,
    case when p_borrado then now() end);
  insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo) values
    (pg_temp.id(p_l), pg_temp.cta(p_t, p_debe), p_monto, 0, 'CENTINELA-LINEA'),
    (pg_temp.id(p_l), pg_temp.cta(p_t, p_haber), 0, p_monto, 'CENTINELA-LINEA');
$$;
-- p_factura null = pago sin referencia (recibido_sin_ref, sin factura ni datos del cliente).
create function pg_temp.recibo(p_t text, p_l text, p_factura text, p_monto numeric, p_anulado boolean default false,
  p_moneda text default 'USD', p_tasa numeric default null, p_identificado boolean default false)
  returns void language sql as $$
  insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name, amount,
    currency, fx_rate, cash_account_id, reference, notes, deleted_at, application_status, identified_at,
    payer_name)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-R-' || p_l, pg_temp.id(p_factura),
    case when p_factura is not null then 'CENTINELA-MB' end,
    case when p_factura is not null then 'CENTINELA-NOMBRE' end,
    p_monto, p_moneda::invoice_currency, p_tasa, pg_temp.cta(p_t, '1.1.1.1'), 'CENTINELA-REF', 'CENTINELA-NOTA',
    case when p_anulado then now() end,
    case when p_factura is null then 'recibido_sin_ref' when p_identificado then 'identificado' else 'aplicado' end,
    case when p_identificado then now() end, 'CENTINELA-PAGADOR')
$$;
create function pg_temp.vincula_recibo(p_r text, p_a text) returns void language sql as $$
  update public.payment_receipts set journal_entry_id = pg_temp.id(p_a) where id = pg_temp.id(p_r)
$$;
create function pg_temp.cxp(p_t text, p_l text, p_estado text, p_moneda text, p_total numeric, p_pagado numeric,
  p_tasa numeric default null, p_borrada boolean default false) returns void language sql as $$
  insert into public.supplier_bills (id, tenant_id, bill_code, supplier_id, supplier_name, concept, expense_account_id,
    currency, fx_rate, total_amount, paid_amount, status, due_date, reference, notes, deleted_at)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-CXP-' || p_l, pg_temp.id('prov-' || p_t), 'CENTINELA-PROVEEDOR',
    'CENTINELA-CONCEPTO', pg_temp.cta(p_t, '5.1'), p_moneda::invoice_currency, p_tasa, p_total, p_pagado, p_estado,
    '2026-12-31', 'CENTINELA-REF', 'CENTINELA-NOTA', case when p_borrada then now() end)
$$;
create function pg_temp.vincula_cxp(p_b text, p_a text) returns void language sql as $$
  update public.supplier_bills set journal_entry_id = pg_temp.id(p_a) where id = pg_temp.id(p_b)
$$;
create function pg_temp.pago(p_t text, p_l text, p_cxp text, p_monto numeric, p_anulado boolean default false,
  p_moneda text default 'USD', p_tasa numeric default null) returns void language sql as $$
  insert into public.supplier_payments (id, tenant_id, payment_code, bill_id, supplier_id, supplier_name, amount,
    currency, fx_rate, cash_account_id, reference, notes, deleted_at)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-OP-' || p_l, pg_temp.id(p_cxp), pg_temp.id('prov-' || p_t),
    'CENTINELA-PROVEEDOR', p_monto, p_moneda::invoice_currency, p_tasa, pg_temp.cta(p_t, '1.1.1.1'),
    'CENTINELA-REF', 'CENTINELA-NOTA', case when p_anulado then now() end)
$$;
create function pg_temp.vincula_pago(p_p text, p_a text) returns void language sql as $$
  update public.supplier_payments set journal_entry_id = pg_temp.id(p_a) where id = pg_temp.id(p_p)
$$;
create function pg_temp.reporte(p_t text, p_l text, p_factura text, p_monto numeric, p_estado text,
  p_moneda text default 'USD', p_borrado boolean default false, p_cancelado boolean default false)
  returns void language sql as $$
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method,
    paid_at, status, note, proof_path, deleted_at, cancelled_at, cancelled_by, resolution_reason)
  values (pg_temp.id(p_l), pg_temp.t(p_t), pg_temp.id(p_factura), 'CENTINELA-F', 'CENTINELA-MB', p_monto,
    p_moneda::invoice_currency, 'otro', '2026-10-01', p_estado::payment_report_status, 'CENTINELA-NOTA',
    'CENTINELA-COMPROBANTE-' || p_l, case when p_borrado then now() end,
    case when p_cancelado then now() end, case when p_cancelado then pg_temp.id('actor') end,
    case when p_cancelado then 'CENTINELA-MOTIVO' end)
$$;
create function pg_temp.credito(p_t text, p_l text, p_estado text, p_monto numeric, p_factura text default null,
  p_borrado boolean default false) returns void language sql as $$
  insert into public.referrals (id, tenant_id, referral_code, referrer_markbox, referred_name, referred_company,
    referred_email, referred_phone, status, reward_usd, applied_invoice_id, applied_at, notes, deleted_at)
  values (pg_temp.id(p_l), pg_temp.t(p_t), 'CENTINELA-REF-' || p_l, 'CENTINELA-MB', 'CENTINELA-REFERIDO',
    'CENTINELA-EMPRESA', 'centinela@correo.test', 'CENTINELA-TEL', p_estado::referral_status, p_monto,
    pg_temp.id(p_factura), case when p_factura is not null then now() end, 'CENTINELA-NOTA',
    case when p_borrado then now() end)
$$;

-- Tenants B..T con su propio plan de cuentas mínimo (A lo sembraron las migraciones reales).
insert into public.tenants (id, slug, display_name)
select pg_temp.t(t), 'centinela-' || lower(t), 'CENTINELA-TENANT-' || t
from unnest(array['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'S', 'T']) t;
insert into public.accounts (tenant_id, code, name, type, is_postable)
select pg_temp.t(t), c.code, 'CENTINELA-CUENTA', c.type::acct_type, true
from unnest(array['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'S', 'T']) t
cross join (values ('1.1.1.1', 'A'), ('1.1.2', 'A'), ('2.1.1', 'P'), ('4.5', 'I'), ('5.1', 'CGS')) c(code, type);
-- Subcuentas (D, E, J) y la cuenta puente 2.1.8 de los pagos sin referencia (I, K, T).
insert into public.accounts (tenant_id, code, name, type, is_postable) values
  (pg_temp.t('D'), '1.1.2.1', 'CENTINELA-SUBCUENTA', 'A', true),
  (pg_temp.t('D'), '4.5.1', 'CENTINELA-SUBCUENTA', 'I', true),
  (pg_temp.t('E'), '1.1.2.1', 'CENTINELA-SUBCUENTA', 'A', true),
  (pg_temp.t('E'), '4.5.1', 'CENTINELA-SUBCUENTA', 'I', true),
  (pg_temp.t('E'), '2.1.5', 'CENTINELA-CUENTA', 'P', true),
  (pg_temp.t('E'), '2.1.5.1', 'CENTINELA-SUBCUENTA', 'P', true),
  (pg_temp.t('J'), '2.1.1.1', 'CENTINELA-SUBCUENTA', 'P', true),
  (pg_temp.t('I'), '2.1.8', 'CENTINELA-CUENTA', 'P', true),
  (pg_temp.t('K'), '2.1.8', 'CENTINELA-CUENTA', 'P', true),
  (pg_temp.t('T'), '2.1.8', 'CENTINELA-CUENTA', 'P', true);
insert into public.suppliers (id, tenant_id, supplier_code, name, tax_id, contact_name, contact_phone, contact_email)
select pg_temp.id('prov-' || t), pg_temp.t(t), 'CENTINELA-PRV-' || t, 'CENTINELA-PROVEEDOR', 'CENTINELA-RIF',
  'CENTINELA-CONTACTO', 'CENTINELA-TEL', 'centinela@correo.test'
from unnest(array['A', 'B', 'E', 'G', 'I', 'J', 'L', 'M', 'P', 'S']) t;

-- ════ Tenant A · la mayoría de las trampas por documento ════
-- Facturas. F4 anulada con asiento en BORRADOR; F5, F16 y F17 anuladas con asiento VIVO (F16 con
-- un recibo vivo y cobrado 0, F17 con cobrado y sin recibo); F3 con solo crédito de referido;
-- F6 vencida sin asiento; F7 VES y F19 CNY sin tasa, F20 VES con tasa 0 (sin asiento: van a
-- «sin asiento», no a «no comparable»); F8 USDT sin tasa; F11 pagada sin fuentes; F21 borrada;
-- F23 borrador CNY sin tasa y con fecha de emisión, y F24 borrador USDT sin tasa (los borradores
-- no entran en «sin tasa» ni en el año de emisión). F25 emitida con su asiento, sin cobrado ni
-- recibos y con un reporte confirmado (P8): cobrado 0 «igual» a sus recibos, que la 87 no cuenta.
select pg_temp.factura('A', 'F1', 'emitida', 'USD', 100.10, 0, '2026-01-10');
select pg_temp.factura('A', 'F2', 'parcial', 'USD', 200.20, 71.26, '2026-02-10');
select pg_temp.factura('A', 'F3', 'parcial', 'USD', 300.30, 100.00, '2026-03-10');
select pg_temp.factura('A', 'F4', 'anulada', 'USD', 400.40, 40.04, '2026-04-10');
select pg_temp.factura('A', 'F5', 'anulada', 'USD', 500.50, 0, '2026-05-10');
select pg_temp.factura('A', 'F6', 'vencida', 'USD', 600.60, 0, '2026-06-10');
select pg_temp.factura('A', 'F7', 'pagada', 'VES', 36000.36, 36000.36, '2025-12-31');
select pg_temp.factura('A', 'F8', 'emitida', 'USDT', 80.08, 0, '2026-08-10');
select pg_temp.factura('A', 'F9', 'borrador', 'USD', 900.90, 0, null);
select pg_temp.factura('A', 'F10', 'parcial', 'USD', 1000.10, 112.21, '2026-09-10');
select pg_temp.factura('A', 'F11', 'pagada', 'USD', 110.11, 110.11, null);
select pg_temp.factura('A', 'F12', 'parcial', 'USD', 120.12, 37.37, '2026-10-10');
select pg_temp.factura('A', 'F13', 'emitida', 'USD', 130.13, 0, '2026-10-11');
select pg_temp.factura('A', 'F14', 'parcial', 'USD', 140.14, 20.00, '2026-10-12');
select pg_temp.factura('A', 'F15', 'parcial', 'USD', 160.16, 25.00, '2026-10-13');
select pg_temp.factura('A', 'F16', 'anulada', 'USD', 170.17, 0, '2026-10-14');
select pg_temp.factura('A', 'F17', 'anulada', 'USD', 180.18, 18.00, '2026-10-15');
select pg_temp.factura('A', 'F18', 'parcial', 'USD', 190.19, 19.00, '2026-10-16');
select pg_temp.factura('A', 'F19', 'emitida', 'CNY', 200.00, 0, '2026-10-17');
select pg_temp.factura('A', 'F20', 'emitida', 'VES', 210.00, 0, '2026-10-18', 0);
select pg_temp.factura('A', 'F21', 'borrador', 'USD', 999.99, 0, null, null, true);
select pg_temp.factura('A', 'F23', 'borrador', 'CNY', 230.23, 0, '2026-10-19');
select pg_temp.factura('A', 'F24', 'borrador', 'USDT', 240.24, 0, null);
select pg_temp.factura('A', 'F25', 'emitida', 'USD', 250.25, 0, '2026-10-19');

-- Asientos de venta. AX13 está BORRADO (no da asiento a F13).
select pg_temp.asiento('A', 'AF1', 'asentado', 'invoice', '1.1.2', '4.5', 100.10, 'F1');
select pg_temp.asiento('A', 'AF4', 'borrador', 'invoice', '1.1.2', '4.5', 400.40, 'F4');
select pg_temp.asiento('A', 'AF5', 'asentado', 'invoice', '1.1.2', '4.5', 500.50, 'F5');
select pg_temp.asiento('A', 'AF8', 'asentado', 'invoice', '1.1.2', '4.5', 80.08, 'F8');
select pg_temp.asiento('A', 'AF10', 'asentado', 'invoice', '1.1.2', '4.5', 1000.10, 'F10');
select pg_temp.asiento('A', 'AF11', 'asentado', 'invoice', '1.1.2', '4.5', 110.11, 'F11');
select pg_temp.asiento('A', 'AF12', 'asentado', 'invoice', '1.1.2', '4.5', 120.12, 'F12');
select pg_temp.asiento('A', 'AX13', 'asentado', 'invoice', '1.1.2', '4.5', 130.13, 'F13', true);
select pg_temp.asiento('A', 'AF14', 'asentado', 'invoice', '1.1.2', '4.5', 140.14, 'F14');
select pg_temp.asiento('A', 'AF15', 'asentado', 'invoice', '1.1.2', '4.5', 160.16, 'F15');
select pg_temp.asiento('A', 'AF16', 'asentado', 'invoice', '1.1.2', '4.5', 170.17, 'F16');
select pg_temp.asiento('A', 'AF17', 'asentado', 'invoice', '1.1.2', '4.5', 180.18, 'F17');
select pg_temp.asiento('A', 'AF18', 'asentado', 'invoice', '1.1.2', '4.5', 190.19, 'F18');
select pg_temp.asiento('A', 'AF25', 'asentado', 'invoice', '1.1.2', '4.5', 250.25, 'F25');

-- Créditos de referido. Q1 aplicado a F3 con su asiento AQ1, que es viejo: sin referral_id,
-- unido solo por el lado del documento (referrals.applied_entry_id). Q2 aplicado a F15 SIN
-- asiento. Q3 revertido (acreditado) con su asiento AQ3 colgado. Q4 aplicado a F15 pero BORRADO.
-- AQ5 es un asiento de crédito vivo sin referral_id en F15, la misma factura de Q2: si el
-- vínculo fuera por la factura, los dos se taparían entre sí.
select pg_temp.credito('A', 'Q1', 'aplicado', 100.00, 'F3');
select pg_temp.credito('A', 'Q2', 'aplicado', 25.00, 'F15');
select pg_temp.credito('A', 'Q3', 'acreditado', 30.00);
select pg_temp.credito('A', 'Q4', 'aplicado', 40.00, 'F15', true);
select pg_temp.asiento('A', 'AQ1', 'asentado', 'referral_credit', '5.1', '1.1.2', 100.00, 'F3');
select pg_temp.asiento('A', 'AQ3', 'asentado', 'referral_credit', '5.1', '1.1.2', 30.00, 'F15');
select pg_temp.asiento('A', 'AQ5', 'asentado', 'referral_credit', '5.1', '1.1.2', 5.55, 'F15');
update public.journal_entries set referral_id = pg_temp.id('Q3') where id = pg_temp.id('AQ3');
update public.referrals set applied_entry_id = pg_temp.id('AQ1') where id = pg_temp.id('Q1');

-- Recibos. R3 y R8 apuntan a asientos ANULADOS; R4 tiene asiento vivo SIN vínculo; R5 anulado
-- con asiento vivo; R9 anulado cuyo único asiento vivo es la reclasificación; R10 y R11
-- identificados (R10 sin reclasificación); R13 sin ningún asiento y sin vínculo.
select pg_temp.recibo('A', 'R1', 'F2', 50.05);
select pg_temp.recibo('A', 'R2', 'F4', 40.04);
select pg_temp.recibo('A', 'R3', 'F12', 12.12);
select pg_temp.recibo('A', 'R4', 'F12', 12.12);
select pg_temp.recibo('A', 'R5', 'F1', 7.07, true);
select pg_temp.recibo('A', 'R6', 'F13', 13.13);
select pg_temp.recibo('A', 'R8', 'F12', 1.01);
select pg_temp.recibo('A', 'R9', 'F1', 9.09, true);
select pg_temp.recibo('A', 'R10', 'F14', 14.00, false, 'USD', null, true);
select pg_temp.recibo('A', 'R11', 'F14', 6.00, false, 'USD', null, true);
select pg_temp.recibo('A', 'R12', 'F16', 17.00);
select pg_temp.recibo('A', 'R13', 'F18', 19.00);
select pg_temp.asiento('A', 'AR1', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 50.05, 'R1');
select pg_temp.asiento('A', 'AR2', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 40.04, 'R2');
select pg_temp.asiento('A', 'AR3', 'anulado', 'receipt', '1.1.1.1', '1.1.2', 12.12, 'R3');
select pg_temp.asiento('A', 'AR4', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 12.12, 'R4');
select pg_temp.asiento('A', 'AR5', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 7.07, 'R5');
select pg_temp.asiento('A', 'AR6', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 13.13, 'R6');
select pg_temp.asiento('A', 'AR8', 'anulado', 'receipt', '1.1.1.1', '1.1.2', 1.01, 'R8');
select pg_temp.asiento('A', 'AR9', 'asentado', 'receipt_reclass', '2.1.8', '1.1.2', 9.09, 'R9');
select pg_temp.asiento('A', 'AR10', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 14.00, 'R10');
select pg_temp.asiento('A', 'AR11', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 6.00, 'R11');
select pg_temp.asiento('A', 'AR11X', 'asentado', 'receipt_reclass', '2.1.8', '1.1.2', 6.00, 'R11');
select pg_temp.asiento('A', 'AR12', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 17.00, 'R12');
select pg_temp.vincula_recibo(r, 'A' || r)
from unnest(array['R1', 'R2', 'R3', 'R5', 'R6', 'R8', 'R10', 'R11', 'R12']) r;

-- Vínculos y orígenes. Pagos sin referencia en USD, asentados contra 2.1.8 (no tocan 1.1.2):
-- R14 y R15 tienen asiento de cobro vivo por receipt_id, pero su vínculo es VIEJO (apunta a un
-- asiento anulado, AR14V, o borrado, AR15V); R16 y R17 no tienen asiento vivo y su vínculo
-- apunta a uno borrado (AR16) o en borrador (AR17), que no son «anulado»; el asiento de R18 no
-- lleva receipt_id: solo lo une el lado del documento. R19 (F5) y R20 (F10, del mismo monto que
-- el reporte P1) están anulados, sin asiento. R21, identificado contra F2, tiene su asiento de
-- cobro (a 2.1.8) por receipt_id, y su journal_entry_id apunta a su reclasificación AR21X, viva y
-- sin receipt_id: es el vínculo «de otro origen» de la fila 58 y la reclasificación unida solo por
-- el lado del documento. Hoy ningún escritor lo produce (collections-actions.ts:218 y :317 guardan
-- el id del asiento de cobro), así que es sintético.
select pg_temp.recibo('A', 'R14', null, 14.14);
select pg_temp.recibo('A', 'R15', null, 15.15);
select pg_temp.recibo('A', 'R16', null, 16.16);
select pg_temp.recibo('A', 'R17', null, 17.17);
select pg_temp.recibo('A', 'R18', null, 18.18);
select pg_temp.recibo('A', 'R19', 'F5', 19.19, true);
select pg_temp.recibo('A', 'R20', 'F10', 90.09, true);
select pg_temp.asiento('A', 'AR14V', 'anulado', 'receipt', '1.1.1.1', '2.1.8', 14.14, 'R14');
select pg_temp.asiento('A', 'AR14', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 14.14, 'R14');
select pg_temp.asiento('A', 'AR15V', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 15.15, 'R15', true);
select pg_temp.asiento('A', 'AR15', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 15.15, 'R15');
select pg_temp.asiento('A', 'AR16', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 16.16, 'R16', true);
select pg_temp.asiento('A', 'AR17', 'borrador', 'receipt', '1.1.1.1', '2.1.8', 17.17, 'R17');
select pg_temp.asiento('A', 'AR18', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 18.18);
select pg_temp.vincula_recibo('R14', 'AR14V');
select pg_temp.vincula_recibo('R15', 'AR15V');
select pg_temp.vincula_recibo('R16', 'AR16');
select pg_temp.vincula_recibo('R17', 'AR17');
select pg_temp.vincula_recibo('R18', 'AR18');
select pg_temp.recibo('A', 'R21', 'F2', 21.21, false, 'USD', null, true);
select pg_temp.asiento('A', 'AR21', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 21.21, 'R21');
select pg_temp.asiento('A', 'AR21X', 'asentado', 'receipt_reclass', '2.1.8', '1.1.2', 21.21);
select pg_temp.vincula_recibo('R21', 'AR21X');

-- Reportes: P1 confirmado (F10), P2 reportado, P3 confirmado BORRADO, P4 rechazado, P5
-- confirmado en VES (F10), P6 confirmado del mismo monto que R3 (F12), P7 cancelado (0421), P8
-- confirmado en F25, que tiene cobrado 0.
select pg_temp.reporte('A', 'P1', 'F10', 90.09, 'confirmado');
select pg_temp.reporte('A', 'P2', 'F10', 10.00, 'reportado');
select pg_temp.reporte('A', 'P3', 'F10', 5.00, 'confirmado', 'USD', true);
select pg_temp.reporte('A', 'P4', 'F10', 3.00, 'rechazado');
select pg_temp.reporte('A', 'P5', 'F10', 22.12, 'confirmado', 'VES');
select pg_temp.reporte('A', 'P6', 'F12', 12.12, 'confirmado');
select pg_temp.reporte('A', 'P7', 'F10', 4.00, 'reportado', 'USD', false, true);
select pg_temp.reporte('A', 'P8', 'F25', 25.25, 'confirmado');

-- Mayor: un manual vivo en 1.1.2, uno descuadrado (U1) y uno sin líneas con origen libre (U2).
select pg_temp.asiento('A', 'M1', 'asentado', 'manual', '1.1.2', '4.5', 33.33);
insert into public.journal_entries (id, tenant_id, entry_code, memo, status, source)
values (pg_temp.id('U1'), pg_temp.t('A'), 'CENTINELA-A-U1', 'CENTINELA-MEMO', 'asentado', 'manual'),
       (pg_temp.id('U2'), pg_temp.t('A'), 'CENTINELA-A-U2', 'CENTINELA-MEMO', 'asentado', 'centinela-origen-libre');
insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo) values
  (pg_temp.id('U1'), pg_temp.cta('A', '5.1'), 10.00, 0, 'CENTINELA-LINEA'),
  (pg_temp.id('U1'), pg_temp.cta('A', '4.5'), 0, 9.99, 'CENTINELA-LINEA');

-- CxP: BA1 con asiento, OP1 con asiento y OP2 anulado con asiento vivo; BA2 sin asiento con OP3
-- sin asiento; BA3 anulada con asiento anulado; BA4 anulada con asiento VIVO; BA5 en CNY sin
-- asiento (fuera de la suma, no «no comparable»); BA6 borrada.
select pg_temp.cxp('A', 'BA1', 'parcial', 'USD', 300.00, 100.00);
select pg_temp.cxp('A', 'BA2', 'parcial', 'USD', 50.00, 10.00);
select pg_temp.cxp('A', 'BA3', 'anulada', 'USD', 77.77, 0);
select pg_temp.cxp('A', 'BA4', 'anulada', 'USD', 44.44, 0);
select pg_temp.cxp('A', 'BA5', 'pendiente', 'CNY', 71.80, 0, 7.18);
select pg_temp.cxp('A', 'BA6', 'pendiente', 'USD', 66.66, 0, null, true);
select pg_temp.pago('A', 'OP1', 'BA1', 100.00);
select pg_temp.pago('A', 'OP2', 'BA1', 20.00, true);
select pg_temp.pago('A', 'OP3', 'BA2', 10.00);
select pg_temp.asiento('A', 'ABA1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 300.00, 'BA1');
select pg_temp.asiento('A', 'ABA3', 'anulado', 'supplier_bill', '5.1', '2.1.1', 77.77, 'BA3');
select pg_temp.asiento('A', 'ABA4', 'asentado', 'supplier_bill', '5.1', '2.1.1', 44.44, 'BA4');
select pg_temp.asiento('A', 'AOP1', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 100.00, 'OP1');
select pg_temp.asiento('A', 'AOP2', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 20.00, 'OP2');
select pg_temp.vincula_cxp(b, 'A' || b) from unnest(array['BA1', 'BA3', 'BA4']) b;
select pg_temp.vincula_pago(p, 'A' || p) from unnest(array['OP1', 'OP2']) p;
-- Asientos MANUALES que llevan bill_id (BA1) y supplier_payment_id (OP1), fuera de 2.1.1: no son
-- el asiento de su documento, porque el origen no es el suyo.
select pg_temp.asiento('A', 'MBA1', 'asentado', 'manual', '5.1', '1.1.1.1', 1.11);
select pg_temp.asiento('A', 'MOP1', 'asentado', 'manual', '5.1', '1.1.1.1', 1.12);
update public.journal_entries set bill_id = pg_temp.id('BA1') where id = pg_temp.id('MBA1');
update public.journal_entries set supplier_payment_id = pg_temp.id('OP1') where id = pg_temp.id('MOP1');

-- ════ B · cuadra en 1.1.2 y 2.1.1 pese a un asiento en borrador, una CxP anulada y documentos
-- VES/CNY sin asiento que no están abiertos con saldo (FB2 anulada, FB3, BB3 y BB4 pagadas): no
-- quedan «fuera de la suma». El recibo VES RB2 de FB3 y el pago VES OPB1 de BB4 están vivos y
-- SIN asiento: no vuelven no comparable a B (decisión 7) ════
select pg_temp.factura('B', 'FB1', 'parcial', 'USD', 1000.00, 250.00, '2026-07-01');
select pg_temp.factura('B', 'FB2', 'anulada', 'VES', 720.72, 0, '2026-07-01', 36);
select pg_temp.factura('B', 'FB3', 'pagada', 'VES', 360.36, 360.36, '2026-07-01', 36);
select pg_temp.cxp('B', 'BB3', 'pagada', 'CNY', 71.71, 71.71, 7.18);
select pg_temp.recibo('B', 'RB1', 'FB1', 250.00);
select pg_temp.asiento('B', 'AFB1', 'asentado', 'invoice', '1.1.2', '4.5', 1000.00, 'FB1');
select pg_temp.asiento('B', 'ARB1', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 250.00, 'RB1');
select pg_temp.vincula_recibo('RB1', 'ARB1');
select pg_temp.asiento('B', 'MB1', 'borrador', 'manual', '1.1.2', '4.5', 999.99);
select pg_temp.cxp('B', 'BB1', 'pendiente', 'USD', 300.00, 0);
select pg_temp.cxp('B', 'BB2', 'anulada', 'USD', 77.77, 0);
select pg_temp.asiento('B', 'ABB1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 300.00, 'BB1');
select pg_temp.asiento('B', 'ABB2', 'anulado', 'supplier_bill', '5.1', '2.1.1', 77.77, 'BB2');
select pg_temp.vincula_cxp('BB1', 'ABB1');
select pg_temp.vincula_cxp('BB2', 'ABB2');
select pg_temp.recibo('B', 'RB2', 'FB3', 360.36, false, 'VES', 36);
-- El pago hereda la moneda de su CxP (0468_pago_proveedor_atomico.sql:213-219).
select pg_temp.cxp('B', 'BB4', 'pagada', 'VES', 360.00, 360.00, 36);
select pg_temp.pago('B', 'OPB1', 'BB4', 360.00, false, 'VES', 36);

-- ════ C: mayor 123.45 por debajo · D: 123.45 por encima, en subcuentas (se cancelan si se suma
-- sin separar tenants) ════
select pg_temp.factura('C', 'FC1', 'emitida', 'USD', 123.45, 0, '2026-07-02');
select pg_temp.factura('C', 'FC2', 'emitida', 'USD', 50.00, 0, '2026-07-02');
select pg_temp.asiento('C', 'AFC2', 'asentado', 'invoice', '1.1.2', '4.5', 50.00, 'FC2');
select pg_temp.asiento('D', 'MD1', 'asentado', 'manual', '1.1.2.1', '4.5.1', 123.45);

-- ════ E: factura VES con asiento al nominal y CxP CNY con asiento: no comparable en las dos
-- cuentas; M2 toca la subcuenta de 2.1.5. ME2 tiene líneas en 1.1.2 y 1.1.2.1 y en 4.5 y 4.5.1,
-- y ME3 en 2.1.5 y 2.1.5.1: cada uno es UN asiento que toca la cuenta ════
select pg_temp.factura('E', 'FE1', 'emitida', 'VES', 3600.00, 0, '2026-07-03', 36);
select pg_temp.asiento('E', 'AFE1', 'asentado', 'invoice', '1.1.2', '4.5', 3600.00, 'FE1');
select pg_temp.cxp('E', 'BE1', 'pendiente', 'CNY', 718.00, 0, 7.18);
select pg_temp.asiento('E', 'ABE1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 100.00, 'BE1');
select pg_temp.vincula_cxp('BE1', 'ABE1');
select pg_temp.asiento('E', 'M2', 'asentado', 'manual', '1.1.2', '2.1.5.1', 1.60);
insert into public.journal_entries (id, tenant_id, entry_code, memo, status, source)
values (pg_temp.id('ME2'), pg_temp.t('E'), 'CENTINELA-A-ME2', 'CENTINELA-MEMO', 'asentado', 'manual'),
       (pg_temp.id('ME3'), pg_temp.t('E'), 'CENTINELA-A-ME3', 'CENTINELA-MEMO', 'asentado', 'manual');
insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo) values
  (pg_temp.id('ME2'), pg_temp.cta('E', '1.1.2'), 2.22, 0, 'CENTINELA-LINEA'),
  (pg_temp.id('ME2'), pg_temp.cta('E', '1.1.2.1'), 3.33, 0, 'CENTINELA-LINEA'),
  (pg_temp.id('ME2'), pg_temp.cta('E', '4.5'), 0, 2.22, 'CENTINELA-LINEA'),
  (pg_temp.id('ME2'), pg_temp.cta('E', '4.5.1'), 0, 3.33, 'CENTINELA-LINEA'),
  (pg_temp.id('ME3'), pg_temp.cta('E', '1.1.1.1'), 5.00, 0, 'CENTINELA-LINEA'),
  (pg_temp.id('ME3'), pg_temp.cta('E', '2.1.5'), 0, 2.00, 'CENTINELA-LINEA'),
  (pg_temp.id('ME3'), pg_temp.cta('E', '2.1.5.1'), 0, 3.00, 'CENTINELA-LINEA');

-- ════ F: sin movimiento ════

-- ════ G: la trampa de B2. Factura VES PAGADA, asentada al nominal, con su recibo convertido:
-- saldo abierto cero y aun así no comparable. En 2.1.1, CxP anuladas con asiento vivo (una en
-- CNY, que no la vuelve no comparable): el mayor queda por encima ════
select pg_temp.factura('G', 'FG1', 'pagada', 'VES', 3600.00, 3600.00, '2026-07-04', 36);
select pg_temp.asiento('G', 'AFG1', 'asentado', 'invoice', '1.1.2', '4.5', 3600.00, 'FG1');
select pg_temp.recibo('G', 'RG1', 'FG1', 3600.00, false, 'VES', 36);
select pg_temp.asiento('G', 'ARG1', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 100.00, 'RG1');
select pg_temp.vincula_recibo('RG1', 'ARG1');
select pg_temp.cxp('G', 'BG1', 'anulada', 'USD', 50.00, 0);
select pg_temp.cxp('G', 'BG2', 'anulada', 'CNY', 359.00, 0, 7.18);
select pg_temp.asiento('G', 'ABG1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 50.00, 'BG1');
select pg_temp.asiento('G', 'ABG2', 'asentado', 'supplier_bill', '5.1', '2.1.1', 50.00, 'BG2');
select pg_temp.vincula_cxp('BG1', 'ABG1');
select pg_temp.vincula_cxp('BG2', 'ABG2');

-- ════ H: factura VES SIN asiento junto a 1.1.2 con movimiento en dólares: cuadra, no es «no
-- comparable» (decisión 7); la VES queda fuera de la suma ════
select pg_temp.factura('H', 'FH1', 'emitida', 'USD', 200.00, 0, '2026-07-05');
select pg_temp.asiento('H', 'AFH1', 'asentado', 'invoice', '1.1.2', '4.5', 200.00, 'FH1');
select pg_temp.factura('H', 'FH2', 'emitida', 'VES', 3600.00, 0, '2026-07-05', 36);

-- ════ I: el mayor vacío gana (decisión 6). 1.1.2 y 2.1.1 sin movimiento con documentos
-- abiertos, aunque FI2, VES, tiene un asiento de venta vivo que la volvería no comparable: AFI2
-- quedó sin líneas, que es lo que deja invoice-posting.ts:173-177 si fallan las líneas y también
-- el borrado de compensación, cuyo error no se mira. El recibo VES identificado RI1, con su
-- asiento de cobro a 2.1.8 y sin reclasificación, no toca 1.1.2 ════
select pg_temp.factura('I', 'FI1', 'emitida', 'USD', 75.00, 0, '2026-07-06');
select pg_temp.factura('I', 'FI2', 'parcial', 'VES', 1440.00, 720.00, '2026-07-06', 36);
insert into public.journal_entries (id, tenant_id, entry_code, memo, status, source, invoice_id)
values (pg_temp.id('AFI2'), pg_temp.t('I'), 'CENTINELA-A-AFI2', 'CENTINELA-MEMO', 'asentado', 'invoice', pg_temp.id('FI2'));
select pg_temp.recibo('I', 'RI1', 'FI2', 720.00, false, 'VES', 36, true);
select pg_temp.asiento('I', 'ARI1', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 20.00, 'RI1');
select pg_temp.vincula_recibo('RI1', 'ARI1');
select pg_temp.cxp('I', 'BI1', 'pendiente', 'USD', 40.00, 0);

-- ════ J: documentos con DOS asientos vivos de su origen, unidos por lados distintos; una
-- factura VES ANULADA con asiento vivo la vuelve no comparable en 1.1.2 ════
select pg_temp.factura('J', 'FJ1', 'parcial', 'USD', 10.00, 4.00, '2026-07-07');
select pg_temp.asiento('J', 'AFJ1A', 'asentado', 'invoice', '1.1.2', '4.5', 10.00, 'FJ1');
select pg_temp.asiento('J', 'AFJ1B', 'asentado', 'invoice', '1.1.2', '4.5', 10.00, 'FJ1');
select pg_temp.factura('J', 'FJ2', 'anulada', 'VES', 360.00, 0, '2026-07-07', 36);
select pg_temp.asiento('J', 'AFJ2', 'asentado', 'invoice', '1.1.2', '4.5', 360.00, 'FJ2');
select pg_temp.recibo('J', 'RJ1', 'FJ1', 4.00);
select pg_temp.asiento('J', 'ARJ1A', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 4.00, 'RJ1');
select pg_temp.asiento('J', 'ARJ1B', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 4.00, 'RJ1');
select pg_temp.vincula_recibo('RJ1', 'ARJ1A');
select pg_temp.cxp('J', 'BJ1', 'parcial', 'USD', 30.00, 5.00);
select pg_temp.asiento('J', 'ABJ1A', 'asentado', 'supplier_bill', '5.1', '2.1.1', 30.00);
select pg_temp.asiento('J', 'ABJ1B', 'asentado', 'supplier_bill', '5.1', '2.1.1.1', 30.00, 'BJ1');
select pg_temp.vincula_cxp('BJ1', 'ABJ1A');
select pg_temp.pago('J', 'OPJ1', 'BJ1', 5.00);
select pg_temp.asiento('J', 'AOPJ1A', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 5.00);
select pg_temp.asiento('J', 'AOPJ1B', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 5.00, 'OPJ1');
select pg_temp.vincula_pago('OPJ1', 'AOPJ1A');

-- ════ K: dos recibos VES con asiento vivo contra 2.1.8, que no tocan 1.1.2: RK1, SIN referencia,
-- y RK2, identificado contra FK2 (VES pagada, sin asiento) y todavía sin reclasificar. Ninguno lo
-- vuelve no comparable, y K cuadra ════
select pg_temp.factura('K', 'FK1', 'emitida', 'USD', 100.00, 0, '2026-07-08');
select pg_temp.asiento('K', 'AFK1', 'asentado', 'invoice', '1.1.2', '4.5', 100.00, 'FK1');
select pg_temp.recibo('K', 'RK1', null, 360.00, false, 'VES', 36);
select pg_temp.asiento('K', 'ARK1', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 10.00, 'RK1');
select pg_temp.vincula_recibo('RK1', 'ARK1');
select pg_temp.factura('K', 'FK2', 'pagada', 'VES', 360.00, 360.00, '2026-07-08', 36);
select pg_temp.recibo('K', 'RK2', 'FK2', 360.00, false, 'VES', 36, true);
select pg_temp.asiento('K', 'ARK2', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 10.00, 'RK2');
select pg_temp.vincula_recibo('RK2', 'ARK2');

-- ════ L: solo proveedores. 1.1.2 sin movimiento y sin facturas (0 contra 0); 2.1.1 no
-- comparable SOLO por un pago VES con asiento vivo ════
select pg_temp.cxp('L', 'BL1', 'parcial', 'USD', 60.00, 10.00);
select pg_temp.asiento('L', 'ABL1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 60.00, 'BL1');
select pg_temp.vincula_cxp('BL1', 'ABL1');
select pg_temp.pago('L', 'OPL1', 'BL1', 360.00, false, 'VES', 36);
select pg_temp.asiento('L', 'AOPL1', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 10.00, 'OPL1');
select pg_temp.vincula_pago('OPL1', 'AOPL1');

-- ════ M: el límite de la decisión 6. Ningún asiento vivo y solo documentos SIN saldo abierto:
-- un borrador, una anulada sin asiento y una pagada con total = cobrado; una CxP anulada y otra
-- pagada. Es «sin movimiento en la cuenta» en 1.1.2 y en 2.1.1, no «sin movimiento en el mayor» ════
select pg_temp.factura('M', 'FM1', 'borrador', 'USD', 101.01, 0, null);
select pg_temp.factura('M', 'FM2', 'anulada', 'USD', 102.02, 0, '2026-07-09');
select pg_temp.factura('M', 'FM3', 'pagada', 'USD', 103.03, 103.03, '2026-07-09');
select pg_temp.cxp('M', 'BM1', 'anulada', 'USD', 104.04, 0);
select pg_temp.cxp('M', 'BM2', 'pagada', 'USD', 105.05, 105.05);

-- ════ N: no comparable SOLO por un recibo VES aplicado a su factura, con asiento vivo: el recibo
-- convierte y su factura VES no tiene asiento ════
select pg_temp.factura('N', 'FN1', 'parcial', 'VES', 720.00, 360.00, '2026-07-10', 36);
select pg_temp.recibo('N', 'RN1', 'FN1', 360.00, false, 'VES', 36);
select pg_temp.asiento('N', 'ARN1', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 10.00, 'RN1');
select pg_temp.vincula_recibo('RN1', 'ARN1');

-- ════ P: el mayor por encima por asientos que ningún documento explica. En 1.1.2, dos asientos de
-- venta vivos huérfanos: el de FP1, emitida y BORRADA, y uno sin invoice_id. En 2.1.1, la CxP
-- CNY ANULADA SIN TASA, cuyo asiento vivo quedó al nominal (bill-posting.ts asienta tal cual sin
-- tasa): es B1 y queda como diferencia, no como «no comparable» ════
select pg_temp.factura('P', 'FP1', 'emitida', 'USD', 107.07, 0, '2026-07-11', null, true);
select pg_temp.asiento('P', 'AFP1', 'asentado', 'invoice', '1.1.2', '4.5', 107.07, 'FP1');
select pg_temp.asiento('P', 'AFP2', 'asentado', 'invoice', '1.1.2', '4.5', 108.08);
select pg_temp.cxp('P', 'BP1', 'anulada', 'CNY', 359.59, 0);
select pg_temp.asiento('P', 'ABP1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 359.59, 'BP1');
select pg_temp.vincula_cxp('BP1', 'ABP1');

-- ════ S: un recibo VES ANULADO con su asiento de cobro vivo y un pago VES ANULADO con el suyo.
-- Son B1 (filas 42 y 45), no vuelven no comparable al tenant: 1.1.2 y 2.1.1 quedan por debajo.
-- FS2, VES sin asiento, queda fuera de la suma ════
select pg_temp.factura('S', 'FS1', 'emitida', 'USD', 109.09, 0, '2026-07-12');
select pg_temp.asiento('S', 'AFS1', 'asentado', 'invoice', '1.1.2', '4.5', 109.09, 'FS1');
select pg_temp.factura('S', 'FS2', 'emitida', 'VES', 360.00, 0, '2026-07-12', 36);
select pg_temp.recibo('S', 'RS1', 'FS2', 360.00, true, 'VES', 36);
select pg_temp.asiento('S', 'ARS1', 'asentado', 'receipt', '1.1.1.1', '1.1.2', 10.00, 'RS1');
select pg_temp.vincula_recibo('RS1', 'ARS1');
select pg_temp.cxp('S', 'BS1', 'pendiente', 'USD', 30.30, 0);
select pg_temp.asiento('S', 'ABS1', 'asentado', 'supplier_bill', '5.1', '2.1.1', 30.30, 'BS1');
select pg_temp.vincula_cxp('BS1', 'ABS1');
select pg_temp.pago('S', 'OPS1', 'BS1', 360.00, true, 'VES', 36);
select pg_temp.asiento('S', 'AOPS1', 'asentado', 'supplier_payment', '2.1.1', '1.1.1.1', 10.00, 'OPS1');
select pg_temp.vincula_pago('OPS1', 'AOPS1');

-- ════ T: no comparable SOLO por un recibo VES identificado Y reclasificado: su asiento de cobro
-- fue a 2.1.8 y la reclasificación ART1X lleva el monto convertido a 1.1.2. FT1, VES pagada, no
-- tiene asiento ════
select pg_temp.factura('T', 'FT1', 'pagada', 'VES', 360.00, 360.00, '2026-07-13', 36);
select pg_temp.recibo('T', 'RT1', 'FT1', 360.00, false, 'VES', 36, true);
select pg_temp.asiento('T', 'ART1', 'asentado', 'receipt', '1.1.1.1', '2.1.8', 10.00, 'RT1');
select pg_temp.asiento('T', 'ART1X', 'asentado', 'receipt_reclass', '2.1.8', '1.1.2', 10.00, 'RT1');
select pg_temp.vincula_recibo('RT1', 'ART1');
