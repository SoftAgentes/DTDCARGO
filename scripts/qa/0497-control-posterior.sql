-- SDD-0573 · Control después de aplicar la 0497 · SOLO LECTURA · conteos por clase.
--
-- La guarda de la 0497 afirma en toda escritura, así que tocar una factura cuya venta no cuadra
-- falla al confirmar. Lo que nadie toca no avisa: una factura sin asiento de venta, que la
-- aserción no revisa, y una venta que quedó inválida por un cambio en `accounts`. Este archivo
-- es esa alarma, por corrida. Línea base de producción, medida el 2026-11-02 con la 0497 sin
-- aplicar y las 7 facturas de prueba ya borradas: 0 filas en el conteo previo, así que aquí se
-- espera lo que se haya emitido desde entonces y nada más. Va con la 0497 aplicada; antes de
-- aplicarla, scripts/qa/0497-legado-por-clase.sql. Se apoya en
-- `i3_original_valid` y `i3_mirror_valid`, y
-- `lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts` lo compara con
-- `i3_assert_invoice_final` sobre las mismas filas. Esa función no corre aquí: usa `for update`.
--
-- SALIDA (una sola tabla): clase · estado_factura · diagnostico · n. Solo etiquetas y conteos: ni
-- ids, ni códigos, ni montos, ni nombres, ni tenant. Lee filas de negocio por dentro, así que
-- correrlo en producción pide autorización aunque no las muestre.
--
-- La columna `diagnostico` dice cómo está la fila AHORA, no de dónde vino. Ninguna columna guarda
-- la transición, así que ni las fechas ni la hora del apply prueban quién la dejó así. Para saber
-- qué cambió, comparar estas filas contra el conteo previo (scripts/qa/0497-legado-por-clase.sql).
--   cuadra                      Tiene su venta y cuadra, con su reverso si está anulada.
--   sin_venta_fechas_recientes  Viva y sin asiento de venta, con `issued_at` desde el día del apply
--                               y `created_at` o `updated_at` después de él. Puede ser de la web
--                               vieja, o de antes: emitida ese día antes del apply y tocada después.
--   sin_venta_fechas_viejas     Sin asiento de venta y fuera de ese criterio: borradores, anuladas
--                               y vivas con otras fechas. Una factura emitida después del apply con
--                               `issued_at` anterior cae aquí: no prueba que sea de antes.
--   viva_no_cuadra              Viva, con un par que no cuadra. No se puede cobrar ni renombrar:
--                               falla al confirmar. Pudo llegar así o quedar así después:
--                               `i3_original_valid` lee `is_postable`, código y jerarquía actuales de
--                               `accounts`, y cambiarlos invalida una venta sana. Volver el valor la repara.
--   no_viva_no_cuadra           No cuadra y no está viva, como una anulada con su venta anulada.
--
-- Clases, en el orden de `i3_assert_invoice_final`; cada factura cae en la primera que falla:
--   sin_venta · factura_borrada_con_venta · reverso_sin_venta · dos_o_mas_ventas ·
--   otros_asientos_en_el_par · venta_de_otro_tenant · venta_en_borrador · venta_anulada ·
--   venta_borrada · venta_sin_codigo · venta_sin_fecha_de_asiento · venta_con_fecha_invalida ·
--   lineas_ninguna · lineas_solo_una · lineas_cuenta_no_clasificable · lineas_importe_invalido ·
--   lineas_sin_cxc_o_ingreso · lineas_descuadradas · anulada_sin_reverso ·
--   par_de_anulacion_invalido · estado_sin_venta_posible · sana · sana_anulada_con_reverso.
-- `venta_invalida_sin_clasificar` no debería salir nunca: `i3_original_valid` dice que no y
-- ninguna subclase explica por qué. Si sale, este archivo se desalineó de la 0497.
\set ON_ERROR_STOP on
begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $guarda$
begin
  if pg_catalog.to_regprocedure('public.i3_original_valid(uuid,uuid,uuid)') is null then
    raise exception 'Este control es de después de la 0497: antes de aplicarla, usar scripts/qa/0497-legado-por-clase.sql.';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                 where name = '0497_reverso_al_anular_factura') then
    raise exception 'La 0497 no está en el ledger: sin su hora no se distingue qué se emitió en la ventana.';
  end if;
end;
$guarda$;

with recursive
aplicada as (
  select max(pg_catalog.to_timestamp(m.version || ' +00', 'YYYYMMDDHH24MISS TZH')) as t
  from supabase_migrations.schema_migrations m
  where m.name = '0497_reverso_al_anular_factura'
),
par as (
  select i.id as invoice_id, i.tenant_id, i.status::text as estado_factura, i.deleted_at,
    i.created_at, i.updated_at, i.issued_at,
    count(e.id) as todos,
    count(e.id) filter (where e.source = 'invoice' and e.reverses_entry_id is null) as originales,
    count(e.id) filter (where e.source = 'invoice_reversal') as reversos,
    (pg_catalog.array_agg(e.id) filter (where e.source = 'invoice' and e.reverses_entry_id is null))[1] as original_id
  from public.invoices i
  left join public.journal_entries e
    on (e.invoice_id = i.id and (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
    or e.reverses_entry_id in (select x.id from public.journal_entries x where x.invoice_id = i.id)
  group by i.id
),
lineas as (
  select l.id as line_id, p.invoice_id, p.tenant_id, l.account_id, l.debit, l.credit
  from par p
  join public.journal_lines l on l.entry_id = p.original_id
  where p.originales = 1
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
  select p.estado_factura, p.created_at, p.updated_at, p.issued_at,
    case
      when p.todos = 0 then 'sin_venta'
      when p.deleted_at is not null then 'factura_borrada_con_venta'
      when p.originales = 0 then 'reverso_sin_venta'
      when p.originales <> 1 then 'dos_o_mas_ventas'
      when p.todos <> p.originales + p.reversos then 'otros_asientos_en_el_par'
      when public.i3_original_valid(p.original_id, p.tenant_id, p.invoice_id) then
        case
          when p.estado_factura = 'anulada' and p.reversos <> 1 then 'anulada_sin_reverso'
          when p.estado_factura = 'anulada' then
            case when r.id is null or r.source <> 'invoice_reversal'
                   or r.invoice_id is distinct from p.invoice_id
                   or r.tenant_id is distinct from p.tenant_id
                   or r.status::text <> 'asentado' or r.deleted_at is not null
                   or r.posted_at is null or not pg_catalog.isfinite(r.posted_at)
                   or not pg_catalog.isfinite(r.entry_date)
                   or r.entry_date < e.entry_date
                   or not public.i3_mirror_valid(p.original_id, r.id)
                 then 'par_de_anulacion_invalido' else 'sana_anulada_con_reverso' end
          when p.estado_factura not in ('emitida','parcial','vencida','pagada') or p.reversos <> 0
            then 'estado_sin_venta_posible'
          else 'sana'
        end
      when e.tenant_id <> p.tenant_id then 'venta_de_otro_tenant'
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
      else 'venta_invalida_sin_clasificar'
    end as clase
  from par p
  left join public.journal_entries e on e.id = p.original_id and p.originales = 1
  left join public.journal_entries r on r.reverses_entry_id = p.original_id and p.originales = 1
  left join por_asiento a on a.invoice_id = p.invoice_id
),
leida as (
  select c.clase, c.estado_factura,
    case
      when c.clase in ('sana', 'sana_anulada_con_reverso') then 'cuadra'
      when c.clase = 'sin_venta'
        and c.estado_factura in ('emitida','parcial','vencida','pagada')
        and c.issued_at >= (ap.t at time zone 'America/Caracas')::date
        and greatest(c.created_at, c.updated_at) >= ap.t then 'sin_venta_fechas_recientes'
      when c.clase = 'sin_venta' then 'sin_venta_fechas_viejas'
      when c.estado_factura in ('emitida','parcial','vencida','pagada') then 'viva_no_cuadra'
      else 'no_viva_no_cuadra'
    end as diagnostico
  from clasificacion c cross join aplicada ap
)
select clase, estado_factura, diagnostico, count(*) as n
from leida
group by clase, estado_factura, diagnostico
order by diagnostico, clase, estado_factura;

rollback;
