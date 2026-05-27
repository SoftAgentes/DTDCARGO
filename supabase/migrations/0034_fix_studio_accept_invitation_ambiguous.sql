-- 0034_fix_studio_accept_invitation_ambiguous.sql
--
-- Fix bug: studio_accept_invitation falla con
-- "column reference 'user_id' is ambiguous" porque el
-- RETURNS TABLE (user_id uuid, ...) crea OUT variables que clashean con
-- las columnas user_tenants.user_id en INSERT y ON CONFLICT.
--
-- Detectado 2026-05-26 al testear el flow de aceptación post Resend setup.
-- Symptom user-facing: "Cuenta creada pero no se pudo asignar al tenant"
-- (la cuenta en auth.users sí se creó vía Supabase Auth, pero el RPC
-- studio_accept_invitation no pudo insertar user_tenants).
--
-- Fix: usar directiva plpgsql `#variable_conflict use_column` al inicio del
-- body. Le dice al parser que ante ambigüedad entre OUT var y column de
-- tabla, use la column (que es lo que queremos en INSERT/UPDATE/ON CONFLICT).
--
-- Alternativa rechazada: renombrar OUT cols (rompería caller TS que espera
-- user_id/tenant_id/role en el JSON response).

create or replace function public.studio_accept_invitation(
  p_token text,
  p_first_name text default null,
  p_last_name text default null
)
returns table (user_id uuid, tenant_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_inv record;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado para aceptar la invitación' using errcode = '42501';
  end if;

  select * into v_inv
  from public.user_invitations
  where token = p_token;

  if v_inv.id is null then
    raise exception 'Token de invitación inválido' using errcode = '22023';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esta invitación ya fue aceptada' using errcode = '23505';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Esta invitación fue revocada' using errcode = '23505';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Esta invitación expiró' using errcode = '23505';
  end if;

  if v_inv.invited_by = v_actor then
    raise exception 'No podés aceptar una invitación que vos mismo creaste' using errcode = '42501';
  end if;

  insert into public.user_profiles (user_id, first_name, last_name)
  values (v_actor, p_first_name, p_last_name)
  on conflict (user_id) do update
  set first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
      last_name  = coalesce(excluded.last_name,  public.user_profiles.last_name),
      updated_at = now();

  insert into public.user_tenants (user_id, tenant_id, role, invited_by)
  values (v_actor, v_inv.tenant_id, v_inv.role, v_inv.invited_by)
  on conflict (user_id, tenant_id) do update
  set role        = v_inv.role,
      disabled_at = null,
      invited_by  = v_inv.invited_by;

  update public.user_invitations
  set accepted_at = now(), accepted_by = v_actor
  where id = v_inv.id;

  return query select v_actor, v_inv.tenant_id, v_inv.role;
end;
$func$;

comment on function public.studio_accept_invitation is
  'El user logueado acepta una invitación por token. Crea/reactiva user_tenants + asegura row en user_profiles. Usa #variable_conflict use_column para evitar clash de OUT vars con columnas.';
