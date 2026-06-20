-- ─────────────────────────────────────────────────────────────
-- 0149 · SDD-0093 · Academia — progreso por lección (portal) + widget de lección
--
-- Slice D.2 del portal del alumno: detalle de curso + reproductor de lección.
-- Dos cambios:
--   1) academy_lesson_progress — una fila por (cliente, lección) completada. El
--      progreso del curso se DERIVA de acá (done/total publicadas), no se guarda
--      mutable en enrollments (el portal no escribe enrollments → sin BOLA). El
--      cliente marca/desmarca: insert-on-conflict-do-nothing / delete.
--   2) academy_lessons.widget — marcador declarativo de una herramienta embebida
--      en la lección (hoy: la Guía de dirección de Alibaba). NULL = lección normal.
--
-- Patrón portal (0144/0145): scope por public.get_portal_client_markbox() +
-- public.get_portal_client_tenant(); revoke anon; RLS por tenant (Studio) +
-- policies de portal (self read/insert/delete). enums lógicos = text + CHECK.
-- Idempotente. NO aplicar a prod desde la rama — la aplica coordinación.
-- Skills Supabase (seguridad + postgres-best-practices) aplicados: policies
-- scopeadas por pertenencia (no BOLA), grant solo a authenticated, sin search_path
-- mutable (no hay funciones nuevas acá).
-- ─────────────────────────────────────────────────────────────

-- ── 1) academy_lessons.widget — herramienta embebida (declarativo) ──
alter table public.academy_lessons add column if not exists widget text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'academy_lessons_widget_chk') then
    alter table public.academy_lessons
      add constraint academy_lessons_widget_chk
      check (widget is null or widget in ('alibaba_address'));
  end if;
end $$;
comment on column public.academy_lessons.widget is
  'Herramienta interactiva embebida en la lección (SDD-0093). NULL = normal. Hoy: alibaba_address (Guía de dirección de bodega Yiwu + MARKBOX).';

-- ── 2) academy_lesson_progress — lecciones completadas por cliente ──
create table if not exists public.academy_lesson_progress (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  client_markbox text not null,
  course_id      uuid not null references public.academy_courses(id) on delete cascade,
  lesson_id      uuid not null references public.academy_lessons(id) on delete cascade,
  completed_at   timestamptz not null default now(),
  constraint academy_lesson_progress_uniq unique (client_markbox, lesson_id)
);
comment on table public.academy_lesson_progress is
  'Progreso por lección del alumno del portal (SDD-0093). Presencia de fila = lección completada. El % del curso se deriva (done/total publicadas). Scope portal por client_markbox.';
create index if not exists idx_academy_lesson_progress_scope
  on public.academy_lesson_progress (client_markbox, course_id);
create index if not exists idx_academy_lesson_progress_tenant
  on public.academy_lesson_progress (tenant_id, course_id);

grant select, insert, delete on public.academy_lesson_progress to authenticated;
revoke all on public.academy_lesson_progress from anon;
alter table public.academy_lesson_progress enable row level security;

-- Studio (tenant): lectura total para analítica del módulo.
create policy "academy_lesson_progress by tenant" on public.academy_lesson_progress for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- Portal: el cliente ve / crea / borra SOLO su propio progreso (pertenencia por
-- markbox + tenant; sin UPDATE — completar es insert idempotente, descompletar es
-- delete).
create policy "academy_lesson_progress portal read" on public.academy_lesson_progress for select
  to authenticated
  using (client_markbox is not null and client_markbox = public.get_portal_client_markbox());
create policy "academy_lesson_progress portal insert" on public.academy_lesson_progress for insert
  to authenticated
  with check (
    client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
    and tenant_id = public.get_portal_client_tenant()
  );
create policy "academy_lesson_progress portal delete" on public.academy_lesson_progress for delete
  to authenticated
  using (client_markbox is not null and client_markbox = public.get_portal_client_markbox());
