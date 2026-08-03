-- SDD-0235 · minimización, throttle y grants cerrados del tracking público.
set lock_timeout = '5s';
set statement_timeout = '30s';

drop policy if exists public_track_log_anon_insert on public.public_track_log;
revoke insert on public.public_track_log from anon, authenticated;

drop function if exists public.public_track_shipment(text, text);
create function public.public_track_shipment(p_code text, p_ip text default null)
returns table (
  found boolean,
  code text,
  status text,
  shipment_service text,
  origin text,
  destination text,
  weight_kg numeric,
  volume_m3 numeric,
  vehicle_category text,
  arrived_destination_at timestamptz,
  delivered_at timestamptz,
  pod_signed_by text,
  created_at timestamptz,
  events jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_normalized text := upper(btrim(coalesce(p_code, '')));
  v_attempt_key text := encode(extensions.digest(coalesce(p_ip, 'unknown'), 'sha256'), 'hex');
  v_recent integer;
  v_shipment_id uuid;
begin
  select count(*) into v_recent
  from public.public_track_log l
  where l.ip = v_attempt_key
    and l.requested_at >= now() - interval '15 minutes';
  if v_recent >= 30 then
    return query select false, ''::text, ''::text, ''::text, ''::text, ''::text,
      null::numeric, null::numeric, ''::text, null::timestamptz,
      null::timestamptz, null::text, null::timestamptz, '[]'::jsonb;
    return;
  end if;

  if v_normalized !~ '^S-[0-9]{4}-[0-9]{4,10}$' then
    insert into public.public_track_log(ip, code, found)
    values (v_attempt_key, left(v_normalized, 32), false);
    return query select false, ''::text, ''::text, ''::text, ''::text, ''::text,
      null::numeric, null::numeric, ''::text, null::timestamptz,
      null::timestamptz, null::text, null::timestamptz, '[]'::jsonb;
    return;
  end if;

  select s.id into v_shipment_id
  from public.shipments s
  where upper(s.code) = v_normalized and s.deleted_at is null
  limit 1;

  insert into public.public_track_log(ip, code, found)
  values (v_attempt_key, v_normalized, v_shipment_id is not null);
  if v_shipment_id is null then
    return query select false, ''::text, ''::text, ''::text, ''::text, ''::text,
      null::numeric, null::numeric, ''::text, null::timestamptz,
      null::timestamptz, null::text, null::timestamptz, '[]'::jsonb;
    return;
  end if;

  return query
  select true, s.code, s.status::text, s.shipment_service::text, s.origin,
    s.destination, s.weight_kg, s.volume_m3, s.vehicle_category,
    s.arrived_destination_at, s.delivered_at, null::text, s.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', e.status::text,
        'note', null,
        'occurred_at', e.occurred_at
      ) order by e.occurred_at)
      from public.shipment_events e
      where e.shipment_id = s.id and e.deleted_at is null
    ), '[]'::jsonb)
  from public.shipments s where s.id = v_shipment_id;
end;
$function$;

revoke all on function public.public_track_shipment(text, text) from public;
grant execute on function public.public_track_shipment(text, text) to anon, authenticated;

comment on column public.public_track_log.ip is
  'Huella SHA-256 del origen aportado al RPC; nunca IP cruda.';
comment on function public.public_track_shipment(text, text) is
  'SDD-0235: tracking público minimizado; omite POD/notas, limita intentos y registra huella del origen.';
