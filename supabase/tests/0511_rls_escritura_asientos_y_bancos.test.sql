\set ON_ERROR_STOP on

-- Contrato desechable de la 0511 (SDD-0593). Fixture sintética y ROLLBACK.
-- Aplica las migraciones REALES de facturas (0077), contabilidad (0078),
-- cobranzas (0079, 0122), tesorería (0088), datos de empresa (0190), RLS (0230) y
-- auditoría (0258/0261/0267/0290/0294), y encima la 0511.
--
-- Prueba la matriz de roles sobre journal_entries, journal_lines y
-- company_bank_accounts: leer es del equipo del tenant; escribir asientos es de
-- accounting y admin; las líneas sólo se insertan; las cuentas bancarias no se
-- escriben directo, ni el admin: van por la RPC DEFINER.
--
-- CONTROL ROJO: con `-v apply_fix=false` la 0511 no se aplica y la primera
-- aserción de escritura falla, porque el comercial puede crear un asiento.
-- En CI, que no tiene Docker, este mismo contrato corre en PGlite:
-- lib/studio/__tests__/rls-escritura-asientos-y-bancos.migration.test.ts.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0511: fixture rechazada, la base ya contiene objetos de aplicación';
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
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- Columnas de 0001/0019/0200, con el CHECK de rol de producción.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id),
  constraint user_tenants_role_check check (role in ('admin', 'commercial', 'operations', 'accounting',
    'warehouse', 'support', 'marketing'))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- La semántica de 0453 (la ÚNICA membresía activa) y de 0200.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
-- El cuerpo exacto de la 0200: la 0511 lo fija por md5.
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- 0077 apunta a shipments; 0122 hace backfill por shipment_service.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- Plataforma legacy mínima de 0267, igual que el contrato 0470.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0079_cobranzas.sql
\ir ../migrations/0088_tesoreria.sql
\ir ../migrations/0122_recibos_cobranza.sql
\ir ../migrations/0190_datos_empresa.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- Doble de audit_d1_execute con su firma y su forma de producción: DEFINER de
-- postgres, y exige admin. La real pide toda la plataforma D1. Lo que se prueba
-- aquí es que el dueño de la tabla sigue escribiendo después del revoke.
create function public.audit_d1_execute(p_operation_id uuid, p_operation_type text, p_target_id uuid, p_input jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if public.current_studio_role() is distinct from 'admin' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.company_bank_accounts set account_number = p_input ->> 'account_number' where id = p_target_id;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.audit_d1_execute(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.audit_d1_execute(uuid, text, uuid, jsonb, text) to authenticated, service_role;

-- Supabase le da a service_role todo sobre public por default privileges. La
-- fixture lo replica para poder comprobarlo.
grant all on all tables in schema public to service_role;

create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0511-synthetic-' || p_label)::uuid
$$;

-- Un usuario por rol en el tenant A; uno desactivado; uno con dos membresías;
-- un cliente del portal, sin membresía; y accounting en B.
insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A', 'operations-A',
  'warehouse-A', 'support-A', 'marketing-A', 'accounting-off', 'accounting-dos', 'cliente-portal',
  'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0511', 'Tenant A 0511'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0511', 'Tenant B 0511');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('accounting-A', 'tenant-A', 'accounting', false), ('admin-A', 'tenant-A', 'admin', false),
  ('commercial-A', 'tenant-A', 'commercial', false), ('operations-A', 'tenant-A', 'operations', false),
  ('warehouse-A', 'tenant-A', 'warehouse', false), ('support-A', 'tenant-A', 'support', false),
  ('marketing-A', 'tenant-A', 'marketing', false), ('accounting-off', 'tenant-A', 'accounting', true),
  ('accounting-dos', 'tenant-A', 'accounting', false), ('accounting-dos', 'tenant-B', 'accounting', false),
  ('accounting-B', 'tenant-B', 'accounting', false)
) v(u, t, r, off);
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('tenant-' || t), v.codigo, v.etiqueta || ' ' || t, v.tipo::public.acct_type, true
from unnest(array['A', 'B']) t
cross join (values ('banco', '1.1.1.1', 'A'), ('ingreso', '4.5', 'I')) v(etiqueta, codigo, tipo);
-- Un asiento asentado con sus dos líneas y un borrador, por tenant.
insert into public.journal_entries (id, tenant_id, entry_code, status, source, posted_at)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('tenant-' || t), v.codigo, v.estado::public.entry_status, 'manual', v.posted
from unnest(array['A', 'B']) t
cross join (values ('asentado', 'A-0511-0001', 'asentado', now()), ('borrador', 'A-0511-0002', 'borrador', null::timestamptz)) v(etiqueta, codigo, estado, posted);
insert into public.journal_lines (id, entry_id, account_id, debit, credit)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('asentado-' || t), pg_temp.fid(v.cuenta || '-' || t), v.debe, v.haber
from unnest(array['A', 'B']) t
cross join (values ('linea-debe', 'banco', 100, 0), ('linea-haber', 'ingreso', 0, 100)) v(etiqueta, cuenta, debe, haber);
insert into public.company_bank_accounts (id, tenant_id, bank_name, account_type, currency, account_number)
select pg_temp.fid('cuenta-banco-' || t), pg_temp.fid('tenant-' || t), 'Banco ' || t, 'Cta. Corriente', 'USD', '0000-' || t
from unnest(array['A', 'B']) t;

-- Lo que la 0511 NO puede tocar.
create temporary table baseline_policies as
select to_jsonb(p) as definition from pg_catalog.pg_policies p
where p.tablename not in ('journal_entries', 'journal_lines', 'company_bank_accounts');
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
  and c.relname not in ('journal_lines', 'company_bank_accounts');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as
select 'asiento' as kind, to_jsonb(e) as row_data from public.journal_entries e
union all select 'linea', to_jsonb(l) from public.journal_lines l
union all select 'banco', to_jsonb(b) from public.company_bank_accounts b;

\if :apply_fix
\ir ../migrations/0511_rls_escritura_asientos_y_bancos.sql
\endif

-- ── Aserciones ──────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0511: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Corre p_sql como el actor (rol de la API + su auth.uid) y cuenta filas o
-- devuelve el error. No reemplaza autorización: la da la RLS real.
create function pg_temp.intenta(p_actor text, p_sql text, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_filas bigint := 0; v_state text; v_msg text; v_valor text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    if p_sql ilike 'select%' then
      execute p_sql into v_valor;
      get diagnostics v_filas = row_count;
    else
      execute p_sql;
      get diagnostics v_filas = row_count;
    end if;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v_filas, 'valor', v_valor);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- Cuenta lo que el actor ve de esa tabla y ese tenant.
create function pg_temp.cuenta(p_actor text, p_tabla text, p_tenant text) returns bigint
language plpgsql as $$
declare v jsonb;
begin
  v := pg_temp.intenta(p_actor, case p_tabla
    when 'journal_lines' then format(
      'select count(*) from public.journal_lines l where l.entry_id in (%L, %L)',
      pg_temp.fid('asentado-' || p_tenant), pg_temp.fid('borrador-' || p_tenant))
    else format('select count(*) from public.%I where tenant_id = %L', p_tabla, pg_temp.fid('tenant-' || p_tenant))
  end);
  return (v ->> 'valor')::bigint;
end;
$$;

-- Las escrituras de contabilidad/actions.ts.
create function pg_temp.alta_asiento(p_tenant text, p_codigo text) returns text language sql immutable as $$
  select format($q$insert into public.journal_entries (tenant_id, entry_code, entry_date, memo, status, source, posted_at)
    values (%L, %L, current_date, 'memo', 'borrador', 'manual', null)$q$, pg_temp.fid('tenant-' || p_tenant), p_codigo)
$$;
create function pg_temp.alta_linea(p_asiento uuid, p_tenant text) returns text language sql immutable as $$
  select format($q$insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    values (%L, %L, 10, 0, 'linea')$q$, p_asiento, pg_temp.fid('banco-' || p_tenant))
$$;
create function pg_temp.id_asiento(p_codigo text, p_tenant text) returns uuid language sql stable as $$
  select e.id from public.journal_entries e where e.entry_code = p_codigo and e.tenant_id = pg_temp.fid('tenant-' || p_tenant)
$$;
create function pg_temp.asiento(p_etiqueta text) returns jsonb language sql stable as $$
  select to_jsonb(e) - 'updated_at' from public.journal_entries e where e.id = pg_temp.fid(p_etiqueta)
$$;

do $sin_filas$
begin
  -- 1. La 0511 no cambia ninguna fila al aplicarse.
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select to_jsonb(e) as row_data from public.journal_entries e
      union all select to_jsonb(l) from public.journal_lines l
      union all select to_jsonb(b) from public.company_bank_accounts b
    ) ahora full join baseline_rows b on b.row_data = ahora.row_data
    where b.row_data is null or ahora.row_data is null),
    'aplicar la migración cambió filas');
end;
$sin_filas$;

do $matriz$
declare
  v_financieros text[] := array['accounting-A', 'admin-A'];
  v_otros text[] := array['commercial-A', 'operations-A', 'warehouse-A', 'support-A', 'marketing-A'];
  v_fuera text[] := array['accounting-off', 'accounting-dos', 'cliente-portal'];
  v_actor text; v_r jsonb; v_i integer := 0; v_codigo text; v_id uuid; v_antes jsonb; v_audit bigint; v_tabla text;
begin
  -- 2. Leer no cambia: todo el equipo activo del tenant ve lo mismo.
  foreach v_actor in array v_financieros || v_otros loop
    perform pg_temp.afirmar(pg_temp.cuenta(v_actor, 'journal_entries', 'A') = 2, format('%s dejó de leer journal_entries', v_actor));
    perform pg_temp.afirmar(pg_temp.cuenta(v_actor, 'journal_lines', 'A') = 2, format('%s dejó de leer journal_lines', v_actor));
    perform pg_temp.afirmar(pg_temp.cuenta(v_actor, 'company_bank_accounts', 'A') = 1, format('%s dejó de leer company_bank_accounts', v_actor));
  end loop;

  -- 3. accounting y admin hacen lo que hace la app: crear con líneas, asentar,
  -- borrar la cabecera si fallan las líneas, archivar y anular.
  foreach v_actor in array v_financieros loop
    v_i := v_i + 1;
    v_codigo := 'A-0511-1' || v_i;
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_asiento('A', v_codigo));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo crear un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    v_id := pg_temp.id_asiento(v_codigo, 'A');

    v_r := pg_temp.intenta(v_actor, pg_temp.alta_linea(v_id, 'A'));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo agregar una línea (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));

    v_r := pg_temp.intenta(v_actor, format($q$update public.journal_entries set status = 'asentado', posted_at = now() where id = %L$q$, v_id));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo asentar (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));

    v_r := pg_temp.intenta(v_actor, format($q$select public.void_journal_entry_with_audit_reason(%L, 'motivo de prueba')$q$, v_id));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'valor')::boolean,
      format('%s no pudo anular por la RPC (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'valor')));

    v_r := pg_temp.intenta(v_actor, format('update public.journal_entries set deleted_at = now() where id = %L', v_id));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo archivar un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));

    v_codigo := 'A-0511-2' || v_i;
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_asiento('A', v_codigo));
    v_id := pg_temp.id_asiento(v_codigo, 'A');
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_linea(v_id, 'A'));
    -- Rollback manual de createJournalEntry; la línea cae en cascada.
    v_r := pg_temp.intenta(v_actor, format('delete from public.journal_entries where id = %L', v_id));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo borrar un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    perform pg_temp.afirmar(not exists (select 1 from public.journal_lines l where l.entry_id = v_id),
      format('la línea no cayó en cascada al borrar %s', v_codigo));
  end loop;

  -- 4. Ningún otro rol escribe asientos, y nada queda escrito.
  select count(*) into v_audit from public.entity_audit_log where entity_type = 'journal_entry';
  foreach v_actor in array v_otros || v_fuera loop
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_asiento('A', 'A-0511-X'));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s pudo crear un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));

    v_r := pg_temp.intenta(v_actor, pg_temp.alta_linea(pg_temp.fid('asentado-A'), 'A'));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s pudo agregar una línea (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));

    v_antes := pg_temp.asiento('asentado-A');
    v_r := pg_temp.intenta(v_actor, format($q$update public.journal_entries set status = 'anulado' where id = %L$q$, pg_temp.fid('asentado-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s anuló un asiento por PATCH (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    v_r := pg_temp.intenta(v_actor, format('update public.journal_entries set deleted_at = now() where id = %L', pg_temp.fid('asentado-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s archivó un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    v_r := pg_temp.intenta(v_actor, format('delete from public.journal_entries where id = %L', pg_temp.fid('borrador-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s borró un asiento (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    v_r := pg_temp.intenta(v_actor, format($q$select public.void_journal_entry_with_audit_reason(%L, 'motivo de prueba')$q$, pg_temp.fid('asentado-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and not (v_r ->> 'valor')::boolean,
      format('%s anuló por la RPC (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'valor')));
    perform pg_temp.afirmar(pg_temp.asiento('asentado-A') = v_antes, format('el asiento cambió tras el intento de %s', v_actor));
    perform pg_temp.afirmar(pg_temp.asiento('borrador-A') is not null, format('el borrador desapareció tras el intento de %s', v_actor));
  end loop;
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where entity_type = 'journal_entry') = v_audit,
    'un intento rechazado dejó un evento de auditoría');

  -- 5. Sin membresía activa única no se lee: desactivado, con dos membresías o
  -- cliente del portal.
  foreach v_actor in array v_fuera loop
    foreach v_tabla in array array['journal_entries', 'journal_lines', 'company_bank_accounts'] loop
      perform pg_temp.afirmar(pg_temp.cuenta(v_actor, v_tabla, 'A') = 0, format('%s lee %s del tenant A', v_actor, v_tabla));
    end loop;
  end loop;

  -- 6. Las líneas no se editan ni se borran directo, ni con rol financiero.
  foreach v_actor in array v_financieros || v_otros loop
    v_r := pg_temp.intenta(v_actor, format('update public.journal_lines set debit = 999 where id = %L', pg_temp.fid('linea-debe-A')));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s editó una línea (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
    v_r := pg_temp.intenta(v_actor, format('delete from public.journal_lines where id = %L', pg_temp.fid('linea-debe-A')));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s borró una línea (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
  end loop;

  -- 7. Otro tenant: ni el rol financiero cruza.
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', 'journal_entries', 'A') = 0, 'accounting-B lee asientos del tenant A');
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', 'journal_lines', 'A') = 0, 'accounting-B lee líneas del tenant A');
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', 'journal_entries', 'B') = 2, 'accounting-B dejó de leer sus asientos');
  v_r := pg_temp.intenta('accounting-B', pg_temp.alta_asiento('A', 'A-0511-Y'));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501', 'accounting-B creó un asiento en el tenant A');
  v_r := pg_temp.intenta('accounting-B', format($q$update public.journal_entries set status = 'anulado' where id = %L$q$, pg_temp.fid('asentado-A')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0, 'accounting-B anuló un asiento del tenant A');
  v_r := pg_temp.intenta('accounting-A', pg_temp.alta_linea(pg_temp.fid('asentado-B'), 'A'));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-A agregó una línea a un asiento del tenant B (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));

  -- 8. El rol financiero no se lleva un asiento a otro tenant.
  v_r := pg_temp.intenta('accounting-A', format('update public.journal_entries set tenant_id = %L where id = %L', pg_temp.fid('tenant-B'), pg_temp.fid('borrador-A')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-A movió un asiento al tenant B (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));
  -- Si la sentencia no lee ninguna columna, no entra la policy de SELECT y el WITH
  -- CHECK de UPDATE es lo único que lo frena. El código nuevo es para que no salte
  -- antes el UNIQUE (tenant, código).
  v_r := pg_temp.intenta('accounting-A', format($q$update public.journal_entries set tenant_id = %L, entry_code = gen_random_uuid()::text$q$, pg_temp.fid('tenant-B')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-A movió asientos al tenant B sin filtro (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));

  -- 9. Las cuentas bancarias no se escriben directo, ni el admin.
  foreach v_actor in array v_financieros || v_otros loop
    v_r := pg_temp.intenta(v_actor, format($q$insert into public.company_bank_accounts (tenant_id, bank_name, account_type, currency, account_number)
      values (%L, 'Otro banco', 'Cta. Corriente', 'USD', '9999')$q$, pg_temp.fid('tenant-A')));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s dio de alta una cuenta bancaria (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
    v_r := pg_temp.intenta(v_actor, format($q$update public.company_bank_accounts set account_number = '9999' where id = %L$q$, pg_temp.fid('cuenta-banco-A')));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s cambió un número de cuenta bancaria (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
    v_r := pg_temp.intenta(v_actor, format('delete from public.company_bank_accounts where id = %L', pg_temp.fid('cuenta-banco-A')));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s borró una cuenta bancaria (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
  end loop;
  perform pg_temp.afirmar((select b.account_number from public.company_bank_accounts b where b.id = pg_temp.fid('cuenta-banco-A')) = '0000-A',
    'el número de cuenta cambió con un intento rechazado');

  -- 10. La RPC DEFINER sigue escribiendo para el admin, y sólo para él.
  v_r := pg_temp.intenta('marketing-A', format($q$select public.audit_d1_execute(%L, 'bank_account.save', %L, '{"account_number":"1111"}'::jsonb, 'motivo')$q$,
    pg_temp.fid('op-1'), pg_temp.fid('cuenta-banco-A')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501', 'marketing pudo usar la RPC de cuentas bancarias');
  v_r := pg_temp.intenta('admin-A', format($q$select public.audit_d1_execute(%L, 'bank_account.save', %L, '{"account_number":"1111"}'::jsonb, 'motivo')$q$,
    pg_temp.fid('op-2'), pg_temp.fid('cuenta-banco-A')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean, format('el admin dejó de poder guardar por la RPC (%s)', v_r ->> 'sqlstate'));
  perform pg_temp.afirmar((select b.account_number from public.company_bank_accounts b where b.id = pg_temp.fid('cuenta-banco-A')) = '1111',
    'la RPC no escribió la cuenta bancaria');

  -- 11. anon no tiene GRANT.
  foreach v_tabla in array array['journal_entries', 'journal_lines', 'company_bank_accounts'] loop
    v_r := pg_temp.intenta(null, format('select count(*) from public.%I', v_tabla), 'anon');
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501', format('anon lee %s', v_tabla));
  end loop;

  -- 12. service_role sigue escribiendo: es lo que usan los posting automáticos.
  v_r := pg_temp.intenta(null, pg_temp.alta_asiento('A', 'A-0511-S'), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder crear asientos');
  v_id := pg_temp.id_asiento('A-0511-S', 'A');
  v_r := pg_temp.intenta(null, pg_temp.alta_linea(v_id, 'A'), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder agregar líneas');
  v_r := pg_temp.intenta(null, format('update public.journal_lines set line_memo = %L where entry_id = %L', 'job', v_id), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder editar líneas');
  v_r := pg_temp.intenta(null, format('delete from public.journal_entries where id = %L', v_id), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder borrar asientos');
  v_r := pg_temp.intenta(null, format($q$update public.company_bank_accounts set account_number = '2222' where id = %L$q$, pg_temp.fid('cuenta-banco-B')), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder editar cuentas bancarias');

  -- 13. Un cambio permitido sigue dejando rastro en auditoría.
  select count(*) into v_audit from public.entity_audit_log where entity_type = 'journal_entry';
  v_r := pg_temp.intenta('accounting-A', format($q$update public.journal_entries set status = 'asentado', posted_at = now() where id = %L$q$, pg_temp.fid('borrador-A')));
  perform pg_temp.afirmar((v_r ->> 'filas')::int = 1, 'accounting-A no pudo asentar el borrador');
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where entity_type = 'journal_entry') = v_audit + 1,
    'asentar no dejó evento de auditoría');
end;
$matriz$;

do $forma$
begin
  -- 14. La forma: sin FOR ALL, sin FORCE y con la ACL esperada.
  perform pg_temp.afirmar(not exists (select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename in ('journal_entries', 'journal_lines', 'company_bank_accounts') and p.cmd = 'ALL'),
    'una tabla conserva una policy FOR ALL');
  perform pg_temp.afirmar((select count(*) from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'company_bank_accounts') = 1, 'company_bank_accounts no tiene sólo su lectura');
  perform pg_temp.afirmar(not exists (select 1 from pg_class c
    where c.oid in ('public.journal_entries'::regclass, 'public.journal_lines'::regclass, 'public.company_bank_accounts'::regclass)
      and c.relforcerowsecurity), 'una tabla quedó con FORCE');
  perform pg_temp.afirmar(
    has_table_privilege('authenticated', 'public.journal_entries', 'SELECT')
    and has_table_privilege('authenticated', 'public.journal_entries', 'INSERT')
    and has_table_privilege('authenticated', 'public.journal_entries', 'UPDATE')
    and has_table_privilege('authenticated', 'public.journal_entries', 'DELETE')
    and has_table_privilege('authenticated', 'public.journal_lines', 'SELECT')
    and has_table_privilege('authenticated', 'public.journal_lines', 'INSERT')
    and not has_table_privilege('authenticated', 'public.journal_lines', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.journal_lines', 'DELETE')
    and has_table_privilege('authenticated', 'public.company_bank_accounts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.company_bank_accounts', 'INSERT,UPDATE,DELETE')
    and has_table_privilege('service_role', 'public.journal_lines', 'UPDATE')
    and has_table_privilege('service_role', 'public.company_bank_accounts', 'UPDATE'),
    'la ACL no quedó como se esperaba');
end;
$forma$;

do $sin_efectos$
begin
  -- 15. La 0511 no toca nada más.
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select to_jsonb(p) as definition from pg_catalog.pg_policies p
      where p.tablename not in ('journal_entries', 'journal_lines', 'company_bank_accounts')
    ) ahora full join baseline_policies b on b.definition = ahora.definition
    where b.definition is null or ahora.definition is null),
    'cambiaron policies de otras tablas');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select c.oid, c.relacl from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
        and c.relname not in ('journal_lines', 'company_bank_accounts')
    ) ahora full join baseline_acl b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.relacl is distinct from ahora.relacl),
    'cambió la ACL de otra tabla');
  perform pg_temp.afirmar(not exists (
    select 1 from (select t.oid, to_jsonb(t) as definition from pg_trigger t where not t.tgisinternal) ahora
    full join baseline_triggers b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió algún trigger');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')
    ) ahora full join baseline_functions b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió alguna función');
end;
$sin_efectos$;

select 'TEST 0511 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
