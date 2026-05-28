-- ─────────────────────────────────────────────────────────────
-- Plan v4 · Phase B — Tabla seo_drafts
--
-- Persistencia del state machine del Generador de Noticias Web
-- (4 steps: Tipo → Tema+Categoría → Bullets → Artículo).
--
-- Permite retomar borradores a medio terminar sin perder trabajo.
-- En modo Auto el draft se persiste al apretar "Generar" en cada step.
-- En modo Manual se persiste al pegar la respuesta del LLM.
--
-- RLS: solo admins del tenant pueden CRUD sus drafts.
-- ─────────────────────────────────────────────────────────────

create table public.seo_drafts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  -- State machine
  topic               text not null,
  tone                text not null check (tone in ('informativo','curiosidad','polemico')),
  tipo                text check (tipo in ('informativo','curiosidad','polemica','especial')),
  categoria           text check (categoria in (
    'operaciones','tarifas-fletes','aduana-seniat','tutoriales-guias',
    'china','industria-global','casos-reales',
    'analisis-opinion','mitos-realidades','anuncios-dtd'
  )),
  ai_suggestion_reason text,
  -- Outputs
  headlines           jsonb not null default '[]'::jsonb,
  selected_headline   text,
  bullets             jsonb not null default '[]'::jsonb,
  article_markdown    text,
  -- SEO
  focus_keyword       text,
  secondary_keywords  jsonb not null default '[]'::jsonb,
  pain_points         jsonb not null default '[]'::jsonb,
  -- Lifecycle
  current_step        int not null default 0 check (current_step between 0 and 3),
  status              text not null default 'draft' check (status in ('draft','published','archived')),
  -- Meta
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid not null references auth.users(id) on delete cascade
);

comment on table public.seo_drafts is
  'Borradores del Generador de Noticias Web. State machine completa persistida para retomar entre sesiones. Plan v4.';

create index seo_drafts_tenant_updated_idx
  on public.seo_drafts (tenant_id, updated_at desc);

create index seo_drafts_status_idx
  on public.seo_drafts (status) where status = 'draft';

-- Trigger: auto-actualizar updated_at
create or replace function public.seo_drafts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger seo_drafts_touch_updated_at_trg
  before update on public.seo_drafts
  for each row execute function public.seo_drafts_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.seo_drafts enable row level security;

-- Admin del tenant puede CRUD sus drafts
create policy seo_drafts_admin_select on public.seo_drafts
  for select using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = seo_drafts.tenant_id
    )
  );

create policy seo_drafts_admin_insert on public.seo_drafts
  for insert with check (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = seo_drafts.tenant_id
    )
  );

create policy seo_drafts_admin_update on public.seo_drafts
  for update using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = seo_drafts.tenant_id
    )
  );

create policy seo_drafts_admin_delete on public.seo_drafts
  for delete using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = seo_drafts.tenant_id
    )
  );

-- ─── GRANTs ──────────────────────────────────────────────────
grant select, insert, update, delete on public.seo_drafts to authenticated;
