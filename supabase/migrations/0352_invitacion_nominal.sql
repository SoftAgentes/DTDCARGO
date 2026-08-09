-- ─────────────────────────────────────────────────────────────
-- SDD-0251 · a) La invitación al Studio pasa a ser NOMINAL.
--
-- EL HUECO. `studio_accept_invitation` validaba token, expiración, revocación
-- y que no aceptaras tu propia invitación — pero NUNCA comparaba el correo de
-- la invitación con el del `auth.uid()` que la estaba aceptando. Quien tuviera
-- el token se llevaba el rol, incluido `admin`.
--
-- POR QUÉ PESA MÁS DE LO QUE PARECE. Este RPC es la ÚNICA vía de obtener una
-- fila en `user_tenants` en todo el sistema (cero INSERT en TypeScript, se
-- verificó). O sea: es la puerta de entrada al ERP. Y el token viaja por
-- correo — reenviarlo, pegarlo en un chat o dejarlo en el historial de un
-- equipo compartido alcanzaba para regalar acceso.
--
-- QUÉ NO ROMPE. El alta normal (`app/invitar/[token]/actions.ts`) crea la
-- cuenta con `invitation.email` y con ESE mismo correo inicia sesión antes de
-- llamar al RPC → el correo siempre coincide. El camino feliz queda igual.
--
-- Lo único que cambia: una sesión ajena con el token en la mano ahora recibe
-- 42501 en vez de una membresía.
-- ─────────────────────────────────────────────────────────────

create or replace function public.studio_accept_invitation(
  p_token text,
  p_first_name text default null,
  p_last_name text default null
)
returns table (user_id uuid, tenant_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_inv record;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado para aceptar la invitación' using errcode = '42501';
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
    raise exception 'No puedes aceptar una invitación que tú mismo creaste' using errcode = '42501';
  end if;

  -- ── SDD-0251: la invitación es NOMINAL ────────────────────────────────
  -- El token demuestra que tienes el link, no que seas el invitado. Sin este
  -- chequeo el link ES la credencial.
  select lower(u.email) into v_actor_email
  from auth.users u
  where u.id = v_actor;

  if v_actor_email is null
     or v_actor_email is distinct from lower(trim(coalesce(v_inv.email, ''))) then
    raise exception 'Esta invitación fue emitida para otro correo'
      using errcode = '42501';
  end if;

  insert into public.user_profiles (user_id, first_name, last_name)
  values (v_actor, p_first_name, p_last_name)
  on conflict (user_id) do update
  set first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
      last_name  = coalesce(excluded.last_name,  public.user_profiles.last_name),
      updated_at = now();

  -- Se conserva el fix 0203: propagar la region de la invitación.
  insert into public.user_tenants (user_id, tenant_id, role, region, invited_by)
  values (v_actor, v_inv.tenant_id, v_inv.role, v_inv.region, v_inv.invited_by)
  on conflict (user_id, tenant_id) do update
  set role        = v_inv.role,
      region      = v_inv.region,
      disabled_at = null,
      invited_by  = v_inv.invited_by;

  update public.user_invitations
  set accepted_at = now(), accepted_by = v_actor
  where id = v_inv.id;

  return query select v_actor, v_inv.tenant_id, v_inv.role;
end;
$$;

comment on function public.studio_accept_invitation(text, text, text) is
  'Acepta invitación por token: upsert perfil + membresía (rol + oficina/region). Fix 0203: propaga region. Fix 0352 (SDD-0251): NOMINAL — el correo del auth.uid() debe coincidir con el de la invitación.';

-- Grants sin cambio (create or replace los preserva; se reafirman por claridad).
revoke execute on function public.studio_accept_invitation(text, text, text) from public, anon;
grant execute on function public.studio_accept_invitation(text, text, text) to authenticated;
