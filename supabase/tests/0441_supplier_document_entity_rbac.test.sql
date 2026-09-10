\set ON_ERROR_STOP on
-- SDD-0409: RED supplier abierto tras 0440; GREEN con mapa interno y overrides.
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
grant usage on schema auth to authenticated, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
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
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

-- Estado exacto posterior a 0440, antes de extraer el mapa interno.
create function public.document_entity_authorized(
  p_entity_type text, p_tenant_id uuid, p_access text
) returns boolean language sql stable security definer set search_path = '' as $$
  with normalized as (
    select pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) access
  ), contract(entity_type, module_id, default_roles) as (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[])
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) role
    from public.user_tenants ut where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id and ut.disabled_at is null limit 1
  ), decision as (
    select n.entity_type, n.access, m.role, c.module_id, c.default_roles,
      o.can_view, o.can_edit
    from normalized n cross join membership m
    left join contract c on c.entity_type = n.entity_type
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
  'SDD-0408: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense, shipment y client replican vista/edición, defaults y overrides de sus módulos.';
revoke all on function public.document_entity_authorized(text,uuid,text) from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated, service_role;
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable set search_path = '' as $$
  select public.document_entity_authorized(p_entity_type, (select public.get_user_tenant_id()), 'view')
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0408: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

insert into public.user_tenants values
  ('aaaaaaaa-4410-4000-8000-000000000001','10000000-4410-4000-8000-000000000001','admin',null),
  ('aaaaaaaa-4410-4000-8000-000000000002','10000000-4410-4000-8000-000000000001','commercial',null),
  ('aaaaaaaa-4410-4000-8000-000000000003','10000000-4410-4000-8000-000000000001','operations',null),
  ('aaaaaaaa-4410-4000-8000-000000000004','10000000-4410-4000-8000-000000000001','accounting',null),
  ('aaaaaaaa-4410-4000-8000-000000000005','10000000-4410-4000-8000-000000000001','support',null),
  ('aaaaaaaa-4410-4000-8000-000000000006','10000000-4410-4000-8000-000000000001','warehouse',null),
  ('aaaaaaaa-4410-4000-8000-000000000007','10000000-4410-4000-8000-000000000001','marketing',null),
  ('aaaaaaaa-4410-4000-8000-000000000008','10000000-4410-4000-8000-000000000001','operations',now()),
  ('bbbbbbbb-4410-4000-8000-000000000001','20000000-4410-4000-8000-000000000002','operations',null);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000004';
do $red$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: no reprodujo supplier abierto para accounting';
  end if;
  raise notice 'TEST 0441 RED baseline: supplier cae en compatibilidad abierta';
end;
$red$;
reset role;

\if :apply_fix
\ir ../migrations/0441_supplier_document_entity_rbac.sql
\endif

do $catalog$
begin
  if pg_catalog.to_regprocedure('public.document_entity_module_contract(text)') is null
     or pg_catalog.obj_description('public.document_entity_module_contract(text)'::regprocedure,'pg_proc') not like 'SDD-0409:%'
     or pg_catalog.has_function_privilege('authenticated','public.document_entity_module_contract(text)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.document_entity_module_contract(text)','EXECUTE')
     or pg_catalog.obj_description('public.document_entity_authorized(text,uuid,text)'::regprocedure,'pg_proc') not like 'SDD-0409:%' then
    raise exception 'TEST 0441: mapa interno, grants o comentario inválidos';
  end if;
end;
$catalog$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000002';
do $commercial$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: commercial perdió Proveedores';
  end if;
end;
$commercial$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000003';
do $operations$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: operations perdió Proveedores';
  end if;
end;
$operations$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000004';
do $accounting$
begin
  if public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','view') then
    raise exception 'TEST 0441: accounting conserva Proveedores por default';
  end if;
end;
$accounting$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000001';
do $admin$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: admin perdió Proveedores';
  end if;
end;
$admin$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000008';
do $disabled$
begin
  if public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','view') then
    raise exception 'TEST 0441: usuario desactivado conserva Proveedores';
  end if;
end;
$disabled$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4410-4000-8000-000000000001','accounting','suppliers',true,true),
  ('10000000-4410-4000-8000-000000000001','operations','suppliers',false,false),
  ('10000000-4410-4000-8000-000000000001','support','suppliers',true,true);
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000004';
do $positive_override$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: override no abrió accounting';
  end if;
end;
$positive_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000003';
do $negative_override$
begin
  if public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','view') then
    raise exception 'TEST 0441: override no cerró operations';
  end if;
end;
$negative_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000005';
do $support$
begin
  if not public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','view')
     or public.document_entity_authorized('supplier','10000000-4410-4000-8000-000000000001','edit') then
    raise exception 'TEST 0441: override rompió support read-only';
  end if;
end;
$support$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4410-4000-8000-000000000002';
do $regression$
begin
  if not public.document_entity_authorized('client','10000000-4410-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('shipment','10000000-4410-4000-8000-000000000001','view')
     or public.document_entity_authorized('invoice','10000000-4410-4000-8000-000000000001','view')
     or public.document_entity_authorized('supplier','20000000-4410-4000-8000-000000000002','view') then
    raise exception 'TEST 0441: regresión previa o cruce de tenant';
  end if;
end;
$regression$;
reset role;

rollback;
select pg_catalog.to_regprocedure('public.document_entity_module_contract(text)') is null
  as supplier_document_entity_rbac_0441_fixture_rolled_back;
