-- 0552_registro_portal_por_link.sql · SDD-0646
--
-- INVITACIÓN AL PORTAL POR LINK PARA LOS CLIENTES VIEJOS.
--
-- En agosto de 2026 entraron 361 clientes del sistema anterior (DTD-8001 a
-- DTD-8361; su código viejo quedó como alias en `client_markbox_history`). Casi
-- ninguno tiene correo, así que la invitación por correo (SDD-0042) no les llega.
-- Sam decidió el 2026-11-16: el equipo genera desde la ficha un link de registro,
-- lo manda por WhatsApp, y el cliente completa SU ficha con su código ya fijo.
--
-- Esta migración trae cuatro piezas:
--
--   1. `client_registration_links`: el link (hash del token, un solo uso, 14 días)
--      y, una vez usado, lo que el cliente escribió al lado de lo que tenía la
--      ficha, para que el equipo lo revise («Registros por link»).
--   2. Las RPC del link: crear (equipo), mirar y completar (ruta pública con
--      service_role) y marcar comprobado (equipo).
--   3. `rename_client_markbox` deja que un cliente RECUPERE SU PROPIO código
--      retirado (la fila del historial queda marcada como restaurada, no se
--      borra). Sigue prohibido para cualquier otro cliente.
--   4. Un candado al insertar en `clients`: un código retirado no se puede dar a
--      una ficha nueva escrita a mano (el alta del Studio ahora acepta el código).
--
-- ── Por qué una tabla nueva y no `client_change_requests` (SDD-0151) ──────────
-- Aquella tabla es una PROPUESTA que el asesor aprueba antes de tocar `clients`,
-- con tres campos (nombre, documento, teléfono) y una sola abierta por cliente.
-- Acá el cliente completa la ficha EN EL ACTO (es su primer acceso, hay que
-- dejarlo dentro) y el equipo revisa DESPUÉS; además entran correo, ciudad,
-- estado y dirección. Meterlo ahí cambiaría el significado de `status`/`pending`
-- para todas las pantallas que ya la leen. El token y la revisión viven en la
-- misma fila: un link usado ES el registro a revisar.
--
-- ── El link no lleva el Shipping Mark ────────────────────────────────────────
-- Si la URL llevara el código, cualquiera podría cambiar el número y quedarse con
-- el portal de otro cliente. La URL lleva SOLO el token (32 bytes aleatorios, 256
-- bits) y la base guarda su sha256: quien lea la tabla no puede armar el link.
--
-- Preflight: los dos cuerpos que se reemplazan se comparan por md5 contra su
-- última definición en el repo (0371 y 0342). Si producción tiene otro cuerpo,
-- la migración aborta en vez de pisarlo (regla de la cabecera de la 0361).

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Preflight
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.rename_client_markbox(uuid,text,text)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = 'ed233ed2354925960ffc4cd798f8549f'
  ) then
    raise exception '0552 abortado: rename_client_markbox no es el cuerpo de la 0371; leer el vivo antes de reemplazarlo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.find_duplicate_client_service(uuid,text,text,text)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = '61d5707d7c63d2c3647a554a497c7569'
  ) then
    raise exception '0552 abortado: find_duplicate_client_service no es el cuerpo de la 0342; leer el vivo antes de reemplazarlo';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute
              where attrelid = 'public.client_markbox_history'::pg_catalog.regclass
                and attname = 'restored_at' and not attisdropped) then
    raise exception '0552 abortado: client_markbox_history.restored_at ya existe; no reaplicar';
  end if;
  if pg_catalog.to_regclass('public.client_registration_links') is not null then
    raise exception '0552 abortado: client_registration_links ya existe; no reaplicar';
  end if;
end;
$preflight$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La tabla
-- ─────────────────────────────────────────────────────────────────────────────

create table public.client_registration_links (
  id                   uuid primary key default extensions.gen_random_uuid(),
  tenant_id            uuid        not null references public.tenants(id) on delete cascade,
  client_id            uuid        not null references public.clients(id) on delete cascade,
  token_hash           text        not null unique
                         check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at           timestamptz not null,
  used_at              timestamptz,
  revoked_at           timestamptz,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  -- Lo que tenía la ficha justo antes y lo que escribió el cliente. Sólo en un
  -- link usado.
  prev_data            jsonb,
  submitted_data       jsonb,
  -- Otra ficha con la misma cédula, correo o teléfono. No se fusiona sola: el
  -- equipo la resuelve en /studio/clientes/duplicados.
  duplicate_client_id  uuid references public.clients(id) on delete set null,
  duplicate_matched_by text check (duplicate_matched_by in ('documento', 'correo', 'telefono')),
  -- La cédula no se escribió porque otra ficha ya la tiene (índice único).
  rif_skipped          boolean not null default false,
  -- El acceso al portal no se pudo crear después de completar la ficha.
  access_error         text,
  reviewed_at          timestamptz,
  reviewed_by          uuid,
  constraint client_registration_links_used_has_data
    check (used_at is null or (prev_data is not null and submitted_data is not null))
);

comment on table public.client_registration_links is
  'SDD-0646: link de registro al portal para un cliente que ya tiene ficha (los 361 del legado). Token de un solo uso, 14 días, guardado como sha256. Usado = registro que el equipo revisa en «Registros por link».';
comment on column public.client_registration_links.token_hash is
  'sha256 hex del token de la URL. El token no se guarda: quien lea la tabla no puede armar el link.';

-- Un solo link vivo por cliente: crear uno nuevo revoca el anterior (RPC), y el
-- índice lo garantiza aunque dos asesores aprieten a la vez.
create unique index client_registration_links_one_open
  on public.client_registration_links (client_id)
  where used_at is null and revoked_at is null;

create index client_registration_links_review_idx
  on public.client_registration_links (tenant_id, used_at desc)
  where used_at is not null;

alter table public.client_registration_links enable row level security;

-- El equipo lee los de su tenant. Ninguna escritura por PostgREST: todo va por
-- las RPC de abajo (security definer).
create policy client_registration_links_select
  on public.client_registration_links
  for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

revoke all on public.client_registration_links from public, anon;
grant select on public.client_registration_links to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Duplicados: una sola regla, con exclusión
--
-- `find_duplicate_client_service` devuelve UNA ficha (limit 1). Al completar la
-- ficha propia, esa ficha suele coincidir consigo misma (mismo teléfono del
-- legado) y taparía al duplicado real. En vez de copiar la regla, se mueve a una
-- función con `p_except_client_id` y la vieja pasa a llamarla con NULL: mismo
-- resultado para el registro de siempre, una sola definición.
-- Cuerpo copiado de la 0342:82-125; lo único nuevo es `c.id is distinct from`.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.find_duplicate_client_except_service(
  p_tenant_id        uuid,
  p_except_client_id uuid,
  p_document         text default null,
  p_email            text default null,
  p_phone            text default null
)
returns table (client_id uuid, matched_by text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select
      nullif(upper(regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')), '') as doc,
      nullif(lower(btrim(coalesce(p_email, ''))), '') as em,
      public.phone_match_key(p_phone) as tel
  )
  select
    c.id,
    case
      when q.doc is not null
        and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc
        then 'documento'
      when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em
        then 'correo'
      else 'telefono'
    end
  from public.clients c, q
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.id is distinct from p_except_client_id
    and (
         (q.doc is not null
           and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc)
      or (q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em)
      or (q.tel is not null and public.phone_match_key(c.phone) = q.tel)
    )
  order by case
    when q.doc is not null
      and upper(regexp_replace(coalesce(c.rif, ''), '[^A-Za-z0-9]', '', 'g')) = q.doc then 0
    when q.em is not null and lower(btrim(coalesce(c.email, ''))) = q.em then 1
    else 2 end
  limit 1;
$$;

create or replace function public.find_duplicate_client_service(
  p_tenant_id uuid,
  p_document text default null,
  p_email text default null,
  p_phone text default null
)
returns table (client_id uuid, matched_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.client_id, d.matched_by
    from public.find_duplicate_client_except_service(p_tenant_id, null, p_document, p_email, p_phone) d;
$$;

revoke all on function public.find_duplicate_client_except_service(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.find_duplicate_client_except_service(uuid, uuid, text, text, text)
  to service_role;
revoke all on function public.find_duplicate_client_service(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.find_duplicate_client_service(uuid, text, text, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Crear el link (equipo)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_create(
  p_client_id  uuid,
  p_token_hash text
)
returns table (link_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c         public.clients;
  v_expires timestamptz := now() + interval '14 days';
  v_id      uuid;
begin
  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token inválido' using errcode = '22023';
  end if;

  select * into c from public.clients where id = p_client_id for update;
  if c.id is null or c.deleted_at is not null then
    raise exception 'No existe el cliente' using errcode = 'P0002';
  end if;
  if c.merged_into_client_id is not null then
    raise exception 'Esa ficha ya fue fusionada' using errcode = '22023';
  end if;
  perform public.assert_tenant_match(c.tenant_id);

  if exists (
    select 1 from public.client_users u
     where u.tenant_id = c.tenant_id and u.client_id = c.id and u.status = 'active'
  ) then
    raise exception 'El cliente ya tiene acceso al portal' using errcode = '22023';
  end if;

  -- Regenerar revoca el anterior: el link viejo deja de abrir en el acto.
  update public.client_registration_links l
     set revoked_at = now()
   where l.client_id = c.id and l.used_at is null and l.revoked_at is null;

  insert into public.client_registration_links (tenant_id, client_id, token_hash, expires_at, created_by)
  values (c.tenant_id, c.id, p_token_hash, v_expires, auth.uid())
  returning id into v_id;

  return query select v_id, v_expires;
end;
$$;

comment on function public.portal_registration_link_create(uuid, text) is
  'SDD-0646: emite el link de registro de un cliente sin acceso al portal. Revoca el anterior. Roles admin, commercial y operations, tenant del usuario.';

revoke all on function public.portal_registration_link_create(uuid, text) from public, anon, service_role;
grant execute on function public.portal_registration_link_create(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Mirar el link (ruta pública, GET)
--
-- Sólo lee: el robot de vista previa de WhatsApp hace GET y no debe gastar nada
-- (lección de la SDD-0253). Devuelve SOLO el código, y sólo si el link sirve: el
-- nombre de la ficha no sale a una página que abre cualquiera con el link. Si no
-- sirve, ninguna fila — el visitante ve un único mensaje para todos los casos.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_peek(p_token_hash text)
returns table (markbox text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.markbox
    from public.client_registration_links l
    join public.clients c on c.id = l.client_id
   where l.token_hash = p_token_hash
     and l.used_at is null
     and l.revoked_at is null
     and l.expires_at > now()
     and c.deleted_at is null
     and c.merged_into_client_id is null
     and not exists (
       select 1 from public.client_users u
        where u.tenant_id = c.tenant_id and u.client_id = c.id and u.status = 'active'
     );
$$;

revoke all on function public.portal_registration_link_peek(text) from public, anon, authenticated;
grant execute on function public.portal_registration_link_peek(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Completar la ficha (ruta pública, POST)
--
-- Todo o nada sobre la ficha y el link. NO crea una ficha ni un código: no hay
-- `next_markbox` acá. La cuenta de auth y el vínculo `client_users` los crea la
-- app después (necesitan la API de Auth); si eso falla, queda `access_error`.
--
-- Errores con mensaje fijo, que la app traduce:
--   P0002 'link_invalido'  → no existe, usado, revocado, vencido o la ficha ya no sirve
--   23505 'correo_en_uso'  → ese correo ya tiene una cuenta; NO gasta el link
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_complete(
  p_token_hash   text,
  p_kind         text,
  p_name         text,
  p_company      text,
  p_document     text,
  p_email        text,
  p_phone        text,
  p_office_phone text,
  p_city         text,
  p_state        text,
  p_address      text,
  p_email_optin  boolean
)
returns table (
  client_id     uuid,
  tenant_id     uuid,
  markbox       text,
  email         text,
  link_id       uuid,
  duplicate_matched_by text,
  rif_skipped   boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l          public.client_registration_links;
  c          public.clients;
  v_kind     text := case when p_kind = 'empresa' then 'empresa' else 'persona' end;
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_name     text := nullif(btrim(coalesce(p_name, '')), '');
  v_company  text := nullif(btrim(coalesce(p_company, '')), '');
  v_doc      text := nullif(btrim(coalesce(p_document, '')), '');
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
  v_city     text := nullif(btrim(coalesce(p_city, '')), '');
  v_state    text := nullif(btrim(coalesce(p_state, '')), '');
  v_address  text := nullif(btrim(coalesce(p_address, '')), '');
  v_office   text := nullif(btrim(coalesce(p_office_phone, '')), '');
  v_dup_id   uuid;
  v_dup_by   text;
  v_skip_rif boolean := false;
  v_prev     jsonb;
  v_sub      jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;
  -- La app ya validó con validateRegisterInput; esto es la red de la base.
  if v_name is null or v_doc is null or v_phone is null or v_city is null or v_state is null
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or (v_kind = 'empresa' and v_company is null) then
    raise exception 'datos_incompletos' using errcode = '22023';
  end if;

  select * into l from public.client_registration_links x
   where x.token_hash = p_token_hash for update;
  if l.id is null or l.used_at is not null or l.revoked_at is not null or l.expires_at <= now() then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select * into c from public.clients x where x.id = l.client_id for update;
  if c.id is null or c.deleted_at is not null or c.merged_into_client_id is not null
     or exists (
       select 1 from public.client_users u
        where u.tenant_id = c.tenant_id and u.client_id = c.id and u.status = 'active'
     ) then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  -- Correo con cuenta: no se puede crear el acceso con él. Se rechaza ANTES de
  -- tocar nada, para que el cliente corrija el correo con el mismo link.
  if exists (select 1 from auth.users au where lower(au.email) = v_email) then
    raise exception 'correo_en_uso' using errcode = '23505';
  end if;

  select d.client_id, d.matched_by into v_dup_id, v_dup_by
    from public.find_duplicate_client_except_service(c.tenant_id, c.id, v_doc, v_email, v_phone) d;

  v_prev := jsonb_build_object(
    'name', c.name, 'contact_name', c.contact_name, 'rif', c.rif, 'doc_kind', c.doc_kind,
    'email', c.email, 'phone', c.phone, 'city', c.city, 'state', c.state, 'address', c.address
  );
  v_sub := jsonb_build_object(
    'kind', v_kind, 'name', v_name, 'company', v_company, 'document', v_doc,
    'email', v_email, 'phone', v_phone, 'office_phone', v_office,
    'city', v_city, 'state', v_state, 'address', v_address,
    'email_optin', coalesce(p_email_optin, false)
  );

  -- La cédula de otra ficha no se copia: el índice único la rechazaría y, sobre
  -- todo, decidir de quién es le toca al equipo (duplicados), no a este POST.
  v_skip_rif := coalesce(v_dup_by = 'documento', false);

  begin
    update public.clients x
       set name         = coalesce(v_company, v_name),
           contact_name = case when v_kind = 'empresa' then v_name else x.contact_name end,
           rif          = case when v_skip_rif then x.rif else v_doc end,
           doc_kind     = v_kind,
           email        = v_email,
           phone        = v_phone,
           city         = v_city,
           state        = v_state,
           address      = coalesce(v_address, x.address),
           email_marketing_optin_at = case when p_email_optin then coalesce(x.email_marketing_optin_at, now())
                                           else x.email_marketing_optin_at end,
           email_optin_source = case when p_email_optin and x.email_marketing_optin_at is null
                                     then 'portal_register_link' else x.email_optin_source end,
           portal_approved_at = coalesce(x.portal_approved_at, now())
     where x.id = c.id;
  exception when unique_violation then
    -- Una ficha borrada que conserva la cédula no aparece en el buscador de
    -- duplicados pero sí en el índice. Se completa todo menos la cédula.
    v_skip_rif := true;
    update public.clients x
       set name         = coalesce(v_company, v_name),
           contact_name = case when v_kind = 'empresa' then v_name else x.contact_name end,
           doc_kind     = v_kind,
           email        = v_email,
           phone        = v_phone,
           city         = v_city,
           state        = v_state,
           address      = coalesce(v_address, x.address),
           email_marketing_optin_at = case when p_email_optin then coalesce(x.email_marketing_optin_at, now())
                                           else x.email_marketing_optin_at end,
           email_optin_source = case when p_email_optin and x.email_marketing_optin_at is null
                                     then 'portal_register_link' else x.email_optin_source end,
           portal_approved_at = coalesce(x.portal_approved_at, now())
     where x.id = c.id;
  end;

  update public.client_registration_links x
     set used_at = now(),
         prev_data = v_prev,
         submitted_data = v_sub,
         duplicate_client_id = v_dup_id,
         duplicate_matched_by = v_dup_by,
         rif_skipped = v_skip_rif
   where x.id = l.id;

  return query select c.id, c.tenant_id, c.markbox, v_email, l.id, v_dup_by, v_skip_rif;
end;
$$;

comment on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean) is
  'SDD-0646: el cliente completa SU ficha con el link. Sin ficha nueva ni código nuevo. Gasta el link; guarda antes/después para la revisión del equipo y marca el duplicado sin fusionar.';

revoke all on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Vincular el acceso (ruta pública, después de crear la cuenta de auth)
--
-- `client_users` tiene un vínculo por cliente (unique tenant_id, client_id): si
-- quedó uno revocado o invitado, se reutiliza. Sólo sirve para un link recién
-- usado (10 minutos) y que todavía no tiene acceso: no es una puerta general
-- para enlazar cuentas a fichas.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_bind(
  p_link_id      uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l       public.client_registration_links;
  v_email text;
begin
  select * into l from public.client_registration_links x where x.id = p_link_id for update;
  if l.id is null or l.used_at is null or l.used_at < now() - interval '10 minutes' then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select lower(au.email) into v_email from auth.users au where au.id = p_auth_user_id;
  if v_email is null or v_email is distinct from (l.submitted_data ->> 'email') then
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

  update public.client_registration_links x set access_error = null where x.id = l.id;
end;
$$;

revoke all on function public.portal_registration_link_bind(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_registration_link_bind(uuid, uuid) to service_role;

create function public.portal_registration_link_access_error(p_link_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.client_registration_links
     set access_error = left(coalesce(nullif(btrim(p_error), ''), 'sin detalle'), 500)
   where id = p_link_id and used_at is not null;
$$;

revoke all on function public.portal_registration_link_access_error(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_registration_link_access_error(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Marcar comprobado (equipo)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_mark_reviewed(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.client_registration_links;
begin
  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  select * into l from public.client_registration_links x where x.id = p_link_id for update;
  if l.id is null then
    raise exception 'No existe ese registro' using errcode = 'P0002';
  end if;
  perform public.assert_tenant_match(l.tenant_id);
  if l.used_at is null then
    raise exception 'Ese link todavía no se usó' using errcode = '22023';
  end if;

  update public.client_registration_links x
     set reviewed_at = coalesce(x.reviewed_at, now()),
         reviewed_by = coalesce(x.reviewed_by, auth.uid())
   where x.id = l.id;
end;
$$;

revoke all on function public.portal_registration_link_mark_reviewed(uuid) from public, anon, service_role;
grant execute on function public.portal_registration_link_mark_reviewed(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. ¿Volvió a entrar desde su correo? (D-1, decisión del DG: opción A)
--
-- El correo que escribió el cliente no se prueba al registrarse: el magic-link
-- de la página lo marca confirmado en Auth sin que el correo intervenga. La
-- prueba real llega cuando el cliente vuelve a entrar al portal, porque hoy
-- toda entrada pasa por su correo (enlace de acceso o contraseña puesta con
-- «¿Olvidaste tu contraseña?»), salvo el acceso que el equipo comparte por
-- WhatsApp (`portal_access_links`, SDD-0253).
--
-- Regla CONSERVADORA (sólo dice «sí» cuando está claro):
--   · hubo un inicio de sesión más de 1 h después de usar el link — el
--     magic-link de la página vence en 1 h (MAILER_OTP_EXP), así que esa
--     entrada ya no pudo ser la suya; y
--   · no se usó ningún acceso por WhatsApp después del registro.
-- Lee auth.users, así que es security definer y sólo devuelve un booleano.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_email_status(p_link_ids uuid[])
returns table (link_id uuid, entered_via_email boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    exists (
      select 1
        from public.client_users cu
        join auth.users au on au.id = cu.auth_user_id
       where cu.tenant_id = l.tenant_id
         and cu.client_id = l.client_id
         and cu.status = 'active'
         and au.last_sign_in_at > l.used_at + interval '1 hour'
    )
    and not exists (
      select 1
        from public.portal_access_links a
       where a.tenant_id = l.tenant_id
         and a.client_id = l.client_id
         and a.used_at > l.used_at
    )
  from public.client_registration_links l
  where l.id = any(p_link_ids)
    and l.used_at is not null
    and l.tenant_id = public.get_user_tenant_id();
$$;

comment on function public.portal_registration_link_email_status(uuid[]) is
  'SDD-0646 D-1: por cada link usado del tenant del usuario, si el cliente volvió a entrar al portal por un camino que pasa por su correo (regla conservadora; ver la migración).';

revoke all on function public.portal_registration_link_email_status(uuid[]) from public, anon, service_role;
grant execute on function public.portal_registration_link_email_status(uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Un código retirado no se da a una ficha nueva
--
-- Los generadores ya saltan el historial (0367). Pero el alta del Studio ahora
-- acepta un código escrito a mano (SDD-0646), y `clients_tenant_id_markbox_key`
-- sólo mira `clients`. Sin este candado, escribir a mano el código viejo de otro
-- cliente le daría a la ficha nueva el historial de aquel por las políticas del
-- portal (comparan el texto del código). Sólo INSERT: el renombrado mueve el
-- historial antes de tocar `clients`.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.clients_guard_markbox_retirado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.markbox is not null and exists (
    select 1 from public.client_markbox_history h
     where h.tenant_id = new.tenant_id and upper(h.markbox) = upper(btrim(new.markbox))
  ) then
    raise exception 'El Shipping Mark % está retirado y reservado; no se reutiliza', new.markbox
      using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.clients_guard_markbox_retirado() from public, anon, authenticated, service_role;

create trigger clients_guard_markbox_retirado_t
  before insert on public.clients
  for each row execute function public.clients_guard_markbox_retirado();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9a. El historial marca lo restaurado; no se borra (0367:49-50)
--
-- Recuperar un código no borra su fila: la marca con fecha y autor. El índice
-- único pasa a mirar sólo lo retirado VIGENTE, para que el mismo código pueda
-- volver a retirarse más adelante sin chocar con su fila restaurada. Todas las
-- filas de un código son del mismo cliente: sólo su dueño lo puede recuperar.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.client_markbox_history
  add column restored_at timestamptz,
  add column restored_by uuid references auth.users(id);

comment on column public.client_markbox_history.restored_at is
  'SDD-0646: el cliente recuperó este código (volvió a ser su Shipping Mark actual). La fila se conserva como historia; no reserva el código porque ya está vivo en clients.';

drop index if exists public.client_markbox_history_uq;
create unique index client_markbox_history_uq
  on public.client_markbox_history (tenant_id, upper(markbox))
  where restored_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9b. rename_client_markbox: recuperar el código PROPIO
--
-- Cuerpo idéntico al de la 0371 salvo el bloque del historial. Antes: cualquier
-- código del historial se rechazaba, aunque fuera el retirado del MISMO cliente.
-- Ahora: si el código está retirado y es de ESTE cliente, su fila queda marcada
-- como restaurada (fecha y autor) y el actual (p. ej. DTD-8123) entra al
-- historial. Si es de otro cliente, sigue el 23505 de siempre.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.rename_client_markbox(
  p_client_id   uuid,
  p_new_markbox text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c        public.clients;
  v_old    text;
  v_new    text;
  v_chain  text;
  v_choca  text;
  v_legal  int := 0;
  v_moved  jsonb := '{}'::jsonb;
  v_n      int;
  v_hist   public.client_markbox_history;
begin
  perform public.assert_studio_role(array['admin', 'commercial', 'operations']);

  if p_client_id is null then
    raise exception 'Falta el cliente' using errcode = '22023';
  end if;

  v_new := upper(btrim(coalesce(p_new_markbox, '')));
  if v_new = '' then
    raise exception 'El Shipping Mark nuevo es obligatorio' using errcode = '22023';
  end if;
  if length(v_new) > 40 then
    raise exception 'El Shipping Mark nuevo es muy largo' using errcode = '22023';
  end if;
  if v_new !~ '^[A-Z0-9-]+$' then
    raise exception 'El Shipping Mark sólo admite letras, números y guiones: %', v_new
      using errcode = '22023';
  end if;

  select * into c from public.clients where id = p_client_id for update;

  if c.id is null then
    raise exception 'No existe el cliente' using errcode = 'P0002';
  end if;
  if c.deleted_at is not null then
    raise exception 'El cliente está eliminado' using errcode = '22023';
  end if;
  if c.merged_into_client_id is not null then
    raise exception 'Esa ficha ya fue fusionada; renombra la que sobrevivió'
      using errcode = '22023';
  end if;

  perform public.assert_tenant_match(c.tenant_id);

  v_old := c.markbox;
  if v_old is null then
    raise exception 'El cliente no tiene Shipping Mark que renombrar' using errcode = '22023';
  end if;
  if upper(btrim(v_old)) = v_new then
    raise exception 'El Shipping Mark nuevo es igual al actual' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.clients x
     where x.tenant_id = c.tenant_id and upper(btrim(x.markbox)) = v_new
  ) then
    raise exception 'El Shipping Mark % ya es de otro cliente', v_new using errcode = '23505';
  end if;

  -- SDD-0646: el retirado del MISMO cliente se puede recuperar; el de otro, no.
  select * into v_hist from public.client_markbox_history h
   where h.tenant_id = c.tenant_id and upper(h.markbox) = v_new
     and h.restored_at is null
   for update;
  if v_hist.id is not null and v_hist.client_id is distinct from c.id then
    raise exception 'El Shipping Mark % está retirado y reservado; no se reutiliza', v_new
      using errcode = '23505';
  end if;

  if c.aliado_id is not null then
    v_chain := public.aliado_prefix_chain(c.aliado_id);
    if v_new !~ ('^' || v_chain || '-\d+$') then
      raise exception 'Un cliente de % debe llevar Shipping Mark %-NNNN, no %',
        v_chain, v_chain, v_new using errcode = '23514';
    end if;
  else
    v_choca := public.markbox_choca_con_insignia(c.tenant_id, v_new, c.id);
    if v_choca is not null then
      raise exception 'El Shipping Mark % choca con la insignia del aliado %: la forma %-NNNN es de sus clientes y % pelada es de su propia ficha',
        v_new, v_choca, v_choca, v_choca using errcode = '23514';
    end if;
  end if;

  -- Recuperar: el código vuelve a ser el actual. La fila NO se borra (la historia
  -- no se pierde, 0367:49-50): queda marcada como restaurada.
  if v_hist.id is not null then
    update public.client_markbox_history
       set restored_at = now(), restored_by = auth.uid()
     where id = v_hist.id;
  end if;

  insert into public.client_markbox_history (tenant_id, client_id, markbox, reason, retired_by)
  values (c.tenant_id, c.id, v_old, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid());

  update public.clients set markbox = v_new where id = c.id;

  update public.invoices  set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('invoices', v_n);

  update public.prealertas set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('prealertas', v_n);

  update public.shipments set client_markbox = v_new
   where tenant_id = c.tenant_id and client_markbox = v_old;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('shipments', v_n);

  update public.payment_reports          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.payment_receipts         set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.prealerta_service_requests set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.prealerta_documents      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.shipment_documents       set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_delivery_addresses set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_claims            set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_claim_evidence    set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.client_notification_schedule set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.quotes                   set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.sales_orders             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.purchase_orders          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.consolidation_items      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.packing_list_submissions set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.suppliers_cn             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.supplier_claims          set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.supplier_order_signals   set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.warehouse_receipts_cn    set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_enrollments      set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_lesson_progress  set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.academy_diplomas         set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.club_members             set client_markbox = v_new where tenant_id = c.tenant_id and client_markbox = v_old;
  update public.referrals                set referrer_markbox = v_new where tenant_id = c.tenant_id and referrer_markbox = v_old;
  update public.warehouse_boxes          set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;
  update public.warehouse_receipt_ve_boxes set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;
  update public.qr_print_orders          set markbox = v_new where tenant_id = c.tenant_id and markbox = v_old;
  update public.dispatch_order_packages p
     set markbox = v_new
    from public.dispatch_orders o
   where o.id = p.od_id and o.tenant_id = c.tenant_id and p.markbox = v_old;

  update public.dispatch_rules
     set vip_markboxes = array_replace(vip_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(vip_markboxes);
  update public.dispatch_rules
     set whitelist_markboxes = array_replace(whitelist_markboxes, v_old, v_new)
   where tenant_id = c.tenant_id and v_old = any(whitelist_markboxes);

  select count(*) into v_legal
    from public.legal_acceptances
   where tenant_id = c.tenant_id and client_markbox = v_old;

  return jsonb_build_object(
    'ok', true,
    'client_id', c.id,
    'old_markbox', v_old,
    'new_markbox', v_new,
    'recovered', v_hist.id is not null,
    'moved', v_moved,
    'needs_review', jsonb_build_object(
      'legal_acceptances_bajo_codigo_viejo', v_legal,
      'kommo_requiere_push', c.kommo_lead_id is not null
    )
  );
end;
$function$;

revoke all on function public.rename_client_markbox(uuid, text, text) from public, anon, service_role;
grant execute on function public.rename_client_markbox(uuid, text, text) to authenticated;
