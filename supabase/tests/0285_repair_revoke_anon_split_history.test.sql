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
values
(
  '20260703234254',
  '0209_revoke_anon_rpc_sweep',
  array[
    $sdd0118_revoke_split_0$create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$$sdd0118_revoke_split_0$,
    $sdd0118_revoke_split_1$comment on function public.rls_auto_enable is
  'Event trigger (ddl_command_end): habilita RLS automáticamente en toda tabla nueva de public. Creada fuera de banda en prod; versionada acá en 0277 para que sea auditable y sobreviva a una reconstrucción. La usa el event trigger ensure_rls.'$sdd0118_revoke_split_1$,
    $sdd0118_revoke_split_2$do $ensure_rls$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end
$ensure_rls$$sdd0118_revoke_split_2$,
    $sdd0118_revoke_split_3$revoke execute on function public.rls_auto_enable() from public, anon, authenticated$sdd0118_revoke_split_3$,
    $sdd0118_revoke_split_4$grant  execute on function public.rls_auto_enable() to service_role$sdd0118_revoke_split_4$,
    $sdd0118_revoke_split_5$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
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

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon$sdd0118_revoke_split_5$,
    $sdd0118_revoke_split_6$grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role$sdd0118_revoke_split_6$,
    $sdd0118_revoke_split_7$revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_7$,
    $sdd0118_revoke_split_8$grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_8$,
    $sdd0118_revoke_split_9$revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon$sdd0118_revoke_split_9$,
    $sdd0118_revoke_split_10$grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_10$,
    $sdd0118_revoke_split_11$revoke execute on function public.comment_mentions_validate() from public, anon$sdd0118_revoke_split_11$,
    $sdd0118_revoke_split_12$grant execute on function public.comment_mentions_validate() to authenticated, service_role$sdd0118_revoke_split_12$,
    $sdd0118_revoke_split_13$revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_13$,
    $sdd0118_revoke_split_14$grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_14$,
    $sdd0118_revoke_split_15$revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon$sdd0118_revoke_split_15$,
    $sdd0118_revoke_split_16$grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role$sdd0118_revoke_split_16$,
    $sdd0118_revoke_split_17$revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_17$,
    $sdd0118_revoke_split_18$grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_18$,
    $sdd0118_revoke_split_19$revoke execute on function public.get_portal_client_tenant() from public, anon$sdd0118_revoke_split_19$,
    $sdd0118_revoke_split_20$grant execute on function public.get_portal_client_tenant() to authenticated, service_role$sdd0118_revoke_split_20$,
    $sdd0118_revoke_split_21$revoke execute on function public.has_any_back_role() from public, anon$sdd0118_revoke_split_21$,
    $sdd0118_revoke_split_22$grant execute on function public.has_any_back_role() to authenticated, service_role$sdd0118_revoke_split_22$,
    $sdd0118_revoke_split_23$revoke execute on function public.has_back_role(check_role back_role) from public, anon$sdd0118_revoke_split_23$,
    $sdd0118_revoke_split_24$grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role$sdd0118_revoke_split_24$,
    $sdd0118_revoke_split_25$revoke execute on function public.is_platform_admin() from public, anon$sdd0118_revoke_split_25$,
    $sdd0118_revoke_split_26$grant execute on function public.is_platform_admin() to authenticated, service_role$sdd0118_revoke_split_26$,
    $sdd0118_revoke_split_27$revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_27$,
    $sdd0118_revoke_split_28$grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_28$,
    $sdd0118_revoke_split_29$revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_29$,
    $sdd0118_revoke_split_30$grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_30$,
    $sdd0118_revoke_split_31$revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon$sdd0118_revoke_split_31$,
    $sdd0118_revoke_split_32$grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role$sdd0118_revoke_split_32$,
    $sdd0118_revoke_split_33$revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon$sdd0118_revoke_split_33$,
    $sdd0118_revoke_split_34$grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role$sdd0118_revoke_split_34$,
    $sdd0118_revoke_split_35$revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon$sdd0118_revoke_split_35$,
    $sdd0118_revoke_split_36$grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_36$,
    $sdd0118_revoke_split_37$revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_37$,
    $sdd0118_revoke_split_38$grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_38$,
    $sdd0118_revoke_split_39$revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_39$,
    $sdd0118_revoke_split_40$grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_40$,
    $sdd0118_revoke_split_41$revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_41$,
    $sdd0118_revoke_split_42$grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_42$,
    $sdd0118_revoke_split_43$revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_43$,
    $sdd0118_revoke_split_44$grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_44$,
    $sdd0118_revoke_split_45$revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_45$,
    $sdd0118_revoke_split_46$grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_46$,
    $sdd0118_revoke_split_47$revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_47$,
    $sdd0118_revoke_split_48$grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_48$,
    $sdd0118_revoke_split_49$revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_49$,
    $sdd0118_revoke_split_50$grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_50$,
    $sdd0118_revoke_split_51$revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_51$,
    $sdd0118_revoke_split_52$grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_52$,
    $sdd0118_revoke_split_53$revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_53$,
    $sdd0118_revoke_split_54$grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_54$,
    $sdd0118_revoke_split_55$revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_55$,
    $sdd0118_revoke_split_56$grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_56$,
    $sdd0118_revoke_split_57$revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_57$,
    $sdd0118_revoke_split_58$grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_58$,
    $sdd0118_revoke_split_59$revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon$sdd0118_revoke_split_59$,
    $sdd0118_revoke_split_60$grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role$sdd0118_revoke_split_60$,
    $sdd0118_revoke_split_61$revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_61$,
    $sdd0118_revoke_split_62$grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_62$,
    $sdd0118_revoke_split_63$revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_63$,
    $sdd0118_revoke_split_64$grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_64$,
    $sdd0118_revoke_split_65$revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_65$,
    $sdd0118_revoke_split_66$grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_66$,
    $sdd0118_revoke_split_67$revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_67$,
    $sdd0118_revoke_split_68$grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_68$,
    $sdd0118_revoke_split_69$revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon$sdd0118_revoke_split_69$,
    $sdd0118_revoke_split_70$grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_70$,
    $sdd0118_revoke_split_71$revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon$sdd0118_revoke_split_71$,
    $sdd0118_revoke_split_72$grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_72$,
    $sdd0118_revoke_split_73$revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_73$,
    $sdd0118_revoke_split_74$grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_74$,
    $sdd0118_revoke_split_75$revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon$sdd0118_revoke_split_75$,
    $sdd0118_revoke_split_76$grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role$sdd0118_revoke_split_76$,
    $sdd0118_revoke_split_77$revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon$sdd0118_revoke_split_77$,
    $sdd0118_revoke_split_78$grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role$sdd0118_revoke_split_78$,
    $sdd0118_revoke_split_79$revoke execute on function public.portal_post_message(p_body text) from public, anon$sdd0118_revoke_split_79$,
    $sdd0118_revoke_split_80$grant execute on function public.portal_post_message(p_body text) to authenticated, service_role$sdd0118_revoke_split_80$,
    $sdd0118_revoke_split_81$revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon$sdd0118_revoke_split_81$,
    $sdd0118_revoke_split_82$grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_82$,
    $sdd0118_revoke_split_83$revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_83$,
    $sdd0118_revoke_split_84$grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_84$,
    $sdd0118_revoke_split_85$revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_85$,
    $sdd0118_revoke_split_86$grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_86$,
    $sdd0118_revoke_split_87$revoke execute on function public.rls_auto_enable() from public, anon$sdd0118_revoke_split_87$,
    $sdd0118_revoke_split_88$grant execute on function public.rls_auto_enable() to authenticated, service_role$sdd0118_revoke_split_88$,
    $sdd0118_revoke_split_89$revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon$sdd0118_revoke_split_89$,
    $sdd0118_revoke_split_90$grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role$sdd0118_revoke_split_90$,
    $sdd0118_revoke_split_91$revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_91$,
    $sdd0118_revoke_split_92$grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_92$,
    $sdd0118_revoke_split_93$revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_93$,
    $sdd0118_revoke_split_94$grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_94$,
    $sdd0118_revoke_split_95$revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon$sdd0118_revoke_split_95$,
    $sdd0118_revoke_split_96$grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role$sdd0118_revoke_split_96$,
    $sdd0118_revoke_split_97$revoke execute on function public.update_user_tenants_last_login() from public, anon$sdd0118_revoke_split_97$,
    $sdd0118_revoke_split_98$grant execute on function public.update_user_tenants_last_login() to authenticated, service_role$sdd0118_revoke_split_98$,
    $sdd0118_revoke_split_99$revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon$sdd0118_revoke_split_99$,
    $sdd0118_revoke_split_100$grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role$sdd0118_revoke_split_100$
  ]
),
(
  '20260729163005',
  '0276_restore_revoke_anon_rpc_sweep_history',
  array[$sdd0118_revoke_split_original_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza statements NULL del ledger; no ejecuta los REVOKE/GRANT almacenados.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
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
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and statements is null;

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_original_0276$]
);

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

\ir ../migrations/0285_repair_revoke_anon_split_history.sql
\ir ../migrations/0285_repair_revoke_anon_split_history.sql

do $patched_0276_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729163005'
    and name = '0276_restore_revoke_anon_rpc_sweep_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = '66df90af092b02ae8c0a87f5e2bc08e0';

  if v_payload <> $sdd0118_revoke_split_expected_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 101
          and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
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
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and (
    statements is null
    or (
      cardinality(statements) = 101
      and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
    )
  );

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_expected_0276$ then
    raise exception 'TEST 0285: payload 0276 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, 'fb8e6a5e43f4abff8e1b69582e36eadb') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 101') = 0 then
    raise exception 'TEST 0285: falta compatibilidad con el split de R16';
  end if;
end
$patched_0276_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729163005'
  and name = '0276_restore_revoke_anon_rpc_sweep_history'
\gexec

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

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
\gexec

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
