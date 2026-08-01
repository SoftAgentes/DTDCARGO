-- SDD-0221 · AUD-02 Corte E4 · expiración de artefactos.
set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
begin
  if to_regclass('public.audit_export_artifacts') is null
     or to_regprocedure('public.audit_event_is_held(uuid,text,uuid,timestamptz,text)') is null then
    raise exception 'E4 requiere E2 y E3';
  end if;
end $$;

create table public.audit_export_expiry_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.audit_export_requests(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  event_type text not null check (event_type in ('claimed','deleted','failed')),
  object_path text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  reason text,
  occurred_at timestamptz not null default clock_timestamp()
);
create index audit_export_expiry_events_state_idx
  on public.audit_export_expiry_events (request_id, occurred_at desc, id desc);
alter table public.audit_export_expiry_events enable row level security;
revoke all on table public.audit_export_expiry_events from public, anon, authenticated, service_role;
create trigger audit_export_expiry_events_immutable
before update or delete on public.audit_export_expiry_events
for each row execute function public.reject_audit_hold_mutation();

create function public.audit_claim_expired_exports(p_limit integer default 25)
returns table (request_id uuid, tenant_id uuid, object_path text, artifact_sha256 text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'audit: límite de expiración inválido' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select a.* from public.audit_export_artifacts a
    where a.expires_at <= clock_timestamp()
      and not public.audit_event_is_held(a.tenant_id, 'audit_export', a.request_id, a.created_at, null)
      and coalesce((
        select x.event_type from public.audit_export_expiry_events x
        where x.request_id = a.request_id order by x.occurred_at desc, x.id desc limit 1
      ), 'none') in ('none','failed')
    order by a.expires_at
    for update skip locked
    limit p_limit
  ), claimed as (
    insert into public.audit_export_expiry_events
      (request_id, tenant_id, event_type, object_path, artifact_sha256)
    select c.request_id, c.tenant_id, 'claimed', c.object_path, c.sha256 from candidates c
    returning audit_export_expiry_events.request_id,
      audit_export_expiry_events.tenant_id,
      audit_export_expiry_events.object_path,
      audit_export_expiry_events.artifact_sha256
  ) select * from claimed;
end $$;

create function public.audit_confirm_export_expired(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_claim public.audit_export_expiry_events%rowtype;
begin
  select * into v_claim from public.audit_export_expiry_events
  where request_id = p_request_id order by occurred_at desc, id desc limit 1;
  if not found or v_claim.event_type <> 'claimed' then
    raise exception 'audit: claim de expiración inválido' using errcode = '22023';
  end if;
  insert into public.audit_export_expiry_events
    (request_id, tenant_id, event_type, object_path, artifact_sha256)
  values (p_request_id, v_claim.tenant_id, 'deleted', v_claim.object_path, v_claim.artifact_sha256);
  insert into public.audit_export_events (request_id, tenant_id, event_type, actor_type)
  values (p_request_id, v_claim.tenant_id, 'expired', 'system');
  perform public.append_audit_event(
    v_claim.tenant_id, 'audit_export', p_request_id, 'system', null,
    'audit_export_artifact_expired', 'job', 'succeeded', null, null, null,
    jsonb_build_object('sha256', v_claim.artifact_sha256), null, 1, 'internal'
  );
  return true;
end $$;

create function public.audit_fail_export_expiry(p_request_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_claim public.audit_export_expiry_events%rowtype;
begin
  select * into v_claim from public.audit_export_expiry_events
  where request_id = p_request_id order by occurred_at desc, id desc limit 1;
  if not found or v_claim.event_type <> 'claimed' then return false; end if;
  insert into public.audit_export_expiry_events
    (request_id, tenant_id, event_type, object_path, artifact_sha256, reason)
  values (p_request_id, v_claim.tenant_id, 'failed', v_claim.object_path,
    v_claim.artifact_sha256, left(btrim(p_reason), 1000));
  return true;
end $$;

revoke all on function public.audit_claim_expired_exports(integer),
  public.audit_confirm_export_expired(uuid), public.audit_fail_export_expiry(uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.audit_claim_expired_exports(integer),
  public.audit_confirm_export_expired(uuid), public.audit_fail_export_expiry(uuid,text)
to service_role;

reset statement_timeout;
reset lock_timeout;

