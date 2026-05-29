-- ─────────────────────────────────────────────────────────────
-- SDD-0039 (Gastos CN) Fase 1b · scope + moneda dual + fx history
--
-- 1. expense_scope enum (shipment | external)
-- 2. expenses.scope + amount_usd + fx_rate
-- 3. backfill: rows sin shipment_id → external; USD → fx 1.0
-- 4. CHECK: scope=shipment requiere shipment_id
-- 5. index por scope para reportes
-- 6. tabla tenant_fx_history (memoria del tipo de cambio por tenant)
-- 7. RLS policy expenses_cn_team (equipo CN ve/crea expenses del tenant)
--
-- Decisión moneda dual: la contadora CN carga en CNY o USD; el sistema
-- normaliza a USD (amount_usd = amount / fx_rate) para reportes/margen.
-- El fx_rate queda guardado por expense para auditoría.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. enum scope ───────────────────────────────────────────
create type public.expense_scope as enum ('shipment', 'external');

comment on type public.expense_scope is
  'shipment=gasto atribuible a un contenedor/embarque · external=overhead de oficina/bodega CN.';

-- ─── 2. columnas nuevas ──────────────────────────────────────
alter table public.expenses
  add column scope public.expense_scope not null default 'shipment',
  add column amount_usd numeric not null default 0,
  add column fx_rate numeric not null default 1.0000;

comment on column public.expenses.amount_usd is
  'Monto normalizado a USD. Si currency=USD → = amount. Si CNY/VES → amount / fx_rate.';
comment on column public.expenses.fx_rate is
  'Tipo de cambio usado (moneda_origen/USD). 1.0 para USD. Guardado por gasto para auditoría.';

-- ─── 3. backfill ─────────────────────────────────────────────
-- rows sin shipment_id pasan a external ANTES del CHECK.
update public.expenses set scope = 'external' where shipment_id is null;
-- montos en USD: amount_usd = amount, fx = 1 (ya es el default, explícito por claridad).
update public.expenses set amount_usd = amount, fx_rate = 1.0000 where currency = 'USD';
-- montos en CNY/VES sin fx (legacy MVP): dejamos amount_usd = amount como aproximación
-- temporal; la contadora los corrige al editarlos. Son pocos (MVP).
update public.expenses
   set amount_usd = amount
 where currency <> 'USD' and amount_usd = 0;

-- ─── 4. integridad ───────────────────────────────────────────
alter table public.expenses add constraint expenses_scope_shipment_check
  check (scope = 'external' or shipment_id is not null);

-- ─── 5. index reportes por scope ─────────────────────────────
create index expenses_scope_idx
  on public.expenses (tenant_id, scope, occurred_at desc)
  where deleted_at is null;

-- ─── 6. tenant_fx_history ────────────────────────────────────
create table public.tenant_fx_history (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  currency_pair text not null,                 -- 'CNY/USD', 'VES/USD'
  rate          numeric not null check (rate > 0),
  set_at        timestamptz not null default now(),
  set_by        uuid references auth.users(id),
  expense_id    uuid references public.expenses(id) on delete set null
);

comment on table public.tenant_fx_history is
  'Historial de tipos de cambio cargados por tenant · prefill inteligente del fx en el drawer de gastos.';

create index tenant_fx_history_idx
  on public.tenant_fx_history (tenant_id, currency_pair, set_at desc);

alter table public.tenant_fx_history enable row level security;

create policy tenant_fx_history_rw on public.tenant_fx_history
  for all
  using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

grant select, insert on public.tenant_fx_history to authenticated;

-- ─── 7. RLS policy expenses_cn_team ──────────────────────────
-- El equipo CN (warehouse/operations/accounting/admin con region='cn')
-- puede ver/crear/editar expenses del tenant — necesario para que la
-- alerta de consolidación pueda ser atendida por cualquiera de ellos.
-- Complementa las policies owner-only de 0047.
create policy expenses_cn_team on public.expenses
  for all
  using (
    tenant_id in (
      select tenant_id from public.user_tenants
      where user_id = auth.uid()
        and region = 'cn'
        and role in ('warehouse', 'operations', 'accounting', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.user_tenants
      where user_id = auth.uid()
        and region = 'cn'
        and role in ('warehouse', 'operations', 'accounting', 'admin')
    )
  );

-- accounting/admin de VE también pueden ver/crear externals del tenant
-- (contabilidad VE consolida el overhead global).
create policy expenses_ve_accounting on public.expenses
  for all
  using (
    tenant_id in (
      select tenant_id from public.user_tenants
      where user_id = auth.uid()
        and region = 've'
        and role in ('accounting', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.user_tenants
      where user_id = auth.uid()
        and region = 've'
        and role in ('accounting', 'admin')
    )
  );
