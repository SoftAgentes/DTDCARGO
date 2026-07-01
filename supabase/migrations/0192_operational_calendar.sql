-- ─────────────────────────────────────────────────────────────
-- 0192 · SDD-0127 · Feriados & ferias — calendario operativo CN/VE
--   operational_calendar
--
-- Sección "Feriados CN/VE" de /studio/admin, ampliada a FERIAS comerciales
-- (Cantón/Yiwu): ambos son eventos de calendario que afectan la disponibilidad
-- de fábricas en China y los lead times / SLAs de despacho. Los usa TMS,
-- almacén y el calendario operativo.
--
-- NO reusa `nomina_holidays` (0163): esa tabla es nómina-scoped (VE, con
-- triggers de asistencia y RLS por rol admin/accounting). Esta es de alcance
-- operativo (CN/VE, feriado|feria, con rango de fechas para ferias) y RLS por
-- tenant. Son dominios distintos; se mantienen separadas a propósito.
--
-- Convención del repo: enums lógicos = text + CHECK. RLS por tenant. Grants
-- explícitos (auto-expose OFF). Soft-delete. touch_updated_at().
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.operational_calendar (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,

  -- País del evento. El founder opera CN↔VE.
  country     text not null
    constraint operational_calendar_country_chk check (country in ('VE', 'CN')),

  -- feriado (día no laborable) | feria (evento comercial: Cantón, Yiwu…).
  kind        text not null
    constraint operational_calendar_kind_chk check (kind in ('holiday', 'fair')),

  name        text not null,                 -- "Año Nuevo Chino", "Canton Fair · Fase 1"
  start_date  date not null,
  -- Fin del rango (ferias duran varios días). null = evento de 1 día.
  end_date    date,
  note        text,

  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint operational_calendar_date_range_chk
    check (end_date is null or end_date >= start_date)
);

comment on table public.operational_calendar is
  'SDD-0127: calendario operativo CN/VE — feriados (día no laborable) y ferias comerciales (Cantón/Yiwu, con rango de fechas). Afecta lead times / SLAs de despacho y almacén. Separado de nomina_holidays (dominio nómina). RLS por tenant, soft delete.';
comment on column public.operational_calendar.kind is
  'SDD-0127: holiday = feriado (1 día, end_date null) · fair = feria comercial (usa start_date..end_date).';

create index if not exists operational_calendar_tenant_date_idx
  on public.operational_calendar (tenant_id, start_date) where deleted_at is null;

grant select, insert, update on public.operational_calendar to authenticated;
revoke all on public.operational_calendar from anon;

alter table public.operational_calendar enable row level security;
create policy "operational_calendar by tenant" on public.operational_calendar for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger operational_calendar_touch
  before update on public.operational_calendar
  for each row execute function public.touch_updated_at();

-- Sin seed: el admin carga feriados/ferias desde /studio/admin?section=holidays
-- (EmptyState cubre el vacío).
