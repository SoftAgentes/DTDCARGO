-- SDD-0559 · Radiografía de integridad contable · SOLO LECTURA · conteos y comparaciones.
--
-- Mide, por documento y por tenant, lo que el diagnóstico del 2026-10-18 llamó B1 (documentos
-- anulados con asiento vivo), B2 (documentos en VES/CNY), B3 (documentos sin asiento vivo),
-- B4 (reportes de pago confirmados, que no crean recibo ni asiento), los documentos con más de
-- un asiento vivo de su origen, el cobrado de cada factura contra sus tres fuentes, 1.1.2 y
-- 2.1.1 del mayor contra sus subdiarios, B16 (partida doble) y B5 (facturas por año). No
-- corrige nada: dimensiona. Las definiciones son las canónicas de la spec
-- docs/specs/0559-radiografia-integridad-repetible/spec.md, las mismas de la SDD-0557.
--
-- «Asiento vivo» = journal_entries.status 'asentado' y deleted_at nulo: lo mismo que suman los
-- saldos de la app (lib/studio/account-queries.ts). El borrador no cuenta. Un documento tiene
-- asiento si hay uno vivo de SU origen (source) unido por cualquiera de los dos lados del
-- vínculo: doc.journal_entry_id = asiento.id o asiento.<doc>_id = doc.id.
--
-- SALIDA (una sola tabla): orden · seccion · indicador · n · monto_usd.
--   · Por defecto `n` es siempre un conteo y monto_usd va vacío. Es lo ÚNICO que puede ir a
--     Git, a un handoff o a un documento.
--   · Con `-v montos=on`, monto_usd trae sumas de seis filas, todas de documentos en USD o
--     USDT (anuladas con asiento, sin asiento, recibos sin asiento, reportes confirmados y
--     cobrado contra sus fuentes), y cada sección empieza por la marca de montos. Las filas
--     del mayor no llevan monto: el mayor mezcla monedas (B2). Esa salida es sólo para la
--     conversación: la prueba falla si una fila con la marca aparece en docs/ o .agents/.
--   · Nunca lee nombres, RIF, Shipping Mark, códigos de documento, memos, notas ni referencias;
--     el origen libre de un asiento se reduce a una lista cerrada. No convierte monedas: lo que
--     está en VES/CNY se cuenta aparte y no entra en las sumas en USD.
--   · Lee public.referrals sólo en id, status, reward_usd, applied_invoice_id, applied_entry_id y
--     deleted_at.
--
-- PRODUCCIÓN: sólo con autorización escrita de Sam que nombre esta radiografía (y la migración
-- de reparación que dimensiona, cuando la hay). La corre el Director, desde la raíz del checkout:
--   MSYS_NO_PATHCONV=1 /c/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes root@<vps> \
--     'docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -q -A -F "|" -P footer=off \
--      -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never' \
--     < scripts/qa/radiografia-integridad.sql
-- (montos: agregar `-v montos=on` dentro de las comillas). Transacción de solo lectura con
-- statement_timeout 60 s y lock_timeout 5 s; termina en ROLLBACK.
-- LOCAL: scripts/qa/radiografia-integridad.fixture.sql (PGlite en
-- scripts/__tests__/radiografia-integridad.test.ts; el esquema completo, en
-- scripts/check-schema-rebuild.mjs).
\set ON_ERROR_STOP on
\if :{?montos}
\else
\set montos off
\endif
begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '5s';
\if :montos
set local dtd.radiografia_montos = 'on';
\endif
with
-- Asiento vivo: la única definición. NOT MATERIALIZED deja que cada subconsulta use los índices
-- de journal_entries (invoice_id, receipt_id, bill_id, supplier_payment_id).
je_vivo as not materialized (
  select je.id, je.tenant_id, je.source, je.invoice_id, je.receipt_id, je.bill_id, je.supplier_payment_id,
         je.referral_id
  from public.journal_entries je
  where je.deleted_at is null and je.status = 'asentado'
),
-- Líneas de los asientos vivos, con la cuenta de control que tocan (la cuenta o sus subcuentas).
lin as (
  select j.id as entry_id, j.tenant_id, j.source, l.debit, l.credit,
         a.code = '1.1.2' or a.code like '1.1.2.%' as es_cxc,
         a.code = '2.1.1' or a.code like '2.1.1.%' as es_cxp,
         a.code = '4.5' or a.code like '4.5.%' as es_ingreso,
         a.code = '2.1.5' or a.code like '2.1.5.%' as es_iva
  from je_vivo j
  join public.journal_lines l on l.entry_id = j.id
  join public.accounts a on a.id = l.account_id
),
-- Facturas no borradas. Abierta = emitida, parcial, pagada o vencida (sin borradores ni anuladas).
fac as (
  select i.id, i.tenant_id, i.status::text as estado, i.currency::text as moneda, i.fx_rate,
         i.total_amount, i.paid_amount, i.issued_at,
         i.status::text in ('emitida', 'parcial', 'pagada', 'vencida') as abierta,
         (select count(*) from je_vivo j where j.source = 'invoice' and j.invoice_id = i.id) as asientos,
         exists (select 1 from public.payment_receipts r where r.invoice_id = i.id and r.deleted_at is null) as con_recibo
  from public.invoices i
  where i.deleted_at is null
),
-- Recibos, vivos y anulados (anular = deleted_at). El asiento del cobro es 'receipt'; la
-- reclasificación al identificar un pago sin referencia es 'receipt_reclass'. con_factura: el
-- pago sin referencia es el único sin invoice_id (CHECK de 0122); al identificarlo se le escribe
-- (0467), así que el identificado también tiene factura, aunque solo toca 1.1.2 con su
-- reclasificación. vinculo_vivo: el lado del documento apunta a un asiento de cobro vivo (no a
-- uno anulado, borrado o de otro origen).
rec as (
  select r.id, r.tenant_id, r.amount, r.currency::text as moneda, r.deleted_at is null as vivo,
         r.invoice_id is not null as con_factura,
         r.journal_entry_id is not null as con_vinculo, r.identified_at is not null as identificado,
         (select count(*) from je_vivo j where j.source = 'receipt'
           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as asientos,
         (select count(*) from je_vivo j where j.source = 'receipt_reclass'
           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as reclasificaciones,
         exists (select 1 from je_vivo j where j.source = 'receipt' and j.id = r.journal_entry_id) as vinculo_vivo,
         exists (select 1 from public.journal_entries e where e.id = r.journal_entry_id
                  and e.status = 'anulado') as vinculo_anulado
  from public.payment_receipts r
),
-- Cuentas por pagar no borradas (anulada = status).
cxp as (
  select b.id, b.tenant_id, b.status = 'anulada' as anulada, b.currency::text as moneda,
         b.total_amount, b.paid_amount,
         (select count(*) from je_vivo j where j.source = 'supplier_bill'
           and (j.id = b.journal_entry_id or j.bill_id = b.id)) as asientos
  from public.supplier_bills b
  where b.deleted_at is null
),
-- Pagos a proveedor, vivos y anulados (anular = deleted_at).
pag as (
  select p.id, p.tenant_id, p.deleted_at is null as vivo, p.currency::text as moneda,
         (select count(*) from je_vivo j where j.source = 'supplier_payment'
           and (j.id = p.journal_entry_id or j.supplier_payment_id = p.id)) as asientos
  from public.supplier_payments p
),
-- Créditos de referido no borrados; aplicado = abono no monetario en una factura (0471).
cred as (
  select c.id, c.status = 'aplicado' as aplicado, c.applied_invoice_id, c.applied_entry_id, c.reward_usd
  from public.referrals c
  where c.deleted_at is null
),
-- Crédito aplicado ↔ su asiento vivo 'referral_credit', por los dos lados del vínculo: el del
-- asiento (journal_entries.referral_id) y el del documento (referrals.applied_entry_id), que es
-- el que la reversión usa para los asientos viejos sin referral_id (referral-credit-posting.ts).
cred_asiento as (
  select c.id as credito, j.id as asiento
  from cred c
  join je_vivo j on j.source = 'referral_credit' and c.aplicado
   and (j.referral_id = c.id or j.id = c.applied_entry_id)
),
-- Reportes de pago no borrados. «cancelado» se deriva de cancelled_at (0421): sigue en 'reportado'.
rep as (
  select p.id, p.amount, p.currency::text as moneda,
         case when p.cancelled_at is not null then 'cancelado' else p.status::text end as estado,
         exists (select 1 from public.invoices i where i.id = p.invoice_id and i.currency <> p.currency) as otra_moneda,
         exists (select 1 from public.payment_receipts r where r.invoice_id = p.invoice_id
                  and r.deleted_at is null and r.amount = p.amount) as recibo_mismo_monto
  from public.payment_reports p
  where p.deleted_at is null
),
-- El cobrado de cada factura contra sus tres fuentes: recibos vivos, reportes confirmados vivos
-- y créditos de referido aplicados.
cobro as (
  select f.id, f.estado, f.moneda, f.paid_amount, x.recibos,
         x.recibos + x.reportes + x.creditos as fuentes
  from fac f
  cross join lateral (select
    coalesce((select sum(r.amount) from public.payment_receipts r
               where r.invoice_id = f.id and r.deleted_at is null), 0) as recibos,
    coalesce((select sum(p.amount) from public.payment_reports p
               where p.invoice_id = f.id and p.deleted_at is null and p.status = 'confirmado'), 0) as reportes,
    coalesce((select sum(c.reward_usd) from cred c
               where c.aplicado and c.applied_invoice_id = f.id), 0) as creditos) x
),
mov as (
  select tenant_id from fac
  union select tenant_id from je_vivo
  union select tenant_id from rec
  union select tenant_id from cxp
  union select tenant_id from pag
),
mayor as (
  select tenant_id,
         sum(debit) filter (where es_cxc) as cxc_debe, sum(credit) filter (where es_cxc) as cxc_haber,
         sum(debit) filter (where es_cxp) as cxp_debe, sum(credit) filter (where es_cxp) as cxp_haber
  from lin
  group by tenant_id
),
-- Un lado por tenant y cuenta de control. saldo_docs suma solo USD/USDT (no convierte).
-- no_comparable (decisión 7): documentos fuera de USD/USDT CON asiento vivo de su origen. En
-- 1.1.2 cuenta solo el recibo que toca 1.1.2: con factura y, si se identificó, con su
-- reclasificación viva. El pago sin referencia se asienta contra 2.1.8 y la reclasificación es
-- la que lo pasa a 1.1.2 (receipt-posting.ts). La CxP anulada no cuenta: su asiento vivo es B1
-- (fila 44) y queda como diferencia, igual que en la SDD-0557.
-- fuera: documentos abiertos fuera de USD/USDT que no entran en la suma.
lado as (
  select m.tenant_id, c.cuenta, c.debe, c.haber, c.saldo_mayor, c.abiertos, c.saldo_docs, c.no_comparable, c.fuera
  from mov m
  left join mayor y on y.tenant_id = m.tenant_id
  cross join lateral (values
    ('1.1.2', coalesce(y.cxc_debe, 0), coalesce(y.cxc_haber, 0), coalesce(y.cxc_debe, 0) - coalesce(y.cxc_haber, 0),
     (select count(*) from fac f where f.tenant_id = m.tenant_id and f.abierta
        and f.total_amount <> f.paid_amount),
     (select coalesce(sum(f.total_amount - f.paid_amount), 0) from fac f where f.tenant_id = m.tenant_id
        and f.abierta and f.moneda in ('USD', 'USDT')),
     exists (select 1 from fac f where f.tenant_id = m.tenant_id
               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)
       or exists (select 1 from rec r where r.tenant_id = m.tenant_id and r.vivo and r.con_factura
                    and (not r.identificado or r.reclasificaciones > 0)
                    and r.moneda not in ('USD', 'USDT') and r.asientos > 0),
     exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.abierta
               and f.moneda not in ('USD', 'USDT') and f.total_amount <> f.paid_amount)),
    ('2.1.1', coalesce(y.cxp_debe, 0), coalesce(y.cxp_haber, 0), coalesce(y.cxp_haber, 0) - coalesce(y.cxp_debe, 0),
     (select count(*) from cxp b where b.tenant_id = m.tenant_id and not b.anulada
        and b.total_amount <> b.paid_amount),
     (select coalesce(sum(b.total_amount - b.paid_amount), 0) from cxp b where b.tenant_id = m.tenant_id
        and not b.anulada and b.moneda in ('USD', 'USDT')),
     exists (select 1 from cxp b where b.tenant_id = m.tenant_id and not b.anulada
               and b.moneda not in ('USD', 'USDT') and b.asientos > 0)
       or exists (select 1 from pag p where p.tenant_id = m.tenant_id and p.vivo
                    and p.moneda not in ('USD', 'USDT') and p.asientos > 0),
     exists (select 1 from cxp b where b.tenant_id = m.tenant_id and not b.anulada
               and b.moneda not in ('USD', 'USDT') and b.total_amount <> b.paid_amount))
  ) c(cuenta, debe, haber, saldo_mayor, abiertos, saldo_docs, no_comparable, fuera)
),
-- El estado de cada lado, en este orden: el primero que se cumple gana (decisiones 6 y 7).
cuadre as (
  select cuenta, fuera,
         case when debe = 0 and haber = 0 and abiertos > 0 then 'sin movimiento en el mayor'
              when no_comparable then 'no comparable'
              when debe = 0 and haber = 0 then 'sin movimiento en la cuenta'
              when round(saldo_mayor - saldo_docs, 2) = 0 then 'cuadra'
              when saldo_mayor > saldo_docs then 'mayor por encima'
              else 'mayor por debajo' end as estado
  from lado
),
partida as (
  select j.id, coalesce(sum(l.debit), 0) as debe, coalesce(sum(l.credit), 0) as haber, count(l.entry_id) as lineas
  from je_vivo j
  left join public.journal_lines l on l.entry_id = j.id
  group by j.id
),
filas (orden, seccion, indicador, n, monto) as (
  select 10, '0 · tamaño', 'tenants con movimiento', (select count(*) from mov), null::numeric
  union all select 11, '0 · tamaño', 'facturas', (select count(*) from fac), null
  union all select 12, '0 · tamaño', 'asientos asentados vivos', (select count(*) from je_vivo), null
  union all select 13, '0 · tamaño', 'recibos vivos', (select count(*) from rec where vivo), null
  union all select 14, '0 · tamaño', 'reportes de pago', (select count(*) from rep), null
  union all select 15, '0 · tamaño', 'cuentas por pagar', (select count(*) from cxp), null
  union all select 16, '0 · tamaño', 'pagos a proveedor vivos', (select count(*) from pag where vivo), null
  union all select 20, '1 · documentos por estado y moneda', 'facturas · ' || estado || ' · ' || moneda, count(*), null
    from fac group by estado, moneda
  union all select 21, '1 · documentos por estado y moneda', 'facturas no borrador en VES/CNY sin tasa',
    (select count(*) from fac where estado <> 'borrador' and moneda not in ('USD', 'USDT')
       and (fx_rate is null or fx_rate <= 0)), null
  union all select 22, '1 · documentos por estado y moneda', 'facturas no borrador en USDT sin tasa (informativa)',
    (select count(*) from fac where estado <> 'borrador' and moneda = 'USDT'
       and (fx_rate is null or fx_rate <= 0)), null
  union all select 23, '1 · documentos por estado y moneda', 'facturas en VES/CNY con asiento de venta vivo',
    (select count(*) from fac where moneda not in ('USD', 'USDT') and asientos > 0), null
  union all select 24, '1 · documentos por estado y moneda', 'recibos vivos en VES/CNY con asiento de cobro vivo',
    (select count(*) from rec where vivo and moneda not in ('USD', 'USDT') and asientos > 0), null
  union all select 30, '2 · asientos por estado y origen', 'asientos · ' || x.estado || ' · ' || x.origen, count(*), null
    from (select je.status::text as estado,
                 case when je.source in ('manual', 'invoice', 'receipt', 'receipt_reclass', 'supplier_bill',
                        'supplier_payment', 'expense', 'claim', 'depreciacion', 'referral_credit',
                        'nomina_settlement', 'supplier_charge', 'currency_conversion', 'supplier_claim_offset')
                      then je.source else 'otro' end as origen
            from public.journal_entries je where je.deleted_at is null) x
    group by x.estado, x.origen
  union all select 40, '3 · B1 documentos anulados con asiento vivo', 'facturas anuladas con asiento de venta vivo',
    count(*), sum(total_amount) filter (where moneda in ('USD', 'USDT'))
    from fac where estado = 'anulada' and asientos > 0
  union all select 41, '3 · B1 documentos anulados con asiento vivo', '  de ellas con abonos (cobrado o recibo vivo)',
    (select count(*) from fac where estado = 'anulada' and asientos > 0 and (paid_amount > 0 or con_recibo)), null
  union all select 42, '3 · B1 documentos anulados con asiento vivo', 'recibos anulados con asiento de cobro vivo',
    (select count(*) from rec where not vivo and asientos > 0), null
  union all select 43, '3 · B1 documentos anulados con asiento vivo', 'recibos anulados con asiento de reclasificación vivo',
    (select count(*) from rec where not vivo and reclasificaciones > 0), null
  union all select 44, '3 · B1 documentos anulados con asiento vivo', 'cuentas por pagar anuladas con asiento vivo',
    (select count(*) from cxp where anulada and asientos > 0), null
  union all select 45, '3 · B1 documentos anulados con asiento vivo', 'pagos a proveedor anulados con asiento vivo',
    (select count(*) from pag where not vivo and asientos > 0), null
  union all select 46, '3 · B1 documentos anulados con asiento vivo', 'asientos de crédito de referido vivos sin crédito aplicado',
    (select count(*) from je_vivo j where j.source = 'referral_credit'
       and not exists (select 1 from cred_asiento k where k.asiento = j.id)), null
  union all select 47, '3 · B1 documentos anulados con asiento vivo', 'asientos de venta vivos cuya factura está borrada o no existe',
    (select count(*) from je_vivo j where j.source = 'invoice'
       and not exists (select 1 from public.invoices i where i.id = j.invoice_id and i.deleted_at is null)), null
  union all select 50, '4 · B3 documentos sin asiento vivo', 'facturas emitidas, parciales, pagadas o vencidas sin asiento de venta vivo',
    count(*), sum(total_amount) filter (where moneda in ('USD', 'USDT'))
    from fac where abierta and asientos = 0
  union all select 51, '4 · B3 documentos sin asiento vivo', 'recibos vivos sin asiento de cobro vivo',
    count(*), sum(amount) filter (where moneda in ('USD', 'USDT'))
    from rec where vivo and asientos = 0
  union all select 52, '4 · B3 documentos sin asiento vivo', '  de ellos con vínculo a un asiento anulado',
    (select count(*) from rec where vivo and asientos = 0 and vinculo_anulado), null
  union all select 53, '4 · B3 documentos sin asiento vivo', 'recibos vivos con asiento de cobro vivo pero sin vínculo',
    (select count(*) from rec where vivo and asientos > 0 and not con_vinculo), null
  union all select 54, '4 · B3 documentos sin asiento vivo', 'recibos vivos identificados sin asiento de reclasificación vivo',
    (select count(*) from rec where vivo and identificado and reclasificaciones = 0), null
  union all select 55, '4 · B3 documentos sin asiento vivo', 'cuentas por pagar vivas sin asiento vivo',
    (select count(*) from cxp where not anulada and asientos = 0), null
  union all select 56, '4 · B3 documentos sin asiento vivo', 'pagos a proveedor vivos sin asiento vivo',
    (select count(*) from pag where vivo and asientos = 0), null
  union all select 57, '4 · B3 documentos sin asiento vivo', 'créditos de referido aplicados sin asiento vivo',
    (select count(*) from cred c where c.aplicado
       and not exists (select 1 from cred_asiento k where k.credito = c.id)), null
  union all select 58, '4 · B3 documentos sin asiento vivo', 'recibos vivos con asiento de cobro vivo y el vínculo a otro asiento (anulado, borrado o de otro origen)',
    (select count(*) from rec where vivo and asientos > 0 and con_vinculo and not vinculo_vivo), null
  union all select 60, '5 · documentos con más de un asiento vivo de su origen', 'facturas con más de un asiento de venta vivo',
    (select count(*) from fac where asientos > 1), null
  union all select 61, '5 · documentos con más de un asiento vivo de su origen', 'recibos con más de un asiento de cobro vivo',
    (select count(*) from rec where asientos > 1), null
  union all select 62, '5 · documentos con más de un asiento vivo de su origen', 'cuentas por pagar con más de un asiento vivo',
    (select count(*) from cxp where asientos > 1), null
  union all select 63, '5 · documentos con más de un asiento vivo de su origen', 'pagos a proveedor con más de un asiento vivo',
    (select count(*) from pag where asientos > 1), null
  union all select 70, '6 · B4 reportes de pago', 'reportes · ' || estado, count(*), null from rep group by estado
  union all select 71, '6 · B4 reportes de pago', 'confirmados (ninguno crea recibo ni asiento)',
    count(*), sum(amount) filter (where moneda in ('USD', 'USDT'))
    from rep where estado = 'confirmado'
  union all select 72, '6 · B4 reportes de pago', '  de ellos en otra moneda que su factura',
    (select count(*) from rep where estado = 'confirmado' and otra_moneda), null
  union all select 73, '6 · B4 reportes de pago', '  de ellos con un recibo vivo del mismo monto en su factura',
    (select count(*) from rep where estado = 'confirmado' and recibo_mismo_monto), null
  -- «Igual» exige algo que comparar: la factura sin cobrado ni fuentes (0 contra 0) va en la 87.
  -- En la 80, cobrado 0 con un reporte o un crédito es «igual» a sus recibos (cero); en la 83,
  -- con cobrado = fuentes, cobrado > 0 basta.
  union all select 80, '7 · cobrado contra sus fuentes', 'facturas con cobrado igual a sus recibos vivos',
    (select count(*) from cobro where paid_amount = recibos and (paid_amount > 0 or fuentes > 0)), null
  union all select 81, '7 · cobrado contra sus fuentes', 'facturas con cobrado mayor que sus recibos vivos',
    (select count(*) from cobro where paid_amount > recibos), null
  union all select 82, '7 · cobrado contra sus fuentes', 'facturas con cobrado menor que sus recibos vivos',
    (select count(*) from cobro where paid_amount < recibos), null
  union all select 83, '7 · cobrado contra sus fuentes', 'facturas con cobrado igual a recibos + reportes confirmados + créditos de referido',
    (select count(*) from cobro where paid_amount = fuentes and paid_amount > 0), null
  union all select 84, '7 · cobrado contra sus fuentes', 'facturas con cobrado mayor que sus tres fuentes',
    count(*), sum(paid_amount - fuentes) filter (where moneda in ('USD', 'USDT'))
    from cobro where paid_amount > fuentes
  union all select 85, '7 · cobrado contra sus fuentes', 'facturas con cobrado menor que sus tres fuentes',
    count(*), sum(fuentes - paid_amount) filter (where moneda in ('USD', 'USDT'))
    from cobro where paid_amount < fuentes
  union all select 86, '7 · cobrado contra sus fuentes', 'facturas anuladas con cobrado',
    (select count(*) from cobro where estado = 'anulada' and paid_amount > 0), null
  union all select 87, '7 · cobrado contra sus fuentes', 'facturas sin cobrado ni fuentes',
    (select count(*) from cobro where paid_amount = 0 and fuentes = 0), null
  union all select 90, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants sin movimiento en el mayor (facturas abiertas, 1.1.2 sin asientos vivos)',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'sin movimiento en el mayor'), null
  union all select 91, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants no comparables (factura, o recibo con factura, en VES/CNY con asiento vivo)',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'no comparable'), null
  union all select 92, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants sin movimiento en la cuenta (0 contra 0)',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'sin movimiento en la cuenta'), null
  union all select 93, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants que cuadran',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'cuadra'), null
  union all select 94, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants con el mayor por encima de las facturas abiertas',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'mayor por encima'), null
  union all select 95, '8 · 1.1.2 mayor contra facturas abiertas', 'tenants con el mayor por debajo de las facturas abiertas',
    (select count(*) from cuadre where cuenta = '1.1.2' and estado = 'mayor por debajo'), null
  union all select 96, '8 · 1.1.2 mayor contra facturas abiertas', '  de los que cuadran o no, con facturas abiertas en VES/CNY fuera de la suma',
    (select count(*) from cuadre where cuenta = '1.1.2' and fuera
       and estado in ('cuadra', 'mayor por encima', 'mayor por debajo')), null
  union all select 97, '8 · 1.1.2 mayor contra facturas abiertas', 'asientos manuales vivos que tocan 1.1.2',
    (select count(distinct entry_id) from lin where es_cxc and source = 'manual'), null
  union all select 100, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants sin movimiento en el mayor (cuentas por pagar abiertas, 2.1.1 sin asientos vivos)',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'sin movimiento en el mayor'), null
  union all select 101, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants no comparables (cuenta por pagar o pago en VES/CNY con asiento vivo)',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'no comparable'), null
  union all select 102, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants sin movimiento en la cuenta (0 contra 0)',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'sin movimiento en la cuenta'), null
  union all select 103, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants que cuadran',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'cuadra'), null
  union all select 104, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants con el mayor por encima de las cuentas por pagar',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'mayor por encima'), null
  union all select 105, '9 · 2.1.1 mayor contra cuentas por pagar', 'tenants con el mayor por debajo de las cuentas por pagar',
    (select count(*) from cuadre where cuenta = '2.1.1' and estado = 'mayor por debajo'), null
  union all select 106, '9 · 2.1.1 mayor contra cuentas por pagar', '  de los que cuadran o no, con cuentas por pagar abiertas en VES/CNY fuera de la suma',
    (select count(*) from cuadre where cuenta = '2.1.1' and fuera
       and estado in ('cuadra', 'mayor por encima', 'mayor por debajo')), null
  union all select 110, '10 · B16 partida doble', 'asientos asentados con debe distinto de haber',
    (select count(*) from partida where debe <> haber), null
  union all select 111, '10 · B16 partida doble', 'asientos asentados con menos de dos líneas',
    (select count(*) from partida where lineas < 2), null
  union all select 120, '11 · B5 facturas no borrador por año de emisión', 'año ' || extract(year from issued_at)::int, count(*), null
    from fac where estado <> 'borrador' and issued_at is not null group by extract(year from issued_at)::int
  union all select 121, '11 · B5 facturas no borrador por año de emisión', 'sin fecha de emisión',
    (select count(*) from fac where estado <> 'borrador' and issued_at is null), null
  union all select 130, '12 · 4.5 ingresos y 2.1.5 IVA del mayor', 'asientos vivos que tocan 4.5',
    (select count(distinct entry_id) from lin where es_ingreso), null
  union all select 131, '12 · 4.5 ingresos y 2.1.5 IVA del mayor', 'asientos vivos que tocan 2.1.5',
    (select count(distinct entry_id) from lin where es_iva), null
)
select orden,
       case when pg_catalog.current_setting('dtd.radiografia_montos', true) = 'on'
            then 'MONTOS-NO-VA-A-GIT · ' || seccion else seccion end as seccion,
       indicador, n,
       case when pg_catalog.current_setting('dtd.radiografia_montos', true) = 'on'
            then round(monto, 2) end as monto_usd
from filas
order by orden, indicador;
rollback;
