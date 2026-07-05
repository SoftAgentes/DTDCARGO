-- ─────────────────────────────────────────────────────────────
-- SDD-0148 #3 · Realtime del chat del portal — RLS SELECT del cliente
--
-- Hoy el cliente del portal NO tiene RLS sobre conversation_messages (el hilo se
-- le muestra vía admin en getPortalThread), así que Supabase Realtime — que
-- respeta RLS — no le puede EMPUJAR las respuestas del equipo. Por eso /portal/
-- soporte usaba un poller (20s). Esta policy le da LECTURA de SU propio hilo
-- channel='portal' para habilitar realtime "de verdad".
--
-- Scope (revisado):
--   · get_portal_client_id() (SDD-0042) → auth.uid → client_users ACTIVO →
--     client_id. Solo matchea el hilo del PROPIO cliente.
--   · channel='portal' → NO expone hilos email/whatsapp del cliente.
--   · SOLO SELECT. El cliente sigue escribiendo por la RPC portal_post_message
--     (SECURITY DEFINER) — no hay policy insert/update/delete para él.
--   · Es la MISMA data que ya ve por getPortalThread — no expone nada nuevo, solo
--     habilita que su propia sesión la lea (para el subscribe de realtime).
--   · Las policies del EQUIPO (por tenant) quedan intactas: las policies SELECT
--     se OR-ean, así que el staff sigue leyendo igual.
--
-- Aditiva, sin DDL destructivo, idempotente (drop policy if exists + create).
-- NO aplicar a prod desde acá (lo hace el Director/founder).
-- ─────────────────────────────────────────────────────────────

grant select on public.conversation_messages to authenticated;

drop policy if exists "conv_messages portal client read own"
  on public.conversation_messages;

create policy "conv_messages portal client read own"
  on public.conversation_messages for select to authenticated
  using (
    conversation_id in (
      select c.id
      from public.conversations c
      where c.client_id = public.get_portal_client_id()
        and c.channel = 'portal'
        and c.deleted_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0217_portal_conversation_read.sql
-- ─────────────────────────────────────────────────────────────
