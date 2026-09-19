\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0449 (SDD-0443): la recepción de cajas por
-- escaneo, las etiquetas del tenant y la conciliación con la lista de empaque,
-- con sesiones reales. Base propia y desechable dentro del contenedor del
-- runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: el qa.md de la SDD-0443 afirma que dos llamadas simultáneas dejan
-- una recepción y tres cajas, con scripts/qa/prealertas-reception-concurrency.mjs.
-- Ese script lanza dos psql con Promise.all y sin barrera: la segunda puede
-- correr después de que la primera confirme, y el verde sale igual sin que haya
-- habido competencia. Además no corre en verify.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0459, 0460,
-- 0464 y 0467). El archivo corre en la base `postgres` del runner y, con dblink,
-- abre tres sesiones contra una base propia (dtd_carrera_0449): `s` prepara y
-- observa, `a` toma el bloqueo y deja la transacción abierta, y `b` llega
-- después, en asíncrono. Cada escenario exige ver pg_blocking_pids(b) con `a`
-- adentro, y el tipo de lock en que espera, antes de que `a` confirme.
--
-- CONTROL en la misma corrida: cada escenario corre primero con una variante de
-- la función sin el lock que defiende (sacada con pg_get_functiondef de la
-- versión aplicada) y tiene que reproducir el defecto. Después corre con la
-- función real y tiene que dar lo correcto. Si un control no reproduce, el
-- archivo falla: el verde nunca sale vacío.
--
-- Los escenarios, con el mecanismo que prueba cada uno:
--   1. Las mismas cajas, dos operarios a la vez (el del script). Real: la
--      segunda espera en el lock de la tabla de recepciones y recibe P0137 «Las
--      cajas cambiaron o ya fueron recibidas»; queda una recepción con tres
--      cajas. Control, sin ninguno de los tres locks: la segunda choca con el
--      código WR- repetido, un error genérico.
--   2. Dos compras del mismo tenant a la vez. Real: la segunda espera en el
--      lock de la tabla y las dos reciben, con códigos WR- consecutivos.
--      Control, sin ese lock: la segunda muere por el código WR- repetido.
--   3. La compra se cancela durante la recepción. Real: la recepción espera la
--      fila de la compra y recibe P0133; no queda recepción y la compra sigue
--      cancelada. Control, sin el FOR UPDATE de la compra: se recibe una compra
--      cancelada y su estado termina en `recibida`.
--   4. Una caja se anula durante la recepción. Real: la recepción espera la
--      fila de la caja y rechaza enseguida con P0137 «Las cajas cambiaron».
--      Control, sin el FOR UPDATE de las cajas: la recepción inserta su recibo
--      y recién al adoptar las cajas aborta con «Recepción concurrente».
--   5. Dos administradores guardan la presentación de etiquetas con la misma
--      versión. Real: el segundo espera en el lock consultivo del tenant y
--      recibe 40001 «Otra sesión cambió las etiquetas». Controles: sin el lock,
--      el segundo choca con la clave primaria (23505); sin la versión esperada,
--      el segundo pisa al primero en silencio.
--   6. Llega una lista de empaque durante la recepción. Real: el trigger de
--      conciliación espera la fila de la compra y, al releerla, ya no cambia el
--      lote. Control, sin su FOR UPDATE: el lote se redimensiona después de
--      empezar la recepción.
--
-- FIXTURE: el del contrato 0449, leído de su archivo con pg_read_file, entre
-- `begin;` y la primera inserción; su `\ir` se reemplaza por la migración. Si el
-- contrato cambia de forma, este archivo falla en vez de probar sobre otro
-- fixture. Encima: un tenant, dos administradores, un operario CN y, por
-- escenario, compras propias con sus cajas.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0449 fuera del repo, ver .agents/handoffs/0443-carrera-recepcion-0449.md):
-- cada lock de la 0449, quitado de a uno, hace fallar sus escenarios. El
-- mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0449 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0449 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0449_%s',
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
    if v_conn like 'c0449\_%' then
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
      'drop database if exists dtd_carrera_0449 with (force)');
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
    raise exception 'TEST 0449 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0449 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0449 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0449 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0449 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0449-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato con la 0449 aplicada, y la semilla, en UNA transacción
-- explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0449_prealerta_exact_box_reception.test.sql',
      E'\nbegin;\n', E'\ninsert into tenants values', '{}'),
    format($seed$
insert into tenants values (%1$L);
insert into auth.users values (%2$L), (%3$L);
insert into user_tenants values (%2$L, %1$L, 'admin', null), (%3$L, %1$L, 'admin', null);
insert into operario_pins values (%4$L, %1$L, 'cn', true, %5$L);
$seed$, pg_temp.id('tenant'), pg_temp.id('admin-1'), pg_temp.id('admin-2'), pg_temp.id('operario'),
      pg_temp.id('almacen')),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0449_s', p_sql) as t(r text)
$$;

-- Una compra anunciada con sus cajas esperadas: DTD-B-<ETIQUETA>-<n>.
create function pg_temp.compra(p_label text, p_cajas integer) returns void language plpgsql as $$
begin
  perform dblink_exec('c0449_s', format($q$insert into prealertas values (%1$L, %2$L, %3$L, 'DTD-0449', null,
      'anunciada', null, %4$s, null);
    insert into warehouse_boxes (tenant_id, prealerta_id, status, code, markbox, seq)
    select %2$L, %1$L, 'esperada', %5$L || n, 'DTD-0449', n from generate_series(1, %4$s) n$q$,
    pg_temp.id(p_label), pg_temp.id('tenant'), 'C-' || upper(p_label), p_cajas,
    'DTD-B-' || upper(p_label) || '-'));
end;
$$;

-- La caja n de una compra.
create function pg_temp.caja(p_label text, p_n integer) returns text language sql immutable as $$
  select 'DTD-B-' || upper(p_label) || '-' || p_n
$$;

-- Una variante de una función aplicada, sacada de pg_get_functiondef: otro
-- nombre (o el mismo, para un trigger) y los reemplazos de p_cambios. Un
-- reemplazo que no encuentra su texto no cambia nada: en una corrida normal eso
-- deja un control sin defecto que reproducir, y el archivo falla ahí.
create function pg_temp.variante(p_firma text, p_nombre text, p_cambios jsonb) returns void
language plpgsql as $$
declare
  v_def text := pg_temp.ver(format('select pg_get_functiondef(%L::regprocedure)', p_firma));
  v_viejo text := split_part(p_firma, '(', 1);
  v_c jsonb;
begin
  v_def := regexp_replace(v_def, '^CREATE OR REPLACE FUNCTION ' || replace(v_viejo, '.', '\.') || '\(',
    'CREATE OR REPLACE FUNCTION ' || p_nombre || '(');
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0449_s', v_def);
end;
$$;

-- Abre la transacción de una sesión con un rol y, si hace falta, un usuario.
create function pg_temp.abrir(p_conn text, p_rol text, p_usuario text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  if p_rol is not null then
    perform dblink_exec(p_conn, format('set local role %I', p_rol));
  end if;
  if p_usuario is not null then
    perform * from dblink(p_conn, format($q$select set_config('test.uid', %L, true)$q$,
      pg_temp.id(p_usuario))) as t(x text);
  end if;
end;
$$;

-- Una carrera: `a` corre p_a_sql y deja la transacción abierta; `b` corre p_b_sql
-- en asíncrono. Devuelve si `b` esperó a `a` (y en qué tipo de lock), lo que
-- devolvió cada uno y el error de `b`, si lo hubo.
create function pg_temp.carrera(p_a_rol text, p_a_usuario text, p_a_sql text,
  p_b_rol text, p_b_usuario text, p_b_sql text) returns jsonb language plpgsql as $$
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
  select pid into v_a from dblink('c0449_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0449_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0449_a', p_a_rol, p_a_usuario);
  select r into v_ra from dblink('c0449_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0449_b', p_b_rol, p_b_usuario);
  perform pg_temp.afirmar(dblink_send_query('c0449_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0449_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0449 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0449_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0449_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0449_b');
  end if;
  perform * from dblink_get_result('c0449_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0449_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0449_b') = 1 then
    perform dblink_cancel_query('c0449_b');
  end if;
  perform * from dblink_get_result('c0449_b', false) as t(r text);
  perform * from dblink_get_result('c0449_b', false) as t(r text);
  perform dblink_exec('c0449_b', 'rollback', false);
  perform dblink_exec('c0449_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- Una recepción por escaneo, con la función real o con una variante.
create function pg_temp.recibir(p_funcion text, p_escaneada text, p_cajas text[]) returns text
language sql as $$
  select format('select %s(%L, %L, %L::text[])::text', p_funcion, pg_temp.id('operario'), p_escaneada, p_cajas)
$$;

create function pg_temp.guardar(p_funcion text, p_tamano text, p_version integer) returns text
language sql as $$
  select format($q$select %s('{"showBrand":true,"language":"zh-es","size":%s}'::jsonb, %s)::text$q$,
    p_funcion, to_jsonb(p_tamano), p_version)
$$;

-- Lo que quedó de una compra, visto desde `s`.
create function pg_temp.estado(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'estado', p.status, 'lote', p.boxes,
      'recepciones', (select count(*) from warehouse_receipts_cn r where r.prealerta_id = p.id),
      'recibidas', (select count(*) from warehouse_boxes b where b.prealerta_id = p.id and b.status = 'recibida'),
      'codigos', (select coalesce(jsonb_agg(r.receipt_code order by r.receipt_code), '[]')
                  from warehouse_receipts_cn r where r.prealerta_id = p.id))::text
    from prealertas p where p.id = %L$q$, pg_temp.id(p_label)))::jsonb
$$;

create function pg_temp.versiones() returns jsonb language sql as $$
  select pg_temp.ver(format($q$select coalesce(jsonb_agg(jsonb_build_object('version', version,
      'tamano', settings ->> 'size') order by version), '[]')::text
    from shipping_label_versions where tenant_id = %L$q$, pg_temp.id('tenant')))::jsonb
$$;

create function pg_temp.version_actual() returns integer language sql as $$
  select pg_temp.ver(format('select coalesce(max(version), 0)::text from shipping_label_versions where tenant_id = %L',
    pg_temp.id('tenant')))::integer
$$;

-- ── Escenarios ───────────────────────────────────────────────
-- p_fase: 'control' (con la variante sin el lock) o 'real'. Devuelve la
-- carrera y lo que quedó, y el main decide si reprodujo o si fue correcto.
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_l text := 'e' || p_n || left(p_fase, 1);
  v_l2 text := 'e' || p_n || left(p_fase, 1) || 'b';
  v_recibir text := case when p_fase = 'real' then 'public.receive_prealerta_boxes_as_operario'
    else 'public.recibir_control_' || p_n end;
  v_guardar text;
  v_version integer;
  v_r jsonb;
begin
  case p_n
  when 1 then
    perform pg_temp.compra(v_l, 3);
    v_r := pg_temp.carrera(
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l, 1),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2), pg_temp.caja(v_l, 3)]),
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l, 2),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2), pg_temp.caja(v_l, 3)]));
    return v_r || jsonb_build_object('compra', pg_temp.estado(v_l));
  when 2 then
    perform pg_temp.compra(v_l, 2);
    perform pg_temp.compra(v_l2, 2);
    v_r := pg_temp.carrera(
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l, 1),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2)]),
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l2, 1),
        array[pg_temp.caja(v_l2, 1), pg_temp.caja(v_l2, 2)]));
    return v_r || jsonb_build_object('compra', pg_temp.estado(v_l), 'compra_2', pg_temp.estado(v_l2));
  when 3 then
    perform pg_temp.compra(v_l, 3);
    v_r := pg_temp.carrera(
      null, null, format($q$with u as (update prealertas set status = 'cancelada' where id = %L returning 1)
        select count(*)::text from u$q$, pg_temp.id(v_l)),
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l, 1),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2), pg_temp.caja(v_l, 3)]));
    return v_r || jsonb_build_object('compra', pg_temp.estado(v_l));
  when 4 then
    perform pg_temp.compra(v_l, 3);
    v_r := pg_temp.carrera(
      null, null, format($q$with u as (update warehouse_boxes set deleted_at = now() where code = %L returning 1)
        select count(*)::text from u$q$, pg_temp.caja(v_l, 2)),
      'service_role', null, pg_temp.recibir(v_recibir, pg_temp.caja(v_l, 1),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2)]));
    return v_r || jsonb_build_object('compra', pg_temp.estado(v_l));
  when 5 then
    -- 5a sin el lock consultivo y 5b sin la versión esperada; en real, la función.
    v_guardar := case p_fase when 'real' then 'public.save_shipping_label_presentation'
      when 'control' then 'public.guardar_control_5a' else 'public.guardar_control_5b' end;
    v_version := pg_temp.version_actual();
    v_r := pg_temp.carrera(
      'authenticated', 'admin-1', pg_temp.guardar(v_guardar, 'standard', v_version),
      'authenticated', 'admin-2', pg_temp.guardar(v_guardar, 'large', v_version));
    return v_r || jsonb_build_object('antes', v_version, 'versiones', pg_temp.versiones());
  when 6 then
    perform pg_temp.compra(v_l, 3);
    v_r := pg_temp.carrera(
      'service_role', null, pg_temp.recibir('public.receive_prealerta_boxes_as_operario', pg_temp.caja(v_l, 1),
        array[pg_temp.caja(v_l, 1), pg_temp.caja(v_l, 2)]),
      null, null, format($q$with i as (insert into packing_list_submissions (tenant_id, prealerta_id, total_ctns,
          is_current) values (%L, %L, 5, true) returning 1) select count(*)::text from i$q$,
        pg_temp.id('tenant'), pg_temp.id(v_l)));
    return v_r || jsonb_build_object('compra', pg_temp.estado(v_l));
  end case;
end;
$$;

-- CONTROL: sin el lock, el escenario tiene que mostrar el defecto.
create function pg_temp.reproduce(p_fase text, p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case
    when p_n in (1, 2) then coalesce(p_r ->> 'error_b' like '%duplicate key%', false)
    when p_n = 3 then p_r ->> 'error_b' is null and (p_r -> 'compra' ->> 'recepciones')::int = 1
      and p_r -> 'compra' ->> 'estado' = 'recibida'
    when p_n = 4 then coalesce(p_r ->> 'error_b' like '%Recepción concurrente%', false)
    when p_n = 5 and p_fase = 'control' then coalesce(p_r ->> 'error_b' like '%duplicate key%', false)
    when p_n = 5 then p_r ->> 'error_b' is null
      and jsonb_array_length(p_r -> 'versiones') = (p_r ->> 'antes')::int + 2
    when p_n = 6 then (p_r -> 'compra' ->> 'lote')::int = 5
  end
$$;

-- REAL: `b` esperó a `a` en el lock que corresponde y el resultado es el correcto.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean
    and p_r ->> 'lock' = case when p_n in (1, 2) then 'relation' when p_n = 5 then 'advisory'
      else 'transactionid' end
    and case
      when p_n = 1 then coalesce(p_r ->> 'error_b' like '%Las cajas cambiaron o ya fueron recibidas%', false)
        and (p_r -> 'compra' ->> 'recepciones')::int = 1 and (p_r -> 'compra' ->> 'recibidas')::int = 3
      when p_n = 2 then p_r ->> 'error_b' is null
        and (p_r -> 'compra' ->> 'recepciones')::int = 1 and (p_r -> 'compra_2' ->> 'recepciones')::int = 1
        and p_r -> 'compra' -> 'codigos' <> p_r -> 'compra_2' -> 'codigos'
      when p_n = 3 then coalesce(p_r ->> 'error_b' like '%no está activa%', false)
        and (p_r -> 'compra' ->> 'recepciones')::int = 0 and p_r -> 'compra' ->> 'estado' = 'cancelada'
      when p_n = 4 then coalesce(p_r ->> 'error_b' like '%Las cajas cambiaron o ya fueron recibidas%', false)
        and (p_r -> 'compra' ->> 'recepciones')::int = 0
      when p_n = 5 then coalesce(p_r ->> 'error_b' like '%Otra sesión cambió las etiquetas%', false)
        and jsonb_array_length(p_r -> 'versiones') = (p_r ->> 'antes')::int + 1
        and p_r -> 'versiones' -> -1 ->> 'tamano' = 'standard'
      when p_n = 6 then (p_r -> 'compra' ->> 'lote')::int = 3 and (p_r -> 'compra' ->> 'recibidas')::int = 2
    end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'las mismas cajas, dos operarios a la vez',
    'dos compras del mismo tenant a la vez',
    'la compra se cancela durante la recepción',
    'una caja se anula durante la recepción',
    'dos administradores guardan las etiquetas con la misma versión',
    'llega una lista de empaque durante la recepción'])[p_n]
$$;

do $carrera$
declare
  v_casos jsonb := '[[1,"control"],[1,"real"],[2,"control"],[2,"real"],[3,"control"],[3,"real"],
    [4,"control"],[4,"real"],[5,"control"],[5,"control_b"],[5,"real"],[6,"control"],[6,"real"]]';
  v_caso jsonb;
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_conciliar text;
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0449 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0449 template template0');
  perform dblink_connect('c0449_s', pg_temp.conn('dtd_carrera_0449', 's'));
  perform dblink_connect('c0449_a', pg_temp.conn('dtd_carrera_0449', 'a'));
  perform dblink_connect('c0449_b', pg_temp.conn('dtd_carrera_0449', 'b'));
  perform dblink_exec('c0449_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0449_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0449_b', $t$set statement_timeout = '30s'$t$);

  -- Las variantes de los controles, sacadas de las funciones aplicadas.
  perform pg_temp.variante('public.receive_prealerta_boxes_as_operario(uuid,text,text[])', 'public.recibir_control_1',
    jsonb_build_array(
      jsonb_build_array(E'  lock table public.warehouse_receipts_cn in share row exclusive mode;\n', ''),
      jsonb_build_array(E'and pr.tenant_id = v_op.tenant_id\n    for update;', 'and pr.tenant_id = v_op.tenant_id;'),
      jsonb_build_array('and code = any(v_selected) for update;', 'and code = any(v_selected);')));
  perform pg_temp.variante('public.receive_prealerta_boxes_as_operario(uuid,text,text[])', 'public.recibir_control_2',
    jsonb_build_array(
      jsonb_build_array(E'  lock table public.warehouse_receipts_cn in share row exclusive mode;\n', '')));
  perform pg_temp.variante('public.receive_prealerta_boxes_as_operario(uuid,text,text[])', 'public.recibir_control_3',
    jsonb_build_array(
      jsonb_build_array(E'and pr.tenant_id = v_op.tenant_id\n    for update;', 'and pr.tenant_id = v_op.tenant_id;')));
  perform pg_temp.variante('public.receive_prealerta_boxes_as_operario(uuid,text,text[])', 'public.recibir_control_4',
    jsonb_build_array(
      jsonb_build_array('and code = any(v_selected) for update;', 'and code = any(v_selected);')));
  perform pg_temp.variante('public.save_shipping_label_presentation(jsonb,integer)', 'public.guardar_control_5a',
    jsonb_build_array(
      jsonb_build_array(E'  perform pg_advisory_xact_lock(hashtextextended(''shipping-label:'' || v_tenant::text, 0));\n', '')));
  perform pg_temp.variante('public.save_shipping_label_presentation(jsonb,integer)', 'public.guardar_control_5b',
    jsonb_build_array(
      jsonb_build_array(E'  if p_expected_version is distinct from v_version then\n'
        || E'    raise exception ''Otra sesión cambió las etiquetas. Actualiza antes de guardar.'' using errcode = ''40001'';\n'
        || E'  end if;\n', '')));
  perform dblink_exec('c0449_s', 'grant execute on function public.recibir_control_1(uuid,text,text[]),
    public.recibir_control_2(uuid,text,text[]), public.recibir_control_3(uuid,text,text[]),
    public.recibir_control_4(uuid,text,text[]) to service_role;
    grant execute on function public.guardar_control_5a(jsonb,integer), public.guardar_control_5b(jsonb,integer)
    to authenticated');
  v_conciliar := pg_temp.ver($q$select pg_get_functiondef('public.reconcile_labels_after_packing_list()'::regprocedure)$q$);

  for v_caso in select * from jsonb_array_elements(v_casos) loop
    v_n := (v_caso ->> 0)::integer;
    v_fase := v_caso ->> 1;
    -- El control del 6 cambia el trigger por su variante y lo restituye después.
    if v_n = 6 and v_fase = 'control' then
      perform pg_temp.variante('public.reconcile_labels_after_packing_list()',
        'public.reconcile_labels_after_packing_list',
        jsonb_build_array(jsonb_build_array('and tenant_id = new.tenant_id for update;', 'and tenant_id = new.tenant_id;')));
    end if;
    begin
      v_r := pg_temp.escenario(v_fase, v_n);
    exception when others then
      v_r := jsonb_build_object('excepcion', sqlerrm);
      perform pg_temp.reponer();
    end;
    if v_n = 6 and v_fase = 'control' then
      perform dblink_exec('c0449_s', v_conciliar);
    end if;
    v_ok := case when v_r ? 'excepcion' then false
      when v_fase = 'real' then pg_temp.correcto(v_n, v_r)
      else pg_temp.reproduce(v_fase, v_n, v_r) end;
    perform nextval('pg_temp.carrera_aserciones');
    if not coalesce(v_ok, false) then
      v_fallan := jsonb_set(v_fallan, array[case when v_fase = 'real' then 'real' else 'control' end],
        (v_fallan -> case when v_fase = 'real' then 'real' else 'control' end) || to_jsonb(v_n));
      v_detalle := v_detalle || format('%s %s (%s): %s', v_fase, v_n, pg_temp.nombre(v_n), v_r);
    end if;
  end loop;

  perform pg_temp.afirmar(pg_temp.ver($q$select md5(pg_get_functiondef('public.reconcile_labels_after_packing_list()'::regprocedure))$q$)
      = md5(v_conciliar), 'el trigger de conciliación tiene que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no reprodujeron el defecto: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0449 carrera OK: % aserciones; los seis escenarios reproducen el defecto sin su lock y se serializan con la 0449',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0449 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0449')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0449 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
