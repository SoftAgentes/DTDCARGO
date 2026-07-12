-- ─────────────────────────────────────────────────────────────
-- 0231_fix_portal_supplier_seq_rpc_grants.sql
--
-- SIN APLICAR A PROD — requiere OK explícito del founder (AGENTS.md: "migrations
-- a prod = con tu OK explícito, nunca auto").
--
-- Fix de regresión: 0211_revoke_authenticated_rpc_sweep.sql revocó EXECUTE de
-- `authenticated` en next_supplier_seq(text) y next_order_seq(text, uuid) — su
-- verificación #1 ("ningún .rpc() con cliente de usuario las llama") fue un
-- falso positivo: app/portal/(app)/proveedores/actions.ts SÍ las llama directo
-- con el client de SESIÓN (createClient(), no admin/service_role) desde
-- createSupplierAction y createPrealertaAction (ver 0105_portal_compras.sql,
-- comentario "usamos el client de SESIÓN... el service_role queda de respaldo
-- en la policy").
--
-- Efecto en prod desde 0211: TODO alta de proveedor o compra nueva en
-- /portal/proveedores falla — el RPC devuelve "permission denied" (42501), la
-- action lo atrapa como error genérico ("No pudimos registrar el proveedor/la
-- compra. Prueba de nuevo.") sin exponer la causa real.
--
-- Por qué es seguro re-exponer a `authenticated`: ambas son SECURITY DEFINER
-- pero resuelven el tenant del CALLER internamente
-- (coalesce(get_portal_client_tenant(), get_user_tenant_id())) — el parámetro
-- p_client_markbox solo se usa para escopear el COUNT dentro de ESE tenant ya
-- resuelto, nunca para escribir. La escritura real de suppliers_cn/prealertas
-- sigue protegida por su propio RLS (WITH CHECK por tenant_id + client_markbox
-- del caller, 0105). Restaura exactamente el grant original de 0105 (línea
-- 241-242), sin ampliar superficie más allá de eso.
-- ─────────────────────────────────────────────────────────────

grant execute on function public.next_supplier_seq(text) to authenticated;
grant execute on function public.next_order_seq(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Fin 0231_fix_portal_supplier_seq_rpc_grants.sql
-- ─────────────────────────────────────────────────────────────
