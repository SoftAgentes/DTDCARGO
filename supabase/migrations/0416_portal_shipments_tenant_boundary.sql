-- 0416 · SDD-0359 · Lectura Portal de envíos y sus hijos ligada al tenant.
-- Sólo reemplaza las tres policies Portal; no altera equipo, ACL, datos o Storage.
-- Gate Cloud individual. Requiere 0080, 0086 y 0196; sin dependencia de app nueva.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regclass('public.client_users') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0416 requiere principal Portal y auth.uid()';
  end if;
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0416: tabla ausente o sin RLS: %', v_table;
    end if;
    if (select count(*) from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = v_table
          and policyname = v_table || ' portal self read'
          and cmd = 'SELECT' and roles = array['authenticated']::name[]) <> 1
       or (select count(*) from pg_catalog.pg_policies
           where schemaname = 'public' and tablename = v_table
             and policyname = v_table || ' by tenant' and cmd = 'ALL') <> 1
       or exists (
         select 1 from pg_catalog.pg_policies
         where schemaname = 'public' and tablename = v_table
           and cmd in ('ALL', 'SELECT')
           and ('authenticated' = any(roles) or 'public' = any(roles))
           and policyname not in (v_table || ' portal self read', v_table || ' by tenant')
       ) then
      raise exception '0416: policies de lectura ausentes o con drift: %', v_table;
    end if;
  end loop;
end;
$preflight$;

drop policy "shipments portal self read" on public.shipments;
create policy "shipments portal self read"
  on public.shipments for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = shipments.tenant_id
        and c.markbox = shipments.client_markbox
    )
  );

drop policy "shipment_documents portal self read" on public.shipment_documents;
create policy "shipment_documents portal self read"
  on public.shipment_documents for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.shipments as s
        on s.tenant_id = cu.tenant_id and s.client_markbox = c.markbox
          and s.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and s.id = shipment_documents.shipment_id
        and s.tenant_id = shipment_documents.tenant_id
        and s.client_markbox = shipment_documents.client_markbox
    )
  );

drop policy "shipment_events portal self read" on public.shipment_events;
create policy "shipment_events portal self read"
  on public.shipment_events for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      join public.shipments as s
        on s.tenant_id = cu.tenant_id and s.client_markbox = c.markbox
          and s.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and s.id = shipment_events.shipment_id
        and s.tenant_id = shipment_events.tenant_id
    )
  );

do $postflight$
declare v_table text;
begin
  foreach v_table in array array['shipments', 'shipment_documents', 'shipment_events'] loop
    if not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = v_table
        and policyname = v_table || ' portal self read' and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and qual like '%client_users%' and qual like '%auth.uid()%'
        and qual like '%tenant_id%' and qual not like '%get_portal_client_markbox%'
    ) then
      raise exception '0416: policy Portal final inválida: %', v_table;
    end if;
  end loop;
end;
$postflight$;
