\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$roles$;

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}',
  correlation_id text,
  source text not null default 'legacy_unknown',
  result text not null default 'legacy_unknown',
  reason text,
  before_data jsonb,
  after_data jsonb,
  schema_version integer not null default 1,
  sensitivity text not null default 'legacy_unknown'
);

create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.entity_audit_log (
    tenant_id, entity_type, entity_id, actor_type, actor_id, event_type,
    source, result, reason, before_data, after_data, payload, correlation_id,
    schema_version, sensitivity
  ) values (
    p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, p_reason, p_before_data, p_after_data,
    p_payload, p_correlation_id, p_schema_version, p_sensitivity
  ) returning id into v_id;
  return v_id;
end $$;

create function public.operario_action(uuid,text,jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path=public
as $$ select '{}'::jsonb $$;
create function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean default false
) returns jsonb language sql security definer set search_path=public
as $$ select '{}'::jsonb $$;
create function public.unstuff_box_as_operario(uuid,text)
returns jsonb language sql security definer set search_path=public
as $$ select '{}'::jsonb $$;
create function public.stuff_lot_as_operario(
  uuid,uuid,text,integer,integer default null
) returns jsonb language sql security definer set search_path=public
as $$ select '{}'::jsonb $$;
create function public.unstuff_lot_as_operario(uuid,uuid)
returns jsonb language sql security definer set search_path=public
as $$ select '{}'::jsonb $$;

\ir ../migrations/0292_audit_d4_logistics_r3.sql

insert into public.entity_audit_log (
  tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload
) values (
  '10000000-0000-0000-0000-000000000001',
  'consolidation',
  '20000000-0000-0000-0000-000000000001',
  'operario',
  '30000000-0000-0000-0000-000000000001',
  'lote_stuffed',
  '{
    "prealerta_id":"40000000-0000-0000-0000-000000000001",
    "load_order":2,
    "width":1,
    "stuffed":3,
    "client_name":"PROHIBIDO",
    "amount":999
  }'
);

do $normalized$
declare
  v_event public.entity_audit_log%rowtype;
begin
  select * into strict v_event from public.entity_audit_log;
  if v_event.source <> 'rpc'
     or v_event.result <> 'succeeded'
     or v_event.sensitivity <> 'restricted'
     or v_event.payload <> '{}'::jsonb
     or v_event.after_data ? 'client_name'
     or v_event.after_data ? 'amount'
     or v_event.after_data ->> 'stuffed' <> '3' then
    raise exception 'TEST 0292: evento legacy no quedó normalizado';
  end if;

  if (
    select count(*)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'operario_action','stuff_box_as_operario','unstuff_box_as_operario',
        'stuff_lot_as_operario','unstuff_lot_as_operario'
      ])
      and p.proconfig @> array['search_path=pg_catalog, public']
  ) <> 5 then
    raise exception 'TEST 0292: search_path no quedó fijado';
  end if;
end;
$normalized$;

create or replace function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text,
  p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal'
)
returns uuid language plpgsql security definer set search_path = ''
as $$ begin raise exception 'forced_audit_failure'; end $$;

do $rollback$
declare
  v_before integer := (select count(*) from public.entity_audit_log);
begin
  begin
    insert into public.entity_audit_log (
      tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'warehouse_receipt_ve',
      '20000000-0000-0000-0000-000000000002',
      'operario',
      '30000000-0000-0000-0000-000000000001',
      'box_scanned',
      '{"manual":false}'
    );
    raise exception 'TEST 0292: writer fallido no abortó';
  exception when others then
    if sqlerrm = 'TEST 0292: writer fallido no abortó' then raise; end if;
  end;

  if (select count(*) from public.entity_audit_log) <> v_before then
    raise exception 'TEST 0292: el evento parcial sobrevivió';
  end if;
end;
$rollback$;

rollback;
select true as audit_d4_fixture_rolled_back;
