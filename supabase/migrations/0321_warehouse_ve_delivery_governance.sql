-- SDD-0231 · confirmación manual gobernada de entrega en Almacén VE.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.shipments') is null
     or to_regclass('public.shipment_events') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0321 requiere shipments y el writer AUD-01';
  end if;
  if to_regprocedure(
    'public.complete_ve_delivery_governed(uuid,text,text,text)'
  ) is not null
     or to_regprocedure('public.guard_ve_delivery_completion()') is not null then
    raise exception '0321 abortado: contrato de entrega VE ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('shipment', 'active', 'logistics', 1, 'migration:0321')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_ve_delivery_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'shipment_delivery_manually_confirmed'
    and payload ? 'request_ref';

create function public.guard_ve_delivery_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.ve_delivery_completion', true)
    ),
    ''
  );
  v_shipment_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.ve_delivery_completion_shipment', true)
    ),
    ''
  );
begin
  if old.status = 'delivered'
     and (
       new.status is distinct from old.status
       or new.delivered_at is distinct from old.delivered_at
       or new.pod_signed_by is distinct from old.pod_signed_by
       or new.delivery_address is distinct from old.delivery_address
       or new.deleted_at is distinct from old.deleted_at
     ) then
    raise exception 've: la entrega es un hito terminal e inmutable'
      using errcode = '42501';
  end if;
  if old.status is distinct from new.status and new.status = 'delivered' then
    if v_request_ref is null
       or v_shipment_id is distinct from new.id::text then
      raise exception 've: confirmar la entrega requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array[
      'status','delivered_at','pod_signed_by','updated_at'
    ]) is distinct from (to_jsonb(new) - array[
      'status','delivered_at','pod_signed_by','updated_at'
    ]) then
      raise exception 've: la confirmación no puede alterar el embarque'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.guard_ve_delivery_completion() owner to postgres;
revoke all on function public.guard_ve_delivery_completion()
  from public, anon, authenticated, service_role;

create trigger guard_ve_delivery_completion_trg
before update on public.shipments
for each row execute function public.guard_ve_delivery_completion();

create function public.complete_ve_delivery_governed(
  p_shipment_id uuid,
  p_received_by text,
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
  v_received_by text := nullif(pg_catalog.btrim(p_received_by), '');
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 've: autenticación requerida' using errcode = '42501';
  end if;
  if v_received_by is null
     or pg_catalog.char_length(v_received_by) not between 2 and 200 then
    raise exception 've: receptor inválido' using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 've: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 've: referencia inválida' using errcode = '22023';
  end if;

  select s.* into v_shipment
  from public.shipments s
  join public.user_tenants ut
    on ut.tenant_id = s.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where s.id = p_shipment_id
    and s.deleted_at is null
  for update of s;
  if not found then
    raise exception 've: embarque no disponible' using errcode = 'P0002';
  end if;
  v_tenant := v_shipment.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'warehouse-ve-delivery:' || v_tenant::text || ':' || v_request_ref,
      231
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'shipment_delivery_manually_confirmed'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_shipment_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'received_by' = v_received_by then
      return 'replayed';
    end if;
    raise exception 've: referencia reutilizada' using errcode = '40001';
  end if;

  if v_shipment.status not in ('out_for_delivery', 'last_mile') then
    raise exception 've: conflicto de estado' using errcode = '40001';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.ve_delivery_completion', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.ve_delivery_completion_shipment', p_shipment_id::text, true
  );

  update public.shipments
  set status = 'delivered',
      pod_signed_by = v_received_by
  where id = p_shipment_id
    and tenant_id = v_tenant
    and status = v_shipment.status
    and deleted_at is null;
  if not found then
    raise exception 've: conflicto al confirmar la entrega'
      using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    p_shipment_id,
    'delivered',
    'Entrega manual confirmada · receptor: ' || v_received_by,
    v_actor
  );

  v_correlation := pg_catalog.concat(
    'warehouse-ve-delivery:', p_shipment_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'shipment',
    p_shipment_id,
    'user',
    v_actor,
    'shipment_delivery_manually_confirmed',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_shipment.status,
      'pod_signed_by', v_shipment.pod_signed_by
    ),
    pg_catalog.jsonb_build_object(
      'status', 'delivered',
      'pod_signed_by', v_received_by
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'shipment_code', v_shipment.code,
      'received_by', v_received_by,
      'attestation_kind', 'manual',
      'sealed_dispatch_pod', false,
      'from', v_shipment.status,
      'to', 'delivered'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.complete_ve_delivery_governed(uuid, text, text, text)
  owner to postgres;
revoke all on function public.complete_ve_delivery_governed(
  uuid, text, text, text
) from public, anon, service_role;
grant execute on function public.complete_ve_delivery_governed(
  uuid, text, text, text
) to authenticated;

comment on function public.complete_ve_delivery_governed(
  uuid, text, text, text
) is
  'SDD-0231: fallback manual de entrega VE con rol, tenant, estado, receptor, timeline, idempotencia y AUD-01 atómicos; no sustituye dispatch_pods sellado.';

reset statement_timeout;
reset lock_timeout;
