\set ON_ERROR_STOP on
-- SDD-0412: RED none/paths inventados abiertos tras 0443; GREEN completo.
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
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create type public.document_entity_type as enum (
  'shipment', 'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry',
  'expense', 'client', 'supplier', 'consolidation', 'booking', 'bitacora_task', 'none'
);
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
  user_id uuid primary key, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null,
  can_view boolean not null, can_edit boolean not null,
  primary key (tenant_id, role, module_id)
);
create table storage.objects (
  id uuid primary key, bucket_id text not null, name text not null unique
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

-- Estado exacto posterior a 0443.
create function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql immutable security invoker set search_path = '' as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[]),
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, '')))
$$;
comment on function public.document_entity_module_contract(text) is
  'SDD-0411: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';
revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

create function public.document_entity_authorized(
  p_entity_type text, p_tenant_id uuid, p_access text
) returns boolean language sql stable security definer set search_path = '' as $$
  with normalized as (
    select pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) role
    from public.user_tenants ut where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id and ut.disabled_at is null limit 1
  ), decision as (
    select n.entity_type, n.access, m.role, c.module_id, c.default_roles,
      o.can_view, o.can_edit
    from normalized n cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c on true
    left join public.studio_role_module_overrides o on o.tenant_id = p_tenant_id
      and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
      and o.module_id = c.module_id
  )
  select coalesce((select case
    when d.access not in ('view', 'edit') then false
    when d.entity_type in ('invoice','supplier_bill','supplier_payment','journal_entry')
      then d.role in ('accounting','admin')
    when d.module_id is not null and d.role = 'admin' then true
    when d.module_id is not null and d.access = 'view'
      then coalesce(d.can_view, d.role = any(d.default_roles))
    when d.module_id is not null and d.access = 'edit'
      then d.role <> 'support' and coalesce(d.can_edit, d.role = any(d.default_roles))
    else true end from decision d), false)
$$;
comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0411: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; las entidades clasificadas, incluida bitacora_task, heredan sus módulos.';
revoke all on function public.document_entity_authorized(text,uuid,text) from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated, service_role;
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable set search_path = '' as $$
  select public.document_entity_authorized(p_entity_type, (select public.get_user_tenant_id()), 'view')
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0411: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

grant select, insert, delete on storage.objects to authenticated;
grant all on storage.objects to service_role;
alter table storage.objects enable row level security;
create policy "documents tenant insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()), 'edit'
    )
  );
create policy "documents tenant read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()), 'view'
    )
  );
create policy "documents tenant delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.get_user_tenant_id())::text
    and public.document_entity_authorized(
      coalesce((storage.foldername(name))[2], ''),
      (select public.get_user_tenant_id()), 'edit'
    )
  );

insert into public.user_tenants values
  ('aaaaaaaa-4440-4000-8000-000000000001','10000000-4440-4000-8000-000000000001','admin',null),
  ('aaaaaaaa-4440-4000-8000-000000000002','10000000-4440-4000-8000-000000000001','commercial',null),
  ('aaaaaaaa-4440-4000-8000-000000000003','10000000-4440-4000-8000-000000000001','operations',null),
  ('aaaaaaaa-4440-4000-8000-000000000004','10000000-4440-4000-8000-000000000001','accounting',null),
  ('aaaaaaaa-4440-4000-8000-000000000005','10000000-4440-4000-8000-000000000001','support',null),
  ('aaaaaaaa-4440-4000-8000-000000000006','10000000-4440-4000-8000-000000000001','warehouse',null),
  ('aaaaaaaa-4440-4000-8000-000000000007','10000000-4440-4000-8000-000000000001','marketing',null),
  ('aaaaaaaa-4440-4000-8000-000000000008','10000000-4440-4000-8000-000000000001','operations',now()),
  ('bbbbbbbb-4440-4000-8000-000000000001','20000000-4440-4000-8000-000000000002','operations',null);

-- RED: support edita none y operations puede inventar un tipo de path.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000005';
do $red_support$
begin
  if not public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','edit') then
    raise exception 'TEST 0444: no reprodujo none abierto para support';
  end if;
end;
$red_support$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000003';
do $red_unknown$
begin
  insert into storage.objects values (
    '30000000-4440-4000-8000-000000000001', 'documents',
    '10000000-4440-4000-8000-000000000001/inventado/none/red.pdf'
  );
  delete from storage.objects where id = '30000000-4440-4000-8000-000000000001';
  raise notice 'TEST 0444 RED baseline: none y tipo Storage inventado quedan abiertos';
end;
$red_unknown$;
reset role;

\if :apply_fix
\ir ../migrations/0444_unlinked_document_entity_rbac.sql
\else
do $expected_red$
begin
  raise exception 'TEST 0444 RED esperado: falta cerrar el contrato completo';
end;
$expected_red$;
\endif

do $catalog$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.document_entity_authorized(text,uuid,text)'::regprocedure
  ) into v_definition;
  if pg_catalog.obj_description('public.document_entity_module_contract(text)'::regprocedure,'pg_proc') not like 'SDD-0412:%'
     or pg_catalog.obj_description('public.document_entity_authorized(text,uuid,text)'::regprocedure,'pg_proc') not like 'SDD-0412:%'
     or v_definition not like '%else false%'
     or v_definition like '%else true%'
     or pg_catalog.has_function_privilege('authenticated','public.document_entity_module_contract(text)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.document_entity_module_contract(text)','EXECUTE') then
    raise exception 'TEST 0444: mapa, fail-closed o grants inválidos';
  end if;
end;
$catalog$;

-- Dos históricos: path canónico none y path legado sin segundo segmento.
insert into storage.objects values
  ('30000000-4440-4000-8000-000000000002','documents','10000000-4440-4000-8000-000000000001/none/none/read.pdf'),
  ('30000000-4440-4000-8000-000000000003','documents','10000000-4440-4000-8000-000000000001/legacy.pdf');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000005';
do $support$
declare
  v_count integer;
  v_blocked boolean := false;
begin
  if not public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','view')
     or not public.document_entity_authorized('','10000000-4440-4000-8000-000000000001','view')
     or public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','edit') then
    raise exception 'TEST 0444: support no quedó read-only o se rompió legado';
  end if;
  select count(*) into v_count from storage.objects where id in (
    '30000000-4440-4000-8000-000000000002',
    '30000000-4440-4000-8000-000000000003'
  );
  if v_count <> 2 then raise exception 'TEST 0444: support perdió históricos'; end if;
  begin
    insert into storage.objects values (
      '30000000-4440-4000-8000-000000000004','documents',
      '10000000-4440-4000-8000-000000000001/none/none/support.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0444: support insertó none'; end if;
end;
$support$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000003';
do $operations$
declare
  v_blocked boolean := false;
begin
  insert into storage.objects values (
    '30000000-4440-4000-8000-000000000005','documents',
    '10000000-4440-4000-8000-000000000001/none/none/operations.pdf'
  );
  delete from storage.objects where id = '30000000-4440-4000-8000-000000000005';
  begin
    insert into storage.objects values (
      '30000000-4440-4000-8000-000000000006','documents',
      '10000000-4440-4000-8000-000000000001/inventado/none/blocked.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0444: tipo Storage inventado sigue abierto'; end if;
end;
$operations$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4440-4000-8000-000000000001','marketing','documents',false,false),
  ('10000000-4440-4000-8000-000000000001','support','documents',true,true);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000007';
do $negative_override$
declare
  v_count integer;
begin
  select count(*) into v_count from storage.objects where id = '30000000-4440-4000-8000-000000000002';
  if v_count <> 0
     or public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','view') then
    raise exception 'TEST 0444: override no cerró Documentos';
  end if;
end;
$negative_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000005';
do $support_override$
begin
  if public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','edit') then
    raise exception 'TEST 0444: override rompió support read-only';
  end if;
end;
$support_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000008';
do $disabled$
begin
  if public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','view') then
    raise exception 'TEST 0444: usuario desactivado conserva Documentos';
  end if;
end;
$disabled$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4440-4000-8000-000000000003';
do $regression$
declare
  v_blocked boolean := false;
begin
  if not public.document_entity_authorized('booking','10000000-4440-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('bitacora_task','10000000-4440-4000-8000-000000000001','edit')
     or public.document_entity_authorized('invoice','10000000-4440-4000-8000-000000000001','view')
     or public.document_entity_authorized('inventado','10000000-4440-4000-8000-000000000001','view')
     or public.document_entity_authorized('none','20000000-4440-4000-8000-000000000002','view')
     or public.document_entity_authorized('none','10000000-4440-4000-8000-000000000001','unknown') then
    raise exception 'TEST 0444: regresión previa, tipo/acción abierta o cruce tenant';
  end if;
  begin
    insert into storage.objects values (
      '30000000-4440-4000-8000-000000000007','documents',
      '20000000-4440-4000-8000-000000000002/none/none/cross.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0444: bucket cruzó tenant'; end if;
end;
$regression$;
reset role;

rollback;
select true as unlinked_document_entity_rbac_0444_fixture_rolled_back;
