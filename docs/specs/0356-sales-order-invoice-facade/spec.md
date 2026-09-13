---
sdd: 0356
title: Minimizar referencias de facturas en Órdenes de venta
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0072
  - SDD-0252
  - SDD-0322
  - SDD-0350
confidencialidad: interno
---

# SDD-0356 — Facturas mínimas por orden de venta

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commit
> `3ca9a79d`) con su contenido original, `status: done` incluido: ese estado describe el cierre técnico
> local de la rama de origen, no la aplicación en producción. Su migración
> `0413_sales_order_invoice_facade` está **PENDIENTE DE APLICAR** y declarada en
> `supabase/migrations-baseline.json`; fusionar no autoriza aplicarla. Lote L07 del bloque C: **0407 →
> 0411, 0412 y 0413 → despliegue y smoke por roles → 0414**. Es **MIGRATE-FIRST**: sin 0413 la RPC no
> existe (PGRST202, medido), `listInvoicesForSalesOrder` lanza y la página de Órdenes de venta falla en
> cuanto hay una orden; declarado en `supabase/pending-migration-symbol-declarations.json`.
>
> Cortes: de `lib/studio/sales-orders/queries.ts` sólo entran el import de `fetchAllByIds`,
> `SalesOrderInvoiceRef` sin fechas y `listInvoicesForSalesOrder` sobre el nuevo
> `listInvoicesBySalesOrder`. No entran `listPrealertasBySalesOrder` ni la columna `sales_order_id` de
> prealertas, que son de SDD-0322 (commit `1faff60b`), cuyo código no está en `main`.
> `lib/studio/__tests__/orders-relations-batch.test.ts` nace recortado a los casos de facturas
> (agrupación por RPC sin consulta por orden, error que no se vuelve vacío y lote vacío), más un caso
> nuevo: el helper de una orden delega en la misma RPC. Se omiten los casos de ítems de compra, de
> prealertas y la lectura de las páginas, que son de SDD-0322. La página
> `app/studio/(app)/ordenes-venta/page.tsx` no está en la allowlist y sigue pidiendo las referencias por
> orden: el criterio «sin una query por orden» se cumple en el helper, no en la página. Paridad medida
> contra `main` con datos sintéticos y PostgREST: mismos estados, mismo filtro de facturas borradas y
> mismo aislamiento; **diverge** donde `main` truncaba en 200 facturas por orden (200 → 210) y oculta las
> facturas de una orden borrada, que la página no lista. No se importan el checklist
> `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la allowlist;
> entran fuera de ella los dos registros de migraciones pendientes y el handoff
> `.agents/handoffs/c-l07-fidelizacion-conversations.md`. Sin desviaciones en SQL ni en el contrato.

## Estado real

El drawer de Órdenes de venta sólo usa id, código, monto y estado de factura.
La query leía `invoices` directamente y enviaba fechas que el componente no
consume. Además, su catch convertía un fallo de lectura en “sin facturas”.

## Decisión

1. Crear `sales_order_invoice_refs(uuid[])`, sin tenant arbitrario y limitada
   a 500 órdenes por llamada; el helper conserva lotes y paginación completa.
2. Exigir permiso efectivo de `sales-orders`, incluyendo overrides. El default
   sigue siendo `commercial|operations|accounting`, con admin universal.
3. Exigir que tanto la orden como la factura pertenezcan al tenant activo y
   estén vivas. Conservar todos los estados de factura para su trazabilidad.
4. Devolver sólo id de factura/orden, código, total, estado y `created_at` para
   ordenar páginas. La aplicación no transmite fechas al componente.
5. Propagar errores y truncamiento, sin presentar un vacío inventado.
6. Mantener todavía la policy SELECT general de `invoices` hasta el slice de
   cierre con inventario de consumidores.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: rol efectivo, membresía y tenant se prueban en SQL;
  ids de otro tenant o de órdenes retiradas no devuelven facturas.
- `cumplimiento` SGE-00.11: errores de la RPC no se convierten en listas vacías.
- `cumplimiento` MP-01: se excluyen cliente, líneas, tasas, notas y datos fiscales.
- `no aplica`: UI, escritura financiera, captura o traslado de PII.

## Allowlist exacta

- `lib/studio/sales-orders/queries.ts`
- `lib/studio/__tests__/orders-relations-batch.test.ts`
- `supabase/migrations/0413_sales_order_invoice_facade.sql`
- `supabase/tests/0413_sales_order_invoice_facade.test.sql`
- `docs/specs/0356-sales-order-invoice-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-sales-order-invoice-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- El helper no consulta `invoices` directamente ni ejecuta una query por orden.
- Roles, overrides, membresía desactivada, dos tenants, soft-delete y límite
  de lote quedan cubiertos por SQL con rollback.
- El componente no recibe fechas; fallos no producen falsos vacíos.
- Vitest focal, TypeScript, lint, SQL, rebuild, docs, numeración, gobernanza,
  componentes y diff pasan.

## Fuera de alcance

- Endurecer todavía SELECT de `invoices` o cambiar creación/estados de factura.
- Cambiar moneda o formato visual del drawer.
- Aplicar 0413 a Cloud/Producción.
