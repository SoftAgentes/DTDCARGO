\set ON_ERROR_STOP on
-- SDD-0406: PostgreSQL local; identidades, tenants y documentos sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN predeterminado: aplica 0438 y valida vista/edición + overrides.
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
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

create type public.document_entity_type as enum (
  'shipment', 'invoice', 'supplier_bill', 'supplier_payment',
  'journal_entry', 'expense', 'none'
);
create table public.documents (
  id uuid primary key,
  tenant_id uuid not null,
  entity_type public.document_entity_type not null,
  entity_id uuid,
  name text not null,
  storage_path text not null unique,
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

-- Estado exacto posterior a 0437: cuatro tipos financieros cerrados; expense
-- todavía cae en el `else true` y no conoce vista/edición ni overrides.
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) in (
      'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry'
    ) then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0405: autorización documental incremental. invoice, supplier_bill, supplier_payment y journal_entry heredan sus módulos financieros (accounting/admin); los demás tipos conservan su alcance previo.';
revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;

create function public.enforce_document_entity_rbac()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated'
     and not public.document_entity_allowed_for_current_role(new.entity_type::text) then
    raise exception 'rol sin permiso para documentos de entidad %', new.entity_type
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create function public.enforce_document_upload_intent_entity_rbac()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated'
     and not public.document_entity_allowed_for_current_role(new.entity_type) then
    raise exception 'rol sin permiso para reserva' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create function public.enforce_document_restore_entity_rbac()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.tenant_id = new.tenant_id
      and public.document_entity_allowed_for_current_role(d.entity_type::text)
  ) then
    raise exception 'rol sin permiso para restaurar' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger documents_entity_rbac_guard_trg
  before insert or update on public.documents
  for each row execute function public.enforce_document_entity_rbac();
create trigger document_upload_intents_entity_rbac_guard_trg
  before insert or update on public.document_upload_intents
  for each row execute function public.enforce_document_upload_intent_entity_rbac();
create trigger document_restore_entity_rbac_guard_trg
  before insert or update on public.document_restore_outbox
  for each row execute function public.enforce_document_restore_entity_rbac();

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
  values (p_document_id, p_tenant_id, p_requested_by, 'restauración sintética')
$$;

grant select, insert, update on public.documents to authenticated;
revoke delete on public.documents from public, anon, authenticated;
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
  using (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_allowed_for_current_role(entity_type::text)
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and public.document_entity_allowed_for_current_role(entity_type::text)
  );
create policy "documents service_role all" on public.documents for all to service_role
  using (true) with check (true);
create policy "document upload intents own tenant read"
  on public.document_upload_intents for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and public.document_entity_allowed_for_current_role(entity_type)
  );
create policy "document upload intents service role all"
  on public.document_upload_intents for all to service_role
  using (true) with check (true);
create policy "document restore requester read"
  on public.document_restore_outbox for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and requested_by = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_restore_outbox.document_id
        and d.tenant_id = document_restore_outbox.tenant_id
        and public.document_entity_allowed_for_current_role(d.entity_type::text)
    )
  );
create policy "document restore outbox service role all"
  on public.document_restore_outbox for all to service_role
  using (true) with check (true);
create policy "documents service_role all storage"
  on storage.objects for all to service_role
  using (bucket_id = 'documents') with check (bucket_id = 'documents');
create policy "documents tenant insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );
create policy "documents tenant read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );
create policy "documents tenant delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_allowed_for_current_role(
      coalesce((storage.foldername(name))[2], '')
    )
  );

insert into public.user_tenants values
  ('aaaaaaaa-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4380-4000-8000-000000000002', '10000000-4380-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4380-4000-8000-000000000003', '10000000-4380-4000-8000-000000000001', 'operations', null),
  ('aaaaaaaa-4380-4000-8000-000000000004', '10000000-4380-4000-8000-000000000001', 'warehouse', null),
  ('aaaaaaaa-4380-4000-8000-000000000005', '10000000-4380-4000-8000-000000000001', 'commercial', null),
  ('aaaaaaaa-4380-4000-8000-000000000006', '10000000-4380-4000-8000-000000000001', 'support', null),
  ('aaaaaaaa-4380-4000-8000-000000000007', '10000000-4380-4000-8000-000000000001', 'accounting', now()),
  ('bbbbbbbb-4380-4000-8000-000000000001', '20000000-4380-4000-8000-000000000002', 'accounting', null);

insert into public.documents values
  ('31000000-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'expense',  '41000000-4380-4000-8000-000000000001', 'recibo.pdf',  '10000000-4380-4000-8000-000000000001/expense/41000000-4380-4000-8000-000000000001/31000000-4380-4000-8000-000000000001.pdf', null),
  ('32000000-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'invoice',  '42000000-4380-4000-8000-000000000001', 'factura.pdf', '10000000-4380-4000-8000-000000000001/invoice/42000000-4380-4000-8000-000000000001/32000000-4380-4000-8000-000000000001.pdf', null),
  ('33000000-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'shipment', '43000000-4380-4000-8000-000000000001', 'bl.pdf',      '10000000-4380-4000-8000-000000000001/shipment/43000000-4380-4000-8000-000000000001/33000000-4380-4000-8000-000000000001.pdf', null),
  ('34000000-4380-4000-8000-000000000001', '20000000-4380-4000-8000-000000000002', 'expense',  '44000000-4380-4000-8000-000000000001', 'otro.pdf',    '20000000-4380-4000-8000-000000000002/expense/44000000-4380-4000-8000-000000000001/34000000-4380-4000-8000-000000000001.pdf', null);
insert into public.document_upload_intents values
  ('51000000-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'aaaaaaaa-4380-4000-8000-000000000005', '31000000-4380-4000-8000-000000000001', 'expense', 'reserved');
insert into public.document_restore_outbox(document_id, tenant_id, requested_by, reason) values
  ('31000000-4380-4000-8000-000000000001', '10000000-4380-4000-8000-000000000001', 'aaaaaaaa-4380-4000-8000-000000000005', 'restaurar recibo');
insert into storage.objects values
  ('61000000-4380-4000-8000-000000000001', 'documents', '10000000-4380-4000-8000-000000000001/expense/41000000-4380-4000-8000-000000000001/31000000-4380-4000-8000-000000000001.pdf'),
  ('62000000-4380-4000-8000-000000000001', 'documents', '10000000-4380-4000-8000-000000000001/invoice/42000000-4380-4000-8000-000000000001/32000000-4380-4000-8000-000000000001.pdf'),
  ('63000000-4380-4000-8000-000000000001', 'documents', '10000000-4380-4000-8000-000000000001/shipment/43000000-4380-4000-8000-000000000001/33000000-4380-4000-8000-000000000001.pdf'),
  ('64000000-4380-4000-8000-000000000001', 'documents', '20000000-4380-4000-8000-000000000002/expense/44000000-4380-4000-8000-000000000001/34000000-4380-4000-8000-000000000001.pdf');

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000005';
do $historical_bug$
begin
  if (select count(*) from public.documents where entity_type = 'expense') <> 1
     or (select count(*) from storage.objects where name like '%/expense/%') <> 1
     or (select count(*) from public.document_upload_intents where entity_type = 'expense') <> 1
     or (select count(*) from public.document_restore_outbox) <> 1 then
    raise exception 'TEST 0438: no reprodujo la apertura tenant-wide de gastos';
  end if;
  if not public.document_entity_allowed_for_current_role('expense') then
    raise exception 'TEST 0438: baseline previo no coincide con 0437';
  end if;
  raise notice 'TEST 0438 RED baseline: commercial ve y puede mutar documentos de gastos';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0438_expense_document_entity_rbac.sql
\endif

do $catalog_contract$
declare v_definition text;
begin
  if pg_catalog.to_regprocedure(
    'public.document_entity_authorized(text,uuid,text)'
  ) is null then
    raise exception 'TEST 0438: falta helper tenant-aware';
  end if;
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_definition;
  if v_definition not like '%SECURITY DEFINER%'
     or v_definition not like '%studio_role_module_overrides%'
     or v_definition not like '%''expenses''%'
     or v_definition not like '%d.role <> ''support''%' then
    raise exception 'TEST 0438: helper no replica el contrato de Gastos';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(p.proacl) a
    where p.oid = 'public.document_entity_authorized(text,uuid,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) or has_function_privilege(
    'anon', 'public.document_entity_authorized(text,uuid,text)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.document_entity_authorized(text,uuid,text)', 'EXECUTE'
  ) then
    raise exception 'TEST 0438: grants del helper inseguros o incompletos';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname in ('public', 'storage')
      and concat_ws(' ', qual, with_check)
        like '%document_entity_allowed_for_current_role%'
  ) then
    raise exception 'TEST 0438: una policy conserva el helper sin acción';
  end if;
end;
$catalog_contract$;

-- Default: commercial queda fuera de gastos, pero conserva tipos no sensibles.
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000005';
do $commercial_default$
declare v_rows bigint; v_blocked boolean;
begin
  if (select count(*) from public.documents where entity_type = 'expense') <> 0
     or (select count(*) from storage.objects where name like '%/expense/%') <> 0
     or (select count(*) from public.document_upload_intents) <> 0
     or (select count(*) from public.document_restore_outbox) <> 0 then
    raise exception 'TEST 0438: commercial conserva una superficie de gastos';
  end if;
  if (select count(*) from public.documents where entity_type = 'shipment') <> 1 then
    raise exception 'TEST 0438: commercial perdió un tipo no restringido';
  end if;
  update public.documents set name = 'forjado.pdf'
  where id = '31000000-4380-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0438: commercial actualizó gasto'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_update_document(
      '31000000-4380-4000-8000-000000000001', 'forjado-rpc.pdf'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0438: guard permitió RPC de gasto'; end if;

  if public.document_entity_authorized(
    'expense', '20000000-4380-4000-8000-000000000002', 'view'
  ) then
    raise exception 'TEST 0438: helper aceptó tenant inyectado';
  end if;
end;
$commercial_default$;
reset role;

-- Override read-only: puede leer el Hub/colas/binario, pero ninguna mutación.
insert into public.studio_role_module_overrides values
  ('10000000-4380-4000-8000-000000000001', 'commercial', 'expenses', true, false);
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000005';
do $commercial_read_only$
declare v_rows bigint; v_blocked boolean;
begin
  if (select count(*) from public.documents where entity_type = 'expense') <> 1
     or (select count(*) from storage.objects where name like '%/expense/%') <> 1
     or (select count(*) from public.document_upload_intents) <> 1
     or (select count(*) from public.document_restore_outbox) <> 1 then
    raise exception 'TEST 0438: override can_view no abrió todas las lecturas';
  end if;
  update public.documents set name = 'forjado.pdf'
  where id = '31000000-4380-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0438: can_view habilitó update'; end if;
  delete from storage.objects
  where id = '61000000-4380-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 0438: can_view habilitó delete del binario'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_reauthorize_intent(
      '51000000-4380-4000-8000-000000000001'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0438: can_view reautorizó reserva'; end if;

  v_blocked := false;
  begin
    perform public.fixture_definer_request_restore(
      '31000000-4380-4000-8000-000000000001',
      '10000000-4380-4000-8000-000000000001',
      'aaaaaaaa-4380-4000-8000-000000000005'
    );
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0438: can_view pidió restauración'; end if;
end;
$commercial_read_only$;
reset role;

-- can_edit explícito habilita el flujo completo para commercial.
update public.studio_role_module_overrides
set can_edit = true
where tenant_id = '10000000-4380-4000-8000-000000000001'
  and role = 'commercial' and module_id = 'expenses';
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000005';
do $commercial_edit$
declare v_rows bigint;
begin
  update public.documents set name = 'recibo-autorizado.pdf'
  where id = '31000000-4380-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'TEST 0438: can_edit no habilitó update'; end if;
  perform public.fixture_definer_update_document(
    '31000000-4380-4000-8000-000000000001', 'recibo-rpc-autorizado.pdf'
  );
  perform public.fixture_definer_reauthorize_intent(
    '51000000-4380-4000-8000-000000000001'
  );
  perform public.fixture_definer_request_restore(
    '31000000-4380-4000-8000-000000000001',
    '10000000-4380-4000-8000-000000000001',
    'aaaaaaaa-4380-4000-8000-000000000005'
  );
end;
$commercial_edit$;
reset role;

-- support puede recibir vista por override, pero nunca edición.
insert into public.studio_role_module_overrides values
  ('10000000-4380-4000-8000-000000000001', 'support', 'expenses', true, true);
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000006';
do $support_invariant$
begin
  if not public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'view'
  ) or public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0438: support no conserva el invariante read-only';
  end if;
end;
$support_invariant$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000002';
do $accounting$
begin
  if not public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'edit'
  ) or not public.document_entity_authorized(
    'invoice', '10000000-4380-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0438: accounting perdió gasto o factura';
  end if;
end;
$accounting$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000003';
do $operations_default$
begin
  if not public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'edit'
  ) or public.document_entity_authorized(
    'invoice', '10000000-4380-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0438: defaults de operations o candado financiero cambiaron';
  end if;
end;
$operations_default$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000007';
do $disabled$
begin
  if public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'view'
  ) or public.document_entity_authorized(
    'shipment', '10000000-4380-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0438: usuario desactivado conserva autorización';
  end if;
end;
$disabled$;
reset role;

-- Un override negativo debe poder cerrar un default habilitado.
insert into public.studio_role_module_overrides values
  ('10000000-4380-4000-8000-000000000001', 'operations', 'expenses', false, false);
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'aaaaaaaa-4380-4000-8000-000000000003';
do $operations_denied$
begin
  if public.document_entity_authorized(
    'expense', '10000000-4380-4000-8000-000000000001', 'view'
  ) or (select count(*) from public.documents where entity_type = 'expense') <> 0 then
    raise exception 'TEST 0438: override negativo no cerró operations';
  end if;
end;
$operations_denied$;
reset role;

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';
do $service$
begin
  if (select count(*) from public.documents) <> 4
     or (select count(*) from storage.objects) <> 4 then
    raise exception 'TEST 0438: service_role perdió el flujo operativo';
  end if;
end;
$service$;
reset role;

rollback;
select pg_catalog.to_regprocedure(
  'public.document_entity_authorized(text,uuid,text)'
) is null as expense_document_entity_rbac_0438_fixture_rolled_back;
