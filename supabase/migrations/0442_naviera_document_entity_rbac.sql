-- SDD-0410 · Documentos de Naviera con RBAC del módulo Naviera.
--
-- Añade consolidation y booking al mapa interno creado por 0441. Ambos tipos
-- heredan una única matriz porque nacen y se administran en el mismo módulo.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_contract_definition text;
  v_authorizer_definition text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_module_contract(text)'
  ) is null
     or pg_catalog.to_regprocedure(
       'public.document_entity_authorized(text,uuid,text)'
     ) is null then
    raise exception '0442 requiere el contrato documental de 0441';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_module_contract(text)'::regprocedure
  ), pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_contract_definition, v_authorizer_definition;

  if pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0409:%'
     or pg_catalog.obj_description(
       'public.document_entity_authorized(text,uuid,text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0409:%'
     or v_contract_definition not like '%''supplier'', ''suppliers''%'
     or v_contract_definition like '%''consolidation'', ''naviera''%'
     or v_contract_definition like '%''booking'', ''naviera''%'
     or v_authorizer_definition not like '%document_entity_module_contract%' then
    raise exception '0442: helper previo ausente o con drift';
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
    ('booking', 'naviera', array['operations', 'accounting']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;

comment on function public.document_entity_module_contract(text) is
  'SDD-0410: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';

revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0410: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense, shipment, client, supplier, consolidation y booking heredan sus módulos.';

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0410: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

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
     ) not like 'SDD-0410:%'
     or v_contract_definition not like '%''consolidation'', ''naviera''%'
     or v_contract_definition not like '%''booking'', ''naviera''%'
     or pg_catalog.obj_description(
       'public.document_entity_authorized(text,uuid,text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0410:%' then
    raise exception '0442: contratos de Naviera no quedaron instalados';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) then
    raise exception '0442: el mapa interno quedó expuesto a un rol de API';
  end if;
end;
$post$;
