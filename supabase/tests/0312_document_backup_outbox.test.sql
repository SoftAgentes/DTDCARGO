\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth;
create function auth.role() returns text language sql stable as $$ select current_setting('test.role',true) $$;
create table public.tenants(id uuid primary key);
create table public.documents(
 id uuid primary key,tenant_id uuid references public.tenants,scan_status text,sha256 text,backup_status text,
 attachment_status text,backed_up_at timestamptz
);
create function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
returns uuid language sql as $$ select $3 $$;
\ir ../migrations/0312_document_backup_outbox.sql
do $$ declare
 t uuid='11111111-1111-4111-8111-111111111111'; d uuid='22222222-2222-4222-8222-222222222222'; j bigint;
begin
 perform set_config('test.role','service_role',true); insert into public.tenants values(t);
 insert into public.documents(id,tenant_id,scan_status,sha256,backup_status,attachment_status) values(d,t,'clean',repeat('a',64),'pending','disponible');
 insert into public.document_backup_outbox(document_id,tenant_id) values(d,t);
 select id into j from public.claim_document_backup_jobs('test',1);
  begin perform public.complete_document_backup(j,'s3.test','key','version',repeat('b',64),'COMPLIANCE',now()+interval '11 years');
   raise exception '0312: aceptó checksum distinto'; exception when data_exception then null; end;
 begin perform public.complete_document_backup(j,'s3.test','key','version',repeat('a',64),'COMPLIANCE',now()+interval '1 year');
   raise exception '0312: aceptó retención insuficiente'; exception when object_not_in_prerequisite_state then null; end;
 perform public.complete_document_backup(j,'s3.test','key','version',repeat('a',64),'COMPLIANCE',now()+interval '11 years');
 if (select attachment_status from public.documents where id=d)<>'protegido' then raise exception '0312: protegió sin estado final'; end if;
end $$;
rollback;
