-- ─────────────────────────────────────────────────────────────
-- SDD-0105 · Activos fijos + depreciación lineal (sub-pestaña de Contabilidad)
--
-- Cierra el hueco #3 del Norte (parte 2): registrar los bienes de uso (flota,
-- equipos, mobiliario) y su depreciación lineal, con su asiento mensual.
--
--   fixed_assets             — bienes de uso (costo, residual, vida útil)
--   fixed_asset_depreciation — depreciación posteada por mes (registro +
--                              idempotencia del posteo mensual)
--
-- Cruza con el plan de cuentas sembrado en 0078:
--   asset_account_id     → 1.2.x   (flota / equipos / mobiliario)
--   accum_dep_account_id → 1.2.9   (depreciación acumulada de flota, contra)
--   expense_account_id   → 6.17    (depreciación de flota y equipos, gasto)
--
-- El asiento mensual de depreciación (DR 6.17 / CR 1.2.9 = cuota) lo crea la
-- capa app (depreciation-posting.ts, espejo de expense-posting.ts) con admin
-- client, idempotente por (asset, period): la idempotencia vive en el índice
-- único (asset_id, period) + la guard app-side. La integridad cross-tenant del
-- vínculo entry_id la fuerza un trigger (sección 6, hardening A1) que reusa el
-- helper security-definer public.journal_entry_in_tenant() creado en 0167.
--
-- journal_entries NO necesita columna nueva: el vínculo asiento↔activo vive en
-- fixed_asset_depreciation.entry_id. Los asientos de depreciación, al ser
-- journal_entries, quedan protegidos por el trigger de cierre de período (0133)
-- sin trabajo extra.
--
-- Estados como text + check (NO enums nuevos). updated_at reusa la función
-- existente public.touch_updated_at() (0002).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. fixed_assets — bienes de uso                           ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.fixed_assets (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  name                 text not null,
  -- Cuenta del activo (1.2.x). on delete restrict: no se borra una cuenta con
  -- activos registrados.
  asset_account_id     uuid not null references public.accounts(id) on delete restrict,
  -- Depreciación acumulada (contra, default app 1.2.9). Nullable: si no se elige,
  -- la capa app resuelve la cuenta por code al postear.
  accum_dep_account_id uuid references public.accounts(id) on delete restrict,
  -- Gasto de depreciación (default app 6.17). Nullable, igual que arriba.
  expense_account_id   uuid references public.accounts(id) on delete restrict,
  cost                 numeric(14,2) not null check (cost >= 0),
  salvage_value        numeric(14,2) not null default 0 check (salvage_value >= 0),
  acquired_on          date not null,
  useful_life_months   integer not null check (useful_life_months > 0),
  method               text not null default 'linea_recta'
                       check (method in ('linea_recta')),
  status               text not null default 'activo'
                       check (status in ('activo', 'baja', 'depreciado')),
  disposed_on          date,                                  -- fecha de baja
  notes                text,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- El valor residual no puede superar el costo (cuota nunca negativa).
  constraint fixed_assets_salvage_lte_cost check (salvage_value <= cost)
);

comment on table public.fixed_assets is
  'SDD-0105: bienes de uso (flota/equipos/mobiliario). asset_account_id=1.2.x, accum_dep_account_id=1.2.9 (default app), expense_account_id=6.17 (default app). Depreciación lineal V1: cuota = (cost-salvage)/useful_life_months. status activo→baja|depreciado (text+check). RLS por tenant_id.';

create index fixed_assets_tenant_idx        on public.fixed_assets (tenant_id);
create index fixed_assets_asset_account_idx on public.fixed_assets (asset_account_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. fixed_asset_depreciation — depreciación posteada/mes   ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.fixed_asset_depreciation (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.fixed_assets(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  period     text not null,                                   -- "YYYY-MM" del mes depreciado
  amount     numeric(14,2) not null check (amount > 0),
  -- Asiento DR 6.17 / CR 1.2.9 de esta depreciación. on delete set null: si el
  -- asiento se anula/borra, queda el registro pero sin asiento ligado.
  entry_id   uuid references public.journal_entries(id) on delete set null,
  posted_at  timestamptz not null default now(),
  posted_by  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Idempotencia del posteo mensual: a lo sumo 1 registro por (activo, mes).
  -- Se inserta PRIMERO (cerrojo) antes de crear el asiento; un re-corrido del
  -- mismo mes choca con este unique y se salta (no duplica el asiento).
  unique (asset_id, period)
);

comment on table public.fixed_asset_depreciation is
  'SDD-0105: depreciación posteada por mes. unique(asset_id, period) = idempotencia del posteo mensual (se inserta como cerrojo antes del asiento). entry_id = asiento DR 6.17 / CR 1.2.9. RLS por tenant_id.';

create index fad_tenant_idx on public.fixed_asset_depreciation (tenant_id);
create index fad_asset_idx  on public.fixed_asset_depreciation (asset_id);
create index fad_entry_idx  on public.fixed_asset_depreciation (entry_id)
  where entry_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. GRANTS explícitos (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝

grant select, insert, update, delete on public.fixed_assets             to authenticated;
grant select, insert, update, delete on public.fixed_asset_depreciation to authenticated;
grant all on public.fixed_assets             to service_role;
grant all on public.fixed_asset_depreciation to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS por tenant                                         ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.fixed_assets             enable row level security;
alter table public.fixed_asset_depreciation enable row level security;

create policy "fixed_assets by tenant"
  on public.fixed_assets for all
  to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "service_role_all_fixed_assets"
  on public.fixed_assets for all
  to service_role using (true) with check (true);

create policy "fixed_asset_depreciation by tenant"
  on public.fixed_asset_depreciation for all
  to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "service_role_all_fixed_asset_depreciation"
  on public.fixed_asset_depreciation for all
  to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Trigger updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- fixed_asset_depreciation es append-only (sin updated_at) → no necesita trigger.

create trigger fixed_assets_touch
  before update on public.fixed_assets
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Integridad cross-tenant del vínculo (hardening A1)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Espejo del guard de 0167 para fixed_asset_depreciation.entry_id: la RLS valida
-- el tenant de la propia fila, pero no que entry_id apunte a un asiento del mismo
-- tenant. Un PATCH directo vía PostgREST (saltándose el posteo server-side) no
-- puede ligar la depreciación a un asiento ajeno. Reusa el helper
-- public.journal_entry_in_tenant(uuid,uuid) creado en 0167 (se aplica ANTES que
-- 0168, así que la función ya existe).
create or replace function public.fixed_asset_depreciation_validate_entry()
returns trigger
language plpgsql
as $$
begin
  if new.entry_id is not null
     and not public.journal_entry_in_tenant(new.entry_id, new.tenant_id) then
    raise exception
      'depreciación ligada a un asiento inexistente o de otro tenant: %', new.entry_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.fixed_asset_depreciation_validate_entry() from public, anon;

drop trigger if exists fixed_asset_depreciation_validate_entry_trg on public.fixed_asset_depreciation;
create trigger fixed_asset_depreciation_validate_entry_trg
  before insert or update on public.fixed_asset_depreciation
  for each row execute function public.fixed_asset_depreciation_validate_entry();

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0168_fixed_assets.sql
-- Aplicar (coordinación, NO en esta ventana): supabase migration apply 0168
-- ─────────────────────────────────────────────────────────────
