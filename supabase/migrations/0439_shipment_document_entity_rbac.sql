-- SDD-0407 · Documentos de envíos con RBAC de Tracking.
--
-- Protege las dos familias que coexisten para un envío:
--   1) documents(entity_type = shipment), consumida por el Hub/DocsPanel;
--   2) shipment_documents + bucket shipment-docs, visible al Portal.
--
-- La policy Portal por principal/tenant de 0416 permanece aditiva y SELECT-only.
-- Sólo el camino interno por tenant hereda vista/edición y overrides de Tracking.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_definition text;
  v_comment text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_authorized(text,uuid,text)'
  ) is null
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null
     or pg_catalog.to_regclass('public.shipment_documents') is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception '0439 requiere 0438, shipment_documents y Storage';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ), pg_catalog.obj_description(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure,
    'pg_proc'
  ) into v_definition, v_comment;

  if v_comment not like 'SDD-0406:%'
     or v_definition not like '%''expense''%'
     or v_definition not like '%''expenses''%'
     or v_definition like '%''tracking''%' then
    raise exception '0439: helper documental previo ausente o con drift';
  end if;

  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and roles = array['authenticated']::name[]
  ) <> 2
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'shipment_documents'
         and policyname = 'shipment_documents by tenant' and cmd = 'ALL'
         and qual like '%get_user_tenant_id%'
         and with_check like '%get_user_tenant_id%'
     )
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'shipment_documents'
         and policyname = 'shipment_documents portal self read' and cmd = 'SELECT'
         and qual like '%client_users%' and qual like '%auth.uid()%'
         and qual like '%tenant_id%'
     ) then
    raise exception '0439: policies de shipment_documents ausentes o con drift';
  end if;

  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'shipment-docs tenant insert',
        'shipment-docs tenant read',
        'shipment-docs tenant delete'
      )
      and coalesce(qual, with_check) like '%get_user_tenant_id%'
  ) <> 3 then
    raise exception '0439: policies del bucket shipment-docs ausentes o con drift';
  end if;
end;
$preflight$;

create or replace function public.document_entity_authorized(
  p_entity_type text,
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), contract(entity_type, module_id, default_roles) as (
    values
      ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
      ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[])
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      n.entity_type,
      n.access,
      m.role,
      c.module_id,
      c.default_roles,
      o.can_view,
      o.can_edit
    from normalized n
    cross join membership m
    left join contract c on c.entity_type = n.entity_type
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else true
    end
    from decision d
  ), false)
$$;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0407: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense y shipment replican vista/edición, defaults y overrides de sus módulos.';

revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

-- El wrapper conserva compatibilidad y ahora también refleja Tracking.
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0407: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

drop policy "shipment_documents by tenant" on public.shipment_documents;
create policy "shipment_documents by tenant read"
  on public.shipment_documents for select to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'view')
  );
create policy "shipment_documents by tenant insert"
  on public.shipment_documents for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );
create policy "shipment_documents by tenant update"
  on public.shipment_documents for update to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );
create policy "shipment_documents by tenant delete"
  on public.shipment_documents for delete to authenticated
  using (
    deleted_at is null
    and tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized('shipment', tenant_id, 'edit')
  );

drop policy "shipment-docs tenant insert" on storage.objects;
create policy "shipment-docs tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'shipment',
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

drop policy "shipment-docs tenant read" on storage.objects;
create policy "shipment-docs tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'shipment',
      (select public.get_user_tenant_id()),
      'view'
    )
  );

drop policy "shipment-docs tenant delete" on storage.objects;
create policy "shipment-docs tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'shipment',
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

do $post$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and policyname = 'shipment_documents by tenant'
  ) or (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and policyname in (
        'shipment_documents by tenant read',
        'shipment_documents by tenant insert',
        'shipment_documents by tenant update',
        'shipment_documents by tenant delete'
      )
      and coalesce(qual, with_check) like '%document_entity_authorized%'
  ) <> 4 then
    raise exception '0439: separación read/write de shipment_documents incompleta';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and policyname = 'shipment_documents portal self read' and cmd = 'SELECT'
      and qual like '%client_users%' and qual like '%auth.uid()%'
      and qual like '%tenant_id%'
  ) then
    raise exception '0439: se perdió la lectura Portal por principal y tenant';
  end if;

  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'shipment-docs tenant insert',
        'shipment-docs tenant read',
        'shipment-docs tenant delete'
      )
      and coalesce(qual, with_check) like '%document_entity_authorized%'
  ) <> 3 then
    raise exception '0439: RBAC del bucket shipment-docs incompleto';
  end if;
end;
$post$;
