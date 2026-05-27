-- ─────────────────────────────────────────────────────────────
-- 0040 · Fix RLS user_tenants — ver otros miembros del tenant
--
-- Bug pre-existente SDD-0024: la única policy de SELECT era
-- "users see their own user_tenants" (user_id = auth.uid()).
-- Resultado: /studio/usuarios mostraba solo 1 miembro aunque la
-- DB tuviera 3+ user_tenants en el mismo tenant.
--
-- Fix: agregar policy plana — cualquier user del tenant ve a los
-- demás miembros del MISMO tenant. La policy existente queda
-- (redundante pero benigna; OR lógico en RLS no rompe nada).
--
-- Usamos get_user_tenant_id() (security definer) para evitar
-- recursión RLS: la policy NO hace SELECT sobre user_tenants,
-- delega al helper que ya bypassea su propia RLS.
--
-- Si en V2 se necesita visibilidad por departamento/team, esta
-- policy queda como base + se agrega un AND adicional con el
-- filtro de dept. Migración aditiva, no breaking.
--
-- APLICADA IN-PLACE EN PROD via Supabase MCP el 2026-05-27.
-- Este archivo queda para historial del repo.
-- ─────────────────────────────────────────────────────────────

create policy "users see members of their tenant"
  on public.user_tenants for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );

comment on policy "users see members of their tenant" on public.user_tenants is
  'SDD-0024 fix · cualquier user activo del tenant ve a los demás miembros del MISMO tenant. Resuelve listado /studio/usuarios que mostraba solo el row propio.';
