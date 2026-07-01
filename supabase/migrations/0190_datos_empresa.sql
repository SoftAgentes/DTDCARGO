-- ─────────────────────────────────────────────────────────────
-- 0190 · SDD-0120 · Datos de la empresa (Administración → BÁSICO)
--   tenants += identidad fiscal + contacto + tasas de impuesto
--   company_offices        (oficinas CN/VE, 1-a-N)
--   company_bank_accounts  (cuentas bancarias que salen en facturas, 1-a-N)
--
-- Primera sección real de /studio/admin (hoy placeholder). Modela la
-- configuración global de la empresa que consumen facturación, documentos y
-- el pie de las cotizaciones: identificación fiscal (RIF, razón social),
-- oficinas, datos bancarios e impuestos (IVA / ISLR / IGTF).
--
-- Decisiones:
--   · Identidad fiscal + tasas → columnas en `tenants` (1-a-1 con el tenant;
--     `iva_enabled` ya existía, acá se suma la tasa y las otras dos).
--   · Oficinas y bancos → tablas propias (1-a-N). Soft-delete + sort_order.
--   · Edición gateada a rol admin en la app (moduleEditDenial "admin");
--     RLS por tenant es el aislamiento duro. Patrón del repo.
--
-- Convención del repo: enums lógicos = text + CHECK. RLS por tenant. Grants
-- explícitos (auto-expose OFF). touch_updated_at() para updated_at.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder. Skills Supabase (seguridad + postgres-best-practices)
-- seguidos.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Identidad fiscal + contacto + tasas en tenants ─────────
alter table public.tenants
  add column if not exists legal_name       text,   -- razón social (fiscal)
  add column if not exists trade_name       text,   -- nombre comercial
  add column if not exists rif              text,   -- J-30182554-9
  add column if not exists commercial_email text,
  add column if not exists phone            text,
  add column if not exists whatsapp         text,
  add column if not exists website          text,
  -- Tasas vigentes (%). `iva_enabled` ya existe (activa/desactiva el IVA);
  -- estas son las magnitudes que usan facturación / costing.
  add column if not exists iva_rate  numeric(5,2) not null default 16
    constraint tenants_iva_rate_chk  check (iva_rate  >= 0 and iva_rate  <= 100),
  add column if not exists islr_rate numeric(5,2) not null default 3
    constraint tenants_islr_rate_chk check (islr_rate >= 0 and islr_rate <= 100),
  add column if not exists igtf_rate numeric(5,2) not null default 3
    constraint tenants_igtf_rate_chk check (igtf_rate >= 0 and igtf_rate <= 100);

comment on column public.tenants.legal_name is
  'SDD-0120: razón social fiscal (aparece en facturas). Distinta de display_name (etiqueta interna del ERP).';
comment on column public.tenants.rif is
  'SDD-0120: RIF venezolano (formato J-NNNNNNNN-N). Validado en la app, nullable en DB.';
comment on column public.tenants.iva_rate is
  'SDD-0120: tasa de IVA vigente (%). iva_enabled (existente) prende/apaga; esta es la magnitud.';

-- ── 2. Oficinas (1-a-N) ───────────────────────────────────────
create table if not exists public.company_offices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,

  -- País de la oficina. El founder opera CN↔VE; se restringe a esos dos.
  country     text not null
    constraint company_offices_country_chk check (country in ('VE', 'CN')),
  name        text not null,   -- "Caracas · HQ", "Yiwu · 义乌办公室"
  address     text not null,

  sort_order  int  not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.company_offices is
  'SDD-0120: oficinas de la empresa (CN/VE). 1-a-N por tenant. Soft delete + sort_order. RLS por tenant.';

create index if not exists company_offices_tenant_idx
  on public.company_offices (tenant_id, sort_order) where deleted_at is null;

grant select, insert, update on public.company_offices to authenticated;
revoke all on public.company_offices from anon;

alter table public.company_offices enable row level security;
create policy "company_offices by tenant" on public.company_offices for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger company_offices_touch
  before update on public.company_offices
  for each row execute function public.touch_updated_at();

-- ── 3. Cuentas bancarias (1-a-N) ──────────────────────────────
create table if not exists public.company_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  bank_name       text not null,   -- "Banco Mercantil"
  account_type    text not null,   -- "Cta. Corriente", "Cta. Ahorro" (libre)
  currency        text not null
    constraint company_bank_accounts_currency_chk check (currency in ('USD', 'VES', 'CNY')),
  account_number  text not null,

  sort_order      int  not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.company_bank_accounts is
  'SDD-0120: cuentas bancarias de la empresa (aparecen en facturas). 1-a-N por tenant. Soft delete. RLS por tenant.';

create index if not exists company_bank_accounts_tenant_idx
  on public.company_bank_accounts (tenant_id, sort_order) where deleted_at is null;

grant select, insert, update on public.company_bank_accounts to authenticated;
revoke all on public.company_bank_accounts from anon;

alter table public.company_bank_accounts enable row level security;
create policy "company_bank_accounts by tenant" on public.company_bank_accounts for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger company_bank_accounts_touch
  before update on public.company_bank_accounts
  for each row execute function public.touch_updated_at();

-- Sin seed: la identidad fiscal, oficinas y bancos los carga el admin desde
-- /studio/admin?section=company (EmptyState cubre el vacío). Nada de datos
-- reales de la empresa hardcodeados en git.
