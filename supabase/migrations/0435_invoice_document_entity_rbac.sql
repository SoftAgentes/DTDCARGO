-- SDD-0403 · Documentos de factura: autorización por entidad.
--
-- El Hub DMS es transversal, pero `invoice` enlaza el módulo bloqueado
-- Facturación: sólo accounting/admin. La policy histórica `documents by
-- tenant` y las tres policies del bucket autorizaban por tenant, así que roles
-- como commercial podían leer metadatos, enumerar/firmar el objeto y mutar una
-- factura documental sin poder entrar a Facturación.
--
-- Este primer slice conserva todos los demás tipos tal como están y cierra
-- `invoice` en las cuatro capas que realmente participan:
--   1. filas de documents;
--   2. objetos del bucket documents;
--   3. reservas de subida y solicitudes de restauración;
--   4. triggers que alcanzan escrituras hechas por RPC SECURITY DEFINER.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_table text;
  v_drift text;
begin
  foreach v_table in array array[
    'public.documents',
    'public.document_upload_intents',
    'public.document_restore_outbox',
    'storage.objects'
  ] loop
    if pg_catalog.to_regclass(v_table) is null then
      raise exception '0435 requiere tabla activa: %', v_table;
    end if;
    if v_table <> 'storage.objects' and not (
      select c.relrowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass(v_table)
    ) then
      raise exception '0435 requiere RLS activo: %', v_table;
    end if;
  end loop;

  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regprocedure('auth.role()') is null
     or pg_catalog.to_regprocedure('storage.foldername(text)') is null then
    raise exception '0435 requiere helpers activos de tenant, rol, auth y Storage';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'document_entity_type'
      and e.enumlabel = 'invoice'
  ) then
    raise exception '0435 requiere document_entity_type.invoice';
  end if;

  with expected(schemaname, tablename, policyname, cmd, roles) as (
    values
      ('public'::name, 'documents'::name, 'documents by tenant'::name, 'ALL'::text, array['authenticated']::name[]),
      ('public'::name, 'documents'::name, 'documents service_role all'::name, 'ALL'::text, array['service_role']::name[]),
      ('public'::name, 'document_upload_intents'::name, 'document upload intents own tenant read'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('public'::name, 'document_upload_intents'::name, 'document upload intents service role all'::name, 'ALL'::text, array['service_role']::name[]),
      ('public'::name, 'document_restore_outbox'::name, 'document restore requester read'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('public'::name, 'document_restore_outbox'::name, 'document restore outbox service role all'::name, 'ALL'::text, array['service_role']::name[]),
      ('storage'::name, 'objects'::name, 'documents service_role all storage'::name, 'ALL'::text, array['service_role']::name[]),
      ('storage'::name, 'objects'::name, 'documents tenant insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('storage'::name, 'objects'::name, 'documents tenant read'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('storage'::name, 'objects'::name, 'documents tenant delete'::name, 'DELETE'::text, array['authenticated']::name[])
  ), actual as (
    select p.schemaname, p.tablename, p.policyname, p.cmd, p.roles
    from pg_catalog.pg_policies p
    where (p.schemaname = 'public' and p.tablename in (
      'documents', 'document_upload_intents', 'document_restore_outbox'
    )) or (
      p.schemaname = 'storage' and p.tablename = 'objects'
      and p.policyname like 'documents%'
    )
  ), drift as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select pg_catalog.string_agg(
    pg_catalog.concat_ws('.', schemaname, tablename, policyname, cmd), ', '
  ) into v_drift from drift;

  if v_drift is not null then
    raise exception '0435: inventario de policies ausente o con drift: %', v_drift;
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.documents', 'DELETE') then
    raise exception '0435 requiere el candado de borrado físico de 0394';
  end if;
end;
$preflight$;

create or replace function public.document_entity_allowed_for_current_role(
  p_entity_type text
) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'invoice'
      then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0403: autorización documental incremental. invoice hereda el candado de Facturación (accounting/admin); los demás tipos conservan su alcance previo.';

revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;

-- RLS de metadatos: conserva tenant y soft-delete; añade sólo el candado invoice.
drop policy "documents by tenant" on public.documents;
create policy "documents by tenant"
  on public.documents for all to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_allowed_for_current_role(entity_type::text)
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_allowed_for_current_role(entity_type::text)
  );

-- Una reserva histórica de factura tampoco debe reaparecer si cambia el rol.
drop policy "document upload intents own tenant read"
  on public.document_upload_intents;
create policy "document upload intents own tenant read"
  on public.document_upload_intents for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and public.document_entity_allowed_for_current_role(entity_type)
  );

-- Las solicitudes ya creadas quedan sometidas al mismo alcance actual.
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
        and public.document_entity_allowed_for_current_role(d.entity_type::text)
    )
  );

-- Storage usa el segundo segmento del path canónico {tenant}/{entity}/... .
-- coalesce preserva objetos legados sin ese segmento; el slice sólo estrecha
-- el namespace canónico `invoice`.
drop policy "documents tenant insert" on storage.objects;
create policy "documents tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );

drop policy "documents tenant read" on storage.objects;
create policy "documents tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );

drop policy "documents tenant delete" on storage.objects;
create policy "documents tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );

-- Los triggers son el cinturón de las RPC SECURITY DEFINER: RLS no se evalúa
-- con el rol del caller dentro de ellas, pero auth.role()/auth.uid() conservan
-- el principal de la solicitud.
create or replace function public.enforce_document_entity_rbac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and not public.document_entity_allowed_for_current_role(new.entity_type::text) then
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
     and not public.document_entity_allowed_for_current_role(new.entity_type) then
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
      and public.document_entity_allowed_for_current_role(d.entity_type::text)
  ) then
    raise exception 'rol sin permiso para restaurar este documento'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_entity_rbac_guard_trg on public.documents;
create trigger documents_entity_rbac_guard_trg
  before insert or update on public.documents
  for each row execute function public.enforce_document_entity_rbac();

drop trigger if exists document_upload_intents_entity_rbac_guard_trg
  on public.document_upload_intents;
create trigger document_upload_intents_entity_rbac_guard_trg
  before insert or update on public.document_upload_intents
  for each row execute function public.enforce_document_upload_intent_entity_rbac();

drop trigger if exists document_restore_entity_rbac_guard_trg
  on public.document_restore_outbox;
create trigger document_restore_entity_rbac_guard_trg
  before insert or update on public.document_restore_outbox
  for each row execute function public.enforce_document_restore_entity_rbac();

revoke all on function public.enforce_document_entity_rbac()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_document_upload_intent_entity_rbac()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_document_restore_entity_rbac()
  from public, anon, authenticated, service_role;
