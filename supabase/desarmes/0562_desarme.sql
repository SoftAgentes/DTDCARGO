-- SDD-0672 · Desarme de la 0562: quita el enlace de autoservicio del portal y devuelve
-- portal_registration_link_peek y portal_registration_link_complete a sus cuerpos de la 0552.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/portal/__tests__/registro-autoservicio.migration.test.ts («desarme»).
--
-- QUITA portal_registration_link_create_self, _peek_self, _complete_self y _bind_self,
--   portal_registration_doc_key, y las columnas link_origin, issued_to_email y guard_failures de
--   client_registration_links (con sus CHECK).
-- DEVUELVE portal_registration_link_peek y portal_registration_link_complete a la 0552 (copia exacta,
--   md5 b90378a1… y 690860ca…; el postflight lo comprueba), con sus mismos privilegios.
-- CONSERVA toda fila de client_registration_links: los enlaces de autoservicio quedan como links
--   comunes (usados, revocados o vencidos), y sus registros siguen en «Registros por link».
-- NO DESHACE DATOS: las fichas que el cliente completó siguen completas, y los accesos creados por
--   el autoservicio siguen activos con su correo real (el enlace lo probó; no tienen fila en
--   client_email_checks, igual que los de la invitación por correo).
-- SE PIERDE, para cada enlace de autoservicio, que lo fue (link_origin), a qué correo salió
--   (issued_to_email) y cuántos intentos con datos que no coincidían tuvo (guard_failures). Si se
--   quieren conservar, exportarlos ANTES (id, client_id, link_origin, issued_to_email, guard_failures de
--   los enlaces con link_origin = 'autoservicio'); este archivo no lo hace.
--
-- SOLO SIRVE CON LA 0562 YA QUIETA. El preflight aborta, sin cambiar nada, si:
--   · la 0562 no está aplicada, o peek/complete no son los cuerpos de la 0562 (otra migración los
--     cambió después: leer el vivo antes de desarmar);
--   · hay un enlace de autoservicio VIVO (sin usar, sin revocar y sin vencer). Es el caso que
--     importa: sin la columna de origen, la ruta del equipo (/registro/link/<token>) lo aceptaría
--     sin la guarda y le mostraría el Shipping Mark a quien abra el correo. Primero se apaga la
--     emisión (la app) y se revocan esos enlaces, con su OK. Uno vencido o revocado no frena:
--     ninguna RPC mueve expires_at ni revoked_at hacia atrás;
--   · hay un registro de autoservicio usado y SIN REVISAR (reviewed_at vacío): el equipo todavía no
--     lo miró, y al perder el origen dejaría de ver que entró por el correo y no por WhatsApp. Se
--     marcan comprobados en «Registros por link», o se exportan, antes.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if not exists (select 1 from pg_catalog.pg_attribute
                  where attrelid = 'public.client_registration_links'::pg_catalog.regclass
                    and attname = 'link_origin' and not attisdropped) then
    raise exception 'Desarme abortado: la 0562 no está aplicada';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_peek(text)')
       and pg_catalog.md5(p.prosrc) = '620cebdf32c25ad7f33c89dc1b058a37'
  ) then
    raise exception 'Desarme abortado: portal_registration_link_peek no es el cuerpo de la 0562; leer el vivo antes de desarmar';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)')
       and pg_catalog.md5(p.prosrc) = '36fe32fa6e5ae9e8cefca187c0250dfa'
  ) then
    raise exception 'Desarme abortado: portal_registration_link_complete no es el cuerpo de la 0562; leer el vivo antes de desarmar';
  end if;
  if exists (select 1 from public.client_registration_links
              where link_origin = 'autoservicio' and used_at is null and revoked_at is null and expires_at > now()) then
    raise exception 'Desarme abortado: hay enlaces de autoservicio vivos; sin el origen, la ruta del equipo los aceptaría sin la guarda';
  end if;
  if exists (select 1 from public.client_registration_links
              where link_origin = 'autoservicio' and used_at is not null and reviewed_at is null) then
    raise exception 'Desarme abortado: hay registros de autoservicio sin revisar; el equipo los marca comprobados (o se exportan) antes';
  end if;
end;
$preflight$;

drop function if exists public.portal_registration_link_bind_self(uuid, uuid);
drop function if exists public.portal_registration_link_complete_self(text, text, text, text, text, text, text, text, text, text, text, boolean);
drop function if exists public.portal_registration_link_peek_self(text);
drop function if exists public.portal_registration_link_create_self(uuid, text, text);
drop function if exists public.portal_registration_doc_key(text);

-- Copia exacta de la 0552 (md5 b90378a1…).
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

-- Copia exacta de la 0552 (md5 690860ca…).
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

revoke all on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.portal_registration_link_complete(text, text, text, text, text, text, text, text, text, text, text, boolean)
  to service_role;

alter table public.client_registration_links
  drop constraint client_registration_links_autoservicio_email,
  drop column guard_failures,
  drop column issued_to_email,
  drop column link_origin;

do $postflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_peek(text)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = 'b90378a1238d754744ef6f5e117490b8'
  ) then
    raise exception 'Desarme: postflight — portal_registration_link_peek no quedó como en la 0552';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)')
       and p.prosecdef
       and pg_catalog.md5(p.prosrc) = '690860ca10ed794163b9ddef480cb279'
  ) then
    raise exception 'Desarme: postflight — portal_registration_link_complete no quedó como en la 0552';
  end if;
end;
$postflight$;
