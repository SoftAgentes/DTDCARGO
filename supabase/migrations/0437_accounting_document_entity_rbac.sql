-- SDD-0405 · Documentos de asientos contables por entidad.
--
-- 0436 dejó el control central cubriendo factura, CxP y órdenes de pago. Este
-- slice añade journal_entry, que enlaza el módulo Contabilidad y comparte el
-- mismo candado accounting/admin. Ningún otro tipo documental cambia.
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
    raise exception '0437 requiere el control documental ampliado por 0436';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure
  ), pg_catalog.obj_description(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure,
    'pg_proc'
  ) into v_definition, v_comment;

  if v_comment not like 'SDD-0404:%'
     or v_definition not like '%''invoice''%'
     or v_definition not like '%''supplier_bill''%'
     or v_definition not like '%''supplier_payment''%'
     or v_definition like '%journal_entry%' then
    raise exception '0437: helper previo ausente o con drift';
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
    raise exception '0437: grants del helper previo ausentes o con drift';
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
      'supplier_payment',
      'journal_entry'
    ) then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;

comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0405: autorización documental incremental. invoice, supplier_bill, supplier_payment y journal_entry heredan sus módulos financieros (accounting/admin); los demás tipos conservan su alcance previo.';

revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;
