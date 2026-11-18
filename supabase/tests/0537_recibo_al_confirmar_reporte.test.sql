\set ON_ERROR_STOP on

-- Contrato de la migr 0537 (SDD-0630): confirmar un reporte de pago del portal
-- crea su recibo de cobro en la misma transacción, por register_collection_receipt.
-- Base propia y desechable dentro del contenedor del runner: nunca consulta ni
-- modifica una base alojada. Datos inventados.
--
-- CÓMO: igual que los otros archivos de carrera (0464, 0467). El archivo corre en
-- la base `postgres` del runner y, con dblink, abre tres sesiones contra una base
-- propia (dtd_carrera_0537): `s` prepara, observa y corre los casos de una sola
-- sesión; `a` corre la primera operación y deja su transacción abierta; `b` corre
-- la segunda en asíncrono. `b` termina o queda esperando a `a` según
-- pg_blocking_pids: no hay sleep que calibrar.
--
-- FIXTURE: el del contrato 0533 en modo fixture_only (con la 0533 aplicada), que
-- incluye el de la 0421. Se lee de su archivo con pg_read_file y se expande con
-- las mismas reglas que scripts/tests/fechas-caracas-postgrest.mjs › inlineContract
-- (\if, \else, \endif, \set, \ir anidados). Si el contrato cambia de forma, este
-- archivo falla en vez de probar sobre otro fixture.
--
-- QUÉ DEFIENDE:
--   CONTROL, antes de la 0537 (cuerpo de la 0533): confirmar sube paid_amount y
--   no crea recibo. Si no pasa, el defecto no se reproduce y el archivo falla.
--   Con la 0537:
--     R1  dos confirmaciones de la misma factura que juntas pasan el saldo: la
--         segunda espera y recibe PAYMENT_EXCEEDS_BALANCE. Un recibo.
--     R2  confirmación y cobro de Cobranzas a la vez, en los dos órdenes: el
--         segundo espera y se rechaza. Un recibo, sin doble conteo.
--     R3  la misma clave en dos sesiones (doble clic): la segunda espera y
--         devuelve el MISMO recibo como replay.
--     R4  confirmaciones de dos facturas del mismo tenant: la segunda espera el
--         correlativo y las dos salen con códigos R- distintos.
--   Después corre en `s` los casos de una sesión
--   (0537_recibo_al_confirmar_reporte.casos.sql) y aplica encima la 0422 y la
--   0423 (…despues.sql).
--
-- SIN HUELLA: la base propia y los roles anon, authenticated y service_role se
-- borran también cuando algo falla, antes de propagar el error. dblink se crea
-- dentro de la transacción del archivo y se va con el rollback.
--
-- RED: lib/portal/__tests__/payment-report-receipt.migration.test.ts corre tres
-- mutantes de la 0537 contra los casos. Los FOR UPDATE que serializan estas
-- carreras son los de la 0421/0464 y la 0467, que conservan sus propios mutantes.
--
-- Límite: requiere dblink (contrib de postgres:17) y el montaje /sb del runner.

begin;

do $guard$
begin
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0537 requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

create extension dblink;
create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0537 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0537_%s',
    split_part(current_setting('unix_socket_directories'), ',', 1),
    current_setting('port'), p_base, current_user, p_sesion)
$$;

create function pg_temp.limpiar() returns text language plpgsql as $$
declare
  v_conn text;
  v_restos text := '';
begin
  foreach v_conn in array coalesce(dblink_get_connections(), '{}') loop
    if v_conn like 'c0537\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0537 with (force)');
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

-- Expansor de un subconjunto de psql, con las reglas de inlineContract:
-- variables en exp_vars, salida en exp_out, \ir relativo al archivo que incluye.
create temporary table exp_vars (name text primary key, value text);
create temporary table exp_out (n bigserial primary key, line text);
create function pg_temp.expandir(p_ruta text) returns void language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/' || p_ruta);
  v_dir text := regexp_replace(p_ruta, '/[^/]*$', '');
  v_linea text;
  v_cmd text;
  v_resto text;
  v_val text;
  v_activo boolean[] := '{}';
  v_tomado boolean[] := '{}';
  v_todo boolean;
  v_destino text;
begin
  foreach v_linea in array string_to_array(v_txt, E'\n') loop
    v_linea := regexp_replace(v_linea, E'\r$', '');
    v_todo := not (false = any (v_activo));
    if v_linea !~ '^\\[A-Za-z_]+' then
      if v_todo then insert into exp_out (line) values (v_linea); end if;
      continue;
    end if;
    v_cmd := substring(v_linea from '^\\([A-Za-z_]+)');
    v_resto := btrim(substring(v_linea from '^\\[A-Za-z_]+\s*(.*)$'));
    if v_cmd = 'if' then
      if v_todo then
        if v_resto ~ '^:\{\?[A-Za-z_]+\}$' then
          v_val := (exists (select 1 from exp_vars where name = substring(v_resto from '^:\{\?([A-Za-z_]+)\}$')))::text;
        elsif v_resto ~ '^:[A-Za-z_]+$' then
          select value into v_val from exp_vars where name = substring(v_resto from 2);
        else
          v_val := v_resto;
        end if;
        if v_val is null or lower(v_val) !~ '^(true|false|on|off|t|f|yes|no|1|0)$' then
          raise exception 'TEST 0537: \if no booleano en %: %', p_ruta, v_linea;
        end if;
        v_tomado := v_tomado || (lower(v_val) ~ '^(true|on|t|yes|1)$');
      else
        v_tomado := v_tomado || false;
      end if;
      v_activo := v_activo || v_tomado[cardinality(v_tomado)];
    elsif v_cmd = 'else' then
      if cardinality(v_activo) = 0 then raise exception 'TEST 0537: \else sin \if en %', p_ruta; end if;
      -- Una rama padre inactiva no se activa por un \else hijo.
      v_activo[cardinality(v_activo)] := not v_tomado[cardinality(v_tomado)]
        and not (false = any (coalesce(v_activo[1:cardinality(v_activo) - 1], '{}')));
    elsif v_cmd = 'endif' then
      if cardinality(v_activo) = 0 then raise exception 'TEST 0537: \endif sin \if en %', p_ruta; end if;
      v_activo := v_activo[1:cardinality(v_activo) - 1];
      v_tomado := v_tomado[1:cardinality(v_tomado) - 1];
    elsif not v_todo then
      continue;
    elsif v_cmd = 'set' then
      if split_part(v_resto, ' ', 1) <> 'ON_ERROR_STOP' then
        v_val := split_part(v_resto, ' ', 2);
        if v_val like ':%' then select value into v_val from exp_vars where name = substring(v_val from 2); end if;
        insert into exp_vars values (split_part(v_resto, ' ', 1), v_val)
          on conflict (name) do update set value = excluded.value;
      end if;
    elsif v_cmd = 'ir' then
      v_destino := v_resto;
      if v_destino like '../%' then
        v_destino := regexp_replace(v_dir, '/?[^/]*$', '') || '/' || substring(v_destino from 4);
        v_destino := regexp_replace(v_destino, '^/', '');
      else
        v_destino := v_dir || '/' || v_destino;
      end if;
      perform pg_temp.expandir(v_destino);
    else
      raise exception 'TEST 0537: metaorden no soportada en %: %', p_ruta, v_linea;
    end if;
  end loop;
  if cardinality(v_activo) <> 0 then raise exception 'TEST 0537: \if sin cerrar en %', p_ruta; end if;
end;
$$;

create function pg_temp.fixture() returns text language plpgsql as $$
begin
  truncate exp_vars, exp_out;
  insert into exp_vars values ('fixture_only', 'true');
  perform pg_temp.expandir('tests/0533_fechas_caracas_operaciones.test.sql');
  return (select string_agg(line, E'\n' order by n) from exp_out);
end;
$$;

-- Etiquetas propias de la carrera y del fixture 0421/0533.
create function pg_temp.k(p text) returns uuid language sql immutable as $$ select md5('0630-carrera-' || p)::uuid $$;
create function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('0421-synthetic-' || p)::uuid $$;
create function pg_temp.caja() returns uuid language sql immutable as $$ select md5('0533-synthetic-cash')::uuid $$;

create function pg_temp.abrir(p_conn text, p_actor text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  perform dblink_exec(p_conn, 'set local role authenticated');
  perform * from dblink(p_conn, format(
    $q$select set_config('request.jwt.claim.sub', %L, true)$q$, pg_temp.id(p_actor))) as t(x text);
end;
$$;

create function pg_temp.carrera(p_a_sql text, p_b_sql text, p_b_actor text default 'admin-A') returns jsonb language plpgsql as $$
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
  select pid into v_a from dblink('c0537_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0537_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0537_a', 'accounting-A');
  select r into v_ra from dblink('c0537_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0537_b', p_b_actor);
  perform pg_temp.afirmar(dblink_send_query('c0537_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      exit;
    end if;
    exit when dblink_is_busy('c0537_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0537 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;
  perform dblink_exec('c0537_a', 'commit');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0537_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0537_b');
  end if;
  perform * from dblink_get_result('c0537_b', false) as t(r text);
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0537_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

create function pg_temp.confirmar(p_req text, p_rep text) returns text language sql as $$
  select format($q$select public.confirm_payment_report_with_receipt(%L, %L, %L, 'Carrera sintética')::text$q$,
    pg_temp.k(p_req), pg_temp.k(p_rep), pg_temp.caja())
$$;
create function pg_temp.cobrar(p_inv text, p_monto numeric) returns text language sql as $$
  select format($q$select public.register_collection_receipt(%L, %s, %L, 'transferencia', current_date,
    null, null, 'cliente', null, null, false)::text$q$, pg_temp.k(p_inv), p_monto, pg_temp.caja())
$$;
create function pg_temp.factura(p_inv text) returns jsonb language sql as $$
  select r::jsonb from dblink('c0537_s', format($q$select jsonb_build_object(
      'pagado', (select paid_amount from public.invoices where id = %1$L),
      'recibos', (select count(*) from public.payment_receipts where invoice_id = %1$L and deleted_at is null),
      'suma', (select coalesce(sum(amount), 0) from public.payment_receipts where invoice_id = %1$L and deleted_at is null),
      'confirmados', (select count(*) from public.payment_reports where invoice_id = %1$L and status = 'confirmado'))::text$q$,
    pg_temp.k(p_inv))) as t(r text)
$$;

do $carrera$
declare
  v_r jsonb;
  v_f jsonb;
  v_restos text;
  v_semilla text;
begin
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0537 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0537 template template0');
  perform dblink_connect('c0537_s', pg_temp.conn('dtd_carrera_0537', 's'));
  perform dblink_connect('c0537_a', pg_temp.conn('dtd_carrera_0537', 'a'));
  perform dblink_connect('c0537_b', pg_temp.conn('dtd_carrera_0537', 'b'));
  perform dblink_exec('c0537_s', pg_temp.fixture());
  perform dblink_exec('c0537_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0537_b', $t$set statement_timeout = '30s'$t$);

  -- Semilla de la carrera: facturas de 1000 sin pagar y sus reportes.
  select string_agg(format($f$
      insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name,
        base_amount, total_amount, paid_amount, status, currency)
      values (%1$L, %2$L, %3$L, 'DUP', 'synthetic', 1000, 1000, 0, 'emitida', 'USD');$f$,
      pg_temp.k(f), pg_temp.id('tenant-A'), 'F-0630-K-' || f), E'\n')
    into v_semilla
    from unnest(array['control', 'r1', 'r2', 'r2b', 'r3', 'r4', 'r5']) f;
  v_semilla := v_semilla || E'\n' || (select string_agg(format($f$
      insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox,
        amount, currency, method, paid_at, note, proof_path)
      values (%1$L, %2$L, %3$L, %4$L, 'DUP', %5$s, 'USD', 'transferencia', current_date - 1,
        'Nota sintética', 'carrera/' || %6$L || '.pdf');$f$,
      pg_temp.k(r), pg_temp.id('tenant-A'), pg_temp.k(f), 'F-0630-K-' || f, monto, r), E'\n')
    from (values ('rep-control', 'control', 300), ('rep-r1a', 'r1', 700), ('rep-r1b', 'r1', 700),
                 ('rep-r2', 'r2', 700), ('rep-r2b', 'r2b', 700), ('rep-r3', 'r3', 300),
                 ('rep-r4', 'r4', 100), ('rep-r5', 'r5', 100)) v(r, f, monto));
  perform dblink_exec('c0537_s', v_semilla);

  -- CONTROL, sin la 0537: confirmar suma el saldo y no deja recibo.
  perform dblink_exec('c0537_s', format($q$do $c$ begin
      perform set_config('request.jwt.claim.sub', %L, true);
      set local role authenticated;
      perform public.resolve_payment_report(%L, %L, 'confirmado', 'Control sin la 0537');
      reset role;
    end $c$;$q$, pg_temp.id('accounting-A'), pg_temp.k('req-control'), pg_temp.k('rep-control')));
  v_f := pg_temp.factura('control');
  perform pg_temp.afirmar((v_f ->> 'pagado')::numeric = 300 and (v_f ->> 'recibos')::integer = 0,
    format('CONTROL sin la 0537: confirmar tenía que sumar 300 sin recibo; si no, el defecto no se reproduce: %s', v_f));

  -- La 0537 entera, en una transacción, como la aplica el runbook.
  perform dblink_exec('c0537_s', 'begin;' || pg_read_file('/sb/migrations/0537_recibo_al_confirmar_reporte.sql') || E'\ncommit;');

  -- R1: dos confirmaciones que juntas pasan el saldo.
  v_r := pg_temp.carrera(pg_temp.confirmar('req-r1a', 'rep-r1a'), pg_temp.confirmar('req-r1b', 'rep-r1b'));
  v_f := pg_temp.factura('r1');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' like '%PAYMENT_EXCEEDS_BALANCE%',
    format('R1: la segunda confirmación tenía que esperar y recibir PAYMENT_EXCEEDS_BALANCE: %s', v_r));
  perform pg_temp.afirmar((v_f ->> 'pagado')::numeric = 700 and (v_f ->> 'recibos')::integer = 1
      and (v_f ->> 'suma')::numeric = 700 and (v_f ->> 'confirmados')::integer = 1,
    format('R1: pagado 700, un recibo y un reporte confirmado: %s', v_f));

  -- R2: confirmación primero, Cobranzas después.
  v_r := pg_temp.carrera(pg_temp.confirmar('req-r2', 'rep-r2'), pg_temp.cobrar('r2', 700));
  v_f := pg_temp.factura('r2');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' like '%PAYMENT_EXCEEDS_BALANCE%',
    format('R2: el cobro de Cobranzas tenía que esperar y rechazarse: %s', v_r));
  perform pg_temp.afirmar((v_f ->> 'pagado')::numeric = 700 and (v_f ->> 'recibos')::integer = 1 and (v_f ->> 'suma')::numeric = 700,
    format('R2: un solo recibo, sin doble conteo: %s', v_f));
  -- R2b: Cobranzas primero, confirmación después.
  v_r := pg_temp.carrera(pg_temp.cobrar('r2b', 700), pg_temp.confirmar('req-r2b', 'rep-r2b'));
  v_f := pg_temp.factura('r2b');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' like '%PAYMENT_EXCEEDS_BALANCE%',
    format('R2b: la confirmación tenía que esperar al cobro y rechazarse: %s', v_r));
  perform pg_temp.afirmar((v_f ->> 'pagado')::numeric = 700 and (v_f ->> 'recibos')::integer = 1
      and (v_f ->> 'confirmados')::integer = 0,
    format('R2b: un recibo, el reporte sigue pendiente: %s', v_f));

  -- R3: la misma clave en dos sesiones del mismo actor (doble clic).
  v_r := pg_temp.carrera(pg_temp.confirmar('req-r3', 'rep-r3'), pg_temp.confirmar('req-r3', 'rep-r3'), 'accounting-A');
  v_f := pg_temp.factura('r3');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' is null,
    format('R3: la segunda sesión con la misma clave tenía que esperar y no fallar: %s', v_r));
  perform pg_temp.afirmar(((v_r ->> 'b')::jsonb ->> 'replayed')::boolean
      and ((v_r ->> 'b')::jsonb -> 'receipt' ->> 'id') = (select r from dblink('c0537_s', format(
        'select id::text from public.payment_receipts where payment_report_id = %L', pg_temp.k('rep-r3'))) as t(r text)),
    format('R3: el reintento concurrente devuelve el mismo recibo como replay: %s', v_r));
  perform pg_temp.afirmar((v_f ->> 'recibos')::integer = 1 and (v_f ->> 'pagado')::numeric = 300,
    format('R3: un solo recibo y pagado 300: %s', v_f));

  -- R4: dos facturas del mismo tenant, correlativo serializado.
  v_r := pg_temp.carrera(pg_temp.confirmar('req-r4', 'rep-r4'), pg_temp.confirmar('req-r5', 'rep-r5'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' is null
      and ((v_r ->> 'a')::jsonb -> 'receipt' ->> 'code') <> ((v_r ->> 'b')::jsonb -> 'receipt' ->> 'code'),
    format('R4: la segunda espera el correlativo y sale con otro código R-: %s', v_r));

  -- Los casos de una sesión y la 0422/0423 encima, en Postgres 17 real.
  -- Terminan en un SELECT de resultado: dblink (no dblink_exec) devuelve la última fila.
  perform pg_temp.afirmar((select r from dblink('c0537_s',
      pg_read_file('/sb/tests/0537_recibo_al_confirmar_reporte.casos.sql')) as t(r text)) like 'TEST0537 casos OK:%',
    'los casos de una sesión terminan en verde');
  perform pg_temp.afirmar((select r from dblink('c0537_s',
      pg_read_file('/sb/tests/0537_recibo_al_confirmar_reporte.despues.sql')) as t(r text)) like 'TEST0537 después de 0422/0423 OK:%',
    'la 0422 y la 0423 encima terminan en verde');
  perform pg_temp.afirmar((select r::bigint from dblink('c0537_s', 'select last_value::text from r0537.aserciones') as t(r text)) > 40,
    'los casos de una sesión corrieron enteros');

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0537 OK: % aserciones de carrera, más los casos de una sesión y la 0422/0423 encima',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0537: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0537')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0537 dejó huella en el clúster';
  end if;
end;
$sin_huella$;
