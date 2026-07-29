-- ─────────────────────────────────────────────────────────────
-- 0257 · Alerta de vencimiento de tarifas públicas (SDD-0164, ⭐1)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige
--    OK del founder NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- `public_cbm_rate()` / `public_fcl_rates()` filtran por
-- `valid_until >= current_date`. Cuando la tarifa pública vence, la RPC
-- deja de devolver la fila y el sitio cae en silencio al respaldo
-- hardcodeado de `lib/calculadora.ts` — sin error, sin alerta.
--
-- Estas dos columnas guardan CUÁNDO se avisó por última vez cada nivel
-- (por vencer / ya vencida), para que el cron de
-- app/api/cron/rate-expiry-alert/route.ts no reenvíe el mismo aviso en
-- cada corrida. Dedup self-healing (ver classifyRateExpiry en
-- lib/studio/rate-types.ts): compara el sent_at contra el INICIO de la
-- ventana de la vigencia ACTUAL, así que si el founder renueva
-- `valid_until` la ventana se corre sola, sin resetear nada a mano.
--
-- Idempotente: add column if not exists.
-- ─────────────────────────────────────────────────────────────

alter table public.rates
  add column if not exists expiry_warn_sent_at timestamptz null,
  add column if not exists expiry_overdue_sent_at timestamptz null;

comment on column public.rates.expiry_warn_sent_at is
  'Último aviso "por vencer" (<=7 días) enviado por el cron de vencimiento de tarifas públicas (SDD-0164 ⭐1). NULL = nunca avisado para la vigencia actual.';

comment on column public.rates.expiry_overdue_sent_at is
  'Último aviso "ya vencida" enviado por el cron de vencimiento de tarifas públicas (SDD-0164 ⭐1). NULL = nunca avisado para la vigencia actual.';
