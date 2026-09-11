-- 0425 · SDD-0372 · Direcciones Portal ligadas a principal, cliente y tenant.
-- LOCAL: aplicar a Cloud sólo con GO nominal. Sin DML, helpers o ACL nuevos.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0425 requiere auth.uid()';
  end if;
  foreach v_table in array array['client_users', 'clients', 'client_delivery_addresses'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0425: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(policyname, cmd, roles) as (values
      ('client_delivery_addresses by tenant', 'ALL', array['authenticated']::name[]),
      ('client_delivery_addresses service_role all', 'ALL', array['service_role']::name[]),
      ('client_delivery_addresses portal self read', 'SELECT', array['authenticated']::name[]),
      ('client_delivery_addresses portal self insert', 'INSERT', array['authenticated']::name[]),
      ('client_delivery_addresses portal self update', 'UPDATE', array['authenticated']::name[])
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'client_delivery_addresses'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd or a.roles <> e.roles or a.permissive <> 'PERMISSIVE'
      or (e.cmd = 'SELECT' and a.with_check is not null)
      or (e.cmd = 'INSERT' and a.qual is not null)
      or (e.cmd in ('SELECT', 'UPDATE', 'ALL') and a.qual is null)
      or (e.cmd in ('INSERT', 'UPDATE', 'ALL') and a.with_check is null)
  ) then
    raise exception '0425: inventario de policies con drift';
  end if;
end;
$preflight$;

alter policy "client_delivery_addresses portal self read"
  on public.client_delivery_addresses
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and c.id = client_delivery_addresses.client_id
        and c.tenant_id = client_delivery_addresses.tenant_id
        and c.markbox = client_delivery_addresses.client_markbox
    )
  );

alter policy "client_delivery_addresses portal self insert"
  on public.client_delivery_addresses
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and c.id = client_delivery_addresses.client_id
        and c.tenant_id = client_delivery_addresses.tenant_id
        and c.markbox = client_delivery_addresses.client_markbox
    )
  );

alter policy "client_delivery_addresses portal self update"
  on public.client_delivery_addresses
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and c.id = client_delivery_addresses.client_id
        and c.tenant_id = client_delivery_addresses.tenant_id
        and c.markbox = client_delivery_addresses.client_markbox
    )
  )
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and c.id = client_delivery_addresses.client_id
        and c.tenant_id = client_delivery_addresses.tenant_id
        and c.markbox = client_delivery_addresses.client_markbox
    )
  );
