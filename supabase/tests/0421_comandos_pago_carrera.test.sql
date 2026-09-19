\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0421 (SDD-0365): los bloqueos de
-- payment_private.run_report_command(), probados con sesiones reales, sobre la
-- versión que queda en producción (la 0421 más la 0464, que reemplaza la
-- función y conserva sus bloqueos). Base propia y desechable dentro del
-- contenedor del runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: el contrato 0421_payment_report_commands.test.sql corre en una sola
-- sesión y lo dice: «El bloqueo concurrente se verifica además con sesiones
-- PostgreSQL separadas». Esas carreras vivían en scripts/test-payment-report-commands.mjs
-- de la PR #21, que nunca entró a main, así que ningún test las corría.
-- La función promete:
--   · FOR UPDATE de la factura antes que del reporte: dos altas que compiten
--     por el último cupo de pendientes se serializan, y la segunda ve el cupo
--     lleno;
--   · un advisory lock por request_id: la misma solicitud repetida a la vez
--     espera a la primera y la reproduce; con otros datos sobre otra factura,
--     espera y recibe PAYMENT_REQUEST_CONFLICT;
--   · FOR SHARE de la autorización («bloquea revocaciones, también UPDATE
--     no-key»): un alta que llega durante la revocación de su vínculo del
--     Portal, o una resolución que llega durante la baja de su usuario
--     financiero, espera y, al releer, ya no tiene permiso.
-- La carrera del saldo entre dos confirmaciones es de la 0464 y ya la cubre
-- scripts/qa/payment-report-confirm-race.mjs: acá no se repite.
--
-- CÓMO: igual que 0459_relevo_carrera_for_update y 0460_retencion_carrera_skip_locked.
-- El archivo corre en la base `postgres` del runner y, con dblink, abre tres
-- sesiones contra una base propia (dtd_carrera_0421): `s` prepara y observa,
-- `a` toma el bloqueo y deja la transacción abierta, y `b` llega después, en
-- asíncrono. Cada caso exige ver pg_blocking_pids(b) con `a` adentro antes de
-- que `a` confirme: la barrera es determinista, sin sleep que calibrar, y un
-- escenario sin carrera falla en vez de pasar vacío.
--
-- FIXTURE: el del contrato 0421 en modo fixture_only, con sus usuarios,
-- facturas, reportes y comprobantes sintéticos. Se lee su sección entre
-- `begin;` y el bloque «Sólo para un segundo PostgreSQL» con pg_read_file, cada
-- `\ir` se reemplaza por la migración que incluye y `\if :apply_fix` se
-- resuelve en verdadero; después va la 0464 entera. Otro meta-comando de psql,
-- o una sección que ya no se encuentra, hace fallar este archivo en vez de
-- probar sobre otro fixture.
--
-- Lo que defiende:
--   1. Último cupo: con cuatro pendientes, dos altas a la vez → una entra y la
--      otra recibe PAYMENT_PENDING_LIMIT. Quedan cinco pendientes y cinco recibos.
--   2. La misma solicitud dos veces: la segunda espera en el advisory lock y
--      reproduce la primera, con el mismo evento. Queda un solo evento.
--   3. La misma solicitud con otros datos, sobre otra factura: la segunda
--      espera en el advisory lock y recibe PAYMENT_REQUEST_CONFLICT, sin crear
--      nada.
--   4. Revocación del Portal en curso: el alta espera y recibe
--      PAYMENT_FORBIDDEN, sin reporte.
--   5. Baja financiera en curso: la resolución espera y recibe
--      PAYMENT_FORBIDDEN; el reporte sigue `reportado`.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0464 fuera del repo, ver .agents/handoffs/carrera-0421-0427.md):
-- sin el FOR UPDATE de la factura en el alta, sin el advisory lock, o sin
-- alguno de los dos FOR SHARE de autorización, este archivo falla.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0421 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0421 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0421_%s',
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
    if v_conn like 'c0421\_%' then
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
      'drop database if exists dtd_carrera_0421 with (force)');
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
    raise exception 'TEST 0421 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0421 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0421 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0421 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0421 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- El id de una etiqueta del fixture, igual que pg_temp.fixture_id del contrato.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0421-synthetic-' || p_label)::uuid
$$;

-- El path de un comprobante, igual que pg_temp.proof_path del contrato.
create function pg_temp.comprobante(p_tenant text, p_invoice text, p_report text) returns text
language sql immutable as $$
  select pg_temp.id(p_tenant)::text || '/' || pg_temp.id(p_invoice)::text || '/'
    || pg_temp.id(p_report)::text || '/' || pg_temp.id('object')::text || '.pdf'
$$;

-- El fixture del contrato con la 0421 aplicada, y la 0464 encima, en UNA
-- transacción explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0421_payment_report_commands.test.sql',
      E'\nbegin;\n\\endif\n', E'\n-- Sólo para un segundo PostgreSQL desechable', '{"apply_fix": true}'),
    pg_read_file('/sb/migrations/0464_reporte_pago_factura_pagada.sql'),
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
  select pid into v_a from dblink('c0421_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0421_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0421_a', p_a_actor);
  select r into v_ra from dblink('c0421_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0421_b', p_b_actor);
  perform pg_temp.afirmar(dblink_send_query('c0421_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0421_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0421 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0421_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0421_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0421_b');
  end if;
  perform * from dblink_get_result('c0421_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0421_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0421_s', p_sql) as t(r text)
$$;

-- Un alta desde el Portal, como la llama el script original de la PR #21.
create function pg_temp.alta(p_solicitud text, p_reporte text, p_factura text,
  p_tenant text default 'tenant-A', p_codigo text default 'F-CMD-SHARED') returns text
language sql as $$
  select format($q$select public.create_portal_payment_report(%L, %L, %L, 100, 'otro',
    current_date - 1, %L, 'Nota sintética')::text$q$,
    pg_temp.id(p_solicitud), pg_temp.id(p_reporte), p_codigo,
    pg_temp.comprobante(p_tenant, p_factura, p_reporte))
$$;

create function pg_temp.resolver(p_solicitud text, p_reporte text, p_accion text) returns text
language sql as $$
  select format($q$select public.resolve_payment_report(%L, %L, %L, 'Revisión sintética')::text$q$,
    pg_temp.id(p_solicitud), pg_temp.id(p_reporte), p_accion)
$$;

do $carrera$
declare
  v_r jsonb;
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0421 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0421 template template0');
  perform dblink_connect('c0421_s', pg_temp.conn('dtd_carrera_0421', 's'));
  perform dblink_connect('c0421_a', pg_temp.conn('dtd_carrera_0421', 'a'));
  perform dblink_connect('c0421_b', pg_temp.conn('dtd_carrera_0421', 'b'));
  perform dblink_exec('c0421_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0421_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0421_b', $t$set statement_timeout = '30s'$t$);

  -- 1. Último cupo: cuatro pendientes y dos altas a la vez.
  for n in 1..4 loop
    perform pg_temp.abrir('c0421_a', 'portal-A');
    perform * from dblink('c0421_a',
      pg_temp.alta('cap-' || n, 'limit-' || n, 'invoice-limit', 'tenant-A', 'F-LIMIT')) as t(r text);
    perform dblink_exec('c0421_a', 'commit');
  end loop;
  v_r := pg_temp.carrera(
    'portal-A', pg_temp.alta('cap-5', 'limit-5', 'invoice-limit', 'tenant-A', 'F-LIMIT'),
    'portal-A', pg_temp.alta('cap-6', 'limit-6', 'invoice-limit', 'tenant-A', 'F-LIMIT'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'error_b' like '%PAYMENT_PENDING_LIMIT%',
    format('último cupo: la segunda alta tenía que esperar a la primera y recibir PAYMENT_PENDING_LIMIT (¿falta el FOR UPDATE de la factura?): %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format($q$select count(*)::text from public.payment_reports
      where invoice_id = %L and status = 'reportado' and deleted_at is null and cancelled_at is null$q$,
      pg_temp.id('invoice-limit'))) = '5'
    and pg_temp.ver(format($q$select count(*)::text from payment_private.report_commands
      where report_id in (select id from public.payment_reports where invoice_id = %L)$q$,
      pg_temp.id('invoice-limit'))) = '5',
    format('último cupo: tienen que quedar cinco pendientes y cinco recibos: %s', v_r));

  -- 2. La misma solicitud dos veces.
  v_r := pg_temp.carrera('portal-A', pg_temp.alta('repeat-request', 'new-A', 'invoice-A'),
                         'portal-A', pg_temp.alta('repeat-request', 'new-A', 'invoice-A'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory',
    format('misma solicitud: la segunda tenía que esperar en el advisory lock de la solicitud: %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'error_b' is null
      and (v_r ->> 'a')::jsonb ->> 'replayed' = 'false' and (v_r ->> 'b')::jsonb ->> 'replayed' = 'true'
      and (v_r ->> 'a')::jsonb -> 'audit_event_id' = (v_r ->> 'b')::jsonb -> 'audit_event_id',
    format('misma solicitud: la segunda tiene que reproducir la primera, con el mismo evento: %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format(
      $q$select count(*)::text from public.entity_audit_log where correlation_id = %L$q$,
      pg_temp.id('repeat-request'))) = '1',
    'misma solicitud: tiene que quedar un solo evento para la solicitud');

  -- 3. La misma solicitud con otros datos, sobre otra factura.
  v_r := pg_temp.carrera('portal-A', pg_temp.alta('conflict-request', 'confirm-A', 'invoice-A'),
    'portal-A', pg_temp.alta('conflict-request', 'overpay-A', 'invoice-overpay', 'tenant-A', 'F-OVERPAY'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'lock' = 'advisory'
      and v_r ->> 'error_b' like '%PAYMENT_REQUEST_CONFLICT%',
    format('solicitud con otros datos: la segunda tenía que esperar en el advisory lock y recibir PAYMENT_REQUEST_CONFLICT: %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format(
      $q$select count(*)::text from public.payment_reports where id = %L$q$, pg_temp.id('overpay-A'))) = '0'
    and pg_temp.ver(format($q$select count(*)::text from payment_private.report_commands where request_id = %L$q$,
      pg_temp.id('conflict-request'))) = '1',
    format('solicitud con otros datos: la segunda no puede crear nada: %s', v_r));

  -- 4. Revocación del Portal en curso.
  v_r := pg_temp.carrera(null, format($q$with u as (update public.client_users set status = 'revoked'
      where auth_user_id = %L and status = 'active' returning 1) select count(*)::text from u$q$,
      pg_temp.id('portal-B')),
    'portal-B', pg_temp.alta('revoke-request', 'new-B', 'invoice-B', 'tenant-B'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'a' = '1'
      and v_r ->> 'error_b' like '%PAYMENT_FORBIDDEN%',
    format('revocación del Portal: el alta tenía que esperar a la revocación y recibir PAYMENT_FORBIDDEN (¿falta el FOR SHARE del vínculo?): %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format(
      $q$select count(*)::text from public.payment_reports where id = %L$q$, pg_temp.id('new-B'))) = '0',
    format('revocación del Portal: el alta no puede dejar reporte: %s', v_r));

  -- 5. Baja financiera en curso.
  v_r := pg_temp.carrera(null, format($q$with u as (update public.user_tenants set disabled_at = now()
      where user_id = %L and disabled_at is null returning 1) select count(*)::text from u$q$,
      pg_temp.id('admin-A')),
    'admin-A', pg_temp.resolver('disabled-request', 'new-A', 'rechazado'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'a' = '1'
      and v_r ->> 'error_b' like '%PAYMENT_FORBIDDEN%',
    format('baja financiera: la resolución tenía que esperar a la baja y recibir PAYMENT_FORBIDDEN (¿falta el FOR SHARE de la membresía?): %s', v_r));
  perform pg_temp.afirmar(pg_temp.ver(format(
      $q$select status::text from public.payment_reports where id = %L$q$, pg_temp.id('new-A'))) = 'reportado',
    format('baja financiera: el reporte tiene que seguir reportado: %s', v_r));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0421 carrera OK: % aserciones; último cupo, solicitud repetida o en conflicto, y revocaciones en curso',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0421 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0421')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0421 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
