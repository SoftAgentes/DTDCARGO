-- 0432 · SDD-0400 · Principal y tenant coherentes en cajas del Portal.
-- Sustituye una sola policy SELECT. Sin DML, cambios de ACL, helpers o Storage.
-- Aplicación Cloud individual y nominal; este archivo no autoriza ejecutarla.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0432 requiere auth.uid()';
  end if;

  foreach v_table in array array['client_users', 'clients', 'warehouse_boxes']
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      raise exception '0432: tabla ausente: %', v_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.warehouse_boxes')
      and relrowsecurity
  ) then
    raise exception '0432: tabla ausente o sin RLS: warehouse_boxes';
  end if;

  if exists (
    with expected(policyname, cmd, role_name) as (values
      ('warehouse_boxes by tenant', 'ALL', 'authenticated'),
      ('warehouse_boxes portal self read', 'SELECT', 'authenticated')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'warehouse_boxes'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd
      or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0432: inventario de policies ausente o con drift';
  end if;
end;
$preflight$;

alter policy "warehouse_boxes portal self read" on public.warehouse_boxes
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id
       and c.tenant_id = cu.tenant_id
       and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.tenant_id = warehouse_boxes.tenant_id
        and c.markbox = warehouse_boxes.markbox
    )
  );

do $postflight$
declare v_qual text;
begin
  select qual into v_qual
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'warehouse_boxes'
    and policyname = 'warehouse_boxes portal self read'
    and cmd = 'SELECT'
    and roles = array['authenticated']::name[]
    and permissive = 'PERMISSIVE';

  if v_qual is null
     or v_qual not like '%client_users%'
     or v_qual not like '%clients%'
     or v_qual not like '%auth.uid()%'
     or v_qual not like '%tenant_id%'
     or v_qual not like '%markbox%'
     or v_qual not like '%deleted_at%' then
    raise exception '0432: frontera Portal final inválida';
  end if;
end;
$postflight$;
