\set ON_ERROR_STOP on

begin;

select 'create role anon nologin'
where not exists (select 1 from pg_roles where rolname = 'anon')
\gexec
select 'create role authenticated nologin'
where not exists (select 1 from pg_roles where rolname = 'authenticated')
\gexec
select 'create role service_role nologin'
where not exists (select 1 from pg_roles where rolname = 'service_role')
\gexec

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260703234254',
  '0209_revoke_anon_rpc_sweep',
  array[$sdd0118_rls_sweep_fixture$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
--
-- Contexto: `create function` en Postgres otorga EXECUTE a PUBLIC por default.
-- Varias migraciones que recrearon funciones (`drop` + `create or replace`)
-- re-abrieron ese grant, dejando 57 funciones SECURITY DEFINER ejecutables por
-- `anon` vía /rest/v1/rpc/* (flag `anon_security_definer_function_executable`
-- del advisor de Supabase, 2026-07-03).
--
-- Este sweep cubre las 48 que NO son públicas intencionales:
--   - revoke execute from public, anon  → anon pierde la superficie
--   - grant execute to authenticated, service_role → cero regresión para los
--     callers legítimos (Studio/portal con cliente de usuario + server actions
--     y API routes con cliente admin).
--
-- Allowlist EXCLUIDA del sweep (diseñadas para anon, consumidas por
-- lib/public/* con getAnonClient() — calculadora, track, servicios — y
-- /verificar):
--   public_calculator_cities · public_calculator_config · public_cbm_rate
--   public_fcl_rates · public_ocean_rate · public_service_faqs
--   public_servicios · public_track_shipment · academy_verify_diploma
--
-- Verificación previa de riesgo (2026-07-03): las 4 más sensibles tienen guard
-- interno (get_user_tenant_id() / membresía user_tenants / operario_pins), y
-- ninguna superficie pre-auth del código llama RPCs de esta lista con cliente
-- anon. Regla permanente: toda migración nueva que cree funciones debe hacer
-- `revoke ... from public, anon` + grant explícito (memoria del repo).

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon;
grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role;
revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon;
grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate() to authenticated, service_role;
revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon;
grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role;
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.get_portal_client_tenant() from public, anon;
grant execute on function public.get_portal_client_tenant() to authenticated, service_role;
revoke execute on function public.has_any_back_role() from public, anon;
grant execute on function public.has_any_back_role() to authenticated, service_role;
revoke execute on function public.has_back_role(check_role back_role) from public, anon;
grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon;
grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon;
grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon;
grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon;
grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon;
grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon;
grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role;
revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon;
grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role;
revoke execute on function public.portal_post_message(p_body text) from public, anon;
grant execute on function public.portal_post_message(p_body text) to authenticated, service_role;
revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon;
grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon;
grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon;
grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon;
grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon;
grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.update_user_tenants_last_login() from public, anon;
grant execute on function public.update_user_tenants_last_login() to authenticated, service_role;
revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon;
grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role;
$sdd0118_rls_sweep_fixture$]
);

\ir ../migrations/0278_restore_rls_auto_enable_history.sql
\ir ../migrations/0278_restore_rls_auto_enable_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 2
      and md5(statements[1]) = '3be131a05cb2d712fc92996004ae8b33'
      and md5(statements[2]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'TEST 0278: ledger no quedó ordenado e idempotente';
  end if;
end
$ledger_contract$;

-- Simula el primer statement que recibirá un branch fresco antes del sweep.
select statements[1]
from supabase_migrations.schema_migrations
where version = '20260703234254'
\gexec

create table public.sdd_0172_rls_probe (id bigint primary key);

do $replay_contract$
declare
  fn oid := to_regprocedure('public.rls_auto_enable()');
begin
  if fn is null then
    raise exception 'TEST 0278: el bootstrap no creó rls_auto_enable()';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid = fn
      and prosecdef
      and prorettype = 'event_trigger'::regtype
      and proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'TEST 0278: contrato de seguridad de rls_auto_enable() incorrecto';
  end if;
  if not exists (
    select 1
    from pg_event_trigger
    where evtname = 'ensure_rls'
      and evtevent = 'ddl_command_end'
      and evtenabled = 'O'
      and evttags = array['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']
  ) then
    raise exception 'TEST 0278: ensure_rls no quedó activo con los tags exactos';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sdd_0172_rls_probe'
      and c.relrowsecurity
  ) then
    raise exception 'TEST 0278: ensure_rls no habilitó RLS en la tabla nueva';
  end if;
  if has_function_privilege('anon', fn, 'EXECUTE')
     or has_function_privilege('authenticated', fn, 'EXECUTE')
     or not has_function_privilege('service_role', fn, 'EXECUTE') then
    raise exception 'TEST 0278: ACL de rls_auto_enable() incorrecto';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = fn),
      acldefault('f', (select proowner from pg_proc where oid = fn))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0278: PUBLIC conserva EXECUTE';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regclass('public.sdd_0172_rls_probe') is null
  and to_regprocedure('public.rls_auto_enable()') is null
  as sdd_0118_rls_history_fixture_rolled_back;
