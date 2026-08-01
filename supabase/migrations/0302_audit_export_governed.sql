-- SDD-0220 · AUD-02 Corte E3 · exportación gobernada.
set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
begin
  if to_regclass('public.audit_legal_holds') is null
     or to_regprocedure('public.audit_admin_tenant()') is null then
    raise exception 'E3 requiere 0301_audit_legal_holds';
  end if;
  if to_regclass('public.audit_export_requests') is not null then
    raise exception 'E3 no aplica: export requests ya existe';
  end if;
end $$;

insert into public.audit_entity_types
  (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('audit_export', 'active', 'governance', 1, 'migration:0302')
on conflict (entity_type) do nothing;

create table public.audit_export_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  format text not null check (format in ('csv', 'json', 'ndjson')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  fields text[] not null,
  justification text not null check (char_length(btrim(justification)) between 8 and 1000),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default clock_timestamp(),
  constraint audit_export_fields_nonempty check (cardinality(fields) between 1 and 12)
);

create table public.audit_export_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.audit_export_requests(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  event_type text not null check (event_type in (
    'awaiting_approval','queued','generating','ready','downloaded','failed','revoked','expired'
  )),
  actor_type text not null check (actor_type in ('user','system')),
  actor_id uuid references auth.users(id) on delete restrict,
  reason text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint audit_export_event_actor check (
    (actor_type = 'user' and actor_id is not null) or (actor_type = 'system' and actor_id is null)
  )
);

create table public.audit_export_artifacts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.audit_export_requests(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  row_count integer not null check (row_count >= 0),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_export_artifact_ttl check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index audit_export_requests_tenant_idx on public.audit_export_requests (tenant_id, requested_at desc);
create index audit_export_events_state_idx on public.audit_export_events (request_id, occurred_at desc, id desc);
create index audit_export_artifacts_expiry_idx on public.audit_export_artifacts (expires_at);

alter table public.audit_export_requests enable row level security;
alter table public.audit_export_events enable row level security;
alter table public.audit_export_artifacts enable row level security;
revoke all on table public.audit_export_requests, public.audit_export_events, public.audit_export_artifacts
  from public, anon, authenticated, service_role;

create trigger audit_export_requests_immutable before update or delete on public.audit_export_requests
for each row execute function public.reject_audit_hold_mutation();
create trigger audit_export_events_immutable before update or delete on public.audit_export_events
for each row execute function public.reject_audit_hold_mutation();
create trigger audit_export_artifacts_immutable before update or delete on public.audit_export_artifacts
for each row execute function public.reject_audit_hold_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-exports', 'audit-exports', false, 52428800,
  array['text/csv','application/json','application/x-ndjson']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function public.audit_export_validate_fields(p_fields text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(p_fields) between 1 and 12
    and p_fields <@ array[
      'id','entity_type','entity_id','actor_type','event_type','occurred_at',
      'correlation_id','source','result','sensitivity','schema_version','timezone'
    ]::text[]
    and cardinality(p_fields) = cardinality(array(select distinct unnest(p_fields)))
$$;
revoke all on function public.audit_export_validate_fields(text[]) from public, anon, authenticated, service_role;

create function public.audit_request_export(
  p_format text, p_filters jsonb, p_fields text[], p_justification text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_id uuid;
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
begin
  if p_format not in ('csv','json','ndjson')
     or jsonb_typeof(v_filters) <> 'object'
     or not public.audit_export_validate_fields(p_fields)
     or exists (
       select 1 from jsonb_object_keys(v_filters) k
       where k not in ('entity_type','actor_type','event_type','source','result','sensitivity','correlation_id','from','to')
     ) then
    raise exception 'audit: solicitud de exportación inválida' using errcode = '22023';
  end if;
  insert into public.audit_export_requests
    (tenant_id, format, filters, fields, justification, requested_by)
  values (v_tenant, p_format, v_filters, p_fields, btrim(p_justification), v_actor)
  returning id into v_id;
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type, actor_id)
  values (v_id, v_tenant, 'awaiting_approval', 'user', v_actor);
  perform public.append_audit_event(
    v_tenant, 'audit_export', v_id, 'user', v_actor, 'audit_export_requested',
    'rpc', 'succeeded', btrim(p_justification), null, null,
    jsonb_build_object('format', p_format, 'field_count', cardinality(p_fields)), null, 1, 'restricted'
  );
  return v_id;
end $$;

create function public.audit_approve_export(p_request_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_request public.audit_export_requests%rowtype;
  v_state text;
begin
  select * into v_request from public.audit_export_requests
  where id = p_request_id and tenant_id = v_tenant for update;
  if not found then raise exception 'audit: export inexistente' using errcode = 'P0002'; end if;
  if v_request.requested_by = v_actor then
    raise exception 'audit: export requiere segundo aprobador' using errcode = '42501';
  end if;
  select event_type into v_state from public.audit_export_events
  where request_id = p_request_id order by occurred_at desc, id desc limit 1;
  if v_state <> 'awaiting_approval' then raise exception 'audit: transición de export inválida' using errcode = '22023'; end if;
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type, actor_id, reason)
  values (p_request_id, v_tenant, 'queued', 'user', v_actor, btrim(p_reason));
  perform public.append_audit_event(
    v_tenant, 'audit_export', p_request_id, 'user', v_actor, 'audit_export_approved',
    'rpc', 'succeeded', btrim(p_reason), null, null, '{}'::jsonb, null, 1, 'restricted'
  );
  return true;
end $$;

create function public.audit_claim_export_job()
returns table (request_id uuid, tenant_id uuid, format text, filters jsonb, fields text[])
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select r.id into v_id
  from public.audit_export_requests r
  cross join lateral (
    select e.event_type from public.audit_export_events e where e.request_id = r.id
    order by e.occurred_at desc, e.id desc limit 1
  ) state
  where state.event_type = 'queued'
  order by r.requested_at
  for update of r skip locked limit 1;
  if v_id is null then return; end if;
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type)
  select id, tenant_id, 'generating', 'system' from public.audit_export_requests where id = v_id;
  return query select r.id, r.tenant_id, r.format, r.filters, r.fields
  from public.audit_export_requests r where r.id = v_id;
end $$;

create function public.audit_export_rows(p_request_id uuid)
returns table (
  id uuid, entity_type text, entity_id uuid, actor_type text, event_type text,
  occurred_at timestamptz, correlation_id text, source text, result text,
  sensitivity text, schema_version integer, timezone text
)
language plpgsql security definer set search_path = '' as $$
declare v_request public.audit_export_requests%rowtype;
begin
  select * into v_request from public.audit_export_requests where audit_export_requests.id = p_request_id;
  if not found or not exists (
    select 1 from public.audit_export_events e where e.request_id = p_request_id
      and e.event_type = 'generating'
      and not exists (select 1 from public.audit_export_events n where n.request_id = p_request_id and (n.occurred_at, n.id) > (e.occurred_at, e.id))
  ) then raise exception 'audit: export no está en generación' using errcode = '22023'; end if;
  return query
  select l.id, l.entity_type, l.entity_id, l.actor_type, l.event_type,
    l.occurred_at, l.correlation_id, l.source, l.result, l.sensitivity,
    l.schema_version, 'UTC'::text
  from public.entity_audit_log l
  where l.tenant_id = v_request.tenant_id
    and (not (v_request.filters ? 'entity_type') or l.entity_type = v_request.filters->>'entity_type')
    and (not (v_request.filters ? 'actor_type') or l.actor_type = v_request.filters->>'actor_type')
    and (not (v_request.filters ? 'event_type') or l.event_type = v_request.filters->>'event_type')
    and (not (v_request.filters ? 'source') or l.source = v_request.filters->>'source')
    and (not (v_request.filters ? 'result') or l.result = v_request.filters->>'result')
    and (not (v_request.filters ? 'sensitivity') or l.sensitivity = v_request.filters->>'sensitivity')
    and (not (v_request.filters ? 'correlation_id') or l.correlation_id = v_request.filters->>'correlation_id')
    and (not (v_request.filters ? 'from') or l.occurred_at >= (v_request.filters->>'from')::timestamptz)
    and (not (v_request.filters ? 'to') or l.occurred_at <= (v_request.filters->>'to')::timestamptz)
  order by l.occurred_at, l.id limit 10000;
end $$;

create function public.audit_complete_export(
  p_request_id uuid, p_object_path text, p_sha256 text, p_row_count integer,
  p_size_bytes bigint, p_manifest jsonb, p_expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_request public.audit_export_requests%rowtype;
begin
  select * into v_request from public.audit_export_requests where id = p_request_id for update;
  if not found or p_object_path !~ ('^' || v_request.tenant_id::text || '/' || p_request_id::text || '/audit\.(csv|json|ndjson)$') then
    raise exception 'audit: artefacto inválido' using errcode = '22023';
  end if;
  insert into public.audit_export_artifacts
    (request_id, tenant_id, object_path, sha256, row_count, size_bytes, manifest, expires_at)
  values (p_request_id, v_request.tenant_id, p_object_path, p_sha256, p_row_count, p_size_bytes, p_manifest, p_expires_at);
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type)
  values (p_request_id, v_request.tenant_id, 'ready', 'system');
  return true;
end $$;

create function public.audit_fail_export(p_request_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type, reason)
  select id, tenant_id, 'failed', 'system', left(btrim(p_reason), 1000)
  from public.audit_export_requests where id = p_request_id;
  return found;
end $$;

create function public.audit_authorize_export_download(p_request_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_path text;
begin
  select a.object_path into v_path
  from public.audit_export_artifacts a
  where a.request_id = p_request_id and a.tenant_id = v_tenant and a.expires_at > clock_timestamp()
    and exists (
      select 1 from public.audit_export_events e where e.request_id = p_request_id and e.event_type = 'ready'
        and not exists (select 1 from public.audit_export_events n where n.request_id = p_request_id and (n.occurred_at,n.id) > (e.occurred_at,e.id) and n.event_type in ('expired','revoked','failed'))
    );
  if v_path is null then raise exception 'audit: export no disponible' using errcode = '42501'; end if;
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type, actor_id)
  values (p_request_id, v_tenant, 'downloaded', 'user', v_actor);
  return v_path;
end $$;

revoke all on function public.audit_request_export(text,jsonb,text[],text),
  public.audit_approve_export(uuid,text), public.audit_claim_export_job(),
  public.audit_export_rows(uuid),
  public.audit_complete_export(uuid,text,text,integer,bigint,jsonb,timestamptz),
  public.audit_fail_export(uuid,text), public.audit_authorize_export_download(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.audit_request_export(text,jsonb,text[],text),
  public.audit_approve_export(uuid,text), public.audit_authorize_export_download(uuid)
to authenticated;
grant execute on function public.audit_claim_export_job(), public.audit_export_rows(uuid),
  public.audit_complete_export(uuid,text,text,integer,bigint,jsonb,timestamptz),
  public.audit_fail_export(uuid,text) to service_role;

reset statement_timeout;
reset lock_timeout;

