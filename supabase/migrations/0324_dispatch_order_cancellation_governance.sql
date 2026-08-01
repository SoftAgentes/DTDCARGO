-- SDD-0234 · cancelación gobernada de orden de Despacho.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.dispatch_orders') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0324 requiere Despacho, membresías y el writer AUD-01';
  end if;
  if to_regprocedure(
       'public.cancel_dispatch_order_governed(uuid,text,text,text)'
     ) is not null
     or to_regprocedure('public.guard_dispatch_order_cancellation()') is not null then
    raise exception '0324 abortado: contrato de cancelación ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('dispatch_order', 'active', 'dispatch', 1, 'migration:0324')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_dispatch_cancellation_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'dispatch_order_cancelled'
    and payload ? 'request_ref';

create function public.guard_dispatch_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.dispatch_order_cancellation', true)
    ),
    ''
  );
  v_order_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.dispatch_order_cancellation_id', true)
    ),
    ''
  );
begin
  if old.status::text <> new.status::text and new.status::text = 'cancelada' then
    if v_request_ref is null or v_order_id is distinct from new.id::text then
      raise exception 'despacho: cancelar requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array[
      'status','cancel_reason','cancelled_at','cancelled_by','updated_at'
    ]) is distinct from (to_jsonb(new) - array[
      'status','cancel_reason','cancelled_at','cancelled_by','updated_at'
    ]) then
      raise exception 'despacho: la cancelación no puede alterar la OD'
        using errcode = '22023';
    end if;
    if new.cancel_reason is null
       or pg_catalog.char_length(pg_catalog.btrim(new.cancel_reason)) not between 4 and 500
       or new.cancelled_at is null
       or new.cancelled_by is null then
      raise exception 'despacho: evidencia de cancelación incompleta'
        using errcode = '23514';
    end if;
  elsif old.status::text = 'cancelada'
     and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'despacho: la cancelación es terminal e inmutable'
      using errcode = '42501';
  elsif new.cancel_reason is distinct from old.cancel_reason
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancelled_by is distinct from old.cancelled_by then
    raise exception 'despacho: metadata de cancelación sólo cambia en el RPC gobernado'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_dispatch_order_cancellation() owner to postgres;
revoke all on function public.guard_dispatch_order_cancellation()
  from public, anon, authenticated, service_role;

-- Se ejecuta después del trigger legacy `dispatch_orders_status_guard`, que
-- estampa cancelled_at/cancelled_by. La validación observa esos valores finales.
create trigger z_guard_dispatch_order_cancellation_trg
before update on public.dispatch_orders
for each row execute function public.guard_dispatch_order_cancellation();

create function public.cancel_dispatch_order_governed(
  p_order_id uuid,
  p_expected_status text,
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
  v_order public.dispatch_orders%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_cancelled_at timestamptz;
  v_cancelled_by uuid;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'despacho: autenticación requerida'
      using errcode = '42501';
  end if;
  if p_expected_status not in ('creada', 'cargando', 'lista', 'en_ruta') then
    raise exception 'despacho: estado esperado inválido'
      using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 500 then
    raise exception 'despacho: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'despacho: referencia inválida'
      using errcode = '22023';
  end if;

  select d.* into v_order
  from public.dispatch_orders d
  join public.user_tenants ut
    on ut.tenant_id = d.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'warehouse')
   and ut.disabled_at is null
  where d.id = p_order_id
  for update of d;
  if not found then
    raise exception 'despacho: OD no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_order.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'dispatch-order-cancellation:' || v_tenant::text || ':' || v_request_ref,
      234
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'dispatch_order_cancelled'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_order_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'from_status' = p_expected_status then
      return 'replayed';
    end if;
    raise exception 'despacho: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_order.status::text <> p_expected_status then
    raise exception 'despacho: conflicto de estado'
      using errcode = '40001';
  end if;

  perform pg_catalog.set_config(
    'dtd.dispatch_order_cancellation', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.dispatch_order_cancellation_id', p_order_id::text, true
  );

  update public.dispatch_orders
  set status = 'cancelada',
      cancel_reason = v_reason
  where id = p_order_id
    and tenant_id = v_tenant
    and status::text = p_expected_status
  returning cancelled_at, cancelled_by into v_cancelled_at, v_cancelled_by;
  if not found then
    raise exception 'despacho: conflicto al cancelar'
      using errcode = '40001';
  end if;

  v_correlation := pg_catalog.concat(
    'dispatch-order-cancellation:', p_order_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'dispatch_order',
    p_order_id,
    'user',
    v_actor,
    'dispatch_order_cancelled',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_order.status,
      'cancel_reason', v_order.cancel_reason,
      'cancelled_at', v_order.cancelled_at,
      'cancelled_by', v_order.cancelled_by
    ),
    pg_catalog.jsonb_build_object(
      'status', 'cancelada',
      'cancel_reason', v_reason,
      'cancelled_at', v_cancelled_at,
      'cancelled_by', v_cancelled_by
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'order_code', v_order.order_code,
      'from_status', p_expected_status,
      'to_status', 'cancelada',
      'packages_released_by_status', true,
      'package_count', v_order.package_count
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.cancel_dispatch_order_governed(uuid, text, text, text)
  owner to postgres;
revoke all on function public.cancel_dispatch_order_governed(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.cancel_dispatch_order_governed(uuid, text, text, text)
  to authenticated;

comment on function public.cancel_dispatch_order_governed(uuid, text, text, text) is
  'SDD-0234: cancelación R3 de OD con rol, tenant, estado, actor, motivo, idempotencia y AUD-01 atómicos.';
