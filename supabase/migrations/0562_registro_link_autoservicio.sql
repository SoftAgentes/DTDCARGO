-- 0562_registro_link_autoservicio.sql · SDD-0672 (entrega 2)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, con el
--    name exacto `0562_registro_link_autoservicio`. Fusionar la PR NO autoriza
--    aplicarla.
--    ORDEN: la migración PRIMERO (migrate-first). Con la app de antes y la
--    migración aplicada, nada cambia para el cliente: nadie emite enlaces de
--    autoservicio, y la ruta del equipo sigue igual (sus enlaces nacen
--    `link_origin = 'equipo'` por defecto). Con la app nueva y sin la migración,
--    `/entrar` no encuentra `portal_registration_link_create_self` y responde
--    «ya eres cliente» con el aviso al equipo, como en la entrega 1.
--
-- EL CLIENTE SIN PORTAL CREA SU PORTAL DESDE SU CORREO, CON UNA GUARDA.
--
-- Pedido de Sam (2026-11-18): si el correo que escribe en /entrar es de un
-- cliente que nunca activó su portal, que llene sus datos completos y quede en
-- la ficha que ya existe. El enlace llega al correo de la ficha (no se completa
-- en la misma pantalla: quien escribe el correo de otro no demuestra que sea
-- suyo). Y como ese correo lo cargó el equipo y puede tener un tipeo (decisión
-- de Sam del 2026-08-23, SDD-0279: «enlace automático no»), el portal solo se
-- activa si la cédula o el RIF, o el WhatsApp, coinciden con lo que ya tiene la
-- ficha. La respuesta nunca dice si el documento coincidió ni cuál dato falló.
--
-- ── Qué trae ────────────────────────────────────────────────────────────────
--   1. `client_registration_links` suma `link_origin` ('equipo' | 'autoservicio',
--      default 'equipo'), `issued_to_email` (el correo al que se mandó un enlace
--      de autoservicio) y `guard_failures` (intentos con datos que no
--      coinciden; con 3, el enlace muere).
--   2. `portal_registration_link_peek` y `portal_registration_link_complete`
--      (cuerpos de la 0552, md5 b90378a1… y 690860ca…) aceptan SOLO enlaces del
--      equipo: un enlace de autoservicio llevado a /registro/link/<token> no
--      salta la guarda ni muestra el Shipping Mark.
--   3. RPC nuevas, todas SECURITY DEFINER, `search_path = ''`, nombres
--      calificados, EXECUTE solo para service_role (revocado a public, anon y
--      authenticated):
--        portal_registration_link_create_self   emitir (la llama /entrar)
--        portal_registration_link_peek_self     mirar (GET, no gasta)
--        portal_registration_link_complete_self completar con la guarda (POST)
--        portal_registration_link_bind_self     vincular la cuenta del correo
--                                               probado (sin «sin comprobar»)
--   4. No escribe datos ni toca filas existentes. ADD COLUMN con default
--      constante: sin reescritura; ACCESS EXCLUSIVE breve sobre
--      client_registration_links. lock_timeout 5 s.
--
-- Desarme: supabase/desarmes/0562_desarme.sql.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Preflight
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
begin
  if pg_catalog.to_regclass('public.client_registration_links') is null then
    raise exception '0562 abortado: falta client_registration_links (migración 0552)';
  end if;
  if pg_catalog.to_regclass('public.client_email_checks') is null then
    raise exception '0562 abortado: falta client_email_checks (migración 0559)';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute
              where attrelid = 'public.client_registration_links'::pg_catalog.regclass
                and attname = 'link_origin' and not attisdropped) then
    raise exception '0562 abortado: client_registration_links.link_origin ya existe; no reaplicar';
  end if;
  if pg_catalog.to_regprocedure('public.phone_match_key(text)') is null then
    raise exception '0562 abortado: falta public.phone_match_key(text) (migración 0342)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_peek(text)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = 'b90378a1238d754744ef6f5e117490b8'
  ) then
    raise exception '0562 abortado: portal_registration_link_peek no es el cuerpo de la 0552; leer el vivo antes de reemplazarlo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = '690860ca10ed794163b9ddef480cb279'
  ) then
    raise exception '0562 abortado: portal_registration_link_complete no es el cuerpo de la 0552; leer el vivo antes de reemplazarlo';
  end if;
end;
$preflight$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas nuevas
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.client_registration_links
  add column link_origin text not null default 'equipo'
    constraint client_registration_links_link_origin_check check (link_origin in ('equipo', 'autoservicio')),
  add column issued_to_email text,
  add column guard_failures integer not null default 0
    constraint client_registration_links_guard_failures_check check (guard_failures between 0 and 3),
  add constraint client_registration_links_autoservicio_email
    check (link_origin = 'equipo' or (issued_to_email is not null and issued_to_email = lower(btrim(issued_to_email))));

comment on column public.client_registration_links.link_origin is
  'SDD-0672: equipo = lo generó un asesor desde la ficha (WhatsApp); autoservicio = lo emitió /entrar al correo de la ficha. La ruta del equipo no acepta los de autoservicio.';
comment on column public.client_registration_links.issued_to_email is
  'SDD-0672: correo (minúsculas) al que salió el enlace de autoservicio. Si el cliente deja ese mismo correo, queda probado.';
comment on column public.client_registration_links.guard_failures is
  'SDD-0672: intentos con cédula/RIF y WhatsApp que no coinciden con la ficha. Con 3, el enlace queda revocado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La ruta del equipo deja de aceptar enlaces de autoservicio
--
-- Cuerpos copiados de la 0552; lo único nuevo es el filtro por `link_origin`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.portal_registration_link_peek(p_token_hash text)
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
     and l.link_origin = 'equipo'
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

create or replace function public.portal_registration_link_complete(
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
  if l.id is null or l.link_origin <> 'equipo' or l.used_at is not null or l.revoked_at is not null or l.expires_at <= now() then
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

revoke all on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lo que la guarda compara (sin EXECUTE para nadie: solo la usan las RPC)
--
-- Documento: sólo los dígitos, sin ceros a la izquierda, y con 6 o más. Así
-- «V-12.345.678», «V12345678» y «12345678» son el mismo; un RIF «J-12345678-9»
-- da «123456789». Una ficha con el documento corrompido por Excel
-- («2108108.0») no coincide; para eso está el teléfono.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_doc_key(p_doc text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(ltrim(regexp_replace(coalesce(p_doc, ''), '[^0-9]', '', 'g'), '0')) >= 6
      then ltrim(regexp_replace(coalesce(p_doc, ''), '[^0-9]', '', 'g'), '0')
    else null
  end;
$$;

revoke all on function public.portal_registration_doc_key(text) from public, anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Emitir el enlace de autoservicio (lo llama /entrar con service_role)
--
-- Errores con mensaje fijo, que la app traduce:
--   P0002 'no_aplica'  → ficha borrada/fusionada, correo que no es el de la
--                        ficha, o el cliente ya tiene CUALQUIER fila de acceso
--                        (activa, invitada o revocada: eso lo decide el equipo)
--   22023 'sin_dato'   → la ficha no tiene ni documento ni teléfono con qué
--                        comprobar: no hay guarda posible
--   55000 'link_equipo'→ hay un enlace del equipo vivo: no se le pisa
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_create_self(
  p_client_id  uuid,
  p_email      text,
  p_token_hash text
)
returns table (link_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c         public.clients;
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_expires timestamptz := now() + interval '24 hours';
  v_id      uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token inválido' using errcode = '22023';
  end if;

  select * into c from public.clients x where x.id = p_client_id for update;
  if c.id is null or c.deleted_at is not null or c.merged_into_client_id is not null
     or v_email = '' or lower(btrim(coalesce(c.email, ''))) <> v_email then
    raise exception 'no_aplica' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.client_users u
     where u.tenant_id = c.tenant_id and u.client_id = c.id
  ) then
    raise exception 'no_aplica' using errcode = 'P0002';
  end if;

  if public.portal_registration_doc_key(c.rif) is null
     and public.phone_match_key(c.phone) is null then
    raise exception 'sin_dato' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.client_registration_links l
     where l.client_id = c.id and l.link_origin = 'equipo'
       and l.used_at is null and l.revoked_at is null and l.expires_at > now()
  ) then
    raise exception 'link_equipo' using errcode = '55000';
  end if;

  -- Pedir otro revoca el anterior de autoservicio (y uno del equipo ya vencido).
  update public.client_registration_links l
     set revoked_at = now()
   where l.client_id = c.id and l.used_at is null and l.revoked_at is null;

  insert into public.client_registration_links
    (tenant_id, client_id, token_hash, expires_at, created_by, link_origin, issued_to_email)
  values (c.tenant_id, c.id, p_token_hash, v_expires, null, 'autoservicio', v_email)
  returning id into v_id;

  return query select v_id, v_expires;
end;
$$;

comment on function public.portal_registration_link_create_self(uuid, text, text) is
  'SDD-0672: /entrar emite el enlace de autoservicio al correo de la ficha de un cliente sin ninguna fila de acceso. 24 h, un solo uso. Solo service_role.';

revoke all on function public.portal_registration_link_create_self(uuid, text, text) from public, anon, authenticated;
grant execute on function public.portal_registration_link_create_self(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Mirar el enlace de autoservicio (GET): sólo lee, no gasta
--
-- Devuelve el correo al que salió (quien abre el enlace lo recibió ahí) y
-- NADA de la ficha: ni el Shipping Mark ni el nombre, hasta pasar la guarda.
-- Si la ficha ya no tiene ese correo (el equipo lo corrigió), el enlace no abre.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_peek_self(p_token_hash text)
returns table (issued_to_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.issued_to_email
    from public.client_registration_links l
    join public.clients c on c.id = l.client_id
   where l.token_hash = p_token_hash
     and l.link_origin = 'autoservicio'
     and l.used_at is null
     and l.revoked_at is null
     and l.expires_at > now()
     and l.guard_failures < 3
     and c.deleted_at is null
     and c.merged_into_client_id is null
     and lower(btrim(coalesce(c.email, ''))) = l.issued_to_email
     and not exists (
       select 1 from public.client_users u
        where u.tenant_id = c.tenant_id and u.client_id = c.id
     );
$$;

revoke all on function public.portal_registration_link_peek_self(text) from public, anon, authenticated;
grant execute on function public.portal_registration_link_peek_self(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Completar con la guarda (POST)
--
-- `estado`:
--   'no_coincide' → ni el documento ni el WhatsApp coinciden con la ficha. NO
--                   gasta el enlace (suma un intento; con 3, lo revoca) y no
--                   dice cuál dato falló. No toca la ficha.
--   'ok'          → igual que el `complete` de la 0552: completa la ficha, gasta
--                   el enlace, guarda antes/después y marca el duplicado sin
--                   fusionar. `correo_probado` dice si dejó el mismo correo al
--                   que salió el enlace.
-- Errores con mensaje fijo: P0002 'link_invalido', 22023 'datos_incompletos',
-- 23505 'correo_en_uso' (como en la 0552; este último NO gasta el enlace ni
-- cuenta como intento, y se mira DESPUÉS de la guarda).
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_complete_self(
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
  estado        text,
  client_id     uuid,
  tenant_id     uuid,
  markbox       text,
  email         text,
  link_id       uuid,
  correo_probado boolean,
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
  v_client_id uuid;
  v_ficha_doc text;
  v_ficha_tel text;
  v_coincide boolean;
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

  -- Orden de bloqueos: primero la ficha y después el enlace, el mismo de
  -- create_self (bloquea la ficha y revoca sus enlaces). Al revés, un /entrar y
  -- este POST a la vez podían trabarse (40P01). El enlace se ubica sin
  -- bloquear; con los dos bloqueados, se vuelve a validar todo.
  select x.client_id into v_client_id from public.client_registration_links x
   where x.token_hash = p_token_hash;
  if v_client_id is null then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select * into c from public.clients x where x.id = v_client_id for update;

  select * into l from public.client_registration_links x
   where x.token_hash = p_token_hash for update;
  if l.id is null or l.link_origin <> 'autoservicio' or l.used_at is not null
     or l.revoked_at is not null or l.expires_at <= now() or l.guard_failures >= 3 then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  -- El correo de la ficha tiene que seguir siendo el que recibió el enlace: si el
  -- equipo corrigió un correo con tipeo, el enlace que llegó al buzón equivocado
  -- deja de servir (la guarda queda para lo que no se pudo corregir).
  if c.id is null or l.client_id is distinct from c.id
     or c.deleted_at is not null or c.merged_into_client_id is not null
     or lower(btrim(coalesce(c.email, ''))) is distinct from l.issued_to_email
     or exists (
       select 1 from public.client_users u
        where u.tenant_id = c.tenant_id and u.client_id = c.id
     ) then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  -- La guarda. Se compara contra lo que la ficha tenía ANTES de este POST.
  v_ficha_doc := public.portal_registration_doc_key(c.rif);
  v_ficha_tel := public.phone_match_key(c.phone);
  -- coalesce: una comparación con NULL daría NULL, y `not NULL` también es NULL:
  -- sin esto, un documento que no se puede normalizar saltaría la guarda.
  v_coincide := coalesce(
       (v_ficha_doc is not null and v_ficha_doc = public.portal_registration_doc_key(v_doc))
    or (v_ficha_tel is not null and v_ficha_tel = public.phone_match_key(v_phone)),
    false);

  if not v_coincide then
    update public.client_registration_links x
       set guard_failures = x.guard_failures + 1,
           revoked_at = case when x.guard_failures + 1 >= 3 then now() else x.revoked_at end
     where x.id = l.id;
    return query select 'no_coincide'::text, null::uuid, null::uuid, null::text, null::text,
                        null::uuid, null::boolean, null::text, null::boolean;
    return;
  end if;

  -- Correo con cuenta: no se puede crear el acceso con él. Se rechaza ANTES de
  -- tocar nada, para que el cliente corrija el correo con el mismo enlace.
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

  -- La cédula de otra ficha no se copia (mismo criterio que la 0552).
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
                                     then 'portal_register_self' else x.email_optin_source end,
           portal_approved_at = coalesce(x.portal_approved_at, now())
     where x.id = c.id;
  exception when unique_violation then
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
                                     then 'portal_register_self' else x.email_optin_source end,
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

  return query select 'ok'::text, c.id, c.tenant_id, c.markbox, v_email, l.id,
                      (v_email = l.issued_to_email), v_dup_by, v_skip_rif;
end;
$$;

comment on function public.portal_registration_link_complete_self(text, text, text, text, text, text, text, text, text, text, text, boolean) is
  'SDD-0672: el cliente completa SU ficha con el enlace de autoservicio, solo si la cédula/RIF o el WhatsApp coinciden con la ficha. No dice cuál dato falló. Solo service_role.';

revoke all on function public.portal_registration_link_complete_self(text, text, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.portal_registration_link_complete_self(text, text, text, text, text, text, text, text, text, text, text, boolean)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Vincular la cuenta del correo PROBADO
--
-- Solo para un enlace de autoservicio recién usado (10 minutos) en el que el
-- cliente dejó el mismo correo al que salió: abrir el enlace prueba que el
-- correo es suyo, así que la cuenta lleva el correo real y NO queda «sin
-- comprobar» (no se escribe client_email_checks). Si cambió el correo, la app
-- usa `portal_registration_link_bind` (0559): dirección interna y comprobación.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.portal_registration_link_bind_self(
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
  if l.id is null or l.link_origin <> 'autoservicio' or l.used_at is null
     or l.used_at < now() - interval '10 minutes' then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select lower(au.email) into v_email from auth.users au where au.id = p_auth_user_id;
  if v_email is null
     or v_email is distinct from (l.submitted_data ->> 'email')
     or v_email is distinct from l.issued_to_email then
    raise exception 'La cuenta no es la del correo probado' using errcode = '22023';
  end if;

  insert into public.client_users as u
    (tenant_id, client_id, email, auth_user_id, status, invited_at, bound_at, revoked_at)
  values (l.tenant_id, l.client_id, v_email, p_auth_user_id, 'active', now(), now(), null)
  on conflict (tenant_id, client_id) do nothing;

  if not found then
    raise exception 'El cliente ya tiene una fila de acceso' using errcode = '22023';
  end if;

  update public.client_registration_links x set access_error = null where x.id = l.id;
end;
$$;

revoke all on function public.portal_registration_link_bind_self(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_registration_link_bind_self(uuid, uuid) to service_role;
