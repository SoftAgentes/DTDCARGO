-- SDD-0224 · Acepta recibos verificables de Cloudflare R2 Bucket Lock sin
-- fingir que R2 implementa S3 Object Lock o VersionId.

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
    raise exception 'respaldo sin proveedor, clave o recibo inmutable'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_lock_mode not in ('COMPLIANCE', 'GOVERNANCE', 'R2_BUCKET_LOCK')
     or p_retain_until < now() + interval '10 years' then
    raise exception 'respaldo sin retención inmutable verificable por 10 años'
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
    jsonb_build_object('provider', p_provider, 'receipt_id', p_version_id, 'sha256', p_backup_sha256,
      'lock_mode', p_lock_mode, 'retain_until', p_retain_until),
    null, 1, 'restricted'
  );
  return v_job.document_id;
end;
$$;

revoke all on function public.complete_document_backup(bigint,text,text,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_document_backup(bigint,text,text,text,text,text,timestamptz)
  to service_role;

comment on column public.documents.backup_version_id is
  'Recibo inmutable del proveedor: VersionId en S3 Object Lock o etag:<ETag> en R2 Bucket Lock.';
comment on column public.documents.backup_lock_mode is
  'Mecanismo verificado: COMPLIANCE, GOVERNANCE o R2_BUCKET_LOCK.';
