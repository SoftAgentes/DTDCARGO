-- ─────────────────────────────────────────────────────────────
-- SDD-0020 Fase 2D.1 · fix runtime: GRANTs explícitos a service_role
--
-- Descubierto al validar end-to-end el endpoint /api/studio/agents/run:
--
--   "permission denied for table agent_runs"
--
-- Causa: la migración 0015 dejó implícito que `service_role` bypasea
-- RLS y permisos. Es cierto para RLS, pero Postgres también requiere
-- GRANTs de tabla explícitos. La migración 0015 solo otorgó SELECT a
-- `authenticated`:
--
--   grant select on public.agent_runs to authenticated;
--   -- INSERT/UPDATE en agent_runs solo via service_role desde orchestrator (audit)
--
-- El comentario era la intención, pero faltaba el GRANT.
--
-- Esta migración corrige otorgando INSERT/UPDATE al `service_role` en
-- las 2 tablas que el orchestrator escribe via service_role:
--   - agent_runs       (startRun / finishRun / appendToolCall)
--   - agent_approvals  (estructura V1, escritura real en SDD-0021)
--
-- Safe: solo otorga al `service_role` (rol privilegiado de Supabase
-- usado únicamente desde el orchestrator server-side). NO toca RLS,
-- NO afecta `authenticated`/`anon`. Idempotente (grants son
-- duplicate-safe).
-- ─────────────────────────────────────────────────────────────

grant insert, update on public.agent_runs to service_role;
grant insert, update on public.agent_approvals to service_role;
