-- ─────────────────────────────────────────────────────────────
-- SDD-0111 · Scorecard de proveedores (señales + rating A/B/C/D) + reclamo al proveedor
--
-- Mide el desempeño de los proveedores chinos (suppliers_cn, 0105) con
-- señales reales y deriva un rating A/B/C/D AUDITABLE (nunca una columna que
-- se teclea a mano). Decisiones del founder aplicadas:
--   · §6.4 → scorecard POR FICHA de proveedor (la fila suppliers_cn, scope
--            unique tenant_id+client_markbox+supplier_seq). NO se consolida
--            por identidad del proveedor (no hay maestro).
--   · §6.5 → VISTA EN VIVO (supplier_scorecard_v) como fuente de verdad,
--            NO tabla snapshot. Siempre fresca, sin cron.
--   · §6.7/6.8 → pesos y umbrales del Norte tal cual (on-time 40% · calidad
--            40% · rechazo 20%; A≥90 B≥82 C≥72 D<72).
--   · §6.10 → amount_usd del reclamo es ADVISORY (no genera asiento).
--   · §6.2/6.3 → default optimista: on_time/conforming arrancan true; el
--            operador de COMPRAS los baja al capturar la señal. expected_at/
--            received_at quedan opcionales para auditar (no se tocan 0124).
--
-- Frontera de "reclamos": supplier_claims (este SDD) ≠ client_claims (0102,
-- lado cliente) ≠ supplier_claim_offsets (0059, cruce contable). Es una señal
-- OPERATIVA negativa de desempeño sobre suppliers_cn.
--
-- Aditiva: NO toca tablas existentes. RLS fail-closed por tenant_id + helpers
-- *_in_tenant() + trigger same-tenant para los FK cruzados + GRANTS explícitos
-- (auto-expose OFF) + FK indexes. Reusa get_user_tenant_id() (0001),
-- assert_tenant_match() (0012), touch_updated_at() (0002).
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 0. Helpers same-tenant (defensa en DB, patrón 0102/0114)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ¿La ficha de proveedor pertenece al tenant? NULL-safe: null → true
-- (el trigger deja pasar; la NOT NULL de la columna es la que exige valor).
create or replace function public.supplier_cn_in_tenant(
  p_supplier_cn uuid,
  p_tenant      uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_supplier_cn is null then
    return true;
  end if;
  return exists (
    select 1 from public.suppliers_cn
    where id = p_supplier_cn and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

comment on function public.supplier_cn_in_tenant is
  'SDD-0111: ¿la ficha suppliers_cn pertenece al tenant? NULL-safe (null → true). Para el trigger same-tenant de las señales/reclamos.';

-- ¿La OC pertenece al tenant? NULL-safe (purchase_order_id es opcional).
create or replace function public.purchase_order_in_tenant(
  p_purchase_order uuid,
  p_tenant         uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_purchase_order is null then
    return true;
  end if;
  return exists (
    select 1 from public.purchase_orders
    where id = p_purchase_order and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

comment on function public.purchase_order_in_tenant is
  'SDD-0111: ¿la purchase_order pertenece al tenant? NULL-safe (null → true).';

revoke execute on function public.supplier_cn_in_tenant(uuid, uuid)   from public, anon;
revoke execute on function public.purchase_order_in_tenant(uuid, uuid) from public, anon;
grant execute on function public.supplier_cn_in_tenant(uuid, uuid)   to authenticated, service_role;
grant execute on function public.purchase_order_in_tenant(uuid, uuid) to authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. supplier_order_signals · señal por orden recibida (A)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila por OC recibida (o señal manual), capturando los booleanos atómicos
-- que alimentan los porcentajes. NO se guarda el % — se deriva en la VIEW.
create table public.supplier_order_signals (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  supplier_cn_id     uuid not null references public.suppliers_cn(id) on delete cascade,   -- ficha evaluada
  purchase_order_id  uuid references public.purchase_orders(id) on delete set null,        -- OC origen (nullable: señal manual)
  client_markbox     text,                                    -- Shipping Mark (interno; ayuda al filtro)
  on_time            boolean not null default true,           -- ¿llegó dentro del plazo prometido?
  conforming         boolean not null default true,           -- ¿conforme a lo pedido (sin reclamo)?
  expected_at        date,                                    -- fecha prometida (auditar on_time)
  received_at        date,                                    -- fecha real de recepción
  notes              text,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.supplier_order_signals is
  'SDD-0111: señal de desempeño por orden recibida (camino A). on_time/conforming = booleanos atómicos que la VIEW supplier_scorecard_v agrega a % (no se guarda el %). 1 señal por OC (índice único parcial). RLS por tenant.';

-- 1 señal por OC (parcial: solo cuando hay OC — las señales manuales sin OC no chocan).
create unique index supplier_order_signals_po_uidx
  on public.supplier_order_signals (tenant_id, purchase_order_id)
  where purchase_order_id is not null;

-- FK indexes (patrón 0013: Postgres no auto-indexea FK columns).
create index supplier_order_signals_tenant_idx
  on public.supplier_order_signals (tenant_id);
create index supplier_order_signals_supplier_idx
  on public.supplier_order_signals (tenant_id, supplier_cn_id);
create index supplier_order_signals_po_fk_idx
  on public.supplier_order_signals (purchase_order_id)
  where purchase_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Enums + supplier_claims · reclamo al proveedor (C)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Enums propios (kind mapea a las categorías del Norte: Daño/Faltante/Calidad).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'supplier_claim_kind') then
    create type public.supplier_claim_kind as enum ('dano', 'faltante', 'calidad', 'retraso', 'otro');
  end if;
  if not exists (select 1 from pg_type where typname = 'supplier_claim_status') then
    create type public.supplier_claim_status as enum ('abierto', 'en_revision', 'resuelto', 'rechazado');
  end if;
end $$;

create table public.supplier_claims (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  claim_code          text not null,                                              -- "RP-2026-NNN"
  supplier_cn_id      uuid not null references public.suppliers_cn(id) on delete cascade,   -- proveedor reclamado
  purchase_order_id   uuid references public.purchase_orders(id) on delete set null,        -- OC afectada (nullable)
  client_markbox      text,                                                       -- Shipping Mark afectado (interno)
  kind                public.supplier_claim_kind not null,
  status              public.supplier_claim_status not null default 'abierto',
  amount_usd          numeric(14,2) not null default 0,                           -- monto expuesto (advisory)
  description         text not null,
  offset_id           uuid,                                                       -- FK SUAVE futura → supplier_claim_offsets (0059); sin constraint
  resolved_at         timestamptz,                                                -- hito terminal (sellado por trigger)
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, claim_code)
);

comment on table public.supplier_claims is
  'SDD-0111: reclamo OPERATIVO al proveedor chino (daño/faltante/calidad/retraso). Señal negativa de desempeño sobre suppliers_cn — NO es client_claims (0102) ni supplier_claim_offsets (0059). offset_id = FK suave sin constraint hasta el puente a 0059 (Fase futura). Soft delete. RLS por tenant.';
comment on column public.supplier_claims.amount_usd is
  'SDD-0111: monto expuesto en USD (advisory, no genera asiento en V1). numeric(14,2) → llega a TS como string, coercer con Number().';
comment on column public.supplier_claims.offset_id is
  'SDD-0111: FK FUTURA a supplier_claim_offsets (0059) cuando el reclamo recupera plata. Sin constraint (Fase C diferida).';

create index supplier_claims_tenant_status_idx
  on public.supplier_claims (tenant_id, status)
  where deleted_at is null;
create index supplier_claims_supplier_idx
  on public.supplier_claims (tenant_id, supplier_cn_id)
  where deleted_at is null;
create index supplier_claims_po_fk_idx
  on public.supplier_claims (purchase_order_id)
  where deleted_at is null and purchase_order_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RPC next_supplier_claim_code · RP-YYYY-NNN            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- "RP" = Reclamo a Proveedor. NO colisiona con RC- (0102) ni OC- (0124).
-- Patrón next_claim_code (0102): assert_tenant_match + MAX(num)+1 por año,
-- padding 3. El unique (tenant_id, claim_code) protege contra carreras.
create or replace function public.next_supplier_claim_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_max  int;
begin
  perform public.assert_tenant_match(p_tenant_id);

  select coalesce(max((regexp_match(claim_code, '^RP-' || v_year || '-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.supplier_claims
   where tenant_id = p_tenant_id;

  return 'RP-' || v_year || '-' || lpad(v_max::text, 3, '0');
end;
$$;

comment on function public.next_supplier_claim_code is
  'SDD-0111: próximo código de reclamo al proveedor RP-YYYY-NNN para el tenant (assert_tenant_match). MAX(num)+1 por año, padding 3. Solo cuenta RP-.';

revoke all on function public.next_supplier_claim_code(uuid) from public;
revoke all on function public.next_supplier_claim_code(uuid) from anon;
grant execute on function public.next_supplier_claim_code(uuid) to authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Triggers same-tenant + sellado de hitos               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Señal: supplier_cn_id + purchase_order_id deben ser del mismo tenant.
create or replace function public.supplier_order_signals_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.supplier_cn_in_tenant(new.supplier_cn_id, new.tenant_id) then
    raise exception 'supplier_cn_id % no pertenece al tenant %', new.supplier_cn_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  if not public.purchase_order_in_tenant(new.purchase_order_id, new.tenant_id) then
    raise exception 'purchase_order_id % no pertenece al tenant %', new.purchase_order_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.supplier_order_signals_check() from public, anon;

drop trigger if exists supplier_order_signals_check_trg on public.supplier_order_signals;
create trigger supplier_order_signals_check_trg
  before insert or update on public.supplier_order_signals
  for each row execute function public.supplier_order_signals_check();

create trigger supplier_order_signals_touch
  before update on public.supplier_order_signals
  for each row execute function public.touch_updated_at();

-- Reclamo: mismo control same-tenant + sella resolved_at en estados terminales.
create or replace function public.supplier_claims_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.supplier_cn_in_tenant(new.supplier_cn_id, new.tenant_id) then
    raise exception 'supplier_cn_id % no pertenece al tenant %', new.supplier_cn_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  if not public.purchase_order_in_tenant(new.purchase_order_id, new.tenant_id) then
    raise exception 'purchase_order_id % no pertenece al tenant %', new.purchase_order_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  -- Sellado idempotente del hito terminal (resuelto | rechazado).
  if new.status in ('resuelto', 'rechazado') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  -- Si vuelve a un estado no terminal, se limpia el hito.
  if new.status in ('abierto', 'en_revision') then
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.supplier_claims_check() from public, anon;

drop trigger if exists supplier_claims_check_trg on public.supplier_claims;
create trigger supplier_claims_check_trg
  before insert or update on public.supplier_claims
  for each row execute function public.supplier_claims_check();

create trigger supplier_claims_touch
  before update on public.supplier_claims
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS explícitos (auto-expose new tables OFF)        ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.supplier_order_signals to authenticated;
grant select, insert, update, delete on public.supplier_claims        to authenticated;
grant all on public.supplier_order_signals to service_role;
grant all on public.supplier_claims        to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS · fail-closed por tenant_id                       ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.supplier_order_signals enable row level security;
alter table public.supplier_claims        enable row level security;

create policy "supplier_order_signals by tenant"
  on public.supplier_order_signals for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "supplier_order_signals service_role all"
  on public.supplier_order_signals for all to service_role using (true) with check (true);

create policy "supplier_claims by tenant"
  on public.supplier_claims for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "supplier_claims service_role all"
  on public.supplier_claims for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. VIEW supplier_scorecard_v · rating derivado por ficha ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Fuente de verdad del rating (§6.5: VIEW, no snapshot). UNA fila por ficha
-- suppliers_cn viva del tenant (incluso sin señales → grade NULL "Sin datos").
-- security_invoker = on → la RLS de las tablas base aplica al usuario que
-- consulta (Postgres 15+). Fórmula ESPEJO EXACTO de computeScore/computeGrade
-- en lib/studio/proveedores/scorecard-types.ts — si divergen es un bug.
create or replace view public.supplier_scorecard_v
with (security_invoker = on) as
with sig as (
  select
    supplier_cn_id,
    tenant_id,
    count(*)                                   as orders_count,
    count(*) filter (where on_time)            as on_time_count,
    count(*) filter (where conforming)         as conforming_count
  from public.supplier_order_signals
  group by supplier_cn_id, tenant_id
),
cl as (
  select
    supplier_cn_id,
    tenant_id,
    count(*)                                                                   as claims_count,
    count(*) filter (where status in ('abierto', 'en_revision'))              as open_claims_count
  from public.supplier_claims
  where deleted_at is null
  group by supplier_cn_id, tenant_id
),
base as (
  select
    s.id                                as supplier_cn_id,
    s.tenant_id,
    s.client_markbox,
    s.supplier_seq,
    s.name,
    s.city,
    s.industry,
    coalesce(sig.orders_count, 0)       as orders_count,
    coalesce(sig.on_time_count, 0)      as on_time_count,
    coalesce(sig.conforming_count, 0)   as conforming_count,
    coalesce(cl.claims_count, 0)        as claims_count,
    coalesce(cl.open_claims_count, 0)   as open_claims_count
  from public.suppliers_cn s
  left join sig on sig.supplier_cn_id = s.id and sig.tenant_id = s.tenant_id
  left join cl  on cl.supplier_cn_id  = s.id and cl.tenant_id  = s.tenant_id
  where s.deleted_at is null
),
pct as (
  select
    b.*,
    case when b.orders_count > 0 then round(100.0 * b.on_time_count   / b.orders_count, 2) end as on_time_pct,
    case when b.orders_count > 0 then round(100.0 * b.conforming_count / b.orders_count, 2) end as quality_pct,
    case when b.orders_count > 0 then round(100.0 * b.claims_count     / b.orders_count, 2) end as defect_pct
  from base b
),
-- Score calculado UNA sola vez (evita que score y grade diverjan si se edita
-- la fórmula en un solo sitio). El grade se DERIVA de este score.
scored as (
  select
    p.*,
    case
      when p.orders_count > 0 then
        round(
          coalesce(p.on_time_pct, 0) * 0.40
        + coalesce(p.quality_pct, 0) * 0.40
        + greatest(0, 100 - coalesce(p.defect_pct, 0) * 6) * 0.20
        )::int
    end as score
  from pct p
)
select
  sc.*,
  case
    when sc.score is null then null   -- orders_count = 0 → "Sin datos"
    when sc.score >= 90 then 'A'
    when sc.score >= 82 then 'B'
    when sc.score >= 72 then 'C'
    else 'D'
  end as grade
from scored sc;

comment on view public.supplier_scorecard_v is
  'SDD-0111: rating derivado por FICHA de proveedor (§6.4). score/grade A/B/C/D calculados EN VIVO desde supplier_order_signals + supplier_claims (§6.5, sin snapshot). Fórmula espejo de computeScore/computeGrade (scorecard-types.ts). grade NULL cuando orders_count=0 ("Sin datos"). security_invoker → RLS por tenant.';

-- La VIEW hereda permisos; damos SELECT explícito (auto-expose OFF).
grant select on public.supplier_scorecard_v to authenticated, service_role;
