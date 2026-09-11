\set ON_ERROR_STOP on
-- SDD-0362: contrato PostgreSQL local con fixtures sintéticos y RLS históricas.
-- RED: psql -v apply_fix=false -f este-archivo; no requiere que exista 0418.
-- GREEN por defecto: aplica el archivo real. BEGIN/ROLLBACK, nunca Cloud.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
create table public.user_tenants (user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
-- Stub requerido por 0080; las seis tablas bajo prueba se crean con DDL real.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  client_markbox text, deleted_at timestamptz
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0105_portal_compras.sql
\ir ../migrations/0144_academia.sql
\ir ../migrations/0145_academia_portal_read.sql
\ir ../migrations/0149_academia_lesson_progress.sql

-- UUID determinista sólo para nombrar fixtures sin ocultar qué caso representa.
create function pg_temp.fixture_id(p_name text) returns uuid language sql immutable as $$
  select md5('0418-synthetic-' || p_name)::uuid
$$;
insert into public.tenants select pg_temp.fixture_id(v) from unnest(array['tenant-A', 'tenant-B']) v;
insert into auth.users (id) select pg_temp.fixture_id(v) from unnest(array[
  'team-A', 'team-disabled', 'portal-A', 'portal-B', 'revoked', 'retired', 'incoherent', 'invited'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now());
insert into public.clients (id, tenant_id, markbox, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox,
       case when retired then now() else null end
from (values
  ('client-A', 'tenant-A', 'DUP', false), ('client-A-other', 'tenant-A', 'OTHER', false),
  ('client-retired', 'tenant-A', 'DEAD', true), ('client-invited', 'tenant-A', 'INVITED', false),
  ('client-B', 'tenant-B', 'DUP', false), ('client-B-other', 'tenant-B', 'OTHER', false)
) v(label, tenant, markbox, retired);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(principal), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
       principal || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'), ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-A-other', 'revoked'), ('retired', 'tenant-A', 'client-retired', 'active'),
  ('incoherent', 'tenant-A', 'client-B-other', 'active'), ('invited', 'tenant-A', 'client-invited', 'invited')
) v(principal, tenant, client, status);
insert into public.academy_courses (id, tenant_id, slug, title, status, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), label, label, status,
       case when retired then now() else null end
from (values
  ('A-enrolled', 'tenant-A', 'publicado', false), ('A-preview', 'tenant-A', 'publicado', false),
  ('A-hidden-enrolled', 'tenant-A', 'borrador', false), ('A-hidden', 'tenant-A', 'borrador', false),
  ('A-deleted', 'tenant-A', 'publicado', true), ('A-archived-enrollment', 'tenant-A', 'borrador', false),
  ('A-cross-enrollment', 'tenant-A', 'borrador', false), ('A-other-enrollment', 'tenant-A', 'borrador', false),
  ('B-enrolled', 'tenant-B', 'publicado', false), ('B-hidden-enrolled', 'tenant-B', 'borrador', false),
  ('B-preview', 'tenant-B', 'publicado', false), ('B-other-enrollment', 'tenant-B', 'borrador', false)
) v(label, tenant, status, retired);
insert into public.academy_modules (id, tenant_id, course_id, title)
select pg_temp.fixture_id(title || '-module'), tenant_id, id, title || '-module' from public.academy_courses;
insert into public.academy_modules (id, tenant_id, course_id, title, deleted_at) values
  (pg_temp.fixture_id('A-dead-module'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('A-enrolled'), 'A-dead-module', now()),
  (pg_temp.fixture_id('B-module-A-course'), pg_temp.fixture_id('tenant-B'), pg_temp.fixture_id('A-enrolled'), 'B-module-A-course', null),
  (pg_temp.fixture_id('A-module-B-course'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('B-enrolled'), 'A-module-B-course', null);
insert into public.academy_lessons (id, tenant_id, course_id, module_id, title, free_preview, status, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), pg_temp.fixture_id(course), pg_temp.fixture_id(module),
       label, preview, status, case when retired then now() else null end
from (values
  ('L-A-enrolled', 'tenant-A', 'A-enrolled', 'A-enrolled-module', false, 'publicado', false),
  ('L-A-next', 'tenant-A', 'A-enrolled', 'A-enrolled-module', false, 'publicado', false),
  ('L-A-draft', 'tenant-A', 'A-enrolled', 'A-enrolled-module', true, 'borrador', false),
  ('L-A-deleted', 'tenant-A', 'A-enrolled', 'A-enrolled-module', false, 'publicado', true),
  ('L-A-preview-free', 'tenant-A', 'A-preview', 'A-preview-module', true, 'publicado', false),
  ('L-A-preview-paid', 'tenant-A', 'A-preview', 'A-preview-module', false, 'publicado', false),
  ('L-A-hidden-enrolled', 'tenant-A', 'A-hidden-enrolled', 'A-hidden-enrolled-module', false, 'publicado', false),
  ('L-A-hidden-free', 'tenant-A', 'A-hidden', 'A-hidden-module', true, 'publicado', false),
  ('L-A-deleted-course', 'tenant-A', 'A-deleted', 'A-deleted-module', true, 'publicado', false),
  ('L-A-archived', 'tenant-A', 'A-archived-enrollment', 'A-archived-enrollment-module', false, 'publicado', false),
  ('L-A-cross-enrollment', 'tenant-A', 'A-cross-enrollment', 'A-cross-enrollment-module', false, 'publicado', false),
  ('L-A-other-enrollment', 'tenant-A', 'A-other-enrollment', 'A-other-enrollment-module', false, 'publicado', false),
  ('L-A-dead-module', 'tenant-A', 'A-enrolled', 'A-dead-module', false, 'publicado', false),
  ('L-A-module-tenant-mismatch', 'tenant-A', 'A-enrolled', 'B-module-A-course', false, 'publicado', false),
  ('L-A-module-course-mismatch', 'tenant-A', 'A-enrolled', 'A-preview-module', false, 'publicado', false),
  ('L-A-lesson-tenant-mismatch', 'tenant-B', 'A-enrolled', 'A-enrolled-module', false, 'publicado', false),
  ('L-B-enrolled', 'tenant-B', 'B-enrolled', 'B-enrolled-module', false, 'publicado', false),
  ('L-B-next', 'tenant-B', 'B-enrolled', 'B-enrolled-module', false, 'publicado', false),
  ('L-B-hidden-enrolled', 'tenant-B', 'B-hidden-enrolled', 'B-hidden-enrolled-module', false, 'publicado', false),
  ('L-B-preview-free', 'tenant-B', 'B-preview', 'B-preview-module', true, 'publicado', false),
  ('L-B-other-enrollment', 'tenant-B', 'B-other-enrollment', 'B-other-enrollment-module', false, 'publicado', false)
) v(label, tenant, course, module, preview, status, retired);
insert into public.academy_enrollments (id, tenant_id, course_id, client_markbox, student_name, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), pg_temp.fixture_id(course), markbox, label,
       case when retired then now() else null end
from (values
  ('E-A-enrolled', 'tenant-A', 'A-enrolled', 'DUP', false), ('E-A-hidden', 'tenant-A', 'A-hidden-enrolled', 'DUP', false),
  ('E-A-dead-course', 'tenant-A', 'A-deleted', 'DUP', false), ('E-A-archived', 'tenant-A', 'A-archived-enrollment', 'DUP', true),
  ('E-A-other', 'tenant-A', 'A-other-enrollment', 'OTHER', false), ('E-retired', 'tenant-A', 'A-enrolled', 'DEAD', false),
  ('E-invited', 'tenant-A', 'A-enrolled', 'INVITED', false), ('E-null-owner', 'tenant-A', 'A-enrolled', null, false),
  ('E-B-enrolled', 'tenant-B', 'B-enrolled', 'DUP', false), ('E-B-hidden', 'tenant-B', 'B-hidden-enrolled', 'DUP', false),
  ('E-B-cross', 'tenant-B', 'A-cross-enrollment', 'DUP', false), ('E-B-other', 'tenant-B', 'B-other-enrollment', 'OTHER', false)
) v(label, tenant, course, markbox, retired);
insert into public.academy_diplomas (id, tenant_id, enrollment_id, client_markbox, folio, student_name, course_title, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), pg_temp.fixture_id(enrollment), markbox, label, label, 'synthetic',
       case when retired then now() else null end
from (values
  ('D-A', 'tenant-A', 'E-A-enrolled', 'DUP', false), ('D-A-history', 'tenant-A', 'E-A-archived', 'DUP', false),
  ('D-A-no-parent', 'tenant-A', null, 'DUP', false), ('D-A-deleted', 'tenant-A', 'E-A-enrolled', 'DUP', true),
  ('D-A-other', 'tenant-A', 'E-A-other', 'OTHER', false), ('D-retired', 'tenant-A', 'E-retired', 'DEAD', false),
  ('D-invited', 'tenant-A', 'E-invited', 'INVITED', false), ('D-null-owner', 'tenant-A', null, null, false),
  ('D-B', 'tenant-B', 'E-B-enrolled', 'DUP', false), ('D-B-other', 'tenant-B', 'E-B-other', 'OTHER', false)
) v(label, tenant, enrollment, markbox, retired);
insert into public.academy_lesson_progress (id, tenant_id, client_markbox, course_id, lesson_id)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, pg_temp.fixture_id(course), pg_temp.fixture_id(lesson)
from (values
  ('P-A', 'tenant-A', 'DUP', 'A-enrolled', 'L-A-enrolled'), ('P-A-history', 'tenant-A', 'DUP', 'A-deleted', 'L-A-deleted-course'),
  ('P-A-other', 'tenant-A', 'OTHER', 'A-enrolled', 'L-A-enrolled'), ('P-retired', 'tenant-A', 'DEAD', 'A-enrolled', 'L-A-enrolled'),
  ('P-invited', 'tenant-A', 'INVITED', 'A-enrolled', 'L-A-enrolled'), ('P-B', 'tenant-B', 'DUP', 'B-enrolled', 'L-B-enrolled'),
  ('P-B-other', 'tenant-B', 'OTHER', 'B-enrolled', 'L-B-enrolled')
) v(label, tenant, markbox, course, lesson);

-- Las seis lecturas cruzadas, borrador inscrito, DELETE ajeno e INSERT sin
-- inscripción deben reproducirse con las policies originales, no con mocks.
savepoint historical_bugs;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $historical_bug$
declare v_count bigint;
begin
  if (select count(*) from public.academy_courses where id = pg_temp.fixture_id('B-enrolled')) <> 1
     or (select count(*) from public.academy_modules where id = pg_temp.fixture_id('B-enrolled-module')) <> 1
     or (select count(*) from public.academy_lessons where id = pg_temp.fixture_id('L-B-enrolled')) <> 1
     or (select count(*) from public.academy_enrollments where id = pg_temp.fixture_id('E-B-enrolled')) <> 1
     or (select count(*) from public.academy_diplomas where id = pg_temp.fixture_id('D-B')) <> 1
     or (select count(*) from public.academy_lesson_progress where id = pg_temp.fixture_id('P-B')) <> 1
     or (select count(*) from public.academy_lessons where id = pg_temp.fixture_id('L-A-draft')) <> 1 then
    raise exception 'TEST 0418: fixture no reproduce las lecturas cruzadas y de borrador históricas';
  end if;
  delete from public.academy_lesson_progress where id = pg_temp.fixture_id('P-B');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0418: no reprodujo DELETE de progreso de B'; end if;
  insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id)
  values (pg_temp.fixture_id('tenant-A'), 'DUP', pg_temp.fixture_id('A-preview'), pg_temp.fixture_id('L-A-preview-free'));
  raise notice 'TEST 0418 RED baseline: seis lecturas cruzadas, borrador, DELETE ajeno e INSERT sin inscripción reproducidos';
end;
$historical_bug$;
rollback to savepoint historical_bugs;
release savepoint historical_bugs;
reset role;

-- Comparación bidireccional: sólo ocho expresiones Portal pueden cambiar.
create temporary table portal_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename in (
    'academy_courses', 'academy_modules', 'academy_lessons', 'academy_enrollments',
    'academy_diplomas', 'academy_lesson_progress'
  ) and policyname like '% portal %';
create temporary table other_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where to_jsonb(p) not in (select definition from portal_policy_baseline);
create temporary table table_acl_baseline as
  select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
  where relnamespace = 'public'::regnamespace and relkind in ('r', 'p');
create temporary table function_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_proc p where pronamespace = 'public'::regnamespace;
create temporary table trigger_baseline as
  select to_jsonb(t) as definition from pg_catalog.pg_trigger t;
create temporary table team_row_baseline (table_name text primary key, row_count bigint);
do $team_baseline$
declare v_table text; v_count bigint;
begin
  foreach v_table in array array['academy_courses', 'academy_modules', 'academy_lessons', 'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'] loop
    execute format('select count(*) from public.%I where tenant_id = pg_temp.fixture_id(''tenant-A'')', v_table) into v_count;
    insert into team_row_baseline values (v_table, v_count);
  end loop;
end;
$team_baseline$;
grant select on team_row_baseline to authenticated;
\if :apply_fix
\ir ../migrations/0418_portal_academia_tenant_boundary.sql
-- La lógica de preflight se ejecuta desde el archivo real, no se copia al test.
-- Cada subtransacción revierte su drift; debe rechazarlo con error propio 0418.
do $preflight_drift$
declare v_ddl text; v_rejected boolean;
begin
  foreach v_ddl in array array[
    'create policy "0418 unexpected" on public.academy_courses for select to authenticated using (true)',
    'drop policy "academy_lesson_progress portal delete" on public.academy_lesson_progress',
    'alter table public.academy_courses disable row level security',
    'alter table public.academy_modules disable row level security',
    'alter table public.academy_lessons disable row level security',
    'alter table public.academy_enrollments disable row level security',
    'alter table public.academy_diplomas disable row level security',
    'alter table public.academy_lesson_progress disable row level security'
  ] loop
    begin
      execute v_ddl;
      v_rejected := false;
      begin
        execute pg_catalog.pg_read_file('/sb/migrations/0418_portal_academia_tenant_boundary.sql');
      exception when raise_exception then
        if sqlerrm not like '0418:%' then raise; end if;
        v_rejected := true;
      end;
      if not v_rejected then raise exception 'TEST 0418: preflight aceptó drift: %', v_ddl; end if;
      raise sqlstate 'PT418' using message = 'rollback de drift sintético';
    exception when sqlstate 'PT418' then null;
    end;
  end loop;
end;
$preflight_drift$;
do $eight_substitutions$
begin
  if (select count(*) from portal_policy_baseline) <> 8
     or (select count(*) from pg_catalog.pg_policies p join portal_policy_baseline b
         on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
         and b.definition->>'policyname' = p.policyname
         where b.definition is distinct from to_jsonb(p)) <> 8 then
    raise exception 'TEST 0418: no sustituyó exactamente las ocho policies Portal';
  end if;
  if exists (
    select 1 from portal_policy_baseline b join pg_catalog.pg_policies p
      on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
      and b.definition->>'policyname' = p.policyname
    where b.definition - 'qual' - 'with_check' is distinct from to_jsonb(p) - 'qual' - 'with_check'
  ) then raise exception 'TEST 0418: cambió comandos, roles o modo de las policies Portal'; end if;
end;
$eight_substitutions$;
\endif
do $unchanged_contract$
begin
  if exists (
    (select definition from other_policy_baseline except
     select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
       and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname))
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
       and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname)
     except select definition from other_policy_baseline)
  ) or exists (
    select 1 from table_acl_baseline b full join (
      select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
      where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
    ) c using (oid)
    where b.oid is null or c.oid is null or c.relacl is distinct from b.relacl
      or c.relrowsecurity is distinct from b.relrowsecurity or c.relforcerowsecurity is distinct from b.relforcerowsecurity
  ) or exists (
    (select definition from function_baseline except select to_jsonb(p) from pg_catalog.pg_proc p where pronamespace = 'public'::regnamespace)
    union all
    (select to_jsonb(p) from pg_catalog.pg_proc p where pronamespace = 'public'::regnamespace except select definition from function_baseline)
  ) or exists (
    (select definition from trigger_baseline except select to_jsonb(t) from pg_catalog.pg_trigger t)
    union all
    (select to_jsonb(t) from pg_catalog.pg_trigger t except select definition from trigger_baseline)
  ) then raise exception 'TEST 0418: cambió una policy ajena, ACL, RLS, RPC o trigger'; end if;
end;
$unchanged_contract$;

-- INVOKER: las aserciones ven exclusivamente las filas del rol/JWT en curso.
create function pg_temp.assert_rows(p_table text, p_labels text[]) returns void language plpgsql as $$
declare v_expected uuid[]; v_actual uuid[];
begin
  select coalesce(array_agg(pg_temp.fixture_id(label) order by pg_temp.fixture_id(label)), '{}'::uuid[])
    into v_expected from unnest(p_labels) label;
  execute format('select coalesce(array_agg(id order by id), ''{}''::uuid[]) from public.%I', p_table) into v_actual;
  if v_expected <> v_actual then
    raise exception 'TEST 0418: visibilidad incorrecta para % en %: esperado %, ids reales %', auth.uid(), p_table, p_labels, v_actual;
  end if;
end;
$$;
create function pg_temp.expect_denied_insert(p_sql text) returns void language plpgsql as $$
declare v_blocked boolean := false;
begin
  begin execute p_sql; exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0418: INSERT no autorizado fue aceptado: %', p_sql; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_rows('academy_courses', array['A-enrolled', 'A-hidden-enrolled', 'A-preview']);
select pg_temp.assert_rows('academy_modules', array['A-enrolled-module', 'A-hidden-enrolled-module', 'A-preview-module']);
select pg_temp.assert_rows('academy_lessons', array['L-A-enrolled', 'L-A-next', 'L-A-hidden-enrolled', 'L-A-preview-free']);
select pg_temp.assert_rows('academy_enrollments', array['E-A-enrolled', 'E-A-hidden', 'E-A-dead-course']);
select pg_temp.assert_rows('academy_diplomas', array['D-A', 'D-A-history', 'D-A-no-parent']);
select pg_temp.assert_rows('academy_lesson_progress', array['P-A', 'P-A-history']);
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
select pg_temp.assert_rows('academy_courses', array['B-enrolled', 'B-hidden-enrolled', 'B-preview']);
select pg_temp.assert_rows('academy_modules', array['B-enrolled-module', 'B-hidden-enrolled-module', 'B-preview-module']);
select pg_temp.assert_rows('academy_lessons', array['L-B-enrolled', 'L-B-next', 'L-B-hidden-enrolled', 'L-B-preview-free']);
select pg_temp.assert_rows('academy_enrollments', array['E-B-enrolled', 'E-B-hidden', 'E-B-cross']);
select pg_temp.assert_rows('academy_diplomas', array['D-B']);
select pg_temp.assert_rows('academy_lesson_progress', array['P-B']);
do $reverse_delete_denied$
declare v_count bigint;
begin
  delete from public.academy_lesson_progress where id = pg_temp.fixture_id('P-A');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0418: B borró progreso de A con el mismo Shipping Mark'; end if;
end;
$reverse_delete_denied$;
do $invalid_principals$
declare v record; v_table text; v_count bigint;
begin
  for v in select * from (values
    ('revoked', 'OTHER'), ('retired', 'DEAD'), ('incoherent', 'OTHER'), ('invited', 'INVITED'),
    ('team-disabled', 'DUP'), ('unknown', 'DUP'), (null, 'DUP')
  ) principals(principal, markbox) loop
    perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(v.principal)::text, ''), true);
    foreach v_table in array array['academy_courses', 'academy_modules', 'academy_lessons', 'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'] loop
      perform pg_temp.assert_rows(v_table, '{}');
    end loop;
    delete from public.academy_lesson_progress;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0418: principal inválido borró progreso: %', v.principal; end if;
    perform pg_temp.expect_denied_insert(format(
      'insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id) values (%L, %L, %L, %L)',
      pg_temp.fixture_id('tenant-A'), v.markbox, pg_temp.fixture_id('A-enrolled'), pg_temp.fixture_id('L-A-next')));
  end loop;
end;
$invalid_principals$;

reset role;
savepoint own_progress;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $own_progress$
declare v_id uuid := pg_temp.fixture_id('P-new'); v_returned uuid; v_count bigint; v_blocked boolean := false;
begin
  insert into public.academy_lesson_progress (id, tenant_id, client_markbox, course_id, lesson_id)
  values (v_id, pg_temp.fixture_id('tenant-A'), 'DUP', pg_temp.fixture_id('A-enrolled'), pg_temp.fixture_id('L-A-next'))
  on conflict (client_markbox, lesson_id) do nothing returning id into v_returned;
  if v_returned is distinct from v_id then raise exception 'TEST 0418: completar no devolvió progreso propio'; end if;
  insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id)
  values (pg_temp.fixture_id('tenant-A'), 'DUP', pg_temp.fixture_id('A-enrolled'), pg_temp.fixture_id('L-A-next'))
  on conflict (client_markbox, lesson_id) do nothing;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0418: completar repetido dejó de ser idempotente'; end if;
  begin update public.academy_lesson_progress set completed_at = now() where id = v_id;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0418: se otorgó UPDATE de progreso'; end if;
  delete from public.academy_lesson_progress where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0418: desmarcar no borró progreso propio'; end if;
  delete from public.academy_lesson_progress where id in (pg_temp.fixture_id('P-B'), pg_temp.fixture_id('P-A-other'));
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0418: A borró progreso ajeno o de otro cliente'; end if;
  -- Leer/desmarcar la historia propia no exige un padre vivo ni la purga.
  delete from public.academy_lesson_progress where id = pg_temp.fixture_id('P-A-history');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0418: se alteró la retención/desmarcado de progreso histórico'; end if;
  insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id)
  values (pg_temp.fixture_id('tenant-A'), 'DUP', pg_temp.fixture_id('A-hidden-enrolled'), pg_temp.fixture_id('L-A-hidden-enrolled'));
end;
$own_progress$;
rollback to savepoint own_progress;
release savepoint own_progress;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $invalid_progress_inserts$
declare v record;
begin
  for v in select * from (values
    ('tenant-B', 'DUP', 'B-enrolled', 'L-B-next'),
    ('tenant-A', 'OTHER', 'A-enrolled', 'L-A-next'),
    ('tenant-A', 'DUP', 'A-preview', 'L-A-preview-free'),
    ('tenant-A', 'DUP', 'A-hidden', 'L-A-hidden-free'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-B-next'),
    ('tenant-A', 'DUP', 'A-preview', 'L-A-next'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-draft'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-deleted'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-dead-module'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-module-tenant-mismatch'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-module-course-mismatch'),
    ('tenant-A', 'DUP', 'A-enrolled', 'L-A-lesson-tenant-mismatch'),
    ('tenant-A', 'DUP', 'A-archived-enrollment', 'L-A-archived'),
    ('tenant-A', 'DUP', 'A-cross-enrollment', 'L-A-cross-enrollment'),
    ('tenant-A', 'DUP', 'A-other-enrollment', 'L-A-other-enrollment')
  ) attempts(tenant, markbox, course, lesson) loop
    perform pg_temp.expect_denied_insert(format(
      'insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id) values (%L, %L, %L, %L)',
      pg_temp.fixture_id(v.tenant), v.markbox, pg_temp.fixture_id(v.course), pg_temp.fixture_id(v.lesson)));
  end loop;
end;
$invalid_progress_inserts$;
-- Retirar el progreso histórico sólo dentro del savepoint evita un fallo UNIQUE
-- que ocultaría si RLS permite insertar contra un curso retirado.
reset role;
savepoint retired_course_insert;
delete from public.academy_lesson_progress where id = pg_temp.fixture_id('P-A-history');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.expect_denied_insert(format(
  'insert into public.academy_lesson_progress (tenant_id, client_markbox, course_id, lesson_id) values (%L, %L, %L, %L)',
  pg_temp.fixture_id('tenant-A'), 'DUP', pg_temp.fixture_id('A-deleted'), pg_temp.fixture_id('L-A-deleted-course')));
rollback to savepoint retired_course_insert;
release savepoint retired_course_insert;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $portal_cannot_manage_academy$
declare v_table text; v_count bigint; v_sql text;
begin
  foreach v_table in array array['academy_courses', 'academy_modules', 'academy_lessons', 'academy_enrollments', 'academy_diplomas'] loop
    execute format('update public.%I set tenant_id = tenant_id', v_table);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0418: Portal obtuvo UPDATE de %', v_table; end if;
    begin
      execute format('delete from public.%I', v_table);
      get diagnostics v_count = row_count;
      if v_count <> 0 then raise exception 'TEST 0418: Portal obtuvo DELETE de %', v_table; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
  foreach v_sql in array array[
    'insert into public.academy_courses (tenant_id, slug, title) values (pg_temp.fixture_id(''tenant-A''), ''forbidden'', ''synthetic'')',
    'insert into public.academy_modules (tenant_id, course_id, title) values (pg_temp.fixture_id(''tenant-A''), pg_temp.fixture_id(''A-enrolled''), ''synthetic'')',
    'insert into public.academy_lessons (tenant_id, course_id, module_id, title) values (pg_temp.fixture_id(''tenant-A''), pg_temp.fixture_id(''A-enrolled''), pg_temp.fixture_id(''A-enrolled-module''), ''synthetic'')',
    'insert into public.academy_enrollments (tenant_id, course_id, client_markbox, student_name) values (pg_temp.fixture_id(''tenant-A''), pg_temp.fixture_id(''A-enrolled''), ''DUP'', ''synthetic'')',
    'insert into public.academy_diplomas (tenant_id, client_markbox, folio, student_name, course_title) values (pg_temp.fixture_id(''tenant-A''), ''DUP'', ''forbidden'', ''synthetic'', ''synthetic'')'
  ] loop perform pg_temp.expect_denied_insert(v_sql); end loop;
end;
$portal_cannot_manage_academy$;

reset role;
savepoint team_operations;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('team-A')::text, true);
do $team_preserved$
declare v record; v_count bigint; v_table text;
begin
  for v in select * from team_row_baseline loop
    execute format('select count(*) from public.%I', v.table_name) into v_count;
    if v_count <> v.row_count then raise exception 'TEST 0418: equipo perdió o amplió visibilidad en %', v.table_name; end if;
    execute format('select count(*) from public.%I where tenant_id <> pg_temp.fixture_id(''tenant-A'')', v.table_name) into v_count;
    if v_count <> 0 then raise exception 'TEST 0418: equipo sin Portal cruzó tenant en %', v.table_name; end if;
  end loop;
  insert into public.academy_courses (id, tenant_id, slug, title)
  values (pg_temp.fixture_id('team-course'), pg_temp.fixture_id('tenant-A'), 'team-course', 'synthetic');
  insert into public.academy_modules (id, tenant_id, course_id, title)
  values (pg_temp.fixture_id('team-module'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('team-course'), 'synthetic');
  insert into public.academy_lessons (id, tenant_id, course_id, module_id, title)
  values (pg_temp.fixture_id('team-lesson'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('team-course'), pg_temp.fixture_id('team-module'), 'synthetic');
  insert into public.academy_enrollments (id, tenant_id, course_id, student_name)
  values (pg_temp.fixture_id('team-enrollment'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('team-course'), 'synthetic');
  insert into public.academy_diplomas (id, tenant_id, enrollment_id, folio, student_name, course_title)
  values (pg_temp.fixture_id('team-diploma'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('team-enrollment'), 'team-folio', 'synthetic', 'synthetic');
  for v in select * from (values
    ('academy_courses', 'team-course'), ('academy_modules', 'team-module'), ('academy_lessons', 'team-lesson'),
    ('academy_enrollments', 'team-enrollment'), ('academy_diplomas', 'team-diploma')
  ) rows(table_name, label) loop
    execute format('update public.%I set tenant_id = tenant_id where id = %L', v.table_name, pg_temp.fixture_id(v.label));
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception 'TEST 0418: equipo perdió UPDATE de %', v.table_name; end if;
  end loop;
  -- Rama interna histórica: no se le imponen requisitos Portal de inscripción.
  insert into public.academy_lesson_progress (id, tenant_id, client_markbox, course_id, lesson_id)
  values (pg_temp.fixture_id('team-progress'), pg_temp.fixture_id('tenant-A'), 'TEAM', pg_temp.fixture_id('team-course'), pg_temp.fixture_id('team-lesson'));
  delete from public.academy_lesson_progress where id = pg_temp.fixture_id('team-progress');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0418: equipo perdió DELETE histórico de progreso'; end if;
end;
$team_preserved$;
rollback to savepoint team_operations;
release savepoint team_operations;
reset role;
-- Principal dual: permiso interno A OR su aprendizaje Portal B, no todos los
-- clientes/catalogos privados de B ni inscripción cruzada E-B-cross hacia A.
insert into public.user_tenants values (pg_temp.fixture_id('portal-B'), pg_temp.fixture_id('tenant-A'), null);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
do $dual_principal$
declare v record; v_count bigint;
begin
  for v in select * from team_row_baseline loop
    execute format('select count(*) from public.%I where tenant_id = pg_temp.fixture_id(''tenant-A'')', v.table_name) into v_count;
    if v_count <> v.row_count then raise exception 'TEST 0418: principal dual perdió la rama interna en %', v.table_name; end if;
  end loop;
  if (select count(*) from public.academy_courses where tenant_id = pg_temp.fixture_id('tenant-B')) <> 3
     or (select count(*) from public.academy_modules where tenant_id = pg_temp.fixture_id('tenant-B')) <> 3
     or (select count(*) from public.academy_lessons where tenant_id = pg_temp.fixture_id('tenant-B')) <> 4
     or (select count(*) from public.academy_enrollments where tenant_id = pg_temp.fixture_id('tenant-B')) <> 3
     or (select count(*) from public.academy_diplomas where tenant_id = pg_temp.fixture_id('tenant-B')) <> 1
     or (select count(*) from public.academy_lesson_progress where tenant_id = pg_temp.fixture_id('tenant-B')) <> 1 then
    raise exception 'TEST 0418: principal dual amplió o perdió la rama Portal B';
  end if;
  delete from public.academy_lesson_progress where id = pg_temp.fixture_id('P-B-other');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0418: principal dual borró progreso de otro cliente B'; end if;
end;
$dual_principal$;
reset role;
set local role anon;
do $anon_denied$
declare v_table text; v_blocked boolean;
begin
  foreach v_table in array array['academy_courses', 'academy_modules', 'academy_lessons', 'academy_enrollments', 'academy_diplomas', 'academy_lesson_progress'] loop
    v_blocked := false;
    begin execute format('select 1 from public.%I', v_table);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0418: anon accedió a %', v_table; end if;
  end loop;
end;
$anon_denied$;
reset role;
-- Ni la solución ni los negativos deben purgar el progreso/diploma histórico.
do $history_preserved$
begin
  if (select count(*) from public.academy_lesson_progress) <> 7
     or (select count(*) from public.academy_diplomas) <> 10 then
    raise exception 'TEST 0418: se purgó historia o quedó residuo de escrituras de prueba';
  end if;
end;
$history_preserved$;
rollback;
select to_regclass('public.academy_courses') is null as portal_academia_0418_fixture_rolled_back;
