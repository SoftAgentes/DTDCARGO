-- SDD-0174 · D4 · normalización de las cinco RPC logísticas R3.
--
-- Las RPC ya mutan y escriben auditoría dentro de una sola transacción. Este
-- bridge intercepta exclusivamente sus INSERT legacy de actor operario,
-- reescribe el evento mediante append_audit_event y descarta el INSERT original.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_signature text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0292 requiere append_audit_event de Corte B1';
  end if;

  foreach v_signature in array array[
    'public.operario_action(uuid,text,jsonb)',
    'public.stuff_box_as_operario(uuid,uuid,text,integer,integer,integer,boolean)',
    'public.unstuff_box_as_operario(uuid,text)',
    'public.stuff_lot_as_operario(uuid,uuid,text,integer,integer)',
    'public.unstuff_lot_as_operario(uuid,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception '0292 requiere %', v_signature;
    end if;
  end loop;

  if to_regprocedure('public.audit_d4_route_operario_event()') is not null
     or exists (
       select 1 from pg_trigger
       where tgname = 'audit_d4_route_operario_event'
         and not tgisinternal
     ) then
    raise exception '0292 abortado: bridge D4 ya existe';
  end if;
end;
$preflight$;

create function public.audit_d4_route_operario_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_after jsonb;
  v_reason text;
begin
  if new.source <> 'legacy_unknown'
     or new.actor_type <> 'operario'
     or new.entity_type not in (
       'warehouse_receipt_cn',
       'warehouse_receipt_ve',
       'dispatch_order',
       'consolidation'
     )
     or new.event_type !~ '^(edited|reassigned|package_[a-z_]+|box_scanned|sealed|box_stuffed|box_unstuffed|lote_stuffed|lote_unstuffed)$'
  then
    return new;
  end if;

  v_after := pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'package_id', new.payload -> 'package_id',
      'old_truck_id', new.payload -> 'old_truck_id',
      'new_truck_id', new.payload -> 'new_truck_id',
      'old_driver_id', new.payload -> 'old_driver_id',
      'new_driver_id', new.payload -> 'new_driver_id',
      'prealerta_id', new.payload -> 'prealerta_id',
      'load_order', new.payload -> 'load_order',
      'width', new.payload -> 'width',
      'stuffed', new.payload -> 'stuffed',
      'unstuffed', new.payload -> 'unstuffed',
      'scanned', new.payload -> 'scanned',
      'expected', new.payload -> 'expected',
      'force', new.payload -> 'force',
      'manual', new.payload -> 'manual'
    )
  );

  v_reason := nullif(pg_catalog.btrim(new.payload ->> 'reason'), '');
  if v_reason is null
     and (
       new.event_type ~ '(_cancelled|_canceled|_voided|_deleted)$'
       or coalesce((new.payload ->> 'force')::boolean, false)
     ) then
    v_reason := 'Acción logística R3 confirmada por el operario.';
  end if;

  perform public.append_audit_event(
    new.tenant_id,
    new.entity_type,
    new.entity_id,
    'operario',
    new.actor_id,
    new.event_type,
    'rpc',
    'succeeded',
    v_reason,
    null,
    v_after,
    '{}'::jsonb,
    pg_catalog.concat(
      'd4:', new.entity_type, ':', new.entity_id::text, ':',
      pg_catalog.txid_current()::text
    ),
    1,
    'restricted'
  );

  return null;
end;
$function$;

alter function public.audit_d4_route_operario_event() owner to postgres;
revoke all on function public.audit_d4_route_operario_event() from public;
revoke all on function public.audit_d4_route_operario_event() from anon;
revoke all on function public.audit_d4_route_operario_event() from authenticated;

create trigger audit_d4_route_operario_event
before insert on public.entity_audit_log
for each row execute function public.audit_d4_route_operario_event();

alter function public.operario_action(uuid,text,jsonb)
  set search_path = pg_catalog, public;
alter function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean
) set search_path = pg_catalog, public;
alter function public.unstuff_box_as_operario(uuid,text)
  set search_path = pg_catalog, public;
alter function public.stuff_lot_as_operario(uuid,uuid,text,integer,integer)
  set search_path = pg_catalog, public;
alter function public.unstuff_lot_as_operario(uuid,uuid)
  set search_path = pg_catalog, public;

do $postcondition$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_d4_route_operario_event'
      and not tgisinternal
      and tgenabled = 'O'
  ) then
    raise exception '0292: bridge D4 ausente';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'operario_action',
        'stuff_box_as_operario',
        'unstuff_box_as_operario',
        'stuff_lot_as_operario',
        'unstuff_lot_as_operario'
      ])
      and p.prosecdef
      and p.proconfig @> array['search_path=pg_catalog, public']
  ) <> 5 then
    raise exception '0292: las cinco RPC no tienen search_path fijo';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
