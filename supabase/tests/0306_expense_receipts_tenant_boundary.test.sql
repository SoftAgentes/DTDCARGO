\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.get_user_tenant_id() returns uuid language sql stable as $$ select null::uuid $$;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
create table public.user_tenants(user_id uuid,tenant_id uuid,role text);
create table storage.objects(id uuid,name text,bucket_id text);
alter table storage.objects enable row level security;
create policy "expense-receipts authenticated insert own" on storage.objects for insert to authenticated with check(bucket_id='expense-receipts');
create policy "expense-receipts authenticated select own or admin" on storage.objects for select to authenticated using(bucket_id='expense-receipts');
create policy "expense-receipts authenticated update own" on storage.objects for update to authenticated using(bucket_id='expense-receipts');
create policy "expense-receipts authenticated delete own" on storage.objects for delete to authenticated using(bucket_id='expense-receipts');
\ir ../migrations/0306_expense_receipts_tenant_boundary.sql
do $$ declare defs text; begin
  select string_agg(coalesce(qual,'')||coalesce(with_check,''),' ') into defs
  from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'expense-receipts authenticated%';
  if defs not like '%get_user_tenant_id%' then raise exception '0306: políticas sin frontera tenant'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'expense-receipts authenticated%') <> 4 then
    raise exception '0306: set de policies incompleto';
  end if;
end $$;
rollback;

