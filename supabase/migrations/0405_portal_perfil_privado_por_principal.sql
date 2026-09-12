-- 0405_portal_perfil_privado_por_principal.sql — SDD-0341
--
-- Devuelve únicamente los paths privados y códigos históricos del propio cliente
-- Portal. La aplicación usa los paths sólo dentro de un firmador server-only.
-- NO aplicar a Producción desde esta rama. Requiere autorización específica.

create or replace function public.get_portal_private_profile_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with principal as (
    select c.id, c.tenant_id, c.avatar_path, c.cedula_photo_path
    from public.client_users as cu
    join public.clients as c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
    limit 1
  )
  select pg_catalog.jsonb_build_object(
    'previous_markboxes', coalesce((
      select pg_catalog.jsonb_agg(h.markbox order by h.retired_at desc)
      from public.client_markbox_history as h
      where h.client_id = p.id
        and h.tenant_id = p.tenant_id
    ), '[]'::jsonb),
    'avatar_path', p.avatar_path,
    'cedula_photo_path', p.cedula_photo_path
  )
  from principal as p
$function$;

comment on function public.get_portal_private_profile_context() is
  'SDD-0341: paths privados y Shipping Marks retirados del cliente Portal '
  'autenticado; sin ids de entrada y sin datos de otros clientes.';

revoke all on function public.get_portal_private_profile_context()
  from public, anon, service_role;
grant execute on function public.get_portal_private_profile_context()
  to authenticated;
