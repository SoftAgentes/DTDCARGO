-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice motor — ESTRUCTURA): Nómina / RRHH — Corte del período
--   (payroll_run + payroll_run_lines)
--
-- Registra el CORTE de nómina de un período (nomina_payroll_runs) y sus
-- RENGLONES por empleado (nomina_payroll_run_lines = los recibos). Es la
-- ESTRUCTURA del motor, NO la ley fiscal:
--   - El recibo se computa en BORRADOR / ADVISORY (solo lo MECÁNICO que el
--     HANDOFF-NOMINA §3 marca como ya resuelto: prorrateo por frecuencia/método
--     de días, monetización de horas extra/nocturnas con los %s de payroll_rules,
--     deducciones SSO/RPE/FAOV sobre el sueldo base con sus topes en SM, y
--     descuento de cuota de préstamo = min(installment, saldo)). El cálculo vive
--     en lib/studio/nomina/payroll-run-types.ts (calcReciboDraft).
--   - NO consume rules.salarial_bonuses (criterio del contador, queda como config).
--   - NO calcula liquidación.
--   - NO genera asiento contable (eso integra SDD-0079, es otro slice).
--     TODO: asiento al confirmar (slice motor + contador).
--
-- Cada corte CONGELA las reglas usadas (rules_snapshot jsonb) para que editar
-- payroll_rules después no cambie un corte viejo.
--
-- Lifecycle del corte: borrador → confirmado → pagado (+ anulado en cualquier
-- punto). Sin asiento contable en este slice.
--
-- Money/PII-adjacent → mismas 3 capas de 0160:
--   - RLS estricta por tenant Y rol (admin + accounting) vía nomina_can_access().
--   - Gate de rol app-level (requireModuleView / moduleEditDenial) = 2ª capa.
--   - Sin seed: el corte lo genera el usuario desde el botón (EmptyState cubre el vacío).
--
-- Aditiva. text+check para los enums. Reusa nomina_can_access() (0160) y
-- touch_updated_at() (0002/0012) ya existentes.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Corte del período (payroll_run)                            ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_payroll_runs (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,

  -- Período del corte.
  period_label           text not null,                    -- ej. "2026-06"
  period_start           date not null,
  period_end             date not null,

  -- Snapshot de la frecuencia y método de días usados (de payroll_rules vigente).
  pay_frequency          text not null
    check (pay_frequency in ('mensual', 'quincenal', 'semanal')),
  day_method             text not null
    check (day_method in ('30', 'real')),

  -- Copia CONGELADA del payroll_rules vigente usado para este corte. Editar las
  -- reglas después NO cambia un corte ya generado.
  rules_snapshot         jsonb not null,

  -- Lifecycle (sin asiento contable en este slice).
  status                 text not null default 'borrador'
    check (status in ('borrador', 'confirmado', 'pagado', 'anulado')),

  -- Totales (rollup de los renglones).
  total_gross_usd        numeric(14,2) not null default 0,
  total_deductions_usd   numeric(14,2) not null default 0,
  total_net_usd          numeric(14,2) not null default 0,

  notes                  text,
  created_by             uuid references auth.users(id) on delete set null,
  confirmed_at           timestamptz,
  paid_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

comment on table public.nomina_payroll_runs is
  'SDD-0103 Slice motor (estructura): corte de nómina del período. Recibos en BORRADOR/ADVISORY (solo cálculo mecánico). rules_snapshot congela las reglas usadas. Lifecycle borrador→confirmado→pagado→anulado SIN asiento contable (TODO: asiento al confirmar, slice motor + contador). RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_payroll_runs.rules_snapshot is
  'Copia congelada del payroll_rules vigente usado. Editar las reglas después NO altera este corte. NO se consume salarial_bonuses (criterio del contador).';
comment on column public.nomina_payroll_runs.status is
  'borrador (renglones regenerables) → confirmado → pagado · anulado en cualquier punto. SIN asiento contable en este slice.';

-- Un solo corte VIVO no-anulado por (tenant, período): evita duplicar el corte.
create unique index nomina_payroll_runs_one_live_per_period
  on public.nomina_payroll_runs (tenant_id, period_label)
  where deleted_at is null and status <> 'anulado';

-- Listado por estado.
create index nomina_payroll_runs_tenant_status_idx
  on public.nomina_payroll_runs (tenant_id, status)
  where deleted_at is null;

create trigger nomina_payroll_runs_touch
  before update on public.nomina_payroll_runs
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Renglón del corte = recibo por empleado (run_lines)        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Los renglones se REGENERAN mientras el corte esté en borrador (se borran y
-- recomputan) → SIN soft-delete: es un detalle reconstruible del corte.
create table public.nomina_payroll_run_lines (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  run_id                   uuid not null references public.nomina_payroll_runs(id) on delete cascade,
  employee_id              uuid not null references public.nomina_employees(id) on delete cascade,

  -- Snapshots para el recibo (sobreviven a un cambio posterior del empleado).
  employee_code            text,
  employee_name            text,
  base_salary_usd          numeric(12,2) not null default 0,

  -- Insumos agregados del período (de asistencia).
  worked_days              int not null default 0,
  overtime_hours           numeric(6,2) not null default 0,
  night_hours              numeric(6,2) not null default 0,

  -- Componentes monetizados (advisory / mecánico).
  overtime_pay_usd         numeric(12,2) not null default 0,
  night_pay_usd            numeric(12,2) not null default 0,
  loan_deduction_usd       numeric(12,2) not null default 0,
  statutory_deductions_usd numeric(12,2) not null default 0,

  -- Totales del recibo.
  gross_usd                numeric(12,2) not null default 0,
  total_deductions_usd     numeric(12,2) not null default 0,
  net_usd                  numeric(12,2) not null default 0,

  -- Renglones transparentes del recibo (label + monto/fórmula). Advisory.
  breakdown                jsonb not null default '[]'::jsonb,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.nomina_payroll_run_lines is
  'SDD-0103 Slice motor (estructura): renglón del corte = recibo BORRADOR/ADVISORY por empleado. Se regenera mientras el corte esté en borrador (sin soft-delete). breakdown = renglones transparentes del recibo. RLS por tenant Y rol.';
comment on column public.nomina_payroll_run_lines.breakdown is
  'Detalle advisory del recibo (sueldo prorrateado, horas extra/nocturnas, deducciones SSO/RPE/FAOV, cuota de préstamo). NO incluye bonos salariales (criterio del contador).';

-- Renglones por corte / por empleado.
create index nomina_payroll_run_lines_tenant_run_idx
  on public.nomina_payroll_run_lines (tenant_id, run_id);

create index nomina_payroll_run_lines_run_idx
  on public.nomina_payroll_run_lines (run_id);

create index nomina_payroll_run_lines_employee_idx
  on public.nomina_payroll_run_lines (tenant_id, employee_id);

create trigger nomina_payroll_run_lines_touch
  before update on public.nomina_payroll_run_lines
  for each row execute function public.touch_updated_at();

-- ── Trigger de coherencia · el renglón referencia un corte Y un empleado del
-- mismo tenant. security definer (patrón nomina_loan_installment_check, 0164):
-- defensa en profundidad aunque la RLS with-check ya fuerza new.tenant_id =
-- get_user_tenant_id().
create or replace function public.nomina_payroll_run_line_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_payroll_runs r
    where r.id = new.run_id and r.tenant_id = new.tenant_id
  ) then
    raise exception 'run_id % no pertenece al tenant %', new.run_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
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

comment on function public.nomina_payroll_run_line_check is
  'SDD-0103: valida que el renglón referencie un corte Y un empleado del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_payroll_run_line_check() from public, anon;

drop trigger if exists nomina_payroll_run_line_check_trg on public.nomina_payroll_run_lines;
create trigger nomina_payroll_run_line_check_trg
  before insert or update on public.nomina_payroll_run_lines
  for each row execute function public.nomina_payroll_run_line_check();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_payroll_runs to authenticated;
grant select, insert, update, delete on public.nomina_payroll_run_lines to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() (0160) ──
alter table public.nomina_payroll_runs enable row level security;
alter table public.nomina_payroll_run_lines enable row level security;

create policy "nomina_payroll_runs by tenant and role"
  on public.nomina_payroll_runs for all
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

-- run_lines no tiene deleted_at (se regeneran, no se soft-deletean).
create policy "nomina_payroll_run_lines by tenant and role"
  on public.nomina_payroll_run_lines for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- Sin seed: el corte lo genera el usuario desde el botón "Generar corte"
-- (EmptyState cubre el vacío). Nada de PII ni datos fiscales adivinados en git.
