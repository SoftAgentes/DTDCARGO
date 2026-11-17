\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0552 (SDD-0646). Fixtures ficticios y
-- rollback: no toca producción ni datos reales.
--
-- Lo que fija:
--   A. El link: un solo uso, vence, regenerar revoca, sólo el equipo lo crea,
--      la ruta pública (service_role) mira y completa, nadie más.
--   B. Completar llena la ficha EXISTENTE: ni ficha nueva ni código nuevo.
--   C. Duplicados: se marcan sin fusionar; la cédula de otra ficha no se copia.
--   D. El código propio retirado se recupera; el de otro cliente, nunca.
--   E. Una ficha nueva no puede nacer con un código retirado.

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
-- t1: el tenant de DTD. t2: otro tenant. a1 admin, v1 un rol sin permiso, x1
-- admin de t2. Fichas: c1 (legado DTD-8001, código viejo VJ-77 retirado), c2
-- (otra ficha con teléfono y cédula), c3 (ya tiene portal), c4 (otro legado
-- con código retirado ZZ-55), c5 (borrada que retiene una cédula), cx (t2).
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

insert into public.clients (id, tenant_id, markbox, name, phone, rif, deleted_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8001', 'CLIENTE LEGADO UNO', '0414-555-0101', null, null),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9101', 'Otra Ficha', '0424-555-0202', 'V-11111111', null),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8003', 'Con Portal', null, null, null),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8004', 'Legado Cuatro', null, null, null),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8005', 'Borrada', null, 'V-22222222', now()),
  ('00000000-0000-0000-0000-00000000c0ff', '00000000-0000-0000-0000-00000000d7d2', 'XT-0001', 'Otro tenant', null, null, null);

insert into public.client_markbox_history (tenant_id, client_id, markbox, reason) values
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'VJ-77', 'legado'),
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c004', 'ZZ-55', 'legado');

insert into public.client_users (tenant_id, client_id, email, auth_user_id, status) values
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003',
   'ocupado@example.test', '00000000-0000-0000-0000-0000000000f1', 'active');

insert into public.shipments (tenant_id, client_markbox) values
  ('00000000-0000-0000-0000-00000000d7d1', 'DTD-8001');

-- ═════════════════════════════════════════════════════════════════════════════
-- A. Permisos
-- ═════════════════════════════════════════════════════════════════════════════
do $$ begin
  assert not has_function_privilege('anon', 'public.portal_registration_link_peek(text)', 'EXECUTE'),
    'anon puede mirar links';
  assert not has_function_privilege('authenticated', 'public.portal_registration_link_peek(text)', 'EXECUTE'),
    'el equipo puede mirar links por token';
  assert has_function_privilege('service_role', 'public.portal_registration_link_peek(text)', 'EXECUTE'),
    'la ruta pública no puede mirar el link';
  assert not has_function_privilege('anon',
    'public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
    'anon puede completar fichas';
  assert not has_function_privilege('authenticated',
    'public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
    'el equipo puede completar fichas por token';
  assert has_function_privilege('service_role',
    'public.portal_registration_link_complete(text,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
    'la ruta pública no puede completar';
  assert not has_function_privilege('service_role', 'public.portal_registration_link_create(uuid,text)', 'EXECUTE'),
    'service_role puede emitir links sin un usuario del equipo';
  assert not has_function_privilege('anon', 'public.portal_registration_link_create(uuid,text)', 'EXECUTE'),
    'anon puede emitir links';
  assert not has_function_privilege('authenticated', 'public.portal_registration_link_bind(uuid,uuid)', 'EXECUTE'),
    'el equipo puede enlazar cuentas por fuera';
  assert not has_function_privilege('anon', 'public.find_duplicate_client_except_service(uuid,uuid,text,text,text)', 'EXECUTE'),
    'anon puede consultar duplicados';
  assert not has_table_privilege('authenticated', 'public.client_registration_links', 'INSERT'),
    'el equipo puede insertar links a mano';
  assert not has_table_privilege('authenticated', 'public.client_registration_links', 'UPDATE'),
    'el equipo puede editar links a mano';
  assert not has_table_privilege('anon', 'public.client_registration_links', 'SELECT'),
    'anon puede leer los hashes';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- A. Crear el link (equipo)
-- ═════════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

do $$
declare r record;
begin
  -- A1. Un hash que no es sha256 hex no entra.
  begin
    perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c001', 'DTD-8001');
    raise exception 'CONTRATO ROTO: aceptó un token que no es un hash';
  exception when invalid_parameter_value then null;
  end;

  -- A2. El primer link.
  select * into r from public.portal_registration_link_create(
    '00000000-0000-0000-0000-00000000c001', repeat('a', 64));
  assert r.link_id is not null, 'no devolvió el link';
  assert r.expires_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour',
    'el vencimiento no es de 14 días';

  -- A3. Regenerar revoca el anterior.
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c001', repeat('b', 64));
  assert (select revoked_at from public.client_registration_links where token_hash = repeat('a', 64)) is not null,
    'regenerar no revocó el link anterior';
  assert (select count(*) from public.client_registration_links
           where client_id = '00000000-0000-0000-0000-00000000c001'
             and used_at is null and revoked_at is null) = 1,
    'quedaron dos links vivos para el mismo cliente';

  -- A4. Un cliente con portal activo no recibe link.
  begin
    perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c003', repeat('c', 64));
    raise exception 'CONTRATO ROTO: emitió link a un cliente que ya tiene portal';
  exception when invalid_parameter_value then null;
  end;

  -- A5. Un cliente de otro tenant, no.
  begin
    perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c0ff', repeat('d', 64));
    raise exception 'CONTRATO ROTO: emitió link para un cliente de otro tenant';
  exception when insufficient_privilege then null;
  end;

  -- A6. El equipo lee la fila de su tenant (la lista de revisión la necesita).
  assert (select count(*) from public.client_registration_links) = 2, 'el equipo no ve sus links';
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
  -- A7. Un rol sin permiso, no.
  begin
    perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c004', repeat('e', 64));
    raise exception 'CONTRATO ROTO: un rol sin permiso emitió un link';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c004', repeat('4', 64));
end $$;

reset role;

-- Un link vencido, puesto a mano (la RPC siempre da 14 días).
insert into public.client_registration_links (tenant_id, client_id, token_hash, expires_at, revoked_at)
values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c002',
        repeat('9', 64), now() - interval '1 minute', null);

-- ═════════════════════════════════════════════════════════════════════════════
-- B. Mirar y completar (ruta pública)
-- ═════════════════════════════════════════════════════════════════════════════
set local role service_role;
set local request.jwt.claim.sub = '';

do $$
declare r record; n_antes int;
begin
  -- B1. Mirar devuelve el código congelado sólo si el link sirve.
  select * into r from public.portal_registration_link_peek(repeat('b', 64));
  assert r.markbox = 'DTD-8001', 'mirar no devolvió el código de la ficha';
  -- El nombre de la ficha no sale a la página pública.
  assert (select array_agg(a.attname order by a.attnum)
            from pg_catalog.pg_proc p,
                 lateral unnest(p.proargnames, p.proargmodes) with ordinality as a(attname, mode, attnum)
           where p.oid = 'public.portal_registration_link_peek(text)'::regprocedure
             and a.mode = 't') = array['markbox']::text[],
    'mirar devuelve algo más que el código (el nombre no debe salir)';
  assert not exists (select 1 from public.portal_registration_link_peek(repeat('a', 64))),
    'un link revocado todavía abre';
  assert not exists (select 1 from public.portal_registration_link_peek(repeat('9', 64))),
    'un link vencido todavía abre';
  assert not exists (select 1 from public.portal_registration_link_peek(repeat('0', 64))),
    'un token inventado abre algo';
  -- Mirar no gasta nada (el robot de WhatsApp hace GET).
  assert (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) is null,
    'mirar gastó el link';

  -- B2. Revocado y vencido no completan.
  begin
    perform public.portal_registration_link_complete(repeat('a', 64), 'persona', 'Ana', null,
      'V-33333333', 'ana@example.test', '0412-555-0303', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: un link revocado completó la ficha';
  exception when no_data_found then null;
  end;
  begin
    perform public.portal_registration_link_complete(repeat('9', 64), 'persona', 'Ana', null,
      'V-33333333', 'ana@example.test', '0412-555-0303', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: un link vencido completó la ficha';
  exception when no_data_found then null;
  end;

  -- B3. Un correo que ya tiene cuenta se rechaza SIN gastar el link.
  begin
    perform public.portal_registration_link_complete(repeat('b', 64), 'persona', 'Ana', null,
      'V-33333333', 'OCUPADO@example.test', '0412-555-0303', null, 'Valencia', 'Carabobo', null, false);
    raise exception 'CONTRATO ROTO: aceptó un correo que ya tiene cuenta';
  exception when unique_violation then null;
  end;
  assert (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) is null,
    'el correo ocupado gastó el link';

  -- B4. Completar: la MISMA ficha, mismo código, sin ficha nueva.
  select count(*) into n_antes from public.clients;
  select * into r from public.portal_registration_link_complete(repeat('b', 64), 'persona', 'Ana Pérez', null,
    'V-33333333', 'Ana@Example.test', '0414-555-0101', '0241-555-0000', 'Valencia', 'Carabobo',
    'Av. Bolívar, edificio 3', true);
  assert r.client_id = '00000000-0000-0000-0000-00000000c001', 'completó otra ficha';
  assert r.markbox = 'DTD-8001', 'cambió el código';
  assert r.duplicate_matched_by is null,
    'la ficha se marcó como duplicada de sí misma (mismo teléfono del legado)';
  assert (select count(*) from public.clients) = n_antes, 'completar creó una ficha nueva';
  assert (select markbox from public.clients where id = r.client_id) = 'DTD-8001', 'la ficha cambió de código';
  assert (select name from public.clients where id = r.client_id) = 'Ana Pérez', 'no escribió el nombre';
  assert (select rif from public.clients where id = r.client_id) = 'V-33333333', 'no escribió la cédula';
  assert (select email from public.clients where id = r.client_id) = 'ana@example.test', 'no normalizó el correo';
  assert (select city || '/' || state from public.clients where id = r.client_id) = 'Valencia/Carabobo',
    'no escribió ciudad y estado';
  assert (select portal_approved_at from public.clients where id = r.client_id) is not null,
    'la cuenta no quedó activa';
  assert (select email_optin_source from public.clients where id = r.client_id) = 'portal_register_link',
    'no registró el opt-in';

  -- B5. Quedó lo de antes al lado de lo que escribió.
  assert (select prev_data ->> 'name' from public.client_registration_links where token_hash = repeat('b', 64))
         = 'CLIENTE LEGADO UNO', 'no guardó lo que tenía la ficha';
  assert (select submitted_data ->> 'document' from public.client_registration_links where token_hash = repeat('b', 64))
         = 'V-33333333', 'no guardó lo que escribió el cliente';
  assert (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) is not null,
    'no gastó el link';

  -- B6. Un solo uso.
  begin
    perform public.portal_registration_link_complete(repeat('b', 64), 'persona', 'Intruso', null,
      'V-44444444', 'intruso@example.test', '0412-555-0404', null, 'Caracas', 'Distrito Capital', null, false);
    raise exception 'CONTRATO ROTO: el link se usó dos veces';
  exception when no_data_found then null;
  end;
  assert (select name from public.clients where id = '00000000-0000-0000-0000-00000000c001') = 'Ana Pérez',
    'el segundo uso pisó la ficha';
end $$;

-- B7. Vincular el acceso: sólo con la cuenta del correo registrado.
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'ana@example.test'),
  ('00000000-0000-0000-0000-0000000000c9', 'otra@example.test');
set local role service_role;

do $$
declare v_link uuid := (select id from public.client_registration_links where token_hash = repeat('b', 64));
begin
  begin
    perform public.portal_registration_link_bind(v_link, '00000000-0000-0000-0000-0000000000c9');
    raise exception 'CONTRATO ROTO: enlazó una cuenta con otro correo';
  exception when invalid_parameter_value then null;
  end;
  perform public.portal_registration_link_bind(v_link, '00000000-0000-0000-0000-0000000000c1');
  assert (select status from public.client_users where client_id = '00000000-0000-0000-0000-00000000c001') = 'active',
    'no quedó el acceso activo';
  assert (select auth_user_id from public.client_users where client_id = '00000000-0000-0000-0000-00000000c001')
         = '00000000-0000-0000-0000-0000000000c1', 'enlazó otra cuenta';
  -- Un link sin usar no sirve para enlazar.
  begin
    perform public.portal_registration_link_bind(
      (select id from public.client_registration_links where token_hash = repeat('4', 64)),
      '00000000-0000-0000-0000-0000000000c9');
    raise exception 'CONTRATO ROTO: un link sin usar enlazó una cuenta';
  exception when no_data_found then null;
  end;
  -- Con acceso activo, el link ya no se muestra.
  assert not exists (select 1 from public.portal_registration_link_peek(repeat('b', 64))),
    'un link usado sigue abriendo';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- C. Duplicados
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  -- C1. La cédula de OTRA ficha: se completa, la cédula no se copia, queda
  --     marcado para el equipo. Ninguna fusión.
  select * into r from public.portal_registration_link_complete(repeat('4', 64), 'persona', 'Luis Cuatro', null,
    'V-11.111.111', 'luis@example.test', '0416-555-0404', null, 'Maracay', 'Aragua', null, false);
  assert r.duplicate_matched_by = 'documento', 'no detectó la cédula de otra ficha';
  assert r.rif_skipped, 'no avisó que la cédula no se escribió';
  assert (select rif from public.clients where id = '00000000-0000-0000-0000-00000000c004') is null,
    'copió la cédula de otra ficha';
  assert (select duplicate_client_id from public.client_registration_links where token_hash = repeat('4', 64))
         = '00000000-0000-0000-0000-00000000c002', 'no apuntó a la ficha duplicada';
  assert (select merged_into_client_id from public.clients where id = '00000000-0000-0000-0000-00000000c004') is null
     and (select merged_into_client_id from public.clients where id = '00000000-0000-0000-0000-00000000c002') is null,
    'fusionó solo';
  assert (select phone from public.clients where id = '00000000-0000-0000-0000-00000000c004') = '0416-555-0404',
    'no completó el resto de la ficha';

  -- C2. La regla vieja sigue igual para el registro de siempre (sin exclusión).
  assert (select matched_by from public.find_duplicate_client_service(
            '00000000-0000-0000-0000-00000000d7d1', null, null, '0424 555 0202')) = 'telefono',
    'find_duplicate_client_service cambió de resultado';
  assert (select client_id from public.find_duplicate_client_except_service(
            '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c002',
            null, null, '0424 555 0202')) is null,
    'la exclusión no excluyó a la ficha propia';
end $$;

-- C3. Una ficha BORRADA con la cédula: el buscador no la ve, el índice sí. Se
--     completa todo menos la cédula.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_create('00000000-0000-0000-0000-00000000c002', repeat('2', 64));
end $$;
reset role;
set local role service_role;
do $$
declare r record;
begin
  select * into r from public.portal_registration_link_complete(repeat('2', 64), 'persona', 'Otra Ficha', null,
    'V-22222222', 'otra-ficha@example.test', '0424-555-0202', null, 'Mérida', 'Mérida', null, false);
  assert r.rif_skipped, 'no se saltó la cédula que el índice rechaza';
  assert (select rif from public.clients where id = '00000000-0000-0000-0000-00000000c002') = 'V-11111111',
    'pisó la cédula';
  assert (select email from public.clients where id = '00000000-0000-0000-0000-00000000c002') = 'otra-ficha@example.test',
    'no completó el resto tras el choque del índice';
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Marcar comprobado (equipo)
-- ═════════════════════════════════════════════════════════════════════════════
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
  begin
    perform public.portal_registration_link_mark_reviewed(
      (select id from public.client_registration_links where token_hash = repeat('b', 64)));
    raise exception 'CONTRATO ROTO: un rol sin permiso marcó comprobado';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform public.portal_registration_link_mark_reviewed(
    (select id from public.client_registration_links where token_hash = repeat('b', 64)));
  assert (select reviewed_by from public.client_registration_links where token_hash = repeat('b', 64))
         = '00000000-0000-0000-0000-0000000000a1', 'no quedó quién comprobó';
  begin
    perform public.portal_registration_link_mark_reviewed(
      (select id from public.client_registration_links where token_hash = repeat('a', 64)));
    raise exception 'CONTRATO ROTO: marcó comprobado un link sin usar';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- D-1. ¿Volvió a entrar desde su correo? (regla conservadora)
-- ═════════════════════════════════════════════════════════════════════════════
reset role;
-- La entrada del registro (minutos después de usar el link) NO cuenta.
update auth.users set last_sign_in_at =
  (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) + interval '10 minutes'
 where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert not (select entered_via_email from public.portal_registration_link_email_status(
    array[(select id from public.client_registration_links where token_hash = repeat('b', 64))])),
    'contó como prueba del correo la entrada del propio registro';
end $$;
reset role;
update auth.users set last_sign_in_at =
  (select used_at from public.client_registration_links where token_hash = repeat('b', 64)) + interval '2 hours'
 where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select entered_via_email from public.portal_registration_link_email_status(
    array[(select id from public.client_registration_links where token_hash = repeat('b', 64))])),
    'no vio que el cliente volvió a entrar después del registro';
end $$;
reset role;
-- Un acceso por WhatsApp después del registro no prueba el correo.
insert into public.portal_access_links (tenant_id, client_id, used_at)
select tenant_id, client_id, used_at + interval '1 hour'
  from public.client_registration_links where token_hash = repeat('b', 64);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert not (select entered_via_email from public.portal_registration_link_email_status(
    array[(select id from public.client_registration_links where token_hash = repeat('b', 64))])),
    'contó como prueba del correo una entrada por WhatsApp';
end $$;
-- Otro tenant no ve el estado de estos links.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert not exists (select 1 from public.portal_registration_link_email_status(
    array(select id from public.client_registration_links))),
    'otro tenant leyó el estado de los correos';
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- ═════════════════════════════════════════════════════════════════════════════
-- D. Recuperar el código propio
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare j jsonb;
begin
  -- D1. Otro cliente NO puede tomar el código retirado de c1.
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c004', 'VJ-77');
    raise exception 'CONTRATO ROTO: un cliente tomó el código retirado de otro';
  exception when unique_violation then null;
  end;

  -- D2. c1 recupera SU código: sale del historial y DTD-8001 entra.
  j := public.rename_client_markbox('00000000-0000-0000-0000-00000000c001', 'vj-77', 'recupera su código de siempre');
  assert (j ->> 'recovered')::boolean, 'no reportó la recuperación';
  assert (select markbox from public.clients where id = '00000000-0000-0000-0000-00000000c001') = 'VJ-77',
    'no recuperó el código';
  assert not exists (select 1 from public.client_markbox_history
                      where markbox = 'VJ-77' and restored_at is null),
    'el código recuperado sigue retirado';
  -- La historia no se pierde (0367:49-50): la fila queda marcada, no se borra.
  assert (select restored_by from public.client_markbox_history
           where markbox = 'VJ-77' and restored_at is not null)
         = '00000000-0000-0000-0000-0000000000a1',
    'la fila del código recuperado se borró o no dice quién lo restauró';
  -- Las cajas rotuladas con cualquiera de los dos códigos siguen llegando a c1.
  assert (select client_id from public.resolve_markbox('00000000-0000-0000-0000-00000000d7d1', 'VJ-77'))
         = '00000000-0000-0000-0000-00000000c001', 'resolve_markbox perdió el código recuperado';
  assert (select not was_redirected from public.resolve_markbox('00000000-0000-0000-0000-00000000d7d1', 'VJ-77')),
    'resolve_markbox trata el código recuperado como alias';
  assert (select client_id from public.resolve_markbox('00000000-0000-0000-0000-00000000d7d1', 'DTD-8001'))
         = '00000000-0000-0000-0000-00000000c001', 'resolve_markbox no resuelve el 8xxx retirado';
  assert (select client_id from public.client_markbox_history where markbox = 'DTD-8001')
         = '00000000-0000-0000-0000-00000000c001', 'el código 8xxx no pasó al historial';
  assert (select client_markbox from public.shipments limit 1) = 'VJ-77', 'no movió los embarques';
  -- Y el 8xxx ahora es retirado: nadie lo toma, ni la ficha c4.
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c004', 'DTD-8001');
    raise exception 'CONTRATO ROTO: otro cliente tomó el 8xxx retirado';
  exception when unique_violation then null;
  end;
  -- Pero c1 puede volver al 8xxx (también es suyo).
  perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c001', 'DTD-8001');
  assert (select markbox from public.clients where id = '00000000-0000-0000-0000-00000000c001') = 'DTD-8001',
    'no pudo volver a su otro código propio';
  -- Retirado vigente: sólo VJ-77. Las dos restauraciones quedan como historia.
  assert (select count(*) from public.client_markbox_history
           where client_id = '00000000-0000-0000-0000-00000000c001' and restored_at is null) = 1,
    'el historial quedó con retirados de más';
  assert (select count(*) from public.client_markbox_history
           where client_id = '00000000-0000-0000-0000-00000000c001') = 3,
    'el historial perdió filas';
  -- Lo de siempre sigue: el código vivo de otro, no.
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c004', 'DTD-9101');
    raise exception 'CONTRATO ROTO: tomó el código vivo de otro cliente';
  exception when unique_violation then null;
  end;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- E. Una ficha nueva no nace con un código retirado
-- ═════════════════════════════════════════════════════════════════════════════
do $$ begin
  begin
    insert into public.clients (tenant_id, markbox, name)
    values ('00000000-0000-0000-0000-00000000d7d1', 'zz-55', 'Ficha nueva a mano');
    raise exception 'CONTRATO ROTO: una ficha nueva tomó un código retirado';
  exception when unique_violation then null;
  end;
  insert into public.clients (tenant_id, markbox, name)
  values ('00000000-0000-0000-0000-00000000d7d1', 'QW-12', 'Ficha nueva con su código viejo libre');
  assert exists (select 1 from public.clients where markbox = 'QW-12'),
    'el candado rechazó un código libre';
end $$;

reset role;
select 'TEST 0552 GREEN' as resultado;

rollback;
