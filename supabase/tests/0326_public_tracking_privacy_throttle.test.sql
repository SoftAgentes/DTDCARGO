\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.public_track_log(
  id uuid primary key default extensions.gen_random_uuid(), ip text, code text not null,
  found boolean not null, requested_at timestamptz not null default now()
);
alter table public.public_track_log enable row level security;
create policy public_track_log_anon_insert on public.public_track_log for insert to anon,authenticated with check(true);
grant insert on public.public_track_log to anon,authenticated;
create table public.shipments(
  id uuid primary key, code text, status text, shipment_service text, origin text,
  destination text, weight_kg numeric, volume_m3 numeric, vehicle_category text,
  arrived_destination_at timestamptz, delivered_at timestamptz, pod_signed_by text,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.shipment_events(
  id uuid primary key, shipment_id uuid, status text, note text,
  occurred_at timestamptz not null default now(), deleted_at timestamptz
);
\ir ../migrations/0326_public_tracking_privacy_throttle.sql

do $$ declare r record; stored_ip text; begin
  insert into public.shipments(id,code,status,shipment_service,pod_signed_by)
  values('11111111-1111-4111-8111-111111111111','S-2026-0001','delivered','consolidado_lcl','Persona receptora');
  insert into public.shipment_events(id,shipment_id,status,note)
  values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','delivered','Documento 123');
  select * into r from public.public_track_shipment('S-2026-0001','203.0.113.10');
  if not r.found or r.pod_signed_by is not null then raise exception '0326: filtró POD o no encontró'; end if;
  if r.events->0->>'note' is not null then raise exception '0326: filtró nota libre'; end if;
  select ip into stored_ip from public.public_track_log limit 1;
  if stored_ip='203.0.113.10' or length(stored_ip)<>64 then raise exception '0326: guardó IP cruda'; end if;
  if has_table_privilege('anon','public.public_track_log','INSERT') then raise exception '0326: anon inserta log directo'; end if;
end $$;
rollback;
