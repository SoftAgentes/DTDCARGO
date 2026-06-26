-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice C): Nómina / RRHH — Asistencia + Feriados
--
-- Insumo del motor de cálculo (payroll_run, futuro): el registro diario de
-- asistencia por empleado (trabajado / ausente / libre / feriado + horas extra
-- y nocturnas) y el calendario de feriados (nacionales VE + propios de la
-- empresa). NO computa recibos: solo persiste los hechos del calendario que el
-- recibo LOTTT consumirá (recargos de hora extra, nocturno y feriado).
--
-- Money/PII-adjacent (asistencia ligada a empleado) → mismas 3 capas de 0160:
--   - RLS estricta por tenant Y rol (admin + accounting) vía nomina_can_access().
--   - Gate de rol app-level (requireModuleView / moduleEditDenial) = 2ª capa.
--   - Trigger de coherencia: el employee_id pertenece al mismo tenant.
--   - Seed DEMO ficticio: feriados nacionales VE plausibles (no PII real).
--
-- Aditiva. text+check para los enums (extensible, sin landmine de cast
-- enum↔text). Reusa nomina_can_access() (0160) y touch_updated_at() (0002).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ nomina_attendance · registro diario por empleado           ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_attendance (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  employee_id     uuid not null references public.nomina_employees(id) on delete cascade,
  work_date       date not null,
  status          text not null
    check (status in ('trabajado', 'ausente', 'libre', 'feriado')),
  -- Horas con recargo (insumo del recibo LOTTT). El % vive en payroll_rules.
  overtime_hours  numeric(6,2) not null default 0,   -- hora extra diurna
  night_hours     numeric(6,2) not null default 0,   -- bono nocturno
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.nomina_attendance is
  'SDD-0103 Slice C: registro diario de asistencia por empleado (insumo del recibo). RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_attendance.overtime_hours is
  'Horas extra diurnas. numeric(6,2) llega a TS como string, coercer con num(). El recargo % vive en payroll_rules (Slice B).';
comment on column public.nomina_attendance.night_hours is
  'Horas con bono nocturno. numeric(6,2) llega a TS como string, coercer con num().';

-- Un solo registro vivo por (empleado, dia): no doble marca.
create unique index nomina_attendance_employee_date_uniq
  on public.nomina_attendance (tenant_id, employee_id, work_date)
  where deleted_at is null;

-- Listado del calendario por empleado / mes.
create index nomina_attendance_tenant_date_idx
  on public.nomina_attendance (tenant_id, work_date desc)
  where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ nomina_holidays · feriado del calendario                   ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_holidays (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  holiday_date  date not null,
  label         text not null,
  scope         text not null default 'nacional'
    check (scope in ('nacional', 'empresa')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.nomina_holidays is
  'SDD-0103 Slice C: feriado del calendario (nacional VE o propio de la empresa). RLS por tenant Y rol (admin/accounting). Soft delete.';

-- Un solo feriado vivo por (tenant, fecha): no duplicar.
create unique index nomina_holidays_tenant_date_uniq
  on public.nomina_holidays (tenant_id, holiday_date)
  where deleted_at is null;

create index nomina_holidays_tenant_date_idx
  on public.nomina_holidays (tenant_id, holiday_date)
  where deleted_at is null;

-- ── Trigger de coherencia · la asistencia referencia un empleado del mismo tenant ──
-- security definer (patron nomina_contractor_payment_check, 0161): defensa en
-- profundidad aunque la RLS with-check ya fuerza new.tenant_id = get_user_tenant_id().
create or replace function public.nomina_attendance_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_employees e
    where e.id = new.employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'employee_id % no pertenece al tenant %', new.employee_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_attendance_check is
  'SDD-0103: valida que la asistencia referencie un empleado del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_attendance_check() from public, anon;

drop trigger if exists nomina_attendance_check_trg on public.nomina_attendance;
create trigger nomina_attendance_check_trg
  before insert or update on public.nomina_attendance
  for each row execute function public.nomina_attendance_check();

-- Triggers updated_at (reusan touch_updated_at de 0002/0012).
create trigger nomina_attendance_touch
  before update on public.nomina_attendance
  for each row execute function public.touch_updated_at();

create trigger nomina_holidays_touch
  before update on public.nomina_holidays
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_attendance to authenticated;
grant select, insert, update, delete on public.nomina_holidays to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() ──
alter table public.nomina_attendance enable row level security;
alter table public.nomina_holidays enable row level security;

create policy "nomina_attendance by tenant and role"
  on public.nomina_attendance for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and deleted_at is null
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

create policy "nomina_holidays by tenant and role"
  on public.nomina_holidays for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and deleted_at is null
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- ── Seed DEMO FICTICIO · feriados nacionales VE (tenant 'dtd') ──
-- Feriados nacionales plausibles de Venezuela para 2026 (no PII; son fechas
-- publicas). created_by = null (seed corre como postgres). Idempotente por
-- el unique parcial (tenant, holiday_date).
insert into public.nomina_holidays
  (tenant_id, holiday_date, label, scope)
select t.id, x.holiday_date::date, x.label, 'nacional'
from public.tenants t
join lateral (values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-02-16', 'Lunes de Carnaval'),
  ('2026-02-17', 'Martes de Carnaval'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-04-19', 'Declaración de la Independencia'),
  ('2026-05-01', 'Día del Trabajador'),
  ('2026-06-24', 'Batalla de Carabobo'),
  ('2026-07-05', 'Día de la Independencia'),
  ('2026-07-24', 'Natalicio de Simón Bolívar'),
  ('2026-10-12', 'Día de la Resistencia Indígena'),
  ('2026-12-24', 'Nochebuena'),
  ('2026-12-25', 'Navidad'),
  ('2026-12-31', 'Fin de Año')
) as x(holiday_date, label) on true
where t.slug = 'dtd'
on conflict do nothing;
