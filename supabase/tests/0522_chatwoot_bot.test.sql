\set ON_ERROR_STOP on

-- SDD-0618 (E7, 7.6 b) · contrato de 0522: la cola durable de dtd-bot.
--
-- Monta lo mínimo que 0522 da por sentado (el mismo armado que el contrato de 0519) y aplica
-- de verdad 0006, 0106, 0337, 0503, 0504 y 0519. Después aplica la 0522 REAL y llama sus
-- funciones como el servidor de Studio (service_role) y como un admin (authenticated).
--
-- `now()` no avanza dentro de la transacción: el paso del tiempo se simula con la hora de
-- llegada y moviendo `lease_hasta`, `limite_at`, `cerrado_at` y `created_at`.
-- Lo que no prueba: dos sesiones a la vez (el `skip locked` y el advisory lock por
-- conversación). Con una sesión se prueba que un turno tomado no se vuelve a repartir.
--
-- CONTROL ROJO: sin 0522 cae en la primera aserción (la función no existe).
-- Termina siempre en ROLLBACK. Solo ids sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_bot_turnos') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0522 requiere una base PostgreSQL desechable vacía';
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
  select md5('0522-sintetico-' || label)::uuid
$$;

insert into public.tenants values (pg_temp.id('T1'), 'dtd'), (pg_temp.id('T2'), 'otro');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql
\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql
\ir ../migrations/0519_chatwoot_portal.sql

-- Un hilo del portal en T1, que en Chatwoot es la conversación 500.
insert into public.clients (id, tenant_id, markbox, name) values (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A');
insert into public.conversations (id, tenant_id, client_id, channel) values (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal');
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id) values (pg_temp.id('hA'), pg_temp.id('T1'), 500);

-- Usuarios: admin y operador de T1, admin de T2.
insert into public.user_tenants values
  (pg_temp.id('uAdmin1'), pg_temp.id('T1'), 'admin', null),
  (pg_temp.id('uOper1'), pg_temp.id('T1'), 'operator', null),
  (pg_temp.id('uAdmin2'), pg_temp.id('T2'), 'admin', null);

\ir ../migrations/0522_chatwoot_bot.sql

create temporary sequence assertion_count;
-- Algunas aserciones corren con el rol del servidor.
grant usage on sequence assertion_count to service_role;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0522: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
-- Corre una sentencia y exige que falle con el código dado.
create function pg_temp.assert_falla(p_sql text, p_codigo text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_codigo then
      perform nextval('pg_temp.assertion_count');
      return;
    end if;
    raise exception 'TEST 0522: % (falló con % y no con %: %)', p_label, sqlstate, p_codigo, sqlerrm;
  end;
  raise exception 'TEST 0522: % (no falló)', p_label;
end;
$$;

-- Llamadas como el servidor de Studio.
create temporary table encolado (turno_id bigint, nuevo boolean, motivo text);
grant all on encolado to service_role;
create function pg_temp.encolar(p_conv bigint, p_inbox bigint, p_msg bigint, p_hace interval,
  p_tenant text default 'T1') returns text language plpgsql as $$
declare v encolado%rowtype;
begin
  truncate encolado;
  set local role service_role;
  insert into encolado select * from public.chatwoot_bot_encolar(pg_temp.id(p_tenant), p_conv, p_inbox, p_msg, now() - p_hace);
  reset role;
  select * into v from encolado;
  return coalesce(v.motivo, case when v.nuevo then 'nuevo' else 'extendido' end);
end;
$$;
create function pg_temp.turno(p_conv bigint, p_tenant text default 'T1') returns public.chatwoot_bot_turnos language sql as $$
  select * from public.chatwoot_bot_turnos t
  where t.tenant_id = pg_temp.id(p_tenant) and t.conversation_id = p_conv
  order by t.id desc limit 1;
$$;
create temporary table tomados (id bigint, conversation_id bigint);
grant all on tomados to service_role;
create function pg_temp.tomar(p_trabajador text, p_limite integer default 5) returns integer language plpgsql as $$
declare v integer;
begin
  truncate tomados;
  set local role service_role;
  insert into tomados select t.id, t.conversation_id from public.chatwoot_bot_tomar(p_trabajador, p_limite, 60) t;
  reset role;
  select count(*) into v from tomados;
  return v;
end;
$$;
create function pg_temp.cerrar(p_turno bigint, p_trabajador text, p_estado text, p_motivo text default null)
returns boolean language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  v := public.chatwoot_bot_cerrar(p_turno, p_trabajador, p_estado, p_motivo);
  reset role;
  return v;
end;
$$;
create function pg_temp.como(p_user text, p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.id(p_user)::text, true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- ─── Encolar: qué entra y qué no ─────────────────────────────────────────────
select pg_temp.assert_true(pg_temp.encolar(12, 3, 100, interval '1 second') = 'sin_bandeja', 'sin fila de bandeja no encola');
insert into public.chatwoot_bot_bandejas (tenant_id, inbox_id) values (pg_temp.id('T1'), 3);
select pg_temp.assert_true((select modo from public.chatwoot_bot_bandejas where inbox_id = 3) = 'apagado', 'la bandeja nace apagada');
select pg_temp.assert_true(pg_temp.encolar(12, 3, 100, interval '1 second') = 'apagado', 'apagado no encola');
select pg_temp.assert_true(not exists (select 1 from public.chatwoot_bot_turnos), 'apagado no deja turno');

update public.chatwoot_bot_bandejas set modo = 'sugerir' where inbox_id = 3;
select pg_temp.assert_true(pg_temp.encolar(500, 3, 100, interval '1 second') = 'portal', 'una conversación del portal no encola');
select pg_temp.assert_true(pg_temp.encolar(500, 3, 100, interval '1 second', 'T2') = 'sin_bandeja', 'el hilo del portal es de su tenant');

select pg_temp.assert_true(pg_temp.encolar(12, 3, 100, interval '1 second') = 'nuevo', 'un entrante abre un turno');
select pg_temp.assert_true(
  (pg_temp.turno(12)).listo_desde = now() - interval '1 second' + interval '8 seconds'
  and (pg_temp.turno(12)).limite_at = now() - interval '1 second' + interval '24 seconds'
  and (pg_temp.turno(12)).estado = 'pendiente',
  'espera 8 s y vence a los 24 s');
select pg_temp.assert_true(pg_temp.encolar(12, 3, 100, interval '1 second') = 'duplicado', 'el mismo mensaje no encola dos veces');
select pg_temp.assert_true(pg_temp.encolar(12, 3, 99, interval '1 second') = 'duplicado', 'un mensaje viejo no encola');

select pg_temp.assert_true(pg_temp.encolar(12, 3, 101, interval '-4 seconds') = 'extendido', 'otro mensaje extiende el turno');
select pg_temp.assert_true((pg_temp.turno(12)).listo_desde = now() + interval '4 seconds' + interval '8 seconds', 'la espera corre 8 s desde el último');
select pg_temp.assert_true(pg_temp.encolar(12, 3, 102, interval '-20 seconds') = 'extendido', 'otro más, cerca del límite');
select pg_temp.assert_true((pg_temp.turno(12)).listo_desde = (pg_temp.turno(12)).limite_at, 'la espera no pasa del límite');
select pg_temp.assert_true((select count(*) from public.chatwoot_bot_turnos where conversation_id = 12) = 1, 'un solo turno abierto por conversación');
select pg_temp.assert_falla(
  format('insert into public.chatwoot_bot_turnos (tenant_id, conversation_id, inbox_id, primer_mensaje_at, listo_desde, limite_at, ultimo_mensaje_id) values (%L, 12, 3, now(), now(), now(), 999)', pg_temp.id('T1')),
  '23505', 'el índice impide un segundo turno abierto');

select pg_temp.assert_falla(
  format('select public.chatwoot_bot_encolar(%L, 12, 3, 103, now(), 500, 24000)', pg_temp.id('T1')),
  '22023', 'inactividad fuera de rango');

-- ─── Bandejas: excluidas y Contesta solo ─────────────────────────────────────
insert into public.chatwoot_bot_bandejas (tenant_id, inbox_id, modo) values (pg_temp.id('T1'), 9, 'sugerir');
insert into public.chatwoot_bot_bandejas_excluidas (tenant_id, inbox_id, motivo) values (pg_temp.id('T1'), 9, 'archivo_kommo');
select pg_temp.assert_true((select modo from public.chatwoot_bot_bandejas where inbox_id = 9) = 'apagado', 'excluir apaga la bandeja');
select pg_temp.assert_true(pg_temp.encolar(40, 9, 1, interval '1 second') = 'excluida', 'una bandeja excluida no encola');
select pg_temp.assert_falla(
  'update public.chatwoot_bot_bandejas set modo = ''sugerir'' where inbox_id = 9',
  '23514', 'una bandeja excluida no se enciende');

select pg_temp.assert_falla(
  'update public.chatwoot_bot_bandejas set modo = ''contesta_solo'' where inbox_id = 3',
  '23514', 'contesta_solo sin excepción IA-01 se rechaza');
insert into public.chatwoot_bot_excepciones (tenant_id, inbox_ids, aprobada_por) values (pg_temp.id('T1'), array[7]::bigint[], pg_temp.id('uAdmin1'));
select pg_temp.assert_falla(
  'update public.chatwoot_bot_bandejas set modo = ''contesta_solo'' where inbox_id = 3',
  '23514', 'una excepción de otra bandeja no alcanza');
insert into public.chatwoot_bot_excepciones (tenant_id, inbox_ids, aprobada_por) values (pg_temp.id('T2'), array[3]::bigint[], pg_temp.id('uAdmin2'));
select pg_temp.assert_falla(
  'update public.chatwoot_bot_bandejas set modo = ''contesta_solo'' where inbox_id = 3',
  '23514', 'una excepción de otro tenant no alcanza');
insert into public.chatwoot_bot_excepciones (tenant_id, inbox_ids, aprobada_por) values (pg_temp.id('T1'), array[3]::bigint[], pg_temp.id('uAdmin1'));
update public.chatwoot_bot_bandejas set modo = 'contesta_solo' where inbox_id = 3;
select pg_temp.assert_true((select modo from public.chatwoot_bot_bandejas where inbox_id = 3) = 'contesta_solo', 'con la excepción, contesta_solo entra');
update public.chatwoot_bot_excepciones set revocada_at = now() where tenant_id = pg_temp.id('T1') and 3 = any (inbox_ids);
select pg_temp.assert_true((select modo from public.chatwoot_bot_bandejas where inbox_id = 3) = 'sugerir', 'revocar baja a sugerir');
select pg_temp.assert_falla(
  'update public.chatwoot_bot_bandejas set modo = ''contesta_solo'' where inbox_id = 3',
  '23514', 'una excepción revocada no alcanza');
insert into public.chatwoot_bot_excepciones (tenant_id, inbox_ids, aprobada_por) values (pg_temp.id('T1'), array[3]::bigint[], pg_temp.id('uAdmin1'));
update public.chatwoot_bot_bandejas set modo = 'contesta_solo' where inbox_id = 3;
delete from public.chatwoot_bot_excepciones where tenant_id = pg_temp.id('T1') and revocada_at is null and 3 = any (inbox_ids);
select pg_temp.assert_true((select modo from public.chatwoot_bot_bandejas where inbox_id = 3) = 'sugerir', 'borrar la excepción también baja a sugerir');

-- ─── Tomar, cerrar y soltar ──────────────────────────────────────────────────
select pg_temp.assert_true(pg_temp.encolar(13, 3, 200, interval '30 seconds') = 'nuevo', 'un turno ya listo');
select pg_temp.assert_true(pg_temp.tomar('w1') = 1, 'se reparte solo lo listo');
select pg_temp.assert_true((select conversation_id from tomados) = 13, 'el listo es el de la conversación 13');
select pg_temp.assert_true(
  (pg_temp.turno(13)).estado = 'tomado' and (pg_temp.turno(13)).trabajador = 'w1'
  and (pg_temp.turno(13)).lease_hasta = now() + interval '60 seconds' and (pg_temp.turno(13)).intentos = 1,
  'tomado con lease e intento');
select pg_temp.assert_true(pg_temp.tomar('w2') = 0, 'un turno tomado no se vuelve a repartir');

select pg_temp.assert_true(not pg_temp.cerrar((pg_temp.turno(13)).id, 'w2', 'sugerido'), 'otro trabajador no cierra');
select pg_temp.assert_falla(
  format('select public.chatwoot_bot_cerrar(%s, ''w1'', ''humano'', null)', (pg_temp.turno(13)).id),
  '23514', 'humano exige motivo');
select pg_temp.assert_falla(
  format('select public.chatwoot_bot_cerrar(%s, ''w1'', ''tomado'', null)', (pg_temp.turno(13)).id),
  '22023', 'cerrar no acepta tomado');
select pg_temp.assert_true(pg_temp.cerrar((pg_temp.turno(13)).id, 'w1', 'sugerido'), 'el dueño del lease cierra');
select pg_temp.assert_true((pg_temp.turno(13)).estado = 'sugerido' and (pg_temp.turno(13)).cerrado_at is not null
  and (pg_temp.turno(13)).lease_hasta is null, 'cerrado como sugerido');
select pg_temp.assert_true(not pg_temp.cerrar((pg_temp.turno(13)).id, 'w1', 'enviado'), 'un turno cerrado no se vuelve a cerrar');

select pg_temp.assert_true(pg_temp.encolar(14, 3, 300, interval '30 seconds') = 'nuevo', 'otro turno listo');
select pg_temp.assert_true(pg_temp.tomar('w1') = 1, 'tomado');
select pg_temp.assert_true(pg_temp.cerrar((pg_temp.turno(14)).id, 'w1', 'pendiente'), 'soltar');
select pg_temp.assert_true((pg_temp.turno(14)).estado = 'pendiente' and (pg_temp.turno(14)).trabajador is null
  and (pg_temp.turno(14)).cerrado_at is null, 'soltado vuelve a pendiente');

-- Lease vencido: el dueño ya no cierra y el watchdog lo pasa a humano.
select pg_temp.assert_true(pg_temp.tomar('w1') = 1, 'se vuelve a tomar el soltado');
select pg_temp.assert_true((pg_temp.turno(14)).intentos = 2, 'cuenta el segundo intento');
update public.chatwoot_bot_turnos set lease_hasta = now() - interval '1 second' where conversation_id = 14;
select pg_temp.assert_true(not pg_temp.cerrar((pg_temp.turno(14)).id, 'w1', 'enviado'), 'con el lease vencido no se cierra');

-- Pendiente sin trabajador: pasó su límite hace más de la gracia.
select pg_temp.assert_true(pg_temp.encolar(15, 3, 400, interval '200 seconds') = 'nuevo', 'un turno que nadie tomó');
create temporary table vigilado (lease_vencido integer, sin_trabajador integer);
grant all on vigilado to service_role;
set local role service_role;
insert into vigilado select * from public.chatwoot_bot_vigilar(60);
reset role;
select pg_temp.assert_true((select lease_vencido from vigilado) = 1 and (select sin_trabajador from vigilado) >= 1, 'el watchdog cuenta lo vencido');
select pg_temp.assert_true((pg_temp.turno(14)).estado = 'humano' and (pg_temp.turno(14)).motivo = 'lease_vencido', 'lease vencido → humano');
select pg_temp.assert_true((pg_temp.turno(15)).estado = 'humano' and (pg_temp.turno(15)).motivo = 'sin_trabajador', 'sin trabajador → humano');
select pg_temp.assert_true((pg_temp.turno(12)).estado = 'pendiente', 'lo que está en plazo no se toca');

-- ─── Invalidar ───────────────────────────────────────────────────────────────
set local role service_role;
select pg_temp.assert_true(public.chatwoot_bot_invalidar(pg_temp.id('T2'), 12, 'resuelta') = 0, 'invalidar respeta el tenant');
select pg_temp.assert_true(public.chatwoot_bot_invalidar(pg_temp.id('T1'), 12, 'escribio_una_persona') = 1, 'invalidar cancela el abierto');
select pg_temp.assert_true(public.chatwoot_bot_invalidar(pg_temp.id('T1'), 12, 'escribio_una_persona') = 0, 'sin abierto no hay nada que cancelar');
reset role;
select pg_temp.assert_true((pg_temp.turno(12)).estado = 'cancelado' and (pg_temp.turno(12)).motivo = 'escribio_una_persona', 'cancelado con su motivo');
select pg_temp.assert_falla(format('select public.chatwoot_bot_invalidar(%L, 12, ''Con Espacios'')', pg_temp.id('T1')), '22023', 'motivo inválido');
select pg_temp.assert_true(pg_temp.encolar(12, 3, 103, interval '1 second') = 'nuevo', 'un mensaje posterior abre un turno nuevo');

-- Un turno tomado que se invalida: su trabajador ya no lo cierra.
select pg_temp.assert_true(pg_temp.encolar(16, 3, 500, interval '30 seconds') = 'nuevo', 'turno para invalidar tomado');
select pg_temp.assert_true(pg_temp.tomar('w3', 1) = 1, 'tomado por w3');
set local role service_role;
select pg_temp.assert_true(public.chatwoot_bot_invalidar(pg_temp.id('T1'), 16, 'resuelta') = 1, 'se invalida tomado');
reset role;
select pg_temp.assert_true(not pg_temp.cerrar((pg_temp.turno(16)).id, 'w3', 'enviado'), 'el trabajador ya no envía');

-- ─── Costo, latido y purga ───────────────────────────────────────────────────
set local role service_role;
select public.chatwoot_bot_anotar_llamada(pg_temp.id('T1'), (pg_temp.turno(13)).id, 'doble', 'doble-1', 100, 20, 0.5, false, 'ok', 300);
select public.chatwoot_bot_anotar_llamada(pg_temp.id('T1'), null, 'doble', 'doble-1', 100, 500, 0.25, true, 'timeout', 120000);
select public.chatwoot_bot_anotar_llamada(pg_temp.id('T2'), null, 'doble', 'doble-1', 1, 1, 9, false, 'ok', 1);
reset role;
insert into public.chatwoot_bot_llamadas (tenant_id, proveedor, modelo, tokens_entrada, tokens_salida, costo_usd, costo_estimado, resultado, duracion_ms, created_at)
values (pg_temp.id('T1'), 'doble', 'doble-1', 1, 1, 7, false, 'ok', 1, now() - interval '40 days');
set local role service_role;
select pg_temp.assert_true(public.chatwoot_bot_gasto_mes(pg_temp.id('T1')) = 0.75, 'gasto del mes: solo este mes y este tenant');
select pg_temp.assert_true(public.chatwoot_bot_gasto_mes(pg_temp.id('T2')) = 9, 'gasto de otro tenant aparte');
select public.chatwoot_bot_latir('w1');
select public.chatwoot_bot_latir('w1');
reset role;
select pg_temp.assert_true((select count(*) from public.chatwoot_bot_latidos) = 1, 'el latido es uno por trabajador');
select pg_temp.assert_falla('select public.chatwoot_bot_latir(''con espacios'')', '22023', 'trabajador inválido');

update public.chatwoot_bot_turnos set cerrado_at = now() - interval '91 days' where conversation_id = 13;
update public.chatwoot_bot_llamadas set created_at = now() - interval '91 days' where costo_usd = 7;
set local role service_role;
select pg_temp.assert_true(public.chatwoot_bot_purgar() = 2, 'purga un turno y una llamada vencidos');
reset role;
select pg_temp.assert_true(not exists (select 1 from public.chatwoot_bot_turnos where conversation_id = 13), 'el turno vencido se fue');
select pg_temp.assert_true((select count(*) from public.chatwoot_bot_llamadas where tenant_id = pg_temp.id('T1')) = 2, 'las llamadas del mes quedan (la del turno purgado, sin turno)');

-- ─── Permisos ────────────────────────────────────────────────────────────────
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_tomar(text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_cerrar(bigint, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_invalidar(uuid, bigint, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_vigilar(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_gasto_mes(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_bot_purgar()', 'execute')
  and has_function_privilege('service_role', 'public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer)', 'execute'),
  'las RPC son solo de service_role');
select pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.chatwoot_bot_turnos', 'select')
  and not has_table_privilege('authenticated', 'public.chatwoot_bot_turnos', 'insert')
  and not has_table_privilege('authenticated', 'public.chatwoot_bot_bandejas', 'update')
  and not has_table_privilege('authenticated', 'public.chatwoot_bot_excepciones', 'insert')
  and not has_table_privilege('authenticated', 'public.chatwoot_bot_latidos', 'select')
  and not has_table_privilege('anon', 'public.chatwoot_bot_turnos', 'select'),
  'authenticated solo lee; anon nada');
select pg_temp.assert_true(
  pg_temp.como('uAdmin1', 'select count(*) from public.chatwoot_bot_turnos') = (select count(*) from public.chatwoot_bot_turnos where tenant_id = pg_temp.id('T1'))
  and pg_temp.como('uAdmin1', 'select count(*) from public.chatwoot_bot_turnos') > 0,
  'el admin ve los turnos de su tenant');
select pg_temp.assert_true(pg_temp.como('uOper1', 'select count(*) from public.chatwoot_bot_turnos') = 0, 'un operador no ve los turnos');
select pg_temp.assert_true(pg_temp.como('uAdmin2', 'select count(*) from public.chatwoot_bot_llamadas') = 1, 'el admin de T2 ve solo lo de T2');
select pg_temp.assert_true(
  (select count(*) from pg_catalog.pg_class c where c.relname like 'chatwoot_bot_%' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  'RLS en todas las tablas del bot');
select pg_temp.assert_true(
  (select count(*) from information_schema.columns
   where table_name like 'chatwoot_bot_%' and column_name ~ '(texto|content|body|nombre|name|phone|telefono|email|prompt|respuesta)') = 0,
  'ninguna columna guarda texto ni datos de la persona');

select 'TEST 0522 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
