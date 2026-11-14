\set ON_ERROR_STOP on

-- Contrato desechable de la 0528 (SDD-0624). Fixture sintética y ROLLBACK.
-- Aplica las migraciones REALES de facturas (0077), contabilidad (0078),
-- cobranzas (0079, 0122), tesorería (0088), datos de empresa (0190), gastos
-- (0047, 0074), RLS (0230, 0407), auditoría (0258/0261/0267/0290/0294), la
-- 0467, la 0470 y la 0511, y encima la 0528.
--
-- Prueba que LEER journal_entries, journal_lines, payment_receipts,
-- supplier_bills y supplier_payments queda para accounting y admin activos de
-- su tenant; que Reclamos sigue viendo el código del asiento por la RPC sin
-- leer la tabla; que support ya no escribe gastos y el resto del staff sí
-- carga los suyos; y que la 0528 no toca nada más.
--
-- CONTROL ROJO: con `-v apply_fix=false` la 0528 no se aplica y la primera
-- aserción falla, porque el comercial lee los asientos.
-- En CI, que no tiene Docker, este mismo contrato corre en PGlite:
-- lib/studio/__tests__/rls-lectura-dinero-y-gastos.migration.test.ts.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0528: fixture rechazada, la base ya contiene objetos de aplicación';
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
-- Columnas de 0001/0019/0058/0200, con el CHECK de rol de producción.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, region text, primary key (user_id, tenant_id),
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
-- Los cuerpos exactos de la 0200 y de la 0351: la 0470 y la 0511 los fijan por md5.
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
create or replace function public.assert_studio_role(p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_studio_role();
begin
  -- current_studio_role() ya filtra `disabled_at is null` (migr 0200): un
  -- usuario desactivado llega acá como NULL y rebota.
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.assert_studio_role(text[]) from public, anon;
grant execute on function public.assert_studio_role(text[]) to authenticated, service_role;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
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

\ir ../migrations/0047_expenses.sql
\ir ../migrations/0074_expenses_scope_fx.sql
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
\ir ../migrations/0407_invoices_write_rbac.sql
\ir ../migrations/0467_cobro_factura_atomico.sql

-- Doble de audit_d1_execute con la forma que exige el preflight de la 0511:
-- DEFINER de postgres. Acá no se ejercita.
create function public.audit_d1_execute(p_operation_id uuid, p_operation_type text, p_target_id uuid, p_input jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'no se usa en el contrato 0528';
end;
$$;
revoke all on function public.audit_d1_execute(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.audit_d1_execute(uuid, text, uuid, jsonb, text) to authenticated, service_role;

-- La columna de la 0157 sin su FK a client_claims (la fixture no trae reclamos).
alter table public.journal_entries add column claim_id uuid;

grant all on all tables in schema public to service_role;

\ir ../migrations/0470_rls_escritura_cobros_proveedores.sql
\ir ../migrations/0511_rls_escritura_asientos_y_bancos.sql

create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0528-synthetic-' || p_label)::uuid
$$;

-- Un usuario por rol en el tenant A, uno desactivado, y accounting en B.
insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A', 'operations-A',
  'warehouse-A', 'support-A', 'marketing-A', 'accounting-off', 'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0528', 'Tenant A 0528'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0528', 'Tenant B 0528');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('accounting-A', 'tenant-A', 'accounting', false), ('admin-A', 'tenant-A', 'admin', false),
  ('commercial-A', 'tenant-A', 'commercial', false), ('operations-A', 'tenant-A', 'operations', false),
  ('warehouse-A', 'tenant-A', 'warehouse', false), ('support-A', 'tenant-A', 'support', false),
  ('marketing-A', 'tenant-A', 'marketing', false), ('accounting-off', 'tenant-A', 'accounting', true),
  ('accounting-B', 'tenant-B', 'accounting', false)
) v(u, t, r, off);
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('tenant-' || t), v.codigo, v.etiqueta || ' ' || t, v.tipo::public.acct_type, true
from unnest(array['A', 'B']) t
cross join (values ('banco', '1.1.1.1', 'A'), ('ingreso', '4.5', 'I'), ('gasto', '5.1.1.1', 'G')) v(etiqueta, codigo, tipo);
-- Asientos: uno asentado de un reclamo y un borrador, por tenant.
insert into public.journal_entries (id, tenant_id, entry_code, status, source, posted_at, claim_id)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('tenant-' || t), v.codigo || '-' || t,
  v.estado::public.entry_status, 'manual', v.posted, case when v.reclamo then pg_temp.fid('reclamo-' || t) end
from unnest(array['A', 'B']) t
cross join (values ('asentado', 'A-0528-0001', 'asentado', now(), true),
                   ('borrador', 'A-0528-0002', 'borrador', null::timestamptz, false)) v(etiqueta, codigo, estado, posted, reclamo);
insert into public.journal_lines (id, entry_id, account_id, debit, credit)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('asentado-' || t), pg_temp.fid(v.cuenta || '-' || t), v.debe, v.haber
from unnest(array['A', 'B']) t
cross join (values ('linea-debe', 'banco', 100, 0), ('linea-haber', 'ingreso', 0, 100)) v(etiqueta, cuenta, debe, haber);
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
  base_amount, total_amount, paid_amount, status, fund_class)
select pg_temp.fid('inv-' || t), pg_temp.fid('tenant-' || t), 'F-0528-' || t, 'DTD-0528', 'Cliente 0528', 'USD',
  5000, 5000, 0, 'emitida'::public.invoice_status, 'third_party'
from unnest(array['A', 'B']) t;
insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name,
  amount, currency, method, cash_account_id, received_at, application_status, fund_class)
select pg_temp.fid('rec-' || t), pg_temp.fid('tenant-' || t), 'R-0528-' || t, pg_temp.fid('inv-' || t), 'DTD-0528',
  'Cliente 0528', 100, 'USD', 'transferencia', pg_temp.fid('banco-' || t), date '2026-05-20', 'aplicado', 'third_party'
from unnest(array['A', 'B']) t;
insert into public.suppliers (id, tenant_id, supplier_code, name)
select pg_temp.fid('sup-' || t), pg_temp.fid('tenant-' || t), 'PRV-0001', 'Proveedor ' || t
from unnest(array['A', 'B']) t;
insert into public.supplier_bills (id, tenant_id, bill_code, supplier_id, supplier_name,
  expense_account_id, total_amount, paid_amount, status, due_date)
select pg_temp.fid('bill-' || t), pg_temp.fid('tenant-' || t), 'CXP-0528-' || t, pg_temp.fid('sup-' || t),
  'Proveedor ' || t, pg_temp.fid('gasto-' || t), 1000, 0, 'pendiente', date '2026-06-30'
from unnest(array['A', 'B']) t;
insert into public.supplier_payments (id, tenant_id, payment_code, bill_id, supplier_id, supplier_name,
  amount, cash_account_id)
select pg_temp.fid('pay-' || t), pg_temp.fid('tenant-' || t), 'OP-0528-' || t, pg_temp.fid('bill-' || t),
  pg_temp.fid('sup-' || t), 'Proveedor ' || t, 100, pg_temp.fid('banco-' || t)
from unnest(array['A', 'B']) t;
-- Un gasto propio por rol, para probar el UPDATE del dueño.
insert into public.expenses (id, tenant_id, user_id, expense_code, amount, category, scope, amount_usd)
select pg_temp.fid('gasto-de-' || r), pg_temp.fid('tenant-A'), pg_temp.fid(r || '-A'), 'EXP-0528-' || r,
  10, 'taxi', 'external', 10
from unnest(array['support', 'commercial', 'operations']) r;

-- Lo que la 0528 NO puede tocar.
create temporary table baseline_policies as
select to_jsonb(p) as definition from pg_catalog.pg_policies p
where not (p.tablename in ('journal_entries', 'journal_lines', 'payment_receipts', 'supplier_bills',
  'supplier_payments') and p.cmd = 'SELECT')
  and not (p.tablename = 'expenses' and p.policyname in ('expenses_insert', 'expenses_update'));
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_rows as
select 'asiento' as kind, to_jsonb(e) as row_data from public.journal_entries e
union all select 'linea', to_jsonb(l) from public.journal_lines l
union all select 'recibo', to_jsonb(r) from public.payment_receipts r
union all select 'cxp', to_jsonb(b) from public.supplier_bills b
union all select 'pago', to_jsonb(p) from public.supplier_payments p;

\if :apply_fix
\ir ../migrations/0528_rls_lectura_dinero_y_gastos.sql
\endif

-- ── Aserciones ──────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0528: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Corre p_sql como el actor (rol de la API + su auth.uid) y devuelve filas o error.
create function pg_temp.intenta(p_actor text, p_sql text)
returns jsonb language plpgsql as $$
declare v_filas bigint := 0; v_state text; v_msg text; v_valor text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    set local role authenticated;
    if p_sql ilike 'select%' then
      execute p_sql into v_valor;
    else
      execute p_sql;
    end if;
    get diagnostics v_filas = row_count;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v_filas, 'valor', v_valor);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- Cuenta lo que el actor ve de esa tabla en el tenant A.
create function pg_temp.cuenta(p_actor text, p_tabla text) returns bigint language plpgsql as $$
declare v jsonb;
begin
  v := pg_temp.intenta(p_actor, case p_tabla
    when 'journal_lines' then format(
      'select count(*) from public.journal_lines l where l.entry_id = %L', pg_temp.fid('asentado-A'))
    else format('select count(*) from public.%I where tenant_id = %L', p_tabla, pg_temp.fid('tenant-A'))
  end);
  if not (v ->> 'ok')::boolean then
    raise exception 'TEST 0528: % no pudo consultar % (%)', p_actor, p_tabla, v ->> 'mensaje';
  end if;
  return (v ->> 'valor')::bigint;
end;
$$;

do $lectura$
declare
  v_t text;
  v_actor text;
  v_base bigint;
begin
  foreach v_t in array array['journal_entries', 'journal_lines', 'payment_receipts', 'supplier_bills',
                             'supplier_payments'] loop
    v_base := case v_t when 'journal_entries' then 2 else (case v_t when 'journal_lines' then 2 else 1 end) end;
    -- Los que no tienen el dinero no leen nada (el primero es el control rojo).
    foreach v_actor in array array['commercial-A', 'operations-A', 'warehouse-A', 'support-A',
                                   'marketing-A', 'accounting-off'] loop
      perform pg_temp.afirmar(pg_temp.cuenta(v_actor, v_t) = 0,
        format('%s lee %s (%s filas)', v_actor, v_t, pg_temp.cuenta(v_actor, v_t)));
    end loop;
    foreach v_actor in array array['accounting-A', 'admin-A'] loop
      perform pg_temp.afirmar(pg_temp.cuenta(v_actor, v_t) = v_base,
        format('%s dejó de leer %s', v_actor, v_t));
    end loop;
    perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', v_t) = 0,
      format('accounting-B lee %s del tenant A', v_t));
  end loop;
  -- Sin sesión, tampoco.
  perform pg_temp.afirmar(pg_temp.cuenta(null, 'journal_entries') = 0, 'una sesión vacía lee asientos');
end;
$lectura$;

-- ── Reclamos: el código del asiento por la RPC, sin montos ──
do $reclamos$
declare
  v_actor text;
  v jsonb;
  v_sql text := format('select entry_code from public.claim_indemnity_entry_codes(array[%L]::uuid[])',
    pg_temp.fid('reclamo-A'));
begin
  foreach v_actor in array array['commercial-A', 'operations-A', 'support-A', 'accounting-A', 'admin-A'] loop
    v := pg_temp.intenta(v_actor, v_sql);
    perform pg_temp.afirmar((v ->> 'ok')::boolean and v ->> 'valor' = 'A-0528-0001-A',
      format('%s no ve el código del asiento de su reclamo (%s)', v_actor, v));
  end loop;
  foreach v_actor in array array['warehouse-A', 'marketing-A', 'accounting-off'] loop
    v := pg_temp.intenta(v_actor, v_sql);
    perform pg_temp.afirmar((v ->> 'ok')::boolean and v ->> 'valor' is null,
      format('%s, que no ve Reclamos, recibió un código (%s)', v_actor, v));
  end loop;
  -- Nunca el de otro tenant.
  v := pg_temp.intenta('accounting-B', format(
    'select count(*) from public.claim_indemnity_entry_codes(array[%L]::uuid[])', pg_temp.fid('reclamo-A')));
  perform pg_temp.afirmar((v ->> 'valor')::bigint = 0, 'accounting-B ve el código de un reclamo del tenant A');
  -- Devuelve sólo dos columnas: nada de montos.
  perform pg_temp.afirmar((select pg_catalog.array_agg(a.attname order by a.attnum) from pg_catalog.pg_proc p,
      unnest(p.proargnames) with ordinality a(attname, attnum)
     where p.oid = 'public.claim_indemnity_entry_codes(uuid[])'::regprocedure and p.proargmodes[a.attnum] = 't')
    = array['claim_id', 'entry_code']::text[], 'la RPC de reclamos devuelve más que (claim_id, entry_code)');
  perform pg_temp.afirmar(not has_function_privilege('anon', 'public.claim_indemnity_entry_codes(uuid[])', 'execute'),
    'anon puede ejecutar la RPC de reclamos');
end;
$reclamos$;

-- ── Gastos: support no escribe; el resto carga los suyos ──
do $gastos$
declare
  v jsonb;
  v_actor text;
  v_sql text;
begin
  foreach v_actor in array array['commercial-A', 'operations-A', 'warehouse-A', 'marketing-A', 'support-A'] loop
    v_sql := format('insert into public.expenses (tenant_id, user_id, expense_code, amount, category, scope, amount_usd) '
      'values (%L, %L, %L, 5, ''taxi'', ''external'', 5)',
      pg_temp.fid('tenant-A'), pg_temp.fid(v_actor), 'EXP-0528-NEW-' || v_actor);
    v := pg_temp.intenta(v_actor, v_sql);
    if v_actor = 'support-A' then
      perform pg_temp.afirmar((v ->> 'ok')::boolean is false and v ->> 'sqlstate' = '42501',
        format('support-A pudo crear un gasto (%s)', v));
    else
      perform pg_temp.afirmar((v ->> 'ok')::boolean,
        format('%s ya no puede cargar su propio gasto (%s)', v_actor, v));
    end if;
  end loop;
  -- Nadie carga un gasto a nombre de otro.
  v := pg_temp.intenta('commercial-A', format(
    'insert into public.expenses (tenant_id, user_id, expense_code, amount, category, scope, amount_usd) '
    'values (%L, %L, ''EXP-0528-AJENO'', 5, ''taxi'', ''external'', 5)',
    pg_temp.fid('tenant-A'), pg_temp.fid('operations-A')));
  perform pg_temp.afirmar((v ->> 'ok')::boolean is false, 'commercial-A cargó un gasto a nombre de operations-A');
  -- UPDATE del dueño: support no, el resto sí.
  v := pg_temp.intenta('support-A', format('update public.expenses set note = ''x'' where id = %L',
    pg_temp.fid('gasto-de-support')));
  perform pg_temp.afirmar((v ->> 'ok')::boolean and (v ->> 'filas')::bigint = 0,
    format('support-A editó su gasto (%s)', v));
  v := pg_temp.intenta('commercial-A', format('update public.expenses set note = ''x'' where id = %L',
    pg_temp.fid('gasto-de-commercial')));
  perform pg_temp.afirmar((v ->> 'ok')::boolean and (v ->> 'filas')::bigint = 1,
    format('commercial-A no pudo editar su gasto (%s)', v));
end;
$gastos$;

-- ── Lo que no se toca ───────────────────────────────────────
do $intacto$
begin
  perform pg_temp.afirmar(not exists (
    select definition from baseline_policies
    except select to_jsonb(p) from pg_catalog.pg_policies p), 'la 0528 cambió una policy ajena');
  perform pg_temp.afirmar(not exists (
    select c.oid, c.relacl from pg_class c join baseline_acl b using (oid)
     where c.relacl is distinct from b.relacl), 'la 0528 cambió una ACL');
  perform pg_temp.afirmar(not exists (
    select kind, row_data from baseline_rows
    except (select 'asiento', to_jsonb(e) from public.journal_entries e
      union all select 'linea', to_jsonb(l) from public.journal_lines l
      union all select 'recibo', to_jsonb(r) from public.payment_receipts r
      union all select 'cxp', to_jsonb(b) from public.supplier_bills b
      union all select 'pago', to_jsonb(p) from public.supplier_payments p)), 'la 0528 cambió filas');
  -- Las escrituras de la 0470/0511 siguen ahí: la 0528 sólo cambia SELECT.
  perform pg_temp.afirmar((select count(*) from pg_catalog.pg_policies
     where tablename = 'journal_entries' and policyname like 'journal_entries_accounting_%') = 3,
    'faltan las policies de escritura de asientos');
  perform pg_temp.afirmar(not exists (select 1 from pg_catalog.pg_policies
     where tablename in ('journal_entries', 'journal_lines', 'payment_receipts', 'supplier_bills', 'supplier_payments')
       and cmd = 'SELECT' and policyname like '%team_select'), 'queda una policy *_team_select');
end;
$intacto$;

select 'TEST 0528 GREEN: ' || (select last_value from pg_temp.aserciones) || ' aserciones' as resultado;
rollback;
