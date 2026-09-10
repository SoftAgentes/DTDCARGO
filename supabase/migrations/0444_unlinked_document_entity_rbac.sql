-- SDD-0412 · Documentos sin transacción con RBAC del módulo Documentos.
--
-- Completa el enum document_entity_type: none hereda el módulo Documents y los
-- tipos desconocidos dejan de caer en compatibilidad abierta. El path legado
-- sin segundo segmento se conserva como Documentos para no romper históricos.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_contract_definition text;
  v_authorizer_definition text;
  v_known_entity_count integer;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_module_contract(text)'
  ) is null
     or pg_catalog.to_regprocedure(
       'public.document_entity_authorized(text,uuid,text)'
     ) is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception '0444 requiere el contrato documental de 0443 y Storage';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_module_contract(text)'::regprocedure
  ), pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_contract_definition, v_authorizer_definition;

  if pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0411:%'
     or v_contract_definition not like '%''bitacora_task'', ''bitacora''%'
     or v_contract_definition like '%''none'', ''documents''%'
     or v_authorizer_definition not like '%else true%'
     or v_authorizer_definition like '%else false%' then
    raise exception '0444: helper previo ausente o con drift';
  end if;

  select count(*) into v_known_entity_count
  from pg_catalog.pg_enum e
  join pg_catalog.pg_type t on t.oid = e.enumtypid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'document_entity_type'
    and e.enumlabel in (
      'shipment', 'invoice', 'supplier_bill', 'supplier_payment',
      'journal_entry', 'expense', 'client', 'supplier', 'consolidation',
      'booking', 'bitacora_task', 'none'
    );

  if v_known_entity_count <> 12 or exists (
    select 1
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_entity_type'
      and e.enumlabel not in (
        'shipment', 'invoice', 'supplier_bill', 'supplier_payment',
        'journal_entry', 'expense', 'client', 'supplier', 'consolidation',
        'booking', 'bitacora_task', 'none'
      )
  ) then
    raise exception '0444: document_entity_type no coincide con los 12 tipos auditados';
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
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('none', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;

comment on function public.document_entity_module_contract(text) is
  'SDD-0412: mapa interno completo entidad documental → módulo/defaults; vacío conserva paths legados como Documentos. Sin EXECUTE para roles de API.';

revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

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
    left join lateral public.document_entity_module_contract(n.entity_type) c
      on true
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
      else false
    end
    from decision d
  ), false)
$$;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0412: autorización documental tenant-aware completa para los 12 tipos; none/vacío heredan Documents y cualquier tipo desconocido falla cerrado.';

revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0412: wrapper de vista sobre el autorizador completo; los tipos desconocidos fallan cerrados.';

do $post$
declare
  v_contract_definition text;
  v_authorizer_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_module_contract(text)'::regprocedure
  ), pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_contract_definition, v_authorizer_definition;

  if pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0412:%'
     or v_contract_definition not like '%''none'', ''documents''%'
     or v_contract_definition not like '%('''', ''documents''%'
     or v_authorizer_definition not like '%else false%'
     or v_authorizer_definition like '%else true%'
     or pg_catalog.obj_description(
       'public.document_entity_authorized(text,uuid,text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0412:%' then
    raise exception '0444: contrato completo/fail-closed no quedó instalado';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) then
    raise exception '0444: el mapa interno quedó expuesto a un rol de API';
  end if;
end;
$post$;
