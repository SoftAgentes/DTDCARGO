\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0459 (SDD-0478): el relevo de la tarifa
-- programada respeta la cancelación que el founder confirma mientras corre.
-- Base propia y desechable dentro del contenedor del runner: nunca consulta ni
-- modifica una base alojada.
--
-- POR QUÉ: el segundo UPDATE de promover_tarifas_programadas()
-- (`set is_public = true, publica_programada = false where id = v_row.id`) no
-- vuelve a mirar publica_programada. Si el founder desprograma, pospone o
-- archiva la programada mientras corre el job, sólo el `for update` del SELECT
-- hace que el relevo espere, relea la fila y la descarte. Sin él, publica la
-- tarifa cancelada. PGlite tiene una sola conexión: por eso el mutante «sin
-- for update» sobrevivía a lib/studio/tarifa-programada.migration.test.ts.
--
-- CÓMO: el archivo corre en la base `postgres` del runner y, con dblink, abre
-- tres sesiones contra una base propia (dtd_carrera_0459):
--   s  prepara y observa, en autocommit;
--   f  el founder: abre una transacción, cancela la programada y no confirma;
--   j  el job: llama a promover_tarifas_programadas() y queda esperando a f.
-- La barrera es determinista: f confirma cuando pg_blocking_pids(j) ya
-- contiene a f. No hay sleep que calibrar.
--
-- Piezas REALES, leídas con pg_read_file del montaje /sb del runner (como en
-- la 0460): el índice singleton de 0255, el guard de listas de 0382 con su
-- trigger, la 0458 entera (la RPC del sitio) y la 0459 entera.
--
-- Lo que defiende, con una $850 pública y una $900 programada para hoy (día de
-- Caracas), cuando la cancelación llega con el relevo en curso:
--   1. Desprogramar: el relevo devuelve [] y el sitio sigue en $850.
--   2. Posponer una semana: el relevo devuelve [] y la $900 sigue programada.
--   3. Archivar: el relevo devuelve [] y la $900 no queda pública ni programada.
--   CONTROL, en cada corrida: la función instalada sin su `for update`
--   (derivada de pg_get_functiondef) publica la $900 en los tres casos. Si no
--   la publica, el escenario dejó de ejercer la carrera y el test falla: el
--   verde no puede ser vacío.
--
-- SIN HUELLA: los archivos que corren después comparten este clúster. La base
-- propia y los roles anon, authenticated y service_role (la 0458 y la 0459 los
-- nombran, así que no pueden llamarse de otra forma) se borran también cuando
-- algo falla, antes de propagar el error. dblink se crea dentro de la
-- transacción del archivo y se va con el rollback. El cierre comprueba que no
-- quedó nada.
--
-- RED: la 0459 sin la línea `for update`, en una copia de supabase/ fuera del
-- repo (comando en .agents/handoffs/0478-carrera-for-update-0459.md): falla con
-- «publicó la tarifa que el founder canceló».
--
-- Límite: requiere dblink (contrib de la imagen postgres:17). No corre en CI,
-- porque scripts/__tests__/ci-workflow-contract.test.mjs deja Docker fuera,
-- como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0459 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0459 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0459_%s',
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
    if v_conn like 'c0459\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  begin
    -- with (force) termina a f y a j si quedaron esperando.
    perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
      'drop database if exists dtd_carrera_0459 with (force)');
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

-- El fixture como UNA consulta simple de varias sentencias: corre en una sola
-- transacción, así que si algo falla no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
declare
  v_0255 text := pg_read_file('/sb/migrations/0255_rates_public_calc_modo.sql');
  v_0382 text := pg_read_file('/sb/migrations/0382_price_books.sql');
  v_indice text := (regexp_match(v_0255,
    'create unique index if not exists rates_one_public_cbm_per_tenant_modo.*?;'))[1];
  v_guard text := (regexp_match(v_0382,
    'create or replace function public\.rates_guard_price_book\(\).*?\$\$;'))[1];
  v_trigger text := (regexp_match(v_0382, 'create trigger rates_guard_price_book_t.*?;'))[1];
begin
  if v_indice is null or v_guard is null or v_trigger is null then
    raise exception 'TEST 0459 carrera: no encuentro en 0255/0382 el índice, el guard o su trigger';
  end if;
  return concat_ws(E'\n',
    $f$
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create table public.tenants (id uuid primary key default gen_random_uuid(), slug text unique not null);
      create table public.price_books (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id),
        is_house boolean not null default false,
        deleted_at timestamptz);
      create table public.rates (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id),
        price_book_id uuid references public.price_books(id),
        per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
        valid_from date, valid_until date,
        is_public boolean not null default false,
        status text not null default 'published',
        public_calc_modo text not null default 'ddp',
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        check (per_cbm is not null or flat_rate is not null));
      insert into public.tenants (slug) values ('dtd');
      insert into public.price_books (tenant_id, is_house) select id, true from public.tenants;
      -- pg_cron mínimo: la 0459 programa su job por nombre, como el real (upsert).
      create schema cron;
      create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
      create function cron.schedule(job_name text, schedule text, command text) returns bigint
        language sql as $cron$
          insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
          on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
          returning jobid
        $cron$;
    $f$,
    v_indice, v_guard, v_trigger,
    pg_read_file('/sb/migrations/0458_tarifa_lectura_sin_vigencia.sql'),
    pg_read_file('/sb/migrations/0459_tarifa_programada_a_futuro.sql'),
    -- La 0459 deja sus timeouts en la sesión, y dblink_exec no admite que la
    -- última sentencia devuelva filas (la 0459 termina con un select).
    'reset lock_timeout; reset statement_timeout;');
end;
$$;

-- Una carrera: el founder cancela la programada y, antes de que confirme, el
-- job corre el relevo. Devuelve lo que hizo el relevo, lo que quedó en
-- `rates` y lo que cotiza el sitio.
create function pg_temp.carrera(p_caso text, p_cancela text) returns jsonb language plpgsql as $$
declare
  v_f int;
  v_j int;
  v_limite timestamptz;
  v_relevo jsonb;
  v_filas jsonb;
  v_sitio numeric;
begin
  -- $850 pública desde hace dos semanas y $900 programada para hoy.
  perform dblink_exec('c0459_s', $sembrar$
    delete from public.rates;
    insert into public.rates (tenant_id, price_book_id, per_cbm, min_charge, is_public, valid_from)
      select t.id, pb.id, 850, 50, true, (now() at time zone 'America/Caracas')::date - 14
        from public.tenants t join public.price_books pb on pb.tenant_id = t.id and pb.is_house;
    insert into public.rates (tenant_id, price_book_id, per_cbm, min_charge, publica_programada, valid_from)
      select t.id, pb.id, 900, 50, true, (now() at time zone 'America/Caracas')::date
        from public.tenants t join public.price_books pb on pb.tenant_id = t.id and pb.is_house
  $sembrar$);
  select pid into v_f from dblink('c0459_f', 'select pg_backend_pid()') as t(pid int);
  select pid into v_j from dblink('c0459_j', 'select pg_backend_pid()') as t(pid int);

  -- f toma la fila de la programada, la cancela y NO confirma.
  perform dblink_exec('c0459_f', 'begin');
  perform pg_temp.afirmar(dblink_exec('c0459_f', p_cancela) = 'UPDATE 1',
    p_caso || ': la cancelación del founder tiene que tocar la programada');

  -- j corre el relevo sin esperar la respuesta.
  perform pg_temp.afirmar(
    dblink_send_query('c0459_j', 'select public.promover_tarifas_programadas()::text') = 1,
    p_caso || ': el relevo tiene que salir');

  -- Barrera: j tiene que quedar esperando a f. f no confirma hasta verlo, así
  -- que una vez bloqueado no se desbloquea solo.
  v_limite := clock_timestamp() + interval '10 seconds';
  loop
    exit when v_f = any (pg_blocking_pids(v_j));
    if dblink_is_busy('c0459_j') = 0 then
      raise exception 'TEST 0459 carrera: %: el relevo terminó sin esperar al founder; la carrera no ocurrió', p_caso;
    end if;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0459 carrera: %: el relevo no quedó esperando al founder en 10 s', p_caso;
    end if;
    perform pg_sleep(0.01);
  end loop;

  -- f confirma; j retoma y termina.
  perform dblink_exec('c0459_f', 'commit');
  select r::jsonb into v_relevo from dblink_get_result('c0459_j') as t(r text);
  perform * from dblink_get_result('c0459_j') as t(r text);  -- cierre del resultado asíncrono

  select jsonb_object_agg(per_cbm::int::text,
           jsonb_build_object('publica', is_public, 'programada', publica_programada))
    into v_filas
    from dblink('c0459_s', 'select per_cbm, is_public, publica_programada from public.rates')
      as t(per_cbm numeric, is_public boolean, publica_programada boolean);
  select per_cbm into v_sitio
    from dblink('c0459_s', $q$select per_cbm from public.public_cbm_rate('ddp')$q$) as t(per_cbm numeric);
  return jsonb_build_object('caso', p_caso, 'relevo', v_relevo, 'filas', v_filas, 'sitio', v_sitio);
end;
$$;

do $carrera$
declare
  -- Cada cancelación y lo que tiene que quedar si el relevo la respeta.
  v_casos constant jsonb := jsonb_build_array(
    jsonb_build_object('caso', 'desprogramar',
      'cancela', 'update public.rates set publica_programada = false where per_cbm = 900',
      'queda', '{"850": {"publica": true, "programada": false}, "900": {"publica": false, "programada": false}}'::jsonb),
    jsonb_build_object('caso', 'posponer una semana',
      'cancela', $c$update public.rates set valid_from = (now() at time zone 'America/Caracas')::date + 7 where per_cbm = 900$c$,
      'queda', '{"850": {"publica": true, "programada": false}, "900": {"publica": false, "programada": true}}'::jsonb),
    jsonb_build_object('caso', 'archivar',
      'cancela', $c$update public.rates set status = 'archived' where per_cbm = 900$c$,
      'queda', '{"850": {"publica": true, "programada": false}, "900": {"publica": false, "programada": false}}'::jsonb));
  -- La línea `for update` del SELECT del relevo, sola en su renglón. El
  -- comentario del cuerpo que la nombra no calza: tiene texto alrededor.
  c_for_update constant text := '\n\s*for update\s*\n';
  v_caso jsonb;
  v_r jsonb;
  v_def text;
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0459 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0459 template template0');
  perform dblink_connect('c0459_s', pg_temp.conn('dtd_carrera_0459', 's'));
  perform dblink_connect('c0459_f', pg_temp.conn('dtd_carrera_0459', 'f'));
  perform dblink_connect('c0459_j', pg_temp.conn('dtd_carrera_0459', 'j'));
  -- Nadie espera para siempre.
  perform dblink_exec('c0459_f', $t$set statement_timeout = '20s'$t$);
  perform dblink_exec('c0459_j', $t$set statement_timeout = '20s'$t$);
  perform dblink_exec('c0459_s', pg_temp.fixture());

  -- 1-3. La 0459 tal cual: cada cancelación se respeta.
  for v_caso in select * from jsonb_array_elements(v_casos) loop
    v_r := pg_temp.carrera(v_caso ->> 'caso', v_caso ->> 'cancela');
    perform pg_temp.afirmar(v_r #> '{relevo,promovidas}' = '[]'::jsonb,
      format('%s: el relevo publicó la tarifa que el founder canceló mientras corría (¿falta el for update?): %s',
        v_caso ->> 'caso', v_r));
    perform pg_temp.afirmar(v_r -> 'filas' = v_caso -> 'queda',
      format('%s: quedó otro estado en rates: %s', v_caso ->> 'caso', v_r));
    perform pg_temp.afirmar((v_r ->> 'sitio')::numeric = 850,
      format('%s: el sitio tiene que seguir cotizando $850: %s', v_caso ->> 'caso', v_r));
  end loop;

  -- CONTROL: la misma función, sin su `for update`, cae en los tres casos.
  select d into v_def
    from dblink('c0459_s', $q$select pg_get_functiondef('public.promover_tarifas_programadas()'::regprocedure)$q$)
      as t(d text);
  perform pg_temp.afirmar((select count(*) from regexp_matches(v_def, c_for_update, 'g')) = 1,
    'control: el relevo instalado tiene que tener un único `for update` propio');
  perform dblink_exec('c0459_s', regexp_replace(v_def, c_for_update, E'\n'));
  perform pg_temp.afirmar(not exists (
      select from dblink('c0459_s', $q$select pg_get_functiondef('public.promover_tarifas_programadas()'::regprocedure)$q$)
        as t(d text)
       where d ~ c_for_update),
    'control: el mutante sin `for update` tiene que quedar instalado');
  for v_caso in select * from jsonb_array_elements(v_casos) loop
    v_r := pg_temp.carrera(v_caso ->> 'caso', v_caso ->> 'cancela');
    perform pg_temp.afirmar(
      (v_r #>> '{relevo,promovidas,0,per_cbm}')::numeric = 900
        and jsonb_array_length(v_r #> '{relevo,promovidas}') = 1
        and (v_r #> '{filas,900,publica}') = 'true'::jsonb,
      format('CONTROL %s: sin el for update el relevo tenía que publicar la $900 cancelada; si no la publica, la carrera no se ejerció: %s',
        v_caso ->> 'caso', v_r));
  end loop;

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0459 carrera OK: % aserciones; el relevo respeta las tres cancelaciones y, sin el for update, las pisa',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0459 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0459')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0459 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
