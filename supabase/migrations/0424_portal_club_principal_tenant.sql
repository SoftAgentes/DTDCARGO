-- 0424 · SDD-0368 · Club Portal: vínculo, cliente y persona del mismo tenant.
-- Sólo sustituye el helper existente; preserva owner/ACL/policies/triggers/datos.
-- Cloud requiere GO nominal y transacción; sin RPC o deploy previo.

do $preflight$
declare v_table text; v_helper oid := pg_catalog.to_regprocedure('public.get_portal_person_id()');
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0424: requiere auth.uid()';
  end if;
  foreach v_table in array array[
    'client_users', 'clients', 'persons', 'club_members', 'club_group_buys',
    'club_group_buy_participants', 'academy_cohorts',
    'club_event_registrations', 'club_featured_suppliers'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0424: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_helper and p.prokind = 'f' and p.pronargs = 0
      and p.prorettype = 'uuid'::pg_catalog.regtype and not p.proretset
      and p.prosecdef and p.provolatile = 's' and not p.proleakproof
      and p.prolang = (select oid from pg_catalog.pg_language where lanname = 'sql')
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.array_length(p.proconfig, 1) = 1
      and p.proconfig[1] in ('search_path=public', 'search_path=""')
      and pg_catalog.md5(p.prosrc) in (
        'd6d407d74ea4426a960fe03991625b35', -- 0187, metadato alojado comprobado
        '4dca9b6a048929d7fcfaf2314c6ff61f'  -- esta versión, permite reejecución
      )
      and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception '0424: helper ausente o firma/cuerpo/configuracion/ACL con drift';
  end if;

  -- Inventario completo de las seis tablas consumidoras. No cambia su RLS.
  if exists (
    with expected(tablename, policyname, cmd) as (values
      ('club_members', 'club_members by tenant', 'ALL'),
      ('club_members', 'club_members portal read', 'SELECT'),
      ('club_group_buys', 'club_group_buys by tenant', 'ALL'),
      ('club_group_buys', 'club_group_buys portal read', 'SELECT'),
      ('club_group_buy_participants', 'club_gb_participants by tenant', 'ALL'),
      ('club_group_buy_participants', 'club_gb_participants portal read', 'SELECT'),
      ('academy_cohorts', 'academy_cohorts by tenant', 'ALL'),
      ('academy_cohorts', 'club_events portal read', 'SELECT'),
      ('club_event_registrations', 'club_event_registrations by tenant', 'ALL'),
      ('club_event_registrations', 'club_event_registrations portal read', 'SELECT'),
      ('club_featured_suppliers', 'club_featured_suppliers by tenant', 'ALL'),
      ('club_featured_suppliers', 'club_featured_suppliers portal read', 'SELECT')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename in (
        'club_members', 'club_group_buys', 'club_group_buy_participants',
        'academy_cohorts', 'club_event_registrations', 'club_featured_suppliers'
      )
    )
    select 1 from expected e full join actual a
      on e.tablename = a.tablename and e.policyname = a.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
      or (e.cmd = 'SELECT' and a.with_check is not null)
  ) then
    raise exception '0424: inventario de policies con drift';
  end if;

  -- Dependencias reales de pg_policy, no una coincidencia de texto/comentario.
  if exists (
    with expected(tablename, policyname) as (values
      ('club_members', 'club_members portal read'),
      ('club_group_buys', 'club_group_buys portal read'),
      ('club_group_buy_participants', 'club_gb_participants portal read'),
      ('academy_cohorts', 'club_events portal read'),
      ('club_event_registrations', 'club_event_registrations portal read'),
      ('club_featured_suppliers', 'club_featured_suppliers portal read')
    ), actual as (
      select c.relname as tablename, p.polname as policyname, n.nspname
      from pg_catalog.pg_depend d
      join pg_catalog.pg_policy p
        on d.classid = 'pg_catalog.pg_policy'::pg_catalog.regclass and d.objid = p.oid
      join pg_catalog.pg_class c on c.oid = p.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        and d.refobjid = v_helper
    )
    select 1 from expected e full join actual a
      on e.tablename = a.tablename and e.policyname = a.policyname and a.nspname = 'public'
    where e.policyname is null or a.policyname is null
  ) then
    raise exception '0424: consumidores del helper con drift';
  end if;
end;
$preflight$;

-- Mantiene la API y la elevación ya existentes. CREATE OR REPLACE conserva
-- identidad/OID, propietario y ACL; no usa el helper menos estricto de cliente.
-- persons.deleted_at no es un revocador nuevo: manda el acceso active + cliente vivo.
create or replace function public.get_portal_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select c.person_id
  from public.client_users cu
  join public.clients c
    on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
  join public.persons p
    on p.id = c.person_id and p.tenant_id = c.tenant_id
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
  limit 1
$function$;

comment on function public.get_portal_person_id() is
  'SDD-0368: persona del principal Portal active, cliente vivo y tenant coherente entre vinculo, cliente y persona. NULL ante incoherencia; conserva la membresia por persona y no modifica permisos de Studio.';

do $postflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.get_portal_person_id()')
      and p.prorettype = 'uuid'::pg_catalog.regtype and not p.proretset
      and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=""']::text[]
      and pg_catalog.md5(p.prosrc) = '4dca9b6a048929d7fcfaf2314c6ff61f'
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception '0424: helper final invalido';
  end if;
end;
$postflight$;
