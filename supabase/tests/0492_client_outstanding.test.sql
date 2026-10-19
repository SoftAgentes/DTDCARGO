\set ON_ERROR_STOP on
-- SDD-0558 · Contrato de 0492: el saldo único por cliente,
-- public.client_outstanding(uuid[]). Fixture sintético aislado; no ejecutar
-- sobre una DB real. El esquema mínimo y los cuerpos exactos de los helpers que
-- 0492 reutiliza vienen de _0492_client_outstanding_schema.sql; aplica la 0492
-- REAL con \ir y termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0492_client_outstanding.test.sql
--
-- Cada regla tiene su cliente propio, así un mutante de esa regla cae en su
-- aserción y no en otra. El cliente DTD-0001 junta todo al final.
-- Las fechas son relativas a «hoy en Caracas» (c), que el fixture calcula con
-- el mismo now() de la transacción.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
\ir _0492_client_outstanding_schema.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0492-synthetic-' || p_label)::uuid
$$;
create function pg_temp.c(p_days integer default 0) returns date language sql stable as $$
  select (now() at time zone 'America/Caracas')::date + p_days
$$;

insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0492', 'Tenant A 0492'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0492', 'Tenant B 0492');
insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'commercial-A',
  'operations-A', 'support-A', 'warehouse-A', 'marketing-A', 'disabled-A', 'double',
  'commercial-B', 'warehouse-B', 'unlinked']) u;
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r, case when d then now() end from (values
  ('admin-A', 'tenant-A', 'admin', false), ('accounting-A', 'tenant-A', 'accounting', false),
  ('commercial-A', 'tenant-A', 'commercial', false), ('operations-A', 'tenant-A', 'operations', false),
  ('support-A', 'tenant-A', 'support', false), ('warehouse-A', 'tenant-A', 'warehouse', false),
  ('marketing-A', 'tenant-A', 'marketing', false), ('disabled-A', 'tenant-A', 'commercial', true),
  ('double', 'tenant-A', 'commercial', false), ('double', 'tenant-B', 'commercial', false),
  ('commercial-B', 'tenant-B', 'commercial', false), ('warehouse-B', 'tenant-B', 'warehouse', false)
) v(u, t, r, d);
-- Overrides por tenant: support pierde clients en A, warehouse lo gana en A,
-- accounting lo pierde en A (y aun así ve el saldo: decisión 14 de Sam) y
-- commercial lo pierde SOLO en B.
insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
select pg_temp.fixture_id(t), r, 'clients', v, false from (values
  ('tenant-A', 'support', false), ('tenant-A', 'warehouse', true),
  ('tenant-A', 'accounting', false), ('tenant-B', 'commercial', false)
) o(t, r, v);

-- Las fichas. c-merged y c-merged2 están fusionadas (borradas, con su código);
-- c1-merged y c1-merged2 cuelgan de c1. c-deleted está borrada sin fusionar.
insert into public.clients (id, tenant_id, markbox, name, deleted_at, merged_into_client_id)
select pg_temp.fixture_id(l), pg_temp.fixture_id(t), m, 'Cliente ' || l,
  case when d then now() end, case when p is null then null else pg_temp.fixture_id(p) end
from (values
  ('c1',          'tenant-A', 'DTD-0001', false, null),
  ('c1-merged',   'tenant-A', 'DTD-0002', true,  'c1'),
  ('c1-merged2',  'tenant-A', 'DTD-0003', true,  'c1-merged'),
  ('c-empty',     'tenant-A', 'DTD-0004', false, null),
  ('c-deleted',   'tenant-A', 'DTD-0005', true,  null),
  ('c-other',     'tenant-A', 'DTD-0006', false, null),
  ('c-norm',      'tenant-A', 'DTD-0007', false, null),
  ('c-borr',      'tenant-A', 'DTD-0011', false, null),
  ('c-anul',      'tenant-A', 'DTD-0012', false, null),
  ('c-elim',      'tenant-A', 'DTD-0013', false, null),
  ('c-sobre',     'tenant-A', 'DTD-0014', false, null),
  ('c-hist',      'tenant-A', 'DTD-0021', false, null),
  ('c-merge',     'tenant-A', 'DTD-0022', false, null),
  ('c-merged',    'tenant-A', 'DTD-0122', true,  'c-merge'),
  ('c-merged2',   'tenant-A', 'DTD-0222', true,  'c-merged'),
  ('c-tenant',    'tenant-A', 'DTD-0031', false, null),
  ('c-due',       'tenant-A', 'DTD-0041', false, null),
  ('c-pago',      'tenant-A', 'DTD-0051', false, null),
  ('c-B',         'tenant-B', 'DTD-0031', false, null)
) v(l, t, m, d, p);
-- c1-merged se insertó con merged_into apuntando a c1, que ya existe; el orden
-- de la lista lo garantiza.
insert into public.client_markbox_history (tenant_id, client_id, markbox)
select pg_temp.fixture_id(t), pg_temp.fixture_id(l), m from (values
  ('tenant-A', 'c1', 'DTD-0100'), ('tenant-A', 'c1-merged', 'DTD-0200'),
  ('tenant-A', 'c-hist', 'DTD-0121')
) v(t, l, m);

insert into public.invoices (id, tenant_id, invoice_code, client_markbox, currency, total_amount,
  paid_amount, status, issued_at, due_date, last_payment_at, deleted_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), 'F-' || v.label, v.markbox,
  v.currency::public.invoice_currency, v.total, v.paid, v.status::public.invoice_status,
  pg_temp.c(-90), case when v.due is null then null else pg_temp.c(v.due) end,
  case when v.lastpay is null then null
       else (pg_temp.c(v.lastpay) + time '12:00') at time zone 'America/Caracas' end,
  case when v.archived then now() end
from (values
  -- c1: código vigente, historial, fusión y fusión encadenada, más lo que no cuenta.
  ('i1',     'tenant-A', 'DTD-0001',   'USD',  100,    0, 'emitida',  -40,  null::integer, false),
  ('i2',     'tenant-A', 'DTD-0100',   'USD',  200,   50, 'parcial',  -10,  null, false),
  ('i3',     'tenant-A', 'DTD-0002',   'USD',   70,    0, 'emitida',   10,  null, false),
  ('i4',     'tenant-A', 'DTD-0003',   'USD',   20,    0, 'vencida',    0,  null, false),
  ('i5',     'tenant-A', 'DTD-0200',   'USD',   30,    0, 'emitida', null,  null, false),
  ('i6',     'tenant-A', 'DTD-0001',   'USD',  500,  500, 'pagada',   -30,  null, false),
  ('i7',     'tenant-A', 'DTD-0001',   'USD',  900,    0, 'borrador', -60,  null, false),
  ('i8',     'tenant-A', 'DTD-0001',   'USD',  800,  100, 'anulada',  -60,  null, false),
  ('i9',     'tenant-A', 'DTD-0001',   'USD', 1000,    0, 'emitida',  -90,  null, true),
  ('i10',    'tenant-A', 'DTD-0001',   'USD',  100,  150, 'pagada',   -20,  null, false),
  ('i11',    'tenant-A', 'DTD-0001',   'VES',  900,    0, 'emitida',    5,  null, false),
  -- Otro cliente y otro tenant con el mismo código: no suman a c1.
  ('i12',    'tenant-B', 'DTD-0001',   'USD', 5000,    0, 'emitida',  -40,  null, false),
  ('i13',    'tenant-A', 'DTD-0006',   'USD',  333,    0, 'emitida',  -40,  null, false),
  -- Una regla por cliente.
  ('i-norm', 'tenant-A', ' dtd-0007 ', 'USD',   44,    0, 'emitida',   -3,  null, false),
  ('i-borr', 'tenant-A', 'DTD-0011',   'USD',  900,    0, 'borrador', -60,  null, false),
  ('i-anul', 'tenant-A', 'DTD-0012',   'USD',  800,  100, 'anulada',  -60,  null, false),
  ('i-elim', 'tenant-A', 'DTD-0013',   'USD', 1000,    0, 'emitida',  -90,  null, true),
  ('i-sob1', 'tenant-A', 'DTD-0014',   'USD',  100,  150, 'pagada',   -20,  null, false),
  ('i-sob2', 'tenant-A', 'DTD-0014',   'USD',   80,    0, 'emitida',   10,  null, false),
  ('i-hist', 'tenant-A', 'DTD-0121',   'USD',   10,    0, 'emitida',   10,  null, false),
  ('i-mrg1', 'tenant-A', 'DTD-0122',   'USD',   10,    0, 'emitida',   10,  null, false),
  ('i-mrg2', 'tenant-A', 'DTD-0222',   'USD',    5,    0, 'emitida',   10,  null, false),
  ('i-ten',  'tenant-A', 'DTD-0031',   'USD',    7,    0, 'emitida',   10,  null, false),
  ('i-tenB', 'tenant-B', 'DTD-0031',   'USD', 5000,    0, 'emitida',   10,  null, false),
  ('i-due0', 'tenant-A', 'DTD-0041',   'USD',   10,    0, 'emitida',    0,  null, false),
  ('i-due1', 'tenant-A', 'DTD-0041',   'USD',   20,    0, 'emitida',   -1,  null, false),
  ('i-pag1', 'tenant-A', 'DTD-0051',   'USD',  100,   40, 'parcial',   10,  -1, false),
  ('i-pag2', 'tenant-A', 'DTD-0051',   'USD',  100,   30, 'parcial',   10,  -1, false),
  ('i-pag3', 'tenant-A', 'DTD-0051',   'VES',   50,   50, 'pagada',   -20,  -12, false)
) v(label, tenant, markbox, currency, total, paid, status, due, lastpay, archived);

-- Recibos y reportes. El anulado, el «reportado» y el confirmado borrado son
-- MÁS RECIENTES que los que cuentan: sin su filtro, ganarían el «último pago».
insert into public.payment_receipts (id, tenant_id, invoice_id, amount, received_at, deleted_at)
select pg_temp.fixture_id(l), pg_temp.fixture_id('tenant-A'),
  case when i is null then null else pg_temp.fixture_id(i) end, a, pg_temp.c(d),
  case when x then now() end
from (values
  ('r-anul', 'i-anul', 100,  -5, false),
  ('r-pag1', 'i-pag1',  40, -20, false),
  ('r-void', 'i-pag1',  10,  -2, true),
  ('r-sinref', null,    10,  -1, false),
  ('r-i8',   'i8',     100,  -5, false),
  ('r-i2',   'i2',      50,  -8, false)
) v(l, i, a, d, x);
insert into public.payment_reports (id, tenant_id, invoice_id, amount, paid_at, status, deleted_at)
select pg_temp.fixture_id(l), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id(i), a,
  pg_temp.c(d), s::public.payment_report_status, case when x then now() end
from (values
  ('p-conf',  'i-pag2', 30, -15, 'confirmado', false),
  ('p-rep',   'i-pag2', 20,  -1, 'reportado',  false),
  ('p-del',   'i-pag2', 20,  -4, 'confirmado', true),
  ('p-rech',  'i-pag2', 20,  -3, 'rechazado',  false)
) v(l, i, a, d, s, x);

create temporary table baseline_policies as select to_jsonb(p) as definition from pg_catalog.pg_policies p;
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as
select 'invoice' as kind, to_jsonb(i) as row_data from public.invoices i
union all select 'client', to_jsonb(c) from public.clients c
union all select 'receipt', to_jsonb(r) from public.payment_receipts r
union all select 'report', to_jsonb(p) from public.payment_reports p;
create temporary view current_rows as
select 'invoice' as kind, to_jsonb(i) as row_data from public.invoices i
union all select 'client', to_jsonb(c) from public.clients c
union all select 'receipt', to_jsonb(r) from public.payment_receipts r
union all select 'report', to_jsonb(p) from public.payment_reports p;

\if :apply_fix
\ir ../migrations/0492_client_outstanding.sql
\endif

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0492: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
-- La función real bajo el rol API y los claims de la fixture. `p_tz` cambia la
-- zona horaria de la sesión solo durante la llamada.
create function pg_temp.saldo(p_actor text, p_clients text[], p_role text default 'authenticated',
  p_tz text default null) returns jsonb language plpgsql as $$
declare
  v_result jsonb;
  v_tz text := pg_catalog.current_setting('timezone');
  -- Los ids se arman ANTES de cambiar de rol: el rol API no usa pg_temp.
  v_ids uuid[] := case when p_clients is null then null
    else coalesce((select array_agg(pg_temp.fixture_id(x)) from unnest(p_clients) x), '{}'::uuid[]) end;
  v_sql text := format(
    'select coalesce(jsonb_agg(to_jsonb(r) order by r.client_id, r.currency nulls first), ''[]''::jsonb)
     from public.client_outstanding(%L::uuid[]) r', v_ids);
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fixture_id(p_actor)::text end, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  if p_tz is not null then perform set_config('timezone', p_tz, true); end if;
  execute format('set local role %I', p_role);
  execute v_sql into v_result;
  reset role;
  perform set_config('timezone', v_tz, true);
  return v_result;
exception when others then
  reset role;
  perform set_config('timezone', v_tz, true);
  raise;
end;
$$;
-- El SQLSTATE y el mensaje de un rechazo, o null si no hubo.
create function pg_temp.rechazo(p_actor text, p_clients text[], p_role text default 'authenticated')
returns text language plpgsql as $$
declare v_message text; v_state text;
begin
  perform pg_temp.saldo(p_actor, p_clients, p_role);
  return null;
exception when others then
  get stacked diagnostics v_message = message_text, v_state = returned_sqlstate;
  return v_state || ' ' || v_message;
end;
$$;
-- Cuántas filas devuelve, o -1 si la llamada se rechazó: una aserción de
-- acceso falla con su nombre en vez de con el error crudo.
create function pg_temp.filas(p_actor text, p_clients text[], p_role text default 'authenticated')
returns integer language plpgsql as $$
begin
  return jsonb_array_length(pg_temp.saldo(p_actor, p_clients, p_role));
exception when others then
  return -1;
end;
$$;
-- La fila de un cliente en una moneda (null = la fila semilla).
create function pg_temp.fila(p_rows jsonb, p_client text, p_currency text) returns jsonb
language sql as $$
  select r from jsonb_array_elements(p_rows) r
  where r->>'client_id' = pg_temp.fixture_id(p_client)::text
    and r->>'currency' is not distinct from p_currency
$$;
create function pg_temp.abierto(p_actor text, p_client text, p_currency text default 'USD')
returns numeric language sql as $$
  select coalesce((pg_temp.fila(pg_temp.saldo(p_actor, array[p_client]), p_client, p_currency)
    ->>'open_amount')::numeric, 0)
$$;

-- 1. Control rojo.
select pg_temp.assert_true(to_regprocedure('public.client_outstanding(uuid[])') is not null,
  'existe public.client_outstanding(uuid[])');

-- 2. Forma: DEFINER, STABLE, search_path vacío, owner postgres y resultado exacto.
select pg_temp.assert_true(exists (select 1 from pg_proc p
  where p.oid = to_regprocedure('public.client_outstanding(uuid[])')
    and p.prosecdef and p.provolatile = 's' and p.proretset
    and p.proowner = 'postgres'::regrole and p.proconfig = array['search_path=""']
    and pg_get_function_result(p.oid) = 'TABLE(client_id uuid, markboxes text[], currency text, '
      || 'open_amount numeric, overdue_amount numeric, open_invoices integer, overdue_invoices integer, '
      || 'oldest_overdue_due_date date, last_payment_on date, as_of date)'),
  'client_outstanding es DEFINER, STABLE, con search_path vacío, owner postgres y la forma del contrato');

-- 3. ACL: authenticated y service_role; ni anon ni PUBLIC.
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.client_outstanding(uuid[])', 'EXECUTE')
  and has_function_privilege('service_role', 'public.client_outstanding(uuid[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.client_outstanding(uuid[])', 'EXECUTE')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.client_outstanding(uuid[])'::regprocedure and a.grantee = 0),
  'EXECUTE solo para authenticated y service_role');

-- 4. 0492 no toca nada existente.
do $unchanged$
begin
  perform pg_temp.assert_true(not exists (
    (select definition from baseline_policies except select to_jsonb(p) from pg_catalog.pg_policies p)
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p except select definition from baseline_policies)),
    '0492 no cambia ninguna policy');
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_acl b join pg_class c on c.oid = b.oid
    where c.relacl is distinct from b.relacl), '0492 no cambia la ACL de ninguna tabla');
  perform pg_temp.assert_true(
    (select count(*) from pg_trigger t where not t.tgisinternal) = (select count(*) from baseline_triggers),
    '0492 no agrega ni quita triggers');
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_functions b join pg_catalog.pg_proc p on p.oid = b.oid
    where to_jsonb(p) is distinct from b.definition), '0492 no redefine ninguna función previa');
  perform pg_temp.assert_true(not exists (
    (select * from baseline_rows except select * from current_rows)
    union all
    (select * from current_rows except select * from baseline_rows)),
    '0492 no toca ninguna fila al aplicarse');
end;
$unchanged$;

-- 5-8. Quién ve el saldo: decisión 14 de Sam («Todo el que ve clientes»).
select pg_temp.assert_true(
  pg_temp.filas('commercial-A', array['c-empty']) = 1
  and pg_temp.filas('operations-A', array['c-empty']) = 1
  and pg_temp.filas('admin-A', array['c-empty']) = 1
  and pg_temp.filas('warehouse-A', array['c-empty']) = 1,
  'commercial, operations, admin y el warehouse con override de clients ven el saldo');
select pg_temp.assert_true(pg_temp.filas('accounting-A', array['c-empty']) = 1,
  'accounting ve el saldo aunque un override le quite clients');
select pg_temp.assert_true(
  pg_temp.rechazo('support-A', array['c-empty']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('marketing-A', array['c-empty']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('warehouse-B', array['c-B']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('disabled-A', array['c-empty']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('double', array['c-empty']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('unlinked', array['c-empty']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN',
  'sin la vista de clients se rechaza con 42501: support revocado, marketing y warehouse sin override,'
  || ' desactivado, doble membresía y sin membresía');
select pg_temp.assert_true(
  pg_temp.rechazo('commercial-B', array['c-B']) = '42501 CLIENT_OUTSTANDING_FORBIDDEN'
  and pg_temp.rechazo('commercial-A', array['c-empty']) is null,
  'el override de un tenant no afecta al otro');

-- 9-11. service_role, el tope y la entrada vacía.
select pg_temp.assert_true(pg_temp.filas(null, array['c-empty', 'c-B'], 'service_role') = 2,
  'service_role sin sesión ve las fichas de los dos tenants');
select pg_temp.assert_true((
  select pg_temp.rechazo('admin-A', array_agg('x' || g)) from generate_series(1, 1001) g)
  = '22023 CLIENT_OUTSTANDING_TOO_MANY', 'más de 1000 ids da 22023');
select pg_temp.assert_true(pg_temp.saldo('admin-A', array[]::text[]) = '[]'::jsonb
  and pg_temp.saldo('admin-A', null) = '[]'::jsonb, 'un arreglo vacío o null no devuelve filas');

-- 12-14. Qué fichas devuelven fila.
select pg_temp.assert_true(pg_temp.saldo('admin-A', array['c-deleted']) = '[]'::jsonb,
  'una ficha borrada no devuelve fila');
select pg_temp.assert_true(pg_temp.saldo('admin-A', array['c-B']) = '[]'::jsonb,
  'una ficha de otro tenant no devuelve fila');
select pg_temp.assert_true((
  select jsonb_array_length(s) = 1 and f->>'currency' is null and f->'markboxes' = '["DTD-0004"]'::jsonb
    and (f->>'open_amount')::numeric = 0 and (f->>'overdue_amount')::numeric = 0
    and (f->>'open_invoices')::int = 0 and f->>'last_payment_on' is null
  from (select pg_temp.saldo('admin-A', array['c-empty']) as s) x,
       lateral (select pg_temp.fila(x.s, 'c-empty', null) as f) y),
  'un cliente sin facturas da una fila semilla con sus códigos y ceros');

-- 15-23. Una regla por cliente.
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-borr') = 0, 'un borrador no es deuda');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-anul') = 0, 'una anulada no es deuda');
select pg_temp.assert_true(
  (pg_temp.fila(pg_temp.saldo('admin-A', array['c-anul']), 'c-anul', 'USD')->>'last_payment_on')::date
    = pg_temp.c(-5),
  'un recibo vivo sobre una factura anulada cuenta como último pago');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-elim') = 0, 'una factura eliminada no es deuda');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-sobre') = 80, 'un sobrepago no compensa otra factura');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-hist') = 10
  and pg_temp.fila(pg_temp.saldo('admin-A', array['c-hist']), 'c-hist', 'USD')->'markboxes'
    = '["DTD-0021", "DTD-0121"]'::jsonb,
  'un código retirado del historial cuenta');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-merge') = 15,
  'la ficha fusionada y la fusión encadenada cuentan');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-tenant') = 7, 'el mismo código en otro tenant no cuenta');
select pg_temp.assert_true(pg_temp.abierto('admin-A', 'c-norm') = 44,
  'el código se compara sin espacios ni mayúsculas, como resolve_markbox');

-- 24. La fecha de corte es la de Caracas, sea cual sea la zona de la sesión.
--     En Kiritimati (UTC+14) el día ya puede ser mañana; en Etc/GMT+12 (UTC−12),
--     ayer. Con las dos, cualquier otra fecha de corte falla a cualquier hora.
select pg_temp.assert_true((
  select bool_and((f->>'overdue_amount')::numeric = 20 and (f->>'overdue_invoices')::int = 1
           and (f->>'open_amount')::numeric = 30 and (f->>'as_of')::date = pg_temp.c(0)
           and (f->>'oldest_overdue_due_date')::date = pg_temp.c(-1))
  from unnest(array['Pacific/Kiritimati', 'Etc/GMT+12']) tz,
       lateral (select pg_temp.fila(pg_temp.saldo('admin-A', array['c-due'], 'authenticated', tz),
         'c-due', 'USD') as f) x),
  'la fecha de Caracas manda en Pacific/Kiritimati y en Etc/GMT+12: lo que vence hoy no está vencido');

-- 25-26. El último pago.
select pg_temp.assert_true(
  (pg_temp.fila(pg_temp.saldo('admin-A', array['c-pago']), 'c-pago', 'USD')->>'last_payment_on')::date
    = pg_temp.c(-15),
  'último pago: el recibo anulado, el reporte sin confirmar y el confirmado borrado no cuentan; el confirmado sí');
select pg_temp.assert_true(
  (pg_temp.fila(pg_temp.saldo('admin-A', array['c-pago']), 'c-pago', 'VES')->>'last_payment_on')::date
    = pg_temp.c(-12),
  'último pago: sin recibo ni reporte, last_payment_at sirve de respaldo en fecha de Caracas');

-- 27. Todo junto: c1 con historial, fusión encadenada, borrador, anulada con
--     abono, eliminada, sobrepago y dos monedas que no se mezclan.
do $c1$
declare v_rows jsonb := pg_temp.saldo('commercial-A', array['c1']); v_usd jsonb; v_ves jsonb;
begin
  v_usd := pg_temp.fila(v_rows, 'c1', 'USD');
  v_ves := pg_temp.fila(v_rows, 'c1', 'VES');
  perform pg_temp.assert_true(jsonb_array_length(v_rows) = 2,
    'c1 tiene una fila por moneda y ninguna semilla');
  perform pg_temp.assert_true((v_usd->>'open_amount')::numeric = 370
    and (v_usd->>'overdue_amount')::numeric = 250
    and (v_usd->>'open_invoices')::int = 5 and (v_usd->>'overdue_invoices')::int = 2
    and (v_usd->>'oldest_overdue_due_date')::date = pg_temp.c(-40),
    'c1 en USD: abierto 370, vencido 250, 5 y 2 facturas, vencimiento más antiguo hace 40 días');
  perform pg_temp.assert_true((v_ves->>'open_amount')::numeric = 900
    and (v_ves->>'overdue_amount')::numeric = 0 and (v_ves->>'open_invoices')::int = 1
    and v_ves->>'oldest_overdue_due_date' is null,
    'c1 en VES: abierto 900 y nada vencido, sin sumarse a USD');
  perform pg_temp.assert_true(
    (v_usd->>'last_payment_on')::date = pg_temp.c(-5) and v_ves->>'last_payment_on' is null,
    'c1: el último pago en USD es el recibo de la anulada (hace 5 días), más reciente que el de i2');
  perform pg_temp.assert_true(
    v_usd->'markboxes' = '["DTD-0001", "DTD-0002", "DTD-0003", "DTD-0100", "DTD-0200"]'::jsonb
    and v_ves->'markboxes' = v_usd->'markboxes',
    'c1: los códigos del cliente, el vigente primero, con historial y fichas fusionadas');
end;
$c1$;

select 'TEST 0492 GREEN: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones' as resultado;
rollback;
