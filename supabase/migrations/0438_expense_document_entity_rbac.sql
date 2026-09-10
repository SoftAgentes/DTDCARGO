-- SDD-0406 · Documentos de gastos: permisos por módulo y por acción.
--
-- Los gastos son configurables por tenant mediante studio_role_module_overrides,
-- a diferencia de los cuatro tipos financieros bloqueados por 0435–0437. Este
-- slice introduce un helper tenant-aware de vista/edición y lo conecta a filas,
-- Storage, reservas, restauraciones y guards de RPC SECURITY DEFINER.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_definition text;
  v_comment text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_allowed_for_current_role(text)'
  ) is null
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null
     or pg_catalog.to_regclass('public.documents') is null
     or pg_catalog.to_regclass('public.document_upload_intents') is null
     or pg_catalog.to_regclass('public.document_restore_outbox') is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception '0438 requiere el control documental de 0437 y la matriz de overrides';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure
  ), pg_catalog.obj_description(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure,
    'pg_proc'
  ) into v_definition, v_comment;

  if v_comment not like 'SDD-0405:%'
     or v_definition not like '%''journal_entry''%'
     or v_definition like '%''expense''%' then
    raise exception '0438: helper previo ausente o con drift';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents by tenant' and cmd = 'ALL'
      and qual like '%document_entity_allowed_for_current_role%'
      and with_check like '%document_entity_allowed_for_current_role%'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'document_upload_intents'
      and policyname = 'document upload intents own tenant read'
      and qual like '%document_entity_allowed_for_current_role%'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'document_restore_outbox'
      and policyname = 'document restore requester read'
      and qual like '%document_entity_allowed_for_current_role%'
  ) then
    raise exception '0438: policies documentales previas ausentes o con drift';
  end if;

  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'documents tenant insert',
        'documents tenant read',
        'documents tenant delete'
      )
      and coalesce(qual, with_check) like '%document_entity_allowed_for_current_role%'
  ) <> 3 then
    raise exception '0438: policies previas del bucket documents ausentes o con drift';
  end if;

  if pg_catalog.to_regprocedure('public.enforce_document_entity_rbac()') is null
     or pg_catalog.to_regprocedure(
       'public.enforce_document_upload_intent_entity_rbac()'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.enforce_document_restore_entity_rbac()'
     ) is null then
    raise exception '0438: guards de RPC SECURITY DEFINER ausentes';
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
  with membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      m.role,
      o.can_view,
      o.can_edit
    from membership m
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = 'expenses'
  )
  select coalesce((
    select case
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, '')))
           not in ('view', 'edit') then false
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and d.role = 'admin' then true
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and pg_catalog.lower(pg_catalog.btrim(p_access)) = 'view' then
        coalesce(d.can_view, d.role in ('accounting', 'operations', 'warehouse'))
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and pg_catalog.lower(pg_catalog.btrim(p_access)) = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role in ('accounting', 'operations', 'warehouse'))
      else true
    end
    from decision d
  ), false)
$$;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0406: autorización documental tenant-aware. Tipos financieros permanecen accounting/admin; expense replica vista/edición y overrides del módulo expenses, incluido support read-only.';

revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

-- Compatibilidad temporal para consumidores externos a las policies. Toda la
-- defensa activa de este slice usa la firma tenant-aware anterior.
create or replace function public.document_entity_allowed_for_current_role(
  p_entity_type text
) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.document_entity_authorized(
    p_entity_type,
    (select public.get_user_tenant_id()),
    'view'
  )
$$;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0406: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;

-- La policy ALL no podía distinguir vista de edición. Se reemplaza por tres
-- decisiones explícitas; no se crea DELETE y el candado físico sigue vigente.
drop policy "documents by tenant" on public.documents;
create policy "documents by tenant read"
  on public.documents for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type::text, tenant_id, 'view')
  );
create policy "documents by tenant insert"
  on public.documents for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type::text, tenant_id, 'edit')
  );
create policy "documents by tenant update"
  on public.documents for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type::text, tenant_id, 'edit')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type::text, tenant_id, 'edit')
  );

drop policy "document upload intents own tenant read"
  on public.document_upload_intents;
create policy "document upload intents own tenant read"
  on public.document_upload_intents for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and public.document_entity_authorized(entity_type, tenant_id, 'view')
  );

drop policy "document restore requester read"
  on public.document_restore_outbox;
create policy "document restore requester read"
  on public.document_restore_outbox for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and requested_by = (select auth.uid())
    and exists (
      select 1
      from public.documents d
      where d.id = document_restore_outbox.document_id
        and d.tenant_id = document_restore_outbox.tenant_id
        and public.document_entity_authorized(
          d.entity_type::text,
          d.tenant_id,
          'view'
        )
    )
  );

drop policy "documents tenant insert" on storage.objects;
create policy "documents tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

drop policy "documents tenant read" on storage.objects;
create policy "documents tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()),
      'view'
    )
  );

drop policy "documents tenant delete" on storage.objects;
create policy "documents tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

create or replace function public.enforce_document_entity_rbac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and not public.document_entity_authorized(
       new.entity_type::text,
       new.tenant_id,
       'edit'
     ) then
    raise exception 'rol sin permiso para documentos de entidad %', new.entity_type
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_document_upload_intent_entity_rbac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and not public.document_entity_authorized(
       new.entity_type,
       new.tenant_id,
       'edit'
     ) then
    raise exception 'rol sin permiso para reservar documentos de entidad %', new.entity_type
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_document_restore_entity_rbac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not exists (
    select 1
    from public.documents d
    where d.id = new.document_id
      and d.tenant_id = new.tenant_id
      and public.document_entity_authorized(
        d.entity_type::text,
        d.tenant_id,
        'edit'
      )
  ) then
    raise exception 'rol sin permiso para restaurar este documento'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_document_entity_rbac()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_document_upload_intent_entity_rbac()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_document_restore_entity_rbac()
  from public, anon, authenticated, service_role;

do $post$
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_authorized(text,uuid,text)'
  ) is null then
    raise exception '0438: helper tenant-aware no quedó instalado';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents by tenant'
  ) or (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname in (
        'documents by tenant read',
        'documents by tenant insert',
        'documents by tenant update'
      )
      and coalesce(qual, with_check) like '%document_entity_authorized%'
  ) <> 3 then
    raise exception '0438: separación read/write de documents incompleta';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated', 'public.documents', 'DELETE'
  ) then
    raise exception '0438: authenticated recuperó DELETE físico de documents';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname in ('public', 'storage')
      and tablename in (
        'documents',
        'document_upload_intents',
        'document_restore_outbox',
        'objects'
      )
      and policyname in (
        'documents by tenant read',
        'documents by tenant insert',
        'documents by tenant update',
        'document upload intents own tenant read',
        'document restore requester read',
        'documents tenant insert',
        'documents tenant read',
        'documents tenant delete'
      )
      and concat_ws(' ', qual, with_check)
          like '%document_entity_allowed_for_current_role%'
  ) then
    raise exception '0438: una policy activa conserva el helper sin acción';
  end if;
end;
$post$;
