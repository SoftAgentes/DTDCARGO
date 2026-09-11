-- 0434 · SDD-0402 · Catálogo de servicios Portal por principal y tenant.
-- Modifica sólo la policy SELECT compartida por equipo y Portal. Sin DML,
-- cambios de ACL, funciones, triggers ni Storage. Aplicación Cloud individual.

do $preflight$
declare v_table text; v_qual text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0434 requiere auth.uid()';
  end if;

  foreach v_table in array array[
    'clients', 'client_users', 'prealerta_addons'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0434: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;

  if exists (
    with expected(policyname, cmd, role_name) as (values
      ('prealerta_addons read', 'SELECT', 'authenticated'),
      ('prealerta_addons tenant write', 'ALL', 'authenticated'),
      ('prealerta_addons service_role all', 'ALL', 'service_role')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'prealerta_addons'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd
      or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0434: inventario de policies ausente o con drift';
  end if;

  select pg_catalog.lower(qual) into v_qual from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'prealerta_addons'
    and policyname = 'prealerta_addons read';
  if v_qual is null
     or v_qual not like '%get_user_tenant_id%'
     or v_qual not like '%get_portal_client_tenant%' then
    raise exception '0434: definición histórica de policy con drift';
  end if;
end;
$preflight$;

alter policy "prealerta_addons read" on public.prealerta_addons
  using (
    tenant_id = public.get_user_tenant_id()
    or exists (
      select 1 from public.client_users cu
      join public.clients client
        on client.id = cu.client_id
       and client.tenant_id = cu.tenant_id
       and client.deleted_at is null
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.tenant_id = prealerta_addons.tenant_id
    )
  );

do $postflight$
declare v_qual text;
begin
  select pg_catalog.lower(qual) into v_qual from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'prealerta_addons'
    and policyname = 'prealerta_addons read'
    and cmd = 'SELECT'
    and roles = array['authenticated']::name[]
    and permissive = 'PERMISSIVE';
  if v_qual is null
     or v_qual not like '%get_user_tenant_id%'
     or v_qual not like '%client_users%'
     or v_qual not like '%clients%'
     or v_qual not like '%auth.uid()%'
     or v_qual not like '%client.tenant_id = cu.tenant_id%'
     or v_qual not like '%cu.tenant_id = prealerta_addons.tenant_id%'
     or v_qual not like '%client.deleted_at is null%'
     or v_qual like '%get_portal_client_tenant%' then
    raise exception '0434: policy de catálogo final inválida';
  end if;
end;
$postflight$;
