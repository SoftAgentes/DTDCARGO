-- SDD-0042: el registro self-service del Portal del Cliente es ANÓNIMO.
--
-- El registrante no tiene sesión, así que la action corre con el admin client
-- (service_role) para bypassear RLS. Pero `next_markbox()` corre internamente
-- `assert_tenant_match(p_tenant_id)`, que exige `get_user_tenant_id()` no-nulo
-- (un tenant AUTENTICADO vía JWT). El service_role no tiene tenant autenticado →
-- el guard tira `42501: Authenticated tenant required` → el alta self-service
-- NUNCA pudo emitir MARKBOX en prod (bug latente desde que se lanzó el portal).
--
-- Fix: función gemela para el path-servidor-de-confianza. MISMA lógica de
-- correlativo que next_markbox(), pero SIN el guard de tenant — porque el único
-- que puede llamarla es service_role (lo forzamos con los GRANTs de abajo). El
-- `next_markbox()` guardado queda INTACTO para el Studio (usuario logueado).
--
-- Seguridad: EXECUTE revocado de public/anon/authenticated y otorgado SOLO a
-- service_role. Un cliente PostgREST con anon/authenticated key NO puede llamarla
-- (recibe permission denied), así que no se puede forjar un MARKBOX para un
-- tenant ajeno desde el navegador. El service_role solo se usa server-side en la
-- action del registro, que ya resuelve el tenant operativo de DTD.

create or replace function public.next_markbox_service(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_max int;
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  select coalesce(max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.clients
   where tenant_id = p_tenant_id;
  return 'DTD-' || lpad(v_max::text, 4, '0');
end;
$function$;

revoke all on function public.next_markbox_service(uuid) from public;
revoke all on function public.next_markbox_service(uuid) from anon;
revoke all on function public.next_markbox_service(uuid) from authenticated;
grant execute on function public.next_markbox_service(uuid) to service_role;
