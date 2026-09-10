-- SDD-0404 · Documentos de Tesorería: CxP y pagos por entidad.
--
-- 0435 instaló un único punto de decisión usado por filas, Storage, reservas,
-- restauraciones y guards de RPC. Este slice amplía sólo ese contrato para que
-- supplier_bill y supplier_payment hereden el mismo candado que el módulo
-- Tesorería: accounting/admin. Los otros tipos continúan sin cambios.
--
-- No aplica la migración en Cloud desde este archivo.

do $preflight$
declare
  v_definition text;
  v_comment text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_allowed_for_current_role(text)'
  ) is null or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0436 requiere el control documental instalado por 0435';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure
  ), pg_catalog.obj_description(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure,
    'pg_proc'
  ) into v_definition, v_comment;

  if v_comment not like 'SDD-0403:%'
     or v_definition not like '%= ''invoice''%'
     or v_definition like '%supplier_bill%'
     or v_definition like '%supplier_payment%' then
    raise exception '0436: helper previo ausente o con drift';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(p.proacl) a
    where p.oid = 'public.document_entity_allowed_for_current_role(text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE'
  ) then
    raise exception '0436: grants del helper previo ausentes o con drift';
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
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) in (
      'invoice',
      'supplier_bill',
      'supplier_payment'
    ) then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0404: autorización documental incremental. invoice, supplier_bill y supplier_payment heredan sus módulos financieros (accounting/admin); los demás tipos conservan su alcance previo.';

revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;
