-- ─────────────────────────────────────────────────────────────
-- Adopción del portal · contadores de invitación por canal (2026-07-11)
--
-- Persisten cuántas veces se invitó a cada cliente por correo y por WhatsApp, para
-- que el equipo NO reinvite de más (anti-spam) y vea de un vistazo si ya se hizo una
-- o dos veces. Viven en client_users (la fila existe apenas se invita por 1ª vez —
-- portal_invite_client la crea antes de mandar el correo / generar el enlace WA).
--
-- El incremento va por RPC SECURITY DEFINER (el equipo NO tiene UPDATE directo sobre
-- client_users, solo SELECT por RLS) con chequeo de tenant adentro y revoke a anon.
-- ─────────────────────────────────────────────────────────────

alter table public.client_users
  add column if not exists email_invite_count      integer     not null default 0,
  add column if not exists whatsapp_invite_count    integer     not null default 0,
  add column if not exists last_email_invite_at     timestamptz,
  add column if not exists last_whatsapp_invite_at  timestamptz;

comment on column public.client_users.email_invite_count is
  'Adopción: veces que se invitó/reenvió por CORREO a este cliente (anti-spam).';
comment on column public.client_users.whatsapp_invite_count is
  'Adopción: veces que se generó invitación por WHATSAPP a este cliente (anti-spam).';

-- ── RPC: incrementa el contador del canal + sella la fecha ──
-- SECURITY DEFINER porque el equipo no tiene UPDATE sobre client_users (solo SELECT).
-- El tenant se resuelve ADENTRO con get_user_tenant_id() → nadie toca otra cuenta.
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
         updated_at = now()
   where cu.client_id = p_client_id
     and cu.tenant_id = public.get_user_tenant_id();
end;
$$;

comment on function public.portal_bump_invite_count(uuid, text) is
  'Adopción: +1 al contador de invitación (email|whatsapp) del cliente en el tenant del usuario. SECURITY DEFINER + tenant check adentro.';

revoke all on function public.portal_bump_invite_count(uuid, text) from public, anon;
grant execute on function public.portal_bump_invite_count(uuid, text) to authenticated;
