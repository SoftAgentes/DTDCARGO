-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 1a: Portal del Cliente — client_users + RLS aislada + RPCs
--
-- Da acceso de PORTAL (cliente externo) vinculando un auth.user a su registro
-- public.clients vía client_users. Aislamiento por helpers PROPIOS
-- (get_portal_client_id / get_portal_client_markbox), SEPARADOS de
-- get_user_tenant_id() — un cliente NUNCA tiene row en user_tenants, así que
-- las policies del Studio (que filtran por tenant) jamás le dan datos.
-- Policies del portal = ADITIVAS (permissive OR) y SOLO SELECT (read-only V1).
-- shipments linkea al cliente por client_markbox (text), no por FK → helper markbox.
-- ─────────────────────────────────────────────────────────────

create table public.client_users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  email         text not null,
  auth_user_id  uuid references auth.users(id) on delete set null,
  token         text unique,
  status        text not null default 'invited'
                  check (status in ('invited','active','revoked')),
  invited_by    uuid references auth.users(id),
  invited_at    timestamptz not null default now(),
  bound_at      timestamptz,
  revoked_at    timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, client_id),   -- 1 acceso de portal por cliente (V1)
  unique (auth_user_id)            -- 1 cliente por auth.user
);

comment on table public.client_users is
  'Acceso al Portal del Cliente (SDD-0042): vincula un auth.user externo con su registro clients. status invited→active(bound)→revoked.';

create index client_users_auth_idx on public.client_users (auth_user_id) where status = 'active';
create index client_users_tenant_idx on public.client_users (tenant_id);

-- ── Helpers de principal-cliente (SEPARADOS del de equipo) ──
create or replace function public.get_portal_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.client_users
  where auth_user_id = auth.uid() and status = 'active'
  limit 1
$$;
comment on function public.get_portal_client_id is
  'Portal (SDD-0042): client_id vinculado al auth.uid() actual, o NULL. NO tocar get_user_tenant_id().';

create or replace function public.get_portal_client_markbox()
returns text language sql stable security definer set search_path = public as $$
  select c.markbox from public.client_users cu
  join public.clients c on c.id = cu.client_id
  where cu.auth_user_id = auth.uid() and cu.status = 'active'
  limit 1
$$;
comment on function public.get_portal_client_markbox is
  'Portal (SDD-0042): MARKBOX del cliente vinculado al auth.uid() actual. shipments linkea por client_markbox.';

-- ── Grants (escritura de client_users SOLO vía RPC) ──
grant select on public.client_users to authenticated;
grant execute on function public.get_portal_client_id() to authenticated;
grant execute on function public.get_portal_client_markbox() to authenticated;

-- ── RLS ──
alter table public.client_users enable row level security;

-- El propio cliente ve su row; el admin del tenant ve las de su tenant.
create policy "client_users self or tenant read"
  on public.client_users for select to authenticated
  using (auth_user_id = auth.uid() or tenant_id = public.get_user_tenant_id());
-- Sin policies de INSERT/UPDATE/DELETE: solo las RPCs SECURITY DEFINER escriben.

-- Policy ADITIVA: el cliente lee SU registro en clients.
create policy "clients portal self read"
  on public.clients for select to authenticated
  using (deleted_at is null and id = public.get_portal_client_id());

-- Policy ADITIVA: el cliente lee SUS envíos (por markbox).
create policy "shipments portal self read"
  on public.shipments for select to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- ── RPCs ──

-- Admin habilita el portal de un cliente: crea/reusa client_users + token de claim.
create or replace function public.portal_invite_client(p_client_id uuid)
returns table (client_user_id uuid, claim_token text, client_email text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tenant uuid;
  v_email text;
  v_admin_tenant uuid;
  v_existing public.client_users;
  v_token text;
  v_new_id uuid;
begin
  v_admin_tenant := public.get_user_tenant_id();
  if v_admin_tenant is null then
    raise exception 'Solo un usuario del tenant puede invitar al portal' using errcode = '42501';
  end if;

  select c.tenant_id, lower(c.email) into v_tenant, v_email
  from public.clients c where c.id = p_client_id and c.deleted_at is null;
  if v_tenant is null then
    raise exception 'Cliente no encontrado';
  end if;
  if v_tenant <> v_admin_tenant then
    raise exception 'El cliente pertenece a otro tenant' using errcode = '42501';
  end if;
  if v_email is null then
    raise exception 'El cliente no tiene email — agregalo antes de invitar al portal';
  end if;

  select * into v_existing from public.client_users where client_id = p_client_id;

  -- ya activo: devolver sin re-tokenizar
  if found and v_existing.status = 'active' then
    return query select v_existing.id, v_existing.token, v_existing.email;
    return;
  end if;

  -- token url-safe (base64 → base64url, sin padding). gen_random_bytes vive en
  -- schema extensions → qualifier explícito (lección SDD-0031 / search_path).
  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(24), 'base64'), '+','-'), '/','_'), '=','');

  if found then
    update public.client_users
      set email = v_email, token = v_token, status = 'invited',
          invited_by = auth.uid(), invited_at = now(),
          auth_user_id = null, revoked_at = null
      where id = v_existing.id;
    return query select v_existing.id, v_token, v_email;
  else
    insert into public.client_users (tenant_id, client_id, email, token, status, invited_by)
    values (v_tenant, p_client_id, v_email, v_token, 'invited', auth.uid())
    returning id into v_new_id;
    return query select v_new_id, v_token, v_email;
  end if;
end;
$$;

-- Callback de login: vincula la sesión actual con su client_users invited (match por email).
create or replace function public.portal_bind_session()
returns table (client_id uuid, bound boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_row public.client_users;
begin
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return query select null::uuid, false; return;
  end if;

  -- ¿ya vinculado y activo?
  select * into v_row from public.client_users
    where auth_user_id = auth.uid() and status = 'active' limit 1;
  if found then
    update public.client_users set last_login_at = now() where id = v_row.id;
    return query select v_row.client_id, true; return;
  end if;

  -- invited con email match → bind
  select * into v_row from public.client_users
    where lower(email) = v_email and status = 'invited' limit 1;
  if not found then
    return query select null::uuid, false; return;
  end if;

  update public.client_users
    set auth_user_id = auth.uid(), status = 'active', bound_at = now(),
        last_login_at = now(), token = null
    where id = v_row.id;
  return query select v_row.client_id, true;
end;
$$;

-- Admin revoca el acceso del portal de un cliente.
create or replace function public.portal_revoke_client(p_client_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_admin_tenant uuid; v_tenant uuid;
begin
  v_admin_tenant := public.get_user_tenant_id();
  if v_admin_tenant is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select tenant_id into v_tenant from public.client_users where client_id = p_client_id;
  if v_tenant is null then return false; end if;
  if v_tenant <> v_admin_tenant then
    raise exception 'El cliente pertenece a otro tenant' using errcode = '42501';
  end if;
  update public.client_users
    set status = 'revoked', revoked_at = now(), auth_user_id = null, token = null
    where client_id = p_client_id;
  return true;
end;
$$;

grant execute on function public.portal_invite_client(uuid) to authenticated;
grant execute on function public.portal_bind_session() to authenticated;
grant execute on function public.portal_revoke_client(uuid) to authenticated;

-- Trigger updated_at (reusa function existente)
create trigger client_users_touch
  before update on public.client_users
  for each row execute function public.touch_updated_at();
