-- SDD-0219 · AUD-02 Corte E2 · legal holds append-only.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.entity_audit_log') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.user_tenants') is null
     or to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null then
    raise exception 'E2 requiere el contrato de auditoría gobernada';
  end if;
  if to_regclass('public.audit_legal_holds') is not null
     or to_regclass('public.audit_legal_hold_events') is not null then
    raise exception 'E2 no aplica: objetos de hold ya existen';
  end if;
end
$preflight$;

insert into public.audit_entity_types
  (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('audit_hold', 'active', 'governance', 1, 'migration:0301')
on conflict (entity_type) do nothing;

create table public.audit_legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  scope_type text not null,
  entity_type text references public.audit_entity_types(entity_type) on update restrict on delete restrict,
  entity_id uuid,
  correlation_id text,
  from_at timestamptz,
  to_at timestamptz,
  reason text not null,
  reference text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_legal_holds_scope_check check (
    (scope_type = 'tenant' and entity_type is null and entity_id is null)
    or (scope_type = 'entity_type' and entity_type is not null and entity_id is null)
    or (scope_type = 'entity' and entity_type is not null and entity_id is not null)
  ),
  constraint audit_legal_holds_reason_check check (char_length(btrim(reason)) between 8 and 1000),
  constraint audit_legal_holds_reference_check check (char_length(btrim(reference)) between 3 and 200),
  constraint audit_legal_holds_correlation_check check (
    correlation_id is null or correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  constraint audit_legal_holds_range_check check (from_at is null or to_at is null or from_at <= to_at)
);

create index audit_legal_holds_tenant_created_idx on public.audit_legal_holds (tenant_id, created_at desc);
create index audit_legal_holds_scope_idx on public.audit_legal_holds (tenant_id, entity_type, entity_id);

create table public.audit_legal_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.audit_legal_holds(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  event_type text not null check (event_type in ('active', 'release_requested', 'released')),
  reason text not null check (char_length(btrim(reason)) between 8 and 1000),
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default clock_timestamp()
);

create index audit_legal_hold_events_state_idx on public.audit_legal_hold_events (hold_id, occurred_at desc, id desc);
create index audit_legal_hold_events_tenant_idx on public.audit_legal_hold_events (tenant_id, occurred_at desc);

alter table public.audit_legal_holds enable row level security;
alter table public.audit_legal_hold_events enable row level security;
revoke all on table public.audit_legal_holds, public.audit_legal_hold_events from public, anon, authenticated, service_role;

create function public.reject_audit_hold_mutation()
returns trigger language plpgsql set search_path = '' as $function$
begin
  raise exception 'audit: legal holds son append-only' using errcode = '23514';
end
$function$;

create trigger audit_legal_holds_immutable before update or delete on public.audit_legal_holds
for each row execute function public.reject_audit_hold_mutation();
create trigger audit_legal_hold_events_immutable before update or delete on public.audit_legal_hold_events
for each row execute function public.reject_audit_hold_mutation();
revoke all on function public.reject_audit_hold_mutation() from public, anon, authenticated, service_role;

create function public.audit_admin_tenant()
returns uuid language plpgsql security definer set search_path = '' as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_count integer;
begin
  select count(*)::integer, (array_agg(ut.tenant_id order by ut.tenant_id))[1]
    into v_count, v_tenant_id
  from public.user_tenants ut
  where ut.user_id = v_user_id and ut.disabled_at is null and ut.role = 'admin';
  if v_user_id is null or v_count <> 1 or v_tenant_id is null then
    raise exception 'audit: capability denegada' using errcode = '42501';
  end if;
  return v_tenant_id;
end
$function$;
revoke all on function public.audit_admin_tenant() from public, anon, authenticated, service_role;

create function public.audit_create_legal_hold(
  p_scope_type text, p_entity_type text, p_entity_id uuid, p_correlation_id text,
  p_from_at timestamptz, p_to_at timestamptz, p_reason text, p_reference text
)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_hold uuid;
begin
  insert into public.audit_legal_holds (
    tenant_id, scope_type, entity_type, entity_id, correlation_id,
    from_at, to_at, reason, reference, created_by
  ) values (
    v_tenant, p_scope_type, nullif(btrim(p_entity_type), ''), p_entity_id,
    nullif(btrim(p_correlation_id), ''), p_from_at, p_to_at,
    btrim(p_reason), btrim(p_reference), v_actor
  ) returning id into v_hold;
  insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
  values (v_hold, v_tenant, 'active', btrim(p_reason), v_actor);
  perform public.append_audit_event(
    v_tenant, 'audit_hold', v_hold, 'user', v_actor, 'legal_hold_created',
    'rpc', 'succeeded', btrim(p_reason), null, null,
    jsonb_build_object('scope_type', p_scope_type, 'reference', btrim(p_reference)),
    null, 1, 'restricted'
  );
  return v_hold;
end
$function$;

create function public.audit_request_legal_hold_release(p_hold_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_hold public.audit_legal_holds%rowtype;
  v_state text;
begin
  select * into v_hold from public.audit_legal_holds where id = p_hold_id and tenant_id = v_tenant for update;
  if not found then raise exception 'audit: hold inexistente' using errcode = 'P0002'; end if;
  select e.event_type into v_state from public.audit_legal_hold_events e
  where e.hold_id = p_hold_id order by e.occurred_at desc, e.id desc limit 1;
  if v_state <> 'active' then raise exception 'audit: transición de hold inválida' using errcode = '22023'; end if;
  insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
  values (p_hold_id, v_tenant, 'release_requested', btrim(p_reason), v_actor);
  perform public.append_audit_event(
    v_tenant, 'audit_hold', p_hold_id, 'user', v_actor, 'legal_hold_release_requested',
    'rpc', 'succeeded', btrim(p_reason), null, null,
    jsonb_build_object('reference', v_hold.reference), null, 1, 'restricted'
  );
  return true;
end
$function$;

create function public.audit_approve_legal_hold_release(p_hold_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_hold public.audit_legal_holds%rowtype;
  v_state text;
  v_requester uuid;
begin
  select * into v_hold from public.audit_legal_holds where id = p_hold_id and tenant_id = v_tenant for update;
  if not found then raise exception 'audit: hold inexistente' using errcode = 'P0002'; end if;
  select e.event_type, e.actor_id into v_state, v_requester from public.audit_legal_hold_events e
  where e.hold_id = p_hold_id order by e.occurred_at desc, e.id desc limit 1;
  if v_state <> 'release_requested' then raise exception 'audit: transición de hold inválida' using errcode = '22023'; end if;
  if v_requester = v_actor then
    raise exception 'audit: liberación requiere segundo aprobador' using errcode = '42501';
  end if;
  insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
  values (p_hold_id, v_tenant, 'released', btrim(p_reason), v_actor);
  perform public.append_audit_event(
    v_tenant, 'audit_hold', p_hold_id, 'user', v_actor, 'legal_hold_released',
    'rpc', 'succeeded', btrim(p_reason), null, null,
    jsonb_build_object('reference', v_hold.reference), null, 1, 'restricted'
  );
  return true;
end
$function$;

create function public.audit_event_is_held(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid,
  p_occurred_at timestamptz, p_correlation_id text
)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.audit_legal_holds h
    cross join lateral (
      select e.event_type from public.audit_legal_hold_events e
      where e.hold_id = h.id order by e.occurred_at desc, e.id desc limit 1
    ) state
    where h.tenant_id = p_tenant_id
      and state.event_type in ('active', 'release_requested')
      and (h.from_at is null or p_occurred_at >= h.from_at)
      and (h.to_at is null or p_occurred_at <= h.to_at)
      and (h.correlation_id is null or h.correlation_id = p_correlation_id)
      and (
        h.scope_type = 'tenant'
        or (h.scope_type = 'entity_type' and h.entity_type = p_entity_type)
        or (h.scope_type = 'entity' and h.entity_type = p_entity_type and h.entity_id = p_entity_id)
      )
  )
$function$;

create function public.audit_list_legal_holds(p_state text default null)
returns table (
  id uuid, scope_type text, entity_type text, entity_id uuid, correlation_id text,
  from_at timestamptz, to_at timestamptz, reason text, reference text,
  state text, created_at timestamptz, last_event_at timestamptz
)
language plpgsql security definer set search_path = '' as $function$
declare v_tenant uuid := public.audit_admin_tenant();
begin
  if p_state is not null and p_state not in ('active', 'release_requested', 'released') then
    raise exception 'audit: estado de hold inválido' using errcode = '22023';
  end if;
  return query
  select h.id, h.scope_type, h.entity_type, h.entity_id, h.correlation_id,
    h.from_at, h.to_at, h.reason, h.reference, latest.event_type,
    h.created_at, latest.occurred_at
  from public.audit_legal_holds h
  cross join lateral (
    select e.event_type, e.occurred_at from public.audit_legal_hold_events e
    where e.hold_id = h.id order by e.occurred_at desc, e.id desc limit 1
  ) latest
  where h.tenant_id = v_tenant and (p_state is null or latest.event_type = p_state)
  order by h.created_at desc;
end
$function$;

revoke all on function public.audit_create_legal_hold(text,text,uuid,text,timestamptz,timestamptz,text,text),
  public.audit_request_legal_hold_release(uuid,text),
  public.audit_approve_legal_hold_release(uuid,text),
  public.audit_event_is_held(uuid,text,uuid,timestamptz,text),
  public.audit_list_legal_holds(text)
from public, anon, authenticated, service_role;
grant execute on function public.audit_create_legal_hold(text,text,uuid,text,timestamptz,timestamptz,text,text),
  public.audit_request_legal_hold_release(uuid,text),
  public.audit_approve_legal_hold_release(uuid,text),
  public.audit_list_legal_holds(text) to authenticated;
grant execute on function public.audit_event_is_held(uuid,text,uuid,timestamptz,text) to service_role;

do $postconditions$
begin
  if has_table_privilege('authenticated', 'public.audit_legal_holds', 'SELECT')
     or has_table_privilege('service_role', 'public.audit_legal_hold_events', 'DELETE')
     or not has_function_privilege('authenticated', 'public.audit_create_legal_hold(text,text,uuid,text,timestamptz,timestamptz,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.audit_event_is_held(uuid,text,uuid,timestamptz,text)', 'EXECUTE') then
    raise exception 'E2 abortado: ACL de holds inválida';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;

