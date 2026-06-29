-- ─────────────────────────────────────────────────────────────
-- 0188 · SDD-0116 · Club DTD — Slice C V1: eventos del Club (D9)
--
-- D9 (founder 2026-06-29): los eventos del Club REUSAN academy_cohorts (SDD-0093)
-- en vez de una tabla club_events nueva. El contenedor de cohortes ya sirve: tiene
-- name, modality (presencial/online), place, starts_at, facilitator_name, status
-- (proximamente/en_curso/completado), y course_id YA es nullable ("evento
-- standalone"). Solo falta:
--   1) un DISCRIMINADOR para separar cohortes de Academia (curso) de eventos del
--      Club → columna `context` ('academia' | 'club'). Las filas existentes quedan
--      'academia' por default (cero backfill).
--   2) `summary` opcional (descripción corta del evento; los cursos no la usaban).
--
-- Inscripciones de miembros a eventos = DIFERIDAS (Slice C.2): academy_enrollments
-- tiene course_id NOT NULL + se ancla por client_markbox (no por persona), así que
-- NO sirve para un evento sin curso anclado a un miembro. Se modela aparte cuando
-- se decida si la asistencia importa. V1 = solo el evento (admin + portal read).
--
-- RIPPLE (cubierto en la capa app, NO en esta migr): las queries de Academia que
-- leen academy_cohorts (academiaStats, listCohortDetails, listCohorts) ahora
-- filtran context='academia' para que los eventos del Club no se cuelen ahí.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica coordinación /
-- founder. Skills Supabase (seguridad + postgres) seguidos.
-- ─────────────────────────────────────────────────────────────

-- ── 1) Discriminador academia vs club ─────────────────────────
alter table public.academy_cohorts
  add column if not exists context text not null default 'academia';

-- CHECK separado e idempotente (add column no admite check inline reejecutable).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academy_cohorts_context_chk'
  ) then
    alter table public.academy_cohorts
      add constraint academy_cohorts_context_chk check (context in ('academia', 'club'));
  end if;
end $$;

comment on column public.academy_cohorts.context is
  'SDD-0116 D9: discriminador de dominio. ''academia'' = cohorte de curso (SDD-0093); ''club'' = evento del Club DTD (course_id null). Las queries de Academia filtran context=''academia''.';

-- ── 2) Descripción corta (opcional, para eventos del Club) ────
alter table public.academy_cohorts
  add column if not exists summary text;

comment on column public.academy_cohorts.summary is
  'SDD-0116: descripción corta (usada por eventos del Club; los cursos no la usaban).';

-- ── Índice para listar eventos del Club por fecha ─────────────
create index if not exists academy_cohorts_club_events_idx
  on public.academy_cohorts (tenant_id, starts_at desc)
  where context = 'club' and deleted_at is null;
