-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice B): Nómina / RRHH — Reglas de cálculo (payroll_rules)
--
-- Store de PARÁMETROS LOTTT (frecuencia de pago, método de días, SML,
-- cestaticket, bono de guerra, %s de deducción SSO/RPE/FAOV, topes IVSS/RPE,
-- recargos, provisiones). Es CONFIG, no cálculo: NO computa recibos (eso es
-- payroll_run, Slice C, que sí requiere contador). Se construye sin esperar al
-- contador; él ajusta los VALORES después desde "Reglas de cálculo".
--
-- Un ruleset VIGENTE por tenant + versionado: editar archiva el anterior y sube
-- version, para que cada corte futuro (payroll_run) pueda congelar el snapshot
-- de reglas que usó.
--
-- Money/PII-adjacent → mismas 3 capas de 0160:
--   - RLS estricta por tenant Y rol (admin + accounting) vía nomina_can_access().
--   - Gate de rol app-level (requireModuleView / moduleEditDenial) = 2ª capa.
--   - Seed DEMO ficticio: valores VE plausibles, NO asesoría fiscal.
--
-- Aditiva. text+check para los enums. Reusa nomina_can_access() y
-- touch_updated_at() ya existentes (0160 / 0002).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_payroll_rules (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  version               int  not null default 1,
  status                text not null default 'vigente'
    check (status in ('vigente', 'archivada')),

  -- Frecuencia y método de días (prorrateo del período).
  pay_frequency         text not null default 'mensual'
    check (pay_frequency in ('mensual', 'quincenal', 'semanal')),
  day_method            text not null default '30'
    check (day_method in ('30', 'real')),

  -- Montos base LOTTT (Bs).
  min_salary            numeric(14,2) not null default 0,   -- SML vigente
  cestaticket           numeric(14,2) not null default 0,   -- cestaticket
  bono_guerra           numeric(14,2) not null default 0,   -- bono de guerra económica

  -- Deducciones del empleado (%).
  sso_pct               numeric(5,2) not null default 4,     -- SSO/IVSS
  rpe_pct               numeric(5,2) not null default 0.5,   -- RPE
  faov_pct              numeric(5,2) not null default 1,     -- FAOV (sin tope)

  -- Topes de cotización (en nº de salarios mínimos).
  sso_cap_sm            numeric(6,2) not null default 5,     -- IVSS: 5 SM
  rpe_cap_sm            numeric(6,2) not null default 10,    -- RPE: 10 SM

  -- Recargos (%).
  overtime_pct          numeric(5,2) not null default 50,    -- hora extra diurna
  night_pct             numeric(5,2) not null default 30,    -- bono nocturno
  holiday_pct           numeric(5,2) not null default 50,    -- día feriado

  -- Provisiones / prestaciones (días).
  utilidades_days       int not null default 30,             -- aguinaldo (mín. legal 30)
  bono_vacacional_days  int not null default 15,
  vacaciones_days       int not null default 15,

  -- Criterio del contador (Slice C): qué bonos son salariales. La columna
  -- existe ya; el valor lo define el contador y el motor lo consume en C.
  salarial_bonuses      jsonb not null default '[]'::jsonb,

  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

comment on table public.nomina_payroll_rules is
  'SDD-0103 Slice B: parámetros LOTTT (config, no cálculo). Un vigente por tenant + versionado. RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_payroll_rules.salarial_bonuses is
  'Criterio del contador (Slice C): lista de bonos salariales. Se almacena pero NO se consume hasta el motor de payroll_run.';
comment on column public.nomina_payroll_rules.min_salary is
  'numeric → llega a TS como string, coercer con num(). SML en Bs (los sueldos del empleado van indexados en USD; estos parámetros estatutarios van en Bs).';

-- Un solo ruleset VIGENTE por tenant (el historial son filas 'archivada').
create unique index nomina_payroll_rules_one_vigente_per_tenant
  on public.nomina_payroll_rules (tenant_id)
  where status = 'vigente' and deleted_at is null;

-- Trigger updated_at (reusa la función existente).
create trigger nomina_payroll_rules_touch
  before update on public.nomina_payroll_rules
  for each row execute function public.touch_updated_at();

-- GRANTS explícitos (auto-expose new tables OFF).
grant select, insert, update, delete on public.nomina_payroll_rules to authenticated;

-- RLS por tenant Y rol (admin/accounting) — reusa nomina_can_access() de 0160.
alter table public.nomina_payroll_rules enable row level security;

create policy "nomina_payroll_rules by tenant and role"
  on public.nomina_payroll_rules for all
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

-- ── Seed DEMO FICTICIO (tenant 'dtd') ─────────────────────────
-- 1 ruleset vigente con valores VE plausibles para que la UI no se vea vacía.
-- NO es asesoría fiscal: el contador valida/ajusta. created_by = null (seed
-- corre como postgres). Idempotente: solo si el tenant aún no tiene vigente.
insert into public.nomina_payroll_rules
  (tenant_id, version, status, pay_frequency, day_method,
   min_salary, cestaticket, bono_guerra,
   sso_pct, rpe_pct, faov_pct, sso_cap_sm, rpe_cap_sm,
   overtime_pct, night_pct, holiday_pct,
   utilidades_days, bono_vacacional_days, vacaciones_days, notes)
select
  t.id, 1, 'vigente', 'mensual', '30',
  130.00, 40.00, 90.00,
  4, 0.5, 1, 5, 10,
  50, 30, 50,
  30, 15, 15, 'Ruleset demo ficticio — valores plausibles VE, pendiente validación del contador.'
from public.tenants t
where t.slug = 'dtd'
  and not exists (
    select 1 from public.nomina_payroll_rules r
    where r.tenant_id = t.id and r.status = 'vigente' and r.deleted_at is null
  );
