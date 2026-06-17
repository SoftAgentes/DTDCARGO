-- ─────────────────────────────────────────────────────────────
-- 0144 · SDD-0093 · Academia DTD — fundación del módulo de formación
--
-- Catálogo on-demand (courses → modules → lessons) + cohortes en vivo
-- (cohorts → enrollments → attendance) + diplomas, con conexión al PORTAL del
-- cliente (enrollments/diplomas llevan client_markbox + policy portal SELECT,
-- patrón shipment_documents) y verificación pública por folio (RPC anon).
--
-- Convención del repo: enums lógicos = text + CHECK (no pg enums). RLS por tenant
-- (Studio) + policy SELECT por client_markbox (portal). Soft-delete. El PRECIO del
-- curso NO vive acá: se gestiona como servicio (service_configs, SDD-0076) vía
-- courses.service_key → cuenta de ingresos (gate por rol, SDD-0085).
--
-- Idempotente (create if not exists). NO aplicar a prod desde la rama — la aplica
-- coordinación. Skills Supabase (seguridad + postgres-best-practices) seguidos.
-- ─────────────────────────────────────────────────────────────

-- ── 1) academy_courses (catálogo) ────────────────────────────
create table if not exists public.academy_courses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  title       text not null,
  tier        text not null default 'inicial',
  summary     text,
  level       text,
  service_key text,                          -- → service_configs (precio + contabilidad); NULL = aún sin servicio
  status      text not null default 'borrador',
  sort        integer not null default 0,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  deleted_at  timestamptz,
  constraint academy_courses_tier_chk check (tier in ('gratis','inicial','core','pro','complemento')),
  constraint academy_courses_status_chk check (status in ('borrador','proximamente','publicado'))
);
comment on table public.academy_courses is
  'Catálogo de cursos de la Academia DTD (SDD-0093). El precio/contabilidad vive en service_configs vía service_key (gate por rol SDD-0085). 100% ERP-side (revoke anon).';
create unique index if not exists academy_courses_slug_uniq
  on public.academy_courses (tenant_id, slug) where deleted_at is null;
create index if not exists idx_academy_courses_status
  on public.academy_courses (tenant_id, status) where deleted_at is null;
grant select, insert, update on public.academy_courses to authenticated;
revoke all on public.academy_courses from anon;
alter table public.academy_courses enable row level security;
create policy "academy_courses by tenant" on public.academy_courses for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create trigger academy_courses_touch
  before update on public.academy_courses
  for each row execute function public.touch_updated_at();

-- ── 2) academy_modules ───────────────────────────────────────
create table if not exists public.academy_modules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  course_id   uuid not null references public.academy_courses(id) on delete cascade,
  title       text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  deleted_at  timestamptz
);
comment on table public.academy_modules is 'Módulos de un curso (SDD-0093).';
create index if not exists idx_academy_modules_course on public.academy_modules (course_id) where deleted_at is null;
grant select, insert, update on public.academy_modules to authenticated;
revoke all on public.academy_modules from anon;
alter table public.academy_modules enable row level security;
create policy "academy_modules by tenant" on public.academy_modules for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create trigger academy_modules_touch
  before update on public.academy_modules
  for each row execute function public.touch_updated_at();

-- ── 3) academy_lessons ───────────────────────────────────────
create table if not exists public.academy_lessons (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  module_id    uuid not null references public.academy_modules(id) on delete cascade,
  course_id    uuid not null references public.academy_courses(id) on delete cascade,  -- denorm para scope/queries
  title        text not null,
  sort         integer not null default 0,
  kind         text not null default 'video',
  video_url    text,
  asset_path   text,
  duration_min integer,
  free_preview boolean not null default false,
  status       text not null default 'borrador',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  deleted_at   timestamptz,
  constraint academy_lessons_kind_chk check (kind in ('video','texto','descarga','quiz')),
  constraint academy_lessons_status_chk check (status in ('borrador','publicado'))
);
comment on table public.academy_lessons is 'Lecciones de un módulo (SDD-0093). free_preview = visible sin compra.';
create index if not exists idx_academy_lessons_module on public.academy_lessons (module_id) where deleted_at is null;
create index if not exists idx_academy_lessons_course on public.academy_lessons (course_id) where deleted_at is null;
grant select, insert, update on public.academy_lessons to authenticated;
revoke all on public.academy_lessons from anon;
alter table public.academy_lessons enable row level security;
create policy "academy_lessons by tenant" on public.academy_lessons for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create trigger academy_lessons_touch
  before update on public.academy_lessons
  for each row execute function public.touch_updated_at();

-- ── 4) academy_cohorts (en vivo) ─────────────────────────────
create table if not exists public.academy_cohorts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  course_id        uuid references public.academy_courses(id) on delete set null,  -- NULL = evento standalone
  name             text not null,
  hours            integer,
  sessions         integer not null default 1,
  modality         text not null default 'presencial',
  place            text,
  starts_at        date,
  facilitator_name text,
  status           text not null default 'proximamente',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id),
  deleted_at       timestamptz,
  constraint academy_cohorts_modality_chk check (modality in ('presencial','online')),
  constraint academy_cohorts_status_chk check (status in ('proximamente','en_curso','completado'))
);
comment on table public.academy_cohorts is 'Cohortes en vivo de un curso (SDD-0093, port del Norte academia.js).';
create index if not exists idx_academy_cohorts_course on public.academy_cohorts (tenant_id, course_id) where deleted_at is null;
grant select, insert, update on public.academy_cohorts to authenticated;
revoke all on public.academy_cohorts from anon;
alter table public.academy_cohorts enable row level security;
create policy "academy_cohorts by tenant" on public.academy_cohorts for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create trigger academy_cohorts_touch
  before update on public.academy_cohorts
  for each row execute function public.touch_updated_at();

-- ── 5) academy_enrollments (inscritos) ───────────────────────
create table if not exists public.academy_enrollments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  course_id      uuid not null references public.academy_courses(id) on delete cascade,
  cohort_id      uuid references public.academy_cohorts(id) on delete set null,  -- NULL = on-demand
  client_markbox text,                       -- enlaza con el cliente del portal
  student_name   text not null,
  student_ci     text,
  student_email  text,
  progress_pct   integer not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id),
  deleted_at     timestamptz
);
comment on table public.academy_enrollments is 'Inscripciones a un curso/cohorte (SDD-0093). client_markbox conecta con el portal (RLS portal SELECT).';
create index if not exists idx_academy_enrollments_course on public.academy_enrollments (course_id) where deleted_at is null;
create index if not exists idx_academy_enrollments_cohort on public.academy_enrollments (cohort_id) where deleted_at is null;
create index if not exists idx_academy_enrollments_markbox on public.academy_enrollments (tenant_id, client_markbox) where deleted_at is null;
grant select, insert, update on public.academy_enrollments to authenticated;
revoke all on public.academy_enrollments from anon;
alter table public.academy_enrollments enable row level security;
create policy "academy_enrollments by tenant" on public.academy_enrollments for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "academy_enrollments portal self read" on public.academy_enrollments for select
  to authenticated
  using (deleted_at is null and client_markbox is not null and client_markbox = public.get_portal_client_markbox());
create trigger academy_enrollments_touch
  before update on public.academy_enrollments
  for each row execute function public.touch_updated_at();

-- ── 6) academy_attendance (asistencia) ───────────────────────
create table if not exists public.academy_attendance (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  cohort_id     uuid not null references public.academy_cohorts(id) on delete cascade,
  enrollment_id uuid not null references public.academy_enrollments(id) on delete cascade,
  session_num   integer not null,
  attended      boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint academy_attendance_uniq unique (enrollment_id, session_num)
);
comment on table public.academy_attendance is 'Asistencia por sesión (SDD-0093). ≥75% aprueba (lógica en app).';
create index if not exists idx_academy_attendance_cohort on public.academy_attendance (cohort_id);
grant select, insert, update on public.academy_attendance to authenticated;
revoke all on public.academy_attendance from anon;
alter table public.academy_attendance enable row level security;
create policy "academy_attendance by tenant" on public.academy_attendance for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- ── 7) academy_diplomas (diplomas) ───────────────────────────
create table if not exists public.academy_diplomas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  enrollment_id  uuid references public.academy_enrollments(id) on delete set null,
  client_markbox text,
  folio          text not null,
  student_name   text not null,
  course_title   text not null,
  hours          integer,
  place          text,
  issued_at      date not null default current_date,
  storage_path   text,                       -- PDF en bucket academy-diplomas
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint academy_diplomas_folio_uniq unique (tenant_id, folio)
);
comment on table public.academy_diplomas is 'Diplomas emitidos (SDD-0093). Verificación pública por folio (RPC anon) + descarga del cliente en el portal (RLS portal SELECT).';
create index if not exists idx_academy_diplomas_markbox on public.academy_diplomas (tenant_id, client_markbox) where deleted_at is null;
grant select, insert, update on public.academy_diplomas to authenticated;
revoke all on public.academy_diplomas from anon;
alter table public.academy_diplomas enable row level security;
create policy "academy_diplomas by tenant" on public.academy_diplomas for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "academy_diplomas portal self read" on public.academy_diplomas for select
  to authenticated
  using (deleted_at is null and client_markbox is not null and client_markbox = public.get_portal_client_markbox());

-- ── 8) academy_verify_diploma(folio) — verificación pública ──
-- Solo campos seguros. SECURITY DEFINER + EXECUTE a anon (revoke del resto) —
-- patrón de las RPC públicas; search_path fijo.
create or replace function public.academy_verify_diploma(p_folio text)
returns table (folio text, student_name text, course_title text, hours integer, place text, issued_at date)
language sql
stable
security definer
set search_path = public
as $$
  select d.folio, d.student_name, d.course_title, d.hours, d.place, d.issued_at
  from public.academy_diplomas d
  where d.folio = p_folio and d.deleted_at is null
  limit 1;
$$;
revoke all on function public.academy_verify_diploma(text) from public;
grant execute on function public.academy_verify_diploma(text) to anon, authenticated;
comment on function public.academy_verify_diploma(text) is
  'Verificación pública de un diploma por folio (SDD-0093). Solo campos seguros. EXECUTE a anon (revoke del resto).';
