-- ─────────────────────────────────────────────────────────────
-- Plan v4 · Phase B — Tabla news_writers + seed 4 escritores
--
-- Escritores externos asignados por TIPO editorial. La rotación FIFO
-- entre escritores del mismo tipo se calcula desde news_posts.created_at
-- en lib/news/writers.ts (no se persiste estado de rotación).
--
-- Mapping:
--   informativo → Miguel Arriaga
--   curiosidad  → Adriana Angola Pérez ↔ Claudia Patricia Belén (FIFO)
--   polemica    → Ernesto Piñérez
--   especial    → (sin writer · DTD Cargo directo, no disclaimer)
-- ─────────────────────────────────────────────────────────────

create table public.news_writers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  tipo            text not null check (tipo in ('informativo','curiosidad','polemica','especial')),
  active          boolean not null default true,
  display_order   int not null default 0,
  -- Metadata futura (foto, bio, link) queda nullable
  bio             text,
  photo_url       text,
  external_link   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.news_writers is
  'Escritores externos asignados por tipo editorial. Plan v4 — sumar/desactivar desde Studio en v5+.';

create index news_writers_tipo_active_idx
  on public.news_writers (tipo, active, display_order);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.news_writers enable row level security;

create policy news_writers_admin_select on public.news_writers
  for select using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
    )
  );

create policy news_writers_admin_insert on public.news_writers
  for insert with check (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_writers.tenant_id
    )
  );

create policy news_writers_admin_update on public.news_writers
  for update using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_writers.tenant_id
    )
  );

create policy news_writers_admin_delete on public.news_writers
  for delete using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_writers.tenant_id
    )
  );

-- ─── GRANTs ──────────────────────────────────────────────────
grant select, insert, update, delete on public.news_writers to authenticated;

-- ─── Seed: 4 escritores externos ─────────────────────────────
-- Aplica para todos los tenants existentes (en práctica, 1 — DTD).
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.news_writers (tenant_id, name, tipo, active, display_order) values
      (v_tenant.id, 'Miguel Arriaga',         'informativo', true, 1),
      (v_tenant.id, 'Adriana Angola Pérez',   'curiosidad',  true, 1),
      (v_tenant.id, 'Claudia Patricia Belén', 'curiosidad',  true, 2),
      (v_tenant.id, 'Ernesto Piñérez',        'polemica',    true, 1)
    on conflict do nothing;
  end loop;
end $$;
