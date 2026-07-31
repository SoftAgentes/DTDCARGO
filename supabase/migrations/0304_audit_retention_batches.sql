-- SDD-0222 · AUD-02 Corte E5 · retención por lotes controlados.
set lock_timeout = '5s';
set statement_timeout = '120s';

do $$
begin
  if to_regclass('public.audit_export_expiry_events') is null
     or to_regprocedure('public.audit_event_is_held(uuid,text,uuid,timestamptz,text)') is null then
    raise exception 'E5 requiere E2-E4';
  end if;
end $$;

insert into public.audit_entity_types
  (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('audit_retention_batch', 'active', 'governance', 1, 'migration:0304')
on conflict (entity_type) do nothing;

create table public.audit_retention_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  retention_class text not null check (retention_class in ('operational','security')),
  cutoff_at timestamptz not null,
  snapshot_count integer not null check (snapshot_count >= 0),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  reason text not null check (char_length(btrim(reason)) between 8 and 1000),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default clock_timestamp()
);

create table public.audit_retention_batch_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.audit_retention_batches(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  event_type text not null check (event_type in ('dry_run','approved','executed','invalidated')),
  actor_type text not null check (actor_type in ('user','system')),
  actor_id uuid references auth.users(id) on delete restrict,
  reason text,
  deleted_count integer,
  deleted_sha256 text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint audit_retention_actor_check check (
    (actor_type = 'user' and actor_id is not null) or (actor_type = 'system' and actor_id is null)
  )
);

create index audit_retention_batches_tenant_idx on public.audit_retention_batches (tenant_id, requested_at desc);
create index audit_retention_batch_events_state_idx on public.audit_retention_batch_events (batch_id, occurred_at desc, id desc);
alter table public.audit_retention_batches enable row level security;
alter table public.audit_retention_batch_events enable row level security;
revoke all on table public.audit_retention_batches, public.audit_retention_batch_events
  from public, anon, authenticated, service_role;
create trigger audit_retention_batches_immutable before update or delete on public.audit_retention_batches
for each row execute function public.reject_audit_hold_mutation();
create trigger audit_retention_batch_events_immutable before update or delete on public.audit_retention_batch_events
for each row execute function public.reject_audit_hold_mutation();

create function public.audit_retention_eligible_ids(
  p_tenant_id uuid, p_class text, p_cutoff_at timestamptz
)
returns table (id uuid)
language sql stable security definer set search_path = '' as $$
  select l.id
  from public.entity_audit_log l
  join public.audit_entity_types t on t.entity_type = l.entity_type
  where l.tenant_id = p_tenant_id
    and l.occurred_at <= p_cutoff_at
    and (
      (p_class = 'operational' and t.domain_code in ('operations','commercial','procurement'))
      or (p_class = 'security' and t.domain_code in ('governance','security','access','integration','ai'))
    )
    and not public.audit_event_is_held(l.tenant_id, l.entity_type, l.entity_id, l.occurred_at, l.correlation_id)
  order by l.id
$$;

create function public.audit_retention_snapshot(
  p_tenant_id uuid, p_class text, p_cutoff_at timestamptz
)
returns table (event_count integer, sha256 text)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer,
    encode(extensions.digest(coalesce(string_agg(e.id::text, ',' order by e.id), ''), 'sha256'), 'hex')
  from public.audit_retention_eligible_ids(p_tenant_id, p_class, p_cutoff_at) e
$$;

revoke all on function public.audit_retention_eligible_ids(uuid,text,timestamptz),
  public.audit_retention_snapshot(uuid,text,timestamptz)
from public, anon, authenticated, service_role;

create function public.audit_retention_dry_run(
  p_class text, p_cutoff_at timestamptz, p_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_count integer;
  v_hash text;
  v_batch uuid;
begin
  if p_class not in ('operational','security') then
    raise exception 'audit: clase fiscal/legacy no es ejecutable' using errcode = '22023';
  end if;
  if (p_class = 'operational' and p_cutoff_at > clock_timestamp() - interval '5 years')
     or (p_class = 'security' and p_cutoff_at > clock_timestamp() - interval '2 years') then
    raise exception 'audit: cutoff viola el calendario aprobado' using errcode = '22023';
  end if;
  select * into v_count, v_hash from public.audit_retention_snapshot(v_tenant, p_class, p_cutoff_at);
  insert into public.audit_retention_batches
    (tenant_id, retention_class, cutoff_at, snapshot_count, snapshot_sha256, reason, requested_by)
  values (v_tenant, p_class, p_cutoff_at, v_count, v_hash, btrim(p_reason), v_actor)
  returning id into v_batch;
  insert into public.audit_retention_batch_events (batch_id, tenant_id, event_type, actor_type, actor_id)
  values (v_batch, v_tenant, 'dry_run', 'user', v_actor);
  return v_batch;
end $$;

create function public.audit_approve_retention_batch(p_batch_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.audit_admin_tenant();
  v_batch public.audit_retention_batches%rowtype;
  v_count integer;
  v_hash text;
  v_state text;
begin
  select * into v_batch from public.audit_retention_batches
  where id = p_batch_id and tenant_id = v_tenant for update;
  if not found then raise exception 'audit: lote inexistente' using errcode = 'P0002'; end if;
  if v_batch.requested_by = v_actor then
    raise exception 'audit: lote requiere segundo aprobador' using errcode = '42501';
  end if;
  select event_type into v_state from public.audit_retention_batch_events
  where batch_id = p_batch_id order by occurred_at desc, id desc limit 1;
  if v_state <> 'dry_run' then raise exception 'audit: transición de lote inválida' using errcode = '22023'; end if;
  select * into v_count, v_hash from public.audit_retention_snapshot(v_tenant, v_batch.retention_class, v_batch.cutoff_at);
  if v_count <> v_batch.snapshot_count or v_hash <> v_batch.snapshot_sha256 then
    insert into public.audit_retention_batch_events
      (batch_id, tenant_id, event_type, actor_type, actor_id, reason)
    values (p_batch_id, v_tenant, 'invalidated', 'user', v_actor, 'snapshot cambió antes de aprobar');
    return false;
  end if;
  insert into public.audit_retention_batch_events
    (batch_id, tenant_id, event_type, actor_type, actor_id, reason)
  values (p_batch_id, v_tenant, 'approved', 'user', v_actor, btrim(p_reason));
  return true;
end $$;

create function public.audit_execute_retention_batch(p_batch_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_batch public.audit_retention_batches%rowtype;
  v_state text;
  v_count integer;
  v_hash text;
  v_deleted integer;
  v_deleted_hash text;
begin
  select * into v_batch from public.audit_retention_batches where id = p_batch_id for update;
  if not found then raise exception 'audit: lote inexistente' using errcode = 'P0002'; end if;
  select event_type into v_state from public.audit_retention_batch_events
  where batch_id = p_batch_id order by occurred_at desc, id desc limit 1;
  if v_state <> 'approved' then raise exception 'audit: lote no aprobado' using errcode = '42501'; end if;
  select * into v_count, v_hash from public.audit_retention_snapshot(v_batch.tenant_id, v_batch.retention_class, v_batch.cutoff_at);
  if v_count <> v_batch.snapshot_count or v_hash <> v_batch.snapshot_sha256 then
    insert into public.audit_retention_batch_events
      (batch_id, tenant_id, event_type, actor_type, reason)
    values (p_batch_id, v_batch.tenant_id, 'invalidated', 'system', 'snapshot cambió antes de ejecutar');
    return -1;
  end if;
  with eligible as (
    select id from public.audit_retention_eligible_ids(v_batch.tenant_id, v_batch.retention_class, v_batch.cutoff_at)
  ), deleted as (
    delete from public.entity_audit_log l using eligible e where l.id = e.id returning l.id
  )
  select count(*)::integer,
    encode(extensions.digest(coalesce(string_agg(id::text, ',' order by id), ''), 'sha256'), 'hex')
  into v_deleted, v_deleted_hash from deleted;
  if v_deleted <> v_batch.snapshot_count or v_deleted_hash <> v_batch.snapshot_sha256 then
    raise exception 'audit: recibo de DELETE no coincide' using errcode = '40001';
  end if;
  insert into public.audit_retention_batch_events
    (batch_id, tenant_id, event_type, actor_type, deleted_count, deleted_sha256)
  values (p_batch_id, v_batch.tenant_id, 'executed', 'system', v_deleted, v_deleted_hash);
  perform public.append_audit_event(
    v_batch.tenant_id, 'audit_retention_batch', p_batch_id, 'system', null,
    'audit_retention_batch_executed', 'job', 'succeeded', null, null, null,
    jsonb_build_object('class', v_batch.retention_class, 'count', v_deleted, 'sha256', v_deleted_hash),
    null, 1, 'restricted'
  );
  return v_deleted;
end $$;

revoke all on function public.audit_retention_dry_run(text,timestamptz,text),
  public.audit_approve_retention_batch(uuid,text), public.audit_execute_retention_batch(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.audit_retention_dry_run(text,timestamptz,text),
  public.audit_approve_retention_batch(uuid,text) to authenticated;
grant execute on function public.audit_execute_retention_batch(uuid) to service_role;

reset statement_timeout;
reset lock_timeout;
