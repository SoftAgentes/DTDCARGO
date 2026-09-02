\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0328. Las funciones son stubs con las firmas
-- productivas: aquí se mide el ACL final, no su lógica de negocio.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create function public.academy_verify_diploma(p_folio text)
returns table (
  folio text,
  student_name text,
  course_title text,
  hours integer,
  place text,
  issued_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select null::text, null::text, null::text, null::integer, null::text, null::date
  where false;
$$;

create function public.markbox_existe_publico(p_markbox text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select false $$;

-- Reproducir el ACL vulnerable previo a 0400, incluida la concesión por PUBLIC
-- que Postgres entrega por defecto al crear funciones.
grant execute on function public.academy_verify_diploma(text)
  to anon, authenticated;
grant execute on function public.markbox_existe_publico(text)
  to anon, authenticated;

\ir ../migrations/0400_revoke_public_verify_rpc_execute.sql

do $$
begin
  assert not has_function_privilege(
    'anon',
    'public.academy_verify_diploma(text)',
    'execute'
  ), 'anon todavía puede enumerar diplomas por Data API';
  assert not has_function_privilege(
    'authenticated',
    'public.academy_verify_diploma(text)',
    'execute'
  ), 'authenticated todavía puede saltarse el throttle de diplomas';
  assert has_function_privilege(
    'service_role',
    'public.academy_verify_diploma(text)',
    'execute'
  ), 'el servidor perdió la verificación de diplomas';

  assert not has_function_privilege(
    'anon',
    'public.markbox_existe_publico(text)',
    'execute'
  ), 'anon todavía puede enumerar Shipping Marks por Data API';
  assert not has_function_privilege(
    'authenticated',
    'public.markbox_existe_publico(text)',
    'execute'
  ), 'authenticated todavía puede saltarse el throttle de Shipping Marks';
  assert has_function_privilege(
    'service_role',
    'public.markbox_existe_publico(text)',
    'execute'
  ), 'el servidor perdió la resolución de Shipping Marks';
end;
$$;

rollback;
