\set ON_ERROR_STOP on

-- Contrato de concurrencia de la SDD-0490: el crédito de referido baja y sube el
-- pagado de una factura desde TypeScript (lib/studio/accounting/referral-credit-posting.ts
-- y app/studio/(app)/fidelizacion/actions.ts), en peticiones separadas por
-- PostgREST, mientras las funciones de la migr 0467 cobran, identifican y anulan
-- recibos con la factura tomada FOR UPDATE. Base propia y desechable dentro del
-- contenedor del runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ:
--   · revertReferralCreditsForInvoice corre después de anular la factura
--     (voidInvoice). Leía paid_amount y escribía el valor absoluto, sin guard.
--     Con la factura anulada, cobrar, identificar y confirmar un reporte la
--     rechazan (PAYMENT_STATE), pero void_collection_receipt (0467) sí le baja
--     el pagado: si el recibo se anula entre la lectura y la escritura de la
--     reversión, su baja se pierde.
--   · applyReferralCredit escribe paid_amount y status con guard sobre el pagado
--     leído, pero no sobre el estado. Anular no toca el pagado: una anulación
--     entre su lectura y su escritura pasa el guard y la factura revive.
-- La SDD-0490 agrega el guard de estado a la aplicación, y a la reversión el
-- guard de pagado y de estado con relectura. Las pruebas unitarias cubren la
-- lógica; este archivo demuestra, con las funciones reales, que esos guards
-- detectan la carrera en Postgres.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0445, 0449,
-- 0454, 0459, 0460, 0464, 0466 y 0467). El archivo corre en la base `postgres`
-- del runner y, con dblink, abre tres sesiones contra una base propia
-- (dtd_carrera_0490): `s` prepara y observa, `a` corre la operación de la 0467 o
-- de la 0294 y deja la transacción abierta, y `b` llega después, en asíncrono.
-- Lo que la app leyó antes de la carrera viaja en la sentencia de `b`, como en
-- PostgREST. Cada escenario exige ver pg_blocking_pids(b) con `a` adentro.
--
-- Los escenarios:
--   1. Pagado 380 = recibo de 300 (register_collection_receipt real) + crédito de
--      80; la factura se anula (void_invoice_with_audit_reason real) y la
--      reversión lee 380. Entonces se anula el recibo (void_collection_receipt
--      real) y la reversión escribe. ANTES (sus sentencias viejas): escribe
--      380 − 80 = 300 y se pierde la baja del recibo. DESPUÉS (0471): la
--      reversión espera en la fila de la factura, lee 80 bajo el lock y deja 0,
--      sin releer ni reintentar.
--   2. Un cobro llega mientras se anula la factura: espera y sale PAYMENT_STATE.
--      No hay cobro que perder después de anular.
--   3. Se anula la factura mientras un cobro está en curso: la anulación espera
--      al cobro, y la reversión, que corre después, lee el pagado con él.
--   4. Una aplicación del crédito está en vuelo cuando se anula la factura: ya
--      leyó pagado 300 y estado parcial. ANTES (guard sólo de pagado): su UPDATE
--      pasa y la factura anulada revive como parcial. DESPUÉS (guard de estado):
--      0 filas, y la factura sigue anulada. ⚠️ ETIQUETA: las dos fases del 4 son
--      de la GENERACIÓN SDD-0490. Ese UPDATE ya NO existe en la app —lo
--      reemplazó apply_referral_credit (0471)—, así que el escenario pasa por lo
--      que fue cierto y NO cuenta como cobertura del código actual. Su SUCESOR
--      es el escenario 5, que corre ese mismo camino contra las RPC. Se conserva
--      como el registro de por qué aquel guard hizo falta.
--   5. VENTANA 1 del riesgo residual (SDD-0496): la anulación cae ENTRE el claim
--      de la aplicación y su UPDATE final. ANTES (las sentencias de la SDD-0490):
--      el claim confirma solo, el crédito queda `aplicado` y la factura sigue en
--      300; la reversión que corre al anular lee ese crédito y baja 80 que nunca
--      entraron, y deja 220 con un recibo de 300. El UPDATE final llega tarde,
--      matchea 0 filas y compensa el crédito, pero la plata ya se fue. DESPUÉS
--      (0471): la aplicación es una sola transacción; espera a la anulación en la
--      fila de la factura y sale REFERRAL_CREDIT_INVOICE_STATE. No hay estado
--      intermedio que revertir.
--   6. VENTANA 2: el proceso de aplicación MUERE en ese mismo tramo. ANTES: el
--      claim ya confirmó y nadie vuelve; la reversión baja los mismos 80 de más.
--      DESPUÉS: la 0471 muere dentro de su transacción y el rollback se lleva el
--      claim y el abono juntos, así que no queda nada que revertir.
-- La medida de las dos es la misma: el pagado de la factura contra lo que
-- efectivamente se cobró en recibos vigentes. ANTES quedan 220 contra 300;
-- DESPUÉS, 300 contra 300, y el crédito sigue disponible.
-- 2 y 3 corren sólo con el código nuevo: no hay defecto que un control pueda
-- mostrar.
--
-- FIXTURE (SDD-0496): encima de lo de abajo van los referidos —las migraciones
-- 0098, 0197, 0237 y 0238, leídas de su archivo— con los cascarones de `clients`
-- y `fiscal_settings` que ésas tocan y el contrato 0467 no trae, y después la
-- 0471. Las facturas de este archivo se emiten con `issued_at` de hoy: la regla
-- de compra nueva de la 0471 la exige.
--
-- FIXTURE: el del contrato 0467_cobro_factura_atomico.test.sql, leído de su
-- archivo hasta sus helpers de observación: plataforma, las migraciones que
-- incluye (0077, 0078, 0079, 0122, 0230, 0258, 0261, 0267, 0290, 0294 y 0407),
-- su semilla (tenant A con un usuario de contabilidad y una cuenta de caja) y la
-- 0467. Si el contrato cambia de forma, este archivo falla en vez de probar
-- sobre otro fixture. Encima, service_role recibe select y update sobre
-- invoices, que en Supabase tiene por defecto: la reversión corre como el admin
-- client. Por escenario, una factura propia de 1000 USD.
--
-- SIN HUELLA, como los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED: las fases ANTES son el control con las sentencias viejas y tienen que
-- reproducir la pérdida; si no, el archivo falla. Los mutantes del código están
-- en las pruebas unitarias (ver .agents/handoffs/0490-reversion-credito-referido.md).
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0490 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0490 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0490_%s',
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
    if v_conn like 'c0490\_%' then
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
      'drop database if exists dtd_carrera_0490 with (force)');
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
-- resuelven con p_vars, y cualquier otro meta-comando de psql aborta. La marca
-- final se busca después de la inicial.
create function pg_temp.expandir(p_contrato text, p_desde text, p_hasta text, p_vars jsonb)
returns text language plpgsql as $$
declare
  v_txt text := pg_read_file('/sb/tests/' || p_contrato);
  v_ini integer := position(p_desde in v_txt);
  v_fin integer;
  v_linea text;
  v_var text;
  v_padres boolean[] := '{}';
  v_conds boolean[] := '{}';
  v_activo boolean := true;
  v_salida text[] := '{}';
begin
  if v_ini = 0 then
    raise exception 'TEST 0490 carrera: no encuentro «%» en %', p_desde, p_contrato;
  end if;
  v_txt := substr(v_txt, v_ini + length(p_desde));
  v_fin := position(p_hasta in v_txt);
  if v_fin = 0 then
    raise exception 'TEST 0490 carrera: no encuentro «%» en % después de «%»', p_hasta, p_contrato, p_desde;
  end if;
  foreach v_linea in array string_to_array(left(v_txt, v_fin - 1), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0490 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0490 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0490 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0490 carrera: % deja un \if sin cerrar en la región', p_contrato;
  end if;
  return array_to_string(v_salida, E'\n');
end;
$$;

-- Los ids de la semilla del contrato 0467 (su pg_temp.fixture_id).
create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0467-synthetic-' || p_label)::uuid
$$;

-- Un id sintético estable por etiqueta, para lo que agrega este archivo.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0490-carrera-' || p_label)::uuid
$$;

-- El fixture del contrato con la 0467 aplicada, y los grants del admin client,
-- en UNA transacción explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $$
begin
  return concat_ws(E'\n',
    'begin;',
    pg_temp.expandir('0467_cobro_factura_atomico.test.sql',
      E'\nbegin;\n', E'\n-- Helpers de observación', '{"apply_fix": true}'),
    'grant select, update on public.invoices to service_role;',
    -- SDD-0496: los referidos y la 0471. `clients` y `fiscal_settings` son los
    -- cascarones mínimos que 0098/0197 y 0237 tocan.
    'create table public.clients (id uuid primary key, tenant_id uuid not null references public.tenants(id),'
      || ' markbox text not null, name text, deleted_at timestamptz);',
    'create table public.fiscal_settings (tenant_id uuid primary key references public.tenants(id) on delete cascade);',
    pg_read_file('/sb/migrations/0098_fidelizacion_referidos.sql'),
    pg_read_file('/sb/migrations/0197_referral_auto_accredit.sql'),
    pg_read_file('/sb/migrations/0237_referral_credit_apply.sql'),
    pg_read_file('/sb/migrations/0238_referrals_accredited_at.sql'),
    pg_read_file('/sb/migrations/0471_credito_referido_atomico.sql'),
    'commit;');
end;
$$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0490_s', p_sql) as t(r text)
$$;

-- Como `ver`, pero como el usuario de contabilidad: devuelve lo que la sentencia
-- produjo. Hace falta porque `ver` corre sin rol ni auth.uid, y las RPC de la
-- 0471 son INVOKER: sin identidad darían REFERRAL_CREDIT_FORBIDDEN y la prueba
-- estaría midiendo el gate de rol en vez de la carrera.
create function pg_temp.ver_como_contabilidad(p_sql text) returns text language plpgsql as $$
declare v_r text;
begin
  perform dblink_exec('c0490_s', 'begin');
  perform dblink_exec('c0490_s', 'set local role authenticated');
  perform * from dblink('c0490_s', format($q$select set_config('request.jwt.claim.sub', %L, true)$q$,
    pg_temp.fid('accounting-A'))) as t(x text);
  select r into v_r from dblink('c0490_s', p_sql) as t(r text);
  perform dblink_exec('c0490_s', 'commit');
  return v_r;
end;
$$;

-- Una operación de la app en `s`, como el usuario de contabilidad del tenant A.
create function pg_temp.como_contabilidad(p_sql text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0490_s', format($q$begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', %L, true);
%s;
commit;$q$, pg_temp.fid('accounting-A'), p_sql));
end;
$$;

-- ── La factura y su historia ─────────────────────────────────
create function pg_temp.factura(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0490_s', format($q$insert into public.invoices (id, tenant_id, invoice_code,
      client_markbox, client_name, currency, fx_rate, base_amount, total_amount, paid_amount, status,
      fund_class, issued_at)
    values (%L, %L, %L, 'DTD-0490', 'Cliente 0490', 'USD', null, 1000, 1000, 0, 'emitida',
      'third_party', current_date)$q$,
    pg_temp.id(p_label), pg_temp.fid('tenant-A'), 'F-0490-' || upper(p_label)));
end;
$$;

create function pg_temp.cobro_sql(p_label text, p_monto numeric) returns text language sql as $$
  select format($q$select public.register_collection_receipt(%L, %s, %L, 'transferencia',
    current_date, null, null, 'cliente', null, null, false)::text$q$,
    pg_temp.id(p_label), p_monto, pg_temp.fid('cash-A'))
$$;

create function pg_temp.anulacion_sql(p_label text) returns text language sql as $$
  select format($q$select public.void_invoice_with_audit_reason(%L, 'Anulación de la carrera 0490')::text$q$,
    pg_temp.id(p_label))
$$;

-- El abono no-monetario del crédito (80 USD), como lo deja applyReferralCredit.
create function pg_temp.abono_credito(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0490_s', format($q$update public.invoices
    set paid_amount = paid_amount + 80,
        status = case when paid_amount + 80 >= total_amount then 'pagada' else 'parcial' end::public.invoice_status,
        last_payment_at = now()
    where id = %L$q$, pg_temp.id(p_label)));
end;
$$;

-- Lo que leyó la app antes de la carrera: pagado y estado.
create function pg_temp.leer(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object('pagado', paid_amount, 'estado', status)::text
    from public.invoices where id = %L$q$, pg_temp.id(p_label)))::jsonb
$$;

-- ── La reversión del crédito (revertReferralCreditsForInvoice) ─
-- ANTES: escribía el absoluto calculado sobre la lectura, sin guard.
create function pg_temp.reversion_vieja(p_label text, p_leido jsonb) returns text language sql as $$
  select format('update public.invoices set paid_amount = %s where id = %L',
    greatest(0, round((p_leido ->> 'pagado')::numeric - 80, 2)), pg_temp.id(p_label))
$$;

-- DESPUÉS: UPDATE con guard de pagado y de estado; ante 0 filas relee y
-- reintenta, hasta 3 veces (REVERT_PAID_MAX_ATTEMPTS). El estado sigue la regla
-- de la 0467 y sólo se escribe si cambia, como hace el código.
create function pg_temp.reversion_nueva(p_label text, p_leido jsonb) returns text language sql as $$
  select format($q$do $r$
declare
  v_pagado numeric := %1$s;
  v_estado text := %2$L;
  v_nuevo numeric;
  v_nuevo_estado text;
  v_fila uuid;
  v_intentos integer := 0;
begin
  loop
    v_intentos := v_intentos + 1;
    v_nuevo := greatest(0, round(v_pagado - 80, 2));
    v_nuevo_estado := case when v_estado in ('anulada', 'borrador') then v_estado
                           when v_nuevo <= 0 then 'emitida' else 'parcial' end;
    if v_nuevo_estado = v_estado then
      update public.invoices set paid_amount = v_nuevo
       where id = %3$L and paid_amount = v_pagado and status = v_estado::public.invoice_status
      returning id into v_fila;
    else
      update public.invoices set paid_amount = v_nuevo, status = v_nuevo_estado::public.invoice_status
       where id = %3$L and paid_amount = v_pagado and status = v_estado::public.invoice_status
      returning id into v_fila;
    end if;
    exit when v_fila is not null or v_intentos >= 3;
    select paid_amount, status::text into v_pagado, v_estado from public.invoices where id = %3$L;
  end loop;
  perform set_config('carrera.intentos', v_intentos::text, false);
  if v_fila is null then
    raise exception 'REVERT_CONFLICT';
  end if;
end
$r$
$q$, (p_leido ->> 'pagado')::numeric, p_leido ->> 'estado', pg_temp.id(p_label))
$$;

-- ── El UPDATE final de applyReferralCredit ───────────────────
-- ANTES: guard sólo sobre el pagado leído. DESPUÉS: también sobre el estado.
-- Devuelve cuántas filas tocó.
create function pg_temp.aplicacion(p_label text, p_leido jsonb, p_con_estado boolean) returns text
language sql as $$
  select format($q$with u as (
      update public.invoices
         set paid_amount = %1$s,
             status = %2$L::public.invoice_status,
             last_payment_at = now()
       where id = %3$L and paid_amount = %4$s%5$s
      returning 1)
    select count(*)::text from u$q$,
    (p_leido ->> 'pagado')::numeric + 80,
    case when (p_leido ->> 'pagado')::numeric + 80 >= 1000 then 'pagada' else 'parcial' end,
    pg_temp.id(p_label),
    (p_leido ->> 'pagado')::numeric,
    case when p_con_estado then format(' and status = %L::public.invoice_status', p_leido ->> 'estado') else '' end)
$$;

-- ── El crédito de referido (SDD-0496) ────────────────────────
-- Un crédito acreditado del mismo cliente que la factura, con fecha muy
-- anterior: la regla de compra nueva de la 0471 lo admite.
create function pg_temp.credito(p_label text) returns void language plpgsql as $$
begin
  perform dblink_exec('c0490_s', format($q$insert into public.referrals
    (id, tenant_id, referral_code, referrer_markbox, referred_name, status, reward_usd, accredited_at)
    values (%L, %L, %L, 'DTD-0490', 'Referido 0490', 'acreditado', 80, now() - interval '30 days')$q$,
    pg_temp.id('ref-' || p_label), pg_temp.fid('tenant-A'), 'REF-0490-' || upper(p_label)));
end;
$$;

create function pg_temp.credito_estado(p_label text) returns text language sql as $$
  select pg_temp.ver(format('select status::text from public.referrals where id = %L',
    pg_temp.id('ref-' || p_label)))
$$;

-- ANTES · el CLAIM de applyReferralCredit: su propia petición, que confirma
-- sola. Desde acá hasta el UPDATE final de la factura no hay ningún lock: ésa
-- es la ventana.
create function pg_temp.claim_viejo(p_label text) returns void language plpgsql as $$
begin
  perform pg_temp.como_contabilidad(format($q$update public.referrals
    set status = 'aplicado', applied_invoice_id = %L, applied_at = now()
    where id = %L and status = 'acreditado'$q$,
    pg_temp.id(p_label), pg_temp.id('ref-' || p_label)));
end;
$$;

-- ANTES · revertReferralCreditsForInvoice tal como la dejó la SDD-0490: reclama
-- los créditos 'aplicado' de la factura y después baja el abono con guard y
-- relectura. Peticiones separadas: nada le dice que el abono nunca llegó.
create function pg_temp.reversion_0490(p_label text) returns void language plpgsql as $$
declare v_creditos integer;
begin
  select x::int into v_creditos from dblink('c0490_s', format($q$with u as (
      update public.referrals set status = 'acreditado', applied_invoice_id = null,
        applied_entry_id = null, applied_at = null
      where applied_invoice_id = %L and status = 'aplicado' and deleted_at is null returning 1)
    select count(*) from u$q$, pg_temp.id(p_label))) as t(x text);
  if v_creditos > 0 then
    perform dblink_exec('c0490_s', 'set role service_role');
    perform dblink_exec('c0490_s', pg_temp.reversion_nueva(p_label, pg_temp.leer(p_label)));
    perform dblink_exec('c0490_s', 'reset role');
  end if;
end;
$$;

-- DESPUÉS · las RPC de la 0471, con el usuario de contabilidad.
create function pg_temp.aplicacion_rpc(p_label text) returns text language sql as $$
  select format('select public.apply_referral_credit(%L, %L)::text',
    pg_temp.id('ref-' || p_label), pg_temp.id(p_label))
$$;

create function pg_temp.reversion_rpc(p_label text) returns text language sql as $$
  select format('select public.revert_referral_credits(%L, null::uuid)::text', pg_temp.id(p_label))
$$;

-- DESPUÉS · el proceso que muere aplicando: la transacción de la 0471 se abre,
-- corre la RPC y no confirma. El rollback se lleva el claim y el abono juntos.
create function pg_temp.muere_aplicando(p_label text) returns text language plpgsql as $$
declare v_r text;
begin
  perform pg_temp.abrir('c0490_a', 'authenticated');
  select r into v_r from dblink('c0490_a', pg_temp.aplicacion_rpc(p_label)) as t(r text);
  perform dblink_exec('c0490_a', 'rollback');
  return v_r;
end;
$$;

-- Abre la transacción de una sesión con el rol dado; con p_contabilidad, como el
-- usuario de contabilidad del tenant A.
create function pg_temp.abrir(p_conn text, p_rol text) returns void language plpgsql as $$
begin
  perform dblink_exec(p_conn, 'begin');
  perform dblink_exec(p_conn, format('set local role %I', p_rol));
  if p_rol = 'authenticated' then
    perform * from dblink(p_conn, format($q$select set_config('request.jwt.claim.sub', %L, true)$q$,
      pg_temp.fid('accounting-A'))) as t(x text);
  end if;
end;
$$;

-- Una carrera: `a` corre p_a_sql y deja la transacción abierta; `b` corre p_b_sql
-- en asíncrono. Devuelve si `b` esperó a `a` (y en qué tipo de lock), lo que
-- devolvió cada uno y el error de `b`, si lo hubo.
create function pg_temp.carrera(p_a_rol text, p_a_sql text, p_b_rol text, p_b_sql text) returns jsonb
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
  select pid into v_a from dblink('c0490_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0490_b', 'select pg_backend_pid()') as t(pid integer);
  perform pg_temp.abrir('c0490_a', p_a_rol);
  select r into v_ra from dblink('c0490_a', p_a_sql) as t(r text);
  perform pg_temp.abrir('c0490_b', p_b_rol);
  perform pg_temp.afirmar(dblink_send_query('c0490_b', p_b_sql) = 1, 'la segunda sesión tiene que salir');

  -- `b` termina o queda esperando a `a`. Si espera, no se suelta hasta que `a`
  -- confirme, así que verlo una vez alcanza.
  v_limite := clock_timestamp() + interval '20 seconds';
  loop
    if v_a = any (pg_blocking_pids(v_b)) then
      v_espero := true;
      select string_agg(distinct locktype, ',') into v_lock from pg_locks where pid = v_b and not granted;
      exit;
    end if;
    exit when dblink_is_busy('c0490_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0490 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  perform dblink_exec('c0490_a', 'commit');
  -- Un error de `b` es un resultado esperado en varios casos: se guarda, no se
  -- reenvía como aviso.
  perform set_config('client_min_messages', 'warning', true);
  select r into v_rb from dblink_get_result('c0490_b', false) as t(r text);
  if v_rb is null then
    v_error := dblink_error_message('c0490_b');
  end if;
  perform * from dblink_get_result('c0490_b', false) as t(r text);  -- cierre del resultado asíncrono
  perform set_config('client_min_messages', v_avisos, true);
  perform dblink_exec('c0490_b', case when v_error is null then 'commit' else 'rollback' end);
  return jsonb_build_object('espero', v_espero, 'lock', v_lock, 'a', v_ra, 'b', v_rb, 'error_b', v_error);
end;
$$;

-- Tras un escenario que se cortó a mitad: nada queda abierto ni esperando.
create function pg_temp.reponer() returns void language plpgsql as $$
declare
  v_avisos text := current_setting('client_min_messages');
begin
  perform set_config('client_min_messages', 'error', true);
  if dblink_is_busy('c0490_b') = 1 then
    perform dblink_cancel_query('c0490_b');
  end if;
  perform * from dblink_get_result('c0490_b', false) as t(r text);
  perform * from dblink_get_result('c0490_b', false) as t(r text);
  perform dblink_exec('c0490_b', 'rollback', false);
  perform dblink_exec('c0490_a', 'rollback', false);
  perform dblink_exec('c0490_s', 'rollback', false);
  perform dblink_exec('c0490_s', 'reset role', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- La factura después de la carrera, con sus recibos vigentes.
create function pg_temp.estado(p_label text) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select jsonb_build_object(
      'pagado', i.paid_amount, 'estado', i.status,
      'recibos', (select count(*) from public.payment_receipts r where r.invoice_id = i.id and r.deleted_at is null),
      'cobrado', (select coalesce(sum(r.amount), 0) from public.payment_receipts r
                   where r.invoice_id = i.id and r.deleted_at is null))::text
    from public.invoices i where i.id = %L$q$, pg_temp.id(p_label)))::jsonb
$$;

-- ── Escenarios ───────────────────────────────────────────────
create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_f text := 'e' || p_n || left(p_fase, 1);
  v_leido jsonb;
  v_recibo uuid;
  v_r jsonb;
begin
  perform pg_temp.factura(v_f);
  perform pg_temp.como_contabilidad(pg_temp.cobro_sql(v_f, 300));
  case p_n
  when 1 then
    if p_fase = 'antes' then
      perform pg_temp.abono_credito(v_f);          -- 380 = 300 + 80, como lo dejaba la app
    else
      -- Con la 0471 el abono lo pone la RPC, junto al claim del crédito.
      perform pg_temp.credito(v_f);
      perform pg_temp.como_contabilidad(pg_temp.aplicacion_rpc(v_f));
    end if;
    perform pg_temp.como_contabilidad(pg_temp.anulacion_sql(v_f));  -- voidInvoice
    v_leido := pg_temp.leer(v_f);                                   -- la reversión vieja lee 380
    v_recibo := pg_temp.ver(format('select id::text from public.payment_receipts where invoice_id = %L',
      pg_temp.id(v_f)))::uuid;
    v_r := pg_temp.carrera('authenticated',
      format($q$select public.void_collection_receipt(%L, 'Anulación de la carrera 0490')::text$q$, v_recibo),
      case when p_fase = 'antes' then 'service_role' else 'authenticated' end,
      case when p_fase = 'antes' then pg_temp.reversion_vieja(v_f, v_leido)
           else pg_temp.reversion_rpc(v_f) end);
  when 2 then
    v_r := pg_temp.carrera('authenticated', pg_temp.anulacion_sql(v_f),
      'authenticated', pg_temp.cobro_sql(v_f, 200));
  when 3 then
    perform pg_temp.credito(v_f);
    perform pg_temp.como_contabilidad(pg_temp.aplicacion_rpc(v_f));  -- 380 = 300 + 80
    v_r := pg_temp.carrera('authenticated', pg_temp.cobro_sql(v_f, 200),
      'authenticated', pg_temp.anulacion_sql(v_f));
    -- Después de anular corre la reversión, que toma la factura y lee bajo el lock.
    perform pg_temp.como_contabilidad(pg_temp.reversion_rpc(v_f));
  when 4 then
    -- ┌─ GENERACIÓN SDD-0490 · NO describe el camino vivo ────────────────────┐
    -- │ Las dos fases corren el UPDATE final de applyReferralCredit con su    │
    -- │ guard optimista. La SDD-0496 RETIRÓ ese UPDATE: la aplicación es hoy  │
    -- │ una sola transacción (apply_referral_credit, migr 0471). O sea que    │
    -- │ este escenario pasa por lo que fue cierto, no por lo que el código    │
    -- │ hace ahora: NO cuenta como cobertura del código actual.               │
    -- │ SUCESOR: el escenario 5, que es este mismo camino contra las RPC.     │
    -- │ Se conserva como el registro de por qué aquel guard hizo falta. Si    │
    -- │ alguien lo edita creyendo que mide la app de hoy, se equivoca.        │
    -- └───────────────────────────────────────────────────────────────────────┘
    v_leido := pg_temp.leer(v_f);                                   -- la aplicación leyó 300, parcial
    v_r := pg_temp.carrera('authenticated', pg_temp.anulacion_sql(v_f),
      'authenticated', pg_temp.aplicacion(v_f, v_leido, p_fase = 'despues'));
  when 5 then
    -- VENTANA 1: la anulación cae entre el claim de la aplicación y su UPDATE final.
    perform pg_temp.credito(v_f);
    if p_fase = 'antes' then
      perform pg_temp.claim_viejo(v_f);            -- crédito 'aplicado'; la factura sigue en 300
      v_leido := pg_temp.leer(v_f);                -- lo que la aplicación leyó antes del claim
      perform pg_temp.como_contabilidad(pg_temp.anulacion_sql(v_f));  -- voidInvoice anula…
      perform pg_temp.reversion_0490(v_f);         -- …y revierte un abono que nunca llegó: 220
      -- El UPDATE final de la aplicación llega tarde: 0 filas, y compensa el
      -- crédito. La plata, en cambio, ya no vuelve sola.
      v_r := jsonb_build_object('b',
        pg_temp.ver_como_contabilidad(pg_temp.aplicacion(v_f, v_leido, true)));
    else
      -- Con la 0471 el claim y el abono son la misma transacción: la aplicación
      -- espera a la anulación en la fila de la factura y sale rechazada.
      v_r := pg_temp.carrera('authenticated', pg_temp.anulacion_sql(v_f),
        'authenticated', pg_temp.aplicacion_rpc(v_f));
      perform pg_temp.como_contabilidad(pg_temp.reversion_rpc(v_f));
    end if;
  when 6 then
    -- VENTANA 2: el proceso de aplicación muere en ese mismo tramo.
    perform pg_temp.credito(v_f);
    if p_fase = 'antes' then
      perform pg_temp.claim_viejo(v_f);            -- el claim confirmó y nadie vuelve
      perform pg_temp.como_contabilidad(pg_temp.anulacion_sql(v_f));
      perform pg_temp.reversion_0490(v_f);         -- 300 − 80 = 220
      v_r := '{}'::jsonb;
    else
      -- La 0471 muere adentro de su transacción: el rollback se lleva las dos
      -- escrituras, así que la reversión no encuentra nada que bajar.
      v_r := jsonb_build_object('a', pg_temp.muere_aplicando(v_f));
      perform pg_temp.como_contabilidad(pg_temp.anulacion_sql(v_f));
      v_r := v_r || jsonb_build_object('b',
        pg_temp.ver_como_contabilidad(pg_temp.reversion_rpc(v_f)));
    end if;
  end case;
  return v_r || jsonb_build_object('leido', v_leido, 'final', pg_temp.estado(v_f),
    -- 5 y 6 miden el crédito en las dos fases (la pérdida se ve con el crédito
    -- ya devuelto); 1 y 3 sólo tienen fila de crédito en el camino nuevo.
    'credito', case when p_n in (5, 6) or (p_n in (1, 3) and p_fase = 'despues')
      then pg_temp.credito_estado(v_f) end);
end;
$$;

-- ANTES (sentencias viejas): tiene que reproducirse la pérdida. En 1, el pagado
-- final no es 0 (se perdió la baja del recibo anulado); en 4, la factura
-- anulada revivió. En 5 y 6, la factura quedó con 220 pagados contra un recibo
-- vigente de 300: son los 80 del crédito que nunca se abonaron y que la
-- reversión igual descontó. El crédito, además, vuelve a estar disponible, así
-- que el cliente lo conserva y la plata se la comió la factura.
create function pg_temp.control(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case p_n
    when 1 then (p_r -> 'final' ->> 'pagado')::numeric <> 0
    when 4 then p_r -> 'final' ->> 'estado' <> 'anulada'
    when 5 then (p_r -> 'final' ->> 'pagado')::numeric = 220
      and (p_r -> 'final' ->> 'cobrado')::numeric = 300
      and p_r ->> 'credito' = 'acreditado' and p_r ->> 'b' = '0'
    when 6 then (p_r -> 'final' ->> 'pagado')::numeric = 220
      and (p_r -> 'final' ->> 'cobrado')::numeric = 300
      and p_r ->> 'credito' = 'acreditado'
    else false end
$$;

-- DESPUÉS: `b` esperó a `a` en una fila (transactionid) y el resultado es el de
-- una ejecución en serie. En 1, pagado 0 tras releer una vez; en 2, el cobro sale
-- PAYMENT_STATE; en 3, la anulación esperó al cobro y la reversión dejó el
-- pagado igual a lo cobrado (500); en 4, 0 filas y la factura sigue anulada.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select p_r -> 'final' ->> 'estado' = 'anulada'
    -- El 6 no es una carrera: nadie espera a nadie porque la transacción que
    -- muere no deja rastro. Los demás sí exigen que `b` haya esperado a `a`.
    and (p_n = 6 or ((p_r ->> 'espero')::boolean and p_r ->> 'lock' = 'transactionid'))
    and case p_n
      -- Ya no hay contador de reintentos: con la factura tomada FOR UPDATE, la
      -- reversión lee UNA vez y lo que lee ya es lo que dejó la anulación del
      -- recibo. El reintento de la SDD-0490 existía porque no había lock.
      when 1 then p_r ->> 'error_b' is null and (p_r -> 'final' ->> 'pagado')::numeric = 0
        and (p_r -> 'final' ->> 'recibos')::int = 0 and p_r ->> 'credito' = 'acreditado'
      when 2 then coalesce(p_r ->> 'error_b' like '%PAYMENT_STATE%', false)
        and (p_r -> 'final' ->> 'pagado')::numeric = 300 and (p_r -> 'final' ->> 'recibos')::int = 1
      when 3 then p_r ->> 'error_b' is null and p_r ->> 'b' = 'true'
        and (p_r -> 'final' ->> 'pagado')::numeric = 500
        and (p_r -> 'final' ->> 'cobrado')::numeric = 500
      when 4 then p_r ->> 'error_b' is null and p_r ->> 'b' = '0'
        and (p_r -> 'final' ->> 'pagado')::numeric = 300
      -- 5 y 6: el pagado coincide con lo cobrado en recibos vigentes, así que a
      -- la factura no se le restó nada que no hubiera entrado, y el crédito
      -- sigue disponible para otra factura.
      when 5 then coalesce(p_r ->> 'error_b' like '%REFERRAL_CREDIT_INVOICE_STATE%', false)
        and (p_r -> 'final' ->> 'pagado')::numeric = 300
        and (p_r -> 'final' ->> 'cobrado')::numeric = 300
        and p_r ->> 'credito' = 'acreditado'
      when 6 then (p_r -> 'final' ->> 'pagado')::numeric = 300
        and (p_r -> 'final' ->> 'cobrado')::numeric = 300
        and p_r ->> 'credito' = 'acreditado'
        and coalesce(p_r ->> 'b', '') like '%"count": 0%'
    end
$$;

create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'se anula un recibo mientras la reversión baja el crédito',
    'un cobro llega mientras se anula la factura',
    'se anula la factura mientras un cobro está en curso',
    'una aplicación del crédito en vuelo cuando se anula la factura'
      || ' [generación 0490, no es el camino vivo; sucesor: escenario 5]',
    'VENTANA 1: la anulación cae entre el claim de la aplicación y su UPDATE final',
    'VENTANA 2: el proceso de aplicación muere entre el claim y el UPDATE final'])[p_n]
$$;

do $carrera$
declare
  v_n integer;
  v_fase text;
  v_r jsonb;
  v_ok boolean;
  v_fallan jsonb := '{"antes": [], "despues": []}';
  v_detalle text[] := '{}';
  v_restos text;
begin
  -- Base propia desde template0: nada de lo que otro archivo deje en template1.
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0490 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0490 template template0');
  perform dblink_connect('c0490_s', pg_temp.conn('dtd_carrera_0490', 's'));
  perform dblink_connect('c0490_a', pg_temp.conn('dtd_carrera_0490', 'a'));
  perform dblink_connect('c0490_b', pg_temp.conn('dtd_carrera_0490', 'b'));
  perform dblink_exec('c0490_s', pg_temp.fixture());
  -- Nadie espera para siempre.
  perform dblink_exec('c0490_a', $t$set statement_timeout = '30s'$t$);
  perform dblink_exec('c0490_b', $t$set statement_timeout = '30s'$t$);

  for v_n in 1..6 loop
    foreach v_fase in array case when v_n in (1, 4, 5, 6) then array['antes', 'despues']
      else array['despues'] end loop
      begin
        v_r := pg_temp.escenario(v_fase, v_n);
      exception when others then
        v_r := jsonb_build_object('excepcion', sqlerrm);
        perform pg_temp.reponer();
      end;
      v_ok := case when v_r ? 'excepcion' then false
        when v_fase = 'despues' then pg_temp.correcto(v_n, v_r)
        else pg_temp.control(v_n, v_r) end;
      perform nextval('pg_temp.carrera_aserciones');
      if not coalesce(v_ok, false) then
        v_fallan := jsonb_set(v_fallan, array[v_fase], (v_fallan -> v_fase) || to_jsonb(v_n));
        v_detalle := v_detalle || format('%s %s (%s): %s', v_fase, v_n, pg_temp.nombre(v_n), v_r);
      end if;
    end loop;
  end loop;

  perform pg_temp.afirmar(jsonb_array_length(v_fallan -> 'antes') = 0 and jsonb_array_length(v_fallan -> 'despues') = 0,
    format('controles ANTES que no reprodujeron la pérdida: %s; escenarios DESPUÉS que fallan: %s. %s',
      v_fallan -> 'antes', v_fallan -> 'despues', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0490 carrera OK: % aserciones; la reversión y la aplicación del crédito no pierden una baja, no reviven una factura anulada y no le restan un abono que nunca llegó',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0490 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0490')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0490 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
