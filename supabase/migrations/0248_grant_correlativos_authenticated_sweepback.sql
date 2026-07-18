-- 0248 — Sweep-back: re-grant EXECUTE de correlativos por-tenant a authenticated
--
-- Continuación de la 0247 (next_consolidation_ref). La 0211
-- (revoke_authenticated_rpc_sweep, 2026-07-03) revocó `authenticated` de 35 RPCs
-- SECURITY DEFINER con la premisa (auditoría de entonces) de que ningún caller con
-- cliente de usuario las llamaba. Esa premisa fue INCORRECTA para los GENERADORES
-- DE CORRELATIVO por-tenant: los server actions del Studio los llaman con el cliente
-- SSR `authenticated` (createClient() = ANON key + sesión → rol authenticated), no
-- con admin/service_role. Verificado 2026-07-17 con has_function_privilege +
-- lectura de cada caller en main.
--
-- Efecto del bug: al construir el botón "crear" de cada sección, el flujo choca con
-- "permission denied for function next_*_code" (idéntico a lo que le pasó a
-- createConsolidation antes de la 0247). Hoy varios de estos botones aún no existen
-- en el frontend (backend listo, UI pendiente) → el bug estaba LATENTE y por eso no
-- se notó. Fijarlo ahora desactiva la mina antes de que llegue el botón.
--
-- Seguro para authenticated: todos son SECURITY DEFINER + set search_path=public y
-- solo COMPUTAN un correlativo por-tenant (SELECT max()+1); el INSERT real que usa
-- el correlativo sigue guardado por RLS por tenant + resolveTenant en el action.
-- Mismo posture que next_markbox / next_order_seq / next_supplier_seq /
-- next_consolidation_ref, que ya están concedidos a authenticated.
--
-- NO incluye los helpers internos de 0211 que SÍ son solo-server (assert_tenant_match,
-- *_in_tenant, is_platform_admin, ensure_client_markbox, mail_increment_template_metrics,
-- create_receipt_as_operario, update_agent_spend) ni los correlativos llamados solo con
-- admin (next_consolidation_code, next_conversation_ref, next_acceptance_code,
-- next_receipt_ve_code, next_orphan_code) — para esos la 0211 fue correcta.

grant execute on function public.next_agent_slug(p_tenant_id uuid)          to authenticated;
grant execute on function public.next_bill_code(p_tenant_id uuid)           to authenticated;
grant execute on function public.next_booking_code(p_tenant_id uuid)        to authenticated;
grant execute on function public.next_bug_folio(p_tenant_id uuid)           to authenticated;
grant execute on function public.next_dua_code(p_tenant_id uuid)            to authenticated;
grant execute on function public.next_entry_code(p_tenant_id uuid)          to authenticated;
grant execute on function public.next_estimate_code(p_tenant_id uuid)       to authenticated;
grant execute on function public.next_expense_code(p_tenant_id uuid)        to authenticated;
grant execute on function public.next_incident_code(p_tenant_id uuid)       to authenticated;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated;
grant execute on function public.next_payment_order_code(p_tenant_id uuid)  to authenticated;
grant execute on function public.next_purchase_order_code(p_tenant_id uuid) to authenticated;
grant execute on function public.next_receipt_code(p_tenant_id uuid)        to authenticated;
grant execute on function public.next_referral_code(p_tenant uuid)          to authenticated;
grant execute on function public.next_rendition_code(p_tenant uuid)         to authenticated;
grant execute on function public.next_sales_order_code(p_tenant_id uuid)    to authenticated;
grant execute on function public.next_supplier_code(p_tenant_id uuid)       to authenticated;
