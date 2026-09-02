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
