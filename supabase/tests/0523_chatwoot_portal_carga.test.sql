\set ON_ERROR_STOP on

-- SDD-0586 (10.7, PR 2: P4) · contrato de 0523: la carga a Chatwoot de los hilos del portal que ya
-- existen (spec §10.5.10 y el formato cerrado con E5).
--
-- Monta lo mínimo que 0519, 0520 y 0523 dan por sentado y aplica de verdad lo demás: 0006 (clients),
-- la columna phone_last10 de 0383, 0106 (conversaciones), 0337 y 0503 (catálogo de flags y
-- chatwoot_agent_links), 0504 (chatwoot_conversations), la 0519 y la 0520. Después aplica la 0523
-- REAL y la llama como el servidor de Studio (service_role): la reserva, las líneas de
-- preparado.ndjson dentro de una transacción de solo lectura, y la vinculación con un
-- vinculos.ndjson armado como lo devuelve el cargador de E5. Al final, la cola de la 0519
-- (chatwoot_portal_tomar) con el flag encendido: lo cargado no vuelve a salir, y lo que cae en el
-- margen del corte sin estar en la foto sale una sola vez.
--
-- CONTROL ROJO: sin 0523 cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids, nombres y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0523 requiere una base PostgreSQL desechable vacía';
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

create table public.user_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name  text
);

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

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

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
  select md5('0523-sintetico-' || label)::uuid
$$;

insert into public.tenants values (pg_temp.id('T1'), 'dtd'), (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql

insert into auth.users values (pg_temp.id('U1')), (pg_temp.id('U2'));
insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values (pg_temp.id('T1'), pg_temp.id('U1'), 7);

-- Fichas de T1: A (con teléfono, que nunca sale), B y C vivas, D borrada. Z en T2.
insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', '+584125550101', null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('C'), pg_temp.id('T1'), 'DTD-SC', 'Cliente C', null, null),
  (pg_temp.id('D'), pg_temp.id('T1'), 'DTD-SD', 'Cliente D', null, now()),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);

-- Hilos de T1: hA portal abierto de A; hP portal pendiente de B; hX portal de A archivado (resuelto
-- en Chatwoot, con su nota); hC portal de C ya vinculado por la cola (no se carga); hD portal de la
-- ficha borrada (no se carga); hE correo de A (no se carga). hZ portal de T2.
insert into public.conversations (id, tenant_id, client_id, channel, status, deleted_at, last_message_at, created_at) values
  (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',   null, now() - interval '20 minutes', now() - interval '3 days'),
  (pg_temp.id('hP'), pg_temp.id('T1'), pg_temp.id('B'), 'portal', 'pendiente', null, now() - interval '1 day', now() - interval '2 days'),
  (pg_temp.id('hX'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',   now() - interval '1 day', now() - interval '5 days', now() - interval '9 days'),
  (pg_temp.id('hC'), pg_temp.id('T1'), pg_temp.id('C'), 'portal', 'abierto',   null, null, now()),
  (pg_temp.id('hD'), pg_temp.id('T1'), pg_temp.id('D'), 'portal', 'abierto',   null, null, now()),
  (pg_temp.id('hE'), pg_temp.id('T1'), pg_temp.id('A'), 'email',  'abierto',   null, null, now()),
  (pg_temp.id('hZ'), pg_temp.id('T2'), pg_temp.id('Z'), 'portal', 'abierto',   null, null, now());

insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, author_user_id, body, external_msg_id, sent_at) values
  (pg_temp.id('a1'), pg_temp.id('T1'), pg_temp.id('hA'), 'in',  'Cliente A', null,            'SINT pregunta a1', 'portal:a1', now() - interval '40 minutes'),
  (pg_temp.id('a2'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Ana',       pg_temp.id('U1'), 'SINT respuesta a2', null,      now() - interval '30 minutes'),
  (pg_temp.id('a3'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Luis',      pg_temp.id('U2'), 'SINT respuesta a3', null,      now() - interval '25 minutes'),
  (pg_temp.id('a4'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Ana',       null,            'SINT vino de Chatwoot', 'chatwoot:999', now() - interval '24 minutes'),
  -- En el margen del corte (2 minutos antes de la foto) y dentro de la foto.
  (pg_temp.id('am'), pg_temp.id('T1'), pg_temp.id('hA'), 'in',  'Cliente A', null,            'SINT en el margen',  null,      now() - interval '2 minutes'),
  (pg_temp.id('p1'), pg_temp.id('T1'), pg_temp.id('hP'), 'in',  'Cliente B', null,            'SINT pregunta p1',   null,      now() - interval '1 day'),
  (pg_temp.id('x1'), pg_temp.id('T1'), pg_temp.id('hX'), 'in',  'Cliente A', null,            'SINT archivado x1',  null,      now() - interval '5 days'),
  (pg_temp.id('c1'), pg_temp.id('T1'), pg_temp.id('hC'), 'in',  'Cliente C', null,            'SINT ya en la cola', null,      now() - interval '1 hour'),
  (pg_temp.id('d1'), pg_temp.id('T1'), pg_temp.id('hD'), 'in',  'Cliente D', null,            'SINT ficha borrada', null,      now() - interval '1 hour'),
  (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'in',  'Cliente Z', null,            'SINT otro tenant',   null,      now() - interval '1 hour');

\ir ../migrations/0519_chatwoot_portal.sql

-- hC ya lo vinculó la cola (su ficha tiene identificador y contacto).
insert into public.chatwoot_portal_contactos (tenant_id, client_id, chatwoot_contact_id, chatwoot_source_id)
values (pg_temp.id('T1'), pg_temp.id('C'), 300, 'dtd-portal:previo');
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
values (pg_temp.id('hC'), pg_temp.id('T1'), 1100);
insert into public.chatwoot_portal_salida (message_id, tenant_id, conversation_id, estado, chatwoot_message_id)
values (pg_temp.id('c1'), pg_temp.id('T1'), pg_temp.id('hC'), 'enviado', 1101);

\ir ../migrations/0520_chatwoot_portal_vuelta.sql
\ir ../migrations/0523_chatwoot_portal_carga.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0523: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.flag(p_tenant text, p_on boolean) returns void language sql as $$
  update public.feature_flags set enabled = p_on where tenant_id = pg_temp.id(p_tenant) and key = 'chatwoot_portal';
$$;
create function pg_temp.falla(p_sql text) returns text language plpgsql as $$
begin
  set local role service_role;
  execute p_sql;
  reset role;
  return null;
exception when others then
  reset role;
  return sqlstate || ': ' || sqlerrm;
end;
$$;
create function pg_temp.identificador(p_cliente text) returns uuid language sql as $$
  select identificador from public.chatwoot_portal_contactos where tenant_id = pg_temp.id('T1') and client_id = pg_temp.id(p_cliente);
$$;
-- Lo que se guarda de las líneas de preparado.ndjson para la vinculación.
create temporary table preparado (n serial, linea jsonb);
create temporary table huella_antes (tabla text, filas bigint, md5 text);

do $huella$
begin
  insert into huella_antes
  select 'conversation_messages', count(*), md5(string_agg(id::text || body || sent_at::text, ',' order by id)) from public.conversation_messages
  union all
  select 'conversations', count(*), md5(string_agg(id::text || status::text || coalesce(deleted_at::text, '-'), ',' order by id)) from public.conversations;
end;
$huella$;

-- ── §1 · La reserva del identificador ───────────────────────────────────────
do $reserva$
declare v integer; v_a uuid;
begin
  perform pg_temp.assert_true(to_regprocedure('public.chatwoot_portal_reservar_contactos(uuid)') is not null,
    'existe chatwoot_portal_reservar_contactos');

  perform pg_temp.flag('T1', true);
  perform pg_temp.assert_true(pg_temp.falla(format('select public.chatwoot_portal_reservar_contactos(%L)', pg_temp.id('T1'))) like '55000:%',
    'con el flag encendido la reserva se niega');
  perform pg_temp.flag('T1', false);

  set local role service_role;
  v := public.chatwoot_portal_reservar_contactos(pg_temp.id('T1'));
  reset role;
  perform pg_temp.assert_true(v = 2, 'reserva A y B (no C, ya vinculada; no D, ficha borrada): ' || v);
  perform pg_temp.assert_true(pg_temp.identificador('A') is not null and pg_temp.identificador('B') is not null, 'A y B tienen identificador');
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_portal_contactos where client_id = pg_temp.id('D')),
    'la ficha borrada no se reserva');
  perform pg_temp.assert_true((select chatwoot_contact_id is null from public.chatwoot_portal_contactos where client_id = pg_temp.id('A')),
    'la reserva no tiene contacto todavía');

  v_a := pg_temp.identificador('A');
  set local role service_role;
  v := public.chatwoot_portal_reservar_contactos(pg_temp.id('T1'));
  reset role;
  perform pg_temp.assert_true(v = 0 and pg_temp.identificador('A') = v_a, 'repetir la reserva no cambia el identificador');
end;
$reserva$;

-- ── §2 · Las líneas de preparado.ndjson ─────────────────────────────────────
do $fuera$
begin
  perform pg_temp.assert_true(pg_temp.falla(format('select * from public.chatwoot_portal_carga_lineas(%L, 1, 9)', pg_temp.id('T1'))) like '25006:%',
    'fuera de una transacción de solo lectura las líneas se niegan');
end;
$fuera$;

do $lineas$
declare
  v jsonb[];
  v_cab jsonb;
  v_texto text;
begin
  begin
    set local transaction_read_only = on;
    set local role service_role;
    select array_agg(l::jsonb order by o) into v from public.chatwoot_portal_carga_lineas(pg_temp.id('T1'), 1, 9) with ordinality as t(l, o);
    reset role;
    v_cab := v[1];
    perform pg_temp.assert_true(v_cab ->> 'tipo' = 'cabecera' and (v_cab ->> 'version')::int = 1, 'la primera línea es la cabecera');
    perform pg_temp.assert_true(v_cab ->> 'corte' = to_char((transaction_timestamp() - interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'el corte va 5 minutos antes de la foto');
    perform pg_temp.assert_true((v_cab ->> 'cuenta')::int = 1 and (v_cab ->> 'bandeja')::int = 9 and v_cab ->> 'tenant_id' = pg_temp.id('T1')::text,
      'la cabecera lleva la cuenta, la bandeja y el tenant');
    perform pg_temp.assert_true((v_cab ->> 'contactos')::int = 2 and (v_cab ->> 'conversaciones')::int = 3 and (v_cab ->> 'mensajes')::int = 6,
      'conteos: 2 contactos, 3 conversaciones y 6 mensajes: ' || v_cab::text);
    perform pg_temp.assert_true(
      (select count(*) from unnest(v) e where e ->> 'tipo' = 'contacto') = 2
      and (select count(*) from unnest(v) e where e ->> 'tipo' = 'conversacion') = 3
      and (select count(*) from unnest(v) e where e ->> 'tipo' = 'mensaje') = 6,
      'los conteos de la cabecera son los de las líneas');
    -- El orden de las secciones: contactos, conversaciones, mensajes.
    perform pg_temp.assert_true(
      (select max(o) from unnest(v) with ordinality t(e, o) where e ->> 'tipo' = 'contacto')
        < (select min(o) from unnest(v) with ordinality t(e, o) where e ->> 'tipo' = 'conversacion')
      and (select max(o) from unnest(v) with ordinality t(e, o) where e ->> 'tipo' = 'conversacion')
        < (select min(o) from unnest(v) with ordinality t(e, o) where e ->> 'tipo' = 'mensaje'),
      'las secciones van en orden');
    -- El contacto: su identificador reservado, su nombre y nada más.
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'tipo' = 'contacto'
      and e ->> 'cliente' = pg_temp.id('A')::text and e ->> 'identificador' = pg_temp.identificador('A')::text and e ->> 'nombre' = 'Cliente A'),
      'el contacto de A lleva su identificador reservado y su nombre');
    perform pg_temp.assert_true(not exists (select 1 from unnest(v) e where e ->> 'tipo' = 'contacto'
      and (select array_agg(k order by k) from jsonb_object_keys(e) k) <> array['cliente', 'identificador', 'nombre', 'tipo']),
      'el contacto no lleva más campos que los del formato');
    select string_agg(e::text, '\n') into v_texto from unnest(v) e;
    perform pg_temp.assert_true(position('5550101' in v_texto) = 0 and position('DTD-S' in v_texto) = 0,
      'nunca sale el teléfono ni el Shipping Mark');
    -- Las conversaciones: el estado traducido, el archivado resolved con su nota.
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'hilo' = pg_temp.id('hA')::text and e ->> 'tipo' = 'conversacion'
      and e ->> 'estado' = 'open' and e -> 'nota_archivo' = 'null'::jsonb and e -> 'archivado_at' = 'null'::jsonb), 'abierto pasa a open, sin nota');
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'hilo' = pg_temp.id('hP')::text and e ->> 'tipo' = 'conversacion'
      and e ->> 'estado' = 'pending'), 'pendiente pasa a pending');
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'hilo' = pg_temp.id('hX')::text and e ->> 'tipo' = 'conversacion'
      and e ->> 'estado' = 'resolved' and e -> 'nota_archivo' ->> 'source_id' = 'dtd:archivado:' || pg_temp.id('hX')::text
      and e -> 'nota_archivo' ->> 'created_at' = e ->> 'archivado_at'), 'el archivado va resolved, con su nota a la hora en que se archivó');
    perform pg_temp.assert_true(not exists (select 1 from unnest(v) e where e ->> 'hilo' in (
      pg_temp.id('hC')::text, pg_temp.id('hD')::text, pg_temp.id('hE')::text, pg_temp.id('hZ')::text)),
      'ni el hilo ya vinculado, ni el de la ficha borrada, ni el de correo, ni el de otro tenant');
    -- Los mensajes: en el orden de Studio, sin lo que vino de Chatwoot, con el agente vinculado.
    perform pg_temp.assert_true(
      (select array_agg(e ->> 'mensaje' order by o) from unnest(v) with ordinality t(e, o) where e ->> 'tipo' = 'mensaje' and e ->> 'hilo' = pg_temp.id('hA')::text)
        = array[pg_temp.id('a1')::text, pg_temp.id('a2')::text, pg_temp.id('a3')::text, pg_temp.id('am')::text],
      'los mensajes de hA en el orden de sent_at, sin el que vino de Chatwoot');
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'mensaje' = pg_temp.id('a2')::text
      and e ->> 'sentido' = 'saliente' and (e ->> 'agente')::int = 7 and e ->> 'source_id' = 'dtd:' || pg_temp.id('a2')::text),
      'un saliente lleva el agente vinculado y su source_id');
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'mensaje' = pg_temp.id('a3')::text and e -> 'agente' = 'null'::jsonb),
      'un saliente sin vínculo lleva el agente en null (lo firma el usuario de servicio)');
    perform pg_temp.assert_true(exists (select 1 from unnest(v) e where e ->> 'mensaje' = pg_temp.id('a1')::text
      and e ->> 'sentido' = 'entrante' and e -> 'agente' = 'null'::jsonb and e ->> 'texto' = 'SINT pregunta a1'),
      'un entrante lleva su texto y nunca agente');
    raise exception 'FIN_SOLO_LECTURA %', array_to_json(v)::text;
  exception when raise_exception then
    if sqlerrm not like 'FIN_SOLO_LECTURA %' then raise; end if;
    -- Lo leído en la foto, para la vinculación (la foto se deshace con la subtransacción).
    insert into preparado (linea) select e from jsonb_array_elements(substr(sqlerrm, length('FIN_SOLO_LECTURA ') + 1)::jsonb) e;
  end;
end;
$lineas$;

-- Un mensaje que cae en el margen del corte y NO estaba en la foto: llega después de leer las líneas.
insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, body, sent_at)
values (pg_temp.id('al'), pg_temp.id('T1'), pg_temp.id('hA'), 'in', 'Cliente A', 'SINT tarde', now() - interval '1 minute');

-- Sin reserva, las líneas se niegan: el hilo de T2 no tiene identificador.
do $sinreserva$
declare v text;
begin
  begin
    set local transaction_read_only = on;
    v := pg_temp.falla(format('select * from public.chatwoot_portal_carga_lineas(%L, 1, 9)', pg_temp.id('T2')));
    raise exception 'FIN_SOLO_LECTURA %', coalesce(v, 'null');
  exception when raise_exception then
    if sqlerrm not like 'FIN_SOLO_LECTURA %' then raise; end if;
    perform pg_temp.assert_true(sqlerrm like 'FIN_SOLO_LECTURA 55000:%falta reservar%', 'sin reserva las líneas se niegan: ' || sqlerrm);
  end;
end;
$sinreserva$;

-- ── §3 · La vinculación ─────────────────────────────────────────────────────
create temporary table vinculos (linea jsonb);
do $armar$
declare v_cab jsonb;
begin
  select linea into v_cab from preparado where linea ->> 'tipo' = 'cabecera';
  insert into vinculos values (jsonb_build_object('tipo', 'cabecera', 'version', 1, 'tenant_id', v_cab ->> 'tenant_id',
    'cuenta', (v_cab ->> 'cuenta')::int, 'bandeja', (v_cab ->> 'bandeja')::int, 'corte', v_cab ->> 'corte',
    'contactos', 2, 'conversaciones', 3, 'mensajes', 6));
  insert into vinculos
  select jsonb_build_object('tipo', 'contacto', 'cliente', p.linea ->> 'cliente', 'identificador', p.linea ->> 'identificador',
    'contacto_id', 500 + row_number() over (order by p.n), 'source_id', 'dtd-portal:' || (p.linea ->> 'identificador'))
  from preparado p where p.linea ->> 'tipo' = 'contacto';
  insert into vinculos
  select jsonb_build_object('tipo', 'conversacion', 'hilo', p.linea ->> 'hilo', 'conversacion_id', 1200 + row_number() over (order by p.n))
  from preparado p where p.linea ->> 'tipo' = 'conversacion';
  insert into vinculos
  select jsonb_build_object('tipo', 'mensaje', 'mensaje', p.linea ->> 'mensaje', 'mensaje_id', 90000 + row_number() over (order by p.n))
  from preparado p where p.linea ->> 'tipo' = 'mensaje';
end;
$armar$;

create function pg_temp.vincular(p_vinculos jsonb, p_preparado jsonb default null) returns text language plpgsql as $$
declare r record; v_p jsonb;
begin
  -- La cabecera se lee antes de cambiar de rol: la tabla temporal es del dueño de la prueba.
  v_p := coalesce(p_preparado, (select linea from preparado where linea ->> 'tipo' = 'cabecera'));
  set local role service_role;
  select * into r from public.chatwoot_portal_vincular_carga(pg_temp.id('T1'), v_p, p_vinculos);
  reset role;
  return r.contactos || '/' || r.hilos || '/' || r.mensajes;
exception when others then
  reset role;
  return sqlstate || ': ' || sqlerrm;
end;
$$;
create function pg_temp.todo() returns jsonb language sql as $$ select jsonb_agg(linea) from vinculos $$;

do $rechazos$
declare v text; v_todo jsonb := pg_temp.todo();
begin
  perform pg_temp.flag('T1', true);
  v := pg_temp.vincular(v_todo);
  perform pg_temp.assert_true(v like '55000:%', 'con el flag encendido la vinculación se niega: ' || v);
  perform pg_temp.flag('T1', false);

  v := pg_temp.vincular(v_todo, (select jsonb_set(linea, '{corte}', '"2020-01-01T00:00:00.000000Z"') from preparado where linea ->> 'tipo' = 'cabecera'));
  perform pg_temp.assert_true(v like '22023:%no es la del preparado%', 'otra cabecera se rechaza: ' || v);
  v := pg_temp.vincular((select jsonb_agg(case when linea ->> 'tipo' = 'cabecera' then jsonb_set(linea, '{mensajes}', '5') else linea end) from vinculos));
  perform pg_temp.assert_true(v like '22023:%conteos%', 'conteos que no cuadran se rechazan: ' || v);
  v := pg_temp.vincular((select jsonb_agg(case when linea ->> 'tipo' = 'contacto' and linea ->> 'cliente' = pg_temp.id('A')::text
    then jsonb_set(linea, '{identificador}', to_jsonb(gen_random_uuid()::text)) else linea end) from vinculos));
  perform pg_temp.assert_true(v like '22023:%identificador%', 'un identificador que no es el reservado se rechaza: ' || v);
  v := pg_temp.vincular(v_todo || jsonb_build_object('tipo', 'mensaje', 'mensaje', pg_temp.id('d1')::text, 'mensaje_id', 99999));
  perform pg_temp.assert_true(v like '22023:%conteos%' or v like 'P0002:%', 'un mensaje de más se rechaza: ' || v);
  v := pg_temp.vincular((select jsonb_agg(case when linea ->> 'tipo' = 'cabecera' then jsonb_set(linea, '{mensajes}', '7') else linea end) from vinculos)
    || jsonb_build_object('tipo', 'mensaje', 'mensaje', pg_temp.id('d1')::text, 'mensaje_id', 99999));
  perform pg_temp.assert_true(v like 'P0002:%hilo vinculado%', 'un mensaje de un hilo que no se vinculó se rechaza: ' || v);
  v := pg_temp.vincular((select jsonb_agg(case when linea ->> 'tipo' = 'cabecera' then jsonb_set(linea, '{contactos}', '3') else linea end) from vinculos)
    || jsonb_build_object('tipo', 'contacto', 'cliente', pg_temp.id('D')::text, 'identificador', gen_random_uuid()::text, 'contacto_id', 777, 'source_id', 'dtd-portal:x'));
  perform pg_temp.assert_true(v like 'P0002:%sin reserva%', 'un contacto sin reserva se rechaza: ' || v);
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_portal_hilos where conversation_id in (pg_temp.id('hA'), pg_temp.id('hP'), pg_temp.id('hX'))),
    'un rechazo no deja nada a medias');
end;
$rechazos$;

-- a1 ya había salido por la cola como «enviado» (otra vía): la carga no lo pisa.
insert into public.chatwoot_portal_salida (message_id, tenant_id, conversation_id, estado, chatwoot_message_id)
values (pg_temp.id('a1'), pg_temp.id('T1'), pg_temp.id('hA'), 'enviado', 77);

do $vincular$
declare v text; v_corte text;
begin
  v := pg_temp.vincular(pg_temp.todo());
  perform pg_temp.assert_true(v = '2/3/6', 'vincula 2 contactos, 3 hilos y 6 mensajes: ' || v);
  perform pg_temp.assert_true((select chatwoot_contact_id = 501 and chatwoot_source_id = 'dtd-portal:' || identificador::text
    from public.chatwoot_portal_contactos where client_id = (select (linea ->> 'cliente')::uuid from vinculos where linea ->> 'tipo' = 'contacto' and (linea ->> 'contacto_id')::int = 501)),
    'el contacto queda con su id y su source_id');
  perform pg_temp.assert_true((select count(*) from public.chatwoot_portal_hilos where conversation_id in (pg_temp.id('hA'), pg_temp.id('hP'), pg_temp.id('hX'))) = 3,
    'los tres hilos quedan vinculados');
  perform pg_temp.assert_true((select status from public.chatwoot_conversations cc join public.chatwoot_portal_hilos h
    on h.chatwoot_conversation_id = cc.conversation_id and h.tenant_id = cc.tenant_id where h.conversation_id = pg_temp.id('hX')) = 'resolved',
    'el espejo del archivado queda resolved');
  perform pg_temp.assert_true((select status from public.chatwoot_conversations cc join public.chatwoot_portal_hilos h
    on h.chatwoot_conversation_id = cc.conversation_id and h.tenant_id = cc.tenant_id where h.conversation_id = pg_temp.id('hP')) = 'pending',
    'el espejo del pendiente queda pending');
  perform pg_temp.assert_true((select count(*) from public.chatwoot_conversations cc join public.chatwoot_portal_hilos h
    on h.chatwoot_conversation_id = cc.conversation_id and h.tenant_id = cc.tenant_id
    join public.conversations c on c.id = h.conversation_id
    where h.conversation_id in (pg_temp.id('hA'), pg_temp.id('hP'), pg_temp.id('hX')) and cc.client_id = c.client_id and cc.inbox_id = 9) = 3,
    'una fila del espejo por hilo, con su client_id y la bandeja (C-8)');
  perform pg_temp.assert_true((select estado = 'enviado' and chatwoot_message_id = 77 from public.chatwoot_portal_salida where message_id = pg_temp.id('a1')),
    'un mensaje ya enviado no se pisa');
  perform pg_temp.assert_true((select count(*) from public.chatwoot_portal_salida where estado = 'cargado'
    and message_id in (pg_temp.id('a2'), pg_temp.id('a3'), pg_temp.id('am'), pg_temp.id('p1'), pg_temp.id('x1'))) = 5,
    'los demás mensajes cargados quedan cargado');
  select linea ->> 'corte' into v_corte from preparado where linea ->> 'tipo' = 'cabecera';
  perform pg_temp.assert_true((select corte = v_corte::timestamptz and cargado_at is not null from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1')),
    'el corte queda fijado con el del preparado');

  -- Repetir: no duplica ni cambia nada.
  v := pg_temp.vincular(pg_temp.todo());
  perform pg_temp.assert_true(v = '2/3/6', 'repetir la vinculación no falla: ' || v);
  perform pg_temp.assert_true((select count(*) from public.chatwoot_portal_hilos where tenant_id = pg_temp.id('T1')) = 4
    and (select count(*) from public.chatwoot_portal_salida where tenant_id = pg_temp.id('T1')) = 7,
    'repetir no duplica vínculos ni filas de la cola');

  -- Un corte que ya existe no se mueve.
  update public.chatwoot_portal_estado set corte = '2026-01-01T00:00:00Z' where tenant_id = pg_temp.id('T1');
  perform pg_temp.vincular(pg_temp.todo());
  perform pg_temp.assert_true((select corte = '2026-01-01T00:00:00Z'::timestamptz from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1')),
    'un corte que ya existe no se mueve');
  -- El corte viejo se queda, anterior a la foto, como el que fijó el DG por SQL (service_role) en la punta a
  -- punta de prueba. §4 prueba que con él nada se duplica ni se pierde.
end;
$vincular$;

-- El portal no cambia (C-6): conversaciones y mensajes, antes y después (sin el que llegó tarde).
do $portal$
begin
  perform pg_temp.assert_true(
    (select md5(string_agg(id::text || body || sent_at::text, ',' order by id)) from public.conversation_messages where id <> pg_temp.id('al'))
      = (select md5 from huella_antes where tabla = 'conversation_messages')
    and (select md5(string_agg(id::text || status::text || coalesce(deleted_at::text, '-'), ',' order by id)) from public.conversations)
      = (select md5 from huella_antes where tabla = 'conversations'),
    'la carga no cambia conversations ni conversation_messages');
end;
$portal$;

-- ── §4 · La cola después de la carga (riesgo 2 y el corte viejo) ────────────
--
-- El corte quedó en 2026-01-01, anterior a la foto: es el caso de prueba, donde el DG fijó un corte
-- para la punta a punta. La cola mira todos los mensajes del cliente desde ahí. Los de los hilos
-- cargados quedan «cargado» y no salen, el que ya mandó la cola (c1) es «enviado» y no sale, y sale
-- solo el que llegó después de la foto. Nada se duplica ni se pierde.
do $cola$
declare v uuid[];
begin
  perform pg_temp.assert_true((select corte < (select (linea ->> 'corte')::timestamptz from preparado where linea ->> 'tipo' = 'cabecera')
    from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1')), 'el corte que quedó es anterior a la foto');
  perform pg_temp.flag('T1', true);
  set local role service_role;
  select array_agg(t.mensaje_id) into v from public.chatwoot_portal_tomar(pg_temp.id('T1'), 20, null) t;
  reset role;
  perform pg_temp.assert_true(v = array[pg_temp.id('al')],
    'con el corte viejo, la cola manda solo el que llegó después de la foto, una vez; lo cargado (también el del margen) y lo enviado no salen: ' || coalesce(v::text, 'null'));
  perform pg_temp.flag('T1', false);
end;
$cola$;

-- ── §5 · Acceso ─────────────────────────────────────────────────────────────
do $acceso$
declare v_firma text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_reservar_contactos(uuid)',
    'public.chatwoot_portal_carga_lineas(uuid, integer, bigint)',
    'public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb)',
    'public.chatwoot_portal_carga_hilos(uuid)',
    'public.chatwoot_portal_carga_apagado(uuid)'] loop
    perform pg_temp.assert_true(
      not has_function_privilege('anon', v_firma, 'EXECUTE') and not has_function_privilege('authenticated', v_firma, 'EXECUTE')
      and has_function_privilege('service_role', v_firma, 'EXECUTE'), 'solo de service_role: ' || v_firma);
  end loop;
end;
$acceso$;

select 'TEST 0523 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
