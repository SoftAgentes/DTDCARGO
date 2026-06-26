-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice C): Nómina / RRHH — Préstamos con cuota de descuento
--
-- Préstamo a un empleado con una CUOTA por período. El descuento real en el
-- recibo lo hará el motor de cálculo (payroll_run, Slice posterior, con
-- contador) — acá SOLO se registra el préstamo, sus cuotas pagadas y el saldo
-- vivo. El saldo se modela DERIVADO (principal − Σ cuotas) en la capa de
-- queries, no como columna (evita drift entre el agregado y el detalle).
--
-- Dos tablas: el préstamo (nomina_loans) y sus cuotas/abonos
-- (nomina_loan_installments). Mismo molde que 0161 (prestador → pagos):
-- trigger de coherencia security definer + RLS por tenant Y rol.
--
-- Reutiliza nomina_can_access() (migr 0160) → misma RLS estricta por tenant
-- Y rol (admin/accounting). text+check para enums. Es dinero + PII (toca al
-- empleado): mismas 3 capas de seguridad de 0160.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_loans (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  employee_id        uuid not null references public.nomina_employees(id) on delete cascade,
  principal_usd      numeric(12,2) not null default 0,      -- monto otorgado
  installment_usd    numeric(12,2) not null default 0,      -- cuota por período (descuento)
  installments_total int  not null default 1,               -- nº de cuotas previstas
  granted_on         date not null default current_date,    -- fecha de otorgamiento
  status             text not null default 'activo'
    check (status in ('activo', 'pagado', 'cancelado')),
  concept            text,                                   -- motivo / concepto
  notes              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

comment on table public.nomina_loans is
  'SDD-0103 Slice C: préstamo a un empleado con cuota de descuento. El descuento real en el recibo lo hará el motor (payroll_run). Saldo = principal − suma de cuotas (derivado en queries, no columna). RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_loans.installment_usd is
  'Cuota por período. numeric(12,2) → string en TS, coercer con num(). El motor descuenta min(cuota, saldo) en cada recibo.';

create table public.nomina_loan_installments (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  loan_id            uuid not null references public.nomina_loans(id) on delete cascade,
  paid_on            date not null default current_date,
  amount_usd         numeric(12,2) not null default 0,      -- abono / cuota registrada
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

comment on table public.nomina_loan_installments is
  'SDD-0103 Slice C: cuota/abono registrado contra un préstamo. amount_usd numeric(12,2) → string en TS, coercer con num(). RLS por tenant Y rol.';

-- Índices: préstamos por empleado / estado, cuotas por préstamo / fecha.
create index nomina_loans_tenant_employee_idx
  on public.nomina_loans (tenant_id, employee_id)
  where deleted_at is null;

create index nomina_loans_tenant_status_idx
  on public.nomina_loans (tenant_id, status)
  where deleted_at is null;

create index nomina_loan_installments_tenant_loan_idx
  on public.nomina_loan_installments (tenant_id, loan_id)
  where deleted_at is null;

create index nomina_loan_installments_tenant_date_idx
  on public.nomina_loan_installments (tenant_id, paid_on desc)
  where deleted_at is null;

-- ── Trigger de coherencia · la cuota pertenece a un préstamo del mismo tenant ──
-- security definer (patrón nomina_contractor_payment_check, 0161): defensa en
-- profundidad aunque la RLS with-check ya fuerza new.tenant_id = get_user_tenant_id().
create or replace function public.nomina_loan_installment_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_loans l
    where l.id = new.loan_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'loan_id % no pertenece al tenant %', new.loan_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_loan_installment_check is
  'SDD-0103: valida que la cuota referencie un préstamo del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_loan_installment_check() from public, anon;

drop trigger if exists nomina_loan_installment_check_trg on public.nomina_loan_installments;
create trigger nomina_loan_installment_check_trg
  before insert or update on public.nomina_loan_installments
  for each row execute function public.nomina_loan_installment_check();

-- Triggers updated_at (reusan touch_updated_at de 0002/0012).
create trigger nomina_loans_touch
  before update on public.nomina_loans
  for each row execute function public.touch_updated_at();

create trigger nomina_loan_installments_touch
  before update on public.nomina_loan_installments
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_loans to authenticated;
grant select, insert, update, delete on public.nomina_loan_installments to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() ──
alter table public.nomina_loans enable row level security;
alter table public.nomina_loan_installments enable row level security;

create policy "nomina_loans by tenant and role"
  on public.nomina_loans for all
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

create policy "nomina_loan_installments by tenant and role"
  on public.nomina_loan_installments for all
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
-- Préstamos y cuotas inventados (no reales), enganchados por nombre a empleados
-- demo del seed de 0160. Si esos empleados no existen, no inserta nada (el join
-- por nombre simplemente no matchea). Idempotente: not exists por (employee,
-- concept) en préstamos y por (loan, paid_on, amount) en cuotas.
insert into public.nomina_loans
  (tenant_id, employee_id, principal_usd, installment_usd, installments_total,
   granted_on, status, concept, notes)
select e.tenant_id, e.id, x.principal_usd, x.installment_usd, x.installments_total,
       x.granted_on::date, x.status, x.concept, x.notes
from public.nomina_employees e
join public.tenants t on t.id = e.tenant_id and t.slug = 'dtd'
join lateral (values
  ('Carlos Fuentes (demo)', 300.00, 25.00, 12, '2026-04-15', 'activo', 'Adelanto personal', 'Registro demo ficticio.'),
  ('Daniela Rivas (demo)',  150.00, 15.00, 10, '2026-05-02', 'activo', 'Emergencia médica',  'Registro demo ficticio.')
) as x(e_full_name, principal_usd, installment_usd, installments_total, granted_on, status, concept, notes)
  on x.e_full_name = e.full_name
where not exists (
    select 1 from public.nomina_loans l2
    where l2.employee_id = e.id and l2.concept = x.concept
  );

insert into public.nomina_loan_installments
  (tenant_id, loan_id, paid_on, amount_usd)
select l.tenant_id, l.id, x.paid_on::date, x.amount_usd
from public.nomina_loans l
join public.tenants t on t.id = l.tenant_id and t.slug = 'dtd'
join lateral (values
  ('Adelanto personal', '2026-05-15', 25.00),
  ('Adelanto personal', '2026-06-15', 25.00),
  ('Emergencia médica', '2026-06-02', 15.00)
) as x(concept, paid_on, amount_usd) on x.concept = l.concept
where not exists (
    select 1 from public.nomina_loan_installments i2
    where i2.loan_id = l.id and i2.paid_on = x.paid_on::date and i2.amount_usd = x.amount_usd
  );
