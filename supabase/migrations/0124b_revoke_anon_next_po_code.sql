-- ─────────────────────────────────────────────────────────────
-- SDD-0071 · 0124b — hardening: next_purchase_order_code NO ejecutable por anon
--
-- Postgres da EXECUTE a PUBLIC por default en toda función nueva; 0124 granteó
-- a authenticated/service_role pero no revocó el default → el advisor
-- anon_security_definer_function_executable la marcó (anon podía pedir el
-- próximo correlativo OC- vía /rest/v1/rpc). La RPC solo la usa el Studio
-- (authenticated) — se revoca PUBLIC/anon y quedan los grants explícitos.
--
-- ✅ APLICADA a prod el 2026-06-12 (vía MCP, autorización founder), junto con 0124.
--
-- NOTA deuda sistémica: 77 funciones más del proyecto tienen el mismo advisor
-- (todas las next_*_code, *_in_tenant, etc.). NO se tocan acá: varias son
-- intencionalmente públicas (public_track_shipment, public_calculator_*).
-- → SDD de hardening aparte con lista blanca.
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.next_purchase_order_code(uuid) from public;
revoke execute on function public.next_purchase_order_code(uuid) from anon;
