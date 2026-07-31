\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth;
create function auth.role() returns text language sql stable as $$ select current_setting('test.role',true) $$;
create type public.document_entity_type as enum('expense');
create table public.tenants(id uuid primary key);
create table public.documents(
 id uuid primary key,tenant_id uuid references public.tenants,entity_type public.document_entity_type,entity_id uuid,
 sha256 text,canonical_mime text,scan_status text,attachment_status text,backup_status text,quarantine_until timestamptz
);
create table public.expenses(id uuid primary key,tenant_id uuid,receipt_document_id uuid,deleted_at timestamptz);
create table public.document_backup_outbox(document_id uuid unique,tenant_id uuid);
create function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
returns uuid language sql as $$ select $3 $$;
\ir ../migrations/0311_document_scan_outbox.sql
do $$ declare
 t uuid='11111111-1111-4111-8111-111111111111'; d uuid='22222222-2222-4222-8222-222222222222';
 e uuid='33333333-3333-4333-8333-333333333333'; j bigint;
begin
 perform set_config('test.role','service_role',true);
 insert into public.tenants values(t); insert into public.expenses values(e,t,null,null);
 insert into public.documents values(d,t,'expense',e,null,null,'pending','verificando','pending',null);
 insert into public.document_scan_outbox(document_id,tenant_id) values(d,t);
 select id into j from public.claim_document_scan_jobs('test',1);
 perform public.complete_document_scan(j,repeat('a',64),'application/pdf',true,null);
 if (select scan_status from public.documents where id=d)<>'clean' then raise exception '0311: no marcó clean'; end if;
 if not exists(select 1 from public.document_backup_outbox where document_id=d) then raise exception '0311: no encoló backup'; end if;
 if (select receipt_document_id from public.expenses where id=e)<>d then raise exception '0311: no enlazó gasto'; end if;
end $$;
rollback;
