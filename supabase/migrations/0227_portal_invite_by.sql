-- ─────────────────────────────────────────────────────────────
-- Adopción del portal · quién invitó (auditoría · 2026-07-11)
--
-- Registra qué asesor hizo la última invitación de cada canal, además del conteo
-- (migr 0226). Sirve para auditoría en equipos ("¿quién le mandó el último correo?").
-- El cron de recordatorio actualiza las columnas directo con service_role y deja el
-- *_by en NULL → NULL = automático (sistema).
-- ─────────────────────────────────────────────────────────────

alter table public.client_users
  add column if not exists last_email_invite_by    uuid references auth.users(id),
  add column if not exists last_whatsapp_invite_by  uuid references auth.users(id);

comment on column public.client_users.last_email_invite_by is
  'Adopción: asesor (auth.uid) del último recordatorio por CORREO manual. NULL = automático (cron).';
comment on column public.client_users.last_whatsapp_invite_by is
  'Adopción: asesor (auth.uid) de la última invitación por WHATSAPP. NULL = automático.';

-- Actualiza el RPC de conteo (migr 0226) para sellar además quién lo hizo.
create or replace function public.portal_bump_invite_count(
  p_client_id uuid,
  p_channel   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_channel not in ('email', 'whatsapp') then
    raise exception 'canal inválido: %', p_channel;
  end if;

  update public.client_users cu
     set email_invite_count = cu.email_invite_count
           + (case when p_channel = 'email' then 1 else 0 end),
         whatsapp_invite_count = cu.whatsapp_invite_count
           + (case when p_channel = 'whatsapp' then 1 else 0 end),
         last_email_invite_at = case
           when p_channel = 'email' then now() else cu.last_email_invite_at end,
         last_whatsapp_invite_at = case
           when p_channel = 'whatsapp' then now() else cu.last_whatsapp_invite_at end,
         last_email_invite_by = case
           when p_channel = 'email' then auth.uid() else cu.last_email_invite_by end,
         last_whatsapp_invite_by = case
           when p_channel = 'whatsapp' then auth.uid() else cu.last_whatsapp_invite_by end,
         updated_at = now()
   where cu.client_id = p_client_id
     and cu.tenant_id = public.get_user_tenant_id();
end;
$$;
