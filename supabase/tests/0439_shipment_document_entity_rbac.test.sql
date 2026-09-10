\set ON_ERROR_STOP on
-- SDD-0407: PostgreSQL local; tenants, equipo y cliente Portal sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN predeterminado: aplica 0439 y valida Hub + legado + Portal + Storage.
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
create table public.studio_role_module_overrides (
  tenant_id uuid not null,
  role text not null,
  module_id text not null,
  can_view boolean not null,
  can_edit boolean not null,
  primary key (tenant_id, role, module_id)
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text not null,
  deleted_at timestamptz
);
create table public.client_users (
  auth_user_id uuid not null,
  client_id uuid not null,
  tenant_id uuid not null,
  status text not null
);
create table public.shipments (
  id uuid primary key,
  tenant_id uuid not null,
  client_markbox text,
  deleted_at timestamptz
);
create table public.shipment_documents (
  id uuid primary key,
  tenant_id uuid not null,
  shipment_id uuid not null,
  client_markbox text,
  file_name text not null,
  storage_path text not null,
  deleted_at timestamptz
);
create table public.documents (
  id uuid primary key,
  tenant_id uuid not null,
  entity_type text not null,
  name text not null,
  deleted_at timestamptz
);
create table storage.objects (
  id uuid primary key,
  bucket_id text not null,
  name text not null unique
);

-- Estado posterior a 0438: expense conoce su módulo; shipment aún cae en true.
create function public.document_entity_authorized(
  p_entity_type text, p_tenant_id uuid, p_access text
) returns boolean
language sql stable security definer set search_path = '' as $$
  with membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id and ut.disabled_at is null
    limit 1
  ), decision as (
    select m.role, o.can_view, o.can_edit
    from membership m
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = 'expenses'
  )
  select coalesce((
    select case
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, '')))
           not in ('view', 'edit') then false
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) in (
        'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and d.role = 'admin' then true
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and pg_catalog.lower(pg_catalog.btrim(p_access)) = 'view' then
        coalesce(d.can_view, d.role in ('accounting', 'operations', 'warehouse'))
      when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'expense'
           and pg_catalog.lower(pg_catalog.btrim(p_access)) = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role in ('accounting', 'operations', 'warehouse'))
      else true
    end from decision d
  ), false)
$$;
comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0406: autorización documental tenant-aware. Tipos financieros permanecen accounting/admin; expense replica vista/edición y overrides del módulo expenses, incluido support read-only.';
revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.document_entity_authorized(
    p_entity_type, (select public.get_user_tenant_id()), 'view'
  )
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0406: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

grant select, insert, update on public.documents to authenticated;
grant select, insert, update, delete on public.shipment_documents to authenticated;
grant select on public.clients, public.client_users, public.shipments to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant all on all tables in schema public, storage to service_role;

alter table public.documents enable row level security;
alter table public.shipment_documents enable row level security;
alter table storage.objects enable row level security;

create policy "documents by tenant read" on public.documents for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type, tenant_id, 'view')
  );
create policy "documents by tenant insert" on public.documents for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type, tenant_id, 'edit')
  );
create policy "documents by tenant update" on public.documents for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type, tenant_id, 'edit')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_authorized(entity_type, tenant_id, 'edit')
  );
create policy "documents service_role all" on public.documents for all to service_role
  using (true) with check (true);

create policy "shipment_documents by tenant"
  on public.shipment_documents for all to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id()) and deleted_at is null
  )
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "shipment_documents portal self read"
  on public.shipment_documents for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          and c.deleted_at is null
      join public.shipments s
        on s.tenant_id = cu.tenant_id and s.client_markbox = c.markbox
          and s.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and s.id = shipment_documents.shipment_id
        and s.tenant_id = shipment_documents.tenant_id
        and s.client_markbox = shipment_documents.client_markbox
    )
  );

create policy "shipment-docs service_role all"
  on storage.objects for all to service_role
  using (bucket_id = 'shipment-docs') with check (bucket_id = 'shipment-docs');
create policy "shipment-docs tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
  );
create policy "shipment-docs tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
  );
create policy "shipment-docs tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
  );

insert into public.user_tenants values
  ('aaaaaaaa-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4390-4000-8000-000000000002', '10000000-4390-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4390-4000-8000-000000000003', '10000000-4390-4000-8000-000000000001', 'operations', null),
  ('aaaaaaaa-4390-4000-8000-000000000004', '10000000-4390-4000-8000-000000000001', 'support', null),
  ('aaaaaaaa-4390-4000-8000-000000000005', '10000000-4390-4000-8000-000000000001', 'marketing', null),
  ('aaaaaaaa-4390-4000-8000-000000000006', '10000000-4390-4000-8000-000000000001', 'operations', now()),
  ('bbbbbbbb-4390-4000-8000-000000000001', '20000000-4390-4000-8000-000000000002', 'operations', null);

insert into public.clients values
  ('71000000-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', 'DTD-4391', null);
insert into public.client_users values
  ('cccccccc-4390-4000-8000-000000000001', '71000000-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', 'active');
insert into public.shipments values
  ('72000000-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', 'DTD-4391', null),
  ('72000000-4390-4000-8000-000000000002', '20000000-4390-4000-8000-000000000002', 'DTD-OTHER', null);
insert into public.shipment_documents values
  ('31000000-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', '72000000-4390-4000-8000-000000000001', 'DTD-4391', 'bl-a.pdf', '10000000-4390-4000-8000-000000000001/72000000-4390-4000-8000-000000000001/31000000-4390-4000-8000-000000000001.pdf', null),
  ('31000000-4390-4000-8000-000000000002', '20000000-4390-4000-8000-000000000002', '72000000-4390-4000-8000-000000000002', 'DTD-OTHER', 'bl-b.pdf', '20000000-4390-4000-8000-000000000002/72000000-4390-4000-8000-000000000002/31000000-4390-4000-8000-000000000002.pdf', null);
insert into public.documents values
  ('41000000-4390-4000-8000-000000000001', '10000000-4390-4000-8000-000000000001', 'shipment', 'hub-bl-a.pdf', null),
  ('41000000-4390-4000-8000-000000000002', '10000000-4390-4000-8000-000000000001', 'expense', 'gasto-a.pdf', null),
  ('41000000-4390-4000-8000-000000000003', '10000000-4390-4000-8000-000000000001', 'invoice', 'factura-a.pdf', null),
  ('41000000-4390-4000-8000-000000000004', '20000000-4390-4000-8000-000000000002', 'shipment', 'hub-bl-b.pdf', null);
insert into storage.objects values
  ('51000000-4390-4000-8000-000000000001', 'shipment-docs', '10000000-4390-4000-8000-000000000001/72000000-4390-4000-8000-000000000001/51000000-4390-4000-8000-000000000001.pdf'),
  ('51000000-4390-4000-8000-000000000002', 'shipment-docs', '20000000-4390-4000-8000-000000000002/72000000-4390-4000-8000-000000000002/51000000-4390-4000-8000-000000000002.pdf');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000005';
do $historical_bug$
begin
  if (select count(*) from public.documents where entity_type = 'shipment') <> 1
     or (select count(*) from public.shipment_documents) <> 1
     or (select count(*) from storage.objects) <> 1
     or not public.document_entity_authorized(
       'shipment', '10000000-4390-4000-8000-000000000001', 'edit'
     ) then
    raise exception 'TEST 0439: no reprodujo la apertura de Tracking para marketing';
  end if;
  raise notice 'TEST 0439 RED baseline: marketing ve y muta ambas familias de documentos';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0439_shipment_document_entity_rbac.sql
\endif

do $catalog_contract$
declare v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_definition;
  if pg_catalog.obj_description(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure,
    'pg_proc'
  ) not like 'SDD-0407:%'
     or v_definition not like '%''tracking''%'
     or v_definition not like '%''shipment''%'
     or v_definition not like '%d.role <> ''support''%' then
    raise exception 'TEST 0439: helper no refleja Tracking';
  end if;
  if (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and policyname like 'shipment_documents by tenant %'
      and coalesce(qual, with_check) like '%document_entity_authorized%'
  ) <> 4 then
    raise exception 'TEST 0439: policies internas no separan vista/edición';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'shipment_documents'
      and policyname = 'shipment_documents portal self read'
      and qual like '%client_users%' and qual like '%auth.uid()%'
  ) then
    raise exception 'TEST 0439: policy Portal desapareció';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000005';
do $marketing_default$
begin
  if (select count(*) from public.documents where entity_type = 'shipment') <> 0
     or (select count(*) from public.shipment_documents) <> 0
     or (select count(*) from storage.objects) <> 0
     or public.document_entity_authorized(
       'shipment', '10000000-4390-4000-8000-000000000001', 'view'
     ) then
    raise exception 'TEST 0439: marketing conserva acceso default a Tracking';
  end if;
end;
$marketing_default$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000004';
do $support_read_only$
declare v_rows bigint;
begin
  if (select count(*) from public.documents where entity_type = 'shipment') <> 1
     or (select count(*) from public.shipment_documents) <> 1
     or (select count(*) from storage.objects) <> 1 then
    raise exception 'TEST 0439: support perdió lectura de Tracking';
  end if;
  update public.documents set name = 'forjado.pdf'
  where id = '41000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0439: support mutó Hub'; end if;
  update public.shipment_documents set file_name = 'forjado.pdf'
  where id = '31000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0439: support mutó tabla legacy'; end if;
  delete from storage.objects
  where id = '51000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0439: support borró binario'; end if;
end;
$support_read_only$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000002';
do $accounting$
declare v_rows bigint;
begin
  update public.documents set name = 'hub-accounting.pdf'
  where id = '41000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0439: accounting no editó Hub'; end if;
  update public.shipment_documents set file_name = 'legacy-accounting.pdf'
  where id = '31000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0439: accounting no editó legado'; end if;
  if not public.document_entity_authorized(
    'expense', '10000000-4390-4000-8000-000000000001', 'edit'
  ) or not public.document_entity_authorized(
    'invoice', '10000000-4390-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0439: el slice rompió expense o tipos financieros';
  end if;
end;
$accounting$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4390-4000-8000-000000000001', 'marketing', 'tracking', true, true),
  ('10000000-4390-4000-8000-000000000001', 'support', 'tracking', true, true),
  ('10000000-4390-4000-8000-000000000001', 'operations', 'tracking', false, false);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000005';
do $marketing_override$
declare v_rows bigint;
begin
  update public.documents set name = 'hub-marketing.pdf'
  where id = '41000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0439: override no abrió Hub'; end if;
  update public.shipment_documents set file_name = 'legacy-marketing.pdf'
  where id = '31000000-4390-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0439: override no abrió legado'; end if;
end;
$marketing_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000004';
do $support_override$
begin
  if not public.document_entity_authorized(
    'shipment', '10000000-4390-4000-8000-000000000001', 'view'
  ) or public.document_entity_authorized(
    'shipment', '10000000-4390-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0439: override rompió support read-only';
  end if;
end;
$support_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000003';
do $operations_denied$
begin
  if (select count(*) from public.documents where entity_type = 'shipment') <> 0
     or (select count(*) from public.shipment_documents) <> 0
     or public.document_entity_authorized(
       'shipment', '10000000-4390-4000-8000-000000000001', 'view'
     ) then
    raise exception 'TEST 0439: override negativo no cerró operations';
  end if;
end;
$operations_denied$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000006';
do $disabled$
begin
  if public.document_entity_authorized(
    'shipment', '10000000-4390-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0439: usuario desactivado conserva Tracking';
  end if;
end;
$disabled$;

set local "request.jwt.claim.sub" = 'cccccccc-4390-4000-8000-000000000001';
do $portal$
begin
  if (select count(*) from public.shipment_documents) <> 1
     or (select count(*) from public.documents) <> 0
     or (select count(*) from storage.objects) <> 0 then
    raise exception 'TEST 0439: lectura Portal cambió o ganó acceso directo indebido';
  end if;
end;
$portal$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4390-4000-8000-000000000005';
do $cross_tenant$
begin
  if public.document_entity_authorized(
    'shipment', '20000000-4390-4000-8000-000000000002', 'view'
  ) then
    raise exception 'TEST 0439: helper aceptó tenant inyectado';
  end if;
end;
$cross_tenant$;
reset role;

set local role service_role;
do $service$
begin
  if (select count(*) from public.shipment_documents) <> 2
     or (select count(*) from public.documents) <> 4
     or (select count(*) from storage.objects) <> 2 then
    raise exception 'TEST 0439: service_role perdió el flujo operativo';
  end if;
end;
$service$;
reset role;

rollback;
select pg_catalog.to_regprocedure(
  'public.document_entity_authorized(text,uuid,text)'
) is null as shipment_document_entity_rbac_0439_fixture_rolled_back;
