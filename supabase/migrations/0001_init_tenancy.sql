-- ─────────────────────────────────────────────────────────────
-- SDD-0004 Fase 1: tenancy mínimo para DoorTuDoor
-- Tablas: tenants + user_tenants
-- Helper function: get_user_tenant_id() para usar en RLS policies
-- RLS habilitado fail-closed (sin policy = nadie ve nada)
-- Seed: tenant DTD único por ahora
-- ─────────────────────────────────────────────────────────────

-- Tabla tenants: empresas que usan el ERP. DTD es la primera.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  brand_primary text not null default '#7F0F1A',
  brand_secondary text not null default '#0F1E3D',
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

comment on table public.tenants is 'Empresas que usan el ERP. Cada una es un tenant aislado por RLS.';

-- Asociación user ↔ tenant. Hoy es 1:1, preparada para N:M en HailuWay.
create table public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

comment on table public.user_tenants is 'Membresia de usuarios en tenants. Role granular vendra en SDDs futuros.';

-- Helper: devuelve el tenant_id del usuario actual
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = auth.uid()
  limit 1;
$$;

comment on function public.get_user_tenant_id is
  'Helper para RLS policies. Devuelve el tenant_id del usuario autenticado.';

-- Grants explicitos: "Automatically expose new tables" esta desactivado en
-- el proyecto Supabase, por lo que cada tabla necesita grants manuales para
-- que el rol `authenticated` pueda llegar a ejecutar SELECT.
-- RLS sigue siendo la capa de seguridad real (filtra que filas se ven).
grant select on public.tenants to authenticated;
grant select on public.user_tenants to authenticated;
grant execute on function public.get_user_tenant_id() to authenticated;

-- RLS habilitado en ambas tablas
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;

-- Policy: usuarios ven solo su tenant
create policy "users see their tenant"
  on public.tenants for select
  to authenticated
  using (id = public.get_user_tenant_id());

-- Policy: usuarios ven solo sus propias membresias
create policy "users see their own user_tenants"
  on public.user_tenants for select
  to authenticated
  using (user_id = auth.uid());

-- Seed: tenant DTD (el unico hoy)
insert into public.tenants (slug, display_name)
values ('dtd', 'DTD·CARGO')
on conflict (slug) do nothing;
