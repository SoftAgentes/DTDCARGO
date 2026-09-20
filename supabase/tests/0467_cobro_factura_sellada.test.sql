\set ON_ERROR_STOP on

-- Interoperabilidad de las migr 0466 (SDD-0487) y 0467 (SDD-0488): las tres
-- RPC de Cobranzas sobre facturas que la 0466 selló al emitir. Bases propias y
-- desechables dentro del contenedor del runner: nunca consulta ni modifica una
-- base alojada.
--
-- POR QUÉ: el contrato 0466_client_billing_identity.test.sql recorre los
-- escritores posteriores a la emisión, pero para la 0467 sólo repite sus
-- UPDATE: las RPC reales no corren ahí, porque el preflight de la 0467 exige el
-- cuerpo de producción de get_user_tenant_id y el fixture de la 0421 trae un
-- stub. schema-rebuild prueba que las dos migraciones se aplican en orden; esto
-- prueba el comportamiento.
--
-- CÓMO: dos bases con el mismo fixture y la 0467 encima, una con la 0466
-- (dtd_sellada_con) y otra sin ella (dtd_sellada_sin). En cada una, una sola
-- sesión de contabilidad corre la misma secuencia con las RPC reales:
--   X, emitida con la preferencia del cliente (su empresa): cobro 300,
--     identificación de un sin-ref de 200, cobro 500 (pagada), y la anulación
--     de los tres recibos, hasta volver a emitida (parcial → emitida);
--   Y, emitida desde el borrador con bill_to_kind = persona (override
--     auditado): cobro 1000 (pagada) y su anulación (→ emitida).
-- Antes de la secuencia, y ya emitidas las dos, cambian la razón social y el
-- domicilio de la empresa y el nombre del cliente: si algo volviera a sellar,
-- el titular cambiaría.
-- Lo que defiende:
--   · las transiciones (estado y pagado, de la RPC y de la factura) son las
--     mismas con la 0466 y sin ella;
--   · con la 0466, el titular (client_name, client_rif, client_doc_kind,
--     client_fiscal_address y bill_to_kind) de X y de Y queda como se selló, en
--     cada paso: ninguna RPC choca con invoice_titular_frozen ni vuelve a
--     sellar;
--   · no aparece ningún invoice_bill_to_overridden nuevo: X sigue en cero e Y
--     en el de su emisión;
--   · los recibos de X llevan el nombre sellado.
--
-- FIXTURE: el de 0467_cobro_factura_carrera.test.sql (la unión de los fixtures
-- de los contratos 0467 y 0421, con get_user_tenant_id de la 0453, la 0421 y la
-- 0464), más la región del contrato 0466 que sigue a su `\ir` de la 0464: la
-- 0392, las columnas de clients, la 0445, la 0462 y, en la base `con`, la 0466.
-- Todo se lee de los archivos con pg_read_file; después va la 0467 entera.
--
-- SIN HUELLA, como los archivos de carrera: las bases propias y los roles anon,
-- authenticated y service_role se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0466 fuera del repo, ver .agents/handoffs/0488-carrera-cobro-0467.md):
-- un sello que se repite al volver a emitida, o una inmutabilidad que también
-- congela el estado, hacen fallar este archivo.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0467 sellada requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence sellada_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0467 sellada: %', p_msg; end if;
  perform nextval('pg_temp.sellada_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_sellada_%s',
    split_part(current_setting('unix_socket_directories'), ',', 1),
    current_setting('port'), p_base, current_user, p_sesion)
$$;

-- Nunca lanza: devuelve lo que no pudo limpiar. Idempotente.
create function pg_temp.limpiar() returns text language plpgsql as $$
declare
  v_conn text;
  v_base text;
  v_restos text := '';
begin
  foreach v_conn in array coalesce(dblink_get_connections(), '{}') loop
    if v_conn like 'csel\_%' then
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        v_restos := v_restos || format(' sesión %s: %s;', v_conn, sqlerrm);
      end;
    end if;
  end loop;
  foreach v_base in array array['dtd_sellada_con', 'dtd_sellada_sin'] loop
    begin
      perform dblink_exec(pg_temp.conn('postgres', 'limpieza'),
        format('drop database if exists %I with (force)', v_base));
    exception when others then
      v_restos := v_restos || format(' base %s: %s;', v_base, sqlerrm);
    end;
  end loop;
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
    raise exception 'TEST 0467 sellada: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0467 sellada: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0467 sellada: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0467 sellada: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0467 sellada: % deja un \if sin cerrar en la región', p_contrato;
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
    raise exception 'TEST 0467 sellada: no encuentro dónde siembra su fixture %', p_contrato;
  end if;
  select array_agg(m[1] order by m[1]) into v_lista
  from regexp_matches(substr(v_txt, 1, v_fin), '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)\s*$', 'gn') m;
  if coalesce(cardinality(v_lista), 0) = 0 then
    raise exception 'TEST 0467 sellada: % no incluye migraciones antes de su fixture', p_contrato;
  end if;
  return v_lista;
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0488-sellada-' || p_label)::uuid
$$;

-- El fixture de la carrera de la 0467, la región del contrato 0466 (con la 0466
-- sólo si p_con_0466) y la 0467, en UNA transacción explícita.
create function pg_temp.fixture(p_con_0466 boolean) returns text language plpgsql as $fx$
declare
  v_migraciones text[];
  v_m text;
  v_partes text[] := array['begin;'];
begin
  select array_agg(distinct m order by m) into v_migraciones
  from unnest(pg_temp.migraciones('0467_cobro_factura_atomico.test.sql')
    || pg_temp.migraciones('0421_payment_report_commands.test.sql')) m;
  -- Plataforma, del contrato 0467 tal cual.
  v_partes := v_partes || pg_temp.expandir('0467_cobro_factura_atomico.test.sql',
    E'\n\\endif\nbegin;\n', E'\n\\ir ../migrations/0077_invoices.sql', '{}');
  -- Lo que la 0421 necesita y la 0467 no trae, copiado del contrato 0421, igual
  -- que en 0467_cobro_factura_carrera.test.sql.
  v_partes := v_partes || $shim$
create schema storage;
grant usage on schema storage to authenticated, service_role;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
alter table public.clients enable row level security;
grant select on public.clients to authenticated;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
alter table public.shipments add column client_markbox text;
alter table public.shipments enable row level security;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
$shim$::text;
  foreach v_m in array v_migraciones loop
    v_partes := v_partes || pg_read_file('/sb/migrations/' || v_m);
  end loop;
  v_partes := v_partes || pg_read_file('/sb/migrations/0421_payment_report_commands.sql')
    || pg_read_file('/sb/migrations/0464_reporte_pago_factura_pagada.sql');
  -- El contrato 0466 aplica la 0464 y sigue desde ahí: la 0392, las columnas de
  -- clients, la 0445, la 0462 y la 0466.
  v_partes := v_partes || pg_temp.expandir('0466_client_billing_identity.test.sql',
    E'\\ir ../migrations/0464_reporte_pago_factura_pagada.sql\n', E'\ncreate temporary sequence billing_assertions',
    jsonb_build_object('apply_billing', p_con_0466));
  v_partes := v_partes || pg_read_file('/sb/migrations/0467_cobro_factura_atomico.sql');
  -- La semilla de la carrera: un tenant, un usuario de contabilidad con una sola
  -- membresía y una cuenta de caja. Más el cliente de las facturas: una persona.
  v_partes := v_partes || format($seed$
insert into auth.users (id, email) values (%1$L, 'contabilidad-0488@sellada.invalid');
insert into public.tenants (id, slug, display_name)
  values (%2$L, 'sellada-0488', 'Tenant sintético de la interoperabilidad 0466-0467');
insert into public.user_tenants (user_id, tenant_id, role) values (%1$L, %2$L, 'accounting');
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
  values (%3$L, %2$L, '1.1.1.1', 'Banco sintético 0488', 'A', true);
insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind)
  values (%4$L, %2$L, 'SELLO', 'Ana Pérez', 'V-12345678', 'persona');
$seed$, pg_temp.id('user'), pg_temp.id('tenant'), pg_temp.id('cash'), pg_temp.id('client'));
  return array_to_string(v_partes || 'commit;'::text, E'\n');
end;
$fx$;

-- Lo que devuelve una consulta en la sesión de observación de una base.
create function pg_temp.ver(p_base text, p_sql text) returns text language sql as $$
  select r from dblink('csel_' || p_base || '_s', p_sql) as t(r text)
$$;

-- Una RPC como el usuario de contabilidad; un error aborta el archivo.
create function pg_temp.rpc(p_base text, p_llamada text) returns jsonb language sql as $$
  select r::jsonb from dblink('csel_' || p_base || '_a', 'select (' || p_llamada || ')::text') as t(r text)
$$;

create function pg_temp.cobro(p_base text, p_factura text, p_monto numeric) returns jsonb language sql as $$
  select pg_temp.rpc(p_base, format($q$public.register_collection_receipt(%L, %s, %L, 'transferencia',
    current_date, null, null, 'cliente', null, null, false)$q$, pg_temp.id(p_factura), p_monto, pg_temp.id('cash')))
$$;

-- El titular de una factura, tal como lo congela la 0466.
create function pg_temp.titular(p_factura text) returns text language sql as $$
  select pg_temp.ver('con', format($q$select row(client_name, client_rif, client_doc_kind,
    client_fiscal_address, bill_to_kind)::text from public.invoices where id = %L$q$, pg_temp.id(p_factura)))
$$;

-- Un paso de la secuencia: lo que devolvió la RPC, lo que quedó en la factura
-- y, con la 0466, el titular de las dos facturas.
create function pg_temp.paso(p_base text, p_paso text, p_factura text, p_r jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('paso', p_paso,
    'rpc', jsonb_build_object('status', p_r -> 'status', 'paid_amount', p_r -> 'paid_amount',
      'fully_paid', p_r -> 'fully_paid'),
    'factura', pg_temp.ver(p_base, format($q$select row(status, paid_amount)::text from public.invoices
      where id = %L$q$, pg_temp.id(p_factura))))
  || case when p_base = 'con' then jsonb_build_object('titular_x', pg_temp.titular('x'),
       'titular_y', pg_temp.titular('y')) else '{}' end
$$;

-- La misma secuencia en cualquiera de las dos bases.
create function pg_temp.secuencia(p_base text) returns jsonb language plpgsql as $$
declare
  v_pasos jsonb := '[]';
  v_r jsonb;
  v_x1 uuid;
  v_x3 uuid;
  v_y1 uuid;
begin
  v_r := pg_temp.cobro(p_base, 'x', 300);
  v_x1 := (v_r ->> 'receipt_id')::uuid;
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X cobro 300', 'x', v_r);
  v_r := pg_temp.rpc(p_base, format('public.identify_collection_receipt(%L, %L)',
    pg_temp.id('sinref'), pg_temp.id('x')));
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X identificación 200', 'x', v_r);
  v_r := pg_temp.cobro(p_base, 'x', 500);
  v_x3 := (v_r ->> 'receipt_id')::uuid;
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X cobro 500', 'x', v_r);
  v_r := pg_temp.rpc(p_base, format($q$public.void_collection_receipt(%L, 'Anulación sintética 0488')$q$, v_x1));
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X anula el cobro de 300', 'x', v_r);
  v_r := pg_temp.rpc(p_base, format($q$public.void_collection_receipt(%L, 'Anulación sintética 0488')$q$,
    pg_temp.id('sinref')));
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X anula la identificación', 'x', v_r);
  v_r := pg_temp.rpc(p_base, format($q$public.void_collection_receipt(%L, 'Anulación sintética 0488')$q$, v_x3));
  v_pasos := v_pasos || pg_temp.paso(p_base, 'X anula el cobro de 500', 'x', v_r);
  v_r := pg_temp.cobro(p_base, 'y', 1000);
  v_y1 := (v_r ->> 'receipt_id')::uuid;
  v_pasos := v_pasos || pg_temp.paso(p_base, 'Y cobro 1000', 'y', v_r);
  v_r := pg_temp.rpc(p_base, format($q$public.void_collection_receipt(%L, 'Anulación sintética 0488')$q$, v_y1));
  v_pasos := v_pasos || pg_temp.paso(p_base, 'Y anula el cobro', 'y', v_r);
  return v_pasos;
end;
$$;

do $sellada$
declare
  v_base text;
  v_conn text;
  v_pasos jsonb := '{}';
  v_sello_x text;
  v_sello_y text;
  v_restos text;
begin
  foreach v_base in array array['con', 'sin'] loop
    -- Base propia desde template0: nada de lo que otro archivo deje en template1.
    perform dblink_exec(pg_temp.conn('postgres', 'admin'),
      format('drop database if exists %I with (force)', 'dtd_sellada_' || v_base));
    perform dblink_exec(pg_temp.conn('postgres', 'admin'),
      format('create database %I template template0', 'dtd_sellada_' || v_base));
    perform dblink_connect('csel_' || v_base || '_s', pg_temp.conn('dtd_sellada_' || v_base, v_base || '_s'));
    perform dblink_connect('csel_' || v_base || '_a', pg_temp.conn('dtd_sellada_' || v_base, v_base || '_a'));
    perform dblink_exec('csel_' || v_base || '_s', pg_temp.fixture(v_base = 'con'));
    perform pg_temp.afirmar(pg_temp.ver(v_base, $q$select row(to_regclass('public.client_billing_identities') is not null,
        to_regprocedure('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)')
          is not null)::text$q$) = row(v_base = 'con', true)::text,
      format('la base %s tiene que tener la 0467, y la 0466 sólo si es la base con', v_base));
    v_conn := 'csel_' || v_base || '_a';
    perform dblink_exec(v_conn, $t$set statement_timeout = '30s'$t$);
    perform dblink_exec(v_conn, 'set role authenticated');
    perform * from dblink(v_conn, format($q$select set_config('request.jwt.claim.sub', %L, false)$q$,
      pg_temp.id('user'))) as t(x text);

    -- Con la 0466 el cliente tiene su empresa y la prefiere.
    if v_base = 'con' then
      perform dblink_exec('csel_con_s', format($q$insert into public.client_billing_identities
          (tenant_id, client_id, kind, legal_name, doc, fiscal_address, is_billing_default)
        values (%L, %L, 'empresa', 'Importadora Pérez C.A.', 'J-12345678-9',
          'Av. Bolívar Norte, local 14, Valencia', true)$q$, pg_temp.id('tenant'), pg_temp.id('client')));
    end if;
    -- X se emite directo; Y pasa por el borrador, que en `con` elige la persona.
    perform dblink_exec('csel_' || v_base || '_s', format($q$insert into public.invoices (id, tenant_id,
        invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency,
        fund_class)
      values (%1$L, %3$L, 'F-SELLO-X', 'SELLO', 'Escrito a mano', 1000, 1000, 0, 'emitida', 'USD', 'third_party'),
        (%2$L, %3$L, 'F-SELLO-Y', 'SELLO', 'Escrito a mano', 1000, 1000, 0, 'borrador', 'USD', 'third_party')$q$,
      pg_temp.id('x'), pg_temp.id('y'), pg_temp.id('tenant')));
    if v_base = 'con' then
      perform dblink_exec('csel_con_s', format($q$update public.invoices set bill_to_kind = 'persona'
        where id = %L$q$, pg_temp.id('y')));
    end if;
    perform dblink_exec('csel_' || v_base || '_s', format($q$update public.invoices set status = 'emitida'
      where id = %L$q$, pg_temp.id('y')));
    perform dblink_exec('csel_' || v_base || '_s', format($q$insert into public.payment_receipts (id, tenant_id,
        receipt_code, amount, currency, method, cash_account_id, received_at, application_status, fund_class)
      values (%L, %L, 'R-SEED-SELLO', 200, 'USD', 'transferencia', %L, current_date - 3, 'recibido_sin_ref',
        'third_party')$q$, pg_temp.id('sinref'), pg_temp.id('tenant'), pg_temp.id('cash')));

    if v_base = 'con' then
      v_sello_x := pg_temp.titular('x');
      v_sello_y := pg_temp.titular('y');
      perform pg_temp.afirmar(v_sello_x = row('Importadora Pérez C.A.', 'J-12345678-9', 'empresa',
          'Av. Bolívar Norte, local 14, Valencia', null::text)::text
        and v_sello_y = row('Ana Pérez', 'V-12345678', 'persona', null::text, 'persona')::text,
        format('la 0466 tiene que sellar X con la empresa preferida e Y con la persona del borrador: X %s, Y %s',
          v_sello_x, v_sello_y));
      perform pg_temp.afirmar(pg_temp.ver('con', format($q$select count(*)::text from public.entity_audit_log
          where entity_id = %L and event_type = 'invoice_bill_to_overridden'$q$, pg_temp.id('y'))) = '1',
        'la emisión de Y tiene que auditar su override');
      -- Ya emitidas: si algo volviera a sellar, el titular cambiaría.
      perform dblink_exec('csel_con_s', format($q$update public.client_billing_identities
        set legal_name = 'Importadora Pérez & Hijos C.A.', fiscal_address = 'Calle Nueva 45, Valencia'
        where client_id = %L$q$, pg_temp.id('client')));
    end if;
    perform dblink_exec('csel_' || v_base || '_s', format($q$update public.clients set name = 'Ana María Pérez'
      where id = %L$q$, pg_temp.id('client')));

    v_pasos := v_pasos || jsonb_build_object(v_base, pg_temp.secuencia(v_base));
  end loop;

  -- Las transiciones, iguales con la 0466 y sin ella.
  perform pg_temp.afirmar(
    (select jsonb_agg(p.value - 'titular_x' - 'titular_y' order by p.ordinality)
     from jsonb_array_elements(v_pasos -> 'con') with ordinality p) = v_pasos -> 'sin',
    format('las transiciones tienen que ser las mismas con la 0466 y sin ella: con %s; sin %s',
      v_pasos -> 'con', v_pasos -> 'sin'));
  perform pg_temp.afirmar(
    (select jsonb_agg(p.value -> 'factura' order by p.ordinality)
     from jsonb_array_elements(v_pasos -> 'sin') with ordinality p)
      = '["(parcial,300.00)", "(parcial,500.00)", "(pagada,1000.00)", "(parcial,700.00)", "(parcial,500.00)",
          "(emitida,0.00)", "(pagada,1000.00)", "(emitida,0.00)"]'::jsonb,
    format('la secuencia tiene que recorrer parcial, pagada y la vuelta a emitida: %s', v_pasos -> 'sin'));
  -- Con la 0466, el titular de las dos facturas no se mueve en ningún paso.
  perform pg_temp.afirmar(not exists (select from jsonb_array_elements(v_pasos -> 'con') p
      where p ->> 'titular_x' is distinct from v_sello_x or p ->> 'titular_y' is distinct from v_sello_y),
    format('el titular tiene que quedar como se selló en cada paso (X %s, Y %s): %s',
      v_sello_x, v_sello_y, v_pasos -> 'con'));
  perform pg_temp.afirmar(pg_temp.ver('con', format($q$select count(*)::text from public.entity_audit_log
      where entity_id = %L and event_type = 'invoice_bill_to_overridden'$q$, pg_temp.id('x'))) = '0'
    and pg_temp.ver('con', format($q$select count(*)::text from public.entity_audit_log
      where entity_id = %L and event_type = 'invoice_bill_to_overridden'$q$, pg_temp.id('y'))) = '1',
    'las RPC de Cobranzas no pueden auditar un override nuevo');
  perform pg_temp.afirmar(pg_temp.ver('con', format($q$select string_agg(distinct client_name, ',')
      from public.payment_receipts where invoice_id = %L$q$, pg_temp.id('x'))) = 'Importadora Pérez C.A.',
    'los recibos de X tienen que llevar el nombre sellado');

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0467 sellada OK: % aserciones; las RPC de Cobranzas no tocan el titular sellado por la 0466 y transitan igual que sin ella',
    currval('pg_temp.sellada_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0467 sellada: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$sellada$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname in ('dtd_sellada_con', 'dtd_sellada_sin'))
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0467 sellada dejó huella en el clúster';
  end if;
end;
$sin_huella$;
