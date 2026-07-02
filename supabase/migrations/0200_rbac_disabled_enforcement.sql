-- 0200_rbac_disabled_enforcement.sql
--
-- SDD-0085 hardening 3 (auditoría 2026-07-02): "Desactivar" un usuario debe
-- cortarle el acceso DE VERDAD.
--
-- Hallazgos que esta migración cierra:
--
--   H1. `get_user_tenant_id()` (helper de TODA la RLS por tenant) no filtraba
--       `disabled_at` → un usuario desactivado seguía viendo/mutando toda la
--       data de su tenant.
--   H2. `current_studio_role()` (gates de poderes en triggers, ej. reclamos
--       pago) tampoco filtraba → un desactivado conservaba su rol en DB.
--   H3. La policy SELECT de `user_tenants` (`user_id = auth.uid()`) devolvía
--       la fila propia aunque estuviera desactivada. Las policies que hacen
--       subquery inline a user_tenants (ej. dispatch_* en 0024) dependen de
--       esa visibilidad → con el filtro acá, TODAS cierran de una.
--   H4. `user_tenants` no tiene NINGUNA policy de UPDATE para authenticated
--       (deny by default) → los `.update()` directos de disable/enable en la
--       app eran NO-OPs SILENCIOSOS (0 filas, sin error, la UI decía "ok").
--       Igual `user_invitations` (`no_direct_update using(false)`) → revocar
--       invitación tampoco hacía nada. Fix: RPCs security definer con check
--       de admin + anti-lockout, como sus hermanas studio_invite_user /
--       studio_change_user_role (0019/0189).
--
-- Residual aceptado (documentado en docs/architecture/rbac-hardening-2026-06.md):
-- los helpers de correlativos de 0024 (next_dispatch_order_code, etc.) validan
-- membership sin filtrar disabled_at, pero solo devuelven un código string; el
-- INSERT posterior lo bloquea la RLS de la tabla (que sí cierra con H1/H3).

-- ─── H1 · get_user_tenant_id: membership ACTIVO ──────────────────────────
-- Redefine la versión de 0012 (wrap (select auth.uid()) para caching por query).

create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1;
$$;

comment on function public.get_user_tenant_id is
  'Helper para RLS policies. Devuelve el tenant_id del usuario autenticado con membership ACTIVO (disabled_at is null — 0200). (select auth.uid()) wrap garantiza caching por query.';

-- ─── H2 · current_studio_role: rol solo si el membership está activo ─────
-- Redefine la versión de 0156.

create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;

comment on function public.current_studio_role is
  'SDD-0101 C: rol del usuario logueado en su tenant (para gates de poderes en triggers). Solo membership activo (0200).';

-- ─── H3 · policy SELECT de user_tenants: fila propia solo si activa ──────
-- Cierra las subqueries inline `tenant_id in (select tenant_id from
-- user_tenants where user_id = auth.uid())` de policies viejas (0024 y afines):
-- corren como el usuario → pasan por esta policy → desactivado = 0 filas.
-- El módulo Usuarios no se afecta: lista con admin client (service_role_all).

drop policy if exists "users see their own user_tenants" on public.user_tenants;
create policy "users see their own user_tenants"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()) and disabled_at is null);

-- ─── H4a · RPC studio_set_user_disabled ──────────────────────────────────
-- Reemplaza el UPDATE directo (no-op silencioso) de disable/enable.
-- Solo admins ACTIVOS del tenant; anti-lockout: no se puede desactivar al
-- último admin activo (cubre también auto-desactivación). Idempotente.

create or replace function public.studio_set_user_disabled(
  p_target_user_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_disabled_at timestamptz;
  v_other_active_admins int;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  -- Caller es admin activo
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden activar/desactivar usuarios' using errcode = '42501';
  end if;

  -- Target existe en el tenant
  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- Anti-lockout: no desactivar al último admin activo del tenant
  if p_disabled and v_target_role = 'admin' and v_target_disabled_at is null then
    select count(*) into v_other_active_admins
    from public.user_tenants
    where tenant_id = v_tenant_id
      and role = 'admin'
      and disabled_at is null
      and user_id <> p_target_user_id;
    if v_other_active_admins = 0 then
      raise exception 'No se puede desactivar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set disabled_at = case when p_disabled then coalesce(disabled_at, now()) else null end
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$$;

comment on function public.studio_set_user_disabled is
  'Solo admins activos. Desactiva (soft) o reactiva el membership de otro user del tenant. Anti-lockout: bloquea desactivar al último admin activo. 0200.';

revoke all on function public.studio_set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.studio_set_user_disabled(uuid, boolean) to authenticated;

-- ─── H4b · RPC studio_revoke_invitation ──────────────────────────────────
-- Reemplaza el UPDATE directo a user_invitations (bloqueado por
-- `no_direct_update using(false)` → no-op silencioso). Idempotente si ya
-- estaba revocada; bloquea revocar una ya aceptada.

create or replace function public.studio_revoke_invitation(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_accepted_at timestamptz;
  v_revoked_at timestamptz;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden revocar invitaciones' using errcode = '42501';
  end if;

  select accepted_at, revoked_at into v_accepted_at, v_revoked_at
  from public.user_invitations
  where id = p_invitation_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'La invitación no existe en este tenant' using errcode = '23503';
  end if;
  if v_accepted_at is not null then
    raise exception 'La invitación ya fue aceptada; desactiva al usuario en su lugar' using errcode = '23514';
  end if;
  if v_revoked_at is not null then
    return true; -- idempotente
  end if;

  update public.user_invitations
  set revoked_at = now(), revoked_by = v_actor
  where id = p_invitation_id and tenant_id = v_tenant_id;

  return true;
end;
$$;

comment on function public.studio_revoke_invitation is
  'Solo admins activos. Revoca una invitación pendiente del tenant (idempotente; bloquea revocar aceptadas). 0200.';

revoke all on function public.studio_revoke_invitation(uuid) from public, anon;
grant execute on function public.studio_revoke_invitation(uuid) to authenticated;
