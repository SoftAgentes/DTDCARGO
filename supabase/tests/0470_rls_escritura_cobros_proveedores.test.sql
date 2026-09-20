\set ON_ERROR_STOP on

-- Contrato desechable de la 0470 (SDD-0492). Fixture sintética y ROLLBACK.
-- Aplica las migraciones REALES de facturas (0077), contabilidad (0078),
-- cobranzas (0079, 0122), tesorería (0088), RLS (0230, 0407), auditoría
-- (0258/0261/0267) y D2 (0290, 0294), más la 0467, y encima la 0470.
--
-- Prueba la matriz de roles sobre payment_receipts, suppliers, supplier_bills y
-- supplier_payments: leer es del equipo del tenant, escribir es de accounting y
-- admin, y nadie borra desde la API. Además, que la 0467 sigue funcionando
-- encima y que las envolturas de la 0294 ahora exigen rol.
--
-- CONTROL ROJO: con `-v apply_fix=false` la 0470 no se aplica y la primera
-- aserción de escritura falla, porque el comercial puede insertar un cobro.
-- En CI, que no tiene Docker, este mismo contrato corre en PGlite:
-- lib/studio/__tests__/rls-escritura-cobros-proveedores.migration.test.ts.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0470: fixture rechazada, la base ya contiene objetos de aplicación';
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
-- El cuerpo exacto de la 0200 y de la 0351: la 0470 los fija por md5.
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
-- 0077 apunta a shipments; 0122 hace backfill por shipment_service.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- Plataforma legacy mínima de 0267, igual que el contrato 0467.
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
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql
\ir ../migrations/0407_invoices_write_rbac.sql
\ir ../migrations/0467_cobro_factura_atomico.sql

-- Supabase le da a service_role todo sobre public por default privileges: la
-- ACL de producción de las 4 tablas es {authenticated=arwd, service_role=arwdDxtm}
-- y anon no tiene nada (0465). La fixture lo replica para poder comprobarlo.
grant all on all tables in schema public to service_role;

create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0470-synthetic-' || p_label)::uuid
$$;

-- Un usuario por rol en el tenant A, uno desactivado, y accounting en B.
insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A', 'operations-A',
  'warehouse-A', 'support-A', 'marketing-A', 'accounting-off', 'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0470', 'Tenant A 0470'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0470', 'Tenant B 0470');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('accounting-A', 'tenant-A', 'accounting', false), ('admin-A', 'tenant-A', 'admin', false),
  ('commercial-A', 'tenant-A', 'commercial', false), ('operations-A', 'tenant-A', 'operations', false),
  ('warehouse-A', 'tenant-A', 'warehouse', false), ('support-A', 'tenant-A', 'support', false),
  ('marketing-A', 'tenant-A', 'marketing', false), ('accounting-off', 'tenant-A', 'accounting', true),
  ('accounting-B', 'tenant-B', 'accounting', false)
) v(u, t, r, off);
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fid('cash-' || t), pg_temp.fid('tenant-' || t), '1.1.1.1', 'Banco ' || t, 'A', true
from unnest(array['A', 'B']) t;
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fid('gasto-' || t), pg_temp.fid('tenant-' || t), '5.1.1.1', 'Gasto ' || t, 'G', true
from unnest(array['A', 'B']) t;
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
  base_amount, total_amount, paid_amount, status, fund_class)
select pg_temp.fid(v.label), pg_temp.fid(v.tenant), v.code, 'DTD-0470', 'Cliente 0470', 'USD',
  v.total, v.total, 0, 'emitida'::public.invoice_status, 'third_party'
from (values
  ('inv-A', 'tenant-A', 'F-0470-A', 5000), ('inv-A2', 'tenant-A', 'F-0470-A2', 5000),
  ('inv-B', 'tenant-B', 'F-0470-B', 1000)
) v(label, tenant, code, total);
insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name,
  amount, currency, method, cash_account_id, received_at, application_status, fund_class)
select pg_temp.fid(v.label), pg_temp.fid(v.tenant), v.code, pg_temp.fid(v.invoice), 'DTD-0470',
  'Cliente 0470', 100, 'USD', 'transferencia', pg_temp.fid('cash-' || v.suf), date '2026-05-20',
  'aplicado', 'third_party'
from (values
  ('rec-A', 'tenant-A', 'R-0470-0001', 'inv-A', 'A'), ('rec-A-void', 'tenant-A', 'R-0470-0002', 'inv-A', 'A'),
  ('rec-B', 'tenant-B', 'R-0470-0003', 'inv-B', 'B')
) v(label, tenant, code, invoice, suf);
insert into public.suppliers (id, tenant_id, supplier_code, name)
select pg_temp.fid('sup-' || t), pg_temp.fid('tenant-' || t), 'PRV-0001', 'Proveedor ' || t
from unnest(array['A', 'B']) t;
-- El segundo proveedor del tenant A, sin CxP: así cada tabla tiene 2 filas de A.
insert into public.suppliers (id, tenant_id, supplier_code, name)
values (pg_temp.fid('sup-A2'), pg_temp.fid('tenant-A'), 'PRV-0002', 'Proveedor A 2');
insert into public.supplier_bills (id, tenant_id, bill_code, supplier_id, supplier_name,
  expense_account_id, total_amount, paid_amount, status, due_date)
select pg_temp.fid(v.label), pg_temp.fid('tenant-' || v.suf), v.code, pg_temp.fid('sup-' || v.suf),
  'Proveedor ' || v.suf, pg_temp.fid('gasto-' || v.suf), 1000, 0, 'pendiente', date '2026-06-30'
from (values ('bill-A', 'CXP-2026-0001', 'A'), ('bill-A-void', 'CXP-2026-0002', 'A'),
             ('bill-B', 'CXP-2026-0003', 'B')) v(label, code, suf);
insert into public.supplier_payments (id, tenant_id, payment_code, bill_id, supplier_id, supplier_name,
  amount, cash_account_id)
select pg_temp.fid(v.label), pg_temp.fid('tenant-' || v.suf), v.code, pg_temp.fid(v.bill),
  pg_temp.fid('sup-' || v.suf), 'Proveedor ' || v.suf, 100, pg_temp.fid('cash-' || v.suf)
from (values ('pay-A', 'OP-2026-0001', 'bill-A', 'A'), ('pay-A-void', 'OP-2026-0002', 'bill-A', 'A'),
             ('pay-B', 'OP-2026-0003', 'bill-B', 'B')) v(label, code, bill, suf);

-- Lo que la 0470 NO puede tocar.
create temporary table baseline_policies as
select to_jsonb(p) as definition from pg_catalog.pg_policies p
where p.tablename not in ('payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments');
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
  and c.relname not in ('payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')
  and p.proname not in ('void_payment_receipt_with_audit_reason', 'void_supplier_bill_with_audit_reason',
                        'void_supplier_payment_with_audit_reason');
create temporary table baseline_rows as
select 'receipt' as kind, to_jsonb(r) as row_data from public.payment_receipts r
union all select 'supplier', to_jsonb(s) from public.suppliers s
union all select 'bill', to_jsonb(b) from public.supplier_bills b
union all select 'payment', to_jsonb(p) from public.supplier_payments p;

\if :apply_fix
\ir ../migrations/0470_rls_escritura_cobros_proveedores.sql
\endif

-- ── Aserciones ──────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0470: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Corre p_sql como el actor (rol de la API + su auth.uid) y cuenta filas o
-- devuelve el error. No reemplaza autorización: la da la RLS real.
create function pg_temp.intenta(p_actor text, p_sql text, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_filas bigint := 0; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    execute p_sql;
    get diagnostics v_filas = row_count;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v_filas);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- Cuenta lo que el actor ve de ese tenant: un accounting del tenant B sigue
-- viendo lo suyo, así que la pregunta siempre es por tenant.
create function pg_temp.cuenta(p_actor text, p_tabla text, p_tenant text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.fid(p_actor)::text, true);
  set local role authenticated;
  execute format('select count(*) from public.%I where tenant_id = %L', p_tabla,
    pg_temp.fid('tenant-' || p_tenant)) into v;
  reset role;
  return v;
end;
$$;

-- El alta mínima de cada tabla, con el tenant que se le pida.
create function pg_temp.alta_sql(p_tabla text, p_tenant text, p_suf text) returns text
language sql immutable as $$
  select case p_tabla
    when 'payment_receipts' then format(
      $q$insert into public.payment_receipts (tenant_id, receipt_code, invoice_id, client_markbox,
        client_name, amount, currency, method, cash_account_id, received_at, application_status, fund_class)
        values (%L, %L, %L, 'DTD-0470', 'Cliente 0470', 50, 'USD', 'transferencia', %L, current_date,
        'aplicado', 'third_party')$q$,
      pg_temp.fid('tenant-' || p_tenant), 'R-0470-NEW-' || p_suf, pg_temp.fid('inv-' || p_tenant),
      pg_temp.fid('cash-' || p_tenant))
    when 'suppliers' then format(
      $q$insert into public.suppliers (tenant_id, supplier_code, name) values (%L, %L, 'Proveedor nuevo')$q$,
      pg_temp.fid('tenant-' || p_tenant), 'PRV-NEW-' || p_suf)
    when 'supplier_bills' then format(
      $q$insert into public.supplier_bills (tenant_id, bill_code, supplier_id, supplier_name,
        expense_account_id, total_amount, due_date)
        values (%L, %L, %L, 'Proveedor', %L, 500, current_date)$q$,
      pg_temp.fid('tenant-' || p_tenant), 'CXP-NEW-' || p_suf, pg_temp.fid('sup-' || p_tenant),
      pg_temp.fid('gasto-' || p_tenant))
    when 'supplier_payments' then format(
      $q$insert into public.supplier_payments (tenant_id, payment_code, bill_id, supplier_id,
        supplier_name, amount, cash_account_id)
        values (%L, %L, %L, %L, 'Proveedor', 50, %L)$q$,
      pg_temp.fid('tenant-' || p_tenant), 'OP-NEW-' || p_suf, pg_temp.fid('bill-' || p_tenant),
      pg_temp.fid('sup-' || p_tenant), pg_temp.fid('cash-' || p_tenant))
  end
$$;

create function pg_temp.fila(p_tabla text, p_suf text) returns uuid language sql immutable as $$
  select case p_tabla
    when 'payment_receipts' then pg_temp.fid('rec-' || p_suf)
    when 'suppliers' then pg_temp.fid('sup-' || p_suf)
    when 'supplier_bills' then pg_temp.fid('bill-' || p_suf)
    when 'supplier_payments' then pg_temp.fid('pay-' || p_suf)
  end
$$;

do $matriz$
declare
  v_tablas text[] := array['payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments'];
  v_financieros text[] := array['accounting-A', 'admin-A'];
  v_otros text[] := array['commercial-A', 'operations-A', 'warehouse-A', 'support-A', 'marketing-A'];
  v_t text; v_actor text; v_r jsonb; v_base bigint; v_i integer := 0;
begin
  foreach v_t in array v_tablas loop
    -- 1. Leer no cambia: todo el equipo activo del tenant ve las mismas filas.
    v_base := pg_temp.cuenta('accounting-A', v_t, 'A');
    perform pg_temp.afirmar(v_base = 2, format('accounting no ve las 2 filas de %s del tenant A', v_t));
    foreach v_actor in array v_otros loop
      perform pg_temp.afirmar(pg_temp.cuenta(v_actor, v_t, 'A') = v_base,
        format('%s dejó de leer %s del tenant A', v_actor, v_t));
    end loop;

    -- 2. Dar de alta es de accounting y admin.
    foreach v_actor in array v_financieros loop
      v_i := v_i + 1;
      v_r := pg_temp.intenta(v_actor, pg_temp.alta_sql(v_t, 'A', v_i::text));
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean,
        format('%s no pudo dar de alta en %s: %s', v_actor, v_t, v_r ->> 'mensaje'));
    end loop;
    foreach v_actor in array v_otros loop
      v_i := v_i + 1;
      v_r := pg_temp.intenta(v_actor, pg_temp.alta_sql(v_t, 'A', v_i::text));
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
        format('%s pudo dar de alta en %s (%s)', v_actor, v_t, coalesce(v_r ->> 'sqlstate', 'sin error')));
    end loop;

    -- 3. Editar es de accounting y admin; al resto no le alcanza ninguna fila.
    foreach v_actor in array v_financieros loop
      v_r := pg_temp.intenta(v_actor, format('update public.%I set deleted_at = null where id = %L',
        v_t, pg_temp.fila(v_t, 'A')));
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::bigint = 1,
        format('%s no pudo editar %s', v_actor, v_t));
    end loop;
    foreach v_actor in array v_otros loop
      v_r := pg_temp.intenta(v_actor, format('update public.%I set deleted_at = null where id = %L',
        v_t, pg_temp.fila(v_t, 'A')));
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::bigint = 0,
        format('%s editó %s (%s filas)', v_actor, v_t, coalesce(v_r ->> 'filas', v_r ->> 'sqlstate')));
    end loop;

    -- 4. Borrar no lo puede nadie por la API, ni accounting.
    foreach v_actor in array v_financieros || v_otros loop
      v_r := pg_temp.intenta(v_actor, format('delete from public.%I where id = %L', v_t,
        pg_temp.fila(v_t, 'A')));
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
        format('%s borró de %s', v_actor, v_t));
    end loop;

    -- 5. El tenant ajeno y el desactivado no leen ni escriben lo de este tenant.
    perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', v_t, 'A') = 0,
      format('accounting del tenant B ve filas de %s del tenant A', v_t));
    v_r := pg_temp.intenta('accounting-B', format('update public.%I set deleted_at = null where id = %L',
      v_t, pg_temp.fila(v_t, 'A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::bigint = 0,
      format('accounting del tenant B editó %s del tenant A', v_t));
    perform pg_temp.afirmar(pg_temp.cuenta('accounting-off', v_t, 'A') = 0,
      format('un accounting desactivado lee %s', v_t));
    v_r := pg_temp.intenta('accounting-off', pg_temp.alta_sql(v_t, 'A', 'off-' || v_t));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
      format('un accounting desactivado dio de alta en %s', v_t));
  end loop;

  -- 6. service_role conserva su borrado para jobs y RPC controladas. Va en el
  --    orden de las FK (orden de pago → CxP → proveedor) y sobre el tenant B.
  foreach v_t in array array['supplier_payments', 'supplier_bills', 'suppliers', 'payment_receipts'] loop
    v_r := pg_temp.intenta(null, format('delete from public.%I where id = %L', v_t,
      pg_temp.fila(v_t, 'B')), 'service_role');
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::bigint = 1,
      format('service_role no pudo borrar de %s: %s', v_t, coalesce(v_r ->> 'mensaje', 'sin error')));
  end loop;

  -- 7. El soft delete de accounting sigue pasando (la trampa de la 0230).
  v_r := pg_temp.intenta('accounting-A',
    format('update public.payment_receipts set deleted_at = now() where id = %L', pg_temp.fid('rec-A-void')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::bigint = 1,
    'accounting no pudo anular un cobro con deleted_at');
end;
$matriz$;

do $envolturas$
declare v_r jsonb;
begin
  -- 8. Las envolturas de la 0294 exigen accounting o admin.
  v_r := pg_temp.intenta('commercial-A', format('select public.void_payment_receipt_with_audit_reason(%L, %L)',
    pg_temp.fid('rec-A'), 'Devuelto al cliente'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
    'el comercial pudo llamar a void_payment_receipt_with_audit_reason');
  v_r := pg_temp.intenta('commercial-A', format('select public.void_supplier_bill_with_audit_reason(%L, %L)',
    pg_temp.fid('bill-A-void'), 'CxP cargada por error'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
    'el comercial pudo llamar a void_supplier_bill_with_audit_reason');
  v_r := pg_temp.intenta('commercial-A', format('select public.void_supplier_payment_with_audit_reason(%L, %L)',
    pg_temp.fid('pay-A-void'), 'Orden duplicada'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false and v_r ->> 'sqlstate' = '42501',
    'el comercial pudo llamar a void_supplier_payment_with_audit_reason');

  -- 9. Y siguen funcionando para quien sí tiene el rol.
  v_r := pg_temp.intenta('accounting-A', format('select public.void_supplier_bill_with_audit_reason(%L, %L)',
    pg_temp.fid('bill-A-void'), 'CxP cargada por error'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean, 'accounting no pudo anular la CxP: ' || coalesce(v_r ->> 'mensaje', ''));
  perform pg_temp.afirmar(
    (select status from public.supplier_bills where id = pg_temp.fid('bill-A-void')) = 'anulada',
    'la CxP no quedó anulada');
  v_r := pg_temp.intenta('admin-A', format('select public.void_supplier_payment_with_audit_reason(%L, %L)',
    pg_temp.fid('pay-A-void'), 'Orden duplicada'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean, 'admin no pudo anular la orden de pago');
  perform pg_temp.afirmar(
    (select deleted_at is not null from public.supplier_payments where id = pg_temp.fid('pay-A-void')),
    'la orden de pago no quedó anulada');

  -- 10. La razón humana sigue llegando a la auditoría D2 (0267: columna reason).
  perform pg_temp.afirmar(exists (
    select 1 from public.entity_audit_log a
     where a.entity_id = pg_temp.fid('bill-A-void') and a.event_type = 'bill_voided'
       and a.reason = 'CxP cargada por error'),
    'la anulación de la CxP no dejó la razón en la auditoría D2');
end;
$envolturas$;

do $sobre_0467$
declare v_r jsonb; v_id uuid;
begin
  -- 11. Las RPC de la 0467 siguen funcionando encima de la 0470.
  v_r := pg_temp.intenta('accounting-A', format(
    'select public.register_collection_receipt(%L, 100, %L, %L, current_date, null, null, null, null, null, false)',
    pg_temp.fid('inv-A2'), pg_temp.fid('cash-A'), 'transferencia'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean,
    'accounting no pudo cobrar con la 0467: ' || coalesce(v_r ->> 'mensaje', ''));
  perform pg_temp.afirmar(
    (select paid_amount from public.invoices where id = pg_temp.fid('inv-A2')) = 100,
    'el cobro de la 0467 no llegó a la factura');
  select id into v_id from public.payment_receipts
   where tenant_id = pg_temp.fid('tenant-A') and invoice_id = pg_temp.fid('inv-A2') and deleted_at is null
   order by created_at desc limit 1;
  v_r := pg_temp.intenta('accounting-A', format('select public.void_collection_receipt(%L, %L)',
    v_id, 'Pago devuelto al cliente'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean,
    'accounting no pudo anular el cobro con la 0467: ' || coalesce(v_r ->> 'mensaje', ''));
  perform pg_temp.afirmar(
    (select paid_amount from public.invoices where id = pg_temp.fid('inv-A2')) = 0,
    'la anulación de la 0467 no bajó el pagado');

  -- 12. Y el comercial sigue rebotando en el chequeo de la propia 0467.
  v_r := pg_temp.intenta('commercial-A', format(
    'select public.register_collection_receipt(%L, 100, %L, %L, current_date, null, null, null, null, null, false)',
    pg_temp.fid('inv-A'), pg_temp.fid('cash-A'), 'transferencia'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false,
    'el comercial pudo cobrar con la RPC de la 0467');
end;
$sobre_0467$;

do $forma$
declare v_t text; v_fn text;
begin
  -- 13. La forma: tres policies por tabla, sin la FOR ALL heredada.
  foreach v_t in array array['payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments'] loop
    perform pg_temp.afirmar(exists (
      select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = v_t
        and p.policyname = v_t || '_team_select' and p.cmd = 'SELECT'
        and p.roles = array['authenticated']::name[] and p.qual like '%get_user_tenant_id%'
        and p.qual not like '%current_studio_role%'),
      format('%s no tiene su policy de lectura del equipo', v_t));
    perform pg_temp.afirmar((select count(*) from pg_policies p
      where p.schemaname = 'public' and p.tablename = v_t) = 3,
      format('%s no quedó con exactamente 3 policies', v_t));
    perform pg_temp.afirmar(not exists (select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = v_t and p.cmd in ('ALL', 'DELETE')),
      format('%s conserva una policy FOR ALL o de DELETE', v_t));
    perform pg_temp.afirmar(
      has_table_privilege('authenticated', 'public.' || v_t, 'SELECT')
      and has_table_privilege('authenticated', 'public.' || v_t, 'INSERT')
      and has_table_privilege('authenticated', 'public.' || v_t, 'UPDATE')
      and not has_table_privilege('authenticated', 'public.' || v_t, 'DELETE')
      and has_table_privilege('service_role', 'public.' || v_t, 'DELETE')
      and not has_table_privilege('anon', 'public.' || v_t, 'SELECT,INSERT,UPDATE,DELETE'),
      format('la ACL de %s no quedó como se esperaba', v_t));
  end loop;

  -- 14. Las envolturas conservan su forma: INVOKER, search_path vacío y ACL.
  foreach v_fn in array array['void_payment_receipt_with_audit_reason',
    'void_supplier_bill_with_audit_reason', 'void_supplier_payment_with_audit_reason'] loop
    perform pg_temp.afirmar(exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_fn and not p.prosecdef
         and p.proconfig = array['search_path=""']::text[]
         and p.prosrc like '%assert_studio_role%'),
      format('%s no quedó INVOKER con search_path vacío y el assert', v_fn));
    perform pg_temp.afirmar(
      has_function_privilege('authenticated', format('public.%s(uuid,text)', v_fn), 'EXECUTE')
      and not has_function_privilege('anon', format('public.%s(uuid,text)', v_fn), 'EXECUTE'),
      format('la ACL de %s cambió', v_fn));
  end loop;
end;
$forma$;

do $sin_efectos$
begin
  -- 15. La 0470 no toca nada más.
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select to_jsonb(p) as definition from pg_catalog.pg_policies p
      where p.tablename not in ('payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments')
    ) ahora full join baseline_policies b on b.definition = ahora.definition
    where b.definition is null or ahora.definition is null),
    'cambiaron policies de otras tablas');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select c.oid, c.relacl from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
        and c.relname not in ('payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments')
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
        and p.proname not in ('void_payment_receipt_with_audit_reason', 'void_supplier_bill_with_audit_reason',
                              'void_supplier_payment_with_audit_reason')
    ) ahora full join baseline_functions b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió alguna función que no es una envoltura');
end;
$sin_efectos$;

select 'TEST 0470 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
