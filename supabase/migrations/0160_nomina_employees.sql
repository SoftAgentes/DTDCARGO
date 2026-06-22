-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice A): Nómina / RRHH — Empleados
--
-- Ficha del empleado del tenant: datos, banco, sueldo indexado en USD.
-- Es NÓMINA = dinero + PII (cédula, teléfono, salario, datos bancarios).
--
-- Seguridad de 3 capas (ver spec §3):
--   - RLS ESTRICTA por tenant Y por rol → solo admin + accounting (un escalón
--     más cerrado que el resto del ERP, que solo aísla por tenant). El backstop
--     ante PostgREST directo lo da nomina_can_access().
--   - El gate de rol app-level (requireModuleView / moduleEditDenial) es la 2ª
--     capa; el sidebar (UX) la 1ª.
--   - cero PII real en git: el seed es DEMO FICTICIO.
--
-- Aditiva. text+check para los enums (extensible, sin landmine de cast
-- enum↔text). RPC correlativo next_employee_code (EMP-NNNN).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_employees (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  employee_code      text not null,                       -- EMP-NNNN (next_employee_code)
  -- Datos personales (PII).
  full_name          text not null,
  national_id        text,                                -- cédula / pasaporte (V-…, E-…)
  position_label     text,                                -- cargo
  department         text,                                -- área / departamento
  phone              text,
  email              text,
  -- Remuneración (dinero · sueldo mensual indexado en USD, pago en Bs a tasa BCV).
  salary_usd         numeric(12,2) not null default 0,
  hire_date          date,                                -- fecha de ingreso
  birth_date         date,
  -- Datos bancarios (PII) para el pago.
  bank_name          text,
  bank_account_type  text check (bank_account_type in ('corriente', 'ahorro')),
  bank_account       text,
  -- Estado laboral.
  status             text not null default 'activo'
    check (status in ('activo', 'inactivo', 'egresado')),
  notes              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, employee_code)
);

comment on table public.nomina_employees is
  'SDD-0103 Slice A: ficha de empleado (RRHH). PII + dinero. RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_employees.salary_usd is
  'Sueldo mensual indexado en USD. numeric(12,2) → llega a TS como string, coercer con num().';
comment on column public.nomina_employees.national_id is
  'Cédula/pasaporte (PII). Único por tenant (no duplicar empleados). El seed es ficticio.';

-- Índices: listado por estado, lookup por cédula, no duplicar cédula viva.
create index nomina_employees_tenant_status_idx
  on public.nomina_employees (tenant_id, status)
  where deleted_at is null;

create unique index nomina_employees_national_id_uniq
  on public.nomina_employees (tenant_id, national_id)
  where deleted_at is null and national_id is not null;

-- ── Helper de acceso por ROL · reusable por todas las tablas de nómina ──
-- Nómina (dinero + PII) se restringe a admin + accounting, NO solo por tenant.
-- security definer → bypassa la RLS de user_tenants para leer el rol del caller.
-- (select auth.uid()) wrap = caching por query (FINDING-003). stable.
create or replace function public.nomina_can_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.role in ('admin', 'accounting')
      and ut.disabled_at is null
  );
$$;

comment on function public.nomina_can_access is
  'SDD-0103: ¿el caller autenticado es admin o accounting (membership activo)? Backstop de rol para la RLS de las tablas de nómina (dinero + PII).';

revoke all on function public.nomina_can_access() from public;
revoke execute on function public.nomina_can_access() from anon;
grant execute on function public.nomina_can_access() to authenticated;

-- ── Correlativo EMP-NNNN ──────────────────────────────────────
-- MAX(num)+1 por tenant (sin año: los empleados son pocos y estables).
-- assert_tenant_match exige tenant autenticado = el suyo. El unique
-- (tenant_id, employee_code) protege la carrera (2.º insert → 23505).
create or replace function public.next_employee_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform public.assert_tenant_match(p_tenant_id);

  select coalesce(max((regexp_match(employee_code, '^EMP-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.nomina_employees
   where tenant_id = p_tenant_id;

  return 'EMP-' || lpad(v_max::text, 4, '0');
end;
$$;

comment on function public.next_employee_code is
  'SDD-0103: próximo código de empleado EMP-NNNN para el tenant (assert_tenant_match). MAX(num)+1, padding 4.';

revoke all on function public.next_employee_code(uuid) from public;
revoke execute on function public.next_employee_code(uuid) from anon;
grant execute on function public.next_employee_code(uuid) to authenticated;

-- Trigger updated_at (reusa la función existente de 0002/0012).
create trigger nomina_employees_touch
  before update on public.nomina_employees
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_employees to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) ───────────────────
alter table public.nomina_employees enable row level security;

create policy "nomina_employees by tenant and role"
  on public.nomina_employees for all
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
-- NO es personal real de DTD: nombres, cédulas, teléfonos y cuentas son
-- inventados para que la UI no se vea vacía en dev/demo. created_by = null
-- (seed corre como postgres, sin sesión). Idempotente por employee_code.
insert into public.nomina_employees
  (tenant_id, employee_code, full_name, national_id, position_label, department,
   phone, email, salary_usd, hire_date, bank_name, bank_account_type, bank_account, status, notes)
select
  t.id, x.employee_code, x.full_name, x.national_id, x.position_label, x.department,
  x.phone, x.email, x.salary_usd, x.hire_date::date, x.bank_name, x.bank_account_type,
  x.bank_account, x.status, x.notes
from public.tenants t
join lateral (values
  ('EMP-0001', 'Carmen Albornoz (demo)', 'V-90.000.011', 'Coordinadora de Operaciones', 'Operación',
   '+58 412 000 0011', 'demo01@example.test', 700.00, '2021-03-01', 'Banesco', 'corriente', '0134 0000 00 0000000011', 'activo', 'Registro demo ficticio.'),
  ('EMP-0002', 'Régulo Ferrer (demo)', 'V-90.000.022', 'Asistente de Almacén', 'Almacén',
   '+58 414 000 0022', 'demo02@example.test', 320.00, '2023-07-10', 'Mercantil', 'ahorro', '0105 0000 00 0000000022', 'activo', 'Registro demo ficticio.'),
  ('EMP-0003', 'Daniela Sequera (demo)', 'V-90.000.033', 'Atención al Cliente', 'Comercial',
   '+58 416 000 0033', 'demo03@example.test', 300.00, '2024-02-19', 'Banco de Venezuela', 'corriente', '0102 0000 00 0000000033', 'inactivo', 'Registro demo ficticio.')
) as x(employee_code, full_name, national_id, position_label, department, phone, email, salary_usd, hire_date, bank_name, bank_account_type, bank_account, status, notes) on true
where t.slug = 'dtd'
on conflict (tenant_id, employee_code) do nothing;
