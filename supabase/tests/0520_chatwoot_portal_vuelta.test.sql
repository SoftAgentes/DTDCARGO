\set ON_ERROR_STOP on

-- SDD-0586 (10.5, PR 1b) · contrato de 0520: la vuelta de Chatwoot al portal y destrabar.
--
-- Monta lo mínimo que 0519 y 0520 dan por sentado y aplica de verdad lo demás: 0006
-- (clients), la columna phone_last10 de 0383, 0106 (conversaciones), 0337 y 0503 (catálogo de
-- flags y chatwoot_agent_links), 0504 (chatwoot_conversations) y la 0519. Después aplica la
-- 0520 REAL y llama sus funciones como el servidor de Studio (service_role) y como el admin
-- del tenant (authenticated, con su sesión).
--
-- Lo que este contrato no puede probar: dos sesiones a la vez. El `for no key update` del
-- hilo solo ordena las escrituras del resumen; la idempotencia la da el índice único de
-- external_msg_id, y esa sí se prueba aquí.
--
-- CONTROL ROJO: sin 0520 cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids, nombres y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0520 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Forma de 0019 (solo las columnas que se leen).
create table public.user_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name  text
);

-- Forma de 0042.
create table public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  enabled     boolean not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (tenant_id, key)
);

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create publication supabase_realtime;

-- tenants vacío evita el seed demo histórico de 0006.
\ir ../migrations/0006_clients.sql
-- La columna de 0383, igual que allí.
alter table public.clients
  add column phone_last10 text
  generated always as (
    case
      when pg_catalog.length(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
      then pg_catalog."right"(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    end
  ) stored;
\ir ../migrations/0106_conversaciones.sql

create function pg_temp.id(label text) returns uuid language sql immutable as $$
  select md5('0520-sintetico-' || label)::uuid
$$;

insert into public.tenants values
  (pg_temp.id('T1'), 'dtd'),
  (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql

-- Usuarios de Studio: U1 (con nombre) y U2 (sin perfil) vinculados en T1; U3 solo en T2.
-- AD es admin de T1, CO comercial de T1, AX admin desactivado de T1 y A2 admin de T2.
insert into auth.users values
  (pg_temp.id('U1')), (pg_temp.id('U2')), (pg_temp.id('U3')),
  (pg_temp.id('AD')), (pg_temp.id('CO')), (pg_temp.id('AX')), (pg_temp.id('A2'));
insert into public.user_profiles values (pg_temp.id('U1'), 'Ana', 'Pérez');
insert into public.user_tenants values
  (pg_temp.id('AD'), pg_temp.id('T1'), 'admin', null),
  (pg_temp.id('CO'), pg_temp.id('T1'), 'commercial', null),
  (pg_temp.id('AX'), pg_temp.id('T1'), 'admin', now()),
  (pg_temp.id('A2'), pg_temp.id('T2'), 'admin', null);
insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values
  (pg_temp.id('T1'), pg_temp.id('U1'), 7),
  (pg_temp.id('T1'), pg_temp.id('U2'), 8),
  (pg_temp.id('T2'), pg_temp.id('U3'), 10);

-- Fichas: A y B vivas en T1, D borrada en T1, Z en T2.
insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', '+584125550101', null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('D'), pg_temp.id('T1'), 'DTD-SD', 'Cliente D', null, now()),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);

-- Hilos: el portal de A (vivo), el de B archivado y el vivo, el de D, un correo de A y el de Z.
insert into public.conversations (id, tenant_id, client_id, channel, deleted_at, unread_count, last_message_at) values
  (pg_temp.id('hA'),  pg_temp.id('T1'), pg_temp.id('A'), 'portal', null, 3, now() - interval '30 minutes'),
  (pg_temp.id('hBv'), pg_temp.id('T1'), pg_temp.id('B'), 'portal', now() - interval '1 day', 1, now() - interval '2 days'),
  (pg_temp.id('hB'),  pg_temp.id('T1'), pg_temp.id('B'), 'portal', null, 0, null),
  (pg_temp.id('hD'),  pg_temp.id('T1'), pg_temp.id('D'), 'portal', null, 2, null),
  (pg_temp.id('hE'),  pg_temp.id('T1'), pg_temp.id('A'), 'email', null, 0, null),
  (pg_temp.id('hZ'),  pg_temp.id('T2'), pg_temp.id('Z'), 'portal', null, 4, null);

-- Un mensaje del cliente en el hilo de A, para la ida.
insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, body, external_msg_id, sent_at)
values (pg_temp.id('a1'), pg_temp.id('T1'), pg_temp.id('hA'), 'in', 'Cliente A', 'texto a1', 'portal:a1', now() - interval '40 minutes');

\ir ../migrations/0519_chatwoot_portal.sql

-- Los vínculos de la ida: la conversación 100 es de A en T1 y también existe en T2 (otra
-- cuenta, otro hilo); 101 es del hilo archivado de B, 102 de D, 103 del hilo de correo y 104
-- solo de T2.
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id) values
  (pg_temp.id('hA'),  pg_temp.id('T1'), 100),
  (pg_temp.id('hBv'), pg_temp.id('T1'), 101),
  (pg_temp.id('hD'),  pg_temp.id('T1'), 102),
  (pg_temp.id('hE'),  pg_temp.id('T1'), 103),
  (pg_temp.id('hZ'),  pg_temp.id('T2'), 104);

\ir ../migrations/0520_chatwoot_portal_vuelta.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0520: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Llamadas como el servidor de Studio (service_role). Devuelve «resultado/cliente».
create function pg_temp.responder(p_tenant text, p_conv bigint, p_msg bigint, p_cuerpo text,
  p_cuando timestamptz, p_agente bigint default null) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  select r.resultado || '/' || coalesce(r.cliente_id::text, '-') into v
  from public.chatwoot_portal_respuesta(pg_temp.id(p_tenant), p_conv, p_msg, p_cuerpo, p_cuando, p_agente) r;
  reset role;
  return v;
end;
$$;
create function pg_temp.falla(p_sql text, p_rol text default 'service_role') returns text language plpgsql as $$
begin
  execute format('set local role %I', p_rol);
  execute p_sql;
  reset role;
  return null;
exception when others then
  reset role;
  return sqlstate;
end;
$$;
-- Destrabar como un usuario con su sesión.
create function pg_temp.destrabar(p_usuario text) returns text language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.id(p_usuario)::text, true);
  set local role authenticated;
  v := public.chatwoot_portal_destrabar();
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v::text;
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'error ' || sqlstate;
end;
$$;
-- plpgsql y jsonb: sin la 0520 el contrato cae en una aserción, no al crear el ayudante.
create function pg_temp.mensaje(p_externo text, p_tenant text default 'T1') returns jsonb language plpgsql as $$
begin
  return (select to_jsonb(m) from public.conversation_messages m
          where m.tenant_id = pg_temp.id(p_tenant) and m.external_msg_id = p_externo);
end;
$$;
create function pg_temp.hilo(p_label text) returns jsonb language plpgsql as $$
begin
  return (select to_jsonb(c) from public.conversations c where c.id = pg_temp.id(p_label));
end;
$$;
create function pg_temp.mensajes_de(p_label text) returns bigint language sql as $$
  select count(*) from public.conversation_messages m where m.conversation_id = pg_temp.id(p_label);
$$;

-- ── §1 · Apagado no escribe ─────────────────────────────────────────────────
do $apagado$
begin
  perform pg_temp.assert_true(pg_temp.responder('T1', 100, 5001, 'Hola', now() - interval '10 minutes', 7) = 'apagado/-',
    'con el flag apagado no se escribe');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5001') is null, 'apagado: nada en el hilo');
end;
$apagado$;

update public.feature_flags set enabled = true
where key = 'chatwoot_portal' and tenant_id in (pg_temp.id('T1'), pg_temp.id('T2'));

-- ── §2 · La respuesta llega una sola vez, con su autor y su hora ────────────
do $vuelta$
declare v jsonb;
begin
  perform pg_temp.assert_true(
    pg_temp.responder('T1', 100, 5001, 'Hola, ya revisé tu envío', now() - interval '10 minutes', 7)
      = 'insertado/' || pg_temp.id('A')::text,
    'la respuesta se escribe y da el cliente para el push');
  v := pg_temp.mensaje('chatwoot:5001');
  perform pg_temp.assert_true(v ->> 'direction' = 'out', 'la respuesta es saliente');
  perform pg_temp.assert_true(v ->> 'conversation_id' = pg_temp.id('hA')::text, 'en el hilo vinculado');
  perform pg_temp.assert_true(v ->> 'body' = 'Hola, ya revisé tu envío', 'con el texto de Chatwoot');
  perform pg_temp.assert_true((v ->> 'sent_at')::timestamptz = now() - interval '10 minutes',
    'con la hora de Chatwoot');
  perform pg_temp.assert_true(v ->> 'author_user_id' = pg_temp.id('U1')::text, 'el autor es el usuario vinculado');
  perform pg_temp.assert_true(v ->> 'author_name' = 'Ana Pérez', 'con su nombre, como la respuesta de hoy');
  v := pg_temp.hilo('hA');
  perform pg_temp.assert_true((v ->> 'unread_count')::int = 0, 'el unread_count del hilo queda en 0');
  perform pg_temp.assert_true((v ->> 'last_message_at')::timestamptz = now() - interval '10 minutes',
    'last_message_at avanza a la hora de la respuesta');

  -- El mismo evento otra vez (un reintento): no duplica ni avisa.
  update public.conversations set unread_count = 2 where id = pg_temp.id('hA');
  perform pg_temp.assert_true(
    pg_temp.responder('T1', 100, 5001, 'Hola, ya revisé tu envío', now() - interval '10 minutes', 7) = 'duplicado/-',
    'el duplicado no da cliente: el push sale una sola vez');
  perform pg_temp.assert_true(
    (select count(*) from public.conversation_messages where external_msg_id = 'chatwoot:5001'
       and tenant_id = pg_temp.id('T1')) = 1,
    'la respuesta está una sola vez');
  perform pg_temp.assert_true((pg_temp.hilo('hA') ->> 'unread_count')::int = 2, 'el duplicado no toca el hilo');

  -- Una respuesta vieja que llega tarde queda en su lugar y no retrocede el hilo.
  perform pg_temp.assert_true(
    pg_temp.responder('T1', 100, 5002, 'Respuesta anterior', now() - interval '3 hours', 8) like 'insertado/%',
    'una respuesta tardía se escribe');
  perform pg_temp.assert_true((pg_temp.mensaje('chatwoot:5002') ->> 'sent_at')::timestamptz = now() - interval '3 hours',
    'la tardía queda con su hora');
  perform pg_temp.assert_true((pg_temp.hilo('hA') ->> 'last_message_at')::timestamptz = now() - interval '10 minutes',
    'la tardía no retrocede last_message_at');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5002') ->> 'author_name' = 'Agente DTD',
    'un vinculado sin perfil firma «Agente DTD»');

  -- Un reloj adelantado no deja un mensaje en el futuro; sin hora, ahora.
  perform pg_temp.responder('T1', 100, 5003, 'Del futuro', now() + interval '1 hour', 9);
  perform pg_temp.assert_true((pg_temp.mensaje('chatwoot:5003') ->> 'sent_at')::timestamptz = now(),
    'una hora en el futuro queda en ahora');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5003') ->> 'author_user_id' is null
    and pg_temp.mensaje('chatwoot:5003') ->> 'author_name' is null,
    'un agente sin vínculo no firma: el portal muestra «DTD Cargo»');
  perform pg_temp.responder('T1', 100, 5004, 'Sin hora', null, null);
  perform pg_temp.assert_true((pg_temp.mensaje('chatwoot:5004') ->> 'sent_at')::timestamptz = now(),
    'sin hora, ahora');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5004') ->> 'author_name' is null, 'sin agente, sin autor');

  -- El vínculo de otro tenant no firma en este.
  perform pg_temp.responder('T1', 100, 5005, 'Firma ajena', now() - interval '5 minutes', 10);
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5005') ->> 'author_user_id' is null,
    'el vínculo de otro tenant no firma');
end;
$vuelta$;

-- ── §3 · Lo que no se escribe ───────────────────────────────────────────────
do $guardas$
begin
  perform pg_temp.assert_true(pg_temp.responder('T1', 101, 5101, 'Al archivado', now(), 7) = 'archivado/-',
    'a un hilo archivado no le escribe');
  perform pg_temp.assert_true(pg_temp.mensajes_de('hBv') = 0 and pg_temp.mensajes_de('hB') = 0,
    'ni en el archivado ni en el vivo de la misma ficha');
  perform pg_temp.assert_true((pg_temp.hilo('hBv') ->> 'unread_count')::int = 1, 'el archivado no cambia');

  perform pg_temp.assert_true(pg_temp.responder('T1', 102, 5102, 'A una ficha borrada', now(), 7) = 'ficha_borrada/-',
    'a una ficha borrada no le escribe');
  perform pg_temp.assert_true(pg_temp.mensajes_de('hD') = 0, 'nada en el hilo de la ficha borrada');

  perform pg_temp.assert_true(pg_temp.responder('T1', 103, 5103, 'Al correo', now(), 7) = 'sin_hilo/-',
    'solo hilos del portal');
  perform pg_temp.assert_true(pg_temp.mensajes_de('hE') = 0, 'nada en el hilo de correo');

  perform pg_temp.assert_true(pg_temp.responder('T1', 999, 5104, 'Sin vínculo', now(), 7) = 'sin_hilo/-',
    'una conversación sin vínculo no es del portal');

  perform pg_temp.assert_true(pg_temp.responder('T1', 104, 5105, 'De otra cuenta', now(), 7) = 'sin_hilo/-',
    'el vínculo de otro tenant no entra');
  perform pg_temp.assert_true(pg_temp.mensajes_de('hZ') = 0, 'nada en el hilo de otro tenant');

  perform pg_temp.assert_true(pg_temp.responder('T1', 100, 5106, '   ', now(), 7) = 'sin_texto/-',
    'sin texto no escribe');
  perform pg_temp.assert_true(pg_temp.responder('T1', 100, 5107, null, now(), 7) = 'sin_texto/-',
    'sin cuerpo no escribe');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5106') is null and pg_temp.mensaje('chatwoot:5107') is null,
    'sin texto: nada en el hilo');
  perform pg_temp.assert_true(pg_temp.responder('T1', 101, 5108, null, now(), 7) = 'archivado/-',
    'el archivado se avisa aunque no haya texto (para la nota)');

  perform pg_temp.assert_true(
    pg_temp.falla($$select * from public.chatwoot_portal_respuesta(null, 100, 1, 'x', now(), null)$$) = '22023',
    'sin tenant, rechazo');
  perform pg_temp.assert_true(
    pg_temp.falla(format($$select * from public.chatwoot_portal_respuesta(%L, 0, 1, 'x', now(), null)$$, pg_temp.id('T1'))) = '22023',
    'conversación inválida, rechazo');
  perform pg_temp.assert_true(
    pg_temp.falla(format($$select * from public.chatwoot_portal_respuesta(%L, 100, 2147483648, 'x', now(), null)$$, pg_temp.id('T1'))) = '22023',
    'mensaje fuera de rango, rechazo');
end;
$guardas$;

-- ── §4 · Mismo id de Chatwoot en otro tenant: cada uno el suyo ───────────────
do $tenants$
begin
  perform pg_temp.assert_true(
    pg_temp.responder('T2', 104, 5001, 'Hola Z', now() - interval '1 minute', 10) = 'insertado/' || pg_temp.id('Z')::text,
    'en T2, el mismo id de mensaje es otra respuesta');
  perform pg_temp.assert_true(pg_temp.mensaje('chatwoot:5001', 'T2') ->> 'author_user_id' = pg_temp.id('U3')::text,
    'con el vínculo de su tenant');
  perform pg_temp.assert_true(
    (select count(*) from public.conversation_messages where external_msg_id = 'chatwoot:5001') = 2,
    'una por tenant');
end;
$tenants$;

-- ── §5 · La ida no manda lo que vino de Chatwoot ────────────────────────────
do $ida$
declare
  v_n  integer;
  v_a1 integer;
begin
  insert into public.chatwoot_portal_estado (tenant_id, corte) values (pg_temp.id('T1'), now() - interval '1 day');
  set local role service_role;
  select count(*), count(*) filter (where t.mensaje_id = pg_temp.id('a1')) into v_n, v_a1
  from public.chatwoot_portal_tomar(pg_temp.id('T1'), 20, pg_temp.id('hA')) t;
  reset role;
  perform pg_temp.assert_true(v_n = 1 and v_a1 = 1, 'la ida toma solo el mensaje del cliente, no las respuestas');
end;
$ida$;

-- ── §6 · Destrabar ─────────────────────────────────────────────────────────
-- La cola: a1 enviando (de §5) pasa a atascado; m2 atascado de T1 en el hilo de B; z1 atascado de T2;
-- p1 pendiente de T1; e1 enviado de T1.
insert into public.conversation_messages (id, tenant_id, conversation_id, direction, body, sent_at) values
  (pg_temp.id('m2'), pg_temp.id('T1'), pg_temp.id('hB'), 'in', 'texto m2', now() - interval '2 days'),
  (pg_temp.id('p1'), pg_temp.id('T1'), pg_temp.id('hB'), 'in', 'texto p1', now() - interval '1 day'),
  (pg_temp.id('e1'), pg_temp.id('T1'), pg_temp.id('hB'), 'in', 'texto e1', now() - interval '3 days'),
  (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'in', 'texto z1', now() - interval '2 days');
update public.chatwoot_portal_salida
set estado = 'atascado', proximo_at = null, error = 'mensaje_http_500', verificar = false,
    created_at = now() - interval '25 hours', updated_at = now() - interval '1 hour'
where message_id = pg_temp.id('a1');
insert into public.chatwoot_portal_salida
  (message_id, tenant_id, conversation_id, estado, intentos, verificar, proximo_at, chatwoot_message_id, error, created_at, updated_at)
values
  (pg_temp.id('m2'), pg_temp.id('T1'), pg_temp.id('hB'), 'atascado', 30, false, null, null, 'contacto_red',
   now() - interval '30 hours', now() - interval '2 hours'),
  (pg_temp.id('p1'), pg_temp.id('T1'), pg_temp.id('hB'), 'pendiente', 2, false, now() + interval '2 minutes', null, 'mensaje_red',
   now() - interval '1 hour', now() - interval '1 minute'),
  (pg_temp.id('e1'), pg_temp.id('T1'), pg_temp.id('hB'), 'enviado', 1, false, null, 900, null,
   now() - interval '3 days', now() - interval '3 days'),
  (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'atascado', 30, false, null, null, 'red',
   now() - interval '30 hours', now() - interval '2 hours');

do $destrabar$
declare v jsonb;
begin
  perform pg_temp.assert_true(pg_temp.destrabar('CO') = 'error 42501', 'un comercial no destraba');
  perform pg_temp.assert_true(pg_temp.destrabar('AX') = 'error 42501', 'un admin desactivado no destraba');
  perform pg_temp.assert_true(
    pg_temp.falla('select public.chatwoot_portal_destrabar()', 'anon') = '42501', 'anon no destraba');
  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_portal_salida where estado = 'atascado') = 3, 'los rechazos no tocan nada');

  perform pg_temp.assert_true(pg_temp.destrabar('AD') = '2', 'el admin destraba los dos atascados de su tenant');
  select to_jsonb(s) into v from public.chatwoot_portal_salida s where s.message_id = pg_temp.id('m2');
  perform pg_temp.assert_true(v ->> 'estado' = 'pendiente', 'el atascado vuelve a pendiente');
  perform pg_temp.assert_true((v ->> 'proximo_at')::timestamptz = now(), 'para ahora');
  perform pg_temp.assert_true((v ->> 'verificar')::boolean, 'verificando: si había llegado, no se duplica');
  perform pg_temp.assert_true((v ->> 'created_at')::timestamptz = now(), 'con un plazo nuevo de 24 h');
  perform pg_temp.assert_true((v ->> 'intentos')::int = 30 and v ->> 'error' = 'contacto_red',
    'conserva los intentos y el último código');

  select to_jsonb(s) into v from public.chatwoot_portal_salida s where s.message_id = pg_temp.id('p1');
  perform pg_temp.assert_true((v ->> 'proximo_at')::timestamptz = now() + interval '2 minutes'
    and not (v ->> 'verificar')::boolean, 'un pendiente no se toca');
  perform pg_temp.assert_true(
    (select s.estado from public.chatwoot_portal_salida s where s.message_id = pg_temp.id('e1')) = 'enviado',
    'un enviado no se toca');
  perform pg_temp.assert_true(
    (select s.estado from public.chatwoot_portal_salida s where s.message_id = pg_temp.id('z1')) = 'atascado',
    'el atascado de otro tenant no se toca');
  perform pg_temp.assert_true(pg_temp.destrabar('AD') = '0', 'una segunda vez no destraba nada');
  perform pg_temp.assert_true(pg_temp.destrabar('A2') = '1', 'el admin de T2 destraba el suyo');

  -- La ida retoma el destrabado verificando antes.
  set local role service_role;
  select to_jsonb(t) into v from public.chatwoot_portal_tomar(pg_temp.id('T1'), 20, pg_temp.id('hA')) t;
  reset role;
  perform pg_temp.assert_true(v ->> 'mensaje_id' = pg_temp.id('a1')::text and (v ->> 'verificar')::boolean,
    'la ida retoma el destrabado y busca antes su source_id');
end;
$destrabar$;

-- ── §7 · Acceso ─────────────────────────────────────────────────────────────
do $acceso$
declare v_firma text;
begin
  v_firma := 'public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)';
  perform pg_temp.assert_true(
    not has_function_privilege('anon', v_firma, 'EXECUTE') and not has_function_privilege('authenticated', v_firma, 'EXECUTE')
    and has_function_privilege('service_role', v_firma, 'EXECUTE'),
    'la respuesta es solo de service_role');
  v_firma := 'public.chatwoot_portal_destrabar()';
  perform pg_temp.assert_true(
    not has_function_privilege('anon', v_firma, 'EXECUTE') and has_function_privilege('authenticated', v_firma, 'EXECUTE'),
    'destrabar es de authenticated, no de anon');
  foreach v_firma in array array[
    'public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)',
    'public.chatwoot_portal_destrabar()'] loop
    perform pg_temp.assert_true((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
      where p.oid = to_regprocedure(v_firma)), 'security definer con search_path vacío: ' || v_firma);
  end loop;
end;
$acceso$;

select 'TEST 0520 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
