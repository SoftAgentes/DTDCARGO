-- ─────────────────────────────────────────────────────────────
-- SDD-0149 · Fase 3 — resumen mensual visible para el CLIENTE (portal)
--
-- El `summary` existente está redactado para uso INTERNO del equipo (tono asesor,
-- notas de "pendientes"). Para exponerlo en el portal sin filtrar ese tono, el cron
-- genera un SEGUNDO resumen client-facing (2ª persona, cálido) y lo guarda acá.
--
-- Aditiva y nullable: null = todavía no se generó (digests viejos o IA del cliente
-- falló ese mes → el portal simplemente no lo muestra). No toca RLS: el portal lee
-- estos digests vía admin client scopeado por client_id (mismo patrón que el hilo).
-- NO aplicar a prod desde acá (founder aplica a mano).
-- ─────────────────────────────────────────────────────────────

alter table public.conversation_monthly_digests
  add column if not exists client_summary text;   -- resumen para el cliente (F3 · null = no generado)

comment on column public.conversation_monthly_digests.client_summary is
  'SDD-0149 F3: resumen client-facing (2ª persona) que se muestra en el portal. Distinto de `summary` (interno, para el asesor). null = no generado.';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0224_conversation_digest_client_summary.sql
-- ─────────────────────────────────────────────────────────────
