-- SDD-0409 · Documentos de proveedores con RBAC del módulo Proveedores.
--
-- Extrae el mapa entidad/módulo a una función interna para que los próximos
-- slices amplíen una sola fuente sin reescribir el motor de autorización.
-- Añade únicamente supplier → suppliers al alcance efectivo.
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
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0441 requiere el contrato documental de 0440';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ), pg_catalog.obj_description(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure,
    'pg_proc'
  ) into v_definition, v_comment;

  if v_comment not like 'SDD-0408:%'
     or v_definition not like '%''client'', ''clients''%'
     or v_definition like '%''supplier'', ''suppliers''%'
     or pg_catalog.to_regprocedure(
       'public.document_entity_module_contract(text)'
     ) is not null then
    raise exception '0441: helper previo ausente o con drift';
  end if;
end;
$preflight$;

create function public.document_entity_module_contract(p_entity_type text)
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
    ('supplier', 'suppliers', array['commercial', 'operations']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;

comment on function public.document_entity_module_contract(text) is
  'SDD-0409: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';

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
      else true
    end
    from decision d
  ), false)
$$;

comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0409: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense, shipment, client y supplier heredan el contrato interno de sus módulos.';

revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0409: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

do $post$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_definition;

  if pg_catalog.to_regprocedure(
    'public.document_entity_module_contract(text)'
  ) is null
     or pg_catalog.obj_description(
       'public.document_entity_module_contract(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0409:%'
     or v_definition not like '%document_entity_module_contract%'
     or pg_catalog.obj_description(
       'public.document_entity_authorized(text,uuid,text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0409:%' then
    raise exception '0441: contrato interno o autorizador no quedó instalado';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.document_entity_module_contract(text)', 'EXECUTE'
  ) then
    raise exception '0441: el mapa interno quedó expuesto a un rol de API';
  end if;
end;
$post$;
