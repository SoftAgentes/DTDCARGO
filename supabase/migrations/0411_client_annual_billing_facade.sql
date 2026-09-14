-- ─────────────────────────────────────────────────────────────
-- 0411 · SDD-0354 · Facturación anual agregada para CRM
--
-- HALLAZGO: Fidelización, CRM y Reportes calculaban el trailing-12m leyendo
-- cada factura del tenant, incluidas moneda, tasa, estado y fechas. Esos roles
-- sólo necesitan el total USD agregado por Shipping Mark.
--
-- ESTE SLICE:
--   · crea una RPC sin parámetro de tenant;
--   · agrega en SQL y devuelve sólo Shipping Mark + billed_usd;
--   · exige acceso efectivo a Fidelización, CRM o Reportes (incluye overrides);
--   · limita p_as_of al presente (±1 día por diferencia de zona horaria);
--   · no cambia todavía la policy SELECT de invoices.
--
-- NO aplicar a Cloud/Producción desde esta rama. Gate individual obligatorio.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if pg_catalog.to_regclass('public.invoices') is null then
    raise exception '0411 requiere public.invoices';
  end if;
  if pg_catalog.to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0411 requiere studio_role_module_overrides (0357)';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0411 requiere helpers activos de tenant y rol';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'invoices_team_select'
      and cmd = 'SELECT'
  ) then
    raise exception '0411 requiere 0407_invoices_write_rbac';
  end if;
end;
$preflight$;

create or replace function public.studio_client_annual_billing(p_as_of date)
returns table (
  client_markbox text,
  billed_usd numeric
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
  if v_tenant is null
     or v_role is null
     or v_role not in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing', 'admin') then
    raise exception 'Acceso no autorizado a facturación anual'
      using errcode = '42501';
  end if;

  -- Reportes es MONEY_MODULE: accounting/admin, candado sin overrides.
  -- Fidelización y CRM sí son editables (SDD-0252). Fila ausente = defaults
  -- de rbac.ts; una revocación explícita NO debe reabrirse por el default.
  v_allowed := v_role in ('accounting', 'admin');
  if not v_allowed then
    select
      coalesce((
        select o.can_view
        from public.studio_role_module_overrides as o
        where o.tenant_id = v_tenant and o.role = v_role
          and o.module_id = 'fidelizacion'
      ), v_role in ('commercial', 'support'))
      or coalesce((
        select o.can_view
        from public.studio_role_module_overrides as o
        where o.tenant_id = v_tenant and o.role = v_role
          and o.module_id = 'kommo'
      ), v_role = 'commercial')
    into v_allowed;
  end if;
  if not v_allowed then
    raise exception 'Acceso no autorizado a facturación anual'
      using errcode = '42501';
  end if;

  -- El parámetro existe para alinear el reloj del servidor web con Postgres,
  -- no para consultar ventanas históricas arbitrarias.
  if p_as_of is null
     or p_as_of < current_date - 1
     or p_as_of > current_date + 1 then
    raise exception 'Fecha de referencia no permitida'
      using errcode = '22023';
  end if;

  return query
  select
    i.client_markbox,
    pg_catalog.sum(
      case
        when i.currency in ('USD', 'USDT') then i.total_amount
        when i.currency = 'VES' and i.fx_rate > 0
          then i.total_amount / i.fx_rate
        else 0::numeric
      end
    ) as billed_usd
  from public.invoices as i
  where i.tenant_id = v_tenant
    and i.deleted_at is null
    and i.client_markbox <> ''
    and i.status in ('emitida', 'parcial', 'pagada', 'vencida')
    and coalesce(
      i.issued_at,
      (i.created_at at time zone 'UTC')::date
    ) >= (p_as_of - interval '1 year')::date
    and coalesce(
      i.issued_at,
      (i.created_at at time zone 'UTC')::date
    ) <= p_as_of
  group by i.client_markbox
  having pg_catalog.sum(
    case
      when i.currency in ('USD', 'USDT') then i.total_amount
      when i.currency = 'VES' and i.fx_rate > 0
        then i.total_amount / i.fx_rate
      else 0::numeric
    end
  ) > 0
  order by i.client_markbox;
end;
$$;

revoke all on function public.studio_client_annual_billing(date)
  from public, anon, authenticated;
grant execute on function public.studio_client_annual_billing(date)
  to authenticated;

comment on function public.studio_client_annual_billing(date) is
  'SDD-0354: facturación trailing-12m USD agregada por Shipping Mark. Exige acceso efectivo a Fidelización, CRM o Reportes, respeta overrides por rol y no expone facturas individuales.';

do $postflight$
begin
  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.studio_client_annual_billing(date)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.studio_client_annual_billing(date)',
       'EXECUTE'
     ) then
    raise exception '0411: ACL de studio_client_annual_billing inválida';
  end if;
end;
$postflight$;
