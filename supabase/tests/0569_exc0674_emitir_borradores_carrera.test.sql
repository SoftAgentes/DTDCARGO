\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0569 (SDD-0690, EXC-0674 ampliada a pre-orden): dos emisiones
-- simultáneas desde Embarques. Corre en una base propia y desechable dentro del contenedor del runner, y
-- nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: un cliente del contenedor se factura una sola vez, por pre-orden (0569) o por monto tecleado
-- (0564). exc0674_emitir_borradores toma los mismos locks consultivos de la 0564 (numeración por tenant
-- y uno por tenant, contenedor y cliente), así que las dos RPC van en fila y la segunda sale con un
-- error claro (exc0674:ya_facturado, o exc0674:tiene_preorden si el tecleado ve la pre-orden viva). El
-- contrato de una sola sesión no puede probarlo.
--
-- CÓMO: el patrón de la carrera 0564. El archivo corre en la base `postgres` del runner y, con dblink,
-- abre tres sesiones contra una base propia (dtd_carrera_0569):
--   · `s` prepara y observa;
--   · `a` emite (o factura) primero y deja la transacción abierta;
--   · `b` emite (o factura) después, en asíncrono.
-- La barrera mira si `b` queda esperando a `a` (pg_blocking_pids) y en qué tipo de lock.
--
-- Escenarios (clientes DTD-C001 a DTD-C009 del K64, cada uno con su pre-orden; DTD-C009 lo agrega el
-- escenario 1):
--   1. Pre-orden viva (0569) y monto tecleado (exc0674_facturar con la guarda de la 0569) del mismo cliente a
--      la vez. El tecleado nunca emite: sale con tiene_preorden o con ya_facturado, y queda una sola factura
--      emitida (la pre-orden, con su código y su total) y una sola fila viva del rastro, de origen borrador.
--      a. La pre-orden llega primero.
--         · Control: la 0569 sin sus locks consultivos. `b` (tecleado) no espera y lo frena la guarda.
--         · Real: `b` espera en el lock consultivo y sale con exc0674:ya_facturado.
--      b. El tecleado llega primero.
--         · Control: exc0674_facturar sin la guarda (la de la 0564). El tecleado emite y la pre-orden queda
--           en borrador y sale ya facturada: lo que el real prueba que ya no pasa.
--         · Real: `a` falla con exc0674:tiene_preorden y retiene sus locks consultivos hasta el rollback;
--           la pre-orden espera en ellos y se emite.
--   2. Al revés: pre-orden primero y monto tecleado después. Gana la pre-orden.
--   3. La misma pre-orden dos veces (doble clic o dos pestañas). Una sola emisión.
--   4. Dos clientes distintos del mismo tenant: `b` espera y las dos se emiten.
--   5. Dos tenants distintos: no se esperan.
--
-- FIXTURE: el del contrato 0569_exc0674_emitir_borradores.test.sql, leído de su archivo hasta sus
-- aserciones. Trae las réplicas mínimas, los triggers copiados, la 0564, la 0569 y las pre-órdenes.
--
-- SIN HUELLA: la base propia y los roles anon, authenticated y service_role se borran también cuando algo
-- falla. dblink se crea dentro de la transacción del archivo y se va con el rollback.

begin;

do $guard$
begin
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0569 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0569 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0569_%s',
    split_part(current_setting('unix_socket_directories'), ',', 1),
    current_setting('port'), p_base, current_user, p_sesion)
$$;

create function pg_temp.limpiar() returns text language plpgsql as $$
declare
  v_conn text;
  v_restos text := '';
begin
  foreach v_conn in array coalesce(dblink_get_connections(), '{}') loop
    if v_conn like 'c0569\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0569 with (force)');
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
  v_txt text := pg_read_file('/sb/tests/0569_exc0674_emitir_borradores.test.sql');
  v_desde text := E'\nbegin;\n';
  v_hasta text := E'\n-- ── Aserciones';
  v_ini integer := position(v_desde in v_txt);
  v_fin integer;
  v_linea text;
  v_salida text[] := '{}';
begin
  if v_ini = 0 then raise exception 'TEST 0569 carrera: no encuentro el inicio del fixture'; end if;
  v_txt := substr(v_txt, v_ini + length(v_desde));
  v_fin := position(v_hasta in v_txt);
  if v_fin = 0 then raise exception 'TEST 0569 carrera: no encuentro el fin del fixture'; end if;
  foreach v_linea in array string_to_array(left(v_txt, v_fin - 1), E'\n') loop
    if v_linea ~ '^\\ir \.\./migrations/[0-9A-Za-z_]+\.sql\s*$' then
      v_salida := v_salida || pg_read_file('/sb/migrations/'
        || substring(v_linea from '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)'));
    elsif v_linea ~ '^\s*\\' then
      raise exception 'TEST 0569 carrera: meta-comando de psql que no sé expandir: %', v_linea;
    else
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  return concat_ws(E'\n', 'begin;', array_to_string(v_salida, E'\n'), 'commit;');
end;
$$;

create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0569_s', p_sql) as t(r text)
$$;

-- Usuarios del contrato: a5 accounting del tenant A, b1 accounting del tenant B.
create function pg_temp.uid(p_quien text) returns text language sql immutable as $$
  select case p_quien when 'a5' then '00000000-0000-4000-8000-00000000a005'
                      when 'b1' then '00000000-0000-4000-8000-00000000b001' end
$$;

-- La pre-orden del cliente DTD-C00n del fixture.
create function pg_temp.preorden(p_n integer) returns text language sql immutable as $$
  select md5('0569-f' || p_n)::uuid::text
$$;

-- Las RPC como las llaman las server actions, y el código de la factura de vuelta.
create function pg_temp.emitir(p_cons text, p_invoice text) returns text language sql as $$
  select format($q$select public.exc0674_emitir_borradores(%L::uuid, array[%L]::uuid[], 'Confirmado') -> 'facturas' -> 0 ->> 'invoice_code'$q$,
    p_cons, p_invoice)
$$;
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
  select pid into v_a from dblink('c0569_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0569_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0569_a', p_a);
  select r into v_ra from dblink('c0569_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0569_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0569_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0569_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0569 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0569_a', 'commit');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0569_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0569_b');
  end if;
  perform * from dblink_get_result('c0569_b', false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0569_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Escenario 1: como carrera(), pero la sesión `a` puede fallar. Su error se guarda en error_a y `a` termina
-- con rollback (los locks consultivos que tomó antes del error siguen tomados hasta entonces).
create function pg_temp.carrera_a_falla(p_a text, p_a_sql text, p_b text, p_b_sql text) returns jsonb
language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_lock text;
  v_ra text;
  v_error_a text;
  v_rb text;
  v_error text;
  v_avisos text := current_setting('client_min_messages');
begin
  select pid into v_a from dblink('c0569_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0569_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0569_a', p_a);
  perform set_config('client_min_messages', 'warning', true);
  select r into v_ra from dblink('c0569_a', p_a_sql, false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  if v_ra is null then
    v_error_a := dblink_error_message('c0569_a');
  end if;
  perform pg_temp.abrir('c0569_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0569_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0569_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0569 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0569_a', 'rollback');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0569_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0569_b');
  end if;
  perform * from dblink_get_result('c0569_b', false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0569_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'error_a', v_error_a, 'b', v_rb,
                            'error_b', v_error);
end;
$$;

-- Escenario 1: del cliente DTD-C00n queda una sola factura emitida, la pre-orden, con su código y su total
-- intactos, y una sola fila viva del rastro, de origen borrador y de esa pre-orden.
create function pg_temp.una_sola(p_n integer) returns boolean language sql as $$
  select pg_temp.ver(format($q$
    select concat_ws('|',
      (select count(*) from public.invoices where client_markbox = %1$L and status = 'emitida'),
      (select invoice_code || ':' || total_amount || ':' || status from public.invoices where id = %2$L),
      (select string_agg(origen_monto || ':' || invoice_id, ',') from public.exc0674_facturas
        where client_markbox = %1$L and anulada_at is null))$q$,
    'DTD-C00' || p_n, pg_temp.preorden(p_n)))
    = format('1|F-1999-02%s:11.60:emitida|borrador:%s', lpad(p_n::text, 2, '0'), pg_temp.preorden(p_n))
$$;

create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0569_b') = 1 then
    perform dblink_cancel_query('c0569_b');
  end if;
  perform * from dblink_get_result('c0569_b', false) as t(r text);
  perform * from dblink_get_result('c0569_b', false) as t(r text);
  perform dblink_exec('c0569_b', 'rollback', false);
  perform dblink_exec('c0569_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

do $carrera$
declare
  k64 constant text := '00000000-0000-4000-8000-00000000c064';
  kb  constant text := '00000000-0000-4000-8000-00000000cb64';
  v_rpc text;
  v_fac text;
  v_ini integer;
  v_fin integer;
  v_r jsonb;
  v_restos text;
begin
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0569 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0569 template template0');
  perform dblink_connect('c0569_s', pg_temp.conn('dtd_carrera_0569', 's'));
  perform dblink_connect('c0569_a', pg_temp.conn('dtd_carrera_0569', 'a'));
  perform dblink_connect('c0569_b', pg_temp.conn('dtd_carrera_0569', 'b'));
  perform dblink_exec('c0569_s', pg_temp.fixture());
  perform dblink_exec('c0569_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0569_b', $t$set statement_timeout = '30s'$t$);

  v_rpc := pg_temp.ver($q$select pg_get_functiondef('public.exc0674_emitir_borradores(uuid,uuid[],text)'::regprocedure)$q$);
  perform pg_temp.afirmar(position('exc0674:numeracion:' in v_rpc) > 0, 'la RPC aplicada no tiene el lock de numeración');
  perform pg_temp.afirmar(position($q$'exc0674:' || v_tenant::text || ':' || p_consolidation_id::text$q$ in v_rpc) > 0,
    'la RPC aplicada no tiene el lock por cliente de la 0564');

  -- 1. Pre-orden viva y monto tecleado del mismo cliente a la vez. Con la guarda de la 0569 el tecleado
  --    nunca emite: sale con tiene_preorden o con ya_facturado, y queda una sola factura emitida (la
  --    pre-orden, con su código y su total) y una sola fila viva del rastro, de origen borrador.
  -- DTD-C009, solo para este escenario: un embarque vigente en el K64 y su pre-orden.
  perform dblink_exec('c0569_s', $f$
    insert into public.clients (id, tenant_id, markbox, name)
      values (md5('0569-c9')::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C009', 'Cliente Carrera 9');
    insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3)
      values (md5('0569-e9')::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C009-01', 'DTD-C009', 1);
    insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at)
      values ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', md5('0569-e9')::uuid,
              now() - interval '2 days');
    insert into public.invoices
      (id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency,
       iva_rate, base_amount, iva_amount, total_amount, status, lines, notes, fund_class)
      values (md5('0569-f9')::uuid, '00000000-0000-4000-8000-0000000000a0', 'F-1999-0209', 'DTD-C009', 'Cliente Carrera 9',
              md5('0569-e9')::uuid, 'DTD-C009-01', 'USD', 16, 10, 1.60, 11.60, 'borrador', '[]', 'Lote de prueba', 'third_party')
  $f$);
  v_fac := pg_temp.ver($q$select pg_get_functiondef('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure)$q$);
  perform pg_temp.afirmar(position('exc0674:tiene_preorden:' in v_fac) > 0,
    'la exc0674_facturar aplicada no tiene la guarda de pre-orden de la 0569');

  -- 1a. CONTROL: la pre-orden primero, con la 0569 sin sus locks consultivos. `b` (tecleado) ya no hace fila
  --     detrás de `a`: no espera y lo frena la guarda, que lee la pre-orden todavía en borrador.
  perform dblink_exec('c0569_s', regexp_replace(v_rpc,
    E'perform pg_catalog\\.pg_advisory_xact_lock\\([^;]*\\);', '', 'g'));
  perform pg_temp.afirmar(
    position('pg_advisory_xact_lock' in pg_temp.ver($q$select pg_get_functiondef('public.exc0674_emitir_borradores(uuid,uuid[],text)'::regprocedure)$q$)) = 0,
    'el control no quitó los locks');
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(1)), 'a5', pg_temp.facturar(k64, 'DTD-C001'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform dblink_exec('c0569_s', v_rpc);
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:tiene_preorden:DTD-C001%', false)
      and not (v_r ->> 'espero')::boolean and v_r ->> 'a' = 'F-1999-0201',
    format('CONTROL 1a: sin los locks, el tecleado no tenía que esperar y lo frenaba la guarda: %s', v_r));
  perform pg_temp.afirmar(pg_temp.una_sola(1), 'CONTROL 1a: quedó otra cosa que la pre-orden emitida');

  -- 1a. REAL: la pre-orden primero; el tecleado espera en el lock consultivo y sale ya facturado.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(2)), 'a5', pg_temp.facturar(k64, 'DTD-C002'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:ya_facturado:DTD-C002%', false)
      and (v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory' and v_r ->> 'a' = 'F-1999-0202',
    format('REAL 1a: pre-orden y monto tecleado a la vez: %s', v_r));
  perform pg_temp.afirmar(pg_temp.una_sola(2), 'REAL 1a: quedó otra cosa que la pre-orden emitida');

  -- 1b. CONTROL: el tecleado primero, con exc0674_facturar SIN la guarda (la 0564). El tecleado emite y la
  --     pre-orden queda en borrador: justo lo que el REAL 1b prueba que ya no pasa.
  v_ini := position('-- SDD-0690 (0569): si el cliente' in v_fac);
  v_fin := position($q$'exc0674:tiene_preorden:%', v_mb using errcode = '22023';$q$ in v_fac);
  perform pg_temp.afirmar(v_ini > 0 and v_fin > v_ini, 'el control no encuentra la guarda de pre-orden');
  v_fin := v_fin + position('end if;' in substr(v_fac, v_fin)) + length('end if;') - 1;
  perform dblink_exec('c0569_s', left(v_fac, v_ini - 1) || substr(v_fac, v_fin));
  perform pg_temp.afirmar(
    position('tiene_preorden' in pg_temp.ver($q$select pg_get_functiondef('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure)$q$)) = 0,
    'el control no quitó la guarda');
  begin
    v_r := pg_temp.carrera('a5', pg_temp.facturar(k64, 'DTD-C008'), 'a5', pg_temp.emitir(k64, pg_temp.preorden(8)));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform dblink_exec('c0569_s', v_fac);
  perform pg_temp.afirmar(
    position('exc0674:tiene_preorden:' in pg_temp.ver($q$select pg_get_functiondef('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure)$q$)) > 0,
    'el control no repuso la guarda');
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:ya_facturado:DTD-C008%', false)
      and v_r ->> 'a' is not null and v_r ->> 'a' <> 'F-1999-0208'
      and pg_temp.ver(format($q$select status from public.invoices where id = %L$q$, pg_temp.preorden(8))) = 'borrador'
      and not pg_temp.una_sola(8),
    format('CONTROL 1b: sin la guarda, el tecleado tenía que emitir delante de la pre-orden: %s', v_r));

  -- 1b. REAL: el tecleado primero. `a` falla con tiene_preorden pero, hasta su rollback, retiene los locks
  --     consultivos que tomó; la pre-orden espera en ellos y se emite.
  begin
    v_r := pg_temp.carrera_a_falla('a5', pg_temp.facturar(k64, 'DTD-C009'), 'a5', pg_temp.emitir(k64, pg_temp.preorden(9)));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_a' like '%exc0674:tiene_preorden:DTD-C009%', false)
      and v_r ->> 'a' is null and v_r ->> 'error_b' is null and v_r ->> 'b' = 'F-1999-0209'
      and (v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory',
    format('REAL 1b: monto tecleado y pre-orden a la vez: %s', v_r));
  perform pg_temp.afirmar(pg_temp.una_sola(9), 'REAL 1b: quedó otra cosa que la pre-orden emitida');

  -- 2. REAL: pre-orden primero; el monto tecleado sale ya facturado.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(3)), 'a5', pg_temp.facturar(k64, 'DTD-C003'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:ya_facturado:DTD-C003%', false)
      and (v_r ->> 'espero')::boolean and v_r ->> 'a' = 'F-1999-0203',
    format('REAL 2: pre-orden y monto tecleado a la vez: %s', v_r));
  perform pg_temp.afirmar(
    pg_temp.ver($q$select string_agg(origen_monto, ',') from public.exc0674_facturas where client_markbox = 'DTD-C003'$q$) = 'borrador'
    and pg_temp.ver($q$select count(*)::text from public.invoices where client_markbox = 'DTD-C003'$q$) = '1',
    'REAL 2: quedó más de una factura del cliente');

  -- 3. REAL: la misma pre-orden dos veces. Una sola emisión.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(4)), 'a5', pg_temp.emitir(k64, pg_temp.preorden(4)));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(coalesce(v_r ->> 'error_b' like '%exc0674:ya_facturado:DTD-C004%', false)
      and (v_r ->> 'espero')::boolean and v_r ->> 'a' = 'F-1999-0204',
    format('REAL 3: la misma pre-orden a la vez: %s', v_r));
  perform pg_temp.afirmar(
    pg_temp.ver($q$select count(*)::text from public.exc0674_facturas where client_markbox = 'DTD-C004'$q$) = '1'
    and pg_temp.ver($q$select count(*)::text from public.t_asientos a join public.invoices i on i.id = a.invoice_id
                        where i.client_markbox = 'DTD-C004'$q$) = '1',
    'REAL 3: quedó más de un rastro o más de un asiento');

  -- 4. REAL: dos clientes del mismo tenant. `b` espera y las dos se emiten con su propio código.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(5)), 'a5', pg_temp.emitir(k64, pg_temp.preorden(6)));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(v_r ->> 'error_b' is null and (v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory'
      and v_r ->> 'a' = 'F-1999-0205' and v_r ->> 'b' = 'F-1999-0206',
    format('REAL 4: dos clientes del mismo tenant a la vez: %s', v_r));

  -- 5. REAL: tenants distintos no se esperan.
  begin
    v_r := pg_temp.carrera('a5', pg_temp.emitir(k64, pg_temp.preorden(7)),
                           'b1', pg_temp.emitir(kb, '00000000-0000-4000-8000-0000000f0110'));
  exception when others then
    v_r := jsonb_build_object('excepcion', sqlerrm);
    perform pg_temp.reponer();
  end;
  perform pg_temp.afirmar(v_r ->> 'error_b' is null and not (v_r ->> 'espero')::boolean
      and v_r ->> 'a' = 'F-1999-0207' and v_r ->> 'b' = 'F-1999-0110',
    format('REAL 5: dos tenants a la vez: %s', v_r));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0569 carrera OK: % aserciones; una pre-orden y un monto tecleado del mismo cliente no se emiten los dos',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0569 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0569')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0569 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
