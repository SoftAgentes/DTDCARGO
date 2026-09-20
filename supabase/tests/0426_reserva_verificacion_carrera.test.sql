\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0426 (SDD-0375): la reserva atómica de
-- public.reserve_public_verify_attempt(), probada con sesiones reales. Base
-- propia y desechable dentro del contenedor del runner: nunca consulta ni
-- modifica una base alojada.
--
-- POR QUÉ: el contrato 0426_public_verify_atomic_reservation.test.sql corre en
-- una sola sesión, y lo dice: «Concurrencia multiconexión: node
-- scripts/check-public-verify-concurrency.mjs». Ese script no corre en verify,
-- y por defecto usa postgres:17-alpine, que el runner no descarga: en esta
-- máquina hace SKIP. La función promete, y sólo se ve con dos sesiones:
--   · un advisory lock por IP: dos reservas de la misma IP se serializan, así
--     que el último cupo de 40 en 30 minutos se da una sola vez; otra IP no
--     espera;
--   · el reloj se lee DESPUÉS de tomar el lock: si la ventana vence mientras
--     una reserva espera, esa reserva cuenta con la hora en que entra;
--   · lock_timeout = 2s: una reserva no espera para siempre y no inserta nada;
--   · sólo READ COMMITTED: con un snapshot fijo no vería la reserva del dueño
--     anterior del lock.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0427, 0459 y 0460). El
-- archivo corre en la base `postgres` del runner y, con dblink, abre tres
-- sesiones contra una base propia (dtd_carrera_0426): `s` prepara y observa,
-- `a` reserva y deja la transacción abierta, y `b` reserva después, en
-- asíncrono. Cada caso exige ver pg_blocking_pids(b) con `a` adentro antes de
-- que `a` cierre: la barrera es determinista y un escenario sin carrera falla
-- en vez de pasar vacío.
--
-- FIXTURE: el del contrato 0426. Se lee con pg_read_file su sección entre
-- `begin;` y el primer `\ir` de la 0426; cada `\ir` se reemplaza por la
-- migración que incluye, y cualquier otro meta-comando de psql aborta. Después
-- va la 0426 entera. Si el contrato cambia de forma, este archivo falla en vez
-- de probar sobre otro fixture.
--
-- Lo que defiende, con los escenarios del script:
--   1. Último cupo, la primera confirma: la segunda espera en el advisory lock
--      y recibe false. Quedan 40. Otra IP reserva sin esperar.
--   2. Último cupo, la primera se revierte: la segunda espera y reserva ella.
--      Quedan 40.
--   3. La ventana vence mientras la segunda espera: al entrar cuenta con su
--      propio reloj y reserva. Su created_at es posterior a la liberación.
--   4. La primera retiene más de 2 s: la segunda corta con lock timeout sin
--      insertar, y después reserva.
--   5. REPEATABLE READ, SERIALIZABLE o READ UNCOMMITTED: rechazo 25000, sin filas.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated, service_role y fixture_0426_extra (los crea el fixture
-- del contrato) se borran también cuando algo falla, antes de propagar el
-- error. dblink se crea dentro de la transacción del archivo y se va con el
-- rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes fuera del repo, ver .agents/handoffs/0375-carrera-reserva-0426.md):
-- la 0426 sin el advisory lock, con el reloj leído al empezar la transacción,
-- sin su lock_timeout o sin la exigencia de READ COMMITTED hace fallar este
-- archivo.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles del fixture no es desechable: no se toca.
  if exists (select from pg_roles
             where rolname in ('anon', 'authenticated', 'service_role', 'fixture_0426_extra')) then
    raise exception 'TEST 0426 carrera requiere un clúster desechable: ya existen roles del fixture';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0426 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0426_%s',
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
    if v_conn like 'c0426\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    -- with (force) termina a `a` y a `b` si quedaron esperando.
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0426 with (force)');
  exception when others then
    v_restos := v_restos || format(' base: %s;', sqlerrm);
  end;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop role if exists anon, authenticated, service_role, fixture_0426_extra');
  exception when others then
    v_restos := v_restos || format(' roles: %s;', sqlerrm);
  end;
  return nullif(v_restos, '');
end;
$$;

-- Expande una región de un contrato para mandarla por dblink: cada `\ir` de
-- migraciones se reemplaza por el archivo, `\if :var` / `\else` / `\endif` se
-- resuelven con p_vars, y cualquier otro meta-comando de psql aborta.
create function pg_temp.expandir(p_contrato text, p_desde text, p_hasta text, p_vars jsonb)
returns text language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/tests/' || p_contrato);
  v_ini integer := position(p_desde in v_txt);
  v_fin integer := position(p_hasta in v_txt);
  v_linea text;
  v_var text;
  v_padres boolean[] := '{}';
  v_conds boolean[] := '{}';
  v_activo boolean := true;
  v_salida text[] := '{}';
begin
  if v_ini = 0 or v_fin <= v_ini then
    raise exception 'TEST 0426 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0426 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0426 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
      end if;
      if v_linea ~ '^\\else' then
        v_activo := v_padres[cardinality(v_padres)] and not v_conds[cardinality(v_conds)];
      else
        v_activo := v_padres[cardinality(v_padres)];
        v_padres := v_padres[1:cardinality(v_padres) - 1];
        v_conds := v_conds[1:cardinality(v_conds) - 1];
      end if;
    elsif v_linea ~ '^\\ir \.\./migrations/[0-9A-Za-z_]+\.sql\s*$' then
      if v_activo then
        v_salida := v_salida || pg_read_file('/sb/migrations/'
          || substring(v_linea from '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)'));
      end if;
    elsif v_linea ~ '^\s*\\' then
      raise exception 'TEST 0426 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0426 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- El fixture del contrato, antes de su primer `\ir` de la 0426, y la 0426
-- entera, en UNA transacción explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0426_public_verify_atomic_reservation.test.sql',
      E'\nbegin;\n', E'\n\\ir ../migrations/0426_public_verify_atomic_reservation.sql\n', '{}'),
    pg_read_file('/sb/migrations/0426_public_verify_atomic_reservation.sql'),
    'commit;');
end;
$$;

-- Abre la transacción de una sesión, con su nivel de aislamiento y su rol.
create function pg_temp.abrir(p_conn text, p_rol text, p_nivel text default null) returns void
language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin' || coalesce(' isolation level ' || p_nivel, ''));
  if p_rol is not null then
    perform dblink_exec(p_conn, format('set local role %I', p_rol));
  end if;
end;
$$;

create function pg_temp.reservar(p_ip text) returns text language sql as $$
  select format('select public.reserve_public_verify_attempt(%L)::text', p_ip)
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0426_s', p_sql) as t(r text)
$$;

create function pg_temp.cuantas(p_ip text) returns integer language sql as $$
  select pg_temp.ver(format(
    'select count(*)::text from public.public_verify_throttle where ip = %L', p_ip))::integer
$$;

-- Siembra p_n intentos de p_ip con p_edad de antigüedad.
create function pg_temp.sembrar(p_ip text, p_n integer, p_edad text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0426_s', format($q$insert into public.public_verify_throttle (ip, created_at)
    select %L, clock_timestamp() - %L::interval from generate_series(1, %s)$q$, p_ip, p_edad, p_n));
end;
$$;

-- Una carrera: `a` corre p_a_sql y deja la transacción abierta; `b` corre
-- p_b_sql en asíncrono. Con `b` esperando, `s` corre p_mientras y, si hay
-- p_hasta, espera a que devuelva true. `a` cierra con p_cierre apenas `b` queda
-- esperando o, con p_b_termina_sola, recién cuando `b` terminó por su cuenta.
-- Devuelve si `b` esperó (y en qué tipo de lock), lo que devolvió cada sesión,
-- el error de `b` y la hora de `s` justo antes de que `a` cerrara.
create function pg_temp.carrera(p_a_sql text, p_b_sql text, p_cierre text default 'commit',
  p_b_termina_sola boolean default false, p_mientras text default null, p_hasta text default null)
returns jsonb language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_lock text;
  v_ra text;
  v_rb text;
  v_rm text;
  v_liberado text;
  v_error text;
  v_avisos text := current_setting('client_min_messages');
begin
  select pid into v_a from dblink('c0426_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0426_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0426_a', 'service_role');
  select r into v_ra from dblink('c0426_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0426_b', 'service_role');
  perform pg_temp.afirmar(dblink_send_query('c0426_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- cierre, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0426_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0426 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  if p_mientras is not null then
    v_rm := pg_temp.ver(p_mientras);
  end if;
  if p_hasta is not null then
    while coalesce(pg_temp.ver(p_hasta), 'false') <> 'true' loop
      if clock_timestamp() > v_limite then
        raise exception 'TEST 0426 carrera: no se cumplió la condición previa al cierre en 20 s';
      end if;
      perform pg_sleep(0.05);
    end loop;
  end if;
  if v_espero and p_b_termina_sola then
    while dblink_is_busy('c0426_b') = 1 loop
      if clock_timestamp() > v_limite then
        raise exception 'TEST 0426 carrera: la segunda sesión no terminó sola en 20 s';
      end if;
      perform pg_sleep(0.05);
    end loop;
  end if;
  v_liberado := pg_temp.ver('select clock_timestamp()::text');
  perform dblink_exec('c0426_a', p_cierre);
  -- Un error de `b` es un resultado esperado en algunos casos: se guarda, no
  -- se reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0426_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0426_b');
  end if;
  perform * from dblink_get_result('c0426_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0426_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb,
    'error_b', v_error, 'mientras', v_rm, 'liberado', v_liberado);
end;
$$;

do $carrera$
declare
  v_r jsonb;
  v_rb text;
  v_error text;
  v_nivel text;
  v_avisos text := current_setting('client_min_messages');
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0426 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0426 template template0');
  perform dblink_connect('c0426_s', pg_temp.conn('dtd_carrera_0426', 's'));
  perform dblink_connect('c0426_a', pg_temp.conn('dtd_carrera_0426', 'a'));
  perform dblink_connect('c0426_b', pg_temp.conn('dtd_carrera_0426', 'b'));
  perform dblink_exec('c0426_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0426_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0426_b', $t$set statement_timeout = '30s'$t$);

  -- 1. Último cupo, la primera confirma. Otra IP reserva sin esperar.
  perform pg_temp.sembrar('198.51.100.42', 39, '0 seconds');
  v_r := pg_temp.carrera(pg_temp.reservar('198.51.100.42'), pg_temp.reservar('198.51.100.42'),
    p_mientras => pg_temp.reservar('198.51.100.52'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory',
    format('último cupo: la segunda reserva tenía que esperar en el advisory lock de la IP (¿falta el lock?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = 'true' and v_r ->> 'b' = 'false'
      and pg_temp.cuantas('198.51.100.42') = 40,
    format('último cupo: una sola reserva, y quedan 40: %s / %s', v_r, pg_temp.cuantas('198.51.100.42')));
  perform pg_temp.afirmar(v_r ->> 'mientras' = 'true' and pg_temp.cuantas('198.51.100.52') = 1,
    format('último cupo: otra IP tenía que reservar sin esperar: %s', v_r));

  -- 2. Último cupo, la primera se revierte.
  perform pg_temp.sembrar('198.51.100.43', 39, '0 seconds');
  v_r := pg_temp.carrera(pg_temp.reservar('198.51.100.43'), pg_temp.reservar('198.51.100.43'), 'rollback',
    p_mientras => pg_temp.reservar('198.51.100.53'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'a' = 'true' and v_r ->> 'b' = 'true'
      and v_r ->> 'mientras' = 'true' and pg_temp.cuantas('198.51.100.43') = 40,
    format('primera revertida: la segunda tenía que esperar y reservar ella, y quedan 40: %s / %s',
      v_r, pg_temp.cuantas('198.51.100.43')));

  -- 3. La ventana vence mientras la segunda espera.
  perform pg_temp.sembrar('198.51.100.46', 40, '29 minutes 59 seconds');
  v_r := pg_temp.carrera(pg_temp.reservar('198.51.100.46'), pg_temp.reservar('198.51.100.46'),
    p_hasta => $q$select bool_and(created_at < clock_timestamp() - interval '30 minutes')::text
      from public.public_verify_throttle where ip = '198.51.100.46'$q$);
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'a' = 'false' and v_r ->> 'b' = 'true',
    format('ventana vencida: la primera ve la ventana llena y la segunda, al entrar, ya no (¿el reloj se lee antes del lock?): %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format($q$select (count(*) = 41
        and max(created_at) >= %L::timestamptz)::text
      from public.public_verify_throttle where ip = '198.51.100.46'$q$, v_r ->> 'liberado')) = 'true',
    format('ventana vencida: la reserva nueva tiene que llevar la hora posterior a la liberación: %s', v_r));

  -- 4. La primera retiene más de 2 s.
  perform pg_temp.sembrar('198.51.100.44', 39, '0 seconds');
  v_r := pg_temp.carrera(pg_temp.reservar('198.51.100.44'), pg_temp.reservar('198.51.100.44'), 'rollback', true);
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'b' is null
      and v_r ->> 'error_b' like '%lock timeout%' and pg_temp.cuantas('198.51.100.44') = 39,
    format('timeout: la segunda tenía que cortar con lock timeout sin insertar (¿falta el lock_timeout de la función?): %s / %s',
      v_r, pg_temp.cuantas('198.51.100.44')));
  perform pg_temp.abrir('c0426_b', 'service_role');
  select r into v_rb from dblink('c0426_b', pg_temp.reservar('198.51.100.44')) as t(r text);
  perform dblink_exec('c0426_b', 'commit');
  perform pg_temp.afirmar(v_rb = 'true' and pg_temp.cuantas('198.51.100.44') = 40,
    'timeout: liberado el lock, la reserva tiene que entrar');

  -- 5. Sólo READ COMMITTED.
  foreach v_nivel in array array['repeatable read', 'serializable', 'read uncommitted'] loop
    perform pg_temp.abrir('c0426_b', 'service_role', v_nivel);
    perform set_config('client_min_messages', 'warning', true);
    select r into v_rb from dblink('c0426_b', pg_temp.reservar('198.51.100.45'), false) as t(r text);
    v_error := case when v_rb is null then dblink_error_message('c0426_b') end;
    perform set_config('client_min_messages', v_avisos, true);
    perform dblink_exec('c0426_b', 'rollback');
    perform pg_temp.afirmar(v_rb is null and v_error like '%requires read committed%',
      format('aislamiento: %s tenía que rechazarse (25000): %s / %s', v_nivel, v_rb, v_error));
  end loop;
  perform pg_temp.afirmar(pg_temp.cuantas('198.51.100.45') = 0, 'aislamiento: los rechazos no dejan filas');

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0426 carrera OK: % aserciones; último cupo, ventana vencida en espera, timeout y aislamiento',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0426 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0426')
     or exists (select from pg_roles
                where rolname in ('anon', 'authenticated', 'service_role', 'fixture_0426_extra'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0426 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
