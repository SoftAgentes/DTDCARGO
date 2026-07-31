\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth; create table auth.users(id uuid primary key);
create table public.tenants(id uuid primary key);
create table public.documents(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.get_user_tenant_id() returns uuid language sql stable as $$ select null::uuid $$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
\ir ../migrations/0308_document_upload_intents.sql
do $$ begin
  if has_table_privilege('authenticated','public.document_upload_intents','INSERT') then raise exception '0308: authenticated puede insertar directo'; end if;
  if not has_table_privilege('authenticated','public.document_upload_intents','SELECT') then raise exception '0308: falta lectura propia'; end if;
  if not (select relrowsecurity from pg_class where oid='public.document_upload_intents'::regclass) then raise exception '0308: RLS apagado'; end if;
end $$;
rollback;

