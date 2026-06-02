-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 1a (hardening): los SECURITY DEFINER del portal NO deben ser
-- ejecutables por `anon` (que los hereda del grant PUBLIC por default).
-- `authenticated` SÍ los necesita (helpers de RLS + RPCs llamadas desde server
-- actions/callback) y conserva su grant explícito de 0080.
-- Limpia los advisors `anon_security_definer_function_executable`.
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.get_portal_client_id()       from public, anon;
revoke execute on function public.get_portal_client_markbox()  from public, anon;
revoke execute on function public.portal_invite_client(uuid)   from public, anon;
revoke execute on function public.portal_bind_session()        from public, anon;
revoke execute on function public.portal_revoke_client(uuid)   from public, anon;
