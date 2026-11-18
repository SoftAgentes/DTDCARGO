\set ON_ERROR_STOP on
-- Contrato de concurrencia de la 0519 (SDD-0586, 10.5, PR 1a): dos tomas de la cola de la
-- ida del portal a la vez. Base propia y desechable dentro del contenedor del runner: nunca
-- consulta ni modifica una base alojada.
--
-- POR QUÉ: chatwoot_portal_tomar elige, por hilo, la cabeza que le toca ir a Chatwoot y la
-- reclama. Lo llaman a la vez el portal (con after(), por su hilo) y el cron
-- chatwoot-reintentos (todo el tenant). La exclusión tiene dos piezas:
--   · `for no key update of c skip locked` sobre la fila del hilo: la segunda toma no espera
--     el hilo que la primera tiene en curso y sigue con los demás;
--   · la guarda del upsert: si una toma llega a la cabeza con una foto vieja, no reclama un
--     envío en curso.
-- El contrato 0519_chatwoot_portal.test.sql corre en una sola sesión (PGlite) y no alcanza
-- ninguna de las dos. Este archivo las mide con dos sesiones.
--
-- CÓMO: igual que 0365_outbox_kommo_carrera.test.sql. El archivo corre en la base `postgres`
-- del runner y, con dblink, abre tres sesiones contra una base propia (dtd_carrera_0519): `s`
-- prepara y observa, `a` toma primero y deja la transacción abierta, y `b` toma después, en
-- asíncrono. Las dos toman como service_role, que es como llama el servidor de Studio. La
-- barrera mira si `b` queda esperando a `a` (pg_blocking_pids) o termina sin esperarla.
--
-- Los escenarios, con el fixture del contrato (hilo hA con su cabeza a1, hilo hB con b1):
--   1. Las dos piden el mismo hilo (hA). Real: `b` no espera y no toma nada; `a` tomó a1.
--      Control: la toma sin `skip locked`; `b` espera a que `a` confirme y, después, la
--      guarda le impide reclamar a1 otra vez (vuelve vacía). Así se mide la guarda.
--   2. Lo mismo. Control: sin `skip locked` y sin la guarda; `b` espera y vuelve a reclamar
--      a1, que se mandaría dos veces. Es el defecto que las dos piezas evitan juntas.
--   3. `a` tiene hA y `b` toma todo el tenant. Real: `b` no espera y toma b1, la cabeza de hB,
--      sin a1. Control: sin `skip locked`; `b` espera por hA y después toma b1, sin a1.
-- La guarda sola, con `skip locked` presente, no se alcanza de forma determinista: su ventana
-- está entre la foto de la sentencia y el bloqueo de la fila, dentro de una sola ejecución.
-- Queda como defensa; el escenario 1 la mide con `skip locked` quitado.
--
-- CONTROL en la misma corrida: cada escenario corre primero con la toma reemplazada por una
-- variante (sacada con pg_get_functiondef de la versión aplicada y restituida después), y
-- tiene que mostrar el defecto. Después corre con la 0519. A diferencia de la 0365, un
-- reemplazo que no encuentra su texto FALLA: la variante tiene que ser la que se dice.
--
-- FIXTURE: el del contrato 0519, leído de su archivo entre sus `\ir` (roles, auth, tenants,
-- fichas, hilos y mensajes sintéticos), con las migraciones reales que el contrato incluye y
-- la 0519 entera encima. Si el contrato cambia de forma, este archivo falla en vez de probar
-- sobre otro fixture.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles anon,
-- authenticated y service_role se borran también cuando algo falla, antes de propagar el
-- error. dblink se crea dentro de la transacción del archivo y se va con el rollback.
--
-- Corre en GitHub Actions (.github/workflows/chatwoot-portal-poc.yml, con un mutante de la 0519
-- sin `skip locked` que tiene que hacerlo caer) y en `pnpm verify` con Docker
-- (scripts/run-sql-tests.mjs). Requiere dblink (contrib de la imagen postgres:17) y el montaje
-- /sb del runner.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0519 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0519 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0519_%s',
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
    if v_conn like 'c0519\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0519 with (force)');
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

-- Un fragmento del contrato entre dos marcas (la segunda se busca después de la primera),
-- para mandarlo por dblink. Tiene que ser SQL puro: un meta-comando de psql adentro aborta.
create function pg_temp.fragmento(p_desde text, p_hasta text) returns text language plpgsql as $$
declare
  v_txt text := replace(pg_read_file('/sb/tests/0519_chatwoot_portal.test.sql'), E'\r\n', E'\n');
  v_ini integer := position(p_desde in v_txt);
  v_fin integer;
begin
  if v_ini = 0 then
    raise exception 'TEST 0519 carrera: no encuentro «%» en el contrato', p_desde;
  end if;
  v_txt := substr(v_txt, v_ini + length(p_desde));
  v_fin := position(p_hasta in v_txt);
  if v_fin = 0 then
    raise exception 'TEST 0519 carrera: no encuentro «%» en el contrato después de «%»', p_hasta, p_desde;
  end if;
  v_txt := left(v_txt, v_fin - 1);
  if v_txt ~ '(^|\n)\s*\\' then
    raise exception 'TEST 0519 carrera: el fragmento del contrato trae un meta-comando de psql';
  end if;
  return v_txt;
end;
$$;

create function pg_temp.migracion(p_nombre text) returns text language sql as $$
  select pg_read_file('/sb/migrations/' || p_nombre || '.sql')
$$;

-- Los ids sintéticos del contrato (su pg_temp.id): el mismo prefijo.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0519-sintetico-' || p_label)::uuid
$$;

-- El fixture del contrato con sus migraciones y la 0519, en UNA transacción explícita: si algo
-- falla, no queda ni un rol. Después, el flag encendido en T1 y su corte.
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
    pg_temp.fragmento(E'\\ir ../migrations/0504_chatwoot_eventos.sql\n', E'\n\\ir ../migrations/0519_chatwoot_portal.sql'),
    pg_temp.migracion('0519_chatwoot_portal'),
    format($q$update public.feature_flags set enabled = true where tenant_id = %1$L and key = 'chatwoot_portal';
insert into public.chatwoot_portal_estado (tenant_id, corte) values (%1$L, now() - interval '1 day');$q$, pg_temp.id('T1')),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0519_s', p_sql) as t(r text)
$$;

-- Una toma como la del servidor: las cabezas reclamadas, por etiqueta y en orden, o ''.
create function pg_temp.tomar(p_hilo text) returns text language sql as $$
  select format($q$select coalesce(string_agg(case t.mensaje_id when %1$L then 'a1' when %2$L then 'b1' else 'otra' end, ','
      order by case t.mensaje_id when %1$L then 'a1' when %2$L then 'b1' else 'otra' end), '')
    from public.chatwoot_portal_tomar(%3$L, 20, %4$s) t$q$,
    pg_temp.id('a1'), pg_temp.id('b1'), pg_temp.id('T1'),
    case when p_hilo is null then 'null' else quote_literal(pg_temp.id(p_hilo)) || '::uuid' end)
$$;

-- La cola después de la carrera: cuántos intentos tiene cada cabeza.
create function pg_temp.estado() returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'a1', (select s.intentos from public.chatwoot_portal_salida s where s.message_id = %L),
      'b1', (select s.intentos from public.chatwoot_portal_salida s where s.message_id = %L))::text$q$,
    pg_temp.id('a1'), pg_temp.id('b1')))::jsonb
$$;

-- Una variante de la toma aplicada, con los reemplazos de p_cambios. Un reemplazo que no
-- encuentra su texto falla: la variante tiene que ser exactamente la que se nombra.
create function pg_temp.variante(p_cambios jsonb) returns void language plpgsql as $$
declare
  v_def text := pg_temp.ver($q$select pg_get_functiondef('public.chatwoot_portal_tomar(uuid,integer,uuid)'::regprocedure)$q$);
  v_c jsonb;
begin
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    if position(v_c ->> 0 in v_def) = 0 then
      raise exception 'TEST 0519 carrera: la variante no encuentra «%» en la toma aplicada', v_c ->> 0;
    end if;
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0519_s', v_def);
end;
$$;

-- Abre la transacción de una sesión con el rol dado.
create function pg_temp.abrir(p_conn text, p_rol text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  perform dblink_exec(p_conn, format('set local role %I', p_rol));
end;
$$;

-- Una carrera: `a` toma y deja la transacción abierta; `b` toma en asíncrono. Devuelve si `b`
-- esperó a `a`, lo que tomó cada uno y el error de `b`, si lo hubo.
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
  select pid into v_a from dblink('c0519_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0519_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0519_a', 'service_role');
  select r into v_ra from dblink('c0519_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0519_b', 'service_role');
  perform pg_temp.afirmar(dblink_send_query('c0519_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a` confirme,
  -- así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      exit;
    end if;
    exit when dblink_is_busy('c0519_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0519 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0519_a', 'commit');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0519_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0519_b');
  end if;
  perform * from dblink_get_result('c0519_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0519_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0519_b') = 1 then
    perform dblink_cancel_query('c0519_b');
  end if;
  perform * from dblink_get_result('c0519_b', false) as t(r text);
  perform * from dblink_get_result('c0519_b', false) as t(r text);
  perform dblink_exec('c0519_b', 'rollback', false);
  perform dblink_exec('c0519_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_n integer) returns jsonb language plpgsql as $$
declare
  v_r jsonb;
begin
  -- Cola vacía: cada escenario empieza con a1 y b1 sin reclamar.
  perform dblink_exec('c0519_s', 'delete from public.chatwoot_portal_salida; delete from public.chatwoot_portal_contactos;');
  v_r := pg_temp.carrera(pg_temp.tomar('hA'), pg_temp.tomar(case when p_n = 3 then null else 'hA' end));
  return v_r || pg_temp.estado();
end;
$$;

-- CONTROL: lo que tiene que mostrar cada variante.
--   1. Sin skip locked: `b` espera y la guarda le impide reclamar a1 (vacía, a1 con 1 intento).
--   2. Sin skip locked ni guarda: `b` espera y reclama a1 otra vez (a1 con 2 intentos).
--   3. Sin skip locked: `b` espera por hA y después toma b1, sin a1.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean and p_r ->> 'error_b' is null and p_r ->> 'a' = 'a1'
    and case p_n
      when 1 then p_r ->> 'b' = '' and (p_r ->> 'a1')::int = 1
      when 2 then p_r ->> 'b' = 'a1' and (p_r ->> 'a1')::int = 2
      else p_r ->> 'b' = 'b1' and (p_r ->> 'a1')::int = 1 and (p_r ->> 'b1')::int = 1
    end
$$;

-- REAL: `b` no esperó a `a`, nadie reclamó a1 dos veces, y en 3 `b` tomó b1.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select not (p_r ->> 'espero')::boolean and p_r ->> 'error_b' is null and p_r ->> 'a' = 'a1'
    and (p_r ->> 'a1')::int = 1
    and case when p_n = 3 then p_r ->> 'b' = 'b1' and (p_r ->> 'b1')::int = 1 else p_r ->> 'b' = '' end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'el mismo hilo a la vez; el control quita skip locked y mide la guarda',
    'el mismo hilo a la vez; el control quita skip locked y la guarda',
    'un hilo en curso y el resto del tenant'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_toma text;
  v_con_skip boolean;
  v_sin_skip jsonb := jsonb_build_array(jsonb_build_array(
    E'    for no key update of c skip locked\n', E'    for no key update of c\n'));
  v_sin_guarda jsonb := jsonb_build_array(jsonb_build_array(
    E'      where (s.estado = ''pendiente'' and s.proximo_at <= pg_catalog.now())\n         or (s.estado = ''enviando'' and s.updated_at <= pg_catalog.now() - interval ''5 minutes'')\n', ''));
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0519 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0519 template template0');
  perform dblink_connect('c0519_s', pg_temp.conn('dtd_carrera_0519', 's'));
  perform dblink_connect('c0519_a', pg_temp.conn('dtd_carrera_0519', 'a'));
  perform dblink_connect('c0519_b', pg_temp.conn('dtd_carrera_0519', 'b'));
  perform dblink_exec('c0519_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0519_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0519_b', $t$set statement_timeout = '30s'$t$);

  v_toma := pg_temp.ver($q$select pg_get_functiondef('public.chatwoot_portal_tomar(uuid,integer,uuid)'::regprocedure)$q$);
  -- Sin `skip locked` en la toma aplicada (un mutante), los controles no se pueden armar y
  -- cuentan como fallidos; los escenarios reales corren igual y son los que tienen que caer.
  v_con_skip := position(E'    for no key update of c skip locked\n' in v_toma) > 0;

  for v_n in 1..3 loop
    foreach v_fase in array array['control', 'real'] loop
      if v_fase = 'control' and not v_con_skip then
        v_r := jsonb_build_object('excepcion', 'la toma aplicada no tiene skip locked: no hay control que armar');
      else
        if v_fase = 'control' and v_n = 2 then
          perform pg_temp.variante(v_sin_skip || v_sin_guarda);
        elsif v_fase = 'control' then
          perform pg_temp.variante(v_sin_skip);
        end if;
        begin
          v_r := pg_temp.escenario(v_n);
        exception when others then
          v_r := jsonb_build_object('excepcion', sqlerrm);
          perform pg_temp.reponer();
        end;
      end if;
      if v_fase = 'control' and v_con_skip then
        perform dblink_exec('c0519_s', v_toma);
      end if;
      v_ok := case when v_r ? 'excepcion' then false
        when v_fase = 'real' then pg_temp.correcto(v_n, v_r)
        else pg_temp.control(v_n, v_r) end;
      perform nextval('pg_temp.carrera_aserciones');
      if not coalesce(v_ok, false) then
        v_fallan := jsonb_set(v_fallan, array[v_fase], (v_fallan -> v_fase) || to_jsonb(v_n));
        v_detalle := v_detalle || format('%s %s (%s): %s', v_fase, v_n, pg_temp.nombre(v_n), v_r);
      end if;
    end loop;
  end loop;

  perform pg_temp.afirmar(
    pg_temp.ver($q$select md5(pg_get_functiondef('public.chatwoot_portal_tomar(uuid,integer,uuid)'::regprocedure))$q$)
      = md5(v_toma),
    'la toma tiene que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no mostraron el defecto: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0519 carrera OK: % aserciones; dos tomas simultáneas no reclaman la misma cabeza ni se esperan',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0519 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0519')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0519 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
