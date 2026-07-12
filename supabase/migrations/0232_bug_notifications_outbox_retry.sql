-- ─────────────────────────────────────────────────────────────
-- 0232_bug_notifications_outbox_retry.sql
--
-- SIN APLICAR A PROD — requiere OK explícito del founder (AGENTS.md: "migrations
-- a prod = con tu OK explícito, nunca auto").
--
-- SDD-0036 Fase 5 · P3: outbox durable enqueue→drain (retry/idempotencia + cron)
-- para los 2 canales que hoy no tienen ningún backstop de durabilidad —
-- email y Telegram. Hoy el dispatch es 100% inline: si sendEmail/
-- sendTelegramMessage falla (Resend caído, rate-limit, Bot API con hiccup),
-- el error se loguea y la notificación se PIERDE para siempre.
--
-- Push NO necesita columnas nuevas: SDD-0146 Fase 5 ya construyó un outbox
-- durable completo (`outbox_push_events` + cron `/api/cron/push-drain`, cada
-- minuto, 5 intentos) que hoy bug-email-notify.ts no usa (llama
-- sendBugPushToUser directo). Este cambio de código (no de schema) lo hace
-- pasar por `enqueueUserPush` — gratis, reusa infraestructura ya probada.
--
-- Diseño (mismo patrón que outbox_push_events, sin next_retry_at explícito —
-- el cron corre cada 5 min y `attempts < 5` ya espacía los reintentos):
--   - `<canal>_attempts`   → 0 hasta el primer fallo; el intento inline ya
--     cuenta como intento #1 si falla. El drain incrementa en cada fallo.
--   - `<canal>_last_error` → mensaje del último fallo (observabilidad; no se
--     expone en ninguna UI todavía).
--   - `delivered_<canal>_at` (ya existía en 0028) sigue siendo la señal de
--     "listo, no tocar más" — attempts > 0 y delivered_at NULL es lo único
--     que el drain recoge.
-- ─────────────────────────────────────────────────────────────

alter table public.bug_notifications
  add column if not exists email_attempts    int  not null default 0,
  add column if not exists email_last_error   text,
  add column if not exists telegram_attempts  int  not null default 0,
  add column if not exists telegram_last_error text;

comment on column public.bug_notifications.email_attempts is
  'SDD-0036 P3: intentos de envío por email. 0 = nunca falló (delivered_email_at set) o canal no solicitado. El drain reintenta mientras < 5.';
comment on column public.bug_notifications.telegram_attempts is
  'SDD-0036 P3: intentos de envío por Telegram. Mismo contrato que email_attempts.';

-- Índices parciales: solo las filas que el drain realmente necesita barrer
-- (pendientes de reintento, no agotadas). Acotan el WHERE del drain a un
-- puñado de filas en vez de escanear toda bug_notifications.
create index bug_notifications_email_retry_idx
  on public.bug_notifications (created_at)
  where delivered_email_at is null and email_attempts > 0 and email_attempts < 5;

create index bug_notifications_telegram_retry_idx
  on public.bug_notifications (created_at)
  where delivered_telegram_at is null and telegram_attempts > 0 and telegram_attempts < 5;

-- ─────────────────────────────────────────────────────────────
-- Fin 0232_bug_notifications_outbox_retry.sql
-- ─────────────────────────────────────────────────────────────
