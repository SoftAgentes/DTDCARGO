-- ─────────────────────────────────────────────────────────────
-- SDD-0059 · Financiero con el Socio Logístico China — Slice A (foundation)
--
-- Cierra la mitad "China / proveedor" del ERP: el libro mayor bilateral
-- (USD + RMB) con el Socio Logístico China + el modelo de cargos /
-- notas de crédito / conversión de divisa / cruce contable que hoy se
-- lleva a mano en Excel. Se monta SOBRE Tesorería (0088) y Contabilidad
-- (0078); NO los duplica. 5 tablas nuevas:
--   partner_ledger_entries · cuenta corriente bilateral (USD+RMB, saldo
--                            neto corriente se DERIVA en lib, no se persiste)
--   supplier_charges       · cada línea de cargo del socio (estado
--                            vigente/disputado/corregido/cancelado;
--                            net_amount se DERIVA en lib — un generated
--                            column no puede sumar de otra tabla)
--   supplier_credit_notes  · correcciones vinculadas (FK restrict al cargo)
--   currency_conversions   · conversión de divisa con tasa por operación
--                            (base del spread forex = revenue)
--   supplier_claim_offsets · cruce contable reclamo→proveedor→china→cliente
--
-- + ALTER supplier_bills ADD bill_kind ('pp'|'ca'|'full') default 'full'
--   (back-compat; las bills viejas quedan 'full'). shipment_id YA existe (0088).
-- + RPC next_partner_ledger_code (PLE-YYYY-NNNN), patrón next_bill_code (0088).
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0096/0100).
-- + Validación de integridad cross-tenant en la DB (lección 0045/0093):
--   helpers supplier_in_tenant() / container_in_tenant() + triggers
--   BEFORE INSERT OR UPDATE → un cliente PostgREST directo no puede colgar
--   un cargo/entry de un supplier o container de OTRO tenant / inexistente.
-- + Altas de plan de cuentas (§5): Cuenta corriente Socio China (pasivo,
--   familia Proveedores 2.1.x), Ingresos por cambio de moneda (revenue 4.x),
--   Costo de mercancía pagada a fábrica por cuenta de cliente (CGS 5.x).
--
-- Aditiva: reusa get_user_tenant_id() (0001), touch_updated_at() (0002),
-- accounts/journal_entries (0078), suppliers/supplier_bills (0088),
-- containers→consolidations (0096) — la FK de contenedor apunta a
-- public.consolidations (el `Container` del blueprint, SDD-0047).
-- enum invoice_currency (0077) NO se reusa: el ledger usa monedas propias
-- (USD/USDT/RMB/VES) como text con CHECK (RMB no está en invoice_currency).
--
-- NO incluye: partner_statements / partner_statement_lines / motor de
-- reconciliación / ninguna UI / alertas PP-CA / export QuickBooks → Slice B/C.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0114 (SDD-0059 Slice A, al integrar a main desde brochure).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 0. ALTER supplier_bills · bill_kind (PP/CA/full)          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 'pp' (订金 depósito) / 'ca' (余额 balance) / 'full' (CxP normal). Las bills
-- existentes quedan 'full' por el DEFAULT (back-compat, no rompe filas).
-- La obligatoriedad de shipment_id cuando bill_kind in ('pp','ca') es
-- VALIDACIÓN EN LIB (no NOT NULL → rompería filas viejas). shipment_id ya
-- existe en supplier_bills desde 0088 (no se agrega).
alter table public.supplier_bills
  add column if not exists bill_kind text not null default 'full';

do $$
begin
  alter table public.supplier_bills drop constraint if exists supplier_bills_bill_kind_check;
  alter table public.supplier_bills
    add constraint supplier_bills_bill_kind_check
    check (bill_kind in ('pp', 'ca', 'full'));
end $$;

comment on column public.supplier_bills.bill_kind is
  'SDD-0059: tipo de CxP — pp (订金 depósito) / ca (余额 balance) / full (CxP normal). Default full = back-compat. La obligatoriedad de shipment_id en pp/ca se valida en lib, no por constraint.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. SUPPLIER_CHARGES · cargos facturados por el socio      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila = una línea de cargo del estado de cuenta del socio. net_amount
-- NO es columna (un generated column no puede sumar de otra tabla) → se
-- deriva en charges-queries.ts = amount − Σ supplier_credit_notes aplicadas.
-- container_id → public.consolidations (el `Container` del blueprint, 0096),
-- nullable. statement_line_id queda nullable y SIN FK (la tabla
-- partner_statement_lines es de Slice B) — solo el espacio para enganchar.
create table public.supplier_charges (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  supplier_id        uuid not null references public.suppliers(id) on delete restrict,
  container_id       uuid references public.consolidations(id) on delete set null,
  description        text not null,
  description_cn     text,
  amount             numeric(14,2) not null,
  currency           text not null default 'USD',         -- USD/USDT/RMB/VES
  fx_rate            numeric(14,4),                        -- <currency>/USD del cargo
  charged_on         date not null default current_date,
  status             text not null default 'vigente',      -- vigente/disputado/corregido/cancelado
  reconciled         boolean not null default false,
  statement_line_id  uuid,                                 -- FK diferida a Slice B (sin constraint)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint supplier_charges_currency_check
    check (currency in ('USD', 'USDT', 'RMB', 'VES')),
  constraint supplier_charges_status_check
    check (status in ('vigente', 'disputado', 'corregido', 'cancelado'))
);

comment on table public.supplier_charges is
  'SDD-0059: cargos facturados por el Socio China (una fila × línea del estado de cuenta). net_amount se DERIVA en lib (amount − Σ notas de crédito). status vigente→disputado→corregido/cancelado. Soft delete via deleted_at. RLS por tenant_id.';

create index supplier_charges_tenant_supplier_idx
  on public.supplier_charges (tenant_id, supplier_id) where deleted_at is null;

create index supplier_charges_tenant_status_idx
  on public.supplier_charges (tenant_id, status) where deleted_at is null;

create index supplier_charges_container_idx
  on public.supplier_charges (container_id) where container_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. SUPPLIER_CREDIT_NOTES · correcciones vinculadas        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cada nota de crédito corrige un cargo (charge_id, on delete restrict — no
-- se borra un cargo con notas vivas). amount es lo que la nota descuenta.
-- document_id → documents (0097), nullable (adjunto del PDF de la nota).
create table public.supplier_credit_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  charge_id   uuid not null references public.supplier_charges(id) on delete restrict,
  reason      text not null,
  amount      numeric(14,2) not null,
  currency    text not null default 'USD',                -- USD/USDT/RMB/VES
  fx_rate     numeric(14,4),
  issued_on   date not null default current_date,
  document_id uuid references public.documents(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint supplier_credit_notes_currency_check
    check (currency in ('USD', 'USDT', 'RMB', 'VES'))
);

comment on table public.supplier_credit_notes is
  'SDD-0059: notas de crédito que corrigen un cargo del socio (charge_id restrict). amount descuenta del bruto → net_amount del cargo se recalcula en lib. document_id = adjunto del PDF (0097). Soft delete via deleted_at. RLS por tenant_id.';

create index supplier_credit_notes_charge_idx
  on public.supplier_credit_notes (charge_id) where deleted_at is null;

create index supplier_credit_notes_tenant_idx
  on public.supplier_credit_notes (tenant_id) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. CURRENCY_CONVERSIONS · conversión de divisa + spread   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cliente entrega USD/USDT/VES en destino → DTD paga fábrica en RMB/USD vía
-- línea de crédito del socio. effective_rate = la tasa real de la operación;
-- market_rate = referencia. spread_pct y commission_amount se COMPUTAN en lib
-- (se persisten para auditoría histórica; no son generated). El 5% por cambio
-- de moneda es REVENUE (cuenta 4.x del plan, ver §5 / posting.ts).
create table public.currency_conversions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  from_currency     text not null,                        -- USD/USDT/VES
  to_currency       text not null,                        -- RMB/USD
  from_amount       numeric(14,2) not null,
  to_amount         numeric(14,2) not null,
  effective_rate    numeric(18,6) not null,               -- to/from de la operación
  market_rate       numeric(18,6),                        -- referencia (nullable)
  spread_pct        numeric(8,4),                         -- computado en lib
  commission_amount numeric(14,2) not null default 0,     -- revenue captado
  shipment_id       uuid references public.shipments(id) on delete set null,
  client_id         uuid references public.clients(id) on delete set null,
  converted_on      date not null default current_date,
  journal_entry_id  uuid references public.journal_entries(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint currency_conversions_from_check
    check (from_currency in ('USD', 'USDT', 'VES')),
  constraint currency_conversions_to_check
    check (to_currency in ('RMB', 'USD'))
);

comment on table public.currency_conversions is
  'SDD-0059: conversión de divisa con tasa por operación (base del spread forex). effective_rate vs market_rate → spread_pct + commission_amount (computados en lib, persistidos para auditoría). El spread es REVENUE (cuenta 4.x). Soft delete via deleted_at. RLS por tenant_id.';

create index currency_conversions_tenant_idx
  on public.currency_conversions (tenant_id, converted_on) where deleted_at is null;

create index currency_conversions_shipment_idx
  on public.currency_conversions (shipment_id) where shipment_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. PARTNER_LEDGER_ENTRIES · cuenta corriente bilateral    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- entry_code PLE-YYYY-NNNN (RPC next_partner_ledger_code). direction
-- debe/haber; amount_usd + amount_rmb dual (saldo neto USD y RMB se DERIVA
-- en ledger-queries.ts, NO se persiste → evita drift). container_id →
-- consolidations (0096) nullable, charge_id → supplier_charges nullable.
create table public.partner_ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  supplier_id      uuid not null references public.suppliers(id) on delete restrict,
  entry_code       text not null,                         -- "PLE-2026-0001"
  entry_type       text not null,                         -- ver CHECK abajo
  direction        text not null,                         -- debe/haber
  amount_usd       numeric(14,2) not null default 0,
  amount_rmb       numeric(14,2) not null default 0,
  fx_rate          numeric(18,6),                         -- USD/RMB del movimiento
  currency_paid    text not null default 'USD',           -- USD/USDT/RMB/VES
  container_id     uuid references public.consolidations(id) on delete set null,
  shipment_id      uuid references public.shipments(id) on delete set null,
  charge_id        uuid references public.supplier_charges(id) on delete set null,
  occurred_on      date not null default current_date,
  description      text,
  description_cn   text,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, entry_code),
  constraint ple_direction_check
    check (direction in ('debe', 'haber')),
  constraint ple_currency_paid_check
    check (currency_paid in ('USD', 'USDT', 'RMB', 'VES')),
  constraint ple_entry_type_check
    check (entry_type in (
      'costo_contenedor',
      'pago_fabrica_pp',
      'pago_fabrica_ca',
      'conversion_divisa',
      'bl_courier',
      'inspeccion_qc',
      'registro_marca',
      'hospitalidad',
      'pago_aliado',
      'nota_credito',
      'ajuste',
      'otro'
    ))
);

comment on table public.partner_ledger_entries is
  'SDD-0059: cuenta corriente bilateral con el Socio China (PLE-YYYY-NNNN). Dual USD+RMB; el saldo neto corriente (USD y RMB) se DERIVA en lib (no se persiste, evita drift). direction debe/haber. Soft delete via deleted_at. RLS por tenant_id.';

create index ple_tenant_supplier_idx
  on public.partner_ledger_entries (tenant_id, supplier_id) where deleted_at is null;

create index ple_tenant_occurred_idx
  on public.partner_ledger_entries (tenant_id, occurred_on) where deleted_at is null;

create index ple_container_idx
  on public.partner_ledger_entries (container_id) where container_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. SUPPLIER_CLAIM_OFFSETS · cruce contable                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Máquina de estados del cruce reclamo→proveedor→china→cliente.
-- reclamado → reconocido_proveedor → pagado_en_china → aplicado_a_cliente →
-- cerrado. client_invoice_id = dónde se aplicó el descuento (FK invoices).
create table public.supplier_claim_offsets (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  shipment_id          uuid references public.shipments(id) on delete set null,
  client_id            uuid references public.clients(id) on delete set null,
  supplier_id          uuid references public.suppliers(id) on delete set null,
  amount_usd           numeric(14,2) not null,
  claimed_on           date not null default current_date,
  recognized_on        date,
  received_in_china_on date,
  applied_to_client_on date,
  evidence_document_id uuid references public.documents(id) on delete set null,
  status               text not null default 'reclamado',
  client_invoice_id    uuid references public.invoices(id) on delete set null,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint claim_offset_status_check
    check (status in (
      'reclamado',
      'reconocido_proveedor',
      'pagado_en_china',
      'aplicado_a_cliente',
      'cerrado'
    ))
);

comment on table public.supplier_claim_offsets is
  'SDD-0059: cruce contable reclamo→proveedor→china→cliente (máquina de estados). El asiento neutraliza margen (devolución de valor ya cobrado, NO pérdida). client_invoice_id = dónde se aplicó el descuento. Soft delete via deleted_at. RLS por tenant_id.';

create index claim_offset_tenant_status_idx
  on public.supplier_claim_offsets (tenant_id, status) where deleted_at is null;

create index claim_offset_shipment_idx
  on public.supplier_claim_offsets (shipment_id) where shipment_id is not null;

create index claim_offset_client_idx
  on public.supplier_claim_offsets (client_id) where client_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. VALIDACIÓN cross-tenant en DB (lección 0045 / 0093)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helpers SECURITY DEFINER: ¿el supplier / container existe y es del tenant?
-- (null → true; el FK opcional se respeta). El filtro por tenant_id es
-- explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó = tenant del
-- caller) → no hay fuga cross-tenant. Cubre PostgREST directo, no sólo la
-- server action (Slice B/C).

create or replace function public.supplier_in_tenant(
  p_supplier uuid,
  p_tenant   uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_supplier is null then
    return true;
  end if;
  return exists (
    select 1 from public.suppliers
    where id = p_supplier and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

create or replace function public.container_in_tenant(
  p_container uuid,
  p_tenant    uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_container is null then
    return true;
  end if;
  return exists (
    select 1 from public.consolidations
    where id = p_container and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

-- Trigger genérico para tablas con supplier_id (+ container_id opcional).
-- Cada tabla declara qué columnas tiene; el trigger sólo valida las que
-- existan en NEW (vía to_jsonb para no fallar si la columna no está).
create or replace function public.partner_finance_validate_refs()
returns trigger
language plpgsql
as $$
declare
  v_row        jsonb := to_jsonb(new);
  v_supplier   uuid;
  v_container  uuid;
begin
  if v_row ? 'supplier_id' then
    v_supplier := (v_row->>'supplier_id')::uuid;
    if not public.supplier_in_tenant(v_supplier, new.tenant_id) then
      raise exception 'proveedor inexistente o ajeno al tenant: %', v_supplier
        using errcode = 'check_violation';
    end if;
  end if;

  if v_row ? 'container_id' then
    v_container := (v_row->>'container_id')::uuid;
    if not public.container_in_tenant(v_container, new.tenant_id) then
      raise exception 'contenedor inexistente o ajeno al tenant: %', v_container
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_charges_validate_refs_trg on public.supplier_charges;
create trigger supplier_charges_validate_refs_trg
  before insert or update on public.supplier_charges
  for each row execute function public.partner_finance_validate_refs();

drop trigger if exists ple_validate_refs_trg on public.partner_ledger_entries;
create trigger ple_validate_refs_trg
  before insert or update on public.partner_ledger_entries
  for each row execute function public.partner_finance_validate_refs();

drop trigger if exists claim_offset_validate_refs_trg on public.supplier_claim_offsets;
create trigger claim_offset_validate_refs_trg
  before insert or update on public.supplier_claim_offsets
  for each row execute function public.partner_finance_validate_refs();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RPC next_partner_ledger_code (PLE-YYYY-NNNN)           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- counter por año + tenant (patrón next_bill_code de 0088). Qualifier
-- public. explícito por search_path (lección migración 0031).
create or replace function public.next_partner_ledger_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(entry_code, '^PLE-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.partner_ledger_entries
  where tenant_id = p_tenant_id
    and entry_code like 'PLE-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'PLE-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_partner_ledger_code is
  'SDD-0059: genera el próximo entry_code PLE-YYYY-NNNN para el tenant del año actual.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7b. journal_entries · FKs de origen del dominio (aditivo) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El asiento del cargo/conversión/cruce referencia su origen igual que el de
-- la CxP usa bill_id (0088). Nullable → null para los asientos previos. Los
-- valores de `source` ('supplier_charge'/'currency_conversion'/
-- 'supplier_claim_offset') son texto libre (no enum) → no tocan ningún CHECK.
-- Los índices soportan la idempotencia (no duplicar asiento por origen).
alter table public.journal_entries
  add column if not exists charge_id uuid references public.supplier_charges(id) on delete set null;

alter table public.journal_entries
  add column if not exists conversion_id uuid references public.currency_conversions(id) on delete set null;

alter table public.journal_entries
  add column if not exists claim_offset_id uuid references public.supplier_claim_offsets(id) on delete set null;

create index if not exists je_charge_idx
  on public.journal_entries (charge_id) where charge_id is not null;

create index if not exists je_conversion_idx
  on public.journal_entries (conversion_id) where conversion_id is not null;

create index if not exists je_claim_offset_idx
  on public.journal_entries (claim_offset_id) where claim_offset_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.supplier_charges        to authenticated;
grant select, insert, update, delete on public.supplier_credit_notes   to authenticated;
grant select, insert, update, delete on public.currency_conversions    to authenticated;
grant select, insert, update, delete on public.partner_ledger_entries  to authenticated;
grant select, insert, update, delete on public.supplier_claim_offsets  to authenticated;

grant all on public.supplier_charges        to service_role;
grant all on public.supplier_credit_notes   to service_role;
grant all on public.currency_conversions    to service_role;
grant all on public.partner_ledger_entries  to service_role;
grant all on public.supplier_claim_offsets  to service_role;

grant execute on function public.next_partner_ledger_code(uuid) to authenticated;
grant execute on function public.supplier_in_tenant(uuid, uuid)  to authenticated;
grant execute on function public.container_in_tenant(uuid, uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9. RLS · fail-closed por tenant_id (patrón 0096/0100)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.supplier_charges       enable row level security;
alter table public.supplier_credit_notes  enable row level security;
alter table public.currency_conversions   enable row level security;
alter table public.partner_ledger_entries enable row level security;
alter table public.supplier_claim_offsets enable row level security;

-- supplier_charges
create policy "supplier_charges by tenant"
  on public.supplier_charges for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "supplier_charges service_role all"
  on public.supplier_charges for all to service_role using (true) with check (true);

-- supplier_credit_notes
create policy "supplier_credit_notes by tenant"
  on public.supplier_credit_notes for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "supplier_credit_notes service_role all"
  on public.supplier_credit_notes for all to service_role using (true) with check (true);

-- currency_conversions
create policy "currency_conversions by tenant"
  on public.currency_conversions for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "currency_conversions service_role all"
  on public.currency_conversions for all to service_role using (true) with check (true);

-- partner_ledger_entries
create policy "partner_ledger_entries by tenant"
  on public.partner_ledger_entries for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "partner_ledger_entries service_role all"
  on public.partner_ledger_entries for all to service_role using (true) with check (true);

-- supplier_claim_offsets
create policy "supplier_claim_offsets by tenant"
  on public.supplier_claim_offsets for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "supplier_claim_offsets service_role all"
  on public.supplier_claim_offsets for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 10. TRIGGERS updated_at (reusa touch_updated_at de 0002)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Sólo las tablas con updated_at (charges). Las demás son append-only +
-- soft delete (sin updated_at, espejo de supplier_payments en 0088).
create trigger supplier_charges_touch
  before update on public.supplier_charges
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 11. PLAN DE CUENTAS · altas §5 (seed idempotente)         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tenant-scoped al tenant dtd (patrón 0078). Idempotente (on conflict
-- (tenant_id, code) do nothing). parent_id se resuelve por prefijo del code.
--   2.1.7  Cuenta corriente Socio Logístico China  (pasivo, familia Proveedores)
--   4.6    Ingresos por cambio de moneda            (revenue del spread forex)
--   5.10   Costo de mercancía pagada a fábrica…     (CGS, contra-cuenta del cruce)
insert into public.accounts (tenant_id, code, name, type, is_postable, qbo_type)
select t.id, x.code, x.name, x.type::acct_type, x.is_postable, x.qbo_type
from public.tenants t
cross join (values
  ('2.1.7', 'Cuenta corriente Socio Logístico China',                   'P',   true, 'Accounts payable (A/P)'),
  ('4.6',   'Ingresos por cambio de moneda',                            'I',   true, 'Income'),
  ('5.10',  'Costo de mercancía pagada a fábrica (por cuenta cliente)', 'CGS', true, 'Cost of Goods Sold')
) as x(code, name, type, is_postable, qbo_type)
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

-- Resolver parent_id por prefijo del code (parent = code sin el último
-- segmento) para las 3 cuentas recién insertadas del tenant dtd.
update public.accounts child
set parent_id = parent.id
from public.accounts parent, public.tenants t
where t.slug = 'dtd'
  and child.tenant_id = t.id
  and parent.tenant_id = t.id
  and child.parent_id is null
  and child.code in ('2.1.7', '4.6', '5.10')
  and parent.code = left(child.code, length(child.code) - position('.' in reverse(child.code)));

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0114_financiero_china.sql
-- Aplicar con: supabase migration apply 0114 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
