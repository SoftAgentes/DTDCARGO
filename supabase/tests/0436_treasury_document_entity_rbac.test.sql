\set ON_ERROR_STOP on
-- SDD-0404: contrato incremental del helper instalado por 0435.
-- RED: `supplier_bill` y `supplier_payment` siguen abiertos para commercial.
-- GREEN predeterminado: aplica 0436 sobre identidades exclusivamente sintéticas.
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
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

-- Estado exacto que deja 0435: factura cerrada, los demás tipos compatibles.
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'invoice'
      then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0403: autorización documental incremental. invoice hereda el candado de Facturación (accounting/admin); los demás tipos conservan su alcance previo.';
revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;

insert into public.user_tenants values
  ('aaaaaaaa-4360-4000-8000-000000000001', '10000000-4360-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4360-4000-8000-000000000002', '10000000-4360-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4360-4000-8000-000000000003', '10000000-4360-4000-8000-000000000001', 'commercial', null),
  ('aaaaaaaa-4360-4000-8000-000000000004', '10000000-4360-4000-8000-000000000001', 'accounting', now());

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4360-4000-8000-000000000003';
do $historical_bug$
begin
  if public.document_entity_allowed_for_current_role('invoice')
     or not public.document_entity_allowed_for_current_role('supplier_bill')
     or not public.document_entity_allowed_for_current_role('supplier_payment') then
    raise exception 'TEST 0436: no reprodujo el alcance exacto posterior a 0435';
  end if;
  raise notice 'TEST 0436 RED baseline: commercial conserva documentos CxP y pago';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0436_treasury_document_entity_rbac.sql
\endif

do $catalog_contract$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(p.proacl) a
    where p.oid = 'public.document_entity_allowed_for_current_role(text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) or has_function_privilege('anon', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.document_entity_allowed_for_current_role(text)', 'EXECUTE') then
    raise exception 'TEST 0436: grants inseguros o incompletos';
  end if;
  if pg_catalog.obj_description(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure,
    'pg_proc'
  ) not like 'SDD-0404:%' then
    raise exception 'TEST 0436: comentario del contrato no avanzó a SDD-0404';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4360-4000-8000-000000000003';
do $commercial$
begin
  if public.document_entity_allowed_for_current_role('invoice')
     or public.document_entity_allowed_for_current_role('supplier_bill')
     or public.document_entity_allowed_for_current_role('supplier_payment') then
    raise exception 'TEST 0436: commercial conserva un documento de Tesorería';
  end if;
  if not public.document_entity_allowed_for_current_role('shipment') then
    raise exception 'TEST 0436: el slice cerró un tipo no financiero';
  end if;
end;
$commercial$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4360-4000-8000-000000000002';
do $accounting$
begin
  if not public.document_entity_allowed_for_current_role('invoice')
     or not public.document_entity_allowed_for_current_role('supplier_bill')
     or not public.document_entity_allowed_for_current_role('supplier_payment') then
    raise exception 'TEST 0436: accounting perdió documentos de Tesorería';
  end if;
end;
$accounting$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4360-4000-8000-000000000001';
do $admin$
begin
  if not public.document_entity_allowed_for_current_role('supplier_bill')
     or not public.document_entity_allowed_for_current_role('supplier_payment') then
    raise exception 'TEST 0436: admin perdió documentos de Tesorería';
  end if;
end;
$admin$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4360-4000-8000-000000000004';
do $disabled$
begin
  if public.document_entity_allowed_for_current_role('supplier_bill')
     or public.document_entity_allowed_for_current_role('supplier_payment') then
    raise exception 'TEST 0436: accounting desactivado conserva documentos de Tesorería';
  end if;
end;
$disabled$;
reset role;

rollback;
select pg_catalog.to_regprocedure('public.document_entity_allowed_for_current_role(text)') is null
  as treasury_document_entity_rbac_0436_fixture_rolled_back;
