-- ─────────────────────────────────────────────────────────────
-- 0229_suppliers_cn_operator_write.sql
--
-- SIN APLICAR A PROD — requiere OK explícito del founder (AGENTS.md: "migrations
-- a prod = con tu OK explícito, nunca auto"). Este archivo queda staged en la
-- rama para que el founder decida cuándo aplicarlo.
--
-- Contexto: el founder pidió (2026-07-12) construir el alta + edición de
-- proveedores (suppliers_cn) desde el Studio, a nombre de un cliente — hasta
-- ahora /studio/proveedores era SOLO LECTURA por una decisión anterior
-- ("cero writes", SDD-0057 Slice C) que quedó enforced en la RLS de
-- 0105_portal_compras.sql: el operador solo tenía policy de SELECT
-- ("suppliers_cn tenant read"), nunca de INSERT/UPDATE.
--
-- Esta migración agrega esas dos policies, scopeadas por tenant (no por rol —
-- el rol se valida en la app vía moduleEditDenial("suppliers"), patrón SDD-0085
-- "RLS por tenant, no por rol"). No toca las policies existentes del cliente
-- del portal (siguen intactas — el cliente sigue pudiendo dar de alta/editar
-- SUS proveedores desde su portal, sin cambios).
--
-- Sin esta migración aplicada, las nuevas server actions de
-- app/studio/(app)/proveedores/actions.ts (createStudioSupplierAction /
-- updateStudioSupplierAction) fallan con el error de RLS de Postgres al
-- intentar el insert/update — el código ya maneja ese caso con un mensaje
-- legible, no rompe la UI mientras tanto.
-- ─────────────────────────────────────────────────────────────

create policy "suppliers_cn tenant insert"
  on public.suppliers_cn for insert to authenticated
  with check (tenant_id = public.get_user_tenant_id());

create policy "suppliers_cn tenant update"
  on public.suppliers_cn for update to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- ─────────────────────────────────────────────────────────────
-- Fin 0229_suppliers_cn_operator_write.sql
-- ─────────────────────────────────────────────────────────────
