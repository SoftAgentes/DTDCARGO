-- 0402_portal_hidden_statuses_por_principal.sql — SDD-0337
--
-- El dashboard, la lista y el detalle de envíos necesitan aplicar las reglas de
-- visibilidad del cliente. Esta RPC no recibe tenant ni client_id: los deriva de
-- auth.uid(), conserva la precedencia override-cliente → default-tenant y sólo
-- devuelve nombres de status ocultos.
--
-- NO aplicar a Producción desde esta rama. Requiere autorización específica por
-- basename y el runbook docs/runbooks/aplicar-migraciones-prod.md.

create or replace function public.get_portal_hidden_shipment_statuses()
returns table (status text)
language sql
stable
security definer
set search_path = ''
as $function$
  with portal_client as (
    select c.id as client_id, c.tenant_id
    from public.client_users as cu
    join public.clients as c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
    limit 1
  ),
  ranked as (
    select
      pg_catalog.substr(r.trigger_event, 8) as status,
      r.visible_in_portal,
      pg_catalog.row_number() over (
        partition by r.trigger_event
        order by (r.client_id is not null) desc
      ) as precedence
    from portal_client as pc
    join public.client_notification_rules as r
      on r.tenant_id = pc.tenant_id
     and (r.client_id is null or r.client_id = pc.client_id)
    where r.trigger_event like 'status:%'
  )
  select ranked.status
  from ranked
  where ranked.precedence = 1
    and not ranked.visible_in_portal
    and ranked.status <> ''
  order by ranked.status
$function$;

comment on function public.get_portal_hidden_shipment_statuses() is
  'SDD-0337: statuses ocultos del cliente Portal autenticado. Sin parámetros; '
  'identidad derivada de auth.uid(); override del cliente prevalece al default.';

revoke all on function public.get_portal_hidden_shipment_statuses()
  from public, anon, service_role;
grant execute on function public.get_portal_hidden_shipment_statuses()
  to authenticated;
