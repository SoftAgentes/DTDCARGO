\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0559 (SDD-0646, D-1 opción C). Fixtures
-- ficticios y rollback: no toca producción ni datos reales.
--
-- El esquema de base es el mismo doble del contrato de la 0552 (hasta aplicar
-- la 0552); lo propio de este contrato empieza en «Datos ficticios».
--
-- Lo que fija:
--   G. Permisos: las RPC del enlace, sólo el servidor; preparar, sólo el equipo.
--   H. Las cuentas por link que ya existían quedan «sin comprobar»; las de
--      otros caminos no cambian. Un correo sin comprobar no recibe enlace de
--      entrada.
--   I. No se emite el enlace mientras la cuenta no lleve su dirección interna.
--   J. Emitir y mirar: mirar no gasta; emitir otro reemplaza el anterior.
--   K. Reclamar y confirmar exigen la sesión del titular: sin ella no se
--      confirma ni se gasta el enlace. Reclamar es de un solo uso y no
--      comprueba; confirmar exige que el correo ya esté en la cuenta; vencido,
--      usado o inventado no sirven.
--   L. El registro nuevo nace con la dirección interna; si el correo ya tiene
--      otra cuenta, queda en choque y no se fusiona nada.
--   M. Corregir el correo lo devuelve a «sin comprobar».
--   N. Reenviar desde Studio exige rol y tenant.
--   P. Revocar y volver a invitar por correo saca al cliente de la regla,
--      pero el equipo sigue viendo «nunca comprobado».
--   Q. Una confirmación a medias queda para revisión, con el enlace gastado.

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

-- ── Datos ficticios ──────────────────────────────────────────────────────────
-- t1: el tenant de DTD. t2: otro tenant. a1 equipo, b1 un rol sin permiso, e1
-- admin de t2. Fichas: c1 (legado, se registra por link ANTES de la 0559: cuenta
-- con el correo real), c3 (cuenta de otro camino: invitación por correo), c4
-- (legado, se registra por link DESPUÉS de la 0559: cuenta con dirección
-- interna), cx (t2).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'equipo@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'viewer@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'otro-tenant@example.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'ocupado@example.test');
insert into public.tenants (id) values
  ('00000000-0000-0000-0000-00000000d7d1'),
  ('00000000-0000-0000-0000-00000000d7d2');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'operations'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000d7d1', 'viewer'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000d7d2', 'admin');

insert into public.clients (id, tenant_id, markbox, name, phone) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8001', 'CLIENTE LEGADO UNO', '0414-555-0101'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8003', 'Con Portal', null),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8004', 'Legado Cuatro', '0416-555-0404'),
  ('00000000-0000-0000-0000-00000000c0ff', '00000000-0000-0000-0000-00000000d7d2', 'XT-0001', 'Otro tenant', null);

-- c3: cuenta de otro camino (no nació de un link).
insert into public.client_users (tenant_id, client_id, email, auth_user_id, status, bound_at) values
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003',
   'ocupado@example.test', '00000000-0000-0000-0000-0000000000f1', 'active', now());

-- c1 se registra por link con la app de ANTES (cuenta sin dirección interna).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c001', repeat('b', 64));
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c004', repeat('4', 64));
end $$;
reset role;
set local role service_role;
set local request.jwt.claim.sub = '';
do $$ begin
  perform public.portal_registration_link_complete(repeat('b', 64), 'persona', 'Ana Pérez', null,
    'V-33333333', 'Ana@Example.test', '0414-555-0101', null, 'Valencia', 'Carabobo', null, false);
end $$;
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'ana@example.test');
set local role service_role;
do $$ begin
  perform public.portal_registration_link_bind(
    (select id from public.client_registration_links where token_hash = repeat('b', 64)),
    '00000000-0000-0000-0000-0000000000c1');
end $$;
reset role;

\ir ../migrations/0559_registro_link_correo_comprobado.sql

-- Como en Supabase: service_role tiene grants sobre las tablas nuevas.
grant select, insert, update, delete on all tables in schema public to service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- G. Permisos
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'public.portal_email_sin_comprobar(text)',
    'public.portal_email_check_auth_interno(uuid)',
    'public.portal_email_check_issue(uuid,text)',
    'public.portal_email_check_peek(text,uuid)',
    'public.portal_email_check_claim(text,uuid)',
    'public.portal_email_check_confirm(uuid,uuid)',
    'public.portal_email_check_release(uuid,boolean)',
    'public.portal_email_check_revisar(uuid)',
    'public.portal_registration_link_bind(uuid,uuid)'
  ] loop
    assert not has_function_privilege('anon', f, 'EXECUTE'), 'anon puede ejecutar ' || f;
    assert not has_function_privilege('authenticated', f, 'EXECUTE'), 'un usuario con sesión puede ejecutar ' || f;
    assert has_function_privilege('service_role', f, 'EXECUTE'), 'la ruta del servidor no puede ejecutar ' || f;
  end loop;
  assert has_function_privilege('authenticated', 'public.portal_email_check_prepare(uuid)', 'EXECUTE'),
    'el equipo no puede preparar el reenvío';
  assert not has_function_privilege('service_role', 'public.portal_email_check_prepare(uuid)', 'EXECUTE'),
    'service_role puede preparar un reenvío sin un usuario del equipo';
  assert not has_function_privilege('anon', 'public.portal_email_check_prepare(uuid)', 'EXECUTE'),
    'anon puede preparar un reenvío';
  assert not has_function_privilege('authenticated', 'public.portal_email_interno_nuevo()', 'EXECUTE'),
    'un usuario con sesión puede pedir direcciones internas';
  assert not has_table_privilege('authenticated', 'public.client_email_checks', 'INSERT')
     and not has_table_privilege('authenticated', 'public.client_email_checks', 'UPDATE')
     and not has_table_privilege('authenticated', 'public.client_email_checks', 'DELETE'),
    'el equipo puede escribir el estado del correo a mano';
  assert not has_table_privilege('anon', 'public.client_email_checks', 'SELECT'),
    'anon puede leer el estado del correo';
  -- Ni el hash del token ni el correo por comprobar salen por PostgREST.
  assert not has_table_privilege('authenticated', 'public.client_email_checks', 'SELECT'),
    'un usuario con sesión puede leer la tabla (hash del token y correo por comprobar)';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_email_checks'),
    'la tabla tiene policies: alguien la lee o la escribe por PostgREST';
  assert has_function_privilege('authenticated', 'public.portal_email_check_estado(uuid[])', 'EXECUTE'),
    'el equipo no puede ver el estado del correo';
  assert not has_function_privilege('anon', 'public.portal_email_check_estado(uuid[])', 'EXECUTE'),
    'anon puede ver el estado del correo';
  -- El estado no devuelve ni el correo ni el hash.
  assert (select array_agg(a.attname order by a.attnum)
            from pg_catalog.pg_proc p,
                 lateral unnest(p.proargnames, p.proargmodes) with ordinality as a(attname, mode, attnum)
           where p.oid = 'public.portal_email_check_estado(uuid[])'::regprocedure
             and a.mode = 't') = array['client_id', 'link_id', 'estado', 'sent_at']::text[],
    'el estado para el equipo devuelve algo más que el estado';
  assert to_regprocedure('public.portal_registration_link_email_status(uuid[])') is null,
    'la heurística de la 0552 sigue viva';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- H. Las cuentas por link que ya existían quedan «sin comprobar»; las de otros
--    caminos no cambian
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare ch public.client_email_checks; r record;
begin
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001';
  assert ch.id is not null, 'la cuenta por link que ya existía no quedó anotada';
  assert ch.verified_at is null, 'la cuenta por link que ya existía nació comprobada';
  assert ch.auth_interno = false, 'dijo que la cuenta ya lleva la dirección interna sin que Auth la tenga';
  assert ch.pending_email = 'ana@example.test', 'no anotó el correo por comprobar';
  assert ch.internal_email ~ '^c-[0-9a-f]{32}@sin-comprobar\.invalid$', 'la dirección interna no tiene la forma pactada';
  assert position('8001' in ch.internal_email) = 0 and position('ana' in ch.internal_email) = 0,
    'la dirección interna sale de un dato del cliente';
  assert not exists (select 1 from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c003'),
    'una cuenta de otro camino quedó anotada como sin comprobar';

  -- El correo del acceso de una cuenta por link sin comprobar: bloqueado.
  select * into r from public.portal_email_sin_comprobar('  ANA@example.test ');
  assert r.bloquea, 'un correo sin comprobar puede recibir un enlace de entrada';
  assert r.pendiente, 'no reconoció el correo por comprobar';
  -- El de una cuenta de otro camino: no cambia.
  select * into r from public.portal_email_sin_comprobar('ocupado@example.test');
  assert not r.bloquea and not r.pendiente, 'bloqueó una cuenta de otro camino';
  select * into r from public.portal_email_sin_comprobar('nadie@example.test');
  assert not r.bloquea and not r.pendiente, 'bloqueó un correo que no existe';
  -- Una dirección interna nunca recibe un enlace de entrada.
  select * into r from public.portal_email_sin_comprobar(ch.internal_email);
  assert r.bloquea, 'una dirección interna puede recibir un enlace de entrada';
end $$;

-- El equipo lee el estado de su tenant; el de otro tenant, no.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select * into r from public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c001']::uuid[]);
  assert r.estado = 'sin_comprobar', 'el equipo no ve el estado del correo de su tenant';
  begin
    perform 1 from public.client_email_checks;
    raise exception 'CONTRATO ROTO: el equipo leyó la tabla directamente';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert not exists (select 1 from public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c001']::uuid[])),
    'otro tenant ve el estado del correo';
end $$;
-- Un cliente del portal (sin tenant de equipo) no ve el estado de nadie.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  begin
    perform public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c001']::uuid[]);
    raise exception 'CONTRATO ROTO: un cliente del portal vio el estado del correo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- I. No hay enlace de comprobación mientras la cuenta no lleve su dirección interna
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
set local request.jwt.claim.sub = '';
do $$
declare v_check uuid := (select id from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001');
begin
  begin
    perform public.portal_email_check_issue(v_check, repeat('e', 64));
    raise exception 'CONTRATO ROTO: emitió el enlace sin que la cuenta lleve su dirección interna';
  exception when invalid_parameter_value then null;
  end;
  -- La base no acepta «ya lleva la dirección interna» si Auth no la tiene.
  begin
    perform public.portal_email_check_auth_interno(v_check);
    raise exception 'CONTRATO ROTO: anotó la dirección interna sin que la cuenta la lleve';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- La app cambia la cuenta con la API de Auth (aquí, a mano).
update auth.users u set email = ch.internal_email
  from public.client_email_checks ch
 where ch.client_id = '00000000-0000-0000-0000-00000000c001' and u.id = ch.auth_user_id;

set local role service_role;
do $$
declare
  ch public.client_email_checks;
  r record;
begin
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001';
  perform public.portal_email_check_auth_interno(ch.id);
  assert (select auth_interno from public.client_email_checks where id = ch.id), 'no anotó la dirección interna';
  assert (select email from public.client_users where client_id = ch.client_id) = ch.internal_email,
    'el acceso sigue respondiendo al correo sin comprobar';
  -- El correo real ya no es el de ningún acceso; sigue «por comprobar».
  select * into r from public.portal_email_sin_comprobar('ana@example.test');
  assert r.pendiente, 'perdió el correo por comprobar';

  -- ═══════════════════════════════════════════════════════════════════════════
  -- J. Emitir y mirar
  -- ═══════════════════════════════════════════════════════════════════════════
  begin
    perform public.portal_email_check_issue(ch.id, 'DTD-8001');
    raise exception 'CONTRATO ROTO: aceptó un token que no es un hash';
  exception when invalid_parameter_value then null;
  end;
  select * into r from public.portal_email_check_issue(ch.id, repeat('e', 64));
  assert r.markbox = 'DTD-8001' and r.pending_email = 'ana@example.test', 'emitir no devolvió a quién se le manda';
  assert r.expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour',
    'el enlace de comprobación no vence a los 7 días';

  select * into r from public.portal_email_check_peek(repeat('e', 64), null);
  assert r.markbox = 'DTD-8001', 'mirar no devolvió el código';
  -- ⭐ El correo por comprobar sólo lo ve el titular, con su sesión.
  assert r.pending_email is null, 'mirar le mostró el correo a quien no tiene sesión';
  select * into r from public.portal_email_check_peek(repeat('e', 64), '00000000-0000-0000-0000-0000000000f1');
  assert r.markbox = 'DTD-8001' and r.pending_email is null, 'mirar le mostró el correo a la sesión de otra cuenta';
  select * into r from public.portal_email_check_peek(repeat('e', 64), '00000000-0000-0000-0000-0000000000c1');
  assert r.pending_email = 'ana@example.test', 'mirar no le mostró al titular qué correo confirma';
  assert (select array_agg(a.attname order by a.attnum)
            from pg_catalog.pg_proc p,
                 lateral unnest(p.proargnames, p.proargmodes) with ordinality as a(attname, mode, attnum)
           where p.oid = 'public.portal_email_check_peek(text,uuid)'::regprocedure
             and a.mode = 't') = array['markbox', 'pending_email']::text[],
    'mirar devuelve algo más que el código y el correo del titular';
  -- Mirar no gasta (un filtro de correo abre el enlace con GET).
  assert (select token_used_at from public.client_email_checks where id = ch.id) is null, 'mirar gastó el enlace';
  assert (select verified_at from public.client_email_checks where id = ch.id) is null, 'mirar comprobó el correo';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('0', 64), null)), 'un token inventado abre algo';

  -- Emitir otro reemplaza el anterior.
  perform public.portal_email_check_issue(ch.id, repeat('f', 64));
  assert not exists (select 1 from public.portal_email_check_peek(repeat('e', 64), null)), 'el enlace reemplazado sigue sirviendo';
  assert not exists (select 1 from public.portal_email_check_claim(repeat('e', 64), '00000000-0000-0000-0000-0000000000c1')), 'el enlace reemplazado se pudo reclamar';

  -- ═══════════════════════════════════════════════════════════════════════════
  -- K. Reclamar, confirmar, soltar
  -- ═══════════════════════════════════════════════════════════════════════════
  assert not exists (select 1 from public.portal_email_check_claim(repeat('0', 64), '00000000-0000-0000-0000-0000000000c1')), 'reclamó un token inventado';
  assert not exists (select 1 from public.portal_email_check_claim('no-es-un-hash', '00000000-0000-0000-0000-0000000000c1')), 'reclamó algo que no es un hash';

  -- ⭐ El enlace solo no comprueba. Sin sesión, o con la sesión de otra cuenta,
  --    no confirma, no gasta el enlace y no devuelve nada de la cuenta.
  select * into r from public.portal_email_check_claim(repeat('f', 64), null);
  assert r.outcome = 'sin_sesion_del_titular', 'reclamó sin sesión';
  assert r.check_id is null and r.auth_user_id is null and r.pending_email is null,
    'sin sesión del titular devolvió datos de la cuenta';
  assert (select token_used_at from public.client_email_checks where id = ch.id) is null,
    'un intento sin la sesión del titular gastó el enlace';
  select * into r from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000f1');
  assert r.outcome = 'sin_sesion_del_titular', 'reclamó con la sesión de otra cuenta';
  assert r.check_id is null and r.auth_user_id is null and r.pending_email is null,
    'la sesión de otra cuenta recibió datos de la cuenta';
  assert (select token_used_at from public.client_email_checks where id = ch.id) is null,
    'un intento sin la sesión del titular gastó el enlace';
  assert (select verified_at from public.client_email_checks where id = ch.id) is null,
    'un intento sin la sesión del titular comprobó el correo';
  assert exists (select 1 from public.portal_email_check_peek(repeat('f', 64), null)),
    'un intento sin la sesión del titular mató el enlace';

  -- Vencido no sirve.
  update public.client_email_checks set token_expires_at = now() - interval '1 minute' where id = ch.id;
  assert not exists (select 1 from public.portal_email_check_peek(repeat('f', 64), null)), 'un enlace vencido todavía abre';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1')),
    'un enlace vencido le muestra el correo al titular';
  assert not exists (select 1 from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1')), 'un enlace vencido se pudo reclamar';
  update public.client_email_checks set token_expires_at = now() + interval '7 days' where id = ch.id;

  select * into r from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1');
  assert r.outcome = 'ok' and r.check_id = ch.id and r.pending_email = 'ana@example.test', 'reclamar no devolvió la cuenta';
  -- Un solo uso.
  assert not exists (select 1 from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1')), 'el enlace se reclamó dos veces';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('f', 64), null)), 'un enlace reclamado sigue abriendo';
  -- Reclamar no comprueba: falta que el correo pase a la cuenta.
  assert (select verified_at from public.client_email_checks where id = ch.id) is null, 'reclamar marcó comprobado';
  begin
    perform public.portal_email_check_confirm(ch.id, '00000000-0000-0000-0000-0000000000c1');
    raise exception 'CONTRATO ROTO: marcó comprobado sin que la cuenta lleve el correo';
  exception when invalid_parameter_value then null;
  end;

  -- Soltar (fallo pasajero): el mismo enlace vuelve a servir.
  perform public.portal_email_check_release(ch.id, false);
  select * into r from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1');
  assert r.outcome = 'ok', 'el enlace soltado no se pudo volver a reclamar';
end $$;
reset role;

-- La app pasa el correo real a la cuenta con la API de Auth (aquí, a mano).
update auth.users set email = 'ana@example.test' where id = '00000000-0000-0000-0000-0000000000c1';

set local role service_role;
do $$
declare
  ch public.client_email_checks;
  r record;
begin
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001';
  -- ⭐ Confirmar también exige la sesión del titular, aunque la cuenta ya lleve el correo.
  begin
    perform public.portal_email_check_confirm(ch.id, null);
    raise exception 'CONTRATO ROTO: confirmó sin sesión';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.portal_email_check_confirm(ch.id, '00000000-0000-0000-0000-0000000000f1');
    raise exception 'CONTRATO ROTO: confirmó con la sesión de otra cuenta';
  exception when insufficient_privilege then null;
  end;
  assert (select verified_at from public.client_email_checks where id = ch.id) is null,
    'quedó comprobado sin la sesión del titular';
  perform public.portal_email_check_confirm(ch.id, '00000000-0000-0000-0000-0000000000c1');
  select * into ch from public.client_email_checks where id = ch.id;
  assert ch.verified_at is not null, 'confirmar no marcó comprobado';
  assert not ch.auth_interno, 'comprobado y todavía dice que la cuenta lleva la dirección interna';
  assert (select email from public.client_users where client_id = ch.client_id) = 'ana@example.test',
    'comprobado y el acceso no responde al correo';
  -- Comprobado: el correo queda habilitado.
  select * into r from public.portal_email_sin_comprobar('ana@example.test');
  assert not r.bloquea and not r.pendiente, 'un correo comprobado sigue bloqueado';
  -- El enlace ya no sirve para nada.
  assert not exists (select 1 from public.portal_email_check_claim(repeat('f', 64), '00000000-0000-0000-0000-0000000000c1')), 'el enlace se usó después de comprobar';
  begin
    perform public.portal_email_check_confirm(ch.id, '00000000-0000-0000-0000-0000000000c1');
    raise exception 'CONTRATO ROTO: confirmó dos veces';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_email_check_issue(ch.id, repeat('1', 64));
    raise exception 'CONTRATO ROTO: emitió un enlace para un correo ya comprobado';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- El equipo: un correo ya comprobado no se reenvía; sin rol o de otro tenant, no.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_link uuid := (select id from public.client_registration_links where token_hash = repeat('b', 64));
begin
  begin
    perform public.portal_email_check_prepare(v_link);
    raise exception 'CONTRATO ROTO: preparó el reenvío de un correo ya comprobado';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_email_check_prepare('00000000-0000-0000-0000-00000000dead');
    raise exception 'CONTRATO ROTO: preparó el reenvío de un registro que no existe';
  exception when no_data_found then null;
  end;
end $$;
reset role;

-- ═════════════════════════════════════════════════════════════════════════════
-- L. Registro nuevo: la cuenta nace con la dirección interna
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
set local request.jwt.claim.sub = '';
do $$ begin
  perform public.portal_registration_link_complete(repeat('4', 64), 'persona', 'Luis Cuatro', null,
    'V-44444444', 'luis@example.test', '0416-555-0404', null, 'Maracay', 'Aragua', null, false);
end $$;
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c4', 'c-' || repeat('a', 32) || '@sin-comprobar.invalid'),
  ('00000000-0000-0000-0000-0000000000c9', 'otra@example.test');
set local role service_role;
do $$
declare
  v_link uuid := (select id from public.client_registration_links where token_hash = repeat('4', 64));
  ch public.client_email_checks;
begin
  -- Una cuenta con otro correo real sigue sin poder enlazarse.
  begin
    perform public.portal_registration_link_bind(v_link, '00000000-0000-0000-0000-0000000000c9');
    raise exception 'CONTRATO ROTO: enlazó una cuenta con otro correo';
  exception when invalid_parameter_value then null;
  end;
  perform public.portal_registration_link_bind(v_link, '00000000-0000-0000-0000-0000000000c4');
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c004';
  assert ch.id is not null and ch.verified_at is null, 'el registro nuevo no quedó sin comprobar';
  assert ch.auth_interno, 'el registro nuevo no anotó que la cuenta lleva la dirección interna';
  assert ch.pending_email = 'luis@example.test', 'el registro nuevo no anotó el correo por comprobar';
  assert ch.internal_email = 'c-' || repeat('a', 32) || '@sin-comprobar.invalid', 'anotó otra dirección interna';
  assert (select email from public.client_users where client_id = ch.client_id) = ch.internal_email,
    'el acceso nuevo responde al correo sin comprobar';
  assert (select status from public.client_users where client_id = ch.client_id) = 'active',
    'el cliente no quedó con acceso activo (tiene que entrar directo)';
  perform public.portal_email_check_issue(ch.id, repeat('5', 64));
end $$;
reset role;

-- El correo real no está en ninguna cuenta de Auth.
do $$ begin
  assert not exists (select 1 from auth.users where lower(email) = 'luis@example.test'),
    'el correo sin comprobar entró a Auth';
end $$;

-- Choque: para cuando confirma, ese correo ya tiene otra cuenta.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d4', 'Luis@example.test');
create table public._conteo as select count(*)::int as n from auth.users;
grant select on public._conteo to service_role;

set local role service_role;
do $$
declare
  ch public.client_email_checks;
  r record;
begin
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c004';
  select * into r from public.portal_email_check_claim(repeat('5', 64), '00000000-0000-0000-0000-0000000000c4');
  assert r.outcome = 'conflicto', 'no avisó que el correo ya tiene otra cuenta';
  select * into ch from public.client_email_checks where id = ch.id;
  assert ch.conflict_at is not null, 'el choque no quedó marcado para el equipo';
  assert ch.verified_at is null, 'el choque quedó comprobado';
  begin
    perform public.portal_email_check_confirm(ch.id, '00000000-0000-0000-0000-0000000000c4');
    raise exception 'CONTRATO ROTO: confirmó un correo en choque';
  exception when no_data_found then null;
  end;
  -- No se fusionó nada.
  assert (select auth_user_id from public.client_users where client_id = ch.client_id)
         = '00000000-0000-0000-0000-0000000000c4', 'el choque cambió la cuenta del cliente';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('5', 64), null)), 'un enlace en choque sigue abriendo';
  -- Soltar como choque (cuando lo detecta Auth y no la base) deja la misma marca.
  update public.client_email_checks set conflict_at = null where id = ch.id;
  perform public.portal_email_check_release(ch.id, true);
  assert (select conflict_at from public.client_email_checks where id = ch.id) is not null,
    'soltar como choque no dejó la marca';
  assert (select token_used_at from public.client_email_checks where id = ch.id) is not null,
    'soltar como choque dejó el enlace vivo';
end $$;

-- El equipo ve el choque.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select estado from public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c004']::uuid[]))
         = 'choque', 'el equipo no ve el choque';
end $$;
reset role;
set local role service_role;
set local request.jwt.claim.sub = '';
reset role;
do $$ begin
  assert (select count(*) from auth.users) = (select n from public._conteo), 'el choque tocó las cuentas';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- M. Corregir el correo: vuelve a «sin comprobar»
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare
  ch public.client_email_checks;
  r record;
begin
  -- Cambiar otro dato, o el mismo correo con otras mayúsculas, no toca nada.
  update public.clients set name = 'Ana P.', email = 'ANA@example.test'
   where id = '00000000-0000-0000-0000-00000000c001';
  assert (select verified_at from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001') is not null,
    'cambiar otro dato quitó la comprobación';

  -- c1 estaba comprobado. Cambia el correo de la ficha.
  update public.clients set email = 'Ana.Nueva@example.test' where id = '00000000-0000-0000-0000-00000000c001';
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c001';
  assert ch.verified_at is null, 'el correo corregido nació comprobado';
  assert ch.pending_email = 'ana.nueva@example.test', 'no anotó el correo nuevo por comprobar';
  assert not ch.auth_interno, 'dijo que la cuenta lleva la dirección interna cuando todavía lleva el correo anterior';
  assert ch.token_hash is null, 'quedó vivo un enlace emitido para el correo anterior';
  assert (select email from public.client_users where client_id = ch.client_id) = ch.internal_email,
    'el acceso sigue respondiendo al correo anterior';
  select * into r from public.portal_email_sin_comprobar('ana.nueva@example.test');
  assert r.pendiente, 'el correo nuevo no quedó por comprobar';

  -- c4 (en choque): corregir el correo limpia el choque y cambia a quién se le manda.
  update public.clients set email = 'luis.bueno@example.test' where id = '00000000-0000-0000-0000-00000000c004';
  select * into ch from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c004';
  assert ch.conflict_at is null and ch.pending_email = 'luis.bueno@example.test' and ch.auth_interno,
    'corregir el correo no dejó la cuenta lista para una comprobación nueva';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- N. Reenviar desde Studio: preparar
-- ═════════════════════════════════════════════════════════════════════════════
create table public._links as
  select 'c1' as k, id from public.client_registration_links where token_hash = repeat('b', 64)
  union all
  select 'c4', id from public.client_registration_links where token_hash = repeat('4', 64);
grant select on public._links to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
  begin
    perform public.portal_email_check_prepare((select id from public._links where k = 'c4'));
    raise exception 'CONTRATO ROTO: un rol sin permiso preparó el reenvío';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  begin
    perform public.portal_email_check_prepare((select id from public._links where k = 'c4'));
    raise exception 'CONTRATO ROTO: otro tenant preparó el reenvío';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select * into r from public.portal_email_check_prepare(
    (select id from public.client_registration_links where token_hash = repeat('4', 64)));
  assert r.auth_interno and r.auth_user_id = '00000000-0000-0000-0000-0000000000c4', 'preparar no devolvió la cuenta';
  -- c1: la cuenta todavía lleva el correo anterior; la app tiene que cambiarla antes de emitir.
  select * into r from public.portal_email_check_prepare(
    (select id from public.client_registration_links where token_hash = repeat('b', 64)));
  assert not r.auth_interno, 'preparar dijo que la cuenta ya lleva la dirección interna';
end $$;
reset role;

-- Sin correo en la ficha no hay a quién mandarle.
update public.clients set email = null where id = '00000000-0000-0000-0000-00000000c004';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    perform public.portal_email_check_prepare(
      (select id from public.client_registration_links where token_hash = repeat('4', 64)));
    raise exception 'CONTRATO ROTO: preparó un reenvío sin correo en la ficha';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
update public.clients set email = 'luis.bueno@example.test' where id = '00000000-0000-0000-0000-00000000c004';

-- ═════════════════════════════════════════════════════════════════════════════
-- P. Si el equipo revoca y vuelve a invitar por correo, la regla deja de aplicar
--    (el cliente entra desde su correo: esa es la prueba)
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
set local request.jwt.claim.sub = '';
do $$
declare
  v_check uuid := (select id from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c004');
  r record;
begin
  -- Q. Una confirmación que quedó a medias: el enlace queda gastado, la fila
  --    marcada para el equipo y no se sabe qué lleva la cuenta.
  perform public.portal_email_check_issue(v_check, repeat('7', 64));
  select * into r from public.portal_email_check_claim(repeat('7', 64), '00000000-0000-0000-0000-0000000000c4');
  assert r.outcome = 'ok', 'no reclamó antes de dejarlo para revisión';
  perform public.portal_email_check_revisar(v_check);
  assert (select review_needed_at from public.client_email_checks where id = v_check) is not null,
    'no quedó marcado para revisión';
  assert not (select auth_interno from public.client_email_checks where id = v_check),
    'en revisión y todavía dice que la cuenta lleva la dirección interna';
  assert (select token_used_at from public.client_email_checks where id = v_check) is not null,
    'dejar para revisión soltó el enlace';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('7', 64), null)), 'un enlace en revisión sigue abriendo';
  assert not exists (select 1 from public.portal_email_check_claim(repeat('7', 64), '00000000-0000-0000-0000-0000000000c4')),
    'un enlace en revisión se pudo reclamar';
  begin
    perform public.portal_email_check_confirm(v_check, '00000000-0000-0000-0000-0000000000c4');
    raise exception 'CONTRATO ROTO: confirmó una comprobación en revisión';
  exception when no_data_found then null;
  end;
  -- No se emite otro enlace hasta que la cuenta vuelve a su dirección interna.
  begin
    perform public.portal_email_check_issue(v_check, repeat('8', 64));
    raise exception 'CONTRATO ROTO: emitió con la cuenta en revisión';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select estado from public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c004']::uuid[]))
         = 'revisar', 'el equipo no ve la comprobación que quedó a medias';
end $$;
reset role;

-- Reenviar la normaliza: la cuenta vuelve a su dirección interna (aquí ya la
-- lleva) y la marca se limpia.
set local role service_role;
set local request.jwt.claim.sub = '';
do $$
declare v_check uuid := (select id from public.client_email_checks where client_id = '00000000-0000-0000-0000-00000000c004');
begin
  perform public.portal_email_check_auth_interno(v_check);
  assert (select review_needed_at from public.client_email_checks where id = v_check) is null,
    'la revisión no se limpió al normalizar la cuenta';
  perform public.portal_email_check_issue(v_check, repeat('6', 64));
  assert exists (select 1 from public.portal_email_check_peek(repeat('6', 64), null)), 'el enlace nuevo no abre';
end $$;
reset role;
update public.client_users set status = 'invited', auth_user_id = null, email = 'luis.bueno@example.test'
 where client_id = '00000000-0000-0000-0000-00000000c004';
set local role service_role;
do $$
declare r record;
begin
  select * into r from public.portal_email_sin_comprobar('luis.bueno@example.test');
  assert not r.bloquea, 'bloqueó a un cliente que el equipo volvió a invitar por correo';
  assert not exists (select 1 from public.portal_email_check_peek(repeat('6', 64), null)),
    'el enlace de una cuenta que ya no es la del cliente sigue abriendo';
  assert not exists (select 1 from public.portal_email_check_claim(repeat('6', 64), '00000000-0000-0000-0000-0000000000c4')),
    'el enlace de una cuenta que ya no es la del cliente se pudo reclamar';
end $$;
reset role;

-- La regla ya no aplica, pero el equipo sigue viendo que ese correo nunca se comprobó.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select estado from public.portal_email_check_estado(array['00000000-0000-0000-0000-00000000c004']::uuid[]))
         = 'nunca_comprobado', 'el equipo dejó de ver que el correo nunca se comprobó';
end $$;

reset role;
select 'TEST 0559 GREEN' as resultado;

rollback;
