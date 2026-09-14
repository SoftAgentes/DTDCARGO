-- 0413 · SDD-0356 · Referencias mínimas de facturas por orden de venta.
-- No aplicar a Cloud/Producción desde esta rama; requiere gate individual.

do $preflight$
begin
  if pg_catalog.to_regclass('public.sales_orders') is null
     or pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0413 requiere órdenes de venta, facturas y overrides';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0413 requiere helpers activos de tenant y rol';
  end if;
end;
$preflight$;

create or replace function public.sales_order_invoice_refs(p_sales_order_ids uuid[])
returns table (
  id uuid, sales_order_id uuid, invoice_code text, total_amount numeric,
  status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_role text := public.current_studio_role();
  v_allowed boolean;
begin
  if v_tenant is null or v_role is null
     or v_role not in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing', 'admin') then
    raise exception 'Acceso no autorizado a referencias de facturas'
      using errcode = '42501';
  end if;
  v_allowed := v_role = 'admin';
  if not v_allowed then
    select coalesce((
      select o.can_view from public.studio_role_module_overrides as o
      where o.tenant_id = v_tenant and o.role = v_role
        and o.module_id = 'sales-orders'
    ), v_role in ('commercial', 'operations', 'accounting'))
    into v_allowed;
  end if;
  if not v_allowed then
    raise exception 'Acceso no autorizado a referencias de facturas'
      using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_sales_order_ids), 0) = 0 then
    return;
  end if;
  if pg_catalog.cardinality(p_sales_order_ids) > 500 then
    raise exception 'Demasiadas órdenes solicitadas' using errcode = '22023';
  end if;

  return query
  select i.id, i.sales_order_id, i.invoice_code, i.total_amount,
    i.status::text, i.created_at
  from public.sales_orders as so
  join public.invoices as i
    on i.sales_order_id = so.id and i.tenant_id = v_tenant
      and i.deleted_at is null
  where so.id = any(p_sales_order_ids)
    and so.tenant_id = v_tenant and so.deleted_at is null
  order by i.sales_order_id, i.created_at desc, i.id;
end;
$$;

revoke all on function public.sales_order_invoice_refs(uuid[])
  from public, anon, authenticated;
grant execute on function public.sales_order_invoice_refs(uuid[]) to authenticated;
comment on function public.sales_order_invoice_refs(uuid[]) is
  'SDD-0356: referencias de facturas para órdenes vivas del tenant activo, con permiso efectivo de sales-orders. No expone cliente, líneas, tasa, notas ni datos fiscales; created_at sirve sólo a paginación estable.';

do $postflight$
begin
  if not pg_catalog.has_function_privilege('authenticated', 'public.sales_order_invoice_refs(uuid[])', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.sales_order_invoice_refs(uuid[])', 'EXECUTE') then
    raise exception '0413: ACL de sales_order_invoice_refs inválida';
  end if;
end;
$postflight$;
