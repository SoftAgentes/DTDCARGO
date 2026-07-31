-- SDD-0224 · Contrato de reserva, reautorización y finalización.

create or replace function public.reserve_document_upload(
  p_entity_type text,
  p_entity_id uuid,
  p_folder text,
  p_doc_type text,
  p_original_name text,
  p_declared_mime text,
  p_declared_size bigint,
  p_idempotency_key uuid
) returns table (
  intent_id uuid,
  document_id uuid,
  bucket_id text,
  object_key text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_intent public.document_upload_intents%rowtype;
  v_document_id uuid;
  v_extension text;
  v_max_size bigint;
begin
  if v_tenant is null or v_user is null then
    raise exception 'usuario sin tenant activo' using errcode = 'insufficient_privilege';
  end if;
  if p_entity_type <> 'expense' then
    raise exception 'tipo de entidad no habilitado en el piloto' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from public.expenses e
    where e.id = p_entity_id and e.tenant_id = v_tenant and e.deleted_at is null
  ) then
    raise exception 'gasto inexistente o ajeno al tenant' using errcode = 'no_data_found';
  end if;
  if p_folder <> 'receipt' then
    raise exception 'carpeta no habilitada para Gastos' using errcode = 'invalid_parameter_value';
  end if;
  if p_declared_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'tipo MIME no permitido' using errcode = 'invalid_parameter_value';
  end if;
  v_max_size := case
    when p_declared_mime like 'image/%' then 8388608::bigint
    else 26214400::bigint
  end;
  if p_declared_size <= 0 or p_declared_size > v_max_size then
    raise exception 'tamaño fuera del límite permitido' using errcode = 'invalid_parameter_value';
  end if;
  if length(trim(p_original_name)) < 1 or length(p_original_name) > 255 then
    raise exception 'nombre de archivo inválido' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_intent
  from public.document_upload_intents dui
  where dui.tenant_id = v_tenant and dui.idempotency_key = p_idempotency_key;

  if found then
    if v_intent.user_id <> v_user
       or v_intent.entity_type <> p_entity_type
       or v_intent.entity_id <> p_entity_id
       or v_intent.declared_size <> p_declared_size
       or v_intent.declared_mime <> p_declared_mime then
      raise exception 'la clave de idempotencia ya pertenece a otra solicitud'
        using errcode = 'unique_violation';
    end if;
    return query select v_intent.id, v_intent.document_id, v_intent.bucket_id,
      v_intent.object_key, v_intent.expires_at;
    return;
  end if;

  v_document_id := extensions.gen_random_uuid();
  v_extension := case p_declared_mime
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf'
  end;

  insert into public.document_upload_intents (
    tenant_id, user_id, document_id, entity_type, entity_id, folder, doc_type,
    original_name, declared_mime, declared_size, object_key, idempotency_key
  ) values (
    v_tenant, v_user, v_document_id, p_entity_type, p_entity_id, p_folder, p_doc_type,
    trim(p_original_name), p_declared_mime, p_declared_size,
    concat(v_tenant, '/', p_entity_type, '/', p_entity_id, '/', v_document_id, '.', v_extension),
    p_idempotency_key
  ) returning * into v_intent;

  return query select v_intent.id, v_intent.document_id, v_intent.bucket_id,
    v_intent.object_key, v_intent.expires_at;
end;
$$;

create or replace function public.reauthorize_document_upload(p_intent_id uuid)
returns table (bucket_id text, object_key text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
begin
  return query
  update public.document_upload_intents dui
  set expires_at = now() + interval '20 minutes', status = 'uploading', last_error = null
  where dui.id = p_intent_id
    and dui.tenant_id = v_tenant
    and dui.user_id = auth.uid()
    and dui.status in ('reserved', 'uploading', 'uploaded')
  returning dui.bucket_id, dui.object_key, dui.expires_at;

  if not found then
    raise exception 'reserva no reautorizable' using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function public.finalize_document_upload(
  p_intent_id uuid,
  p_actual_size bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_intent public.document_upload_intents%rowtype;
begin
  select * into v_intent
  from public.document_upload_intents dui
  where dui.id = p_intent_id
    and dui.tenant_id = v_tenant
    and dui.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'reserva inexistente o ajena al tenant' using errcode = 'no_data_found';
  end if;
  if v_intent.status = 'finalized' then
    return v_intent.document_id;
  end if;
  if v_intent.status not in ('reserved', 'uploading', 'uploaded') then
    raise exception 'estado de reserva no finalizable' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_actual_size <> v_intent.declared_size then
    raise exception 'el tamaño almacenado no coincide con la reserva' using errcode = 'data_exception';
  end if;
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = v_intent.bucket_id and so.name = v_intent.object_key
  ) then
    raise exception 'el objeto exacto reservado no existe' using errcode = 'no_data_found';
  end if;

  insert into public.documents (
    id, tenant_id, entity_type, entity_id, folder, doc_type, name,
    storage_path, bucket_id, object_key, original_name, content_type,
    size_bytes, uploaded_by, idempotency_key, upload_intent_id,
    attachment_status, scan_status, backup_status, root_id
  ) values (
    v_intent.document_id, v_intent.tenant_id,
    v_intent.entity_type::public.document_entity_type, v_intent.entity_id,
    v_intent.folder, v_intent.doc_type, v_intent.original_name,
    v_intent.object_key, v_intent.bucket_id, v_intent.object_key,
    v_intent.original_name, v_intent.declared_mime, p_actual_size,
    v_intent.user_id, v_intent.idempotency_key, v_intent.id,
    'verificando', 'pending', 'pending', v_intent.document_id
  ) on conflict (id) do nothing;

  update public.document_upload_intents
  set status = 'finalized', finalized_at = now()
  where id = v_intent.id;

  insert into public.document_scan_outbox (document_id, tenant_id)
  values (v_intent.document_id, v_intent.tenant_id)
  on conflict (document_id) do nothing;

  return v_intent.document_id;
end;
$$;

revoke all on function public.reserve_document_upload(text,uuid,text,text,text,text,bigint,uuid) from public;
revoke all on function public.reauthorize_document_upload(uuid) from public;
revoke all on function public.finalize_document_upload(uuid,bigint) from public;
grant execute on function public.reserve_document_upload(text,uuid,text,text,text,text,bigint,uuid) to authenticated;
grant execute on function public.reauthorize_document_upload(uuid) to authenticated;
grant execute on function public.finalize_document_upload(uuid,bigint) to authenticated;
