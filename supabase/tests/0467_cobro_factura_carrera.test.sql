\set ON_ERROR_STOP on

-- Contrato de concurrencia de la migr 0467 (SDD-0488): cobrar, identificar y
-- anular un recibo, y confirmar un reporte de pago, sobre la misma factura y a
-- la vez, no pierden ninguna suma. Base propia y desechable dentro del
-- contenedor del runner: nunca consulta ni modifica una base alojada.
--
-- POR QUÉ: la 0467 toma el recibo y la factura FOR UPDATE antes de leer el
-- saldo, y un lock consultivo del tenant antes de sacar el código R-. El
-- contrato 0467_cobro_factura_atomico.test.sql corre en una sola sesión y sólo
-- cuenta los FOR UPDATE: la carrera real vivía en scripts/qa/cobro-factura-race.mjs,
-- que no corre en verify.
--
-- CÓMO: igual que los otros archivos de carrera (0421, 0426, 0427, 0459, 0460
-- y 0464). El archivo corre en la base `postgres` del runner y, con dblink,
-- abre tres sesiones contra una base propia (dtd_carrera_0467): `s` prepara y
-- observa; `a` (S1) corre la primera operación hasta su pausa, y `b` (S2)
-- corre la segunda entera, en asíncrono. S2 termina o queda esperando a S1,
-- según pg_blocking_pids: no hay sleep que calibrar. Recién entonces S1 sigue.
--
-- Los 13 escenarios del script, dos veces en la misma corrida:
--   ANTES (sin la 0467): S1 y S2 repiten, petición por petición, lo que hacía
--   lib/studio/collections-actions.ts por PostgREST. Cada petición es su
--   propia transacción, y lo leído viaja entre ellas como en la app. La pausa
--   de S1 cae entre su lectura y su escritura. Cada escenario tiene que
--   reproducir la pérdida (el 8, que S1 muera por el código R- repetido): si un
--   control no reproduce, el archivo falla y el verde nunca sale vacío.
--   DESPUÉS (con la 0467 aplicada encima, entera): las mismas carreras con las
--   RPC. S2 tiene que esperar a S1, sale el rechazo esperado, y en cada factura
--   paid_amount = recibos vigentes + reportes confirmados, sin pasar el total.
-- La confirmación de un reporte es la de la 0421 más la 0464 en las dos fases.
-- Los escenarios 12 y 13 prueban que la regla de saldo del cobro y la de la
-- confirmación (0464, SDD-0484) son la misma y se serializan en la factura.
--
-- FIXTURE: la unión de los fixtures de los contratos 0467 y 0421. Lo de
-- plataforma sale del contrato 0467, leído de su archivo con pg_read_file:
-- roles, auth, tenants, membresías, get_user_tenant_id con el cuerpo de la 0453
-- (el que exige el preflight de la 0467) y los cascarones de Tesorería. Lo que
-- la 0421 necesita y la 0467 no trae (Storage, clients y el markbox de
-- shipments) va copiado de su contrato. Las migraciones son las que los dos
-- contratos incluyen con `\ir`, sin repetir y en orden de número; después van la
-- 0421 y la 0464, como en producción. Encima, la semilla del script: un tenant,
-- un usuario de contabilidad con una sola membresía y una cuenta de caja.
--
-- SIN HUELLA, como en los otros archivos de carrera: la base propia y los roles
-- anon, authenticated y service_role (el fixture los nombra, así que no pueden
-- llamarse de otra forma) se borran también cuando algo falla, antes de
-- propagar el error. dblink se crea dentro de la transacción del archivo y se va
-- con el rollback. El cierre comprueba que no quedó nada.
--
-- RED (mutantes de la 0467 fuera del repo, ver .agents/handoffs/0488-carrera-cobro-0467.md):
-- cada uno de los cinco FOR UPDATE de la 0467, quitado de a uno, hace fallar
-- escenarios de la fase DESPUÉS. El mensaje dice cuáles.
--
-- Límite: requiere dblink (contrib de la imagen postgres:17) y el montaje /sb
-- del runner. No corre en CI, porque scripts/__tests__/ci-workflow-contract.test.mjs
-- deja Docker fuera, como al resto de supabase/tests.

begin;

do $guard$
begin
  -- Un clúster que ya tiene los roles de Supabase no es desechable: no se toca.
  if exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'TEST 0467 carrera requiere un clúster desechable: ya existen roles de Supabase';
  end if;
end;
$guard$;

-- Sólo dentro de esta transacción: el rollback del final lo retira.
create extension dblink;

create temporary sequence carrera_aserciones;

create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0467 carrera: %', p_msg; end if;
  perform nextval('pg_temp.carrera_aserciones');
end;
$$;

-- Conexión local por socket, como la del runner: sin contraseña y sin red.
create function pg_temp.conn(p_base text, p_sesion text) returns text language sql as $$
  select format('host=%s port=%s dbname=%s user=%s application_name=dtd_carrera_0467_%s',
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
    if v_conn like 'c0467\_%' then
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
      'drop database if exists dtd_carrera_0467 with (force)');
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
    raise exception 'TEST 0467 carrera: no encuentro la región del fixture en %', p_contrato;
  end if;
  foreach v_linea in array string_to_array(
      substr(v_txt, v_ini + length(p_desde), v_fin - v_ini - length(p_desde)), E'\n') loop
    if v_linea ~ '^\\if :[a-z_]+\s*$' then
      v_var := substring(v_linea from '^\\if :([a-z_]+)');
      if not p_vars ? v_var then
        raise exception 'TEST 0467 carrera: % usa :% y no tiene valor', p_contrato, v_var;
      end if;
      v_padres := v_padres || v_activo;
      v_conds := v_conds || (p_vars ->> v_var)::boolean;
      v_activo := v_activo and (p_vars ->> v_var)::boolean;
    elsif v_linea ~ '^\\(else|endif)\s*$' then
      if cardinality(v_padres) = 0 then
        raise exception 'TEST 0467 carrera: % tiene un % sin \if en la región', p_contrato, v_linea;
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
      raise exception 'TEST 0467 carrera: % trae un meta-comando de psql que no sé expandir: %',
        p_contrato, v_linea;
    elsif v_activo then
      v_salida := v_salida || v_linea;
    end if;
  end loop;
  if cardinality(v_padres) <> 0 then
    raise exception 'TEST 0467 carrera: % deja un \if sin cerrar en la región', p_contrato;
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
    raise exception 'TEST 0467 carrera: no encuentro dónde siembra su fixture %', p_contrato;
  end if;
  select array_agg(m[1] order by m[1]) into v_lista
  from regexp_matches(substr(v_txt, 1, v_fin), '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)\s*$', 'gn') m;
  if coalesce(cardinality(v_lista), 0) = 0 then
    raise exception 'TEST 0467 carrera: % no incluye migraciones antes de su fixture', p_contrato;
  end if;
  return v_lista;
end;
$$;

-- Un id sintético estable por etiqueta.
create function pg_temp.id(p_label text) returns uuid language sql immutable as $$
  select md5('0488-carrera-' || p_label)::uuid
$$;

-- La unión de los dos fixtures, con la 0421 y la 0464 aplicadas y la semilla,
-- en UNA transacción explícita: si algo falla, no queda ni un rol.
create function pg_temp.fixture() returns text language plpgsql as $fx$
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
  -- Lo que la 0421 necesita y la 0467 no trae, copiado del contrato 0421.
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
  -- La semilla del script (scripts/qa/cobro-factura-race.seed.sql), sin
  -- user_profiles: en este fixture user_tenants apunta sólo a auth.users.
  v_partes := v_partes || format($seed$
insert into auth.users (id, email) values (%1$L, 'contabilidad-0488@carrera.invalid');
insert into public.tenants (id, slug, display_name)
  values (%2$L, 'carrera-0488', 'Tenant sintético de la carrera 0488');
insert into public.user_tenants (user_id, tenant_id, role) values (%1$L, %2$L, 'accounting');
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
  values (%3$L, %2$L, '1.1.1.1', 'Banco sintético 0488', 'A', true);
$seed$, pg_temp.id('user'), pg_temp.id('tenant'), pg_temp.id('cash'));
  return array_to_string(v_partes || 'commit;'::text, E'\n');
end;
$fx$;

-- Lo que devuelve una consulta de observación en `s`.
create function pg_temp.ver(p_sql text) returns text language sql as $$
  select r from dblink('c0467_s', p_sql) as t(r text)
$$;

-- ── Semillas por escenario (en `s`, como el script) ──────────
create function pg_temp.factura(p_id uuid, p_codigo text, p_total numeric default 1000,
  p_pagado numeric default 0, p_estado text default 'emitida') returns void language plpgsql as $$
begin
  perform dblink_exec('c0467_s', format($q$insert into public.invoices (id, tenant_id, invoice_code,
      client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency, fund_class)
    values (%L, %L, %L, 'DTD-0488', 'Cliente sintético 0488', %s, %s, %s, %L, 'USD', 'third_party')$q$,
    p_id, pg_temp.id('tenant'), p_codigo, p_total, p_total, p_pagado, p_estado));
end;
$$;

-- Con factura, aplicado; sin factura, un pago sin referencia.
create function pg_temp.recibo(p_id uuid, p_codigo text, p_factura uuid, p_monto numeric) returns void
language plpgsql as $$
begin
  perform dblink_exec('c0467_s', format($q$insert into public.payment_receipts (id, tenant_id, receipt_code,
      invoice_id, client_markbox, client_name, amount, currency, method, cash_account_id, received_at,
      application_status, fund_class)
    values (%L, %L, %L, %L, %L, %L, %s, 'USD', 'transferencia', %L, current_date - 3, %L, 'third_party')$q$,
    p_id, pg_temp.id('tenant'), p_codigo, p_factura,
    case when p_factura is not null then 'DTD-0488' end,
    case when p_factura is not null then 'Cliente sintético 0488' end,
    p_monto, pg_temp.id('cash'),
    case when p_factura is not null then 'aplicado' else 'recibido_sin_ref' end));
end;
$$;

create function pg_temp.reporte_pendiente(p_id uuid, p_factura uuid, p_monto numeric) returns void
language plpgsql as $$
begin
  perform dblink_exec('c0467_s', format($q$insert into public.payment_reports (id, tenant_id, invoice_id,
      invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
    select %1$L, i.tenant_id, i.id, i.invoice_code, i.client_markbox, %2$s, i.currency, 'transferencia',
      current_date - 1, 'Reporte sintético 0488',
      i.tenant_id::text || '/' || i.id::text || '/' || %1$L || '/comprobante.pdf'
    from public.invoices i where i.id = %3$L$q$, p_id, p_monto, p_factura));
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

-- Una RPC: S1 la deja con la transacción abierta y sus locks tomados; la pausa
-- es antes del COMMIT.
create function pg_temp.atomica(p_llamada text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'atomica', 'antes', 'select (' || p_llamada || ')::text',
    'despues', 'commit', 'completa', E'do $p$\nbegin\nperform ' || p_llamada || E';\nend\n$p$')
$$;

-- collections-actions.ts antes de la SDD-0488: lee la factura, saca el código,
-- inserta el recibo y escribe paid_amount ABSOLUTO (lo leído más el monto).
create function pg_temp.cobro_viejo(p_k text, p_factura uuid, p_monto numeric, p_pausa_en_codigo boolean)
returns jsonb language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
  v_lectura text := format($q$perform set_config(%L, paid_amount::text, false),
      set_config(%L, total_amount::text, false), set_config(%L, tenant_id::text, false),
      set_config(%L, client_markbox, false), set_config(%L, client_name, false)
    from public.invoices where id = %L;$q$,
    v_g || 'paid', v_g || 'total', v_g || 'tenant', v_g || 'markbox', v_g || 'name', p_factura);
  v_codigo text := format($q$perform set_config(%L, public.next_receipt_code(current_setting(%L)::uuid), false);$q$,
    v_g || 'code', v_g || 'tenant');
  v_recibo text := format($q$insert into public.payment_receipts (tenant_id, receipt_code, invoice_id,
      client_markbox, client_name, amount, currency, method, cash_account_id, received_at,
      application_status, fund_class)
    values (current_setting(%1$L)::uuid, current_setting(%2$L), %3$L, current_setting(%4$L),
      current_setting(%5$L), %6$s, 'USD', 'transferencia', %7$L, current_date, 'aplicado', 'third_party');$q$,
    v_g || 'tenant', v_g || 'code', p_factura, v_g || 'markbox', v_g || 'name', p_monto, pg_temp.id('cash'));
  v_factura text := format($q$update public.invoices
    set paid_amount = round(current_setting(%1$L)::numeric + %2$s, 2),
      status = (case when round(current_setting(%1$L)::numeric + %2$s, 2) >= current_setting(%3$L)::numeric
        then 'pagada' else 'parcial' end)::public.invoice_status,
      last_payment_at = now()
    where id = %4$L;$q$, v_g || 'paid', p_monto, v_g || 'total', p_factura);
begin
  if p_pausa_en_codigo then
    return pg_temp.vieja(array[v_lectura, v_codigo], array[v_recibo, v_factura]);
  end if;
  return pg_temp.vieja(array[v_lectura], array[v_codigo, v_recibo, v_factura]);
end;
$$;

-- Lee el recibo, lo anula con el wrapper de la 0294 y, si tenía factura, lee
-- su pagado y lo baja. Sin factura (un sin-ref) la app sólo anulaba el recibo:
-- las dos peticiones de la factura no encuentran fila y no tocan nada.
create function pg_temp.anulacion_vieja(p_k text, p_recibo uuid) returns jsonb language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
begin
  return pg_temp.vieja(array[
    format($q$perform set_config(%L, coalesce(invoice_id::text, ''), false), set_config(%L, amount::text, false)
      from public.payment_receipts where id = %L;$q$, v_g || 'invoice', v_g || 'amount', p_recibo),
    format($q$perform public.void_payment_receipt_with_audit_reason(%L, 'Anulación de la carrera 0488');$q$,
      p_recibo),
    format($q$perform set_config(%L, paid_amount::text, false) from public.invoices
      where id = nullif(current_setting(%L), '')::uuid;$q$, v_g || 'paid', v_g || 'invoice')
  ], array[
    format($q$update public.invoices
      set paid_amount = greatest(0, round(current_setting(%1$L)::numeric - current_setting(%2$L)::numeric, 2)),
        status = (case when greatest(0, round(current_setting(%1$L)::numeric - current_setting(%2$L)::numeric, 2)) <= 0
          then 'emitida' else 'parcial' end)::public.invoice_status
      where id = nullif(current_setting(%3$L), '')::uuid;$q$, v_g || 'paid', v_g || 'amount', v_g || 'invoice')
  ]);
end;
$$;

-- Lee el sin-ref y la factura, y después aplica el recibo y suma su monto.
create function pg_temp.identificacion_vieja(p_k text, p_recibo uuid, p_factura uuid) returns jsonb
language plpgsql as $$
declare
  v_g text := 'carrera.' || p_k || '_';
begin
  return pg_temp.vieja(array[
    format($q$perform set_config(%L, amount::text, false) from public.payment_receipts
      where id = %L and application_status = 'recibido_sin_ref' and deleted_at is null;$q$,
      v_g || 'amount', p_recibo),
    format($q$perform set_config(%L, paid_amount::text, false), set_config(%L, total_amount::text, false),
        set_config(%L, client_markbox, false), set_config(%L, client_name, false)
      from public.invoices where id = %L;$q$,
      v_g || 'paid', v_g || 'total', v_g || 'markbox', v_g || 'name', p_factura)
  ], array[
    format($q$update public.payment_receipts
      set invoice_id = %L, client_markbox = current_setting(%L), client_name = current_setting(%L),
        application_status = 'aplicado', identified_at = now(), fund_class = 'third_party'
      where id = %L;$q$, p_factura, v_g || 'markbox', v_g || 'name', p_recibo),
    format($q$update public.invoices
      set paid_amount = round(current_setting(%1$L)::numeric + current_setting(%2$L)::numeric, 2),
        status = (case when round(current_setting(%1$L)::numeric + current_setting(%2$L)::numeric, 2)
          >= current_setting(%3$L)::numeric then 'pagada' else 'parcial' end)::public.invoice_status,
        last_payment_at = now()
      where id = %4$L;$q$, v_g || 'paid', v_g || 'amount', v_g || 'total', p_factura)
  ]);
end;
$$;

-- En ANTES la app vieja; en DESPUÉS, la RPC de la 0467.
create function pg_temp.cobro(p_fase text, p_k text, p_factura uuid, p_monto numeric,
  p_pausa_en_codigo boolean default false) returns jsonb language sql as $$
  select case when p_fase = 'antes' then pg_temp.cobro_viejo(p_k, p_factura, p_monto, p_pausa_en_codigo)
    else pg_temp.atomica(format($q$public.register_collection_receipt(%L, %s, %L, 'transferencia',
      current_date, null, null, 'cliente', null, null, false)$q$, p_factura, p_monto, pg_temp.id('cash'))) end
$$;

create function pg_temp.anulacion(p_fase text, p_k text, p_recibo uuid) returns jsonb language sql as $$
  select case when p_fase = 'antes' then pg_temp.anulacion_vieja(p_k, p_recibo)
    else pg_temp.atomica(format($q$public.void_collection_receipt(%L, 'Anulación de la carrera 0488')$q$,
      p_recibo)) end
$$;

create function pg_temp.identificacion(p_fase text, p_k text, p_recibo uuid, p_factura uuid) returns jsonb
language sql as $$
  select case when p_fase = 'antes' then pg_temp.identificacion_vieja(p_k, p_recibo, p_factura)
    else pg_temp.atomica(format($q$public.identify_collection_receipt(%L, %L)$q$, p_recibo, p_factura)) end
$$;

-- La confirmación de un reporte (0421 + 0464) es la misma en las dos fases.
create function pg_temp.confirmacion(p_solicitud uuid, p_reporte uuid) returns jsonb language sql as $$
  select pg_temp.atomica(format($q$public.resolve_payment_report(%L::uuid, %L::uuid, 'confirmado',
    'Confirmación de la carrera 0488')$q$, p_solicitud, p_reporte))
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
  select pid into v_a from dblink('c0467_a', 'select pg_backend_pid()') as t(pid integer);
  select pid into v_b from dblink('c0467_b', 'select pg_backend_pid()') as t(pid integer);
  -- Los errores de las sesiones son resultados esperados en varios casos: se
  -- guardan, no se reenvían como avisos.
  perform set_config('client_min_messages', 'warning', true);
  if p_1 ->> 'tipo' = 'vieja' then
    if dblink_exec('c0467_a', p_1 ->> 'antes', false) = 'ERROR' then
      v_error_1 := dblink_error_message('c0467_a');
    end if;
  else
    perform dblink_exec('c0467_a', 'begin');
    select r into v_r from dblink('c0467_a', p_1 ->> 'antes', false) as t(r text);
    if v_r is null then
      v_error_1 := dblink_error_message('c0467_a');
      perform dblink_exec('c0467_a', 'rollback');
    end if;
  end if;
  if v_error_1 is not null then
    -- S1 no llegó a su pausa: no hubo carrera.
    perform set_config('client_min_messages', v_avisos, true);
    return jsonb_build_object('espero', false, 'pausa', false, 'error_1', v_error_1);
  end if;

  perform pg_temp.afirmar(dblink_send_query('c0467_b', p_2 ->> 'completa') = 1,
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
    exit when dblink_is_busy('c0467_b') = 0;
    if clock_timestamp() > v_limite then
      raise exception 'TEST 0467 carrera: la segunda sesión ni terminó ni quedó esperando en 20 s';
    end if;
    perform pg_sleep(0.01);
  end loop;

  if p_1 ->> 'tipo' = 'vieja' then
    if dblink_exec('c0467_a', p_1 ->> 'despues', false) = 'ERROR' then
      v_error_1 := dblink_error_message('c0467_a');
    end if;
  else
    perform dblink_exec('c0467_a', 'commit');
  end if;
  select r into v_r from dblink_get_result('c0467_b', false) as t(r text);
  if v_r is null then
    v_error_2 := dblink_error_message('c0467_b');
  end if;
  perform * from dblink_get_result('c0467_b', false) as t(r text);  -- cierre del resultado asíncrono
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
  if dblink_is_busy('c0467_b') = 1 then
    perform dblink_cancel_query('c0467_b');
  end if;
  perform * from dblink_get_result('c0467_b', false) as t(r text);
  perform * from dblink_get_result('c0467_b', false) as t(r text);
  perform dblink_exec('c0467_b', 'rollback', false);
  perform dblink_exec('c0467_a', 'rollback', false);
  perform set_config('client_min_messages', v_avisos, true);
end;
$$;

-- Las facturas del escenario, vistas desde `s`, con lo que las explica.
create function pg_temp.facturas(p_ids uuid[]) returns jsonb language sql as $$
  select pg_temp.ver(format($q$select coalesce(jsonb_agg(jsonb_build_object(
      'codigo', i.invoice_code, 'pagado', i.paid_amount, 'total', i.total_amount, 'estado', i.status,
      'recibos', (select coalesce(sum(r.amount), 0) from public.payment_receipts r
                  where r.invoice_id = i.id and r.deleted_at is null),
      'codigos', (select coalesce(jsonb_agg(r.receipt_code order by r.receipt_code), '[]') from public.payment_receipts r
                  where r.invoice_id = i.id and r.deleted_at is null and r.receipt_code not like 'R-SEED-%%'),
      'reportes', (select coalesce(sum(p.amount), 0) from public.payment_reports p
                   where p.invoice_id = i.id and p.status = 'confirmado'))
    order by i.invoice_code), '[]')::text from public.invoices i where i.id = any (%L::uuid[])$q$, p_ids))::jsonb
$$;

-- ── Escenarios (los del script, con sus montos) ──────────────
create function pg_temp.nombre(p_n integer) returns text language sql immutable as $$
  select (array[
    'cobro → cobro, misma factura',
    'cobro → cobro, entre los dos superan el saldo',
    'cobro → confirmación de reporte',
    'confirmación de reporte → cobro',
    'anulación → cobro',
    'anulación → confirmación de reporte',
    'identificación → identificación del mismo pago en otra factura',
    'cobro → cobro en otra factura del mismo tenant (código R-)',
    'cobro → identificación en la misma factura',
    'identificación → anulación del mismo pago',
    'cobro → anulación en la misma factura',
    'cobro → confirmación que ya no cabe en el saldo (0464)',
    'confirmación → cobro que ya no cabe en el saldo (0464)'])[p_n]
$$;

-- El rechazo que S2 tiene que recibir con la 0467, si lo hay.
create function pg_temp.rechazo(p_n integer) returns text language sql immutable as $$
  select case p_n when 2 then 'PAYMENT_EXCEEDS_BALANCE' when 7 then 'PAYMENT_RECEIPT_APPLIED'
    when 12 then 'PAYMENT_EXCEEDS_BALANCE' when 13 then 'PAYMENT_EXCEEDS_BALANCE' end
$$;

create function pg_temp.escenario(p_fase text, p_n integer) returns jsonb language plpgsql as $$
declare
  v_p text := p_fase || '-' || p_n || '-';
  v_k text := p_fase || '_' || p_n || '_';
  v_inv uuid := pg_temp.id(v_p || 'inv');
  v_inv2 uuid := pg_temp.id(v_p || 'inv2');
  v_rec uuid := pg_temp.id(v_p || 'rec');
  v_rep uuid := pg_temp.id(v_p || 'rep');
  v_sol uuid := pg_temp.id(v_p || 'sol');
  v_ids uuid[] := array[v_inv];
  v_s1 jsonb;
  v_s2 jsonb;
begin
  case p_n
  when 1 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 300);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv, 200);
  when 2 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 600);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv, 600);
  when 3 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.reporte_pendiente(v_rep, v_inv, 200);
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 300);
    v_s2 := pg_temp.confirmacion(v_sol, v_rep);
  when 4 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.reporte_pendiente(v_rep, v_inv, 200);
    v_s1 := pg_temp.confirmacion(v_sol, v_rep);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv, 300);
  when 5 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv', 1000, 400, 'parcial');
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', v_inv, 400);
    v_s1 := pg_temp.anulacion(p_fase, v_k || 's1', v_rec);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv, 300);
  when 6 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv', 1000, 400, 'parcial');
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', v_inv, 400);
    perform pg_temp.reporte_pendiente(v_rep, v_inv, 200);
    v_s1 := pg_temp.anulacion(p_fase, v_k || 's1', v_rec);
    v_s2 := pg_temp.confirmacion(v_sol, v_rep);
  when 7 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.factura(v_inv2, 'F-' || v_p || 'inv2');
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', null, 800);
    v_ids := array[v_inv, v_inv2];
    v_s1 := pg_temp.identificacion(p_fase, v_k || 's1', v_rec, v_inv);
    v_s2 := pg_temp.identificacion(p_fase, v_k || 's2', v_rec, v_inv2);
  when 8 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.factura(v_inv2, 'F-' || v_p || 'inv2');
    v_ids := array[v_inv, v_inv2];
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 300, true);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv2, 200);
  when 9 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv', 2000);
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', null, 800);
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 300);
    v_s2 := pg_temp.identificacion(p_fase, v_k || 's2', v_rec, v_inv);
  when 10 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', null, 800);
    v_s1 := pg_temp.identificacion(p_fase, v_k || 's1', v_rec, v_inv);
    v_s2 := pg_temp.anulacion(p_fase, v_k || 's2', v_rec);
  when 11 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv', 1000, 400, 'parcial');
    perform pg_temp.recibo(v_rec, 'R-SEED-' || v_p || 'rec', v_inv, 400);
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 300);
    v_s2 := pg_temp.anulacion(p_fase, v_k || 's2', v_rec);
  when 12 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.reporte_pendiente(v_rep, v_inv, 200);
    v_s1 := pg_temp.cobro(p_fase, v_k || 's1', v_inv, 900);
    v_s2 := pg_temp.confirmacion(v_sol, v_rep);
  when 13 then
    perform pg_temp.factura(v_inv, 'F-' || v_p || 'inv');
    perform pg_temp.reporte_pendiente(v_rep, v_inv, 200);
    v_s1 := pg_temp.confirmacion(v_sol, v_rep);
    v_s2 := pg_temp.cobro(p_fase, v_k || 's2', v_inv, 900);
  end case;
  return pg_temp.carrera(v_s1, v_s2) || jsonb_build_object('facturas', pg_temp.facturas(v_ids));
end;
$$;

-- El invariante del script: en toda factura del escenario, pagado = recibos
-- vigentes + reportes confirmados, y pagado no pasa el total.
create function pg_temp.roto(p_r jsonb) returns boolean language sql immutable as $$
  select exists (select from jsonb_array_elements(p_r -> 'facturas') f
    where (f ->> 'pagado')::numeric <> (f ->> 'recibos')::numeric + (f ->> 'reportes')::numeric
       or (f ->> 'pagado')::numeric > (f ->> 'total')::numeric)
$$;

-- ANTES: la carrera tiene que perder algo (el 8: S1 muere por el código repetido).
create function pg_temp.reproduce(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select case when p_n = 8 then coalesce(p_r ->> 'error_1' ~ 'duplicate key|receipt_code', false)
    else (p_r ->> 'pausa')::boolean and pg_temp.roto(p_r) end
$$;

-- DESPUÉS: S2 esperó a S1, S1 no falló, S2 recibió el rechazo esperado (o
-- ninguno), el invariante se cumple y, en el 8, hay dos códigos R- distintos.
create function pg_temp.correcto(p_n integer, p_r jsonb) returns boolean language sql immutable as $$
  select (p_r ->> 'espero')::boolean and p_r ->> 'error_1' is null and not pg_temp.roto(p_r)
    and case when pg_temp.rechazo(p_n) is not null
          then coalesce(p_r ->> 'error_2' like '%' || pg_temp.rechazo(p_n) || '%', false)
          else p_r ->> 'error_2' is null end
    and (p_n <> 8 or (select count(*) = 2 and count(distinct c) = 2
      from jsonb_array_elements(p_r -> 'facturas') f, jsonb_array_elements_text(f -> 'codigos') c))
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
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'drop database if exists dtd_carrera_0467 with (force)');
  perform dblink_exec(pg_temp.conn('postgres', 'admin'), 'create database dtd_carrera_0467 template template0');
  perform dblink_connect('c0467_s', pg_temp.conn('dtd_carrera_0467', 's'));
  perform dblink_connect('c0467_a', pg_temp.conn('dtd_carrera_0467', 'a'));
  perform dblink_connect('c0467_b', pg_temp.conn('dtd_carrera_0467', 'b'));
  perform dblink_exec('c0467_s', pg_temp.fixture());
  -- S1 y S2 son el usuario de contabilidad, como las peticiones de la app.
  -- Nadie espera para siempre.
  foreach v_conn in array array['c0467_a', 'c0467_b'] loop
    perform dblink_exec(v_conn, $t$set statement_timeout = '30s'$t$);
    perform dblink_exec(v_conn, 'set role authenticated');
    perform * from dblink(v_conn, format($q$select set_config('request.jwt.claim.sub', %L, false)$q$,
      pg_temp.id('user'))) as t(x text);
  end loop;

  foreach v_fase in array array['antes', 'despues'] loop
    if v_fase = 'despues' then
      perform dblink_exec('c0467_s', pg_read_file('/sb/migrations/0467_cobro_factura_atomico.sql'));
    end if;
    for v_n in 1..13 loop
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
    format('controles ANTES que no reprodujeron la pérdida: %s; escenarios DESPUÉS que fallan: %s. %s',
      v_fallan -> 'antes', v_fallan -> 'despues', array_to_string(v_detalle, ' | ')));

  v_restos := pg_temp.limpiar();
  perform pg_temp.afirmar(v_restos is null, 'la limpieza dejó restos:' || coalesce(v_restos, ''));
  raise notice 'TEST 0467 carrera OK: % aserciones; los 13 escenarios pierden sin la 0467 y se serializan con ella',
    currval('pg_temp.carrera_aserciones');
exception when others or query_canceled or assert_failure then
  v_restos := pg_temp.limpiar();
  if v_restos is not null then
    raise warning 'TEST 0467 carrera: la limpieza tampoco pudo con todo:%', v_restos;
  end if;
  raise;
end;
$carrera$;

rollback;

-- Sin huella: nada de este archivo queda para los que corren después.
do $sin_huella$
begin
  if exists (select from pg_database where datname = 'dtd_carrera_0467')
     or exists (select from pg_roles where rolname in ('anon', 'authenticated', 'service_role'))
     or exists (select from pg_extension where extname = 'dblink') then
    raise exception 'TEST 0467 carrera dejó huella en el clúster';
  end if;
end;
$sin_huella$;
