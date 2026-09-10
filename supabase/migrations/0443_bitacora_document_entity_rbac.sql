-- SDD-0411 · Adjuntos de Bitácora con RBAC del módulo Bitácora.
--
-- bitacora_task indexa su metadata en documents, pero el binario vive en el
-- bucket bitacora junto a los audios de actas. Ambos caminos deben heredar la
-- vista/edición del módulo y mantener a support estrictamente read-only.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_contract_definition text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_module_contract(text)'
  ) is null
     or pg_catalog.to_regprocedure(
       'public.document_entity_authorized(text,uuid,text)'
     ) is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception '0443 requiere el contrato documental de 0442 y Storage';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_module_contract(text)'::regprocedure
  ) into v_contract_definition;

  if pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0410:%'
     or v_contract_definition not like '%''consolidation'', ''naviera''%'
     or v_contract_definition not like '%''booking'', ''naviera''%'
     or v_contract_definition like '%''bitacora_task'', ''bitacora''%' then
    raise exception '0443: helper previo ausente o con drift';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'bitacora tenant insert storage',
        'bitacora tenant read storage',
        'bitacora tenant delete storage'
      )
      and coalesce(qual, with_check) like '%get_user_tenant_id%'
      and coalesce(qual, with_check) not like '%document_entity_authorized%'
  ) <> 3 then
    raise exception '0443: policies previas del bucket bitacora ausentes o con drift';
  end if;
end;
$preflight$;

create or replace function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql
immutable
security invoker
set search_path = ''
as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[]),
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;

comment on function public.document_entity_module_contract(text) is
  'SDD-0411: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';

revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0411: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; las entidades clasificadas, incluida bitacora_task, heredan sus módulos.';

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0411: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

drop policy "bitacora tenant insert storage" on storage.objects;
create policy "bitacora tenant insert storage"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'bitacora_task',
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

drop policy "bitacora tenant read storage" on storage.objects;
create policy "bitacora tenant read storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'bitacora_task',
      (select public.get_user_tenant_id()),
      'view'
    )
  );

drop policy "bitacora tenant delete storage" on storage.objects;
create policy "bitacora tenant delete storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      'bitacora_task',
      (select public.get_user_tenant_id()),
      'edit'
    )
  );

do $post$
declare
  v_contract_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_module_contract(text)'::regprocedure
  ) into v_contract_definition;

  if pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0411:%'
     or v_contract_definition not like '%''bitacora_task'', ''bitacora''%'
     or pg_catalog.obj_description(
       'public.document_entity_authorized(text,uuid,text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0411:%' then
    raise exception '0443: contrato de Bitácora no quedó instalado';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) then
    raise exception '0443: el mapa interno quedó expuesto a un rol de API';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'bitacora tenant insert storage',
        'bitacora tenant read storage',
        'bitacora tenant delete storage'
      )
      and coalesce(qual, with_check) like '%document_entity_authorized%'
  ) <> 3 then
    raise exception '0443: RBAC del bucket bitacora incompleto';
  end if;
end;
$post$;
