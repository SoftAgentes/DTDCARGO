-- 0406_portal_packing_lists_por_principal.sql — SDD-0342
--
-- Lista mínima de packing lists vigentes del cliente Portal. Deriva identidad,
-- tenant y Shipping Mark desde auth.uid(); no expone contacto, filas ni montos.
-- NO aplicar a Producción desde esta rama. Requiere autorización específica.

create or replace function public.get_portal_packing_list_documents()
returns table (
  id uuid,
  purchase_code text,
  folio text,
  submitted_at timestamptz,
  boxes numeric
)
language sql
stable
security definer
set search_path = ''
as $function$
  select pls.id, p.code, pls.folio, pls.created_at, pls.total_ctns
  from public.client_users as cu
  join public.clients as c
    on c.id = cu.client_id
   and c.tenant_id = cu.tenant_id
   and c.deleted_at is null
  join public.packing_list_submissions as pls
    on pls.tenant_id = c.tenant_id
   and pg_catalog.upper(pg_catalog.btrim(pls.client_markbox)) =
       pg_catalog.upper(pg_catalog.btrim(c.markbox))
   and pls.is_current
   and pls.deleted_at is null
  join public.prealertas as p
    on p.id = pls.prealerta_id
   and p.tenant_id = c.tenant_id
   and pg_catalog.upper(pg_catalog.btrim(p.client_markbox)) =
       pg_catalog.upper(pg_catalog.btrim(c.markbox))
   and p.deleted_at is null
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
  order by pls.created_at desc
  limit 200
$function$;

comment on function public.get_portal_packing_list_documents() is
  'SDD-0342: packing lists vigentes del cliente Portal autenticado; sin ids de '
  'entrada, contacto del proveedor, filas ni montos.';

revoke all on function public.get_portal_packing_list_documents()
  from public, anon, service_role;
grant execute on function public.get_portal_packing_list_documents()
  to authenticated;
