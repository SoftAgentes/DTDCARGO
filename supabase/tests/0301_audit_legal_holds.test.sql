\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null,
  domain_code text not null,
  contract_version integer not null,
  introduced_by_ref text not null
);
insert into public.audit_entity_types values ('invoice', 'active', 'finance', 1, 'fixture');
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  source text not null,
  result text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}',
  correlation_id text,
  schema_version integer not null,
  sensitivity text not null,
  occurred_at timestamptz not null default now()
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text, p_result text default 'succeeded',
  p_reason text default null, p_before_data jsonb default null,
  p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1,
  p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $$
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
end
$$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
  from public, anon, authenticated;
grant execute on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
  to service_role;

\ir ../migrations/0301_audit_legal_holds.sql

do $test$
declare
  v_tenant uuid;
  v_admin_a uuid;
  v_admin_b uuid;
  v_hold uuid;
  v_blocked boolean := false;
begin
  insert into public.tenants (name, slug) values ('E2 tenant', 'e2-holds-test') returning id into v_tenant;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_admin_a;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_admin_b;
  insert into public.user_tenants (user_id, tenant_id, role)
  values (v_admin_a, v_tenant, 'admin'), (v_admin_b, v_tenant, 'admin');
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  v_hold := public.audit_create_legal_hold(
    'entity_type', 'invoice', null, null, null, null,
    'Fiscalización abierta de prueba', 'EXP-E2-001'
  );
  if not public.audit_event_is_held(v_tenant, 'invoice', gen_random_uuid(), now(), null) then
    raise exception 'E2: hold activo no bloquea';
  end if;
  perform public.audit_request_legal_hold_release(v_hold, 'Expediente cerrado; solicitar revisión');
  if not public.audit_event_is_held(v_tenant, 'invoice', gen_random_uuid(), now(), null) then
    raise exception 'E2: release_requested dejó de bloquear';
  end if;
  begin
    perform public.audit_approve_legal_hold_release(v_hold, 'Aprobación propia inválida');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'E2: permitió autoaprobar liberación'; end if;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform public.audit_approve_legal_hold_release(v_hold, 'Segundo aprobador valida el cierre');
  if public.audit_event_is_held(v_tenant, 'invoice', gen_random_uuid(), now(), null) then
    raise exception 'E2: hold liberado sigue bloqueando';
  end if;
  v_blocked := false;
  begin
    update public.audit_legal_holds set reference = 'ALTERADO' where id = v_hold;
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'E2: definición de hold mutable'; end if;
  if (select count(*) from public.entity_audit_log where entity_type = 'audit_hold' and entity_id = v_hold) <> 3 then
    raise exception 'E2: faltan eventos canónicos de transición';
  end if;
end
$test$;
rollback;
