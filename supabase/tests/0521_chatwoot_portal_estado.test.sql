\set ON_ERROR_STOP on

-- SDD-0586 (10.5, PR 1c-2) · contrato de 0521: el estado del hilo del portal, la conciliación y la
-- guarda de los hilos del portal.
--
-- Monta lo mínimo que 0519, 0520 y 0521 dan por sentado y aplica de verdad lo demás: 0006
-- (clients), la columna phone_last10 de 0383, 0106 (conversaciones, con su RLS y sus grants), 0337 y
-- 0503 (catálogo de flags), 0504 (el espejo chatwoot_conversations y chatwoot_registrar_evento), la
-- 0519 y la 0520. Después aplica la 0521 REAL y la llama como el servidor de Studio (service_role) y
-- escribe como alguien del equipo (authenticated, con su sesión) directo, como lo haría PostgREST.
--
-- Lo que este contrato no puede probar: `portal_post_message` real (su cadena, de la 0512 hacia
-- atrás, no se monta aquí). La propiedad que importa es que una función `security definer` pase la
-- guarda, y se prueba con una función definer del contrato que escribe lo mismo (un entrante y la
-- reapertura del hilo), llamada como authenticated, y con las funciones reales de la 0520 y la 0521.
--
-- CONTROL ROJO: sin 0521 cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids y nombres sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0521 requiere una base PostgreSQL desechable vacía';
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
  select md5('0521-sintetico-' || label)::uuid
$$;

insert into public.tenants values
  (pg_temp.id('T1'), 'dtd'),
  (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql

-- CO es comercial de T1, C2 comercial de T2, DM tiene dos membresías activas (T1 y T2).
insert into auth.users values (pg_temp.id('CO')), (pg_temp.id('C2')), (pg_temp.id('DM'));
insert into public.user_tenants values
  (pg_temp.id('CO'), pg_temp.id('T1'), 'commercial', null),
  (pg_temp.id('C2'), pg_temp.id('T2'), 'commercial', null),
  (pg_temp.id('DM'), pg_temp.id('T1'), 'commercial', null),
  (pg_temp.id('DM'), pg_temp.id('T2'), 'commercial', null);

insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', null, null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('C'), pg_temp.id('T1'), 'DTD-SC', 'Cliente C', null, null),
  (pg_temp.id('D'), pg_temp.id('T1'), 'DTD-SD', 'Cliente D', null, null),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);

-- Hilos de T1 (un hilo vivo por cliente y canal: conversations_client_channel_live_idx, 0106): hA portal
-- abierto de A; hR portal resuelto de B con actividad de hace 3 días; hV portal resuelto de C con actividad
-- de hace 10 días; hX portal archivado de A; hE correo de A. hZ es el portal de T2.
insert into public.conversations (id, tenant_id, client_id, channel, status, deleted_at, last_message_at) values
  (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',  null, now() - interval '30 days'),
  (pg_temp.id('hR'), pg_temp.id('T1'), pg_temp.id('B'), 'portal', 'resuelto', null, now() - interval '3 days'),
  (pg_temp.id('hV'), pg_temp.id('T1'), pg_temp.id('C'), 'portal', 'resuelto', null, now() - interval '10 days'),
  (pg_temp.id('hX'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',  now() - interval '1 day', null),
  (pg_temp.id('hE'), pg_temp.id('T1'), pg_temp.id('A'), 'email',  'abierto',  null, null),
  (pg_temp.id('hZ'), pg_temp.id('T2'), pg_temp.id('Z'), 'portal', 'abierto',  null, null);

\ir ../migrations/0519_chatwoot_portal.sql

-- Vínculos: 100 hA, 101 hR, 102 hV, 103 hX, 105 hE (un vínculo que no debería existir: correo) y
-- 100 también en T2 para hZ (otra cuenta, otro hilo).
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id) values
  (pg_temp.id('hA'), pg_temp.id('T1'), 100),
  (pg_temp.id('hR'), pg_temp.id('T1'), 101),
  (pg_temp.id('hV'), pg_temp.id('T1'), 102),
  (pg_temp.id('hX'), pg_temp.id('T1'), 103),
  (pg_temp.id('hE'), pg_temp.id('T1'), 105),
  (pg_temp.id('hZ'), pg_temp.id('T2'), 100);

\ir ../migrations/0520_chatwoot_portal_vuelta.sql
\ir ../migrations/0521_chatwoot_portal_estado.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0521: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- El flag chatwoot_portal (sembrado apagado por la 0519) en un tenant.
create function pg_temp.flag(p_tenant text, p_on boolean) returns void language sql as $$
  update public.feature_flags set enabled = p_on where tenant_id = pg_temp.id(p_tenant) and key = 'chatwoot_portal';
$$;
-- El espejo de una conversación (0504), como lo deja chatwoot_registrar_evento.
create function pg_temp.espejo(p_tenant text, p_conv bigint, p_status text, p_actividad timestamptz default null) returns void language sql as $$
  insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, last_activity_at, source_updated_at)
  values (pg_temp.id(p_tenant), p_conv, 9, p_status, p_actividad, 1)
  on conflict (tenant_id, conversation_id) do update set status = excluded.status, last_activity_at = excluded.last_activity_at;
$$;
-- El estado como el servidor de Studio: «resultado/estado».
create function pg_temp.estado(p_tenant text, p_conv bigint) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  select r.resultado || '/' || coalesce(r.estado, '-') into v
  from public.chatwoot_portal_estado_hilo(pg_temp.id(p_tenant), p_conv) r;
  reset role;
  return v;
end;
$$;
create function pg_temp.status(p_hilo text) returns text language sql as $$
  select status::text from public.conversations where id = pg_temp.id(p_hilo);
$$;
-- Escribe como alguien del equipo, directo (PostgREST): «ok», o el SQLSTATE y el mensaje.
create function pg_temp.como(p_usuario text, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.id(p_usuario)::text, true);
  set local role authenticated;
  execute p_sql;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate || ': ' || sqlerrm;
end;
$$;
create function pg_temp.sql_hilo(p_set text, p_hilo text) returns text language sql as $$
  select format('update public.conversations set %s where id = %L', p_set, pg_temp.id(p_hilo));
$$;
create function pg_temp.sql_saliente(p_tenant text, p_hilo text) returns text language sql as $$
  select format(
    'insert into public.conversation_messages (tenant_id, conversation_id, direction, body) values (%L, %L, ''out'', ''respuesta sintética'')',
    pg_temp.id(p_tenant), pg_temp.id(p_hilo));
$$;

-- Lo que hace portal_post_message, como función security definer del contrato: un entrante y la
-- reapertura del hilo, llamada por authenticated. Tiene que pasar la guarda.
create function public.prueba_definer_escribe(p_hilo uuid, p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_messages (tenant_id, conversation_id, direction, body)
  values (p_tenant, p_hilo, 'in', 'entrante sintético');
  update public.conversations set status = 'abierto' where id = p_hilo;
  insert into public.conversation_messages (tenant_id, conversation_id, direction, body)
  values (p_tenant, p_hilo, 'out', 'saliente sintético por definer');
end;
$$;
grant execute on function public.prueba_definer_escribe(uuid, uuid) to authenticated;

-- ── §1 · El estado, desde el espejo ─────────────────────────────────────────
do $estado$
begin
  perform pg_temp.assert_true(to_regprocedure('public.chatwoot_portal_estado_hilo(uuid, bigint)') is not null,
    'existe chatwoot_portal_estado_hilo');

  -- Con el flag apagado no toca nada.
  perform pg_temp.espejo('T1', 100, 'resolved');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'apagado/-', 'con el flag apagado: apagado');
  perform pg_temp.assert_true(pg_temp.status('hA') = 'abierto', 'con el flag apagado el hilo no cambia');

  perform pg_temp.flag('T1', true);
  -- Los cuatro estados del espejo (0504:96) al enum de 0106:34.
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'actualizado/resuelto', 'resolved pasa a resuelto');
  perform pg_temp.assert_true(pg_temp.status('hA') = 'resuelto', 'el hilo quedó resuelto');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'igual/resuelto', 'solo si cambia: igual');
  perform pg_temp.espejo('T1', 100, 'pending');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'actualizado/pendiente', 'pending pasa a pendiente');
  perform pg_temp.espejo('T1', 100, 'open');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'actualizado/abierto', 'open pasa a abierto');
  perform pg_temp.espejo('T1', 100, 'snoozed');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'actualizado/pendiente', 'snoozed pasa a pendiente');

  -- Archivado, otro canal, otro tenant y sin espejo.
  perform pg_temp.espejo('T1', 103, 'resolved');
  perform pg_temp.assert_true(pg_temp.estado('T1', 103) = 'archivado/-', 'a un hilo archivado no lo cambia');
  perform pg_temp.assert_true(pg_temp.status('hX') = 'abierto', 'el hilo archivado quedó igual');
  perform pg_temp.espejo('T1', 105, 'resolved');
  perform pg_temp.assert_true(pg_temp.estado('T1', 105) = 'sin_hilo/-', 'un vínculo a un hilo de correo no se toca');
  perform pg_temp.assert_true(pg_temp.status('hE') = 'abierto', 'el hilo de correo quedó igual');
  perform pg_temp.assert_true(pg_temp.estado('T1', 104) = 'sin_hilo/-', 'una conversación sin vínculo: sin_hilo');
  perform pg_temp.assert_true(pg_temp.estado('T1', 102) = 'sin_espejo/-', 'sin espejo todavía: sin_espejo');
  perform pg_temp.assert_true(pg_temp.status('hZ') = 'abierto', 'el hilo de T2 con el mismo número no se tocó');
end;
$estado$;

-- El orden lo da el espejo: un evento viejo (source_updated_at menor) no lo pisa.
do $orden$
declare r record;
begin
  perform pg_temp.flag('T1', true);
  set local role service_role;
  perform public.chatwoot_registrar_evento(pg_temp.id('T1'), null, null, 101, 9, 'open', 0, null, null, now(), 200);
  perform public.chatwoot_registrar_evento(pg_temp.id('T1'), null, null, 101, 9, 'resolved', 0, null, null, now(), 100);
  reset role;
  perform pg_temp.assert_true(pg_temp.estado('T1', 101) = 'actualizado/abierto',
    'un evento viejo no pisa el espejo: el hilo queda con el más nuevo');
end;
$orden$;

-- ── §2 · Por conciliar ──────────────────────────────────────────────────────
do $conciliar$
declare v uuid[];
begin
  perform pg_temp.flag('T1', true);
  -- hR vuelve a resuelto con actividad de hace 3 días; hV resuelto, sin actividad reciente.
  update public.conversations set status = 'resuelto' where id = pg_temp.id('hR');
  update public.conversations set status = 'abierto' where id = pg_temp.id('hA');
  perform pg_temp.espejo('T1', 101, 'resolved', now() - interval '3 days');
  perform pg_temp.espejo('T1', 102, 'resolved', now() - interval '10 days');
  set local role service_role;
  select array_agg(p.conversation_id order by p.conversation_id) into v
  from public.chatwoot_portal_por_conciliar(pg_temp.id('T1'), 20) p;
  reset role;
  perform pg_temp.assert_true(pg_temp.id('hA') = any(v),
    'un hilo abierto entra sin ventana (su último mensaje es de hace 30 días)');
  perform pg_temp.assert_true(pg_temp.id('hR') = any(v), 'un resuelto con actividad en 7 días entra');
  perform pg_temp.assert_true(not pg_temp.id('hV') = any(v), 'un resuelto sin actividad en 7 días no entra');
  perform pg_temp.assert_true(not pg_temp.id('hX') = any(v), 'un hilo archivado no entra');
  perform pg_temp.assert_true(not pg_temp.id('hE') = any(v), 'un hilo de correo no entra');
  perform pg_temp.assert_true(not pg_temp.id('hZ') = any(v), 'un hilo de otro tenant no entra');
  perform pg_temp.assert_true(cardinality(v) = 2, 'entran exactamente hA y hR');

  -- El orden: primero el que nunca se concilió; el tope corta.
  update public.chatwoot_portal_hilos set conciliado_at = now() where conversation_id = pg_temp.id('hA');
  set local role service_role;
  select array_agg(p.conversation_id) into v from public.chatwoot_portal_por_conciliar(pg_temp.id('T1'), 1) p;
  reset role;
  perform pg_temp.assert_true(v = array[pg_temp.id('hR')], 'el tope corta, y primero va el nunca conciliado');

  perform pg_temp.flag('T1', false);
  set local role service_role;
  select array_agg(p.conversation_id) into v from public.chatwoot_portal_por_conciliar(pg_temp.id('T1'), 20) p;
  reset role;
  perform pg_temp.assert_true(v is null, 'con el flag apagado no hay nada que conciliar');
end;
$conciliar$;

-- ── §3 · La marca de agua ───────────────────────────────────────────────────
do $marca$
declare v_ok boolean; v_hasta bigint;
begin
  set local role service_role;
  v_ok := public.chatwoot_portal_marcar_conciliado(pg_temp.id('T1'), pg_temp.id('hR'), 50);
  reset role;
  select conciliado_hasta into v_hasta from public.chatwoot_portal_hilos where conversation_id = pg_temp.id('hR');
  perform pg_temp.assert_true(v_ok and v_hasta = 50, 'la marca sube a 50');
  set local role service_role;
  perform public.chatwoot_portal_marcar_conciliado(pg_temp.id('T1'), pg_temp.id('hR'), 40);
  perform public.chatwoot_portal_marcar_conciliado(pg_temp.id('T1'), pg_temp.id('hR'), null);
  reset role;
  select conciliado_hasta into v_hasta from public.chatwoot_portal_hilos where conversation_id = pg_temp.id('hR');
  perform pg_temp.assert_true(v_hasta = 50, 'la marca nunca vuelve hacia atrás, y la nula la deja igual');
  perform pg_temp.assert_true((select conciliado_at is not null from public.chatwoot_portal_hilos
    where conversation_id = pg_temp.id('hR')), 'queda la hora de la conciliación');
  set local role service_role;
  v_ok := public.chatwoot_portal_marcar_conciliado(pg_temp.id('T2'), pg_temp.id('hR'), 60);
  reset role;
  select conciliado_hasta into v_hasta from public.chatwoot_portal_hilos where conversation_id = pg_temp.id('hR');
  perform pg_temp.assert_true(not v_ok and v_hasta = 50, 'otro tenant no mueve la marca');
end;
$marca$;

-- ── §4 · La guarda de los hilos del portal ──────────────────────────────────
do $guarda$
declare v text;
begin
  perform pg_temp.flag('T1', true);
  update public.conversations set status = 'abierto' where id = pg_temp.id('hA');

  -- Escrituras directas de authenticated, con el flag encendido.
  v := pg_temp.como('CO', pg_temp.sql_hilo('status = ''resuelto''', 'hA'));
  perform pg_temp.assert_true(v like '42501:%Bandeja de Chatwoot%', 'el equipo no cambia directo el estado de un hilo del portal: ' || v);
  perform pg_temp.assert_true(pg_temp.status('hA') = 'abierto', 'el estado quedó igual');
  v := pg_temp.como('CO', pg_temp.sql_saliente('T1', 'hA'));
  perform pg_temp.assert_true(v like '42501:%se responde desde la Bandeja%', 'el equipo no escribe directo un saliente en un hilo del portal: ' || v);
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_hilo('assigned_to = null', 'hA')) = 'ok', 'asignar sigue libre');
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_hilo('is_case = true', 'hA')) = 'ok', 'marcar caso sigue libre');
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_hilo('status = ''abierto''', 'hA')) = 'ok',
    'poner el mismo estado no es un cambio');
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_saliente('T1', 'hE')) = 'ok',
    'un saliente en un hilo de correo sigue libre');
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_hilo('status = ''resuelto''', 'hE')) = 'ok',
    'el estado de un hilo de correo sigue libre');

  -- El canal, en los dos sentidos y también al crear.
  v := pg_temp.como('CO', pg_temp.sql_hilo('channel = ''email''', 'hA'));
  perform pg_temp.assert_true(v like '42501:%se vuelve ni deja de ser del portal%', 'un hilo del portal no deja de serlo: ' || v);
  v := pg_temp.como('CO', pg_temp.sql_hilo('channel = ''portal''', 'hE'));
  perform pg_temp.assert_true(v like '42501:%se vuelve ni deja de ser del portal%', 'un hilo de correo no se vuelve del portal: ' || v);
  v := pg_temp.como('CO', format(
    'insert into public.conversations (tenant_id, client_id, channel) values (%L, %L, ''portal'')',
    pg_temp.id('T1'), pg_temp.id('D')));
  perform pg_temp.assert_true(v like '42501:%solo lo crea el portal%', 'el equipo no crea un hilo del portal: ' || v);
  perform pg_temp.assert_true(pg_temp.como('CO', format(
    'insert into public.conversations (tenant_id, client_id, channel) values (%L, %L, ''email'')',
    pg_temp.id('T1'), pg_temp.id('D'))) = 'ok', 'crear un hilo de correo sigue libre');

  -- Las funciones security definer pasan: la del contrato, llamada por authenticated, y las reales.
  update public.conversations set status = 'resuelto' where id = pg_temp.id('hA');
  perform pg_temp.assert_true(pg_temp.como('CO', format('select public.prueba_definer_escribe(%L, %L)',
    pg_temp.id('hA'), pg_temp.id('T1'))) = 'ok', 'una función security definer, llamada por authenticated, pasa la guarda');
  perform pg_temp.assert_true(pg_temp.status('hA') = 'abierto', 'la función definer reabrió el hilo');
  perform pg_temp.espejo('T1', 100, 'resolved');
  perform pg_temp.assert_true(pg_temp.estado('T1', 100) = 'actualizado/resuelto', 'chatwoot_portal_estado_hilo escribe el estado con el flag encendido');
  set local role service_role;
  select r.resultado into v from public.chatwoot_portal_respuesta(pg_temp.id('T1'), 100, 777, 'respuesta del agente', now(), null) r;
  reset role;
  perform pg_temp.assert_true(v = 'insertado', 'chatwoot_portal_respuesta escribe el saliente con el flag encendido');

  -- Con el flag apagado: Studio vuelve a responder y a cambiar el estado; el canal sigue trabado.
  perform pg_temp.flag('T1', false);
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_hilo('status = ''pendiente''', 'hA')) = 'ok',
    'con el flag apagado el equipo cambia el estado');
  perform pg_temp.assert_true(pg_temp.como('CO', pg_temp.sql_saliente('T1', 'hA')) = 'ok',
    'con el flag apagado el equipo responde');
  v := pg_temp.como('CO', pg_temp.sql_hilo('channel = ''whatsapp''', 'hA'));
  perform pg_temp.assert_true(v like '42501:%se vuelve ni deja de ser del portal%', 'el canal sigue trabado con el flag apagado: ' || v);

  -- Dos membresías activas: get_user_tenant_id() es nulo, la guarda no frena y corta la RLS.
  perform pg_temp.flag('T1', true);
  update public.conversations set status = 'abierto' where id = pg_temp.id('hA');
  perform pg_temp.assert_true(pg_temp.como('DM', pg_temp.sql_hilo('status = ''resuelto''', 'hA')) = 'ok',
    'con dos membresías la escritura no da error: la RLS no le muestra filas');
  perform pg_temp.assert_true(pg_temp.status('hA') = 'abierto', 'con dos membresías el estado no cambió: lo cortó la RLS');
  v := pg_temp.como('DM', pg_temp.sql_saliente('T1', 'hA'));
  perform pg_temp.assert_true(v like '42501:%row-level security%', 'con dos membresías el saliente lo corta la RLS: ' || v);
end;
$guarda$;

-- El flag de otro tenant, preguntado por alguien del equipo: false.
do $flag$
declare v boolean;
begin
  perform pg_temp.flag('T1', true);
  perform pg_temp.flag('T2', true);
  perform set_config('request.jwt.claim.sub', pg_temp.id('CO')::text, true);
  set local role authenticated;
  v := public.chatwoot_portal_flag(pg_temp.id('T2'));
  reset role;
  perform pg_temp.assert_true(v = false, 'el flag de otro tenant da false para authenticated');
  set local role authenticated;
  v := public.chatwoot_portal_flag(pg_temp.id('T1'));
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v = true, 'el flag del tenant de la sesión, encendido');
end;
$flag$;

-- ── §5 · Acceso ─────────────────────────────────────────────────────────────
do $acceso$
declare v_firma text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_estado_hilo(uuid, bigint)',
    'public.chatwoot_portal_por_conciliar(uuid, integer)',
    'public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint)'] loop
    perform pg_temp.assert_true(
      not has_function_privilege('anon', v_firma, 'EXECUTE') and not has_function_privilege('authenticated', v_firma, 'EXECUTE')
      and has_function_privilege('service_role', v_firma, 'EXECUTE'), 'solo de service_role: ' || v_firma);
    perform pg_temp.assert_true((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
      where p.oid = to_regprocedure(v_firma)), 'security definer con search_path vacío: ' || v_firma);
  end loop;
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.chatwoot_portal_flag(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.chatwoot_portal_flag(uuid)', 'EXECUTE'),
    'el flag es de authenticated, no de anon');
  perform pg_temp.assert_true((select not p.prosecdef from pg_proc p
    where p.oid = to_regprocedure('public.chatwoot_portal_guarda()')), 'la guarda es security invoker');
end;
$acceso$;

select 'TEST 0521 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
