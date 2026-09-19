\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0427 (SDD-0377): los bloqueos de
-- portal_address_private.delete_delivery_address(), probados con sesiones
-- reales. Base propia y desechable dentro del contenedor del runner: nunca
-- consulta ni modifica una base alojada.
--
-- POR QUÉ: el contrato 0427_portal_delete_delivery_address_command.test.sql
-- corre en una sola sesión, y su modo keep_fixture existía para ensayar la
-- concurrencia a mano. Esa prueba vivía en scripts/check-portal-address-concurrency.mjs,
-- que nunca entró a main, aunque la spec 0377 da la concurrencia por aceptada.
-- La función promete cosas que sólo se ven con dos sesiones:
--   · `FOR UPDATE` sobre la dirección: dos borrados simultáneos de la misma
--     dirección (doble clic, dos pestañas) dejan un solo borrado y un solo
--     evento de auditoría. El segundo espera, relee y devuelve true;
--   · `FOR SHARE` sobre el vínculo del Portal, que según su comentario
--     «bloquea también revocaciones ... hasta el commit». Una revocación que
--     llega durante el borrado espera a que termine; un borrado que llega
--     durante una revocación espera y, al releer, ya no tiene permiso;
--   · `FOR SHARE` sobre el cliente y `FOR UPDATE` sobre la dirección
--     revalidan la propiedad: si el cliente se da de baja, o la dirección pasa
--     a otro cliente mientras el borrado espera, no se borra nada;
--   · `lock_timeout = 2s`: el borrado no espera para siempre.
--
-- CÓMO: igual que 0459_relevo_carrera_for_update y 0460_retencion_carrera_skip_locked.
-- El archivo corre en la base `postgres` del runner y, con dblink, abre tres
-- sesiones contra una base propia (dtd_carrera_0427): `s` prepara y observa,
-- `a` toma el bloqueo y deja la transacción abierta, y `b` llega después, en
-- asíncrono. Cada caso exige ver pg_blocking_pids(b) con `a` adentro antes de
-- que `a` confirme: la barrera es determinista, sin sleep que calibrar, y un
-- escenario sin carrera falla en vez de pasar vacío.
--
-- FIXTURE: el del contrato 0427 en modo keep_fixture. Se lee su sección entre
-- `begin;` y el cierre de keep_fixture con pg_read_file, cada `\ir` se
-- reemplaza por la migración que incluye y `\if :apply_fix` / `\if :keep_fixture`
-- se resuelven en verdadero. Otro meta-comando de psql, o una sección que ya no
-- se encuentra, hace fallar este archivo en vez de probar sobre otro fixture.
--
-- Lo que defiende, con los ocho escenarios de aquel script:
--   1. Doble borrado: el segundo espera al primero, los dos devuelven true y
--      queda un solo evento portal_delivery_address_deleted.
--   2. Doble borrado con el primero revertido: el segundo espera y borra él;
--      queda un solo evento.
--   3. Revocación en curso: el borrado espera y, al releer el vínculo, devuelve
--      false sin borrar ni auditar.
--   4. Traslado en curso: la dirección pasa a otro cliente; el borrado espera y
--      devuelve false sin borrarla.
--   5. Baja del cliente en curso: el borrado espera y devuelve false.
--   6. La dirección tomada más de 2 s: el borrado corta con lock timeout, sin
--      borrar ni auditar.
--   7. Snapshot viejo: en REPEATABLE READ, un borrado posterior a la revocación
--      falla por serialización. No queda autoridad residual.
--   8. Borrado en curso: la revocación espera a que el borrado confirme.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes fuera del repo, ver .agents/handoffs/carrera-0421-0427.md): la
-- 0427 sin el `for update` de la dirección, sin alguno de sus dos `for share` o
-- sin su `lock_timeout` hace fallar este archivo.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0427 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0427 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0427_%s',
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
    if v_conn like 'c0427\_%' then
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
      'drop database if exists dtd_carrera_0427 with (force)');
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
    raise exception 'TEST 0427 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0427 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0427 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0427 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0427 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- El id de una etiqueta del fixture, igual que pg_temp.fixture_id del contrato.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0427-synthetic-' || p_label)::uuid
$$;

-- El fixture del contrato con la 0427 aplicada, más los usuarios y las
-- direcciones de la carrera, en UNA transacción explícita: si algo falla, no
-- queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0427_portal_delete_delivery_address_command.test.sql',
      E'\nbegin;\n', E'\n\\if :keep_fixture\ncommit;', '{"apply_fix": true, "keep_fixture": true}'),
    -- Tres usuarios del Portal más, cada uno con su cliente activo del tenant A.
    format($f$
      insert into auth.users (id) values (%1$L), (%2$L), (%3$L);
      insert into public.clients (id, tenant_id, markbox, name) values
        (%4$L, %7$L, 'CARRERAC', 'client-C'), (%5$L, %7$L, 'CARRERAD', 'client-D'),
        (%6$L, %7$L, 'CARRERAE', 'client-E');
      insert into public.client_users (auth_user_id, tenant_id, client_id, email, status) values
        (%1$L, %7$L, %4$L, 'portal-c@example.invalid', 'active'),
        (%2$L, %7$L, %5$L, 'portal-d@example.invalid', 'active'),
        (%3$L, %7$L, %6$L, 'portal-e@example.invalid', 'active');
    $f$, pg_temp.id('portal-C'), pg_temp.id('portal-D'), pg_temp.id('portal-E'),
      pg_temp.id('client-C'), pg_temp.id('client-D'), pg_temp.id('client-E'), pg_temp.id('tenant-A')),
    -- Las direcciones de la carrera. El trigger de 0198 sella tenant y Shipping Mark.
    (select string_agg(format($f$insert into public.client_delivery_addresses
        (id, client_id, tenant_id, client_markbox, line)
        values (%L, %L, %L, 'forged-input-is-sealed', %L);$f$,
        pg_temp.id(d.direccion), pg_temp.id(d.cliente), pg_temp.id('tenant-A'), 'synthetic-' || d.direccion),
        E'\n')
       from (values ('address-carrera', 'client-A'), ('address-carrera-2', 'client-A'),
                    ('address-C-traslado', 'client-C'), ('address-C-timeout', 'client-C'),
                    ('address-D', 'client-D'), ('address-E', 'client-E')) as d(direccion, cliente)),
    'commit;');
end;
$$;

-- Abre la transacción de una sesión; con actor, como ese usuario del Portal.
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
-- p_b_sql en asíncrono. `a` cierra con p_cierre apenas `b` queda esperando o,
-- con p_b_termina_sola, recién cuando `b` terminó por su cuenta. Devuelve si
-- `b` esperó a `a` (y en qué tipo de lock), lo que devolvió cada uno y el error
-- de `b`, si lo hubo.
create function pg_temp.carrera(p_a_actor text, p_a_sql text, p_b_actor text, p_b_sql text,
  p_cierre text default 'commit', p_b_termina_sola boolean default false)
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
  select pid into v_a from dblink('c0427_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0427_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0427_a', p_a_actor);
  select r into v_ra from dblink('c0427_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0427_b', p_b_actor);
  perform pg_temp.afirmar(dblink_send_query('c0427_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0427_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0427 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  if v_espero and p_b_termina_sola then
    while dblink_is_busy('c0427_b') = 1 loop
      if clock_timestamp() > v_limite then
        raise exception 'TEST 0427 carrera: la segunda sesión no terminó sola en 20 s';
      end if;
      perform pg_sleep(0.05);
    end loop;
  end if;
  perform dblink_exec('c0427_a', p_cierre);
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0427_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0427_b');
  end if;
  perform * from dblink_get_result('c0427_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0427_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Cómo quedó una dirección: si está borrada y cuántos eventos de borrado tiene.
create function pg_temp.direccion(p_label text) returns jsonb language sql as $$
  select r::jsonb from dblink('c0427_s', format($q$
    select jsonb_build_object(
      'borrada', (select deleted_at is not null from public.client_delivery_addresses where id = %1$L),
      'eventos', (select count(*) from public.entity_audit_log
                   where entity_type = 'client_delivery_address' and entity_id = %1$L
                     and event_type = 'portal_delivery_address_deleted'))::text
  $q$, pg_temp.id(p_label))) as t(r text)
$$;

create function pg_temp.borrar(p_direccion text, p_correlacion text) returns text language sql as $$
  select format('select public.delete_portal_delivery_address(%L, %L)::text',
    pg_temp.id(p_direccion), pg_temp.id(p_correlacion))
$$;

create function pg_temp.revocar(p_actor text) returns text language sql as $$
  select format($q$with u as (update public.client_users set status = 'revoked'
    where auth_user_id = %L and status = 'active' returning 1) select count(*)::text from u$q$,
    pg_temp.id(p_actor))
$$;

do $carrera$
declare
  v_r jsonb;
  v_rb text;
  v_error text;
  v_avisos text := current_setting('client_min_messages');
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0427 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0427 template template0');
  perform dblink_connect('c0427_s', pg_temp.conn('dtd_carrera_0427', 's'));
  perform dblink_connect('c0427_a', pg_temp.conn('dtd_carrera_0427', 'a'));
  perform dblink_connect('c0427_b', pg_temp.conn('dtd_carrera_0427', 'b'));
  perform dblink_exec('c0427_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0427_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0427_b', $t$set statement_timeout = '30s'$t$);

  -- 1. Doble borrado de la misma dirección.
  v_r := pg_temp.carrera('portal-A', pg_temp.borrar('address-A', 'carrera-doble-1'),
                         'portal-A', pg_temp.borrar('address-A', 'carrera-doble-2'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('doble borrado: el segundo tenía que esperar al primero (¿falta el for update de la dirección?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = 'true' and v_r ->> 'b' = 'true',
    format('doble borrado: los dos tienen que devolver true: %s', v_r));
  perform pg_temp.afirmar(pg_temp.direccion('address-A') = '{"borrada": true, "eventos": 1}',
    format('doble borrado: tiene que quedar un solo borrado con un solo evento: %s / %s',
      v_r, pg_temp.direccion('address-A')));

  -- 2. Doble borrado con el primero revertido.
  v_r := pg_temp.carrera('portal-A', pg_temp.borrar('address-carrera-2', 'carrera-revertido-1'),
                         'portal-A', pg_temp.borrar('address-carrera-2', 'carrera-revertido-2'), 'rollback');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'a' = 'true' and v_r ->> 'b' = 'true'
      and pg_temp.direccion('address-carrera-2') = '{"borrada": true, "eventos": 1}',
    format('doble borrado revertido: el segundo tenía que esperar y borrar él, con un solo evento: %s / %s',
      v_r, pg_temp.direccion('address-carrera-2')));

  -- 3. Revocación en curso: llega primero.
  v_r := pg_temp.carrera(null, pg_temp.revocar('portal-B'),
                         'portal-B', pg_temp.borrar('address-B', 'carrera-revocada'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('revocación en curso: el borrado tenía que esperar a la revocación (¿falta el for share del vínculo?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = '1' and v_r ->> 'b' = 'false'
      and pg_temp.direccion('address-B') = '{"borrada": false, "eventos": 0}',
    format('revocación en curso: el borrado tiene que devolver false sin borrar ni auditar: %s / %s',
      v_r, pg_temp.direccion('address-B')));

  -- 4. Traslado en curso: la dirección pasa a otro cliente del mismo tenant.
  v_r := pg_temp.carrera(null, format($q$with u as (update public.client_delivery_addresses set client_id = %L
      where id = %L returning 1) select count(*)::text from u$q$,
      pg_temp.id('client-other'), pg_temp.id('address-C-traslado')),
    'portal-C', pg_temp.borrar('address-C-traslado', 'carrera-traslado'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('traslado en curso: el borrado tenía que esperar al traslado (¿falta el for update de la dirección?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = '1' and v_r ->> 'b' = 'false'
      and pg_temp.direccion('address-C-traslado') = '{"borrada": false, "eventos": 0}',
    format('traslado en curso: el borrado no puede tocar una dirección que ya es de otro cliente: %s / %s',
      v_r, pg_temp.direccion('address-C-traslado')));

  -- 5. Baja del cliente en curso.
  v_r := pg_temp.carrera(null, format($q$with u as (update public.clients set deleted_at = now()
      where id = %L returning 1) select count(*)::text from u$q$, pg_temp.id('client-D')),
    'portal-D', pg_temp.borrar('address-D', 'carrera-baja'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('baja del cliente: el borrado tenía que esperar a la baja (¿falta el for share del cliente?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = '1' and v_r ->> 'b' = 'false'
      and pg_temp.direccion('address-D') = '{"borrada": false, "eventos": 0}',
    format('baja del cliente: el borrado tiene que devolver false sin borrar ni auditar: %s / %s',
      v_r, pg_temp.direccion('address-D')));

  -- 6. La dirección tomada más de 2 s: el borrado corta solo.
  v_r := pg_temp.carrera(null, format($q$select id::text from public.client_delivery_addresses
      where id = %L for update$q$, pg_temp.id('address-C-timeout')),
    'portal-C', pg_temp.borrar('address-C-timeout', 'carrera-timeout'), 'rollback', true);
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r ->> 'b' is null
      and v_r ->> 'error_b' like '%lock timeout%'
      and pg_temp.direccion('address-C-timeout') = '{"borrada": false, "eventos": 0}',
    format('timeout: el borrado tenía que cortar con lock timeout, sin borrar ni auditar (¿falta el lock_timeout de la función?): %s / %s',
      v_r, pg_temp.direccion('address-C-timeout')));

  -- 7. Snapshot viejo: en REPEATABLE READ, la revocación confirma después del
  -- snapshot y antes del borrado.
  perform dblink_exec('c0427_b', 'begin isolation level repeatable read');
  perform dblink_exec('c0427_b', 'set local role authenticated');
  perform * from dblink('c0427_b', format($q$select set_config('request.jwt.claim.sub', %L, true)$q$,
    pg_temp.id('portal-E'))) as t(x text);
  perform * from dblink('c0427_b', 'select count(*)::text from public.client_delivery_addresses') as t(x text);
  perform pg_temp.afirmar((select r from dblink('c0427_s', pg_temp.revocar('portal-E')) as t(r text)) = '1',
    'snapshot viejo: la revocación tiene que confirmar después del snapshot');
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink('c0427_b', pg_temp.borrar('address-E', 'carrera-snapshot'), false) as t(r text);
  v_error := case when v_rb is null then dblink_error_message('c0427_b') end;
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0427_b', 'rollback');
  perform pg_temp.afirmar(v_rb is null and v_error like '%could not serialize access%'
      and pg_temp.direccion('address-E') = '{"borrada": false, "eventos": 0}',
    format('snapshot viejo: el borrado tenía que fallar por serialización, sin borrar ni auditar (¿falta el for share del vínculo?): %s / %s / %s',
      v_rb, v_error, pg_temp.direccion('address-E')));

  -- 8. Borrado en curso: la revocación llega después.
  v_r := pg_temp.carrera('portal-A', pg_temp.borrar('address-carrera', 'carrera-antes'),
                         null, pg_temp.revocar('portal-A'));
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean,
    format('borrado en curso: la revocación tenía que esperar al borrado (¿falta el for share del vínculo?): %s', v_r));
  perform pg_temp.afirmar(v_r ->> 'a' = 'true' and v_r ->> 'b' = '1'
      and pg_temp.direccion('address-carrera') = '{"borrada": true, "eventos": 1}',
    format('borrado en curso: el borrado confirma y la revocación entra después: %s / %s',
      v_r, pg_temp.direccion('address-carrera')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0427 carrera OK: % aserciones; los ocho escenarios del borrado concurrente',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0427 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0427')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0427 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
