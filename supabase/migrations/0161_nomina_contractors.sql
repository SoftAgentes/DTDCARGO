-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice A): Nómina / RRHH — Prestadores y pagos por sesión
--
-- Prestadores freelance (limpieza, plomería, electricidad…) que cobran POR
-- SESIÓN, fuera de la nómina fija. Dos tablas: el prestador y sus pagos.
--
-- Reutiliza nomina_can_access() (migr 0160) → misma RLS estricta por tenant
-- Y rol (admin/accounting). text+check para enums. PII en el prestador.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_contractors (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  full_name         text not null,                        -- PII
  service           text not null,                        -- servicio prestado
  phone             text,                                 -- PII
  national_id       text,                                 -- cédula/RIF (PII, opcional)
  default_rate_usd  numeric(12,2) not null default 0,     -- tarifa de referencia por sesión
  status            text not null default 'activo'
    check (status in ('activo', 'inactivo')),
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.nomina_contractors is
  'SDD-0103 Slice A: prestadores freelance (pago por sesión, fuera de la nómina fija). PII. RLS por tenant Y rol (admin/accounting). Soft delete.';

create table public.nomina_contractor_payments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  contractor_id     uuid not null references public.nomina_contractors(id) on delete cascade,
  paid_on           date not null default current_date,
  concept           text not null,
  amount_usd        numeric(12,2) not null default 0,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.nomina_contractor_payments is
  'SDD-0103 Slice A: pagos por sesión a un prestador. amount_usd numeric(12,2) → string en TS, coercer con num(). RLS por tenant Y rol.';

-- Índices: listado de prestadores por estado, pagos por prestador / fecha.
create index nomina_contractors_tenant_status_idx
  on public.nomina_contractors (tenant_id, status)
  where deleted_at is null;

create index nomina_contractor_payments_tenant_contractor_idx
  on public.nomina_contractor_payments (tenant_id, contractor_id)
  where deleted_at is null;

create index nomina_contractor_payments_tenant_date_idx
  on public.nomina_contractor_payments (tenant_id, paid_on desc)
  where deleted_at is null;

-- ── Trigger de coherencia · el pago pertenece a un prestador del mismo tenant ──
-- security definer (patrón client_claims_check, 0152): defensa en profundidad
-- aunque la RLS with-check ya fuerza new.tenant_id = get_user_tenant_id().
create or replace function public.nomina_contractor_payment_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_contractors c
    where c.id = new.contractor_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'contractor_id % no pertenece al tenant %', new.contractor_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_contractor_payment_check is
  'SDD-0103: valida que el pago referencie un prestador del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_contractor_payment_check() from public, anon;

drop trigger if exists nomina_contractor_payment_check_trg on public.nomina_contractor_payments;
create trigger nomina_contractor_payment_check_trg
  before insert or update on public.nomina_contractor_payments
  for each row execute function public.nomina_contractor_payment_check();

-- Triggers updated_at (reusan touch_updated_at de 0002/0012).
create trigger nomina_contractors_touch
  before update on public.nomina_contractors
  for each row execute function public.touch_updated_at();

create trigger nomina_contractor_payments_touch
  before update on public.nomina_contractor_payments
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_contractors to authenticated;
grant select, insert, update, delete on public.nomina_contractor_payments to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() ──
alter table public.nomina_contractors enable row level security;
alter table public.nomina_contractor_payments enable row level security;

create policy "nomina_contractors by tenant and role"
  on public.nomina_contractors for all
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

create policy "nomina_contractor_payments by tenant and role"
  on public.nomina_contractor_payments for all
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
-- Prestadores y pagos inventados (no reales). Idempotente por (tenant, full_name).
-- not exists (en vez de on conflict): no hay unique en full_name, así que el
-- guard explícito es lo que hace el seed idempotente ante un re-run.
insert into public.nomina_contractors
  (tenant_id, full_name, service, phone, default_rate_usd, status, notes)
select t.id, x.full_name, x.service, x.phone, x.default_rate_usd, x.status, x.notes
from public.tenants t
join lateral (values
  ('Marisol Tovar (demo)', 'Limpieza / doméstica', '+58 412 000 0101', 15.00, 'activo', 'Registro demo ficticio.'),
  ('Jesús Marcano (demo)', 'Plomería',             '+58 414 000 0102', 30.00, 'activo', 'Registro demo ficticio.')
) as x(full_name, service, phone, default_rate_usd, status, notes) on true
where t.slug = 'dtd'
  and not exists (
    select 1 from public.nomina_contractors c2
    where c2.tenant_id = t.id and c2.full_name = x.full_name
  );

insert into public.nomina_contractor_payments
  (tenant_id, contractor_id, paid_on, concept, amount_usd)
select c.tenant_id, c.id, x.paid_on::date, x.concept, x.amount_usd
from public.nomina_contractors c
join public.tenants t on t.id = c.tenant_id and t.slug = 'dtd'
join lateral (values
  ('Marisol Tovar (demo)', '2026-05-20', 'Limpieza de oficina (jornada)', 15.00),
  ('Jesús Marcano (demo)', '2026-05-12', 'Reparación de baño', 30.00)
) as x(full_name, paid_on, concept, amount_usd) on x.full_name = c.full_name
where not exists (
    select 1 from public.nomina_contractor_payments p2
    where p2.contractor_id = c.id and p2.concept = x.concept and p2.paid_on = x.paid_on::date
  );
