-- 0401_portal_brand_por_principal.sql — SDD-0336
--
-- El Portal necesita la marca white-label del cliente autenticado para etiquetas
-- y comprobantes. Hasta ahora cada Server Component construía un service_role y
-- confiaba en haber resuelto antes el Shipping Mark correcto. Esta RPC angosta no
-- recibe ids ni códigos: deriva el cliente únicamente de auth.uid(), devuelve sólo
-- los ocho campos públicos de marca y no abre SELECT directo sobre `aliados`.
--
-- NO aplicar a Producción desde esta rama. Requiere autorización específica por
-- basename y el runbook docs/runbooks/aplicar-migraciones-prod.md.

create or replace function public.get_portal_brand()
returns table (
  trade_name text,
  brand_name text,
  brand_primary text,
  brand_secondary text,
  support_email text,
  support_whatsapp text,
  support_website text,
  hide_dtd_brand boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    a.trade_name,
    a.brand_name,
    a.brand_primary,
    a.brand_secondary,
    a.support_email,
    a.support_whatsapp,
    a.support_website,
    a.hide_dtd_brand
  from public.client_users as cu
  join public.clients as c
    on c.id = cu.client_id
   and c.deleted_at is null
  join public.aliados as a
    on a.id = c.aliado_id
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
  limit 1
$function$;

comment on function public.get_portal_brand() is
  'SDD-0336: marca white-label del cliente del Portal autenticado. Sin parámetros; '
  'identidad derivada de auth.uid(). Devuelve sólo campos públicos de marca.';

revoke all on function public.get_portal_brand()
  from public, anon, service_role;
grant execute on function public.get_portal_brand()
  to authenticated;
