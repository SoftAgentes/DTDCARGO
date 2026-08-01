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
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

create type public.warehouse_receipt_event_type as enum ('note');
create type public.warehouse_receipt_ve_status as enum ('sellado');

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

create function public.operario_action(
  uuid,
  text,
  jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event', 'note'::warehouse_receipt_event_type::text,
    'status', 'sellado'::warehouse_receipt_ve_status::text
  )
$$;

create function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean default false
)
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('rpc', 'stuff_box') $$;

create function public.unstuff_box_as_operario(uuid,text)
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('rpc', 'unstuff_box') $$;

create function public.stuff_lot_as_operario(
  uuid,uuid,text,integer,integer default null
)
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('rpc', 'stuff_lot') $$;

create function public.unstuff_lot_as_operario(uuid,uuid)
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('rpc', 'unstuff_lot') $$;

revoke all on function public.operario_action(uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean
) from public, anon, authenticated;
revoke all on function public.unstuff_box_as_operario(uuid,text)
  from public, anon, authenticated;
revoke all on function public.stuff_lot_as_operario(
  uuid,uuid,text,integer,integer
) from public, anon, authenticated;
revoke all on function public.unstuff_lot_as_operario(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.operario_action(uuid,text,jsonb)
  to service_role;
grant execute on function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean
) to service_role;
grant execute on function public.unstuff_box_as_operario(uuid,text)
  to service_role;
grant execute on function public.stuff_lot_as_operario(
  uuid,uuid,text,integer,integer
) to service_role;
grant execute on function public.unstuff_lot_as_operario(uuid,uuid)
  to service_role;

\ir ../migrations/0292_audit_d4_logistics_r3.sql
\ir ../migrations/0296_audit_d4_empty_search_path.sql

do $metadata$
declare
  v_definition text;
begin
  if (
    select count(*)
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
      and p.proconfig @> array['search_path=""']
  ) <> 5 then
    raise exception 'TEST 0296: alguna RPC no quedó con path vacío';
  end if;

  select pg_get_functiondef('public.operario_action(uuid,text,jsonb)'::regprocedure)
    into strict v_definition;
  if v_definition !~ '::public\.warehouse_receipt_event_type'
     or v_definition !~ '::public\.warehouse_receipt_ve_status'
     or v_definition ~ '::(warehouse_receipt_event_type|warehouse_receipt_ve_status)' then
    raise exception 'TEST 0296: casts de enum no quedaron cualificados';
  end if;
end;
$metadata$;

set local role service_role;

do $execution$
begin
  if public.operario_action(null, 'probe', '{}'::jsonb)
     <> '{"event":"note","status":"sellado"}'::jsonb then
    raise exception 'TEST 0296: operario_action falló con path vacío';
  end if;
  if public.stuff_box_as_operario(null,null,'x',0,0,0,false)
     <> '{"rpc":"stuff_box"}'::jsonb then
    raise exception 'TEST 0296: stuff_box falló con path vacío';
  end if;
  if public.unstuff_box_as_operario(null,'x')
     <> '{"rpc":"unstuff_box"}'::jsonb then
    raise exception 'TEST 0296: unstuff_box falló con path vacío';
  end if;
  if public.stuff_lot_as_operario(null,null,'x',0,null)
     <> '{"rpc":"stuff_lot"}'::jsonb then
    raise exception 'TEST 0296: stuff_lot falló con path vacío';
  end if;
  if public.unstuff_lot_as_operario(null,null)
     <> '{"rpc":"unstuff_lot"}'::jsonb then
    raise exception 'TEST 0296: unstuff_lot falló con path vacío';
  end if;
end;
$execution$;

reset role;
set local role anon;

do $anon_denied$
begin
  begin
    perform public.operario_action(null, 'probe', '{}'::jsonb);
    raise exception 'TEST 0296: anon ejecutó operario_action';
  exception when insufficient_privilege then
    null;
  end;
end;
$anon_denied$;

reset role;
rollback;
select true as audit_d4_empty_search_path_fixture_rolled_back;
