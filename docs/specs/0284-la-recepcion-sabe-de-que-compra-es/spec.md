---
sdd: "0284"
title: "La recepción de Yiwu sabe de qué compra es — y por eso conoce al proveedor"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0057","0072","0281","0283"]
confidencialidad: interno
---

# DTD-0284 — La recepción sabe de qué compra es

> Iba a ser "vincular la recepción con el proveedor real" y necesitaba una
> migración. Al medir, resultó que el vínculo **ya existe** y nadie lo usa — y
> que la migración habría resuelto otra cosa.

## Lo que estaba mal en el plan original

El checklist decía (A2): *"`warehouse_receipts_cn` guarda `supplier_name` como
texto libre, sin FK a `suppliers_cn`. Consecuencia: no se puede responder ¿cuánto
me manda este proveedor? ni detectar que dos clientes compran al mismo"*.

Dos cosas de esa frase no sobrevivieron a la medición:

1. **`suppliers_cn` es POR CLIENTE**, no global: su clave es
   `(tenant_id, client_markbox, supplier_seq)`. La misma fábrica que le vende a
   tres clientes son **tres filas distintas**. Una FK a esa tabla nunca habría
   permitido "detectar que dos clientes compran al mismo" — eso pide una entidad
   de proveedor global, que es otro diseño.

2. **El vínculo al proveedor real ya existe, en cadena:**
   `warehouse_receipts_cn.prealerta_id → prealertas.supplier_id → suppliers_cn`.
   Y las compras lo traen: **8 de 8 (100%) tienen `supplier_id`**.

## Lo que la medición sí encontró (2026-08-24, producción)

| Medida | Valor |
|---|---|
| Recepciones en bodega CN | **6** |
| Recepciones atadas a su compra (`prealerta_id`) | **0** 🔴 |
| Compras | 8 · todas `anunciada` |
| Compras con `supplier_id` | **8 (100%)** |
| Compras con **orden de venta** (`sales_order_id`) | **0** 🔴 |
| Cajas pre-declaradas | 128 (29 con compra · 99 legado sin compra) |

El `0 de 6` tiene una causa exacta: el único punto que ataba la compra
—`createReceiptAction`— lo hacía con la regla **financiera**, exigiendo que la
compra tuviera una orden de venta sin facturar. Como **ninguna compra tiene orden
de venta**, esa condición no se cumplió nunca.

**El daño no era financiero, era operativo.** Sin ese vínculo:

- `/portal/compras/[code]` (SDD-0281) le dice *"todavía no registramos la
  llegada"* al cliente cuya mercancía **sí está en la bodega**;
- el aviso de SDD-0283 se queda sin compra de la que colgar;
- y la recepción no puede saber de qué proveedor vino, aunque el dato exista.

## Alcance

### Entra

1. **Separar el vínculo operativo del financiero** en `createReceiptAction`:
   - `prealerta_id` → *"¿de qué compra es esta mercancía?"*. Regla: **una sola
     compra abierta** del cliente. Sin exigir orden de venta.
   - `sales_order_id` → *"¿qué OV cumple?"*. **Regla intacta**: OV atada y aún
     sin facturar.
2. **El cliente ve el proveedor que él registró.** En el detalle de compra, cada
   recepción muestra el nombre de `suppliers_cn`; el texto que escribió la bodega
   sólo aparece **cuando difiere** (a veces llega en chino o abreviado).

### No entra

**Una entidad de proveedor global** (la misma fábrica compartida entre clientes).
Es lo que de verdad respondería "¿cuánto me manda este proveedor?" a nivel
empresa, y es un diseño propio — con deduplicación, fusión y su propia UI. Con
**6 recepciones** en el sistema, construirlo hoy sería resolver un problema que
todavía no tiene datos.

### Por qué aflojar el vínculo operativo NO puede facturar de más

No es una opinión, es el camino del código: `autoInvoiceForReceipt` delega en el
RPC `sales_order_claim_and_invoice` (migr 0128), que devuelve **`no_sales_order`**
cuando la compra no resuelve una OV; la action lo traduce a `notApplicable` y
**no emite nada**. Una caja sin OV se ata para que el cliente vea su llegada, y
el motor financiero la ignora.

Y la regla conservadora se mantiene donde importa: **con dos o más compras
abiertas no se elige ninguna**. Atar la equivocada le mostraría al cliente que
llegó algo que no llegó.

### Sin migración

`warehouse_receipts_cn.prealerta_id` existe desde la migr 0127, con índice. Esto
es código, no schema.

## Adjuntos

Ninguno.
