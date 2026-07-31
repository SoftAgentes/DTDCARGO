-- SDD-0224 · Cierra el namespace cross-tenant del bucket legado de Gastos.

drop policy if exists "expense-receipts authenticated insert own" on storage.objects;
drop policy if exists "expense-receipts authenticated select own or admin" on storage.objects;
drop policy if exists "expense-receipts authenticated update own" on storage.objects;
drop policy if exists "expense-receipts authenticated delete own" on storage.objects;

create policy "expense-receipts authenticated insert own tenant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "expense-receipts authenticated select own or tenant admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1
        from public.user_tenants ut
        where ut.user_id = auth.uid()
          and ut.tenant_id = public.get_user_tenant_id()
          and ut.role = 'admin'
      )
    )
  );

create policy "expense-receipts authenticated update own tenant"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "expense-receipts authenticated delete own tenant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

