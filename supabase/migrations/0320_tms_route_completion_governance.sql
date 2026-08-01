-- SDD-0230 · cierre gobernado de ruta TMS.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tms_routes') is null
     or to_regclass('public.tms_trucks') is null
     or to_regclass('public.tms_drivers') is null
     or to_regclass('public.shipments') is null
     or to_regclass('public.shipment_events') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0320 requiere TMS, shipments y el writer AUD-01';
  end if;
  if to_regprocedure('public.complete_tms_route_governed(uuid,text,text)') is not null
     or to_regprocedure('public.guard_tms_route_completion()') is not null then
    raise exception '0320 abortado: contrato de cierre TMS ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('tms_route', 'active', 'logistics', 1, 'migration:0320')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_tms_route_completion_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'tms_route_completed'
    and payload ? 'request_ref';

create function public.guard_tms_route_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.tms_route_completion', true)
    ),
    ''
  );
  v_route_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.tms_route_completion_route', true)
    ),
    ''
  );
begin
  if old.status = 'completado'
     and (
       new.status is distinct from old.status
       or new.progress_pct is distinct from old.progress_pct
       or new.completed_at is distinct from old.completed_at
       or new.shipment_id is distinct from old.shipment_id
       or new.truck_id is distinct from old.truck_id
       or new.driver_id is distinct from old.driver_id
       or new.deleted_at is distinct from old.deleted_at
     ) then
    raise exception 'tms: el cierre de ruta es terminal e inmutable'
      using errcode = '42501';
  end if;
  if old.status is distinct from new.status and new.status = 'completado' then
    if v_request_ref is null or v_route_id is distinct from new.id::text then
      raise exception 'tms: completar la ruta requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array[
      'status','progress_pct','completed_at','updated_at'
    ]) is distinct from (to_jsonb(new) - array[
      'status','progress_pct','completed_at','updated_at'
    ]) then
      raise exception 'tms: el cierre no puede alterar la ruta'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.guard_tms_route_completion() owner to postgres;
revoke all on function public.guard_tms_route_completion()
  from public, anon, authenticated, service_role;

create trigger guard_tms_route_completion_trg
before update on public.tms_routes
for each row execute function public.guard_tms_route_completion();

create function public.complete_tms_route_governed(
  p_route_id uuid,
  p_reason text,
  p_request_ref text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_route public.tms_routes%rowtype;
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_truck_status text;
  v_driver_status text;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'tms: autenticación requerida' using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'tms: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'tms: referencia inválida' using errcode = '22023';
  end if;

  select r.* into v_route
  from public.tms_routes r
  join public.user_tenants ut
    on ut.tenant_id = r.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where r.id = p_route_id
    and r.deleted_at is null
  for update of r;
  if not found then
    raise exception 'tms: ruta no disponible' using errcode = 'P0002';
  end if;
  v_tenant := v_route.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tms-route-completion:' || v_tenant::text || ':' || v_request_ref,
      230
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'tms_route_completed'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_route_id
       and v_existing.reason = v_reason then
      return 'replayed';
    end if;
    raise exception 'tms: referencia reutilizada' using errcode = '40001';
  end if;

  if v_route.status <> 'en_ruta' then
    raise exception 'tms: conflicto de estado de la ruta' using errcode = '40001';
  end if;

  select s.* into v_shipment
  from public.shipments s
  where s.id = v_route.shipment_id
    and s.tenant_id = v_tenant
    and s.deleted_at is null
  for update;
  if not found or v_shipment.status <> 'out_for_delivery' then
    raise exception 'tms: conflicto de estado del embarque' using errcode = '40001';
  end if;

  if v_route.truck_id is not null then
    select t.status::text into v_truck_status
    from public.tms_trucks t
    where t.id = v_route.truck_id
      and t.tenant_id = v_tenant
      and t.deleted_at is null
    for update;
    if not found or v_truck_status <> 'en_ruta' then
      raise exception 'tms: conflicto de estado del camión' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.tms_routes other
      where other.tenant_id = v_tenant
        and other.id <> p_route_id
        and other.truck_id = v_route.truck_id
        and other.status in ('planificado', 'en_ruta')
        and other.deleted_at is null
    ) then
      raise exception 'tms: el camión tiene otra ruta activa' using errcode = '40001';
    end if;
  end if;

  if v_route.driver_id is not null then
    select d.status::text into v_driver_status
    from public.tms_drivers d
    where d.id = v_route.driver_id
      and d.tenant_id = v_tenant
      and d.deleted_at is null
    for update;
    if not found or v_driver_status <> 'en_ruta' then
      raise exception 'tms: conflicto de estado del chofer' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.tms_routes other
      where other.tenant_id = v_tenant
        and other.id <> p_route_id
        and other.driver_id = v_route.driver_id
        and other.status in ('planificado', 'en_ruta')
        and other.deleted_at is null
    ) then
      raise exception 'tms: el chofer tiene otra ruta activa' using errcode = '40001';
    end if;
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.tms_route_completion', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.tms_route_completion_route', p_route_id::text, true
  );

  update public.tms_routes
  set status = 'completado', progress_pct = 100
  where id = p_route_id
    and tenant_id = v_tenant
    and status = 'en_ruta'
    and deleted_at is null;
  if not found then
    raise exception 'tms: conflicto al completar la ruta' using errcode = '40001';
  end if;

  if v_route.truck_id is not null then
    update public.tms_trucks
    set status = 'disponible'
    where id = v_route.truck_id
      and tenant_id = v_tenant
      and status = 'en_ruta'
      and deleted_at is null;
    if not found then
      raise exception 'tms: conflicto al liberar el camión' using errcode = '40001';
    end if;
  end if;

  if v_route.driver_id is not null then
    update public.tms_drivers
    set status = 'disponible'
    where id = v_route.driver_id
      and tenant_id = v_tenant
      and status = 'en_ruta'
      and deleted_at is null;
    if not found then
      raise exception 'tms: conflicto al liberar el chofer' using errcode = '40001';
    end if;
  end if;

  update public.shipments
  set status = 'last_mile'
  where id = v_route.shipment_id
    and tenant_id = v_tenant
    and status = 'out_for_delivery'
    and deleted_at is null;
  if not found then
    raise exception 'tms: conflicto al mover el embarque' using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    v_route.shipment_id,
    'last_mile',
    'Ruta ' || v_route.route_code || ' completada · próximo paso: POD del cliente',
    v_actor
  );

  v_correlation := pg_catalog.concat(
    'tms-route-completion:', p_route_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'tms_route',
    p_route_id,
    'user',
    v_actor,
    'tms_route_completed',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_route.status,
      'progress_pct', v_route.progress_pct,
      'shipment_status', v_shipment.status
    ),
    pg_catalog.jsonb_build_object(
      'status', 'completado',
      'progress_pct', 100,
      'shipment_status', 'last_mile'
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'route_code', v_route.route_code,
      'shipment_id', v_route.shipment_id,
      'truck_id', v_route.truck_id,
      'driver_id', v_route.driver_id,
      'from', v_route.status,
      'to', 'completado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.complete_tms_route_governed(uuid, text, text)
  owner to postgres;
revoke all on function public.complete_tms_route_governed(uuid, text, text)
  from public, anon, service_role;
grant execute on function public.complete_tms_route_governed(uuid, text, text)
  to authenticated;

comment on function public.complete_tms_route_governed(uuid, text, text) is
  'SDD-0230: cierre R3 de ruta con rol, tenant, precondiciones, recursos, shipment, timeline, idempotencia y AUD-01 atómicos.';

reset statement_timeout;
reset lock_timeout;
