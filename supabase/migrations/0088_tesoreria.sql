-- ─────────────────────────────────────────────────────────────
-- SDD-0044: Tesorería (Bloque 2.2 financiero) — el espejo de Cobranzas.
--
-- Donde 0079 (Cobranzas) cerró el ciclo del COBRO (factura → recibo →
-- caja → DR Caja / CR Clientes 1.1.2), acá se cierra el del PAGO:
--   suppliers (proveedor-lite, PRV-NNNN)
--   supplier_bills (CxP, CXP-YYYY-NNNN) + asiento de CAUSACIÓN
--     DR expense_account (costo/gasto) / CR 2.1.1 Cuentas por pagar
--   supplier_payments (órdenes de pago, OP-YYYY-NNNN) + asiento del PAGO
--     DR 2.1.1 / CR cash_account (caja/banco)
--
-- Multi-moneda USD/VES/USDT/CNY (reusa enum invoice_currency de 0077);
-- el asiento se hace en USD funcional vía fx_rate. SIN aprobación
-- multi-firma (Fase 2), SIN forecast de caja, SIN conciliación.
--
-- Reusa get_user_tenant_id() (0001), touch_updated_at() (0002),
-- accounts/journal_entries (0078), enum invoice_currency (0077).
-- SIN seed (proveedores/CxP/pagos son data operativa, no demo).
--
-- ⚠️ Correlativo: la spec 0044 mencionaba 0087, pero 0087_portal_approval
--    ya ocupa ese número. Esta migración es 0088 (siguiente libre).
-- ─────────────────────────────────────────────────────────────

-- ── Proveedores (supplier-lite) ────────────────────────────────
-- Entidad mínima para atar la CxP a un payee real y agrupar "cuánto le
-- debo a X" + las remesas a China. NO es el módulo de proveedores
-- completo (Bloque 5). `type` cubre los tipos de beneficiario del mockup
-- sin entidades separadas. supplier_code PRV-NNNN (sin año, patrón markbox).
create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  supplier_code    text not null,                          -- "PRV-0001"
  name             text not null,
  name_cn          text,                                   -- 唛 / nombre del proveedor chino
  type             text not null default 'proveedor_cn',   -- proveedor_cn/naviera/agente_aduanal/servicio/otro
  country          text not null default 'CN',             -- CN/VE/otro
  default_currency invoice_currency not null default 'USD',
  payment_channel  text,                                   -- "USDT", "Alipay", "transferencia BS", etc.
  contact_name     text,
  contact_phone    text,
  contact_email    text,
  tax_id           text,                                   -- RIF / registro mercantil
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, supplier_code)
);

comment on table public.suppliers is
  'SDD-0044: proveedor-lite (PRV-NNNN). type cubre proveedor_cn/naviera/agente_aduanal/servicio/otro. Lo justo para atar la CxP a un payee y agrupar deuda + remesas a China. Soft delete via deleted_at. RLS por tenant_id.';

create index suppliers_tenant_type_idx
  on public.suppliers (tenant_id, type) where deleted_at is null;

-- ── Cuentas por pagar (CxP) ────────────────────────────────────
-- bill_code CXP-YYYY-NNNN. expense_account_id = la cuenta de costo/gasto
-- que se debita en la causación. currency en la moneda de la factura del
-- proveedor; el asiento se hace en USD funcional (vía fx_rate). El "stage"
-- de la cola se DERIVA por query (no es columna): vencida/por_vencer/
-- parcial/pagada. journal_entry_id = asiento de causación (source='supplier_bill').
create table public.supplier_bills (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  bill_code          text not null,                        -- "CXP-2026-0001"
  supplier_id        uuid not null references public.suppliers(id) on delete restrict,
  supplier_name      text not null,                        -- snapshot al momento
  concept            text,
  expense_account_id uuid not null references public.accounts(id),  -- DR en la causación
  currency           invoice_currency not null default 'USD',
  fx_rate            numeric(14,4),
  total_amount       numeric(14,2) not null,
  paid_amount        numeric(14,2) not null default 0,
  status             text not null default 'pendiente',    -- pendiente/parcial/pagada/anulada
  issue_date         date not null default current_date,
  due_date           date not null,
  reference          text,                                 -- nº de proforma / factura del proveedor
  shipment_id        uuid references public.shipments(id) on delete set null,  -- costing futuro
  journal_entry_id   uuid references public.journal_entries(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, bill_code)
);

comment on table public.supplier_bills is
  'SDD-0044: cuentas por pagar (CXP-YYYY-NNNN). Asiento de causación DR expense_account_id / CR 2.1.1. La cola CxP se deriva por query (total_amount-paid_amount>0, status≠anulada). paid_amount lo sube cada supplier_payment. Soft delete via deleted_at. RLS por tenant_id.';

create index sb_tenant_supplier_idx
  on public.supplier_bills (tenant_id, supplier_id) where deleted_at is null;

create index sb_tenant_status_idx
  on public.supplier_bills (tenant_id, status) where deleted_at is null;

-- ── Órdenes de pago ────────────────────────────────────────────
-- payment_code OP-YYYY-NNNN. Una orden por CxP en el MVP (bill_id requerido).
-- amount en su moneda; el asiento del pago se hace en USD funcional.
-- cash_account_id = la cuenta de caja/banco (postable) que paga (CR del asiento).
-- journal_entry_id = asiento del pago (source='supplier_payment').
create table public.supplier_payments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  payment_code     text not null,                          -- "OP-2026-0001"
  bill_id          uuid not null references public.supplier_bills(id) on delete restrict,
  supplier_id      uuid not null references public.suppliers(id),
  supplier_name    text not null,                          -- snapshot al momento
  amount           numeric(14,2) not null,                 -- en la moneda de la orden
  currency         invoice_currency not null default 'USD',
  fx_rate          numeric(14,4),
  method           text not null default 'transferencia', -- transferencia/efectivo/zelle/usdt/alipay/remesa_china/otro
  cash_account_id  uuid not null references public.accounts(id),    -- CR en el pago
  reference        text,
  paid_at          date not null default current_date,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,                            -- anulación (auditable, no se borra)
  unique (tenant_id, payment_code)
);

comment on table public.supplier_payments is
  'SDD-0044: órdenes de pago a proveedores (OP-YYYY-NNNN). Una orden por CxP (bill_id, on delete restrict). amount en la moneda de la orden; asiento del pago (DR 2.1.1 / CR cash_account_id) en USD funcional. Anular = deleted_at (revierte saldo + asiento). RLS por tenant_id.';

create index sp_tenant_bill_idx
  on public.supplier_payments (tenant_id, bill_id) where deleted_at is null;

create index sp_tenant_supplier_idx
  on public.supplier_payments (tenant_id, supplier_id) where deleted_at is null;

-- ── journal_entries: + bill_id / supplier_payment_id (aditivo) ──
-- El asiento de causación (source='supplier_bill') referencia su CxP igual
-- que el de factura usa invoice_id; el del pago (source='supplier_payment')
-- referencia su orden igual que el del cobro usa receipt_id. Columnas
-- nullable → null para los asientos previos. 'supplier_bill'/'supplier_payment'
-- son valores más de `source` (texto libre, no enum) → no toca ningún CHECK.
-- Los índices soportan la idempotencia (no duplicar asiento por origen).
alter table public.journal_entries
  add column if not exists bill_id uuid references public.supplier_bills(id) on delete set null;

alter table public.journal_entries
  add column if not exists supplier_payment_id uuid references public.supplier_payments(id) on delete set null;

create index if not exists je_bill_idx
  on public.journal_entries (bill_id) where bill_id is not null;

create index if not exists je_supplier_payment_idx
  on public.journal_entries (supplier_payment_id) where supplier_payment_id is not null;

-- ── next_supplier_code: PRV-NNNN, counter por tenant (sin año) ──
-- Mismo patrón que next_markbox (0006). Padding 4 dígitos; se extiende
-- automáticamente si pasa de 9999.
create or replace function public.next_supplier_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(supplier_code, '^PRV-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.suppliers
  where tenant_id = p_tenant_id;

  v_padded := lpad(v_max::text, 4, '0');
  return 'PRV-' || v_padded;
end;
$$;

comment on function public.next_supplier_code is
  'SDD-0044: genera el próximo supplier_code PRV-NNNN para el tenant. MAX(num)+1 padding 4.';

-- ── next_bill_code: CXP-YYYY-NNNN, counter por año + tenant ─────
-- Mismo patrón que next_invoice_code (0077) / next_receipt_code (0079).
create or replace function public.next_bill_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(bill_code, '^CXP-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.supplier_bills
  where tenant_id = p_tenant_id
    and bill_code like 'CXP-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'CXP-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_bill_code is
  'SDD-0044: genera el próximo bill_code CXP-YYYY-NNNN para el tenant del año actual.';

-- ── next_payment_order_code: OP-YYYY-NNNN, counter por año + tenant ──
create or replace function public.next_payment_order_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(payment_code, '^OP-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.supplier_payments
  where tenant_id = p_tenant_id
    and payment_code like 'OP-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'OP-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_payment_order_code is
  'SDD-0044: genera el próximo payment_code OP-YYYY-NNNN para el tenant del año actual.';

-- ── entity_audit_log: + supplier / supplier_bill / supplier_payment ──
-- Acciones sensibles (alta proveedor, crear/anular CxP, registrar/anular
-- pago) escriben en el audit genérico con actor_type='user' via service_role.
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
      'payment_receipt',
      'supplier',
      'supplier_bill',
      'supplier_payment'
    ));
end $$;

-- ── GRANTS EXPLÍCITOS (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.suppliers          to authenticated;
grant select, insert, update, delete on public.supplier_bills     to authenticated;
grant select, insert, update, delete on public.supplier_payments  to authenticated;
grant execute on function public.next_supplier_code(uuid)         to authenticated;
grant execute on function public.next_bill_code(uuid)             to authenticated;
grant execute on function public.next_payment_order_code(uuid)    to authenticated;

-- ── RLS por tenant ────────────────────────────────────────────
alter table public.suppliers         enable row level security;
alter table public.supplier_bills    enable row level security;
alter table public.supplier_payments enable row level security;

create policy "suppliers by tenant"
  on public.suppliers for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "supplier_bills by tenant"
  on public.supplier_bills for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "supplier_payments by tenant"
  on public.supplier_payments for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ── Triggers updated_at (suppliers + supplier_bills) ──────────
-- supplier_payments NO tiene updated_at (espejo de payment_receipts).
create trigger suppliers_touch
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

create trigger supplier_bills_touch
  before update on public.supplier_bills
  for each row execute function public.touch_updated_at();
