\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0562 (SDD-0672, entrega 2). Fixtures
-- ficticios y rollback: no toca producción ni datos reales.
--
-- El esquema de base es el mismo doble de los contratos de la 0552 y la 0559
-- (hasta aplicar la 0552); lo propio de este contrato empieza en «Datos
-- ficticios». Antes de aplicar la 0562 se simulan los privilegios por defecto
-- de Supabase (EXECUTE para anon, authenticated y service_role en cada función
-- nueva de public): así el contrato mide lo que la migración revoca de verdad.
--
-- Lo que fija:
--   A. Permisos: las cuatro RPC nuevas, solo service_role, SECURITY DEFINER y
--      search_path vacío; la comparación de la guarda no la ejecuta nadie.
--      Mirar devuelve solo el correo al que salió el enlace.
--   B. Los enlaces que ya existían quedan del equipo; los CHECK nuevos; cómo se
--      normaliza el documento.
--   C. Emitir: solo al correo de la ficha, de una ficha viva, a un cliente sin
--      NINGUNA fila de acceso (activa, invitada o revocada), con documento o
--      teléfono con qué comprobar y sin un enlace del equipo vivo. 24 h, origen
--      autoservicio, correo en minúsculas. Pedir otro revoca el anterior.
--   D. Mirar no gasta; nada para un enlace del equipo, reemplazado, vencido o
--      con 3 fallos.
--   E. La ruta del equipo no acepta un enlace de autoservicio y sigue aceptando
--      los suyos (regresión de la 0646); completar con la guarda no acepta uno
--      del equipo; un link nuevo del equipo revoca el de autoservicio.
--   F. La guarda: sin coincidencia responde «no_coincide» sin datos de la ficha,
--      no la toca, no gasta el enlace y suma un intento; un documento que no se
--      normaliza no la salta; un correo con cuenta no gasta ni suma; el
--      documento en otro formato, o solo el WhatsApp, pasan: «ok», ficha
--      completa, antes/después guardados y `correo_probado` solo si dejó el
--      correo al que salió el enlace.
--   G. Tres intentos: el enlace queda revocado y no sirve ni con los datos
--      correctos. La guarda se mira antes que el correo con cuenta.
--   H. Vincular: solo un enlace de autoservicio recién usado y la cuenta del
--      correo probado; activa el acceso sin dejarlo «sin comprobar» y no pisa
--      una fila de acceso que ya existe. Mirar y completar no sirven si el
--      cliente ya tiene una fila de acceso.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to public;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_t uuid := public.get_user_tenant_id();
begin
  if v_t is null then raise exception 'Authenticated tenant required' using errcode = '42501'; end if;
  if v_t <> p_tenant_id then raise exception 'Tenant mismatch' using errcode = '42501'; end if;
end; $$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_studio_role(p_roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_role text := public.current_studio_role();
begin
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
end; $$;

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text, deleted_at timestamptz,
  merged_into_client_id uuid references public.clients(id),
  aliado_id uuid, kommo_lead_id bigint,
  name text, contact_name text, email text, phone text, rif text,
  doc_kind text, city text, state text, address text,
  portal_approved_at timestamptz,
  email_marketing_optin_at timestamptz, email_optin_source text
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);
-- Doble del índice de documento: incluye fichas borradas, como el que hace
-- caer el camino de respaldo de la RPC.
create unique index clients_tenant_doc_unique
  on public.clients (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null;

create table public.client_users (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  email text, auth_user_id uuid unique, status text not null default 'invited',
  invited_at timestamptz default now(), bound_at timestamptz, revoked_at timestamptz,
  unique (tenant_id, client_id)
);

-- Acceso por WhatsApp de la 0360 (SDD-0253), sólo lo que mira la 0552.
create table public.portal_access_links (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null, used_at timestamptz
);

create table public.aliados (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid, parent_aliado_id uuid,
  prefix text not null, status text not null default 'activo', deleted_at timestamptz
);
create function public.aliado_prefix_chain(p_aliado_id uuid) returns text
language sql stable set search_path = public as $$
  select upper(a.prefix) from public.aliados a where a.id = p_aliado_id;
$$;

create table public.dispatch_orders (id uuid primary key, tenant_id uuid not null);
create table public.dispatch_order_packages (od_id uuid not null, markbox text not null);
create table public.dispatch_rules (
  tenant_id uuid not null,
  vip_markboxes text[] not null default '{}',
  whitelist_markboxes text[] not null default '{}'
);

do $stubs$
declare t text;
begin
  foreach t in array array[
    'invoices','prealertas','shipments','payment_reports','payment_receipts',
    'prealerta_service_requests','prealerta_documents','shipment_documents',
    'client_delivery_addresses','client_claims','client_claim_evidence',
    'client_notification_schedule','quotes','sales_orders','purchase_orders',
    'consolidation_items','packing_list_submissions','suppliers_cn','supplier_claims',
    'supplier_order_signals','warehouse_receipts_cn','academy_enrollments',
    'academy_lesson_progress','academy_diplomas','club_members','legal_acceptances'
  ] loop
    execute format('create table public.%I (tenant_id uuid not null, client_markbox text)', t);
  end loop;
  foreach t in array array['warehouse_boxes','warehouse_receipt_ve_boxes','qr_print_orders'] loop
    execute format('create table public.%I (tenant_id uuid not null, markbox text)', t);
  end loop;
end;
$stubs$;

create table public.referrals (tenant_id uuid not null, referrer_markbox text);

\ir ../migrations/0342_phone_match_key_relleno.sql
\ir ../migrations/0367_client_markbox_historial.sql
\ir ../migrations/0371_insignia_pelada_del_aliado.sql

do $grants$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select on public.%I to authenticated', t);
    if t <> 'client_markbox_history' then
      execute format('grant insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end;
$grants$;

\ir ../migrations/0552_registro_portal_por_link.sql

-- Como en Supabase: service_role tiene grants sobre las tablas y salta la RLS.
-- Sólo a service_role: lo que se mide de anon y authenticated queda igual.
alter role service_role bypassrls;
grant select, insert, update, delete on all tables in schema public to service_role;

\ir ../migrations/0559_registro_link_correo_comprobado.sql

-- La tabla de la 0559, también para service_role.
grant select, insert, update, delete on all tables in schema public to service_role;

-- ── Datos ficticios ──────────────────────────────────────────────────────────
-- t1: el tenant de DTD. a1: equipo. f1: una cuenta que ya existe (correo en
-- uso). Fichas del legado sin portal:
--   c101 documento y teléfono (la guarda por documento, en otro formato)
--   c102 solo teléfono (la guarda por WhatsApp; cambia el correo)
--   c103 ni documento ni teléfono que sirvan («S/N» y un teléfono de relleno)
--   c104 / c105 / c106 con fila de acceso activa / invitada / revocada
--   c107 borrada · c108 fusionada
--   c109 / c110 con link del equipo vivo / que se vence (creados ANTES de la 0562)
--   c111 tres intentos · c112 el equipo invita mientras tanto
--   c113 el equipo genera un link encima · c114 enlaces que ya no sirven
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'equipo@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'activo@example.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'ocupado@example.test');
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'operations');

insert into public.clients (id, tenant_id, markbox, name, email, rif, phone, city, state) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8101', 'CLIENTE AUTOSERVICIO UNO', 'Cliente.Uno@Example.test', 'V-12.345.678', '0414-555-1101', 'Valencia', 'Carabobo'),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8102', 'CLIENTE DOS', 'dos@example.test', null, '0424-555-2202', null, null),
  ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8103', 'CLIENTE TRES', 'tres@example.test', 'S/N', '0000000', null, null),
  ('00000000-0000-0000-0000-00000000c104', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8104', 'CLIENTE CUATRO', 'activo@example.test', 'V-14.141.414', '0414-555-1404', null, null),
  ('00000000-0000-0000-0000-00000000c105', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8105', 'CLIENTE CINCO', 'invitado@example.test', 'V-15.151.515', '0414-555-1505', null, null),
  ('00000000-0000-0000-0000-00000000c106', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8106', 'CLIENTE SEIS', 'revocado@example.test', 'V-16.161.616', '0414-555-1606', null, null),
  ('00000000-0000-0000-0000-00000000c107', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8107', 'CLIENTE SIETE', 'borrado@example.test', 'V-17.171.717', '0414-555-1707', null, null),
  ('00000000-0000-0000-0000-00000000c109', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8109', 'CLIENTE NUEVE', 'nueve@example.test', 'V-19.191.919', '0414-555-1909', null, null),
  ('00000000-0000-0000-0000-00000000c110', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8110', 'CLIENTE DIEZ', 'diez@example.test', 'V-20.202.020', '0414-555-2010', null, null),
  ('00000000-0000-0000-0000-00000000c111', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8111', 'CLIENTE ONCE', 'once@example.test', 'J-40404040-4', '0414-555-3111', null, null),
  ('00000000-0000-0000-0000-00000000c112', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8112', 'CLIENTE DOCE', 'doce@example.test', 'V-21.212.121', '0414-555-3212', null, null),
  ('00000000-0000-0000-0000-00000000c113', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8113', 'CLIENTE TRECE', 'trece@example.test', 'V-22.222.333', '0414-555-3313', null, null),
  ('00000000-0000-0000-0000-00000000c114', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8114', 'CLIENTE CATORCE', 'catorce@example.test', 'V-23.232.323', '0414-555-3414', null, null);
update public.clients set deleted_at = now() where id = '00000000-0000-0000-0000-00000000c107';
insert into public.clients (id, tenant_id, markbox, name, email, rif, phone, merged_into_client_id) values
  ('00000000-0000-0000-0000-00000000c108', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8108', 'CLIENTE OCHO', 'fusionado@example.test', 'V-18.181.818', '0414-555-1808',
   '00000000-0000-0000-0000-00000000c101');

insert into public.client_users (tenant_id, client_id, email, auth_user_id, status, bound_at, revoked_at) values
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c104', 'activo@example.test',
   '00000000-0000-0000-0000-0000000000a4', 'active', now(), null),
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c105', 'invitado@example.test',
   null, 'invited', null, null),
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c106', 'revocado@example.test',
   null, 'revoked', null, now());

-- Links del equipo de ANTES de la 0562 (la 0646 de siempre).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c109', repeat('9', 64));
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c110', repeat('8', 64));
end $$;
reset role;
set local request.jwt.claim.sub = '';

-- Como en Supabase: cada función nueva de public nace con EXECUTE para anon,
-- authenticated y service_role. Revocarlo le toca a la 0562.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\ir ../migrations/0562_registro_link_autoservicio.sql

-- ── Fin de la 0562 (el ensayo del desarme corta aquí) ─────────────────────────
grant select, insert, update, delete on all tables in schema public to service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- A. Permisos y forma
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare
  f text;
  p record;
begin
  foreach f in array array[
    'public.portal_registration_link_create_self(uuid,text,text)',
    'public.portal_registration_link_peek_self(text)',
    'public.portal_registration_link_complete_self(text,text,text,text,text,text,text,text,text,text,text,boolean)',
    'public.portal_registration_link_bind_self(uuid,uuid)',
    'public.portal_registration_link_peek(text)',
    'public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)'
  ] loop
    select pr.prosecdef, pr.proconfig into p
      from pg_catalog.pg_proc pr where pr.oid = pg_catalog.to_regprocedure(f);
    assert found, 'falta ' || f;
    assert not has_function_privilege('anon', f, 'EXECUTE'), 'anon puede ejecutar ' || f;
    assert not has_function_privilege('authenticated', f, 'EXECUTE'), 'un usuario con sesión puede ejecutar ' || f;
    assert has_function_privilege('service_role', f, 'EXECUTE'), 'la ruta del servidor no puede ejecutar ' || f;
    assert p.prosecdef, f || ' no es SECURITY DEFINER';
    assert p.proconfig = array['search_path=""']::text[], f || ' no fija search_path vacío';
  end loop;

  -- La comparación de la guarda: sólo la usan las RPC.
  assert not has_function_privilege('anon', 'public.portal_registration_doc_key(text)', 'EXECUTE')
     and not has_function_privilege('authenticated', 'public.portal_registration_doc_key(text)', 'EXECUTE'),
    'un visitante o un usuario con sesión puede ejecutar portal_registration_doc_key';
  assert not has_function_privilege('service_role', 'public.portal_registration_doc_key(text)', 'EXECUTE'),
    'la ruta del servidor puede ejecutar portal_registration_doc_key (sólo la usan las RPC)';
  assert (select pr.proconfig from pg_catalog.pg_proc pr
           where pr.oid = 'public.portal_registration_doc_key(text)'::regprocedure) = array['search_path=""']::text[],
    'portal_registration_doc_key no fija search_path vacío';

  -- ⭐ Mirar devuelve SÓLO el correo al que salió: ni Shipping Mark ni nombre.
  assert (select array_agg(a.attname order by a.attnum)
            from pg_catalog.pg_proc pr,
                 lateral unnest(pr.proargnames, pr.proargmodes) with ordinality as a(attname, mode, attnum)
           where pr.oid = 'public.portal_registration_link_peek_self(text)'::regprocedure
             and a.mode = 't') = array['issued_to_email']::text[],
    'mirar el enlace de autoservicio devuelve algo más que el correo al que salió';
  -- Lo que lee la app al completar.
  assert (select array_agg(a.attname order by a.attnum)
            from pg_catalog.pg_proc pr,
                 lateral unnest(pr.proargnames, pr.proargmodes) with ordinality as a(attname, mode, attnum)
           where pr.oid = 'public.portal_registration_link_complete_self(text,text,text,text,text,text,text,text,text,text,text,boolean)'::regprocedure
             and a.mode = 't')
         = array['estado', 'client_id', 'tenant_id', 'markbox', 'email', 'link_id', 'correo_probado',
                 'duplicate_matched_by', 'rif_skipped']::text[],
    'completar con la guarda devuelve otra forma';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- B. Columnas, CHECK y documento normalizado
-- ═════════════════════════════════════════════════════════════════════════════
do $$
begin
  assert (select count(*) from public.client_registration_links) = 2, 'faltan los links del equipo de antes';
  assert not exists (
    select 1 from public.client_registration_links
     where link_origin <> 'equipo' or issued_to_email is not null or guard_failures <> 0
  ), 'los links que ya existían no quedaron como del equipo';

  begin
    insert into public.client_registration_links (tenant_id, client_id, token_hash, expires_at, link_origin)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c103',
            repeat('c', 64), now() + interval '1 day', 'autoservicio');
    raise exception 'CONTRATO ROTO: un enlace de autoservicio nació sin el correo al que salió';
  exception when check_violation then null;
  end;
  begin
    insert into public.client_registration_links (tenant_id, client_id, token_hash, expires_at, link_origin, issued_to_email)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c103',
            repeat('c', 64), now() + interval '1 day', 'autoservicio', 'Tres@Example.test');
    raise exception 'CONTRATO ROTO: el correo al que salió el enlace quedó con mayúsculas';
  exception when check_violation then null;
  end;
  begin
    insert into public.client_registration_links (tenant_id, client_id, token_hash, expires_at, link_origin)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c103',
            repeat('c', 64), now() + interval '1 day', 'whatsapp');
    raise exception 'CONTRATO ROTO: aceptó un origen desconocido';
  exception when check_violation then null;
  end;
  begin
    update public.client_registration_links set guard_failures = 4 where token_hash = repeat('9', 64);
    raise exception 'CONTRATO ROTO: aceptó más de 3 intentos';
  exception when check_violation then null;
  end;

  -- El documento: sólo los dígitos, sin ceros a la izquierda, con 6 o más.
  assert public.portal_registration_doc_key('V-12.345.678') = '12345678', 'la cédula con puntos y guion no se normaliza';
  assert public.portal_registration_doc_key('V12345678') = '12345678', 'la cédula con la letra pegada no se normaliza';
  assert public.portal_registration_doc_key(' 12345678 ') = '12345678', 'la cédula sola no se normaliza';
  assert public.portal_registration_doc_key('J-12345678-9') = '123456789', 'el RIF no se normaliza';
  assert public.portal_registration_doc_key('V-012.345.678') = '12345678', 'un cero a la izquierda cambia el documento';
  assert public.portal_registration_doc_key('V-00012') is null, 'un documento de menos de 6 dígitos sirve para comparar';
  assert public.portal_registration_doc_key('abc') is null, 'un documento sin dígitos sirve para comparar';
  assert public.portal_registration_doc_key('S/N') is null, '«S/N» sirve para comparar';
  assert public.portal_registration_doc_key(null) is null, 'un documento vacío sirve para comparar';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- C. Emitir el enlace de autoservicio
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
set local request.jwt.claim.sub = '';
do $$
declare
  r record;
  l public.client_registration_links;
begin
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', 'cliente.uno@example.test', 'DTD-8101');
    raise exception 'CONTRATO ROTO: emitió el enlace con un token que no es un hash';
  exception when invalid_parameter_value then
    assert sqlerrm = 'Token inválido', 'un token que no es un hash respondió: ' || sqlerrm;
  end;

  -- Solo al correo de la ficha.
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', 'otro@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace a un correo que no es el de la ficha';
  exception when no_data_found then
    assert sqlerrm = 'no_aplica', 'un correo que no es el de la ficha respondió: ' || sqlerrm;
  end;
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', '   ', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace sin correo';
  exception when no_data_found then null;
  end;

  -- Una ficha viva.
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c107', 'borrado@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace de una ficha borrada';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c108', 'fusionado@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace de una ficha fusionada';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000dead', 'nadie@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace de una ficha que no existe';
  exception when no_data_found then null;
  end;

  -- ⭐ Ninguna fila de acceso: activa, invitada o revocada (eso lo decide el equipo).
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c104', 'activo@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace a un cliente que ya tiene portal';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c105', 'invitado@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace a un cliente con acceso invitado';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c106', 'revocado@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace a un cliente con acceso revocado por el equipo';
  exception when no_data_found then null;
  end;

  -- Sin documento ni teléfono que sirvan no hay guarda posible.
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c103', 'tres@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: emitió un enlace sin dato con qué comprobar';
  exception when invalid_parameter_value then
    assert sqlerrm = 'sin_dato', 'una ficha sin dato con qué comprobar respondió: ' || sqlerrm;
  end;

  -- Un link del equipo vivo no se pisa.
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c109', 'nueve@example.test', repeat('a', 64));
    raise exception 'CONTRATO ROTO: pisó un enlace vivo del equipo';
  exception when object_not_in_prerequisite_state then
    assert sqlerrm = 'link_equipo', 'un link del equipo vivo respondió: ' || sqlerrm;
  end;
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('9', 64)) is null,
    'emitir revocó el link vivo del equipo';
  assert not exists (select 1 from public.client_registration_links where link_origin = 'autoservicio'),
    'un rechazo dejó un enlace de autoservicio';

  -- Emitir.
  select * into r from public.portal_registration_link_create_self(
    '00000000-0000-0000-0000-00000000c101', '  CLIENTE.uno@example.test ', repeat('a', 64));
  select * into l from public.client_registration_links x where x.id = r.link_id;
  assert l.id is not null and l.token_hash = repeat('a', 64), 'emitir no devolvió el enlace';
  assert l.link_origin = 'autoservicio', 'el enlace emitido no nació de autoservicio';
  assert l.issued_to_email = 'cliente.uno@example.test', 'no guardó en minúsculas el correo al que salió el enlace';
  assert l.client_id = '00000000-0000-0000-0000-00000000c101' and l.tenant_id = '00000000-0000-0000-0000-00000000d7d1',
    'el enlace quedó en otra ficha';
  assert l.created_by is null, 'el enlace de autoservicio lleva un autor del equipo';
  assert l.expires_at = now() + interval '24 hours' and r.expires_at = l.expires_at,
    'el enlace de autoservicio no vence a las 24 horas';
  assert l.used_at is null and l.revoked_at is null and l.guard_failures = 0, 'el enlace no nació abierto';

  -- Pedir otro revoca el anterior. Sin eso, el índice de un enlace abierto por
  -- cliente (0552) choca: se traduce al mismo mensaje.
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', 'cliente.uno@example.test', repeat('b', 64));
  exception when unique_violation then
    raise exception 'CONTRATO ROTO: pedir otro enlace no revocó el anterior (chocó con el enlace abierto)';
  end;
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('a', 64)) is not null,
    'pedir otro enlace no revocó el anterior';
  assert (select used_at is null and revoked_at is null from public.client_registration_links where token_hash = repeat('b', 64)),
    'el enlace nuevo no quedó abierto';

  -- Un link del equipo vencido no frena el autoservicio, y queda revocado.
  update public.client_registration_links set expires_at = now() - interval '1 minute' where token_hash = repeat('8', 64);
  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c110', 'diez@example.test', repeat('d', 64));
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('8', 64)) is not null,
    'el link vencido del equipo quedó abierto';
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- D. Mirar (GET): no gasta y no abre lo que no sirve
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
do $$
declare
  r record;
  c public.clients;
begin
  select * into r from public.portal_registration_link_peek_self(repeat('b', 64));
  assert r.issued_to_email = 'cliente.uno@example.test', 'mirar no devolvió el correo al que salió el enlace';
  assert (select used_at is null and revoked_at is null and guard_failures = 0
            from public.client_registration_links where token_hash = repeat('b', 64)),
    'mirar gastó el enlace';
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('a', 64))),
    'un enlace reemplazado todavía abre';
  -- Aunque un enlace del equipo llevara el correo de la ficha (el CHECK lo
  -- permite), la ruta del autoservicio no lo abre: el origen se mira aparte del
  -- correo. Se le quita en el bloque E, después de intentar completarlo.
  update public.client_registration_links set issued_to_email = 'nueve@example.test'
   where token_hash = repeat('9', 64);
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('9', 64))),
    'mirar el enlace de autoservicio abre un enlace del equipo';
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('0', 64))),
    'un token inventado abre algo';
  assert not exists (select 1 from public.portal_registration_link_peek_self('no-es-un-hash')),
    'algo que no es un hash abre algo';

  select * into c from public.clients where id = '00000000-0000-0000-0000-00000000c114';

  -- Con 3 intentos anotados, aunque no esté revocado, no abre ni completa.
  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c114', 'catorce@example.test', repeat('6', 64));
  assert exists (select 1 from public.portal_registration_link_peek_self(repeat('6', 64))), 'el enlace recién emitido no abre';
  update public.client_registration_links set guard_failures = 3 where token_hash = repeat('6', 64);
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('6', 64))),
    'un enlace con 3 intentos fallidos todavía abre';
  begin
    perform public.portal_registration_link_complete_self(repeat('6', 64), 'persona', 'Catorce Prueba', null,
      'V-23.232.323', 'catorce@example.test', '0414-555-3414', null, 'Maracay', 'Aragua', null, false);
    raise exception 'CONTRATO ROTO: un enlace con 3 intentos fallidos todavía completa';
  exception when no_data_found then null;
  end;

  -- Pedir otro revoca ese; el nuevo, vencido, tampoco sirve.
  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c114', 'catorce@example.test', repeat('7', 64));
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('6', 64)) is not null,
    'el enlace con 3 intentos quedó abierto al pedir otro';
  update public.client_registration_links set expires_at = now() - interval '1 minute' where token_hash = repeat('7', 64);
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('7', 64))),
    'un enlace vencido todavía abre';
  begin
    perform public.portal_registration_link_complete_self(repeat('7', 64), 'persona', 'Catorce Prueba', null,
      'V-23.232.323', 'catorce@example.test', '0414-555-3414', null, 'Maracay', 'Aragua', null, false);
    raise exception 'CONTRATO ROTO: un enlace vencido completó la ficha';
  exception when no_data_found then null;
  end;
  assert (select to_jsonb(x) from public.clients x where x.id = c.id) = to_jsonb(c),
    'un enlace que no sirve tocó la ficha';
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- E. La ruta del equipo y la del autoservicio no se cruzan
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
do $$
declare
  r record;
  c public.clients;
begin
  select * into c from public.clients where id = '00000000-0000-0000-0000-00000000c101';

  -- ⭐ Un enlace de autoservicio llevado a /registro/link/<token>.
  assert not exists (select 1 from public.portal_registration_link_peek(repeat('b', 64))),
    'la ruta del equipo muestra el Shipping Mark de un enlace de autoservicio';
  begin
    perform public.portal_registration_link_complete(repeat('b', 64), 'persona', 'Intruso', null,
      'V-99.999.999', 'intruso@example.test', '0412-555-9999', null, 'Caracas', 'Distrito Capital', null, false);
    raise exception 'CONTRATO ROTO: la ruta del equipo completó con un enlace de autoservicio';
  exception when no_data_found then
    assert sqlerrm = 'link_invalido', 'la ruta del equipo respondió: ' || sqlerrm;
  end;
  assert (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) is null,
    'la ruta del equipo gastó un enlace de autoservicio';
  assert (select to_jsonb(x) from public.clients x where x.id = c.id) = to_jsonb(c),
    'la ruta del equipo tocó la ficha con un enlace de autoservicio';

  -- ⭐ Un link del equipo llevado a la página del autoservicio.
  begin
    perform public.portal_registration_link_complete_self(repeat('9', 64), 'persona', 'Nueve Prueba', null,
      'V-19.191.919', 'nueve@example.test', '0414-555-1909', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: completar con la guarda aceptó un enlace del equipo';
  exception when no_data_found then null;
  end;
  assert (select used_at is null and guard_failures = 0
            from public.client_registration_links where token_hash = repeat('9', 64)),
    'completar con la guarda tocó un link del equipo';
  update public.client_registration_links set issued_to_email = null where token_hash = repeat('9', 64);

  -- Regresión de la 0646: la ruta del equipo sigue igual con sus links.
  select * into r from public.portal_registration_link_peek(repeat('9', 64));
  assert r.markbox = 'DTD-8109', 'la ruta del equipo dejó de abrir sus links';
  select * into r from public.portal_registration_link_complete(repeat('9', 64), 'persona', 'Nueve Prueba', null,
    'V-19.191.919', 'nueve.equipo@example.test', '0414-555-1909', null, 'Valencia', 'Carabobo', null, false);
  assert r.markbox = 'DTD-8109' and r.email = 'nueve.equipo@example.test',
    'la ruta del equipo dejó de completar sus links';
  assert (select used_at from public.client_registration_links where token_hash = repeat('9', 64)) is not null,
    'la ruta del equipo no gastó su link';

  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c113', 'trece@example.test', repeat('5', 64));
end $$;
reset role;

-- Un link nuevo del equipo revoca el de autoservicio (el equipo decide).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c113', repeat('e', 64));
end $$;
reset role;
set local request.jwt.claim.sub = '';
do $$ begin
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('5', 64)) is not null,
    'el link del equipo dejó vivo el enlace de autoservicio';
  assert (select link_origin from public.client_registration_links where token_hash = repeat('e', 64)) = 'equipo',
    'el link nuevo del equipo no nació del equipo';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- F. Completar con la guarda
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
do $$
declare
  r record;
  l public.client_registration_links;
  c public.clients;
begin
  select * into c from public.clients where id = '00000000-0000-0000-0000-00000000c101';

  -- ⭐ Ni el documento ni el WhatsApp coinciden.
  select * into r from public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Otra Persona', null,
    'V-99.999.999', 'cliente.uno@example.test', '0412-555-9999', null, 'Caracas', 'Distrito Capital', null, false);
  assert r.estado = 'no_coincide', 'la guarda dejó pasar datos que no coinciden';
  assert r.client_id is null and r.tenant_id is null and r.markbox is null and r.email is null
     and r.link_id is null and r.correo_probado is null and r.duplicate_matched_by is null and r.rif_skipped is null,
    'el rechazo de la guarda devolvió datos de la ficha';
  select * into l from public.client_registration_links where token_hash = repeat('b', 64);
  assert l.used_at is null and l.revoked_at is null, 'un intento fallido gastó el enlace';
  assert l.guard_failures = 1, 'un intento fallido no sumó';
  assert (select to_jsonb(x) from public.clients x where x.id = c.id) = to_jsonb(c), 'un intento fallido tocó la ficha';
  assert exists (select 1 from public.portal_registration_link_peek_self(repeat('b', 64))),
    'un intento fallido mató el enlace antes de tiempo';

  -- ⭐ Un documento que no se normaliza no salta la guarda (y el WhatsApp tampoco coincide).
  select * into r from public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Otra Persona', null,
    'abc', 'cliente.uno@example.test', '0412-555-9999', null, 'Caracas', 'Distrito Capital', null, false);
  assert r.estado = 'no_coincide', 'un documento que no se normaliza salta la guarda';
  assert (select guard_failures from public.client_registration_links where id = l.id) = 2, 'el segundo intento no sumó';
  assert (select to_jsonb(x) from public.clients x where x.id = c.id) = to_jsonb(c), 'un intento fallido tocó la ficha';

  -- Un correo que ya tiene cuenta: no gasta el enlace ni suma un intento.
  begin
    perform public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Ana Uno', null,
      '12345678', 'Ocupado@example.test', '0412-555-9999', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: completó con un correo que ya tiene cuenta';
  exception when unique_violation then
    assert sqlerrm = 'correo_en_uso', 'el correo con cuenta respondió: ' || sqlerrm;
  end;
  assert (select used_at is null and guard_failures = 2 from public.client_registration_links where id = l.id),
    'el correo con cuenta gastó el enlace o sumó un intento';

  -- ⭐ El documento coincide en otro formato («V-12.345.678» en la ficha, «12345678» en el formulario).
  select * into r from public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Ana Uno', null,
    '12345678', 'Cliente.UNO@example.test', '0412-555-9999', null, 'Valencia', 'Carabobo', 'Calle Ficticia 1', true);
  assert r.estado = 'ok', 'el documento en otro formato no pasó la guarda';
  assert r.client_id = c.id and r.tenant_id = c.tenant_id and r.markbox = 'DTD-8101'
     and r.email = 'cliente.uno@example.test' and r.link_id = l.id,
    'completar no devolvió la ficha';
  assert r.correo_probado, 'dejó el correo al que salió el enlace y no quedó probado';
  assert r.duplicate_matched_by is null and not r.rif_skipped, 'marcó un duplicado que no existe';

  select * into l from public.client_registration_links where id = l.id;
  assert l.used_at is not null, 'completar no gastó el enlace';
  assert l.guard_failures = 2, 'pasar la guarda cambió los intentos';
  assert l.prev_data ->> 'rif' = 'V-12.345.678' and l.prev_data ->> 'email' = 'Cliente.Uno@Example.test'
     and l.prev_data ->> 'phone' = '0414-555-1101' and l.prev_data ->> 'name' = 'CLIENTE AUTOSERVICIO UNO',
    'no guardó lo que tenía la ficha';
  assert l.submitted_data ->> 'document' = '12345678' and l.submitted_data ->> 'email' = 'cliente.uno@example.test'
     and l.submitted_data ->> 'phone' = '0412-555-9999' and (l.submitted_data ->> 'email_optin')::boolean,
    'no guardó lo que escribió el cliente';

  select * into c from public.clients where id = c.id;
  assert c.name = 'Ana Uno' and c.rif = '12345678' and c.doc_kind = 'persona' and c.email = 'cliente.uno@example.test'
     and c.phone = '0412-555-9999' and c.city = 'Valencia' and c.state = 'Carabobo' and c.address = 'Calle Ficticia 1',
    'no completó la ficha';
  assert c.markbox = 'DTD-8101', 'completar cambió el Shipping Mark';
  assert c.portal_approved_at is not null, 'la ficha no quedó aprobada para el portal';
  assert c.email_marketing_optin_at is not null and c.email_optin_source = 'portal_register_self',
    'no anotó el consentimiento con su origen';
  assert (select count(*) from public.clients) = 14, 'completar creó otra ficha';

  -- Usado: ya no abre ni completa.
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('b', 64))),
    'un enlace usado todavía abre';
  begin
    perform public.portal_registration_link_complete_self(repeat('b', 64), 'persona', 'Ana Uno', null,
      '12345678', 'cliente.uno@example.test', '0412-555-9999', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: el enlace se usó dos veces';
  exception when no_data_found then null;
  end;

  -- ⭐ Solo el WhatsApp coincide (la ficha no tiene documento), con otro formato; el cliente cambia el correo.
  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c102', 'dos@example.test', repeat('2', 64));
  select * into r from public.portal_registration_link_complete_self(repeat('2', 64), 'empresa', 'Luis Dos', 'Comercial Dos C.A.',
    'J-50505050-5', 'nuevo.dos@example.test', '+58 424 5552202', null, 'Barquisimeto', 'Lara', null, false);
  assert r.estado = 'ok', 'el WhatsApp solo no pasó la guarda';
  assert r.correo_probado is not null and not r.correo_probado,
    'dijo que el correo quedó probado cuando el cliente lo cambió';
  assert (select name = 'Comercial Dos C.A.' and contact_name = 'Luis Dos' and email = 'nuevo.dos@example.test'
            from public.clients where id = '00000000-0000-0000-0000-00000000c102'),
    'el WhatsApp coincidió y no completó la ficha';
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- G. Tres intentos y el enlace muere
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
do $$
declare
  r record;
  l public.client_registration_links;
  c public.clients;
begin
  select * into c from public.clients where id = '00000000-0000-0000-0000-00000000c111';
  perform public.portal_registration_link_create_self(c.id, 'once@example.test', repeat('3', 64));

  -- La guarda va antes que el correo con cuenta: no revela que los datos coincidieron.
  select * into r from public.portal_registration_link_complete_self(repeat('3', 64), 'persona', 'Otro', null,
    'V-11.111.111', 'ocupado@example.test', '0412-555-0000', null, 'Caracas', 'Distrito Capital', null, false);
  assert r.estado = 'no_coincide', 'el correo con cuenta se miró antes que la guarda';
  select * into r from public.portal_registration_link_complete_self(repeat('3', 64), 'persona', 'Otro', null,
    'V-11.111.111', 'once@example.test', '0412-555-0000', null, 'Caracas', 'Distrito Capital', null, false);
  assert r.estado = 'no_coincide', 'el segundo intento pasó la guarda';
  select * into l from public.client_registration_links where token_hash = repeat('3', 64);
  assert l.guard_failures = 2 and l.revoked_at is null, 'con 2 intentos el enlace murió antes de tiempo';

  select * into r from public.portal_registration_link_complete_self(repeat('3', 64), 'persona', 'Otro', null,
    'V-11.111.111', 'once@example.test', '0412-555-0000', null, 'Caracas', 'Distrito Capital', null, false);
  assert r.estado = 'no_coincide', 'el tercer intento pasó la guarda';
  select * into l from public.client_registration_links where id = l.id;
  assert l.guard_failures = 3, 'el tercer intento no sumó';
  assert l.revoked_at is not null, 'tres intentos fallidos no revocaron el enlace';
  assert l.used_at is null, 'los intentos fallidos gastaron el enlace como usado';

  -- Muerto: ni con los datos correctos.
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('3', 64))),
    'un enlace muerto por intentos todavía abre';
  begin
    perform public.portal_registration_link_complete_self(repeat('3', 64), 'persona', 'Once Prueba', null,
      'J404040404', 'once@example.test', '0414-555-3111', null, 'Caracas', 'Distrito Capital', null, false);
    raise exception 'CONTRATO ROTO: un enlace muerto por intentos completó la ficha';
  exception when no_data_found then null;
  end;
  assert (select to_jsonb(x) from public.clients x where x.id = c.id) = to_jsonb(c),
    'los intentos fallidos tocaron la ficha';
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- H. Vincular la cuenta del correo probado
-- ═════════════════════════════════════════════════════════════════════════════
-- La app crea la cuenta de Auth con el correo (aquí, a mano).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'Cliente.Uno@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'nuevo.dos@example.test'),
  ('00000000-0000-0000-0000-0000000000b9', 'nueve.equipo@example.test');

set local role service_role;
do $$
declare r record;
begin
  -- c112: el equipo invita por correo mientras el enlace está abierto.
  perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c112', 'doce@example.test', repeat('4', 64));
  insert into public.client_users (tenant_id, client_id, email, status)
  values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c112', 'doce@example.test', 'invited');
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('4', 64))),
    'el enlace abre para un cliente que ya tiene una fila de acceso';
  begin
    perform public.portal_registration_link_complete_self(repeat('4', 64), 'persona', 'Doce Prueba', null,
      'V-21.212.121', 'doce@example.test', '0414-555-3212', null, 'Mérida', 'Mérida', null, false);
    raise exception 'CONTRATO ROTO: completó la ficha de un cliente que ya tiene una fila de acceso';
  exception when no_data_found then null;
  end;

  -- Sin esa fila completa; y si el equipo invita entre completar y vincular, no se pisa.
  delete from public.client_users where client_id = '00000000-0000-0000-0000-00000000c112';
  select * into r from public.portal_registration_link_complete_self(repeat('4', 64), 'persona', 'Doce Prueba', null,
    'V-21.212.121', 'doce@example.test', '0414-555-3212', null, 'Mérida', 'Mérida', null, false);
  assert r.estado = 'ok' and r.correo_probado, 'el cliente doce no completó con su correo';
  insert into public.client_users (tenant_id, client_id, email, status)
  values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c112', 'doce@example.test', 'invited');
end $$;
reset role;
-- La app crea la cuenta del cliente doce después de completar (aquí, a mano).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000bc', 'doce@example.test');

set local role service_role;
do $$
declare v_e uuid := (select id from public.client_registration_links where token_hash = repeat('4', 64));
begin
  begin
    perform public.portal_registration_link_bind_self(v_e, '00000000-0000-0000-0000-0000000000bc');
    raise exception 'CONTRATO ROTO: vinculó sobre una fila de acceso que ya existía';
  exception when invalid_parameter_value then null;
  end;
  assert (select status = 'invited' and auth_user_id is null
            from public.client_users where client_id = '00000000-0000-0000-0000-00000000c112'),
    'vincular pisó la fila de acceso que ya existía';
end $$;

do $$
declare
  v_b uuid := (select id from public.client_registration_links where token_hash = repeat('b', 64));
  v_2 uuid := (select id from public.client_registration_links where token_hash = repeat('2', 64));
  v_3 uuid := (select id from public.client_registration_links where token_hash = repeat('3', 64));
  v_9 uuid := (select id from public.client_registration_links where token_hash = repeat('9', 64));
  u public.client_users;
begin
  -- Solo autoservicio: un link del equipo va por la vinculación de la 0559.
  begin
    perform public.portal_registration_link_bind_self(v_9, '00000000-0000-0000-0000-0000000000b9');
    raise exception 'CONTRATO ROTO: vinculó por el autoservicio un link del equipo';
  exception when no_data_found then null;
  end;
  -- Un enlace que no se usó.
  begin
    perform public.portal_registration_link_bind_self(v_3, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'CONTRATO ROTO: vinculó un enlace que no se usó';
  exception when no_data_found then null;
  end;
  -- ⭐ El cliente cambió el correo: no está probado; va por la comprobación de la 0559.
  begin
    perform public.portal_registration_link_bind_self(v_2, '00000000-0000-0000-0000-0000000000b2');
    raise exception 'CONTRATO ROTO: vinculó sin comprobar un correo que no es al que salió el enlace';
  exception when invalid_parameter_value then null;
  end;
  -- Otra cuenta, o una que no existe.
  begin
    perform public.portal_registration_link_bind_self(v_b, '00000000-0000-0000-0000-0000000000f1');
    raise exception 'CONTRATO ROTO: vinculó una cuenta con otro correo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_registration_link_bind_self(v_b, '00000000-0000-0000-0000-00000000dead');
    raise exception 'CONTRATO ROTO: vinculó una cuenta que no existe';
  exception when invalid_parameter_value then null;
  end;
  -- Usado hace más de 10 minutos.
  update public.client_registration_links set used_at = now() - interval '11 minutes' where id = v_b;
  begin
    perform public.portal_registration_link_bind_self(v_b, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'CONTRATO ROTO: vinculó un enlace usado hace más de 10 minutos';
  exception when no_data_found then null;
  end;
  update public.client_registration_links set used_at = now(), access_error = 'createUser: prueba' where id = v_b;

  -- La cuenta del correo probado.
  perform public.portal_registration_link_bind_self(v_b, '00000000-0000-0000-0000-0000000000b1');
  select * into u from public.client_users where client_id = '00000000-0000-0000-0000-00000000c101';
  assert u.status = 'active' and u.auth_user_id = '00000000-0000-0000-0000-0000000000b1'
     and u.email = 'cliente.uno@example.test' and u.bound_at is not null and u.revoked_at is null,
    'vincular no dejó el acceso activo con el correo probado';
  -- ⭐ Abrir el enlace probó el correo: no queda «sin comprobar».
  assert not exists (select 1 from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c101'),
    'el correo probado quedó «sin comprobar»';
  assert (select access_error from public.client_registration_links where id = v_b) is null,
    'vincular no limpió el error de acceso';

  -- Una sola vez; y con la fila de acceso ya no se emite otro enlace.
  begin
    perform public.portal_registration_link_bind_self(v_b, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'CONTRATO ROTO: vinculó dos veces';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) from public.client_users where client_id = '00000000-0000-0000-0000-00000000c101') = 1,
    'vincular dejó dos filas de acceso';
  begin
    perform public.portal_registration_link_create_self('00000000-0000-0000-0000-00000000c101', 'cliente.uno@example.test', repeat('f', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace a un cliente que ya tiene portal';
  exception when no_data_found then null;
  end;
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- I. La ficha cambia con el enlace abierto: borrada, fusionada o con otro correo
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
do $$
declare c public.clients;
begin
  select * into c from public.clients where id = '00000000-0000-0000-0000-00000000c114';
  perform public.portal_registration_link_create_self(c.id, 'catorce@example.test', repeat('1', 64));
  assert exists (select 1 from public.portal_registration_link_peek_self(repeat('1', 64))),
    'el enlace de catorce no abre';

  -- Borrada.
  update public.clients set deleted_at = now() where id = c.id;
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('1', 64))),
    'mirar abre el enlace de una ficha borrada';
  begin
    perform public.portal_registration_link_complete_self(repeat('1', 64), 'persona', 'Catorce Prueba', null,
      'V-23.232.323', 'catorce@example.test', '0414-555-3414', null, 'Maracay', 'Aragua', null, false);
    raise exception 'CONTRATO ROTO: completar con la guarda aceptó una ficha borrada';
  exception when no_data_found then null;
  end;
  update public.clients set deleted_at = null where id = c.id;

  -- Fusionada.
  update public.clients set merged_into_client_id = '00000000-0000-0000-0000-00000000c101' where id = c.id;
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('1', 64))),
    'mirar abre el enlace de una ficha fusionada';
  begin
    perform public.portal_registration_link_complete_self(repeat('1', 64), 'persona', 'Catorce Prueba', null,
      'V-23.232.323', 'catorce@example.test', '0414-555-3414', null, 'Maracay', 'Aragua', null, false);
    raise exception 'CONTRATO ROTO: completar con la guarda aceptó una ficha fusionada';
  exception when no_data_found then null;
  end;
  update public.clients set merged_into_client_id = null where id = c.id;

  -- ⭐ El equipo corrige un correo con tipeo: el enlace que salió al correo viejo muere.
  update public.clients set email = 'catorce.corregido@example.test' where id = c.id;
  assert not exists (select 1 from public.portal_registration_link_peek_self(repeat('1', 64))),
    'un enlace mandado a un correo que la ficha ya corrigió todavía abre';
  begin
    perform public.portal_registration_link_complete_self(repeat('1', 64), 'persona', 'Catorce Prueba', null,
      'V-23.232.323', 'catorce@example.test', '0414-555-3414', null, 'Maracay', 'Aragua', null, false);
    raise exception 'CONTRATO ROTO: un enlace mandado a un correo que la ficha ya corrigió todavía completa';
  exception when no_data_found then null;
  end;

  -- Nada de eso gastó el enlace ni sumó intentos; con la ficha como estaba, vuelve a abrir.
  assert (select used_at is null and revoked_at is null and guard_failures = 0
            from public.client_registration_links where token_hash = repeat('1', 64)),
    'un enlace rechazado por el estado de la ficha se gastó o sumó un intento';
  update public.clients set email = c.email where id = c.id;
  assert exists (select 1 from public.portal_registration_link_peek_self(repeat('1', 64))),
    'con la ficha como estaba, el enlace no abre';
  assert (select deleted_at is null and merged_into_client_id is null and email = c.email
            from public.clients where id = c.id),
    'el bloque I no dejó la ficha como estaba';
end $$;

reset role;
select 'TEST 0562 GREEN' as resultado;

rollback;
