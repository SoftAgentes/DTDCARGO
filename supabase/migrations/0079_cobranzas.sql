-- ─────────────────────────────────────────────────────────────
-- SDD-0041: Cobranzas (Bloque 2.1 financiero)
-- Ledger de recibos de pago (payment_receipts) + gestión de
-- cobranza liviana (collection_activities) + next_receipt_code()
-- R-YYYY-NNNN + RLS por tenant + grants. Cierra el gap que
-- SDD-0021 dejó (paid_amount era un acumulador sin historial) y el
-- asiento del cobro que SDD-0040 difirió (DR Banco/Caja / CR
-- Clientes 1.1.2).
--
-- Reusa get_user_tenant_id() (0001). La cola de CxC NO es una tabla:
-- se deriva de invoices con saldo (total_amount - paid_amount > 0).
--
-- NO incluye: Tesorería (CxP/remesas/multi-firma/caja como módulo),
-- conciliación bancaria, conversión multi-moneda con motor de cambio,
-- recordatorios automáticos, pago multi-factura. Esos quedan para
-- SDDs futuros. SIN seed (los recibos son data operativa, no demo).
-- ─────────────────────────────────────────────────────────────

-- ── Recibos de pago (ledger del cobro) ─────────────────────────
-- Un recibo por cobro sobre UNA factura (no multi-factura en el MVP).
-- amount está en la moneda de la factura (currency); el asiento se
-- hace en USD funcional (si la moneda no es USD, el equivalente se
-- deriva con fx_rate). cash_account_id es la cuenta de caja/banco
-- (postable) que recibió el dinero — la usa el asiento como DR.
create table public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  receipt_code     text not null,                          -- "R-2026-0001"
  invoice_id       uuid not null references public.invoices(id) on delete restrict,
  client_markbox   text not null,                          -- snapshot al momento
  client_name      text not null,                          -- snapshot al momento
  amount           numeric(14,2) not null,                 -- en la moneda de la factura
  currency         invoice_currency not null default 'USD',
  fx_rate          numeric(14,4),                          -- si no es USD, para derivar el equivalente
  method           text not null default 'transferencia', -- efectivo/transferencia/zelle/pago_movil/usdt/otro
  cash_account_id  uuid not null references public.accounts(id),
  reference        text,                                   -- nro de transferencia / captura / nota
  received_at      date not null default current_date,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,                            -- anulación del recibo (auditable, no se borra)
  unique (tenant_id, receipt_code)
);

comment on table public.payment_receipts is
  'SDD-0041: ledger de recibos de pago. Un recibo por cobro sobre una factura (invoice_id, on delete restrict). amount en la moneda de la factura; el asiento del cobro (DR cash_account_id / CR 1.1.2) se hace en USD funcional. Anular = deleted_at (auditable). RLS por tenant_id.';

create index pr_tenant_invoice_idx
  on public.payment_receipts (tenant_id, invoice_id) where deleted_at is null;

-- ── Gestión de cobranza (log liviano) ──────────────────────────
-- contacto / promesa / nota / recordatorio. El "stage" de la cola se
-- deriva (no es una máquina de estados persistida): vencido si
-- due_date<today, promesa si hay una activity kind='promesa' vigente.
create table public.collection_activities (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  kind            text not null,                           -- contacto/promesa/nota/recordatorio
  promised_amount numeric(14,2),
  promised_date   date,
  next_followup   date,
  body            text,
  created_at      timestamptz not null default now(),
  created_by      uuid
);

comment on table public.collection_activities is
  'SDD-0041: bitácora de gestión de cobranza (contacto/promesa/nota/recordatorio). El stage de la cola CxC se deriva de acá + del saldo/vencimiento de la factura, no se persiste como estado. RLS por tenant_id.';

create index ca_tenant_invoice_idx
  on public.collection_activities (tenant_id, invoice_id);

-- ── journal_entries: + receipt_id (asiento del cobro) ──────────
-- El asiento automático del cobro (source='receipt') referencia su recibo.
-- Aditivo: la columna es nullable y queda null para los asientos previos.
-- 'receipt' es un valor más de `source` (texto libre, no enum) → no hace
-- falta tocar ningún CHECK. El índice soporta la idempotencia (no duplicar
-- asiento por recibo) — mismo patrón que je_invoice_idx (0078).
alter table public.journal_entries
  add column if not exists receipt_id uuid references public.payment_receipts(id) on delete set null;

create index if not exists je_receipt_idx
  on public.journal_entries (receipt_id) where receipt_id is not null;

-- ── next_receipt_code: R-YYYY-NNNN, counter por año + tenant ───
-- Mismo patrón que next_invoice_code (0077) / next_entry_code (0078).
-- Si pasa de 9999 en un año el padding se extiende automáticamente.
create or replace function public.next_receipt_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(receipt_code, '^R-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.payment_receipts
  where tenant_id = p_tenant_id
    and receipt_code like 'R-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'R-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_receipt_code is
  'SDD-0041: genera el próximo receipt_code R-YYYY-NNNN para el tenant del año actual.';

-- ── entity_audit_log: + 'payment_receipt' (aditivo) ────────────
-- Acciones sensibles (registrar cobro, anular recibo) escriben en el
-- audit genérico con actor_type='user' via service_role.
do $$
begin
  alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
  alter table public.entity_audit_log
    add constraint entity_audit_log_entity_type_check
    check (entity_type in (
      'shipment',
      'dispatch_order',
      'dispatch_order_package',
      'warehouse_receipt_cn',
      'warehouse_receipt_ve',
      'invoice',
      'journal_entry',
      'account',
      'payment_receipt'
    ));
end $$;

-- ── GRANTS EXPLÍCITOS (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.payment_receipts      to authenticated;
grant select, insert, update, delete on public.collection_activities to authenticated;
grant execute on function public.next_receipt_code(uuid)             to authenticated;

-- ── RLS por tenant ────────────────────────────────────────────
alter table public.payment_receipts      enable row level security;
alter table public.collection_activities enable row level security;

create policy "payment_receipts by tenant"
  on public.payment_receipts for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "collection_activities by tenant"
  on public.collection_activities for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
