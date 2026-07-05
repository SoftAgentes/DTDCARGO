-- ─────────────────────────────────────────────────────────────
-- SDD-0148 · TOGGLE del aviso de mensajes del portal
--
-- Suma la preferencia por-evento `notify_on_portal_message` (default true) a
-- user_notification_prefs (tabla de 0028): el agente puede SILENCIAR el aviso
-- (Telegram) de "mensaje nuevo de un cliente por el portal" sin apagar los demás
-- eventos ni el canal Telegram entero.
--
-- Default true = CERO cambio de comportamiento (hoy todos reciben el aviso); el
-- agente opta OUT desde Mi perfil › Notificaciones › Eventos. Aditiva, sin DDL
-- destructivo, idempotente. NO aplicar a prod desde acá (lo hace el Director/founder).
-- ─────────────────────────────────────────────────────────────

alter table public.user_notification_prefs
  add column if not exists notify_on_portal_message boolean not null default true;

comment on column public.user_notification_prefs.notify_on_portal_message is
  'SDD-0148: si false, el agente NO recibe el aviso (Telegram) de mensajes entrantes del portal (conversation-inbound-notify). Default true.';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0218_notify_portal_message_pref.sql
-- ─────────────────────────────────────────────────────────────
