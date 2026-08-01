-- SDD-0224 · Bucket privado canónico. El navegador solo recibe autorización
-- firmada para una clave exacta; no hay políticas amplias para authenticated.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-attachments',
  'erp-attachments',
  false,
  25 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "erp-attachments authenticated insert" on storage.objects;
drop policy if exists "erp-attachments authenticated select" on storage.objects;
drop policy if exists "erp-attachments authenticated update" on storage.objects;
drop policy if exists "erp-attachments authenticated delete" on storage.objects;

create policy "erp-attachments service role all"
  on storage.objects for all to service_role
  using (bucket_id = 'erp-attachments')
  with check (bucket_id = 'erp-attachments');

