\set ON_ERROR_STOP on
-- Contrato de concurrencia de la 0522 (SDD-0618, 7.6 b; revisión del DG de la #459): encender
-- «contesta_solo» mientras otra transacción revoca, borra o achica la excepción IA-01. Base
-- propia y desechable dentro del contenedor del runner: nunca consulta ni modifica una base
-- alojada.
--
-- POR QUÉ: `chatwoot_bot_bandejas_guardar` exige una excepción vigente que nombre la bandeja.
-- Con un `exists` que no bloquea, si T1 enciende mientras T2 (sin confirmar) revoca la
-- excepción, las dos confirman y la bandeja queda en contesta_solo sin IA-01. La guarda lee
-- la excepción con `for share`:
--   · si T2 revoca primero, el `for share` de T1 espera, vuelve a evaluar el where sobre la
--     fila nueva, no la encuentra y T1 falla;
--   · si T1 enciende primero, el update o el delete de T2 esperan a T1, y después el trigger
--     de T2 recalcula y baja la bandeja a sugerir.
-- El contrato 0522_chatwoot_bot.test.sql corre en una sola sesión (PGlite) y no alcanza
-- ninguno de los dos órdenes. Este archivo los mide con dos sesiones.
--
-- CÓMO: igual que 0519_chatwoot_portal_carrera.test.sql. Corre en la base `postgres` del
-- runner y, con dblink, abre tres sesiones contra una base propia (dtd_carrera_0522): `s`
-- prepara y observa, `a` hace su cambio y deja la transacción abierta, y `b` hace el suyo
-- en asíncrono. Las dos escriben como service_role, que es como escribe el servidor de
-- Studio. Las triggers son security definer: no dependen de la identidad de la sesión.
--
-- Escenarios (bandeja 3 en sugerir y una excepción de T1 con [3, 7]):
--   1. `a` revoca la excepción; `b` enciende contesta_solo. Real: `b` espera y falla; la
--      bandeja queda en sugerir. Control (sin `for share`): `b` no espera y confirma; la
--      bandeja queda en contesta_solo sin excepción vigente.
--   2. `a` borra la excepción; `b` enciende. Igual que 1.
--   3. `a` saca la bandeja 3 de inbox_ids; `b` enciende. Igual que 1.
--   4. Al revés: `a` enciende y deja abierto; `b` revoca. Real: `b` espera a `a` y su
--      trigger baja la bandeja a sugerir. Sin control: aun sin `for share`, el trigger de
--      `b` espera el bloqueo de fila que `a` tiene sobre la bandeja, así que este orden no
--      tiene un defecto que mostrar; se mide solo el resultado.
--
-- CONTROL en la misma corrida: los escenarios 1 a 3 corren primero con la guarda reemplazada
-- por la variante sin `for share` (sacada con pg_get_functiondef y restituida después) y
-- tienen que mostrar el defecto. Un reemplazo que no encuentra su texto FALLA.
--
-- FIXTURE: el del contrato 0522, leído de su archivo entre sus `\ir`, con las migraciones
-- reales que el contrato incluye y la 0522 entera encima.
--
-- SIN HUELLA: la base propia y los roles anon, authenticated y service_role se borran también
-- cuando algo falla. dblink se crea dentro de la transacción del archivo y se va con el
-- rollback. Requiere dblink (contrib de postgres:17) y el montaje /sb del runner.

begin;

do $guard$
begin
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0522 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0522 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0522_%s',
    split_part(current_setting('unix_socket_directories'), ',', 1),
    current_setting('port'), p_base, current_user, p_sesion)
$$;

-- Nunca lanza: devuelve lo que no pudo limpiar. Idempotente.
create function pg_temp.limpiar() returns text language plpgsql as $$
declare
  v_conn text;
  v_restos text := '';
begin
  foreach v_conn in array coalesce(dblink_get_connections(), '{}') loop
    if v_conn like 'c0522\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0522 with (force)');
  exception when others then
    v_restos := v_restos || format(' base: %s;', sqlerrm);
  end;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop role if exists anon, authenticated, service_role');
  exception when others then
    v_restos := v_restos || format(' roles: %s;', sqlerrm);
  end;
  return nullif(v_restos, '');
end;
$$;

-- Un fragmento del contrato entre dos marcas, para mandarlo por dblink. SQL puro.
create function pg_temp.fragmento(p_desde text, p_hasta text) returns text language plpgsql as $$
declare
  v_txt text := replace(pg_read_file('/sb/tests/0522_chatwoot_bot.test.sql'), E'\r\n', E'\n');
  v_ini integer := position(p_desde in v_txt);
  v_fin integer;
begin
  if v_ini = 0 then
    raise exception 'TEST 0522 carrera: no encuentro «%» en el contrato', p_desde;
  end if;
  v_txt := substr(v_txt, v_ini + length(p_desde));
  v_fin := position(p_hasta in v_txt);
  if v_fin = 0 then
    raise exception 'TEST 0522 carrera: no encuentro «%» en el contrato después de «%»', p_hasta, p_desde;
  end if;
  v_txt := left(v_txt, v_fin - 1);
  if v_txt ~ '(^|\n)\s*\\' then
    raise exception 'TEST 0522 carrera: el fragmento del contrato trae un meta-comando de psql';
  end if;
  return v_txt;
end;
$$;

create function pg_temp.migracion(p_nombre text) returns text language sql as $$
  select pg_read_file('/sb/migrations/' || p_nombre || '.sql')
$$;

create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0522-sintetico-' || p_label)::uuid
$$;

-- El fixture del contrato con sus migraciones y la 0522, en UNA transacción explícita.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.fragmento(E'\nbegin;\n', E'\n\\ir ../migrations/0006_clients.sql'),
    pg_temp.migracion('0006_clients'),
    pg_temp.fragmento(E'\\ir ../migrations/0006_clients.sql\n', E'\n\\ir ../migrations/0106_conversaciones.sql'),
    pg_temp.migracion('0106_conversaciones'),
    pg_temp.fragmento(E'\\ir ../migrations/0106_conversaciones.sql\n', E'\n\\ir ../migrations/0337_feature_flags_seed_and_trigger.sql'),
    pg_temp.migracion('0337_feature_flags_seed_and_trigger'),
    pg_temp.migracion('0503_chatwoot_bandeja'),
    pg_temp.migracion('0504_chatwoot_eventos'),
    pg_temp.migracion('0519_chatwoot_portal'),
    pg_temp.fragmento(E'\\ir ../migrations/0519_chatwoot_portal.sql\n', E'\n\\ir ../migrations/0522_chatwoot_bot.sql'),
    pg_temp.migracion('0522_chatwoot_bot'),
    'commit;');
end;
$$;

create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0522_s', p_sql) as t(r text)
$$;

-- Punto de partida de cada escenario: bandeja 3 en sugerir y una sola excepción de T1 con [3, 7].
create function pg_temp.partida() returns void language plpgsql as $$
begin
  perform dblink_exec('c0522_s', format($q$
    delete from public.chatwoot_bot_excepciones where tenant_id = %1$L;
    insert into public.chatwoot_bot_bandejas (tenant_id, inbox_id, modo) values (%1$L, 3, 'sugerir')
      on conflict (tenant_id, inbox_id) do update set modo = 'sugerir';
    insert into public.chatwoot_bot_excepciones (tenant_id, inbox_ids, aprobada_por)
      values (%1$L, array[3, 7]::bigint[], %2$L);$q$, pg_temp.id('T1'), pg_temp.id('uAdmin1')));
end;
$$;

-- Las sentencias de cada lado, como consultas que devuelven texto.
create function pg_temp.encender() returns text language sql as $$
  select format($q$with u as (update public.chatwoot_bot_bandejas set modo = 'contesta_solo'
      where tenant_id = %L and inbox_id = 3 returning modo) select coalesce(string_agg(modo, ','), '') from u$q$,
    pg_temp.id('T1'))
$$;
create function pg_temp.quitar(p_n integer) returns text language sql as $$
  select case p_n
    when 2 then format($q$with d as (delete from public.chatwoot_bot_excepciones where tenant_id = %L returning 1)
      select count(*)::text from d$q$, pg_temp.id('T1'))
    when 3 then format($q$with u as (update public.chatwoot_bot_excepciones set inbox_ids = array[7]::bigint[]
      where tenant_id = %L returning 1) select count(*)::text from u$q$, pg_temp.id('T1'))
    else format($q$with u as (update public.chatwoot_bot_excepciones set revocada_at = now()
      where tenant_id = %L returning 1) select count(*)::text from u$q$, pg_temp.id('T1'))
  end
$$;

-- Cómo quedó: el modo de la bandeja 3 y si tiene excepción vigente.
create function pg_temp.estado() returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'modo', (select b.modo from public.chatwoot_bot_bandejas b where b.tenant_id = %1$L and b.inbox_id = 3),
      'vigente', exists (select 1 from public.chatwoot_bot_excepciones e
        where e.tenant_id = %1$L and e.revocada_at is null and 3 = any (e.inbox_ids)))::text$q$,
    pg_temp.id('T1')))::jsonb
$$;

-- La guarda aplicada, cambiada por los reemplazos dados. Un reemplazo que no encuentra su
-- texto falla.
create function pg_temp.variante(p_cambios jsonb) returns void language plpgsql as $$
declare
  v_def text := pg_temp.ver($q$select pg_get_functiondef('public.chatwoot_bot_bandejas_guardar()'::regprocedure)$q$);
  v_c jsonb;
begin
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    if position(v_c ->> 0 in v_def) = 0 then
      raise exception 'TEST 0522 carrera: la variante no encuentra «%» en la guarda aplicada', v_c ->> 0;
    end if;
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0522_s', v_def);
end;
$$;

create function pg_temp.abrir(p_conn text, p_rol text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  perform dblink_exec(p_conn, format('set local role %I', p_rol));
end;
$$;

-- `a` hace su cambio y deja la transacción abierta; `b` el suyo en asíncrono.
create function pg_temp.carrera(p_a_sql text, p_b_sql text) returns jsonb language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_ra text;
  v_rb text;
  v_error text;
  v_avisos text := current_setting('client_min_messages');
begin
  select pid into v_a from dblink('c0522_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0522_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0522_a', 'service_role');
  select r into v_ra from dblink('c0522_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0522_b', 'service_role');
  perform pg_temp.afirmar(dblink_send_query('c0522_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      exit;
    end if;
    exit when dblink_is_busy('c0522_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0522 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0522_a', 'commit');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0522_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0522_b');
  end if;
  perform * from dblink_get_result('c0522_b', false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0522_b', case when v_error is null or v_error = 'OK' then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'a', v_ra, 'b', v_rb, 'error_b', nullif(v_error, 'OK'));
end;
$$;

create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0522_b') = 1 then
    perform dblink_cancel_query('c0522_b');
  end if;
  perform * from dblink_get_result('c0522_b', false) as t(r text);
  perform * from dblink_get_result('c0522_b', false) as t(r text);
  perform dblink_exec('c0522_b', 'rollback', false);
  perform dblink_exec('c0522_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

create function pg_temp.escenario(p_n integer) returns jsonb language plpgsql as $$
begin
  perform pg_temp.partida();
  if p_n = 4 then
    return pg_temp.carrera(pg_temp.encender(), pg_temp.quitar(1)) || pg_temp.estado();
  end if;
  return pg_temp.carrera(pg_temp.quitar(p_n), pg_temp.encender()) || pg_temp.estado();
end;
$$;

-- CONTROL (sin for share), escenarios 1 a 3: `b` no espera, confirma, y la bandeja queda en
-- contesta_solo sin excepción vigente.
create function pg_temp.control(p_r jsonb) returns boolean language sql immutable as $$
  select not (p_r ->> 'espero')::boolean and p_r ->> 'error_b' is null
    and p_r ->> 'modo' = 'contesta_solo' and not (p_r ->> 'vigente')::boolean
$$;

-- REAL: nunca contesta_solo sin vigente. En 1 a 3, `b` espera y falla por la guarda; en 4,
-- `b` espera, confirma su revocación y la bandeja baja a sugerir.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean and not (p_r ->> 'vigente')::boolean and p_r ->> 'modo' = 'sugerir'
    and case when p_n = 4 then p_r ->> 'error_b' is null and p_r ->> 'a' = 'contesta_solo'
      else p_r ->> 'error_b' like '%contesta_solo sin excepción IA-01 vigente%' end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'revocar en curso y encender',
    'borrar en curso y encender',
    'sacar la bandeja de inbox_ids en curso y encender',
    'encender en curso y revocar'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_guarda text;
  v_con_share boolean;
  v_sin_share jsonb := jsonb_build_array(jsonb_build_array(E'\n    for share;\n', E';\n'));
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0522 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0522 template template0');
  perform dblink_connect('c0522_s', pg_temp.conn('dtd_carrera_0522', 's'));
  perform dblink_connect('c0522_a', pg_temp.conn('dtd_carrera_0522', 'a'));
  perform dblink_connect('c0522_b', pg_temp.conn('dtd_carrera_0522', 'b'));
  perform dblink_exec('c0522_s', pg_temp.fixture());
  perform dblink_exec('c0522_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0522_b', $t$set statement_timeout = '30s'$t$);

  v_guarda := pg_temp.ver($q$select pg_get_functiondef('public.chatwoot_bot_bandejas_guardar()'::regprocedure)$q$);
  -- Sin `for share` en la guarda aplicada (un mutante), los controles no se pueden armar y
  -- cuentan como fallidos; los escenarios reales corren igual y son los que tienen que caer.
  v_con_share := position(E'\n    for share;\n' in v_guarda) > 0;

  for v_n in 1..4 loop
    foreach v_fase in array array['control', 'real'] loop
      continue when v_fase = 'control' and v_n = 4;
      if v_fase = 'control' and not v_con_share then
        v_r := jsonb_build_object('excepcion', 'la guarda aplicada no tiene for share: no hay control que armar');
      else
        if v_fase = 'control' then
          perform pg_temp.variante(v_sin_share);
        end if;
        begin
          v_r := pg_temp.escenario(v_n);
        exception when others then
          v_r := jsonb_build_object('excepcion', sqlerrm);
          perform pg_temp.reponer();
        end;
        if v_fase = 'control' then
          perform dblink_exec('c0522_s', v_guarda);
        end if;
      end if;
      v_ok := case when v_r ? 'excepcion' then false
        when v_fase = 'real' then pg_temp.correcto(v_n, v_r)
        else pg_temp.control(v_r) end;
      perform nextval('pg_temp.carrera_aserciones');
      if not coalesce(v_ok, false) then
        v_fallan := jsonb_set(v_fallan, array[v_fase], (v_fallan -> v_fase) || to_jsonb(v_n));
        v_detalle := v_detalle || format('%s %s (%s): %s', v_fase, v_n, pg_temp.nombre(v_n), v_r);
      end if;
    end loop;
  end loop;

  perform pg_temp.afirmar(
    pg_temp.ver($q$select md5(pg_get_functiondef('public.chatwoot_bot_bandejas_guardar()'::regprocedure))$q$)
      = md5(v_guarda),
    'la guarda tiene que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no mostraron el defecto: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0522 carrera OK: % aserciones; contesta_solo nunca queda sin IA-01 vigente con dos escrituras a la vez',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0522 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0522')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0522 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
