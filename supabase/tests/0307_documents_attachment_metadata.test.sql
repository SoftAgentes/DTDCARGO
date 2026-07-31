\set ON_ERROR_STOP on
begin;
create schema auth; create table auth.users(id uuid primary key);
create table public.documents(
  id uuid primary key, tenant_id uuid not null, name text not null,
  storage_path text not null unique, content_type text, created_at timestamptz default now(), deleted_at timestamptz
);
insert into public.documents(id,tenant_id,name,storage_path,content_type)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','a.pdf','t/a.pdf','application/pdf');
\ir ../migrations/0307_documents_attachment_metadata.sql
do $$ begin
  if (select object_key from public.documents limit 1) <> 't/a.pdf' then raise exception '0307: backfill object_key falló'; end if;
  begin
    update public.documents set object_key='otro';
    raise exception '0307: permitió identidades divergentes';
  exception when check_violation then null; end;
  begin
    update public.documents set sha256='malo';
    raise exception '0307: permitió hash inválido';
  exception when check_violation then null; end;
end $$;
rollback;

