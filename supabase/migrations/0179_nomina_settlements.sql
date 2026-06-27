-- ─────────────────────────────────────────────────────────────
-- SDD-0109: Liquidación y finiquito de nómina (LOTTT)
--   nomina_settlements + nomina_settlement_lines
--
-- Cierra el hueco keystone de Nómina (SDD-0103): al egresar un empleado el
-- módulo genera un FINIQUITO que liquida lo que la ley manda según la CAUSA de
-- terminación (renuncia 76 / causas ajenas 78 / despido justificado 79 / despido
-- injustificado 92), con desglose transparente, PDF a Storage y asiento contable
-- (SDD-0079) al confirmar.
--
-- Regla de oro: el finiquito es BORRADOR / ADVISORY hasta que un usuario
-- accounting/admin lo confirme. El contador valida antes de pagar.
--
-- El SALARIO INTEGRAL (Art. 142) es PARÁMETRO, no ley hardcodeada:
--   - qué bonos son salariales      → nomina_payroll_rules.salarial_bonuses (ya existe)
--   - alícuotas bono vac/utilidades → nomina_payroll_rules.{bono_vacacional_days,utilidades_days}
--   - método garantía vs retroactivo, tasa de interés, Art.92 en causa 78
--     → columnas de config AÑADIDAS acá a nomina_payroll_rules (additivo).
-- El finiquito CONGELA el ruleset usado (rules_snapshot jsonb) → editar Reglas
-- después NO cambia un finiquito viejo (mismo patrón que payroll_runs).
--
-- Decisiones del founder (2026-06-27) reflejadas en los DEFAULTs de config:
--   #2 prestaciones_method default 'mejor' (calcula garantía Y retroactivo, toma la mayor)
--   #4 ajena_78_incluye_92 default false (causas ajenas NO duplican por default)
--   #5 el asiento provisiona contra pasivo "finiquitos por pagar" (lo cablea la action)
--   #7 cálculo en USD, conversión a Bs para el PDF (lo hace la capa de PDF)
--
-- Money/PII de egreso → mismas 3 capas de 0160/0175:
--   - RLS estricta por tenant Y rol (admin + accounting) vía nomina_can_access().
--   - Gate de rol app-level (requireModuleView / moduleEditDenial) = 2ª capa.
--   - Triggers de coherencia same-tenant security definer = backstop en DB.
--   - Sin seed con PII real: el finiquito lo genera el usuario desde el botón.
--
-- Aditiva. text+check para los enums. Reusa nomina_can_access() (0160),
-- assert_tenant_match() (0160) y touch_updated_at() (0002/0012) ya existentes.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Config adicional del criterio salarial (additiva a Reglas) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Parámetros que el contador ajusta; defaults plausibles + advisory. Se agregan
-- a nomina_payroll_rules (NO a la lógica del motor) por SDD-0109 §3.3.
alter table public.nomina_payroll_rules
  add column if not exists prestaciones_method text not null default 'mejor'
    check (prestaciones_method in ('garantia', 'retroactivo', 'mejor')),
  add column if not exists prestaciones_interest_pct numeric(6,2) not null default 0,
  add column if not exists ajena_78_incluye_92 boolean not null default false;

comment on column public.nomina_payroll_rules.prestaciones_method is
  'SDD-0109 (criterio contador): cómo se calculan las prestaciones Art. 142 — garantia (15 días/trimestre), retroactivo (30 días/año sobre último integral), o mejor (calcula ambas y toma la mayor; default, = ley literal).';
comment on column public.nomina_payroll_rules.prestaciones_interest_pct is
  'SDD-0109 (criterio contador): tasa de interés sobre prestaciones acumuladas (advisory; el contador la carga). Default 0.';
comment on column public.nomina_payroll_rules.ajena_78_incluye_92 is
  'SDD-0109 (criterio contador): si la terminación por causas ajenas (Art. 78) gatilla la indemnización Art. 92. Default false (decisión founder 2026-06-27).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Correlativo LIQ-NNNN                                        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Patrón next_employee_code (0160): assert_tenant_match exige tenant autenticado
-- = el suyo; el unique(tenant_id, settlement_code) protege la carrera.
create or replace function public.next_settlement_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform public.assert_tenant_match(p_tenant_id);

  select coalesce(max((regexp_match(settlement_code, '^LIQ-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.nomina_settlements
   where tenant_id = p_tenant_id;

  return 'LIQ-' || lpad(v_max::text, 4, '0');
end;
$$;

comment on function public.next_settlement_code is
  'SDD-0109: próximo código de finiquito LIQ-NNNN para el tenant (assert_tenant_match). MAX(num)+1, padding 4.';

revoke all on function public.next_settlement_code(uuid) from public;
revoke execute on function public.next_settlement_code(uuid) from anon;
grant execute on function public.next_settlement_code(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Finiquito (cabecera)                                        ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_settlements (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,

  settlement_code          text not null,                  -- LIQ-NNNN (next_settlement_code)
  employee_id              uuid not null references public.nomina_employees(id) on delete restrict,

  -- Snapshots (sobreviven a un cambio posterior del empleado · PII de egreso).
  employee_code            text not null,                  -- EMP-NNNN
  employee_name            text not null,                  -- PII

  -- Causa de terminación LOTTT (mapa causa→renglones es mecánico).
  termination_cause        text not null
    check (termination_cause in ('renuncia_76', 'ajena_78', 'despido_justificado_79', 'despido_injustificado_92')),

  hire_date                date not null,                  -- ingreso (snapshot, antigüedad)
  termination_date         date not null,                  -- egreso (>= hire_date · trigger)
  base_salary_usd          numeric(14,2) not null,         -- salario normal mensual al egreso (snapshot)

  -- Copia CONGELADA del criterio salarial usado (bonos salariales + alícuotas +
  -- método de prestaciones + tasa). Editar Reglas después NO cambia este finiquito.
  rules_snapshot           jsonb not null,

  status                   text not null default 'borrador'
    check (status in ('borrador', 'confirmado', 'anulado')),

  -- Totales (rollup de los renglones).
  total_prestaciones_usd   numeric(14,2) not null default 0,
  total_fracciones_usd     numeric(14,2) not null default 0,  -- vac + bono vac + utilidades frac
  total_indemnizacion_usd  numeric(14,2) not null default 0,  -- Art. 92 (0 si no aplica)
  total_intereses_usd      numeric(14,2) not null default 0,
  total_deductions_usd     numeric(14,2) not null default 0,  -- saldo de préstamos, etc.
  total_net_usd            numeric(14,2) not null default 0,
  salario_integral_usd     numeric(14,2) not null default 0,  -- snapshot del integral (transparencia)

  pdf_path                 text,                            -- ruta en Storage (null hasta confirmar)
  journal_entry_id         uuid references public.journal_entries(id) on delete set null,  -- asiento (null hasta confirmar)
  confirmed_at             timestamptz,
  notes                    text,
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,

  unique (tenant_id, settlement_code)
);

comment on table public.nomina_settlements is
  'SDD-0109: finiquito de egreso (liquidación LOTTT) por empleado/causa. BORRADOR/ADVISORY hasta confirmar (genera PDF + asiento SDD-0079). rules_snapshot congela el criterio salarial usado. RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_settlements.rules_snapshot is
  'Copia congelada del criterio salarial usado (salarial_bonuses + alícuotas + método de prestaciones + tasa). Editar las Reglas después NO altera este finiquito.';
comment on column public.nomina_settlements.salario_integral_usd is
  'Snapshot del salario integral diario × 30 (Art. 142) computado con el rules_snapshot. Transparencia: qué base se usó para prestaciones e indemnización.';
comment on column public.nomina_settlements.journal_entry_id is
  'Asiento contable (SDD-0079) generado al confirmar: provisiona contra pasivo "finiquitos por pagar". null hasta confirmar.';

-- Un solo finiquito VIVO no-anulado por (tenant, empleado): un empleado se
-- liquida una vez; si se anula puede re-generarse.
create unique index nomina_settlements_one_live_per_employee
  on public.nomina_settlements (tenant_id, employee_id)
  where deleted_at is null and status <> 'anulado';

-- Listado por estado.
create index nomina_settlements_tenant_status_idx
  on public.nomina_settlements (tenant_id, status)
  where deleted_at is null;

create trigger nomina_settlements_touch
  before update on public.nomina_settlements
  for each row execute function public.touch_updated_at();

-- ── Trigger de coherencia: empleado del mismo tenant + fechas coherentes.
-- security definer (patrón nomina_payroll_run_line_check, 0175).
create or replace function public.nomina_settlement_check()
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
  if new.termination_date < new.hire_date then
    raise exception 'termination_date % anterior a hire_date %', new.termination_date, new.hire_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_settlement_check is
  'SDD-0109: valida que el finiquito referencie un empleado del mismo tenant y que el egreso no sea anterior al ingreso (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_settlement_check() from public, anon;

drop trigger if exists nomina_settlement_check_trg on public.nomina_settlements;
create trigger nomina_settlement_check_trg
  before insert or update on public.nomina_settlements
  for each row execute function public.nomina_settlement_check();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Renglones del desglose (settlement_lines)                  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Se REGENERAN mientras el finiquito esté en borrador (se borran y recomputan)
-- → SIN soft-delete. Una vez confirmado, son inmutables (el status lo bloquea).
create table public.nomina_settlement_lines (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  settlement_id   uuid not null references public.nomina_settlements(id) on delete cascade,

  kind            text not null
    check (kind in ('prestaciones', 'vacaciones_frac', 'bono_vacacional_frac',
                    'utilidades_frac', 'indemnizacion_92', 'intereses',
                    'deduccion_prestamo', 'otro')),
  label           text not null,                            -- descripción legible
  days            numeric(8,2),                             -- días devengados (cuando aplique)
  base_usd        numeric(14,2),                            -- base (salario normal o integral)
  amount_usd      numeric(14,2) not null default 0,         -- monto (negativo = deducción)
  created_at      timestamptz not null default now()
);

comment on table public.nomina_settlement_lines is
  'SDD-0109: renglón del desglose del finiquito. Se regenera mientras el finiquito esté en borrador (sin soft-delete). amount_usd negativo = deducción. RLS por tenant Y rol.';

create index nomina_settlement_lines_tenant_settlement_idx
  on public.nomina_settlement_lines (tenant_id, settlement_id);

create index nomina_settlement_lines_settlement_idx
  on public.nomina_settlement_lines (settlement_id);

-- ── Trigger de coherencia: el renglón referencia un finiquito del mismo tenant.
create or replace function public.nomina_settlement_line_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_settlements s
    where s.id = new.settlement_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'settlement_id % no pertenece al tenant %', new.settlement_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_settlement_line_check is
  'SDD-0109: valida que el renglón referencie un finiquito del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_settlement_line_check() from public, anon;

drop trigger if exists nomina_settlement_line_check_trg on public.nomina_settlement_lines;
create trigger nomina_settlement_line_check_trg
  before insert or update on public.nomina_settlement_lines
  for each row execute function public.nomina_settlement_line_check();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_settlements to authenticated;
grant select, insert, update, delete on public.nomina_settlement_lines to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() (0160) ──
alter table public.nomina_settlements enable row level security;
alter table public.nomina_settlement_lines enable row level security;

create policy "nomina_settlements by tenant and role"
  on public.nomina_settlements for all
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

-- settlement_lines no tiene deleted_at (se regeneran, no se soft-deletean).
create policy "nomina_settlement_lines by tenant and role"
  on public.nomina_settlement_lines for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- Sin seed: el finiquito lo genera el usuario desde el botón "Generar finiquito"
-- (EmptyState cubre el vacío). Nada de PII de egreso adivinada en git.
