\set ON_ERROR_STOP on
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $roles$;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key default gen_random_uuid(), name text, slug text);
create table public.user_tenants (
  user_id uuid, tenant_id uuid, role text, disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
create table public.audit_entity_types (
  entity_type text primary key, status text, domain_code text,
  contract_version integer, introduced_by_ref text
);
insert into public.audit_entity_types values
  ('shipment','active','operations',1,'fixture'),
  ('invoice','active','finance',1,'fixture');
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, entity_type text,
  entity_id uuid, actor_type text, actor_id uuid, event_type text, source text,
  result text, reason text, before_data jsonb, after_data jsonb,
  payload jsonb default '{}', correlation_id text, schema_version integer,
  sensitivity text, occurred_at timestamptz
);
create table public.audit_export_expiry_events (id uuid);
create table public.test_held_entities (entity_id uuid primary key);
create function public.audit_event_is_held(uuid,text,uuid,timestamptz,text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.test_held_entities where entity_id = $3)
$$;
create function public.audit_admin_tenant() returns uuid language sql security definer set search_path = '' as $$
  select tenant_id from public.user_tenants
  where user_id = auth.uid() and role = 'admin' and disabled_at is null limit 1
$$;
create function public.reject_audit_hold_mutation() returns trigger language plpgsql as $$
begin raise exception 'append-only' using errcode = '23514'; end $$;
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
  insert into public.entity_audit_log values (
    gen_random_uuid(),p_tenant_id,p_entity_type,p_entity_id,p_actor_type,p_actor_id,
    p_event_type,p_source,p_result,p_reason,p_before_data,p_after_data,p_payload,
    p_correlation_id,p_schema_version,p_sensitivity,clock_timestamp()
  ) returning id into v_id;
  return v_id;
end $$;

\ir ../migrations/0304_audit_retention_batches.sql

do $test$
declare
  v_tenant uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_op_entity uuid := gen_random_uuid();
  v_held_entity uuid := gen_random_uuid();
  v_fin_entity uuid := gen_random_uuid();
  v_batch uuid;
  v_denied boolean := false;
  v_deleted integer;
begin
  insert into public.tenants values (v_tenant, 'E5', 'e5');
  insert into auth.users values (v_a), (v_b);
  insert into public.user_tenants values
    (v_a,v_tenant,'admin',null),(v_b,v_tenant,'admin',null);
  insert into public.test_held_entities values (v_held_entity);
  insert into public.entity_audit_log
    (tenant_id,entity_type,entity_id,actor_type,event_type,source,result,payload,schema_version,sensitivity,occurred_at)
  values
    (v_tenant,'shipment',v_op_entity,'system','old_op','job','succeeded','{}',1,'internal',now()-interval '7 years'),
    (v_tenant,'shipment',v_held_entity,'system','old_held','job','succeeded','{}',1,'internal',now()-interval '7 years'),
    (v_tenant,'invoice',v_fin_entity,'system','old_fiscal','job','succeeded','{}',1,'internal',now()-interval '12 years');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_batch := public.audit_retention_dry_run('operational', now()-interval '6 years', 'Prueba controlada de retención');
  if (select snapshot_count from public.audit_retention_batches where id=v_batch) <> 1 then
    raise exception 'E5: dry-run no excluyó hold/fiscal';
  end if;
  begin
    perform public.audit_approve_retention_batch(v_batch, 'Autoaprobación inválida');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'E5: permitió autoaprobación'; end if;
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  if not public.audit_approve_retention_batch(v_batch, 'Segundo aprobador confirma lote') then
    raise exception 'E5: segundo aprobador falló';
  end if;
  v_deleted := public.audit_execute_retention_batch(v_batch);
  if v_deleted <> 1 then raise exception 'E5: conteo ejecutado incorrecto'; end if;
  if exists (select 1 from public.entity_audit_log where entity_id=v_op_entity) then
    raise exception 'E5: evento elegible sobrevivió';
  end if;
  if not exists (select 1 from public.entity_audit_log where entity_id in (v_held_entity,v_fin_entity) group by tenant_id having count(*)=2) then
    raise exception 'E5: borró hold o fiscal';
  end if;
  if (select deleted_count from public.audit_retention_batch_events where batch_id=v_batch and event_type='executed') <> 1 then
    raise exception 'E5: recibo ausente';
  end if;
end $test$;
rollback;

