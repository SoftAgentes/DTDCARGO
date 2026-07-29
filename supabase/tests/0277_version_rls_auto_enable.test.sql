\set ON_ERROR_STOP on

begin;

select 'create role anon nologin'
where not exists (select 1 from pg_roles where rolname = 'anon')
\gexec
select 'create role authenticated nologin'
where not exists (select 1 from pg_roles where rolname = 'authenticated')
\gexec
select 'create role service_role nologin'
where not exists (select 1 from pg_roles where rolname = 'service_role')
\gexec

\ir ../migrations/0277_version_rls_auto_enable.sql
\ir ../migrations/0277_version_rls_auto_enable.sql

create table public.sdd_0172_rls_probe_0277 (id bigint primary key);

do $contract$
declare
  fn oid := to_regprocedure('public.rls_auto_enable()');
begin
  if fn is null then
    raise exception 'TEST 0277: falta rls_auto_enable()';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid = fn
      and prosecdef
      and prorettype = 'event_trigger'::regtype
      and proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'TEST 0277: contrato de función incorrecto';
  end if;
  if not exists (
    select 1
    from pg_event_trigger
    where evtname = 'ensure_rls'
      and evtevent = 'ddl_command_end'
      and evtenabled = 'O'
      and evttags = array['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']
  ) then
    raise exception 'TEST 0277: contrato del event trigger incorrecto';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sdd_0172_rls_probe_0277'
      and c.relrowsecurity
  ) then
    raise exception 'TEST 0277: la tabla nueva no recibió RLS';
  end if;
  if has_function_privilege('anon', fn, 'EXECUTE')
     or has_function_privilege('authenticated', fn, 'EXECUTE')
     or not has_function_privilege('service_role', fn, 'EXECUTE') then
    raise exception 'TEST 0277: ACL incorrecto';
  end if;
end
$contract$;

rollback;

select to_regclass('public.sdd_0172_rls_probe_0277') is null
  and to_regprocedure('public.rls_auto_enable()') is null
  as sdd_0172_rls_0277_rolled_back;
