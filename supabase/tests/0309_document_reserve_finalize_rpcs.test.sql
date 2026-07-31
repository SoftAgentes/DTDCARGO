\set ON_ERROR_STOP on
begin;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create schema auth; create schema extensions; create schema storage;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.user',true)::uuid $$;
create function public.get_user_tenant_id() returns uuid language sql stable as $$ select current_setting('test.tenant',true)::uuid $$;
create type public.document_entity_type as enum('none','expense');
create table public.expenses(id uuid primary key,tenant_id uuid,deleted_at timestamptz);
create table storage.objects(bucket_id text,name text);
create table public.document_upload_intents(
 id uuid primary key default extensions.gen_random_uuid(), tenant_id uuid,user_id uuid,document_id uuid unique,
 entity_type text,entity_id uuid,folder text,doc_type text,original_name text,declared_mime text,declared_size bigint,
 bucket_id text default 'erp-attachments',object_key text,idempotency_key uuid,status text default 'reserved',
 expires_at timestamptz default now()+interval '20 minutes',finalized_at timestamptz,last_error text,
 unique(tenant_id,idempotency_key)
);
create table public.documents(
 id uuid primary key,tenant_id uuid,entity_type public.document_entity_type,entity_id uuid,folder text,doc_type text,name text,
 storage_path text,bucket_id text,object_key text,original_name text,content_type text,size_bytes bigint,uploaded_by uuid,
 idempotency_key uuid,upload_intent_id uuid,attachment_status text,scan_status text,backup_status text,root_id uuid
);
create table public.document_scan_outbox(document_id uuid unique,tenant_id uuid);
\ir ../migrations/0309_document_reserve_finalize_rpcs.sql
do $$ declare
 t uuid='11111111-1111-4111-8111-111111111111'; u uuid='22222222-2222-4222-8222-222222222222';
 e uuid='33333333-3333-4333-8333-333333333333'; k uuid='44444444-4444-4444-8444-444444444444';
 r1 record; r2 record; d uuid;
begin
 perform set_config('test.user',u::text,true); perform set_config('test.tenant',t::text,true);
 insert into public.expenses values(e,t,null);
 select * into r1 from public.reserve_document_upload('expense',e,'receipt',null,'factura.pdf','application/pdf',100,k);
 select * into r2 from public.reserve_document_upload('expense',e,'receipt',null,'factura.pdf','application/pdf',100,k);
 if r1.intent_id<>r2.intent_id or r1.object_key not like t::text||'/expense/'||e::text||'/%' then raise exception '0309: reserva no idempotente/canónica'; end if;
 insert into storage.objects values(r1.bucket_id,r1.object_key);
 d:=public.finalize_document_upload(r1.intent_id,100);
 if d<>r1.document_id or not exists(select 1 from public.document_scan_outbox where document_id=d) then raise exception '0309: finalize no fue atómico'; end if;
 begin perform public.reserve_document_upload('expense','55555555-5555-4555-8555-555555555555','receipt',null,'x.pdf','application/pdf',1,extensions.gen_random_uuid());
   raise exception '0309: aceptó entidad ajena'; exception when no_data_found then null; end;
end $$;
rollback;

