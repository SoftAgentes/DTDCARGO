-- SDD-0223 · Fechas planificadas de embarques (CAL-01 / DAT-01)
-- Separa el plan editable de los hitos reales y obliga toda mutación a pasar
-- por un RPC versionado, autorizado y auditado.

alter table public.shipments
  add column planned_departure_at timestamptz,
  add column planned_arrival_at timestamptz,
  add column planned_delivery_at timestamptz,
  add column planning_timezone text not null default 'America/Caracas',
  add column planning_version integer not null default 0,
  add column planning_updated_at timestamptz,
  add column planning_updated_by uuid references auth.users(id) on delete set null;

alter table public.shipments
  add constraint shipments_planning_timezone_not_blank
    check (btrim(planning_timezone) <> ''),
  add constraint shipments_planning_version_nonnegative
    check (planning_version >= 0),
  add constraint shipments_planning_chronology
    check (
      (planned_departure_at is null or planned_arrival_at is null or planned_departure_at <= planned_arrival_at)
      and (planned_arrival_at is null or planned_delivery_at is null or planned_arrival_at <= planned_delivery_at)
      and (planned_departure_at is null or planned_delivery_at is null or planned_departure_at <= planned_delivery_at)
    );

create index shipments_planned_departure_idx on public.shipments (tenant_id, planned_departure_at)
  where deleted_at is null and planned_departure_at is not null;
create index shipments_planned_arrival_idx on public.shipments (tenant_id, planned_arrival_at)
  where deleted_at is null and planned_arrival_at is not null;
create index shipments_planned_delivery_idx on public.shipments (tenant_id, planned_delivery_at)
  where deleted_at is null and planned_delivery_at is not null;

create function public.guard_shipment_planning_write()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if row(
    new.planned_departure_at, new.planned_arrival_at, new.planned_delivery_at,
    new.planning_timezone, new.planning_version, new.planning_updated_at, new.planning_updated_by
  ) is distinct from row(
    old.planned_departure_at, old.planned_arrival_at, old.planned_delivery_at,
    old.planning_timezone, old.planning_version, old.planning_updated_at, old.planning_updated_by
  ) and coalesce(current_setting('dtd.shipment_planning_write', true), '') <> 'rpc' then
    raise exception 'Las fechas planificadas solo se modifican mediante update_shipment_plan'
      using errcode = '42501';
  end if;
  return new;
end
$function$;

create trigger shipments_planning_write_guard
before update on public.shipments
for each row execute function public.guard_shipment_planning_write();

create function public.update_shipment_plan(
  p_shipment_id uuid,
  p_expected_version integer,
  p_departure_at timestamptz,
  p_arrival_at timestamptz,
  p_delivery_at timestamptz,
  p_timezone text,
  p_reason text
) returns integer
language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.shipments%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_timezone text := btrim(coalesce(p_timezone, ''));
begin
  if v_actor is null then
    raise exception 'Autenticación requerida' using errcode = '28000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 4 then
    raise exception 'El motivo debe tener al menos 4 caracteres' using errcode = '22023';
  end if;
  if v_timezone = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception 'Zona horaria IANA inválida' using errcode = '22023';
  end if;
  if (p_departure_at is not null and p_arrival_at is not null and p_departure_at > p_arrival_at)
    or (p_arrival_at is not null and p_delivery_at is not null and p_arrival_at > p_delivery_at)
    or (p_departure_at is not null and p_delivery_at is not null and p_departure_at > p_delivery_at) then
    raise exception 'La secuencia planificada no es cronológica' using errcode = '22023';
  end if;

  select * into v_row
  from public.shipments
  where id = p_shipment_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Envío no encontrado' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_row.tenant_id
      and ut.disabled_at is null and ut.role in ('admin', 'commercial', 'operations')
  ) then
    raise exception 'Sin permiso para reprogramar este envío' using errcode = '42501';
  end if;
  if v_row.planning_version <> p_expected_version then
    raise exception 'El plan cambió en otra sesión; recarga antes de guardar'
      using errcode = '40001';
  end if;

  v_before := jsonb_build_object(
    'departure_at', v_row.planned_departure_at,
    'arrival_at', v_row.planned_arrival_at,
    'delivery_at', v_row.planned_delivery_at,
    'timezone', v_row.planning_timezone,
    'version', v_row.planning_version
  );
  perform set_config('dtd.shipment_planning_write', 'rpc', true);
  update public.shipments set
    planned_departure_at = p_departure_at,
    planned_arrival_at = p_arrival_at,
    planned_delivery_at = p_delivery_at,
    planning_timezone = v_timezone,
    planning_version = planning_version + 1,
    planning_updated_at = now(),
    planning_updated_by = v_actor
  where id = p_shipment_id
  returning * into v_row;

  v_after := jsonb_build_object(
    'departure_at', v_row.planned_departure_at,
    'arrival_at', v_row.planned_arrival_at,
    'delivery_at', v_row.planned_delivery_at,
    'timezone', v_row.planning_timezone,
    'version', v_row.planning_version
  );
  perform public.append_audit_event(
    v_row.tenant_id, 'shipment', v_row.id, 'user', v_actor,
    'shipment_plan_updated', 'rpc', 'succeeded', btrim(p_reason),
    v_before, v_after, jsonb_build_object('code', v_row.code),
    null, 1, 'internal'
  );
  return v_row.planning_version;
end
$function$;

revoke all on function public.update_shipment_plan(uuid,integer,timestamptz,timestamptz,timestamptz,text,text) from public, anon;
grant execute on function public.update_shipment_plan(uuid,integer,timestamptz,timestamptz,timestamptz,text,text) to authenticated;
revoke all on function public.guard_shipment_planning_write() from public, anon, authenticated;

comment on function public.update_shipment_plan(uuid,integer,timestamptz,timestamptz,timestamptz,text,text) is
  'SDD-0223: mutación versionada y auditada del plan; nunca altera hitos reales.';
