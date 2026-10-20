\set ON_ERROR_STOP on
-- SDD-0571 · Contrato de 0496: la tarifa congelada por recepción
-- (shipment_rate_snapshots y congelar_tarifa_recepcion). Fixture sintético
-- aislado; no ejecutar sobre una DB real. El esquema mínimo y los cuerpos
-- exactos de los helpers vienen de _0496_tarifa_congelada_schema.sql; aplica la
-- 0496 REAL con \ir y termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0496_tarifa_congelada_por_embarque.test.sql
--
-- Cada regla tiene su recepción propia, así un mutante de esa regla cae en su
-- aserción y no en otra.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
\ir _0496_tarifa_congelada_schema.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0496-synthetic-' || p_label)::uuid
$$;

\if :apply_fix
\ir ../migrations/0496_tarifa_congelada_por_embarque.sql
\endif

create sequence pg_temp.assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0496: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Corre p_sql como p_actor (rol API p_role) y devuelve la primera fila en jsonb.
-- El SQL llega armado: el rol API no usa pg_temp.
create function pg_temp.como(p_actor text, p_sql text, p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fixture_id(p_actor)::text end, true);
  execute format('set local role %I', p_role);
  execute 'with r as (' || p_sql || ') select to_jsonb(r) from r limit 1' into v_result;
  reset role;
  return v_result;
exception when others then
  reset role;
  raise;
end;
$$;
-- Igual, pero devuelve el SQLSTATE (o 'OK') y nunca deja cambios.
create function pg_temp.codigo(p_actor text, p_sql text, p_role text default 'authenticated')
returns text language plpgsql as $$
begin
  begin
    perform pg_temp.como(p_actor, p_sql, p_role);
    raise exception using errcode = 'XX999';
  exception when sqlstate 'XX999' then
    return 'OK';
  when others then
    return sqlstate;
  end;
end;
$$;
-- La llamada a la RPC, con los ids resueltos.
create function pg_temp.congelar(
  p_receipt text, p_source text, p_rate text default null, p_quote text default null,
  p_per numeric default null, p_min numeric default null,
  p_service text default 'puerta_a_puerta_DDP', p_kg integer default 500,
  p_reason text default null, p_dry boolean default false
) returns text language sql stable as $$
  select format('select * from public.congelar_tarifa_recepcion(%L::uuid, %L, %L::uuid, %L::uuid, %L::numeric, %L::numeric, %L::public.shipment_service, %L::integer, %L, %L::boolean)',
    pg_temp.fixture_id(p_receipt), p_source,
    case when p_rate is null then null else pg_temp.fixture_id(p_rate) end,
    case when p_quote is null then null else pg_temp.fixture_id(p_quote) end,
    p_per, p_min, p_service, p_kg, p_reason, p_dry)
$$;
-- plpgsql: sin la 0496 la tabla no existe y el control rojo tiene que caer en
-- la primera aserción, no al crear estas funciones.
create function pg_temp.vivas(p_receipt text) returns integer language plpgsql stable as $$
begin
  return (select count(*)::integer from public.shipment_rate_snapshots
          where receipt_id = pg_temp.fixture_id(p_receipt) and superseded_at is null);
end;
$$;
create function pg_temp.todas(p_receipt text) returns integer language plpgsql stable as $$
begin
  return (select count(*)::integer from public.shipment_rate_snapshots
          where receipt_id = pg_temp.fixture_id(p_receipt));
end;
$$;

-- 0. La RPC existe (control rojo).
do $existe$
begin
  if pg_catalog.to_regclass('public.shipment_rate_snapshots') is null then
    raise exception 'TEST 0496: existe public.shipment_rate_snapshots';
  end if;
  perform pg_temp.assert_true(true, 'existe');
end;
$existe$;

-- ─── Fixture ─────────────────────────────────────────────────────────────────
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0496', 'Tenant A 0496'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0496', 'Tenant B 0496');
insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'operations-A',
  'warehouse-A', 'support-A', 'commercial-A', 'marketing-A', 'admin-B']) u;
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('admin-A', 'tenant-A', 'admin'), ('accounting-A', 'tenant-A', 'accounting'),
  ('operations-A', 'tenant-A', 'operations'), ('warehouse-A', 'tenant-A', 'warehouse'),
  ('support-A', 'tenant-A', 'support'), ('commercial-A', 'tenant-A', 'commercial'),
  ('marketing-A', 'tenant-A', 'marketing'), ('admin-B', 'tenant-B', 'admin')
) v(u, t, r);

-- Aliados raíz: P (tarifa propia), Q (pactado 700), R (descuento 10 %), S (nada).
insert into public.aliados (id, tenant_id)
select pg_temp.fixture_id(a), pg_temp.fixture_id('tenant-A') from unnest(array['al-P', 'al-Q', 'al-R', 'al-S']) a;
insert into public.price_books (id, tenant_id, aliado_id, name, is_house, discount_pct, base_per_cbm)
select pg_temp.fixture_id(b), pg_temp.fixture_id(t),
  case when a is null then null else pg_temp.fixture_id(a) end, b, h, d, p
from (values
  ('book-casa-A', 'tenant-A', null,   true,  null::numeric, null::numeric),
  ('book-P',      'tenant-A', 'al-P', false, null, null),
  ('book-Q',      'tenant-A', 'al-Q', false, null, 700),
  ('book-R',      'tenant-A', 'al-R', false, 10,   null),
  ('book-S',      'tenant-A', 'al-S', false, null, null),
  ('book-casa-B', 'tenant-B', null,   true,  null, null)
) v(b, t, a, h, d, p);

insert into public.clients (id, tenant_id, markbox, name, aliado_id)
select pg_temp.fixture_id(c), pg_temp.fixture_id(t), m, 'Cliente ' || c,
  case when a is null then null else pg_temp.fixture_id(a) end
from (values
  ('c-directo', 'tenant-A', 'DTD-0001', null),
  ('c-P',       'tenant-A', 'DTD-0002', 'al-P'),
  ('c-Q',       'tenant-A', 'DTD-0003', 'al-Q'),
  ('c-R',       'tenant-A', 'DTD-0004', 'al-R'),
  ('c-S',       'tenant-A', 'DTD-0005', 'al-S'),
  ('c-B',       'tenant-B', 'DTD-0001', null)
) v(c, t, m, a);

insert into public.rates (id, tenant_id, service, destination, per_cbm, flat_rate, min_charge, price_book_id, deleted_at)
select pg_temp.fixture_id(r), pg_temp.fixture_id(t), s::public.shipment_service, 'Valencia', p, f, m,
  pg_temp.fixture_id(b), case when x then now() end
from (values
  ('rate-casa',       'tenant-A', 'puerta_a_puerta_DDP', 850::numeric, null::numeric, 50::numeric,  'book-casa-A', false),
  ('rate-casa-lcl',   'tenant-A', 'consolidado_lcl',     580,          null,          null,         'book-casa-A', false),
  ('rate-casa-fcl',   'tenant-A', 'fcl_directo',         null,         4000,          null,         'book-casa-A', false),
  ('rate-P',          'tenant-A', 'puerta_a_puerta_DDP', 800,          null,          40,           'book-P',      false),
  ('rate-S',          'tenant-A', 'puerta_a_puerta_DDP', 999,          null,          10,           'book-S',      false),
  ('rate-borrada',    'tenant-A', 'puerta_a_puerta_DDP', 1,            null,          0,            'book-casa-A', true),
  ('rate-B',          'tenant-B', 'puerta_a_puerta_DDP', 300,          null,          0,            'book-casa-B', false)
) v(r, t, s, p, f, m, b, x);

insert into public.quotes (id, tenant_id, quote_code, client_markbox, service, rate_per_cbm, rate_used_id, status)
select pg_temp.fixture_id(q), pg_temp.fixture_id('tenant-A'), 'EST-' || q, m, s::public.shipment_service, p,
  case when r is null then null else pg_temp.fixture_id(r) end, st::public.quote_status
from (values
  ('q-aceptado',   ' dtd-0001 ', 'puerta_a_puerta_DDP', 820::numeric, 'rate-casa', 'accepted'),
  ('q-borrador',   'DTD-0001',   'puerta_a_puerta_DDP', 820,          'rate-casa', 'draft'),
  ('q-otro',       'DTD-0002',   'puerta_a_puerta_DDP', 820,          'rate-casa', 'accepted'),
  ('q-sin-cbm',    'DTD-0001',   'fcl_directo',         null,         null,        'accepted'),
  ('q-sin-fila',   'DTD-0001',   'consolidado_lcl',     600,          null,        'accepted')
) v(q, m, s, p, r, st);

insert into public.quotes (id, tenant_id, quote_code, client_markbox, service, rate_per_cbm, status)
values (pg_temp.fixture_id('q-B'), pg_temp.fixture_id('tenant-B'), 'EST-q-B', 'DTD-0001',
  'puerta_a_puerta_DDP', 300, 'accepted');

-- Una recepción por regla.
insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, client_markbox, is_orphan,
  total_cbm, total_weight_kg, destination_city, deleted_at)
select pg_temp.fixture_id(r), pg_temp.fixture_id(t), 'WR-' || r, m, o, cbm, kg, 'Valencia',
  case when x then now() end
from (values
  ('r-estimado',   'tenant-A', 'DTD-0001', false, 2.5::numeric, 1400::numeric, false),
  ('r-sin-fila',   'tenant-A', 'DTD-0001', false, 1.0,  null,   false),
  ('r-casa',       'tenant-A', 'DTD-0001', false, 2.0,  800,    false),
  ('r-minimo',     'tenant-A', 'DTD-0001', false, 0.03, 10,     false),
  ('r-propia',     'tenant-A', 'DTD-0002', false, 1.0,  100,    false),
  ('r-pactada',    'tenant-A', 'DTD-0003', false, 1.0,  100,    false),
  ('r-descuento',  'tenant-A', 'DTD-0004', false, 1.0,  100,    false),
  ('r-aliado-nada','tenant-A', 'DTD-0005', false, 1.0,  100,    false),
  ('r-manual',     'tenant-A', 'DTD-0001', false, 1.5,  null,   false),
  ('r-excel',      'tenant-A', 'DTD-0001', false, 1.5,  null,   false),
  ('r-1000',       'tenant-A', 'DTD-0001', false, 2.0,  2600,   false),
  ('r-reemplazo',  'tenant-A', 'DTD-0001', false, 1.0,  null,   false),
  ('r-vista',      'tenant-A', 'DTD-0004', false, 3.333, 2000,  false),
  ('r-guardian',   'tenant-A', 'DTD-0001', false, 1.0,  null,   false),
  ('r-cascada',    'tenant-A', 'DTD-0001', false, 1.0,  null,   false),
  ('r-libre',      'tenant-A', 'DTD-0001', false, 1.0,  null,   false),
  ('r-huerfana',   'tenant-A', 'DTD-0001', true,  1.0,  null,   false),
  ('r-sin-cbm',    'tenant-A', 'DTD-0001', false, null, null,   false),
  ('r-sin-cliente','tenant-A', 'DTD-9999', false, 1.0,  null,   false),
  ('r-borrada',    'tenant-A', 'DTD-0001', false, 1.0,  null,   true),
  ('r-B',          'tenant-B', 'DTD-0001', false, 1.0,  null,   false)
) v(r, t, m, o, cbm, kg, x);
insert into public.shipments (id, tenant_id, code) values
  (pg_temp.fixture_id('s-A'), pg_temp.fixture_id('tenant-A'), 'S-A'),
  (pg_temp.fixture_id('s-A2'), pg_temp.fixture_id('tenant-A'), 'S-A2'),
  (pg_temp.fixture_id('s-B'), pg_temp.fixture_id('tenant-B'), 'S-B');

-- ─── 1. Permisos de la tabla ─────────────────────────────────────────────────
do $permisos$
begin
  perform pg_temp.assert_true(
    (select relrowsecurity from pg_class where oid = 'public.shipment_rate_snapshots'::regclass),
    'la tabla tiene RLS');
  perform pg_temp.assert_true(
    has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'SELECT')
    and not has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'INSERT')
    and not has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'DELETE')
    and not has_table_privilege('anon', 'public.shipment_rate_snapshots', 'SELECT'),
    'authenticated solo lee; anon nada');
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.congelar_tarifa_recepcion(uuid,text,uuid,uuid,numeric,numeric,public.shipment_service,integer,text,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.congelar_tarifa_recepcion(uuid,text,uuid,uuid,numeric,numeric,public.shipment_service,integer,text,boolean)', 'EXECUTE'),
    'la RPC es solo de authenticated');
end;
$permisos$;

-- ─── 2. Estimado aceptado ────────────────────────────────────────────────────
do $estimado$
declare v jsonb;
begin
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-estimado', 'estimado', p_quote => 'q-borrador')) = '22023',
    'un estimado en borrador no congela');
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-estimado', 'estimado', p_quote => 'q-otro')) = '22023',
    'un estimado de otro cliente no congela');
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-estimado', 'estimado', p_quote => 'q-sin-cbm')) = '22023',
    'un estimado sin precio por CBM no congela');
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-estimado', 'estimado', p_quote => 'q-B')) = 'P0002',
    'un estimado de otro tenant no existe para este');
  v := pg_temp.como('warehouse-A', pg_temp.congelar('r-estimado', 'estimado', p_quote => 'q-aceptado', p_service => 'consolidado_lcl'));
  perform pg_temp.assert_true(v->>'source' = 'estimado' and (v->>'per_cbm')::numeric = 820
    and (v->>'min_charge')::numeric = 50 and v->>'service' = 'puerta_a_puerta_DDP'
    and v->>'quote_id' = pg_temp.fixture_id('q-aceptado')::text
    and v->>'rate_id' = pg_temp.fixture_id('rate-casa')::text,
    'estimado aceptado: su precio, el mínimo de su fila del tarifario y su servicio');
  perform pg_temp.assert_true((v->>'cbm')::numeric = 2.5 and (v->>'weight_kg')::numeric = 1400
    and (v->>'amount_to_invoice')::numeric = 2050 and v->>'client_markbox' = 'DTD-0001'
    and v->>'client_id' = pg_temp.fixture_id('c-directo')::text
    and v->>'frozen_by' = pg_temp.fixture_id('warehouse-A')::text
    and v->>'destination' = 'Valencia',
    'estimado aceptado: CBM y peso de la recepción, a facturar 2.5 × 820, cliente y quién');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-sin-fila', 'estimado', p_quote => 'q-sin-fila'));
  perform pg_temp.assert_true((v->>'min_charge')::numeric = 0 and v->>'rate_id' is null,
    'un estimado sin fila del tarifario congela con mínimo 0');
end;
$estimado$;

-- ─── 3. Tarifario: casa, propia, pactada, descuento ──────────────────────────
do $tarifario$
declare v jsonb;
begin
  v := pg_temp.como('operations-A', pg_temp.congelar('r-casa', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(v->>'source' = 'casa' and v->>'rate_origin' is null
    and (v->>'per_cbm')::numeric = 850 and (v->>'min_charge')::numeric = 50
    and (v->>'amount_to_invoice')::numeric = 1700
    and v->>'price_book_id' = pg_temp.fixture_id('book-casa-A')::text,
    'cliente directo: la casa, 2 × 850');
  v := pg_temp.como('operations-A', pg_temp.congelar('r-minimo', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true((v->>'amount_to_invoice')::numeric = 50,
    'el mínimo se cobra: 0.03 × 850 = 25.50 < 50');
  v := pg_temp.como('accounting-A', pg_temp.congelar('r-propia', 'tarifario', p_rate => 'rate-P'));
  perform pg_temp.assert_true(v->>'source' = 'lista' and v->>'rate_origin' = 'propia'
    and (v->>'per_cbm')::numeric = 800 and (v->>'min_charge')::numeric = 40
    and v->>'price_book_id' = pg_temp.fixture_id('book-P')::text,
    'aliado con tarifa propia: lista propia, su precio y su mínimo');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-pactada', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(v->>'source' = 'lista' and v->>'rate_origin' = 'pactada'
    and (v->>'per_cbm')::numeric = 700 and (v->>'min_charge')::numeric = 50
    and v->>'rate_id' = pg_temp.fixture_id('rate-casa')::text
    and v->>'price_book_id' = pg_temp.fixture_id('book-Q')::text,
    'aliado con precio pactado: 700, y el mínimo de la casa');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-descuento', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(v->>'source' = 'lista' and v->>'rate_origin' = 'descuento'
    and (v->>'per_cbm')::numeric = 765 and (v->>'discount_pct')::numeric = 10
    and (v->>'min_charge')::numeric = 50,
    'aliado con descuento: 850 menos 10 % = 765, y el mínimo sin descontar');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-aliado-nada', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(v->>'source' = 'casa' and (v->>'per_cbm')::numeric = 850,
    'aliado sin tarifa propia, pacto ni descuento: la casa');
end;
$tarifario$;

-- ─── 4. Tarifario: lo que no se acepta ───────────────────────────────────────
do $rechazos$
begin
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-P')) = '22023',
    'la tarifa propia de otro aliado no se usa para un cliente directo');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-S')) = '22023',
    'la lista de un aliado ajeno tampoco');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_service => 'consolidado_lcl')) = '22023',
    'la fila tiene que ser del servicio pedido');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa-fcl', p_service => 'fcl_directo')) = '22023',
    'una fila sin precio por CBM no congela');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-borrada')) = 'P0002',
    'una fila borrada no congela');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-B')) = 'P0002',
    'una fila de otro tenant no existe para este');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'otra')) = '22023',
    'una fuente desconocida se rechaza');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_kg => 800)) = '22023',
    'el peso incluido es 500 o 1000');
  perform pg_temp.assert_true(pg_temp.vivas('r-libre') = 0, 'nada de eso congeló');
end;
$rechazos$;

-- ─── 5. La recepción ─────────────────────────────────────────────────────────
do $recepcion$
begin
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-huerfana', 'tarifario', p_rate => 'rate-casa')) = '22023',
    'una huérfana no tiene a quién cobrarle');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-sin-cbm', 'tarifario', p_rate => 'rate-casa')) = '22023',
    'sin CBM medido no se congela');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-sin-cliente', 'tarifario', p_rate => 'rate-casa')) = '22023',
    'un Shipping Mark sin cliente no se congela');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-borrada', 'tarifario', p_rate => 'rate-casa')) = 'P0002',
    'una recepción eliminada no existe');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-B', 'tarifario', p_rate => 'rate-casa')) = 'P0002',
    'una recepción de otro tenant no existe para este');
  perform pg_temp.assert_true(
    (pg_temp.como('admin-B', pg_temp.congelar('r-B', 'tarifario', p_rate => 'rate-B'))->>'per_cbm')::numeric = 300,
    'el admin del otro tenant sí congela la suya, con su tarifa');
end;
$recepcion$;

-- ─── 6. Roles ────────────────────────────────────────────────────────────────
do $roles$
begin
  perform pg_temp.assert_true(pg_temp.codigo('commercial-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_dry => true)) = '42501',
    'commercial no ve ni congela');
  perform pg_temp.assert_true(pg_temp.codigo('marketing-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_dry => true)) = '42501',
    'marketing no ve ni congela');
  perform pg_temp.assert_true(pg_temp.codigo(null, pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_dry => true)) = '42501',
    'sin sesión, nada');
  perform pg_temp.assert_true(pg_temp.codigo('support-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa', p_dry => true)) = 'OK',
    'support ve la propuesta');
  perform pg_temp.assert_true(pg_temp.codigo('support-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa')) = '42501',
    'support no congela');
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-libre', 'tarifario', p_rate => 'rate-casa')) = 'OK',
    'warehouse congela una pendiente desde el tarifario');
end;
$roles$;

-- ─── 7. A mano, Excel y 1.000 kg/m³ ──────────────────────────────────────────
do $a_mano$
declare v jsonb;
begin
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-manual', 'manual', p_per => 900, p_reason => 'Precio negociado por WhatsApp')) = '42501',
    'warehouse no fija a mano');
  perform pg_temp.assert_true(pg_temp.codigo('operations-A', pg_temp.congelar('r-manual', 'manual', p_per => 900, p_reason => 'Precio negociado por WhatsApp')) = '42501',
    'operations no fija a mano');
  perform pg_temp.assert_true(pg_temp.codigo('accounting-A', pg_temp.congelar('r-manual', 'manual', p_per => 900)) = '22023',
    'a mano exige motivo');
  perform pg_temp.assert_true(pg_temp.codigo('accounting-A', pg_temp.congelar('r-manual', 'manual', p_per => 900, p_reason => 'corto')) = '22023',
    'el motivo lleva al menos 10 caracteres');
  perform pg_temp.assert_true(pg_temp.codigo('accounting-A', pg_temp.congelar('r-manual', 'manual', p_per => 0, p_reason => 'Precio negociado por WhatsApp')) = '22023',
    'la tarifa a mano es mayor que 0');
  perform pg_temp.assert_true(pg_temp.codigo('accounting-A', pg_temp.congelar('r-manual', 'manual', p_per => 900, p_min => -1, p_reason => 'Precio negociado por WhatsApp')) = '22023',
    'el mínimo a mano no es negativo');
  v := pg_temp.como('accounting-A', pg_temp.congelar('r-manual', 'manual', p_per => 900.004, p_min => 30, p_reason => '  Precio negociado por WhatsApp  '));
  perform pg_temp.assert_true(v->>'source' = 'manual' and (v->>'per_cbm')::numeric = 900
    and (v->>'min_charge')::numeric = 30 and v->>'reason' = 'Precio negociado por WhatsApp'
    and v->>'rate_id' is null and v->>'quote_id' is null and (v->>'amount_to_invoice')::numeric = 1350,
    'a mano: el número redondeado a centavos, el motivo limpio y sin fila de origen');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-excel', 'excel_yiwu', p_per => 610, p_reason => 'Excel de Yiwu, fila 14'));
  perform pg_temp.assert_true(v->>'source' = 'excel_yiwu' and (v->>'per_cbm')::numeric = 610,
    'el Excel de Yiwu queda con su fuente');
  perform pg_temp.assert_true(pg_temp.codigo('operations-A', pg_temp.congelar('r-1000', 'tarifario', p_rate => 'rate-casa', p_kg => 1000, p_reason => 'Excepción pactada por contenedor')) = '42501',
    '1.000 kg/m³ no lo fija operations');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-1000', 'tarifario', p_rate => 'rate-casa', p_kg => 1000)) = '22023',
    '1.000 kg/m³ exige motivo');
  v := pg_temp.como('admin-A', pg_temp.congelar('r-1000', 'tarifario', p_rate => 'rate-casa', p_kg => 1000, p_reason => 'Excepción pactada por contenedor'));
  perform pg_temp.assert_true((v->>'included_kg_per_cbm')::integer = 1000 and (v->>'excess_weight_kg')::numeric = 600
    and (v->>'amount_to_invoice')::numeric = 1700,
    'con 1.000 kg/m³: 2600 − 2 × 1000 = 600 kg de exceso, que no se suman a lo que se factura');
end;
$a_mano$;

-- ─── 8. Exceso con 500 kg/m³ ─────────────────────────────────────────────────
do $exceso$
begin
  perform pg_temp.assert_true(
    (select excess_weight_kg from public.shipment_rate_snapshots
     where receipt_id = pg_temp.fixture_id('r-estimado') and superseded_at is null) = 150,
    'con 500 kg/m³: 1400 − 2.5 × 500 = 150 kg de exceso');
  perform pg_temp.assert_true(
    (select excess_weight_kg from public.shipment_rate_snapshots
     where receipt_id = pg_temp.fixture_id('r-casa') and superseded_at is null) = 0,
    'bajo el peso incluido no hay exceso');
end;
$exceso$;

-- ─── 9. Una viva por recepción y el reemplazo ────────────────────────────────
do $reemplazo$
declare v1 jsonb; v2 jsonb; v_old record;
begin
  v1 := pg_temp.como('warehouse-A', pg_temp.congelar('r-reemplazo', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(pg_temp.codigo('admin-A', pg_temp.congelar('r-reemplazo', 'tarifario', p_rate => 'rate-casa')) = '23505',
    'una recepción con tarifa no se vuelve a congelar sin motivo');
  perform pg_temp.assert_true(pg_temp.codigo('warehouse-A', pg_temp.congelar('r-reemplazo', 'tarifario', p_rate => 'rate-casa', p_reason => 'El cliente aceptó el estimado después')) = '42501',
    'warehouse no reemplaza una tarifa congelada');
  v2 := pg_temp.como('accounting-A', pg_temp.congelar('r-reemplazo', 'estimado', p_quote => 'q-aceptado', p_reason => 'El cliente aceptó el estimado después'));
  select * into v_old from public.shipment_rate_snapshots where id = (v1->>'id')::uuid;
  perform pg_temp.assert_true(pg_temp.vivas('r-reemplazo') = 1 and pg_temp.todas('r-reemplazo') = 2,
    'el reemplazo deja una sola viva y conserva la anterior');
  perform pg_temp.assert_true(v_old.superseded_at is not null and v_old.superseded_by_id = (v2->>'id')::uuid
    and (v2->>'per_cbm')::numeric = 820 and v2->>'reason' = 'El cliente aceptó el estimado después',
    'la anterior apunta a la nueva, que lleva su motivo');
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.assert_true(true, 'el reemplazo pasa el chequeo diferido');
end;
$reemplazo$;

-- ─── 10. Vista previa ────────────────────────────────────────────────────────
do $vista$
declare v_prev jsonb; v_real jsonb; v_prev2 jsonb;
begin
  v_prev := pg_temp.como('support-A', pg_temp.congelar('r-vista', 'tarifario', p_rate => 'rate-casa', p_dry => true));
  perform pg_temp.assert_true(pg_temp.todas('r-vista') = 0 and v_prev->>'id' is null,
    'la vista previa no escribe');
  v_real := pg_temp.como('admin-A', pg_temp.congelar('r-vista', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(
    (v_prev - 'id' - 'frozen_at' - 'frozen_by' - 'superseded_by_id')
    = (v_real - 'id' - 'frozen_at' - 'frozen_by' - 'superseded_by_id'),
    'la vista previa calcula lo mismo que la congelación, también lo generado (3.333 × 765)');
  perform pg_temp.assert_true((v_real->>'amount_to_invoice')::numeric = 2549.75
    and (v_real->>'excess_weight_kg')::numeric = 333.50,
    'a facturar 3.333 × 765 = 2549.75 y exceso 2000 − 1666.50');
  perform pg_temp.assert_true(
    (pg_temp.como('support-A', pg_temp.congelar('r-minimo', 'tarifario', p_rate => 'rate-casa', p_dry => true))->>'amount_to_invoice')::numeric = 50,
    'la vista previa también cobra el mínimo');
  v_prev2 := pg_temp.como('support-A', pg_temp.congelar('r-vista', 'tarifario', p_rate => 'rate-casa', p_dry => true));
  perform pg_temp.assert_true(v_prev2->>'superseded_by_id' = v_real->>'id',
    'con una tarifa viva, la vista previa dice cuál reemplazaría');
end;
$vista$;

-- ─── 11. El guardián ─────────────────────────────────────────────────────────
do $guardian$
declare v jsonb; v_id uuid; v_otra uuid;
begin
  v := pg_temp.como('admin-A', pg_temp.congelar('r-guardian', 'tarifario', p_rate => 'rate-casa'));
  v_id := (v->>'id')::uuid;
  v_otra := (select id from public.shipment_rate_snapshots
             where receipt_id = pg_temp.fixture_id('r-casa') and superseded_at is null);
  perform pg_temp.assert_true(pg_temp.codigo('admin-A',
    format('update public.shipment_rate_snapshots set per_cbm = 1 where id = %L returning id', v_id)) = '42501',
    'authenticated no edita por la API');
  perform pg_temp.assert_true(pg_temp.codigo('admin-A',
    format('delete from public.shipment_rate_snapshots where id = %L returning id', v_id)) = '42501',
    'authenticated no borra por la API');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('update public.shipment_rate_snapshots set per_cbm = 1 where id = %L returning id', v_id), 'service_role') = '42501',
    'ni service_role edita la tarifa');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('update public.shipment_rate_snapshots set reason = %L where id = %L returning id', 'Un motivo cualquiera', v_id), 'service_role') = '42501',
    'ni el motivo');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('delete from public.shipment_rate_snapshots where id = %L returning id', v_id), 'service_role') = '42501',
    'ni service_role la borra');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('update public.shipment_rate_snapshots set shipment_id = %L where id = %L returning id', pg_temp.fixture_id('s-B'), v_id), 'service_role') = '42501',
    'el envío tiene que ser del mismo tenant');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('update public.shipment_rate_snapshots set shipment_id = %L where id = %L returning id', pg_temp.fixture_id('s-A'), v_id), 'service_role') = 'OK',
    'la 4.2 llena el envío una vez');
  update public.shipment_rate_snapshots set shipment_id = pg_temp.fixture_id('s-A') where id = v_id;
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('update public.shipment_rate_snapshots set shipment_id = %L where id = %L returning id', pg_temp.fixture_id('s-A2'), v_id), 'service_role') = '42501',
    'y después no lo cambia');
  -- Reemplazo que apunta a otra recepción: lo rechaza el chequeo diferido.
  begin
    set local role service_role;
    update public.shipment_rate_snapshots set superseded_at = now(), superseded_by_id = v_otra where id = v_id;
    set constraints shipment_rate_snapshots_supersede_check immediate;
    reset role;
    raise exception 'TEST 0496: un reemplazo que apunta a otra recepción no pasa el chequeo diferido';
  exception when sqlstate '23514' then
    reset role;
  end;
  set constraints all deferred;
  perform pg_temp.assert_true(true, 'un reemplazo que apunta a otra recepción no pasa el chequeo diferido');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('insert into public.shipment_rate_snapshots (tenant_id, receipt_id, client_id, client_markbox, service, source, reason, per_cbm, cbm) values (%L, %L, %L, %L, %L, %L, %L, 1, 1) returning id',
      pg_temp.fixture_id('tenant-B'), pg_temp.fixture_id('r-libre'), pg_temp.fixture_id('c-directo'), 'DTD-0001',
      'puerta_a_puerta_DDP', 'manual', 'Inserción directa de prueba'), 'service_role') = '42501',
    'un INSERT directo no mezcla tenants');
  perform pg_temp.assert_true(pg_temp.codigo(null,
    format('insert into public.shipment_rate_snapshots (tenant_id, receipt_id, client_id, client_markbox, service, source, per_cbm, cbm) values (%L, %L, %L, %L, %L, %L, 1, 1) returning id',
      pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('r-sin-fila'), pg_temp.fixture_id('c-directo'), 'DTD-0001',
      'puerta_a_puerta_DDP', 'lista'), 'service_role') = '23514',
    'una fila incoherente (lista sin origen ni fila) no entra');
end;
$guardian$;

-- ─── 12. Quién lee ───────────────────────────────────────────────────────────
do $lectura$
declare v_total integer := (select count(*) from public.shipment_rate_snapshots
                            where tenant_id = pg_temp.fixture_id('tenant-A'));
begin
  perform pg_temp.assert_true(v_total > 10, 'hay tarifas en el tenant A');
  perform pg_temp.assert_true(
    (pg_temp.como('commercial-A', format('select count(*) as n from public.shipment_rate_snapshots where tenant_id = %L',
      pg_temp.fixture_id('tenant-A')))->>'n')::integer = v_total,
    'commercial lee todas las del tenant');
  perform pg_temp.assert_true(
    (pg_temp.como('warehouse-A', format('select count(*) as n from public.shipment_rate_snapshots where tenant_id = %L',
      pg_temp.fixture_id('tenant-A')))->>'n')::integer = v_total,
    'warehouse lee todas las del tenant');
  perform pg_temp.assert_true(
    (pg_temp.como('marketing-A', 'select count(*) as n from public.shipment_rate_snapshots')->>'n')::integer = 0,
    'marketing no lee');
  perform pg_temp.assert_true(
    (pg_temp.como('admin-B', 'select count(*) as n from public.shipment_rate_snapshots')->>'n')::integer = 1,
    'el otro tenant solo ve la suya');
end;
$lectura$;

-- ─── 13. Borrado en cascada ──────────────────────────────────────────────────
do $cascada$
begin
  perform pg_temp.como('admin-A', pg_temp.congelar('r-cascada', 'tarifario', p_rate => 'rate-casa'));
  perform pg_temp.assert_true(pg_temp.todas('r-cascada') = 1, 'la recepción tiene su tarifa');
  delete from public.warehouse_receipts_cn where id = pg_temp.fixture_id('r-cascada');
  perform pg_temp.assert_true(pg_temp.todas('r-cascada') = 0, 'borrar la recepción arrastra su tarifa');
end;
$cascada$;

select 'TEST 0496 GREEN: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones' as resultado;
rollback;
