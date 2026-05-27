-- ─────────────────────────────────────────────────────────────
-- SDD Expenses · gastos rápidos del Mobile ERP
--
-- Captura de gastos operativos en viaje (China/VE) + gastos de oficina.
-- Cada gasto pertenece a un user (auth.uid) dentro de un tenant.
-- Opcional: vinculación a embarque + flag "cobrable al cliente".
--
-- Schema MVP · sin foto (storage bucket en fase futura).
-- ─────────────────────────────────────────────────────────────

create type public.expense_currency as enum ('USD', 'VES', 'CNY');

create type public.expense_category as enum (
  'taxi', 'comida', 'hotel', 'vuelo', 'peaje',
  'combustible', 'aduana', 'cliente', 'otro'
);

create type public.expense_method as enum (
  'cash', 'card', 'transfer', 'usdt'
);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  expense_code    text not null,                    -- 'EXP-2026-0001'
  amount          numeric not null check (amount > 0),
  currency        expense_currency not null default 'USD',
  category        expense_category not null,
  method          expense_method not null default 'cash',
  shipment_id     uuid references public.shipments(id) on delete set null,
  note            text,
  location        text,                              -- texto libre ej 'Yiwu, CN'
  billable        boolean not null default false,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (tenant_id, expense_code)
);

comment on table public.expenses is
  'Gastos rápidos operativos · cada user del tenant carga los suyos via Mobile ERP. Opcional vínculo a shipment + flag cobrable.';

create index expenses_user_idx
  on public.expenses (tenant_id, user_id, occurred_at desc)
  where deleted_at is null;

create index expenses_shipment_idx
  on public.expenses (shipment_id)
  where shipment_id is not null;

create index expenses_billable_idx
  on public.expenses (tenant_id, billable, occurred_at desc)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- RPC · next_expense_code (secuencial por tenant + año)
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_expense_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(expense_code from 'EXP-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.expenses
  where tenant_id = p_tenant_id
    and expense_code like 'EXP-' || v_year || '-%';

  v_next := 'EXP-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_expense_code(uuid) is
  'Genera el próximo código EXP-YYYY-NNNN secuencial para el tenant.';

grant execute on function public.next_expense_code(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS · owner-only · tenant_id check
-- ─────────────────────────────────────────────────────────────

alter table public.expenses enable row level security;

-- SELECT: ver mis propios gastos (todos en el tenant)
create policy expenses_select on public.expenses
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.user_tenants
        where user_id = auth.uid()
          and tenant_id = expenses.tenant_id
          and role = 'admin'
      )
    )
  );

-- INSERT: solo crear gastos propios
create policy expenses_insert on public.expenses
  for insert with check (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- UPDATE: solo modificar mis propios gastos
create policy expenses_update on public.expenses
  for update using (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- DELETE bloqueado · soft-delete via update deleted_at

-- ─────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update on public.expenses to authenticated;
