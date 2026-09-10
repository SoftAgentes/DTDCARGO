\set ON_ERROR_STOP on
-- SDD-0408: contrato incremental del helper posterior a 0439.
-- RED: client todavía cae en compatibilidad abierta para cualquier rol activo.
-- GREEN predeterminado: aplica 0440 con principals exclusivamente sintéticos.
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
grant usage on schema auth to authenticated, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
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

create function public.document_entity_authorized(
  p_entity_type text, p_tenant_id uuid, p_access text
) returns boolean
language sql stable security definer set search_path = '' as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), contract(entity_type, module_id, default_roles) as (
    values
      ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
      ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[])
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id and ut.disabled_at is null
    limit 1
  ), decision as (
    select n.entity_type, n.access, m.role, c.module_id, c.default_roles,
      o.can_view, o.can_edit
    from normalized n cross join membership m
    left join contract c on c.entity_type = n.entity_type
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else true
    end from decision d
  ), false)
$$;
comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0407: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense y shipment replican vista/edición, defaults y overrides de sus módulos.';
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
  'SDD-0407: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

insert into public.user_tenants values
  ('aaaaaaaa-4400-4000-8000-000000000001', '10000000-4400-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4400-4000-8000-000000000002', '10000000-4400-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4400-4000-8000-000000000003', '10000000-4400-4000-8000-000000000001', 'operations', null),
  ('aaaaaaaa-4400-4000-8000-000000000004', '10000000-4400-4000-8000-000000000001', 'commercial', null),
  ('aaaaaaaa-4400-4000-8000-000000000005', '10000000-4400-4000-8000-000000000001', 'support', null),
  ('aaaaaaaa-4400-4000-8000-000000000006', '10000000-4400-4000-8000-000000000001', 'warehouse', null),
  ('aaaaaaaa-4400-4000-8000-000000000007', '10000000-4400-4000-8000-000000000001', 'marketing', null),
  ('aaaaaaaa-4400-4000-8000-000000000008', '10000000-4400-4000-8000-000000000001', 'accounting', now()),
  ('bbbbbbbb-4400-4000-8000-000000000001', '20000000-4400-4000-8000-000000000002', 'operations', null);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000007';
do $historical_bug$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0440: no reprodujo client abierto para marketing';
  end if;
  raise notice 'TEST 0440 RED baseline: client cae en compatibilidad abierta';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0440_client_document_entity_rbac.sql
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
  ) not like 'SDD-0408:%'
     or v_definition not like '%''client'', ''clients''%'
     or pg_catalog.obj_description(
       'public.document_entity_allowed_for_current_role(text)'::regprocedure,
       'pg_proc'
     ) not like 'SDD-0408:%' then
    raise exception 'TEST 0440: catálogo no avanzó a client';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000004';
do $commercial$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) or not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) or public.document_entity_authorized(
    'invoice', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: commercial no coincide con Clientes/finanzas';
  end if;
end;
$commercial$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000003';
do $operations$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) or not public.document_entity_authorized(
    'expense', '10000000-4400-4000-8000-000000000001', 'edit'
  ) or not public.document_entity_authorized(
    'shipment', '10000000-4400-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0440: operations perdió un contrato previo';
  end if;
end;
$operations$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000005';
do $support$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) or public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) or not public.document_entity_authorized(
    'shipment', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: support perdió el invariante read-only';
  end if;
end;
$support$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000006';
do $warehouse_default$
begin
  if public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: warehouse ganó Clientes por default';
  end if;
end;
$warehouse_default$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000007';
do $marketing_default$
begin
  if public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: marketing conserva Clientes por default';
  end if;
end;
$marketing_default$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000001';
do $admin$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0440: admin perdió Clientes';
  end if;
end;
$admin$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000008';
do $disabled$
begin
  if public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: usuario desactivado conserva Clientes';
  end if;
end;
$disabled$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4400-4000-8000-000000000001', 'warehouse', 'clients', true, true),
  ('10000000-4400-4000-8000-000000000001', 'operations', 'clients', false, false),
  ('10000000-4400-4000-8000-000000000001', 'support', 'clients', true, true);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000006';
do $warehouse_override$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0440: override no abrió warehouse';
  end if;
end;
$warehouse_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000003';
do $operations_override$
begin
  if public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: override negativo no cerró operations';
  end if;
end;
$operations_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000005';
do $support_override$
begin
  if not public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'view'
  ) or public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'edit'
  ) then
    raise exception 'TEST 0440: override rompió support read-only';
  end if;
end;
$support_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4400-4000-8000-000000000004';
do $defensive_contract$
begin
  if public.document_entity_authorized(
    'client', '20000000-4400-4000-8000-000000000002', 'view'
  ) or public.document_entity_authorized(
    'client', '10000000-4400-4000-8000-000000000001', 'unknown'
  ) or not public.document_entity_authorized(
    'legacy', '10000000-4400-4000-8000-000000000001', 'view'
  ) then
    raise exception 'TEST 0440: tenant, acceso inválido o compatibilidad cambiaron';
  end if;
end;
$defensive_contract$;
reset role;

rollback;
select pg_catalog.to_regprocedure(
  'public.document_entity_authorized(text,uuid,text)'
) is null as client_document_entity_rbac_0440_fixture_rolled_back;
