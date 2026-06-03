-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 5.1: Gate de activación del Portal del Cliente
--
-- El registro self-service da MARKBOX al instante, pero la cuenta queda
-- PENDIENTE DE REVISIÓN: el cliente puede entrar (login OK) pero no ve el
-- dashboard hasta activarse. Activación = clients.portal_approved_at IS NOT NULL
-- OR (≥1 envío con ese client_markbox). Esta migración agrega SOLO la columna de
-- aprobación + la RPC que la setea (admin del tenant). El "≥1 envío" se evalúa en
-- la query del portal (getPortalActivation), no necesita schema.
--
-- ADITIVA · sin DDL destructivo · NO toca RLS existente (el cliente NO escribe
-- esta columna; sólo el admin vía la RPC SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists portal_approved_at timestamptz;

comment on column public.clients.portal_approved_at is
  'Portal (SDD-0042 Fase 5): cuándo un asesor aprobó la cuenta del cliente para ver el dashboard. NULL = pendiente (puede destrabarse igual con ≥1 envío). Lo setea portal_approve_client().';

-- Admin del tenant aprueba la cuenta de portal de un cliente (gate de activación).
-- Mismo patrón de authz que portal_invite_client / portal_revoke_client:
-- membresía de tenant (get_user_tenant_id() no-null + el cliente es de ese tenant).
create or replace function public.portal_approve_client(p_client_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_admin_tenant uuid;
  v_tenant uuid;
begin
  v_admin_tenant := public.get_user_tenant_id();
  if v_admin_tenant is null then
    raise exception 'Solo un usuario del tenant puede aprobar el portal' using errcode = '42501';
  end if;

  select tenant_id into v_tenant
  from public.clients
  where id = p_client_id and deleted_at is null;

  if v_tenant is null then
    raise exception 'Cliente no encontrado';
  end if;
  if v_tenant <> v_admin_tenant then
    raise exception 'El cliente pertenece a otro tenant' using errcode = '42501';
  end if;

  update public.clients
    set portal_approved_at = now()
    where id = p_client_id;

  return true;
end;
$$;

comment on function public.portal_approve_client is
  'Portal (SDD-0042 Fase 5): el admin del tenant aprueba la cuenta del cliente (setea clients.portal_approved_at = now()). Authz por membresía de tenant.';

grant execute on function public.portal_approve_client(uuid) to authenticated;
