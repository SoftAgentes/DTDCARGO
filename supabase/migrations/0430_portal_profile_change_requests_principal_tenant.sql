-- 0430 · SDD-0382 · Perfil y solicitudes Portal por principal y tenant.
-- Sólo dos policies de lectura. Sin DML, ACL, helpers, índices ni triggers.
-- Aplicación Cloud individual con autorización nominal independiente.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('public.get_portal_client_id()') is null
    or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0430: helpers de identidad esperados ausentes';
  end if;
  foreach v_table in array array['clients', 'client_users', 'client_change_requests'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0430: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(tablename, policyname, cmd, role_name) as (values
      ('clients', 'clients by tenant', 'ALL', 'authenticated'),
      ('clients', 'clients portal self read', 'SELECT', 'authenticated'),
      ('client_change_requests', 'client_change_requests self or tenant read', 'SELECT', 'authenticated')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in ('clients', 'client_change_requests')
    )
    select 1 from expected e
    full join actual a using (tablename, policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
      or a.qual is null
      or (e.cmd = 'ALL' and a.with_check is null)
      or (e.cmd = 'SELECT' and a.with_check is not null)
  ) then
    raise exception '0430: inventario de policies con drift';
  end if;
end;
$preflight$;

alter policy "clients portal self read" on public.clients
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.client_id = clients.id
        and cu.tenant_id = clients.tenant_id
    )
  );

alter policy "client_change_requests self or tenant read"
  on public.client_change_requests
  using (
    tenant_id = public.get_user_tenant_id()
    or (
      source = 'client' and exists (
        select 1 from public.client_users cu
        join public.clients c
          on c.id = cu.client_id
         and c.tenant_id = cu.tenant_id
         and c.deleted_at is null
        where cu.auth_user_id = (select auth.uid())
          and cu.status = 'active'
          and cu.client_id = client_change_requests.client_id
          and cu.tenant_id = client_change_requests.tenant_id
      )
    )
  );
