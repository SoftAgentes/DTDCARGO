-- SDD-0573 · A2 · Qué facturas no cuadran para la 0497 · SOLO LECTURA · conteos por clase.
--
-- Desde la 0497, `i3_invoice_final_check` llama a `i3_assert_invoice_final` cuando la
-- factura entra o sale de `anulada` o `borrador`, cuando cambia su `deleted_at` o su
-- tenant, y en INSERT y DELETE. La aserción falla con 23514 si la factura y su venta no
-- cuadran. Una factura de antes en ese estado sigue aceptando un cobro o un renombre,
-- pero no esas transiciones, y `void` y `post` piden revisión. Este archivo cuenta esas
-- facturas ANTES de aplicar la 0497, con la misma lógica: por eso no usa ningún objeto
-- de la 0497. `lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts` compara
-- este conteo con el resultado de la función real sobre las mismas filas.
--
-- SALIDA (una sola tabla): clase · estado_factura · n. Solo etiquetas y conteos: ni ids,
-- ni códigos, ni montos, ni nombres, ni tenant. Lee filas de negocio por dentro, así que
-- correrlo en producción pide autorización aunque no las muestre.
--
-- Cada factura cae en una sola clase, la primera que falla, en este orden:
--   Mensaje «La relación contable de la factura requiere revisión.»
--     factura_borrada_con_venta · dos_o_mas_ventas
--   Mensaje «La venta original requiere revisión.»
--     venta_de_otro_tenant · venta_en_borrador · venta_anulada · venta_borrada ·
--     venta_sin_codigo · venta_sin_fecha_de_asiento · venta_con_fecha_invalida ·
--     lineas_ninguna · lineas_solo_una · lineas_cuenta_no_clasificable ·
--     lineas_importe_invalido · lineas_sin_cxc_o_ingreso · lineas_descuadradas
--   Mensaje «Una factura anulada con venta requiere su reverso íntegro.»
--     anulada_sin_reverso
--   Mensaje «Estado de factura y par contable incompatibles.»
--     estado_sin_venta_posible
--   Cuadran: sana (tiene su venta y cuadra) · sin_venta (no tiene asiento de venta).
\set ON_ERROR_STOP on
begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $guarda$
begin
  if pg_catalog.to_regprocedure('public.i3_assert_invoice_final(uuid)') is not null then
    raise exception 'Este conteo es de antes de la 0497: con ella aplicada, usar public.i3_assert_invoice_final.';
  end if;
end;
$guarda$;

with recursive
por_factura as (
  select i.id as invoice_id, i.tenant_id, i.status::text as estado_factura, i.deleted_at,
         count(*) as ventas, (pg_catalog.array_agg(e.id))[1] as entry_id
  from public.invoices i
  join public.journal_entries e on e.invoice_id = i.id and e.source = 'invoice'
  group by i.id
),
lineas as (
  select l.id as line_id, f.invoice_id, f.tenant_id, l.account_id, l.debit, l.credit
  from por_factura f
  join public.journal_lines l on l.entry_id = f.entry_id
  where f.ventas = 1
),
ancestry as (
  select l.line_id, l.tenant_id, a.id, a.parent_id, a.code, array[a.id] as seen
  from lineas l
  join public.accounts a on a.id = l.account_id
  where a.tenant_id = l.tenant_id and a.is_postable
  union all
  select c.line_id, c.tenant_id, a.id, a.parent_id, a.code, c.seen || a.id
  from ancestry c
  join public.accounts a on a.id = c.parent_id
  where a.tenant_id = c.tenant_id and not a.id = any(c.seen)
),
clasificadas as (
  select l.invoice_id, l.debit, l.credit,
    (select min(c.code) from ancestry c
      where c.line_id = l.line_id and c.code in ('1.1.2','4.5','2.1.5') having count(*) = 1) as kind,
    not exists (select 1 from ancestry c
      where c.line_id = l.line_id and c.parent_id is not null
        and not exists (select 1 from public.accounts parent
          where parent.id = c.parent_id and parent.tenant_id = l.tenant_id and not parent.id = any(c.seen))) as ancestry_valid
  from lineas l
),
por_asiento as (
  select invoice_id, count(*) as n,
    bool_and(kind is not null and ancestry_valid) as cuentas_ok,
    bool_and(coalesce(debit is not null and credit is not null
      and debit between 0 and 999999999999.99
      and credit between 0 and 999999999999.99
      and scale(debit) <= 2 and scale(credit) <= 2
      and (debit = 0 or credit = 0)
      and case kind when '1.1.2' then credit = 0 and debit > 0
                    when '4.5' then debit = 0
                    when '2.1.5' then debit = 0 and credit > 0
                    else false end, false)) as importes_ok,
    count(*) filter (where kind = '1.1.2') as n_cxc,
    count(*) filter (where kind = '4.5') as n_ingreso,
    sum(debit) as debe, sum(credit) as haber
  from clasificadas
  group by invoice_id
),
clasificacion as (
  select f.estado_factura,
    case
      when f.deleted_at is not null then 'factura_borrada_con_venta'
      when f.ventas <> 1 then 'dos_o_mas_ventas'
      when e.tenant_id <> f.tenant_id then 'venta_de_otro_tenant'
      when e.status::text = 'borrador' then 'venta_en_borrador'
      when e.status::text <> 'asentado' then 'venta_anulada'
      when e.deleted_at is not null then 'venta_borrada'
      when nullif(pg_catalog.btrim(e.entry_code), '') is null then 'venta_sin_codigo'
      when e.posted_at is null then 'venta_sin_fecha_de_asiento'
      when not pg_catalog.isfinite(e.posted_at) or not pg_catalog.isfinite(e.entry_date)
        or e.entry_date not between date '0001-01-01' and date '9999-12-31' then 'venta_con_fecha_invalida'
      when coalesce(a.n, 0) = 0 then 'lineas_ninguna'
      when a.n = 1 then 'lineas_solo_una'
      when not a.cuentas_ok then 'lineas_cuenta_no_clasificable'
      when not a.importes_ok then 'lineas_importe_invalido'
      when a.n_cxc <> 1 or a.n_ingreso < 1 then 'lineas_sin_cxc_o_ingreso'
      when not (a.debe > 0 and a.debe = a.haber) then 'lineas_descuadradas'
      when f.estado_factura = 'anulada' then 'anulada_sin_reverso'
      when f.estado_factura not in ('emitida','parcial','vencida','pagada') then 'estado_sin_venta_posible'
      else 'sana'
    end as clase
  from por_factura f
  left join public.journal_entries e on e.id = f.entry_id and f.ventas = 1
  left join por_asiento a on a.invoice_id = f.invoice_id
),
todas as (
  select clase, estado_factura from clasificacion
  union all
  select 'sin_venta', i.status::text from public.invoices i
  where not exists (select 1 from public.journal_entries e where e.invoice_id = i.id and e.source = 'invoice')
)
select clase, estado_factura, count(*) as n
from todas
group by clase, estado_factura
order by clase, estado_factura;

rollback;
