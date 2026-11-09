\set ON_ERROR_STOP on

-- SDD-0586 10.7 · contrato de supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql: deshacer en Studio los
-- vínculos de la carga P4 (sub-paso 4.6b del runbook docs/runbooks/chatwoot-portal-p4-puertas.md).
--
-- Aplica las migraciones reales (0006, 0106, 0337, 0503, 0504, 0519, 0520, 0523, 0508 y 0524), hace una
-- carga con las funciones reales y corre el guion real: las guardas abortan sin escribir; el camino feliz
-- deshace todo, conserva el contacto del archivo de E5 y deja el corte en nulo; la cola no manda nada
-- después; y una carga nueva reusa los identificadores.
--
-- CONTROL ROJO: sin el guion cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids, nombres y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST deshacer requiere una base PostgreSQL desechable vacía';
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
  select md5('deshacer-sintetico-' || label)::uuid
$$;

insert into public.tenants values (pg_temp.id('T1'), 'dtd'), (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql

-- La tabla de auditoría, mínima: lo que lee el desarme (la real es de la 0267 y la 0289).
create table public.entity_audit_log (
  id          bigserial primary key,
  tenant_id   uuid not null,
  entity_type text not null,
  event_type  text not null,
  after_data  jsonb
);
insert into public.entity_audit_log (tenant_id, entity_type, event_type, after_data) values
  (pg_temp.id('T1'), 'client', 'client_updated', '{"campo":"otro"}');

insert into auth.users values (pg_temp.id('U1'));
insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values (pg_temp.id('T1'), pg_temp.id('U1'), 7);

-- Producción antes de encender: dos fichas, dos hilos del portal, la cola sin correr.
insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', null, null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);
insert into public.conversations (id, tenant_id, client_id, channel, status, deleted_at, last_message_at, created_at) values
  (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',   null, now() - interval '1 hour', now() - interval '3 days'),
  (pg_temp.id('hP'), pg_temp.id('T1'), pg_temp.id('B'), 'portal', 'pendiente', null, now() - interval '1 day',  now() - interval '2 days'),
  (pg_temp.id('hZ'), pg_temp.id('T2'), pg_temp.id('Z'), 'portal', 'abierto',   null, null, now());
insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, author_user_id, body, external_msg_id, sent_at) values
  (pg_temp.id('a1'), pg_temp.id('T1'), pg_temp.id('hA'), 'in',  'Cliente A', null,            'SINT pregunta a1',  null, now() - interval '2 hours'),
  (pg_temp.id('a2'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Ana',       pg_temp.id('U1'), 'SINT respuesta a2', null, now() - interval '90 minutes'),
  (pg_temp.id('p1'), pg_temp.id('T1'), pg_temp.id('hP'), 'in',  'Cliente B', null,            'SINT pregunta p1',  null, now() - interval '1 day'),
  (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'in',  'Cliente Z', null,            'SINT otro tenant',  null, now() - interval '1 hour');

\ir ../migrations/0519_chatwoot_portal.sql
\ir ../migrations/0520_chatwoot_portal_vuelta.sql
\ir ../migrations/0523_chatwoot_portal_carga.sql
\ir ../migrations/0508_chatwoot_bajas_purga.sql
\ir ../migrations/0524_chatwoot_portal_puerta4.sql
-- El guion real: define pg_temp.deshacer_vinculos().
\ir ../cargas/portal-historial-deshacer/deshacer-vinculos.sql

-- La marca de la copia efímera, como la pone el ensayo: guardada para la base (se deshace con el rollback
-- del contrato) y en esta sesión.
do $marca$
begin
  execute pg_catalog.format('alter database %I set dtd.entorno = %L', pg_catalog.current_database(), 'copia');
end;
$marca$;
select set_config('dtd.entorno', 'copia', true);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST deshacer: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.flag(p_on boolean) returns void language sql as $$
  update public.feature_flags set enabled = p_on where tenant_id = pg_temp.id('T1') and key = 'chatwoot_portal';
$$;
create function pg_temp.identificador(p_cliente text) returns uuid language sql as $$
  select identificador from public.chatwoot_portal_contactos where tenant_id = pg_temp.id('T1') and client_id = pg_temp.id(p_cliente);
$$;
create temporary table preparado (n serial, linea jsonb);
create temporary table huella_antes (md5_mensajes text, md5_hilos text, auditoria bigint);
insert into huella_antes
select (select md5(string_agg(id::text || body || sent_at::text, ',' order by id)) from public.conversation_messages),
       (select md5(string_agg(id::text || status::text, ',' order by id)) from public.conversations),
       (select count(*) from public.entity_audit_log where tenant_id = pg_temp.id('T1'));

-- B3 (revisión de la #469): lo que el desarme NO puede tocar.
-- · T2, con una carga vinculada completa: contacto, hilo, salida cargado, espejo y corte.
-- · En T1, un espejo de otra bandeja (WhatsApp) sin hilo del portal.
insert into public.chatwoot_portal_contactos (tenant_id, client_id, chatwoot_contact_id, chatwoot_source_id)
values (pg_temp.id('T2'), pg_temp.id('Z'), 800, 'dtd-portal:z');
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
values (pg_temp.id('hZ'), pg_temp.id('T2'), 1500);
insert into public.chatwoot_portal_salida (message_id, tenant_id, conversation_id, estado, chatwoot_message_id)
values (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'cargado', 95000);
insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id) values
  (pg_temp.id('T2'), 1500, 9, 'open', pg_temp.id('Z')),
  (pg_temp.id('T1'), 7001, 3, 'resolved', null);
insert into public.chatwoot_portal_estado (tenant_id, corte, cargado_at) values (pg_temp.id('T2'), now() - interval '1 day', now());
create function pg_temp.huella_ajena() returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(client_id::text || ':' || identificador::text || ':' || coalesce(chatwoot_contact_id::text, '-'), ',' order by client_id)
       from public.chatwoot_portal_contactos where tenant_id = pg_temp.id('T2')),
    (select string_agg(conversation_id::text || ':' || chatwoot_conversation_id::text, ',' order by conversation_id)
       from public.chatwoot_portal_hilos where tenant_id = pg_temp.id('T2')),
    (select string_agg(message_id::text || ':' || estado, ',' order by message_id)
       from public.chatwoot_portal_salida where tenant_id = pg_temp.id('T2')),
    (select string_agg(tenant_id::text || ':' || conversation_id::text || ':' || coalesce(inbox_id::text, '-'), ',' order by tenant_id, conversation_id)
       from public.chatwoot_conversations where tenant_id = pg_temp.id('T2') or (tenant_id = pg_temp.id('T1') and conversation_id = 7001)),
    (select string_agg(coalesce(corte::text, '-') || ':' || coalesce(cargado_at::text, '-'), ',')
       from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T2'))))
$$;
create temporary table huella_ajena_antes as select pg_temp.huella_ajena() as md5;

-- ── §1 · La carga, hecha con las funciones reales (reserva, líneas y vinculación) ──
-- Como función, para correrla otra vez después de deshacer (N2). El contacto que ya tiene id en Studio
-- (el conservado) lo reusa, como hace el cargador de E5 por su identificador.
create function pg_temp.cargar() returns text language plpgsql as $$
declare v jsonb[]; r record; v_cab jsonb; v_vinc jsonb;
begin
  delete from preparado;
  set local role service_role;
  perform public.chatwoot_portal_reservar_contactos(pg_temp.id('T1'));
  reset role;
  begin
    set local transaction_read_only = on;
    set local role service_role;
    select array_agg(l::jsonb order by o) into v from public.chatwoot_portal_carga_lineas(pg_temp.id('T1'), 1, 9) with ordinality as t(l, o);
    reset role;
    raise exception 'FIN_SOLO_LECTURA %', array_to_json(v)::text;
  exception when raise_exception then
    if sqlerrm not like 'FIN_SOLO_LECTURA %' then raise; end if;
    insert into preparado (linea) select e from jsonb_array_elements(substr(sqlerrm, length('FIN_SOLO_LECTURA ') + 1)::jsonb) e;
  end;
  select linea into v_cab from preparado where linea ->> 'tipo' = 'cabecera';
  select jsonb_build_array(jsonb_build_object('tipo', 'cabecera', 'version', 1, 'tenant_id', v_cab ->> 'tenant_id',
      'cuenta', 1, 'bandeja', 9, 'corte', v_cab ->> 'corte', 'contactos', (v_cab ->> 'contactos')::int,
      'conversaciones', (v_cab ->> 'conversaciones')::int, 'mensajes', (v_cab ->> 'mensajes')::int))
    || coalesce((select jsonb_agg(jsonb_build_object('tipo', 'contacto', 'cliente', p.linea ->> 'cliente', 'identificador', p.linea ->> 'identificador',
      'contacto_id', coalesce(k.chatwoot_contact_id, 500 + p.n),
      'source_id', coalesce(k.chatwoot_source_id, 'dtd-portal:' || (p.linea ->> 'identificador'))))
      from preparado p
      join public.chatwoot_portal_contactos k on k.tenant_id = pg_temp.id('T1') and k.client_id = (p.linea ->> 'cliente')::uuid
      where p.linea ->> 'tipo' = 'contacto'), '[]')
    || coalesce((select jsonb_agg(jsonb_build_object('tipo', 'conversacion', 'hilo', p.linea ->> 'hilo', 'conversacion_id', 1200 + p.n))
      from preparado p where p.linea ->> 'tipo' = 'conversacion'), '[]')
    || coalesce((select jsonb_agg(jsonb_build_object('tipo', 'mensaje', 'mensaje', p.linea ->> 'mensaje', 'mensaje_id', 90000 + p.n))
      from preparado p where p.linea ->> 'tipo' = 'mensaje'), '[]')
    into v_vinc;
  set local role service_role;
  select * into r from public.chatwoot_portal_vincular_carga(pg_temp.id('T1'), v_cab, v_vinc);
  reset role;
  return r.contactos || '/' || r.hilos || '/' || r.mensajes;
end;
$$;

do $carga$
declare v text;
begin
  v := pg_temp.cargar();
  perform pg_temp.assert_true(v = '2/2/3', 'la carga vincula 2 contactos, 2 hilos y 3 mensajes: ' || v);
  perform pg_temp.assert_true((select corte is not null from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1')), 'la carga fija el corte');
end;
$carga$;

-- Lo que el desarme deshace, antes.
create temporary table antes (identificador_a uuid, identificador_b uuid, contacto_a bigint);
insert into antes select pg_temp.identificador('A'), pg_temp.identificador('B'),
  (select chatwoot_contact_id from public.chatwoot_portal_contactos where client_id = pg_temp.id('A'));

-- Las entradas del guion: los parámetros y el archivo de E5. El archivo conserva el contacto de A.
create temporary table deshacer_param (tenant uuid, cuenta bigint, bandeja bigint, esperados_salida integer,
  esperados_hilos integer, esperados_contactos integer, esperados_espejo integer, entorno text, sistema text);
create temporary table conservados (n serial, linea text);
create function pg_temp.entradas(p_hilos integer default 2, p_bandeja bigint default 9, p_entorno text default 'copia', p_sistema text default null)
returns void language plpgsql as $$
begin
  delete from pg_temp.deshacer_param;
  insert into pg_temp.deshacer_param values (pg_temp.id('T1'), 1, p_bandeja, 3, p_hilos, 2, 2, p_entorno, p_sistema);
  delete from pg_temp.conservados;
  insert into pg_temp.conservados (linea) values
    (jsonb_build_object('tipo', 'cabecera', 'version', 1, 'tenant_id', pg_temp.id('T1'), 'cuenta', 1, 'bandeja', 9, 'contactos', 1)::text),
    (jsonb_build_object('tipo', 'contacto', 'identificador', (select identificador_a from antes), 'contacto_id', (select contacto_a from antes))::text);
end;
$$;
create function pg_temp.deshacer() returns text language plpgsql as $$
declare v text;
begin
  select string_agg(l, ' | ') into v from pg_temp.deshacer_vinculos() as t(l);
  return v;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end;
$$;
create function pg_temp.intacto() returns boolean language sql as $$
  select (select count(*) from public.chatwoot_portal_hilos where tenant_id = pg_temp.id('T1')) = 2
     and (select count(*) from public.chatwoot_portal_salida where tenant_id = pg_temp.id('T1') and estado = 'cargado') = 3
     and (select count(*) from public.chatwoot_portal_contactos where tenant_id = pg_temp.id('T1') and chatwoot_contact_id is not null) = 2
     and (select corte is not null from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1'))
$$;

-- ── §2 · Las guardas: abortan sin escribir nada ──
do $guardas$
declare v text;
begin
  perform pg_temp.assert_true(to_regprocedure('pg_temp.deshacer_vinculos()') is not null, 'existe deshacer_vinculos');

  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%faltan los parámetros%', 'sin parámetros se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas(p_entorno => 'otro');
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%copia o produccion%', 'con un entorno que no es copia ni produccion se niega: ' || coalesce(v, 'null'));
  perform pg_temp.entradas(p_entorno => 'produccion', p_sistema => (select s.system_identifier::text from pg_control_system() s));
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no coincide con la marca%', 'produccion en una base con la marca copia se niega: ' || coalesce(v, 'null'));
  perform set_config('dtd.entorno', '', true);
  perform pg_temp.entradas(p_entorno => 'produccion', p_sistema => '1');
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%identificador del sistema%', 'produccion con otro system_identifier se niega: ' || coalesce(v, 'null'));
  perform pg_temp.entradas(p_entorno => 'copia');
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no coincide con la marca%', 'copia en una base sin marca se niega: ' || coalesce(v, 'null'));
  perform set_config('dtd.entorno', 'copia', true);
  -- B2: la marca copia solo en la sesión (un PGOPTIONS en producción) no alcanza: tiene que estar guardada.
  execute pg_catalog.format('alter database %I reset dtd.entorno', pg_catalog.current_database());
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%solo en la sesión%', 'copia con la marca solo en la sesión se niega: ' || coalesce(v, 'null'));
  execute pg_catalog.format('alter database %I set dtd.entorno = %L', pg_catalog.current_database(), 'copia');

  perform pg_temp.entradas();
  perform pg_temp.flag(true);
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '55000:%está encendido%', 'con el flag encendido se niega: ' || coalesce(v, 'null'));
  perform pg_temp.flag(false);

  insert into public.entity_audit_log (tenant_id, entity_type, event_type, after_data)
  values (pg_temp.id('T1'), 'feature_flag', 'feature_flag_changed', '{"key":"chatwoot_portal","enabled":true}');
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '55000:%se encendió alguna vez%', 'si el flag se encendió alguna vez se niega: ' || coalesce(v, 'null'));
  delete from public.entity_audit_log where entity_type = 'feature_flag';

  update public.chatwoot_portal_salida set estado = 'pendiente', proximo_at = now() where message_id = pg_temp.id('a1');
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '55000:%la cola corrió%', 'con una salida que no está cargado se niega: ' || coalesce(v, 'null'));
  update public.chatwoot_portal_salida set estado = 'cargado', proximo_at = null where message_id = pg_temp.id('a1');

  create function pg_temp.disparador() returns trigger language plpgsql as $t$ begin return new; end; $t$;
  create trigger auditoria_falsa after delete on public.chatwoot_portal_hilos for each row execute function pg_temp.disparador();
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '55000:%trigger%', 'con un trigger en las tablas que toca se niega: ' || coalesce(v, 'null'));
  drop trigger auditoria_falsa on public.chatwoot_portal_hilos;

  perform pg_temp.entradas(p_hilos => 3);
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no son los esperados%', 'con conteos distintos de los esperados se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas(p_bandeja => 8);
  update pg_temp.conservados set linea = jsonb_set(linea::jsonb, '{bandeja}', '8')::text where linea::jsonb ->> 'tipo' = 'cabecera';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no es de la bandeja%', 'con un espejo de otra bandeja se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas();
  delete from pg_temp.conservados where linea::jsonb ->> 'tipo' = 'cabecera';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%una sola cabecera%', 'sin la cabecera de los conservados se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas();
  update pg_temp.conservados set linea = jsonb_set(linea::jsonb, '{tenant_id}', to_jsonb(pg_temp.id('T2')::text))::text where linea::jsonb ->> 'tipo' = 'cabecera';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no es la del tenant%', 'con la cabecera de otro tenant se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas();
  update pg_temp.conservados set linea = jsonb_set(linea::jsonb, '{contactos}', '2')::text where linea::jsonb ->> 'tipo' = 'cabecera';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no cuadra%', 'con el conteo de los conservados que no cuadra se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas();
  update pg_temp.conservados set linea = jsonb_set(linea::jsonb, '{identificador}', to_jsonb(gen_random_uuid()::text))::text where linea::jsonb ->> 'tipo' = 'contacto';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no es el que Studio tiene%', 'con un identificador no reservado se niega: ' || coalesce(v, 'null'));

  perform pg_temp.entradas();
  update pg_temp.conservados set linea = jsonb_set(linea::jsonb, '{contacto_id}', '999999')::text where linea::jsonb ->> 'tipo' = 'contacto';
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v like '22023:%no es el que Studio tiene%', 'con un contacto_id que no es el guardado se niega: ' || coalesce(v, 'null'));

  perform pg_temp.assert_true(pg_temp.intacto(), 'ninguna guarda escribió nada');
  perform pg_temp.assert_true(pg_temp.huella_ajena() = (select md5 from huella_ajena_antes), 'ninguna guarda tocó T2 ni el espejo de otra bandeja');
end;
$guardas$;

-- ── §3 · El camino feliz: deshace todo, conserva el contacto de A ──
do $deshacer$
declare v text;
begin
  perform pg_temp.entradas();
  v := pg_temp.deshacer();
  perform pg_temp.assert_true(v = 'HECHO salida=3 hilos=2 espejo=2 contactos_vaciados=1 contactos_conservados=1 corte=nulo | HECHO auditoria_antes=1 auditoria_despues=1',
    'deshace e informa solo conteos: ' || coalesce(v, 'null'));
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_portal_hilos where tenant_id = pg_temp.id('T1')), 'no quedan hilos vinculados');
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_portal_salida where tenant_id = pg_temp.id('T1')), 'no quedan salidas');
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_conversations where tenant_id = pg_temp.id('T1') and conversation_id between 1201 and 1299),
    'no queda el espejo de los hilos vinculados');
  perform pg_temp.assert_true((select corte is null and cargado_at is null from public.chatwoot_portal_estado where tenant_id = pg_temp.id('T1')),
    'el corte y cargado_at quedan en nulo');
  perform pg_temp.assert_true((select chatwoot_contact_id = (select contacto_a from antes) and chatwoot_source_id is not null
    from public.chatwoot_portal_contactos where client_id = pg_temp.id('A')), 'el contacto conservado (A) guarda sus dos ids');
  perform pg_temp.assert_true((select chatwoot_contact_id is null and chatwoot_source_id is null and identificador = (select identificador_b from antes)
    from public.chatwoot_portal_contactos where client_id = pg_temp.id('B')), 'el contacto de B queda con su identificador y los dos ids en nulo');
  perform pg_temp.assert_true(
    (select md5(string_agg(id::text || body || sent_at::text, ',' order by id)) from public.conversation_messages) = (select md5_mensajes from huella_antes)
    and (select md5(string_agg(id::text || status::text, ',' order by id)) from public.conversations) = (select md5_hilos from huella_antes),
    'no toca conversations ni conversation_messages');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log where tenant_id = pg_temp.id('T1')) = (select auditoria from huella_antes),
    'no deja filas en la auditoría');
  perform pg_temp.assert_true(pg_temp.huella_ajena() = (select md5 from huella_ajena_antes),
    'no toca otro tenant (T2, con su carga vinculada) ni el espejo de otra bandeja de T1');
end;
$deshacer$;

-- ── §4 · La cola después de deshacer: con el corte en nulo no manda nada ──
do $cola$
declare v integer;
begin
  perform pg_temp.flag(true);
  set local role service_role;
  select count(*) into v from public.chatwoot_portal_tomar(pg_temp.id('T1'), 20, null);
  reset role;
  perform pg_temp.assert_true(v = 0, 'después de deshacer, la cola no manda nada aunque se encienda el flag: ' || v);
  perform pg_temp.flag(false);
end;
$cola$;

-- ── §5 · Una carga nueva reusa los mismos identificadores ──
do $otra$
declare v integer;
begin
  set local role service_role;
  v := public.chatwoot_portal_reservar_contactos(pg_temp.id('T1'));
  reset role;
  perform pg_temp.assert_true(v = 0 and pg_temp.identificador('A') = (select identificador_a from antes)
    and pg_temp.identificador('B') = (select identificador_b from antes), 'una carga nueva reusa los identificadores: ' || v);
  -- N2: la segunda carga entera vincula otra vez. El contacto conservado (A) mantiene su id.
  perform pg_temp.assert_true(pg_temp.cargar() = '2/2/3', 'una segunda carga completa vincula otra vez 2/2/3');
  perform pg_temp.assert_true((select chatwoot_contact_id = (select contacto_a from antes) from public.chatwoot_portal_contactos where client_id = pg_temp.id('A')),
    'después de la segunda carga, el contacto conservado mantiene su id');
  perform pg_temp.assert_true(pg_temp.huella_ajena() = (select md5 from huella_ajena_antes), 'la segunda carga tampoco toca T2');
end;
$otra$;

select 'TEST deshacer GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
