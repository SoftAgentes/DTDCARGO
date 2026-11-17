-- 0559_registro_link_correo_comprobado.sql · SDD-0646 (enmienda D-1, opción C)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, con el
--    name exacto `0559_registro_link_correo_comprobado`. Fusionar la PR NO
--    autoriza aplicarla.
--    ORDEN: la migración PRIMERO (migrate-first). Con la app de antes y la
--    migración aplicada, el registro por link sigue funcionando (la función de
--    vínculo acepta la cuenta de antes) y cada registro nuevo queda anotado
--    «sin comprobar»; «Registros por link» muestra «no se sabe» en vez de la
--    heurística. Con la app nueva y sin la migración, el registro por link
--    guarda la ficha y avisa «te contactamos» (no activa el acceso).
--
-- EL CORREO DEL REGISTRO POR LINK SE COMPRUEBA ANTES DE SERVIR PARA ENTRAR.
--
-- El link de registro llega por WhatsApp: prueba quién es la persona, no que el
-- correo que escribió sea suyo. Decisión de Sam (2026-11-17): el cliente sigue
-- entrando directo al terminar el formulario, pero ese correo no sirve para
-- obtener ni recuperar acceso hasta que su dueño lo confirme con un enlace de
-- un solo uso que llega a ese mismo correo y que SOLO comprueba (no abre
-- sesión).
--
-- ── Dónde vive «comprobado» y por qué ───────────────────────────────────────
-- En una tabla propia, `client_email_checks`, una fila por cliente registrado
-- por link. No sirve el `email_confirmed_at` de Auth: la entrada directa desde
-- la página lo marca sin que el correo intervenga. Y no es una columna de
-- `client_users` porque varias funciones que ya existen reescriben esa fila
-- (invitar, revocar, borrar cliente) y habría que reemplazarlas todas para que
-- no pisaran el estado.
--
-- La regla aplica SOLO a la cuenta que nació del link: la fila apunta a la
-- cuenta de Auth (`auth_user_id`) y el bloqueo exige que el acceso activo del
-- cliente siga siendo de esa cuenta. Las cuentas de la invitación por correo
-- (SDD-0042) y del registro público no tienen fila y no cambian. Si el equipo
-- revoca el acceso y vuelve a invitar por correo, el cliente pasa al camino de
-- la invitación (entra desde su correo, que es la prueba) y la fila deja de
-- aplicar.
--
-- Mientras no esté comprobado, la cuenta de Auth lleva una dirección interna
-- que no recibe correo (dominio reservado `.invalid`, con un id aleatorio: no
-- sale del Shipping Mark, del nombre ni del correo). El correo real queda en
-- la ficha y en `pending_email`. Al confirmar, la app pasa el correo real a la
-- cuenta y recién ahí queda habilitado.
--
-- ── Qué trae ────────────────────────────────────────────────────────────────
--   1. `client_email_checks` (RLS: el equipo lee su tenant; nadie escribe por
--      PostgREST).
--   2. `portal_registration_link_bind` (cuerpo de la 0552, md5 9dc4862d…):
--      ahora acepta la cuenta con dirección interna y anota la fila «sin
--      comprobar». Sigue aceptando la cuenta de antes (correo real) para no
--      romper la app anterior entre la migración y la publicación.
--   3. Las RPC del enlace de comprobación: emitir, mirar (GET), reclamar,
--      confirmar y soltar (POST); todas solo `service_role`. Y la que prepara
--      el reenvío desde Studio (equipo, rol y tenant).
--   4. `portal_email_sin_comprobar(correo)`: la pregunta que hacen los caminos
--      que mandan un enlace de entrada.
--   5. Un trigger en `clients`: si cambia el correo de la ficha, la fila vuelve
--      a «sin comprobar» y el enlace emitido deja de servir.
--   6. Las cuentas por link que ya existen quedan «sin comprobar».
--   7. Se retira `portal_registration_link_email_status` (la heurística de
--      «volvió a entrar más de 1 h después»).

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Preflight
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
begin
  if pg_catalog.to_regclass('public.client_registration_links') is null then
    raise exception '0559 abortado: falta client_registration_links (migración 0552)';
  end if;
  if pg_catalog.to_regclass('public.client_email_checks') is not null then
    raise exception '0559 abortado: client_email_checks ya existe; no reaplicar';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_bind(uuid,uuid)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = '9dc4862d3d6d1a9fe43726203322b2cd'
  ) then
    raise exception '0559 abortado: portal_registration_link_bind no es el cuerpo de la 0552; leer el vivo antes de reemplazarlo';
  end if;
end;
$preflight$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La tabla
-- ─────────────────────────────────────────────────────────────────────────────

create table public.client_email_checks (
  id               uuid primary key default extensions.gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,
  client_id        uuid        not null unique references public.clients(id) on delete cascade,
  link_id          uuid        references public.client_registration_links(id) on delete set null,
  -- La cuenta de Auth que nació del link. La regla sólo aplica mientras el
  -- acceso activo del cliente sea de esta cuenta.
  auth_user_id     uuid        not null,
  -- Dirección que lleva la cuenta de Auth mientras no se compruebe. No recibe
  -- correo y no dice nada del cliente.
  internal_email   text        not null unique
                     check (internal_email ~ '^c-[0-9a-f]{32}@sin-comprobar\.invalid$'),
  -- El correo por comprobar (el de la ficha), en minúsculas.
  pending_email    text,
  -- ¿La cuenta de Auth ya lleva la dirección interna? Falso en las cuentas
  -- creadas antes de esta migración y después de corregir un correo comprobado,
  -- hasta que la app la cambia.
  auth_interno     boolean     not null default false,
  token_hash       text        unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  token_used_at    timestamptz,
  sent_at          timestamptz,
  sent_count       integer     not null default 0,
  verified_at      timestamptz,
  -- Al confirmar, ese correo ya tenía otra cuenta. No se fusiona nada: lo
  -- resuelve el equipo.
  conflict_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.client_email_checks is
  'SDD-0646 D-1 (opción C): estado «correo comprobado» de la cuenta del portal que nació de un link de registro. Sin fila = cuenta de otro camino, la regla no aplica. verified_at vacío = el correo no sirve para obtener ni recuperar acceso.';
comment on column public.client_email_checks.token_hash is
  'sha256 hex del token del enlace de comprobación. El token no se guarda. El enlace sólo comprueba el correo: no abre sesión.';

create index client_email_checks_link_idx on public.client_email_checks (link_id);
create index client_email_checks_pending_idx
  on public.client_email_checks (pending_email) where verified_at is null;

alter table public.client_email_checks enable row level security;

create policy client_email_checks_select
  on public.client_email_checks
  for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

revoke all on public.client_email_checks from public, anon, authenticated;
grant select on public.client_email_checks to authenticated;

-- Dirección interna nueva: id aleatorio, dominio reservado que no recibe correo.
create function public.portal_email_interno_nuevo()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'c-' || replace(extensions.gen_random_uuid()::text, '-', '') || '@sin-comprobar.invalid';
$$;

revoke all on function public.portal_email_interno_nuevo() from public, anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vincular el acceso: anota «sin comprobar»
--
-- Cuerpo de la 0552 más dos cosas: acepta la cuenta que lleva la dirección
-- interna, y deja la fila de `client_email_checks`. La cuenta con el correo
-- real (app anterior) se sigue aceptando y queda anotada con
-- `auth_interno = false`: la app la pasa a la dirección interna después.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.portal_registration_link_bind(
  p_link_id      uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l         public.client_registration_links;
  v_email   text;
  v_real    text;
  v_interno boolean;
begin
  select * into l from public.client_registration_links x where x.id = p_link_id for update;
  if l.id is null or l.used_at is null or l.used_at < now() - interval '10 minutes' then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select lower(au.email) into v_email from auth.users au where au.id = p_auth_user_id;
  v_real := lower(l.submitted_data ->> 'email');
  v_interno := coalesce(v_email ~ '^c-[0-9a-f]{32}@sin-comprobar\.invalid$', false);
  if v_email is null or (not v_interno and v_email is distinct from v_real) then
    raise exception 'La cuenta no es la del registro' using errcode = '22023';
  end if;

  insert into public.client_users as u
    (tenant_id, client_id, email, auth_user_id, status, invited_at, bound_at, revoked_at)
  values (l.tenant_id, l.client_id, v_email, p_auth_user_id, 'active', now(), now(), null)
  on conflict (tenant_id, client_id) do update
     set email = excluded.email,
         auth_user_id = excluded.auth_user_id,
         status = 'active',
         invited_at = coalesce(u.invited_at, excluded.invited_at),
         bound_at = excluded.bound_at,
         revoked_at = null
   where u.status <> 'active';

  if not found then
    raise exception 'El cliente ya tiene acceso al portal' using errcode = '22023';
  end if;

  insert into public.client_email_checks as ch
    (tenant_id, client_id, link_id, auth_user_id, internal_email, pending_email, auth_interno)
  values (
    l.tenant_id, l.client_id, l.id, p_auth_user_id,
    case when v_interno then v_email else public.portal_email_interno_nuevo() end,
    v_real, v_interno
  )
  on conflict (client_id) do update
     set link_id = excluded.link_id,
         auth_user_id = excluded.auth_user_id,
         internal_email = excluded.internal_email,
         pending_email = excluded.pending_email,
         auth_interno = excluded.auth_interno,
         token_hash = null, token_expires_at = null, token_used_at = null,
         sent_at = null, sent_count = 0,
         verified_at = null, conflict_at = null,
         updated_at = now();

  update public.client_registration_links x set access_error = null where x.id = l.id;
end;
$$;

revoke all on function public.portal_registration_link_bind(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_registration_link_bind(uuid, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ¿Este correo está sin comprobar? (lo preguntan los caminos que mandan un
--    enlace de entrada; sólo service_role)
--
--   bloquea   → la dirección es interna, o es el correo del acceso activo de
--               una cuenta por link sin comprobar: no se le manda ningún
--               enlace de entrada.
--   pendiente → es el correo por comprobar de alguna cuenta por link.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_sin_comprobar(p_email text)
returns table (bloquea boolean, pendiente boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_email, ''))) as e)
  select
    (q.e ~ '@sin-comprobar\.invalid$')
    or exists (
      select 1
        from public.client_email_checks ch
        join public.client_users cu
          on cu.tenant_id = ch.tenant_id and cu.client_id = ch.client_id
         and cu.auth_user_id = ch.auth_user_id and cu.status = 'active'
       where ch.verified_at is null
         and lower(cu.email) = q.e
    ),
    exists (
      select 1 from public.client_email_checks ch
       where ch.verified_at is null and ch.pending_email = q.e
    )
  from q;
$$;

comment on function public.portal_email_sin_comprobar(text) is
  'SDD-0646 D-1: si un correo no puede recibir un enlace de entrada porque es de una cuenta por link sin comprobar. Sólo service_role.';

revoke all on function public.portal_email_sin_comprobar(text) from public, anon, authenticated;
grant execute on function public.portal_email_sin_comprobar(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Reenviar desde Studio: preparar (equipo, rol y tenant)
--
-- Deja `pending_email` igual al correo de la ficha (la ficha manda) y devuelve
-- lo que la app necesita para pasar la cuenta a la dirección interna antes de
-- emitir. No emite nada.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_check_prepare(p_link_id uuid)
returns table (check_id uuid, auth_user_id uuid, internal_email text, auth_interno boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch      public.client_email_checks;
  c       public.clients;
  v_email text;
begin
  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  select * into ch from public.client_email_checks x where x.link_id = p_link_id for update;
  if ch.id is null then
    raise exception 'sin_registro' using errcode = 'P0002';
  end if;
  perform public.assert_tenant_match(ch.tenant_id);

  if ch.verified_at is not null then
    raise exception 'ya_comprobado' using errcode = '22023';
  end if;

  select * into c from public.clients x where x.id = ch.client_id;
  if c.id is null or c.deleted_at is not null or not exists (
    select 1 from public.client_users u
     where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
       and u.auth_user_id = ch.auth_user_id and u.status = 'active'
  ) then
    raise exception 'sin_acceso' using errcode = '22023';
  end if;

  v_email := nullif(lower(btrim(coalesce(c.email, ''))), '');
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'sin_correo' using errcode = '22023';
  end if;

  if v_email is distinct from ch.pending_email then
    update public.client_email_checks x
       set pending_email = v_email,
           token_hash = null, token_expires_at = null, token_used_at = null,
           conflict_at = null, updated_at = now()
     where x.id = ch.id;
  end if;

  return query select ch.id, ch.auth_user_id, ch.internal_email, ch.auth_interno;
end;
$$;

revoke all on function public.portal_email_check_prepare(uuid) from public, anon, service_role;
grant execute on function public.portal_email_check_prepare(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. La cuenta de Auth ya lleva la dirección interna (lo anota la app después
--    de cambiarla con la API de Auth). La base lo comprueba contra auth.users.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_check_auth_interno(p_check_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.client_email_checks;
begin
  select * into ch from public.client_email_checks x where x.id = p_check_id for update;
  if ch.id is null or ch.verified_at is not null then
    raise exception 'sin_registro' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from auth.users au
     where au.id = ch.auth_user_id and lower(au.email) = ch.internal_email
  ) then
    raise exception 'La cuenta todavía no lleva la dirección interna' using errcode = '22023';
  end if;

  update public.client_email_checks x
     set auth_interno = true, updated_at = now()
   where x.id = ch.id;
  update public.client_users u
     set email = ch.internal_email
   where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
     and u.auth_user_id = ch.auth_user_id;
end;
$$;

revoke all on function public.portal_email_check_auth_interno(uuid) from public, anon, authenticated;
grant execute on function public.portal_email_check_auth_interno(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Emitir el enlace de comprobación (service_role)
--
-- Un solo enlace vivo por cuenta: emitir otro reemplaza el anterior. Vence a
-- los 7 días. Sólo si la cuenta de Auth ya lleva la dirección interna.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_check_issue(p_check_id uuid, p_token_hash text)
returns table (tenant_id uuid, markbox text, pending_email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch        public.client_email_checks;
  c         public.clients;
  v_expires timestamptz := now() + interval '7 days';
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token inválido' using errcode = '22023';
  end if;

  select * into ch from public.client_email_checks x where x.id = p_check_id for update;
  if ch.id is null then
    raise exception 'sin_registro' using errcode = 'P0002';
  end if;
  if ch.verified_at is not null then
    raise exception 'ya_comprobado' using errcode = '22023';
  end if;
  if not ch.auth_interno then
    raise exception 'La cuenta todavía no lleva la dirección interna' using errcode = '22023';
  end if;
  if ch.pending_email is null or ch.pending_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'sin_correo' using errcode = '22023';
  end if;

  select * into c from public.clients x where x.id = ch.client_id;
  if c.id is null or c.deleted_at is not null or not exists (
    select 1 from public.client_users u
     where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
       and u.auth_user_id = ch.auth_user_id and u.status = 'active'
  ) then
    raise exception 'sin_acceso' using errcode = '22023';
  end if;

  update public.client_email_checks x
     set token_hash = p_token_hash,
         token_expires_at = v_expires,
         token_used_at = null,
         conflict_at = null,
         sent_at = now(),
         sent_count = x.sent_count + 1,
         updated_at = now()
   where x.id = ch.id;

  return query select ch.tenant_id, c.markbox, ch.pending_email, v_expires;
end;
$$;

revoke all on function public.portal_email_check_issue(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_email_check_issue(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Mirar el enlace (ruta pública, GET). Sólo lee: un robot de vista previa o
--    un filtro de correo que abra el enlace no lo gasta. Devuelve sólo el
--    código, y sólo si el enlace sirve.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_check_peek(p_token_hash text)
returns table (markbox text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.markbox
    from public.client_email_checks ch
    join public.clients c on c.id = ch.client_id
   where ch.token_hash = p_token_hash
     and ch.token_used_at is null
     and ch.token_expires_at > now()
     and ch.verified_at is null
     and ch.conflict_at is null
     and ch.auth_interno
     and c.deleted_at is null
     and exists (
       select 1 from public.client_users u
        where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
          and u.auth_user_id = ch.auth_user_id and u.status = 'active'
     );
$$;

revoke all on function public.portal_email_check_peek(text) from public, anon, authenticated;
grant execute on function public.portal_email_check_peek(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Confirmar (ruta pública, POST), en tres pasos
--
--   claim   → reclama el enlace (un solo uso, atómico). Si ese correo ya tiene
--             otra cuenta de Auth, lo marca como choque y lo dice; no fusiona.
--   (la app pasa el correo real a la cuenta con la API de Auth)
--   confirm → marca comprobado. La base exige que la cuenta YA lleve ese
--             correo: sin el paso de Auth no hay «comprobado».
--   release → si el paso de Auth falló: suelta el enlace para reintentar, o lo
--             deja marcado como choque.
-- Ninguno abre sesión ni devuelve nada con qué abrirla.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_email_check_claim(p_token_hash text)
returns table (check_id uuid, auth_user_id uuid, pending_email text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch        public.client_email_checks;
  v_choque  boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select * into ch from public.client_email_checks x
   where x.token_hash = p_token_hash for update;
  if ch.id is null or ch.token_used_at is not null or ch.token_expires_at <= now()
     or ch.verified_at is not null or ch.conflict_at is not null
     or not ch.auth_interno or ch.pending_email is null
     or not exists (
       select 1 from public.clients c where c.id = ch.client_id and c.deleted_at is null
     )
     or not exists (
       select 1 from public.client_users u
        where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
          and u.auth_user_id = ch.auth_user_id and u.status = 'active'
     ) then
    return;
  end if;

  v_choque := exists (
    select 1 from auth.users au
     where lower(au.email) = ch.pending_email and au.id <> ch.auth_user_id
  );

  update public.client_email_checks x
     set token_used_at = now(),
         conflict_at = case when v_choque then now() else null end,
         updated_at = now()
   where x.id = ch.id;

  return query select ch.id, ch.auth_user_id, ch.pending_email,
                      case when v_choque then 'conflicto' else 'ok' end;
end;
$$;

revoke all on function public.portal_email_check_claim(text) from public, anon, authenticated;
grant execute on function public.portal_email_check_claim(text) to service_role;

create function public.portal_email_check_confirm(p_check_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.client_email_checks;
begin
  select * into ch from public.client_email_checks x where x.id = p_check_id for update;
  if ch.id is null or ch.token_used_at is null or ch.verified_at is not null
     or ch.conflict_at is not null or ch.pending_email is null then
    raise exception 'enlace_invalido' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from auth.users au
     where au.id = ch.auth_user_id and lower(au.email) = ch.pending_email
  ) then
    raise exception 'La cuenta todavía no lleva el correo comprobado' using errcode = '22023';
  end if;

  update public.client_email_checks x
     set verified_at = now(), auth_interno = false, updated_at = now()
   where x.id = ch.id;
  update public.client_users u
     set email = ch.pending_email
   where u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
     and u.auth_user_id = ch.auth_user_id;
end;
$$;

revoke all on function public.portal_email_check_confirm(uuid) from public, anon, authenticated;
grant execute on function public.portal_email_check_confirm(uuid) to service_role;

create function public.portal_email_check_release(p_check_id uuid, p_conflicto boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.client_email_checks x
     set token_used_at = case when coalesce(p_conflicto, false) then x.token_used_at else null end,
         conflict_at   = case when coalesce(p_conflicto, false) then now() else x.conflict_at end,
         updated_at    = now()
   where x.id = p_check_id
     and x.verified_at is null
     and x.token_used_at is not null;
$$;

revoke all on function public.portal_email_check_release(uuid, boolean) from public, anon, authenticated;
grant execute on function public.portal_email_check_release(uuid, boolean) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Si cambia el correo de la ficha, vuelve a «sin comprobar»
--
-- Lo corrija el equipo o cualquier otro camino: el correo nuevo nace sin
-- comprobar, el enlace emitido deja de servir y el acceso deja de responder al
-- correo anterior. Si estaba comprobado, la cuenta de Auth todavía lleva el
-- correo anterior: `auth_interno` queda en falso hasta que la app la pasa a la
-- dirección interna.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.clients_email_vuelve_sin_comprobar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  v_old text := nullif(lower(btrim(coalesce(old.email, ''))), '');
begin
  if v_new is distinct from v_old then
    update public.client_users u
       set email = ch.internal_email
      from public.client_email_checks ch
     where ch.client_id = new.id
       and ch.pending_email is distinct from v_new
       and u.tenant_id = ch.tenant_id and u.client_id = ch.client_id
       and u.auth_user_id = ch.auth_user_id;

    update public.client_email_checks ch
       set pending_email = v_new,
           auth_interno = case when ch.verified_at is not null then false else ch.auth_interno end,
           verified_at = null,
           token_hash = null, token_expires_at = null, token_used_at = null,
           conflict_at = null,
           updated_at = now()
     where ch.client_id = new.id
       and ch.pending_email is distinct from v_new;
  end if;
  return new;
end;
$$;

revoke all on function public.clients_email_vuelve_sin_comprobar() from public, anon, authenticated, service_role;

create trigger clients_email_vuelve_sin_comprobar_t
  after update of email on public.clients
  for each row execute function public.clients_email_vuelve_sin_comprobar();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Las cuentas por link que ya existen quedan «sin comprobar»
--
-- Una fila por cliente con un link usado y acceso activo vinculado desde ese
-- registro. `auth_interno = false`: la cuenta de Auth todavía lleva el correo
-- real; pasarla a la dirección interna necesita la API de Auth (el botón
-- «Reenviar comprobación» o la corrida única de infra/ops). Pocas filas, sin
-- locks largos.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.client_email_checks
  (tenant_id, client_id, link_id, auth_user_id, internal_email, pending_email, auth_interno)
select distinct on (l.client_id)
       l.tenant_id, l.client_id, l.id, cu.auth_user_id,
       public.portal_email_interno_nuevo(),
       coalesce(nullif(lower(btrim(coalesce(c.email, ''))), ''), lower(cu.email)),
       false
  from public.client_registration_links l
  join public.clients c on c.id = l.client_id and c.deleted_at is null
  join public.client_users cu
    on cu.tenant_id = l.tenant_id and cu.client_id = l.client_id
   and cu.status = 'active' and cu.auth_user_id is not null
   and cu.bound_at >= l.used_at
 where l.used_at is not null
 order by l.client_id, l.used_at desc
on conflict (client_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Se retira la heurística de la 0552 (7b): «Registros por link» lee el
--     estado real de `client_email_checks`.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.portal_registration_link_email_status(uuid[]);
