\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.user',true)::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('test.role',true) $$;
create function public.get_user_tenant_id() returns uuid language sql stable as $$ select current_setting('test.tenant',true)::uuid $$;
create table public.tenants(id uuid primary key);
create table public.documents(
 id uuid primary key,tenant_id uuid references public.tenants,created_at timestamptz default now(),retention_class text,
 deleted_at timestamptz,deleted_by uuid,deletion_reason text,attachment_status text,is_current boolean,
 backup_status text,backup_version_id text,sha256 text,backup_sha256 text
);
create function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
returns uuid language sql as $$ select $3 $$;
\ir ../migrations/0313_document_restore_retention.sql
do $$ declare
 t uuid='11111111-1111-4111-8111-111111111111'; u uuid='22222222-2222-4222-8222-222222222222';
 d uuid='33333333-3333-4333-8333-333333333333'; j bigint;
begin
 perform set_config('test.tenant',t::text,true); perform set_config('test.user',u::text,true);
 insert into public.tenants values(t); insert into auth.users values(u);
 insert into public.documents(id,tenant_id,retention_class,attachment_status,is_current,backup_status,backup_version_id,sha256,backup_sha256)
 values(d,t,'financial','protegido',true,'verified','v1',repeat('a',64),repeat('a',64));
 perform public.soft_delete_document(d,'Prueba de borrado lógico');
 if (select deleted_at is null from public.documents where id=d) then raise exception '0313: no soft-delete'; end if;
 j:=public.request_document_restore(d,'Prueba controlada de restore');
 perform set_config('test.role','service_role',true);
 if (select count(*) from public.claim_document_restore_jobs('test',1))<>1 then raise exception '0313: no reclamó restore'; end if;
 perform public.complete_document_restore(j,repeat('a',64));
 if (select restored_at is null from public.documents where id=d) then raise exception '0313: no registró restore'; end if;
end $$;
rollback;
