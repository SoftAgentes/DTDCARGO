\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0564 (SDD-0674, EXC-0674): dos facturaciones simultáneas desde
-- Embarques. Corre en una base propia y desechable dentro del contenedor del runner, y nunca consulta ni
-- modifica una base alojada.
--
-- POR QUÉ: next_invoice_code (0077:63-83) calcula max+1 sin lock, y solo lo protege el unique
-- (tenant_id, invoice_code) de la 0077:48. Por eso exc0674_facturar toma un lock consultivo por tenant
-- antes de numerar, y otro por (tenant, contenedor, cliente). El contrato de una sola sesión no puede
-- probarlo.
--
-- CÓMO: el mismo patrón que la carrera 0469. El archivo corre en la base `postgres` del runner y, con
-- dblink, abre tres sesiones contra una base propia (dtd_carrera_0564):
--   · `s` prepara y observa;
--   · `a` factura primero y deja la transacción abierta;
--   · `b` factura después, en asíncrono.
-- La barrera mira si `b` queda esperando a `a` (pg_blocking_pids) y en qué tipo de lock.
--
-- Escenarios (clientes distintos del K64; cada factura queda confirmada):
--   1. Dos clientes distintos del mismo tenant a la vez.
--      · Real: `b` espera en el lock consultivo de numeración y sale con el número siguiente.
--      · Control: la RPC sin ese lock. `b` numera igual que `a`, espera en el unique y falla con 23505.
--   2. El mismo cliente a la vez (doble clic o dos pestañas). Real: `b` espera y recibe
--      exc0674:ya_facturado. Queda una sola factura.
--   3. Dos tenants distintos a la vez. No se esperan, porque el lock es por tenant.
--
-- FIXTURE: el del contrato 0564_exc0674_facturar_contenedor.test.sql, leído de su archivo hasta sus
-- aserciones. Trae las réplicas mínimas, la 0564 y los clientes DTD-C001 a DTD-C006 (tenant A) y DTD-B001
-- (tenant B).
--
-- SIN HUELLA: la base propia y los roles anon, authenticated y service_role se borran también cuando algo
-- falla. dblink se crea dentro de la transacción del archivo y se va con el rollback.

begin;

do $guard$
begin
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0564 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0564 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0564_%s',
    split_part(current_setting('unix_socket_directories'), ',', 1),
    current_setting('port'), p_base, current_user, p_sesion)
$$;

create function pg_temp.limpiar() returns text language plpgsql as $$
declare
  v_conn text;
  v_restos text := '';
begin
  foreach v_conn in array coalesce(dblink_get_connections(), '{}') loop
    if v_conn like 'c0564\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0564 with (force)');
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

-- La región del contrato, con cada `\ir` de migraciones reemplazado por el archivo. Cualquier otro
-- meta-comando de psql aborta.
create function pg_temp.fixture() returns text language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/tests/0564_exc0674_facturar_contenedor.test.sql');
  v_desde text := E'\nbegin;\n';
  v_hasta text := E'\n-- ── Aserciones';
  v_ini integer := position(v_desde in v_txt);
  v_fin integer;
  v_linea text;
  v_salida text[] := '{}';
begin
  if v_ini = 0 then raise exception 'TEST 0564 carrera: no encuentro el inicio del fixture'; end if;
  v_txt := substr(v_txt, v_ini + length(v_desde));
  v_fin := position(v_hasta in v_txt);
  if v_fin = 0 then raise exception 'TEST 0564 carrera: no encuentro el fin del fixture'; end if;
  foreach v_linea in array string_to_array(left(v_txt, v_fin - 1), E'\n') loop
    if v_linea ~ '^\\ir \.\./migrations/[0-9A-Za-z_]+\.sql\s*$' then
      v_salida := v_salida || pg_read_file('/sb/migrations/'
        || substring(v_linea from '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)'));
    elsif v_linea ~ '^\s*\\' then
      raise exception 'TEST 0564 carrera: meta-comando de psql que no sé expandir: %', v_linea;
    else
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  return concat_ws(E'\n', 'begin;', array_to_string(v_salida, E'\n'), 'commit;');
end;
$$;

create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0564_s', p_sql) as t(r text)
$$;

-- Usuarios del contrato: a5 accounting del tenant A, b1 accounting del tenant B.
create function pg_temp.uid(p_quien text) returns text language sql immutable as $$
  select case p_quien when 'a5' then '00000000-0000-4000-8000-00000000a005'
                      when 'b1' then '00000000-0000-4000-8000-00000000b001' end
$$;

-- La RPC como la llama la server action, y el código de la factura de vuelta.
create function pg_temp.facturar(p_cons text, p_markbox text) returns text language sql as $$
  select format($q$select public.exc0674_facturar(%L::uuid, %L::jsonb, 'Confirmado') -> 'facturas' -> 0 ->> 'invoice_code'$q$,
    p_cons, jsonb_build_array(jsonb_build_object('client_markbox', p_markbox, 'total_usd', 10))::text)
$$;

create function pg_temp.abrir(p_conn text, p_quien text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  perform * from dblink(p_conn, format($q$select set_config('test.uid', %L, true)$q$, pg_temp.uid(p_quien))) as t(x text);
  perform dblink_exec(p_conn, 'set local role authenticated');
end;
$$;

create function pg_temp.carrera(p_a text, p_a_sql text, p_b text, p_b_sql text) returns jsonb
language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_lock text;
  v_ra text;
  v_rb text;
  v_error text;
  v_avisos text := current_setting('client_min_messages');
begin
  select pid into v_a from dblink('c0564_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0564_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0564_a', p_a);
  select r into v_ra from dblink('c0564_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0564_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0564_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0564_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0564 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0564_a', 'commit');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0564_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0564_b');
  end if;
  perform * from dblink_get_result('c0564_b', false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0564_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0564_b') = 1 then
    perform dblink_cancel_query('c0564_b');
  end if;
  perform * from dblink_get_result('c0564_b', false) as t(r text);
  perform * from dblink_get_result('c0564_b', false) as t(r text);
  perform dblink_exec('c0564_b', 'rollback', false);
  perform dblink_exec('c0564_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

do $carrera$
declare
  k64 constant text := '00000000-0000-4000-8000-00000000c064';
  kb  constant text := '00000000-0000-4000-8000-00000000cb64';
  v_rpc text;
  v_r jsonb;
  v_restos text;
begin
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0564 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0564 template template0');
  perform dblink_connect('c0564_s', pg_temp.conn('dtd_carrera_0564', 's'));
  perform dblink_connect('c0564_a', pg_temp.conn('dtd_carrera_0564', 'a'));
  perform dblink_connect('c0564_b', pg_temp.conn('dtd_carrera_0564', 'b'));
  perform dblink_exec('c0564_s', pg_temp.fixture());
  perform dblink_exec('c0564_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0564_b', $t$set statement_timeout = '30s'$t$);

  v_rpc := pg_temp.ver($q$select pg_get_functiondef('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure)$q$);
  perform pg_temp.afirmar(position('exc0674:numeracion:' in v_rpc) > 0, 'la RPC aplicada no tiene el lock de numeración');

  -- 1. CONTROL: la RPC sin el lock de numeración. `b` numera igual que `a` y choca con el unique.
  perform dblink_exec('c0564_s', regexp_replace(v_rpc,
    E'perform pg_catalog\\.pg_advisory_xact_lock\\(\\s*pg_catalog\\.hashtextextended\\(''exc0674:numeracion:''[^;]*\\);', '', 'g'));
  perform pg_temp.afirmar(
    position('exc0674:numeracion:' in pg_temp.ver($q$select pg_get_functiondef('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure)$q$)) = 0,
    'el control no quitó el lock');
  begin
    v_r := pg_temp.carrera('a5', pg_temp.facturar(k64, 'DTD-C001'), 'a5', pg_temp.facturar(k64, 'DTD-C002'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform dblink_exec('c0564_s', v_rpc);
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%duplicate key value violates unique constraint%', false),
    format('CONTROL 1: sin el lock, la segunda facturación tenía que chocar con el unique: %s', v_r));

  -- 1. REAL: `b` espera en el lock consultivo y sale con el número siguiente.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.facturar(k64, 'DTD-C003'), 'a5', pg_temp.facturar(k64, 'DTD-C004'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(v_r ->> 'error_b' is null and (v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory'
      and v_r ->> 'a' is not null and v_r ->> 'b' is not null and v_r ->> 'a' <> v_r ->> 'b',
    format('REAL 1: dos clientes del mismo tenant a la vez: %s', v_r));

  -- 2. REAL: el mismo cliente a la vez. Una sola factura.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.facturar(k64, 'DTD-C005'), 'a5', pg_temp.facturar(k64, 'DTD-C005'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:ya_facturado:DTD-C005%', false)
      and (v_r ->> 'espero')::boolean and v_r ->> 'a' is not null,
    format('REAL 2: el mismo cliente a la vez: %s', v_r));
  perform pg_temp.afirmar(
    pg_temp.ver($q$select count(*)::text from public.exc0674_facturas where client_markbox = 'DTD-C005'$q$) = '1',
    'REAL 2: quedó más de una factura del mismo cliente');

  -- 3. REAL: tenants distintos no se esperan.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.facturar(k64, 'DTD-C006'), 'b1', pg_temp.facturar(kb, 'DTD-B001'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(v_r ->> 'error_b' is null and not (v_r ->> 'espero')::boolean
      and v_r ->> 'a' is not null and v_r ->> 'b' is not null,
    format('REAL 3: dos tenants a la vez: %s', v_r));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0564 carrera OK: % aserciones; dos facturaciones a la vez no comparten número ni duplican cliente',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0564 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0564')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0564 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
