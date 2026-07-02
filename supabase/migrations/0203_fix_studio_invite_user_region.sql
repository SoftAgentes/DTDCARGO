-- 0203_fix_studio_invite_user_region.sql (renumerada: colisión con 0200_rbac_disabled_enforcement)
--
-- BUG (2026-07-02): "Invitar usuario" en /studio/usuarios falla con
--   column reference "token" is ambiguous
--
-- CAUSA RAÍZ — drift prod↔repo:
--   La app llama studio_invite_user(p_email, p_role, p_region) — 3 args
--   (lib/studio/user-queries.ts). Esa versión se aplicó en prod vía SQL
--   editor (SDD-0038) y NUNCA quedó como archivo (0058 solo capturó la
--   columna region). Bugs de la versión que vive en prod:
--     1. `select id, token into v_existing` → `token` choca con la OUT
--        column del RETURNS TABLE (misma herida que 0032 arregló en la
--        versión de 2 args).
--     2. El insert final hace `returning` sin `return query` → aunque se
--        arreglara el 1, la invitación nueva no devolvería filas.
--     3. No acepta el rol 'marketing' (0189 solo parcheó la de 2 args,
--        que nadie llama).
--     4. No chequea membresía activa del email invitado ni disabled_at
--        del actor.
--   Además studio_accept_invitation en prod NO propaga region → la
--   oficina elegida al invitar se perdía al aceptar.
--
-- FIX:
--   a. DROP de la versión de 2 args: tener 2 overloads fue exactamente lo
--      que dejó que 0189 parcheara la equivocada. Queda UNA canónica de
--      3 args con default 've' (cubre llamadas viejas de 2 args).
--   b. Recrea la de 3 args consolidando 0032 + 0189 + region, sin
--      ambigüedad (selects calificados + vars escalares, RETURNING
--      calificado).
--   c. Recrea studio_accept_invitation propagando region a user_tenants.
--   d. Grants mínimos: revoke public/anon (deuda RPC anon-execute).
--   e. Mensajes de error en tuteo (los de prod estaban en voseo).

-- ─── a. una sola versión canónica ────────────────────────────
drop function if exists public.studio_invite_user(text, text);

-- ─── b. studio_invite_user(email, role, region) ──────────────
create or replace function public.studio_invite_user(
  p_email text,
  p_role text,
  p_region text default 've'
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
  v_region public.user_region;
  v_token text;
  v_existing_id uuid;
  v_existing_token text;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado' using errcode = '42501';
  end if;
  if v_tenant_id is null then
    raise exception 'No tienes un tenant asignado' using errcode = '42501';
  end if;

  if p_role not in ('admin','commercial','operations','accounting','warehouse','support','marketing') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Region con default 've' si viene NULL o inválida
  if p_region is null or p_region not in ('ve','cn') then
    v_region := 've';
  else
    v_region := p_region::public.user_region;
  end if;

  select ut.role into v_actor_role
  from public.user_tenants ut
  where ut.user_id = v_actor and ut.tenant_id = v_tenant_id and ut.disabled_at is null;
  if v_actor_role is null or v_actor_role <> 'admin' then
    raise exception 'Solo los admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- Invitación pending existente → actualizar rol+oficina y devolverla.
  -- Refs calificadas (ui.*) + vars escalares: las OUT columns
  -- invitation_id/token no pueden chocar (la herida de 0032 y de prod).
  select ui.id, ui.token into v_existing_id, v_existing_token
  from public.user_invitations ui
  where ui.tenant_id = v_tenant_id and ui.email = v_email
    and ui.accepted_at is null and ui.revoked_at is null
  limit 1;

  if v_existing_id is not null then
    update public.user_invitations
       set role = p_role, region = v_region
     where id = v_existing_id;
    return query select v_existing_id, v_existing_token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- RETURNING calificado — la OUT column `token` clashea si no (fix 0032)
  return query
  insert into public.user_invitations (
    tenant_id, email, role, region, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_region, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user(text, text, text) is
  'Solo admins. Crea invitación (o devuelve la pending existente actualizando rol+oficina). Token 32 chars url-safe, expira en 7 días. Única versión canónica desde 0203.';

-- ─── c. studio_accept_invitation propaga region ──────────────
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

  insert into public.user_profiles (user_id, first_name, last_name)
  values (v_actor, p_first_name, p_last_name)
  on conflict (user_id) do update
  set first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
      last_name  = coalesce(excluded.last_name,  public.user_profiles.last_name),
      updated_at = now();

  -- FIX 0203: propagar region de la invitación → user_tenants
  -- (antes la oficina elegida al invitar se perdía al aceptar).
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
  'Acepta invitación por token: upsert perfil + membresía (rol + oficina/region de la invitación). Fix 0203: propaga region.';

-- ─── d. grants mínimos (deuda RPC anon-execute) ──────────────
revoke execute on function public.studio_invite_user(text, text, text) from public, anon;
grant execute on function public.studio_invite_user(text, text, text) to authenticated, service_role;

revoke execute on function public.studio_accept_invitation(text, text, text) from public, anon;
grant execute on function public.studio_accept_invitation(text, text, text) to authenticated;
