\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0365 (SDD-0256): dos drenajes de la cola
-- de escritura a Kommo que reservan a la vez no toman las mismas filas. Base
-- propia y desechable dentro del contenedor del runner: nunca consulta ni
-- modifica una base alojada.
--
-- POR QUÉ: la edge function kommo-writeback reserva su lote con
-- claim_kommo_writeback_batch (0365:70-99), que elige las pendientes con FOR
-- UPDATE SKIP LOCKED (0365:88) y las pasa a `processing`. La corren a la vez el
-- cron y el nudge de las acciones del CRM (app/studio/(app)/crm/actions.ts), con
-- un lote de 100. El contrato 0365_kommo_outbox_claim.test.sql corre en una sola
-- sesión y no puede probarlo, y los dos comentarios que lo explican no dicen lo
-- mismo:
--   · la migración (0365:67-69): SKIP LOCKED hace que el segundo saltee las
--     filas del primero «en lugar de esperarlas (y terminar procesándolas
--     también)»;
--   · el contrato (su cabecera): SKIP LOCKED «sólo agrega que el segundo no se
--     quede esperando»; la exclusión la da la transición de estado.
-- Este archivo lo mide con dos controles.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0445, 0449,
-- 0454, 0459, 0460, 0464, 0466 y 0467). El archivo corre en la base `postgres`
-- del runner y, con dblink, abre tres sesiones contra una base propia
-- (dtd_carrera_0365): `s` prepara y observa, `a` reserva primero y deja la
-- transacción abierta, y `b` reserva después, en asíncrono. Las dos reservan
-- como service_role, que es como llama la edge function. La barrera mira si `b`
-- queda esperando a `a` (pg_blocking_pids) o termina sin esperarla.
--
-- Los escenarios, con 4 filas pendientes de un tenant propio:
--   1. Dos drenajes a la vez con el lote de la edge function (100). Real: `b` no
--      espera y no toma nada; `a` tomó las 4. Control: el claim sin su lock; `b`
--      espera y vuelve a tomar las 4 (se enviarían dos veces).
--   2. Dos drenajes a la vez con un lote más chico que la cola (2). Real: `b` no
--      espera y toma las otras 2. Control: el claim sin su lock; `b` espera y
--      vuelve a tomar las 2 de `a`.
--   3. Lo mismo que 2, con el control en FOR UPDATE sin SKIP LOCKED. Control:
--      `b` espera a que `a` confirme, pero después toma las otras 2 y no repite
--      ninguna. Real: `b` no espera.
-- Así, 1 y 2 miden que sin el lock la transición de estado no excluye (el UPDATE
-- vuelve a tomar la fila al re-evaluar), y 3 mide que un FOR UPDATE a secas ya
-- excluye: lo que agrega SKIP LOCKED es no esperar.
--
-- CONTROL en la misma corrida: cada escenario corre primero con el claim
-- reemplazado por una variante (sacada con pg_get_functiondef de la versión
-- aplicada, y restituida después), y tiene que mostrar el defecto. Después corre
-- con la 0365. Los reemplazos son tolerantes: si el claim ya no tiene el lock, o
-- sólo tiene FOR UPDATE, la variante queda como tiene que quedar.
--
-- FIXTURE: el del contrato 0365, leído de su archivo hasta la migración (los
-- roles, tenants y la cola en su forma de la 0136 con la 0344), con la 0365
-- entera encima. Si el contrato cambia de forma, este archivo falla en vez de
-- probar sobre otro fixture. Por escenario, un tenant propio con su cola.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0365 fuera del repo, ver
-- .agents/handoffs/0256-carrera-outbox-0365.md): sin el lock caen los tres
-- escenarios, con filas repetidas; con FOR UPDATE a secas también caen los tres,
-- porque `b` espera, pero sin repetir filas. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0365 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0365 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0365_%s',
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
    if v_conn like 'c0365\_%' then
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
      'drop database if exists dtd_carrera_0365 with (force)');
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

-- Un fragmento de un contrato entre dos marcas (la segunda se busca después de
-- la primera), para mandarlo por dblink. Tiene que ser SQL puro: un meta-comando
-- de psql adentro aborta.
create function pg_temp.fragmento(p_contrato text, p_desde text, p_hasta text) returns text
language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/tests/' || p_contrato);
  v_ini integer := position(p_desde in v_txt);
  v_fin integer;
begin
  if v_ini = 0 then
    raise exception 'TEST 0365 carrera: no encuentro «%» en %', p_desde, p_contrato;
  end if;
  v_txt := substr(v_txt, v_ini + length(p_desde));
  v_fin := position(p_hasta in v_txt);
  if v_fin = 0 then
    raise exception 'TEST 0365 carrera: no encuentro «%» en % después de «%»', p_hasta, p_contrato, p_desde;
  end if;
  v_txt := left(v_txt, v_fin - 1);
  if v_txt ~ '(^|\n)\s*\\' then
    raise exception 'TEST 0365 carrera: el fragmento de % trae un meta-comando de psql', p_contrato;
  end if;
  return v_txt;
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0365-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato con la 0365 aplicada, en UNA transacción explícita: si
-- algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.fragmento('0365_kommo_outbox_claim.test.sql',
      E'\nbegin;\n', E'\n\\i /sb/migrations/0365_kommo_outbox_claim.sql'),
    pg_read_file('/sb/migrations/0365_kommo_outbox_claim.sql'),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0365_s', p_sql) as t(r text)
$$;

-- Un tenant con 4 órdenes pendientes (leads 1 a 4, de la más vieja a la más
-- nueva), como las deja enqueue_kommo_writeback.
create function pg_temp.cola(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0365_s', format($q$
insert into public.tenants (id) values (%1$L);
insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key, created_at)
select %1$L, n, 'patch_stage', '{"status_id": 142}', n || ':patch_stage', now() - (5 - n) * interval '1 minute'
  from generate_series(1, 4) as n;
$q$, pg_temp.id(p_label)));
end;
$$;

-- La reserva de la edge function (kommo-writeback/index.ts): devuelve los leads
-- reservados, en orden, o '' si no reservó nada.
create function pg_temp.reservar(p_label text, p_lote integer) returns text language sql as $$
  select format($q$select coalesce(string_agg(kommo_lead_id::text, ',' order by kommo_lead_id), '')
    from public.claim_kommo_writeback_batch(%L, %s)$q$, pg_temp.id(p_label), p_lote)
$$;

-- Leads que reservaron los dos: cada uno se enviaría dos veces.
create function pg_temp.repetidas(p_a text, p_b text) returns integer language sql immutable as $$
  select count(*)::integer from unnest(string_to_array(p_a, ',')) as x
   where x = any (string_to_array(p_b, ','))
$$;

-- La cola del tenant después de la carrera.
create function pg_temp.estado(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'procesando', count(*) filter (where status = 'processing'),
      'pendientes', count(*) filter (where status = 'pending'),
      'intentos', string_agg(attempts::text, ',' order by kommo_lead_id))::text
    from public.kommo_writeback_outbox where tenant_id = %L$q$, pg_temp.id(p_label)))::jsonb
$$;

-- Una variante del claim aplicado, sacada de pg_get_functiondef, con los
-- reemplazos de p_cambios. Un reemplazo que no encuentra su texto no cambia nada.
create function pg_temp.variante(p_cambios jsonb) returns void language plpgsql as $$
declare
  v_def text := pg_temp.ver($q$select pg_get_functiondef('public.claim_kommo_writeback_batch(uuid,int)'::regprocedure)$q$);
  v_c jsonb;
begin
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0365_s', v_def);
end;
$$;

-- Abre la transacción de una sesión con el rol dado.
create function pg_temp.abrir(p_conn text, p_rol text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  if p_rol is not null then
    perform dblink_exec(p_conn, format('set local role %I', p_rol));
  end if;
end;
$$;

-- Una carrera: `a` corre p_a_sql y deja la transacción abierta; `b` corre p_b_sql
-- en asíncrono. Devuelve si `b` esperó a `a` (y en qué tipo de lock), lo que
-- devolvió cada uno y el error de `b`, si lo hubo.
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
  select pid into v_a from dblink('c0365_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0365_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0365_a', p_a);
  select r into v_ra from dblink('c0365_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0365_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0365_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0365_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0365 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0365_a', 'commit');
  -- Un error de `b` se guarda, no se reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0365_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0365_b');
  end if;
  perform * from dblink_get_result('c0365_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0365_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0365_b') = 1 then
    perform dblink_cancel_query('c0365_b');
  end if;
  perform * from dblink_get_result('c0365_b', false) as t(r text);
  perform * from dblink_get_result('c0365_b', false) as t(r text);
  perform dblink_exec('c0365_b', 'rollback', false);
  perform dblink_exec('c0365_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_t text := 'e' || p_n || left(p_fase, 1);
  v_lote integer := case when p_n = 1 then 100 else 2 end;
  v_r jsonb;
begin
  perform pg_temp.cola(v_t);
  v_r := pg_temp.carrera('service_role', pg_temp.reservar(v_t, v_lote),
    'service_role', pg_temp.reservar(v_t, v_lote));
  return v_r || jsonb_build_object('repetidas', pg_temp.repetidas(v_r ->> 'a', v_r ->> 'b'))
    || pg_temp.estado(v_t);
end;
$$;

-- CONTROL. Sin el lock (1 y 2): `b` vuelve a tomar filas de `a`. Con FOR UPDATE a
-- secas (3): `b` espera a `a` en una fila, y después toma las otras 2 sin repetir.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case
    when p_n in (1, 2) then (p_r ->> 'repetidas')::int >= 1
    else (p_r ->> 'espero')::boolean and p_r ->> 'lock' = 'transactionid'
      and (p_r ->> 'repetidas')::int = 0 and p_r ->> 'a' = '1,2' and p_r ->> 'b' = '3,4'
  end
$$;

-- REAL: `b` no esperó a `a`, ninguna fila se reservó dos veces y las 4 quedaron
-- en processing con un solo intento. En 1, `a` tomó las 4 y `b` ninguna; en 2 y
-- 3, cada uno tomó 2, las más viejas para `a`.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select not (p_r ->> 'espero')::boolean and p_r ->> 'error_b' is null
    and (p_r ->> 'repetidas')::int = 0
    and (p_r ->> 'procesando')::int = 4 and (p_r ->> 'pendientes')::int = 0
    and p_r ->> 'intentos' = '1,1,1,1'
    and case when p_n = 1 then p_r ->> 'a' = '1,2,3,4' and p_r ->> 'b' = ''
             else p_r ->> 'a' = '1,2' and p_r ->> 'b' = '3,4' end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'dos drenajes con el lote de la edge function',
    'dos drenajes con un lote más chico que la cola',
    'dos drenajes con un lote más chico que la cola, contra FOR UPDATE a secas'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_claim text;
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0365 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0365 template template0');
  perform dblink_connect('c0365_s', pg_temp.conn('dtd_carrera_0365', 's'));
  perform dblink_connect('c0365_a', pg_temp.conn('dtd_carrera_0365', 'a'));
  perform dblink_connect('c0365_b', pg_temp.conn('dtd_carrera_0365', 'b'));
  perform dblink_exec('c0365_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0365_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0365_b', $t$set statement_timeout = '30s'$t$);

  v_claim := pg_temp.ver($q$select pg_get_functiondef('public.claim_kommo_writeback_batch(uuid,int)'::regprocedure)$q$);

  for v_n in 1..3 loop
    foreach v_fase in array array['control', 'real'] loop
      if v_fase = 'control' and v_n in (1, 2) then
        -- El claim sin su lock: elige las pendientes sin reservarlas.
        perform pg_temp.variante(jsonb_build_array(
          jsonb_build_array(E'     for update skip locked\n', ''),
          jsonb_build_array(E'     for update\n', '')));
      elsif v_fase = 'control' then
        -- El claim con FOR UPDATE a secas: espera las filas bloqueadas.
        perform pg_temp.variante(jsonb_build_array(
          jsonb_build_array(E'     for update skip locked\n', E'     for update\n'),
          jsonb_build_array(E'     order by o.created_at\n     limit', E'     order by o.created_at\n     for update\n     limit')));
      end if;
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      if v_fase = 'control' then
        perform dblink_exec('c0365_s', v_claim);
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
    pg_temp.ver($q$select md5(pg_get_functiondef('public.claim_kommo_writeback_batch(uuid,int)'::regprocedure))$q$)
      = md5(v_claim),
    'el claim tiene que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no mostraron el defecto: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0365 carrera OK: % aserciones; dos drenajes simultáneos se reparten la cola sin esperarse ni tomar la misma fila',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0365 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0365')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0365 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
