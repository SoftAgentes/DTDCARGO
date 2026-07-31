\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
\ir ../migrations/0310_erp_attachments_bucket.sql
do $$ begin
 if (select public from storage.buckets where id='erp-attachments') then raise exception '0310: bucket público'; end if;
 if (select file_size_limit from storage.buckets where id='erp-attachments')<>26214400 then raise exception '0310: límite incorrecto'; end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and 'authenticated'=any(roles) and policyname like 'erp-attachments%') then
   raise exception '0310: policy amplia authenticated'; end if;
end $$;
rollback;

