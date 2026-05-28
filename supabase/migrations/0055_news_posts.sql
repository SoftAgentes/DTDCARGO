-- ─────────────────────────────────────────────────────────────
-- Plan v4 · Phase B — Tabla news_posts (reemplaza NEWS_POSTS hardcoded)
--
-- Cada post publicado a /noticias vive acá. RLS permite SELECT anon
-- solo para published=true (lectura pública), writes solo admin tenant.
--
-- Schema incluye:
--   - tipo (4 valores) + categoria (10 valores)
--   - SEO: focus_keyword, secondary_keywords, meta_description, pain_points
--   - Autoría: author_name, author_role (nullable)
--   - Source tracking: 'manual' | 'seo-generator'
--   - Soft delete via published=false
-- ─────────────────────────────────────────────────────────────

create table public.news_posts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  slug                text not null,
  -- Clasificación
  tipo                text not null check (tipo in ('informativo','curiosidad','polemica','especial')),
  categoria           text not null check (categoria in (
    'operaciones','tarifas-fletes','aduana-seniat','tutoriales-guias',
    'china','industria-global','casos-reales',
    'analisis-opinion','mitos-realidades','anuncios-dtd'
  )),
  -- Contenido
  title               text not null,
  excerpt             text not null,
  body_markdown       text not null,
  -- Autoría
  author_name         text not null default 'DTD Cargo',
  author_role         text,
  -- SEO (Plan v4 — SEO-first)
  focus_keyword       text,
  secondary_keywords  jsonb not null default '[]'::jsonb,
  meta_description    text,
  pain_points         jsonb not null default '[]'::jsonb,
  -- Meta
  date                date not null default current_date,
  read_time_min       int not null default 5,
  published           boolean not null default true,
  source              text not null default 'manual' check (source in ('manual','seo-generator')),
  -- Lifecycle
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  unique (slug)
);

comment on table public.news_posts is
  'Posts publicados en /noticias. Plan v4 — reemplaza array NEWS_POSTS de design-tokens.ts. RLS: anon SELECT solo published, admin tenant para writes.';

create unique index news_posts_slug_idx on public.news_posts (slug);
create index news_posts_tipo_date_idx on public.news_posts (tipo, date desc);
create index news_posts_categoria_date_idx on public.news_posts (categoria, date desc);
create index news_posts_published_date_idx on public.news_posts (published, date desc) where published = true;
create index news_posts_focus_keyword_idx on public.news_posts (focus_keyword) where focus_keyword is not null;

-- Trigger: auto-actualizar updated_at
create or replace function public.news_posts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger news_posts_touch_updated_at_trg
  before update on public.news_posts
  for each row execute function public.news_posts_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.news_posts enable row level security;

-- Public anon: SELECT solo para published=true
create policy news_posts_public_select on public.news_posts
  for select using (published = true);

-- Admin del tenant: full CRUD
create policy news_posts_admin_insert on public.news_posts
  for insert with check (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_posts.tenant_id
    )
  );

create policy news_posts_admin_update on public.news_posts
  for update using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_posts.tenant_id
    )
  );

create policy news_posts_admin_delete on public.news_posts
  for delete using (
    exists (
      select 1 from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.role = 'admin'
        and ut.tenant_id = news_posts.tenant_id
    )
  );

-- ─── GRANTs ──────────────────────────────────────────────────
-- anon: solo SELECT (RLS limita a published=true)
grant select on public.news_posts to anon;
-- authenticated: SELECT + write (RLS limita writes a admin tenant)
grant select, insert, update, delete on public.news_posts to authenticated;
