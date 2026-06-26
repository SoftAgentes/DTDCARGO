-- ─────────────────────────────────────────────────────────────
-- SDD-0107 (Fase 2 de SDD-0106): academy_enrollments.person_id — ancla
-- de la inscripción a la persona (identidad por cédula).
--
-- SDD-0106 creó `persons` (cédula = ancla estable) y dejó la Academia como
-- isla de `student_ci` sueltos. Esta migración ata cada inscripción a una
-- persona por cédula normalizada, reusando el índice único parcial de 0170.
--
-- ADITIVA: solo agrega columna nullable + índice FK + backfill. NO toca
-- academy_lesson_progress ni el RLS del portal (siguen por client_markbox);
-- NO re-emite diplomas. `academy_enrollments` ya tiene RLS por tenant (0144).
--
-- Backfill en orden de confianza, scoped por tenant_id en cada join:
--   (a) por cédula:   match student_ci ↔ persons.national_id normalizado.
--   (b) por markbox:  inscripciones con client_markbox → clients.person_id.
--   (c) academia-only: crea UNA persona por cédula normalizada distinta sin
--       match previo (deduplicada → no choca el índice único de 0170) y linkea.
--   (d) sin student_ci → person_id queda null (no se inventa identidad).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- 1) Columna FK (nullable; una inscripción sin cédula no se ancla).
alter table public.academy_enrollments
  add column person_id uuid references public.persons(id) on delete set null;

comment on column public.academy_enrollments.person_id is
  'SDD-0107: persona (identidad por cédula, persons) del alumno. La cédula sigue en student_ci; person_id es el vínculo normalizado y deduplicado. nullable: inscripción sin cédula no se ancla.';

-- 2) Índice FK (patrón fk_indexes del repo).
create index academy_enrollments_person_idx
  on public.academy_enrollments (person_id) where deleted_at is null;

-- ── 3) Backfill ──────────────────────────────────────────────

-- (a) por cédula: student_ci ↔ persons.national_id, normalizado igual que el
--     índice único de 0095/0170 (upper + sin puntos/guiones/espacios).
update public.academy_enrollments e
set person_id = p.id
from public.persons p
where e.person_id is null
  and e.deleted_at is null
  and e.student_ci is not null
  and btrim(e.student_ci) <> ''
  and p.tenant_id = e.tenant_id
  and p.deleted_at is null
  and p.national_id is not null
  and btrim(p.national_id) <> ''
  and upper(regexp_replace(e.student_ci::text,  '[^A-Za-z0-9]', '', 'g'))
    = upper(regexp_replace(p.national_id::text, '[^A-Za-z0-9]', '', 'g'));

-- (b) por markbox: las que quedan sin persona y con client_markbox → el
--     person_id del cliente de carga (mismo tenant).
update public.academy_enrollments e
set person_id = c.person_id
from public.clients c
where e.person_id is null
  and e.deleted_at is null
  and e.client_markbox is not null
  and btrim(e.client_markbox) <> ''
  and c.tenant_id = e.tenant_id
  and c.deleted_at is null
  and c.markbox = e.client_markbox
  and c.person_id is not null;

-- (c) academia-only: las que quedan con student_ci y sin match → crear UNA
--     persona por cédula normalizada distinta y linkear. Deduplicado ANTES de
--     insertar (distinct on por cédula normalizada) → no choca el índice único
--     parcial de 0170. Doble guarda: not exists contra persons ya vivas con esa
--     cédula normalizada (por si la rama (a) no la vinculó por raza de datos).
with pending as (
  select
    e.tenant_id,
    upper(regexp_replace(e.student_ci::text, '[^A-Za-z0-9]', '', 'g')) as ci_norm,
    e.student_ci,
    e.student_name,
    e.student_email,
    e.created_at
  from public.academy_enrollments e
  where e.person_id is null
    and e.deleted_at is null
    and e.student_ci is not null
    and btrim(e.student_ci) <> ''
    and btrim(regexp_replace(e.student_ci::text, '[^A-Za-z0-9]', '', 'g')) <> ''
),
deduped as (
  select distinct on (tenant_id, ci_norm)
    tenant_id, ci_norm, student_ci, student_name, student_email, created_at
  from pending
  order by tenant_id, ci_norm, created_at asc
)
insert into public.persons
  (tenant_id, national_id, doc_kind, name, email, created_at)
select
  d.tenant_id, d.student_ci, 'persona', d.student_name, d.student_email, d.created_at
from deduped d
where not exists (
  select 1 from public.persons p
  where p.tenant_id = d.tenant_id
    and p.deleted_at is null
    and p.national_id is not null
    and upper(regexp_replace(p.national_id::text, '[^A-Za-z0-9]', '', 'g')) = d.ci_norm
);

-- (c.2) linkear las academia-only contra la persona recién creada (o cualquier
--       persona viva con esa cédula normalizada en el tenant).
update public.academy_enrollments e
set person_id = p.id
from public.persons p
where e.person_id is null
  and e.deleted_at is null
  and e.student_ci is not null
  and btrim(e.student_ci) <> ''
  and p.tenant_id = e.tenant_id
  and p.deleted_at is null
  and p.national_id is not null
  and btrim(p.national_id) <> ''
  and upper(regexp_replace(e.student_ci::text,  '[^A-Za-z0-9]', '', 'g'))
    = upper(regexp_replace(p.national_id::text, '[^A-Za-z0-9]', '', 'g'));

-- (d) inscripciones sin student_ci → person_id queda null (no-op explícito).
