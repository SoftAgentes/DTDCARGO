-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
