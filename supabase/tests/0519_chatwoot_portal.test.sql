\set ON_ERROR_STOP on

-- SDD-0586 (10.5, PR 1a) · contrato de 0519: la ida del chat del portal a Chatwoot.
--
-- Monta lo mínimo que 0519 da por sentado y aplica de verdad lo demás: 0006 (clients),
-- la columna phone_last10 de 0383, 0106 (conversaciones), 0337 y 0503 (catálogo de flags)
-- y 0504 (chatwoot_conversations). Después aplica la 0519 REAL y llama sus funciones como
-- el servidor de Studio (service_role).
--
-- Lo que este contrato no puede probar: dos sesiones a la vez. El `skip locked` del bloqueo
-- por hilo y la guarda del upsert (el segundo que llega no reclama) solo se alcanzan con dos
-- conexiones; con una, el filtro de la cabeza ya deja fuera el hilo en curso, y eso sí se
-- prueba aquí. La prueba de dos sesiones queda pendiente (handoff de la 10.5, ida).
--
-- `now()` no avanza dentro de la transacción: el paso del tiempo se simula moviendo
-- `proximo_at`, `updated_at` y `created_at` de la cola.
--
-- CONTROL ROJO: sin 0519 cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids, nombres y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0519 requiere una base PostgreSQL desechable vacía';
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
  select md5('0519-sintetico-' || label)::uuid
$$;

insert into public.tenants values
  (pg_temp.id('T1'), 'dtd'),
  (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql

-- Fichas: A y B vivas en T1, D borrada en T1, Z en T2.
insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', '+584125550101', null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('D'), pg_temp.id('T1'), 'DTD-SD', 'Cliente D', null, now()),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);

-- Hilos: portal de A, B, D y Z; un hilo de correo de A.
insert into public.conversations (id, tenant_id, client_id, channel) values
  (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal'),
  (pg_temp.id('hB'), pg_temp.id('T1'), pg_temp.id('B'), 'portal'),
  (pg_temp.id('hE'), pg_temp.id('T1'), pg_temp.id('A'), 'email'),
  (pg_temp.id('hD'), pg_temp.id('T1'), pg_temp.id('D'), 'portal'),
  (pg_temp.id('hZ'), pg_temp.id('T2'), pg_temp.id('Z'), 'portal');

-- Mensajes, con la hora relativa a now() (que no avanza en la transacción).
create function pg_temp.msg(p_label text, p_hilo text, p_hace interval, p_dir text default 'in',
  p_externo text default null, p_tenant text default 'T1') returns void language sql as $$
  insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, body, external_msg_id, sent_at)
  values (pg_temp.id(p_label), pg_temp.id(p_tenant), pg_temp.id(p_hilo), p_dir::conversation_direction,
    'Autor ' || p_label, 'texto ' || p_label, p_externo, now() - p_hace);
$$;
select pg_temp.msg('a0', 'hA', interval '2 days', 'in', 'portal:a0');     -- antes del corte
select pg_temp.msg('aC', 'hA', interval '65 minutes', 'in', 'chatwoot:900'); -- vino de Chatwoot
select pg_temp.msg('a1', 'hA', interval '60 minutes', 'in', 'portal:a1');
select pg_temp.msg('aO', 'hA', interval '55 minutes', 'out');              -- respuesta desde Studio
select pg_temp.msg('a2', 'hA', interval '50 minutes', 'in', null);         -- firma vieja, sin id
select pg_temp.msg('a3', 'hA', interval '40 minutes', 'in', 'portal:a3');
select pg_temp.msg('b1', 'hB', interval '70 minutes', 'in', 'portal:b1');
select pg_temp.msg('b2', 'hB', interval '5 minutes', 'in', 'portal:b2');
select pg_temp.msg('e1', 'hE', interval '80 minutes', 'in', 'email:e1');
select pg_temp.msg('d1', 'hD', interval '90 minutes', 'in', 'portal:d1');
select pg_temp.msg('z1', 'hZ', interval '100 minutes', 'in', 'portal:z1', 'T2');

\ir ../migrations/0519_chatwoot_portal.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0519: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Llamadas como el servidor de Studio (service_role).
create temporary table tomados (
  orden serial, mensaje_id uuid, hilo_id uuid, autor text, cuerpo text, intento integer,
  verificar boolean, identificador uuid, contacto_id bigint, contacto_source_id text, conversacion_id bigint
);
grant all on tomados to service_role;
grant usage on sequence tomados_orden_seq to service_role;
create function pg_temp.tomar(p_tenant text, p_limite integer default 20, p_hilo text default null)
returns integer language plpgsql as $$
declare v integer;
begin
  truncate tomados;
  set local role service_role;
  insert into tomados (mensaje_id, hilo_id, autor, cuerpo, intento, verificar, identificador,
    contacto_id, contacto_source_id, conversacion_id)
  select * from public.chatwoot_portal_tomar(pg_temp.id(p_tenant), p_limite,
    case when p_hilo is null then null else pg_temp.id(p_hilo) end);
  reset role;
  select count(*) into v from tomados;
  return v;
end;
$$;
create function pg_temp.tomado(p_label text) returns boolean language sql as $$
  select exists (select 1 from tomados t where t.mensaje_id = pg_temp.id(p_label));
$$;
create function pg_temp.marcar(p_label text, p_intento integer, p_ok boolean, p_cw bigint default null,
  p_error text default null, p_incierto boolean default false, p_tenant text default 'T1') returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  v := public.chatwoot_portal_marcar(pg_temp.id(p_tenant), pg_temp.id(p_label), p_intento, p_ok, p_cw, p_error, p_incierto);
  reset role;
  return v;
end;
$$;
create function pg_temp.vincular(p_hilo text, p_contacto bigint, p_source text, p_inbox bigint default null,
  p_conv bigint default null, p_tenant text default 'T1') returns text language plpgsql as $$
begin
  set local role service_role;
  perform public.chatwoot_portal_vincular(pg_temp.id(p_tenant), pg_temp.id(p_hilo), p_contacto, p_source, p_inbox, p_conv);
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate;
end;
$$;
create function pg_temp.falla(p_sql text) returns text language plpgsql as $$
begin
  set local role service_role;
  execute p_sql;
  reset role;
  return null;
exception when others then
  reset role;
  return sqlstate;
end;
$$;
create function pg_temp.rezagados(p_tenant text) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  select r.sin_llegar || '/' || r.atascados into v from public.chatwoot_portal_rezagados(pg_temp.id(p_tenant)) r;
  reset role;
  return v;
end;
$$;
-- plpgsql y jsonb: sin la 0519 el contrato cae en una aserción, no al crear el ayudante.
create function pg_temp.salida(p_label text) returns jsonb language plpgsql as $$
begin
  return (select to_jsonb(s) from public.chatwoot_portal_salida s where s.message_id = pg_temp.id(p_label));
end;
$$;
create function pg_temp.flag(p_tenant text, p_on boolean) returns void language sql as $$
  update public.feature_flags set enabled = p_on where tenant_id = pg_temp.id(p_tenant) and key = 'chatwoot_portal';
$$;
create function pg_temp.corte(p_tenant text, p_hace interval) returns void language plpgsql as $$
begin
  insert into public.chatwoot_portal_estado (tenant_id, corte) values (pg_temp.id(p_tenant), now() - p_hace)
  on conflict (tenant_id) do update set corte = excluded.corte;
end;
$$;

-- ── §10 · El flag nace apagado ──────────────────────────────────────────────
do $flag$
begin
  perform pg_temp.assert_true(exists (
    select 1 from public.feature_flag_catalog() c where c.key = 'chatwoot_portal' and c.enabled = false
  ), 'el catálogo trae chatwoot_portal apagado');
  perform pg_temp.assert_true((select count(*) from public.feature_flag_catalog()) = 24
    and exists (select 1 from public.feature_flag_catalog() c where c.key = 'chatwoot_inbox'),
    'el catálogo conserva los 23 de la 0503 y suma uno');
  perform pg_temp.assert_true((
    select count(*) = 2 and bool_and(not f.enabled) from public.feature_flags f where f.key = 'chatwoot_portal'
  ), 'los tenants que ya existían nacen con chatwoot_portal apagado');
  insert into public.tenants values (pg_temp.id('T3'), 'nuevo');
  perform pg_temp.assert_true(exists (
    select 1 from public.feature_flags f where f.tenant_id = pg_temp.id('T3') and f.key = 'chatwoot_portal' and not f.enabled
  ), 'un tenant nuevo nace con la fila, apagada');
end;
$flag$;

-- ── §3 · tomar: apagado o sin corte no da nada ──────────────────────────────
do $apagado$
begin
  perform pg_temp.corte('T1', interval '1 day');
  perform pg_temp.assert_true(pg_temp.tomar('T1') = 0, 'con el flag apagado no se toma nada');
  perform pg_temp.assert_true(pg_temp.rezagados('T1') = '0/0', 'con el flag apagado no hay aviso');
  perform pg_temp.flag('T1', true);
  delete from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1');
  perform pg_temp.assert_true(pg_temp.tomar('T1') = 0, 'sin corte no se toma nada');
  perform pg_temp.assert_true(pg_temp.rezagados('T1') = '0/0', 'sin corte no hay aviso');
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_portal_salida),
    'apagado o sin corte, la cola queda vacía');
  perform pg_temp.corte('T1', interval '1 day');
  perform pg_temp.assert_true(pg_temp.falla('select * from public.chatwoot_portal_tomar(null)') = '22023',
    'tomar sin tenant se rechaza');
end;
$apagado$;

-- ── §3 · tomar: qué entra, uno por hilo y el más viejo primero ──────────────
do $tomar$
begin
  perform pg_temp.assert_true(pg_temp.rezagados('T1') = '4/0',
    'el aviso cuenta lo del portal que lleva más de 15 min sin llegar');
  perform pg_temp.assert_true(pg_temp.tomar('T1') = 2, 'uno por hilo: dos hilos del portal vivos, dos mensajes');
  perform pg_temp.assert_true(
    (select array_agg(t.mensaje_id order by t.orden) from tomados t) = array[pg_temp.id('b1'), pg_temp.id('a1')],
    'el más viejo primero: b1 antes que a1');
  perform pg_temp.assert_true(not pg_temp.tomado('a0'), 'lo de antes del corte no se manda');
  perform pg_temp.assert_true(not pg_temp.tomado('aC'), 'lo que vino de Chatwoot no vuelve');
  perform pg_temp.assert_true(not pg_temp.tomado('e1'), 'solo el canal del portal');
  perform pg_temp.assert_true(not pg_temp.tomado('d1'), 'la ficha borrada no se manda');
  perform pg_temp.assert_true(not pg_temp.tomado('z1'), 'otro tenant no entra');
  perform pg_temp.assert_true((select bool_and(t.intento = 1 and not t.verificar) from tomados t),
    'el primer intento no verifica');
  perform pg_temp.assert_true((
    select t.cuerpo = 'texto a1' and t.autor = 'Autor a1' and t.hilo_id = pg_temp.id('hA')
      and t.contacto_id is null and t.contacto_source_id is null and t.conversacion_id is null
    from tomados t where t.mensaje_id = pg_temp.id('a1')
  ), 'devuelve el texto y el nombre, sin vínculo todavía');
  perform pg_temp.assert_true((
    select count(*) = 2 and count(distinct k.identificador) = 2 from public.chatwoot_portal_contactos k
    where k.client_id in (pg_temp.id('A'), pg_temp.id('B')) and k.chatwoot_contact_id is null
  ), 'el identificador se guarda antes de llamar a Chatwoot, uno por ficha');
  perform pg_temp.assert_true((
    select count(*) = 2 and bool_and(s.estado = 'enviando' and s.intentos = 1) from public.chatwoot_portal_salida s
  ), 'los dos quedan reclamados');
  perform pg_temp.assert_true(pg_temp.tomar('T1') = 0, 'un hilo con un envío en curso no da nada');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 0, 'ni pedido por su hilo');
end;
$tomar$;

-- ── marcar: enviado, el siguiente del hilo y un intento viejo ───────────────
do $marcar$
begin
  perform pg_temp.assert_true(pg_temp.marcar('a1', 1, true, 501) = 'enviado', 'un envío ok queda enviado');
  perform pg_temp.assert_true((pg_temp.salida('a1')->>'chatwoot_message_id')::bigint = 501, 'con el id de Chatwoot');
  perform pg_temp.assert_true(pg_temp.marcar('a1', 1, true, 502) is null, 'cerrar dos veces no escribe');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 1, 'después de a1 el hilo da uno más');
  perform pg_temp.assert_true(pg_temp.tomado('a2'),
    'después de a1 sale a2: sin Studio ni Chatwoot de por medio, y sin id externo también');
  perform pg_temp.assert_true(pg_temp.falla($q$select public.chatwoot_portal_marcar(md5('0519-sintetico-T1')::uuid,
    md5('0519-sintetico-a2')::uuid, 1, true, null)$q$) = '22023', 'un ok sin id de Chatwoot se rechaza');
  perform pg_temp.assert_true(pg_temp.falla($q$select public.chatwoot_portal_marcar(md5('0519-sintetico-T1')::uuid,
    md5('0519-sintetico-a2')::uuid, 1, false, null, 'Error con texto')$q$) = '22023', 'el error es solo un código');
  perform pg_temp.assert_true(pg_temp.marcar('a2', 1, false, null, 'mensaje_red', true) = 'pendiente',
    'un fallo queda pendiente');
  perform pg_temp.assert_true((pg_temp.salida('a2')->>'proximo_at')::timestamptz = now() + interval '1 minute'
    and (pg_temp.salida('a2')->>'verificar')::boolean and pg_temp.salida('a2')->>'error' = 'mensaje_red',
    'espera 1 minuto y verifica antes de reenviar');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 0,
    'mientras a2 espera, a3 no sale: no se salta al siguiente');
end;
$marcar$;

-- ── Reintentos: 1, 2, 4, 8, 15 y 15 min; a las 24 h, atascado ───────────────
do $reintentos$
declare
  v_espera interval;
  v_intento integer;
begin
  foreach v_espera in array array[interval '2 minutes', interval '4 minutes', interval '8 minutes',
    interval '15 minutes', interval '15 minutes'] loop
    update public.chatwoot_portal_salida set proximo_at = now() - interval '1 second' where message_id = pg_temp.id('a2');
    perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 1, 'vencida la espera, el hilo da uno');
    perform pg_temp.assert_true(pg_temp.tomado('a2'), 'vencida la espera, a2 vuelve');
    select t.intento into v_intento from tomados t;
    perform pg_temp.assert_true((select t.verificar from tomados t), 'verificar no se apaga sin salir');
    perform pg_temp.assert_true(pg_temp.marcar('a2', v_intento, false, null, 'mensaje_http_502', false) = 'pendiente',
      'el intento ' || v_intento || ' queda pendiente');
    perform pg_temp.assert_true((pg_temp.salida('a2')->>'proximo_at')::timestamptz = now() + v_espera,
      'la espera del intento ' || v_intento || ' es ' || v_espera::text);
  end loop;
  update public.chatwoot_portal_salida
  set proximo_at = now() - interval '1 second', created_at = now() - interval '24 hours'
  where message_id = pg_temp.id('a2');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 1, 'a2 vuelve una vez más');
  perform pg_temp.assert_true(pg_temp.marcar('a2', 7, false, null, 'mensaje_red', false) = 'atascado',
    'a las 24 h del primer intento queda atascado');
  perform pg_temp.assert_true(pg_temp.salida('a2')->>'proximo_at' is null, 'atascado no tiene próximo intento');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hA') = 0, 'un atascado detiene su hilo');
end;
$reintentos$;

-- ── Un envío colgado se retoma como incierto, y el intento viejo no escribe ─
do $colgado$
begin
  update public.chatwoot_portal_salida set updated_at = now() - interval '4 minutes' where message_id = pg_temp.id('b1');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hB') = 0, 'un envío de 4 minutos sigue en curso');
  update public.chatwoot_portal_salida set updated_at = now() - interval '5 minutes' where message_id = pg_temp.id('b1');
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hB') = 1, 'a los 5 minutos el hilo da uno');
  perform pg_temp.assert_true(pg_temp.tomado('b1'), 'a los 5 minutos se retoma');
  perform pg_temp.assert_true((select t.intento = 2 and t.verificar from tomados t),
    'el colgado cuenta como incierto: verifica antes de reenviar');
  perform pg_temp.assert_true(pg_temp.marcar('b1', 1, true, 777) is null, 'el intento viejo no escribe');
  perform pg_temp.assert_true(pg_temp.salida('b1')->>'estado' = 'enviando', 'el intento viejo no cierra el nuevo');
  perform pg_temp.assert_true(pg_temp.marcar('b1', 2, true, 778) = 'enviado', 'el vigente sí');
end;
$colgado$;

-- ── §5 · vincular ───────────────────────────────────────────────────────────
do $vincular$
declare v_ident uuid;
begin
  select k.identificador into v_ident from public.chatwoot_portal_contactos k where k.client_id = pg_temp.id('B');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, 'src-b') = 'ok', 'guarda el contacto');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 42, 'src-x') = '23505', 'una ficha no tiene dos contactos');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, '04125550101') = '23514',
    'un source_id que es un teléfono se rechaza');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, 'src-b', 3, 9001) = 'ok', 'guarda la conversación');
  perform pg_temp.assert_true((
    select cc.client_id = pg_temp.id('B') and cc.inbox_id = 3 and cc.status = 'open'
    from public.chatwoot_conversations cc where cc.conversation_id = 9001
  ), 'deja el client_id en chatwoot_conversations para la Ficha DTD');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, 'src-b', 3, 9001) = 'ok', 'vincular dos veces lo mismo no falla');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, 'src-b', 3, 9009) = '23505', 'un hilo no tiene dos conversaciones');
  perform pg_temp.assert_true(pg_temp.vincular('hE', 41, 'src-b', 3, 9010) = 'P0002', 'solo hilos del portal');
  perform pg_temp.assert_true(pg_temp.vincular('hB', 41, 'src-b', 3, 9011, 'T2') = 'P0002', 'solo hilos del tenant');
  perform pg_temp.assert_true(pg_temp.vincular('hZ', 51, 'src-z', null, null, 'T2') = 'P0002',
    'sin identificador guardado no hay contacto que vincular');

  -- Un evento posterior sin teléfono conserva el client_id (0504).
  set local role service_role;
  perform public.chatwoot_registrar_evento(pg_temp.id('T1'), 'message_created:7001', 'message_created',
    9001, 3, 'open', 1, null, null, now(), 10, 7001, true);
  reset role;
  perform pg_temp.assert_true((select cc.client_id from public.chatwoot_conversations cc where cc.conversation_id = 9001)
    = pg_temp.id('B'), 'un chatwoot_registrar_evento posterior sin teléfono conserva el client_id');

  -- El webhook llegó antes que el vínculo: la fila existe sin ficha y vincular la completa.
  set local role service_role;
  perform public.chatwoot_registrar_evento(pg_temp.id('T1'), 'message_created:7002', 'message_created',
    9002, 3, 'open', 1, null, null, now(), 10, 7002, true);
  reset role;
  perform pg_temp.assert_true(pg_temp.vincular('hA', 43, 'src-a', 3, 9001) = '23505',
    'una conversación no se ata a dos hilos');
  perform pg_temp.assert_true(pg_temp.vincular('hA', 43, 'src-a', 3, 9002) = 'ok', 'vincular después del evento no falla');
  perform pg_temp.assert_true((select cc.client_id from public.chatwoot_conversations cc where cc.conversation_id = 9002) = pg_temp.id('A'),
    'si el evento llegó antes, vincular completa el client_id');

  -- Lo que tomar devuelve después del vínculo, con el mismo identificador.
  perform pg_temp.assert_true(pg_temp.tomar('T1', 20, 'hB') = 1, 'después de b1 el hilo da uno');
  perform pg_temp.assert_true(pg_temp.tomado('b2'), 'después de b1 sale b2');
  perform pg_temp.assert_true((
    select t.contacto_id = 41 and t.contacto_source_id = 'src-b' and t.conversacion_id = 9001 and t.identificador = v_ident
    from tomados t
  ), 'tomar devuelve el vínculo y el mismo identificador');
end;
$vincular$;

-- ── El aviso y otro tenant ──────────────────────────────────────────────────
do $aviso$
begin
  perform pg_temp.assert_true(pg_temp.rezagados('T1') = '2/1', 'el aviso cuenta a2 (atascado) y a3; b2 es reciente');
  perform pg_temp.corte('T2', interval '1 day');
  perform pg_temp.assert_true(pg_temp.rezagados('T2') = '0/0', 'T2 con el flag apagado no avisa');
  perform pg_temp.assert_true(pg_temp.tomar('T2') = 0, 'T2 con el flag apagado no manda');
  perform pg_temp.flag('T2', true);
  perform pg_temp.assert_true(pg_temp.tomar('T2') = 1, 'T2 con el flag encendido da uno');
  perform pg_temp.assert_true(pg_temp.tomado('z1'), 'T2 manda lo suyo');
  perform pg_temp.assert_true(pg_temp.marcar('z1', 1, true, 601, null, false, 'T1') is null,
    'marcar no cierra un mensaje de otro tenant');
end;
$aviso$;

-- ── §2 · Acceso y datos ─────────────────────────────────────────────────────
do $acceso$
declare
  v_tabla text;
  v_firma text;
begin
  foreach v_tabla in array array['public.chatwoot_portal_contactos', 'public.chatwoot_portal_hilos',
    'public.chatwoot_portal_salida', 'public.chatwoot_portal_estado'] loop
    perform pg_temp.assert_true((select c.relrowsecurity from pg_class c where c.oid = v_tabla::regclass),
      'RLS en ' || v_tabla);
    perform pg_temp.assert_true(
      not has_table_privilege('anon', v_tabla, 'SELECT') and not has_table_privilege('authenticated', v_tabla, 'SELECT')
      and not has_table_privilege('authenticated', v_tabla, 'INSERT') and not has_table_privilege('authenticated', v_tabla, 'UPDATE')
      and not has_table_privilege('authenticated', v_tabla, 'DELETE') and not has_table_privilege('anon', v_tabla, 'INSERT'),
      'sin permisos para anon ni authenticated: ' || v_tabla);
  end loop;
  foreach v_firma in array array[
    'public.chatwoot_portal_tomar(uuid, integer, uuid)',
    'public.chatwoot_portal_marcar(uuid, uuid, integer, boolean, bigint, text, boolean)',
    'public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint)',
    'public.chatwoot_portal_rezagados(uuid)'] loop
    perform pg_temp.assert_true(
      not has_function_privilege('anon', v_firma, 'EXECUTE') and not has_function_privilege('authenticated', v_firma, 'EXECUTE')
      and has_function_privilege('service_role', v_firma, 'EXECUTE'),
      'las funciones son solo de service_role: ' || v_firma);
    perform pg_temp.assert_true((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
      where p.oid = to_regprocedure(v_firma)), 'security definer con search_path vacío: ' || v_firma);
  end loop;
  perform pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name like 'chatwoot_portal_%'
      and column_name ~ '(^|_)(phone|telefono|content|body|cuerpo|texto|name|nombre|email|correo|markbox|rif)(_|$)'
  ), 'ninguna columna nueva guarda teléfono, texto, nombre, correo, Shipping Mark ni RIF');
end;
$acceso$;

select 'TEST 0519 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
