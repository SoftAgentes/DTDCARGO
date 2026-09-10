\set ON_ERROR_STOP on
-- SDD-0410: RED Naviera abierta tras 0441; GREEN para consolidation + booking.
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

-- Estado exacto posterior a 0441.
create function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql immutable security invoker set search_path = '' as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, '')))
$$;
comment on function public.document_entity_module_contract(text) is
  'SDD-0409: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';
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
  'SDD-0409: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense, shipment, client y supplier heredan el contrato interno de sus módulos.';
revoke all on function public.document_entity_authorized(text,uuid,text) from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated, service_role;
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable set search_path = '' as $$
  select public.document_entity_authorized(p_entity_type, (select public.get_user_tenant_id()), 'view')
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0409: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

insert into public.user_tenants values
  ('aaaaaaaa-4420-4000-8000-000000000001','10000000-4420-4000-8000-000000000001','admin',null),
  ('aaaaaaaa-4420-4000-8000-000000000002','10000000-4420-4000-8000-000000000001','commercial',null),
  ('aaaaaaaa-4420-4000-8000-000000000003','10000000-4420-4000-8000-000000000001','operations',null),
  ('aaaaaaaa-4420-4000-8000-000000000004','10000000-4420-4000-8000-000000000001','accounting',null),
  ('aaaaaaaa-4420-4000-8000-000000000005','10000000-4420-4000-8000-000000000001','support',null),
  ('aaaaaaaa-4420-4000-8000-000000000006','10000000-4420-4000-8000-000000000001','warehouse',null),
  ('aaaaaaaa-4420-4000-8000-000000000007','10000000-4420-4000-8000-000000000001','marketing',null),
  ('aaaaaaaa-4420-4000-8000-000000000008','10000000-4420-4000-8000-000000000001','operations',now()),
  ('bbbbbbbb-4420-4000-8000-000000000001','20000000-4420-4000-8000-000000000002','operations',null);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000002';
do $red$
begin
  if not public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','edit') then
    raise exception 'TEST 0442: no reprodujo Naviera abierta para commercial';
  end if;
  raise notice 'TEST 0442 RED baseline: consolidation y booking caen en compatibilidad abierta';
end;
$red$;
reset role;

\if :apply_fix
\ir ../migrations/0442_naviera_document_entity_rbac.sql
\else
do $expected_red$
begin
  raise exception 'TEST 0442 RED esperado: falta mapear Naviera';
end;
$expected_red$;
\endif

do $catalog$
begin
  if pg_catalog.obj_description('public.document_entity_module_contract(text)'::regprocedure,'pg_proc') not like 'SDD-0410:%'
     or pg_catalog.obj_description('public.document_entity_authorized(text,uuid,text)'::regprocedure,'pg_proc') not like 'SDD-0410:%'
     or pg_catalog.has_function_privilege('authenticated','public.document_entity_module_contract(text)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.document_entity_module_contract(text)','EXECUTE') then
    raise exception 'TEST 0442: mapa interno, grants o comentario inválidos';
  end if;
end;
$catalog$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000003';
do $operations$
begin
  if not public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','edit') then
    raise exception 'TEST 0442: operations perdió Naviera';
  end if;
end;
$operations$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000004';
do $accounting$
begin
  if not public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','view') then
    raise exception 'TEST 0442: accounting perdió Naviera';
  end if;
end;
$accounting$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000002';
do $commercial$
begin
  if public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','view')
     or public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','view') then
    raise exception 'TEST 0442: commercial conserva Naviera por default';
  end if;
end;
$commercial$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000001';
do $admin$
begin
  if not public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','edit') then
    raise exception 'TEST 0442: admin perdió Naviera';
  end if;
end;
$admin$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000008';
do $disabled$
begin
  if public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','view') then
    raise exception 'TEST 0442: usuario desactivado conserva Naviera';
  end if;
end;
$disabled$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4420-4000-8000-000000000001','commercial','naviera',true,true),
  ('10000000-4420-4000-8000-000000000001','accounting','naviera',false,false),
  ('10000000-4420-4000-8000-000000000001','support','naviera',true,true);
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000002';
do $positive_override$
begin
  if not public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','edit') then
    raise exception 'TEST 0442: override no abrió commercial';
  end if;
end;
$positive_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000004';
do $negative_override$
begin
  if public.document_entity_authorized('consolidation','10000000-4420-4000-8000-000000000001','view')
     or public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','view') then
    raise exception 'TEST 0442: override no cerró accounting';
  end if;
end;
$negative_override$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000005';
do $support$
begin
  if not public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','view')
     or public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','edit') then
    raise exception 'TEST 0442: override rompió support read-only';
  end if;
end;
$support$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4420-4000-8000-000000000003';
do $regression$
begin
  if not public.document_entity_authorized('supplier','10000000-4420-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('shipment','10000000-4420-4000-8000-000000000001','edit')
     or public.document_entity_authorized('invoice','10000000-4420-4000-8000-000000000001','view')
     or public.document_entity_authorized('booking','20000000-4420-4000-8000-000000000002','view')
     or public.document_entity_authorized('booking','10000000-4420-4000-8000-000000000001','unknown') then
    raise exception 'TEST 0442: regresión previa, cruce de tenant o acción abierta';
  end if;
end;
$regression$;
reset role;

rollback;
select true as naviera_document_entity_rbac_0442_fixture_rolled_back;
