\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0454 (SDD-0467): borrar un cliente
-- revoca su acceso al Portal también cuando otra escritura de acceso compite
-- con el borrado. Base propia y desechable dentro del contenedor del runner:
-- nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: la cabecera de la 0454 describe su concurrencia con dos mecanismos:
--   · la revocación actualiza TODAS las filas de client_users del cliente, sin
--     filtrar por estado: una reinvitación concurrente queda esperando esa fila
--     y, al re-evaluar, también se revoca;
--   · la guarda portal_access_require_live_client toma FOR SHARE sobre el
--     cliente cuando la fila es nueva o se muda de cliente: espera al borrado en
--     curso y, al confirmarse, lo rechaza.
-- El contrato 0454_borrar_cliente_revoca_portal.test.sql corre en una sola
-- sesión y no puede probarlo. El FOR UPDATE de client_users de la 0454 (su
-- línea 411) está en el backfill que corrió una sola vez al aplicar: no es de
-- tiempo de ejecución.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0449, 0459,
-- 0460, 0464, 0466 y 0467). El archivo corre en la base `postgres` del runner
-- y, con dblink, abre tres sesiones contra una base propia (dtd_carrera_0454):
-- `s` prepara y observa, `a` escribe primero y deja la transacción abierta, y
-- `b` llega después, en asíncrono. Cada escenario exige ver pg_blocking_pids(b)
-- con `a` adentro antes de que `a` confirme.
--
-- CONTROL en la misma corrida: cada escenario corre primero con la función de
-- la 0454 que lo defiende reemplazada por una variante sin su mecanismo
-- (sacada con pg_get_functiondef de la versión aplicada, y restituida
-- después), y tiene que dejar un acceso vigente sobre un cliente borrado.
-- Después corre con la 0454 y no puede quedar ninguno.
--
-- Los escenarios, con el Studio de un lado (el borrado por RLS, como
-- softDeleteClientAction, y las RPC reales de invitación y de códigos):
--   Guarda con FOR SHARE (la fila es nueva o se muda):
--   1. Se borra el cliente y llega una invitación nueva (portal_invite_client
--      inserta). Real: la invitación espera el borrado y lo rechaza con 23514.
--   2. Llega una invitación nueva y se borra el cliente. Real: el borrado
--      espera la invitación y la revoca.
--   3. Se borra el cliente y llega un código corto nuevo
--      (portal_create_access_link). Real: espera y lo rechaza.
--   4. Se borra el cliente y otro vínculo se muda a él (el UPDATE de
--      client_id que hace una fusión). Real: espera y lo rechaza.
--   Control de 1 a 4: la guarda sin su FOR SHARE.
--   Revocación sin filtrar por estado (el cliente ya tenía un vínculo revocado):
--   5. Se borra el cliente y llega una reinvitación (portal_invite_client
--      reactiva la fila). Real: la reinvitación espera la fila y la guarda la
--      rechaza.
--   6. Llega una reinvitación y se borra el cliente. Real: el borrado espera la
--      fila y, al re-evaluar, también la revoca.
--   Control de 5 y 6: la revocación que se salta las filas ya revocadas.
--
-- FIXTURE: el del contrato 0454, leído de su archivo con pg_read_file hasta sus
-- utilidades (migraciones reales 0006, 0080, 0081, 0230, 0360 y 0361, la
-- auditoría y el D5 de client_users), con la 0454 entera encima. Si el contrato
-- cambia de forma, este archivo falla en vez de probar sobre otro fixture.
-- Encima, un tenant con su administrador y, por escenario, clientes propios.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0454 fuera del repo, ver
-- .agents/handoffs/0467-carrera-borrado-0454.md): cada mecanismo, quitado de a
-- uno, hace fallar sus escenarios. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0454 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0454 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0454_%s',
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
    if v_conn like 'c0454\_%' then
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
      'drop database if exists dtd_carrera_0454 with (force)');
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
    raise exception 'TEST 0454 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0454 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0454 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0454 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0454 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0454-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato con la 0454 aplicada, y la semilla, en UNA
-- transacción explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0454_borrar_cliente_revoca_portal.test.sql',
      E'\nbegin;\n', E'\n-- ─── Utilidades', '{}'),
    pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql'),
    format($seed$
insert into public.tenants (id, slug, display_name) values (%1$L, 'carrera-0454', 'Tenant de la carrera 0454');
insert into auth.users (id, email) values (%2$L, 'studio-0454@carrera.invalid');
insert into public.user_tenants (user_id, tenant_id, role) values (%2$L, %1$L, 'admin');
$seed$, pg_temp.id('tenant'), pg_temp.id('studio')),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0454_s', p_sql) as t(r text)
$$;

-- Un cliente vivo del tenant, con email para poder invitarlo.
create function pg_temp.cliente(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0454_s', format($q$insert into public.clients (id, tenant_id, markbox, name, email)
    values (%L, %L, %L, %L, %L)$q$, pg_temp.id(p_label), pg_temp.id('tenant'), upper(p_label),
    'Cliente ' || p_label, p_label || '@carrera.invalid'));
end;
$$;

-- Un vínculo de un cliente, con el estado dado: revocado, o activo con su propio
-- principal (auth_user_id es único en client_users).
create function pg_temp.vinculo(p_label text, p_estado text) returns void language plpgsql as $$
begin
  if p_estado = 'active' then
    perform dblink_exec('c0454_s', format($q$insert into auth.users (id, email) values (%L, %L)$q$,
      pg_temp.id('principal-' || p_label), 'principal-' || p_label || '@carrera.invalid'));
  end if;
  perform dblink_exec('c0454_s', format($q$insert into public.client_users (id, tenant_id, client_id, email,
      auth_user_id, token, status, bound_at, revoked_at)
    values (%L, %L, %L, %L, %L, null, %L, %L, %L)$q$,
    pg_temp.id('vinculo-' || p_label), pg_temp.id('tenant'), pg_temp.id(p_label), p_label || '@carrera.invalid',
    case when p_estado = 'active' then pg_temp.id('principal-' || p_label) end, p_estado,
    case when p_estado = 'active' then now() end, case when p_estado = 'revoked' then now() end));
end;
$$;

-- Una variante de una función aplicada, sacada de pg_get_functiondef, con el
-- mismo nombre (son funciones de trigger) y los reemplazos de p_cambios. Un
-- reemplazo que no encuentra su texto no cambia nada: en una corrida normal eso
-- deja un control sin defecto que mostrar, y el archivo falla ahí.
create function pg_temp.variante(p_firma text, p_cambios jsonb) returns void language plpgsql as $$
declare
  v_def text := pg_temp.ver(format('select pg_get_functiondef(%L::regprocedure)', p_firma));
  v_c jsonb;
begin
  for v_c in select * from jsonb_array_elements(p_cambios) loop
    v_def := replace(v_def, v_c ->> 0, v_c ->> 1);
  end loop;
  perform dblink_exec('c0454_s', v_def);
end;
$$;

-- Abre la transacción de una sesión: con actor, como el administrador del Studio.
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
  select pid into v_a from dblink('c0454_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0454_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0454_a', p_a);
  select r into v_ra from dblink('c0454_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0454_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0454_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0454_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0454 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0454_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0454_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0454_b');
  end if;
  perform * from dblink_get_result('c0454_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0454_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0454_b') = 1 then
    perform dblink_cancel_query('c0454_b');
  end if;
  perform * from dblink_get_result('c0454_b', false) as t(r text);
  perform * from dblink_get_result('c0454_b', false) as t(r text);
  perform dblink_exec('c0454_b', 'rollback', false);
  perform dblink_exec('c0454_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- ── Operaciones del Studio ───────────────────────────────────
-- El borrado de softDeleteClientAction: UPDATE directo por RLS, sin RETURNING.
create function pg_temp.borrar(p_label text) returns text language sql as $$
  select format('update public.clients set deleted_at = now() where id = %L', pg_temp.id(p_label))
$$;
create function pg_temp.invitar(p_label text) returns text language sql as $$
  select format('select claim_token from public.portal_invite_client(%L)', pg_temp.id(p_label))
$$;
create function pg_temp.codigo(p_label text) returns text language sql as $$
  select format($q$select link_id::text from public.portal_create_access_link(%L, %L, 72)$q$,
    pg_temp.id(p_label), 'CARRERA' || upper(p_label))
$$;
-- El UPDATE de client_id con que una fusión muda el acceso a otra ficha.
create function pg_temp.mudar(p_desde text, p_hacia text) returns text language sql as $$
  select format('update public.client_users set client_id = %L where id = %L',
    pg_temp.id(p_hacia), pg_temp.id('vinculo-' || p_desde))
$$;

-- Accesos vigentes sobre un cliente borrado: vínculos invited/active (o con
-- identidad o token) y códigos sin revocar. Es lo que la 0454 promete que no
-- existe.
create function pg_temp.vigentes(p_label text) returns integer language sql as $$
  select pg_temp.ver(format($q$select ((select count(*) from public.client_users cu
      join public.clients c on c.id = cu.client_id
      where c.id = %1$L and c.deleted_at is not null
        and (cu.status <> 'revoked' or cu.revoked_at is null or cu.auth_user_id is not null or cu.token is not null))
    + (select count(*) from public.portal_access_links l join public.clients c on c.id = l.client_id
      where c.id = %1$L and c.deleted_at is not null and l.revoked_at is null))::text$q$, pg_temp.id(p_label)))::integer
$$;

create function pg_temp.borrado(p_label text) returns boolean language sql as $$
  select pg_temp.ver(format('select (deleted_at is not null)::text from public.clients where id = %L',
    pg_temp.id(p_label)))::boolean
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_c text := 'e' || p_n || left(p_fase, 1);
  v_d text := 'e' || p_n || left(p_fase, 1) || 'd';
  v_r jsonb;
begin
  perform pg_temp.cliente(v_c);
  case p_n
  when 1 then
    v_r := pg_temp.carrera('studio', pg_temp.borrar(v_c), 'studio', pg_temp.invitar(v_c));
  when 2 then
    v_r := pg_temp.carrera('studio', pg_temp.invitar(v_c), 'studio', pg_temp.borrar(v_c));
  when 3 then
    v_r := pg_temp.carrera('studio', pg_temp.borrar(v_c), 'studio', pg_temp.codigo(v_c));
  when 4 then
    perform pg_temp.cliente(v_d);
    perform pg_temp.vinculo(v_d, 'active');
    v_r := pg_temp.carrera('studio', pg_temp.borrar(v_c), null, pg_temp.mudar(v_d, v_c));
  when 5 then
    perform pg_temp.vinculo(v_c, 'revoked');
    v_r := pg_temp.carrera('studio', pg_temp.borrar(v_c), 'studio', pg_temp.invitar(v_c));
  when 6 then
    perform pg_temp.vinculo(v_c, 'revoked');
    v_r := pg_temp.carrera('studio', pg_temp.invitar(v_c), 'studio', pg_temp.borrar(v_c));
  end case;
  return v_r || jsonb_build_object('borrado', pg_temp.borrado(v_c), 'vigentes', pg_temp.vigentes(v_c));
end;
$$;

-- CONTROL: sin el mecanismo, queda un acceso vigente sobre el cliente borrado.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'borrado')::boolean and (p_r ->> 'vigentes')::int >= 1
$$;

-- REAL: `b` esperó a `a`, el cliente quedó borrado y no queda ningún acceso
-- vigente: en 1, 3, 4 y 5 la escritura de acceso se rechaza; en 2 y 6 el borrado
-- la revoca.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean and p_r ->> 'lock' = 'transactionid'
    and (p_r ->> 'borrado')::boolean and (p_r ->> 'vigentes')::int = 0
    and case when p_n in (1, 3, 4, 5)
          then coalesce(p_r ->> 'error_b' like '%cliente inexistente o borrado%', false)
          else p_r ->> 'error_b' is null end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'se borra el cliente y llega una invitación nueva',
    'llega una invitación nueva y se borra el cliente',
    'se borra el cliente y llega un código corto nuevo',
    'se borra el cliente y otro vínculo se muda a él',
    'se borra el cliente y llega una reinvitación',
    'llega una reinvitación y se borra el cliente'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_guarda text;
  v_revocacion text;
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0454 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0454 template template0');
  perform dblink_connect('c0454_s', pg_temp.conn('dtd_carrera_0454', 's'));
  perform dblink_connect('c0454_a', pg_temp.conn('dtd_carrera_0454', 'a'));
  perform dblink_connect('c0454_b', pg_temp.conn('dtd_carrera_0454', 'b'));
  perform dblink_exec('c0454_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0454_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0454_b', $t$set statement_timeout = '30s'$t$);

  v_guarda := pg_temp.ver($q$select pg_get_functiondef('public.portal_access_require_live_client()'::regprocedure)$q$);
  v_revocacion := pg_temp.ver($q$select pg_get_functiondef('public.clients_revoke_portal_access()'::regprocedure)$q$);

  for v_n in 1..6 loop
    foreach v_fase in array array['control', 'real'] loop
      if v_fase = 'control' and v_n <= 4 then
        -- La guarda sin su FOR SHARE: la fila nueva o mudada no espera al borrado.
        perform pg_temp.variante('public.portal_access_require_live_client()', jsonb_build_array(jsonb_build_array(
          E'     where c.id = new.client_id and c.deleted_at is null\n       for share of c;',
          '     where c.id = new.client_id and c.deleted_at is null;')));
      elsif v_fase = 'control' then
        -- La revocación que se salta las filas ya revocadas.
        perform pg_temp.variante('public.clients_revoke_portal_access()', jsonb_build_array(jsonb_build_array(
          E'   where cu.client_id = new.id;', E'   where cu.client_id = new.id and cu.status <> ''revoked'';')));
      end if;
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      if v_fase = 'control' then
        perform dblink_exec('c0454_s', case when v_n <= 4 then v_guarda else v_revocacion end);
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
    pg_temp.ver($q$select md5(pg_get_functiondef('public.portal_access_require_live_client()'::regprocedure))
      || md5(pg_get_functiondef('public.clients_revoke_portal_access()'::regprocedure))$q$)
      = md5(v_guarda) || md5(v_revocacion),
    'la guarda y la revocación tienen que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no dejaron el acceso vigente: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0454 carrera OK: % aserciones; ningún acceso al Portal queda vigente sobre un cliente borrado, aunque compita con el borrado',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0454 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0454')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0454 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
