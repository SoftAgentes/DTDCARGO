-- 0211 — Hardening: revoke EXECUTE de authenticated en 35 RPCs solo-server
--
-- Segunda pata del sweep del advisor (la 0209 cerró anon). Estas 35 funciones
-- SECURITY DEFINER tenían EXECUTE de authenticated sin ningún caller real con
-- ese rol. Verificación previa contra prod + código (2026-07-03), 6 vías:
--   1. código: ningún .rpc() con cliente de usuario las llama (solo admin/service_role);
--   2. pg_policies: ninguna aparece en qual/with_check;
--   3. pg_trigger: ninguna está atada a un trigger;
--   4. pg_constraint: ninguna aparece en CHECK constraints;
--   5. pg_attrdef: ninguna es default de columna;
--   6. transitiva: ninguna es llamada desde el cuerpo de funciones NO-secdef
--      (que corren como el invocador y chequearían el ACL de authenticated).
-- Los helpers *_in_tenant que SÍ usan las trigger functions quedaron FUERA
-- (charge/comment/container/document/journal/ledger/legal/person/prealerta/
-- referral/rendition/shipment/statement/supplier_in_tenant, etc.).
-- `academy_verify_diploma` queda fuera: pública a propósito.
-- Reversible al instante con `grant execute ... to authenticated`.

revoke execute on function public.assert_tenant_match(p_tenant_id uuid) from authenticated;
grant execute on function public.assert_tenant_match(p_tenant_id uuid) to service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from authenticated;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to service_role;
revoke execute on function public.employee_in_tenant(p_employee_id uuid, p_tenant_id uuid) from authenticated;
grant execute on function public.employee_in_tenant(p_employee_id uuid, p_tenant_id uuid) to service_role;
revoke execute on function public.ensure_client_markbox(p_client_id uuid) from authenticated;
grant execute on function public.ensure_client_markbox(p_client_id uuid) to service_role;
revoke execute on function public.is_platform_admin() from authenticated;
grant execute on function public.is_platform_admin() to service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from authenticated;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from authenticated;
grant execute on function public.next_acceptance_code(p_tenant uuid) to service_role;
revoke execute on function public.next_agent_slug(p_tenant_id uuid) from authenticated;
grant execute on function public.next_agent_slug(p_tenant_id uuid) to service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_bill_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_booking_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from authenticated;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from authenticated;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from authenticated;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to service_role;
revoke execute on function public.next_dua_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_dua_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_entry_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_expense_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_incident_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_incident_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from authenticated;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to service_role;
revoke execute on function public.next_orphan_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_orphan_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_packing_list_folio(p_tenant_id uuid) from authenticated;
grant execute on function public.next_packing_list_folio(p_tenant_id uuid) to service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_purchase_order_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_purchase_order_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_receipt_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_receipt_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from authenticated;
grant execute on function public.next_referral_code(p_tenant uuid) to service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from authenticated;
grant execute on function public.next_rendition_code(p_tenant uuid) to service_role;
revoke execute on function public.next_sales_order_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_sales_order_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from authenticated;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from authenticated;
grant execute on function public.next_supplier_seq(p_client_markbox text) to service_role;
revoke execute on function public.rls_auto_enable() from authenticated;
grant execute on function public.rls_auto_enable() to service_role;
revoke execute on function public.update_agent_spend(p_agent_id uuid, p_cost_usd numeric) from authenticated;
grant execute on function public.update_agent_spend(p_agent_id uuid, p_cost_usd numeric) to service_role;
