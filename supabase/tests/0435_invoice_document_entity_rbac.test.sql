\set ON_ERROR_STOP on
-- SDD-0403: PostgreSQL local, identidades y documentos exclusivamente sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN por defecto: aplica 0435; apply_fix=false conserva la fuga histórica.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;

create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')
$$;
create function storage.foldername(p_name text) returns text[]
language sql immutable set search_path = '' as $$
  select case
    when pg_catalog.array_length(pg_catalog.string_to_array(p_name, '/'), 1) > 1
      then (pg_catalog.string_to_array(p_name, '/'))[
        1:pg_catalog.array_length(pg_catalog.string_to_array(p_name, '/'), 1) - 1
      ]
    else array[]::text[]
  end
$$;

create table public.user_tenants (
  user_id uuid primary key,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

create type public.document_entity_type as enum ('shipment', 'invoice', 'none');
create table public.documents (
  id uuid primary key,
  tenant_id uuid not null,
  entity_type public.document_entity_type not null,
  entity_id uuid,
  name text not null,
  storage_path text not null unique,
  is_current boolean not null default true,
  deleted_at timestamptz
);
create table public.document_upload_intents (
  id uuid primary key,
  tenant_id uuid not null,
  user_id uuid not null,
  document_id uuid not null,
  entity_type text not null,
  status text not null default 'reserved'
);
create table public.document_restore_outbox (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id),
  tenant_id uuid not null,
  requested_by uuid not null,
  reason text not null
);
create table storage.objects (
  id uuid primary key,
  bucket_id text not null,
  name text not null unique
);

-- Dobles mínimos de las RPC SECURITY DEFINER reales: add/finalize version,
-- reauthorize_document_upload y request_document_restore. Permiten demostrar
-- que el guard se evalúa aun cuando el cuerpo privilegiado salta RLS.
create function public.fixture_definer_update_document(p_id uuid, p_name text)
returns void language sql security definer set search_path = '' as $$
  update public.documents set name = p_name where id = p_id
$$;
create function public.fixture_definer_reauthorize_intent(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.document_upload_intents set status = 'uploading' where id = p_id
$$;
create function public.fixture_definer_request_restore(
  p_document_id uuid, p_tenant_id uuid, p_requested_by uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.document_restore_outbox(document_id, tenant_id, requested_by, reason)
  values (p_document_id, p_tenant_id, p_requested_by, 'restauración de prueba')
$$;

grant select, insert, update on public.documents to authenticated;
-- En producción estas dos tablas son SELECT-only para authenticated. Los grants
-- extra de este fixture permiten probar que los triggers también protegen a las
-- RPC SECURITY DEFINER que escriben como owner.
grant select, insert, update on public.document_upload_intents to authenticated;
grant select, insert on public.document_restore_outbox to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant execute on function public.fixture_definer_update_document(uuid,text),
  public.fixture_definer_reauthorize_intent(uuid),
  public.fixture_definer_request_restore(uuid,uuid,uuid) to authenticated;
grant all on all tables in schema public, storage to service_role;

alter table public.documents enable row level security;
alter table public.document_upload_intents enable row level security;
alter table public.document_restore_outbox enable row level security;
alter table storage.objects enable row level security;

create policy "documents by tenant" on public.documents for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "documents service_role all" on public.documents for all to service_role
  using (true) with check (true);

create policy "document upload intents own tenant read"
  on public.document_upload_intents for select to authenticated
  using (tenant_id = public.get_user_tenant_id() and user_id = auth.uid());
create policy "document upload intents service role all"
  on public.document_upload_intents for all to service_role
  using (true) with check (true);

create policy "document restore requester read"
  on public.document_restore_outbox for select to authenticated
  using (tenant_id = public.get_user_tenant_id() and requested_by = auth.uid());
create policy "document restore outbox service role all"
  on public.document_restore_outbox for all to service_role
  using (true) with check (true);

create policy "documents service_role all storage"
  on storage.objects for all to service_role
  using (bucket_id = 'documents') with check (bucket_id = 'documents');
create policy "documents tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );
create policy "documents tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );
create policy "documents tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

insert into public.user_tenants values
  ('aaaaaaaa-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4350-4000-8000-000000000002', '10000000-4350-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4350-4000-8000-000000000003', '10000000-4350-4000-8000-000000000001', 'commercial', null),
  ('aaaaaaaa-4350-4000-8000-000000000004', '10000000-4350-4000-8000-000000000001', 'accounting', now()),
  ('bbbbbbbb-4350-4000-8000-000000000001', '20000000-4350-4000-8000-000000000002', 'accounting', null);

insert into public.documents values
  ('31000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'invoice',  '41000000-4350-4000-8000-000000000001', 'factura-a.pdf', '10000000-4350-4000-8000-000000000001/invoice/41000000-4350-4000-8000-000000000001/31000000-4350-4000-8000-000000000001.pdf', true, null),
  ('32000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'shipment', '42000000-4350-4000-8000-000000000001', 'bl-a.pdf',      '10000000-4350-4000-8000-000000000001/shipment/42000000-4350-4000-8000-000000000001/32000000-4350-4000-8000-000000000001.pdf', true, null),
  ('33000000-4350-4000-8000-000000000001', '20000000-4350-4000-8000-000000000002', 'invoice',  '43000000-4350-4000-8000-000000000001', 'factura-b.pdf', '20000000-4350-4000-8000-000000000002/invoice/43000000-4350-4000-8000-000000000001/33000000-4350-4000-8000-000000000001.pdf', true, null);
insert into public.document_upload_intents values
  ('51000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'aaaaaaaa-4350-4000-8000-000000000003', '31000000-4350-4000-8000-000000000001', 'invoice', 'reserved'),
  ('52000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'aaaaaaaa-4350-4000-8000-000000000003', '32000000-4350-4000-8000-000000000001', 'shipment', 'reserved');
insert into public.document_restore_outbox(document_id, tenant_id, requested_by, reason) values
  ('31000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'aaaaaaaa-4350-4000-8000-000000000003', 'restaurar factura'),
  ('32000000-4350-4000-8000-000000000001', '10000000-4350-4000-8000-000000000001', 'aaaaaaaa-4350-4000-8000-000000000003', 'restaurar bl');
insert into storage.objects values
  ('61000000-4350-4000-8000-000000000001', 'documents', '10000000-4350-4000-8000-000000000001/invoice/41000000-4350-4000-8000-000000000001/31000000-4350-4000-8000-000000000001.pdf'),
  ('62000000-4350-4000-8000-000000000001', 'documents', '10000000-4350-4000-8000-000000000001/shipment/42000000-4350-4000-8000-000000000001/32000000-4350-4000-8000-000000000001.pdf'),
  ('63000000-4350-4000-8000-000000000001', 'documents', '20000000-4350-4000-8000-000000000002/invoice/43000000-4350-4000-8000-000000000001/33000000-4350-4000-8000-000000000001.pdf');

-- Fuga histórica: el rol comercial ve tanto el metadato como el binario, la
-- reserva y la restauración de una factura por compartir tenant.
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4350-4000-8000-000000000003';
do $historical_bug$
begin
  if (select count(*) from public.documents where entity_type = 'invoice') <> 1
     or (select count(*) from storage.objects where name like '%/invoice/%') <> 1
     or (select count(*) from public.document_upload_intents where entity_type = 'invoice') <> 1
     or (select count(*) from public.document_restore_outbox where document_id = '31000000-4350-4000-8000-000000000001') <> 1 then
    raise exception 'TEST 0435: no reprodujo la lectura tenant-wide de factura';
  end if;
  raise notice 'TEST 0435 RED baseline: commercial ve metadato, binario y colas de factura';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0435_invoice_document_entity_rbac.sql
\endif

do $catalog_contract$
begin
  if pg_catalog.to_regprocedure('public.document_entity_allowed_for_current_role(text)') is null then
    raise exception 'TEST 0435: falta el helper de autorización documental';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(p.proacl) a
    where p.oid = 'public.document_entity_allowed_for_current_role(text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) or has_function_privilege('anon', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE') then
    raise exception 'TEST 0435: grants inseguros del helper';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents by tenant' and cmd = 'ALL'
      and qual like '%document_entity_allowed_for_current_role%'
      and with_check like '%document_entity_allowed_for_current_role%'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'document_upload_intents'
      and policyname = 'document upload intents own tenant read'
      and qual like '%document_entity_allowed_for_current_role%'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'document_restore_outbox'
      and policyname = 'document restore requester read'
      and qual like '%document_entity_allowed_for_current_role%'
  ) then
    raise exception 'TEST 0435: policy pública sin autorización por entidad';
  end if;
  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('documents tenant insert', 'documents tenant read', 'documents tenant delete')
      and coalesce(qual, with_check) like '%document_entity_allowed_for_current_role%'
  ) <> 3 then
    raise exception 'TEST 0435: bucket documents sin autorización por entidad';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'documents_entity_rbac_guard_trg' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.document_upload_intents'::regclass
      and tgname = 'document_upload_intents_entity_rbac_guard_trg' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.document_restore_outbox'::regclass
      and tgname = 'document_restore_entity_rbac_guard_trg' and not tgisinternal
  ) then
    raise exception 'TEST 0435: faltan guards para RPC SECURITY DEFINER';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4350-4000-8000-000000000003';
do $commercial$
declare v_rows bigint; v_blocked boolean;
begin
  if (select count(*) from public.documents where entity_type = 'invoice') <> 0
     or (select count(*) from storage.objects where name like '%/invoice/%') <> 0
     or (select count(*) from public.document_upload_intents where entity_type = 'invoice') <> 0
     or (select count(*) from public.document_restore_outbox where document_id = '31000000-4350-4000-8000-000000000001') <> 0 then
    raise exception 'TEST 0435: commercial todavía lee una superficie de factura';
  end if;
  if (select count(*) from public.documents where entity_type = 'shipment') <> 1
     or (select count(*) from storage.objects where name like '%/shipment/%') <> 1
     or (select count(*) from public.document_upload_intents where entity_type = 'shipment') <> 1
     or (select count(*) from public.document_restore_outbox where document_id = '32000000-4350-4000-8000-000000000001') <> 1 then
    raise exception 'TEST 0435: el slice rompió documentos no financieros';
  end if;

  update public.documents set name = 'forjada.pdf'
  where id = '31000000-4350-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0435: commercial actualizó metadato de factura'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_update_document(
      '31000000-4350-4000-8000-000000000001', 'forjada-por-rpc.pdf'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0435: guard permitió mutación SECURITY DEFINER'; end if;

  v_blocked := false;
  begin
    insert into public.documents values (
      '31000000-4350-4000-8000-000000000099',
      '10000000-4350-4000-8000-000000000001', 'invoice',
      '41000000-4350-4000-8000-000000000001', 'forjada.pdf',
      '10000000-4350-4000-8000-000000000001/invoice/41000000-4350-4000-8000-000000000001/31000000-4350-4000-8000-000000000099.pdf', true, null
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0435: commercial insertó metadato de factura'; end if;

  v_blocked := false;
  begin
    insert into storage.objects values (
      '61000000-4350-4000-8000-000000000099', 'documents',
      '10000000-4350-4000-8000-000000000001/invoice/41000000-4350-4000-8000-000000000001/61000000-4350-4000-8000-000000000099.pdf'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0435: commercial subió binario de factura'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_reauthorize_intent(
      '51000000-4350-4000-8000-000000000001'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0435: guard permitió reautorizar reserva de factura'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_request_restore(
      '31000000-4350-4000-8000-000000000001',
      '10000000-4350-4000-8000-000000000001',
      'aaaaaaaa-4350-4000-8000-000000000003'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0435: guard permitió restauración de factura'; end if;
end;
$commercial$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4350-4000-8000-000000000002';
do $accounting$
declare v_rows bigint;
begin
  if (select count(*) from public.documents where entity_type = 'invoice') <> 1
     or (select count(*) from storage.objects where name like '%/invoice/%') <> 1 then
    raise exception 'TEST 0435: accounting perdió la factura de su tenant';
  end if;
  update public.documents set name = 'factura-contabilidad.pdf'
  where id = '31000000-4350-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0435: accounting no pudo actualizar'; end if;
  perform public.fixture_definer_update_document(
    '31000000-4350-4000-8000-000000000001', 'factura-rpc-contabilidad.pdf'
  );
  perform public.fixture_definer_reauthorize_intent(
    '51000000-4350-4000-8000-000000000001'
  );
  perform public.fixture_definer_request_restore(
    '31000000-4350-4000-8000-000000000001',
    '10000000-4350-4000-8000-000000000001',
    'aaaaaaaa-4350-4000-8000-000000000002'
  );
end;
$accounting$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4350-4000-8000-000000000004';
do $disabled$
begin
  if (select count(*) from public.documents) <> 0
     or (select count(*) from storage.objects) <> 0 then
    raise exception 'TEST 0435: usuario desactivado conservó acceso';
  end if;
end;
$disabled$;

set local "request.jwt.claim.sub" = 'bbbbbbbb-4350-4000-8000-000000000001';
do $cross_tenant$
begin
  if (select count(*) from public.documents) <> 1
     or (select count(*) from storage.objects) <> 1 then
    raise exception 'TEST 0435: accounting cruzó tenant o perdió su factura';
  end if;
end;
$cross_tenant$;
reset role;

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';
do $service$
begin
  if (select count(*) from public.documents) <> 3
     or (select count(*) from storage.objects) <> 3 then
    raise exception 'TEST 0435: service_role perdió el acceso operativo';
  end if;
end;
$service$;
reset role;

rollback;
select pg_catalog.to_regclass('public.documents') is null
  as invoice_document_entity_rbac_0435_fixture_rolled_back;
