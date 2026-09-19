\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0466 (SDD-0487), con la 0462: el
-- documento (RIF o cédula) de un cliente no queda repetido entre `clients` y
-- `client_billing_identities` cuando entra a la vez por dos puertas. Base propia
-- y desechable dentro del contenedor del runner: nunca consulta ni modifica una
-- base alojada.
--
-- POR QUÉ: la spec 0487 afirma que «los dos lados toman el mismo lock
-- consultivo por (tenant, documento normalizado)»: la RPC del Portal
-- portal_upsert_my_billing_identity y el trigger de clients
-- clients_doc_not_billing_identity_elsewhere. Los índices únicos no cruzan las
-- dos tablas, así que ese lock es lo único que impide el duplicado cuando las dos
-- escrituras compiten. El contrato 0466 corre en una sola sesión y no puede
-- probarlo.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0449, 0459,
-- 0460, 0464 y 0467). El archivo corre en la base `postgres` del runner y, con
-- dblink, abre tres sesiones contra una base propia (dtd_carrera_0466): `s`
-- prepara y observa, `a` escribe primero y deja la transacción abierta, y `b`
-- llega después, en asíncrono. Cada escenario exige ver pg_blocking_pids(b) con
-- `a` adentro, y el tipo de lock en que espera, antes de que `a` confirme.
--
-- CONTROL en la misma corrida: cada escenario corre primero con una variante sin
-- el lock que defiende (sacada con pg_get_functiondef de la versión aplicada; el
-- trigger se reemplaza y se restituye) y después con la 0466. Si un control no da
-- lo que tiene que dar, el archivo falla.
--
-- Los escenarios, con el mecanismo que prueba cada uno:
--   Entre clientes: el lock consultivo de los dos lados.
--   1. La empresa del Portal (A) y el RIF de otra ficha en el Studio (B), a la
--      vez. Real: el UPDATE de B espera en el lock consultivo y el trigger lo
--      rechaza con client_doc_taken_by_billing_identity. Control, trigger sin el
--      lock: el documento queda repetido entre las dos tablas.
--   2. El RIF de una ficha en el Studio (B) y la empresa del Portal (A), a la
--      vez. Real: la RPC espera en el lock y devuelve `blocked`, con B como ficha
--      en conflicto. Control, RPC sin el lock: queda repetido.
--   3. Dos clientes agregan la misma empresa desde el Portal. Real: el segundo
--      espera en el lock y queda `blocked` con el primero como ficha en
--      conflicto. Control, RPC sin el lock: el índice de las identidades lo
--      bloquea igual, pero el intento queda sin la ficha en conflicto.
--   4. La empresa del Portal (A) y el RIF de otra ficha desde su perfil (B, la
--      0462), a la vez. Real: `blocked`, y el cupo de B queda intacto. Control,
--      trigger sin el lock: queda repetido.
--   5. Dos fichas toman el mismo RIF desde su perfil. Real: la segunda espera en
--      el lock del trigger y queda `blocked`. Control, trigger sin el lock: el
--      índice de clients (0095) la bloquea igual. Esa unicidad no depende de un
--      lock.
--   El mismo cliente a la vez: los FOR UPDATE de la 0466 y la 0462.
--   6. Quita su empresa y elige facturar a la empresa. Real: la elección espera
--      la fila y devuelve `missing_identity`. Control, sin el FOR UPDATE de
--      portal_set_my_billing_kind: devuelve `applied` y audita un cambio que no
--      hizo.
--   7. Guarda su empresa dos veces a la vez. Real: la segunda espera su ficha y
--      devuelve `no_changes`. Control, sin el FOR UPDATE de la ficha en
--      portal_upsert_my_billing_identity: `applied` y dos eventos de auditoría.
--   8. Cambia su RIF dos veces a la vez desde su perfil. Real: la segunda
--      espera su ficha y devuelve `no_changes`, con 2 cambios de 3 disponibles.
--      Control, sin el FOR UPDATE de portal_update_my_profile: `applied` y el
--      mismo cambio consume dos del cupo.
--   9. Quita su empresa y la vuelve a guardar igual. Real: el guardado espera la
--      fila de la empresa y la vuelve a crear (`applied`). Control, sin el FOR
--      UPDATE de la empresa en portal_upsert_my_billing_identity: devuelve
--      `no_changes` y la empresa queda borrada.
--
-- FIXTURE: el del contrato 0466, leído de los archivos con pg_read_file: la
-- región del contrato 0421 que ese contrato incluye en modo
-- fixture_in_transaction y, después, la suya (0464, 0392, columnas de clients,
-- 0445, 0462 y 0466). Si un contrato cambia de forma, este archivo falla en vez
-- de probar sobre otro fixture. Encima, por escenario, clientes propios del
-- tenant A con su principal del Portal.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0466 y la 0462 fuera del repo, ver
-- .agents/handoffs/0487-carrera-documento-0466.md): cada lock, quitado de a uno,
-- hace fallar sus escenarios. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0466 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0466 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0466_%s',
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
    if v_conn like 'c0466\_%' then
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
      'drop database if exists dtd_carrera_0466 with (force)');
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
    raise exception 'TEST 0466 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0466 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0466 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0466 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0466 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Los ids del fixture 0421 (tenant-A) y los propios de esta carrera.
create function pg_temp.id0421(p_label text) returns uuid language sql immutable as $$
  select md5('0421-synthetic-' || p_label)::uuid
$$;
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0466-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato 0466 en UNA transacción explícita: la región del
-- contrato 0421 (lo que 0466 incluye con fixture_in_transaction) y la suya.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0421_payment_report_commands.test.sql',
      E'\nbegin;\n\\endif\n', E'\n-- Sólo para un segundo PostgreSQL desechable', '{"apply_fix": true}'),
    pg_temp.expandir('0466_client_billing_identity.test.sql',
      E'\\set fixture_in_transaction false\n', E'\ncreate temporary sequence billing_assertions',
      '{"apply_billing": true}'),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0466_s', p_sql) as t(r text)
$$;

-- Un cliente del tenant A con su principal activo del Portal.
create function pg_temp.cliente(p_label text, p_tipo text, p_rif text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0466_s', format($q$insert into auth.users (id, email) values (%1$L, %2$L);
    insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind)
      values (%3$L, %4$L, %5$L, %6$L, %7$L, %8$L);
    insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
      values (%1$L, %4$L, %3$L, %2$L, 'active')$q$,
    pg_temp.id('principal-' || p_label), p_label || '@carrera.invalid', pg_temp.id('cliente-' || p_label),
    pg_temp.id0421('tenant-A'), 'M-' || upper(p_label), 'Cliente ' || p_label, p_rif, p_tipo));
end;
$$;

-- Una empresa ya guardada, como la deja el Portal.
create function pg_temp.empresa(p_label text, p_doc text, p_preferida boolean) returns void language plpgsql as $$
begin
  perform dblink_exec('c0466_s', format($q$insert into public.client_billing_identities
      (tenant_id, client_id, kind, legal_name, doc, fiscal_address, is_billing_default)
    values (%L, %L, 'empresa', %L, %L, null, %L)$q$,
    pg_temp.id0421('tenant-A'), pg_temp.id('cliente-' || p_label), 'Importadora Carrera C.A.', p_doc, p_preferida));
end;
$$;

-- Una variante de una función aplicada, sacada de pg_get_functiondef: otro
-- nombre (o el mismo, para el trigger) y los reemplazos de p_cambios. Un
-- reemplazo que no encuentra su texto no cambia nada: en una corrida normal eso
-- deja un control sin defecto que mostrar, y el archivo falla ahí.
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
  perform dblink_exec('c0466_s', v_def);
end;
$$;

-- Abre la transacción de una sesión: con principal, como ese usuario del Portal.
create function pg_temp.abrir(p_conn text, p_principal text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  if p_principal is not null then
    perform dblink_exec(p_conn, 'set local role authenticated');
    perform * from dblink(p_conn, format($q$select set_config('request.jwt.claim.sub', %L, true)$q$,
      pg_temp.id('principal-' || p_principal))) as t(x text);
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
  select pid into v_a from dblink('c0466_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0466_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0466_a', p_a);
  select r into v_ra from dblink('c0466_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0466_b', p_b);
  perform pg_temp.afirmar(dblink_send_query('c0466_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0466_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0466 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0466_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0466_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0466_b');
  end if;
  perform * from dblink_get_result('c0466_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0466_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0466_b') = 1 then
    perform dblink_cancel_query('c0466_b');
  end if;
  perform * from dblink_get_result('c0466_b', false) as t(r text);
  perform * from dblink_get_result('c0466_b', false) as t(r text);
  perform dblink_exec('c0466_b', 'rollback', false);
  perform dblink_exec('c0466_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- ── Operaciones ──────────────────────────────────────────────
create function pg_temp.upsert(p_funcion text, p_doc text) returns text language sql as $$
  select format($q$select outcome from %s(%L, %L, null, true)$q$, p_funcion, 'Importadora Carrera C.A.', p_doc)
$$;
create function pg_temp.perfil(p_funcion text, p_doc text) returns text language sql as $$
  select format($q$select outcome || ':' || remaining_count from %s(null, %L, null)$q$, p_funcion, p_doc)
$$;
create function pg_temp.studio(p_label text, p_doc text) returns text language sql as $$
  select format($q$with u as (update public.clients set rif = %L where id = %L returning 1)
    select count(*)::text from u$q$, p_doc, pg_temp.id('cliente-' || p_label))
$$;

-- Lo que quedó de un cliente, visto desde `s`.
create function pg_temp.estado(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'rif', c.rif,
      'empresa', (select i.doc from public.client_billing_identities i where i.client_id = c.id),
      'intento', (select a.field || ':' || coalesce(a.conflicting_client_id::text, 'null')
                  from public.client_profile_blocked_attempts a where a.client_id = c.id
                  order by a.created_at desc limit 1),
      'guardados', (select count(*) from public.entity_audit_log e
                    where e.entity_id = c.id and e.event_type = 'client_billing_identity_saved'),
      'cambios_de_tipo', (select count(*) from public.entity_audit_log e
                          where e.entity_id = c.id and e.event_type = 'client_billing_kind_changed'),
      'cupo', public.portal_profile_edit_remaining(c.id))::text
    from public.clients c where c.id = %L$q$, pg_temp.id('cliente-' || p_label)))::jsonb
$$;

-- El documento está en las dos tablas a la vez, en clientes vivos distintos.
create function pg_temp.repetido(p_doc text) returns boolean language sql as $$
  select pg_temp.ver(format($q$select (exists (select 1 from public.clients c
      join public.client_billing_identities i on i.tenant_id = c.tenant_id and i.client_id <> c.id
      join public.clients o on o.id = i.client_id and o.deleted_at is null
      where c.deleted_at is null and public.billing_doc_norm(c.rif) = public.billing_doc_norm(%1$L)
        and public.billing_doc_norm(i.doc) = public.billing_doc_norm(%1$L)))::text$q$, p_doc))::boolean
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_p text := 'e' || p_n || left(p_fase, 1);
  v_a text := v_p || 'a';
  v_b text := v_p || 'b';
  v_x text := 'J-4' || lpad((p_n * 10 + case when p_fase = 'real' then 1 else 2 end)::text, 7, '0') || '-1';
  -- Los documentos principales de cada fase, distintos: el índice de clients no los deja repetir.
  v_off integer := case when p_fase = 'real' then 10 else 20 end;
  v_upsert text := case when p_fase = 'real' then 'public.portal_upsert_my_billing_identity'
    else 'public.upsert_control_' || p_n end;
  v_perfil text := case when p_fase = 'real' then 'public.portal_update_my_profile'
    else 'public.perfil_control_' || p_n end;
  v_elegir text := case when p_fase = 'real' then 'public.portal_set_my_billing_kind'
    else 'public.elegir_control_' || p_n end;
  v_r jsonb;
begin
  case p_n
  when 1 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.cliente(v_b, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 2)::text, 7, '0') || '-1');
    v_r := pg_temp.carrera(v_a, pg_temp.upsert('public.portal_upsert_my_billing_identity', v_x),
      null, pg_temp.studio(v_b, v_x));
  when 2 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.cliente(v_b, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 2)::text, 7, '0') || '-1');
    v_r := pg_temp.carrera(null, pg_temp.studio(v_b, v_x), v_a, pg_temp.upsert(v_upsert, v_x));
  when 3 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.cliente(v_b, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 2)::text, 7, '0'));
    v_r := pg_temp.carrera(v_a, pg_temp.upsert('public.portal_upsert_my_billing_identity', v_x),
      v_b, pg_temp.upsert(v_upsert, v_x));
  when 4 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.cliente(v_b, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 2)::text, 7, '0') || '-1');
    v_r := pg_temp.carrera(v_a, pg_temp.upsert('public.portal_upsert_my_billing_identity', v_x),
      v_b, pg_temp.perfil('public.portal_update_my_profile', v_x));
  when 5 then
    perform pg_temp.cliente(v_a, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 1)::text, 7, '0') || '-1');
    perform pg_temp.cliente(v_b, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 2)::text, 7, '0') || '-1');
    v_r := pg_temp.carrera(v_a, pg_temp.perfil('public.portal_update_my_profile', v_x),
      v_b, pg_temp.perfil('public.portal_update_my_profile', v_x));
  when 6 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.empresa(v_a, v_x, false);
    v_r := pg_temp.carrera(v_a, 'select outcome from public.portal_delete_my_billing_identity()',
      v_a, format($q$select outcome from %s('empresa')$q$, v_elegir));
  when 7 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    v_r := pg_temp.carrera(v_a, pg_temp.upsert('public.portal_upsert_my_billing_identity', v_x),
      v_a, pg_temp.upsert(v_upsert, v_x));
  when 8 then
    perform pg_temp.cliente(v_a, 'empresa', 'J-5' || lpad((p_n * 100 + v_off + 1)::text, 7, '0') || '-1');
    v_r := pg_temp.carrera(v_a, pg_temp.perfil('public.portal_update_my_profile', v_x),
      v_a, pg_temp.perfil(v_perfil, v_x));
  when 9 then
    perform pg_temp.cliente(v_a, 'persona', 'V-1' || lpad((p_n * 100 + v_off + 1)::text, 7, '0'));
    perform pg_temp.empresa(v_a, v_x, true);
    v_r := pg_temp.carrera(v_a, 'select outcome from public.portal_delete_my_billing_identity()',
      v_a, pg_temp.upsert(v_upsert, v_x));
  end case;
  return v_r || jsonb_build_object('doc', v_x, 'a_estado', pg_temp.estado(v_a),
    'b_estado', case when p_n in (6, 7, 8, 9) then null else pg_temp.estado(v_b) end,
    'repetido', pg_temp.repetido(v_x));
end;
$$;

-- CONTROL: sin el lock, lo que tiene que mostrar cada escenario.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case
    when p_n = 1 then p_r ->> 'error_b' is null and (p_r ->> 'repetido')::boolean
    when p_n = 2 then p_r ->> 'b' = 'applied' and (p_r ->> 'repetido')::boolean
    when p_n = 3 then p_r ->> 'b' = 'blocked' and p_r -> 'b_estado' ->> 'intento' = 'company_rif:null'
      and not (p_r ->> 'repetido')::boolean
    when p_n = 4 then p_r ->> 'b' like 'applied:%' and (p_r ->> 'repetido')::boolean
    when p_n = 5 then p_r ->> 'b' like 'blocked:%' and p_r -> 'b_estado' ->> 'rif' <> p_r ->> 'doc'
    when p_n = 6 then p_r ->> 'b' = 'applied' and (p_r -> 'a_estado' ->> 'cambios_de_tipo')::int = 1
      and p_r -> 'a_estado' ->> 'empresa' is null
    when p_n = 7 then p_r ->> 'b' = 'applied' and (p_r -> 'a_estado' ->> 'guardados')::int = 2
    when p_n = 8 then p_r ->> 'b' = 'applied:1'
    when p_n = 9 then p_r ->> 'b' = 'no_changes' and p_r -> 'a_estado' ->> 'empresa' is null
  end
$$;

-- REAL: `b` esperó a `a` en el lock que corresponde y el resultado es el correcto.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean
    and p_r ->> 'lock' = case when p_n <= 5 then 'advisory' else 'transactionid' end
    and not (p_r ->> 'repetido')::boolean
    and case
      when p_n = 1 then coalesce(p_r ->> 'error_b' like '%client_doc_taken_by_billing_identity%', false)
        and p_r -> 'b_estado' ->> 'rif' <> p_r ->> 'doc' and p_r -> 'a_estado' ->> 'empresa' = p_r ->> 'doc'
      when p_n = 2 then p_r ->> 'b' = 'blocked' and p_r -> 'a_estado' ->> 'empresa' is null
        and p_r -> 'a_estado' ->> 'intento' = 'company_rif:' || md5('0466-carrera-cliente-e2rb')::uuid
      when p_n = 3 then p_r ->> 'b' = 'blocked' and p_r -> 'b_estado' ->> 'empresa' is null
        and p_r -> 'b_estado' ->> 'intento' = 'company_rif:' || md5('0466-carrera-cliente-e3ra')::uuid
      when p_n = 4 then p_r ->> 'b' = 'blocked:3' and p_r -> 'b_estado' ->> 'rif' <> p_r ->> 'doc'
      when p_n = 5 then p_r ->> 'b' like 'blocked:%' and p_r -> 'b_estado' ->> 'rif' <> p_r ->> 'doc'
      when p_n = 6 then p_r ->> 'b' = 'missing_identity' and (p_r -> 'a_estado' ->> 'cambios_de_tipo')::int = 0
      when p_n = 7 then p_r ->> 'b' = 'no_changes' and (p_r -> 'a_estado' ->> 'guardados')::int = 1
      when p_n = 8 then p_r ->> 'b' = 'no_changes:2'
      when p_n = 9 then p_r ->> 'b' = 'applied' and p_r -> 'a_estado' ->> 'empresa' = p_r ->> 'doc'
    end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'la empresa del Portal y el RIF de otra ficha en el Studio, a la vez',
    'el RIF de una ficha en el Studio y la empresa del Portal, a la vez',
    'dos clientes agregan la misma empresa desde el Portal',
    'la empresa del Portal y el RIF de otra ficha desde su perfil, a la vez',
    'dos fichas toman el mismo RIF desde su perfil',
    'el cliente quita su empresa y elige facturar a la empresa, a la vez',
    'el cliente guarda su empresa dos veces a la vez',
    'el cliente cambia su RIF dos veces a la vez desde su perfil',
    'el cliente quita su empresa y la vuelve a guardar igual, a la vez'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_trigger text;
  v_fallan jsonb := '{"control": [], "real": []}';
  v_detalle text[] := '{}';
  v_restos text;
  v_sin_lock_trigger jsonb := jsonb_build_array(jsonb_build_array(
    E'  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(''billing-doc:'' || new.tenant_id::text || '':'' || v_norm, 0)\n  );\n', ''));
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0466 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0466 template template0');
  perform dblink_connect('c0466_s', pg_temp.conn('dtd_carrera_0466', 's'));
  perform dblink_connect('c0466_a', pg_temp.conn('dtd_carrera_0466', 'a'));
  perform dblink_connect('c0466_b', pg_temp.conn('dtd_carrera_0466', 'b'));
  perform dblink_exec('c0466_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0466_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0466_b', $t$set statement_timeout = '30s'$t$);

  -- Las variantes de los controles, sacadas de las funciones aplicadas.
  foreach v_n in array array[2, 3] loop
    perform pg_temp.variante('public.portal_upsert_my_billing_identity(text,text,text,boolean)',
      'public.upsert_control_' || v_n, jsonb_build_array(jsonb_build_array(
        E'    perform pg_catalog.pg_advisory_xact_lock(\n      pg_catalog.hashtextextended(''billing-doc:'' || v_tenant_id::text || '':'' || v_norm, 0)\n    );\n', '')));
  end loop;
  perform pg_temp.variante('public.portal_set_my_billing_kind(text)', 'public.elegir_control_6',
    jsonb_build_array(jsonb_build_array(E'  where identity.client_id = v_client_id\n  for update;', '  where identity.client_id = v_client_id;')));
  perform pg_temp.variante('public.portal_upsert_my_billing_identity(text,text,text,boolean)', 'public.upsert_control_7',
    jsonb_build_array(jsonb_build_array(E'  where client.id = v_client_id and client.deleted_at is null\n  for update;',
      '  where client.id = v_client_id and client.deleted_at is null;')));
  perform pg_temp.variante('public.portal_upsert_my_billing_identity(text,text,text,boolean)', 'public.upsert_control_9',
    jsonb_build_array(jsonb_build_array(E'  where identity.client_id = v_client_id
  for update;',
      '  where identity.client_id = v_client_id;')));
  perform pg_temp.variante('public.portal_update_my_profile(text,text,text)', 'public.perfil_control_8',
    jsonb_build_array(jsonb_build_array(E'  where client.id = v_client_id and client.deleted_at is null\n  for update;',
      '  where client.id = v_client_id and client.deleted_at is null;')));
  perform dblink_exec('c0466_s', 'grant execute on function
    public.upsert_control_2(text,text,text,boolean), public.upsert_control_3(text,text,text,boolean),
    public.upsert_control_7(text,text,text,boolean), public.upsert_control_9(text,text,text,boolean),
    public.elegir_control_6(text),
    public.perfil_control_8(text,text,text) to authenticated');
  v_trigger := pg_temp.ver($q$select pg_get_functiondef('public.clients_doc_not_billing_identity_elsewhere()'::regprocedure)$q$);

  for v_n in 1..9 loop
    foreach v_fase in array array['control', 'real'] loop
      -- Los controles 1, 4 y 5 cambian el trigger por su variante y lo restituyen.
      if v_fase = 'control' and v_n in (1, 4, 5) then
        perform pg_temp.variante('public.clients_doc_not_billing_identity_elsewhere()',
          'public.clients_doc_not_billing_identity_elsewhere', v_sin_lock_trigger);
      end if;
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      if v_fase = 'control' and v_n in (1, 4, 5) then
        perform dblink_exec('c0466_s', v_trigger);
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

  perform pg_temp.afirmar(pg_temp.ver($q$select md5(pg_get_functiondef('public.clients_doc_not_billing_identity_elsewhere()'::regprocedure))$q$)
      = md5(v_trigger), 'el trigger de clients tiene que volver a su versión aplicada');
  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'control') = 0 and jsonb_array_length(v_fallan -> 'real') = 0,
    format('controles que no dieron lo esperado: %s; escenarios reales que fallan: %s. %s',
      v_fallan -> 'control', v_fallan -> 'real', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0466 carrera OK: % aserciones; el mismo documento no se repite entre clients y las identidades de facturación, y el mismo cliente se serializa consigo mismo',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0466 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0466')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0466 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
