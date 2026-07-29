\set ON_ERROR_STOP on

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
    create role service_role nologin;
  end if;
end
$roles$;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260703234254', '0209_revoke_anon_rpc_sweep', null);

create type public.document_status as enum ('fixture');
create type public.document_entity_type as enum ('fixture');
create type public.back_role as enum ('fixture');

create function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to anon, authenticated, service_role;

create function public.charge_in_tenant(p_charge uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to anon, authenticated, service_role;

create function public.comment_mentions_validate()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.comment_mentions_validate() to anon, authenticated, service_role;

create function public.container_in_tenant(p_container uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to anon, authenticated, service_role;

create function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.get_portal_client_tenant()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.get_portal_client_tenant() to anon, authenticated, service_role;

create function public.has_any_back_role()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.has_any_back_role() to anon, authenticated, service_role;

create function public.has_back_role(check_role back_role)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.has_back_role(check_role back_role) to anon, authenticated, service_role;

create function public.is_platform_admin()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

create function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.legal_client_in_tenant(p_client uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.mail_check_blacklist(p_tenant_id uuid, p_email text)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to anon, authenticated, service_role;

create function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to anon, authenticated, service_role;

create function public.next_acceptance_code(p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_acceptance_code(p_tenant uuid) to anon, authenticated, service_role;

create function public.next_bill_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_bill_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_booking_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_booking_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_bug_folio(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_bug_folio(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_consolidation_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_consolidation_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_consolidation_ref(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_conversation_ref(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_conversation_ref(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_dispatch_order_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_entry_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_entry_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_estimate_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_estimate_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_expense_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_expense_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_invoice_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_invoice_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_order_seq(p_client_markbox text, p_supplier_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to anon, authenticated, service_role;

create function public.next_partner_ledger_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_payment_order_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_payment_order_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_qr_order_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_qr_order_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_receipt_ve_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_referral_code(p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_referral_code(p_tenant uuid) to anon, authenticated, service_role;

create function public.next_rendition_code(p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_rendition_code(p_tenant uuid) to anon, authenticated, service_role;

create function public.next_supplier_code(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_supplier_code(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.next_supplier_seq(p_client_markbox text)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.next_supplier_seq(p_client_markbox text) to anon, authenticated, service_role;

create function public.portal_approve_client(p_client_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.portal_approve_client(p_client_id uuid) to anon, authenticated, service_role;

create function public.portal_post_message(p_body text)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.portal_post_message(p_body text) to anon, authenticated, service_role;

create function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to anon, authenticated, service_role;

create function public.referral_client_in_tenant(p_client uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.rls_auto_enable()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.rls_auto_enable() to anon, authenticated, service_role;

create function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to anon, authenticated, service_role;

create function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.statement_in_tenant(p_statement uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to anon, authenticated, service_role;

create function public.update_user_tenants_last_login()
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.update_user_tenants_last_login() to anon, authenticated, service_role;

create function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb)
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to anon, authenticated, service_role;

\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql
\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'TEST 0276: estado final incorrecto en 20260703234254';
  end if;
  if not has_function_privilege(
    'anon',
    'public.comment_mentions_validate()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0276: la migración ejecutó el payload almacenado';
  end if;
end
$ledger_contract$;

-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
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


do $replay_contract$
begin
  if has_function_privilege('anon', 'public.add_document_version(uuid, text, text, text, bigint, document_status, date, text, text)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text)';
  end if;
  if not has_function_privilege('authenticated', 'public.add_document_version(uuid, text, text, text, bigint, document_status, date, text, text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.add_document_version(uuid, text, text, text, bigint, document_status, date, text, text)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.add_document_version(uuid, text, text, text, bigint, document_status, date, text, text)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.add_document_version(uuid, text, text, text, bigint, document_status, date, text, text)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text)';
  end if;

  if has_function_privilege('anon', 'public.charge_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.charge_in_tenant(p_charge uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.charge_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.charge_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.charge_in_tenant(p_charge uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.charge_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.charge_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.charge_in_tenant(p_charge uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.comment_entity_in_tenant(text, uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.comment_entity_in_tenant(text, uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.comment_entity_in_tenant(text, uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.comment_entity_in_tenant(text, uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.comment_entity_in_tenant(text, uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.comment_mentions_validate()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.comment_mentions_validate()';
  end if;
  if not has_function_privilege('authenticated', 'public.comment_mentions_validate()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.comment_mentions_validate()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.comment_mentions_validate()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.comment_mentions_validate()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.comment_mentions_validate()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.comment_mentions_validate()';
  end if;

  if has_function_privilege('anon', 'public.container_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.container_in_tenant(p_container uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.container_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.container_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.container_in_tenant(p_container uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.container_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.container_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.container_in_tenant(p_container uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text, text)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text)';
  end if;
  if not has_function_privilege('authenticated', 'public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text, text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text, text)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text, text)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.create_receipt_as_operario(uuid, uuid, boolean, text, text, text, text, text, text, integer, numeric, numeric, date, text, jsonb, boolean, text, text)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text)';
  end if;

  if has_function_privilege('anon', 'public.document_entity_in_tenant(document_entity_type, uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.document_entity_in_tenant(document_entity_type, uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.document_entity_in_tenant(document_entity_type, uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.document_entity_in_tenant(document_entity_type, uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.document_entity_in_tenant(document_entity_type, uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.get_portal_client_tenant()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.get_portal_client_tenant()';
  end if;
  if not has_function_privilege('authenticated', 'public.get_portal_client_tenant()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.get_portal_client_tenant()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.get_portal_client_tenant()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.get_portal_client_tenant()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.get_portal_client_tenant()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.get_portal_client_tenant()';
  end if;

  if has_function_privilege('anon', 'public.has_any_back_role()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.has_any_back_role()';
  end if;
  if not has_function_privilege('authenticated', 'public.has_any_back_role()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.has_any_back_role()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.has_any_back_role()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.has_any_back_role()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.has_any_back_role()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.has_any_back_role()';
  end if;

  if has_function_privilege('anon', 'public.has_back_role(back_role)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.has_back_role(check_role back_role)';
  end if;
  if not has_function_privilege('authenticated', 'public.has_back_role(back_role)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.has_back_role(back_role)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.has_back_role(check_role back_role)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.has_back_role(back_role)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.has_back_role(back_role)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.has_back_role(check_role back_role)';
  end if;

  if has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.is_platform_admin()';
  end if;
  if not has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.is_platform_admin()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.is_platform_admin()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.is_platform_admin()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.is_platform_admin()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.is_platform_admin()';
  end if;

  if has_function_privilege('anon', 'public.ledger_entry_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.ledger_entry_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.ledger_entry_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.ledger_entry_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.ledger_entry_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.legal_client_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.legal_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.legal_client_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.legal_client_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.legal_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.legal_client_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.legal_client_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.legal_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.mail_check_blacklist(uuid, text)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.mail_check_blacklist(p_tenant_id uuid, p_email text)';
  end if;
  if not has_function_privilege('authenticated', 'public.mail_check_blacklist(uuid, text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.mail_check_blacklist(uuid, text)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.mail_check_blacklist(p_tenant_id uuid, p_email text)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.mail_check_blacklist(uuid, text)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.mail_check_blacklist(uuid, text)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.mail_check_blacklist(p_tenant_id uuid, p_email text)';
  end if;

  if has_function_privilege('anon', 'public.mail_increment_template_metrics(uuid, text, integer)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer)';
  end if;
  if not has_function_privilege('authenticated', 'public.mail_increment_template_metrics(uuid, text, integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.mail_increment_template_metrics(uuid, text, integer)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.mail_increment_template_metrics(uuid, text, integer)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.mail_increment_template_metrics(uuid, text, integer)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer)';
  end if;

  if has_function_privilege('anon', 'public.next_acceptance_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_acceptance_code(p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_acceptance_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_acceptance_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_acceptance_code(p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_acceptance_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_acceptance_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_acceptance_code(p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_bill_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_bill_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_bill_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_bill_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_bill_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_bill_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_bill_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_bill_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_booking_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_booking_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_booking_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_booking_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_booking_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_booking_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_booking_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_booking_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_bug_folio(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_bug_folio(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_bug_folio(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_bug_folio(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_bug_folio(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_bug_folio(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_bug_folio(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_bug_folio(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_consolidation_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_consolidation_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_consolidation_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_consolidation_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_consolidation_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_consolidation_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_consolidation_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_consolidation_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_consolidation_ref(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_consolidation_ref(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_consolidation_ref(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_consolidation_ref(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_consolidation_ref(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_consolidation_ref(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_consolidation_ref(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_consolidation_ref(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_conversation_ref(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_conversation_ref(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_conversation_ref(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_conversation_ref(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_conversation_ref(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_conversation_ref(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_conversation_ref(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_conversation_ref(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_dispatch_order_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_dispatch_order_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_dispatch_order_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_dispatch_order_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_dispatch_order_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_dispatch_order_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_dispatch_order_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_dispatch_order_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_entry_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_entry_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_entry_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_entry_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_entry_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_entry_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_entry_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_entry_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_estimate_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_estimate_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_estimate_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_estimate_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_estimate_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_estimate_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_estimate_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_estimate_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_expense_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_expense_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_expense_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_expense_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_expense_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_expense_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_expense_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_expense_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_invoice_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_invoice_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_invoice_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_invoice_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_invoice_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_invoice_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_invoice_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_invoice_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_order_seq(text, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_order_seq(p_client_markbox text, p_supplier_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_order_seq(text, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_order_seq(text, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_order_seq(p_client_markbox text, p_supplier_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_order_seq(text, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_order_seq(text, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_order_seq(p_client_markbox text, p_supplier_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_partner_ledger_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_partner_ledger_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_partner_ledger_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_partner_ledger_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_partner_ledger_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_partner_ledger_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_partner_ledger_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_partner_ledger_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_payment_order_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_payment_order_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_payment_order_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_payment_order_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_payment_order_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_payment_order_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_payment_order_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_payment_order_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_qr_order_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_qr_order_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_qr_order_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_qr_order_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_qr_order_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_qr_order_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_qr_order_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_qr_order_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_receipt_ve_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_receipt_ve_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_receipt_ve_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_receipt_ve_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_receipt_ve_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_receipt_ve_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_receipt_ve_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_receipt_ve_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_referral_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_referral_code(p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_referral_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_referral_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_referral_code(p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_referral_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_referral_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_referral_code(p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_rendition_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_rendition_code(p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_rendition_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_rendition_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_rendition_code(p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_rendition_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_rendition_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_rendition_code(p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_supplier_code(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_supplier_code(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_supplier_code(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_supplier_code(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_supplier_code(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_supplier_code(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_supplier_code(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_supplier_code(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.next_supplier_seq(text)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.next_supplier_seq(p_client_markbox text)';
  end if;
  if not has_function_privilege('authenticated', 'public.next_supplier_seq(text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_supplier_seq(text)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.next_supplier_seq(p_client_markbox text)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.next_supplier_seq(text)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.next_supplier_seq(text)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.next_supplier_seq(p_client_markbox text)';
  end if;

  if has_function_privilege('anon', 'public.portal_approve_client(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.portal_approve_client(p_client_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.portal_approve_client(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.portal_approve_client(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.portal_approve_client(p_client_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.portal_approve_client(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.portal_approve_client(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.portal_approve_client(p_client_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.portal_post_message(text)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.portal_post_message(p_body text)';
  end if;
  if not has_function_privilege('authenticated', 'public.portal_post_message(text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.portal_post_message(text)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.portal_post_message(p_body text)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.portal_post_message(text)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.portal_post_message(text)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.portal_post_message(p_body text)';
  end if;

  if has_function_privilege('anon', 'public.prealerta_supplier_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.prealerta_supplier_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.prealerta_supplier_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.prealerta_supplier_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.prealerta_supplier_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.referral_client_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.referral_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.referral_client_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.referral_client_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.referral_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.referral_client_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.referral_client_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.referral_client_in_tenant(p_client uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.rendition_receipt_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.rendition_receipt_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.rendition_receipt_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.rendition_receipt_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.rendition_receipt_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.rls_auto_enable()';
  end if;
  if not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.rls_auto_enable()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.rls_auto_enable()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.rls_auto_enable()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.rls_auto_enable()';
  end if;

  if has_function_privilege('anon', 'public.seed_tenant_cities_from_ve_catalog(uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.seed_tenant_cities_from_ve_catalog(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.seed_tenant_cities_from_ve_catalog(uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.seed_tenant_cities_from_ve_catalog(uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.seed_tenant_cities_from_ve_catalog(uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)';
  end if;

  if has_function_privilege('anon', 'public.shipment_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.shipment_in_tenant(p_shipment uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.shipment_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.shipment_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.shipment_in_tenant(p_shipment uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.shipment_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.shipment_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.shipment_in_tenant(p_shipment uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.statement_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.statement_in_tenant(p_statement uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.statement_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.statement_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.statement_in_tenant(p_statement uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.statement_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.statement_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.statement_in_tenant(p_statement uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.supplier_in_tenant(uuid, uuid)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.supplier_in_tenant(p_supplier uuid, p_tenant uuid)';
  end if;
  if not has_function_privilege('authenticated', 'public.supplier_in_tenant(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.supplier_in_tenant(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.supplier_in_tenant(p_supplier uuid, p_tenant uuid)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.supplier_in_tenant(uuid, uuid)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.supplier_in_tenant(uuid, uuid)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.supplier_in_tenant(p_supplier uuid, p_tenant uuid)';
  end if;

  if has_function_privilege('anon', 'public.update_user_tenants_last_login()', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.update_user_tenants_last_login()';
  end if;
  if not has_function_privilege('authenticated', 'public.update_user_tenants_last_login()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.update_user_tenants_last_login()', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.update_user_tenants_last_login()';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.update_user_tenants_last_login()'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.update_user_tenants_last_login()'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.update_user_tenants_last_login()';
  end if;

  if has_function_privilege('anon', 'public.upsert_dispatch_rules(uuid, jsonb)', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb)';
  end if;
  if not has_function_privilege('authenticated', 'public.upsert_dispatch_rules(uuid, jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.upsert_dispatch_rules(uuid, jsonb)', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb)';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = 'public.upsert_dispatch_rules(uuid, jsonb)'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = 'public.upsert_dispatch_rules(uuid, jsonb)'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb)';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regprocedure('public.comment_mentions_validate()') is null
  as sdd_0118_revoke_anon_fixture_rolled_back;
