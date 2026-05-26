-- ─────────────────────────────────────────────────────────────
-- 0030 · Back de administración de contenido del sitio público
--
-- Crea el dominio back_* para gestionar lo que hoy vive hardcoded en
-- lib/design-tokens.ts. Sin re-deploy: admin/diseñador/editor editan
-- vía /back y el sitio público lee de Supabase.
--
-- Arquitectura (acordada con founder):
--   - Identity layer: REUSA auth.users + tenants + user_tenants del Studio.
--     Un user puede ser admin del Studio Y admin del back, mismo user_id.
--   - Domain layer: tablas back_* nuevas, separadas físicamente del Studio.
--     RLS policies aisladas; ningún query del Studio tocará estas tablas.
--
-- Tablas creadas (en orden de dependencia):
--   1. back_user_roles    · enum back_role + tabla user × tenant × role
--   2. back_assets        · media library (apunta a Supabase Storage)
--   3. back_servicios     · 16 servicios (SERVICES_CN + SERVICES_VE de design-tokens)
--   4. back_noticias      · posts del blog (NEWS_POSTS)
--   5. back_glosario      · términos del glosario (GLOSSARY_TERMS)
--   6. back_revisions     · audit log de quién editó qué y cuándo
--
-- RLS strategy:
--   - SELECT abierto a authenticated CON back role asignado en su tenant
--   - INSERT/DELETE: admin only
--   - UPDATE: admin + diseñador + editor (field-level whitelist lo enforce
--     el server action, RLS solo verifica que tenga ALGÚN rol)
--
-- Seed: NO incluido en esta migración. El seed inicial (mover los 16 servicios,
-- 3 noticias, 50 términos de glosario desde lib/design-tokens.ts → Supabase)
-- va en una migración separada (0031_back_initial_seed.sql) o un script tsx.
-- ─────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- A. ROLES — quién puede entrar al back y con qué nivel
-- ═════════════════════════════════════════════════════════════

create type back_role as enum ('admin', 'disenador', 'editor');

comment on type back_role is
  'Roles del back de administración del sitio público dtdcargo.com. ' ||
  'admin = CRUD full; disenador = solo campos visuales; editor = solo texto.';

create table public.back_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role back_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  primary key (user_id, tenant_id, role)
);

comment on table public.back_user_roles is
  'Asignación de back roles. Un user puede tener varios roles (admin + editor) ' ||
  'simultaneamente. PK compuesto evita duplicados.';

create index back_user_roles_tenant_role_idx
  on public.back_user_roles (tenant_id, role);

-- Helper: ¿el user actual tiene este rol específico en su tenant?
create or replace function public.has_back_role(check_role back_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.back_user_roles
    where user_id = auth.uid()
      and tenant_id = public.get_user_tenant_id()
      and role = check_role
  );
$$;

comment on function public.has_back_role(back_role) is
  'Usar en RLS policies y server actions para gatekeep operaciones por rol.';

-- Helper: ¿el user actual tiene CUALQUIER rol del back (= puede entrar)?
create or replace function public.has_any_back_role()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.back_user_roles
    where user_id = auth.uid()
      and tenant_id = public.get_user_tenant_id()
  );
$$;

-- ═════════════════════════════════════════════════════════════
-- B. ASSETS — biblioteca de media (apunta a Supabase Storage)
-- ═════════════════════════════════════════════════════════════
-- Va ANTES de back_noticias porque noticias.cover_asset_id le hace FK.

create table public.back_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,  -- path dentro del bucket Supabase Storage
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width int,                    -- nullable para audios/PDFs
  height int,
  alt_text text,                -- a11y · obligatorio en UI, opcional en DB para migrar
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id),
  unique (tenant_id, storage_path)
);

comment on table public.back_assets is
  'Biblioteca de imágenes y archivos que el back gestiona. storage_path apunta ' ||
  'a un objeto en el bucket "back-assets" de Supabase Storage.';

create index back_assets_tenant_uploaded_idx
  on public.back_assets (tenant_id, uploaded_at desc);

-- ═════════════════════════════════════════════════════════════
-- C. SERVICIOS — mirror del array Service[] de design-tokens.ts
-- ═════════════════════════════════════════════════════════════

create table public.back_servicios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,                                    -- ej "reserva-contenedores"
  location text not null check (location in ('cn', 've')),
  title text not null,
  subtitle text,                                         -- nullable
  copy text not null,
  benefit text not null,
  icon text not null,                                    -- nombre del icon component
  featured boolean not null default false,
  sort_order int not null default 0,                     -- orden display
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (tenant_id, slug)
);

comment on table public.back_servicios is
  'Catálogo de servicios visible en /servicios. Mirror del tipo Service de ' ||
  'lib/design-tokens.ts. Source of truth a partir de la migración del seed inicial.';

create index back_servicios_tenant_location_sort_idx
  on public.back_servicios (tenant_id, location, sort_order);

-- ═════════════════════════════════════════════════════════════
-- D. NOTICIAS — posts del blog (NEWS_POSTS)
-- ═════════════════════════════════════════════════════════════

create table public.back_noticias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text not null,
  body text[],                                            -- array de párrafos (nullable = "coming soon")
  cover_asset_id uuid references public.back_assets(id) on delete set null,
  category text not null,                                 -- 'industria', 'guias', 'casos', etc.
  date date not null,                                     -- fecha de publicación
  read_time_min int not null default 5,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (tenant_id, slug)
);

comment on table public.back_noticias is
  'Posts del blog visible en /noticias. body=null significa "próximamente" ' ||
  '(renderiza el ComingSoonBlock en el frontend).';

create index back_noticias_tenant_date_idx
  on public.back_noticias (tenant_id, date desc);

create index back_noticias_tenant_category_idx
  on public.back_noticias (tenant_id, category);

-- ═════════════════════════════════════════════════════════════
-- E. GLOSARIO — términos visible en /glosario
-- ═════════════════════════════════════════════════════════════

create table public.back_glosario (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  term_id text not null,                                  -- id slug-style del término (no UUID)
  term text not null,                                     -- el término en sí ("FCL")
  acronym text,                                           -- "Full Container Load" (opcional)
  category text not null,                                 -- 'incoterms', 'documentos', etc.
  body text[] not null,                                   -- array de párrafos (puede tener <b>X</b>)
  analogy_label text,                                     -- "Analogía", "Como cuando..." etc
  analogy_text text,                                      -- el contenido de la analogía
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (tenant_id, term_id)
);

comment on table public.back_glosario is
  'Términos del glosario visible en /glosario. body y analogy mantienen el ' ||
  'mismo formato que GLOSSARY_TERMS de lib/design-tokens.ts.';

create index back_glosario_tenant_category_sort_idx
  on public.back_glosario (tenant_id, category, sort_order);

-- ═════════════════════════════════════════════════════════════
-- F. REVISIONS — audit log de quién editó qué y cuándo
-- ═════════════════════════════════════════════════════════════

create table public.back_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('servicio', 'noticia', 'glosario', 'asset')
  ),
  entity_id uuid not null,                                -- id del item afectado
  action text not null check (
    action in ('create', 'update', 'delete', 'publish', 'unpublish')
  ),
  changes jsonb,                                          -- diff: { "field": ["old", "new"] }
  performed_at timestamptz not null default now(),
  performed_by uuid not null references auth.users(id)
);

comment on table public.back_revisions is
  'Audit log de ediciones en back_*. Usado para "actividad reciente" del ' ||
  'dashboard y para trazabilidad ante errores ("quién publicó esto?").';

create index back_revisions_tenant_entity_idx
  on public.back_revisions (tenant_id, entity_type, entity_id, performed_at desc);

create index back_revisions_tenant_recent_idx
  on public.back_revisions (tenant_id, performed_at desc);

-- ═════════════════════════════════════════════════════════════
-- G. updated_at TRIGGER — bumpea automático en cada UPDATE
-- ═════════════════════════════════════════════════════════════

create or replace function public.tg_back_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger back_servicios_set_updated_at
  before update on public.back_servicios
  for each row execute function public.tg_back_set_updated_at();

create trigger back_noticias_set_updated_at
  before update on public.back_noticias
  for each row execute function public.tg_back_set_updated_at();

create trigger back_glosario_set_updated_at
  before update on public.back_glosario
  for each row execute function public.tg_back_set_updated_at();

-- ═════════════════════════════════════════════════════════════
-- H. GRANTS + RLS — fail-closed por default, abrir solo lo necesario
-- ═════════════════════════════════════════════════════════════

-- Grants explícitos al rol authenticated (regla post-SDD-0004 del Studio).
grant select on public.back_user_roles to authenticated;
grant select, insert, update, delete on public.back_assets to authenticated;
grant select, insert, update, delete on public.back_servicios to authenticated;
grant select, insert, update, delete on public.back_noticias to authenticated;
grant select, insert, update, delete on public.back_glosario to authenticated;
grant select, insert on public.back_revisions to authenticated;
grant execute on function public.has_back_role(back_role) to authenticated;
grant execute on function public.has_any_back_role() to authenticated;

-- También para anon (público) — solo SELECT de las tablas de contenido publicado,
-- porque eventualmente el sitio público va a leer directo de acá vía
-- supabase-js client-side (o vía server-side anon client).
grant select on public.back_servicios to anon;
grant select on public.back_noticias to anon;
grant select on public.back_glosario to anon;

-- Habilitar RLS fail-closed en todas las tablas back_*.
alter table public.back_user_roles enable row level security;
alter table public.back_assets enable row level security;
alter table public.back_servicios enable row level security;
alter table public.back_noticias enable row level security;
alter table public.back_glosario enable row level security;
alter table public.back_revisions enable row level security;

-- ─── back_user_roles policies ───
-- SELECT: solo el admin del tenant ve las asignaciones de roles
create policy "admin sees user roles in tenant"
  on public.back_user_roles for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );

-- ─── back_assets policies ───
-- SELECT: cualquier rol del back puede ver assets
create policy "back users see tenant assets"
  on public.back_assets for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
-- INSERT/UPDATE/DELETE: admin + diseñador (no editor)
create policy "admin and disenador write assets"
  on public.back_assets for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (public.has_back_role('admin') or public.has_back_role('disenador'))
  );
create policy "admin and disenador update assets"
  on public.back_assets for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and (public.has_back_role('admin') or public.has_back_role('disenador'))
  );
create policy "admin deletes assets"
  on public.back_assets for delete
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );

-- ─── back_servicios policies ───
-- SELECT autenticado: cualquier back role
create policy "back users see tenant servicios"
  on public.back_servicios for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
-- SELECT anon (público): solo published (para que el sitio lea directo)
create policy "anon sees published servicios"
  on public.back_servicios for select
  to anon
  using (is_published = true);
-- INSERT: admin only
create policy "admin inserts servicios"
  on public.back_servicios for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );
-- UPDATE: admin + diseñador + editor (field-level whitelist en server action)
create policy "any back role updates servicios"
  on public.back_servicios for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
-- DELETE: admin only
create policy "admin deletes servicios"
  on public.back_servicios for delete
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );

-- ─── back_noticias policies (mismo patrón que servicios) ───
create policy "back users see tenant noticias"
  on public.back_noticias for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
create policy "anon sees published noticias"
  on public.back_noticias for select
  to anon
  using (is_published = true);
create policy "admin and editor insert noticias"
  on public.back_noticias for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (public.has_back_role('admin') or public.has_back_role('editor'))
  );
create policy "any back role updates noticias"
  on public.back_noticias for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
create policy "admin deletes noticias"
  on public.back_noticias for delete
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );

-- ─── back_glosario policies (mismo patrón) ───
create policy "back users see tenant glosario"
  on public.back_glosario for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
create policy "anon sees published glosario"
  on public.back_glosario for select
  to anon
  using (is_published = true);
create policy "admin and editor insert glosario"
  on public.back_glosario for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and (public.has_back_role('admin') or public.has_back_role('editor'))
  );
create policy "any back role updates glosario"
  on public.back_glosario for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
create policy "admin deletes glosario"
  on public.back_glosario for delete
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_back_role('admin')
  );

-- ─── back_revisions policies ───
-- SELECT: cualquier back role (transparencia interna)
create policy "back users see tenant revisions"
  on public.back_revisions for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
  );
-- INSERT: cualquier back role (al editar se loggea la revisión)
create policy "back users insert their own revisions"
  on public.back_revisions for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and public.has_any_back_role()
    and performed_by = auth.uid()
  );
-- UPDATE/DELETE: NUNCA — el audit log es append-only.

-- ═════════════════════════════════════════════════════════════
-- DONE. Próximas migraciones planeadas:
--   0031_back_initial_seed.sql       (mover SERVICES_CN+VE, NEWS_POSTS,
--                                     GLOSSARY_TERMS de design-tokens a DB)
--   0032_back_assets_storage.sql     (crear bucket back-assets en Storage
--                                     + policies de upload)
-- ═════════════════════════════════════════════════════════════
