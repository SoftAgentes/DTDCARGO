\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0460 (SDD-0477): el `FOR UPDATE OF cu
-- SKIP LOCKED` de erase_revoked_portal_access_data(), probado con sesiones
-- reales. Base propia y desechable dentro del contenedor del runner: nunca
-- consulta ni modifica una base alojada.
--
-- POR QUÉ: el contrato 0460_retencion_vinculo_portal_revocado.test.sql corre en
-- una sola sesión de psql, y ahí el mutante sin SKIP LOCKED sólo moría por la
-- aserción sobre el texto de la RPC (spec 0477 › Riesgos y límites). Lo que
-- promete el SKIP LOCKED es de comportamiento y sólo se ve con dos sesiones:
--   · una corrida del cron no espera a otra que tiene filas tomadas, y entre
--     las dos no repiten filas ni eventos;
--   · una fila que alguien tiene bloqueada (una reinvitación desde el Studio)
--     se salta sin esperar y sin pisar lo que esa transacción escribe.
--
-- CÓMO: el archivo corre en la base `postgres` del runner y, con dblink, abre
-- tres sesiones contra una base propia (dtd_carrera_0460):
--   s  prepara y observa, en autocommit;
--   a  tiene filas tomadas: una primera corrida del cron (tope 2) o el founder
--      reinvitando un vínculo, con la transacción abierta;
--   b  una segunda corrida del cron, como service_role y en asíncrono.
-- Mientras `a` no cierra, el coordinador mira si `b` termina o si
-- pg_blocking_pids(b) ya contiene a `a`. No hay sleep que calibrar: una vez
-- bloqueada, `b` no se desbloquea hasta que `a` cierre.
--
-- FIXTURE: el MISMO del contrato 0460. Se lee su sección entre `begin;` y
-- «Utilidades» con pg_read_file, y cada `\ir` se reemplaza por el archivo que
-- incluye; después va la 0460 entera. Si el contrato cambia de forma y la
-- sección ya no se puede expandir, este archivo falla en vez de probar sobre
-- otro fixture.
--
-- Lo que defiende, con cuatro vínculos revocados hace 61 a 64 días:
--   1. Dos corridas a la vez: la segunda no espera a la primera y borra sólo las
--      dos filas que la primera no tomó. Al confirmar las dos queda un evento
--      por fila.
--   2. La primera corrida se revierte: las filas que la segunda saltó siguen
--      elegibles y la corrida siguiente las borra. Saltar no es perder.
--   3. Reinvitación en curso: la corrida no espera al founder y no borra ese
--      vínculo. Al confirmar la reinvitación, queda `invited` con su correo.
--   CONTROL, en cada corrida, con la función instalada derivada de
--   pg_get_functiondef:
--   · sin SKIP LOCKED, la segunda corrida espera en 1 y en 3: el escenario sí
--     ejerce el bloqueo. No duplica eventos, porque el FOR UPDATE relee la fila;
--   · sin ningún bloqueo, en 1 espera igual y repite el borrado y el evento de
--     las filas de la primera: el bloqueo es lo que evita eventos duplicados.
--   Si un control no se cumple, el escenario dejó de probar la carrera y el
--   test falla: el verde no puede ser vacío.
--
-- SIN HUELLA, como en 0459_relevo_carrera_for_update: los archivos que corren
-- después comparten este clúster. La base propia y los roles anon,
-- authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED: la 0460 sin `skip locked`, o sin la línea del bloqueo, en una copia de
-- supabase/ fuera del repo (comando en .agents/handoffs/0477-carrera-skip-locked-0460.md):
-- falla con «la segunda corrida esperó a la primera».
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0460 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0460 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0460_%s',
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
    if v_conn like 'c0460\_%' then
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
      'drop database if exists dtd_carrera_0460 with (force)');
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

-- El fixture del contrato 0460, expandido, más la 0460 y la base sintética. Va
-- como UNA consulta simple de varias sentencias: corre en una sola
-- transacción, así que si algo falla no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
declare
  v_contrato text := pg_read_file('/sb/tests/0460_retencion_vinculo_portal_revocado.test.sql');
  v_desde integer := position(E'\nbegin;\n' in v_contrato);
  v_hasta integer := position(E'\n-- ─── Utilidades' in v_contrato);
  v_seccion text;
  v_ajenos text;
  v_expandido text;
begin
  if v_desde = 0 or v_hasta < v_desde then
    raise exception 'TEST 0460 carrera: no encuentro el fixture del contrato 0460 entre `begin;` y «Utilidades»';
  end if;
  v_seccion := substr(v_contrato, v_desde + 8, v_hasta - v_desde - 8);
  -- dblink manda SQL: fuera de los `\ir` de migraciones, ningún meta-comando de psql.
  select string_agg(l, ' | ') into v_ajenos
    from regexp_split_to_table(v_seccion, E'\n') as l
   where l ~ '^\s*\\' and l !~ '^\\ir \.\./migrations/[0-9A-Za-z_]+\.sql$';
  if v_ajenos is not null then
    raise exception 'TEST 0460 carrera: el fixture del contrato 0460 trae meta-comandos que no sé expandir: %', v_ajenos;
  end if;
  select string_agg(case
           when l ~ '^\\ir \.\./migrations/'
             then pg_read_file('/sb/migrations/' || substring(l from '^\\ir \.\./migrations/(.+)$'))
           else l end, E'\n' order by n)
    into v_expandido
    from regexp_split_to_table(v_seccion, E'\n') with ordinality as t(l, n);
  return concat_ws(E'\n',
    v_expandido,
    pg_read_file('/sb/migrations/0460_retencion_vinculo_portal_revocado.sql'),
    $f$
      insert into public.tenants (id, slug, display_name)
      values (md5('0460-carrera-tenant')::uuid, 'synthetic-carrera', 'Tenant sintético');
      insert into auth.users (id, email)
      values (md5('0460-carrera-equipo')::uuid, 'equipo-carrera@example.invalid');
      insert into public.user_tenants (user_id, tenant_id, role)
      values (md5('0460-carrera-equipo')::uuid, md5('0460-carrera-tenant')::uuid, 'admin');
    $f$);
end;
$$;

-- Cuatro vínculos revocados para un caso: el 1 hace 64 días y el 4 hace 61, así
-- que una corrida con tope 2 toma el 1 y el 2.
create function pg_temp.sembrar(p_caso text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0460_s', format($sembrar$
    insert into public.clients (id, tenant_id, markbox, name, email)
    select md5('0460-carrera-' || c)::uuid, md5('0460-carrera-tenant')::uuid, upper(c),
           'Cliente sintético ' || c, c || '@example.invalid'
      from unnest(array[%1$L, %2$L, %3$L, %4$L]) as c;
    insert into public.client_users (tenant_id, client_id, email, status, invited_by, invited_at,
      bound_at, revoked_at, last_login_at, created_at, updated_at, email_invite_count,
      whatsapp_invite_count, last_email_invite_at, last_email_invite_by)
    select md5('0460-carrera-tenant')::uuid, md5('0460-carrera-' || c)::uuid,
           c || '.portal@example.invalid', 'revoked', md5('0460-carrera-equipo')::uuid,
           now() - interval '90 days', now() - interval '80 days',
           now() - make_interval(days => 65 - i::integer), now() - interval '70 days',
           now() - interval '90 days', now() - make_interval(days => 65 - i::integer),
           1, 0, now() - interval '89 days', md5('0460-carrera-equipo')::uuid
      from unnest(array[%1$L, %2$L, %3$L, %4$L]) with ordinality as t(c, i)
  $sembrar$, p_caso || '1', p_caso || '2', p_caso || '3', p_caso || '4'));
end;
$$;

-- Cómo quedó cada vínculo del caso: status, si se borró todo y cuántos
-- eventos portal_access_data_erased tiene.
create function pg_temp.estado(p_caso text) returns jsonb language sql as $$
  select r::jsonb from dblink('c0460_s', format($q$
    select jsonb_object_agg(substr(c.markbox, 2), jsonb_build_object(
             'status', cu.status,
             'borrada', num_nonnulls(cu.email, cu.invited_at, cu.bound_at, cu.last_login_at,
                                     cu.revoked_at, cu.last_email_invite_at,
                                     cu.last_whatsapp_invite_at, cu.auth_user_id, cu.token) = 0,
             'eventos', (select count(*) from public.entity_audit_log e
                          where e.entity_type = 'portal_invitation' and e.entity_id = cu.client_id
                            and e.event_type = 'portal_access_data_erased')))::text
      from public.client_users cu
      join public.clients c on c.id = cu.client_id
     where cu.client_id in (select md5('0460-carrera-' || x)::uuid
                              from unnest(array[%1$L, %2$L, %3$L, %4$L]) as x)
  $q$, p_caso || '1', p_caso || '2', p_caso || '3', p_caso || '4')) as t(r text)
$$;

-- Una fila esperada de pg_temp.estado.
create function pg_temp.fila(p_status text, p_borrada boolean, p_eventos integer) returns jsonb
language sql as $$
  select jsonb_build_object('status', p_status, 'borrada', p_borrada, 'eventos', p_eventos)
$$;

-- Una carrera: `a` toma filas y deja la transacción abierta; `b` corre el cron.
-- Devuelve si `b` esperó a `a`, lo que devolvió cada uno y cómo quedaron los
-- vínculos después de que `a` cerró con p_cierre.
create function pg_temp.carrera(p_caso text, p_toma text, p_cierre text) returns jsonb
language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_primera jsonb;
  v_segunda jsonb;
begin
  perform pg_temp.sembrar(p_caso);
  select pid into v_a from dblink('c0460_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0460_b', 'select pg_backend_pid()') as t(pid integer);

  perform dblink_exec('c0460_a', 'begin');
  if p_toma = 'corrida' then
    -- Una primera corrida del cron con tope 2: toma las dos filas más viejas.
    perform dblink_exec('c0460_a', 'set local role service_role');
    select r::jsonb into v_primera
      from dblink('c0460_a', 'select public.erase_revoked_portal_access_data(2, false)::text')
        as t(r text);
    perform pg_temp.afirmar((v_primera ->> 'erased')::integer = 2,
      format('%s: la primera corrida tiene que tomar dos filas: %s', p_caso, v_primera));
  else
    -- El founder reinvita el vínculo 1 desde el Studio.
    perform * from dblink('c0460_a', format(
      $q$select set_config('request.jwt.claim.sub', %L, true)$q$,
      md5('0460-carrera-equipo')::uuid)) as t(x text);
    perform dblink_exec('c0460_a', 'set local role authenticated');
    select r::jsonb into v_primera
      from dblink('c0460_a', format(
        $q$select jsonb_agg(i.client_email)::text from public.portal_invite_client(%L) as i$q$,
        md5('0460-carrera-' || p_caso || '1')::uuid)) as t(r text);
    perform pg_temp.afirmar(jsonb_array_length(v_primera) = 1,
      format('%s: la reinvitación tiene que devolver el vínculo: %s', p_caso, v_primera));
  end if;

  perform pg_temp.afirmar(
    dblink_send_query('c0460_b', 'select public.erase_revoked_portal_access_data(1000, false)::text') = 1,
    p_caso || ': la segunda corrida tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- cierre, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      exit;
    end if;
    exit when dblink_is_busy('c0460_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0460 carrera: %: la segunda corrida ni terminó ni quedó esperando en 20 s', p_caso;
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0460_a', p_cierre);
  select r::jsonb into v_segunda from dblink_get_result('c0460_b') as t(r text);
  perform * from dblink_get_result('c0460_b') as t(r text);  -- cierre del resultado asíncrono
  return jsonb_build_object('caso', p_caso, 'espero', v_espero, 'primera', v_primera,
    'segunda', v_segunda, 'estado', pg_temp.estado(p_caso));
end;
$$;

do $carrera$
declare
  -- La cláusula de bloqueo del relevo, y su renglón entero.
  c_skip constant text := 'for update of cu skip locked';
  c_renglon constant text := '\n\s*for update of cu skip locked\s*\n';
  v_borrada jsonb := pg_temp.fila('revoked', true, 1);
  v_r jsonb;
  v_def text;
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0460 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0460 template template0');
  perform dblink_connect('c0460_s', pg_temp.conn('dtd_carrera_0460', 's'));
  perform dblink_connect('c0460_a', pg_temp.conn('dtd_carrera_0460', 'a'));
  perform dblink_connect('c0460_b', pg_temp.conn('dtd_carrera_0460', 'b'));
  perform dblink_exec('c0460_s', pg_temp.fixture());
  -- Nadie espera para siempre. `b` es el cron: service_role, sin principal.
  perform dblink_exec('c0460_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0460_b', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0460_b', 'set role service_role');

  -- 1. Dos corridas a la vez.
  v_r := pg_temp.carrera('a', 'corrida', 'commit');
  perform pg_temp.afirmar(not (v_r ->> 'espero')::boolean,
    format('dos corridas: la segunda corrida esperó a la primera (¿falta el skip locked?): %s', v_r));
  perform pg_temp.afirmar((v_r #>> '{segunda,erased}')::integer = 2,
    format('dos corridas: la segunda tenía que borrar sólo las dos filas libres: %s', v_r));
  perform pg_temp.afirmar(v_r -> 'estado' = jsonb_build_object(
      '1', v_borrada, '2', v_borrada, '3', v_borrada, '4', v_borrada),
    format('dos corridas: cada vínculo tiene que quedar borrado con un solo evento: %s', v_r));

  -- 2. La primera corrida se revierte.
  v_r := pg_temp.carrera('b', 'corrida', 'rollback');
  perform pg_temp.afirmar(not (v_r ->> 'espero')::boolean,
    format('se revierte: la segunda corrida esperó a la primera (¿falta el skip locked?): %s', v_r));
  perform pg_temp.afirmar((v_r #>> '{segunda,erased}')::integer = 2
      and v_r -> 'estado' = jsonb_build_object('1', pg_temp.fila('revoked', false, 0),
        '2', pg_temp.fila('revoked', false, 0), '3', v_borrada, '4', v_borrada),
    format('se revierte: las filas de la primera tienen que seguir con sus datos y sin evento: %s', v_r));
  select r::jsonb into v_r
    from dblink('c0460_b', 'select public.erase_revoked_portal_access_data(1000, false)::text') as t(r text);
  perform pg_temp.afirmar((v_r ->> 'erased')::integer = 2 and pg_temp.estado('b') = jsonb_build_object(
      '1', v_borrada, '2', v_borrada, '3', v_borrada, '4', v_borrada),
    format('se revierte: la corrida siguiente tiene que borrar las dos filas saltadas: %s / %s',
      v_r, pg_temp.estado('b')));

  -- 3. Reinvitación en curso.
  v_r := pg_temp.carrera('c', 'reinvitacion', 'commit');
  perform pg_temp.afirmar(not (v_r ->> 'espero')::boolean,
    format('reinvitación: la corrida esperó al founder (¿falta el skip locked?): %s', v_r));
  perform pg_temp.afirmar((v_r #>> '{segunda,erased}')::integer = 3 and v_r -> 'estado' = jsonb_build_object(
      '1', pg_temp.fila('invited', false, 0), '2', v_borrada, '3', v_borrada, '4', v_borrada),
    format('reinvitación: la corrida no puede borrar el vínculo reinvitado: %s', v_r));

  -- CONTROL: la misma función, sin SKIP LOCKED y después sin bloqueo.
  select d into v_def
    from dblink('c0460_s', $q$select pg_get_functiondef(
      'public.erase_revoked_portal_access_data(integer,boolean)'::regprocedure)$q$) as t(d text);
  perform pg_temp.afirmar((select count(*) from regexp_matches(v_def, c_renglon, 'g')) = 1,
    'control: el relevo instalado tiene que tener un único renglón «for update of cu skip locked»');

  perform dblink_exec('c0460_s', replace(v_def, c_skip, 'for update of cu'));
  v_r := pg_temp.carrera('m', 'corrida', 'commit');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and (v_r #>> '{segunda,erased}')::integer = 2
      and v_r -> 'estado' = jsonb_build_object('1', v_borrada, '2', v_borrada, '3', v_borrada, '4', v_borrada),
    format('CONTROL sin skip locked, dos corridas: la segunda tenía que esperar y no duplicar; si no espera, la carrera no se ejerció: %s', v_r));
  v_r := pg_temp.carrera('p', 'reinvitacion', 'commit');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and v_r #> '{estado,1}' = pg_temp.fila('invited', false, 0),
    format('CONTROL sin skip locked, reinvitación: la corrida tenía que esperar al founder; si no espera, la carrera no se ejerció: %s', v_r));

  perform dblink_exec('c0460_s', regexp_replace(v_def, c_renglon, E'\n'));
  perform pg_temp.afirmar(not exists (
      select from dblink('c0460_s', $q$select pg_get_functiondef(
        'public.erase_revoked_portal_access_data(integer,boolean)'::regprocedure)$q$) as t(d text)
       where d ~* 'for update'),
    'control: el mutante sin bloqueo tiene que quedar instalado');
  v_r := pg_temp.carrera('n', 'corrida', 'commit');
  perform pg_temp.afirmar((v_r ->> 'espero')::boolean and (v_r #>> '{segunda,erased}')::integer = 4
      and v_r -> 'estado' = jsonb_build_object('1', pg_temp.fila('revoked', true, 2),
        '2', pg_temp.fila('revoked', true, 2), '3', v_borrada, '4', v_borrada),
    format('CONTROL sin bloqueo: la segunda corrida tenía que repetir las filas de la primera; si no, la carrera no se ejerció: %s', v_r));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0460 carrera OK: % aserciones; la corrida no espera, no repite ni pisa una reinvitación, y los controles sin skip locked y sin bloqueo caen',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0460 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0460')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0460 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
