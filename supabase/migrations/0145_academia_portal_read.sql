-- ─────────────────────────────────────────────────────────────
-- 0145 · SDD-0093 · Academia — lectura de catálogo desde el PORTAL del cliente
--
-- El cliente del portal (rol authenticated, SIN tenant) hoy no puede leer
-- academy_courses/modules/lessons (solo tienen la policy "by tenant"). Para el
-- portal del alumno (catálogo, "mis cursos", detalle, preview) agrega policies
-- SELECT de portal, permissive (OR con las existentes):
--   · cursos: publicados (catálogo) O donde el cliente está inscrito.
--   · módulos: de esos cursos.
--   · lecciones: free_preview de cursos publicados (preview sin comprar) O todas
--     las de un curso donde el cliente está inscrito.
--
-- Patrón portal: public.get_portal_client_markbox() (igual que enrollments/diplomas
-- en 0144). Solo SELECT (el cliente no muta el catálogo). NO aplicar a prod desde
-- la rama — la aplica coordinación. Skills Supabase (seguridad + best-practices)
-- seguidos: policy SELECT, to authenticated, predicado de pertenencia (no BOLA).
-- ─────────────────────────────────────────────────────────────

create policy "academy_courses portal read" on public.academy_courses for select
  to authenticated
  using (
    deleted_at is null
    and (
      status = 'publicado'
      or exists (
        select 1 from public.academy_enrollments e
        where e.course_id = academy_courses.id
          and e.deleted_at is null
          and e.client_markbox = public.get_portal_client_markbox()
      )
    )
  );

create policy "academy_modules portal read" on public.academy_modules for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.academy_courses c
      where c.id = academy_modules.course_id
        and c.deleted_at is null
        and (
          c.status = 'publicado'
          or exists (
            select 1 from public.academy_enrollments e
            where e.course_id = c.id and e.deleted_at is null
              and e.client_markbox = public.get_portal_client_markbox()
          )
        )
    )
  );

create policy "academy_lessons portal read" on public.academy_lessons for select
  to authenticated
  using (
    deleted_at is null
    and (
      (free_preview = true and status = 'publicado')   -- preview gratis sin inscripción
      or exists (
        select 1 from public.academy_enrollments e
        where e.course_id = academy_lessons.course_id
          and e.deleted_at is null
          and e.client_markbox = public.get_portal_client_markbox()
      )
    )
  );
