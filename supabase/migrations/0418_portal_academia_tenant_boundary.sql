-- 0418 · SDD-0362 · Aprendizaje Portal ligado al principal y tenant.
-- Ocho policies en seis tablas. Sin DML, ACL, RPC, triggers ni Storage.
-- Requiere 0080/0105/0144/0145/0149. Aplicación Cloud transaccional y nominal;
-- no requiere nueva RPC ni despliegue previo de la aplicación.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0418: requiere auth.uid()';
  end if;
  foreach v_table in array array[
    'client_users', 'clients', 'academy_courses', 'academy_modules',
    'academy_lessons', 'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0418: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(tablename, policyname, cmd) as (values
      ('academy_courses', 'academy_courses by tenant', 'ALL'),
      ('academy_courses', 'academy_courses portal read', 'SELECT'),
      ('academy_modules', 'academy_modules by tenant', 'ALL'),
      ('academy_modules', 'academy_modules portal read', 'SELECT'),
      ('academy_lessons', 'academy_lessons by tenant', 'ALL'),
      ('academy_lessons', 'academy_lessons portal read', 'SELECT'),
      ('academy_enrollments', 'academy_enrollments by tenant', 'ALL'),
      ('academy_enrollments', 'academy_enrollments portal self read', 'SELECT'),
      ('academy_diplomas', 'academy_diplomas by tenant', 'ALL'),
      ('academy_diplomas', 'academy_diplomas portal self read', 'SELECT'),
      ('academy_lesson_progress', 'academy_lesson_progress by tenant', 'ALL'),
      ('academy_lesson_progress', 'academy_lesson_progress portal read', 'SELECT'),
      ('academy_lesson_progress', 'academy_lesson_progress portal insert', 'INSERT'),
      ('academy_lesson_progress', 'academy_lesson_progress portal delete', 'DELETE')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename in (
        'academy_courses', 'academy_modules', 'academy_lessons',
        'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'
      )
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0418: inventario de policies ausente o con drift; revisar antes de aplicar';
  end if;
end;
$preflight$;

-- No consultar cursos desde inscripciones: los cursos dependen de esta policy
-- y formaríamos un ciclo RLS. La coherencia del catálogo se exige abajo.
alter policy "academy_enrollments portal self read" on public.academy_enrollments
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_enrollments.tenant_id
        and c.markbox = academy_enrollments.client_markbox
    )
  );

-- Un diploma propio sigue disponible aunque su inscripción se haya archivado
-- o retirado: no cambiamos su retención ni requerimos un padre vivo.
alter policy "academy_diplomas portal self read" on public.academy_diplomas
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_diplomas.tenant_id
        and c.markbox = academy_diplomas.client_markbox
    )
  );

alter policy "academy_courses portal read" on public.academy_courses
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_courses.tenant_id
        and (
          academy_courses.status = 'publicado'
          or exists (
            select 1 from public.academy_enrollments e
            where e.course_id = academy_courses.id and e.tenant_id = cu.tenant_id
              and e.client_markbox = c.markbox and e.deleted_at is null
          )
        )
    )
  );

alter policy "academy_modules portal read" on public.academy_modules
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.academy_courses course
        on course.id = academy_modules.course_id and course.tenant_id = cu.tenant_id
          and course.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_modules.tenant_id
        and (
          course.status = 'publicado'
          or exists (
            select 1 from public.academy_enrollments e
            where e.course_id = course.id and e.tenant_id = cu.tenant_id
              and e.client_markbox = c.markbox and e.deleted_at is null
          )
        )
    )
  );

alter policy "academy_lessons portal read" on public.academy_lessons
  using (
    deleted_at is null and status = 'publicado' and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.academy_courses course
        on course.id = academy_lessons.course_id and course.tenant_id = cu.tenant_id
          and course.deleted_at is null
      join public.academy_modules module
        on module.id = academy_lessons.module_id and module.course_id = course.id
          and module.tenant_id = cu.tenant_id and module.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_lessons.tenant_id
        and (
          (academy_lessons.free_preview and course.status = 'publicado')
          or exists (
            select 1 from public.academy_enrollments e
            where e.course_id = course.id and e.tenant_id = cu.tenant_id
              and e.client_markbox = c.markbox and e.deleted_at is null
          )
        )
    )
  );

-- Leer/desmarcar progreso histórico propio no exige catálogo todavía vivo.
alter policy "academy_lesson_progress portal read" on public.academy_lesson_progress
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_lesson_progress.tenant_id
        and c.markbox = academy_lesson_progress.client_markbox
    )
  );

alter policy "academy_lesson_progress portal delete" on public.academy_lesson_progress
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_lesson_progress.tenant_id
        and c.markbox = academy_lesson_progress.client_markbox
    )
  );

-- Completar sí exige inscripción propia y coherencia de todos los padres.
-- ON CONFLICT DO NOTHING conserva idempotencia; no se otorga UPDATE.
alter policy "academy_lesson_progress portal insert" on public.academy_lesson_progress
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.academy_enrollments e
        on e.tenant_id = cu.tenant_id and e.client_markbox = c.markbox
          and e.course_id = academy_lesson_progress.course_id and e.deleted_at is null
      join public.academy_courses course
        on course.id = e.course_id and course.tenant_id = cu.tenant_id and course.deleted_at is null
      join public.academy_lessons lesson
        on lesson.id = academy_lesson_progress.lesson_id and lesson.course_id = course.id
          and lesson.tenant_id = cu.tenant_id and lesson.deleted_at is null and lesson.status = 'publicado'
      join public.academy_modules module
        on module.id = lesson.module_id and module.course_id = course.id
          and module.tenant_id = cu.tenant_id and module.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = academy_lesson_progress.tenant_id
        and c.markbox = academy_lesson_progress.client_markbox
    )
  );

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename in (
        'academy_courses', 'academy_modules', 'academy_lessons',
        'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'
      ) and policyname like '% portal %' and roles = array['authenticated']::name[]
        and permissive = 'PERMISSIVE'
        and case when cmd = 'INSERT' then
          with_check like '%client_users%' and with_check like '%auth.uid()%'
            and with_check like '%tenant_id%' and with_check like '%academy_enrollments%'
            and with_check like '%academy_lessons%' and with_check like '%academy_modules%'
        else
          cmd in ('SELECT', 'DELETE') and qual like '%client_users%'
            and qual like '%auth.uid()%' and qual like '%tenant_id%'
        end
    ) <> 8 then
    raise exception '0418: frontera Portal final inválida';
  end if;
end;
$postflight$;
