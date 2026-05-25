-- ─────────────────────────────────────────────────────────────
-- SDD-0028: Fotos reales de recepción CN.
--
-- 1 bucket privado `receipt-photos` + 1 tabla warehouse_receipt_photos
-- que indexa los objects en Storage por receipt + tenant + operario.
--
-- Path scheme: {tenant_id}/{receipt_id}/{position}-{uuid}.jpg
-- Operario no es authenticated → upload + delete via server action
-- con service_role. authenticated del tenant lee via signed URL (TTL 1h).
-- ─────────────────────────────────────────────────────────────

-- Bucket privado, 8MB max por archivo, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-photos',
  'receipt-photos',
  false,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
create policy "receipt-photos service_role write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'receipt-photos')
  with check (bucket_id = 'receipt-photos');

-- authenticated puede leer solo los objects de su tenant
-- (primer segmento del path = tenant_id)
create policy "receipt-photos authenticated read by tenant"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipt-photos'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- Tabla photos
create table public.warehouse_receipt_photos (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  receipt_id                uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  storage_path              text not null,
  position                  int not null default 0,
  size_bytes                bigint,
  content_type              text,
  uploaded_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at                timestamptz not null default now(),
  unique (storage_path)
);

comment on table public.warehouse_receipt_photos is
  'Index de fotos en bucket receipt-photos. 1 row por foto. Cascade delete con el receipt padre.';

create index warehouse_receipt_photos_receipt_idx
  on public.warehouse_receipt_photos (receipt_id, position);

create index warehouse_receipt_photos_tenant_idx
  on public.warehouse_receipt_photos (tenant_id);

-- RPC link (post-upload)
create or replace function public.link_receipt_photo(
  p_operario_id  uuid,
  p_receipt_id   uuid,
  p_storage_path text,
  p_position     int,
  p_size_bytes   bigint,
  p_content_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id   uuid;
  v_op_tenant   uuid;
  v_active      boolean;
  v_photo_id    uuid;
begin
  select op.tenant_id, op.active into v_op_tenant, v_active
    from public.operario_pins op where op.id = p_operario_id;
  if v_op_tenant is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0015';
  end if;

  select wr.tenant_id into v_tenant_id
    from public.warehouse_receipts_cn wr where wr.id = p_receipt_id;
  if v_tenant_id is null then
    raise exception 'Receipt no encontrado' using errcode = 'P0016';
  end if;
  if v_tenant_id <> v_op_tenant then
    raise exception 'Receipt de otro tenant' using errcode = 'P0017';
  end if;

  insert into public.warehouse_receipt_photos (
    tenant_id, receipt_id, storage_path, position,
    size_bytes, content_type, uploaded_by_operario_id
  ) values (
    v_tenant_id, p_receipt_id, p_storage_path, p_position,
    p_size_bytes, p_content_type, p_operario_id
  )
  returning id into v_photo_id;

  return v_photo_id;
end;
$$;

comment on function public.link_receipt_photo is
  'Indexa una foto ya subida a Storage al receipt + operario. Llamado desde server action post-upload.';

-- RPC unlink (V2 UI)
create or replace function public.unlink_receipt_photo(
  p_operario_id uuid,
  p_photo_id    uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op_tenant uuid;
  v_path      text;
  v_active    boolean;
begin
  select op.tenant_id, op.active into v_op_tenant, v_active
    from public.operario_pins op where op.id = p_operario_id;
  if v_op_tenant is null or not v_active then
    raise exception 'Operario inválido' using errcode = 'P0014';
  end if;

  delete from public.warehouse_receipt_photos p
   where p.id = p_photo_id and p.tenant_id = v_op_tenant
  returning p.storage_path into v_path;

  return v_path;
end;
$$;

comment on function public.unlink_receipt_photo is
  'Borra row de foto y retorna storage_path para que server action borre el object del bucket.';

-- RLS
alter table public.warehouse_receipt_photos enable row level security;

create policy "warehouse_receipt_photos select by tenant"
  on public.warehouse_receipt_photos for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Grants
grant select on public.warehouse_receipt_photos to authenticated;
grant select, insert, delete on public.warehouse_receipt_photos to service_role;

revoke all on function public.link_receipt_photo(uuid, uuid, text, int, bigint, text)
  from public, anon, authenticated;
grant execute on function public.link_receipt_photo(uuid, uuid, text, int, bigint, text)
  to service_role;

revoke all on function public.unlink_receipt_photo(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unlink_receipt_photo(uuid, uuid) to service_role;
