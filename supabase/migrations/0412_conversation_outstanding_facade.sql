-- 0412 · SDD-0355 · Saldo mínimo de Conversaciones por hilo autorizado.
-- No aplicar a Cloud/Producción desde esta rama; requiere gate individual.

do $preflight$
begin
  if pg_catalog.to_regclass('public.conversations') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0412 requiere conversaciones, clientes, facturas y overrides';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0412 requiere helpers activos de tenant y rol';
  end if;
end;
$preflight$;

create or replace function public.conversation_client_outstanding(p_conversation_id uuid)
returns table (client_id uuid, balance numeric, currency text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_role text := public.current_studio_role();
  v_allowed boolean;
  v_client_id uuid;
  v_markbox text;
begin
  if v_tenant is null or v_role is null
     or v_role not in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing', 'admin') then
    raise exception 'Acceso no autorizado al contexto de conversación'
      using errcode = '42501';
  end if;

  -- Conversaciones no es un módulo locked: respeta grant/revoke de SDD-0252.
  v_allowed := v_role = 'admin';
  if not v_allowed then
    select coalesce((
      select o.can_view
      from public.studio_role_module_overrides as o
      where o.tenant_id = v_tenant and o.role = v_role
        and o.module_id = 'conversaciones'
    ), v_role in ('commercial', 'operations', 'support'))
    into v_allowed;
  end if;
  if not v_allowed then
    raise exception 'Acceso no autorizado al contexto de conversación'
      using errcode = '42501';
  end if;

  -- El caller elige un hilo, nunca un cliente ni tenant arbitrario.
  select c.id, c.markbox into v_client_id, v_markbox
  from public.conversations as cv
  join public.clients as c
    on c.id = cv.client_id and c.tenant_id = v_tenant and c.deleted_at is null
  where cv.id = p_conversation_id
    and cv.tenant_id = v_tenant and cv.deleted_at is null;
  if v_client_id is null then
    return;
  end if;

  return query
  with currency_totals as (
    select
      i.currency::text as invoice_currency,
      pg_catalog.sum(i.total_amount) as total,
      pg_catalog.sum(greatest(0::numeric, i.total_amount - coalesce(i.paid_amount, 0))) as outstanding
    from public.invoices as i
    where i.tenant_id = v_tenant
      and i.client_markbox = v_markbox
      and i.deleted_at is null
      and i.status in ('emitida', 'parcial', 'pagada', 'vencida')
    group by i.currency
  ), dominant as (
    select ct.outstanding, ct.invoice_currency
    from currency_totals as ct
    order by ct.total desc, ct.invoice_currency asc
    limit 1
  )
  select
    v_client_id,
    coalesce(d.outstanding, 0::numeric),
    coalesce(d.invoice_currency, 'USD')
  from (select 1) as seed
  left join dominant as d on true;
end;
$$;

revoke all on function public.conversation_client_outstanding(uuid)
  from public, anon, authenticated;
grant execute on function public.conversation_client_outstanding(uuid)
  to authenticated;

comment on function public.conversation_client_outstanding(uuid) is
  'SDD-0355: saldo CxC mínimo del cliente resuelto desde un hilo del tenant activo. Aplica permisos efectivos de Conversaciones, excluye borradores/anuladas y no expone facturas.';

do $postflight$
begin
  if not pg_catalog.has_function_privilege('authenticated', 'public.conversation_client_outstanding(uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.conversation_client_outstanding(uuid)', 'EXECUTE') then
    raise exception '0412: ACL de conversation_client_outstanding inválida';
  end if;
end;
$postflight$;
