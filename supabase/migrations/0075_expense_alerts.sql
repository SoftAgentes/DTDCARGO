-- ─────────────────────────────────────────────────────────────
-- SDD-0039 Parte B.8 · Alerta automática "consolidado → cargar gastos"
-- para el equipo CN.
--
-- Modelo A (confirmado por el founder): al consolidar una recepción, el
-- sistema crea (o reusa) un shipment "contenedor" agrupado por destino, y
-- la alerta cuelga de ese shipment. Gastos + (futuro) BL se asocian al
-- shipment_id.
--
-- Auto-cierre: lo maneja la server action (al cargar el 1er gasto
-- scope=shipment) — NO hay triggers de BD (patrón del proyecto: hooks en
-- server actions, ver lib/studio/mail/). Cierre manual + cierre por
-- reversión (la recepción sale de 'consolidado') también vía action.
-- ─────────────────────────────────────────────────────────────

-- 1. Razón de resolución de la alerta
create type public.expense_alert_resolution as enum (
  'manual',    -- la contadora/admin la cerró explícitamente
  'auto',      -- se cargó >=1 gasto del contenedor → cierre automático
  'reverted'   -- la recepción salió de 'consolidado' → se invalida
);

-- 2. Tabla de alertas (1 fila activa por shipment)
create table public.expense_alerts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  shipment_id       uuid not null references public.shipments(id) on delete cascade,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,                       -- null = activa
  resolved_by       uuid references auth.users(id),    -- null si auto/reverted
  resolution_reason public.expense_alert_resolution
);

comment on table public.expense_alerts is
  'SDD-0039 · Alerta "cargar gastos del contenedor consolidado" para el equipo CN. 1 activa por shipment.';

-- 1 sola alerta activa por shipment → idempotencia del hook de consolidación
create unique index expense_alerts_one_active_per_shipment
  on public.expense_alerts (shipment_id)
  where resolved_at is null;

create index expense_alerts_active_idx
  on public.expense_alerts (tenant_id, resolved_at)
  where resolved_at is null;

-- 3. RLS · equipo CN (warehouse/operations/accounting/admin) + accounting/admin
--    de cualquier región ven y gestionan alertas de su tenant.
alter table public.expense_alerts enable row level security;

create policy expense_alerts_rw on public.expense_alerts
  for all
  using (
    tenant_id in (
      select ut.tenant_id from public.user_tenants ut
      where ut.user_id = auth.uid()
        and (
          (ut.region = 'cn' and ut.role in ('warehouse','operations','accounting','admin'))
          or ut.role in ('accounting','admin')
        )
    )
  )
  with check (
    tenant_id in (
      select ut.tenant_id from public.user_tenants ut
      where ut.user_id = auth.uid()
        and (
          (ut.region = 'cn' and ut.role in ('warehouse','operations','accounting','admin'))
          or ut.role in ('accounting','admin')
        )
    )
  );

grant select, insert, update on public.expense_alerts to authenticated;

-- 4. Code del shipment "contenedor consolidado": C-YYYY-NNNN por tenant/año.
--    Mismo patrón que next_receipt_code (0008). search_path=public OK
--    (no usa funciones de schema extensions).
create or replace function public.next_consolidation_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max  int;
begin
  select coalesce(max((regexp_match(code, '^C-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.shipments
  where tenant_id = p_tenant_id
    and code like 'C-' || v_year || '-%';
  return 'C-' || v_year || '-' || lpad(v_max::text, 4, '0');
end;
$$;

comment on function public.next_consolidation_code is
  'SDD-0039 · Próximo code C-YYYY-NNNN para un shipment contenedor de consolidación CN.';

grant execute on function public.next_consolidation_code(uuid) to authenticated;
