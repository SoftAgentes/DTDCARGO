-- ─────────────────────────────────────────────────────────────
-- SDD-0024 Fase 1 · Usuarios & Roles V1 simple
--
-- Contenido:
--   - CHECK constraint en user_tenants.role (6 valores válidos)
--   - ALTER user_tenants ADD disabled_at + last_login_at + invited_by
--   - Tabla user_profiles (1:1 con auth.users)
--   - Tabla user_invitations (token + expires + accepted/revoked)
--   - 3 RPCs: studio_invite_user, studio_accept_invitation,
--     studio_change_user_role
--   - Trigger on_auth_session_created → update last_login_at
--   - RLS para user_profiles, user_invitations
--
-- NO incluido en esta migración:
--   - UI / server actions (Fase 2)
--   - Endpoint público accept (Fase 2)
--   - Template "team_invitation" en mailing (Fase 3, depende SDD-0026)
--
-- Backward-compat:
--   - user_tenants ya existe desde 0001_init_tenancy.sql con role text
--     default 'admin'. Esta migración hardenea con CHECK + agrega cols.
--   - Pre-CHECK: normalizamos cualquier valor existente fuera del set
--     a 'admin' (defensa contra datos viejos con mayúsculas, etc.).
-- ─────────────────────────────────────────────────────────────

-- ─── Pre: normalizar roles existentes ────────────────────────
-- Si hay rows con role no normalizado, lo arreglamos antes del CHECK.
update public.user_tenants
set role = lower(role)
where role <> lower(role);

-- Cualquier valor que no esté en la lista oficial → 'admin' (seguro:
-- mantiene acceso al usuario, evita lockout post-migration).
update public.user_tenants
set role = 'admin'
where role not in (
  'admin', 'commercial', 'operations',
  'accounting', 'warehouse', 'support'
);

-- ─── ALTER user_tenants: CHECK + cols nuevas ─────────────────
alter table public.user_tenants
  add constraint user_tenants_role_check
  check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support'
  ));

alter table public.user_tenants
  add column if not exists disabled_at   timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists invited_by    uuid references auth.users(id) on delete set null;

create index if not exists user_tenants_disabled_at_idx
  on public.user_tenants (tenant_id, role)
  where disabled_at is null;

comment on constraint user_tenants_role_check on public.user_tenants is
  'SDD-0024: enforced de 6 roles oficiales. Si en V1.5 se agregan custom roles, refactor a tabla roles separada.';

-- ─── Tabla: user_profiles ────────────────────────────────────
create table public.user_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  first_name      text,
  last_name       text,
  avatar_url      text,
  phone           text,
  position_label  text,
  locale          text not null default 'es-VE',
  timezone        text not null default 'America/Caracas',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.user_profiles is
  'Perfil personal del user (1:1 con auth.users). Separado de user_tenants porque un user puede estar en N tenants pero su perfil es único.';

-- ─── Tabla: user_invitations ─────────────────────────────────
create table public.user_invitations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  email          text not null check (email = lower(email)),
  role           text not null check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support'
  )),
  token          text not null unique,
  invited_by     uuid not null references auth.users(id) on delete cascade,
  expires_at     timestamptz not null default (now() + interval '7 days'),
  accepted_at    timestamptz,
  accepted_by    uuid references auth.users(id) on delete set null,
  revoked_at     timestamptz,
  revoked_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.user_invitations is
  'Invitaciones pendientes a unirse al tenant. Token single-use, expira en 7 días, email lower-case enforced via CHECK.';

-- Solo puede haber 1 invitation pendiente (no accepted ni revoked)
-- por (tenant, email). Permite re-invitar después de revoke.
create unique index user_invitations_pending_uniq
  on public.user_invitations (tenant_id, email)
  where accepted_at is null and revoked_at is null;

create index user_invitations_tenant_status_idx
  on public.user_invitations (tenant_id, created_at desc);
create index user_invitations_token_idx
  on public.user_invitations (token);

-- ─── RPC: studio_invite_user ─────────────────────────────────
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

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random)
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

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

-- ─── RPC: studio_accept_invitation ───────────────────────────
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
declare
  v_actor uuid := auth.uid();
  v_inv record;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado para aceptar la invitación' using errcode = '42501';
  end if;

  -- Lookup invitation
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

  -- Anti auto-aceptación: el invitador no puede aceptar su propia invitación
  if v_inv.invited_by = v_actor then
    raise exception 'No podés aceptar una invitación que vos mismo creaste' using errcode = '42501';
  end if;

  -- Crear/actualizar user_profile
  insert into public.user_profiles (user_id, first_name, last_name)
  values (v_actor, p_first_name, p_last_name)
  on conflict (user_id) do update
  set first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
      last_name  = coalesce(excluded.last_name,  public.user_profiles.last_name),
      updated_at = now();

  -- Crear/reactivar membership
  insert into public.user_tenants (user_id, tenant_id, role, invited_by)
  values (v_actor, v_inv.tenant_id, v_inv.role, v_inv.invited_by)
  on conflict (user_id, tenant_id) do update
  set role        = v_inv.role,
      disabled_at = null,
      invited_by  = v_inv.invited_by;

  -- Marcar invitation como accepted
  update public.user_invitations
  set accepted_at = now(), accepted_by = v_actor
  where id = v_inv.id;

  return query select v_actor, v_inv.tenant_id, v_inv.role;
end;
$$;

comment on function public.studio_accept_invitation is
  'El user logueado acepta una invitación por token. Crea/reactiva user_tenants + asegura row en user_profiles.';

-- ─── RPC: studio_change_user_role ────────────────────────────
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
  v_admin_count int;
begin
  -- Validar role
  if p_new_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
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
  select role into v_target_role
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- Anti-lockout: si target es admin y el nuevo rol no es admin,
  -- verificar que no sea el último admin activo del tenant.
  if v_target_role = 'admin' and p_new_role <> 'admin' then
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
  'Solo admins. Cambia el rol de otro user. Bloquea degradar al último admin (anti-lockout).';

-- ─── Trigger: actualizar last_login_at ──────────────────────
-- Se dispara en INSERT a auth.sessions (cada login crea sesión nueva).
-- Updatea todos los rows de user_tenants del user — si está en N tenants,
-- los N quedan con last_login_at = now(). Acceptable V1.
create or replace function public.update_user_tenants_last_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_tenants
  set last_login_at = new.created_at
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_auth_session_created_update_last_login on auth.sessions;
create trigger on_auth_session_created_update_last_login
  after insert on auth.sessions
  for each row execute function public.update_user_tenants_last_login();

-- ─── GRANTs ──────────────────────────────────────────────────
grant select on public.user_profiles to authenticated;
grant update on public.user_profiles to authenticated;          -- RLS filtra owner

grant select on public.user_invitations to authenticated;       -- RLS filtra tenant
-- INSERT/UPDATE/DELETE solo via RPC (no grants directos)

grant execute on function public.studio_invite_user(text, text) to authenticated;
grant execute on function public.studio_accept_invitation(text, text, text) to authenticated;
grant execute on function public.studio_change_user_role(uuid, text) to authenticated;
revoke execute on function public.studio_invite_user(text, text) from public, anon;
revoke execute on function public.studio_accept_invitation(text, text, text) from public, anon;
revoke execute on function public.studio_change_user_role(uuid, text) from public, anon;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.user_profiles enable row level security;
alter table public.user_invitations enable row level security;

-- ── user_profiles: todos los authenticated ven todos los perfiles
-- (útil para mostrar avatar+nombre en cualquier UI). UPDATE solo dueño.
create policy "user_profiles_all_select"
  on public.user_profiles for select to authenticated
  using (true);

create policy "user_profiles_owner_update"
  on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_profiles_no_direct_insert"
  on public.user_profiles for insert to authenticated
  with check (false);

create policy "user_profiles_no_delete"
  on public.user_profiles for delete
  using (false);

-- ── user_invitations: SELECT por tenant. Resto solo via RPC.
create policy "user_invitations_by_tenant_select"
  on public.user_invitations for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "user_invitations_no_direct_insert"
  on public.user_invitations for insert to authenticated
  with check (false);

create policy "user_invitations_no_direct_update"
  on public.user_invitations for update to authenticated
  using (false);

create policy "user_invitations_no_delete"
  on public.user_invitations for delete
  using (false);

-- ─── Backfill: user_profile para users existentes ────────────
-- Para que la migración no rompa queries que asumen user_profile existe.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
