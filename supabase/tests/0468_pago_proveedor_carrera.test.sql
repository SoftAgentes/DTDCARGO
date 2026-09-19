\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0468 (SDD-0489): pagar y anular órdenes
-- de pago, y anular la CxP, sobre la misma CxP y a la vez, no pierden ninguna
-- suma ni reviven una CxP anulada. Base propia y desechable dentro del
-- contenedor del runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: la 0468 toma la orden y la CxP FOR UPDATE antes de leer el saldo, y
-- un lock consultivo del tenant antes de sacar el código OP-. El contrato
-- 0468_pago_proveedor_atomico.test.sql corre en una sola sesión y sólo cuenta
-- los FOR UPDATE: acá están las dos sesiones reales.
--
-- CÓMO: igual que 0467_cobro_factura_carrera.test.sql. El archivo corre en la
-- base `postgres` del runner y, con dblink, abre tres sesiones contra una base
-- propia (dtd_carrera_0468): `s` prepara y observa; `a` (S1) corre la primera
-- operación hasta su pausa, y `b` (S2) corre la segunda entera, en asíncrono.
-- S2 termina o queda esperando a S1, según pg_blocking_pids: no hay sleep que
-- calibrar. Recién entonces S1 sigue.
--
-- Los 9 escenarios, dos veces en la misma corrida:
--   ANTES (sin la 0468): S1 y S2 repiten, petición por petición, lo que hacía
--   lib/studio/treasury/treasury-actions.ts por PostgREST, con sus chequeos de
--   estado y de saldo (la tolerancia de 0,01 incluida). Cada petición es su
--   propia transacción, y lo leído viaja entre ellas como en la app. La pausa
--   de S1 cae entre su lectura y su escritura. Cada escenario tiene que
--   reproducir el daño (el 6, que S1 muera por el código OP- repetido): si un
--   control no reproduce, el archivo falla y el verde nunca sale vacío.
--   DESPUÉS (con la 0468 aplicada encima, entera): las mismas carreras con las
--   RPC. S2 tiene que esperar a S1 y sale el rechazo esperado. En cada CxP
--   paid_amount = órdenes vigentes, sin pasar el total, con el status que le
--   corresponde, y una CxP que se anuló sigue anulada y sin órdenes vigentes.
-- La anulación de la CxP (voidBillFor sobre el wrapper de la 0294) y el
-- registro del asiento del pago (el update de journal_entry_id que la app hace
-- después de la RPC) son iguales en las dos fases: la 0468 no los cambia.
--
-- FIXTURE: el del contrato 0468, leído de su archivo con pg_read_file: roles,
-- auth, tenants, membresías, get_user_tenant_id con el cuerpo de la 0453 (el
-- que exige el preflight de la 0468) y las migraciones que incluye con `\ir`,
-- en orden de número: 0088 real, no cascarones. Encima, una semilla: un tenant,
-- un usuario de contabilidad con una sola membresía, una cuenta de caja, una de
-- gasto y un proveedor.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0468 fuera del repo, ver
-- .agents/handoffs/0489-carrera-pago-proveedor.md): cada uno de los tres FOR
-- UPDATE y el lock consultivo, quitados de a uno, hacen fallar escenarios de la
-- fase DESPUÉS. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0468 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0468 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0468_%s',
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
    if v_conn like 'c0468\_%' then
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
      'drop database if exists dtd_carrera_0468 with (force)');
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
    raise exception 'TEST 0468 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0468 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0468 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0468 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0468 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Las migraciones que un contrato incluye con `\ir` antes de sembrar su fixture.
create function pg_temp.migraciones(p_contrato text) returns text[] language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/tests/' || p_contrato);
  v_fin integer := position(E'\ncreate function pg_temp.fixture_id' in v_txt);
  v_lista text[];
begin
  if v_fin = 0 then
    raise exception 'TEST 0468 carrera: no encuentro dónde siembra su fixture %', p_contrato;
  end if;
  select array_agg(m[1] order by m[1]) into v_lista
  from regexp_matches(substr(v_txt, 1, v_fin), '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)\s*$', 'gn') m;
  if coalesce(cardinality(v_lista), 0) = 0 then
    raise exception 'TEST 0468 carrera: % no incluye migraciones antes de su fixture', p_contrato;
  end if;
  return v_lista;
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0489-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato 0468 y la semilla, en UNA transacción explícita: si
-- algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $fx$
declare
  v_m text;
  v_partes text[] := array['begin;'];
begin
  -- Plataforma, del contrato 0468 tal cual.
  v_partes := v_partes || pg_temp.expandir('0468_pago_proveedor_atomico.test.sql',
    E'\n\\endif\nbegin;\n', E'\n\\ir ../migrations/0077_invoices.sql', '{}');
  foreach v_m in array pg_temp.migraciones('0468_pago_proveedor_atomico.test.sql') loop
    v_partes := v_partes || pg_read_file('/sb/migrations/' || v_m);
  end loop;
  v_partes := v_partes || format($seed$
insert into auth.users (id, email) values (%1$L, 'contabilidad-0489@carrera.invalid');
insert into public.tenants (id, slug, display_name)
  values (%2$L, 'carrera-0489', 'Tenant sintético de la carrera 0489');
insert into public.user_tenants (user_id, tenant_id, role) values (%1$L, %2$L, 'accounting');
insert into public.accounts (id, tenant_id, code, name, type, is_postable) values
  (%3$L, %2$L, '1.1.1.1', 'Banco sintético 0489', 'A', true),
  (%4$L, %2$L, '5.1.1.1', 'Flete sintético 0489', 'CGS', true);
insert into public.suppliers (id, tenant_id, supplier_code, name)
  values (%5$L, %2$L, 'PRV-0001', 'Proveedor sintético 0489');
$seed$, pg_temp.id('user'), pg_temp.id('tenant'), pg_temp.id('cash'), pg_temp.id('expense'),
    pg_temp.id('supplier'));
  return array_to_string(v_partes || 'commit;'::text, E'\n');
end;
$fx$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0468_s', p_sql) as t(r text)
$$;

-- ── Semillas por escenario (en `s`, que salta la RLS) ────────
create function pg_temp.cxp(p_id uuid, p_codigo text, p_total numeric default 1000,
  p_pagado numeric default 0, p_estado text default 'pendiente') returns void language plpgsql as $$
begin
  perform dblink_exec('c0468_s', format($q$insert into public.supplier_bills (id, tenant_id, bill_code,
      supplier_id, supplier_name, expense_account_id, currency, total_amount, paid_amount, status, due_date)
    values (%L, %L, %L, %L, 'Proveedor sintético 0489', %L, 'USD', %s, %s, %L, current_date + 30)$q$,
    p_id, pg_temp.id('tenant'), p_codigo, pg_temp.id('supplier'), pg_temp.id('expense'),
    p_total, p_pagado, p_estado));
end;
$$;

create function pg_temp.orden(p_id uuid, p_codigo text, p_cxp uuid, p_monto numeric) returns void
language plpgsql as $$
begin
  perform dblink_exec('c0468_s', format($q$insert into public.supplier_payments (id, tenant_id, payment_code,
      bill_id, supplier_id, supplier_name, amount, currency, method, cash_account_id, paid_at)
    values (%L, %L, %L, %L, %L, 'Proveedor sintético 0489', %s, 'USD', 'transferencia', %L, current_date - 3)$q$,
    p_id, pg_temp.id('tenant'), p_codigo, p_cxp, pg_temp.id('supplier'), p_monto, pg_temp.id('cash')));
end;
$$;

create function pg_temp.asiento_sembrado(p_id uuid, p_codigo text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0468_s', format($q$insert into public.journal_entries (id, tenant_id, entry_code, source)
    values (%L, %L, %L, 'supplier_payment')$q$, p_id, pg_temp.id('tenant'), p_codigo));
end;
$$;

-- ── Operaciones ──────────────────────────────────────────────
-- Una operación es {tipo, antes, despues, completa}. `antes` corre S1 hasta su
-- pausa y `despues` la termina; `completa` es lo que corre S2 de una vez.

-- La app vieja: cada petición en su propia transacción, como PostgREST. Lo
-- leído viaja entre peticiones en variables de la sesión (carrera.<k>_*).
create function pg_temp.bloque(p_peticiones text[]) returns text language sql as $$
  select E'do $p$\nbegin\n' || array_to_string(p_peticiones, E'\ncommit;\n') || E'\ncommit;\nend\n$p$'
$$;

create function pg_temp.vieja(p_antes text[], p_despues text[]) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'vieja', 'antes', pg_temp.bloque(p_antes),
    'despues', pg_temp.bloque(p_despues), 'completa', pg_temp.bloque(p_antes || p_despues))
$$;

-- Una sentencia de una sola petición: S1 la deja con la transacción abierta y
-- sus locks tomados; la pausa es antes del COMMIT. `p_completa` es lo que corre
-- S2 de una vez (por defecto, la llamada en un DO).
create function pg_temp.atomica(p_llamada text, p_completa text default null) returns jsonb
language sql as $$
  select jsonb_build_object('tipo', 'atomica', 'antes', 'select (' || p_llamada || ')::text',
    'despues', 'commit',
    'completa', coalesce(p_completa, E'do $p$\nbegin\nperform ' || p_llamada || E';\nend\n$p$'))
$$;

-- treasury-actions.ts antes de la SDD-0489: lee la CxP (y su moneda), la
-- rechaza si está anulada o pagada o si el monto pasa el saldo más 0,01, saca
-- el código, inserta la orden y escribe paid_amount ABSOLUTO (lo leído más el
-- monto) y el status.
create function pg_temp.pago_viejo(p_k text, p_cxp uuid, p_monto numeric, p_pausa_en_codigo boolean)
returns jsonb language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
  v_lectura text := format($q$perform set_config(%1$L, paid_amount::text, false),
      set_config(%2$L, total_amount::text, false), set_config(%3$L, tenant_id::text, false),
      set_config(%4$L, supplier_id::text, false), set_config(%5$L, supplier_name, false),
      set_config(%6$L, status, false), set_config(%7$L, currency::text, false),
      set_config(%8$L, coalesce(fx_rate::text, ''), false)
    from public.supplier_bills where id = %9$L;
    if current_setting(%6$L) in ('anulada', 'pagada') then
      raise exception 'la app vieja rechaza: CxP %%', current_setting(%6$L);
    end if;
    if %10$s > round(current_setting(%2$L)::numeric - current_setting(%1$L)::numeric, 2) + 0.01 then
      raise exception 'la app vieja rechaza: supera el saldo';
    end if;$q$,
    v_g || 'paid', v_g || 'total', v_g || 'tenant', v_g || 'supplier', v_g || 'name', v_g || 'status',
    v_g || 'currency', v_g || 'fx', p_cxp, p_monto);
  v_codigo text := format($q$perform set_config(%L, public.next_payment_order_code(current_setting(%L)::uuid), false);$q$,
    v_g || 'code', v_g || 'tenant');
  v_orden text := format($q$insert into public.supplier_payments (tenant_id, payment_code, bill_id, supplier_id,
      supplier_name, amount, currency, fx_rate, method, cash_account_id, reference, paid_at, notes)
    values (current_setting(%1$L)::uuid, current_setting(%2$L), %3$L, current_setting(%4$L)::uuid,
      current_setting(%5$L), %6$s, current_setting(%7$L)::public.invoice_currency,
      nullif(current_setting(%8$L), '')::numeric, 'transferencia', %9$L, null, current_date, null);$q$,
    v_g || 'tenant', v_g || 'code', p_cxp, v_g || 'supplier', v_g || 'name', p_monto, v_g || 'currency',
    v_g || 'fx', pg_temp.id('cash'));
  v_cxp text := format($q$update public.supplier_bills
    set paid_amount = round(current_setting(%1$L)::numeric + %2$s, 2),
      status = case when round(current_setting(%1$L)::numeric + %2$s, 2) >= current_setting(%3$L)::numeric - 0.000001
        then 'pagada' else 'parcial' end
    where id = %4$L;$q$, v_g || 'paid', p_monto, v_g || 'total', p_cxp);
begin
  if p_pausa_en_codigo then
    return pg_temp.vieja(array[v_lectura, v_codigo], array[v_orden, v_cxp]);
  end if;
  return pg_temp.vieja(array[v_lectura], array[v_codigo, v_orden, v_cxp]);
end;
$$;

-- Lee la orden (y el asiento que la app anulará después), la anula con el
-- wrapper de la 0294, lee el pagado de su CxP y, si no está anulada, lo baja.
create function pg_temp.anulacion_vieja(p_k text, p_orden uuid) returns jsonb language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
begin
  return pg_temp.vieja(array[
    format($q$perform set_config(%1$L, bill_id::text, false), set_config(%2$L, amount::text, false),
        set_config(%3$L, coalesce(journal_entry_id::text, ''), false),
        set_config(%4$L, (deleted_at is not null)::text, false)
      from public.supplier_payments where id = %5$L;
      if current_setting(%4$L)::boolean then
        raise exception 'Esta orden ya está anulada.';
      end if;$q$, v_g || 'bill', v_g || 'amount', v_g || 'je', v_g || 'deleted', p_orden),
    format($q$if not public.void_supplier_payment_with_audit_reason(%L, 'Anulación de la carrera 0489') then
        raise exception 'La orden de pago ya no admite anulación.';
      end if;$q$, p_orden),
    format($q$perform set_config(%L, paid_amount::text, false), set_config(%L, status, false)
      from public.supplier_bills where id = current_setting(%L)::uuid;$q$,
      v_g || 'paid', v_g || 'status', v_g || 'bill')
  ], array[
    format($q$update public.supplier_bills
      set paid_amount = greatest(0, round(current_setting(%1$L)::numeric - current_setting(%2$L)::numeric, 2)),
        status = case when greatest(0, round(current_setting(%1$L)::numeric - current_setting(%2$L)::numeric, 2)) <= 0
          then 'pendiente' else 'parcial' end
      where id = current_setting(%3$L)::uuid and current_setting(%4$L) <> 'anulada';$q$,
      v_g || 'paid', v_g || 'amount', v_g || 'bill', v_g || 'status')
  ]);
end;
$$;

-- En ANTES la app vieja; en DESPUÉS, la RPC de la 0468.
create function pg_temp.pago(p_fase text, p_k text, p_cxp uuid, p_monto numeric,
  p_pausa_en_codigo boolean default false) returns jsonb language sql as $$
  select case when p_fase = 'antes' then pg_temp.pago_viejo(p_k, p_cxp, p_monto, p_pausa_en_codigo)
    else pg_temp.atomica(format($q$public.register_supplier_payment_order(%L, %s, %L, 'transferencia',
      current_date, null, null)$q$, p_cxp, p_monto, pg_temp.id('cash'))) end
$$;

-- La anulación deja en carrera.<k>_je el asiento que la app va a anular: la
-- vieja, el que leyó en su primera petición; la RPC, el que devuelve.
create function pg_temp.anulacion(p_fase text, p_k text, p_orden uuid) returns jsonb language sql as $$
  select case when p_fase = 'antes' then pg_temp.anulacion_vieja(p_k, p_orden)
    else pg_temp.atomica(
      format($q$public.void_supplier_payment_order(%L, 'Anulación de la carrera 0489')$q$, p_orden),
      format(E'do $p$\nbegin\nperform set_config(%L, coalesce((public.void_supplier_payment_order(%L, %L)) ->> %L, %L), false);\nend\n$p$',
        'carrera.' || p_k || '_je', p_orden, 'Anulación de la carrera 0489', 'journal_entry_id', '')) end
$$;

-- voidBillFor, igual en las dos fases: lee la CxP, la rechaza si está anulada
-- o tiene pagado, y llama al wrapper de la 0294, que exige paid_amount = 0.
-- Si el wrapper no cambia nada, la app muestra un error: acá es una excepción.
create function pg_temp.anulacion_cxp(p_k text, p_cxp uuid) returns jsonb language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
  v_llamada text := format($q$public.void_supplier_bill_with_audit_reason(%L, 'Anulación de la carrera 0489')$q$,
    p_cxp);
begin
  return pg_temp.atomica(v_llamada, pg_temp.bloque(array[
    format($q$perform set_config(%1$L, paid_amount::text, false), set_config(%2$L, status, false)
      from public.supplier_bills where id = %3$L;
      if current_setting(%2$L) = 'anulada' or current_setting(%1$L)::numeric > 0 then
        raise exception 'la app vieja no anula: la CxP está anulada o tiene pagos';
      end if;$q$, v_g || 'paid', v_g || 'status', p_cxp),
    format($q$if not %s then
        raise exception 'La CxP ya no admite anulación.';
      end if;$q$, v_llamada)]));
end;
$$;

-- El asiento del pago: la app lo guarda con un update aparte, después de la RPC.
create function pg_temp.asiento(p_orden uuid, p_asiento uuid) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'atomica',
    'antes', format($q$with u as (update public.supplier_payments set journal_entry_id = %L where id = %L
      returning id) select id::text from u$q$, p_asiento, p_orden),
    'despues', 'commit', 'completa', null)
$$;

-- ── La carrera ───────────────────────────────────────────────
-- S1 corre hasta su pausa; S2 sale entera en asíncrono y termina o queda
-- esperando a S1; recién entonces S1 sigue. Devuelve si S2 esperó (y en qué
-- tipo de lock) y el error de cada una, si lo hubo.
create function pg_temp.carrera(p_1 jsonb, p_2 jsonb) returns jsonb language plpgsql as $$
declare
  v_a integer;
  v_b integer;
  v_limite timestamptz;
  v_espero boolean := false;
  v_lock text;
  v_r text;
  v_error_1 text;
  v_error_2 text;
  v_avisos text := current_setting('client_min_messages');
begin
  select pid into v_a from dblink('c0468_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0468_b', 'select pg_backend_pid()') as t(pid integer);
  -- Los errores de las sesiones son resultados esperados en varios casos: se
  -- guardan, no se reenvían como avisos.
  perform set_config('client_min_messages', 'warning', true);
  if p_1 ->> 'tipo' = 'vieja' then
    if dblink_exec('c0468_a', p_1 ->> 'antes', false) = 'ERROR' then
      v_error_1 := dblink_error_message('c0468_a');
    end if;
  else
    perform dblink_exec('c0468_a', 'begin');
    select r into v_r from dblink('c0468_a', p_1 ->> 'antes', false) as t(r text);
    if v_r is null then
      v_error_1 := dblink_error_message('c0468_a');
      perform dblink_exec('c0468_a', 'rollback');
    end if;
  end if;
  if v_error_1 is not null then
    -- S1 no llegó a su pausa: no hubo carrera.
    perform set_config('client_min_messages', v_avisos, true);
    return jsonb_build_object('espero', false, 'pausa', false, 'error_1', v_error_1);
  end if;

  perform pg_temp.afirmar(dblink_send_query('c0468_b', p_2 ->> 'completa') = 1,
    'la segunda sesión tiene que salir');
  -- S2 termina o queda esperando a S1. Si espera, no se suelta hasta que S1
  -- siga, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0468_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0468 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  if p_1 ->> 'tipo' = 'vieja' then
    if dblink_exec('c0468_a', p_1 ->> 'despues', false) = 'ERROR' then
      v_error_1 := dblink_error_message('c0468_a');
    end if;
  else
    perform dblink_exec('c0468_a', 'commit');
  end if;
  select r into v_r from dblink_get_result('c0468_b', false) as t(r text);
  if v_r is null then
    v_error_2 := dblink_error_message('c0468_b');
  end if;
  perform * from dblink_get_result('c0468_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  return jsonb_build_object('espero', v_espero, 'pausa', true, 'lock', v_lock,
    'error_1', v_error_1, 'error_2', v_error_2);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0468_b') = 1 then
    perform dblink_cancel_query('c0468_b');
  end if;
  perform * from dblink_get_result('c0468_b', false) as t(r text);
  perform * from dblink_get_result('c0468_b', false) as t(r text);
  perform dblink_exec('c0468_b', 'rollback', false);
  perform dblink_exec('c0468_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- Las CxP del escenario, vistas desde `s`, con lo que las explica. `anulada`
-- dice si alguna vez se anuló: el evento D2 bill_voided queda aunque reviva.
create function pg_temp.cxps(p_ids uuid[]) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select coalesce(jsonb_agg(jsonb_build_object(
      'codigo', b.bill_code, 'pagado', b.paid_amount, 'total', b.total_amount, 'estado', b.status,
      'ordenes', (select coalesce(sum(p.amount), 0) from public.supplier_payments p
                  where p.bill_id = b.id and p.deleted_at is null),
      'codigos', (select coalesce(jsonb_agg(p.payment_code order by p.payment_code), '[]') from public.supplier_payments p
                  where p.bill_id = b.id and p.deleted_at is null and p.payment_code not like 'OP-SEED-%%'),
      'anulada', exists (select from public.entity_audit_log a
                         where a.entity_id = b.id and a.event_type = 'bill_voided'))
    order by b.bill_code), '[]')::text from public.supplier_bills b where b.id = any (%L::uuid[])$q$, p_ids))::jsonb
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'pago → pago, misma CxP',
    'pago → pago, entre los dos superan el saldo',
    'anulación de orden → pago',
    'pago → anulación de orden',
    'anulación → anulación de dos órdenes de la misma CxP',
    'pago → pago en otra CxP del mismo tenant (código OP-)',
    'pago → anulación de la CxP',
    'anulación de la CxP → pago',
    'asiento del pago → anulación de la orden'])[p_n]
$$;

-- El rechazo que S2 tiene que recibir con la 0468, si lo hay.
create function pg_temp.rechazo(p_n integer) returns text language sql immutable as $$
  select case p_n when 2 then 'PAYMENT_EXCEEDS_BALANCE' when 7 then 'La CxP ya no admite anulación.'
    when 8 then 'PAYMENT_STATE' end
$$;

create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_p text := p_fase || '-' || p_n || '-';
  v_k text := p_fase || '_' || p_n || '_';
  v_cxp uuid := pg_temp.id(v_p || 'cxp');
  v_cxp2 uuid := pg_temp.id(v_p || 'cxp2');
  v_o1 uuid := pg_temp.id(v_p || 'o1');
  v_o2 uuid := pg_temp.id(v_p || 'o2');
  v_je uuid := pg_temp.id(v_p || 'je');
  v_ids uuid[] := array[v_cxp];
  v_s1 jsonb;
  v_s2 jsonb;
  v_r jsonb;
begin
  case p_n
  when 1 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp');
    v_s1 := pg_temp.pago(p_fase, v_k || 's1', v_cxp, 300);
    v_s2 := pg_temp.pago(p_fase, v_k || 's2', v_cxp, 200);
  when 2 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp');
    v_s1 := pg_temp.pago(p_fase, v_k || 's1', v_cxp, 600);
    v_s2 := pg_temp.pago(p_fase, v_k || 's2', v_cxp, 600);
  when 3 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp', 1000, 400, 'parcial');
    perform pg_temp.orden(v_o1, 'OP-SEED-' || v_p || 'o1', v_cxp, 400);
    v_s1 := pg_temp.anulacion(p_fase, v_k || 's1', v_o1);
    v_s2 := pg_temp.pago(p_fase, v_k || 's2', v_cxp, 300);
  when 4 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp', 1000, 400, 'parcial');
    perform pg_temp.orden(v_o1, 'OP-SEED-' || v_p || 'o1', v_cxp, 400);
    v_s1 := pg_temp.pago(p_fase, v_k || 's1', v_cxp, 300);
    v_s2 := pg_temp.anulacion(p_fase, v_k || 's2', v_o1);
  when 5 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp', 1000, 700, 'parcial');
    perform pg_temp.orden(v_o1, 'OP-SEED-' || v_p || 'o1', v_cxp, 400);
    perform pg_temp.orden(v_o2, 'OP-SEED-' || v_p || 'o2', v_cxp, 300);
    v_s1 := pg_temp.anulacion(p_fase, v_k || 's1', v_o1);
    v_s2 := pg_temp.anulacion(p_fase, v_k || 's2', v_o2);
  when 6 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp');
    perform pg_temp.cxp(v_cxp2, 'CXP-' || v_p || 'cxp2');
    v_ids := array[v_cxp, v_cxp2];
    v_s1 := pg_temp.pago(p_fase, v_k || 's1', v_cxp, 300, true);
    v_s2 := pg_temp.pago(p_fase, v_k || 's2', v_cxp2, 200);
  when 7 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp');
    v_s1 := pg_temp.pago(p_fase, v_k || 's1', v_cxp, 300);
    v_s2 := pg_temp.anulacion_cxp(v_k || 's2', v_cxp);
  when 8 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp');
    v_s1 := pg_temp.anulacion_cxp(v_k || 's1', v_cxp);
    v_s2 := pg_temp.pago(p_fase, v_k || 's2', v_cxp, 300);
  when 9 then
    perform pg_temp.cxp(v_cxp, 'CXP-' || v_p || 'cxp', 1000, 400, 'parcial');
    perform pg_temp.orden(v_o1, 'OP-SEED-' || v_p || 'o1', v_cxp, 400);
    perform pg_temp.asiento_sembrado(v_je, 'A-SEED-' || v_p || 'je');
    v_s1 := pg_temp.asiento(v_o1, v_je);
    v_s2 := pg_temp.anulacion(p_fase, v_k || 's2', v_o1);
  end case;
  v_r := pg_temp.carrera(v_s1, v_s2) || jsonb_build_object('cxps', pg_temp.cxps(v_ids));
  if p_n = 9 then
    -- El asiento guardado en la orden y el que la anulación le pasa a la app.
    v_r := v_r || jsonb_build_object('asiento', jsonb_build_object(
      'guardado', pg_temp.ver(format($q$select coalesce(journal_entry_id::text, '') from public.supplier_payments
        where id = %L$q$, v_o1)),
      'informado', (select r from dblink('c0468_b', format('select current_setting(%L, true)',
        'carrera.' || v_k || 's2_je')) as t(r text))));
  end if;
  return v_r;
end;
$$;

-- El invariante: en toda CxP del escenario, pagado = órdenes vigentes, pagado
-- no pasa el total, el status es el que corresponde al pagado, y una CxP que se
-- anuló sigue anulada y sin órdenes vigentes. En el 9, la anulación le pasa a
-- la app el asiento que quedó guardado en la orden.
create function pg_temp.roto(p_r jsonb) returns boolean language sql immutable as $$
  select exists (select from jsonb_array_elements(p_r -> 'cxps') f
    where (f ->> 'pagado')::numeric <> (f ->> 'ordenes')::numeric
       or (f ->> 'pagado')::numeric > (f ->> 'total')::numeric
       or ((f ->> 'anulada')::boolean and (f ->> 'estado' <> 'anulada' or (f ->> 'ordenes')::numeric > 0))
       or (f ->> 'estado' <> 'anulada' and f ->> 'estado' <> case
             when (f ->> 'pagado')::numeric = 0 then 'pendiente'
             when (f ->> 'pagado')::numeric >= (f ->> 'total')::numeric then 'pagada'
             else 'parcial' end))
    or (p_r ? 'asiento'
        and p_r -> 'asiento' ->> 'guardado' is distinct from p_r -> 'asiento' ->> 'informado')
$$;

-- ANTES: la carrera tiene que dañar algo (el 6: S1 muere por el código repetido).
create function pg_temp.reproduce(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case when p_n = 6 then coalesce(p_r ->> 'error_1' ~ 'duplicate key|payment_code', false)
    else (p_r ->> 'pausa')::boolean and pg_temp.roto(p_r) end
$$;

-- DESPUÉS: S2 esperó a S1 (en el 6, en el lock consultivo del tenant; en los
-- demás, en la fila), S1 no falló, S2 recibió el rechazo esperado (o ninguno),
-- el invariante se cumple y, en el 6, hay dos códigos OP- distintos.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean
    and p_r ->> 'lock' = case when p_n = 6 then 'advisory' else 'transactionid' end
    and p_r ->> 'error_1' is null and not pg_temp.roto(p_r)
    and case when pg_temp.rechazo(p_n) is not null
          then coalesce(p_r ->> 'error_2' like '%' || pg_temp.rechazo(p_n) || '%', false)
          else p_r ->> 'error_2' is null end
    and (p_n <> 6 or (select count(*) = 2 and count(distinct c) = 2
      from jsonb_array_elements(p_r -> 'cxps') f, jsonb_array_elements_text(f -> 'codigos') c))
$$;

do $carrera$
declare
  v_fase text;
  v_n integer;
  v_r jsonb;
  v_ok boolean;
  v_fallan jsonb := '{"antes": [], "despues": []}';
  v_detalle text[] := '{}';
  v_conn text;
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0468 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0468 template template0');
  perform dblink_connect('c0468_s', pg_temp.conn('dtd_carrera_0468', 's'));
  perform dblink_connect('c0468_a', pg_temp.conn('dtd_carrera_0468', 'a'));
  perform dblink_connect('c0468_b', pg_temp.conn('dtd_carrera_0468', 'b'));
  perform dblink_exec('c0468_s', pg_temp.fixture());
  -- S1 y S2 son el usuario de contabilidad, como las peticiones de la app.
  -- Nadie espera para siempre.
  foreach v_conn in array array['c0468_a', 'c0468_b'] loop
    perform dblink_exec(v_conn, $t$set statement_timeout = '30s'$t$);
    perform dblink_exec(v_conn, 'set role authenticated');
    perform * from dblink(v_conn, format($q$select set_config('request.jwt.claim.sub', %L, false)$q$,
      pg_temp.id('user'))) as t(x text);
  end loop;

  foreach v_fase in array array['antes', 'despues'] loop
    if v_fase = 'despues' then
      perform dblink_exec('c0468_s', pg_read_file('/sb/migrations/0468_pago_proveedor_atomico.sql'));
    end if;
    for v_n in 1..9 loop
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      v_ok := case when v_r ? 'excepcion' then false
        when v_fase = 'antes' then pg_temp.reproduce(v_n, v_r)
        else pg_temp.correcto(v_n, v_r) end;
      perform nextval('pg_temp.carrera_aserciones');
      if not v_ok then
        v_fallan := jsonb_set(v_fallan, array[v_fase], (v_fallan -> v_fase) || to_jsonb(v_n));
        v_detalle := v_detalle || format('%s %s (%s): %s', v_fase, v_n, pg_temp.nombre(v_n), v_r);
      end if;
    end loop;
  end loop;

  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'antes') = 0
      and jsonb_array_length(v_fallan -> 'despues') = 0,
    format('controles ANTES que no reprodujeron el daño: %s; escenarios DESPUÉS que fallan: %s. %s',
      v_fallan -> 'antes', v_fallan -> 'despues', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0468 carrera OK: % aserciones; los 9 escenarios se dañan sin la 0468 y se serializan con ella',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0468 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0468')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0468 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
