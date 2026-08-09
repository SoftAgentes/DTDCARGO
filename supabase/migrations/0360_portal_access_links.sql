-- ─────────────────────────────────────────────────────────────
-- 0360_portal_access_links.sql · SDD-0253
-- Enlace de acceso al portal corto y con marca propia.
--
-- ── Por qué existe ──────────────────────────────────────────────────────────
-- El acceso por WhatsApp mandaba el magic-link CRUDO de Supabase. Medido el
-- 2026-08-09 con DTD-9017: el robot de previsualización de WhatsApp recorrió la
-- cadena `/auth/v1/verify` → callback y **consumió el token de un solo uso antes
-- que el cliente**. Se veía como un problema estético; era un enlace muerto al
-- llegar.
--
-- La cura es meter una PÁGINA en el medio: `/entrar/<código>` no consume nada al
-- abrirse (los crawlers hacen GET), y el magic-link se acuña recién cuando el
-- cliente aprieta el botón. Esta tabla guarda esos códigos.
--
-- Efecto lateral buscado: el token deja de nacer cuando el ASESOR aprieta el
-- botón y nace cuando el CLIENTE lo lee → se acaba el TTL de 30 minutos que
-- obligaba a coordinar en vivo. El código corto dura 72 h.
--
-- ── Permisos ────────────────────────────────────────────────────────────────
-- Es una llave al portador: quien tenga el código entra como el cliente. Por eso
-- `anon` NO tiene nada acá — la ruta pública lee con `service_role`. El equipo
-- sólo puede LEER los de su tenant; crear va por RPC SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.portal_access_links (
  id          uuid primary key default extensions.gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  client_id   uuid        not null references public.clients(id) on delete cascade,
  code        text        not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

comment on table public.portal_access_links is
  'SDD-0253: códigos cortos de acceso al portal (dtdcargo.com/entrar/<code>). Llave al portador: un solo uso, vence, revocable.';
comment on column public.portal_access_links.code is
  'Código de 10 chars sobre 30 símbolos (sin 0/O/1/I/L/U) ≈ 49 bits. Es la URL que ve el cliente.';
comment on column public.portal_access_links.used_at is
  'Sellado en el POST del botón, NO al abrir la página: si se sellara en el GET, el crawler de WhatsApp lo quemaría — que es justo el bug que este SDD cierra.';

-- Búsqueda por código: es el acceso caliente de la ruta pública.
create index if not exists portal_access_links_code_idx
  on public.portal_access_links (code);
-- Listado por cliente (tarjeta del Studio: "¿qué enlaces tiene vivos?").
create index if not exists portal_access_links_client_idx
  on public.portal_access_links (tenant_id, client_id, created_at desc);

alter table public.portal_access_links enable row level security;

-- El equipo ve los de su tenant. Nada de insert/update/delete por PostgREST:
-- crear va por el RPC de abajo, y marcar usado lo hace service_role (que
-- bypassea RLS) desde `/entrar`.
drop policy if exists portal_access_links_select on public.portal_access_links;
create policy portal_access_links_select
  on public.portal_access_links
  for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

revoke all on public.portal_access_links from anon;
grant select on public.portal_access_links to authenticated;

-- ── RPC: crear un código para un cliente ───────────────────────────────────
-- SECURITY DEFINER porque `authenticated` no tiene INSERT sobre la tabla. El
-- tenant se resuelve ADENTRO con get_user_tenant_id() y se verifica contra el
-- del cliente → nadie emite una llave para un cliente de otra cuenta.
--
-- El código lo genera el caller (TypeScript) y se pasa acá: mantener la
-- generación en un solo lenguaje evita dos alfabetos que se desincronizan. El
-- unique de `code` es la red si dos llamadas chocan (probabilidad ~0 a 49 bits).
create or replace function public.portal_create_access_link(
  p_client_id  uuid,
  p_code       text,
  p_ttl_hours  integer default 72
)
returns table(link_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_tenant uuid;
  v_tenant       uuid;
  v_expires      timestamptz;
  v_id           uuid;
begin
  v_admin_tenant := public.get_user_tenant_id();
  if v_admin_tenant is null then
    raise exception 'Solo un usuario del tenant puede emitir un acceso' using errcode = '42501';
  end if;

  if p_code is null or length(p_code) < 8 then
    raise exception 'Código inválido';
  end if;
  if p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 168 then
    raise exception 'TTL fuera de rango (1..168 h)';
  end if;

  select c.tenant_id into v_tenant
    from public.clients c
   where c.id = p_client_id and c.deleted_at is null;

  if v_tenant is null then
    raise exception 'Cliente no encontrado';
  end if;
  if v_tenant <> v_admin_tenant then
    raise exception 'El cliente pertenece a otro tenant' using errcode = '42501';
  end if;

  v_expires := now() + make_interval(hours => p_ttl_hours);

  insert into public.portal_access_links (tenant_id, client_id, code, expires_at, created_by)
  values (v_tenant, p_client_id, p_code, v_expires, auth.uid())
  returning id into v_id;

  return query select v_id, v_expires;
end;
$$;

comment on function public.portal_create_access_link(uuid, text, integer) is
  'SDD-0253: emite un código corto de acceso al portal para un cliente del tenant del usuario. SECURITY DEFINER + chequeo de tenant adentro.';

revoke all on function public.portal_create_access_link(uuid, text, integer) from public, anon;
grant execute on function public.portal_create_access_link(uuid, text, integer) to authenticated;

-- ── RPC: revocar ───────────────────────────────────────────────────────────
-- Apagar una llave que se mandó al chat equivocado tiene que ser una acción, no
-- un ticket. Idempotente: revocar dos veces no es un error.
create or replace function public.portal_revoke_access_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portal_access_links
     set revoked_at = coalesce(revoked_at, now())
   where id = p_link_id
     and tenant_id = public.get_user_tenant_id();
end;
$$;

comment on function public.portal_revoke_access_link(uuid) is
  'SDD-0253: apaga un código corto de acceso. Idempotente, scopeado al tenant del usuario.';

revoke all on function public.portal_revoke_access_link(uuid) from public, anon;
grant execute on function public.portal_revoke_access_link(uuid) to authenticated;
