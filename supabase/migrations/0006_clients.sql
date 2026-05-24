-- ─────────────────────────────────────────────────────────────
-- SDD-0010: catálogo de clientes + MARKBOX autogenerado
-- Tabla clients + enum client_tier + función next_markbox() + RLS + seed
-- Reusa get_user_tenant_id() y touch_updated_at() de migrations previas
-- ─────────────────────────────────────────────────────────────

create type client_tier as enum ('regular', 'vip', 'premium');

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  markbox     text not null,                          -- "DTD-NNNN" (autogenerado)
  name        text not null,
  email       text,
  phone       text,
  address     text,
  rif         text,                                   -- "J-12345678-9" (formato VE)
  tier        client_tier not null default 'regular',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (tenant_id, markbox)
);

comment on table public.clients is
  'Catálogo de clientes del tenant. MARKBOX como ID estable. Soft delete via deleted_at. RLS por tenant_id.';

create index clients_tenant_tier_idx
  on public.clients (tenant_id, tier) where deleted_at is null;

create index clients_tenant_name_idx
  on public.clients (tenant_id, name) where deleted_at is null;

-- Función atómica que devuelve el próximo MARKBOX para un tenant.
-- Usa MAX del número parseado (regexp) en lugar de COUNT para tolerar
-- markboxes históricos no-secuenciales (e.g. DTD-1001 del seed de shipments).
-- Padding 4 dígitos; si pasa de 9999 se extiende automáticamente.
create or replace function public.next_markbox(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.clients
  where tenant_id = p_tenant_id;

  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-' || v_padded;
end;
$$;

comment on function public.next_markbox is
  'Genera el próximo MARKBOX para el tenant. MAX(num) + 1 con padding 4. Tolera markboxes no-secuenciales.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF)
grant select, insert, update, delete on public.clients to authenticated;
grant execute on function public.next_markbox(uuid) to authenticated;

-- RLS por tenant
alter table public.clients enable row level security;

create policy "clients by tenant"
  on public.clients for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at (reusa function existente)
create trigger clients_touch
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- Seed: 6 clientes matching los client_markbox actuales de shipments (DTD-1001..1006)
-- para que el "histórico de envíos" del detalle del cliente tenga data desde día 1.
insert into public.clients (tenant_id, markbox, name, email, phone, tier, rif, notes)
select t.id, x.markbox, x.name, x.email, x.phone, x.tier::client_tier, x.rif, x.notes
from public.tenants t
cross join (values
  ('DTD-1001', 'Empresa Demo S.A.',  'compras@demosa.com.ve',      '+58 414 1234567', 'vip',     'J-12345678-9', 'Cliente histórico desde 2020'),
  ('DTD-1002', 'Carga Ejemplo C.A.', 'logistica@cargaejemplo.com', '+58 412 7654321', 'regular', 'J-87654321-0', null),
  ('DTD-1003', 'Tenant Prueba SRL',  null,                          '+58 414 5550000', 'regular', null,           'Cliente regional, 3 envíos/mes'),
  ('DTD-1004', 'Demo Pyme C.A.',     'demo@localpyme.ve',           null,              'premium', 'V-12345678',   'Pyme alto volumen Q1 2026'),
  ('DTD-1005', 'Tenant Industrial',  'industrial@tenant.com.ve',    '+58 412 8888888', 'vip',     'J-99999999-9', 'Industria con FCL frecuente'),
  ('DTD-1006', 'Demo Local Pyme',    'local@pyme.ve',               '+58 412 9999999', 'regular', 'J-11112222-3', 'Pyme local Maracaibo')
) as x(markbox, name, email, phone, tier, rif, notes)
where t.slug = 'dtd'
on conflict (tenant_id, markbox) do nothing;
