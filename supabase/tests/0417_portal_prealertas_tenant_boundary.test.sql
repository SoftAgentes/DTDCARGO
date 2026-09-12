\set ON_ERROR_STOP on
-- SDD-0361: PostgreSQL local, principals sintéticos y migraciones históricas reales.
-- RED: psql -v apply_fix=false -f este-archivo. No requiere que exista 0417.
-- GREEN por defecto: aplica 0417; apply_fix=false conserva el RED reproducible.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
-- 0080 crea una policy de envíos: stub de tabla, no sustituto de las RLS bajo prueba.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  client_markbox text, deleted_at timestamptz
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0105_portal_compras.sql
\ir ../migrations/0118_prealerta_documents.sql
\ir ../migrations/0229_suppliers_cn_operator_write.sql

insert into public.tenants values
  ('10000000-4170-0000-0000-000000000001'), ('20000000-4170-0000-0000-000000000002');
insert into auth.users (id) values
  ('aaaaaaaa-4170-0000-0000-000000000001'), -- equipo A
  ('aaaaaaaa-4170-0000-0000-000000000002'), -- equipo desactivado
  ('aaaaaaaa-4170-0000-0000-000000000101'), -- Portal A
  ('bbbbbbbb-4170-0000-0000-000000000101'), -- Portal B; después principal dual
  ('aaaaaaaa-4170-0000-0000-000000000102'), -- revocado
  ('aaaaaaaa-4170-0000-0000-000000000103'), -- cliente retirado
  ('aaaaaaaa-4170-0000-0000-000000000104'), -- client_users A apunta a cliente B
  ('aaaaaaaa-4170-0000-0000-000000000105'); -- invitado
insert into public.user_tenants values
  ('aaaaaaaa-4170-0000-0000-000000000001', '10000000-4170-0000-0000-000000000001', null),
  ('aaaaaaaa-4170-0000-0000-000000000002', '10000000-4170-0000-0000-000000000001', now());
insert into public.clients (id, tenant_id, markbox, deleted_at) values
  ('31000000-4170-0000-0000-000000000001', '10000000-4170-0000-0000-000000000001', 'DUP', null),
  ('31000000-4170-0000-0000-000000000002', '10000000-4170-0000-0000-000000000001', 'OTHER', null),
  ('31000000-4170-0000-0000-000000000003', '10000000-4170-0000-0000-000000000001', 'DEAD', now()),
  ('31000000-4170-0000-0000-000000000005', '10000000-4170-0000-0000-000000000001', 'INVITED', null),
  ('32000000-4170-0000-0000-000000000001', '20000000-4170-0000-0000-000000000002', 'DUP', null),
  ('32000000-4170-0000-0000-000000000002', '20000000-4170-0000-0000-000000000002', 'OTHER', null);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status) values
  ('aaaaaaaa-4170-0000-0000-000000000101', '10000000-4170-0000-0000-000000000001', '31000000-4170-0000-0000-000000000001', 'portal-a@example.invalid', 'active'),
  ('bbbbbbbb-4170-0000-0000-000000000101', '20000000-4170-0000-0000-000000000002', '32000000-4170-0000-0000-000000000001', 'portal-b@example.invalid', 'active'),
  ('aaaaaaaa-4170-0000-0000-000000000102', '10000000-4170-0000-0000-000000000001', '31000000-4170-0000-0000-000000000002', 'revoked@example.invalid', 'revoked'),
  ('aaaaaaaa-4170-0000-0000-000000000103', '10000000-4170-0000-0000-000000000001', '31000000-4170-0000-0000-000000000003', 'retired@example.invalid', 'active'),
  ('aaaaaaaa-4170-0000-0000-000000000104', '10000000-4170-0000-0000-000000000001', '32000000-4170-0000-0000-000000000002', 'incoherent@example.invalid', 'active'),
  ('aaaaaaaa-4170-0000-0000-000000000105', '10000000-4170-0000-0000-000000000001', '31000000-4170-0000-0000-000000000005', 'invited@example.invalid', 'invited');
insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name, deleted_at) values
  ('71000000-4170-0000-0000-000000000001', '10000000-4170-0000-0000-000000000001', 'DUP', 1, 'S-A1', null),
  ('71000000-4170-0000-0000-000000000002', '10000000-4170-0000-0000-000000000001', 'OTHER', 1, 'S-A2', null),
  ('71000000-4170-0000-0000-000000000003', '10000000-4170-0000-0000-000000000001', 'DUP', 2, 'S-A3', now()),
  ('71000000-4170-0000-0000-000000000004', '10000000-4170-0000-0000-000000000001', 'DEAD', 1, 'S-A4', null),
  ('71000000-4170-0000-0000-000000000005', '10000000-4170-0000-0000-000000000001', 'INVITED', 1, 'S-A5', null),
  ('72000000-4170-0000-0000-000000000001', '20000000-4170-0000-0000-000000000002', 'DUP', 1, 'S-B1', null),
  ('72000000-4170-0000-0000-000000000002', '20000000-4170-0000-0000-000000000002', 'OTHER', 1, 'S-B2', null);
insert into public.prealertas (id, tenant_id, client_markbox, code, description, boxes, deleted_at) values
  ('81000000-4170-0000-0000-000000000001', '10000000-4170-0000-0000-000000000001', 'DUP', 'A1', 'synthetic', 1, null),
  ('81000000-4170-0000-0000-000000000002', '10000000-4170-0000-0000-000000000001', 'OTHER', 'A2', 'synthetic', 1, null),
  ('81000000-4170-0000-0000-000000000003', '10000000-4170-0000-0000-000000000001', 'DUP', 'A3', 'synthetic', 1, now()),
  ('81000000-4170-0000-0000-000000000004', '10000000-4170-0000-0000-000000000001', 'DEAD', 'A4', 'synthetic', 1, null),
  ('81000000-4170-0000-0000-000000000005', '10000000-4170-0000-0000-000000000001', 'INVITED', 'A5', 'synthetic', 1, null),
  ('82000000-4170-0000-0000-000000000001', '20000000-4170-0000-0000-000000000002', 'DUP', 'B1', 'synthetic', 1, null),
  ('82000000-4170-0000-0000-000000000002', '20000000-4170-0000-0000-000000000002', 'OTHER', 'B2', 'synthetic', 1, null);
insert into public.prealerta_documents (tenant_id, prealerta_id, client_markbox, file_name, storage_path, deleted_at)
select v.tenant_id::uuid, p.id, v.markbox, v.label, 'synthetic/' || v.label,
       case when v.label = 'D-deleted' then now() else null end
from (values
  ('10000000-4170-0000-0000-000000000001', 'A1', 'DUP', 'D-A1'),
  ('20000000-4170-0000-0000-000000000002', 'B1', 'DUP', 'D-B1'),
  ('10000000-4170-0000-0000-000000000001', 'A2', 'DUP', 'D-stale-owner'),
  ('10000000-4170-0000-0000-000000000001', 'B1', 'DUP', 'D-cross-parent'),
  ('20000000-4170-0000-0000-000000000002', 'A1', 'DUP', 'D-cross-tenant'),
  ('10000000-4170-0000-0000-000000000001', 'A3', 'DUP', 'D-retired-parent'),
  ('10000000-4170-0000-0000-000000000001', 'A1', 'DUP', 'D-deleted'),
  ('10000000-4170-0000-0000-000000000001', 'A2', 'OTHER', 'D-other'),
  ('10000000-4170-0000-0000-000000000001', 'A4', 'DEAD', 'D-retired-client'),
  ('10000000-4170-0000-0000-000000000001', 'A5', 'INVITED', 'D-invited-client'),
  ('10000000-4170-0000-0000-000000000001', 'A1', null, 'D-null-owner'),
  ('10000000-4170-0000-0000-000000000001', 'A1', 'OTHER', 'D-child-mismatch')
) v(tenant_id, code, markbox, label) join public.prealertas p on p.code = v.code;

-- Prueba de realidad: las policies originales permiten tres lecturas ajenas y
-- DOS apropiaciones, aunque WITH CHECK fuerce el tenant nuevo a ser el propio.
savepoint historical_takeovers;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4170-0000-0000-000000000101';
do $historical_bug$
declare v_count bigint;
begin
  if (select count(*) from public.suppliers_cn where name = 'S-B1') <> 1
     or (select count(*) from public.prealertas where code = 'B1') <> 1
     or (select count(*) from public.prealerta_documents where file_name = 'D-B1') <> 1 then
    raise exception 'TEST 0417: fixture no reproduce los tres cruces históricos';
  end if;
  update public.suppliers_cn
  set tenant_id = '10000000-4170-0000-0000-000000000001', supplier_seq = 90
  where id = '72000000-4170-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: no reprodujo apropiación de proveedor'; end if;
  update public.prealertas
  set tenant_id = '10000000-4170-0000-0000-000000000001', supplier_id = null, code = 'TAKEOVER'
  where id = '82000000-4170-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: no reprodujo apropiación de prealerta'; end if;
  raise notice 'TEST 0417 RED baseline: 3 lecturas cross-tenant + 2 UPDATE de apropiación reproducidos';
end;
$historical_bug$;
rollback to savepoint historical_takeovers;
release savepoint historical_takeovers;
reset role;

-- La solución sólo debe sustituir policies Portal, sin tocar equipo, servicio,
-- Storage ni ACL de tabla. La comparación es bidireccional: tampoco agrega vías.
create temporary table unchanged_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where (schemaname = 'public' and tablename in ('suppliers_cn', 'prealertas', 'prealerta_documents')
         and policyname not like '% portal self %') or schemaname = 'storage';
create temporary table table_acl_baseline as
  select oid, relacl, relrowsecurity from pg_catalog.pg_class
  where oid in ('public.suppliers_cn'::regclass, 'public.prealertas'::regclass, 'public.prealerta_documents'::regclass);
\if :apply_fix
\ir ../migrations/0417_portal_prealertas_tenant_boundary.sql
-- El runner monta el repo sólo-lectura en /sb. Ejecutar el archivo real prueba
-- el preflight sin duplicar su lógica; cada drift sintético revierte su DDL.
do $preflight_drift$
declare v record; v_rejected boolean;
begin
  for v in select * from (values
    ('create policy "0417 unexpected" on public.suppliers_cn for select to authenticated using (true)',
     '0417: inventario de policies ausente o con drift; revisar antes de aplicar'),
    ('drop policy "prealertas portal self update" on public.prealertas',
     '0417: inventario de policies ausente o con drift; revisar antes de aplicar'),
    ('alter table public.prealerta_documents disable row level security',
     '0417: tabla ausente o sin RLS: prealerta_documents')
  ) scenarios(ddl, expected_error) loop
    begin
      execute v.ddl;
      v_rejected := false;
      begin
        execute pg_catalog.pg_read_file('/sb/migrations/0417_portal_prealertas_tenant_boundary.sql');
      exception when raise_exception then
        if sqlerrm <> v.expected_error then raise; end if;
        v_rejected := true;
      end;
      if not v_rejected then raise exception 'TEST 0417: preflight aceptó drift: %', v.ddl; end if;
      raise sqlstate 'PT417' using message = 'rollback de drift sintético';
    exception when sqlstate 'PT417' then null;
    end;
  end loop;
end;
$preflight_drift$;
\endif
do $unchanged_nonportal$
begin
  if exists (
    (select definition from unchanged_policy_baseline except
     select to_jsonb(p) from pg_catalog.pg_policies p
     where (schemaname = 'public' and tablename in ('suppliers_cn', 'prealertas', 'prealerta_documents')
            and policyname not like '% portal self %') or schemaname = 'storage')
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p
     where (schemaname = 'public' and tablename in ('suppliers_cn', 'prealertas', 'prealerta_documents')
            and policyname not like '% portal self %') or schemaname = 'storage'
     except select definition from unchanged_policy_baseline)
  ) or exists (
    select 1 from table_acl_baseline b join pg_catalog.pg_class c on c.oid = b.oid
    where c.relacl is distinct from b.relacl or c.relrowsecurity is distinct from b.relrowsecurity
  ) then raise exception 'TEST 0417: cambió equipo, service_role, Storage, ACL o habilitación RLS'; end if;
end;
$unchanged_nonportal$;

-- INVOKER: observa siempre las filas alcanzables por el rol y JWT actuales.
create function pg_temp.assert_portal(p_suppliers text[], p_prealertas text[], p_docs text[])
returns void language plpgsql as $$
declare v_suppliers text[]; v_prealertas text[]; v_docs text[];
begin
  select coalesce(array_agg(name order by name), '{}'::text[]) into v_suppliers from public.suppliers_cn;
  select coalesce(array_agg(code order by code), '{}'::text[]) into v_prealertas from public.prealertas;
  select coalesce(array_agg(file_name order by file_name), '{}'::text[]) into v_docs from public.prealerta_documents;
  if v_suppliers <> p_suppliers or v_prealertas <> p_prealertas or v_docs <> p_docs then
    raise exception 'TEST 0417: visibilidad para %: suppliers=%, prealertas=%, docs=%; esperado % / % / %',
      auth.uid(), v_suppliers, v_prealertas, v_docs, p_suppliers, p_prealertas, p_docs;
  end if;
end;
$$;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4170-0000-0000-000000000101';
select pg_temp.assert_portal(array['S-A1'], array['A1'], array['D-A1']);
set local "request.jwt.claim.sub" = 'bbbbbbbb-4170-0000-0000-000000000101';
select pg_temp.assert_portal(array['S-B1'], array['B1'], array['D-B1']);

do $invalid_principals$
declare v record; v_table text; v_count bigint; v_blocked boolean;
begin
  for v in select * from (values
    ('aaaaaaaa-4170-0000-0000-000000000102', 'OTHER'),
    ('aaaaaaaa-4170-0000-0000-000000000103', 'DEAD'),
    ('aaaaaaaa-4170-0000-0000-000000000104', 'OTHER'),
    ('aaaaaaaa-4170-0000-0000-000000000105', 'INVITED'),
    ('aaaaaaaa-4170-0000-0000-000000000002', 'DUP'),
    ('aaaaaaaa-4170-0000-0000-000000000999', 'DUP'), ('', 'DUP')
  ) principals(uid, markbox) loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v.uid, true);
    perform pg_temp.assert_portal('{}', '{}', '{}');
    foreach v_table in array array['suppliers_cn', 'prealertas', 'prealerta_documents'] loop
      execute format('update public.%I set tenant_id = tenant_id', v_table);
      get diagnostics v_count = row_count;
      if v_count <> 0 then raise exception 'TEST 0417: principal inválido actualizó %', v_table; end if;
      execute format('delete from public.%I', v_table);
      get diagnostics v_count = row_count;
      if v_count <> 0 then raise exception 'TEST 0417: principal inválido borró %', v_table; end if;
    end loop;
    v_blocked := false;
    begin
      insert into public.suppliers_cn (tenant_id, client_markbox, supplier_seq, name)
      values ('10000000-4170-0000-0000-000000000001', v.markbox, 99, 'INVALID');
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: principal inválido insertó proveedor %', v.uid; end if;
    v_blocked := false;
    begin
      insert into public.prealertas (tenant_id, client_markbox, code, description, boxes)
      values ('10000000-4170-0000-0000-000000000001', v.markbox, 'INVALID', 'synthetic', 1);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: principal inválido insertó prealerta %', v.uid; end if;
  end loop;
end;
$invalid_principals$;

-- Escrituras propias siguen habilitadas; no se convierten compras en read-only.
reset role;
savepoint own_portal_writes;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4170-0000-0000-000000000101';
do $own_writes$
declare v_supplier uuid := gen_random_uuid(); v_prealerta uuid := gen_random_uuid(); v_count bigint; v_returned uuid;
begin
  insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name)
  values (v_supplier, '10000000-4170-0000-0000-000000000001', 'DUP', 20, 'OWN') returning id into v_returned;
  if v_returned is distinct from v_supplier then raise exception 'TEST 0417: alta propia no devuelve proveedor'; end if;
  update public.suppliers_cn set name = 'OWN-EDIT' where id = v_supplier;
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select name from public.suppliers_cn where id = v_supplier) <> 'OWN-EDIT' then
    raise exception 'TEST 0417: Portal no puede editar su proveedor';
  end if;
  insert into public.prealertas (id, tenant_id, client_markbox, supplier_id, code, description, boxes)
  values (v_prealerta, '10000000-4170-0000-0000-000000000001', 'DUP', v_supplier, 'OWN', 'synthetic', 1) returning id into v_returned;
  if v_returned is distinct from v_prealerta then raise exception 'TEST 0417: alta propia no devuelve prealerta'; end if;
  update public.prealertas set description = 'OWN-EDIT' where id = v_prealerta;
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select description from public.prealertas where id = v_prealerta) <> 'OWN-EDIT' then
    raise exception 'TEST 0417: Portal no puede editar su prealerta';
  end if;
  delete from public.prealertas where id = v_prealerta;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal obtuvo DELETE de prealerta'; end if;
  delete from public.suppliers_cn where id = v_supplier;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal obtuvo DELETE de proveedor'; end if;
end;
$own_writes$;
rollback to savepoint own_portal_writes;
release savepoint own_portal_writes;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4170-0000-0000-000000000101';
do $foreign_writes$
declare v record; v_count bigint; v_blocked boolean;
begin
  -- USING mira la fila vieja: pasar WITH CHECK en el tenant propio no la autoriza.
  update public.suppliers_cn set tenant_id = '10000000-4170-0000-0000-000000000001', supplier_seq = 90
  where id = '72000000-4170-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal se apropió del proveedor de B'; end if;
  update public.prealertas set tenant_id = '10000000-4170-0000-0000-000000000001', supplier_id = null, code = 'TAKEOVER'
  where id = '82000000-4170-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal se apropió de prealerta de B'; end if;
  update public.suppliers_cn set name = 'FOREIGN' where name in ('S-A2', 'S-A3');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal editó otro cliente o proveedor retirado'; end if;
  update public.prealertas set description = 'FOREIGN' where code in ('A2', 'A3');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal editó otra prealerta o prealerta retirada'; end if;
  -- WITH CHECK mira la fila nueva: tampoco se puede reasignar una fila propia.
  for v in select * from (values
    ('20000000-4170-0000-0000-000000000002'::uuid, 'DUP'),
    ('10000000-4170-0000-0000-000000000001'::uuid, 'OTHER')
  ) owners(tenant_id, markbox) loop
    v_blocked := false;
    begin
      insert into public.suppliers_cn (tenant_id, client_markbox, supplier_seq, name)
      values (v.tenant_id, v.markbox, 90, 'FORBIDDEN');
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: Portal insertó proveedor ajeno'; end if;
    v_blocked := false;
    begin
      insert into public.prealertas (tenant_id, client_markbox, code, description, boxes)
      values (v.tenant_id, v.markbox, 'FORBIDDEN', 'synthetic', 1);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: Portal insertó prealerta ajena'; end if;
    v_blocked := false;
    begin
      update public.suppliers_cn set tenant_id = v.tenant_id, client_markbox = v.markbox, supplier_seq = 90
      where id = '71000000-4170-0000-0000-000000000001';
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: Portal reasignó su proveedor'; end if;
    v_blocked := false;
    begin
      update public.prealertas set tenant_id = v.tenant_id, client_markbox = v.markbox, code = 'REASSIGNED'
      where id = '81000000-4170-0000-0000-000000000001';
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: Portal reasignó su prealerta'; end if;
  end loop;
end;
$foreign_writes$;
do $portal_docs_read_only$
declare v_count bigint; v_blocked boolean := false;
begin
  update public.prealerta_documents set file_name = 'FORBIDDEN';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal obtuvo UPDATE de documentos'; end if;
  delete from public.prealerta_documents;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: Portal obtuvo DELETE de documentos'; end if;
  begin
    insert into public.prealerta_documents (tenant_id, prealerta_id, client_markbox, storage_path, file_name)
    values ('10000000-4170-0000-0000-000000000001', '81000000-4170-0000-0000-000000000001', 'DUP', 'synthetic/FORBIDDEN', 'FORBIDDEN');
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0417: Portal obtuvo INSERT de documentos'; end if;
end;
$portal_docs_read_only$;
reset role;

-- Equipo: conserva 0229 (proveedores SELECT/INSERT/UPDATE), 0105 (prealertas
-- SELECT-only) y 0118 (documentos CRUD). No se amplían permisos de otra entidad.
savepoint team_writes;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4170-0000-0000-000000000001';
do $team_preserved$
declare v_id uuid := gen_random_uuid(); v_doc uuid := gen_random_uuid(); v_count bigint; v_table text; v_blocked boolean := false;
begin
  foreach v_table in array array['suppliers_cn', 'prealertas', 'prealerta_documents'] loop
    execute format('select count(*) from public.%I where tenant_id <> public.get_user_tenant_id()', v_table) into v_count;
    if v_count <> 0 then raise exception 'TEST 0417: equipo cruzó tenant en %', v_table; end if;
  end loop;
  if (select count(*) from public.suppliers_cn) <> 5
     or (select count(*) from public.prealertas) <> 5
     or (select count(*) from public.prealerta_documents) <> 9 then
    raise exception 'TEST 0417: equipo perdió su visibilidad histórica';
  end if;
  insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name)
  values (v_id, '10000000-4170-0000-0000-000000000001', 'OTHER', 70, 'TEAM');
  update public.suppliers_cn set name = 'TEAM-EDIT' where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: equipo perdió UPDATE de proveedores'; end if;
  delete from public.suppliers_cn where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: equipo obtuvo DELETE de proveedores'; end if;
  update public.prealertas set description = 'TEAM-EDIT';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: equipo obtuvo UPDATE directo de prealertas'; end if;
  delete from public.prealertas;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0417: equipo obtuvo DELETE directo de prealertas'; end if;
  begin
    insert into public.prealertas (tenant_id, client_markbox, code, description, boxes)
    values ('10000000-4170-0000-0000-000000000001', 'DUP', 'TEAM', 'synthetic', 1);
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'TEST 0417: equipo obtuvo INSERT directo de prealertas'; end if;
  insert into public.prealerta_documents (id, tenant_id, prealerta_id, client_markbox, storage_path, file_name)
  values (v_doc, '10000000-4170-0000-0000-000000000001', '81000000-4170-0000-0000-000000000001', 'DUP', 'synthetic/TEAM', 'TEAM');
  update public.prealerta_documents set file_name = 'TEAM-EDIT' where id = v_doc;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: equipo perdió UPDATE de documentos'; end if;
  delete from public.prealerta_documents where id = v_doc;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: equipo perdió DELETE de documentos'; end if;
end;
$team_preserved$;
rollback to savepoint team_writes;
release savepoint team_writes;
reset role;
insert into public.user_tenants values
  ('bbbbbbbb-4170-0000-0000-000000000101', '10000000-4170-0000-0000-000000000001', null);
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4170-0000-0000-000000000101';
do $dual_principal$
begin
  if (select count(*) from public.suppliers_cn where name in ('S-A2', 'S-B1')) <> 2
     or (select count(*) from public.prealertas where code in ('A2', 'B1')) <> 2
     or (select count(*) from public.suppliers_cn where name = 'S-B2') <> 0
     or (select count(*) from public.prealertas where code = 'B2') <> 0
     or (select count(*) from public.prealerta_documents where file_name = 'D-B1') <> 1
     or (select count(*) from public.prealerta_documents where file_name = 'D-cross-tenant') <> 0 then
    raise exception 'TEST 0417: principal dual amplió la rama Portal';
  end if;
end;
$dual_principal$;
reset role;
set local role anon;
do $anon_denied$
declare v_table text; v_blocked boolean;
begin
  foreach v_table in array array['suppliers_cn', 'prealertas', 'prealerta_documents'] loop
    v_blocked := false;
    begin execute format('select 1 from public.%I', v_table);
    exception when insufficient_privilege then v_blocked := true; end;
    if not v_blocked then raise exception 'TEST 0417: anon accedió a %', v_table; end if;
  end loop;
end;
$anon_denied$;
reset role;
set local role service_role;
do $service_preserved$
declare v_supplier uuid := gen_random_uuid(); v_prealerta uuid := gen_random_uuid(); v_doc uuid := gen_random_uuid(); v_count bigint;
begin
  if (select count(*) from public.suppliers_cn) <> 7
     or (select count(*) from public.prealertas) <> 7
     or (select count(*) from public.prealerta_documents) <> 12 then
    raise exception 'TEST 0417: service_role perdió filas o quedó residuo de un test';
  end if;
  insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name)
  values (v_supplier, '20000000-4170-0000-0000-000000000002', 'DUP', 900, 'SERVICE');
  update public.suppliers_cn set name = 'SERVICE-EDIT' where id = v_supplier;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió UPDATE de proveedores'; end if;
  insert into public.prealertas (id, tenant_id, client_markbox, supplier_id, code, description, boxes)
  values (v_prealerta, '20000000-4170-0000-0000-000000000002', 'DUP', v_supplier, 'SERVICE', 'synthetic', 1);
  update public.prealertas set description = 'SERVICE-EDIT' where id = v_prealerta;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió UPDATE de prealertas'; end if;
  insert into public.prealerta_documents (id, tenant_id, prealerta_id, client_markbox, storage_path, file_name)
  values (v_doc, '20000000-4170-0000-0000-000000000002', v_prealerta, 'DUP', 'synthetic/SERVICE', 'SERVICE');
  update public.prealerta_documents set file_name = 'SERVICE-EDIT' where id = v_doc;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió UPDATE de documentos'; end if;
  delete from public.prealerta_documents where id = v_doc;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió DELETE de documentos'; end if;
  delete from public.prealertas where id = v_prealerta;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió DELETE de prealertas'; end if;
  delete from public.suppliers_cn where id = v_supplier;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0417: service_role perdió DELETE de proveedores'; end if;
end;
$service_preserved$;
reset role;
rollback;
select to_regclass('public.prealertas') is null as portal_prealertas_0417_fixture_rolled_back;
