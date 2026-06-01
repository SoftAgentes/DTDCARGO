-- ─────────────────────────────────────────────────────────────
-- SDD-0021: Facturación (Bloque 1.1 financiero)
-- Tabla invoices + enums invoice_status / invoice_currency +
-- next_invoice_code() + RLS por tenant + toggle tenants.iva_enabled.
-- Reusa get_user_tenant_id() y touch_updated_at() existentes.
--
-- NO incluye: asiento contable, ledger de pagos, capa fiscal SENIAT.
-- Esos quedan para SDDs de Contabilidad / Cobranzas / Fiscal.
-- SIN seed (las facturas son data operativa, no demo).
-- ─────────────────────────────────────────────────────────────

create type invoice_status   as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create type invoice_currency as enum ('USD', 'VES', 'USDT', 'CNY');

-- Toggle IVA/SENIAT a nivel tenant. Fuente de verdad del flag fiscal,
-- el front la lee al render. OFF por defecto (la mayoría de la operación
-- de DTD factura sin discriminar IVA todavía).
alter table public.tenants
  add column if not exists iva_enabled boolean not null default false;

comment on column public.tenants.iva_enabled is
  'SDD-0021: si true, las facturas discriminan base + IVA 16%. OFF por defecto.';

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  invoice_code    text not null,                          -- "F-2026-0001"
  client_markbox  text not null,                          -- lookup textual (blando, no FK)
  client_name     text not null,                          -- snapshot al momento
  shipment_id     uuid references public.shipments(id) on delete set null,
  shipment_code   text,                                   -- snapshot textual (DTDU-…)
  currency        invoice_currency not null default 'USD',
  fx_rate         numeric(14,4),                          -- BCV si VES / para asiento fiscal
  iva_rate        numeric(5,2)  not null default 0,       -- snapshot (16.00 si IVA ON, 0 si OFF)
  base_amount     numeric(14,2) not null,                 -- suma de líneas (qty*unitPrice)
  iva_amount      numeric(14,2) not null default 0,
  total_amount    numeric(14,2) not null,                 -- base + iva
  status          invoice_status not null default 'borrador',
  issued_at       date,
  due_date        date,
  paid_amount     numeric(14,2) not null default 0,       -- acumulador (no ledger todavía)
  last_payment_at timestamptz,
  lines           jsonb not null default '[]',            -- [{ desc, qty, unitPrice }]
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (tenant_id, invoice_code)
);

comment on table public.invoices is
  'SDD-0021: facturas operativas. State machine borrador → emitida → parcial/pagada · vencida (visual) · anulada. paid_amount es acumulador (el ledger de pagos es Cobranzas, Bloque 2). Soft delete via deleted_at. RLS por tenant_id.';

create index invoices_tenant_status_idx
  on public.invoices (tenant_id, status) where deleted_at is null;

create index invoices_tenant_client_idx
  on public.invoices (tenant_id, client_markbox) where deleted_at is null;

-- next_invoice_code: formato F-YYYY-NNNN, counter por año + tenant.
-- Si pasa de 9999 en un año el padding se extiende automáticamente.
-- Mismo patrón que next_quote_code (SDD-0011).
create or replace function public.next_invoice_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(invoice_code, '^F-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.invoices
  where tenant_id = p_tenant_id
    and invoice_code like 'F-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'F-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_invoice_code is
  'SDD-0021: genera el próximo invoice_code F-YYYY-NNNN para el tenant del año actual.';

-- Permite a authenticated agregar 'invoice' al audit log genérico
-- (entity_audit_log.entity_type CHECK · ver 0066/0072). Las acciones
-- sensibles (emit, pago, anular) escriben ahí con actor_type='user'
-- via service_role (createAdminClient).
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
      'invoice'
    ));
end $$;

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF)
grant select, insert, update, delete on public.invoices to authenticated;
grant execute on function public.next_invoice_code(uuid) to authenticated;

-- RLS por tenant
alter table public.invoices enable row level security;

create policy "invoices by tenant"
  on public.invoices for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
create trigger invoices_touch
  before update on public.invoices
  for each row execute function public.touch_updated_at();
