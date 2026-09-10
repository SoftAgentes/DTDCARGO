\set ON_ERROR_STOP on
-- SDD-0405: contrato incremental del helper posterior a 0436.
-- RED: journal_entry todavía permanece abierto para commercial.
-- GREEN predeterminado: aplica 0437 con principals exclusivamente sintéticos.
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

-- Estado exacto de 0436: factura + Tesorería cerradas; asiento aún compatible.
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) in (
      'invoice', 'supplier_bill', 'supplier_payment'
    ) then (select public.current_studio_role()) in ('accounting', 'admin')
    else true
  end
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0404: autorización documental incremental. invoice, supplier_bill y supplier_payment heredan sus módulos financieros (accounting/admin); los demás tipos conservan su alcance previo.';
revoke all on function public.document_entity_allowed_for_current_role(text)
  from public, anon;
grant execute on function public.document_entity_allowed_for_current_role(text)
  to authenticated, service_role;

insert into public.user_tenants values
  ('aaaaaaaa-4370-4000-8000-000000000001', '10000000-4370-4000-8000-000000000001', 'admin', null),
  ('aaaaaaaa-4370-4000-8000-000000000002', '10000000-4370-4000-8000-000000000001', 'accounting', null),
  ('aaaaaaaa-4370-4000-8000-000000000003', '10000000-4370-4000-8000-000000000001', 'commercial', null),
  ('aaaaaaaa-4370-4000-8000-000000000004', '10000000-4370-4000-8000-000000000001', 'accounting', now());

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4370-4000-8000-000000000003';
do $historical_bug$
begin
  if public.document_entity_allowed_for_current_role('invoice')
     or public.document_entity_allowed_for_current_role('supplier_bill')
     or public.document_entity_allowed_for_current_role('supplier_payment')
     or not public.document_entity_allowed_for_current_role('journal_entry') then
    raise exception 'TEST 0437: no reprodujo el alcance exacto posterior a 0436';
  end if;
  raise notice 'TEST 0437 RED baseline: commercial conserva documentos de asiento';
end;
$historical_bug$;
reset role;

\if :apply_fix
\ir ../migrations/0437_accounting_document_entity_rbac.sql
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
    raise exception 'TEST 0437: grants inseguros o incompletos';
  end if;
  if pg_catalog.obj_description(
    'public.document_entity_allowed_for_current_role(text)'::regprocedure,
    'pg_proc'
  ) not like 'SDD-0405:%' then
    raise exception 'TEST 0437: comentario del contrato no avanzó a SDD-0405';
  end if;
end;
$catalog_contract$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4370-4000-8000-000000000003';
do $commercial$
begin
  if public.document_entity_allowed_for_current_role('invoice')
     or public.document_entity_allowed_for_current_role('supplier_bill')
     or public.document_entity_allowed_for_current_role('supplier_payment')
     or public.document_entity_allowed_for_current_role('journal_entry') then
    raise exception 'TEST 0437: commercial conserva un documento contable';
  end if;
  if not public.document_entity_allowed_for_current_role('shipment') then
    raise exception 'TEST 0437: el slice cerró un tipo no financiero';
  end if;
end;
$commercial$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4370-4000-8000-000000000002';
do $accounting$
begin
  if not public.document_entity_allowed_for_current_role('invoice')
     or not public.document_entity_allowed_for_current_role('supplier_bill')
     or not public.document_entity_allowed_for_current_role('supplier_payment')
     or not public.document_entity_allowed_for_current_role('journal_entry') then
    raise exception 'TEST 0437: accounting perdió un documento contable';
  end if;
end;
$accounting$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4370-4000-8000-000000000001';
do $admin$
begin
  if not public.document_entity_allowed_for_current_role('journal_entry') then
    raise exception 'TEST 0437: admin perdió documentos de asiento';
  end if;
end;
$admin$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4370-4000-8000-000000000004';
do $disabled$
begin
  if public.document_entity_allowed_for_current_role('journal_entry') then
    raise exception 'TEST 0437: accounting desactivado conserva documentos de asiento';
  end if;
end;
$disabled$;
reset role;

rollback;
select pg_catalog.to_regprocedure('public.document_entity_allowed_for_current_role(text)') is null
  as accounting_document_entity_rbac_0437_fixture_rolled_back;
