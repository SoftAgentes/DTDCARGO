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
--   H5. (review adversarial 2026-07-02) `upsert_dispatch_rules` (0024/0046) y
--       `seed_tenant_cities_from_ve_catalog` (0024) son SECURITY DEFINER que
--       ESCRIBEN ellas mismas (la RLS de la tabla no aplica) y validaban
--       membership sin `disabled_at` → un desactivado con JWT vivo podía mutar
--       la política de pago del despacho. Redefinidas acá con el filtro.
--   H6. (review adversarial) TOCTOU en los anti-lockout: dos admins podían
--       desactivarse (o desactivar+degradar) en paralelo y dejar el tenant sin
--       admins. Fix: pg_advisory_xact_lock por tenant en studio_set_user_disabled
--       y studio_change_user_role (redefinida; también corrige el falso positivo
--       al degradar a un admin YA desactivado).
--   H7. (review adversarial) la policy `user_profiles_all_select using(true)`
--       dejaba a un desactivado (o cualquier authenticated no-miembro) leer la
--       PII de todo el staff. Ahora: fila propia O miembro activo. El portal y
--       los notify helpers usan admin client (bypass) — sin impacto.
--
-- Residual aceptado (documentado en docs/architecture/rbac-hardening-2026-06.md):
-- los helpers de correlativos de 0024 (next_dispatch_order_code, next_route_code)
-- validan membership sin filtrar disabled_at, pero solo DEVUELVEN un código
-- string; el INSERT posterior lo bloquea la RLS de la tabla (H1/H3). El ban de
-- Auth es global a la cuenta: si un staff comparte auth user con un cliente del
-- portal, desactivarlo del Studio también le corta /portal (caso hoy inexistente).

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

  -- Anti-lockout: no desactivar al último admin activo del tenant.
  -- Lock advisory por tenant (H6): serializa contra otros disable/degradación
  -- concurrentes — sin esto, dos admins desactivándose en paralelo pasan ambos
  -- el count y el tenant queda sin admins (TOCTOU).
  if p_disabled and v_target_role = 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
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

-- ─── H5a · upsert_dispatch_rules: membership ACTIVO ──────────────────────
-- Redefine la versión de 0046 (cuerpo idéntico + filtro disabled_at). Es
-- SECURITY DEFINER y escribe ella misma → el check de membership es el ÚNICO
-- gate; sin el filtro, un desactivado con JWT vivo mutaba payment_policy /
-- whitelist / vip / hold del motor de despacho.

create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
      and disabled_at is null
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes,
    hold_until, hold_reason,
    updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    nullif(p_payload->>'hold_until', '')::date,
    nullif(trim(p_payload->>'hold_reason'), ''),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    hold_until           = excluded.hold_until,
    hold_reason          = excluded.hold_reason,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules con hold_until + hold_reason. Last-write-wins. Solo membership ACTIVO (0200 H5).';

-- ─── H5b · seed_tenant_cities_from_ve_catalog: membership ACTIVO ─────────
-- Redefine la versión de 0024 (cuerpo idéntico + filtro disabled_at).

create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
      and disabled_at is null
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ciudades del catálogo VE público a dispatch_city_catalog del tenant. Solo membership ACTIVO (0200 H5).';

-- ─── H6 · studio_change_user_role: lock anti-TOCTOU + fix falso positivo ──
-- Redefine la versión de 0189 (misma lista de 7 roles) con:
--   (a) pg_advisory_xact_lock por tenant (mismo lock que studio_set_user_disabled)
--       → serializa degradaciones y desactivaciones concurrentes de admins;
--   (b) el anti-lockout solo aplica si el target admin está ACTIVO — degradar a
--       un admin ya desactivado no puede dejar el tenant sin admins (antes
--       fallaba con 'No se puede degradar al último admin', falso positivo).

create or replace function public.studio_change_user_role(
  p_target_user_id uuid,
  p_new_role text
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
  v_admin_count int;
begin
  -- Validar role
  if p_new_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido: %', p_new_role using errcode = '22023';
  end if;

  -- Caller es admin
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden cambiar roles' using errcode = '42501';
  end if;

  -- Target existe en el tenant
  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- Anti-lockout: si target es admin ACTIVO y el nuevo rol no es admin,
  -- verificar que no sea el último admin activo del tenant (con lock).
  if v_target_role = 'admin' and p_new_role <> 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
    select count(*) into v_admin_count
    from public.user_tenants
    where tenant_id = v_tenant_id and role = 'admin' and disabled_at is null;
    if v_admin_count <= 1 then
      raise exception 'No se puede degradar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set role = p_new_role
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$$;

comment on function public.studio_change_user_role is
  'Solo admins. Cambia el rol de otro user. Anti-lockout con lock por tenant (0200 H6); no aplica a targets ya desactivados.';

-- ─── H7 · user_profiles: PII del staff solo para miembros activos ────────
-- La policy original (0019) era using(true) para authenticated → un
-- desactivado (o cualquier authenticated sin membership) leía nombre/teléfono/
-- telegram de todo el staff. Ahora: fila propia O miembro activo. El portal y
-- los notify/cron helpers usan admin client (bypass) — sin impacto.

drop policy if exists "user_profiles_all_select" on public.user_profiles;
create policy "user_profiles_all_select"
  on public.user_profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.disabled_at is null
    )
  );
