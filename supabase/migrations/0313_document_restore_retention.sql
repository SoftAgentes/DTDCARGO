-- SDD-0224 · Borrado lógico, retención y restauración auditable.

alter table public.documents
  add column if not exists retention_until timestamptz,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references auth.users(id) on delete set null;

update public.documents
set retention_until = created_at + interval '10 years'
where retention_until is null and retention_class in ('financial', 'legal');

create table public.document_restore_outbox (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 8 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.document_restore_outbox enable row level security;
create policy "document restore requester read"
  on public.document_restore_outbox for select to authenticated
  using (tenant_id = public.get_user_tenant_id() and requested_by = auth.uid());
create policy "document restore outbox service role all"
  on public.document_restore_outbox for all to service_role
  using (true) with check (true);
grant select on public.document_restore_outbox to authenticated;
grant all on public.document_restore_outbox to service_role;

create or replace function public.soft_delete_document(p_document_id uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
begin
  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'motivo de borrado insuficiente' using errcode = 'invalid_parameter_value';
  end if;
  update public.documents
  set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = trim(p_reason),
      attachment_status = 'eliminado', is_current = false
  where id = p_document_id and tenant_id = v_tenant and deleted_at is null;
  if not found then
    raise exception 'documento inexistente, ya borrado o ajeno al tenant' using errcode = 'no_data_found';
  end if;
  perform public.append_audit_event(
    v_tenant, 'document', p_document_id, 'user', auth.uid(),
    'attachment_soft_deleted', 'rpc', 'succeeded', trim(p_reason), null, null,
    '{}'::jsonb, null, 1, 'restricted'
  );
  return true;
end;
$$;

create or replace function public.request_document_restore(p_document_id uuid, p_reason text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_id bigint;
begin
  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'motivo de restauración insuficiente' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from public.documents d
    where d.id = p_document_id and d.tenant_id = v_tenant
      and d.backup_status = 'verified' and d.backup_version_id is not null
  ) then
    raise exception 'documento sin respaldo verificable o ajeno al tenant'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  insert into public.document_restore_outbox(document_id, tenant_id, requested_by, reason)
  values (p_document_id, v_tenant, auth.uid(), trim(p_reason)) returning id into v_id;
  perform public.append_audit_event(
    v_tenant, 'document', p_document_id, 'user', auth.uid(),
    'attachment_restore_requested', 'rpc', 'succeeded', trim(p_reason), null, null,
    jsonb_build_object('restore_job_id', v_id), null, 1, 'restricted'
  );
  return v_id;
end;
$$;

create or replace function public.claim_document_restore_jobs(p_worker text, p_limit integer default 5)
returns setof public.document_restore_outbox
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede reclamar restauraciones'
      using errcode = 'insufficient_privilege';
  end if;
  return query
  with candidates as (
    select o.id from public.document_restore_outbox o
    where o.status in ('pending', 'failed') and o.available_at <= now() and o.attempts < 8
    order by o.available_at, o.id for update skip locked
    limit least(greatest(p_limit, 1), 20)
  )
  update public.document_restore_outbox o
  set status = 'processing', locked_at = now(), locked_by = left(p_worker, 120),
      attempts = o.attempts + 1, last_error = null
  from candidates c where o.id = c.id returning o.*;
end;
$$;

create or replace function public.complete_document_restore(p_job_id bigint, p_restored_sha256 text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.document_restore_outbox%rowtype;
  v_document public.documents%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'solo service_role puede completar restauraciones'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_job from public.document_restore_outbox where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    raise exception 'trabajo de restauración no procesable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select * into v_document from public.documents where id = v_job.document_id for update;
  if p_restored_sha256 <> v_document.sha256 or p_restored_sha256 <> v_document.backup_sha256 then
    raise exception 'checksum restaurado no coincide' using errcode = 'data_exception';
  end if;
  update public.documents
  set restored_at = now(), restored_by = v_job.requested_by
  where id = v_job.document_id;
  update public.document_restore_outbox
  set status = 'completed', completed_at = now(), locked_at = null
  where id = p_job_id;
  perform public.append_audit_event(
    v_job.tenant_id, 'document', v_job.document_id, 'system', null,
    'attachment_restore_verified', 'worker', 'succeeded', v_job.reason, null, null,
    jsonb_build_object('sha256', p_restored_sha256, 'restore_job_id', p_job_id),
    null, 1, 'restricted'
  );
  return v_job.document_id;
end;
$$;

revoke all on function public.soft_delete_document(uuid,text) from public;
revoke all on function public.request_document_restore(uuid,text) from public;
revoke all on function public.claim_document_restore_jobs(text,integer) from public, anon, authenticated;
revoke all on function public.complete_document_restore(bigint,text) from public, anon, authenticated;
grant execute on function public.soft_delete_document(uuid,text) to authenticated;
grant execute on function public.request_document_restore(uuid,text) to authenticated;
grant execute on function public.claim_document_restore_jobs(text,integer) to service_role;
grant execute on function public.complete_document_restore(bigint,text) to service_role;

comment on column public.documents.retention_until is
  'SDD-0224: fecha mínima de retención; nunca autoriza por sí sola una eliminación física.';

