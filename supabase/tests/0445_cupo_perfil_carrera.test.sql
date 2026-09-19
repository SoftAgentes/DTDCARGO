\set ON_ERROR_STOP on

-- Contrato de concurrencia del cupo de 3 cambios del perfil del Portal: el
-- trigger de la migr 0445 con la 0446 (la foto y la fusión) y la 0462 (la
-- edición directa). SDD-0439, que antes fue la 0435. Base propia y desechable
-- dentro del contenedor del runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: la spec 0439 dice que el trigger de la 0445 «serializa por fila de
-- clients, de modo que dos solicitudes simultáneas no pueden superar el
-- límite». En la app el cupo se consume por dos caminos, y cada uno toma FOR
-- UPDATE de la ficha antes de contar: portal_update_my_profile (0462:214) y
-- portal_set_identity_photo (0446:256). Los contratos 0445, 0446, 0461 y 0462
-- corren en una sola sesión y no pueden probarlo.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0449, 0454,
-- 0459, 0460, 0464, 0466 y 0467). El archivo corre en la base `postgres` del
-- runner y, con dblink, abre tres sesiones contra una base propia
-- (dtd_carrera_0445): `s` prepara y observa, `a` escribe primero y deja la
-- transacción abierta, y `b` llega después, en asíncrono. Cada escenario exige
-- ver pg_blocking_pids(b) con `a` adentro antes de que `a` confirme.
--
-- CONTROL en la misma corrida: los escenarios 1 a 6 corren primero con la
-- función que los defiende reemplazada por una variante sin su FOR UPDATE
-- (sacada con pg_get_functiondef de la versión aplicada, y restituida después),
-- y tienen que mostrar el defecto. Después corren con las migraciones reales.
--
-- Los escenarios, con 1 cambio disponible (en la fusión, el superviviente queda
-- con los 3 gastados):
--   1. Dos altas directas de la solicitud aprobada que inserta la 0462, desde un
--      llamador sin lock propio: el contrato del trigger. Real: la segunda
--      espera y recibe profile_edit_limit_reached. Control: el trigger sin su
--      FOR UPDATE (0445:138); pasan las dos y quedan 4 cambios.
--   2. Dos ediciones directas a la vez, con cambios distintos. Real: la segunda
--      espera y recibe el límite. Control: la 0462 y el trigger, los dos sin su
--      FOR UPDATE; pasan las dos. Uno solo de los dos locks alcanza: se cubren
--      entre sí (mutantes M1 y M2).
--   3. Una edición directa y, encima, un cambio de foto. Real: la foto espera y
--      recibe el límite. Control: la foto sin su FOR UPDATE (0446:256); cuenta
--      antes de esperar y pasa.
--   4. Dos cambios de foto a la vez. Real y control como en 3.
--   5. Una fusión retira la ficha y su cliente edita sus datos a la vez. Real:
--      la edición espera y recibe profile_client_not_found. Control: la 0462 sin
--      su FOR UPDATE; el cambio cae en la ficha retirada y se cuenta ahí, fuera
--      del cupo del superviviente. El trigger no lo frena: su FOR UPDATE no mira
--      deleted_at.
--   6. Lo mismo que 5 con un cambio de foto. Control: la foto sin su FOR UPDATE.
--   7. Una fusión y un cambio del superviviente a la vez. Real: el cambio espera
--      la fusión, cuenta la historia unida y recibe el límite. No tiene control:
--      una fusión no aplica el máximo (0446:49-51), así que cualquier orden
--      equivale a uno en serie y no hay defecto que mostrar. Mide que los FOR
--      UPDATE de los triggers de la fusión (0446:75 y :133) no cambian nada:
--      merge_clients ya toma las dos fichas al empezar (0361:84-89).
--
-- FIXTURE: el del contrato 0462, leído de su archivo hasta sus migraciones, más
-- las columnas de clients que exige la 0446 y ese contrato no trae (salen del
-- contrato 0446). Encima, la cadena real 0445 → 0446 → 0447 → 0461 → 0462 en
-- orden de número, como la aplican los contratos 0461 y 0462, y la fusión
-- recortada del contrato 0446, que toma las dos fichas FOR UPDATE al empezar,
-- como merge_clients. Si un contrato cambia de forma, este archivo falla en vez
-- de probar sobre otro fixture. Por escenario, fichas propias con su cliente del
-- Portal.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes fuera del repo, ver .agents/handoffs/0439-carrera-cupo-0445.md):
-- sin el FOR UPDATE del trigger cae 1; sin el de la 0462 cae 5; sin los dos
-- caen 1, 2 y 5; sin el de la foto caen 3, 4 y 6. Sin los de los triggers de la
-- fusión no cae ninguno. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0445 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0445 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0445_%s',
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
    if v_conn like 'c0445\_%' then
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
      'drop database if exists dtd_carrera_0445 with (force)');
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
    raise exception 'TEST 0445 carrera: no encuentro «%» en %', p_desde, p_contrato;
  end if;
  v_txt := substr(v_txt, v_ini + length(p_desde));
  v_fin := position(p_hasta in v_txt);
  if v_fin = 0 then
    raise exception 'TEST 0445 carrera: no encuentro «%» en % después de «%»', p_hasta, p_contrato, p_desde;
  end if;
  v_txt := left(v_txt, v_fin - 1);
  if v_txt ~ '(^|\n)\s*\\' then
    raise exception 'TEST 0445 carrera: el fragmento de % trae un meta-comando de psql', p_contrato;
  end if;
  return v_txt;
end;
$$;

-- Las columnas de clients que la 0446 exige y el contrato 0462 no trae, con la
-- definición que les da el contrato 0446.
create function pg_temp.columnas_0446() returns text language plpgsql as $$
declare
  v_tiene text[];
  v_linea text;
  v_salida text[] := '{}';
begin
  select array_agg(split_part(btrim(l), ' ', 1)) into v_tiene
  from unnest(string_to_array(pg_temp.fragmento('0462_portal_profile_direct_edit.test.sql',
    E'create table public.clients (\n', E'\n);'), E'\n')) as l;
  foreach v_linea in array string_to_array(pg_temp.fragmento('0446_portal_profile_functional_remediation.test.sql',
      E'create table public.clients (\n', E'\n);'), E'\n') loop
    if not split_part(btrim(v_linea), ' ', 1) = any (v_tiene) then
      v_salida := v_salida || format('alter table public.clients add column %s;', rtrim(btrim(v_linea), ','));
    end if;
  end loop;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0445-carrera-' || p_label)::uuid
$$;

-- El fixture y la semilla en UNA transacción explícita: si algo falla, no queda
-- ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.fragmento('0462_portal_profile_direct_edit.test.sql',
      E'\nbegin;\n', E'\n\\ir ../migrations/0445_portal_profile_edit_limit.sql'),
    pg_temp.columnas_0446(),
    pg_read_file('/sb/migrations/0445_portal_profile_edit_limit.sql'),
    pg_read_file('/sb/migrations/0446_portal_profile_functional_remediation.sql'),
    pg_read_file('/sb/migrations/0447_identity_photo_replacement_privacy_gate.sql'),
    pg_read_file('/sb/migrations/0461_identity_photo_replacement_enable.sql'),
    pg_read_file('/sb/migrations/0462_portal_profile_direct_edit.sql'),
    pg_temp.fragmento('0446_portal_profile_functional_remediation.test.sql',
      E'-- orden de los UPDATE son iguales a los de la función productiva.\n',
      E'\ninsert into auth.users(id) values'),
    format('insert into public.tenants (id) values (%L);', pg_temp.id('tenant')),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0445_s', p_sql) as t(r text)
$$;

-- Una ficha del tenant con su cliente del Portal y dos fotos nuevas ya subidas a
-- su prefijo. Con p_foto, además, una foto de identidad cargada: cambiarla
-- consume cupo.
create function pg_temp.ficha(p_label text, p_foto boolean) returns void language plpgsql as $$
declare
  v_prefijo text := pg_temp.id('tenant')::text || '/' || upper(p_label) || '/';
begin
  perform dblink_exec('c0445_s', format($q$
insert into auth.users (id) values (%1$L);
insert into public.clients (id, tenant_id, markbox, name, cedula_photo_path)
  values (%2$L, %3$L, %4$L, %5$L, %6$L);
insert into public.client_users (client_id, auth_user_id, status) values (%2$L, %1$L, 'active');
insert into storage.objects (bucket_id, name) values ('client-docs', %7$L), ('client-docs', %8$L);
$q$, pg_temp.id('principal-' || p_label), pg_temp.id(p_label), pg_temp.id('tenant'), upper(p_label),
    'Cliente ' || p_label, case when p_foto then v_prefijo || 'actual.jpg' end,
    v_prefijo || 'nueva-a.jpg', v_prefijo || 'nueva-b.jpg'));
end;
$$;

-- La solicitud aprobada del cliente que inserta la edición directa (0462): el
-- trigger de la 0445 la cuenta y la asienta como aplicada.
create function pg_temp.alta(p_label text, p_nombre text) returns text language sql as $$
  select format($q$insert into public.client_change_requests
      (tenant_id, client_id, proposed_name, status, source, submitted_at, reviewed_at)
    values (%L, %L, %L, 'approved', 'client', now(), now())$q$,
    pg_temp.id('tenant'), pg_temp.id(p_label), p_nombre)
$$;

-- p_n cambios ya aplicados.
create function pg_temp.consumir(p_label text, p_n integer) returns void language plpgsql as $$
begin
  for i in 1..p_n loop
    perform dblink_exec('c0445_s', pg_temp.alta(p_label, 'Previo ' || i));
  end loop;
end;
$$;

-- Un cambio de foto ya asentado: el asiento sin solicitud que la fusión mueve con
-- el trigger de la 0446:133 (el de la solicitud lo mueve el de la 0446:75).
create function pg_temp.foto_previa(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0445_s', format($q$insert into public.client_profile_edits
      (tenant_id, client_id, edit_kind, status, previous_storage_path, new_storage_path, applied_at)
    values (%L, %L, 'identity_photo', 'applied', 'previa/vieja.jpg', 'previa/nueva.jpg', now())$q$,
    pg_temp.id('tenant'), pg_temp.id(p_label)));
end;
$$;

-- Un teléfono propio por ficha: si se repitiera, la 0462 bloquearía el cambio por
-- duplicado.
create function pg_temp.telefono(p_label text) returns text language sql immutable as $$
  select '58414' || right(lpad(abs(hashtext(p_label))::text, 7, '0'), 7)
$$;

-- Una variante de una función aplicada, sacada de pg_get_functiondef, con los
-- reemplazos de p_cambios. Un reemplazo que no encuentra su texto no cambia nada:
-- en una corrida normal eso deja un control sin defecto que mostrar, y el archivo
-- falla ahí.
create function pg_temp.variante(p_firma text, p_cambios jsonb) returns void language plpgsql as $$
declare
  v_def text := pg_temp.ver(format('select pg_get_functiondef(%L::regprocedure)', p_firma));
  v_c jsonb;
begin
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0445_s', v_def);
end;
$$;

-- Abre la transacción de una sesión: con actor, como el cliente del Portal.
create function pg_temp.abrir(p_conn text, p_actor text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  if p_actor is not null then
    perform dblink_exec(p_conn, 'set local role authenticated');
    perform * from dblink(p_conn, format($q$select set_config('request.jwt.claim.sub', %L, true)$q$,
      pg_temp.id(p_actor))) as t(x text);
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
  select pid into v_a from dblink('c0445_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0445_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0445_a', p_a);
  select r into v_ra from dblink('c0445_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0445_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0445_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0445_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0445 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0445_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0445_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0445_b');
  end if;
  perform * from dblink_get_result('c0445_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0445_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0445_b') = 1 then
    perform dblink_cancel_query('c0445_b');
  end if;
  perform * from dblink_get_result('c0445_b', false) as t(r text);
  perform * from dblink_get_result('c0445_b', false) as t(r text);
  perform dblink_exec('c0445_b', 'rollback', false);
  perform dblink_exec('c0445_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- ── Operaciones ──────────────────────────────────────────────
-- Las dos RPC del Portal que consumen cupo, como las llama perfil/actions.ts.
create function pg_temp.editar(p_nombre text, p_telefono text) returns text language sql as $$
  select format('select outcome from public.portal_update_my_profile(%L, null, %L)', p_nombre, p_telefono)
$$;
create function pg_temp.foto(p_label text, p_archivo text) returns text language sql as $$
  select format('select counted::text from public.portal_set_identity_photo(%L)',
    pg_temp.id('tenant')::text || '/' || upper(p_label) || '/' || p_archivo)
$$;
-- La fusión del Studio: p_retirada queda dentro de p_superviviente.
create function pg_temp.fusionar(p_superviviente text, p_retirada text) returns text language sql as $$
  select format('select public.merge_clients(%L, %L)::text', pg_temp.id(p_superviviente), pg_temp.id(p_retirada))
$$;

-- Cambios que cuentan (reservados o aplicados) de una ficha.
create function pg_temp.activos(p_label text) returns integer language sql as $$
  select pg_temp.ver(format($q$select count(*)::text from public.client_profile_edits
    where client_id = %L and status in ('reserved', 'applied')$q$, pg_temp.id(p_label)))::integer
$$;

-- La ficha: nombre, teléfono, archivo de la foto y si quedó retirada.
create function pg_temp.estado(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object('nombre', name, 'telefono', phone,
      'foto', split_part(cedula_photo_path, '/', 3), 'retirada', deleted_at is not null)::text
    from public.clients where id = %L$q$, pg_temp.id(p_label)))::jsonb
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_c text := 'e' || p_n || left(p_fase, 1);
  v_s text := 'e' || p_n || left(p_fase, 1) || 's';
  v_r jsonb;
begin
  perform pg_temp.ficha(v_c, p_n in (3, 4, 6));
  if p_n <= 4 then
    perform pg_temp.consumir(v_c, 2);
  else
    -- La ficha que se retira trae 2 cambios (una solicitud y una foto) y el
    -- superviviente 1: después de la fusión, el superviviente tiene los 3.
    perform pg_temp.ficha(v_s, false);
    perform pg_temp.consumir(v_s, 1);
    perform pg_temp.consumir(v_c, 1);
    perform pg_temp.foto_previa(v_c);
  end if;
  case p_n
  when 1 then
    v_r := pg_temp.carrera(null, pg_temp.alta(v_c, 'Alta A'), null, pg_temp.alta(v_c, 'Alta B'));
  when 2 then
    v_r := pg_temp.carrera('principal-' || v_c, pg_temp.editar('Nombre A', null),
      'principal-' || v_c, pg_temp.editar(null, pg_temp.telefono(v_c)));
  when 3 then
    v_r := pg_temp.carrera('principal-' || v_c, pg_temp.editar('Nombre A', null),
      'principal-' || v_c, pg_temp.foto(v_c, 'nueva-b.jpg'));
  when 4 then
    v_r := pg_temp.carrera('principal-' || v_c, pg_temp.foto(v_c, 'nueva-a.jpg'),
      'principal-' || v_c, pg_temp.foto(v_c, 'nueva-b.jpg'));
  when 5 then
    v_r := pg_temp.carrera(null, pg_temp.fusionar(v_s, v_c),
      'principal-' || v_c, pg_temp.editar('Nombre R', null));
  when 6 then
    v_r := pg_temp.carrera(null, pg_temp.fusionar(v_s, v_c),
      'principal-' || v_c, pg_temp.foto(v_c, 'nueva-b.jpg'));
  when 7 then
    v_r := pg_temp.carrera(null, pg_temp.fusionar(v_s, v_c),
      'principal-' || v_s, pg_temp.editar('Nombre S', null));
  end case;
  v_r := v_r || jsonb_build_object('activos', pg_temp.activos(v_c), 'ficha', pg_temp.estado(v_c));
  if p_n >= 5 then
    v_r := v_r || jsonb_build_object('activos_sup', pg_temp.activos(v_s), 'sup', pg_temp.estado(v_s));
  end if;
  return v_r;
end;
$$;

-- CONTROL: sin el FOR UPDATE, el defecto se ve. En 1 a 4 pasan los dos cambios y
-- quedan 4; en 5 y 6, el cambio cae en la ficha retirada y se cuenta ahí.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select p_r ->> 'error_b' is null
    and case when p_n <= 4 then (p_r ->> 'activos')::int = 4
             else (p_r ->> 'activos')::int >= 1 end
$$;

-- REAL: `b` esperó a `a` en una fila (transactionid) y recibió el error, sin que
-- su cambio se aplicara. En 1 a 4 el cupo queda en 3; en 5 a 7 la ficha retirada
-- no tiene nada que cuente y el superviviente tiene los 3.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean and p_r ->> 'lock' = 'transactionid'
    and case
      when p_n <= 4 then coalesce(p_r ->> 'error_b' like '%profile_edit_limit_reached%', false)
        and (p_r ->> 'activos')::int = 3
        and case p_n
          when 2 then p_r -> 'ficha' ->> 'nombre' = 'Nombre A' and p_r -> 'ficha' ->> 'telefono' is null
          when 3 then p_r -> 'ficha' ->> 'foto' = 'actual.jpg'
          when 4 then p_r -> 'ficha' ->> 'foto' = 'nueva-a.jpg'
          else true end
      else coalesce(p_r ->> 'error_b' like case when p_n = 7 then '%profile_edit_limit_reached%'
                                                else '%profile_client_not_found%' end, false)
        and (p_r ->> 'activos')::int = 0 and (p_r ->> 'activos_sup')::int = 3
        and (p_r -> 'ficha' ->> 'retirada')::boolean
        and case p_n
          when 5 then p_r -> 'ficha' ->> 'nombre' <> 'Nombre R'
          when 6 then p_r -> 'ficha' ->> 'foto' = 'actual.jpg'
          else p_r -> 'sup' ->> 'nombre' <> 'Nombre S' end
    end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'dos altas directas de la solicitud aprobada',
    'dos ediciones directas a la vez',
    'una edición directa y un cambio de foto',
    'dos cambios de foto a la vez',
    'una fusión retira la ficha y su cliente edita sus datos',
    'una fusión retira la ficha y su cliente cambia la foto',
    'una fusión y un cambio del superviviente'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_trigger text;
  v_edicion text;
  v_foto text;
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0445 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0445 template template0');
  perform dblink_connect('c0445_s', pg_temp.conn('dtd_carrera_0445', 's'));
  perform dblink_connect('c0445_a', pg_temp.conn('dtd_carrera_0445', 'a'));
  perform dblink_connect('c0445_b', pg_temp.conn('dtd_carrera_0445', 'b'));
  perform dblink_exec('c0445_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0445_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0445_b', $t$set statement_timeout = '30s'$t$);

  v_trigger := pg_temp.ver($q$select pg_get_functiondef('public.portal_profile_edit_request_lifecycle()'::regprocedure)$q$);
  v_edicion := pg_temp.ver($q$select pg_get_functiondef('public.portal_update_my_profile(text,text,text)'::regprocedure)$q$);
  v_foto := pg_temp.ver($q$select pg_get_functiondef('public.portal_set_identity_photo(text)'::regprocedure)$q$);

  for v_n in 1..7 loop
    foreach v_fase in array case when v_n = 7 then array['real'] else array['control', 'real'] end loop
      if v_fase = 'control' and v_n in (1, 2) then
        -- El trigger sin su FOR UPDATE de la ficha (0445:138).
        perform pg_temp.variante('public.portal_profile_edit_request_lifecycle()', jsonb_build_array(jsonb_build_array(
          '    perform 1 from public.clients where id = new.client_id for update;',
          '    perform 1 from public.clients where id = new.client_id;')));
      end if;
      if v_fase = 'control' and v_n in (2, 5) then
        -- La edición directa sin su FOR UPDATE de la ficha (0462:214).
        perform pg_temp.variante('public.portal_update_my_profile(text,text,text)', jsonb_build_array(jsonb_build_array(
          E'  where client.id = v_client_id and client.deleted_at is null\n  for update;',
          '  where client.id = v_client_id and client.deleted_at is null;')));
      end if;
      if v_fase = 'control' and v_n in (3, 4, 6) then
        -- La foto sin su FOR UPDATE de la ficha (0446:256).
        perform pg_temp.variante('public.portal_set_identity_photo(text)', jsonb_build_array(jsonb_build_array(
          E'  where client.id = v_client_id and client.deleted_at is null\n  for update;',
          '  where client.id = v_client_id and client.deleted_at is null;')));
      end if;
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      if v_fase = 'control' then
        perform dblink_exec('c0445_s', v_trigger);
        perform dblink_exec('c0445_s', v_edicion);
        perform dblink_exec('c0445_s', v_foto);
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
    pg_temp.ver($q$select md5(pg_get_functiondef('public.portal_profile_edit_request_lifecycle()'::regprocedure))
      || md5(pg_get_functiondef('public.portal_update_my_profile(text,text,text)'::regprocedure))
      || md5(pg_get_functiondef('public.portal_set_identity_photo(text)'::regprocedure))$q$)
      = md5(v_trigger) || md5(v_edicion) || md5(v_foto),
    'el trigger, la edición directa y la foto tienen que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no mostraron el defecto: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0445 carrera OK: % aserciones; el cupo de 3 cambios no se supera aunque dos cambios compitan, y durante una fusión nada se consume sobre la ficha retirada',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0445 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0445')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0445 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
