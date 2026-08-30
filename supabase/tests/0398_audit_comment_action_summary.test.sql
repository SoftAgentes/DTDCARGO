-- Contract for SDD-0166 allowlist v2 / SDD-0168 audit action evidence.
-- Runs in an isolated transaction and never touches a remote database.

begin;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid
$$;

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.user_profiles (
  user_id uuid primary key,
  first_name text,
  last_name text
);

create table public.operario_pins (
  id uuid primary key,
  tenant_id uuid not null,
  display_name text not null
);

create table public.entity_audit_log (
  id uuid primary key,
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  correlation_id text,
  source text not null default 'legacy_unknown',
  result text not null default 'legacy_unknown',
  reason text,
  before_data jsonb,
  after_data jsonb,
  schema_version integer not null default 1,
  sensitivity text not null default 'legacy_unknown'
);

grant insert on public.entity_audit_log to service_role;

-- Minimal C1-compatible predecessor. Migration 0398 must replace the complete
-- function and abort if the governed tenant/admin/redaction contract drifted.
create function public.audit_list_events(
  p_limit integer default 50,
  p_entity_type text default null,
  p_actor_type text default null,
  p_event_type text default null,
  p_source text default null,
  p_result text default null,
  p_sensitivity text default null,
  p_correlation_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_cursor text default null
)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  actor_type text,
  actor_id uuid,
  actor_label text,
  actor_resolved boolean,
  event_type text,
  occurred_at timestamptz,
  correlation_id text,
  source text,
  result text,
  sensitivity text,
  schema_version integer,
  timezone text,
  summary jsonb,
  next_cursor text,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
begin
  perform 1
  from public.user_tenants as ut
  where ut.role = 'admin';

  return query
  select
    log.id,
    log.entity_type,
    log.entity_id,
    log.actor_type,
    log.actor_id,
    null::text,
    false,
    log.event_type,
    log.occurred_at,
    log.correlation_id,
    log.source,
    log.result,
    log.sensitivity,
    log.schema_version,
    'UTC'::text,
    null::jsonb,
    null::text,
    false
  from public.entity_audit_log as log
  where log.tenant_id = v_tenant_id
  limit 0;
end
$function$;

revoke all on function public.audit_list_events(
  integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text
) from public, anon, authenticated, service_role;
grant execute on function public.audit_list_events(
  integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text
) to authenticated;

insert into public.user_tenants (user_id, tenant_id, role) values
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001', 'operations'),
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002', 'admin');

insert into public.user_profiles (user_id, first_name, last_name) values
  ('20000000-0000-0000-0000-000000000001', 'Admin', 'Uno');

insert into public.entity_audit_log (
  id,
  tenant_id,
  entity_type,
  entity_id,
  actor_type,
  actor_id,
  event_type,
  payload,
  occurred_at,
  source,
  result,
  sensitivity
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000001',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_soft_deleted',
    '{"schema":"comment.lifecycle.v1","action":"self_delete","body":"never-return"}',
    '2026-08-29 12:00:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000001',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_restored',
    '{"schema":"comment.lifecycle.v1","action":"undo","reason":"never-return"}',
    '2026-08-29 12:01:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000002',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_soft_deleted',
    '{"schema":"comment.lifecycle.v1","action":"future_action"}',
    '2026-08-29 12:02:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000003',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_restored',
    '{"schema":"comment.lifecycle.v2","action":"ordinary_restore"}',
    '2026-08-29 12:03:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'shipment',
    '50000000-0000-0000-0000-000000000004',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_restored',
    '{"schema":"comment.lifecycle.v1","action":"ordinary_restore"}',
    '2026-08-29 12:04:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000005',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_edited',
    '{"schema":"comment.lifecycle.v1","action":"self_delete"}',
    '2026-08-29 12:05:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    'comment',
    '50000000-0000-0000-0000-000000000006',
    'user',
    '20000000-0000-0000-0000-000000000003',
    'comment_soft_deleted',
    '{"schema":"comment.lifecycle.v1","action":"moderation"}',
    '2026-08-29 12:06:00+00',
    'studio',
    'succeeded',
    'internal'
  );

insert into public.entity_audit_log (
  id,
  tenant_id,
  entity_type,
  entity_id,
  actor_type,
  actor_id,
  event_type,
  payload,
  occurred_at,
  source,
  result,
  sensitivity
) values
  (
    '40000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000007',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_soft_deleted',
    '{"schema":"comment.lifecycle.v1","action":"moderation"}',
    '2026-08-29 12:07:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000008',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_restored',
    '{"schema":"comment.lifecycle.v1","action":"ordinary_restore"}',
    '2026-08-29 12:08:00+00',
    'studio',
    'succeeded',
    'internal'
  ),
  (
    '40000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    'comment',
    '50000000-0000-0000-0000-000000000009',
    'user',
    '20000000-0000-0000-0000-000000000001',
    'comment_restored',
    '{"schema":"comment.lifecycle.v1","action":"exceptional_restore"}',
    '2026-08-29 12:09:00+00',
    'studio',
    'succeeded',
    'internal'
  );

\ir ../migrations/0398_audit_comment_action_summary.sql

do $acl$
declare
  v_list_oid oid := to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  );
  v_result text;
begin
  if has_table_privilege('authenticated', 'public.entity_audit_log', 'SELECT')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'SELECT')
     or has_function_privilege('anon', v_list_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_list_oid, 'EXECUTE')
     or has_function_privilege('service_role', v_list_oid, 'EXECUTE') then
    raise exception 'TEST 0398: ACL gobernada inválida';
  end if;

  select pg_catalog.pg_get_function_result(v_list_oid) into v_result;
  if v_result ~* '(payload|before_data|after_data|reason)'
     or v_result !~* 'summary jsonb' then
    raise exception 'TEST 0398: firma expone datos crudos';
  end if;
end
$acl$;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000002';

do $non_admin$
begin
  begin
    perform * from public.audit_list_events();
    raise exception 'TEST 0398: no-admin consultó auditoría';
  exception
    when insufficient_privilege then null;
  end;
end
$non_admin$;

set local "request.jwt.claim.sub" =
  '20000000-0000-0000-0000-000000000001';

do $allowlist$
declare
  v_count integer;
  v_summary jsonb;
  v_serialized text;
  v_actions text[];
begin
  select count(*) into v_count from public.audit_list_events();
  if v_count <> 9 then
    raise exception 'TEST 0398: aislamiento por tenant inválido';
  end if;

  select summary into v_summary
  from public.audit_list_events()
  where id = '40000000-0000-0000-0000-000000000001';
  if v_summary <> '{"action":"self_delete"}'::jsonb
     or (
       select count(*)
       from pg_catalog.jsonb_object_keys(v_summary)
     ) <> 1 then
    raise exception 'TEST 0398: self_delete no salió como resumen exacto';
  end if;

  select summary into v_summary
  from public.audit_list_events()
  where id = '40000000-0000-0000-0000-000000000002';
  if v_summary <> '{"action":"undo"}'::jsonb then
    raise exception 'TEST 0398: undo no salió como resumen exacto';
  end if;

  select pg_catalog.array_agg(
    event_row.summary ->> 'action'
    order by event_row.summary ->> 'action'
  ) into v_actions
  from public.audit_list_events() as event_row
  where event_row.summary is not null;
  if v_actions <> array[
    'exceptional_restore',
    'moderation',
    'ordinary_restore',
    'self_delete',
    'undo'
  ]::text[] then
    raise exception 'TEST 0398: vocabulario positivo incompleto: %', v_actions;
  end if;

  if exists (
    select 1
    from public.audit_list_events()
    where id in (
      '40000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000004',
      '40000000-0000-0000-0000-000000000005',
      '40000000-0000-0000-0000-000000000006'
    )
      and summary is not null
  ) then
    raise exception 'TEST 0398: schema, acción, entidad o evento desconocido filtró summary';
  end if;

  select pg_catalog.string_agg(pg_catalog.row_to_json(event_row)::text, '')
    into v_serialized
  from public.audit_list_events() as event_row;
  if v_serialized like '%never-return%'
     or v_serialized like '%"payload"%'
     or v_serialized like '%"reason"%' then
    raise exception 'TEST 0398: la RPC filtró payload o reason crudo';
  end if;
end
$allowlist$;

reset role;

rollback;

select
  to_regclass('public.entity_audit_log') is null
  and to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  ) is null
  as audit_0398_fixture_rolled_back;
