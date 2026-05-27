-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
