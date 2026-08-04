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
\ir ../migrations/0346_r2_bucket_lock_backup_receipts.sql

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.complete_document_backup(bigint,text,text,text,text,text,timestamptz)'::regprocedure)
    into v_definition;
  if position('R2_BUCKET_LOCK' in v_definition) = 0 then
    raise exception 'complete_document_backup no acepta recibos R2 Bucket Lock';
  end if;
  if position('receipt_id' in v_definition) = 0 then
    raise exception 'la auditoría no identifica el valor como receipt_id';
  end if;
  if has_function_privilege('authenticated',
      'public.complete_document_backup(bigint,text,text,text,text,text,timestamptz)', 'EXECUTE') then
    raise exception 'authenticated no debe completar respaldos';
  end if;
  if not has_function_privilege('service_role',
      'public.complete_document_backup(bigint,text,text,text,text,text,timestamptz)', 'EXECUTE') then
    raise exception 'service_role debe completar respaldos';
  end if;
end;
$$;

do $$
declare
  v_tenant uuid := '11111111-1111-4111-8111-111111111111';
  v_document uuid := '22222222-2222-4222-8222-222222222222';
  v_job bigint;
begin
  perform set_config('test.role', 'service_role', true);
  insert into public.tenants values (v_tenant);
  insert into public.documents(id, tenant_id, scan_status, sha256, backup_status, attachment_status)
    values (v_document, v_tenant, 'clean', repeat('a', 64), 'pending', 'disponible');
  insert into public.document_backup_outbox(document_id, tenant_id) values (v_document, v_tenant);
  select id into v_job from public.claim_document_backup_jobs('r2-test', 1);
  perform public.complete_document_backup(
    v_job, 'cloudflare-r2', 'dtdcargo/test', 'etag:abc123', repeat('a', 64),
    'R2_BUCKET_LOCK', now() + interval '10 years 1 day'
  );
  if not exists (
    select 1 from public.documents
    where id = v_document and attachment_status = 'protegido'
      and backup_provider = 'cloudflare-r2'
      and backup_version_id = 'etag:abc123'
      and backup_lock_mode = 'R2_BUCKET_LOCK'
  ) then
    raise exception '0346: no persistió el recibo R2 esperado';
  end if;
end;
$$;

rollback;
