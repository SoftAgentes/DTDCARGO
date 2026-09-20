\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0464 (SDD-0484): dos confirmaciones
-- simultáneas sobre la misma factura no acreditan dos veces el saldo. Base
-- propia y desechable dentro del contenedor del runner: nunca consulta ni
-- modifica una base alojada.
--
-- POR QUÉ: la 0464 hace que confirmar sobre una factura ya pagada devuelva
-- PAYMENT_INVOICE_PAID. Esa regla sólo aguanta dos confirmaciones a la vez
-- porque la factura se toma FOR UPDATE antes de leer su saldo: la segunda
-- espera, relee la factura ya pagada y se rechaza. El contrato de la 0464 corre
-- en una sola sesión, y la carrera real vivía en scripts/qa/payment-report-confirm-race.mjs,
-- que no corre en verify.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0459 y
-- 0460). El archivo corre en la base `postgres` del runner y, con dblink, abre
-- tres sesiones contra una base propia (dtd_carrera_0464): `s` prepara y
-- observa, `a` confirma el primer reporte y deja la transacción abierta, y `b`
-- confirma el segundo, en asíncrono. Cada carrera exige ver
-- pg_blocking_pids(b) con `a` adentro antes de que `a` confirme: la barrera es
-- determinista, sin sleep que calibrar.
--
-- FIXTURE: el del contrato 0421 en modo fixture_only, como el script. Se lee su
-- sección entre `begin;` y el bloque «Sólo para un segundo PostgreSQL» con
-- pg_read_file, cada `\ir` se reemplaza por la migración que incluye y
-- `\if :apply_fix` se resuelve en verdadero. Si el contrato cambia de forma,
-- este archivo falla en vez de probar sobre otro fixture. Encima se siembran
-- dos facturas de 1000 con 20 pagados y dos reportes de 980 cada una.
--
-- Lo que defiende, con el escenario del script:
--   CONTROL, antes de la 0464 (la función de la 0421): la misma carrera
--   acredita las dos confirmaciones y la factura queda en 1980 sobre 1000. Si
--   no pasa, la carrera no se ejerce y el test falla: el verde no puede ser
--   vacío.
--   Con la 0464 aplicada: la segunda confirmación espera a la primera y recibe
--   PAYMENT_INVOICE_PAID. Pagado 1000, un solo reporte confirmado y un solo
--   recibo.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutante fuera del repo, ver .agents/handoffs/0484-carrera-saldo-0464.md):
-- la 0464 sin el FOR UPDATE de la factura en la confirmación hace fallar este
-- archivo: la segunda confirma con el saldo viejo.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0464 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0464 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0464_%s',
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
    if v_conn like 'c0464\_%' then
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
      'drop database if exists dtd_carrera_0464 with (force)');
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
    raise exception 'TEST 0464 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0464 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0464 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0464 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0464 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- El id de una etiqueta del fixture, igual que pg_temp.fixture_id del contrato 0421.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0421-synthetic-' || p_label)::uuid
$$;

-- El fixture del contrato 0421 con la 0421 aplicada (todavía sin la 0464) y las
-- dos facturas de la carrera, en UNA transacción explícita: si algo falla, no
-- queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0421_payment_report_commands.test.sql',
      E'\nbegin;\n\\endif\n', E'\n-- Sólo para un segundo PostgreSQL desechable', '{"apply_fix": true}'),
    -- Como el script: factura de 1000 con 20 pagados y dos reportes de 980.
    (select string_agg(format($f$
      insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name,
        base_amount, total_amount, paid_amount, status, currency)
      values (%1$L, %2$L, %3$L, 'DUP', 'synthetic', 1000, 1000, 20, 'emitida', 'USD');
      insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox,
        amount, currency, method, paid_at, note, proof_path)
      select md5('0421-synthetic-' || r)::uuid, %2$L, %1$L, %3$L, 'DUP', 980, 'USD',
        'transferencia', current_date - 1, 'Nota sintética', 'carrera/' || r || '.pdf'
        from unnest(array[%4$L, %5$L]) as r;$f$,
        pg_temp.id(f.factura), pg_temp.id('tenant-A'), f.codigo, f.factura || '-1', f.factura || '-2'), E'\n')
       from (values ('saldo-control', 'F-SALDO-CONTROL'), ('saldo', 'F-SALDO')) as f(factura, codigo)),
    'commit;');
end;
$$;

-- Abre la transacción de una sesión; con actor, como ese usuario autenticado.
create function pg_temp.abrir(p_conn text, p_actor text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  if p_actor is not null then
    perform dblink_exec(p_conn, 'set local role authenticated');
    perform * from dblink(p_conn, format(
      $q$select set_config('request.jwt.claim.sub', %L, true)$q$, pg_temp.id(p_actor))) as t(x text);
  end if;
end;
$$;

-- Una carrera: `a` corre p_a_sql y deja la transacción abierta; `b` corre
-- p_b_sql en asíncrono. Devuelve si `b` esperó a `a` (y en qué tipo de lock),
-- lo que devolvió cada uno y el error de `b`, si lo hubo.
create function pg_temp.carrera(p_a_actor text, p_a_sql text, p_b_actor text, p_b_sql text)
returns jsonb language plpgsql as $$
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
  select pid into v_a from dblink('c0464_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0464_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0464_a', p_a_actor);
  select r into v_ra from dblink('c0464_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0464_b', p_b_actor);
  perform pg_temp.afirmar(dblink_send_query('c0464_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0464_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0464 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0464_a', 'commit');
  -- Un error de `b` es un resultado esperado: se guarda, no se reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0464_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0464_b');
  end if;
  perform * from dblink_get_result('c0464_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0464_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Confirmar un reporte, como en el script: accounting-A, resolve_payment_report.
create function pg_temp.confirmar(p_reporte text, p_n integer) returns text language sql as $$
  select format($q$select public.resolve_payment_report(%L, %L, 'confirmado', %L)::text$q$,
    pg_temp.id(p_reporte || '-solicitud'), pg_temp.id(p_reporte), 'Carrera sesión ' || p_n)
$$;

-- Cómo quedó una factura de la carrera: pagado, reportes confirmados y recibos.
create function pg_temp.factura(p_factura text) returns jsonb language sql as $$
  select r::jsonb from dblink('c0464_s', format($q$select jsonb_build_object(
      'pagado', (select paid_amount from public.invoices where id = %1$L),
      'confirmados', (select count(*) from public.payment_reports
                       where invoice_id = %1$L and status = 'confirmado'),
      'recibos', (select count(*) from payment_private.report_commands
                   where request_id in (%2$L, %3$L)))::text$q$,
    pg_temp.id(p_factura), pg_temp.id(p_factura || '-1-solicitud'), pg_temp.id(p_factura || '-2-solicitud')))
    as t(r text)
$$;

do $carrera$
declare
  v_r jsonb;
  v_f jsonb;
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0464 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0464 template template0');
  perform dblink_connect('c0464_s', pg_temp.conn('dtd_carrera_0464', 's'));
  perform dblink_connect('c0464_a', pg_temp.conn('dtd_carrera_0464', 'a'));
  perform dblink_connect('c0464_b', pg_temp.conn('dtd_carrera_0464', 'b'));
  perform dblink_exec('c0464_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0464_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0464_b', $t$set statement_timeout = '30s'$t$);

  -- CONTROL, antes de la 0464: la misma carrera acredita dos veces.
  v_r := pg_temp.carrera('accounting-A', pg_temp.confirmar('saldo-control-1', 1),
                         'accounting-A', pg_temp.confirmar('saldo-control-2', 2));
  v_f := pg_temp.factura('saldo-control');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' is null
      and (v_f ->> 'pagado')::numeric = 1980 and (v_f ->> 'confirmados')::integer = 2,
    format('CONTROL sin la 0464: la segunda confirmación tenía que esperar y acreditar otra vez (1980); si no, la carrera no se ejerce: %s / %s',
      v_r, v_f));

  -- La 0464 entera, como la aplica el runbook.
  perform dblink_exec('c0464_s', pg_read_file('/sb/migrations/0464_reporte_pago_factura_pagada.sql'));

  -- Con la 0464: la segunda confirmación se rechaza.
  v_r := pg_temp.carrera('accounting-A', pg_temp.confirmar('saldo-1', 1),
                         'accounting-A', pg_temp.confirmar('saldo-2', 2));
  v_f := pg_temp.factura('saldo');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('saldo: la segunda confirmación tenía que esperar a la primera (¿falta el FOR UPDATE de la factura?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'error_b' like '%PAYMENT_INVOICE_PAID%',
    format('saldo: la segunda confirmación tenía que recibir PAYMENT_INVOICE_PAID: %s / %s', v_r, v_f));
  perform pg_temp.afirmar((v_f ->> 'pagado')::numeric = 1000 and (v_f ->> 'confirmados')::integer = 1
      and (v_f ->> 'recibos')::integer = 1,
    format('saldo: tiene que quedar pagado 1000, un reporte confirmado y un recibo: %s / %s', v_r, v_f));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0464 carrera OK: % aserciones; sin la 0464 se acredita dos veces y con ella la segunda confirmación se rechaza',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0464 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0464')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0464 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
