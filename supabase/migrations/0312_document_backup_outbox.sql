-- SDD-0224 · Réplica independiente verificable antes del estado protegido.

alter table public.documents
  add column if not exists backup_provider text,
  add column if not exists backup_object_key text,
  add column if not exists backup_version_id text,
  add column if not exists backup_sha256 text,
  add column if not exists backup_lock_mode text,
  add column if not exists backup_retain_until timestamptz,
  add constraint documents_backup_sha256_format check (
    backup_sha256 is null or backup_sha256 ~ '^[0-9a-f]{64}$'
  );

create table public.document_backup_outbox (
  id bigint generated always as identity primary key,
  document_id uuid not null unique references public.documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.document_backup_outbox enable row level security;
create policy "document backup outbox service role all"
  on public.document_backup_outbox for all to service_role
  using (true) with check (true);
grant all on public.document_backup_outbox to service_role;

create index document_backup_outbox_claim_idx
  on public.document_backup_outbox (available_at, id)
  where status in ('pending', 'failed');

create or replace function public.claim_document_backup_jobs(
  p_worker text,
  p_limit integer default 10
) returns setof public.document_backup_outbox
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede reclamar respaldos'
      using errcode = 'insufficient_privilege';
  end if;
  return query
  with candidates as (
    select o.id from public.document_backup_outbox o
    join public.documents d on d.id = o.document_id
    where o.status in ('pending', 'failed') and o.available_at <= now()
      and o.attempts < 12 and d.scan_status = 'clean' and d.sha256 is not null
    order by o.available_at, o.id
    for update of o skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.document_backup_outbox o
  set status = 'processing', locked_at = now(), locked_by = left(p_worker, 120),
      attempts = o.attempts + 1, last_error = null
  from candidates c where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_document_backup(
  p_job_id bigint,
  p_provider text,
  p_object_key text,
  p_version_id text,
  p_backup_sha256 text,
  p_lock_mode text,
  p_retain_until timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.document_backup_outbox%rowtype;
  v_document public.documents%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede completar respaldos'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_job from public.document_backup_outbox where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    raise exception 'trabajo de respaldo no procesable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select * into v_document from public.documents where id = v_job.document_id for update;
  if v_document.scan_status <> 'clean' or v_document.sha256 is null then
    raise exception 'documento no verificado' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_backup_sha256 <> v_document.sha256 then
    raise exception 'checksum de respaldo distinto al original' using errcode = 'data_exception';
  end if;
  if nullif(trim(p_provider), '') is null
     or nullif(trim(p_object_key), '') is null
     or nullif(trim(p_version_id), '') is null then
    raise exception 'respaldo sin proveedor, clave o versión inmutable'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_lock_mode not in ('COMPLIANCE', 'GOVERNANCE')
     or p_retain_until < now() + interval '10 years' then
    raise exception 'respaldo sin Object Lock verificable por 10 años'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.documents
  set backup_status = 'verified', attachment_status = 'protegido',
      backed_up_at = now(), backup_provider = left(p_provider, 80),
      backup_object_key = p_object_key, backup_version_id = p_version_id,
      backup_sha256 = p_backup_sha256, backup_lock_mode = p_lock_mode,
      backup_retain_until = p_retain_until
  where id = v_job.document_id;
  update public.document_backup_outbox
  set status = 'completed', completed_at = now(), locked_at = null
  where id = p_job_id;

  perform public.append_audit_event(
    v_job.tenant_id, 'document', v_job.document_id, 'system', null,
    'attachment_backup_verified', 'worker', 'succeeded', null, null, null,
    jsonb_build_object('provider', p_provider, 'version_id', p_version_id, 'sha256', p_backup_sha256,
      'lock_mode', p_lock_mode, 'retain_until', p_retain_until),
    null, 1, 'restricted'
  );
  return v_job.document_id;
end;
$$;

create or replace function public.fail_document_backup(p_job_id bigint, p_error text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_job public.document_backup_outbox%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede reportar fallas de respaldo'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_job from public.document_backup_outbox where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    raise exception 'trabajo de respaldo no procesable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.document_backup_outbox
  set status = 'failed', available_at = now() + make_interval(mins => least(360, attempts * 15)),
      locked_at = null, last_error = left(coalesce(p_error, 'respaldo no disponible'), 2000)
  where id = p_job_id;
  update public.documents set backup_status = 'failed' where id = v_job.document_id;
  return v_job.document_id;
end;
$$;

revoke all on function public.claim_document_backup_jobs(text,integer) from public, anon, authenticated;
revoke all on function public.complete_document_backup(bigint,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.fail_document_backup(bigint,text) from public, anon, authenticated;
grant execute on function public.claim_document_backup_jobs(text,integer) to service_role;
grant execute on function public.complete_document_backup(bigint,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.fail_document_backup(bigint,text) to service_role;
