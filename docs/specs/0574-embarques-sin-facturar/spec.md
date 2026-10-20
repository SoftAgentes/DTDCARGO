---
sdd: "0574"
title: "Embarques sin facturar: el reporte y las tarjetas en Dirección"
status: in-progress
author: "founder + Claude Opus 5.5"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0048", "0052", "0357", "0557", "0571"]
confidencialidad: interno
---

# SDD-0574 — Embarques sin facturar

> Un reporte dice qué carga recibida en Yiwu todavía no tiene factura fiscal y cuánto hay que facturar: primero lo que ya llegó a Venezuela, después lo que no tiene tarifa congelada y al final lo que va en camino con su tarifa. Dirección lo muestra en tres tarjetas.

**Estado:** implementado en la rama `codex/sdd-0574-embarques-sin-facturar`, apilada sobre la SDD-0571 (PR #307), porque lee su tabla `shipment_rate_snapshots`. Sin migración.

## Contexto

- **El plan contable** (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`): la 4.5 es «Reporte "Embarques sin facturar" y tarjetas en Dirección», tamaño S, sin migración, adelantada al carril paralelo con la 4.1 y la 4.2 («Mi ajuste» del §8). B17 lo pone entre los reportes que faltan.
- **Decisión 9** (2026-10-20): la factura fiscal sale al llegar a Venezuela, con vencimiento inmediato; antes, al consolidar, hay una pre-factura informativa. Por eso «llegó sin factura» es lo urgente, y un borrador no cuenta como facturado.
- **El Director** (2026-10-20) autorizó leer `invoices` solo en lectura, justificado en el BASELINE de `invoice-read-boundary`, sin escribir `invoices` ni tocar `lib/studio/accounting`, y avisándole a «Contabilidad» qué columnas se leen. Aviso enviado el mismo día.

## La regla (`lib/studio/rate-snapshots/sin-facturar.ts`)

- **Unidad: la recepción en Yiwu**, hasta la 4.2. El contenedor `C-` de hoy mezcla clientes; la recepción es por cliente y tiene su tarifa congelada (SDD-0571).
- **Facturada:** existe una factura viva del mismo envío y del mismo Shipping Mark (los dos con `upper(btrim())`) en emitida, parcial, pagada o vencida (los estados de SDD-0557/0558). Esa recepción no aparece.
- **Pre-factura:** un borrador del mismo envío y Shipping Mark no la cubre; se muestra su código.
- **Anulada:** no cuenta.
- **Fuera:** recepciones borradas, huérfanas, sin Shipping Mark o de un envío cancelado.
- **Estados**, en este orden:
  1. `llego_sin_factura`: el envío está en `arrived_destination`, `out_for_delivery`, `last_mile` o `delivered`, o tiene `arrived_destination_at`;
  2. `sin_tarifa`: no tiene tarifa congelada viva;
  3. `en_camino`: tiene tarifa y todavía no llegó.
- **A facturar:** el `amount_to_invoice` de la tarifa congelada (máx(CBM × tarifa, mínimo)).
- **Días:** desde la llegada si llegó con fecha; si no, desde la recepción. Dentro de cada estado, lo más viejo primero.

## Lectura

Con el cliente de SESIÓN, bajo RLS, solo lectura y paginada (`fetchAllPaged`, `fetchAllByIds`); si una lectura se corta en el tope de páginas, el reporte lo dice. Lee:
- `warehouse_receipts_cn`: `id, receipt_code, client_markbox, received_at, status, total_cbm, shipment_id`, vivas y no huérfanas;
- `shipments`: `id, code, status, arrived_destination_at` de esas recepciones;
- `invoices`: `id, invoice_code, shipment_id, client_markbox, status`, vivas, de esos envíos — `invoices_accounting_select` (0414) deja leer a accounting y admin, que son quienes ven Reportes y Dirección;
- `shipment_rate_snapshots`: las tarifas vivas (SDD-0571). Sin la 0496 aplicada, el reporte lo dice y todo cuenta como sin tarifa.

## Pantallas

- **Reporte** `/studio/reportes/embarques-sin-facturar`, bajo el layout de Reportes (`requireModuleView("reports")`: accounting + admin): tres tarjetas (cantidad y monto por estado), y la tabla con estado, recepción, Shipping Mark, envío, CBM, tarifa, a facturar, días y pre-factura. Enlace desde Reportes › Contables.
- **Dirección** (`requireModuleView("direccion")`, admin): la tarjeta «Por facturar» con los tres estados, cada uno enlazado al reporte.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/rate-snapshots/sin-facturar.ts` | la regla y la lectura |
| `lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts` | pruebas de la regla y de la lectura |
| `app/studio/(app)/reportes/embarques-sin-facturar/page.tsx` | el reporte |
| `app/studio/(app)/reportes/page.tsx` | el enlace desde Contables |
| `app/studio/(app)/direccion/page.tsx` | la tarjeta |
| `app/studio/(app)/direccion/_components/SinFacturarCard.tsx` | la tarjeta |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | el lector nuevo, justificado (20 archivos, 45 lecturas) |
| `docs/specs/0574-embarques-sin-facturar/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0574-embarques-sin-facturar.md` | handoff |

No toca `lib/studio/accounting`, `invoices` (solo lee), recibos ni tasas.

## Criterios de aceptación

1. Una recepción con factura fiscal viva del mismo envío y Shipping Mark no aparece; una de otro cliente del mismo contenedor no la cubre.
2. Un borrador no la cubre y se muestra como pre-factura; una anulada no cuenta.
3. Los tres estados, su orden, los días y el resumen por estado salen de la regla pura, con prueba.
4. La lectura filtra borradas, huérfanas, facturas borradas y tarifas reemplazadas, y no se rompe sin la 0496.
5. El lector de `invoices` está en el BASELINE, con su candado, tenant y uso escritos.
6. Reporte y tarjeta solo para quien ve Reportes (accounting, admin) y Dirección (admin).
7. Mutantes de la regla mueren.

## Pendiente

- **Después de la 4.2** (envío por cliente), la unidad pasa a ser el envío y la factura se cruza por `shipment_id` sin Shipping Mark.
- La auto-factura de la orden de venta (0128) liga la factura a la prealerta, no al envío: hoy esas facturas no se reconocen como cobertura. No hay casos medidos; SDD-0284 contó 0 de 8 compras con orden de venta.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| Lector nuevo de `invoices` (SDD-0357) | cumplimiento | BASELINE con candado, tenant y uso |
| Datos personales | no aplica | se muestran Shipping Marks y códigos, sin nombres ni RIF |
| LOD-01 / ERR-01 | cumplimiento | avisos de lectura incompleta y de la 0496 ausente con `role="status"` |

## Validación

Ver el handoff `.agents/handoffs/0574-embarques-sin-facturar.md`.
