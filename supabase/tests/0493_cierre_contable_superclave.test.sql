\set ON_ERROR_STOP on
-- SDD-0566 · Contrato de 0493: cierre contable con superclave y reporte de
-- excepciones. Fixture sintético aislado; no ejecutar sobre una DB real. Aplica
-- con \ir las migraciones REALES de contabilidad (0078) y cierre de período
-- (0133), y 0493; termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0493_cierre_contable_superclave.test.sql
--
-- Todo corre en UNA transacción (los contratos comparten la base): la
-- caducidad del permiso al cerrar la transacción se prueba con una excepción
-- de otro txid, que el trigger tiene que rechazar.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.journal_entries') is not null then
    raise exception 'TEST 0493: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth to authenticated, service_role;
grant usage on schema extensions to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- 0357: los desvíos de la matriz de módulos.
create table public.studio_role_module_overrides (
  tenant_id uuid not null references public.tenants(id), role text not null, module_id text not null,
  can_view boolean, can_edit boolean, primary key (tenant_id, role, module_id)
);
-- Plataforma legacy mínima de 0078, igual que los contratos 0467 y 0471.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
-- 0078 apunta a invoices desde journal_entries.
create table public.invoices (id uuid primary key, tenant_id uuid not null references public.tenants(id));

\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0133_period_close.sql
-- Como 0210 (y sus reparaciones 0275/0284/0287/0288): el search_path de los
-- triggers que el preflight de 0493 exige. Sin esto la base de prueba no sería
-- la de producción.
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
\if :apply_fix
\ir ../migrations/0493_cierre_contable_superclave.sql
\endif

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0493-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'commercial-A', 'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0493', 'Tenant A 0493'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0493', 'Tenant B 0493');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('admin-A', 'tenant-A', 'admin'), ('accounting-A', 'tenant-A', 'accounting'),
  ('commercial-A', 'tenant-A', 'commercial'), ('accounting-B', 'tenant-B', 'accounting')) v(u, t, r);

-- Cuentas sintéticas (0078 siembra solo los tenants que ya existían).
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fixture_id(v.l), pg_temp.fixture_id(v.t), v.code, 'CENTINELA', v.type::public.acct_type, v.postable
from (values
  ('caja-A', 'tenant-A', '1.1.1', 'A', true), ('ventas-A', 'tenant-A', '4.1', 'I', true),
  ('grupo-A', 'tenant-A', '1', 'A', false), ('caja-B', 'tenant-B', '1.1.1', 'A', true)) v(l, t, code, type, postable);

-- Asientos de enero, antes de cerrar (el trigger bloquearía después).
insert into public.journal_entries (id, tenant_id, entry_code, entry_date, status, source, posted_at)
select pg_temp.fixture_id(v.l), pg_temp.fixture_id('tenant-A'), v.code, v.d::date, v.s::public.entry_status, 'manual',
  case when v.s = 'asentado' then now() end
from (values
  ('e-asentado', 'A-2026-0001', '2026-01-10', 'asentado'),
  ('e-borrador', 'A-2026-0002', '2026-01-12', 'borrador'),
  ('e-borrador2', 'A-2026-0003', '2026-01-15', 'borrador'),
  ('e-bloqueo', 'A-2026-0004', '2026-01-20', 'borrador'),
  ('e-abierto', 'A-2026-0005', '2026-03-01', 'asentado')) v(l, code, d, s);
insert into public.journal_lines (entry_id, account_id, debit, credit)
select pg_temp.fixture_id(v.e), pg_temp.fixture_id(v.a), v.d, v.c
from (values
  ('e-asentado', 'caja-A', 100, 0), ('e-asentado', 'ventas-A', 0, 100),
  ('e-borrador', 'caja-A', 50, 0), ('e-borrador', 'ventas-A', 0, 50),
  ('e-borrador2', 'caja-A', 40, 0), ('e-borrador2', 'ventas-A', 0, 40),
  ('e-bloqueo', 'caja-A', 10, 0), ('e-bloqueo', 'ventas-A', 0, 10),
  ('e-abierto', 'caja-A', 30, 0), ('e-abierto', 'ventas-A', 0, 30)) v(e, a, d, c);

-- Se cierra enero. Como postgres: el historial queda sin usuario.
insert into public.accounting_settings (tenant_id, closing_date)
values (pg_temp.fixture_id('tenant-A'), '2026-01-31');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0493: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.as_actor(p_actor text, p_sql text, p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_actor)::text, ''), true);
  execute format('set local role %I', p_role);
  execute p_sql into v_result;
  reset role;
  return v_result;
exception when others then
  reset role;
  raise;
end;
$$;
-- El SQLSTATE de un intento que tiene que fallar ('ok' si no falló).
create function pg_temp.sqlstate_of(p_actor text, p_sql text) returns text language plpgsql as $$
declare v_state text;
begin
  perform pg_temp.as_actor(p_actor, p_sql);
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  return v_state;
end;
$$;
create function pg_temp.status_of(p_entry text) returns text language sql as $$
  select status::text from public.journal_entries where id = pg_temp.fixture_id(p_entry)
$$;
-- plpgsql y no sql: un cuerpo sql se valida al crearse y, sin 0493, el control
-- rojo fallaría acá y no en su primera aserción.
create function pg_temp.exceptions_of(p_entry text) returns bigint language plpgsql as $$
begin
  return (select count(*) from public.accounting_closing_exceptions where entry_id = pg_temp.fixture_id(p_entry));
end;
$$;
create function pg_temp.attempts() returns integer language plpgsql as $$
begin
  return (select failed_attempts from public.accounting_closing_secrets where tenant_id = pg_temp.fixture_id('tenant-A'));
end;
$$;

-- ── 0. La migración está (control rojo: sin 0493 falla acá) ──
select pg_temp.assert_true(to_regprocedure('public.anular_asiento_en_cierre(uuid,text,text)') is not null,
  'existe public.anular_asiento_en_cierre(uuid,text,text)');

-- ── 1. El modo nace en 'superclave' y la fecha queda en el historial ──
select pg_temp.assert_true(
  (select closing_mode from public.accounting_settings where tenant_id = pg_temp.fixture_id('tenant-A')) = 'superclave',
  'el modo por defecto es superclave');
select pg_temp.assert_true(exists (
  select 1 from public.accounting_closing_events
  where tenant_id = pg_temp.fixture_id('tenant-A') and kind = 'fecha_cambiada'
    and old_value is null and new_value = '2026-01-31'), 'cerrar enero queda en el historial');

-- ── 2. Sin superclave definida no se cambia nada, ni con la RPC ──
select pg_temp.assert_true(
  pg_temp.as_actor('accounting-A', format(
    'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-asentado'), 'cualquiera', 'Corrección de enero')) ->> 'motivo' = 'sin_superclave',
  'sin superclave la RPC devuelve sin_superclave');
select pg_temp.assert_true(pg_temp.status_of('e-asentado') = 'asentado', 'sin superclave el asiento sigue asentado');
select pg_temp.assert_true(pg_temp.exceptions_of('e-asentado') = 0, 'sin superclave no hay excepción');

-- ── 3. Un update directo y un set_config a mano no abren el período ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'update public.journal_entries set memo = ''x'' where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('e-asentado'))) = '23514', 'el update directo choca con el cierre');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'with g as (select set_config(''dtd.excepcion_cierre'', ''forjado'', true)) '
  || 'update public.journal_entries set memo = ''x'' from g where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('e-asentado'))) = '23514', 'un set_config a mano no alcanza');
select set_config('dtd.excepcion_cierre', '', true);

-- ── 4. Definir la superclave: solo admin, solo hash ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A',
  'select public.fijar_superclave_de_cierre(null, ''Clave-Segura-1'')') = '42501',
  'un no admin no define la superclave');
select pg_temp.assert_true(pg_temp.sqlstate_of('admin-A',
  'select public.fijar_superclave_de_cierre(null, ''corta'')') = '22023',
  'la superclave tiene al menos 8 caracteres');
select pg_temp.assert_true(pg_temp.sqlstate_of('admin-A',
  'select public.fijar_superclave_de_cierre(null, repeat(''ñ'', 40))') = '22023',
  'más de 72 bytes se rechaza: bcrypt ignoraría el resto');
select pg_temp.assert_true(
  (pg_temp.as_actor('admin-A', 'select public.fijar_superclave_de_cierre(null, ''Clave-Segura-1'')') ->> 'ok')::boolean,
  'el admin define la superclave');
select pg_temp.assert_true((select secret_hash like '$2%' and secret_hash <> 'Clave-Segura-1'
  from public.accounting_closing_secrets where tenant_id = pg_temp.fixture_id('tenant-A')),
  'la superclave queda como hash bcrypt');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events
  where kind = 'superclave_definida' and user_id = pg_temp.fixture_id('admin-A')), 'definirla queda en el historial');
select pg_temp.assert_true(pg_temp.sqlstate_of('admin-A',
  'select to_jsonb(s) from public.accounting_closing_secrets s limit 1') = '42501',
  'ni el admin lee la tabla de la superclave');
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', 'select public.estado_cierre_contable()') ->> 'superclave_definida')::boolean
  and not (pg_temp.as_actor('accounting-A', 'select public.estado_cierre_contable()') ? 'secret_hash'),
  'el estado dice que hay superclave, sin el hash');

-- ── 5. Las funciones internas y las tablas no se tocan desde la API ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select to_jsonb(public.cierre_verificar_superclave(%L::uuid, %L))',
  pg_temp.fixture_id('tenant-A'), 'Clave-Segura-1')) = '42501', 'la verificación interna no se llama desde la API');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select to_jsonb(public.autorizar_excepcion_al_cierre(%L::uuid, %L::uuid, ''x'', ''2026-01-10'', ''anular'', %L, ''motivo largo'', 0, 0))',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('e-asentado'), 'Clave-Segura-1')) = '42501',
  'la autorización interna no se llama desde la API');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'insert into public.accounting_closing_exceptions (tenant_id, entry_id, entry_code, entry_date, closing_date, '
  || 'operation, authorized_by, reason, amount_before, amount_after, nonce, txid) values '
  || '(%L::uuid, %L::uuid, ''x'', ''2026-01-10'', ''2026-01-31'', ''anular'', ''superclave'', ''forjada'', 0, 0, ''n'', 1) returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('e-asentado'))) = '42501', 'nadie inserta una excepción a mano');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A',
  'select to_jsonb(nonce) from public.accounting_closing_exceptions limit 1') = '42501', 'el nonce no se lee');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A',
  'insert into public.accounting_closing_events (tenant_id, kind) values ((select public.get_user_tenant_id()), ''fecha_cambiada'') returning to_jsonb(id)') = '42501',
  'nadie escribe el historial a mano');

-- ── 6. Clave mala: no cambia nada, pero el intento queda y cuenta ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)', pg_temp.fixture_id('e-asentado'), 'mala', 'ab')) = '22023',
  'un motivo inválido se rechaza antes de mirar la clave');
select pg_temp.assert_true(pg_temp.attempts() = 0, 'un motivo inválido no gasta un intento');
select pg_temp.assert_true(
  pg_temp.as_actor('accounting-A', format(
    'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-asentado'), 'Clave-Mala-99', 'Corrección de enero')) ->> 'motivo' = 'incorrecta',
  'la clave mala devuelve incorrecta, sin lanzar');
select pg_temp.assert_true(pg_temp.status_of('e-asentado') = 'asentado', 'con clave mala no se anula');
select pg_temp.assert_true(pg_temp.attempts() = 1, 'la clave mala suma un intento');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events
  where kind = 'intento_fallido' and user_id = pg_temp.fixture_id('accounting-A')), 'el intento queda en el historial');

-- ── 7. Clave buena: anula, deja la excepción y limpia el permiso ──
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-asentado'), 'Clave-Segura-1', 'Corrección de enero')) ->> 'ok')::boolean,
  'con la superclave se anula en período cerrado');
select pg_temp.assert_true(pg_temp.status_of('e-asentado') = 'anulado', 'el asiento queda anulado');
select pg_temp.assert_true(pg_temp.attempts() = 0, 'un acierto pone el contador en 0');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_exceptions
  where entry_id = pg_temp.fixture_id('e-asentado') and operation = 'anular' and authorized_by = 'superclave'
    and amount_before = 100 and amount_after = 0 and reason = 'Corrección de enero'
    and user_id = pg_temp.fixture_id('accounting-A') and closing_date = '2026-01-31' and entry_code = 'A-2026-0001'),
  'la excepción trae el antes, el después, el motivo y el usuario');
select pg_temp.assert_true(coalesce(current_setting('dtd.excepcion_cierre', true), '') = '', 'la RPC limpia el permiso');
-- El mismo asiento, en la misma transacción, sin el permiso: rechazado.
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'update public.journal_entries set memo = ''x'' where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('e-asentado'))) = '23514', 'sin el nonce, la excepción ya no sirve');

-- ── 8. El permiso no sirve para otro asiento ni en otra transacción ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'with g as (select set_config(''dtd.excepcion_cierre'', %L, true)) '
  || 'update public.journal_entries set memo = ''x'' from g where id = %L::uuid returning to_jsonb(id)',
  (select nonce from public.accounting_closing_exceptions where entry_id = pg_temp.fixture_id('e-asentado')),
  pg_temp.fixture_id('e-borrador'))) = '23514', 'el permiso de un asiento no abre otro');
insert into public.accounting_closing_exceptions (tenant_id, entry_id, entry_code, entry_date, closing_date,
  operation, authorized_by, reason, amount_before, amount_after, nonce, txid)
values (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('e-borrador'), 'A-2026-0002', '2026-01-12', '2026-01-31',
  'asentar', 'superclave', 'De otra transacción', 0, 50, 'n-viejo', txid_current() - 1);
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'with g as (select set_config(''dtd.excepcion_cierre'', ''n-viejo'', true)) '
  || 'update public.journal_entries set memo = ''x'' from g where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('e-borrador'))) = '23514', 'el permiso de otra transacción no sirve');
select set_config('dtd.excepcion_cierre', '', true);
delete from public.accounting_closing_exceptions where nonce = 'n-viejo';

-- ── 9. Asentar, eliminar y crear en período cerrado ──
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.asentar_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-borrador'), 'Clave-Segura-1', 'Faltaba asentar')) ->> 'ok')::boolean,
  'se asienta un borrador de período cerrado');
select pg_temp.assert_true(pg_temp.status_of('e-borrador') = 'asentado', 'el borrador queda asentado');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_exceptions
  where entry_id = pg_temp.fixture_id('e-borrador') and operation = 'asentar' and amount_before = 0 and amount_after = 50),
  'asentar registra 0 → 50');
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.eliminar_borrador_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-borrador2'), 'Clave-Segura-1', 'Borrador duplicado')) ->> 'ok')::boolean,
  'se elimina un borrador de período cerrado');
select pg_temp.assert_true((select deleted_at is not null from public.journal_entries where id = pg_temp.fixture_id('e-borrador2')),
  'el borrador queda eliminado');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_exceptions
  where entry_id = pg_temp.fixture_id('e-borrador2') and operation = 'eliminar' and amount_before = 40 and amount_after = 0),
  'eliminar registra 40 → 0');
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.crear_asiento_en_cierre(%L::jsonb, %L, %L)',
    jsonb_build_object('entry_date', '2026-01-20', 'memo', 'Ajuste de enero', 'asentar', true, 'lineas',
      jsonb_build_array(
        jsonb_build_object('account_id', pg_temp.fixture_id('caja-A'), 'debit', 75),
        jsonb_build_object('account_id', pg_temp.fixture_id('ventas-A'), 'credit', 75))),
    'Clave-Segura-1', 'Ajuste que faltaba')) ->> 'ok')::boolean,
  'se crea un asiento con fecha cerrada');
select pg_temp.assert_true(exists (select 1 from public.journal_entries e
  where e.memo = 'Ajuste de enero' and e.status = 'asentado' and e.entry_date = '2026-01-20'
    and (select count(*) from public.journal_lines l where l.entry_id = e.id) = 2), 'el asiento nuevo tiene sus dos líneas');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_exceptions
  where operation = 'crear' and amount_before = 0 and amount_after = 75), 'crear registra 0 → 75');

-- ── 10. Las guardas: entrada, rol y tenant ──
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select public.crear_asiento_en_cierre(%L::jsonb, %L, %L)',
  jsonb_build_object('entry_date', '2026-01-21', 'lineas', jsonb_build_array(
    jsonb_build_object('account_id', pg_temp.fixture_id('caja-A'), 'debit', 75),
    jsonb_build_object('account_id', pg_temp.fixture_id('ventas-A'), 'credit', 70))),
  'Clave-Segura-1', 'Descuadrado')) = '22023', 'un asiento descuadrado no se crea');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select public.crear_asiento_en_cierre(%L::jsonb, %L, %L)',
  jsonb_build_object('entry_date', '2026-01-21', 'lineas', jsonb_build_array(
    jsonb_build_object('account_id', pg_temp.fixture_id('caja-B'), 'debit', 5),
    jsonb_build_object('account_id', pg_temp.fixture_id('ventas-A'), 'credit', 5))),
  'Clave-Segura-1', 'Cuenta ajena')) = '22023', 'una cuenta de otro tenant no entra');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A', format(
  'select public.crear_asiento_en_cierre(%L::jsonb, %L, %L)',
  jsonb_build_object('entry_date', '2026-01-21', 'lineas', jsonb_build_array(
    jsonb_build_object('account_id', pg_temp.fixture_id('grupo-A'), 'debit', 5),
    jsonb_build_object('account_id', pg_temp.fixture_id('ventas-A'), 'credit', 5))),
  'Clave-Segura-1', 'Cuenta de grupo')) = '22023', 'una cuenta de grupo no recibe asientos');
select pg_temp.assert_true(pg_temp.sqlstate_of('commercial-A', format(
  'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
  pg_temp.fixture_id('e-borrador'), 'Clave-Segura-1', 'Sin permiso de edición')) = '42501',
  'quien no edita contabilidad no usa la excepción');
select pg_temp.assert_true(
  pg_temp.as_actor('accounting-B', format(
    'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-borrador'), 'Clave-Segura-1', 'Asiento de otro tenant')) ->> 'motivo' = 'no_encontrado',
  'un asiento de otro tenant no existe para la RPC');
select pg_temp.assert_true(
  pg_temp.as_actor('accounting-A', format(
    'select public.anular_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-abierto'), 'Clave-Segura-1', 'Período abierto')) ->> 'motivo' = 'no_cerrado',
  'un asiento de período abierto no usa la excepción');
select pg_temp.assert_true(pg_temp.status_of('e-abierto') = 'asentado', 'el asiento abierto no cambia');

-- ── 11. Cinco fallidos bloquean 15 minutos ──
do $bloqueo$
declare i integer;
begin
  for i in 1..5 loop
    perform pg_temp.assert_true(
      pg_temp.as_actor('accounting-A', format(
        'select public.asentar_asiento_en_cierre(%L::uuid, %L, %L)',
        pg_temp.fixture_id('e-bloqueo'), 'Clave-Mala-' || i, 'Intento ' || i)) ->> 'motivo' = 'incorrecta',
      'el intento ' || i || ' es incorrecto');
  end loop;
end;
$bloqueo$;
select pg_temp.assert_true((select locked_until > now() from public.accounting_closing_secrets
  where tenant_id = pg_temp.fixture_id('tenant-A')), 'el quinto fallido bloquea');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events where kind = 'superclave_bloqueada'),
  'el bloqueo queda en el historial');
select pg_temp.assert_true(
  pg_temp.as_actor('accounting-A', format(
    'select public.asentar_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-bloqueo'), 'Clave-Segura-1', 'Ya con la buena')) ->> 'motivo' = 'bloqueada',
  'bloqueada, ni la clave buena entra');
select pg_temp.assert_true(pg_temp.status_of('e-bloqueo') = 'borrador', 'bloqueada no se asienta');
update public.accounting_closing_secrets set locked_until = now() - interval '1 second'
where tenant_id = pg_temp.fixture_id('tenant-A');
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.asentar_asiento_en_cierre(%L::uuid, %L, %L)',
    pg_temp.fixture_id('e-bloqueo'), 'Clave-Segura-1', 'Pasó el bloqueo')) ->> 'ok')::boolean,
  'pasado el bloqueo, la clave buena entra');

-- ── 12. Cambiar y restablecer la superclave ──
select pg_temp.assert_true(
  pg_temp.as_actor('admin-A', 'select public.fijar_superclave_de_cierre(''Clave-Mala-1'', ''Clave-Nueva-2'')') ->> 'motivo' = 'incorrecta',
  'para cambiarla hay que dar la actual');
select pg_temp.assert_true(
  (pg_temp.as_actor('admin-A', 'select public.fijar_superclave_de_cierre(''Clave-Segura-1'', ''Clave-Nueva-2'')') ->> 'ok')::boolean,
  'con la actual se cambia');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events where kind = 'superclave_cambiada'),
  'el cambio queda en el historial');
select pg_temp.assert_true(pg_temp.sqlstate_of('admin-A',
  'select public.restablecer_superclave_de_cierre(''Clave-Tercera-3'', ''corto'')') = '22023',
  'restablecer pide un motivo de al menos 10 caracteres');
select pg_temp.assert_true(pg_temp.sqlstate_of('accounting-A',
  'select public.restablecer_superclave_de_cierre(''Clave-Tercera-3'', ''La olvidamos todos'')') = '42501',
  'solo el admin restablece');
select pg_temp.assert_true(
  (pg_temp.as_actor('admin-A', 'select public.restablecer_superclave_de_cierre(''Clave-Tercera-3'', ''La olvidamos todos'')') ->> 'ok')::boolean,
  'el admin la restablece sin la actual');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events
  where kind = 'superclave_restablecida' and reason = 'La olvidamos todos'), 'restablecer queda con su motivo');

-- ── 13. Modo advertencia: sin clave, con motivo, y queda en el historial ──
select pg_temp.as_actor('admin-A', format(
  'update public.accounting_settings set closing_mode = ''advertencia'' where tenant_id = %L::uuid returning to_jsonb(tenant_id)',
  pg_temp.fixture_id('tenant-A')));
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events
  where kind = 'modo_cambiado' and old_value = 'superclave' and new_value = 'advertencia'
    and user_id = pg_temp.fixture_id('admin-A')), 'el cambio de modo queda en el historial');
select pg_temp.assert_true(
  (pg_temp.as_actor('accounting-A', format(
    'select public.crear_asiento_en_cierre(%L::jsonb, null, %L)',
    jsonb_build_object('entry_date', '2026-01-25', 'memo', 'Con advertencia', 'lineas', jsonb_build_array(
      jsonb_build_object('account_id', pg_temp.fixture_id('caja-A'), 'debit', 5),
      jsonb_build_object('account_id', pg_temp.fixture_id('ventas-A'), 'credit', 5))),
    'Visto el aviso')) ->> 'ok')::boolean,
  'en modo advertencia basta el motivo');
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_exceptions
  where authorized_by = 'advertencia' and reason = 'Visto el aviso'), 'la excepción dice que fue con advertencia');

-- ── 14. Mover la fecha queda en el historial, con quién ──
select pg_temp.as_actor('admin-A', format(
  'update public.accounting_settings set closing_date = ''2026-02-28'' where tenant_id = %L::uuid returning to_jsonb(tenant_id)',
  pg_temp.fixture_id('tenant-A')));
select pg_temp.assert_true(exists (select 1 from public.accounting_closing_events
  where kind = 'fecha_cambiada' and old_value = '2026-01-31' and new_value = '2026-02-28'
    and user_id = pg_temp.fixture_id('admin-A')), 'mover la fecha queda con quién, de cuál a cuál');

-- ── 15. El texto de la superclave no aparece en ninguna parte ──
select pg_temp.assert_true(not exists (
  select 1 from public.accounting_closing_events e
  where concat_ws('|', e.kind, e.old_value, e.new_value, e.reason) ~ 'Clave-(Segura|Nueva|Tercera|Mala)'),
  'el historial no guarda ninguna clave');
select pg_temp.assert_true(not exists (
  select 1 from public.accounting_closing_exceptions x
  where concat_ws('|', x.reason, x.entry_code, x.nonce) ~ 'Clave-(Segura|Nueva|Tercera|Mala)'),
  'las excepciones no guardan ninguna clave');
select pg_temp.assert_true(not exists (
  select 1 from public.accounting_closing_secrets s where s.secret_hash ~ 'Clave-'), 'el hash no contiene la clave');

select 'TEST 0493 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
