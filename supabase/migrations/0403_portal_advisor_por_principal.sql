-- 0403_portal_advisor_por_principal.sql — SDD-0338
--
-- Inicio y Soporte muestran el asesor asignado al cliente del Portal. La RPC no
-- recibe client_id: deriva el cliente desde auth.uid(), exige que el asesor siga
-- activo en el mismo tenant y devuelve únicamente los cuatro campos visibles.
--
-- NO aplicar a Producción desde esta rama. Requiere autorización específica por
-- basename y el runbook docs/runbooks/aplicar-migraciones-prod.md.

create or replace function public.get_portal_advisor()
returns table (
  name text,
  phone text,
  avatar_url text,
  position_label text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    pg_catalog.btrim(pg_catalog.concat_ws(' ', up.first_name, up.last_name)) as name,
    up.phone,
    up.avatar_url,
    up.position_label
  from public.client_users as cu
  join public.clients as c
    on c.id = cu.client_id
   and c.tenant_id = cu.tenant_id
   and c.deleted_at is null
  join public.user_tenants as ut
    on ut.user_id = c.advisor_id
   and ut.tenant_id = c.tenant_id
   and ut.disabled_at is null
  join public.user_profiles as up
    on up.user_id = c.advisor_id
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
    and pg_catalog.btrim(pg_catalog.concat_ws(' ', up.first_name, up.last_name)) <> ''
  limit 1
$function$;

comment on function public.get_portal_advisor() is
  'SDD-0338: asesor activo del cliente Portal autenticado. Sin parámetros; '
  'identidad derivada de auth.uid(); sólo perfil público asignado.';

revoke all on function public.get_portal_advisor()
  from public, anon, service_role;
grant execute on function public.get_portal_advisor()
  to authenticated;
