-- SDD-0235 · un camionero solo avanza la OD asignada a su identidad TMS.
set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.camionero_advance_od(
  p_operario_id uuid,
  p_od_id uuid,
  p_status public.dispatch_order_status,
  p_progress int,
  p_current_city text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tenant_id uuid;
  v_role text;
  v_roles text[];
  v_region public.operario_region;
  v_active boolean;
  v_tms_driver_id uuid;
  v_od_tenant uuid;
  v_od_driver uuid;
begin
  select tenant_id, role, roles, region, active, tms_driver_id
    into v_tenant_id, v_role, v_roles, v_region, v_active, v_tms_driver_id
  from public.operario_pins where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  v_roles := coalesce(nullif(v_roles, '{}'), array[v_role]);
  if not (v_roles && array['camionero','supervisor']) then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id, driver_id into v_od_tenant, v_od_driver
  from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;
  if 'supervisor' <> all(v_roles)
     and (v_tms_driver_id is null or v_od_driver is distinct from v_tms_driver_id) then
    raise exception 'OD no asignada al camionero' using errcode = 'P0008';
  end if;
  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
  set status = p_status,
      progress_pct = coalesce(p_progress, progress_pct),
      current_city = coalesce(p_current_city, current_city),
      updated_at = now()
  where id = p_od_id;
end;
$function$;

revoke all on function public.camionero_advance_od(uuid, uuid, public.dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, public.dispatch_order_status, int, text)
  to service_role;

comment on function public.camionero_advance_od(uuid, uuid, public.dispatch_order_status, int, text) is
  'SDD-0235: camionero limitado a la OD cuyo driver_id coincide con su tms_driver_id; supervisor bypass explícito.';
