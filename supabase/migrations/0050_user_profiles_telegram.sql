-- ─────────────────────────────────────────────────────────────
-- user_profiles · telegram link
--
-- Permite que cada user del Studio reciba notificaciones via Telegram
-- como canal adicional al email + push web (SDD-0036 Fase 5 follow-up).
--
-- Flow:
--   1. User toca "Conectar Telegram" en ProfileModal · Preferencias
--   2. Sistema genera telegram_link_code random (8 chars)
--   3. UI muestra link "t.me/{BOT_USERNAME}?start={code}"
--   4. User abre el link · Telegram envía /start {code} al bot
--   5. Webhook /api/telegram/webhook recibe el update · matchea código
--      → setea telegram_chat_id + telegram_username + clear link_code
--   6. Sistema confirma vía router.refresh()
-- ─────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_link_code text;

comment on column public.user_profiles.telegram_chat_id is
  'Telegram chat_id del user · numeric stored as text. NULL si no linkeó. Set por webhook /api/telegram/webhook.';

comment on column public.user_profiles.telegram_username is
  'Telegram @username del user (sin @). Display-only, no auth.';

comment on column public.user_profiles.telegram_link_code is
  'Código random de 8 chars pendiente de uso en /start. NULL cuando ya consumido o nunca generado.';

create unique index if not exists user_profiles_telegram_link_code_uidx
  on public.user_profiles (telegram_link_code)
  where telegram_link_code is not null;

create index if not exists user_profiles_telegram_chat_id_idx
  on public.user_profiles (telegram_chat_id)
  where telegram_chat_id is not null;
