-- 0417 · SDD-0361 · Principal y tenant en compras/proveedores del Portal.
-- Sólo modifica siete policies Portal. Sin DML, ACL, RPCs nuevas o Storage.
-- Requiere 0080/0105/0118/0229. Aplicación Cloud individual, transaccional,
-- con autorización nominal; no depende de una nueva versión de la aplicación.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0417 requiere auth.uid()';
  end if;
  foreach v_table in array array[
    'client_users', 'clients', 'suppliers_cn', 'prealertas', 'prealerta_documents'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0417: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(tablename, policyname, cmd, role_name) as (values
      ('suppliers_cn', 'suppliers_cn portal self select', 'SELECT', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn portal self insert', 'INSERT', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn portal self update', 'UPDATE', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn tenant read', 'SELECT', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn tenant insert', 'INSERT', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn tenant update', 'UPDATE', 'authenticated'),
      ('suppliers_cn', 'suppliers_cn service_role all', 'ALL', 'service_role'),
      ('prealertas', 'prealertas portal self select', 'SELECT', 'authenticated'),
      ('prealertas', 'prealertas portal self insert', 'INSERT', 'authenticated'),
      ('prealertas', 'prealertas portal self update', 'UPDATE', 'authenticated'),
      ('prealertas', 'prealertas tenant read', 'SELECT', 'authenticated'),
      ('prealertas', 'prealertas service_role all', 'ALL', 'service_role'),
      ('prealerta_documents', 'prealerta_documents by tenant', 'ALL', 'authenticated'),
      ('prealerta_documents', 'prealerta_documents portal self read', 'SELECT', 'authenticated'),
      ('prealerta_documents', 'prealerta_documents service_role all', 'ALL', 'service_role')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in ('suppliers_cn', 'prealertas', 'prealerta_documents')
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0417: inventario de policies ausente o con drift; revisar antes de aplicar';
  end if;
end;
$preflight$;

alter policy "suppliers_cn portal self select" on public.suppliers_cn
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = suppliers_cn.tenant_id
        and c.markbox = suppliers_cn.client_markbox
    )
  );

alter policy "suppliers_cn portal self insert" on public.suppliers_cn
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = suppliers_cn.tenant_id
        and c.markbox = suppliers_cn.client_markbox
    )
  );

alter policy "suppliers_cn portal self update" on public.suppliers_cn
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = suppliers_cn.tenant_id
        and c.markbox = suppliers_cn.client_markbox
    )
  )
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = suppliers_cn.tenant_id
        and c.markbox = suppliers_cn.client_markbox
    )
  );

alter policy "prealertas portal self select" on public.prealertas
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealertas.tenant_id
        and c.markbox = prealertas.client_markbox
    )
  );

alter policy "prealertas portal self insert" on public.prealertas
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealertas.tenant_id
        and c.markbox = prealertas.client_markbox
    )
  );

alter policy "prealertas portal self update" on public.prealertas
  using (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealertas.tenant_id
        and c.markbox = prealertas.client_markbox
    )
  )
  with check (
    exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = prealertas.tenant_id
        and c.markbox = prealertas.client_markbox
    )
  );

alter policy "prealerta_documents portal self read" on public.prealerta_documents
  using (
    deleted_at is null and client_markbox is not null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.prealertas p
        on p.tenant_id = cu.tenant_id and p.client_markbox = c.markbox
          and p.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and p.id = prealerta_documents.prealerta_id
        and p.tenant_id = prealerta_documents.tenant_id
        and p.client_markbox = prealerta_documents.client_markbox
    )
  );

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in ('suppliers_cn', 'prealertas', 'prealerta_documents')
        and policyname like '% portal self %'
        and roles = array['authenticated']::name[]
        and case when cmd = 'INSERT' then
          with_check like '%client_users%' and with_check like '%auth.uid()%'
            and with_check like '%tenant_id%'
        when cmd = 'UPDATE' then
          qual like '%client_users%' and qual like '%auth.uid()%' and qual like '%tenant_id%'
            and with_check = qual
        else
          cmd = 'SELECT' and qual like '%client_users%'
            and qual like '%auth.uid()%' and qual like '%tenant_id%'
        end
    ) <> 7 then
    raise exception '0417: frontera Portal final inválida';
  end if;
end;
$postflight$;
