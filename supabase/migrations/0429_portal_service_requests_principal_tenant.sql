-- 0429 · SDD-0381 · Solicitudes Portal por principal vivo y tenant coherente.
-- Sólo tres policies. Sin DML, ACL, helpers, triggers ni cambios de equipo.
-- Aplicación Cloud individual con autorización nominal independiente.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0429 requiere auth.uid()';
  end if;
  foreach v_table in array array[
    'prealerta_service_requests', 'client_users', 'clients', 'prealertas'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0429: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(policyname, cmd, role_name) as (values
      ('psr portal self select', 'SELECT', 'authenticated'),
      ('psr portal self insert', 'INSERT', 'authenticated'),
      ('psr portal self update', 'UPDATE', 'authenticated'),
      ('psr tenant read', 'SELECT', 'authenticated'),
      ('psr tenant update', 'UPDATE', 'authenticated'),
      ('psr service_role all', 'ALL', 'service_role')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'prealerta_service_requests'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
      or (e.cmd = 'INSERT' and (a.qual is not null or a.with_check is null))
      or (e.cmd = 'SELECT' and (a.qual is null or a.with_check is not null))
      or (e.cmd in ('UPDATE', 'ALL') and (a.qual is null or a.with_check is null))
  ) then
    raise exception '0429: inventario de policies con drift';
  end if;
end;
$preflight$;

alter policy "psr portal self select" on public.prealerta_service_requests
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealerta_service_requests.tenant_id
        and c.markbox = prealerta_service_requests.client_markbox
    )
  );

alter policy "psr portal self insert" on public.prealerta_service_requests
  with check (
    consent_accepted = true and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealerta_service_requests.tenant_id
        and c.markbox = prealerta_service_requests.client_markbox
    )
  );

-- USING autoriza la fila ORIGINAL; WITH CHECK autoriza la resultante.
-- Validar sólo NEW permitía reasignarse una fila ajena con el mismo markbox.
alter policy "psr portal self update" on public.prealerta_service_requests
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealerta_service_requests.tenant_id
        and c.markbox = prealerta_service_requests.client_markbox
    )
  )
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealerta_service_requests.tenant_id
        and c.markbox = prealerta_service_requests.client_markbox
    )
  );
