\set ON_ERROR_STOP on

-- Contrato del núcleo transaccional de auto-facturación (SDD-0072 Fase 2).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ ESTE Y NO OTRO ────────────────────────────────────────────────
--
-- `sales_order_claim_and_invoice` decide CUÁNTO se le cobra a un cliente y
-- emite la factura. Es una de las migraciones con más lógica de dinero del
-- repo y no tenía un solo contrato. Un error acá no se ve en pantalla: se ve
-- en la factura que ya se mandó.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 El DENOMINADOR CONGELADO. El prorrateo divide el total de la OV
--      entre las cajas. Si ese universo se recalcula en cada recepción, un
--      assign/unassign posterior lo mueve y la misma caja pasa a valer otra
--      cosa. La 0128 lo snapshotea en la 1ª factura justo por eso — y ese
--      snapshot era la pieza sin probar.
--   2. 🔴 NUNCA se re-factura una caja. La idempotencia es lo único que
--      separa un reintento de un cobro doble.
--   3. 🔴 NUNCA se sobre-factura la OV. La suma de las parciales no puede
--      pasarse del total, y la última absorbe el resto exacto.
--   4. 🔴 `total == base + iva`, con aritmética numeric. Si no cuadra, el
--      asiento contable aborta y la factura queda emitida sin contabilizar.
--   5. 🔴 Una caja no puede apuntar a la OV de OTRO tenant. La FK garantiza
--      existencia, no dueño.
--   6. El «ya facturado» excluye borrador y anulada — si contara un borrador,
--      la caja siguiente se factura de menos.
--   7. Los gates duros (huérfana / sin CBM / sin peso) rechazan antes de
--      emitir nada.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

-- ── Esqueleto mínimo · sólo lo que la RPC lee o escribe ───────────────────
-- Fidelidad deliberadamente baja en todo lo que la 0128 no mira. Lo que sí
-- está fiel son los tipos numeric: la mitad de los contratos de acá son sobre
-- centavos, y un float los volvería inservibles.
create table public.tenants (
  id          uuid primary key,
  iva_enabled boolean not null default false
);

create table public.sales_orders (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  sales_order_code text not null,
  client_markbox   text,
  client_name      text,
  total_usd        numeric(14,2),
  status           text not null default 'confirmada',
  service          text not null default 'consolidado',
  deleted_at       timestamptz
  -- invoicing_total_boxes lo AGREGA la 0128 · no va acá.
);

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  invoice_code    text not null,
  client_markbox  text not null,
  client_name     text not null,
  sales_order_id  uuid,
  currency        text,
  iva_rate        numeric(5,2),
  base_amount     numeric(14,2),
  iva_amount      numeric(14,2),
  total_amount    numeric(14,2),
  lines           jsonb,
  notes           text,
  status          text not null default 'emitida',
  issued_at       date,
  due_date        date,
  fund_class      text,
  deleted_at      timestamptz
);

create table public.prealertas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  sales_order_id uuid references public.sales_orders(id),
  boxes          int not null default 0,
  invoice_id     uuid references public.invoices(id) on delete set null,
  invoiced_at    timestamptz,
  deleted_at     timestamptz
);

create table public.warehouse_receipts_cn (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  receipt_code    text not null,
  client_markbox  text,
  client_name     text,
  is_orphan       boolean not null default false,
  total_cbm       numeric(12,3),
  total_weight_kg numeric(12,2),
  prealerta_id    uuid references public.prealertas(id),
  sales_order_id  uuid references public.sales_orders(id),
  deleted_at      timestamptz
);

-- Correlativo: sólo tiene que devolver un código distinto cada vez.
create sequence public.test_invoice_seq;
create or replace function public.next_invoice_code(p_tenant_id uuid)
returns text language sql as $nic$
  select 'F-TEST-' || lpad(nextval('public.test_invoice_seq')::text, 4, '0')
$nic$;

\ir ../migrations/0128_sales_order_invoicing_hardening.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, iva_enabled) values (:'t1', false), (:'t2', true);

-- OV de $1.000 con 10 cajas repartidas en 4 recepciones.
--   P1 = 2 · P2 = 2 · P3 = 5 · P4 = 1
-- El reparto no es decorativo: P3 se va a dar de baja DESPUÉS de la 1ª factura
-- y P4 existe sólo para que la 2ª no sea la final (si lo fuera, absorbería el
-- restante y el prorrateo —que es lo que se está probando— no correría).
\set so '5a1e0000-0000-0000-0000-000000000001'
insert into public.sales_orders (id, tenant_id, sales_order_code, client_markbox,
                                 client_name, total_usd, status)
values (:'so', :'t1', 'OV-0001', 'DTD-0001', 'Importadora Uno', 1000.00, 'confirmada');

insert into public.prealertas (id, tenant_id, sales_order_id, boxes) values
  ('b0000000-0000-0000-0000-000000000001', :'t1', :'so', 2),
  ('b0000000-0000-0000-0000-000000000002', :'t1', :'so', 2),
  ('b0000000-0000-0000-0000-000000000003', :'t1', :'so', 5),
  ('b0000000-0000-0000-0000-000000000004', :'t1', :'so', 1);

insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, client_markbox,
                                          client_name, total_cbm, total_weight_kg, prealerta_id)
values
  ('c0000000-0000-0000-0000-000000000001', :'t1', 'WR-1', 'DTD-0001', 'Importadora Uno', 1.5, 200, 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', :'t1', 'WR-2', 'DTD-0001', 'Importadora Uno', 1.5, 200, 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000004', :'t1', 'WR-4', 'DTD-0001', 'Importadora Uno', 1.5, 200, 'b0000000-0000-0000-0000-000000000004');

-- ── 1 · La 1ª factura prorratea y congela el denominador ──────────────────
do $$
declare r jsonb; v_den int;
begin
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000001');

  if r->>'outcome' <> 'invoiced' then
    raise exception 'CONTRATO 1 ROTO: la 1a recepcion no facturo (outcome=%)', r->>'outcome';
  end if;
  -- 2 de 10 cajas de una OV de $1.000.
  if (r->>'total_amount')::numeric <> 200.00 then
    raise exception 'CONTRATO 1 ROTO: 2/10 de $1000 deberia ser 200.00 y dio %', r->>'total_amount';
  end if;

  select invoicing_total_boxes into v_den
    from public.sales_orders where id = '5a1e0000-0000-0000-0000-000000000001';
  if v_den is distinct from 10 then
    raise exception 'CONTRATO 1 ROTO: el denominador no quedo congelado en 10 (es %)', v_den;
  end if;
end;
$$;

-- ── 2 · 🔴 El denominador NO se mueve aunque cambien las cajas ────────────
--
-- Se da de baja P3 (5 cajas). El universo VIVO pasa de 10 a 5. Si el prorrateo
-- volviera a mirar el universo vivo, la caja de 2 cajas pasaría de valer $200
-- (2/10) a $400 (2/5): al MISMO cliente, por la MISMA caja, el doble — sólo
-- porque otra caja se dio de baja después.
do $$
declare r jsonb; v_den int;
begin
  update public.prealertas set deleted_at = now()
   where id = 'b0000000-0000-0000-0000-000000000003';

  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000002');

  if r->>'outcome' <> 'invoiced' then
    raise exception 'CONTRATO 2 ROTO: la 2a recepcion no facturo (outcome=%)', r->>'outcome';
  end if;
  if (r->>'total_amount')::numeric <> 200.00 then
    raise exception
      'CONTRATO 2 ROTO: el denominador se movio — la misma caja de 2/10 facturo % en vez de 200.00',
      r->>'total_amount';
  end if;

  select invoicing_total_boxes into v_den
    from public.sales_orders where id = '5a1e0000-0000-0000-0000-000000000001';
  if v_den is distinct from 10 then
    raise exception 'CONTRATO 2 ROTO: el denominador congelado cambio a %', v_den;
  end if;
end;
$$;

-- ── 3 · 🔴 La misma caja NUNCA se factura dos veces ───────────────────────
do $$
declare r jsonb; v_n int;
begin
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000001');

  if r->>'outcome' <> 'already_invoiced' then
    raise exception 'CONTRATO 3 ROTO: reintentar la misma recepcion dio % — es un cobro doble', r->>'outcome';
  end if;

  select count(*) into v_n from public.invoices
   where sales_order_id = '5a1e0000-0000-0000-0000-000000000001' and deleted_at is null;
  if v_n <> 2 then
    raise exception 'CONTRATO 3 ROTO: hay % facturas donde deberia haber 2', v_n;
  end if;
end;
$$;

-- ── 4 · 🔴 La última absorbe el resto y la suma NO se pasa del total ──────
do $$
declare r jsonb; v_suma numeric;
begin
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000004');

  if r->>'outcome' <> 'invoiced' then
    raise exception 'CONTRATO 4 ROTO: la recepcion final no facturo (outcome=%)', r->>'outcome';
  end if;
  -- Queda 1000 − 200 − 200 = 600, y P4 es la última viva: se lleva el restante
  -- entero, no su prorrateo de 1/10 ($100).
  if (r->>'total_amount')::numeric <> 600.00 then
    raise exception 'CONTRATO 4 ROTO: la final debia absorber 600.00 y facturo %', r->>'total_amount';
  end if;

  select coalesce(sum(total_amount), 0) into v_suma
    from public.invoices
   where sales_order_id = '5a1e0000-0000-0000-0000-000000000001'
     and deleted_at is null and status not in ('borrador', 'anulada');
  if v_suma <> 1000.00 then
    raise exception 'CONTRATO 4 ROTO: la OV de $1000 se facturo por % en total', v_suma;
  end if;

  -- Y la OV queda facturada, no a medias.
  if (select status from public.sales_orders where id = '5a1e0000-0000-0000-0000-000000000001')
     <> 'facturada' then
    raise exception 'CONTRATO 4 ROTO: la OV no quedo en facturada tras cubrir el total';
  end if;
end;
$$;

-- ── 5 · 🔴 total == base + iva, al centavo ────────────────────────────────
--
-- Si no cuadra, el asiento contable (0040) aborta y la factura queda emitida
-- sin contabilizar: el cliente la recibe y los libros no la ven.
do $$
declare r jsonb; v jsonb; v_so uuid := '5a1e0000-0000-0000-0000-000000000002';
begin
  insert into public.sales_orders (id, tenant_id, sales_order_code, client_markbox,
                                   client_name, total_usd, status)
  values (v_so, '22222222-2222-2222-2222-222222222222', 'OV-0002', 'DTD-0002',
          'Con IVA', 200.00, 'confirmada');
  insert into public.prealertas (id, tenant_id, sales_order_id, boxes)
  values ('b0000000-0000-0000-0000-000000000010',
          '22222222-2222-2222-2222-222222222222', v_so, 1);
  insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, client_markbox,
                                            client_name, total_cbm, total_weight_kg, prealerta_id)
  values ('c0000000-0000-0000-0000-000000000010',
          '22222222-2222-2222-2222-222222222222', 'WR-10', 'DTD-0002', 'Con IVA',
          1.0, 100, 'b0000000-0000-0000-0000-000000000010');

  r := public.sales_order_claim_and_invoice(
         '22222222-2222-2222-2222-222222222222',
         'c0000000-0000-0000-0000-000000000010');

  if r->>'outcome' <> 'invoiced' then
    raise exception 'CONTRATO 5 ROTO: no facturo con IVA activo (outcome=%)', r->>'outcome';
  end if;
  if (r->>'iva_amount')::numeric <= 0 then
    raise exception 'CONTRATO 5 ROTO: el tenant tiene IVA activo y la factura salio con IVA %', r->>'iva_amount';
  end if;
  if (r->>'base_amount')::numeric + (r->>'iva_amount')::numeric
     <> (r->>'total_amount')::numeric then
    raise exception 'CONTRATO 5 ROTO: base % + iva % no da el total % — el asiento contable abortaria',
      r->>'base_amount', r->>'iva_amount', r->>'total_amount';
  end if;

  -- Y lo guardado en la fila coincide con lo devuelto (no sólo el jsonb).
  select jsonb_build_object('b', base_amount, 'i', iva_amount, 't', total_amount) into v
    from public.invoices where id = (r->>'invoice_id')::uuid;
  if (v->>'b')::numeric + (v->>'i')::numeric <> (v->>'t')::numeric then
    raise exception 'CONTRATO 5 ROTO: la fila guardada no cuadra base+iva=total';
  end if;
end;
$$;

-- ── 6 · 🔴 Una caja NO puede apuntar a la OV de otro tenant ───────────────
do $$
begin
  insert into public.prealertas (tenant_id, sales_order_id, boxes)
  values ('22222222-2222-2222-2222-222222222222',
          '5a1e0000-0000-0000-0000-000000000001', 1);
  raise exception 'CONTRATO 6 ROTO: una caja del tenant 2 se colgo de la OV del tenant 1';
exception
  when check_violation then null;  -- esperado
end;
$$;

-- ── 7 · Un borrador NO cuenta como facturado ──────────────────────────────
--
-- Si contara, el restante se calcularía de menos y la caja siguiente se
-- facturaría por debajo — plata que no se cobra y nadie nota.
do $$
declare r jsonb; v_so uuid := '5a1e0000-0000-0000-0000-000000000003';
begin
  insert into public.sales_orders (id, tenant_id, sales_order_code, client_markbox,
                                   client_name, total_usd, status)
  values (v_so, '11111111-1111-1111-1111-111111111111', 'OV-0003', 'DTD-0003',
          'Con borrador', 500.00, 'confirmada');
  -- Un borrador de $400 colgando de la misma OV.
  insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name,
                               sales_order_id, total_amount, status)
  values ('11111111-1111-1111-1111-111111111111', 'F-BORRADOR', 'DTD-0003',
          'Con borrador', v_so, 400.00, 'borrador');

  insert into public.prealertas (id, tenant_id, sales_order_id, boxes)
  values ('b0000000-0000-0000-0000-000000000020',
          '11111111-1111-1111-1111-111111111111', v_so, 1);
  insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, client_markbox,
                                            client_name, total_cbm, total_weight_kg, prealerta_id)
  values ('c0000000-0000-0000-0000-000000000020',
          '11111111-1111-1111-1111-111111111111', 'WR-20', 'DTD-0003', 'Con borrador',
          1.0, 100, 'b0000000-0000-0000-0000-000000000020');

  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000020');

  -- Única caja viva → es la final → se lleva el restante ENTERO ($500), no
  -- $100 (que sería 500 − 400 del borrador).
  if (r->>'total_amount')::numeric <> 500.00 then
    raise exception
      'CONTRATO 7 ROTO: un borrador de $400 se conto como facturado — la caja final facturo % en vez de 500.00',
      r->>'total_amount';
  end if;
end;
$$;

-- ── 8 · Los gates duros rechazan antes de emitir ──────────────────────────
do $$
declare r jsonb; v_n_antes int; v_n_despues int;
begin
  select count(*) into v_n_antes from public.invoices;

  -- Huérfana: no se sabe de quién es la caja. Facturar sería cobrarle a
  -- cualquiera.
  insert into public.prealertas (id, tenant_id, sales_order_id, boxes)
  values ('b0000000-0000-0000-0000-000000000030',
          '11111111-1111-1111-1111-111111111111',
          '5a1e0000-0000-0000-0000-000000000001', 1);
  insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, is_orphan,
                                            total_cbm, total_weight_kg, prealerta_id)
  values ('c0000000-0000-0000-0000-000000000030',
          '11111111-1111-1111-1111-111111111111', 'WR-30', true, 1.0, 100,
          'b0000000-0000-0000-0000-000000000030');
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000030');
  if r->>'outcome' <> 'gate_failed' then
    raise exception 'CONTRATO 8 ROTO: una caja huerfana llego a facturar (outcome=%)', r->>'outcome';
  end if;

  -- Sin CBM ni peso no hay con qué calcular nada.
  insert into public.prealertas (id, tenant_id, sales_order_id, boxes)
  values ('b0000000-0000-0000-0000-000000000031',
          '11111111-1111-1111-1111-111111111111',
          '5a1e0000-0000-0000-0000-000000000001', 1);
  insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, total_cbm,
                                            total_weight_kg, prealerta_id)
  values ('c0000000-0000-0000-0000-000000000031',
          '11111111-1111-1111-1111-111111111111', 'WR-31', 0, 0,
          'b0000000-0000-0000-0000-000000000031');
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000031');
  if r->>'outcome' <> 'gate_failed' then
    raise exception 'CONTRATO 8 ROTO: una caja sin CBM/peso llego a facturar (outcome=%)', r->>'outcome';
  end if;

  -- Y ninguno de los dos dejó una factura a medio hacer.
  select count(*) into v_n_despues from public.invoices;
  if v_n_despues <> v_n_antes then
    raise exception 'CONTRATO 8 ROTO: un gate rechazo pero igual quedaron % facturas nuevas',
      v_n_despues - v_n_antes;
  end if;
end;
$$;

-- ── 9 · Una recepción que no existe no revienta: responde not_found ───────
do $$
declare r jsonb;
begin
  r := public.sales_order_claim_and_invoice(
         '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-0000000000ff');
  if r->>'outcome' <> 'not_found' then
    raise exception 'CONTRATO 9 ROTO: una recepcion inexistente dio %', r->>'outcome';
  end if;

  -- Y la recepción de OTRO tenant tampoco se ve (el filtro por tenant está en
  -- el primer SELECT; sin él, se facturaría carga ajena).
  r := public.sales_order_claim_and_invoice(
         '22222222-2222-2222-2222-222222222222',
         'c0000000-0000-0000-0000-000000000001');
  if r->>'outcome' <> 'not_found' then
    raise exception 'CONTRATO 9 ROTO: el tenant 2 alcanzo una recepcion del tenant 1 (%)', r->>'outcome';
  end if;
end;
$$;

rollback;
