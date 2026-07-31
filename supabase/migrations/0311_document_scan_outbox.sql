-- SDD-0224 · Outbox durable para verificación de contenido fuera de Vercel.

create table public.document_scan_outbox (
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

alter table public.document_scan_outbox enable row level security;
create policy "document scan outbox service role all"
  on public.document_scan_outbox for all to service_role
  using (true) with check (true);
grant all on public.document_scan_outbox to service_role;

create index document_scan_outbox_claim_idx
  on public.document_scan_outbox (available_at, id)
  where status in ('pending', 'failed');

create or replace function public.claim_document_scan_jobs(
  p_worker text,
  p_limit integer default 10
) returns setof public.document_scan_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede reclamar verificaciones'
      using errcode = 'insufficient_privilege';
  end if;
  return query
  with candidates as (
    select o.id
    from public.document_scan_outbox o
    where o.status in ('pending', 'failed')
      and o.available_at <= now()
      and o.attempts < 8
    order by o.available_at, o.id
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.document_scan_outbox o
  set status = 'processing', locked_at = now(), locked_by = left(p_worker, 120),
      attempts = o.attempts + 1, last_error = null
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_document_scan(
  p_job_id bigint,
  p_sha256 text,
  p_canonical_mime text,
  p_clean boolean,
  p_error text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.document_scan_outbox%rowtype;
  v_document public.documents%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede completar verificaciones'
      using errcode = 'insufficient_privilege';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 inválido' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_job from public.document_scan_outbox where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    raise exception 'trabajo de verificación no procesable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select * into v_document from public.documents where id = v_job.document_id for update;

  if p_clean then
    update public.documents
    set sha256 = p_sha256, canonical_mime = p_canonical_mime,
        scan_status = 'clean', attachment_status = 'disponible',
        backup_status = 'pending', quarantine_until = null
    where id = v_job.document_id;

    insert into public.document_backup_outbox (document_id, tenant_id)
    values (v_job.document_id, v_job.tenant_id)
    on conflict (document_id) do nothing;

    if v_document.entity_type::text = 'expense' then
      update public.expenses
      set receipt_document_id = v_job.document_id
      where id = v_document.entity_id and tenant_id = v_job.tenant_id and deleted_at is null;
    end if;
  else
    update public.documents
    set sha256 = p_sha256, canonical_mime = p_canonical_mime,
        scan_status = 'infected', attachment_status = 'cuarentena',
        backup_status = 'not_required', quarantine_until = now() + interval '30 days'
    where id = v_job.document_id;
  end if;

  update public.document_scan_outbox
  set status = 'completed', completed_at = now(), locked_at = null,
      last_error = nullif(left(coalesce(p_error, ''), 2000), '')
  where id = p_job_id;

  perform public.append_audit_event(
    v_job.tenant_id, 'document', v_job.document_id, 'system', null,
    case when p_clean then 'attachment_scan_clean' else 'attachment_quarantined' end,
    'worker', 'succeeded', p_error, null, null,
    jsonb_build_object('sha256', p_sha256, 'canonical_mime', p_canonical_mime),
    null, 1, 'restricted'
  );
  return v_job.document_id;
end;
$$;

create or replace function public.fail_document_scan(p_job_id bigint, p_error text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_job public.document_scan_outbox%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede reportar fallas de verificación'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_job from public.document_scan_outbox where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    raise exception 'trabajo de verificación no procesable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.document_scan_outbox
  set status = 'failed', available_at = now() + make_interval(mins => least(60, attempts * 5)),
      locked_at = null, last_error = left(coalesce(p_error, 'scanner no disponible'), 2000)
  where id = p_job_id;
  update public.documents
  set scan_status = 'failed', attachment_status = 'cuarentena',
      quarantine_until = now() + interval '30 days'
  where id = v_job.document_id;
  perform public.append_audit_event(
    v_job.tenant_id, 'document', v_job.document_id, 'system', null,
    'attachment_scan_failed', 'worker', 'failed', left(p_error, 500), null, null,
    '{}'::jsonb, null, 1, 'restricted'
  );
  return v_job.document_id;
end;
$$;

revoke all on function public.claim_document_scan_jobs(text,integer) from public, anon, authenticated;
revoke all on function public.complete_document_scan(bigint,text,text,boolean,text) from public, anon, authenticated;
revoke all on function public.fail_document_scan(bigint,text) from public, anon, authenticated;
grant execute on function public.claim_document_scan_jobs(text,integer) to service_role;
grant execute on function public.complete_document_scan(bigint,text,text,boolean,text) to service_role;
grant execute on function public.fail_document_scan(bigint,text) to service_role;
