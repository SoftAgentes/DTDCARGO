-- ─────────────────────────────────────────────────────────────
-- Expenses · foto del recibo / comprobante
--
-- Bucket privado `expense-receipts` + columna receipt_path en expenses.
-- Path scheme: {tenant_id}/{user_id}/{expense_code}.{ext}
-- Solo el dueño puede leer/escribir/borrar sus recibos · admin del
-- tenant puede leer todos los del tenant.
--
-- 1 foto por gasto (MVP) · si más adelante necesitamos N fotos
-- se migra a tabla auxiliar como warehouse_receipt_photos.
-- ─────────────────────────────────────────────────────────────

alter table public.expenses
  add column if not exists receipt_path text;

comment on column public.expenses.receipt_path is
  'Path en bucket expense-receipts · NULL si no se cargó. Formato {tenant}/{user}/{code}.{ext}';

-- Bucket privado · 5MB max · solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role tiene acceso total (para limpieza, backups)
create policy "expense-receipts service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'expense-receipts')
  with check (bucket_id = 'expense-receipts');

-- INSERT: authenticated puede subir solo a su propia carpeta
-- path = {tenant_id}/{user_id}/{filename}
create policy "expense-receipts authenticated insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- SELECT: dueño puede leer su recibo · admin del tenant puede leer todos
create policy "expense-receipts authenticated select own or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.user_tenants ut
        where ut.user_id = auth.uid()
          and ut.tenant_id::text = (storage.foldername(name))[1]
          and ut.role = 'admin'
      )
    )
  );

-- UPDATE: solo dueño (caso reemplazar foto)
create policy "expense-receipts authenticated update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- DELETE: solo dueño (al borrar el gasto)
create policy "expense-receipts authenticated delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
